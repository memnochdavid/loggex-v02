<?php

namespace App\EventSubscriber;

use App\Entity\Horario;
use App\Service\PeriodoLectivoResolver;
use Doctrine\Bundle\DoctrineBundle\Attribute\AsDoctrineListener;
use Doctrine\ORM\Event\PrePersistEventArgs;
use Doctrine\ORM\Events;

/**
 * Auto-fill de `Horario.periodoLectivo` en el `prePersist`.
 *
 * Razón: tras Fase 1, `Horario.periodoLectivo` es NOT NULL, pero el frontend
 * (todavía en pre-Fase 3) no envía el campo cuando guarda placements desde
 * `/admin/horarios`. Este listener rellena el rango activo del grupo de la
 * imparticion antes del INSERT, manteniendo el contrato API anterior intacto.
 *
 * Cuando Fase 3 cablee el selector de rango en la UI, el frontend podrá enviar
 * un `periodoLectivo` explícito (override del que decide este listener) y este
 * subscriber lo respetará (no toca si ya está set).
 *
 * Doc: docs/hoja-de-ruta-periodos-lectivos.md (Fase 2)
 */
#[AsDoctrineListener(event: Events::prePersist)]
class HorarioPeriodoLectivoSubscriber
{
    public function __construct(private readonly PeriodoLectivoResolver $resolver)
    {
    }

    public function prePersist(PrePersistEventArgs $args): void
    {
        $entity = $args->getObject();
        if (!$entity instanceof Horario) {
            return;
        }
        if ($entity->getPeriodoLectivo() !== null) {
            return;  // ya viene asignado del request — respetar
        }
        $imp = $entity->getImparticion();
        if ($imp === null) {
            return;
        }
        $grupo = $imp->getGrupo();
        if ($grupo === null) {
            return;
        }

        $pl = $this->resolver->resolveActive($grupo);
        if ($pl !== null) {
            $entity->setPeriodoLectivo($pl);
        }
        // Si el resolver devuelve null (grupo sin ningún PeriodoLectivo, caso
        // imposible tras la migración Fase 1), Doctrine fallará con NOT NULL
        // violation — preferimos error explícito a silenciar el problema.
    }
}
