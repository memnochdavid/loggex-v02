<?php

namespace App\Service;

use App\Entity\Grupo;
use App\Entity\Imparticion;
use Doctrine\ORM\EntityManagerInterface;

class HorarioSolver
{
    private const DIAS = [1, 2, 3, 4, 5];

    private const SLOTS_MANANA = [
        ['08:30', '09:30'], ['09:30', '10:30'], ['10:30', '11:30'],
        ['11:30', '12:30'], ['12:30', '13:30'], ['13:30', '14:30'],
    ];

    private const SLOTS_TARDE = [
        ['15:00', '16:00'], ['16:00', '17:00'], ['17:00', '18:00'],
        ['18:00', '19:00'], ['19:00', '20:00'], ['20:00', '21:00'],
    ];

    private const TIMEOUT_SEC = 2.0;
    // Preferencia (no límite) para compactar: penaliza pasar de este umbral
    private const SOFT_SAME_MODULE_PER_DAY = 3;

    private float $startedAt = 0.0;
    private array $bestPlacements = [];
    private bool $timedOut = false;
    private int $nodesExplored = 0;
    private int $maxDepth = 0;

    public function __construct(private EntityManagerInterface $em)
    {
    }

    public function solve(Grupo $grupo, ?int $seed = null): array
    {
        $turno = $this->turnoFromCiclo($grupo->getCiclo()?->getNombre() ?? '');
        $slots = $turno === 'T' ? self::SLOTS_TARDE : self::SLOTS_MANANA;

        $imps = $this->em->getRepository(Imparticion::class)->findBy(['grupo' => $grupo]);
        $parallelBusy = $this->buildParallelBusy($grupo, $turno);

        // Expandir a "una tarea por hora a colocar"
        $tasks = [];
        foreach ($imps as $imp) {
            $horas = $imp->getModulo()?->getHorasSemanales() ?? 0;
            for ($i = 0; $i < $horas; $i++) {
                $tasks[] = $imp;
            }
        }

        // Heurística: colocar primero imparticiones cuyo profesor tiene más
        // huecos bloqueados por grupos paralelos (más restringidas).
        $busyPerProf = [];
        foreach ($parallelBusy as $pids) {
            foreach ($pids as $pid) {
                $busyPerProf[$pid] = ($busyPerProf[$pid] ?? 0) + 1;
            }
        }
        usort($tasks, function ($a, $b) use ($busyPerProf) {
            $pa = $a->getProfesor()?->getId();
            $pb = $b->getProfesor()?->getId();
            return ($busyPerProf[$pb] ?? 0) <=> ($busyPerProf[$pa] ?? 0);
        });

        if ($seed !== null) {
            mt_srand($seed);
            $tasks = $this->shuffleCopy($tasks);
        }

        $cells = [];
        foreach (self::DIAS as $d) {
            foreach ($slots as $s) {
                $cells[] = ['dia' => $d, 'hi' => $s[0], 'hf' => $s[1]];
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

        $placedPerImp = [];
        foreach ($placements as $p) {
            $iid = $p['imp']->getId();
            $placedPerImp[$iid] = ($placedPerImp[$iid] ?? 0) + 1;
        }
        $unplaced = [];
        foreach ($imps as $imp) {
            $total = $imp->getModulo()?->getHorasSemanales() ?? 0;
            $placed = $placedPerImp[$imp->getId()] ?? 0;
            if ($placed < $total) {
                $unplaced[] = [
                    'imparticionId' => $imp->getId(),
                    'modulo' => $imp->getModulo()?->getNombre(),
                    'horasRestantes' => $total - $placed,
                ];
            }
        }

        $aula = $grupo->getAbreviatura() ? 'Aula ' . $grupo->getAbreviatura() : 'Aula';
        $out = [];
        foreach ($placements as $p) {
            $out[] = [
                'diaSemana' => $p['dia'],
                'horaInicio' => $p['hi'] . ':00',
                'horaFin' => $p['hf'] . ':00',
                'aula' => $aula,
                'imparticionId' => $p['imp']->getId(),
            ];
        }

        // Info para depuración
        $tasksPerImp = [];
        foreach ($imps as $imp) {
            $tasksPerImp[] = [
                'imparticionId' => $imp->getId(),
                'modulo' => $imp->getModulo()?->getNombre(),
                'profesor' => trim(($imp->getProfesor()?->getNombre() ?? '').' '.($imp->getProfesor()?->getApellidos() ?? '')),
                'profesorId' => $imp->getProfesor()?->getId(),
                'horasSemanales' => $imp->getModulo()?->getHorasSemanales() ?? 0,
            ];
        }
        $parallelBusySummary = [];
        foreach ($parallelBusy as $k => $pids) {
            $parallelBusySummary[$k] = array_values(array_unique($pids));
        }

        return [
            'complete' => $ok,
            'placements' => $out,
            'unplaced' => $unplaced,
            'debug' => [
                'turno' => $turno,
                'totalSlots' => count($cells),
                'totalHorasAColocar' => count($tasks),
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

    private function backtrack(int $idx, array $tasks, array $cells, array &$placements, array &$profBusyLocal, array $parallelBusy, ?int $seed): bool
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
        $imp = $tasks[$idx];
        $pid = $imp->getProfesor()?->getId();
        $moduloId = $imp->getModulo()?->getId();

        // Ordenar candidatas: prioriza días donde ya hay bloques del mismo módulo
        // (hasta MAX_SAME_MODULE_PER_DAY), luego el resto.
        $candidates = $cells;
        if ($seed !== null) {
            mt_srand($seed + $idx * 31);
            $candidates = $this->shuffleCopy($candidates);
        }
        $sameDayScore = function (int $dia) use ($placements, $moduloId) {
            $n = 0;
            foreach ($placements as $k => $p) {
                [$dk] = explode('_', $k);
                if ((int) $dk === $dia && $p['imp']->getModulo()?->getId() === $moduloId) {
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
            $key = $c['dia'] . '_' . $c['hi'];
            if (isset($placements[$key])) continue;
            if ($pid && isset($profBusyLocal[$key]) && in_array($pid, $profBusyLocal[$key], true)) continue;
            if ($pid && isset($parallelBusy[$key]) && in_array($pid, $parallelBusy[$key], true)) continue;

            $placements[$key] = ['imp' => $imp, 'hi' => $c['hi'], 'hf' => $c['hf'], 'dia' => $c['dia']];
            if ($pid) $profBusyLocal[$key][] = $pid;

            if ($this->backtrack($idx + 1, $tasks, $cells, $placements, $profBusyLocal, $parallelBusy, $seed)) {
                return true;
            }

            unset($placements[$key]);
            if ($pid && isset($profBusyLocal[$key])) {
                $profBusyLocal[$key] = array_values(array_filter($profBusyLocal[$key], fn ($x) => $x !== $pid));
                if (empty($profBusyLocal[$key])) unset($profBusyLocal[$key]);
            }

            if (microtime(true) - $this->startedAt > self::TIMEOUT_SEC) return false;
        }
        return false;
    }

    private function buildParallelBusy(Grupo $grupo, string $turno): array
    {
        $centro = $grupo->getCentro();
        if (!$centro) return [];
        $grupos = $this->em->getRepository(Grupo::class)->findBy(['centro' => $centro]);
        $busy = [];
        foreach ($grupos as $g) {
            if ($g->getId() === $grupo->getId()) continue;
            if ($this->turnoFromCiclo($g->getCiclo()?->getNombre() ?? '') !== $turno) continue;
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

    private function turnoFromCiclo(string $nombre): string
    {
        $n = strtoupper($nombre);
        if (str_contains($n, 'WEB')) return 'M';
        if (str_contains($n, 'MULTIPLATAFORMA')) return 'T';
        return 'M';
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
