<?php

namespace App\Service;

use App\Entity\Centro;
use App\Entity\EtapaEducativa;
use App\Entity\Grupo;
use App\Entity\Imparticion;
use App\Entity\PeriodoLectivo;
use Doctrine\ORM\EntityManagerInterface;

/**
 * Calcula la consumición de horas anuales de un grupo agregando, por
 * imparticion del grupo:
 *   - minutosCurriculo: objetivo anual (Materia.getObjetivoAnualMinutos).
 *   - minutosPlanificadoTotal: Σ por rango (PLI.effectiveMinutosSemanales × semanas del rango).
 *   - minutosImpartidosHoy: Σ por rango (PLI.effectiveMinutosSemanales × semanas transcurridas del rango hasta `fechaReferencia`).
 *   - minutosProyectadoTotal: en esta sesión, = planificado total (asume que se cumple el ritmo).
 *
 * Cálculo "teórico" (D-M, 2026-05-03 al arrancar Fase 8):
 *   minutosImpartidos_rango = pli.effectiveMinutosSemanales × semanasTranscurridasRango.
 *   `Asistencia` queda como mejora futura — el switch teórico/real se hace
 *   aquí sin tocar endpoint ni frontend.
 *
 * Las semanas se obtienen de `CalendarioLectivoService` (descuenta festivos
 * aplicables al centro). Si el centro no tiene fechas configuradas y no hay
 * `CalendarioEscolarCcaa`, los métodos del servicio devuelven `semanas=null`
 * y este servicio cae a 0 (el frontend mostrará el banner de "configura
 * fechas del centro").
 *
 * Sesión 2 (próxima): doble eje rango↔evaluación. Esta versión solo agrega
 * por rango — la estructura del output ya deja un slot `evaluaciones: []`
 * vacío para no romper compat cuando llegue.
 *
 * Doc: docs/hoja-de-ruta-periodos-lectivos.md §3 Fase 8
 */
class ConsumicionAnualService
{
    public function __construct(
        private readonly EntityManagerInterface $em,
        private readonly CalendarioLectivoService $calendario,
    ) {}

    /**
     * @return array{
     *   grupoId: int,
     *   grupoNombre: string,
     *   fechaReferencia: string,
     *   diasLectivosTotales: int,
     *   diasLectivosTranscurridos: int,
     *   porcentajeCursoTranscurrido: float,
     *   rangos: list<array{id:int, nombre:?string, fechaInicio:string, fechaFin:string, semanas:float, diasLectivos:int, semanasTranscurridas:float, diasLectivosTranscurridos:int, jornadaSemanaMinutos:int}>,
     *   materias: list<array{imparticionId:int, materiaId:int, materiaNombre:?string, modalidad:string, minutosCurriculo:int, minutosPlanificadoTotal:int, minutosImpartidosHoy:int, minutosProyectadoTotal:int, porRango: list<array{rangoId:int, minutosSemanales:int, minutosPlanificados:int, minutosImpartidos:int}>}>,
     *   evaluaciones: list<array{}>
     * }
     */
    public function computeForGrupo(Grupo $grupo, ?\DateTimeInterface $fechaReferencia = null): array
    {
        $fechaRef = $fechaReferencia ?? new \DateTime('today');
        $centro = $grupo->getItinerario()?->getCentro();

        $pls = $this->em->getRepository(PeriodoLectivo::class)->createQueryBuilder('pl')
            ->andWhere('pl.grupo = :g')
            ->andWhere('pl.deleted = false')
            ->setParameter('g', $grupo)
            ->orderBy('pl.fechaInicio', 'ASC')
            ->addOrderBy('pl.id', 'ASC')
            ->getQuery()->getResult();

        $rangosOut = [];
        $rangoMeta = [];
        $diasLectivosTotalesGrupo = 0;
        $diasLectivosTranscurridosGrupo = 0;

        foreach ($pls as $pl) {
            [$dias, $sem] = $this->semanasYDiasDelRango($centro, $pl->getFechaInicio(), $pl->getFechaFin());

            $finTrans = $fechaRef < $pl->getFechaFin() ? $fechaRef : $pl->getFechaFin();
            $diasTrans = 0;
            $semTrans = 0.0;
            if ($pl->getFechaInicio() <= $finTrans) {
                [$diasTrans, $semTrans] = $this->semanasYDiasDelRango($centro, $pl->getFechaInicio(), $finTrans);
            }

            $jornadaMin = $this->calcularJornadaSemanaMinutos($pl);

            $rangoMeta[$pl->getId()] = [
                'sem' => $sem,
                'semTrans' => $semTrans,
            ];
            $diasLectivosTotalesGrupo += $dias;
            $diasLectivosTranscurridosGrupo += $diasTrans;

            $rangosOut[] = [
                'id' => $pl->getId(),
                'nombre' => $pl->getNombre(),
                'fechaInicio' => $pl->getFechaInicio()->format('Y-m-d'),
                'fechaFin' => $pl->getFechaFin()->format('Y-m-d'),
                'semanas' => $sem,
                'diasLectivos' => $dias,
                'semanasTranscurridas' => $semTrans,
                'diasLectivosTranscurridos' => $diasTrans,
                'jornadaSemanaMinutos' => $jornadaMin,
            ];
        }

        $porcCurso = $diasLectivosTotalesGrupo > 0
            ? round(100.0 * $diasLectivosTranscurridosGrupo / $diasLectivosTotalesGrupo, 1)
            : 0.0;

        $impas = $this->em->getRepository(Imparticion::class)->createQueryBuilder('i')
            ->andWhere('i.grupo = :g')
            ->andWhere('i.deleted = false')
            ->setParameter('g', $grupo)
            ->getQuery()->getResult();

        $pliIndex = [];
        foreach ($pls as $pl) {
            foreach ($pl->getImparticiones() as $pli) {
                if ($pli->isDeleted()) {
                    continue;
                }
                $imp = $pli->getImparticion();
                if (!$imp || $imp->getId() === null) {
                    continue;
                }
                $pliIndex[$imp->getId()][$pl->getId()] = $pli;
            }
        }

        $materiasOut = [];
        foreach ($impas as $imp) {
            $materia = $imp->getMateria();
            if (!$materia) {
                continue;
            }

            $objetivoAnual = $materia->getObjetivoAnualMinutos();
            $modalidad = $imp->getEffectiveModalidad();

            $planTotal = 0;
            $impartidoTotal = 0;
            $porRango = [];
            foreach ($pls as $pl) {
                $meta = $rangoMeta[$pl->getId()];
                $pli = $pliIndex[$imp->getId()][$pl->getId()] ?? null;
                $minSem = $pli ? $pli->getEffectiveMinutosSemanales() : 0;

                $planRango = (int) round($minSem * $meta['sem']);
                $impRango = (int) round($minSem * $meta['semTrans']);

                $planTotal += $planRango;
                $impartidoTotal += $impRango;

                $porRango[] = [
                    'rangoId' => $pl->getId(),
                    'minutosSemanales' => $minSem,
                    'minutosPlanificados' => $planRango,
                    'minutosImpartidos' => $impRango,
                ];
            }

            $materiasOut[] = [
                'imparticionId' => $imp->getId(),
                'materiaId' => $materia->getId(),
                'materiaNombre' => $materia->getNombre(),
                'modalidad' => $modalidad->value,
                'minutosCurriculo' => $objetivoAnual,
                'minutosPlanificadoTotal' => $planTotal,
                'minutosImpartidosHoy' => $impartidoTotal,
                'minutosProyectadoTotal' => $planTotal,
                'porRango' => $porRango,
            ];
        }

        usort($materiasOut, fn ($a, $b) => strcmp((string) $a['materiaNombre'], (string) $b['materiaNombre']));

        return [
            'grupoId' => $grupo->getId(),
            'grupoNombre' => trim(($grupo->getCurso() !== null ? $grupo->getCurso() . 'º ' : '') . ($grupo->getAbreviatura() ?? '')),
            'fechaReferencia' => $fechaRef->format('Y-m-d'),
            'diasLectivosTotales' => $diasLectivosTotalesGrupo,
            'diasLectivosTranscurridos' => $diasLectivosTranscurridosGrupo,
            'porcentajeCursoTranscurrido' => $porcCurso,
            'rangos' => $rangosOut,
            'materias' => $materiasOut,
            'evaluaciones' => [],
        ];
    }

    /**
     * @return array{0:int, 1:float} [diasLectivos, semanas]
     */
    private function semanasYDiasDelRango(?Centro $centro, \DateTimeInterface $inicio, \DateTimeInterface $fin): array
    {
        if ($centro === null) {
            return [0, 0.0];
        }
        $r = $this->calendario->semanasLectivas($centro, EtapaEducativa::FP, $inicio, $fin);
        return [(int) ($r['diasLectivos'] ?? 0), (float) ($r['semanas'] ?? 0.0)];
    }

    private function calcularJornadaSemanaMinutos(PeriodoLectivo $pl): int
    {
        $jornada = $pl->getEffectiveJornadaTipo();
        if (!$jornada) {
            return 0;
        }
        $diasLectivos = $jornada->getDiasLectivos();
        if (empty($diasLectivos)) {
            $diasLectivos = [1, 2, 3, 4, 5];
        }
        $minPorDia = 0;
        foreach ($jornada->getTramos() as $tramo) {
            $hi = $tramo->getHoraInicio();
            $hf = $tramo->getHoraFin();
            if (!$hi || !$hf) {
                continue;
            }
            $diff = ((int) $hf->format('H')) * 60 + (int) $hf->format('i')
                  - (((int) $hi->format('H')) * 60 + (int) $hi->format('i'));
            if ($diff > 0) {
                $minPorDia += $diff;
            }
        }
        return $minPorDia * count($diasLectivos);
    }
}
