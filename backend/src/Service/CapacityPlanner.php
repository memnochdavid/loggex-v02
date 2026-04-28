<?php

namespace App\Service;

use App\Entity\Grupo;
use App\Entity\Imparticion;
use App\Entity\JornadaTipo;
use App\Entity\TipoTramo;
use Doctrine\ORM\EntityManagerInterface;

/**
 * Pre-asignación cuantitativa de slots a materias antes del backtracking topológico.
 *
 * Resuelve el ILP "cuántos slots de cada duración recibe cada materia" de forma que
 * Σ_j d_j · x_ij ≥ m_i (cubre o sobrepasa por menos que un slot del tamaño máximo)
 * y Σ_i x_ij ≤ N_j (no se usan más slots de los disponibles), minimizando el desajuste
 * total Σ_i (Σ_j d_j · x_ij − m_i).
 *
 * El backtracking topológico (HorarioSolver) recibe la asignación cuantitativa como
 * restricción dura: solo decide en qué día y posición van los slots ya pre-asignados.
 *
 * Ver `docs/hoja-de-ruta-jornadas-recreos.md` §14.7.
 */
class CapacityPlanner
{
    private const MAX_COMBOS_PER_MATERIA = 30;
    private const TIMEOUT_SEC = 1.5;

    private array $bestSolution = [];
    private int $bestCost = PHP_INT_MAX;
    private float $startedAt = 0.0;
    private bool $timedOut = false;
    private int $nodesExplored = 0;

    public function __construct(private EntityManagerInterface $em)
    {
    }

    /**
     * @return array{
     *   feasible: bool,
     *   totalMinutos: int,
     *   capacidadMinutos: int,
     *   desajuste: int,
     *   asignacion: array<int, array<int, int>>,
     *   roundups: array<int, array{impId:int, materia:string, deltaMin:int, motivo:string}>,
     *   huerfanos: array<int, array{impId:int, materia:string, minutosRestantes:int, horasRestantes:float}>,
     *   slotsDisponibles: array<int, int>,
     *   debug: array<string, mixed>
     * }
     */
    public function plan(Grupo $grupo): array
    {
        // Lee la jornada efectiva (override del grupo si lo hay, default del itinerario).
        $jornada = $grupo->getEffectiveJornadaTipo();
        if ($jornada === null) {
            return $this->errorResult('Sin jornada asignada al itinerario ni override en el grupo.');
        }

        $diasLectivos = $jornada->getDiasLectivos() ?: [1, 2, 3, 4, 5];
        $slotsBase = $this->slotsFromJornada($jornada);
        if (empty($slotsBase)) {
            return $this->errorResult('La jornada no contiene tramos de tipo SLOT.');
        }

        $slotsDisponibles = [];
        foreach ($slotsBase as $slot) {
            $duracion = $slot[2];
            $slotsDisponibles[$duracion] = ($slotsDisponibles[$duracion] ?? 0) + count($diasLectivos);
        }
        ksort($slotsDisponibles);
        $duraciones = array_keys($slotsDisponibles);

        $imps = $this->em->getRepository(Imparticion::class)->findBy(['grupo' => $grupo]);
        $materias = [];
        $totalMinutos = 0;
        foreach ($imps as $imp) {
            $minutos = $imp->getMateria()?->getMinutosSemanales() ?? 0;
            if ($minutos <= 0) continue;
            $materias[] = [
                'impId' => $imp->getId(),
                'nombre' => $imp->getMateria()?->getNombre() ?? '?',
                'minutos' => (int) $minutos,
            ];
            $totalMinutos += (int) $minutos;
        }

        $capacidadMinutos = 0;
        foreach ($duraciones as $d) {
            $capacidadMinutos += $d * $slotsDisponibles[$d];
        }

        if (empty($materias)) {
            return [
                'feasible' => true,
                'totalMinutos' => 0,
                'capacidadMinutos' => $capacidadMinutos,
                'desajuste' => 0,
                'asignacion' => [],
                'roundups' => [],
                'huerfanos' => [],
                'slotsDisponibles' => $slotsDisponibles,
                'debug' => ['note' => 'sin imparticiones con minutos > 0'],
            ];
        }

        if ($capacidadMinutos < $totalMinutos) {
            return [
                'feasible' => false,
                'totalMinutos' => $totalMinutos,
                'capacidadMinutos' => $capacidadMinutos,
                'desajuste' => $totalMinutos - $capacidadMinutos,
                'asignacion' => [],
                'roundups' => [],
                'huerfanos' => array_map(fn ($m) => [
                    'impId' => $m['impId'],
                    'materia' => $m['nombre'],
                    'minutosRestantes' => $m['minutos'],
                    'horasRestantes' => round($m['minutos'] / 60, 2),
                ], $materias),
                'slotsDisponibles' => $slotsDisponibles,
                'debug' => ['error' => 'capacidad insuficiente: capacidad < Σ minutos'],
            ];
        }

        $maxD = max($duraciones);
        $combosPorMateria = [];
        foreach ($materias as $idx => $m) {
            $combos = $this->generateCombos($m['minutos'], $duraciones, $maxD, $slotsDisponibles);
            usort($combos, fn ($a, $b) => $a['delta'] <=> $b['delta']);
            $combos = array_slice($combos, 0, self::MAX_COMBOS_PER_MATERIA);
            if (empty($combos)) {
                return [
                    'feasible' => false,
                    'totalMinutos' => $totalMinutos,
                    'capacidadMinutos' => $capacidadMinutos,
                    'desajuste' => 0,
                    'asignacion' => [],
                    'roundups' => [],
                    'huerfanos' => [[
                        'impId' => $m['impId'],
                        'materia' => $m['nombre'],
                        'minutosRestantes' => $m['minutos'],
                        'horasRestantes' => round($m['minutos'] / 60, 2),
                    ]],
                    'slotsDisponibles' => $slotsDisponibles,
                    'debug' => ['error' => "ninguna combinación de slots cubre la materia '{$m['nombre']}' ({$m['minutos']}min)"],
                ];
            }
            $combosPorMateria[$idx] = $combos;
        }

        $minDeltaRestante = array_fill(0, count($materias) + 1, 0);
        for ($i = count($materias) - 1; $i >= 0; $i--) {
            $minDeltaRestante[$i] = $minDeltaRestante[$i + 1] + $combosPorMateria[$i][0]['delta'];
        }

        $this->bestSolution = [];
        $this->bestCost = PHP_INT_MAX;
        $this->startedAt = microtime(true);
        $this->timedOut = false;
        $this->nodesExplored = 0;

        $this->backtrack($materias, $combosPorMateria, $slotsDisponibles, 0, [], 0, $minDeltaRestante);

        if (empty($this->bestSolution)) {
            return [
                'feasible' => false,
                'totalMinutos' => $totalMinutos,
                'capacidadMinutos' => $capacidadMinutos,
                'desajuste' => 0,
                'asignacion' => [],
                'roundups' => [],
                'huerfanos' => array_map(fn ($m) => [
                    'impId' => $m['impId'],
                    'materia' => $m['nombre'],
                    'minutosRestantes' => $m['minutos'],
                    'horasRestantes' => round($m['minutos'] / 60, 2),
                ], $materias),
                'slotsDisponibles' => $slotsDisponibles,
                'debug' => [
                    'error' => 'no se encontró asignación factible (combinatoria sin solución).',
                    'timedOut' => $this->timedOut,
                    'nodesExplored' => $this->nodesExplored,
                ],
            ];
        }

        $asignacion = [];
        $roundups = [];
        foreach ($materias as $idx => $m) {
            $combo = $this->bestSolution[$idx];
            $asignacion[$m['impId']] = $combo['x'];
            if ($combo['delta'] > 0) {
                $roundups[] = [
                    'impId' => $m['impId'],
                    'materia' => $m['nombre'],
                    'deltaMin' => $combo['delta'],
                    'motivo' => $this->explicarMotivo($combo, $m, $duraciones),
                ];
            }
        }

        return [
            'feasible' => true,
            'totalMinutos' => $totalMinutos,
            'capacidadMinutos' => $capacidadMinutos,
            'desajuste' => $this->bestCost,
            'asignacion' => $asignacion,
            'roundups' => $roundups,
            'huerfanos' => [],
            'slotsDisponibles' => $slotsDisponibles,
            'debug' => [
                'duraciones' => $duraciones,
                'materiasCount' => count($materias),
                'nodesExplored' => $this->nodesExplored,
                'elapsedSec' => round(microtime(true) - $this->startedAt, 3),
                'timedOut' => $this->timedOut,
            ],
        ];
    }

    /**
     * Genera todas las combinaciones (x_1, ..., x_k) tales que:
     * - Σ d_j·x_j ≥ m
     * - Σ d_j·x_j < m + maxD (sobrepaso < el slot más grande, por D22=A)
     * - x_j ≤ disponibles[d_j]
     */
    private function generateCombos(int $m, array $duraciones, int $maxD, array $disponibles): array
    {
        $combos = [];
        $this->generateCombosRecursive($m, $duraciones, 0, [], 0, $maxD, $disponibles, $combos);
        return $combos;
    }

    private function generateCombosRecursive(int $m, array $duraciones, int $idx, array $x, int $sum, int $maxD, array $disponibles, array &$combos): void
    {
        if ($idx === count($duraciones)) {
            if ($sum >= $m && $sum < $m + $maxD) {
                $xMap = [];
                foreach ($duraciones as $i => $d) {
                    $xMap[$d] = $x[$i] ?? 0;
                }
                $combos[] = ['x' => $xMap, 'delta' => $sum - $m, 'sum' => $sum];
            }
            return;
        }
        $d = $duraciones[$idx];
        $maxCount = $disponibles[$d];
        for ($c = 0; $c <= $maxCount; $c++) {
            $newSum = $sum + $c * $d;
            if ($newSum >= $m + $maxD) break;
            $newX = $x;
            $newX[$idx] = $c;
            $this->generateCombosRecursive($m, $duraciones, $idx + 1, $newX, $newSum, $maxD, $disponibles, $combos);
        }
    }

    private function backtrack(array $materias, array $combosPorMateria, array $disponibles, int $idx, array $current, int $costSoFar, array $minDeltaRestante): void
    {
        $this->nodesExplored++;
        if ($this->bestCost === 0) return;
        if ($this->timedOut || microtime(true) - $this->startedAt > self::TIMEOUT_SEC) {
            $this->timedOut = true;
            return;
        }
        if ($costSoFar + $minDeltaRestante[$idx] >= $this->bestCost) return;

        if ($idx === count($materias)) {
            $this->bestSolution = $current;
            $this->bestCost = $costSoFar;
            return;
        }

        foreach ($combosPorMateria[$idx] as $combo) {
            $cabe = true;
            foreach ($combo['x'] as $d => $c) {
                if (($disponibles[$d] ?? 0) < $c) { $cabe = false; break; }
            }
            if (!$cabe) continue;

            $newDisp = $disponibles;
            foreach ($combo['x'] as $d => $c) {
                $newDisp[$d] -= $c;
            }
            $newCurrent = $current;
            $newCurrent[$idx] = $combo;
            $this->backtrack($materias, $combosPorMateria, $newDisp, $idx + 1, $newCurrent, $costSoFar + $combo['delta'], $minDeltaRestante);
            if ($this->bestCost === 0) return;
        }
    }

    private function explicarMotivo(array $combo, array $materia, array $duraciones): string
    {
        $partes = [];
        foreach ($combo['x'] as $d => $c) {
            if ($c > 0) $partes[] = "{$c}×{$d}min";
        }
        return sprintf(
            'Encaje %s = %dmin sobre %dmin requeridos (%+dmin)',
            implode(' + ', $partes),
            $combo['sum'],
            $materia['minutos'],
            $combo['delta']
        );
    }

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

    private function errorResult(string $msg): array
    {
        return [
            'feasible' => false,
            'totalMinutos' => 0,
            'capacidadMinutos' => 0,
            'desajuste' => 0,
            'asignacion' => [],
            'roundups' => [],
            'huerfanos' => [],
            'slotsDisponibles' => [],
            'debug' => ['error' => $msg],
        ];
    }
}
