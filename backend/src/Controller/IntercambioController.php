<?php

namespace App\Controller;

use App\Entity\EstadoExcepcion;
use App\Entity\ExcepcionHorario;
use App\Entity\Horario;
use App\Entity\TipoExcepcion;
use App\Entity\User;
use Doctrine\ORM\EntityManagerInterface;
use Symfony\Bundle\FrameworkBundle\Controller\AbstractController;
use Symfony\Component\HttpFoundation\JsonResponse;
use Symfony\Component\HttpFoundation\Request;
use Symfony\Component\HttpFoundation\Response;
use Symfony\Component\Routing\Attribute\Route;
use Symfony\Component\Security\Http\Attribute\CurrentUser;
use Symfony\Component\Validator\Validator\ValidatorInterface;

/**
 * Endpoint dedicado a crear un INTERCAMBIO bilateral atómico.
 *
 * Body esperado:
 *   {
 *     "horarioBaseA":   "/api/horarios/123",   // bloque mío que cedo
 *     "fechaConcretaA": "2026-05-15",          // día en que NO voy
 *     "horarioBaseB":   "/api/horarios/456",   // bloque del otro profe que cubriré
 *     "fechaConcretaB": "2026-05-22",          // día en que cubro al otro
 *     "motivo":         "Cambio acordado",
 *     "observaciones":  "Texto libre opcional"
 *   }
 *
 * Crea dos `ExcepcionHorario` linked vía `intercambioPareja` (self-FK
 * bidireccional). Cada cara tiene `imparticionEfectiva` apuntando a la
 * imparticion del otro profe (la que de facto se imparte ese día).
 *
 * Estado:
 *  - Si solicitante es profe puro → ambas caras PENDIENTE_APROBACION.
 *  - Si solicitante es admin/superadmin → ambas APROBADA + aprobadaPor + fechaResolucion.
 *
 * El subscriber `NotificationDispatchSubscriber` se activa en postPersist
 * y emite las notificaciones correspondientes (al admin si pendiente, a
 * los afectados si aprobada).
 *
 * Doc: docs/hoja-de-ruta-intercambio-imparticiones.md Fase E.
 */
class IntercambioController extends AbstractController
{
    public function __construct(
        private readonly EntityManagerInterface $em,
        private readonly ValidatorInterface $validator,
    ) {
    }

    #[Route(
        '/api/v1/excepciones/intercambio',
        name: 'api_excepciones_intercambio_create',
        methods: ['POST']
    )]
    public function crear(#[CurrentUser] ?User $user, Request $request): JsonResponse
    {
        if ($user === null) {
            return $this->json(['message' => 'No autenticado'], Response::HTTP_UNAUTHORIZED);
        }
        if (
            !$this->isGranted('ROLE_PROFESOR')
            && !$this->isGranted('ROLE_ADMIN')
            && !$this->isGranted('ROLE_SUPERADMIN')
        ) {
            return $this->json(['message' => 'Acceso denegado'], Response::HTTP_FORBIDDEN);
        }

        $payload = json_decode($request->getContent(), true);
        if (!is_array($payload)) {
            return $this->json(['message' => 'JSON inválido'], Response::HTTP_BAD_REQUEST);
        }

        $idA = $this->extractIdFromIri($payload['horarioBaseA'] ?? null);
        $idB = $this->extractIdFromIri($payload['horarioBaseB'] ?? null);
        $fechaA = $payload['fechaConcretaA'] ?? null;
        $fechaB = $payload['fechaConcretaB'] ?? null;
        if (!$idA || !$idB || !$fechaA || !$fechaB) {
            return $this->json([
                'message' => 'Faltan campos obligatorios (horarioBaseA, horarioBaseB, fechaConcretaA, fechaConcretaB).',
            ], Response::HTTP_BAD_REQUEST);
        }
        if ($idA === $idB) {
            return $this->json(['message' => 'Los dos bloques deben ser distintos.'], Response::HTTP_BAD_REQUEST);
        }

        $horarioA = $this->em->find(Horario::class, $idA);
        $horarioB = $this->em->find(Horario::class, $idB);
        if (!$horarioA || !$horarioB) {
            return $this->json(['message' => 'Bloque no encontrado.'], Response::HTTP_NOT_FOUND);
        }

        $impA = $horarioA->getImparticion();
        $impB = $horarioB->getImparticion();
        if (!$impA || !$impB) {
            return $this->json(['message' => 'Bloques sin imparticion asociada.'], Response::HTTP_UNPROCESSABLE_ENTITY);
        }

        // Misma centro requerido para que el filtro CurrentUserExtension siga
        // siendo coherente. Sin esta restricción un profe podría intentar
        // intercambiar con un grupo de otro centro.
        $centroA = $impA->getGrupo()?->getCentro();
        $centroB = $impB->getGrupo()?->getCentro();
        if ($centroA === null || $centroB === null || $centroA->getId() !== $centroB->getId()) {
            return $this->json(['message' => 'Los dos bloques deben ser del mismo centro.'], Response::HTTP_UNPROCESSABLE_ENTITY);
        }

        // Profes distintos (intercambio entre dos personas).
        $profA = $impA->getProfesor();
        $profB = $impB->getProfesor();
        if ($profA === null || $profB === null || $profA->getId() === $profB->getId()) {
            return $this->json(['message' => 'Los dos bloques deben pertenecer a profesores distintos.'], Response::HTTP_UNPROCESSABLE_ENTITY);
        }

        try {
            $fA = new \DateTimeImmutable($fechaA);
            $fB = new \DateTimeImmutable($fechaB);
        } catch (\Exception) {
            return $this->json(['message' => 'Formato de fecha inválido.'], Response::HTTP_BAD_REQUEST);
        }

        // Día de semana de cada fecha debe coincidir con su horario base.
        if ((int) $fA->format('N') !== $horarioA->getDiaSemana()) {
            return $this->json(['message' => 'fechaConcretaA no coincide con el día de semana del bloque A.'], Response::HTTP_UNPROCESSABLE_ENTITY);
        }
        if ((int) $fB->format('N') !== $horarioB->getDiaSemana()) {
            return $this->json(['message' => 'fechaConcretaB no coincide con el día de semana del bloque B.'], Response::HTTP_UNPROCESSABLE_ENTITY);
        }

        $isAdmin = $this->isGranted('ROLE_ADMIN') || $this->isGranted('ROLE_SUPERADMIN');
        $estado  = $isAdmin ? EstadoExcepcion::APROBADA : EstadoExcepcion::PENDIENTE_APROBACION;
        $now     = new \DateTimeImmutable();

        $excA = (new ExcepcionHorario())
            ->setHorarioBase($horarioA)
            ->setFechaConcreta($fA)
            ->setTipo(TipoExcepcion::INTERCAMBIO)
            ->setImparticionEfectiva($impB)  // El día A se imparte LA otra clase.
            ->setMotivo($payload['motivo'] ?? null)
            ->setObservaciones($payload['observaciones'] ?? null)
            ->setEstado($estado)
            ->setSolicitadaPor($user)
            ->setFechaSolicitud($now);

        $excB = (new ExcepcionHorario())
            ->setHorarioBase($horarioB)
            ->setFechaConcreta($fB)
            ->setTipo(TipoExcepcion::INTERCAMBIO)
            ->setImparticionEfectiva($impA)
            ->setMotivo($payload['motivo'] ?? null)
            ->setObservaciones($payload['observaciones'] ?? null)
            ->setEstado($estado)
            ->setSolicitadaPor($user)
            ->setFechaSolicitud($now);

        if ($isAdmin) {
            $excA->setAprobadaPor($user)->setFechaResolucion($now);
            $excB->setAprobadaPor($user)->setFechaResolucion($now);
        }

        // Validators de la entidad (Assert\Callback validateCoherencia, etc.)
        // Ojo: el callback comprueba CANCELADO + EVENTO_ESPECIAL; INTERCAMBIO
        // no tiene reglas estrictas en Fase A, solo coherencia día-semana
        // que ya hemos comprobado arriba a mano.
        foreach ([$excA, $excB] as $exc) {
            $errors = $this->validator->validate($exc);
            if (count($errors) > 0) {
                return $this->json([
                    'message' => 'Error de validación',
                    'detail'  => (string) $errors,
                ], Response::HTTP_UNPROCESSABLE_ENTITY);
            }
        }

        // Persistencia atómica con vinculación bidireccional.
        $this->em->persist($excA);
        $this->em->persist($excB);
        // Necesitamos el ID de cada uno antes de cruzar referencias.
        $this->em->flush();
        $excA->setIntercambioPareja($excB);
        $excB->setIntercambioPareja($excA);
        $this->em->flush();

        return $this->json([
            'a' => ['id' => $excA->getId(), 'estado' => $excA->getEstado()->value],
            'b' => ['id' => $excB->getId(), 'estado' => $excB->getEstado()->value],
            'aprobada' => $isAdmin,
        ], Response::HTTP_CREATED);
    }

    private function extractIdFromIri(?string $iri): ?int
    {
        if (!is_string($iri) || $iri === '') return null;
        $parts = explode('/', trim($iri, '/'));
        $last = end($parts);
        return is_numeric($last) ? (int) $last : null;
    }
}
