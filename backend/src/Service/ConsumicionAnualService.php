<?php

namespace App\Service;

use App\Entity\Centro;
use App\Entity\EtapaEducativa;
use App\Entity\Grupo;
use App\Entity\Imparticion;
use App\Entity\PeriodoEvaluativo;
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
 * Doble eje (sesión 2): además del eje "rangos" (PeriodoLectivo), el output
 * incluye un eje "evaluaciones" (PeriodoEvaluativo) con desglose por materia
 * por evaluación. Para una evaluación E y una imparticion I:
 *   minutosPlanificados_E_I = Σ por rango PL del grupo:
 *     intersección [max(PL.ini, E.ini), min(PL.fin, E.fin)] × PLI.minSem
 *   (semanas calculadas vía CalendarioLectivoService descontando festivos).
 * El currículo no se reparte por evaluación — se compara siempre contra el
 * objetivo anual de la materia, lo que responde a "¿cuánto se habrá impartido
 * al cerrar cada evaluación?" (no a "¿qué porcentaje de la nota toca?").
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
 * Doc: docs/hoja-de-ruta-periodos-lectivos.md §3 Fase 8
 */
class ConsumicionAnualService
{
    /** @var array<string, array{0:int, 1:float}> cache local por invocación */
    private array $cacheVentana = [];

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
     *   evaluaciones: list<array{id:int, nombre:?string, tipo:?string, fechaInicio:string, fechaFin:string, peso:?float, semanas:float, diasLectivos:int, semanasTranscurridas:float, diasLectivosTranscurridos:int}>,
     *   materias: list<array{imparticionId:int, materiaId:int, materiaNombre:?string, modalidad:string, minutosCurriculo:int, minutosPlanificadoTotal:int, minutosImpartidosHoy:int, minutosProyectadoTotal:int, porRango: list<array{rangoId:int, minutosSemanales:int, minutosPlanificados:int, minutosImpartidos:int}>, porEvaluacion: list<array{evaluacionId:int, minutosPlanificados:int, minutosImpartidos:int}>}>
     * }
     */
    public function computeForGrupo(Grupo $grupo, ?\DateTimeInterface $fechaReferencia = null): array
    {
        $this->cacheVentana = [];

        $fechaRef = $fechaReferencia ?? new \DateTime('today');
        $centro = $grupo->getItinerario()?->getCentro();

        // Refactor modelo semanal (Fase D 2026-05-06): el tab Consumición
        // opera sobre SEMANAs (PLs `tipo=SEMANA`) — son los rangos con
        // fechas reales que el admin asigna vía "Configurar curso óptimo".
        // La PLANTILLA (tipo PLANTILLA, fechas NULL) se EXCLUYE: representa
        // la "semana tipo" sin contribución a días lectivos transcurridos.
        // Si solo hay PLANTILLA (caso edge: grupo recién creado sin haber
        // ejecutado "Configurar curso óptimo"), el resultado queda vacío
        // — el frontend muestra estado "sin datos, configura primero el
        // curso óptimo" que es coherente con la realidad. Sin este filtro,
        // `$pl->getFechaInicio()->format()` crasheaba con NULL.
        $pls = $this->em->getRepository(PeriodoLectivo::class)->createQueryBuilder('pl')
            ->andWhere('pl.grupo = :g')
            ->andWhere('pl.deleted = false')
            ->andWhere('pl.tipo = :tipoSemana')
            ->setParameter('g', $grupo)
            ->setParameter('tipoSemana', \App\Entity\TipoPeriodoLectivo::SEMANA->value)
            ->orderBy('pl.fechaInicio', 'ASC')
            ->addOrderBy('pl.id', 'ASC')
            ->getQuery()->getResult();

        $rangosOut = [];
        $rangoMeta = [];
        $diasLectivosTotalesGrupo = 0;
        $diasLectivosTranscurridosGrupo = 0;

        foreach ($pls as $pl) {
            [$dias, $sem] = $this->semanasYDiasCached($centro, $pl->getFechaInicio(), $pl->getFechaFin());

            $finTrans = $fechaRef < $pl->getFechaFin() ? $fechaRef : $pl->getFechaFin();
            $diasTrans = 0;
            $semTrans = 0.0;
            if ($pl->getFechaInicio() <= $finTrans) {
                [$diasTrans, $semTrans] = $this->semanasYDiasCached($centro, $pl->getFechaInicio(), $finTrans);
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

        $evals = $this->em->getRepository(PeriodoEvaluativo::class)->createQueryBuilder('pe')
            ->andWhere('pe.grupo = :g')
            ->andWhere('pe.deleted = false')
            ->setParameter('g', $grupo)
            ->orderBy('pe.fechaInicio', 'ASC')
            ->addOrderBy('pe.id', 'ASC')
            ->getQuery()->getResult();

        $evaluacionesOut = [];
        foreach ($evals as $pe) {
            [$dias, $sem] = $this->semanasYDiasCached($centro, $pe->getFechaInicio(), $pe->getFechaFin());
            $finTrans = $fechaRef < $pe->getFechaFin() ? $fechaRef : $pe->getFechaFin();
            $diasTrans = 0;
            $semTrans = 0.0;
            if ($pe->getFechaInicio() <= $finTrans) {
                [$diasTrans, $semTrans] = $this->semanasYDiasCached($centro, $pe->getFechaInicio(), $finTrans);
            }
            $evaluacionesOut[] = [
                'id' => $pe->getId(),
                'nombre' => $pe->getNombre(),
                'tipo' => $pe->getTipo(),
                'fechaInicio' => $pe->getFechaInicio()->format('Y-m-d'),
                'fechaFin' => $pe->getFechaFin()->format('Y-m-d'),
                'peso' => $pe->getPeso(),
                'semanas' => $sem,
                'diasLectivos' => $dias,
                'semanasTranscurridas' => $semTrans,
                'diasLectivosTranscurridos' => $diasTrans,
            ];
        }

        $impas = $this->em->getRepository(Imparticion::class)->createQueryBuilder('i')
            ->andWhere('i.grupo = :g')
            ->andWhere('i.deleted = false')
            ->setParameter('g', $grupo)
            ->getQuery()->getResult();

        // Fase B.3 (2026-05-08): incidencias APROBADAS de tipo CANCELADO o
        // EVENTO_ESPECIAL restan minutos del cómputo curricular. Las de
        // SUSTITUCION e INTERCAMBIO NO afectan (la clase se imparte igual,
        // solo cambia el profe). Indexadas por imparticionId del horarioBase
        // para resta rápida en el loop de materias.
        $incidenciasByImpId = $this->loadIncidenciasRestadoras($grupo);

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

            // Resta incidencias CANCELADO/EVENTO_ESPECIAL aprobadas de la imp.
            // Cada incidencia "elimina" un bloque concreto del cómputo:
            //   - planTotal: siempre se descuenta (la clase no se imparte
            //     en el plan ajustado del curso).
            //   - impartidoTotal: se descuenta si la fecha ya pasó (ese
            //     bloque no se ha impartido y nunca se impartirá).
            $impIncidencias = $incidenciasByImpId[$imp->getId()] ?? [];
            $minutosPerdidosImp = 0;
            $minutosPerdidosImpHoy = 0;
            foreach ($impIncidencias as $inc) {
                $minutosPerdidosImp += $inc['minutos'];
                if ($inc['fecha'] <= $fechaRef) {
                    $minutosPerdidosImpHoy += $inc['minutos'];
                }
            }
            $planTotal       = max(0, $planTotal - $minutosPerdidosImp);
            $impartidoTotal  = max(0, $impartidoTotal - $minutosPerdidosImpHoy);

            // Resta incidencias también al porRango correspondiente (el rango
            // cuyo intervalo de fechas contiene la fechaConcreta de la
            // incidencia). Sin esto, el banner por evaluación que lee
            // porRango[].minutosPlanificados/Impartidos mostraría los
            // valores brutos sin descontar.
            if (!empty($impIncidencias)) {
                $rangoBoundsById = [];
                foreach ($pls as $pl) {
                    $rangoBoundsById[$pl->getId()] = [
                        $pl->getFechaInicio(),
                        $pl->getFechaFin(),
                    ];
                }
                foreach ($impIncidencias as $inc) {
                    foreach ($porRango as $idx => $pr) {
                        [$rIni, $rFin] = $rangoBoundsById[$pr['rangoId']] ?? [null, null];
                        if ($rIni && $rFin && $inc['fecha'] >= $rIni && $inc['fecha'] <= $rFin) {
                            $porRango[$idx]['minutosPlanificados'] = max(0, $pr['minutosPlanificados'] - $inc['minutos']);
                            if ($inc['fecha'] <= $fechaRef) {
                                $porRango[$idx]['minutosImpartidos'] = max(0, $porRango[$idx]['minutosImpartidos'] - $inc['minutos']);
                            }
                            break;
                        }
                    }
                }
            }

            $porEvaluacion = [];
            foreach ($evals as $pe) {
                [$planE, $impE] = $this->calcularMinutosEnEvaluacion(
                    $centro, $pe, $pls, $pliIndex, $imp, $fechaRef
                );
                // Resta incidencias cuya fecha cae dentro del rango de la
                // evaluación.
                $peIni = $pe->getFechaInicio();
                $peFin = $pe->getFechaFin();
                foreach ($impIncidencias as $inc) {
                    if ($peIni && $peFin && $inc['fecha'] >= $peIni && $inc['fecha'] <= $peFin) {
                        $planE = max(0, $planE - $inc['minutos']);
                        if ($inc['fecha'] <= $fechaRef) {
                            $impE = max(0, $impE - $inc['minutos']);
                        }
                    }
                }
                $porEvaluacion[] = [
                    'evaluacionId' => $pe->getId(),
                    'minutosPlanificados' => $planE,
                    'minutosImpartidos' => $impE,
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
                // Fase B.3: total de minutos descontados por incidencias
                // CANCELADO/EVENTO_ESPECIAL aprobadas. El frontend puede
                // mostrarlo como aclaración ("3h perdidas por incidencias").
                'minutosPerdidosIncidencias' => $minutosPerdidosImp,
                'minutosPerdidosIncidenciasHoy' => $minutosPerdidosImpHoy,
                'porRango' => $porRango,
                'porEvaluacion' => $porEvaluacion,
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
            'evaluaciones' => $evaluacionesOut,
            'materias' => $materiasOut,
        ];
    }

    /**
     * Para una imparticion y una evaluación, suma los minutos planificados e
     * impartidos calculando la intersección [PL ∩ Evaluación] de cada rango
     * con la ventana de la evaluación. Reusa el cache de ventana.
     *
     * @param iterable<PeriodoLectivo> $pls
     * @param array<int, array<int, \App\Entity\PeriodoLectivoImparticion>> $pliIndex
     * @return array{0:int, 1:int} [planificados, impartidos]
     */
    private function calcularMinutosEnEvaluacion(
        ?Centro $centro,
        PeriodoEvaluativo $pe,
        iterable $pls,
        array $pliIndex,
        Imparticion $imp,
        \DateTimeInterface $fechaRef,
    ): array {
        $plan = 0;
        $imp_ = 0;
        foreach ($pls as $pl) {
            $pli = $pliIndex[$imp->getId()][$pl->getId()] ?? null;
            if (!$pli) {
                continue;
            }
            $minSem = $pli->getEffectiveMinutosSemanales();
            if ($minSem <= 0) {
                continue;
            }

            $iIni = $pl->getFechaInicio() > $pe->getFechaInicio() ? $pl->getFechaInicio() : $pe->getFechaInicio();
            $iFin = $pl->getFechaFin() < $pe->getFechaFin() ? $pl->getFechaFin() : $pe->getFechaFin();
            if ($iIni > $iFin) {
                continue;
            }

            [, $sem] = $this->semanasYDiasCached($centro, $iIni, $iFin);
            $plan += (int) round($minSem * $sem);

            $iFinT = $iFin < $fechaRef ? $iFin : $fechaRef;
            if ($iIni <= $iFinT) {
                [, $semT] = $this->semanasYDiasCached($centro, $iIni, $iFinT);
                $imp_ += (int) round($minSem * $semT);
            }
        }
        return [$plan, $imp_];
    }

    /**
     * Cache local por invocación de `computeForGrupo`. Evita recomputar el
     * mismo `[fechaInicio, fechaFin]` cuando varias imparticiones × rangos ×
     * evaluaciones lo cruzan. Reset al inicio de cada `computeForGrupo`.
     *
     * @return array{0:int, 1:float} [diasLectivos, semanas]
     */
    private function semanasYDiasCached(?Centro $centro, \DateTimeInterface $inicio, \DateTimeInterface $fin): array
    {
        if ($centro === null) {
            return [0, 0.0];
        }
        $key = $inicio->format('Y-m-d') . '|' . $fin->format('Y-m-d');
        if (!isset($this->cacheVentana[$key])) {
            $r = $this->calendario->semanasLectivas($centro, EtapaEducativa::FP, $inicio, $fin);
            $this->cacheVentana[$key] = [(int) ($r['diasLectivos'] ?? 0), (float) ($r['semanas'] ?? 0.0)];
        }
        return $this->cacheVentana[$key];
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

    /**
     * Carga las incidencias APROBADAS de tipo CANCELADO o EVENTO_ESPECIAL
     * cuyo `horarioBase.imparticion.grupo == $grupo`. Indexa por
     * imparticionId para resta rápida en el loop principal.
     *
     * Las incidencias INTERCAMBIO/SUSTITUCION NO entran porque la clase
     * SE imparte (solo cambia el profe titular), no afecta cobertura
     * curricular.
     *
     * Cada entrada del array devuelto:
     *   ['fecha' => DateTimeInterface, 'minutos' => int, 'tipo' => string]
     *
     * @return array<int, list<array{fecha: \DateTimeInterface, minutos: int, tipo: string}>>
     */
    private function loadIncidenciasRestadoras(Grupo $grupo): array
    {
        $rows = $this->em->createQuery(
            "SELECT eh.id AS eh_id, eh.fechaConcreta AS fecha, eh.tipo AS tipo,
                    h.horaInicio AS hi, h.horaFin AS hf, i.id AS imp_id
             FROM App\\Entity\\ExcepcionHorario eh
             JOIN eh.horarioBase h
             JOIN h.imparticion i
             WHERE i.grupo = :grupo
               AND i.deleted = false
               AND eh.deleted = false
               AND eh.estado = :aprobada
               AND eh.tipo IN (:tiposRestadores)"
        )
            ->setParameter('grupo', $grupo)
            ->setParameter('aprobada', \App\Entity\EstadoExcepcion::APROBADA)
            ->setParameter('tiposRestadores', [
                \App\Entity\TipoExcepcion::CANCELADO,
                \App\Entity\TipoExcepcion::EVENTO_ESPECIAL,
            ])
            ->getResult();

        $byImp = [];
        foreach ($rows as $r) {
            $hi = $r['hi'];
            $hf = $r['hf'];
            if (!$hi instanceof \DateTimeInterface || !$hf instanceof \DateTimeInterface) {
                continue;
            }
            $minutos = (int) (($hf->getTimestamp() - $hi->getTimestamp()) / 60);
            if ($minutos <= 0) continue;
            $byImp[(int) $r['imp_id']][] = [
                'fecha'   => $r['fecha'],
                'minutos' => $minutos,
                'tipo'    => $r['tipo'] instanceof \BackedEnum ? $r['tipo']->value : (string) $r['tipo'],
            ];
        }
        return $byImp;
    }
}
