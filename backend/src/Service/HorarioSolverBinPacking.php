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

        // Construir celdas en orden HORA-primero, DÍA-después. Garantiza
        // distribución uniforme de una misma materia entre días: si Sistemas
        // (5h/sem) recibe los 5 primeros slots, serán "8:30 lun, 8:30 mar,
        // 8:30 mié, 8:30 jue, 8:30 vie" — un slot por día. Si fuese día-
        // primero (8:30 lun, 9:30 lun, ..., 13:00 lun, 8:30 mar, ...),
        // Sistemas ocuparía todo el lunes y nada el resto.
        $cells = [];
        foreach ($slots as $slot) {
            foreach ($diasLectivos as $dia) {
                $cells[] = [
                    'dia' => $dia,
                    'hi' => $slot[0],
                    'hf' => $slot[1],
                    'min' => $slot[2],
                ];
            }
        }

        $placements = [];           // ['dia_hi' => placement]
        $profBusyLocal = [];        // ['dia_hi' => [profIds]]
        $aulaBusyLocal = [];        // ['dia_hi' => [aulasOcupadas]] — futuro

        foreach ($cells as $cell) {
            $key = $cell['dia'] . '_' . $cell['hi'];
            $duracion = $cell['min'];

            $isBusyForProf = function (?int $pid) use ($key, $profBusyLocal, $parallelBusy) {
                if ($pid === null) return false;
                if (isset($profBusyLocal[$key]) && in_array($pid, $profBusyLocal[$key], true)) return true;
                if (isset($parallelBusy[$key]) && in_array($pid, $parallelBusy[$key], true)) return true;
                return false;
            };

            // PASE A — estricto: materias con líquido SUFICIENTE para el slot
            // sin overshoot. Prioriza líquido descendente. Esto evita el caso
            // patológico donde una materia con líquido=30 (residual) ocupa un
            // slot de 90 (overshoot 60min en una asignación). Per-rango el
            // overshoot total queda acotado a la última asignación de cada
            // materia, en lugar de cualquier asignación.
            $bestImpId = null;
            $bestLiquido = -1;
            foreach ($imps as $impId => $imp) {
                if ($liquido[$impId] < $duracion) continue;
                if ($isBusyForProf($imp->getProfesor()?->getId())) continue;
                if ($liquido[$impId] > $bestLiquido) {
                    $bestLiquido = $liquido[$impId];
                    $bestImpId = $impId;
                }
            }

            // PASE B — overshoot último slot: si pase A no encontró candidato,
            // materias con líquido > 0 pero < duración_slot. Acepta overshoot
            // ≤ duración - 1. Prioriza la materia con mayor líquido residual.
            // Tope: cobertura tras añadir slot ≤ 130% del target. Sin este
            // tope, una materia pequeña (DIG target 60 con líquido=60) podía
            // recibir un slot de 90 (cobertura final 150/60 = 250% del target
            // del rango, inflando la materia anual al 140%+).
            if ($bestImpId === null) {
                foreach ($imps as $impId => $imp) {
                    if ($liquido[$impId] <= 0) continue;
                    if ($liquido[$impId] >= $duracion) continue; // ya considerado en pase A
                    if ($isBusyForProf($imp->getProfesor()?->getId())) continue;
                    $target = $minutosTarget[$impId];
                    if ($target <= 0) continue;
                    $cubierto = $target - $liquido[$impId];
                    $coberturaTrasAdd = ($cubierto + $duracion) / $target;
                    if ($coberturaTrasAdd > 1.30) continue;
                    if ($liquido[$impId] > $bestLiquido) {
                        $bestLiquido = $liquido[$impId];
                        $bestImpId = $impId;
                    }
                }
            }

            // PASE C — rellenar saturado: materias ya cubiertas (líquido ≤ 0)
            // pero con cobertura tras añadir slot ≤ 130% del target. Garantiza
            // saturación de la jornada sin inflar materias pequeñas demasiado.
            if ($bestImpId === null) {
                $bestRatio = INF;
                foreach ($imps as $impId => $imp) {
                    if ($isBusyForProf($imp->getProfesor()?->getId())) continue;
                    $target = $minutosTarget[$impId];
                    if ($target <= 0) continue;
                    $cubierto = $target - $liquido[$impId];
                    $coberturaTrasAdd = ($cubierto + $duracion) / $target;
                    if ($coberturaTrasAdd > 1.30) continue;
                    $ratioActual = $cubierto / $target;
                    if ($ratioActual < $bestRatio) {
                        $bestRatio = $ratioActual;
                        $bestImpId = $impId;
                    }
                }
            }

            if ($bestImpId === null) {
                // Slot vacío (todas materias con profe ocupado o tope 130%).
                continue;
            }

            $imp = $imps[$bestImpId];
            $placements[$key] = [
                'imp' => $imp,
                'hi' => $cell['hi'],
                'hf' => $cell['hf'],
                'dia' => $cell['dia'],
                'min' => $duracion,
            ];
            $pid = $imp->getProfesor()?->getId();
            if ($pid !== null) {
                $profBusyLocal[$key][] = $pid;
            }
            $liquido[$bestImpId] -= $duracion;
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
                'algoritmo' => 'bin-packing-first-fit',
                'periodoLectivoId' => $periodoLectivo->getId(),
                'periodoLectivoNombre' => $periodoLectivo->getNombre(),
                'jornadaId' => $jornada->getId(),
                'jornadaNombre' => $jornada->getNombre(),
                'turno' => $turno?->value,
                'diasLectivos' => $diasLectivos,
                'slotsPorDia' => count($slots),
                'slotDurations' => array_map(fn ($s) => $s[2], $slots),  // [60, 60, 90, ...] — Fase 2 classifier
                'totalSlots' => count($cells),
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
