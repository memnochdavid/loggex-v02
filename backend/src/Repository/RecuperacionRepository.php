<?php

namespace App\Repository;

use App\Entity\Recuperacion;
use Doctrine\Bundle\DoctrineBundle\Repository\ServiceEntityRepository;
use Doctrine\Persistence\ManagerRegistry;

/**
 * @extends ServiceEntityRepository<Recuperacion>
 */
class RecuperacionRepository extends ServiceEntityRepository
{
    public function __construct(ManagerRegistry $registry)
    {
        parent::__construct($registry, Recuperacion::class);
    }

    /**
     * Devuelve la última recuperación (por fecha) para cada tarea de una lista,
     * para un alumno dado. Map: [tareaId => Recuperacion].
     *
     * @param int[] $tareaIds
     */
    public function findLatestByAlumnoAndTareas(int $alumnoId, array $tareaIds): array
    {
        if (empty($tareaIds)) {
            return [];
        }
        $qb = $this->createQueryBuilder('r')
            ->andWhere('r.alumno = :alumno')
            ->andWhere('r.tarea IN (:tareas)')
            ->andWhere('r.deleted = false')
            ->setParameter('alumno', $alumnoId)
            ->setParameter('tareas', $tareaIds)
            ->orderBy('r.fecha', 'ASC');

        $map = [];
        foreach ($qb->getQuery()->getResult() as $rec) {
            $map[$rec->getTarea()->getId()] = $rec; // la última (ASC => la última pisa)
        }
        return $map;
    }
}
