<?php

namespace App\Service;

use App\Entity\Grupo;
use App\Entity\PeriodoLectivo;
use App\Entity\PeriodoLectivoImparticion;
use Doctrine\ORM\EntityManagerInterface;

/**
 * Solver iterativo: envuelve `HorarioSolverBinPacking` en un bucle de pasadas
 * que aplica acciones correctivas IN-MEMORY entre intentos hasta cuadrar el
 * rango o agotar opciones.
 *
 * **Fase 3 (2026-05-01)**: el bucle delega la elección de acción correctiva
 * en `CorrectiveActionExecutor`, que mapea bottleneck (clasificado per-pasada)
 * → acción candidata. Las 3 acciones disponibles son:
 *
 * - `REDUCIR_CUOTA_PROPIA` (Fase 1, fallback): resta 60 min/sem a la primera
 *   imp unplaced. Útil cuando el bottleneck es CONFLICT_PROFE (no hay slots
 *   libres y reducir esa imp es lo único que evita el infinito).
 * - `REDUCIR_CUOTA_OVERSHOOT` (Fase 3): resta 60 min/sem a la imp con MAYOR
 *   cobertura > 100%. Útil cuando CAPACIDAD_INSUFICIENTE: el déficit global
 *   se distribuye a quien más sobra en lugar de penalizar la unplaced.
 * - `CAMBIAR_COMBO_SLOT` (Fase 3): cuando SLOT_ASIMETRICO, ajusta el target
 *   de la imp unplaced al múltiplo limpio de minDur más cercano por debajo,
 *   eliminando la fragmentación que el bin-packing no podía cuadrar.
 *
 * Anti-loop: si la acción elegida es la misma (code, target) que la pasada
 * anterior y el unplaced no bajó, el selector devuelve null y termina con
 * `stoppedReason='noActionAvailable'`.
 *
 * **Por qué importa**: el bucle del frontend hacía PATCH a BD entre intentos
 * (Fase 1 lo arregló) y aplicaba sólo REDUCIR_CUOTA_PROPIA ciegamente
 * (Fase 3 lo arregla). Ahora razona el bottleneck, elige la acción que
 * mejor lo ataca y termina con diagnóstico estructurado.
 *
 * Doc: `docs/hoja-de-ruta-solver-iterativo.md` Fases 1+2+3.
 */
class HorarioSolverIterativo
{
    private const DEFAULT_MAX_ITERATIONS = 6;
    private const SLOT_REDUCTION_MIN = 60;  // 1 slot mínimo (FP Mañanas/Tardes) — usado por redistribuirCrossRango

    public function __construct(
        private EntityManagerInterface $em,
        private HorarioSolverBinPacking $solver,
        private PeriodoLectivoResolver $resolver,
        private BottleneckClassifier $classifier,
        private CorrectiveActionExecutor $executor,
    ) {
    }

    /**
     * @param array<\App\Entity\PeriodoLectivoImparticion>|null $pliOverride
     *        PLIs in-memory (modo dry-run). Si null, se cargan de BD.
     * @param array<int, int>|null $alreadyPlacedByImp Cap anual cross-rango.
     */
    public function solveIterativo(
        Grupo $grupo,
        ?int $seed = null,
        ?PeriodoLectivo $periodoLectivo = null,
        ?array $alreadyPlacedByImp = null,
        ?array $pliOverride = null,
        ?float $totalSemanasGrupoOverride = null,
        int $maxIterations = self::DEFAULT_MAX_ITERATIONS,
    ): array {
        $start = microtime(true);

        $periodoLectivo = $periodoLectivo ?? $this->resolver->resolveActive($grupo);
        if ($periodoLectivo === null) {
            return $this->errorResult('Grupo sin PeriodoLectivo (caso imposible tras la migración Fase 1).');
        }

        // Cargar PLIs base. Si el caller pasa override (dry-run con PL virtual),
        // los usamos; si no, los leemos de BD. En ambos casos clonamos a
        // versiones mutables para que las reducciones del bucle no afecten al
        // caller ni a Doctrine.
        $basePlis = $pliOverride ?? $this->em->getRepository(PeriodoLectivoImparticion::class)
            ->createQueryBuilder('pli')
            ->andWhere('pli.periodoLectivo = :pl')
            ->andWhere('pli.deleted = false')
            ->setParameter('pl', $periodoLectivo)
            ->getQuery()
            ->getResult();

        $workingPlis = $this->cloneMutableMinutos($basePlis);

        $iterationLog = [];
        $actionHistory = [];
        $unplacedHistory = [];
        $lastResult = null;
        $stoppedReason = 'maxIterations';

        for ($iter = 1; $iter <= $maxIterations; $iter++) {
            $lastResult = $this->solver->solve(
                $grupo,
                $seed,
                $periodoLectivo,
                $alreadyPlacedByImp,
                $workingPlis,
                $totalSemanasGrupoOverride,
            );

            $unplacedCount = count($lastResult['unplaced'] ?? []);
            $placedCount = count($lastResult['placements'] ?? []);
            $unplacedHistory[] = $unplacedCount;

            if ($lastResult['complete'] ?? false) {
                $iterationLog[] = [
                    'pasada' => $iter,
                    'bottleneck' => null,
                    'accion' => null,
                    'target' => null,
                    'placedCount' => $placedCount,
                    'unplacedCount' => 0,
                ];
                $stoppedReason = 'complete';
                break;
            }

            // Clasificar bottleneck per-pasada (Fase 2/3): el clasificador
            // mira el último resultado del solver y dice qué falla.
            $debug = $lastResult['debug'] ?? [];
            $classification = $this->classifier->classify(
                $lastResult['unplaced'] ?? [],
                $debug['imparticiones'] ?? [],
                $debug['parallelBusy'] ?? [],
                $debug['slotDurations'] ?? [],
                count($debug['diasLectivos'] ?? []),
            );
            $bottleneck = $classification['primaryBottleneck'] ?? 'UNKNOWN';

            // Selector + ejecutor (Fase 3): mapea bottleneck → acción.
            // Anti-loop: si la misma acción (code, target) repite y el
            // unplaced no bajó, devuelve null → terminamos.
            $action = $this->executor->selectAction(
                $bottleneck,
                $lastResult,
                $workingPlis,
                $actionHistory,
                $unplacedHistory,
            );
            if ($action === null) {
                $iterationLog[] = [
                    'pasada' => $iter,
                    'bottleneck' => $bottleneck,
                    'accion' => null,
                    'target' => null,
                    'placedCount' => $placedCount,
                    'unplacedCount' => $unplacedCount,
                ];
                $stoppedReason = 'noActionAvailable';
                break;
            }

            $applied = $this->executor->applyAction($action, $workingPlis);
            $actionHistory[] = ['code' => $action['code'], 'target' => $action['target'] ?? null];

            $iterationLog[] = [
                'pasada' => $iter,
                'bottleneck' => $bottleneck,
                'accion' => $action['code'],
                'target' => [
                    'imparticionId' => $action['target'] ?? null,
                    'materia' => $action['params']['materia'] ?? null,
                    'minutosAntes' => $applied['minutosAntes'],
                    'minutosDespues' => $applied['minutosDespues'],
                ],
                'placedCount' => $placedCount,
                'unplacedCount' => $unplacedCount,
            ];

            if (!$applied['success']) {
                // La acción no produjo cambio: terminar para no quedar en bucle.
                $stoppedReason = 'noActionAvailable';
                break;
            }
        }

        // Diagnóstico final: si el bucle no completó, re-clasificar con el
        // último estado para que `primaryBottleneck` y `suggestions` reflejen
        // la situación final (puede haber cambiado tras varias acciones, por
        // ejemplo de SLOT_ASIMETRICO a CONFLICT_PROFE residual).
        $primaryBottleneck = null;
        $metrics = [];
        $suggestions = [];
        $finalUnplaced = $lastResult['unplaced'] ?? [];
        if (!empty($finalUnplaced) && $lastResult !== null) {
            $debug = $lastResult['debug'] ?? [];
            $finalClass = $this->classifier->classify(
                $finalUnplaced,
                $debug['imparticiones'] ?? [],
                $debug['parallelBusy'] ?? [],
                $debug['slotDurations'] ?? [],
                count($debug['diasLectivos'] ?? []),
            );
            $primaryBottleneck = $finalClass['primaryBottleneck'] ?? null;
            $metrics = $finalClass['metrics'] ?? [];
            $suggestions = $finalClass['suggestions'] ?? [];
        }

        $diagnostic = [
            'stoppedReason' => $stoppedReason,
            'iterationsRun' => count($iterationLog),
            'finalUnplaced' => $finalUnplaced,
            'primaryBottleneck' => $primaryBottleneck,
            'metrics' => $metrics,
            'suggestions' => $suggestions,
        ];

        // Devolvemos el último resultado del solver enriquecido con el log y
        // diagnóstico. El frontend puede mostrar `placements` igual que con el
        // endpoint /solver/, y opcionalmente abrir un drawer con `iterationLog`
        // y `diagnostic`.
        return array_merge($lastResult ?? [], [
            'iterationLog' => $iterationLog,
            'diagnostic' => $diagnostic,
            'iterativo' => [
                'maxIterations' => $maxIterations,
                'iterationsRun' => count($iterationLog),
                'elapsedSec' => round(microtime(true) - $start, 3),
            ],
        ]);
    }

    /**
     * Versión multi-rango (Fase 3.5, 2026-05-01). Loop'ea N PLs en orden
     * cronológico (fechaInicio asc) llamando a `solveIterativo` per-PL con
     * cap anual cross-rango cumulativo. Devuelve un array per-PL con el
     * mismo formato + el `accumPlacedByImp` final.
     *
     * Reemplaza la lógica equivalente que vivía en frontend
     * (`runSolverAllRangos` con `accumPlacedByImp` local). Una sola llamada
     * de red, mismo resultado determinista.
     *
     * @param array<array{
     *     periodoLectivo: PeriodoLectivo,
     *     pliOverride: array<PeriodoLectivoImparticion>|null,
     *     tempId: int|null,
     *     plKey: string,
     * }> $rangos Items pre-resueltos por el controlador (PL real o virtual).
     */
    /**
     * Versión multi-rango con bucle OUTER de redistribución cross-rango
     * (Hotfix 2 ampliado, 2026-05-01). El bucle outer:
     *
     *   1. Resuelve cada PL en orden cronológico con `solveIterativo`.
     *   2. Calcula `accumPlacedByImp` (minutos anuales colocados per imp).
     *   3. Compara con `targetAnualByImp`. Si hay imps por debajo del 95%
     *      de su currículo anual, intenta REDISTRIBUIR_CROSS_RANGO:
     *        - Para cada shortfall, busca un PL receptor donde la imp esté
     *          activa y haya OTRA imp con overshoot > 110% que pueda ceder.
     *        - Mueve 60 min/sem: aumenta cuota de la imp con shortfall en
     *          el receptor, reduce la donante. workingPlisByPl persiste
     *          entre iteraciones outer (las mutaciones se mantienen).
     *   4. Re-corre el outer loop con los nuevos `workingPlisByPl`.
     *   5. Termina cuando no hay shortfalls O no hay redistribución posible
     *      (= heurísticamente imposible, ningún movimiento mejora).
     *
     * El `redistributionLog` registra cada movimiento {plKey, donor, receptor,
     * minMovidos, outerIter}. Si tras N iteraciones outer sigue habiendo
     * shortfalls, se devuelven en `crossRangoShortfalls` para que el frontend
     * informe al admin.
     */
    private const MAX_OUTER_ITERATIONS = 12;

    public function solveMultiRango(
        Grupo $grupo,
        array $rangos,
        ?int $seed = null,
        ?float $totalSemanasGrupoOverride = null,
        int $maxIterations = self::DEFAULT_MAX_ITERATIONS,
    ): array {
        $start = microtime(true);

        // Orden cronológico: respeta el cap anual cumulativo (R1 antes que R2).
        usort($rangos, function ($a, $b) {
            $fA = $a['periodoLectivo']->getFechaInicio()?->format('Y-m-d') ?? '';
            $fB = $b['periodoLectivo']->getFechaInicio()?->format('Y-m-d') ?? '';
            return strcmp($fA, $fB);
        });

        if ($totalSemanasGrupoOverride === null) {
            $total = 0.0;
            foreach ($rangos as $r) {
                $pl = $r['periodoLectivo'];
                $ini = $pl->getFechaInicio();
                $fin = $pl->getFechaFin();
                if (!$ini || !$fin) continue;
                $diffDays = (int) $ini->diff($fin)->format('%a') + 1;
                if ($diffDays > 0) $total += $diffDays / 7.0;
            }
            $totalSemanasGrupoOverride = $total > 0 ? $total : null;
        }

        // Cargar PLIs base por PL UNA SOLA VEZ y mantenerlos como
        // workingPlisByPl (mutables entre iteraciones outer). El targetAnual
        // se calcula desde los PLIs originales (no se mueve con la
        // redistribución — el currículo es fijo).
        $workingPlisByPl = [];
        $semanasByPlKey = [];
        $targetAnualByImp = [];
        foreach ($rangos as $r) {
            $pl = $r['periodoLectivo'];
            $pliOverride = $r['pliOverride'] ?? null;
            $iniPre = $pl->getFechaInicio();
            $finPre = $pl->getFechaFin();
            $semanasPlPre = ($iniPre && $finPre)
                ? ((int) $iniPre->diff($finPre)->format('%a') + 1) / 7.0
                : 0.0;
            $semanasByPlKey[$r['plKey']] = $semanasPlPre;
            $basePlis = $pliOverride ?? $this->em->getRepository(PeriodoLectivoImparticion::class)
                ->createQueryBuilder('pli')
                ->andWhere('pli.periodoLectivo = :pl')
                ->andWhere('pli.deleted = false')
                ->setParameter('pl', $pl)
                ->getQuery()
                ->getResult();
            // Clonar para mutación cross-iter outer.
            $workingPlisByPl[$r['plKey']] = $this->cloneMutableMinutos($basePlis);
            // Target anual fijo desde el origen (no se redistribuye).
            foreach ($basePlis as $pli) {
                $imp = $pli->getImparticion();
                if ($imp === null || $imp->isDeleted()) continue;
                if (!$imp->getEffectiveModalidad()->consumeAula()) continue;
                $impId = $imp->getId();
                if ($impId === null) continue;
                $targetAnualByImp[$impId] = ($targetAnualByImp[$impId] ?? 0)
                    + (int) round($pli->getEffectiveMinutosSemanales() * $semanasPlPre);
            }
        }

        // Bucle OUTER: solve all → measure shortfall → redistribute → repeat.
        $perPl = [];
        $accumPlacedByImp = [];
        $crossRangoShortfalls = [];
        $redistributionLog = [];
        $outerIterationsRun = 0;
        $stoppedReason = 'maxOuterIterations';

        for ($outerIter = 1; $outerIter <= self::MAX_OUTER_ITERATIONS; $outerIter++) {
            $outerIterationsRun = $outerIter;
            $perPl = [];
            $accumPlacedByImp = [];

            foreach ($rangos as $r) {
                $pl = $r['periodoLectivo'];
                $semanasPl = $semanasByPlKey[$r['plKey']];
                $iterRes = $this->solveIterativo(
                    $grupo,
                    $seed,
                    $pl,
                    $accumPlacedByImp,
                    $workingPlisByPl[$r['plKey']],  // mutable, se preservan los redistribuciones
                    $totalSemanasGrupoOverride,
                    $maxIterations,
                );

                $semanalMinPorImp = [];
                foreach (($iterRes['placements'] ?? []) as $p) {
                    $dur = $this->minsBetween($p['horaInicio'], $p['horaFin']);
                    if ($dur <= 0) continue;
                    $impId = (int) ($p['imparticionId'] ?? 0);
                    if ($impId <= 0) continue;
                    $semanalMinPorImp[$impId] = ($semanalMinPorImp[$impId] ?? 0) + $dur;
                }
                foreach ($semanalMinPorImp as $impId => $semanalMin) {
                    $accumPlacedByImp[$impId] = ($accumPlacedByImp[$impId] ?? 0) + (int) round($semanalMin * $semanasPl);
                }

                $perPl[] = array_merge($iterRes, [
                    'periodoLectivoId' => $pl->getId() > 0 ? $pl->getId() : null,
                    'tempId' => $r['tempId'] ?? null,
                    'plKey' => $r['plKey'],
                    'plNombre' => $pl->getNombre(),
                    'plFechaInicio' => $pl->getFechaInicio()?->format('Y-m-d'),
                    'plFechaFin' => $pl->getFechaFin()?->format('Y-m-d'),
                    'semanasPl' => round($semanasPl, 2),
                ]);
            }

            // Calcular shortfalls cross-rango.
            $crossRangoShortfalls = $this->computeCrossRangoShortfalls(
                $targetAnualByImp,
                $accumPlacedByImp,
                $perPl,
            );
            if (empty($crossRangoShortfalls)) {
                $stoppedReason = 'allCovered';
                break;
            }

            // Intentar redistribuir: mueve cuota in-memory en workingPlisByPl.
            $movements = $this->redistribuirCrossRango(
                $crossRangoShortfalls,
                $perPl,
                $workingPlisByPl,
                $outerIter,
            );
            $redistributionLog = array_merge($redistributionLog, $movements);
            if (empty($movements)) {
                // Heurística agotada: ningún movimiento mejora el shortfall.
                $stoppedReason = 'noRedistributionPossible';
                break;
            }
        }

        return [
            'perPl' => $perPl,
            'accumPlacedByImp' => $accumPlacedByImp,
            'targetAnualByImp' => $targetAnualByImp,
            'crossRangoShortfalls' => $crossRangoShortfalls,
            'redistributionLog' => $redistributionLog,
            'outerIterationsRun' => $outerIterationsRun,
            'stoppedReason' => $stoppedReason,
            'totalSemanasGrupo' => $totalSemanasGrupoOverride,
            'elapsedSec' => round(microtime(true) - $start, 3),
            'rangosCount' => count($rangos),
        ];
    }

    /**
     * Compara `targetAnualByImp` vs `accumPlacedByImp` y devuelve la lista
     * de imps con cobertura anual < 95%. Cada entry incluye nombre de
     * materia (buscado en `perPl.debug.imparticiones`).
     */
    private function computeCrossRangoShortfalls(array $targetAnualByImp, array $accumPlacedByImp, array $perPl): array
    {
        $shortfalls = [];
        foreach ($targetAnualByImp as $impId => $target) {
            if ($target <= 0) continue;
            $placed = $accumPlacedByImp[$impId] ?? 0;
            if ($placed >= $target * 0.95) continue;
            $faltanMin = $target - $placed;
            $materia = null;
            foreach ($perPl as $plRep) {
                foreach ($plRep['debug']['imparticiones'] ?? [] as $row) {
                    if ((int) $row['imparticionId'] === $impId) {
                        $materia = $row['materia'] ?? null;
                        break 2;
                    }
                }
            }
            $shortfalls[] = [
                'imparticionId' => $impId,
                'materia' => $materia,
                'targetAnualMin' => $target,
                'placedAnualMin' => $placed,
                'faltanMin' => $faltanMin,
                'horasFaltantes' => round($faltanMin / 60, 1),
                'coberturaPct' => (int) round($placed / $target * 100),
            ];
        }
        // Ordenar por faltanMin desc: las más urgentes primero.
        usort($shortfalls, fn ($a, $b) => $b['faltanMin'] <=> $a['faltanMin']);
        return $shortfalls;
    }

    /**
     * Intenta mover cuota in-memory para reducir los shortfalls cross-rango.
     *
     * Para cada imp con shortfall (sorted: la más urgente primero):
     *   - Busca un PL receptor donde la imp esté activa (presente en
     *     workingPlisByPl[plKey]) y haya OTRA imp con cobertura > 110%
     *     del target proporcional del PL (overshoot que pueda ceder).
     *   - Mueve `SLOT_REDUCTION_MIN` (60 min/sem) del PLI donante al
     *     PLI receptor: reduce minutosSemanales del donante, aumenta
     *     el del receptor.
     *   - Como mucho un movimiento por shortfall por iteración outer
     *     (evita movimientos masivos que disparen efectos secundarios).
     *
     * Devuelve el log de movimientos. Lista vacía = no hay movimiento
     * posible (heurística agotada).
     *
     * @return array<array{plKey:string, donorImpId:int, donorMateria:?string, receptorImpId:int, receptorMateria:?string, minutosMovidos:int, outerIter:int}>
     */
    private function redistribuirCrossRango(
        array $shortfalls,
        array $perPl,
        array &$workingPlisByPl,
        int $outerIter,
    ): array {
        $movements = [];
        // Mapa rápido plKey → debug.imparticiones (target/placed por imp en ese PL).
        $debugImpsByPlKey = [];
        foreach ($perPl as $plRep) {
            $debugImpsByPlKey[$plRep['plKey']] = $plRep['debug']['imparticiones'] ?? [];
        }

        foreach ($shortfalls as $sf) {
            $impId = (int) $sf['imparticionId'];
            $movedThisShortfall = false;
            foreach ($workingPlisByPl as $plKey => $plis) {
                if ($movedThisShortfall) break;
                // ¿imp activa en este PL?
                $pliReceptor = null;
                foreach ($plis as $pli) {
                    if ($pli->getImparticion()?->getId() === $impId) {
                        $pliReceptor = $pli;
                        break;
                    }
                }
                if ($pliReceptor === null) continue;

                // Buscar una imp donante en este PL con overshoot > 110% del target del PL.
                $debugImps = $debugImpsByPlKey[$plKey] ?? [];
                foreach ($debugImps as $row) {
                    $donorImpId = (int) ($row['imparticionId'] ?? 0);
                    if ($donorImpId === $impId) continue;       // no la propia
                    $target = (int) ($row['minutosTarget'] ?? 0);
                    $placed = (int) ($row['minutosColocados'] ?? 0);
                    if ($target <= 0) continue;
                    if ($placed < $target * 1.10) continue;     // sin overshoot
                    // Encontrar el PLI donante en workingPlis.
                    $pliDonor = null;
                    foreach ($plis as $pli) {
                        if ($pli->getImparticion()?->getId() === $donorImpId) {
                            $pliDonor = $pli;
                            break;
                        }
                    }
                    if ($pliDonor === null) continue;
                    $donorMin = $pliDonor->getEffectiveMinutosSemanales();
                    if ($donorMin < self::SLOT_REDUCTION_MIN) continue;  // ya en mínimo

                    // Movimiento: -60 al donante, +60 al receptor.
                    $pliDonor->setMinutosSemanales($donorMin - self::SLOT_REDUCTION_MIN);
                    $pliReceptor->setMinutosSemanales($pliReceptor->getEffectiveMinutosSemanales() + self::SLOT_REDUCTION_MIN);
                    $movements[] = [
                        'plKey' => $plKey,
                        'donorImpId' => $donorImpId,
                        'donorMateria' => $row['materia'] ?? null,
                        'receptorImpId' => $impId,
                        'receptorMateria' => $sf['materia'] ?? null,
                        'minutosMovidos' => self::SLOT_REDUCTION_MIN,
                        'outerIter' => $outerIter,
                    ];
                    $movedThisShortfall = true;
                    break;
                }
            }
        }
        return $movements;
    }

    private function minsBetween(string $hi, string $hf): int
    {
        $parse = function (string $s): int {
            $parts = explode(':', $s);
            $h = (int) ($parts[0] ?? 0);
            $m = (int) ($parts[1] ?? 0);
            return $h * 60 + $m;
        };
        return $parse($hf) - $parse($hi);
    }

    /**
     * Clona los PLI a copias in-memory donde sí podemos mutar `minutosSemanales`
     * sin afectar a la BD ni al caller. Las relaciones (Imparticion, PL) se
     * comparten por referencia: solo nos interesa que cada clon tenga su
     * propio scalar de minutos.
     *
     * @param array<PeriodoLectivoImparticion> $source
     * @return array<PeriodoLectivoImparticion>
     */
    private function cloneMutableMinutos(array $source): array
    {
        $out = [];
        foreach ($source as $pli) {
            $clone = new PeriodoLectivoImparticion();
            $clone->setPeriodoLectivo($pli->getPeriodoLectivo());
            $clone->setImparticion($pli->getImparticion());
            // Punto clave: capturamos el EFECTIVO (override propio o default
            // heredado de Materia) y lo materializamos como override del clon.
            // El solver lee `getEffectiveMinutosSemanales()` y verá nuestros
            // valores reducidos en sucesivas pasadas.
            $clone->setMinutosSemanales($pli->getEffectiveMinutosSemanales());
            $out[] = $clone;
        }
        return $out;
    }

    private function errorResult(string $msg): array
    {
        return [
            'complete' => false,
            'placements' => [],
            'unplaced' => [],
            'iterationLog' => [],
            'diagnostic' => [
                'stoppedReason' => 'error',
                'iterationsRun' => 0,
                'finalUnplaced' => [],
                'primaryBottleneck' => null,
                'metrics' => [],
                'suggestions' => [],
            ],
            'debug' => ['error' => $msg, 'algoritmo' => 'iterativo-fase3'],
        ];
    }
}
