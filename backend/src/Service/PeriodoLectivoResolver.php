<?php

namespace App\Service;

use App\Entity\EtapaEducativa;
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
    public function __construct(
        private EntityManagerInterface $em,
        private CalendarioLectivoService $calendario,
    ) {
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
     * Semanas equivalentes de un PeriodoLectivo. Punto único de consulta
     * para el solver y CapacityPlanner.
     *
     * Política (Fase C 2026-05-06 — modelo semanal puro):
     *   - SEMANA con fechas → `(fechaFin - fechaInicio + 1) / 7` (semanas
     *     brutas; el solver acepta esa granularidad y los festivos los
     *     procesan otras capas vía `CalendarioLectivoService`).
     *   - PLANTILLA sin fechas → `semanasReferenciaCentro` del calendario
     *     lectivo del centro vía `CalendarioLectivoService::semanasLectivas`.
     *     Fallback 36 LOMLOE si no se puede resolver el calendario CCAA.
     *
     * Sin este método, los servicios calculaban `(fin-ini)/7` directo y
     * crasheaban con la PLANTILLA (NULL fechas → 0 semanas → cap anual
     * roto). El frontend tenía que simular fechas ficticias del grupo en
     * cada llamada al solver — deuda eliminada con este helper.
     */
    public function calcularSemanas(PeriodoLectivo $pl): float
    {
        $i = $pl->getFechaInicio();
        $f = $pl->getFechaFin();
        if ($i !== null && $f !== null) {
            $diff = $i->diff($f);
            return (((int) $diff->days) + 1) / 7.0;
        }
        // PLANTILLA o PL sin fechas: usar calendario lectivo del centro.
        $centro = $pl->getGrupo()?->getItinerario()?->getCentro();
        if ($centro !== null) {
            $r = $this->calendario->semanasLectivas($centro, EtapaEducativa::FP);
            if (($r['semanas'] ?? null) !== null && $r['semanas'] > 0) {
                return (float) $r['semanas'];
            }
        }
        return 36.0;
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
