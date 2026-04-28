<?php

namespace App\Repository;

use App\Entity\PeriodoLectivoImparticion;
use Doctrine\Bundle\DoctrineBundle\Repository\ServiceEntityRepository;
use Doctrine\Persistence\ManagerRegistry;

/**
 * @extends ServiceEntityRepository<PeriodoLectivoImparticion>
 */
class PeriodoLectivoImparticionRepository extends ServiceEntityRepository
{
    public function __construct(ManagerRegistry $registry)
    {
        parent::__construct($registry, PeriodoLectivoImparticion::class);
    }
}
