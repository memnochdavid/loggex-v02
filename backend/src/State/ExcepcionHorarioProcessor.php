<?php

namespace App\State;

use ApiPlatform\Metadata\Operation;
use ApiPlatform\Metadata\Post;
use ApiPlatform\State\ProcessorInterface;
use App\Entity\EstadoExcepcion;
use App\Entity\ExcepcionHorario;
use App\Entity\User;
use Symfony\Bundle\SecurityBundle\Security;
use Symfony\Component\DependencyInjection\Attribute\Autowire;

/**
 * Procesador para `ExcepcionHorario` en POST/PATCH.
 *
 * Reglas (D-C 2026-05-07):
 *   - POST: rellena `solicitadaPor` desde el JWT (no del payload). Si el
 *     solicitante NO es admin/superadmin, fuerza estado=PENDIENTE_APROBACION
 *     para que pase por cola del admin del centro.
 *   - PATCH: si cambia `estado` a APROBADA/RECHAZADA/CANCELADA y aún no hay
 *     `aprobadaPor`, lo setea con el usuario actual + `fechaResolucion=now`.
 *     Si pasa de APROBADA → CANCELADA, marca `revertida=true` (D-F).
 *
 * Doc: docs/hoja-de-ruta-intercambio-imparticiones.md §3 D-C, D-F.
 */
class ExcepcionHorarioProcessor implements ProcessorInterface
{
    public function __construct(
        #[Autowire(service: 'api_platform.doctrine.orm.state.persist_processor')]
        private ProcessorInterface $persistProcessor,
        private Security $security,
    ) {
    }

    public function process(mixed $data, Operation $operation, array $uriVariables = [], array $context = []): mixed
    {
        if (!$data instanceof ExcepcionHorario) {
            return $this->persistProcessor->process($data, $operation, $uriVariables, $context);
        }

        $user = $this->security->getUser();

        if ($operation instanceof Post && $data->getId() === null) {
            if ($user instanceof User) {
                $data->setSolicitadaPor($user);
            }

            $isAdmin = $this->security->isGranted('ROLE_ADMIN')
                || $this->security->isGranted('ROLE_SUPERADMIN')
                || $this->security->isGranted('ROLE_SUPER_ADMIN');

            if (!$isAdmin) {
                // Profe puro: la cola de aprobación es obligatoria.
                $data->setEstado(EstadoExcepcion::PENDIENTE_APROBACION);
                $data->setAprobadaPor(null);
                $data->setFechaResolucion(null);
            } else if ($data->getEstado() === EstadoExcepcion::APROBADA && $data->getAprobadaPor() === null) {
                // Admin crea aprobada directamente: él mismo firma la aprobación.
                $data->setAprobadaPor($user instanceof User ? $user : null);
                $data->setFechaResolucion(new \DateTimeImmutable());
            }
        } else {
            // PATCH: detectar transiciones de estado.
            $estado = $data->getEstado();
            $resuelto = in_array($estado, [
                EstadoExcepcion::APROBADA,
                EstadoExcepcion::RECHAZADA,
                EstadoExcepcion::CANCELADA,
            ], true);

            if ($resuelto && $data->getAprobadaPor() === null && $user instanceof User) {
                $data->setAprobadaPor($user);
            }
            if ($resuelto && $data->getFechaResolucion() === null) {
                $data->setFechaResolucion(new \DateTimeImmutable());
            }

            // Reversión de aprobada → cancelada deja flag (D-F).
            if ($estado === EstadoExcepcion::CANCELADA && $data->getFechaResolucion() !== null) {
                $data->setRevertida(true);
            }
        }

        return $this->persistProcessor->process($data, $operation, $uriVariables, $context);
    }
}
