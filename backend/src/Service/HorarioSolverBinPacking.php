<?php

namespace App\Service;

use App\Entity\Grupo;
use App\Entity\Horario;
use App\Entity\JornadaTipo;
use App\Entity\PeriodoLectivo;
use App\Entity\PeriodoLectivoImparticion;
use App\Entity\TipoTramo;
use App\Entity\TurnoJornada;
use Doctrine\ORM\EntityManagerInterface;

/**
 * Solver tipo BIN-PACKING (first-fit) con respeto a `parallelBusy`.
 *
 * **Modelo conceptual** (consenso 2026-04-29 con el usuario): cada materia
 * tiene un "depósito de líquido" (= minutos curriculares semanales que
 * faltan colocar). Cada slot de la jornada es un "recipiente" con capacidad
 * fija (60 o 90 min). El algoritmo recorre slots cronológicamente (hora-
 * primero, día-después para distribuir uniformemente entre días) y vierte
 * en cada slot la materia con más líquido pendiente cuyo profesor NO esté
 * ocupado en ese slot por un grupo paralelo.
 *
 * **Diferencia vs HorarioSolver ILP**: el ILP busca combos delta=0 y a veces
 * deja slots vacíos cuando varias combinaciones son válidas (ej: target=240
 * puede ser `4×60` o `1×60+2×90`; el ILP elige uno dejando el otro vacío).
 * El bin-packing NO tiene esta ambigüedad: cada slot recibe materia (hasta
 * agotar líquidos) y la última asignación de cada materia puede sobrepasar
 * su target en ≤ 1 slot (overshoot D22=A acotado).
 *
 * **Garantías**:
 * - Cobertura per materia: 100-110% (overshoot ≤ 1 slot).
 * - Slots vacíos: SOLO por conflict profe en grupos paralelos.
 * - Algoritmo determinista: mismo input → mismo output.
 * - Tiempo de ejecución: O(N×M) donde N = slots, M = materias. < 50ms / rango.
 *
 * Doc: docs/hoja-de-ruta-solver-bin-packing.md
 */
class HorarioSolverBinPacking
{
    /** Bloque mínimo (= 1 hora pedagógica). Granularidad menor permitida en jornada. */
    private const MIN_BLOQUE_MIN = 60;
    /** Bloque máximo y cap diario por materia (= 2 horas seguidas). */
    private const MAX_BLOQUE_MIN = 120;
    private const MAX_DIARIO_MIN_POR_MATERIA = 120;

    public function __construct(
        private EntityManagerInterface $em,
        private PeriodoLectivoResolver $resolver,
    ) {
    }

    /**
     * Misma interfaz que `HorarioSolver::solve()` para que el endpoint pueda
     * conmutar entre ambos solvers transparentemente.
     *
     * `$pliOverride` permite ejecutar el solver en modo dry-run con un
     * PeriodoLectivo y PLIs construidos en memoria (sin persistir). Lo usa
     * la cola pendingActions del editor para mostrar preview de placements
     * antes de que el usuario pulse Guardar (Tanda B 2026-04-30).
     *
     * @param array<\App\Entity\PeriodoLectivoImparticion>|null $pliOverride
     */
    public function solve(Grupo $grupo, ?int $seed = null, ?PeriodoLectivo $periodoLectivo = null, ?array $alreadyPlacedByImp = null, ?array $pliOverride = null, ?float $totalSemanasGrupoOverride = null): array
    {
        $start = microtime(true);

        $periodoLectivo = $periodoLectivo ?? $this->resolver->resolveActive($grupo);
        if ($periodoLectivo === null) {
            return $this->errorResult('Grupo sin PeriodoLectivo (caso imposible tras la migración Fase 1).');
        }

        $jornada = $periodoLectivo->getEffectiveJornadaTipo();
        if ($jornada === null) {
            return $this->errorResult('Sin jornada asignada al rango, al grupo (override) ni al itinerario.');
        }

        $diasLectivos = $jornada->getDiasLectivos() ?: [1, 2, 3, 4, 5];
        $slots = $this->slotsFromJornada($jornada);
        if (empty($slots)) {
            return $this->errorResult('La jornada no contiene tramos de tipo SLOT.');
        }

        // Imparticiones del rango (vía PLI). En modo dry-run el caller pasa
        // `$pliOverride` con PLIs in-memory; si no, se leen de BD como hasta
        // ahora.
        $plis = $pliOverride ?? $this->em->getRepository(PeriodoLectivoImparticion::class)
            ->createQueryBuilder('pli')
            ->andWhere('pli.periodoLectivo = :pl')
            ->andWhere('pli.deleted = false')
            ->setParameter('pl', $periodoLectivo)
            ->getQuery()
            ->getResult();

        $imps = [];                  // [impId => Imparticion]
        $minutosTarget = [];         // [impId => target inicial (min/sem pedido)]
        $liquido = [];               // [impId => minutos pendientes por verter]
        foreach ($plis as $pli) {
            $imp = $pli->getImparticion();
            if ($imp === null || $imp->isDeleted()) continue;
            // Solo PRESENCIAL ocupa slot. Las modalidades FCT/NO_REGULAR/AUTONOMA
            // no entran al bin-packing (su carga curricular se cuenta aparte).
            if (!$imp->getEffectiveModalidad()->consumeAula()) continue;
            $minutos = $pli->getEffectiveMinutosSemanales();
            if ($minutos <= 0) continue;
            $impId = $imp->getId();
            $imps[$impId] = $imp;
            $minutosTarget[$impId] = $minutos;
            $liquido[$impId] = $minutos;
        }

        if (empty($imps)) {
            return [
                'complete' => true,
                'placements' => [],
                'unplaced' => [],
                'periodoLectivoId' => $periodoLectivo->getId(),
                'periodoLectivoNombre' => $periodoLectivo->getNombre(),
                'debug' => ['note' => 'Sin imparticiones presenciales en el rango.'],
            ];
        }

        $turno = $jornada->getTurno();
        $parallelBusy = $this->buildParallelBusy($grupo, $turno);

        // ── BLOQUES CONTIGUOS (2026-05-01) ────────────────────────────
        // Reemplaza el modelo "1 placement = 1 slot" por "1 placement = 1
        // bloque contiguo de N slots de la misma materia en el mismo día".
        // Restricciones:
        //   - bloque mínimo: MIN_BLOQUE_MIN minutos (default 60).
        //   - bloque máximo: MAX_BLOQUE_MIN minutos (default 120).
        //   - cap diario por materia: MAX_DIARIO_MIN_POR_MATERIA (default 120).
        //   - profe libre en TODOS los slots del bloque.
        //   - tramo contiguo: secuencia de slots consecutivos sin recreo
        //     entre medias (un recreo rompe el tramo).
        //
        // Algoritmo:
        //   foreach día lectivo:
        //     foreach tramo contiguo del día:
        //       while quedan slots libres:
        //         elegir mejor materia candidata + tamaño bloque
        //         si no hay → dejar resto de tramo vacío
        //         sino → colocar bloque (1 placement con horaInicio del primer
        //                slot, horaFin del último slot del bloque)
        //
        // El frontend renderiza cada placement con altura = duración / slot
        // mínimo de la jornada (CSS grid-row span N). Una jornada con slots
        // de 30min y un placement de 60min = span 2.

        $tramosContiguos = $this->buildTramosContiguos($jornada);  // [[slot, slot, ...], ...]
        $placements = [];
        $profBusyLocal = [];        // ['dia_hi' => [profIds]] — slot a slot

        // Orden DÍA-primero, TRAMO-después. Distribución diaria gestionada
        // vía CAP_DIARIO + score que premia materias con menos colocadas hoy.
        foreach ($diasLectivos as $dia) {
            $colocadosHoy = [];     // [impId => minutos colocados HOY]

            foreach ($tramosContiguos as $tramo) {
                $slotsLibres = $tramo;  // copia: lista de [hi, hf, dur]

                while (!empty($slotsLibres)) {
                    $best = $this->elegirMejorBloque(
                        $slotsLibres,
                        $imps,
                        $liquido,
                        $minutosTarget,
                        $colocadosHoy,
                        $dia,
                        $profBusyLocal,
                        $parallelBusy,
                    );
                    if ($best === null) break;  // sin candidato → dejar resto vacío

                    $impId = $best['impId'];
                    $imp = $imps[$impId];
                    $bloqueSlots = array_slice($slotsLibres, 0, $best['nSlots']);
                    $bloqueDur = array_sum(array_map(fn ($s) => $s[2], $bloqueSlots));
                    $hi = $bloqueSlots[0][0];
                    $hf = $bloqueSlots[count($bloqueSlots) - 1][1];

                    $placements[] = [
                        'imp' => $imp,
                        'dia' => $dia,
                        'hi' => $hi,
                        'hf' => $hf,
                        'min' => $bloqueDur,
                    ];

                    // Marcar profe ocupado en TODOS los slots del bloque.
                    $pid = $imp->getProfesor()?->getId();
                    if ($pid !== null) {
                        foreach ($bloqueSlots as $slot) {
                            $key = $dia . '_' . $slot[0];
                            $profBusyLocal[$key][] = $pid;
                        }
                    }
                    $liquido[$impId] -= $bloqueDur;
                    $colocadosHoy[$impId] = ($colocadosHoy[$impId] ?? 0) + $bloqueDur;
                    // Consumir los slots usados.
                    $slotsLibres = array_slice($slotsLibres, $best['nSlots']);
                }
            }
        }

        // Construir output (compatible con HorarioSolver).
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

        // Materias con líquido > 0 al final: unplaced (no se pudo colocar todo).
        // En bin-packing esto solo ocurre si el profe estaba ocupado en TODOS
        // los slots posibles del rango (caso patológico).
        $unplaced = [];
        foreach ($imps as $impId => $imp) {
            if ($liquido[$impId] > 0) {
                $unplaced[] = [
                    'imparticionId' => $impId,
                    'materia' => $imp->getMateria()?->getNombre(),
                    'minutosRestantes' => $liquido[$impId],
                    'horasRestantes' => round($liquido[$impId] / 60, 2),
                ];
            }
        }

        $minutosColocados = 0;
        $placedMinPerImp = [];
        foreach ($placements as $p) {
            $iid = $p['imp']->getId();
            $minutosColocados += (int) $p['min'];
            $placedMinPerImp[$iid] = ($placedMinPerImp[$iid] ?? 0) + (int) $p['min'];
        }

        $tasksPerImp = [];
        $totalMinAColocar = 0;
        foreach ($imps as $impId => $imp) {
            $totalMinAColocar += $minutosTarget[$impId];
            $tasksPerImp[] = [
                'imparticionId' => $impId,
                'materia' => $imp->getMateria()?->getNombre(),
                'profesor' => trim(($imp->getProfesor()?->getNombre() ?? '') . ' ' . ($imp->getProfesor()?->getApellidos() ?? '')),
                'profesorId' => $imp->getProfesor()?->getId(),
                'minutosTarget' => $minutosTarget[$impId],
                'minutosColocados' => $placedMinPerImp[$impId] ?? 0,
                'liquidoFinal' => $liquido[$impId],
            ];
        }

        return [
            'complete' => empty($unplaced),
            'placements' => $out,
            'unplaced' => $unplaced,
            'periodoLectivoId' => $periodoLectivo->getId(),
            'periodoLectivoNombre' => $periodoLectivo->getNombre(),
            'debug' => [
                'algoritmo' => 'bin-packing-bloques',
                'periodoLectivoId' => $periodoLectivo->getId(),
                'periodoLectivoNombre' => $periodoLectivo->getNombre(),
                'jornadaId' => $jornada->getId(),
                'jornadaNombre' => $jornada->getNombre(),
                'turno' => $turno?->value,
                'diasLectivos' => $diasLectivos,
                'slotsPorDia' => count($slots),
                'slotDurations' => array_map(fn ($s) => $s[2], $slots),  // [30, 30, 30, ...] — Fase 2 classifier
                'totalSlots' => count($slots) * count($diasLectivos),
                'tramosContiguosPorDia' => array_map(fn ($t) => count($t), $tramosContiguos),
                'totalMinutosAColocar' => $totalMinAColocar,
                'minutosColocados' => $minutosColocados,
                'placedCount' => count($out),
                'imparticiones' => $tasksPerImp,
                'parallelBusyCellsCount' => count($parallelBusy),
                'parallelBusy' => $parallelBusy,                          // [dia_hi => [profIds]] — Fase 2 classifier
                'elapsedSec' => round(microtime(true) - $start, 3),
            ],
        ];
    }

    /**
     * Devuelve los slots agrupados en tramos contiguos. Un tramo contiguo
     * = secuencia de slots `SLOT` consecutivos sin recreo entre medias.
     * Ejemplo (FP Mañanas tras migración 30min):
     *   slots 0-3 (08:30-10:30, 4×30min), recreo, slots 5-8 (10:50-12:50,
     *   4×30min), recreo, slots 10-12 (13:00-14:30, 3×30min)
     *   → 3 tramos contiguos: [4 slots], [4 slots], [3 slots].
     *
     * El solver coloca bloques DENTRO de cada tramo contiguo (un bloque no
     * puede atravesar un recreo).
     *
     * @return array<int, array<int, array{0: string, 1: string, 2: int}>>
     *         Cada entrada exterior es un tramo contiguo; cada interior es
     *         un slot [horaInicio, horaFin, duracionMin].
     */
    private function buildTramosContiguos(JornadaTipo $jornada): array
    {
        $tramos = $jornada->getTramos()->toArray();
        usort($tramos, fn ($a, $b) => $a->getHoraInicio() <=> $b->getHoraInicio());
        $out = [];
        $current = [];
        foreach ($tramos as $t) {
            if ($t->getTipo() !== TipoTramo::SLOT) {
                // Recreo (o cualquier no-SLOT) cierra el tramo contiguo actual.
                if (!empty($current)) {
                    $out[] = $current;
                    $current = [];
                }
                continue;
            }
            $hi = $t->getHoraInicio()?->format('H:i');
            $hf = $t->getHoraFin()?->format('H:i');
            if ($hi === null || $hf === null) continue;
            $current[] = [$hi, $hf, $t->getDuracionMinutos()];
        }
        if (!empty($current)) {
            $out[] = $current;
        }
        return $out;
    }

    /**
     * Elige la mejor materia + tamaño de bloque a colocar al inicio de
     * `$slotsLibres` (lista de slots consecutivos restantes en el tramo
     * contiguo actual del día).
     *
     * Restricciones por candidato:
     *   - liquido > 0
     *   - colocadoHoy + bloque ≤ MAX_DIARIO_MIN_POR_MATERIA
     *   - bloque cabe en slots libres del tramo
     *   - profe libre en TODOS los slots del bloque
     *
     * Tamaño del bloque (en minutos): el más grande posible que cumpla
     * `60 ≤ bloque ≤ min(120, líquido restante, capacidad diaria restante,
     * minutos disponibles en slots libres)`. Si la materia tiene líquido
     * < 60, intenta aún colocar 60min (overshoot acotado a último slot del
     * mínimo) si el ratio de cobertura final ≤ 1.30 del target.
     *
     * Score: prioriza líquido descendente; empate → menor minutos colocados
     * hoy (favorece distribución diaria entre materias).
     *
     * @param array<int, array{0: string, 1: string, 2: int}> $slotsLibres
     * @return array{impId: int, nSlots: int}|null  null = no hay candidato
     */
    private function elegirMejorBloque(
        array $slotsLibres,
        array $imps,
        array $liquido,
        array $minutosTarget,
        array $colocadosHoy,
        int $dia,
        array $profBusyLocal,
        array $parallelBusy,
    ): ?array {
        if (empty($slotsLibres)) return null;
        // Asumimos slots de duración uniforme dentro de un tramo contiguo
        // (típico en jornadas reales: todo 30min o todo 60min).
        $slotDur = $slotsLibres[0][2];
        if ($slotDur <= 0) return null;
        // Minutos disponibles en lo que queda del tramo.
        $minutosDisponibles = count($slotsLibres) * $slotDur;

        $best = null;  // ['impId', 'nSlots', 'durMin', 'score']
        foreach ($imps as $impId => $imp) {
            $liquidoImp = $liquido[$impId];
            if ($liquidoImp <= 0) continue;  // ya cubierto (overshoot opcional vía pase B abajo)
            $colocadoHoyImp = $colocadosHoy[$impId] ?? 0;
            $capRestanteHoy = self::MAX_DIARIO_MIN_POR_MATERIA - $colocadoHoyImp;
            if ($capRestanteHoy < self::MIN_BLOQUE_MIN) continue;  // ya tiene 60+ hoy o muy cerca

            // Tamaño deseado (en minutos):
            //   tope superior: min(MAX_BLOQUE, líquido, cap diario, disponible)
            //   tope inferior: MIN_BLOQUE_MIN
            $durDeseada = min(
                self::MAX_BLOQUE_MIN,
                $liquidoImp,
                $capRestanteHoy,
                $minutosDisponibles,
            );
            // Si líquido < MIN_BLOQUE pero cap permite 60min, podemos aceptar overshoot
            // hasta llegar a MIN_BLOQUE_MIN siempre que no superemos 130% del target.
            if ($durDeseada < self::MIN_BLOQUE_MIN) {
                $target = $minutosTarget[$impId];
                if ($target <= 0) continue;
                // Overshoot tras colocar bloque mínimo
                $cubierto = $target - $liquidoImp;
                $coberturaTrasAdd = ($cubierto + self::MIN_BLOQUE_MIN) / $target;
                if ($coberturaTrasAdd > 1.30) continue;
                $durDeseada = self::MIN_BLOQUE_MIN;
                if ($durDeseada > min($capRestanteHoy, $minutosDisponibles)) continue;
            }
            // Redondear hacia abajo a múltiplo de slotDur, sin bajar de MIN_BLOQUE_MIN.
            $nSlotsDeseado = (int) floor($durDeseada / $slotDur);
            if ($nSlotsDeseado * $slotDur < self::MIN_BLOQUE_MIN) continue;

            // Probar el tamaño deseado y, si profe ocupado, ir bajando hasta
            // MIN_BLOQUE_MIN. Esto absorbe el caso "profe libre solo 60min,
            // pero materia querría bloque de 90".
            $nSlotsFinal = null;
            $pid = $imp->getProfesor()?->getId();
            for ($n = $nSlotsDeseado; $n * $slotDur >= self::MIN_BLOQUE_MIN; $n--) {
                $libreEnTodos = true;
                for ($i = 0; $i < $n; $i++) {
                    $key = $dia . '_' . $slotsLibres[$i][0];
                    if ($pid !== null && (
                        (isset($profBusyLocal[$key]) && in_array($pid, $profBusyLocal[$key], true)) ||
                        (isset($parallelBusy[$key]) && in_array($pid, $parallelBusy[$key], true))
                    )) {
                        $libreEnTodos = false;
                        break;
                    }
                }
                if ($libreEnTodos) {
                    $nSlotsFinal = $n;
                    break;
                }
            }
            if ($nSlotsFinal === null) continue;

            $durFinal = $nSlotsFinal * $slotDur;
            // Score: líquido pendiente (mayor prioridad) menos lo colocado hoy
            // (favorece distribución diaria — materias que no han recibido nada
            // hoy ganan a las que ya tienen slots).
            $score = $liquidoImp - $colocadoHoyImp;
            if ($best === null || $score > $best['score']) {
                $best = [
                    'impId' => $impId,
                    'nSlots' => $nSlotsFinal,
                    'durMin' => $durFinal,
                    'score' => $score,
                ];
            }
        }

        if ($best !== null) {
            return ['impId' => $best['impId'], 'nSlots' => $best['nSlots']];
        }

        // Pase de "saturar la jornada": ninguna materia con líquido > 0 cabe.
        // Buscar materias ya cubiertas (líquido ≤ 0) cuya cobertura tras
        // añadir un bloque mínimo no supere el 130% del target. Garantiza
        // que la jornada quede ocupada (sin huecos) sin inflar materias
        // pequeñas demasiado.
        $bestRatio = INF;
        $bestSat = null;
        foreach ($imps as $impId => $imp) {
            $colocadoHoyImp = $colocadosHoy[$impId] ?? 0;
            $capRestanteHoy = self::MAX_DIARIO_MIN_POR_MATERIA - $colocadoHoyImp;
            if ($capRestanteHoy < self::MIN_BLOQUE_MIN) continue;
            $target = $minutosTarget[$impId];
            if ($target <= 0) continue;
            $cubierto = $target - $liquido[$impId];
            $coberturaTrasAdd = ($cubierto + self::MIN_BLOQUE_MIN) / $target;
            if ($coberturaTrasAdd > 1.30) continue;
            $ratioActual = $cubierto / $target;
            if ($ratioActual >= $bestRatio) continue;

            // Verificar profe libre.
            $pid = $imp->getProfesor()?->getId();
            $nSlots = (int) (self::MIN_BLOQUE_MIN / max(1, $slotsLibres[0][2]));
            if ($nSlots * $slotsLibres[0][2] < self::MIN_BLOQUE_MIN) continue;
            if ($nSlots > count($slotsLibres)) continue;
            $libre = true;
            for ($i = 0; $i < $nSlots; $i++) {
                $key = $dia . '_' . $slotsLibres[$i][0];
                if ($pid !== null && (
                    (isset($profBusyLocal[$key]) && in_array($pid, $profBusyLocal[$key], true)) ||
                    (isset($parallelBusy[$key]) && in_array($pid, $parallelBusy[$key], true))
                )) {
                    $libre = false;
                    break;
                }
            }
            if (!$libre) continue;
            $bestRatio = $ratioActual;
            $bestSat = ['impId' => $impId, 'nSlots' => $nSlots];
        }
        return $bestSat;
    }

    /**
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

    /**
     * Calcula la ocupación de profesores en grupos paralelos del mismo centro
     * cuya jornada comparte el mismo `turno`. Espejo de
     * `HorarioSolver::buildParallelBusy()`.
     */
    private function buildParallelBusy(Grupo $grupo, ?TurnoJornada $turno): array
    {
        $centro = $grupo->getCentro();
        if (!$centro || $turno === null) return [];
        $grupos = $this->em->getRepository(Grupo::class)->findBy(['centro' => $centro]);
        $busy = [];
        $horarioRepo = $this->em->getRepository(Horario::class);
        foreach ($grupos as $g) {
            if ($g->getId() === $grupo->getId()) continue;
            $plOtro = $this->resolver->resolveActive($g);
            if ($plOtro === null) continue;
            $jOtro = $plOtro->getEffectiveJornadaTipo();
            if ($jOtro === null) continue;
            if ($jOtro->getTurno() !== $turno) continue;

            $horarios = $horarioRepo->createQueryBuilder('h')
                ->innerJoin('h.imparticion', 'i')
                ->andWhere('i.grupo = :grupo')
                ->andWhere('h.periodoLectivo = :pl')
                ->andWhere('h.deleted = false')
                ->setParameter('grupo', $g)
                ->setParameter('pl', $plOtro)
                ->getQuery()
                ->getResult();

            foreach ($horarios as $h) {
                $pid = $h->getImparticion()?->getProfesor()?->getId();
                if (!$pid) continue;
                $dia = $h->getDiaSemana();
                $hi = $h->getHoraInicio()?->format('H:i');
                if ($hi === null) continue;
                $busy[$dia . '_' . $hi][] = $pid;
            }
        }
        return $busy;
    }

    private function errorResult(string $msg): array
    {
        return [
            'complete' => false,
            'placements' => [],
            'unplaced' => [],
            'debug' => ['error' => $msg, 'algoritmo' => 'bin-packing-first-fit'],
        ];
    }
}
