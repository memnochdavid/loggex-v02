<?php

namespace App\EventSubscriber;

use App\Entity\Imparticion;
use Doctrine\Bundle\DoctrineBundle\Attribute\AsDoctrineListener;
use Doctrine\ORM\Event\PreUpdateEventArgs;
use Doctrine\ORM\Events;

/**
 * Cuando una `Imparticion` pasa a `deleted = true` (vía SoftDeleteProcessor
 * en la operación DELETE de la API), arrastra de forma transitiva:
 *
 *  - **PeriodoLectivoImparticion (PLI)**: hard-delete (PLI es derivativa, su
 *    Delete operation ya es física desde Fase 4). Sin esto los PLIs quedan
 *    huérfanos apuntando a una imparticion oculta por el filtro softdelete →
 *    el resolver Doctrine devuelve "Entity not found" cuando el solver/
 *    CapacityPlanner los hidratan, y la API responde 500.
 *  - **Horario**: soft-delete (Horario usa SoftDeletableTrait, mantenemos
 *    audit). Mismos huérfanos potenciales.
 *
 * Usa DBAL crudo para evitar que el filtro global de softdelete altere las
 * queries de limpieza dentro del flush de la propia Imparticion.
 *
 * Doc: docs/hoja-de-ruta-periodos-lectivos.md §6 (entrada "Fix solver:
 * cascade soft-delete de Imparticion").
 */
#[AsDoctrineListener(event: Events::preUpdate)]
class ImparticionSoftDeleteCascadeSubscriber
{
    public function preUpdate(PreUpdateEventArgs $args): void
    {
        $entity = $args->getObject();
        if (!$entity instanceof Imparticion) {
            return;
        }
        if (!$args->hasChangedField('deleted')) {
            return;
        }
        // Sólo nos importa el flanco false → true (soft-delete real).
        if ($args->getOldValue('deleted') !== false || $args->getNewValue('deleted') !== true) {
            return;
        }

        $impId = $entity->getId();
        if ($impId === null) {
            return;
        }

        $conn = $args->getObjectManager()->getConnection();
        $now = (new \DateTimeImmutable())->format('Y-m-d H:i:s');

        // Hard-delete PLIs huérfanos.
        $conn->executeStatement(
            'DELETE FROM periodo_lectivo_imparticion WHERE imparticion_id = :id',
            ['id' => $impId]
        );

        // Soft-delete horarios live que apuntan a esta imparticion.
        $conn->executeStatement(
            'UPDATE horario SET deleted = 1, deleted_at = :now WHERE imparticion_id = :id AND deleted = 0',
            ['id' => $impId, 'now' => $now]
        );
    }
}
