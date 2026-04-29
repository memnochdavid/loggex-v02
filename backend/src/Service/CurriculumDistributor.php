<?php

namespace App\Service;

use App\Entity\Grupo;
use App\Entity\Imparticion;
use App\Entity\PeriodoLectivo;
use App\Entity\TipoTramo;
use Doctrine\ORM\EntityManagerInterface;

/**
 * Distribuye horas curriculares entre rangos lectivos respetando jornada y currículo.
 *
 * **Principio "tiempos fluidos"** (consenso usuario, doc Fase 5 §Visión):
 * - La jornada del centro NO es discutible (la del PL activo de cada rango).
 * - `Materia.horasTotales` NO es discutible (ley LOMLOE/BOE/BOJA).
 * - El **calendario** ES la variable: si jornada × semanas calendario no
 *   llega al currículo, el sistema sugiere extender `Grupo.fechaFin`.
 *
 * **Algoritmo slot-discreto** (rev 2026-04-29 segunda iteración):
 * Trabaja en unidades discretas de "slot-occurrences por semana en un rango"
 * (K_ij entero ≥ 0). Cada slot-occurrence en rango j aporta `slotMin_j × sem_j`
 * minutos anuales. Asigna slots greedy a las materias en orden de objetivo
 * descendente, eligiendo siempre el rango con más slots/sem libres. Garantiza:
 *
 *   - Para cada materia: Σ_j K_ij × slotMin_j × sem_j ≥ horasTotales_i × 60
 *     (cubre o sobrepasa por D22=A round-up, overshoot < slotMin × sem)
 *   - Para cada rango: Σ_i K_ij ≤ capSlots_j (no satura jornada)
 *
 * Si `Σ horasTotales > Σ_j cap_j × sem_j` (capacidad anual insuficiente),
 * devuelve `extendBy` proporcional al déficit (días naturales). Si tras
 * asignar greedy queda alguna materia sin cubrir (capacidad agotada),
 * idem.
 *
 * Doc: docs/hoja-de-ruta-periodos-lectivos.md §6 (bitácora 2026-04-29 rev2).
 */
class CurriculumDistributor
{
    public function __construct(private EntityManagerInterface $em)
    {
    }

    /**
     * @return array{
     *   feasible: bool,
     *   extendBy: int,
     *   reason: ?string,
     *   distribution: array<int, array<int, int>>,
     *   shortfalls: array<int, int>,
     *   debug: array<string, mixed>
     * }
     */
    public function distribute(Grupo $grupo): array
    {
        $pls = $this->em->getRepository(PeriodoLectivo::class)
            ->createQueryBuilder('pl')
            ->andWhere('pl.grupo = :g')
            ->andWhere('pl.deleted = false')
            ->setParameter('g', $grupo)
            ->orderBy('pl.fechaInicio', 'ASC')
            ->getQuery()
            ->getResult();

        if (empty($pls)) {
            return $this->errorResult('Grupo sin PeriodoLectivos.');
        }

        // Meta-info por rango: cap_j (min/sem aprovechables), slotMin_j, sem_j (semanas enteras),
        // capRest_j (minutos anuales libres = cap_j × sem_j al inicio).
        $plMeta = [];
        $lastCap = 0;
        $lastPlId = null;
        foreach ($pls as $pl) {
            $jornada = $pl->getEffectiveJornadaTipo();
            if ($jornada === null) {
                return $this->errorResult(sprintf('PL #%d sin jornada efectiva.', $pl->getId()));
            }
            $diasLectivos = $jornada->getDiasLectivos() ?: [1, 2, 3, 4, 5];
            $diasCount = count($diasLectivos);
            $slotDurations = [];
            $capPorDia = 0;
            foreach ($jornada->getTramos() as $tramo) {
                if ($tramo->getTipo() !== TipoTramo::SLOT) continue;
                $hi = $tramo->getHoraInicio();
                $hf = $tramo->getHoraFin();
                if ($hi === null || $hf === null) continue;
                $dur = ((int) $hf->format('H')) * 60 + (int) $hf->format('i')
                     - (((int) $hi->format('H')) * 60 + (int) $hi->format('i'));
                if ($dur <= 0) continue;
                $slotDurations[] = $dur;
                $capPorDia += $dur;
            }
            if (empty($slotDurations)) {
                return $this->errorResult(sprintf('PL #%d sin slots colocables.', $pl->getId()));
            }
            // slotMin_j: el slot más pequeño (granularidad de los m_ij del rango).
            // Las materias asumen múltiplos de slotMin_j en su minutosSemanales.
            $slotMin = min($slotDurations);
            $cap = $capPorDia * $diasCount;
            $semanas = $this->calcularSemanasEnteras($pl);
            if ($semanas < 1) {
                return $this->errorResult(sprintf('PL #%d con < 1 semana.', $pl->getId()));
            }
            // (semanasEnteras solo se usa para el sanity check >= 1 sem)
            // Slots aprovechables/sem = nº slots reales × días lectivos.
            // (Antes: intdiv(cap, slotMin), pero esto sobreestimaba cuando hay
            // slots de duración mixta — ej jornada 4×60+1×90/día = 25 slots
            // reales/sem, no 27 como daba la división.)
            $capSlotsPorSem = count($slotDurations) * $diasCount;
            // Semanas FRACCIONALES (días/7) — refleja las ocurrencias reales
            // del día_semana que el solver físico contará. Antes usaba
            // round(días/7) entero, pero eso sobreestimaba un rango con 88
            // días (12.57 sem reales) al pedir K basados en 13 sem → predicción
            // sobre rangos extendidos (18 vs 17.57) causaba overshoot/shortfall
            // dependiendo del signo del round.
            $semanasFrac = $this->calcularSemanasFraccionales($pl);
            // capMin TARGET = capSlotsPorSem × slotMin (no cap_total). Esto
            // controla el número de PLACEMENTS físicos que el solver puede
            // colocar respetando combos delta=0. Para FP Mañanas (4×60+1×90):
            //   - cap_total = 1650 min, capSlotsPorSem = 25, slotMin = 60.
            //   - capMinTarget = 25 × 60 = 1500 min.
            //   - 150 min residuales (= slot de 90 fuera del target).
            // El solver físico puede usar el slot de 90 si encuentra combo
            // delta=0 (ej: target 240 = 1×60+2×90=240, libera 1 placement).
            // Pero el distribuidor NO sobre-asigna cuotas para llenar 1650 →
            // evita unplaced cuando el solver no encuentra combos.
            $capMinTarget = $capSlotsPorSem * $slotMin;
            $plMeta[$pl->getId()] = [
                'pl' => $pl,
                'cap' => $cap,                              // min/sem cap real (jornada slots)
                'capTarget' => $capMinTarget,               // min/sem target del distribuidor
                'slotMin' => $slotMin,                      // granularidad
                'capSlotsPorSem' => $capSlotsPorSem,
                'semanas' => $semanasFrac,
                'aporteSlot' => $slotMin * $semanasFrac,
                'capMinLibres' => $capMinTarget,            // min libres respecto al target
            ];
            $lastCap = $cap;
            $lastPlId = $pl->getId();
        }

        // Imparticiones presenciales del grupo.
        $impsAll = $this->em->getRepository(Imparticion::class)
            ->findBy(['grupo' => $grupo, 'deleted' => false]);
        $impsPres = [];
        foreach ($impsAll as $imp) {
            if ($imp->isDeleted()) continue;
            if (!$imp->getEffectiveModalidad()->consumeAula()) continue;
            $materia = $imp->getMateria();
            if ($materia === null) continue;
            $objetivo = $materia->getObjetivoAnualMinutos();
            if ($objetivo <= 0) continue;
            $impsPres[$imp->getId()] = [
                'imp' => $imp,
                'objetivo' => $objetivo,
                'restante' => $objetivo,             // min anuales por colocar
                'nombre' => $materia->getNombre() ?? '?',
            ];
        }

        if (empty($impsPres)) {
            return [
                'feasible' => true,
                'extendBy' => 0,
                'reason' => null,
                'distribution' => array_fill_keys(array_keys($plMeta), []),
                'shortfalls' => [],
                'debug' => ['note' => 'Grupo sin imparticiones presenciales.'],
            ];
        }

        // Capacity check anual.
        $capAnual = 0;
        foreach ($plMeta as $meta) {
            $capAnual += $meta['cap'] * $meta['semanas'];
        }
        $sumObjetivos = 0;
        foreach ($impsPres as $row) {
            $sumObjetivos += $row['objetivo'];
        }

        if ($capAnual < $sumObjetivos) {
            $deficit = $sumObjetivos - $capAnual;
            // +1 sem de margen para evitar oscilación per-materia (el round-up
            // del distribuidor causa overshoot ≤ aporteSlot en algunas; sin
            // margen el extend sólo cubre exacto el déficit y nuevas
            // distribuciones siguen viéndose justas).
            $extendSem = $lastCap > 0 ? ((int) ceil($deficit / $lastCap)) + 1 : 1;
            return [
                'feasible' => false,
                'extendBy' => max(7, $extendSem * 7),
                'reason' => 'capacityShortfall',
                'distribution' => array_fill_keys(array_keys($plMeta), []),
                'shortfalls' => array_map(fn ($r) => $r['objetivo'], $impsPres),
                'debug' => [
                    'capAnualMin' => $capAnual,
                    'sumObjetivosMin' => $sumObjetivos,
                    'deficitMin' => $deficit,
                    'extendSemanas' => $extendSem,
                ],
            ];
        }

        // Inicializar matriz K (slot-occurrences/sem por rango y materia).
        $K = [];
        foreach ($plMeta as $plId => $_) {
            $K[$plId] = [];
            foreach ($impsPres as $impId => $_) {
                $K[$plId][$impId] = 0;
            }
        }

        // Distribución slot-discreto con **round-UP estricto per materia**:
        //
        // Filosofía (consenso 2026-04-29): el solver físico (CapacityPlanner +
        // backtracking) ahora prefiere combos con delta=0 (penalty fuerte por
        // delta>0). Esto significa que si el distribuidor pide 180 min/sem, el
        // solver coloca 180 exactos cuando puede. Por tanto, el distribuidor
        // **debe pedir cuotas que ya garanticen ≥ 100% por materia**: no puede
        // confiar en que el solver "redondee al alza" como antes.
        //
        // Algoritmo:
        // 1. Para cada materia (orden por menor número de slots necesarios →
        //    asegura que las pequeñas como DIG reciban su cuota antes de
        //    que las grandes consuman toda la capacidad):
        //    - Asignar slots greedy al rango con MÁS holgura mientras
        //      `restante > 0`. Cada slot añade `aporteSlot_j` minutos.
        //    - Cuando `restante ≤ 0`, la materia está cubierta (overshoot
        //      ≤ aporteSlot máximo de un solo slot, ≤ 1.5h típicamente).
        //
        // 2. Si alguna materia se queda con `restante > 0` (capacidad agotada
        //    sin cubrir): devolver `extendBy` proporcional al mayor faltante.
        //    El frontend extiende y reintenta.
        //
        // Orden ASC por slots necesarios = priorizar pequeñas. Las grandes
        // van al final con la capacidad restante. Si las grandes saturan
        // antes de cubrirse: shortfall y extender. Resultado: nadie queda
        // sin asignar (no más DIG=0 ni IPEI1=0).
        $impIdsOrdenados = array_keys($impsPres);
        // Usar el aporteSlot promedio para estimar slots necesarios.
        $aporteSlotPromedio = 0;
        foreach ($plMeta as $meta) $aporteSlotPromedio += $meta['aporteSlot'];
        $aporteSlotPromedio = count($plMeta) > 0 ? $aporteSlotPromedio / count($plMeta) : 1;
        usort($impIdsOrdenados, function ($a, $b) use ($impsPres, $aporteSlotPromedio) {
            $slotsA = (int) ceil($impsPres[$a]['objetivo'] / max(1, $aporteSlotPromedio));
            $slotsB = (int) ceil($impsPres[$b]['objetivo'] / max(1, $aporteSlotPromedio));
            return $slotsA <=> $slotsB; // ASC: menos slots primero
        });

        // Pase 1: cubrir currículo curricular per materia (orden ASC slots
        // necesarios). Greedy con criterio "overshoot mínimo": cada slot va
        // al rango cuya aporte está más cerca del faltante restante.
        foreach ($impIdsOrdenados as $impId) {
            $iter = 0;
            while ($impsPres[$impId]['restante'] > 0 && $iter++ < 2000) {
                $bestPlId = null;
                $bestOvershoot = PHP_INT_MAX;
                $bestLibres = -1;
                $rest = $impsPres[$impId]['restante'];
                foreach ($plMeta as $plId => $meta) {
                    if ($meta['capMinLibres'] < $meta['slotMin']) continue;
                    $overshoot = max(0, $meta['aporteSlot'] - $rest);
                    if ($overshoot < $bestOvershoot
                        || ($overshoot === $bestOvershoot && $meta['capMinLibres'] > $bestLibres)) {
                        $bestOvershoot = $overshoot;
                        $bestLibres = $meta['capMinLibres'];
                        $bestPlId = $plId;
                    }
                }
                if ($bestPlId === null) break;
                if ($bestOvershoot > $rest) break;
                $K[$bestPlId][$impId] += 1;
                $plMeta[$bestPlId]['capMinLibres'] -= $plMeta[$bestPlId]['slotMin'];
                $impsPres[$impId]['restante'] -= $plMeta[$bestPlId]['aporteSlot'];
            }
        }

        // Pase 2: SATURAR JORNADA. Tras cubrir currículo, llenar los slots
        // vacíos de cada rango con la materia menos cubierta relativamente.
        // Garantiza que el chip "Borrador 23/27.5h" se vuelve "Completo 27/27.5h"
        // (ningún slot vacío).
        //
        // Criterio: para cada slot libre, asignarlo a la materia con MENOR
        // cobertura relativa actual (= Σ K_ij × slotMin / objetivo_i). Eso
        // distribuye el sobrante entre todas las materias proporcionalmente
        // (las menos cubiertas reciben más). Tope: cada materia puede llegar
        // máximo a 130% de su objetivo (evita over-asignar a una sola).
        $coberturaMaxPase2 = 1.30;
        $cubiertoByImp = [];
        foreach ($impsPres as $impId => $row) {
            $cubierto = 0;
            foreach ($plMeta as $plId => $meta) {
                $cubierto += $K[$plId][$impId] * $meta['aporteSlot'];
            }
            $cubiertoByImp[$impId] = $cubierto;
        }
        foreach ($plMeta as $plId => $_) {
            $iter = 0;
            // Saturar HASTA cap_j_min, no count: la jornada FP Mañanas con
            // 4×60+1×90 tiene cap=1650 min pero solo 25 placements. Si paramos
            // a 25 slots, dejamos 150 min sin asignar (slots vacíos en la
            // rejilla). Saturando por min, el solver físico coloca el slot
            // de 90 con una materia que tenga cuota total múltiplo de 60.
            while ($plMeta[$plId]['capMinLibres'] >= $plMeta[$plId]['slotMin'] && $iter++ < 200) {
                $bestImp = null;
                $bestCobertura = PHP_INT_MAX;
                foreach ($impsPres as $impId => $row) {
                    if ($row['objetivo'] <= 0) continue;
                    // Chequear cobertura TRAS añadir el slot, no antes. Para
                    // materias pequeñas (DIG 36h), un solo slot puede hacer
                    // saltar la cobertura del 110% al 140% — peor que no
                    // añadir nada. Si tras añadir supera el tope, skip.
                    $coberturaTrasAdd = ($cubiertoByImp[$impId] + $plMeta[$plId]['aporteSlot']) / $row['objetivo'];
                    if ($coberturaTrasAdd > $coberturaMaxPase2) continue;
                    $coberturaActual = $cubiertoByImp[$impId] / $row['objetivo'];
                    if ($coberturaActual < $bestCobertura) {
                        $bestCobertura = $coberturaActual;
                        $bestImp = $impId;
                    }
                }
                if ($bestImp === null) break;
                $K[$plId][$bestImp] += 1;
                $plMeta[$plId]['capMinLibres'] -= $plMeta[$plId]['slotMin'];
                $cubiertoByImp[$bestImp] += $plMeta[$plId]['aporteSlot'];
            }
        }

        // Verificar shortfalls. Tolerancia per-materia = max(60 min, 5% del
        // objetivo) — el solver físico cuenta ocurrencias enteras del día_semana
        // que puede ser +/-1 vs sem fraccional, compensando undershoots
        // pequeños. Sin tolerancia, el algoritmo greedy con "stop si overshoot
        // > rest" oscila infinitamente: cada extender redistribuye y materias
        // DIFERENTES quedan con undershoot residual (43-326 min), por lo que
        // nunca converge a feasible aunque la capacidad anual sí cubra el
        // currículo.
        $shortfalls = [];
        foreach ($impsPres as $impId => $row) {
            $tolerancia = max(60, (int) ($row['objetivo'] * 0.05));
            if ($row['restante'] > $tolerancia) {
                $shortfalls[$impId] = (int) ceil($row['restante']);
            }
        }

        if (!empty($shortfalls)) {
            // Ningún rango tiene capacidad y hay materias sin cubrir → extender curso.
            // Calculamos por la MAYOR shortfall individual + 1 sem margen, no
            // por la suma — el cap del último rango se aplica per-materia, no
            // global. Sumar todos los shortfalls infraestima el extend cuando
            // hay 1 materia gigante (ej Programación 100h) y otras pequeñas.
            $maxShortfall = max($shortfalls);
            $extendSem = $lastCap > 0 ? ((int) ceil($maxShortfall / $lastCap)) + 1 : 1;
            $totalShortfall = array_sum($shortfalls);
            // Build distribution con lo que sí se asignó (parcial).
            $distribucion = [];
            foreach ($K as $plId => $row) {
                $distribucion[$plId] = [];
                foreach ($row as $impId => $k) {
                    $distribucion[$plId][$impId] = $k * $plMeta[$plId]['slotMin'];
                }
            }
            return [
                'feasible' => false,
                'extendBy' => max(7, $extendSem * 7),
                'reason' => 'redistributionShortfall',
                'distribution' => $distribucion,
                'shortfalls' => $shortfalls,
                'debug' => [
                    'totalShortfallMin' => $totalShortfall,
                    'extendSemanas' => $extendSem,
                    'shortfallsByMateria' => array_map(
                        fn ($s, $impId) => ['materia' => $impsPres[$impId]['nombre'], 'min' => $s],
                        $shortfalls,
                        array_keys($shortfalls)
                    ),
                ],
            ];
        }

        // Convertir K a minutosSemanales: m_ij = K_ij × slotMin_j.
        $distribucion = [];
        $debugCobertura = [];
        foreach ($K as $plId => $row) {
            $distribucion[$plId] = [];
            foreach ($row as $impId => $k) {
                $distribucion[$plId][$impId] = $k * $plMeta[$plId]['slotMin'];
            }
        }
        // Reporte por materia: minutos colocados (con overshoot por round-up D22=A).
        foreach ($impsPres as $impId => $row) {
            $colocado = 0;
            foreach ($plMeta as $plId => $meta) {
                $colocado += $distribucion[$plId][$impId] * $meta['semanas'];
            }
            $debugCobertura[$row['nombre']] = [
                'objetivoMin' => $row['objetivo'],
                'colocadoMin' => $colocado,
                'overshootMin' => $colocado - $row['objetivo'],
            ];
        }

        return [
            'feasible' => true,
            'extendBy' => 0,
            'reason' => null,
            'distribution' => $distribucion,
            'shortfalls' => [],
            'debug' => [
                'capAnualMin' => $capAnual,
                'sumObjetivosMin' => $sumObjetivos,
                'rangosCount' => count($plMeta),
                'materiasPresenciales' => count($impsPres),
                'cobertura' => $debugCobertura,
            ],
        ];
    }

    /**
     * Semanas enteras del rango — solo usado para sanity check (>= 1 sem).
     */
    private function calcularSemanasEnteras(PeriodoLectivo $pl): int
    {
        $i = $pl->getFechaInicio();
        $f = $pl->getFechaFin();
        if ($i === null || $f === null) return 0;
        $diff = $i->diff($f);
        $dias = ((int) $diff->days) + 1;
        return max(1, (int) round($dias / 7));
    }

    /**
     * Semanas fraccionales del rango: `(fechaFin - fechaInicio + 1) / 7.0`.
     * Refleja las ocurrencias reales del día_semana que contará el solver
     * físico (que opera en placements semanales recurrentes per día_semana).
     * El distribuidor usa este valor en `aporteSlot = slotMin × sem` para
     * predecir minutos anuales con precisión.
     */
    private function calcularSemanasFraccionales(PeriodoLectivo $pl): float
    {
        $i = $pl->getFechaInicio();
        $f = $pl->getFechaFin();
        if ($i === null || $f === null) return 0.0;
        $diff = $i->diff($f);
        $dias = ((int) $diff->days) + 1;
        return $dias / 7.0;
    }

    private function errorResult(string $msg): array
    {
        return [
            'feasible' => false,
            'extendBy' => 0,
            'reason' => 'error',
            'distribution' => [],
            'shortfalls' => [],
            'debug' => ['error' => $msg],
        ];
    }
}
