<?php

namespace App\EventSubscriber;

use App\Entity\EstadoExcepcion;
use App\Entity\ExcepcionHorario;
use Doctrine\Bundle\DoctrineBundle\Attribute\AsDoctrineListener;
use Doctrine\ORM\Event\PreUpdateEventArgs;
use Doctrine\ORM\Events;

/**
 * Cascade del cambio de estado a TODAS las caras de un INTERCAMBIO.
 *
 * Refactor de Plan B (2026-05-08): el modelo anterior `intercambioPareja`
 * era 1↔1 (dos caras del mismo intercambio linked vía self-FK). Plan B
 * generaliza a un GRUPO de N caras compartiendo `intercambioGrupoId` UUID
 * (permite p.ej. 1 cara A + 2 caras B = 60+60 que suman lo mismo en min).
 *
 * Las N caras del grupo representan UN único acuerdo. Aprobar/rechazar/
 * revertir UNA cara propaga el cambio a todas las demás del grupo en el
 * mismo flush, manteniendo `aprobadaPor`, `fechaResolucion`,
 * `respuestaAdmin` y `revertida` consistentes.
 *
 * Anti-loop: re-entrancy guard estático. Cuando se actualiza la primera
 * cara, este subscriber edita las demás caras del grupo. Sus respectivos
 * preUpdate dispararán este mismo subscriber, pero el guard devuelve
 * early sin cascadear de nuevo.
 *
 * Compatibilidad con NotificationDispatchSubscriber: ambos suscriben a
 * preUpdate. Tras la cascada, cada cara emite sus propias notificaciones
 * a los afectados de su lado (titular + sustituto + alumnos del grupo).
 *
 * Doc: docs/hoja-de-ruta-intercambio-imparticiones.md Plan B.
 */
#[AsDoctrineListener(event: Events::preUpdate)]
class IntercambioGrupoCascadeSubscriber
{
    private bool $processing = false;

    public function preUpdate(PreUpdateEventArgs $args): void
    {
        if ($this->processing) {
            return;
        }
        $entity = $args->getObject();
        if (!$entity instanceof ExcepcionHorario) {
            return;
        }
        if (!$args->hasChangedField('estado')) {
            return;
        }
        $grupoId = $entity->getIntercambioGrupoId();
        if ($grupoId === null || $grupoId === '') {
            return;
        }

        $newEstadoRaw = $args->getNewValue('estado');
        $newEstado = $newEstadoRaw instanceof EstadoExcepcion
            ? $newEstadoRaw
            : (is_string($newEstadoRaw) ? EstadoExcepcion::from($newEstadoRaw) : null);
        if ($newEstado === null) {
            return;
        }

        $em = $args->getObjectManager();
        $repo = $em->getRepository(ExcepcionHorario::class);
        // Otros miembros del grupo (excluyo a la entidad que disparó el evento).
        $otros = $repo->createQueryBuilder('eh')
            ->where('eh.intercambioGrupoId = :grupoId')
            ->andWhere('eh.id != :selfId')
            ->andWhere('eh.deleted = false')
            ->setParameter('grupoId', $grupoId)
            ->setParameter('selfId', $entity->getId())
            ->getQuery()
            ->getResult();

        if (empty($otros)) {
            return;  // grupo de un solo miembro (caso raro) o sin más caras.
        }

        $this->processing = true;
        try {
            $aprobadorA  = $entity->getAprobadaPor();
            $fechaResA   = $entity->getFechaResolucion();
            $respuestaA  = $entity->getRespuestaAdmin();
            $revertidaA  = $entity->isRevertida();

            foreach ($otros as $miembro) {
                /** @var ExcepcionHorario $miembro */
                if ($miembro->getEstado() === $newEstado) {
                    continue;  // ya en el mismo estado — saltar.
                }
                $miembro->setEstado($newEstado);

                if (in_array($newEstado, [
                    EstadoExcepcion::APROBADA,
                    EstadoExcepcion::RECHAZADA,
                    EstadoExcepcion::CANCELADA,
                ], true)) {
                    if ($aprobadorA !== null && $miembro->getAprobadaPor() === null) {
                        $miembro->setAprobadaPor($aprobadorA);
                    }
                    if ($fechaResA !== null && $miembro->getFechaResolucion() === null) {
                        $miembro->setFechaResolucion($fechaResA);
                    }
                    if ($respuestaA !== null && $miembro->getRespuestaAdmin() === null) {
                        $miembro->setRespuestaAdmin($respuestaA);
                    }
                }

                if ($newEstado === EstadoExcepcion::CANCELADA && $revertidaA) {
                    $miembro->setRevertida(true);
                }

                // Forzar recompute del change set para que Doctrine schedule
                // el UPDATE en el mismo flush.
                $em->getUnitOfWork()->recomputeSingleEntityChangeSet(
                    $em->getClassMetadata(ExcepcionHorario::class),
                    $miembro
                );
            }
        } finally {
            $this->processing = false;
        }
    }
}
