<?php

namespace App\Service;

use App\Entity\Grupo;
use App\Entity\PeriodoLectivo;
use App\Entity\TipoPeriodoLectivo;
use Doctrine\ORM\EntityManagerInterface;

/**
 * Resolver del modelo semanal. Punto único para mapear
 * "grupo + fecha → PeriodoLectivo aplicable".
 *
 * Política (post-refactor 2026-05-06):
 *   1. Si hay una `SEMANA` cuyo `[fechaInicio, fechaFin]` contiene la fecha,
 *      se devuelve esa (override puntual gana).
 *   2. Si no, se devuelve la `PLANTILLA` del grupo (caso default — todas
 *      las semanas no excepcionales delegan en ella).
 *   3. Si el grupo no tiene PLANTILLA todavía, devuelve NULL — el llamador
 *      decide si fallar o auto-crear vía un comando/processor superior.
 *
 * Doc: docs/hoja-de-ruta-modelo-semanal.md §11.
 */
class PeriodoLectivoResolver
{
    public function __construct(private EntityManagerInterface $em)
    {
    }

    /**
     * PL aplicable al grupo en la fecha dada. SEMANA si existe override,
     * PLANTILLA en caso default.
     */
    public function resolveActive(Grupo $grupo, ?\DateTimeInterface $fecha = null): ?PeriodoLectivo
    {
        $fecha = $fecha ?? new \DateTime();
        $repo = $this->em->getRepository(PeriodoLectivo::class);

        // 1. SEMANA cuyo rango contiene la fecha.
        $semana = $repo->createQueryBuilder('pl')
            ->andWhere('pl.grupo = :grupo')
            ->andWhere('pl.deleted = false')
            ->andWhere('pl.tipo = :tipoSemana')
            ->andWhere(':fecha BETWEEN pl.fechaInicio AND pl.fechaFin')
            ->setParameter('grupo', $grupo)
            ->setParameter('tipoSemana', TipoPeriodoLectivo::SEMANA->value)
            ->setParameter('fecha', $fecha->format('Y-m-d'))
            ->orderBy('pl.fechaInicio', 'ASC')
            ->setMaxResults(1)
            ->getQuery()
            ->getOneOrNullResult();

        if ($semana !== null) {
            return $semana;
        }

        // 2. Fallback: PLANTILLA del grupo.
        return $this->getPlantilla($grupo);
    }

    /**
     * PLANTILLA viva del grupo, o NULL si todavía no se ha creado.
     *
     * Por contrato, cada grupo tiene exactamente una PLANTILLA viva. Si
     * existieran varias por error de datos, se devuelve la más antigua
     * (id ASC) y se asume que un health-check posterior lo señalará.
     */
    public function getPlantilla(Grupo $grupo): ?PeriodoLectivo
    {
        return $this->em->getRepository(PeriodoLectivo::class)
            ->createQueryBuilder('pl')
            ->andWhere('pl.grupo = :grupo')
            ->andWhere('pl.deleted = false')
            ->andWhere('pl.tipo = :tipoPlantilla')
            ->setParameter('grupo', $grupo)
            ->setParameter('tipoPlantilla', TipoPeriodoLectivo::PLANTILLA->value)
            ->orderBy('pl.id', 'ASC')
            ->setMaxResults(1)
            ->getQuery()
            ->getOneOrNullResult();
    }

    /**
     * Todas las SEMANAs vivas del grupo, ordenadas por `semanaNumero`.
     *
     * @return PeriodoLectivo[]
     */
    public function getSemanas(Grupo $grupo): array
    {
        return $this->em->getRepository(PeriodoLectivo::class)
            ->createQueryBuilder('pl')
            ->andWhere('pl.grupo = :grupo')
            ->andWhere('pl.deleted = false')
            ->andWhere('pl.tipo = :tipoSemana')
            ->setParameter('grupo', $grupo)
            ->setParameter('tipoSemana', TipoPeriodoLectivo::SEMANA->value)
            ->orderBy('pl.semanaNumero', 'ASC')
            ->addOrderBy('pl.fechaInicio', 'ASC')
            ->getQuery()
            ->getResult();
    }
}
