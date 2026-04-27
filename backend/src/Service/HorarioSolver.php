<?php

namespace App\Service;

use App\Entity\Grupo;
use App\Entity\Imparticion;
use App\Entity\JornadaTipo;
use App\Entity\TipoTramo;
use App\Entity\TurnoJornada;
use Doctrine\ORM\EntityManagerInterface;

class HorarioSolver
{
    private const TIMEOUT_SEC = 2.0;
    // Preferencia (no límite) para compactar: penaliza pasar de este umbral
    private const SOFT_SAME_MODULE_PER_DAY = 3;

    private float $startedAt = 0.0;
    private array $bestPlacements = [];
    private bool $timedOut = false;
    private int $nodesExplored = 0;
    private int $maxDepth = 0;

    public function __construct(
        private EntityManagerInterface $em,
        private CapacityPlanner $planner,
    ) {
    }

    public function solve(Grupo $grupo, ?int $seed = null): array
    {
        $jornada = $grupo->getItinerario()?->getJornadaTipo();
        if ($jornada === null) {
            return [
                'complete' => false,
                'placements' => [],
                'unplaced' => [],
                'debug' => [
                    'error' => 'Sin jornada asignada al itinerario. Asigna una en /admin/jornadas.',
                ],
            ];
        }

        $diasLectivos = $jornada->getDiasLectivos() ?: [1, 2, 3, 4, 5];
        $slots = $this->slotsFromJornada($jornada);
        if (empty($slots)) {
            return [
                'complete' => false,
                'placements' => [],
                'unplaced' => [],
                'debug' => [
                    'error' => 'La jornada no contiene tramos de tipo SLOT.',
                ],
            ];
        }

        // Pre-asignación cuantitativa (sub-fase O, §14.7): el CapacityPlanner decide
        // cuántos slots de cada duración recibe cada imparticion ANTES del backtracking
        // topológico. Si la combinatoria es infactible (capacidad < total), el solver
        // se detiene aquí con el diagnóstico del planner — no hay nada que el
        // backtracking pueda hacer al respecto.
        $capacity = $this->planner->plan($grupo);
        if (!$capacity['feasible']) {
            return [
                'complete' => false,
                'placements' => [],
                'unplaced' => $capacity['huerfanos'],
                'capacity' => $capacity,
                'debug' => [
                    'error' => 'El itinerario no cabe en la jornada según CapacityPlanner.',
                    'capacity' => $capacity,
                ],
            ];
        }

        $turno = $jornada->getTurno();
        $imps = $this->em->getRepository(Imparticion::class)->findBy(['grupo' => $grupo]);
        $parallelBusy = $this->buildParallelBusy($grupo, $turno);

        // Una tarea por imparticion con cuotas por duración (preasignadas por el
        // planner). El backtracking ya no inventa el reparto cuantitativo: solo
        // decide día y posición. Cuando todas las cuotas llegan a 0 la imparticion
        // está completa. El round-up acordado (D22=A) ya está incorporado en las
        // cuotas (el planner generó combos con sum >= minutos).
        $tasks = [];
        foreach ($imps as $imp) {
            $minutos = $imp->getMateria()?->getMinutosSemanales() ?? 0;
            if ($minutos <= 0) continue;
            $cuotas = $capacity['asignacion'][$imp->getId()] ?? [];
            if (empty($cuotas) || array_sum($cuotas) === 0) continue;
            $tasks[] = [
                'imp' => $imp,
                'cuotas' => $cuotas,
                'total' => $minutos,
            ];
        }

        // Heurística: empezar por imparticiones cuyo profesor tiene más
        // huecos bloqueados por grupos paralelos (más restringidas).
        $busyPerProf = [];
        foreach ($parallelBusy as $pids) {
            foreach ($pids as $pid) {
                $busyPerProf[$pid] = ($busyPerProf[$pid] ?? 0) + 1;
            }
        }
        usort($tasks, function ($a, $b) use ($busyPerProf) {
            $pa = $a['imp']->getProfesor()?->getId();
            $pb = $b['imp']->getProfesor()?->getId();
            return ($busyPerProf[$pb] ?? 0) <=> ($busyPerProf[$pa] ?? 0);
        });

        if ($seed !== null) {
            mt_srand($seed);
            $tasks = $this->shuffleCopy($tasks);
        }

        $cells = [];
        foreach ($diasLectivos as $d) {
            foreach ($slots as $s) {
                $cells[] = ['dia' => $d, 'hi' => $s[0], 'hf' => $s[1], 'min' => $s[2]];
            }
        }

        $placements = [];       // key "dia_hi" => ['imp' => Imparticion, 'hi', 'hf', 'dia']
        $profBusyLocal = [];    // key "dia_hi" => [profId, ...]
        $this->startedAt = microtime(true);
        $this->bestPlacements = [];
        $this->timedOut = false;
        $this->nodesExplored = 0;
        $this->maxDepth = 0;

        $ok = $this->backtrack(0, $tasks, $cells, $placements, $profBusyLocal, $parallelBusy, $seed);

        // Si no logró solución completa, usar la mejor parcial vista (no la última,
        // que puede estar vacía tras unwind por timeout/dead-end).
        if (!$ok && count($this->bestPlacements) > count($placements)) {
            $placements = $this->bestPlacements;
        }

        $placedMinPerImp = [];
        foreach ($placements as $p) {
            $iid = $p['imp']->getId();
            $placedMinPerImp[$iid] = ($placedMinPerImp[$iid] ?? 0) + (int) $p['min'];
        }
        // Tras pre-asignación cuantitativa, "completo" significa que cada imparticion
        // recibió todos los slots de su cuota — no que sus minutos cuadren exacto con
        // los declarados (puede haber round-up D22=A si el planner devolvió delta>0).
        $unplaced = [];
        foreach ($imps as $imp) {
            $cuotaImp = $capacity['asignacion'][$imp->getId()] ?? [];
            $minutosCuota = 0;
            foreach ($cuotaImp as $d => $c) $minutosCuota += $d * $c;
            $placedMin = $placedMinPerImp[$imp->getId()] ?? 0;
            if ($placedMin < $minutosCuota) {
                $faltanMin = $minutosCuota - $placedMin;
                $unplaced[] = [
                    'imparticionId' => $imp->getId(),
                    'materia' => $imp->getMateria()?->getNombre(),
                    'minutosRestantes' => $faltanMin,
                    'horasRestantes' => round($faltanMin / 60, 2),
                ];
            }
        }

        // Cascada de aula: aulaEspecifica de la imparticion → aulaDefault del
        // grupo → "Aula " + abreviatura. El admin puede sobrescribirla por slot
        // editando manualmente Horario.aula en /admin/horarios (cuarto nivel).
        $out = [];
        foreach ($placements as $p) {
            $out[] = [
                'diaSemana' => $p['dia'],
                'horaInicio' => $p['hi'] . ':00',
                'horaFin' => $p['hf'] . ':00',
                'aula' => $p['imp']->resolveAula(),
                'imparticionId' => $p['imp']->getId(),
            ];
        }

        // Info para depuración
        $tasksPerImp = [];
        $totalMinAColocar = 0;
        foreach ($imps as $imp) {
            $minutos = $imp->getMateria()?->getMinutosSemanales() ?? 0;
            $totalMinAColocar += $minutos;
            $tasksPerImp[] = [
                'imparticionId' => $imp->getId(),
                'materia' => $imp->getMateria()?->getNombre(),
                'profesor' => trim(($imp->getProfesor()?->getNombre() ?? '').' '.($imp->getProfesor()?->getApellidos() ?? '')),
                'profesorId' => $imp->getProfesor()?->getId(),
                'minutosTotales' => $minutos,
                'horasSemanales' => round($minutos / 60, 2),
            ];
        }
        $parallelBusySummary = [];
        foreach ($parallelBusy as $k => $pids) {
            $parallelBusySummary[$k] = array_values(array_unique($pids));
        }
        $minutosColocados = array_sum($placedMinPerImp);

        return [
            'complete' => $ok,
            'placements' => $out,
            'unplaced' => $unplaced,
            'capacity' => $capacity,
            'debug' => [
                'jornadaId' => $jornada->getId(),
                'jornadaNombre' => $jornada->getNombre(),
                'turno' => $turno?->value,
                'diasLectivos' => $diasLectivos,
                'slotsPorDia' => count($slots),
                'totalSlots' => count($cells),
                'totalMinutosAColocar' => $totalMinAColocar,
                'minutosColocados' => $minutosColocados,
                'imparticiones' => $tasksPerImp,
                'parallelBusyCellsCount' => count($parallelBusy),
                'parallelBusy' => $parallelBusySummary,
                'elapsedSec' => round(microtime(true) - $this->startedAt, 3),
                'timedOut' => $this->timedOut,
                'nodesExplored' => $this->nodesExplored,
                'maxDepthReached' => $this->maxDepth,
                'placedCount' => count($out),
                'bestPartialUsed' => !$ok && count($this->bestPlacements) > 0,
            ],
        ];
    }

    /**
     * Devuelve los slots asignables de una jornada en formato
     * [['HH:MM', 'HH:MM', duracionMinutos], ...] ordenados por horaInicio.
     * Filtra los tramos de tipo RECREO.
     *
     * @return array<int, array{0: string, 1: string, 2: int}>
     */
    private function slotsFromJornada(JornadaTipo $jornada): array
    {
        $tramos = $jornada->getTramos()->toArray();
        usort($tramos, fn ($a, $b) => $a->getHoraInicio() <=> $b->getHoraInicio());
        $out = [];
        foreach ($tramos as $t) {
            if ($t->getTipo() !== TipoTramo::SLOT) continue;
            $hi = $t->getHoraInicio()?->format('H:i');
            $hf = $t->getHoraFin()?->format('H:i');
            if ($hi === null || $hf === null) continue;
            $out[] = [$hi, $hf, $t->getDuracionMinutos()];
        }
        return $out;
    }

    private function backtrack(int $idx, array &$tasks, array $cells, array &$placements, array &$profBusyLocal, array $parallelBusy, ?int $seed): bool
    {
        $this->nodesExplored++;
        if ($idx > $this->maxDepth) $this->maxDepth = $idx;
        // Actualizar mejor parcial vista antes de cualquier retorno
        if (count($placements) > count($this->bestPlacements)) {
            $this->bestPlacements = $placements;
        }
        if ($this->timedOut || microtime(true) - $this->startedAt > self::TIMEOUT_SEC) {
            $this->timedOut = true;
            return false;
        }
        if ($idx >= count($tasks)) {
            return true;
        }
        // Si todas las cuotas de la imparticion están agotadas, pasamos a la siguiente.
        // Las cuotas son la pre-asignación cuantitativa del CapacityPlanner: ya
        // incluyen el round-up D22=A si lo hay.
        if (array_sum($tasks[$idx]['cuotas']) === 0) {
            return $this->backtrack($idx + 1, $tasks, $cells, $placements, $profBusyLocal, $parallelBusy, $seed);
        }

        $imp = $tasks[$idx]['imp'];
        $pid = $imp->getProfesor()?->getId();
        $moduloId = $imp->getMateria()?->getId();

        // Ordenar candidatas: prioriza días donde ya hay bloques del mismo módulo
        // (hasta SOFT_SAME_MODULE_PER_DAY), luego el resto.
        $candidates = $cells;
        if ($seed !== null) {
            mt_srand($seed + $idx * 31);
            $candidates = $this->shuffleCopy($candidates);
        }
        $sameDayScore = function (int $dia) use ($placements, $moduloId) {
            $n = 0;
            foreach ($placements as $k => $p) {
                [$dk] = explode('_', $k);
                if ((int) $dk === $dia && $p['imp']->getMateria()?->getId() === $moduloId) {
                    $n++;
                }
            }
            return $n;
        };
        // Ordenación: primero días con 1-2 bloques del mismo módulo (compactar),
        // luego días vacíos, y por último los que ya tienen >=3 (para no pasarse).
        usort($candidates, function ($a, $b) use ($sameDayScore) {
            $sa = $sameDayScore($a['dia']);
            $sb = $sameDayScore($b['dia']);
            $rank = fn ($s) => $s === 0 ? 1 : ($s < self::SOFT_SAME_MODULE_PER_DAY ? 2 : 0);
            return $rank($sb) <=> $rank($sa);
        });

        foreach ($candidates as $c) {
            // Filtro de cuota: la imparticion solo puede coger slots de duraciones
            // para las que el planner asignó cupo restante.
            if (($tasks[$idx]['cuotas'][$c['min']] ?? 0) <= 0) continue;

            $key = $c['dia'] . '_' . $c['hi'];
            if (isset($placements[$key])) continue;
            if ($pid && isset($profBusyLocal[$key]) && in_array($pid, $profBusyLocal[$key], true)) continue;
            if ($pid && isset($parallelBusy[$key]) && in_array($pid, $parallelBusy[$key], true)) continue;

            $placements[$key] = ['imp' => $imp, 'hi' => $c['hi'], 'hf' => $c['hf'], 'dia' => $c['dia'], 'min' => $c['min']];
            if ($pid) $profBusyLocal[$key][] = $pid;
            $tasks[$idx]['cuotas'][$c['min']]--;

            // Recurse en el MISMO idx: si la cuota llegó a 0 en todas las
            // duraciones, la cabecera saltará a idx+1; si no, seguirá colocando
            // slots para esta imparticion.
            if ($this->backtrack($idx, $tasks, $cells, $placements, $profBusyLocal, $parallelBusy, $seed)) {
                return true;
            }

            $tasks[$idx]['cuotas'][$c['min']]++;
            unset($placements[$key]);
            if ($pid && isset($profBusyLocal[$key])) {
                $profBusyLocal[$key] = array_values(array_filter($profBusyLocal[$key], fn ($x) => $x !== $pid));
                if (empty($profBusyLocal[$key])) unset($profBusyLocal[$key]);
            }

            if (microtime(true) - $this->startedAt > self::TIMEOUT_SEC) return false;
        }
        return false;
    }

    /**
     * Calcula la ocupación de profesores en grupos paralelos del mismo centro
     * cuya jornada comparte el mismo `turno` con la del grupo actual. Esto
     * impide que un profesor se asigne en dos grupos a la vez.
     *
     * Nota: comparamos por `turno` (enum mañana/tarde) en lugar de solape real
     * de rangos horarios. Es una aproximación suficiente y barata; si dos
     * jornadas distintas pero ambas "MAÑANA" no se solapan en la práctica,
     * se cuenta de más pero no rompe nada.
     */
    private function buildParallelBusy(Grupo $grupo, ?TurnoJornada $turno): array
    {
        $centro = $grupo->getCentro();
        if (!$centro || $turno === null) return [];
        $grupos = $this->em->getRepository(Grupo::class)->findBy(['centro' => $centro]);
        $busy = [];
        foreach ($grupos as $g) {
            if ($g->getId() === $grupo->getId()) continue;
            $jOtro = $g->getItinerario()?->getJornadaTipo();
            if ($jOtro === null) continue;
            if ($jOtro->getTurno() !== $turno) continue;
            $imps = $this->em->getRepository(Imparticion::class)->findBy(['grupo' => $g]);
            foreach ($imps as $imp) {
                $pid = $imp->getProfesor()?->getId();
                if (!$pid) continue;
                foreach ($imp->getHorarios() as $h) {
                    $dia = $h->getDiaSemana();
                    $hi = $h->getHoraInicio()?->format('H:i');
                    if ($hi === null) continue;
                    $busy[$dia . '_' . $hi][] = $pid;
                }
            }
        }
        return $busy;
    }

    private function shuffleCopy(array $arr): array
    {
        for ($i = count($arr) - 1; $i > 0; $i--) {
            $j = mt_rand(0, $i);
            [$arr[$i], $arr[$j]] = [$arr[$j], $arr[$i]];
        }
        return $arr;
    }
}
