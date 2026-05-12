<?php

namespace App\EventSubscriber;

use App\Entity\EstadoExcepcion;
use App\Entity\ExcepcionHorario;
use Doctrine\Bundle\DoctrineBundle\Attribute\AsDoctrineListener;
use Doctrine\ORM\EntityManagerInterface;
use Doctrine\ORM\Event\OnFlushEventArgs;
use Doctrine\ORM\Event\PreUpdateEventArgs;
use Doctrine\ORM\Events;

/**
 * Cascade de mutaciones a TODAS las caras de un INTERCAMBIO.
 *
 * Refactor de Plan B (2026-05-08): el modelo anterior `intercambioPareja`
 * era 1↔1 (dos caras del mismo intercambio linked vía self-FK). Plan B
 * generaliza a un GRUPO de N caras compartiendo `intercambioGrupoId` UUID
 * (permite p.ej. 1 cara A + 2 caras B = 60+60 que suman lo mismo en min).
 *
 * Las N caras del grupo representan UN único acuerdo. Cambios atómicos
 * propagados:
 *  - Cambio de **estado** (PENDIENTE → APROBADA/RECHAZADA/CANCELADA):
 *    propaga `estado` + `aprobadaPor` + `fechaResolucion` + `respuestaAdmin`
 *    + `revertida` consistentes en todas las caras.
 *  - **Soft-delete** (`deleted: false → true`, vía `SoftDeleteProcessor`
 *    cuando el admin elimina desde `/admin/incidencias`): propaga el
 *    `deleted = true` a todas las caras del grupo para que el delete sea
 *    atómico. Sin esto el admin tenía que borrar manualmente las N caras
 *    (clases gemelas DAW+DAM + intercambio bilateral A+B = hasta 4 caras
 *    por una sola incidencia).
 *
 * Anti-loop: re-entrancy guard estático. Cuando se actualiza la primera
 * cara, este subscriber edita las demás caras del grupo. Sus respectivos
 * preUpdate dispararán este mismo subscriber, pero el guard devuelve
 * early sin cascadear de nuevo.
 *
 * Compatibilidad con NotificationDispatchSubscriber: ambos suscriben a
 * preUpdate. Tras la cascada, cada cara emite sus propias notificaciones
 * a los afectados de su lado (titular + sustituto + alumnos del grupo).
 * El dispatcher dedupe por `intercambioGrupoId` para que el destinatario
 * no reciba N notifs idénticas.
 *
 * Limitaciones conocidas:
 *  - Reactivación (`deleted: true → false`) no se propaga; sólo el camino
 *    "soft-delete down". Caso edge poco frecuente.
 *  - Hard-delete (`em->remove()`) no se propaga: este subscriber sólo
 *    escucha `preUpdate`. Hoy todo el delete del producto pasa por
 *    `SoftDeleteProcessor`, así que no es problema operativo.
 *
 * Doc: docs/hoja-de-ruta-intercambio-imparticiones.md Plan B.
 */
#[AsDoctrineListener(event: Events::preUpdate)]
#[AsDoctrineListener(event: Events::onFlush)]
class IntercambioGrupoCascadeSubscriber
{
    private bool $processing = false;

    /**
     * Cascade de **cambio de estado**. preUpdate funciona aquí porque la
     * mutación se origina dentro del flujo PATCH de API Platform, donde
     * `aprobada/rechazada/cancelada` se setea sobre una entidad scheduled
     * for update y `recomputeSingleEntityChangeSet` puede propagar a las
     * hermanas. Para soft-delete ver `onFlush()` — esa ruta entra por
     * `SoftDeleteProcessor` con un patrón distinto.
     */
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
        $otros = $this->loadOtrosDelGrupo($em, $grupoId, $entity->getId());
        if (empty($otros)) {
            return;
        }

        $this->processing = true;
        try {
            $this->cascadeEstado($em, $entity, $otros, $newEstado);
        } finally {
            $this->processing = false;
        }
    }

    /**
     * Cascade de **soft-delete**. Se hace en `onFlush` (no `preUpdate`)
     * porque `SoftDeleteProcessor` invoca `setDeleted(true) + persist +
     * flush` sin pasar las hermanas por el UoW: éstas no están scheduled
     * for update, así que `recomputeSingleEntityChangeSet` no las propaga
     * (limitación documentada en `HorarioGemeloSyncSubscriber` Fase D).
     * `onFlush` + `computeChangeSet` sí registra los UPDATEs de las
     * hermanas en el mismo flush.
     */
    public function onFlush(OnFlushEventArgs $args): void
    {
        if ($this->processing) {
            return;
        }
        $em = $args->getObjectManager();
        $uow = $em->getUnitOfWork();

        // Detectar EH con changeSet `deleted: false → true`. Snapshot
        // antes de mutar nada: modificar el UoW mientras iteramos su
        // lista de scheduled puede dar comportamiento raro.
        $triggers = [];
        foreach ($uow->getScheduledEntityUpdates() as $entity) {
            if (!$entity instanceof ExcepcionHorario) {
                continue;
            }
            $changeSet = $uow->getEntityChangeSet($entity);
            if (!isset($changeSet['deleted'])) {
                continue;
            }
            if ($changeSet['deleted'][0] !== false || $changeSet['deleted'][1] !== true) {
                continue;
            }
            $grupoId = $entity->getIntercambioGrupoId();
            if ($grupoId === null || $grupoId === '') {
                continue;
            }
            $triggers[] = ['entity' => $entity, 'grupoId' => $grupoId];
        }
        if ($triggers === []) {
            return;
        }

        $this->processing = true;
        try {
            $metadata = $em->getClassMetadata(ExcepcionHorario::class);
            foreach ($triggers as $row) {
                /** @var ExcepcionHorario $eh */
                $eh = $row['entity'];
                $otros = $this->loadOtrosDelGrupo($em, $row['grupoId'], $eh->getId());
                foreach ($otros as $miembro) {
                    // Si ya está scheduled para soft-delete (caso "batch
                    // borra A y luego B en el mismo flush"), saltar.
                    if ($uow->isScheduledForUpdate($miembro)) {
                        $cs = $uow->getEntityChangeSet($miembro);
                        if (isset($cs['deleted']) && $cs['deleted'][1] === true) {
                            continue;
                        }
                    }
                    if ($miembro->isDeleted()) {
                        continue;
                    }
                    $miembro->setDeleted(true);
                    // computeChangeSet (no recompute): el miembro NO estaba
                    // scheduled; computeChangeSet lo añade al UoW.
                    $uow->computeChangeSet($metadata, $miembro);
                }
            }
        } finally {
            $this->processing = false;
        }
    }

    /**
     * Carga las EH vivas del mismo grupo, excluyendo a la disparadora.
     * Filtro `deleted = false` directo en SQL para que el SoftDeleteFilter
     * no afecte (la filtración manual es coherente con el resto del subscriber).
     *
     * @return list<ExcepcionHorario>
     */
    private function loadOtrosDelGrupo(EntityManagerInterface $em, string $grupoId, ?int $selfId): array
    {
        $qb = $em->getRepository(ExcepcionHorario::class)->createQueryBuilder('eh')
            ->where('eh.intercambioGrupoId = :grupoId')
            ->andWhere('eh.deleted = false')
            ->setParameter('grupoId', $grupoId);
        if ($selfId !== null) {
            $qb->andWhere('eh.id != :selfId')->setParameter('selfId', $selfId);
        }
        return $qb->getQuery()->getResult();
    }

    /**
     * @param list<ExcepcionHorario> $otros
     */
    private function cascadeEstado(
        EntityManagerInterface $em,
        ExcepcionHorario $entity,
        array $otros,
        EstadoExcepcion $newEstado,
    ): void {
        $aprobadorA  = $entity->getAprobadaPor();
        $fechaResA   = $entity->getFechaResolucion();
        $respuestaA  = $entity->getRespuestaAdmin();
        $revertidaA  = $entity->isRevertida();
        $metadata    = $em->getClassMetadata(ExcepcionHorario::class);

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
            $em->getUnitOfWork()->recomputeSingleEntityChangeSet($metadata, $miembro);
        }
    }
}
