<?php

namespace App\Service;

use App\Entity\Grupo;
use App\Entity\PeriodoLectivo;
use Doctrine\ORM\EntityManagerInterface;

/**
 * Resuelve el `PeriodoLectivo` "activo" de un grupo en una fecha dada.
 *
 * Política: el rango cuyo `[fechaInicio, fechaFin]` contiene la fecha. Si
 * ninguno la contiene, devuelve el primero por `fechaInicio` (típicamente
 * el "Curso completo" si solo hay uno, o el primero del año si el centro
 * todavía no ha llegado a su fecha de inicio).
 *
 * El solver y el `CapacityPlanner` consultan este servicio cuando el
 * controlador no pasa un `PeriodoLectivo` explícito (caso por defecto:
 * el frontend de Fase 2 todavía no expone el selector de rango).
 *
 * Doc: docs/hoja-de-ruta-periodos-lectivos.md (Fase 2)
 */
class PeriodoLectivoResolver
{
    public function __construct(private EntityManagerInterface $em)
    {
    }

    public function resolveActive(Grupo $grupo, ?\DateTimeInterface $fecha = null): ?PeriodoLectivo
    {
        $fecha = $fecha ?? new \DateTime();
        $repo = $this->em->getRepository(PeriodoLectivo::class);

        // Primero el rango que contiene la fecha.
        $contiene = $repo->createQueryBuilder('pl')
            ->andWhere('pl.grupo = :grupo')
            ->andWhere('pl.deleted = false')
            ->andWhere(':fecha BETWEEN pl.fechaInicio AND pl.fechaFin')
            ->setParameter('grupo', $grupo)
            ->setParameter('fecha', $fecha->format('Y-m-d'))
            ->orderBy('pl.orden', 'ASC')
            ->addOrderBy('pl.fechaInicio', 'ASC')
            ->setMaxResults(1)
            ->getQuery()
            ->getOneOrNullResult();

        if ($contiene !== null) {
            return $contiene;
        }

        // Fallback: el primer rango por fechaInicio.
        return $repo->createQueryBuilder('pl')
            ->andWhere('pl.grupo = :grupo')
            ->andWhere('pl.deleted = false')
            ->setParameter('grupo', $grupo)
            ->orderBy('pl.fechaInicio', 'ASC')
            ->setMaxResults(1)
            ->getQuery()
            ->getOneOrNullResult();
    }
}
