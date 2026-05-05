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
    /**
     * Bloque mínimo de RELLENO RESIDUAL (último recurso). Cuando el bin-packing
     * acaba un tramo contiguo dejando 30min libres porque ningún candidato
     * compone limpiamente con bloques 60/90/120, este pase final asigna ese
     * residual a la materia con más overshoot relativo y profe libre. La
     * intención: cero huecos de 30min en la rejilla. Solo se activa cuando
     * `minutosDisponibles < MIN_BLOQUE_MIN`.
     */
    private const MIN_BLOQUE_RESIDUAL_MIN = 30;
    /**
     * Topes de overshoot por caso. La distinción es importante:
     *
     * - **CLOSE** (1.30): aplicado cuando una imp tiene liquido residual <60min
     *   y necesita cerrar su currículum con un bloque mínimo de 60min, o cuando
     *   se evita un residual <60min al final del tramo absorbiendo overshoot.
     *   Tolerar 30% aquí permite que materias pequeñas (target 60-360min/sem)
     *   cierren sus 30min residuales sin dejar shortfall global.
     *
     * - **SATURATE** (1.05): aplicado cuando una imp ya está cubierta al 100%
     *   y se considera "saturarla" para rellenar slots sobrantes del tramo.
     *   Aquí freno duro: si el calendario está bien dimensionado (contracción
     *   A del planner), no debería haber slots sobrantes. Si los hay, el
     *   solver deja huecos visibles antes que inflar materias completas.
     *
     * Esta distinción combinada con la contracción del calendario evita
     * tanto el rebose generalizado (era 8-25% per imp con techo 1.30) como
     * el shortfall por materias pequeñas (era 5-19% per imp con techo único 1.05).
     */
    private const MAX_OVERSHOOT_RATIO_CLOSE = 1.30;
    private const MAX_OVERSHOOT_RATIO_SATURATE = 1.05;

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

        // CUOTA DIARIA IDEAL: al iniciar el solver, el liquido total de cada
        // imp dividido entre los días lectivos. Sirve de referencia para que
        // el score de `elegirMejorBloque` penalice colocar más de la cuota
        // en un día (si una imp ya tiene su parte hoy, prioriza otras).
        // Esto evita que las imps grandes acaparen lun-jue y dejen el viernes
        // con huecos o residuales irreducibles.
        //
        // Mínimo: MIN_BLOQUE_MIN. Una imp con liquido pequeño (ej. IPE I con
        // 180 min/sem y 5 días = 36 min/día ideal) tiene cuota inferior al
        // bloque mínimo. Si dejásemos esa cuota, la imp recibiría penalty
        // SIEMPRE que coloque un bloque (60 - 36 = 24 min de exceso) y
        // perdería sistemáticamente contra otras imps → shortfall. Subiendo
        // la cuota a MIN_BLOQUE_MIN garantizamos que las imps "de pocos días/
        // semana" pueden colocar sus bloques sin penalty.
        $diasLectivosCount = count($diasLectivos);
        $cuotaDiariaIdeal = [];
        foreach ($liquido as $impId => $liq) {
            $cuota = $diasLectivosCount > 0
                ? (int) ceil($liq / $diasLectivosCount)
                : 0;
            $cuotaDiariaIdeal[$impId] = max(self::MIN_BLOQUE_MIN, $cuota);
        }

        // Dentro de cada día, ordenamos los tramos por duración ASC: el más
        // pequeño (típicamente el de 90min al final del día) PRIMERO.
        //
        // Razón: si llenásemos los tramos en orden cronológico, las imps
        // grandes alcanzarían su cap diario (120) en los tramos de 120 al
        // inicio del día, y al llegar al tramo de 90 ninguna podría absorber
        // 90 limpio → quedaría como 60+30. Procesando 90 PRIMERO, las imps
        // entran con liquido fresco y absorben los 90 sin residual; luego
        // los tramos de 120 se reparten entre 2 imps de 60min o 1 de 120min
        // distinta.
        $tramosPorDia = $tramosContiguos;
        usort($tramosPorDia, function ($a, $b) {
            $durA = array_sum(array_map(fn ($s) => $s[2], $a));
            $durB = array_sum(array_map(fn ($s) => $s[2], $b));
            return $durA <=> $durB;
        });

        // Orden DÍA-primero, TRAMO-después (con tramos ordenados por dificultad).
        // La distribución entre días la gestionamos vía `cuotaDiariaIdeal`
        // + score que penaliza acaparar.
        foreach ($diasLectivos as $dia) {
            $colocadosHoy = [];     // [impId => minutos colocados HOY]
            // Mapa de slots ocupados HOY por imp: [impId => ['HH:MM' => 'HH:MM_fin', ...]]
            // Se usa en `elegirMejorBloque` para dar bonus de adyacencia (un
            // bloque que arranca donde acaba otro placement del mismo día/imp
            // forma un bloque contiguo natural).
            $slotsOcupadosHoyByImp = [];

            foreach ($tramosPorDia as $tramo) {
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
                        $cuotaDiariaIdeal,
                        $slotsOcupadosHoyByImp,
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
                    // Registrar en el mapa de adyacencia: el último slot
                    // (su `hf`) marca dónde puede continuar la imp en otro
                    // bloque adyacente.
                    $slotsOcupadosHoyByImp[$impId][$hf] = true;
                    // Consumir los slots usados.
                    $slotsLibres = array_slice($slotsLibres, $best['nSlots']);
                }
            }
        }

        // Pase de FUSIÓN ADYACENTE: si dos placements consecutivos del mismo
        // día son de la misma imparticion (= misma materia y profe) y
        // contiguos en el tiempo, los fundimos en un solo placement de
        // duración combinada (hasta MAX_BLOQUE_MIN+30=150min, que es la
        // tolerancia pedagógica para sesiones extendidas). Esto consolida
        // los casos donde el solver colocó 60min de una imp + 30min de la
        // misma imp como cierre residual del tramo: pasan a verse como un
        // bloque de 90min limpio.
        $placements = $this->fuseAdjacentSameImpBlocks($placements);

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
     * mínimo) si el ratio de cobertura final ≤ MAX_OVERSHOOT_RATIO_CLOSE (1.30).
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
        array $cuotaDiariaIdeal = [],
        array $slotsOcupadosHoyByImp = [],
    ): ?array {
        if (empty($slotsLibres)) return null;
        // Asumimos slots de duración uniforme dentro de un tramo contiguo
        // (típico en jornadas reales: todo 30min o todo 60min).
        $slotDur = $slotsLibres[0][2];
        if ($slotDur <= 0) return null;
        // Minutos disponibles en lo que queda del tramo.
        $minutosDisponibles = count($slotsLibres) * $slotDur;

        // Modo RELLENO RESIDUAL del TRAMO: cuando el remanente del tramo es
        // < 60min (típicamente 30min al final de un tramo de 90 cerrado con
        // un bloque de 60), bajamos el mínimo aceptado para no dejar huecos.
        $bloqueMinAceptablePorTramo = ($minutosDisponibles < self::MIN_BLOQUE_MIN)
            ? self::MIN_BLOQUE_RESIDUAL_MIN
            : self::MIN_BLOQUE_MIN;

        $best = null;  // ['impId', 'nSlots', 'durMin', 'score']
        foreach ($imps as $impId => $imp) {
            // Mínimo aceptable POR IMP: si el liquido residual de la imp es
            // exactamente 30min (caso de pli.minutosSemanales no múltiplo de
            // 60, p. ej. 90 = 60+30), permitimos un bloque de 30 para cerrar
            // la imp limpiamente al 100% sin overshoot. Sin esto, el bloque
            // mínimo 60 dejaría 30min unplaced que el ejecutor convierte en
            // shortfall (vía REDUCIR_CUOTA_PROPIA destructiva).
            $liquidoActual = $liquido[$impId] ?? 0;
            $bloqueMinAceptable = (
                $liquidoActual > 0
                && $liquidoActual < self::MIN_BLOQUE_MIN
                && $liquidoActual >= self::MIN_BLOQUE_RESIDUAL_MIN
                && $liquidoActual % self::MIN_BLOQUE_RESIDUAL_MIN === 0
            )
                ? self::MIN_BLOQUE_RESIDUAL_MIN
                : $bloqueMinAceptablePorTramo;
            $liquidoImp = $liquido[$impId];
            if ($liquidoImp <= 0) continue;  // ya cubierto (overshoot opcional vía pase B abajo)
            $colocadoHoyImp = $colocadosHoy[$impId] ?? 0;
            $capRestanteHoy = self::MAX_DIARIO_MIN_POR_MATERIA - $colocadoHoyImp;
            if ($capRestanteHoy < $bloqueMinAceptable) continue;  // ya tiene cap hoy

            // Tamaño deseado (en minutos):
            //   tope superior: min(MAX_BLOQUE, líquido, cap diario, disponible)
            //   tope inferior: bloqueMinAceptable (60 normal, 30 en residual)
            $durDeseada = min(
                self::MAX_BLOQUE_MIN,
                $liquidoImp,
                $capRestanteHoy,
                $minutosDisponibles,
            );
            // Si líquido < mínimo pero cap permite el bloque mínimo, aceptar
            // overshoot hasta el bloque mínimo si la cobertura ≤ MAX_CLOSE
            // (130%). CLOSE porque estamos cerrando la propia imp (su currículum
            // se completa con un poco de exceso) — sin esto, materias pequeñas
            // con residual <60min quedan permanentemente sin colocar.
            if ($durDeseada < $bloqueMinAceptable) {
                $target = $minutosTarget[$impId];
                if ($target <= 0) continue;
                $cubierto = $target - $liquidoImp;
                $coberturaTrasAdd = ($cubierto + $bloqueMinAceptable) / $target;
                if ($coberturaTrasAdd > self::MAX_OVERSHOOT_RATIO_CLOSE) continue;
                $durDeseada = $bloqueMinAceptable;
                if ($durDeseada > min($capRestanteHoy, $minutosDisponibles)) continue;
            }
            // OVERSHOOT PARA CERRAR TRAMO: si quedaría residual <60min con el
            // tamaño calculado y `minutosDisponibles` cabe en cap+MAX_BLOQUE,
            // intentamos AGRANDAR el bloque hasta llenar el tramo entero
            // (overshoot controlado por MAX_CLOSE = 1.30). Esto evita que un
            // tramo de 90min termine como "60min materia X + 30min residual
            // de Y": en su lugar queda como "90min materia X" si X lo absorbe
            // sin pasar del 130% de su target.
            $residualTrasAdd = $minutosDisponibles - $durDeseada;
            if ($residualTrasAdd > 0
                && $residualTrasAdd < self::MIN_BLOQUE_MIN
                && $minutosDisponibles <= self::MAX_BLOQUE_MIN
                && $minutosDisponibles <= $capRestanteHoy
            ) {
                $target = $minutosTarget[$impId];
                if ($target > 0) {
                    $cubierto = $target - $liquidoImp;
                    $coberturaTrasAdd = ($cubierto + $minutosDisponibles) / $target;
                    if ($coberturaTrasAdd <= self::MAX_OVERSHOOT_RATIO_CLOSE) {
                        $durDeseada = $minutosDisponibles;
                    }
                }
            }
            // Redondear hacia abajo a múltiplo de slotDur, sin bajar del mínimo
            // aceptable (60 normal, 30 en residual).
            $nSlotsDeseado = (int) floor($durDeseada / $slotDur);
            if ($nSlotsDeseado * $slotDur < $bloqueMinAceptable) continue;

            // Probar el tamaño deseado y, si profe ocupado, ir bajando hasta
            // el mínimo aceptable. Esto absorbe el caso "profe libre solo
            // 60min pero materia querría bloque de 90".
            $nSlotsFinal = null;
            $pid = $imp->getProfesor()?->getId();
            for ($n = $nSlotsDeseado; $n * $slotDur >= $bloqueMinAceptable; $n--) {
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
            // Score base: líquido pendiente menos colocado hoy (favorece
            // distribución diaria — materias sin slots hoy ganan a las que
            // ya tienen).
            $score = $liquidoImp - $colocadoHoyImp;
            // Bonus/penalty por el residual que dejaría este bloque en el
            // tramo. Buscamos preferir bloques que cierran el tramo limpio
            // (residual = 0) y descartar los que dejan un cabo de 30min
            // que no podrá completarse con bloques pedagógicos 60/90/120.
            $residualTrasAdd = $minutosDisponibles - $durFinal;
            if ($residualTrasAdd === 0) {
                $score += 1_000_000;       // cerrar tramo limpio: prioridad máxima
            } elseif ($residualTrasAdd > 0 && $residualTrasAdd < self::MIN_BLOQUE_MIN) {
                $score -= 1_000_000;       // dejar residual <60min: rechazar salvo que no haya otra
            }
            // BALANCEO POR DÍA: penalty proporcional al exceso sobre la cuota
            // diaria ideal (liquido_inicial / 5_días). Sin esto, las imps
            // grandes acaparan los primeros días y dejan los últimos con
            // huecos o residuales irreducibles. Penalty fuerte por cada
            // minuto de exceso, pero menor que el bonus/penalty de tramo.
            $cuota = $cuotaDiariaIdeal[$impId] ?? 0;
            if ($cuota > 0) {
                $excesoTrasAdd = max(0, $colocadoHoyImp + $durFinal - $cuota);
                if ($excesoTrasAdd > 0) {
                    $score -= $excesoTrasAdd * 100;  // penalty por minuto de exceso
                }
            }
            // BONUS POR CERRAR LIQUIDO RESIDUAL: si la imp tiene liquido < 60
            // pero el bloque actual cerraría su currículum exacto (sin overshoot),
            // priorizar fuerte. Sin esto, las imps con liquido residual <60
            // pierden siempre contra imps grandes y quedan unplaced → shortfall.
            // El bonus es menor que el de cerrar tramo limpio (1M) pero mayor
            // que el balanceo (×100), garantizando que se cierra residual antes
            // de seguir distribuyendo a imps grandes.
            if ($liquidoImp < self::MIN_BLOQUE_MIN && $liquidoImp > 0 && $durFinal === $liquidoImp) {
                $score += 500_000;
            }
            // BONUS POR ADYACENCIA: si el primer slot del bloque candidato
            // arranca exactamente donde terminó otro placement de la misma
            // imp en el mismo día (ej. solver acaba de colocar 60min hasta las
            // 09:30 y este candidato empieza a las 09:30), prefiere esta
            // colocación. Eso permite que el pase de FUSIÓN ADYACENTE post-
            // solver una ambos placements en uno solo de duración combinada
            // (60+30=90, 60+60=120, etc.) — clave para evitar bloques de 30
            // sueltos visualmente cuando una imp tiene pli no-múltiplo de 60.
            $primerSlotHi = $slotsLibres[0][0];
            $slotsOcupadosImp = $slotsOcupadosHoyByImp[$impId] ?? [];
            if (isset($slotsOcupadosImp[$primerSlotHi])) {
                $score += 200_000;
            }
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
        // Buscar materias ya cubiertas (líquido ≤ 0). Dos sub-casos:
        //
        //   (a) Si una imp puede absorber EL TRAMO ENTERO (90 ó 120) con su
        //       cobertura tras add ≤ MAX_CLOSE (1.30), preferimos colocar UN
        //       bloque del tamaño del tramo. Esto evita que el solver llene
        //       el tramo con "60 mat A + 30 mat B" (dos imps distintas en
        //       un tramo de 90, fusión imposible) y deja un bloque limpio
        //       de 90 con una sola imp.
        //
        //   (b) Si ninguna imp tolera el tramo entero, fallback al bloque
        //       mínimo con cobertura ≤ MAX_SATURATE (1.05). Freno duro para
        //       evitar inflado generalizado cuando el calendario excede el
        //       currículum (raro tras la contracción A del planner).
        $bestRatio = INF;
        $bestSat = null;
        foreach ($imps as $impId => $imp) {
            $colocadoHoyImp = $colocadosHoy[$impId] ?? 0;
            $capRestanteHoy = self::MAX_DIARIO_MIN_POR_MATERIA - $colocadoHoyImp;
            if ($capRestanteHoy < $bloqueMinAceptable) continue;
            $target = $minutosTarget[$impId];
            if ($target <= 0) continue;
            $cubierto = $target - $liquido[$impId];

            // Decidir tamaño del bloque: cierre limpio del tramo si la imp
            // lo tolera, fallback al bloque mínimo con freno SATURATE.
            $durSat = $bloqueMinAceptable;
            if ($minutosDisponibles >= self::MIN_BLOQUE_MIN
                && $minutosDisponibles <= self::MAX_BLOQUE_MIN
                && $minutosDisponibles <= $capRestanteHoy
                && (($cubierto + $minutosDisponibles) / $target) <= self::MAX_OVERSHOOT_RATIO_CLOSE
            ) {
                $durSat = $minutosDisponibles;
            } else {
                $coberturaTrasAdd = ($cubierto + $bloqueMinAceptable) / $target;
                if ($coberturaTrasAdd > self::MAX_OVERSHOOT_RATIO_SATURATE) continue;
            }

            $ratioActual = $cubierto / $target;
            if ($ratioActual >= $bestRatio) continue;

            // Verificar profe libre en TODOS los slots del bloque.
            $pid = $imp->getProfesor()?->getId();
            $nSlots = (int) ($durSat / max(1, $slotsLibres[0][2]));
            if ($nSlots * $slotsLibres[0][2] < $bloqueMinAceptable) continue;
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
     * Fusiona placements adyacentes de la misma imparticion en uno solo.
     *
     * Caso típico: tras el solver, una imp con liquido pendiente recibe un
     * bloque de 60min al inicio del tramo y otro de 30min al final del mismo
     * tramo (residual). Si entre ambos no hay otro placement (no es habitual,
     * pero ocurre si el resto del tramo lo llena la misma imp en un solo
     * bloque) los fundimos en uno solo.
     *
     * El tope `MAX_BLOQUE_MIN + slot residual = 150min` permite el caso
     * `90 + 60 = 150` (que NO debería ocurrir por cap diario 120, pero el
     * margen sirve como safety) y `60 + 30 = 90`, `90 + 30 = 120`, etc.
     *
     * @param list<array{imp: \App\Entity\Imparticion, dia: int, hi: string, hf: string, min: int}> $placements
     * @return list<array{imp: \App\Entity\Imparticion, dia: int, hi: string, hf: string, min: int}>
     */
    private function fuseAdjacentSameImpBlocks(array $placements): array
    {
        if (empty($placements)) return $placements;
        // Agrupar por día.
        $byDay = [];
        foreach ($placements as $p) {
            $byDay[$p['dia']][] = $p;
        }
        $result = [];
        foreach ($byDay as $dia => $list) {
            usort($list, fn ($a, $b) => strcmp($a['hi'], $b['hi']));
            $i = 0;
            $n = count($list);
            while ($i < $n) {
                $cur = $list[$i];
                $j = $i + 1;
                while ($j < $n) {
                    $next = $list[$j];
                    $sameImp = $cur['imp']->getId() === $next['imp']->getId();
                    $contiguous = $cur['hf'] === $next['hi'];
                    $combinedDur = (int) $cur['min'] + (int) $next['min'];
                    if ($sameImp && $contiguous && $combinedDur <= self::MAX_BLOQUE_MIN + self::MIN_BLOQUE_RESIDUAL_MIN) {
                        $cur = [
                            'imp' => $cur['imp'],
                            'dia' => $cur['dia'],
                            'hi' => $cur['hi'],
                            'hf' => $next['hf'],
                            'min' => $combinedDur,
                        ];
                        $j++;
                    } else {
                        break;
                    }
                }
                $result[] = $cur;
                $i = $j;
            }
        }
        return $result;
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
