<?php

namespace App\EventSubscriber;

use App\Controller\GetMyScheduleController;
use App\Entity\ExcepcionHorario;
use App\Entity\Horario;
use App\Entity\Imparticion;
use App\Entity\Matricula;
use Doctrine\Bundle\DoctrineBundle\Attribute\AsDoctrineListener;
use Doctrine\ORM\EntityManagerInterface;
use Doctrine\ORM\Event\PostPersistEventArgs;
use Doctrine\ORM\Event\PostRemoveEventArgs;
use Doctrine\ORM\Event\PostUpdateEventArgs;
use Doctrine\ORM\Events;
use Symfony\Contracts\Cache\CacheInterface;

#[AsDoctrineListener(event: Events::postPersist)]
#[AsDoctrineListener(event: Events::postUpdate)]
#[AsDoctrineListener(event: Events::postRemove)]
class CacheInvalidationSubscriber
{
    public function __construct(private readonly CacheInterface $cache)
    {
    }

    public function postPersist(PostPersistEventArgs $args): void
    {
        $this->invalidate($args->getObject(), $args->getObjectManager());
    }

    public function postUpdate(PostUpdateEventArgs $args): void
    {
        $this->invalidate($args->getObject(), $args->getObjectManager());
    }

    public function postRemove(PostRemoveEventArgs $args): void
    {
        $this->invalidate($args->getObject(), $args->getObjectManager());
    }

    private function invalidate(object $entity, EntityManagerInterface $em): void
    {
        $userIds = $this->collectAffectedUserIds($entity, $em);
        foreach ($userIds as $userId) {
            $this->cache->delete(GetMyScheduleController::CACHE_KEY_PREFIX . $userId);
        }
    }

    /**
     * Dada una entidad, devuelve los IDs de usuario cuyo schedule debe invalidarse.
     */
    private function collectAffectedUserIds(object $entity, EntityManagerInterface $em): array
    {
        if ($entity instanceof Horario) {
            return $this->userIdsForImparticion($entity->getImparticion(), $em);
        }

        if ($entity instanceof Imparticion) {
            return $this->userIdsForImparticion($entity, $em);
        }

        if ($entity instanceof Matricula) {
            $ids = [];
            if ($alumno = $entity->getAlumno()) {
                $ids[] = $alumno->getId();
            }
            // Al mover un alumno de grupo también cambia el schedule del profesor
            // de cada imparticion del grupo, pero eso ya lo recalcula su propio TTL (5min).
            return array_filter($ids);
        }

        if ($entity instanceof ExcepcionHorario) {
            // Fase B intercambio-imparticiones (2026-05-07): un cambio en una
            // excepción debe invalidar el schedule cacheado de todos los
            // afectados (titular del horario, alumnos del grupo, solicitante,
            // profe override). Sin esto, una excepción aprobada no se ve en
            // /horario/me hasta que expira el TTL de 5min.
            $ids = [];
            if ($solic = $entity->getSolicitadaPor()) {
                $ids[] = $solic->getId();
            }
            if ($override = $entity->getProfeOverride()) {
                $ids[] = $override->getId();
            }
            $hb = $entity->getHorarioBase();
            if ($hb) {
                $ids = array_merge($ids, $this->userIdsForImparticion($hb->getImparticion(), $em));
            }
            return array_values(array_unique(array_filter($ids)));
        }

        return [];
    }

    private function userIdsForImparticion(?Imparticion $imparticion, EntityManagerInterface $em): array
    {
        if (!$imparticion) {
            return [];
        }

        $ids = [];
        if ($profesor = $imparticion->getProfesor()) {
            $ids[] = $profesor->getId();
        }

        $grupo = $imparticion->getGrupo();
        if ($grupo) {
            // Grupo no expone getMatriculas(); consultamos vía repository.
            $dql = 'SELECT IDENTITY(m.alumno) AS alumnoId FROM App\\Entity\\Matricula m WHERE m.grupo = :grupoId AND m.deleted = false';
            $rows = $em->createQuery($dql)->setParameter('grupoId', $grupo->getId())->getArrayResult();
            foreach ($rows as $row) {
                if (!empty($row['alumnoId'])) {
                    $ids[] = (int) $row['alumnoId'];
                }
            }
        }

        return array_values(array_unique(array_filter($ids)));
    }
}
