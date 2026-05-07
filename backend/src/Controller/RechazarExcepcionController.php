<?php

namespace App\Controller;

use App\Entity\EstadoExcepcion;
use App\Entity\ExcepcionHorario;
use App\Entity\TipoExcepcion;
use App\Entity\User;
use Doctrine\ORM\EntityManagerInterface;
use Symfony\Bundle\FrameworkBundle\Controller\AbstractController;
use Symfony\Component\HttpFoundation\JsonResponse;
use Symfony\Component\HttpFoundation\Request;
use Symfony\Component\HttpFoundation\Response;
use Symfony\Component\Routing\Attribute\Route;
use Symfony\Component\Security\Http\Attribute\CurrentUser;

/**
 * Endpoint para que el destinatario semántico de una incidencia la rechace
 * antes de que el admin firme.
 *
 * Quién es destinatario por tipo:
 *  - SUSTITUCION / EVENTO_ESPECIAL → profeOverride.
 *  - INTERCAMBIO → imparticionEfectiva.profesor (la otra cara). El
 *    cascade subscriber propaga el rechazo a la pareja.
 *  - CANCELADO → nadie (el admin/profe titular cancela su propia clase
 *    sin necesidad de consentimiento de un destinatario).
 *
 * Reusa el modelo existente: estado=RECHAZADA, aprobadaPor=destinatario
 * (el campo guarda quien resolvió, sea admin o destinatario), respuesta
 * del destinatario en `respuestaAdmin` (campo renombrable conceptualmente
 * a "respuesta de quien resolvió" si surge la necesidad).
 *
 * Doc: docs/hoja-de-ruta-intercambio-imparticiones.md Topic 1.
 */
class RechazarExcepcionController extends AbstractController
{
    public function __construct(
        private readonly EntityManagerInterface $em,
    ) {
    }

    #[Route(
        '/api/v1/excepciones/{id}/rechazar',
        name: 'api_excepciones_rechazar_destinatario',
        methods: ['POST'],
        requirements: ['id' => '\d+']
    )]
    public function rechazar(
        int $id,
        #[CurrentUser] ?User $user,
        Request $request
    ): JsonResponse {
        if ($user === null) {
            return $this->json(['message' => 'No autenticado'], Response::HTTP_UNAUTHORIZED);
        }

        $eh = $this->em->find(ExcepcionHorario::class, $id);
        if (!$eh || $eh->isDeleted()) {
            return $this->json(['message' => 'Incidencia no encontrada.'], Response::HTTP_NOT_FOUND);
        }

        if ($eh->getEstado() !== EstadoExcepcion::PENDIENTE_APROBACION) {
            return $this->json([
                'message' => 'Solo se puede rechazar una incidencia pendiente.',
            ], Response::HTTP_UNPROCESSABLE_ENTITY);
        }

        // Detectar quién está autorizado a rechazar según el tipo.
        $tipo = $eh->getTipo();
        $callerId = $user->getId();
        $autorizadosIds = [];
        if ($tipo === TipoExcepcion::SUSTITUCION || $tipo === TipoExcepcion::EVENTO_ESPECIAL) {
            // Solo el sustituto/facilitador (destinatario semántico) puede rechazar.
            // El titular no decide aquí (él es quien solicitó o aceptó cubrir).
            $override = $eh->getProfeOverride()?->getId();
            if ($override !== null) $autorizadosIds[] = $override;
        } elseif ($tipo === TipoExcepcion::INTERCAMBIO) {
            // Plan B: ambos profes envueltos en CUALQUIERA de las dos
            // posiciones (titular del horarioBase O imparticionEfectiva.profesor)
            // pueden rechazar. Es un acuerdo bilateral; cualquiera de las
            // partes puede romperlo y la cascade propaga al grupo.
            $titularId = $eh->getHorarioBase()?->getImparticion()?->getProfesor()?->getId();
            $efectivoId = $eh->getImparticionEfectiva()?->getProfesor()?->getId();
            if ($titularId !== null) $autorizadosIds[] = $titularId;
            if ($efectivoId !== null) $autorizadosIds[] = $efectivoId;
        } elseif ($tipo === TipoExcepcion::CANCELADO) {
            return $this->json([
                'message' => 'Las cancelaciones no tienen destinatario que pueda rechazar.',
            ], Response::HTTP_UNPROCESSABLE_ENTITY);
        }

        if (!in_array($callerId, $autorizadosIds, true)) {
            return $this->json([
                'message' => 'No estás autorizado a rechazar esta incidencia.',
            ], Response::HTTP_FORBIDDEN);
        }

        $payload = json_decode($request->getContent(), true);
        $respuesta = is_array($payload) ? ($payload['respuesta'] ?? null) : null;

        $eh->setEstado(EstadoExcepcion::RECHAZADA)
           ->setAprobadaPor($user)
           ->setFechaResolucion(new \DateTimeImmutable());
        if (is_string($respuesta) && $respuesta !== '') {
            $eh->setRespuestaAdmin($respuesta);
        }

        // El IntercambioParejaCascadeSubscriber propagará a la pareja
        // (caso intercambio bilateral) en el mismo flush.
        // El NotificationDispatchSubscriber emitirá `excepcion_rechazada`
        // al solicitante automáticamente vía preUpdate.
        $this->em->flush();

        return $this->json([
            'id' => $eh->getId(),
            'estado' => $eh->getEstado()->value,
        ]);
    }
}
