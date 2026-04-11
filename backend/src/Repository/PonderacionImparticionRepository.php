<?php

namespace App\Repository;

use App\Entity\PonderacionImparticion;
use Doctrine\Bundle\DoctrineBundle\Repository\ServiceEntityRepository;
use Doctrine\Persistence\ManagerRegistry;

/**
 * @extends ServiceEntityRepository<PonderacionImparticion>
 */
class PonderacionImparticionRepository extends ServiceEntityRepository
{
    public function __construct(ManagerRegistry $registry)
    {
        parent::__construct($registry, PonderacionImparticion::class);
    }

    /**
     * Devuelve los pesos configurados para una impartición, indexados por tipoTarea.
     * Si no hay configuración, devuelve los valores por defecto.
     *
     * @return array<string, float>
     */
    public function getPesosParaImparticion(int $imparticionId): array
    {
        $ponderaciones = $this->findBy(['imparticion' => $imparticionId]);

        if (empty($ponderaciones)) {
            return [
                'examen' => 0.5,
                'tarea' => 0.3,
                'practica' => 0.2,
            ];
        }

        $pesos = [];
        foreach ($ponderaciones as $p) {
            $pesos[$p->getTipoTarea()] = $p->getPeso();
        }

        return $pesos;
    }
}
