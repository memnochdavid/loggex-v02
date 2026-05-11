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
    /**
     * `$plsOverride` permite ejecutar el distribuidor en modo dry-run con
     * PeriodoLectivos in-memory (sin persistir). Lo usa la cola pendingActions
     * del editor para previsualizar la distribución antes de Guardar.
     *
     * @param array<\App\Entity\PeriodoLectivo>|null $plsOverride
     */
    public function distribute(Grupo $grupo, ?array $plsOverride = null): array
    {
        $pls = $plsOverride ?? $this->em->getRepository(PeriodoLectivo::class)
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
            // slotMin_j: granularidad pedagógica de los m_ij del rango.
            // max(60, slot_atómico) garantiza que `pli.minutosSemanales` sea
            // múltiplo de 60min (= 1 hora pedagógica) cuando los slots
            // atómicos son 30min, evitando que el solver reciba liquidos
            // residuales de 30 que se traducen en bloques sueltos.
            $slotMin = max(60, min($slotDurations));
            $cap = $capPorDia * $diasCount;
            $semanas = $this->calcularSemanasEnteras($pl);
            if ($semanas < 1) {
                return $this->errorResult(sprintf('PL #%d con < 1 semana.', $pl->getId()));
            }
            $capSlotsPorSem = count($slotDurations) * $diasCount;
            $semanasFrac = $this->calcularSemanasFraccionales($pl);
            // Cap pedagógico real: mayor múltiplo de slotMin que cabe en el
            // cap físico de la jornada. Ej: cap=1650 (27.5h slots) con
            // slotMin=60 → 1620 (27 bloques pedagógicos). Los 30min
            // residuales no se pueden distribuir porque slotMin fuerza
            // múltiplos de 60.
            //
            // Antes esto era `capSlotsPorSem × slotMin` (= 55 × 60 = 3300
            // con jornada de slots atómicos 30min), valor inflado al doble
            // del cap físico que no obligaba al greedy a balancear entre
            // PLs. Síntoma: con N=2 rangos de longitudes distintas, el
            // distribuidor podía cargar 1680 min/sem en un PL y 1620 en
            // otro (en lugar de balancear a ~1650 promedio), sobrepasando
            // el cap físico del PL más cargado. El solver iterativo
            // detectaba `unplaced > 0` y aplicaba REDUCIR_CUOTA_PROPIA
            // destructiva (−60 min/sem a 2 imps), generando shortfall
            // cross-rango de 11.7h en cada una.
            $capMinTarget = ((int) floor($cap / $slotMin)) * $slotMin;
            $plMeta[$pl->getId()] = [
                'pl' => $pl,
                'cap' => $cap,
                'capTarget' => $capMinTarget,
                'slotMin' => $slotMin,
                'capSlotsPorSem' => $capSlotsPorSem,
                'semanas' => $semanasFrac,
                'aporteSlot' => $slotMin * $semanasFrac,
                'capMinLibres' => $capMinTarget,
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
            // Sin margen +1 (cambio 2026-04-29 noche, Opción A): el +1 sem
            // que añadíamos antes inflaba el calendario causando holgura ~16%
            // que bin-packing rellena con overshoot. Ahora extendemos solo lo
            // matemáticamente necesario; la tolerancia 5% del chequeo de
            // shortfalls evita la oscilación sin necesidad del margen +1.
            $extendSem = $lastCap > 0 ? (int) ceil($deficit / $lastCap) : 1;
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

        // Orden ASC de imps por slots necesarios (las pequeñas reservan
        // sus slots antes de que las grandes consuman toda la capacidad).
        $impIdsOrdenados = array_keys($impsPres);
        $aporteSlotPromedio = 0;
        foreach ($plMeta as $meta) $aporteSlotPromedio += $meta['aporteSlot'];
        $aporteSlotPromedio = count($plMeta) > 0 ? $aporteSlotPromedio / count($plMeta) : 1;
        usort($impIdsOrdenados, function ($a, $b) use ($impsPres, $aporteSlotPromedio) {
            $slotsA = (int) ceil($impsPres[$a]['objetivo'] / max(1, $aporteSlotPromedio));
            $slotsB = (int) ceil($impsPres[$b]['objetivo'] / max(1, $aporteSlotPromedio));
            return $slotsA <=> $slotsB;
        });

        // Pase greedy: por imp en orden ASC, asignar slots al PL con menor
        // overshoot hasta cubrir restante.
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

        // Pase 2 (saturar jornada) ELIMINADO 2026-04-29 noche: cuando el
        // solver físico es bin-packing first-fit (default), satura la jornada
        // por sí solo (cada slot recibe la materia con más líquido pendiente
        // hasta agotar). Si distribuidor también satura aquí, las cuotas se
        // inflaban ~25-30% sobre target curricular y bin-packing añadía otro
        // ~20% per materia, dejando overshoot total ~40% en algunas materias.
        // Sin pase 2: distribuidor pide cuota natural exacta, bin-packing
        // distribuye los slots residuales (típicamente 5 slots de 90 que
        // aportan 30 min/sem extra cada uno = 150 min/sem) entre las materias
        // menos cubiertas con tope 130%. Resultado: overshoot ≤ 130% per
        // materia.
        //
        // Si el caller usa el solver ILP legacy, sigue funcionando porque
        // CapacityPlanner reduce cuotas al cap real y el ILP coloca lo que
        // cabe. Pero el ILP no satura — slots vacíos. Para usar ILP con
        // saturación habría que reactivar pase 2 condicionalmente.

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
            // Calculamos por la MAYOR shortfall individual (sin margen +1, ver
            // capacityShortfall arriba para razón). El cap del último rango se
            // aplica per-materia, no global. Sumar todos los shortfalls
            // infraestima el extend cuando hay 1 materia gigante.
            $maxShortfall = max($shortfalls);
            $extendSem = $lastCap > 0 ? (int) ceil($maxShortfall / $lastCap) : 1;
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
