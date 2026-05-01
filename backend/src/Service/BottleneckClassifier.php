<?php

namespace App\Service;

/**
 * Clasifica el cuello de botella tras una pasada del solver bin-packing
 * cuando hay materias unplaced. Devuelve un código de bottleneck primario +
 * sugerencias accionables (códigos i18n + params) para que el frontend las
 * traduzca a los 5 idiomas soportados.
 *
 * **Bottlenecks reconocidos** (por prioridad):
 *
 * 1. CAPACIDAD_INSUFICIENTE — Σ minutos curriculares > capacidad de la
 *    jornada por semana. Aritmético; el solver no puede colocar lo que no
 *    cabe físicamente. Sugerencias: subir jornada, extender calendario,
 *    marcar materias como AUTONOMA/FCT.
 *
 * 2. CONFLICT_PROFE — al menos una materia unplaced tiene a su profesor
 *    ocupado en > 50% de los slots por grupos paralelos del mismo turno.
 *    Sugerencias: contratar otro profe para esa materia, cambiar turno del
 *    grupo, mover la materia a otro PL del año (si aplica).
 *
 * 3. SLOT_ASIMETRICO — la jornada tiene slots de duración mixta (ej. 60 y
 *    90 min) y los targets de las materias unplaced son múltiplos del slot
 *    corto pero no del largo. Resultado: el slot residual asimétrico crea
 *    overshoot/undershoot estructural. Sugerencia: dividir el slot largo
 *    en dos tramos compatibles.
 *
 * 4. UNKNOWN — fallback cuando ninguno aplica. Sugerencia: revisar
 *    manualmente / probar otro seed.
 *
 * **Por qué la prioridad es esa**: CAPACIDAD_INSUFICIENTE es la causa más
 * fundamental (sin slots no hay solución posible); CONFLICT_PROFE puede
 * resolverse moviendo o contratando; SLOT_ASIMETRICO es operativo del
 * centro y suele tener overshoot tolerable.
 *
 * Doc: `docs/hoja-de-ruta-solver-iterativo.md` Fase 2.
 */
class BottleneckClassifier
{
    /** Umbral de % de slots ocupados por paralelos para considerar "conflict". */
    private const CONFLICT_PCT_THRESHOLD = 0.50;

    /**
     * @param array<array{imparticionId:int, materia:?string, minutosRestantes:int, ...}> $unplaced
     * @param array<array{imparticionId:int, materia:?string, profesor:?string, profesorId:?int, minutosTarget:int, minutosColocados:int, liquidoFinal:int}> $imparticionesDebug
     *        El campo `debug.imparticiones` que devuelve el solver bin-packing (incluye profesorId + targets).
     * @param array<string, array<int>> $parallelBusy mapa "dia_hi" → [profIds] (debug.parallelBusy del solver).
     * @param array<int> $slotDurations duraciones de los slots de la jornada (debug.slotDurations).
     * @param int $diasLectivosCount número de días lectivos de la jornada.
     *
     * @return array{
     *   primaryBottleneck: string,
     *   metrics: array<string, mixed>,
     *   suggestions: array<int, array{code: string, params: array<string, mixed>}>
     * }
     */
    public function classify(
        array $unplaced,
        array $imparticionesDebug,
        array $parallelBusy,
        array $slotDurations,
        int $diasLectivosCount,
    ): array {
        // Si no hay unplaced, no hay bottleneck — caller debería evitar
        // llamarme en ese caso, pero por defensa devolvemos UNKNOWN vacío.
        if (empty($unplaced)) {
            return [
                'primaryBottleneck' => 'NONE',
                'metrics' => [],
                'suggestions' => [],
            ];
        }

        $impByImpId = [];
        foreach ($imparticionesDebug as $row) {
            $impByImpId[(int) $row['imparticionId']] = $row;
        }

        // ── 1. CAPACIDAD_INSUFICIENTE ─────────────────────────────────
        $capacidadSemanalMin = array_sum($slotDurations) * $diasLectivosCount;
        $totalTargetMin = 0;
        foreach ($imparticionesDebug as $row) {
            $totalTargetMin += (int) ($row['minutosTarget'] ?? 0);
        }
        $deficitMin = $totalTargetMin - $capacidadSemanalMin;

        if ($deficitMin > 0) {
            $deficitH = round($deficitMin / 60, 1);
            $capacidadH = round($capacidadSemanalMin / 60, 1);
            $totalH = round($totalTargetMin / 60, 1);
            return [
                'primaryBottleneck' => 'CAPACIDAD_INSUFICIENTE',
                'metrics' => [
                    'totalTargetH' => $totalH,
                    'capacidadH' => $capacidadH,
                    'deficitH' => $deficitH,
                    'deficitMin' => $deficitMin,
                ],
                'suggestions' => [
                    [
                        'code' => 'RAISE_JORNADA',
                        'params' => [
                            'deficitH' => $deficitH,
                            'capacidadH' => $capacidadH,
                            'totalH' => $totalH,
                        ],
                    ],
                    [
                        'code' => 'EXTEND_CALENDAR',
                        'params' => ['deficitH' => $deficitH],
                    ],
                    [
                        'code' => 'MARK_AS_NON_PRESENCIAL',
                        'params' => ['deficitH' => $deficitH],
                    ],
                ],
            ];
        }

        // ── 2. CONFLICT_PROFE ─────────────────────────────────────────
        $totalCells = max(1, count($slotDurations) * $diasLectivosCount);
        // Para cada profe, contar slots ocupados en paralelos.
        $conflictCellsByProf = [];
        foreach ($parallelBusy as $cellKey => $profIds) {
            foreach ($profIds as $pid) {
                $conflictCellsByProf[(int) $pid] = ($conflictCellsByProf[(int) $pid] ?? 0) + 1;
            }
        }

        $worstConflict = null;  // ['impId', 'pct', 'profName', 'materia', 'conflictCells']
        foreach ($unplaced as $u) {
            $impId = (int) ($u['imparticionId'] ?? 0);
            $info = $impByImpId[$impId] ?? null;
            if (!$info) continue;
            $profId = $info['profesorId'] ?? null;
            if (!$profId) continue;
            $conflictCells = $conflictCellsByProf[(int) $profId] ?? 0;
            $pct = $conflictCells / $totalCells;
            if ($worstConflict === null || $pct > $worstConflict['pct']) {
                $worstConflict = [
                    'impId' => $impId,
                    'pct' => $pct,
                    'profName' => $info['profesor'] ?? '—',
                    'materia' => $info['materia'] ?? $u['materia'] ?? '—',
                    'conflictCells' => $conflictCells,
                ];
            }
        }

        if ($worstConflict !== null && $worstConflict['pct'] >= self::CONFLICT_PCT_THRESHOLD) {
            $pctRounded = (int) round($worstConflict['pct'] * 100);
            return [
                'primaryBottleneck' => 'CONFLICT_PROFE',
                'metrics' => [
                    'profName' => $worstConflict['profName'],
                    'materia' => $worstConflict['materia'],
                    'conflictPct' => $pctRounded,
                    'conflictCells' => $worstConflict['conflictCells'],
                    'totalCells' => $totalCells,
                ],
                'suggestions' => [
                    [
                        'code' => 'HIRE_PROFE',
                        'params' => [
                            'profName' => $worstConflict['profName'],
                            'materia' => $worstConflict['materia'],
                            'conflictPct' => $pctRounded,
                            'conflictCells' => $worstConflict['conflictCells'],
                            'totalCells' => $totalCells,
                        ],
                    ],
                    [
                        'code' => 'CHANGE_TURNO',
                        'params' => ['materia' => $worstConflict['materia']],
                    ],
                    [
                        'code' => 'MOVE_TO_ANOTHER_PL',
                        'params' => ['materia' => $worstConflict['materia']],
                    ],
                ],
            ];
        }

        // ── 3. SLOT_ASIMETRICO ────────────────────────────────────────
        $distinctDurations = array_values(array_unique($slotDurations));
        if (count($distinctDurations) > 1) {
            sort($distinctDurations);
            $minDur = $distinctDurations[0];
            $maxDur = end($distinctDurations);
            // Buscar al menos una materia unplaced cuyo target sea múltiplo del
            // slot corto pero no del largo (fragmentación estructural).
            $afectada = null;
            foreach ($unplaced as $u) {
                $impId = (int) ($u['imparticionId'] ?? 0);
                $target = (int) ($impByImpId[$impId]['minutosTarget'] ?? 0);
                if ($target > 0 && $target % $minDur === 0 && $target % $maxDur !== 0) {
                    $afectada = $impByImpId[$impId]['materia'] ?? $u['materia'] ?? '—';
                    break;
                }
            }
            if ($afectada !== null) {
                return [
                    'primaryBottleneck' => 'SLOT_ASIMETRICO',
                    'metrics' => [
                        'minDur' => $minDur,
                        'maxDur' => $maxDur,
                        'afectada' => $afectada,
                    ],
                    'suggestions' => [
                        [
                            'code' => 'SPLIT_SLOT',
                            'params' => ['maxDur' => $maxDur, 'minDur' => $minDur],
                        ],
                    ],
                ];
            }
        }

        // ── 4. UNKNOWN (fallback) ─────────────────────────────────────
        return [
            'primaryBottleneck' => 'UNKNOWN',
            'metrics' => [
                'unplacedCount' => count($unplaced),
            ],
            'suggestions' => [
                ['code' => 'REVIEW_MANUALLY', 'params' => []],
            ],
        ];
    }
}
