<?php

namespace App\Repository;

use App\Entity\ExcepcionHorario;
use Doctrine\Bundle\DoctrineBundle\Repository\ServiceEntityRepository;
use Doctrine\Persistence\ManagerRegistry;

/**
 * @extends ServiceEntityRepository<ExcepcionHorario>
 */
class ExcepcionHorarioRepository extends ServiceEntityRepository
{
    public function __construct(ManagerRegistry $registry)
    {
        parent::__construct($registry, ExcepcionHorario::class);
    }
}
