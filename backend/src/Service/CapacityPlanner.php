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
    public function plan(Grupo $grupo, ?PeriodoLectivo $periodoLectivo = null, ?array $alreadyPlacedByImp = null): array
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

        // Cap anual por materia (Fase 5 fix afinado + 2026-04-29 cuota equitativa):
        // cada materia tiene un objetivo curricular = `materia.minutosSemanales × 36`
        // (LOMLOE D-L). Lo ya colocado en OTROS rangos del grupo se descuenta del
        // cuota de este rango, con tolerancia +TOLERANCIA_ANUAL_FRAC.
        //
        // Tres cuotas posibles, se toma la más restrictiva (`min` de las tres):
        //   1. `cuotaNatural   = min/sem × semanasRango` → techo físico:
        //      no se puede asignar más que lo que tendría la materia "naturalmente"
        //      en este rango si fuese todo el año.
        //   2. `cuotaEquitativa = objetivoAnual × (semanasRango / totalSemanasGrupo)` →
        //      reparto proporcional cuando Σsemanas > 36 LOMLOE, evita que los
        //      primeros rangos saturen el currículo y dejen vacíos los últimos.
        //   3. `maxRestante    = objetivoAnual × (1 + TOLERANCIA_ANUAL_FRAC) − yaColocado` →
        //      fail-safe absoluto: nunca sobrepasar el currículo total + holgura.
        //
        // Tolerancia anual: 0 absoluta. Con la cuota equitativa (#2) repartiendo
        // el currículo entre rangos, el round-up D22=A se autorregula en el
        // último rango: cuando `maxRestante` cae por debajo del slot menor
        // multiplicado por las semanas, el ILP fuerza un round-DOWN natural
        // (combo sum >= m_pequeño = un solo slot), absorbiendo el exceso de
        // round-up acumulado en rangos previos. Resultado típico: overshoot
        // ≤ 5-10% del currículo en lugar del 20% que producía la tolerancia
        // proporcional o el rango final vacío que producía la fórmula naïve.
        //
        // El parámetro `$alreadyPlacedByImp` lo pasa el caller (frontend calcula
        // minutos anuales ya colocados en otros rangos antes de ejecutar el solver).
        // Si el array es null, no se aplica el cap (modo legacy / single-range).
        $TOLERANCIA_ANUAL_MIN = 0;           // sin holgura: el último rango se autorregula
        $SEMANAS_REF_LOMLOE = 36;
        $semanasRango = $this->calcularSemanasPL($periodoLectivo);
        // Total de semanas del grupo (todos sus PLs vivos). Necesario para la
        // cuota equitativa cuando hay multi-rango. Si solo hay un PL, coincide
        // con $semanasRango y la cuota equitativa = objetivoAnual completo.
        $totalSemanasGrupo = $alreadyPlacedByImp !== null
            ? $this->calcularTotalSemanasGrupo($grupo)
            : 0.0;
        // Slot menor de la jornada — usado como umbral para descartar materias
        // con cuota residual demasiado pequeña (cap anual cross-rango): si el
        // currículo de una materia ya está cubierto al ~98% por rangos
        // anteriores, su cuota restante puede ser solo unos minutos. Forzar
        // un slot completo en este rango por esa materia generaría combos
        // imposibles con las demás (déficit semanal en jornadas ajustadas).
        // Solución: si cuotaEsteRango < slotMin, skip esta materia en el rango.
        $slotMinDuracion = empty($slotsBase) ? 60 : (int) min(array_map(fn ($s) => $s[2], $slotsBase));

        $materias = [];
        $totalMinutos = 0;
        foreach ($plis as $pli) {
            $imp = $pli->getImparticion();
            if ($imp === null || $imp->isDeleted()) continue;
            // Solo PRESENCIAL ocupa slots. Las modalidades FCT/NO_REGULAR/AUTONOMA
            // cuentan al currículo pero NO consumen aula — no entran al ILP ni a
            // las cuotas. Sus minutos los reportará el banner anual aparte.
            if (!$imp->getEffectiveModalidad()->consumeAula()) continue;
            $minutosBaseSemanal = $pli->getEffectiveMinutosSemanales();
            if ($minutosBaseSemanal <= 0) continue;

            // Cuota objetivo de este rango = min/sem × semanas (lo "natural").
            $cuotaNatural = (int) round($minutosBaseSemanal * $semanasRango);

            // Cap anual: si el caller pasó info de placements en otros rangos,
            // aplicar la triple regla min(natural, equitativa, restante).
            if ($alreadyPlacedByImp !== null) {
                $objetivoAnual = ($imp->getMateria()?->getMinutosSemanales() ?? 0) * $SEMANAS_REF_LOMLOE;
                // Cuota equitativa: este rango toma la fracción del objetivo
                // anual proporcional al peso de sus semanas sobre el total
                // del grupo. Si totalSemanas <= 0 (caso edge), neutralizamos
                // la equitativa con PHP_INT_MAX para que no domine el min().
                $cuotaEquitativa = $totalSemanasGrupo > 0
                    ? (int) round($objetivoAnual * ($semanasRango / $totalSemanasGrupo))
                    : PHP_INT_MAX;
                $yaColocadoOtrosRangos = (int) ($alreadyPlacedByImp[$imp->getId()] ?? 0);
                $maxRestante = max(0, $objetivoAnual + $TOLERANCIA_ANUAL_MIN - $yaColocadoOtrosRangos);
                $cuotaEsteRango = min($cuotaNatural, $cuotaEquitativa, $maxRestante);
                // Skip si la cuota residual no llega ni a 1 slot del rango.
                // Materia "casi cubierta" no necesita más placements aquí —
                // forzarlo crearía un combo de 1 slot que satura otras.
                if ($cuotaEsteRango < $slotMinDuracion) {
                    $cuotaEsteRango = 0;
                }
            } else {
                $cuotaEsteRango = $cuotaNatural;
            }

            // Convertir cuota total del rango → minutos/sem para el ILP del
            // planner (que opera en cuotas semanales asumiendo placements
            // recurrentes cada semana del rango).
            $minutosSemanalEffective = $semanasRango > 0
                ? (int) round($cuotaEsteRango / $semanasRango)
                : $minutosBaseSemanal;

            if ($minutosSemanalEffective <= 0) continue;
            $materias[] = [
                'impId' => $imp->getId(),
                'nombre' => $imp->getMateria()?->getNombre() ?? '?',
                'minutos' => $minutosSemanalEffective,
            ];
            $totalMinutos += $minutosSemanalEffective;
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
        // y bloquear el solver, reducimos los minutos por imparticion para que
        // Σ ≤ capacidad, generamos asignación con esos valores reducidos y
        // reportamos el excedente como huérfanos parciales.
        //
        // Criterio (Fase 5 fix-C 2026-04-29): "menor penalización porcentual".
        // Cada iteración quita 1 slot a la materia que pierda MENOR % relativo
        // de sus minutos. Las materias grandes absorben mejor 1 slot perdido
        // (8h/sem → 7h/sem = -12.5%) que las pequeñas (1h/sem → 0h/sem = -100%).
        // Resultado matemáticamente óptimo: minimiza el déficit relativo total.
        //
        // El round-robin previo (que penalizaba materias en orden de iteración)
        // dejaba resultados caprichosos: Sistemas 5h podía quedar al 78% mientras
        // Programación 8h al 97% — sin lógica pedagógica. El criterio actual
        // concentra el déficit en la materia más grande del rango, que es la
        // que mejor lo absorbe en términos relativos.
        //
        // Razón filosófica: con el truco de recreos LOMLOE FP, una sobrecarga
        // semanal pequeña es operativa — los placements colocan lo que cabe;
        // el resto se justifica al currículo con recreos lectivos. El admin
        // debe poder ejecutar el solver aunque haya un déficit semanal pequeño.
        $orphansFromReduction = [];          // impId → minutos perdidos
        $orphanMateriaNames = [];            // impId → nombre (para reportar)
        if ($capacidadMinutos < $totalMinutos) {
            $unidadRedondeo = (int) min($duraciones);
            $excess = $totalMinutos - $capacidadMinutos;
            while ($excess > 0) {
                // Candidato: materia con minutos ≥ 2 unidades (no la dejes
                // con < 1 unidad) y MENOR penalización porcentual al perder
                // 1 unidad. La de mayor minutos en absoluto = menor penalty%.
                $candidatoIdx = null;
                $minPenaltyPct = INF;
                foreach ($materias as $idx => $m) {
                    if ($m['minutos'] < $unidadRedondeo * 2) continue;
                    $penaltyPct = $unidadRedondeo / $m['minutos'];
                    if ($penaltyPct < $minPenaltyPct) {
                        $minPenaltyPct = $penaltyPct;
                        $candidatoIdx = $idx;
                    }
                }
                if ($candidatoIdx === null) break;  // ninguna puede ceder más
                $impId = $materias[$candidatoIdx]['impId'];
                $materias[$candidatoIdx]['minutos'] -= $unidadRedondeo;
                $orphansFromReduction[$impId] = ($orphansFromReduction[$impId] ?? 0) + $unidadRedondeo;
                $orphanMateriaNames[$impId] = $materias[$candidatoIdx]['nombre'];
                $excess -= $unidadRedondeo;
            }
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

    /**
     * Semanas de un PeriodoLectivo (decimal). Calcula como (fechaFin - fechaInicio + 1) / 7.
     */
    private function calcularSemanasPL(PeriodoLectivo $pl): float
    {
        $i = $pl->getFechaInicio();
        $f = $pl->getFechaFin();
        if ($i === null || $f === null) return 0.0;
        $diff = $i->diff($f);
        return (((int) $diff->days) + 1) / 7.0;
    }

    /**
     * Σ semanas de TODOS los PeriodoLectivos vivos del grupo. Usado para
     * calcular la cuota equitativa cuando el cap anual cross-rango está
     * activo: la cuota de un rango es proporcional al peso de sus semanas
     * sobre el total del grupo.
     */
    private function calcularTotalSemanasGrupo(Grupo $grupo): float
    {
        $pls = $this->em->getRepository(PeriodoLectivo::class)
            ->findBy(['grupo' => $grupo, 'deleted' => false]);
        $total = 0.0;
        foreach ($pls as $pl) {
            $total += $this->calcularSemanasPL($pl);
        }
        return $total;
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
