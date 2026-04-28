<?php

namespace App\Service;

use App\Entity\Grupo;
use App\Entity\JornadaTipo;
use App\Entity\PeriodoLectivo;
use App\Entity\PeriodoLectivoImparticion;
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

    public function __construct(
        private EntityManagerInterface $em,
        private PeriodoLectivoResolver $resolver,
    ) {
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
    public function plan(Grupo $grupo, ?PeriodoLectivo $periodoLectivo = null): array
    {
        // Resuelve el rango lectivo activo si el caller no lo pasa explícitamente.
        $periodoLectivo = $periodoLectivo ?? $this->resolver->resolveActive($grupo);
        if ($periodoLectivo === null) {
            return $this->errorResult('Grupo sin PeriodoLectivo (caso imposible tras la migración Fase 1).');
        }

        // Jornada efectiva del rango: la propia si está set, sino fallback al
        // grupo (override) y al itinerario. Cadena completa en
        // PeriodoLectivo::getEffectiveJornadaTipo().
        $jornada = $periodoLectivo->getEffectiveJornadaTipo();
        if ($jornada === null) {
            return $this->errorResult('Sin jornada asignada al rango, al grupo (override) ni al itinerario.');
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

        // Capacidad curricular = slots + recreos × días lectivos. Es la jornada
        // presencial completa que se reporta al currículo (truco LOMLOE FP:
        // los recreos cuentan como lectivos a efectos del cumplimiento anual,
        // aunque el solver no los use para placement). Si el centro no quiere
        // contarlos, la cifra coincide con `capacidadMinutos`.
        $recreosMinutosPorDia = 0;
        foreach ($jornada->getTramos() as $tramo) {
            if ($tramo->getTipo() !== TipoTramo::RECREO) continue;
            $hi = $tramo->getHoraInicio();
            $hf = $tramo->getHoraFin();
            if ($hi === null || $hf === null) continue;
            $diff = ((int) $hf->format('H')) * 60 + (int) $hf->format('i')
                  - (((int) $hi->format('H')) * 60 + (int) $hi->format('i'));
            if ($diff > 0) $recreosMinutosPorDia += $diff;
        }
        $recreosMinutosSemanales = $recreosMinutosPorDia * count($diasLectivos);

        // Lee las imparticiones DEL RANGO (vía PLI), no todas las del grupo.
        // Si una imparticion no tiene PLI en este rango, no existe en este rango.
        $plis = $this->em->getRepository(PeriodoLectivoImparticion::class)
            ->createQueryBuilder('pli')
            ->andWhere('pli.periodoLectivo = :pl')
            ->andWhere('pli.deleted = false')
            ->setParameter('pl', $periodoLectivo)
            ->getQuery()
            ->getResult();

        $materias = [];
        $totalMinutos = 0;
        foreach ($plis as $pli) {
            $imp = $pli->getImparticion();
            if ($imp === null || $imp->isDeleted()) continue;
            $minutos = $pli->getEffectiveMinutosSemanales();
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
            'capacidadCurricularMinutos' => $capacidadMinutos + $recreosMinutosSemanales,
            'recreosMinutosSemanales' => $recreosMinutosSemanales,
                'desajuste' => 0,
                'asignacion' => [],
                'roundups' => [],
                'huerfanos' => [],
                'slotsDisponibles' => $slotsDisponibles,
                'debug' => ['note' => 'sin imparticiones con minutos > 0'],
            ];
        }

        // Capacidad insuficiente: best-effort. En vez de devolver "todos huérfanos"
        // y bloquear el solver, reducimos proporcionalmente los minutos por
        // imparticion para que Σ ≤ capacidad, generamos asignación con esos
        // valores reducidos y reportamos el excedente como huérfanos parciales.
        // Razón: con el truco de recreos LOMLOE FP, una sobrecarga semanal
        // pequeña es operativa (los placements colocan lo que cabe; el resto
        // se justifica al currículo con recreos lectivos). El admin debe poder
        // ejecutar el solver aunque haya un déficit semanal pequeño.
        $orphansFromReduction = [];          // impId → minutos perdidos
        $orphanMateriaNames = [];            // impId → nombre (para reportar)
        if ($capacidadMinutos < $totalMinutos) {
            $factor = $capacidadMinutos / $totalMinutos;
            $unidadRedondeo = (int) min($duraciones);  // típicamente 60 (slot más corto)
            $reducidoTotal = 0;
            foreach ($materias as &$m) {
                $original = (int) $m['minutos'];
                // Floor a la unidad de slot más corta para que la reducción sea
                // expresable como combo válido. Si queda 0 → la materia se
                // marca como totalmente huérfana en este rango (caso extremo).
                $reducido = (int) floor(($original * $factor) / $unidadRedondeo) * $unidadRedondeo;
                $reducido = max(0, $reducido);
                $perdido = $original - $reducido;
                if ($perdido > 0) {
                    $orphansFromReduction[$m['impId']] = $perdido;
                    $orphanMateriaNames[$m['impId']] = $m['nombre'];
                }
                $m['minutos'] = $reducido;
                $reducidoTotal += $reducido;
            }
            unset($m);
            // Filtrar materias con minutos=0 tras reducción (no entran al ILP).
            $materias = array_values(array_filter($materias, fn ($m) => $m['minutos'] > 0));
            // Nota: $totalMinutos NO se actualiza — sigue siendo el original
            // (para que la respuesta refleje los minutos pedidos vs capacidad).
        }
        if (empty($materias)) {
            return [
                'feasible' => false,
                'totalMinutos' => $totalMinutos,
                'capacidadMinutos' => $capacidadMinutos,
            'capacidadCurricularMinutos' => $capacidadMinutos + $recreosMinutosSemanales,
            'recreosMinutosSemanales' => $recreosMinutosSemanales,
                'desajuste' => $totalMinutos - $capacidadMinutos,
                'asignacion' => [],
                'roundups' => [],
                'huerfanos' => array_map(
                    fn ($impId, $min) => [
                        'impId' => $impId,
                        'materia' => $orphanMateriaNames[$impId] ?? '?',
                        'minutosRestantes' => $min,
                        'horasRestantes' => round($min / 60, 2),
                    ],
                    array_keys($orphansFromReduction),
                    array_values($orphansFromReduction)
                ),
                'slotsDisponibles' => $slotsDisponibles,
                'debug' => ['error' => 'capacidad insuficiente; reducción proporcional dejó 0 minutos en todas.'],
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
            'capacidadCurricularMinutos' => $capacidadMinutos + $recreosMinutosSemanales,
            'recreosMinutosSemanales' => $recreosMinutosSemanales,
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
            'capacidadCurricularMinutos' => $capacidadMinutos + $recreosMinutosSemanales,
            'recreosMinutosSemanales' => $recreosMinutosSemanales,
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

        // Si hubo reducción proporcional (best-effort), reporta como huérfanos
        // las minutos perdidas y marca feasible:false para que la UI lo refleje.
        $huerfanos = [];
        foreach ($orphansFromReduction as $impId => $perdido) {
            $huerfanos[] = [
                'impId' => $impId,
                'materia' => $orphanMateriaNames[$impId] ?? '?',
                'minutosRestantes' => $perdido,
                'horasRestantes' => round($perdido / 60, 2),
            ];
        }

        return [
            'feasible' => empty($huerfanos),
            'totalMinutos' => $totalMinutos,
            'capacidadMinutos' => $capacidadMinutos,
            'capacidadCurricularMinutos' => $capacidadMinutos + $recreosMinutosSemanales,
            'recreosMinutosSemanales' => $recreosMinutosSemanales,
            'desajuste' => $this->bestCost,
            'asignacion' => $asignacion,
            'roundups' => $roundups,
            'huerfanos' => $huerfanos,
            'slotsDisponibles' => $slotsDisponibles,
            'debug' => [
                'duraciones' => $duraciones,
                'materiasCount' => count($materias),
                'nodesExplored' => $this->nodesExplored,
                'elapsedSec' => round(microtime(true) - $this->startedAt, 3),
                'timedOut' => $this->timedOut,
                'reducedFromOverflow' => !empty($orphansFromReduction),
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
            'capacidadCurricularMinutos' => 0,
            'recreosMinutosSemanales' => 0,
            'desajuste' => 0,
            'asignacion' => [],
            'roundups' => [],
            'huerfanos' => [],
            'slotsDisponibles' => [],
            'debug' => ['error' => $msg],
        ];
    }
}
