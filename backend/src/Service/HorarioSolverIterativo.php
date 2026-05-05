<?php

namespace App\Service;

use App\Entity\Grupo;
use App\Entity\PeriodoLectivo;
use App\Entity\PeriodoLectivoImparticion;
use App\Entity\TipoTramo;
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

        // Estado entre outer iterations:
        // - blockedPairs: parejas (donor, receptor, plKey) que no produjeron
        //   aumento en `placed[receptor]` tras un movimiento previo. Se omiten
        //   en futuros redistribuciones para evitar oscilaciones.
        // - pendingVerification: movimientos hechos en la outer iter N que
        //   se verifican en la N+1 comparando placed[receptor] antes/después.
        //   Si no aumentó, se revierten y la pareja se añade a blockedPairs.
        // - lastMovementsSignature: firma del set de movimientos del outer iter
        //   anterior. Si la del actual coincide → oscilación, abortamos.
        $blockedPairs = [];
        $pendingVerification = [];
        $lastMovementsSignature = null;

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

            // Verificación de movimientos pendientes (outer iter anterior):
            // si placed[receptor] no aumentó tras el movimiento, revertirlo
            // (donor recupera sus 60min, receptor los pierde) y bloquear la
            // pareja para futuras iteraciones. Esto evita que un movimiento
            // inútil consuma cuota del donante sin beneficio neto.
            foreach ($pendingVerification as $verif) {
                $receptorId = $verif['receptorImpId'];
                $placedAntes = $verif['placedReceptorAntes'];
                $placedAhora = $accumPlacedByImp[$receptorId] ?? 0;
                if ($placedAhora <= $placedAntes) {
                    $this->revertMovement($verif, $workingPlisByPl);
                    $pairKey = $verif['plKey'].':'.$verif['donorImpId'].':'.$receptorId;
                    $blockedPairs[$pairKey] = true;
                    $redistributionLog[] = array_merge($verif, [
                        'reverted' => true,
                        'reason' => 'receptor_no_aumento',
                        'placedReceptorDespues' => $placedAhora,
                    ]);
                }
            }
            $pendingVerification = [];

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
            // Donante elegido por overshoot anual absoluto (no relativo de un
            // PL) y verificación de que tras ceder mantiene cobertura ≥ 95%.
            // `blockedPairs` skipea parejas que ya fallaron antes.
            [$movements, $newPending] = $this->redistribuirCrossRango(
                $crossRangoShortfalls,
                $perPl,
                $workingPlisByPl,
                $outerIter,
                $blockedPairs,
                $accumPlacedByImp,
                $targetAnualByImp,
                $semanasByPlKey,
            );
            $redistributionLog = array_merge($redistributionLog, $movements);
            $pendingVerification = $newPending;
            if (empty($movements)) {
                // Heurística agotada: ningún movimiento mejora el shortfall.
                $stoppedReason = 'noRedistributionPossible';
                break;
            }

            // Anti-loop outer: si el set de movimientos repite exactamente lo
            // del iter anterior (mismas parejas donor↔receptor en mismo PL),
            // estamos oscilando. Abortar para no consumir las 12 iteraciones.
            $signature = $this->signMovements($movements);
            if ($lastMovementsSignature !== null && $signature === $lastMovementsSignature) {
                $stoppedReason = 'oscillating';
                break;
            }
            $lastMovementsSignature = $signature;
        }

        // Post-proceso (2026-05-01): filtrar `unplaced` per-PL para imps que
        // ya están cubiertas ANUALMENTE. Cuando una imp tiene 30min residual
        // en un PL pero otros PLs ya superaron el target anual, ese unplaced
        // NO es un fallo del solver — es overshoot mínimo en otros rangos
        // que compensa el residual aquí. Sin este filtro, el modal del
        // frontend mostraba falsos "Rango N incomplete" cuando todo cuadra.
        foreach ($perPl as $idx => $plRep) {
            $unplacedFiltrado = [];
            foreach ($plRep['unplaced'] ?? [] as $u) {
                $impId = (int) ($u['imparticionId'] ?? 0);
                if ($impId <= 0) continue;
                $target = $targetAnualByImp[$impId] ?? 0;
                $placed = $accumPlacedByImp[$impId] ?? 0;
                if ($target > 0 && $placed >= $target * 0.95) {
                    // Anualmente cubierto: este unplaced del PL es residual
                    // matemáticamente irreducible (target del rango < bloque
                    // mínimo) pero no afecta al currículo. Se omite del
                    // reporte y el PL queda complete=true.
                    continue;
                }
                $unplacedFiltrado[] = $u;
            }
            if (count($unplacedFiltrado) !== count($plRep['unplaced'] ?? [])) {
                $perPl[$idx]['unplaced'] = $unplacedFiltrado;
                $perPl[$idx]['complete'] = empty($unplacedFiltrado);
                // Si tras el filtro no queda unplaced real, el diagnostic del
                // solver individual del PL (que detectó UNKNOWN o lo que sea
                // por ese unplaced residual) ya no aplica: limpiar para que
                // el frontend NO lo trate como issue.
                if (empty($unplacedFiltrado)) {
                    $perPl[$idx]['diagnostic'] = [
                        'stoppedReason' => 'allCoveredAfterCrossRangoFilter',
                        'iterationsRun' => $perPl[$idx]['diagnostic']['iterationsRun'] ?? 0,
                        'finalUnplaced' => [],
                        'primaryBottleneck' => null,
                        'metrics' => [],
                        'suggestions' => [],
                    ];
                }
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
     * Para cada imp con shortfall (más urgente primero):
     *   - Busca un PL receptor donde la imp esté activa.
     *   - Selecciona donante candidato con MAYOR overshoot ANUAL absoluto
     *     (no relativo a un solo PL) que tras ceder 60min/sem mantenga
     *     `placed_anual_estimado >= target_anual × 0.95`.
     *   - Skipea parejas en `$blockedPairs` (movimientos que ya fallaron).
     *   - Devuelve también `pendingVerification[]`: las metadatas de cada
     *     movimiento (donor/receptor + placed_antes) para que el caller
     *     verifique en la siguiente iter outer si el receptor aumentó. Si
     *     no, el caller revertirá y bloqueará la pareja.
     *
     * @return array{0: array<array<string,mixed>>, 1: array<array<string,mixed>>}
     *         [movements, pendingVerification]
     */
    private function redistribuirCrossRango(
        array $shortfalls,
        array $perPl,
        array &$workingPlisByPl,
        int $outerIter,
        array $blockedPairs,
        array $accumPlacedByImp,
        array $targetAnualByImp,
        array $semanasByPlKey,
    ): array {
        $movements = [];
        $pendingVerification = [];
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

                // Construir lista de candidatos a donante para este (PL, receptor)
                // ordenada por overshoot anual absoluto DESC. Filtros:
                //   - No la propia receptor.
                //   - Pareja no bloqueada previamente.
                //   - Donante presente en este PL.
                //   - Donante con cuota ≥ SLOT_REDUCTION_MIN (algo que ceder).
                //   - Tras ceder, donante mantiene placed_anual_estimado ≥ 95%
                //     de su target_anual (no rompe su propia cobertura).
                $semanasPl = $semanasByPlKey[$plKey] ?? 0.0;
                $candidatos = [];
                foreach ($debugImpsByPlKey[$plKey] ?? [] as $row) {
                    $donorImpId = (int) ($row['imparticionId'] ?? 0);
                    if ($donorImpId <= 0 || $donorImpId === $impId) continue;
                    $pairKey = $plKey.':'.$donorImpId.':'.$impId;
                    if (isset($blockedPairs[$pairKey])) continue;

                    $pliDonor = null;
                    foreach ($plis as $pli) {
                        if ($pli->getImparticion()?->getId() === $donorImpId) {
                            $pliDonor = $pli;
                            break;
                        }
                    }
                    if ($pliDonor === null) continue;
                    $donorMin = $pliDonor->getEffectiveMinutosSemanales();
                    if ($donorMin < self::SLOT_REDUCTION_MIN) continue;

                    $donorTargetAnual = $targetAnualByImp[$donorImpId] ?? 0;
                    $donorPlacedAnual = $accumPlacedByImp[$donorImpId] ?? 0;
                    if ($donorTargetAnual <= 0) continue;

                    // Overshoot ANUAL absoluto en minutos. Solo donantes con sobra real.
                    $overshootAnual = $donorPlacedAnual - $donorTargetAnual;
                    if ($overshootAnual <= 0) continue;

                    // Estimación del placed anual tras ceder 60min/sem en este PL:
                    // se restan 60 × semanasPl minutos del donante.
                    $estimatedPlacedTrasCeder = $donorPlacedAnual - (int) round(self::SLOT_REDUCTION_MIN * $semanasPl);
                    if ($estimatedPlacedTrasCeder < $donorTargetAnual * 0.95) continue;

                    $candidatos[] = [
                        'donorImpId' => $donorImpId,
                        'pliDonor' => $pliDonor,
                        'donorMin' => $donorMin,
                        'overshootAnual' => $overshootAnual,
                        'materia' => $row['materia'] ?? null,
                    ];
                }

                if (empty($candidatos)) continue;
                // Ordenar por overshoot DESC: el que más le sobra es el mejor.
                usort($candidatos, fn ($a, $b) => $b['overshootAnual'] <=> $a['overshootAnual']);
                $cand = $candidatos[0];

                // VIABILIDAD DEL RECEPTOR: el solver físico tiene cap diario
                // (MAX_DIARIO_MIN_POR_MATERIA = 120 → max 1 slot/día/imp).
                // Si tras el movimiento el receptor superase el techo viable
                // (= N_dias × max_dur_slot), el solver no podrá colocar la
                // cuota nueva → REDUCIR_CUOTA_PROPIA destructiva → cascada.
                // Skip pareja si el receptor ya está en su techo viable.
                $maxPliViable = $this->calcMaxPliViableForPl($pliReceptor->getPeriodoLectivo());
                $receptorActual = $pliReceptor->getEffectiveMinutosSemanales();
                if ($maxPliViable !== null && $receptorActual + self::SLOT_REDUCTION_MIN > $maxPliViable) {
                    continue;
                }

                // Movimiento: -60 al donante, +60 al receptor.
                $cand['pliDonor']->setMinutosSemanales($cand['donorMin'] - self::SLOT_REDUCTION_MIN);
                $pliReceptor->setMinutosSemanales($receptorActual + self::SLOT_REDUCTION_MIN);

                $movement = [
                    'plKey' => $plKey,
                    'donorImpId' => $cand['donorImpId'],
                    'donorMateria' => $cand['materia'],
                    'receptorImpId' => $impId,
                    'receptorMateria' => $sf['materia'] ?? null,
                    'minutosMovidos' => self::SLOT_REDUCTION_MIN,
                    'outerIter' => $outerIter,
                ];
                $movements[] = $movement;
                $pendingVerification[] = array_merge($movement, [
                    'placedReceptorAntes' => $accumPlacedByImp[$impId] ?? 0,
                ]);
                $movedThisShortfall = true;
            }
        }
        return [$movements, $pendingVerification];
    }

    /**
     * Revierte un movimiento previo: restaura los minutosSemanales del donante
     * y receptor en el PL afectado. Llamado cuando el verificador detecta que
     * el receptor no aumentó `placed_anual` tras el movimiento.
     */
    private function revertMovement(array $verif, array &$workingPlisByPl): void
    {
        $plKey = $verif['plKey'];
        $donorImpId = $verif['donorImpId'];
        $receptorImpId = $verif['receptorImpId'];
        $minutos = $verif['minutosMovidos'];
        $plis = $workingPlisByPl[$plKey] ?? [];
        foreach ($plis as $pli) {
            $impId = $pli->getImparticion()?->getId();
            if ($impId === $donorImpId) {
                $pli->setMinutosSemanales($pli->getEffectiveMinutosSemanales() + $minutos);
            } elseif ($impId === $receptorImpId) {
                $pli->setMinutosSemanales(max(0, $pli->getEffectiveMinutosSemanales() - $minutos));
            }
        }
    }

    /**
     * Calcula el techo de minutos/sem viable para una imp en este PL: el
     * solver físico tiene cap diario por imp (MAX_DIARIO_MIN_POR_MATERIA = 120
     * en bin-packing), lo que limita a 1 slot por día. Por tanto el max
     * pli/sem que el solver puede colocar = N_dias_lectivos × max_slot_dur.
     *
     * Devuelve null si la jornada no se puede resolver (no aplicar check).
     */
    private function calcMaxPliViableForPl(?PeriodoLectivo $pl): ?int
    {
        if ($pl === null) return null;
        $jornada = $pl->getEffectiveJornadaTipo();
        if ($jornada === null) return null;
        $diasLectivos = $jornada->getDiasLectivos() ?: [1, 2, 3, 4, 5];
        $maxSlotDur = 0;
        foreach ($jornada->getTramos() as $t) {
            if ($t->getTipo() !== TipoTramo::SLOT) continue;
            $hi = $t->getHoraInicio();
            $hf = $t->getHoraFin();
            if ($hi === null || $hf === null) continue;
            $dur = ((int) $hf->format('H')) * 60 + (int) $hf->format('i')
                 - (((int) $hi->format('H')) * 60 + (int) $hi->format('i'));
            if ($dur > $maxSlotDur) $maxSlotDur = $dur;
        }
        if ($maxSlotDur <= 0) return null;
        return count($diasLectivos) * $maxSlotDur;
    }

    /**
     * Firma estable de un set de movimientos para detectar oscilación entre
     * outer iterations. Dos sets con las mismas parejas (donor, receptor, plKey)
     * en cualquier orden producen la misma firma.
     */
    private function signMovements(array $movements): string
    {
        $tokens = [];
        foreach ($movements as $m) {
            $tokens[] = $m['plKey'].':'.$m['donorImpId'].':'.$m['receptorImpId'];
        }
        sort($tokens);
        return implode('|', $tokens);
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
