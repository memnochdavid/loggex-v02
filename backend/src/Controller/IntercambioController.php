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
 * Endpoint para crear un INTERCAMBIO atómico — Plan B (multi-bloque).
 *
 * Body esperado:
 *   {
 *     "horarioBaseA":   "/api/horarios/123",   // bloque mío que cedo
 *     "fechaConcretaA": "2026-05-15",          // día en que NO voy
 *     "parejasB": [                            // lado B: 1+ bloques del otro profe
 *       { "horarioBaseB": "/api/horarios/456", "fechaConcretaB": "2026-05-22" },
 *       { "horarioBaseB": "/api/horarios/789", "fechaConcretaB": "2026-05-29" }
 *     ],
 *     "motivo":         "Cambio acordado",
 *     "observaciones":  "Texto libre opcional"
 *   }
 *
 * Backward-compat: si el body llega con `horarioBaseB`/`fechaConcretaB`
 * (formato Plan A pre-2026-05-08), se convierte en `parejasB: [{...}]` de un
 * elemento. El cliente legado sigue funcionando.
 *
 * Crea 1 cara A + N caras B, todas con el mismo `intercambioGrupoId` UUID
 * (Plan B refactor pareja → grupo). Para 1↔1 también se setea
 * `intercambioPareja` legacy en ambas caras (compatibilidad con render
 * existente). Para 1↔N el campo legacy queda NULL.
 *
 * Reglas:
 *  - Mismo centro entre A y todas las B.
 *  - Profe de A distinto del profe de las B (todas las B del MISMO profe;
 *    multi-profe queda diferido — Plan B2 si surge).
 *  - Cada fecha coincide con el diaSemana de su horario base.
 *  - **Σ duración B == duración A** (swap equilibrado en minutos totales,
 *    aunque distinto número de bloques).
 *
 * Estado:
 *  - Solicitante profe puro → todas las caras PENDIENTE_APROBACION.
 *  - Solicitante admin/superadmin → todas APROBADA + aprobadaPor + fechaResolucion.
 *
 * El cascade subscriber (IntercambioGrupoCascadeSubscriber) propaga
 * cambios de estado a todas las caras del grupo en el mismo flush. El
 * NotificationDispatchSubscriber emite las notificaciones a los
 * afectados de cada cara independientemente.
 *
 * Doc: docs/hoja-de-ruta-intercambio-imparticiones.md Fase E + Plan B.
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

        // Backward-compat con clientes Plan A: si llega `horarioBaseB` y
        // `fechaConcretaB` singulares, los convertimos a `parejasB: [{...}]`.
        if (!isset($payload['parejasB']) && isset($payload['horarioBaseB'])) {
            $payload['parejasB'] = [[
                'horarioBaseB'   => $payload['horarioBaseB'],
                'fechaConcretaB' => $payload['fechaConcretaB'] ?? null,
            ]];
        }

        $idA = $this->extractIdFromIri($payload['horarioBaseA'] ?? null);
        $fechaAStr = $payload['fechaConcretaA'] ?? null;
        $parejasB = $payload['parejasB'] ?? null;

        if (!$idA || !$fechaAStr || !is_array($parejasB) || $parejasB === []) {
            return $this->json([
                'message' => 'Faltan campos obligatorios (horarioBaseA, fechaConcretaA, parejasB).',
            ], Response::HTTP_BAD_REQUEST);
        }

        $horarioA = $this->em->find(Horario::class, $idA);
        if (!$horarioA) {
            return $this->json(['message' => 'Bloque A no encontrado.'], Response::HTTP_NOT_FOUND);
        }
        $impA = $horarioA->getImparticion();
        $profA = $impA?->getProfesor();
        $centroA = $impA?->getGrupo()?->getCentro();
        if ($impA === null || $profA === null || $centroA === null) {
            return $this->json(['message' => 'Bloque A sin imparticion / profesor / centro.'], Response::HTTP_UNPROCESSABLE_ENTITY);
        }

        try {
            $fA = new \DateTimeImmutable($fechaAStr);
        } catch (\Exception) {
            return $this->json(['message' => 'Formato de fechaConcretaA inválido.'], Response::HTTP_BAD_REQUEST);
        }
        if ((int) $fA->format('N') !== $horarioA->getDiaSemana()) {
            return $this->json(['message' => 'fechaConcretaA no coincide con el día de semana del bloque A.'], Response::HTTP_UNPROCESSABLE_ENTITY);
        }

        $durA = $this->durationMinutes($horarioA);
        if ($durA === null) {
            return $this->json(['message' => 'No se pudo calcular la duración del bloque A.'], Response::HTTP_UNPROCESSABLE_ENTITY);
        }

        // Procesa cada parejaB: validación individual + recopilación.
        $horariosB = [];
        $fechasB   = [];
        $durTotalB = 0;
        $profBId   = null;
        // Unicidad por (horario_id, fecha_concreta): el mismo bloque
        // recurrente puede usarse en fechas distintas (p.ej. Sara cede
        // el mismo Mar 8:30-9:30 dos semanas seguidas para cubrir 2h).
        // No rechazamos `idB` repetido si la fecha cambia.
        $tuplasVistas = [];
        // Y también prohibimos que B coincida con A — un profe no puede
        // intercambiarse consigo mismo en su propio bloque.
        $idANoEsB = $idA;
        foreach ($parejasB as $i => $par) {
            if (!is_array($par)) {
                return $this->json(['message' => "parejasB[$i] debe ser un objeto."], Response::HTTP_BAD_REQUEST);
            }
            $idB       = $this->extractIdFromIri($par['horarioBaseB'] ?? null);
            $fechaBStr = $par['fechaConcretaB'] ?? null;
            if (!$idB || !$fechaBStr) {
                return $this->json([
                    'message' => "parejasB[$i] sin horarioBaseB o fechaConcretaB.",
                ], Response::HTTP_BAD_REQUEST);
            }
            $tupla = "$idB|$fechaBStr";
            if (isset($tuplasVistas[$tupla])) {
                return $this->json([
                    'message' => "parejasB[$i] duplicada (mismo bloque y fecha que otra pareja).",
                ], Response::HTTP_BAD_REQUEST);
            }
            $tuplasVistas[$tupla] = true;
            if ($idB === $idANoEsB && $fechaBStr === $fechaAStr) {
                return $this->json([
                    'message' => "parejasB[$i] coincide exactamente con el bloque A.",
                ], Response::HTTP_BAD_REQUEST);
            }

            $hB = $this->em->find(Horario::class, $idB);
            if (!$hB) {
                return $this->json(['message' => "parejasB[$i] bloque no encontrado."], Response::HTTP_NOT_FOUND);
            }
            $impB    = $hB->getImparticion();
            $profB   = $impB?->getProfesor();
            $centroB = $impB?->getGrupo()?->getCentro();
            if ($impB === null || $profB === null || $centroB === null) {
                return $this->json([
                    'message' => "parejasB[$i] sin imparticion / profesor / centro.",
                ], Response::HTTP_UNPROCESSABLE_ENTITY);
            }
            if ($centroB->getId() !== $centroA->getId()) {
                return $this->json([
                    'message' => "parejasB[$i] es de otro centro distinto al bloque A.",
                ], Response::HTTP_UNPROCESSABLE_ENTITY);
            }
            if ($profB->getId() === $profA->getId()) {
                return $this->json([
                    'message' => "parejasB[$i] pertenece al mismo profesor que A — no es un intercambio.",
                ], Response::HTTP_UNPROCESSABLE_ENTITY);
            }
            // Plan B: todas las parejasB deben pertenecer al MISMO profesor B.
            // Multi-profe queda diferido (Plan B2).
            if ($profBId === null) {
                $profBId = $profB->getId();
            } elseif ($profBId !== $profB->getId()) {
                return $this->json([
                    'message' => 'Plan B solo permite intercambio con UN profesor B (todas las parejasB deben ser de la misma persona).',
                ], Response::HTTP_UNPROCESSABLE_ENTITY);
            }

            try {
                $fB = new \DateTimeImmutable($fechaBStr);
            } catch (\Exception) {
                return $this->json([
                    'message' => "parejasB[$i] fechaConcretaB con formato inválido.",
                ], Response::HTTP_BAD_REQUEST);
            }
            if ((int) $fB->format('N') !== $hB->getDiaSemana()) {
                return $this->json([
                    'message' => "parejasB[$i] fechaConcretaB no coincide con el día de semana del bloque.",
                ], Response::HTTP_UNPROCESSABLE_ENTITY);
            }

            $durB = $this->durationMinutes($hB);
            if ($durB === null) {
                return $this->json([
                    'message' => "parejasB[$i] no se pudo calcular la duración.",
                ], Response::HTTP_UNPROCESSABLE_ENTITY);
            }

            $horariosB[] = $hB;
            $fechasB[]   = $fB;
            $durTotalB  += $durB;
        }

        // Validación clave del Plan B: Σ minutos B == minutos A.
        if ($durTotalB !== $durA) {
            return $this->json([
                'message' => sprintf(
                    'Intercambio desequilibrado: el bloque A dura %d min y la suma de las %d parejas B es %d min. Total debe coincidir.',
                    $durA, count($horariosB), $durTotalB
                ),
            ], Response::HTTP_UNPROCESSABLE_ENTITY);
        }

        $isAdmin = $this->isGranted('ROLE_ADMIN') || $this->isGranted('ROLE_SUPERADMIN');
        $estado  = $isAdmin ? EstadoExcepcion::APROBADA : EstadoExcepcion::PENDIENTE_APROBACION;
        $now     = new \DateTimeImmutable();
        $grupoId = $this->generateUuidV4();

        // Cara A: imparticionEfectiva apunta a la imp del único profe B.
        // Para 1↔1 esto reproduce el comportamiento clásico (titular ve
        // "↔ Joaquín" en su clase). Para 1↔N el render del frontend
        // también puede usarlo como "uno de los que cubrirán" — la lista
        // completa la enumera buscando por intercambioGrupoId.
        $impBPrimera = $horariosB[0]->getImparticion();

        $excA = (new ExcepcionHorario())
            ->setHorarioBase($horarioA)
            ->setFechaConcreta($fA)
            ->setTipo(TipoExcepcion::INTERCAMBIO)
            ->setImparticionEfectiva($impBPrimera)
            ->setMotivo($payload['motivo'] ?? null)
            ->setObservaciones($payload['observaciones'] ?? null)
            ->setEstado($estado)
            ->setSolicitadaPor($user)
            ->setFechaSolicitud($now)
            ->setIntercambioGrupoId($grupoId);

        if ($isAdmin) {
            $excA->setAprobadaPor($user)->setFechaResolucion($now);
        }

        $excsB = [];
        foreach ($horariosB as $i => $hB) {
            $excB = (new ExcepcionHorario())
                ->setHorarioBase($hB)
                ->setFechaConcreta($fechasB[$i])
                ->setTipo(TipoExcepcion::INTERCAMBIO)
                ->setImparticionEfectiva($impA)  // todas las B apuntan a la única imp A
                ->setMotivo($payload['motivo'] ?? null)
                ->setObservaciones($payload['observaciones'] ?? null)
                ->setEstado($estado)
                ->setSolicitadaPor($user)
                ->setFechaSolicitud($now)
                ->setIntercambioGrupoId($grupoId);
            if ($isAdmin) {
                $excB->setAprobadaPor($user)->setFechaResolucion($now);
            }
            $excsB[] = $excB;
        }

        // Validación de entidad (Assert\Callback, etc.).
        foreach (array_merge([$excA], $excsB) as $exc) {
            $errors = $this->validator->validate($exc);
            if (count($errors) > 0) {
                return $this->json([
                    'message' => 'Error de validación',
                    'detail'  => (string) $errors,
                ], Response::HTTP_UNPROCESSABLE_ENTITY);
            }
        }

        // Persistencia atómica.
        $this->em->persist($excA);
        foreach ($excsB as $excB) {
            $this->em->persist($excB);
        }
        $this->em->flush();

        // Backward-compat: para el caso 1↔1 también vinculamos via el
        // legacy `intercambioPareja` self-FK (lo usan algunos lugares
        // del frontend que aún no leen `intercambioGrupoId`). Para 1↔N
        // queda NULL — el frontend que sea grupo-aware enumera por
        // grupoId; el legacy puede ignorar la cara A si no ve pareja.
        if (count($excsB) === 1) {
            $excA->setIntercambioPareja($excsB[0]);
            $excsB[0]->setIntercambioPareja($excA);
            $this->em->flush();
        }

        return $this->json([
            'a' => ['id' => $excA->getId(), 'estado' => $excA->getEstado()->value],
            'b' => array_map(fn ($e) => ['id' => $e->getId(), 'estado' => $e->getEstado()->value], $excsB),
            'grupoId' => $grupoId,
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

    /**
     * Duración en minutos de un Horario. Usa horaInicio/horaFin (TIME_MUTABLE)
     * sin TZ — son horas reloj, no datetimes.
     */
    private function durationMinutes(Horario $h): ?int
    {
        $hi = $h->getHoraInicio();
        $hf = $h->getHoraFin();
        if ($hi === null || $hf === null) return null;
        return (int) (($hf->getTimestamp() - $hi->getTimestamp()) / 60);
    }

    /**
     * UUID v4 RFC 4122 con PHP nativo (sin depender de symfony/uid).
     * 16 bytes random + bits de versión (4) y variante (RFC 4122).
     */
    private function generateUuidV4(): string
    {
        $data = random_bytes(16);
        $data[6] = chr((ord($data[6]) & 0x0f) | 0x40);  // version 4
        $data[8] = chr((ord($data[8]) & 0x3f) | 0x80);  // variant RFC 4122
        return vsprintf('%s%s-%s-%s-%s-%s%s%s', str_split(bin2hex($data), 4));
    }
}
