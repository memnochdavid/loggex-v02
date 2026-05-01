<?php

namespace App\Service;

use App\Entity\PeriodoLectivoImparticion;

/**
 * Selector + ejecutor de acciones correctivas para el solver iterativo.
 *
 * Mapea (bottleneck → acción candidata) y aplica la mutación in-memory sobre
 * el array de PLIs de trabajo. Cada acción es reversible en teoría (las
 * mutaciones son scalars) pero el bucle no rollback'ea: si la acción no
 * ayuda, simplemente no repite.
 *
 * **Acciones (Fase 3, 2026-05-01)**:
 *
 * - **REDUCIR_CUOTA_PROPIA** — la conservadora: resta SLOT_REDUCTION_MIN al
 *   PLI de la primera imp unplaced. Heredada de Fase 1. Útil cuando el
 *   bottleneck es CONFLICT_PROFE (no hay slots libres para esa imp; reducir
 *   su cuota es lo único que evita el infinito).
 *
 * - **REDUCIR_CUOTA_OVERSHOOT** — la solidaria: resta SLOT_REDUCTION_MIN a
 *   la imp con MAYOR cobertura% > 100% relativa al target. La materia que
 *   más sobra absorbe el déficit antes que la que ya está en falta. Útil
 *   cuando CAPACIDAD_INSUFICIENTE: el déficit es global y conviene
 *   distribuirlo a quien menos duela.
 *
 * - **CAMBIAR_COMBO_SLOT** — la quirúrgica: cuando SLOT_ASIMETRICO, ajusta
 *   el target de una imp unplaced al múltiplo limpio de `minDur` más cercano
 *   por debajo. Si target=270 con jornada [60,60,60,60,90], baja a 240 (=
 *   4×60) eliminando la fragmentación que el bin-packing no podía cuadrar.
 *
 * **Selector**: bottleneck → acción candidata, con anti-loop: si la acción
 * elegida es la misma (code, target) que la pasada anterior y no bajó el
 * unplaced, devolvemos null (= terminar bucle).
 *
 * Doc: `docs/hoja-de-ruta-solver-iterativo.md` Fase 3.
 */
class CorrectiveActionExecutor
{
    public const ACTION_REDUCIR_CUOTA_PROPIA = 'REDUCIR_CUOTA_PROPIA';
    public const ACTION_REDUCIR_CUOTA_OVERSHOOT = 'REDUCIR_CUOTA_OVERSHOOT';
    public const ACTION_CAMBIAR_COMBO_SLOT = 'CAMBIAR_COMBO_SLOT';

    private const SLOT_REDUCTION_MIN = 60;

    /**
     * Selector: dado el bottleneck primario y el último resultado del solver,
     * propone una acción a aplicar. Devuelve null si no hay acción aplicable
     * (= terminar bucle iterativo con stoppedReason='noActionAvailable').
     *
     * @param string $bottleneck código (ver BottleneckClassifier)
     * @param array $lastResult resultado del solver (con `unplaced` + `debug.imparticiones`)
     * @param array<PeriodoLectivoImparticion> $workingPlis PLIs in-memory mutables
     * @param array<int, array{code:string, target:?int}> $history historial de acciones aplicadas (más reciente al final)
     * @param array<int, int> $unplacedHistory unplaced count tras cada pasada (más reciente al final)
     *
     * @return array{code:string, target:?int, params:array<string,mixed>}|null
     */
    public function selectAction(
        string $bottleneck,
        array $lastResult,
        array $workingPlis,
        array $history = [],
        array $unplacedHistory = [],
    ): ?array {
        $unplaced = $lastResult['unplaced'] ?? [];
        if (empty($unplaced)) return null;

        $debug = $lastResult['debug'] ?? [];
        $impsDebug = $debug['imparticiones'] ?? [];
        $slotDurations = $debug['slotDurations'] ?? [];

        // Selector: cada bottleneck tiene una acción "ideal"; si ésta no
        // produce nada (ej. nadie tiene overshoot), caemos al fallback
        // conservador REDUCIR_CUOTA_PROPIA.
        $action = match ($bottleneck) {
            'CAPACIDAD_INSUFICIENTE' => $this->buildOvershootAction($impsDebug, $workingPlis),
            'SLOT_ASIMETRICO' => $this->buildComboSlotAction($unplaced, $impsDebug, $slotDurations, $workingPlis),
            default => null,  // CONFLICT_PROFE y UNKNOWN siempre fallback
        };
        if ($action === null) {
            $action = $this->buildPropiaAction($unplaced, $workingPlis);
        }
        if ($action === null) return null;

        // Anti-loop: si la última acción fue exactamente la misma (code, target)
        // y el unplaced no bajó respecto a la pasada anterior, abortar para
        // evitar bucle infinito.
        if (count($history) >= 1 && count($unplacedHistory) >= 2) {
            $last = $history[count($history) - 1];
            $prevUnplaced = $unplacedHistory[count($unplacedHistory) - 2];
            $currUnplaced = $unplacedHistory[count($unplacedHistory) - 1];
            if (
                $last['code'] === $action['code']
                && (int) ($last['target'] ?? 0) === (int) ($action['target'] ?? 0)
                && $currUnplaced >= $prevUnplaced
            ) {
                return null;
            }
        }

        return $action;
    }

    /**
     * Aplica la acción seleccionada al array de PLIs de trabajo. Mutación
     * in-memory; ningún PATCH a BD.
     *
     * @param array<PeriodoLectivoImparticion> $workingPlis
     * @return array{success:bool, minutosAntes:?int, minutosDespues:?int}
     */
    public function applyAction(array $action, array &$workingPlis): array
    {
        $impId = (int) ($action['target'] ?? 0);
        if ($impId <= 0) return ['success' => false, 'minutosAntes' => null, 'minutosDespues' => null];

        foreach ($workingPlis as $pli) {
            if ($pli->getImparticion()?->getId() !== $impId) continue;
            $current = $pli->getEffectiveMinutosSemanales();
            $next = match ($action['code']) {
                self::ACTION_REDUCIR_CUOTA_PROPIA, self::ACTION_REDUCIR_CUOTA_OVERSHOOT
                    => max(0, $current - self::SLOT_REDUCTION_MIN),
                self::ACTION_CAMBIAR_COMBO_SLOT
                    => (int) ($action['params']['nuevoTarget'] ?? $current),
                default => $current,
            };
            if ($next === $current) return ['success' => false, 'minutosAntes' => $current, 'minutosDespues' => $current];
            $pli->setMinutosSemanales($next);
            return ['success' => true, 'minutosAntes' => $current, 'minutosDespues' => $next];
        }
        return ['success' => false, 'minutosAntes' => null, 'minutosDespues' => null];
    }

    /**
     * Construye la acción REDUCIR_CUOTA_PROPIA: target = primera imp unplaced
     * cuya PLI tenga ≥ SLOT_REDUCTION_MIN minutos (reducible).
     *
     * @return array{code:string, target:int, params:array<string,mixed>}|null
     */
    private function buildPropiaAction(array $unplaced, array $workingPlis): ?array
    {
        foreach ($unplaced as $u) {
            $impId = (int) ($u['imparticionId'] ?? 0);
            if ($impId <= 0) continue;
            $pli = $this->findPliByImpId($workingPlis, $impId);
            if ($pli === null) continue;
            if ($pli->getEffectiveMinutosSemanales() < self::SLOT_REDUCTION_MIN) continue;
            return [
                'code' => self::ACTION_REDUCIR_CUOTA_PROPIA,
                'target' => $impId,
                'params' => [
                    'materia' => $u['materia'] ?? null,
                    'reductionMin' => self::SLOT_REDUCTION_MIN,
                ],
            ];
        }
        return null;
    }

    /**
     * Construye REDUCIR_CUOTA_OVERSHOOT: target = imp con MAYOR cobertura
     * relativa > 100% (la que más sobra). Si nadie sobra > 100%, devuelve
     * null (selector caerá al fallback).
     *
     * @return array{code:string, target:int, params:array<string,mixed>}|null
     */
    private function buildOvershootAction(array $impsDebug, array $workingPlis): ?array
    {
        $bestImpId = null;
        $bestPct = 1.0;  // Sólo consideramos cobertura > 100%
        $bestRow = null;
        foreach ($impsDebug as $row) {
            $target = (int) ($row['minutosTarget'] ?? 0);
            $colocados = (int) ($row['minutosColocados'] ?? 0);
            if ($target <= 0) continue;
            $pct = $colocados / $target;
            if ($pct <= $bestPct) continue;
            $impId = (int) ($row['imparticionId'] ?? 0);
            $pli = $this->findPliByImpId($workingPlis, $impId);
            if ($pli === null) continue;
            // Sólo si la PLI tiene cuota suficiente para reducir.
            if ($pli->getEffectiveMinutosSemanales() < self::SLOT_REDUCTION_MIN) continue;
            $bestImpId = $impId;
            $bestPct = $pct;
            $bestRow = $row;
        }
        if ($bestImpId === null) return null;
        return [
            'code' => self::ACTION_REDUCIR_CUOTA_OVERSHOOT,
            'target' => $bestImpId,
            'params' => [
                'materia' => $bestRow['materia'] ?? null,
                'coberturaPct' => (int) round($bestPct * 100),
                'reductionMin' => self::SLOT_REDUCTION_MIN,
            ],
        ];
    }

    /**
     * Construye CAMBIAR_COMBO_SLOT: target = primera imp unplaced cuyo target
     * sea múltiplo de minDur pero NO de maxDur. Reduce el target al múltiplo
     * limpio de minDur más cercano por debajo (= elimina el slot residual).
     * Devuelve null si nadie cumple (selector cae al fallback).
     *
     * @return array{code:string, target:int, params:array<string,mixed>}|null
     */
    private function buildComboSlotAction(array $unplaced, array $impsDebug, array $slotDurations, array $workingPlis): ?array
    {
        $distinct = array_values(array_unique($slotDurations));
        if (count($distinct) <= 1) return null;
        sort($distinct);
        $minDur = $distinct[0];
        $maxDur = end($distinct);

        $impByImpId = [];
        foreach ($impsDebug as $row) {
            $impByImpId[(int) $row['imparticionId']] = $row;
        }

        foreach ($unplaced as $u) {
            $impId = (int) ($u['imparticionId'] ?? 0);
            if ($impId <= 0) continue;
            $row = $impByImpId[$impId] ?? null;
            if (!$row) continue;
            $target = (int) ($row['minutosTarget'] ?? 0);
            if ($target <= 0) continue;
            // Sólo si target es múltiplo de minDur pero NO de maxDur (= caso
            // típico de fragmentación con slot largo asimétrico).
            if ($target % $minDur !== 0) continue;
            if ($target % $maxDur === 0) continue;
            // Múltiplo limpio de minDur más cercano por debajo del target
            // actual: el siguiente paso de `target / minDur - 1`.
            $newTarget = (int) (floor($target / $minDur) * $minDur) - $minDur;
            if ($newTarget <= 0) continue;
            $pli = $this->findPliByImpId($workingPlis, $impId);
            if ($pli === null) continue;
            if ($newTarget >= $pli->getEffectiveMinutosSemanales()) continue;  // no reduciría
            return [
                'code' => self::ACTION_CAMBIAR_COMBO_SLOT,
                'target' => $impId,
                'params' => [
                    'materia' => $row['materia'] ?? $u['materia'] ?? null,
                    'targetAntes' => $target,
                    'nuevoTarget' => $newTarget,
                    'minDur' => $minDur,
                    'maxDur' => $maxDur,
                ],
            ];
        }
        return null;
    }

    private function findPliByImpId(array $workingPlis, int $impId): ?PeriodoLectivoImparticion
    {
        foreach ($workingPlis as $pli) {
            if ($pli->getImparticion()?->getId() === $impId) return $pli;
        }
        return null;
    }
}
