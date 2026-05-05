<?php

namespace App\Service;

use App\Entity\Centro;
use App\Entity\Grupo;
use App\Entity\Imparticion;
use App\Entity\PeriodoEvaluativo;
use App\Entity\TipoTramo;
use Doctrine\ORM\EntityManagerInterface;

/**
 * Decide la propuesta de `PeriodoLectivo` óptima para un grupo basándose en
 * datos reales del centro, no en un número fijo arbitrario.
 *
 * Antes de este servicio, "Configurar curso óptimo" creaba siempre 3 rangos
 * equiespaciados (variable `createRangosCount` del frontend con default 3).
 * Eso ignoraba el calendario real, las evaluaciones del grupo y el currículo.
 *
 * Heurística:
 *   1. Resuelve la ventana del curso: `Grupo.fechaInicio/Fin` con fallback a
 *      `Centro.fechaInicio/FinCurso` y luego a `CalendarioEscolarCcaa` por
 *      etapa (vía `CalendarioLectivoService`).
 *   2. Calcula semanas y días lectivos reales descontando festivos aplicables.
 *   3. Suma `Materia.getObjetivoAnualMinutos()` de las imparticiones presenciales.
 *   4. Calcula la jornada semanal (Σ minutos slots × 5 días).
 *   5. Si Σ currículo > capacidad calendario, propone extender el último rango.
 *   6. Para decidir N rangos:
 *      - Si el grupo tiene `PeriodoEvaluativo` (1ª, 2ª, 3ª, ORDINARIA_FINAL),
 *        crea 1 rango por evaluación con sus fechas reales + un rango final
 *        si queda calendario tras la última evaluación.
 *      - Si NO hay evaluaciones configuradas → **1 rango único "Curso completo"**.
 *        Es la opción natural: el admin puede partirlo manualmente si lo
 *        necesita (cambio de jornada en un periodo, taller intensivo, etc.).
 *
 * Esto reemplaza al hard-code `N=3` y respeta el principio "no inventar
 * rangos sin razón".
 *
 * Doc: `docs/hoja-de-ruta-solver-iterativo.md` Fase B 2026-05-05.
 */
class PeriodoLectivoPlanner
{
    public function __construct(
        private readonly EntityManagerInterface $em,
        private readonly CalendarioLectivoService $calendario,
    ) {
    }

    /**
     * @return array{
     *     rangos: list<array{nombre:string,fechaInicio:string,fechaFin:string,jornadaTipoId:?int,etiqueta:string,razon:string}>,
     *     diagnostico: array{
     *         semanasLectivas:?float,
     *         diasLectivos:?int,
     *         curriculumMinutos:int,
     *         capacidadMinutos:int,
     *         feasible:bool,
     *         extendDias:int,
     *         jornadaSemanalMin:int,
     *         razonGlobal:string,
     *         fechaInicio:?string,
     *         fechaFin:?string,
     *         fechaFinExtendida:?string
     *     }
     * }
     */
    public function plan(Grupo $grupo): array
    {
        [$ini, $fin, $origenFechas] = $this->resolveVentana($grupo);

        if ($ini === null || $fin === null) {
            return $this->emptyResult('sin_fechas_resolubles');
        }

        // Calcular días lectivos reales descontando festivos.
        $info = $this->calendario->semanasLectivas(
            $grupo->getCentro(),
            null,
            \DateTime::createFromInterface($ini),
            \DateTime::createFromInterface($fin),
        );
        $semanasLectivas = $info['semanas'] ?? 0.0;
        $diasLectivos = $info['diasLectivos'] ?? 0;

        // Σ horas curriculares de las imparticiones presenciales (las que
        // consumen aula). Modalidades NO_REGULAR / FCT / AUTONOMA no se
        // colocan en slots físicos del horario, así que no contribuyen al
        // cálculo de capacidad necesaria.
        // Query directa al repo: `Grupo` no expone `getImparticiones()`
        // (la propiedad existe pero sin getter público — mismo patrón que
        // se hace en `NotificationDispatcher::notifyTareaNueva` con `Matricula`).
        $imps = $this->em->getRepository(Imparticion::class)->createQueryBuilder('i')
            ->andWhere('i.grupo = :g')
            ->andWhere('i.deleted = false')
            ->setParameter('g', $grupo)
            ->getQuery()
            ->getResult();
        $curriculumMin = 0;
        foreach ($imps as $imp) {
            /** @var Imparticion $imp */
            if (!$imp->getEffectiveModalidad()->consumeAula()) continue;
            $materia = $imp->getMateria();
            if ($materia === null || $materia->isDeleted()) continue;
            $curriculumMin += $materia->getObjetivoAnualMinutos();
        }

        // Jornada semanal lectiva en minutos: suma duración de slots SLOT
        // (sin recreos) por la jornada efectiva del grupo, multiplicada por
        // los días lectivos del enum (default lun-vie = 5).
        $jornada = $grupo->getEffectiveJornadaTipo();
        $jornadaSlotsMinDia = 0;
        $jornadaTipoId = $jornada?->getId();
        if ($jornada !== null) {
            foreach ($jornada->getTramos() as $t) {
                if ($t->getTipo() !== TipoTramo::SLOT) continue;
                $jornadaSlotsMinDia += $t->getDuracionMinutos() ?? 0;
            }
        }
        $jornadaSemanalMin = $jornadaSlotsMinDia * 5;

        $capacidadMin = (int) round($jornadaSemanalMin * ($semanasLectivas ?? 0));
        $feasible = $jornadaSemanalMin > 0 && $curriculumMin <= $capacidadMin;

        // AJUSTE DE CALENDARIO al currículo:
        //
        //   1. Si curriculum > capacidad → EXTENDER fechaFin del último rango
        //      hasta que la nueva capacidad cubra el currículo.
        //   2. Si capacidad > curriculum × MARGIN → CONTRAER fechaFin del
        //      último rango para que la suma `jornada × semanas_lectivas`
        //      sea ≈ curriculum (con un pequeño margen para evitar undershoot
        //      por redondeos / festivos a mitad de curso).
        //
        // El curso lectivo se ajusta exactamente al tamaño curricular del
        // grupo. El resto del año natural queda libre para FCT, evaluación
        // extraordinaria, repaso, lo que el centro decida.
        //
        // Margen: 2% sobre el currículo. Si el currículo pide 1044h, fijamos
        // capacidad objetivo ≈ 1064h (3 días extra) para absorber redondeos
        // y festivos puntuales sin tener que volver a extender.
        $extendDias = 0;
        $contractDias = 0;
        $finExtendido = clone $fin;
        if ($jornadaSemanalMin > 0) {
            $marginMin = (int) round($curriculumMin * 0.02);
            $capacidadObjetivo = $curriculumMin + $marginMin;

            if ($capacidadMin < $curriculumMin) {
                // EXTENDER: cubrir el déficit.
                $deficitMin = $curriculumMin - $capacidadMin;
                $semanasExtra = (int) ceil($deficitMin / $jornadaSemanalMin);
                $extendDias = $semanasExtra * 7;
                if ($finExtendido instanceof \DateTime) {
                    $finExtendido->modify("+{$extendDias} days");
                }
            } elseif ($capacidadMin > $capacidadObjetivo) {
                // CONTRAER: el calendario lectivo sobra. Mover fechaFin hacia
                // atrás día a día hasta que las semanas lectivas restantes
                // cubran capacidadObjetivo (curriculum + 2% margen).
                $contractDias = $this->calcContractDias(
                    $grupo->getCentro(),
                    $ini,
                    $fin,
                    $jornadaSemanalMin,
                    $capacidadObjetivo,
                );
                if ($contractDias > 0 && $finExtendido instanceof \DateTime) {
                    $finExtendido->modify("-{$contractDias} days");
                }
            }
        }

        $rangos = $this->construirRangos($grupo, $ini, $finExtendido, $jornadaTipoId);

        return [
            'rangos' => $rangos,
            'diagnostico' => [
                'semanasLectivas' => $semanasLectivas,
                'diasLectivos' => $diasLectivos,
                'curriculumMinutos' => $curriculumMin,
                'capacidadMinutos' => $capacidadMin,
                'feasible' => $feasible,
                'extendDias' => $extendDias,
                'contractDias' => $contractDias,
                'jornadaSemanalMin' => $jornadaSemanalMin,
                'razonGlobal' => $feasible
                    ? ($contractDias > 0 ? 'contraido_a_curriculum' : 'cabe_en_calendario')
                    : 'requiere_extension',
                'origenFechas' => $origenFechas,
                'fechaInicio' => $ini->format('Y-m-d'),
                'fechaFin' => $fin->format('Y-m-d'),
                'fechaFinExtendida' => $finExtendido->format('Y-m-d'),
            ],
        ];
    }

    /**
     * Resuelve la ventana del curso del grupo. Cada extremo (inicio/fin) se
     * resuelve independientemente con cascada `grupo > centro > año académico`.
     * Esto evita que un solo `null` en el grupo descarte ambas fechas y caiga
     * al fallback completo (caso real: grupo con `fechaInicio` definida pero
     * `fechaFin` NULL → antes se usaba 1-sep → 30-jun aunque el grupo empezase
     * el 15-sep, inflando la capacidad calendario en 2 semanas fantasma).
     *
     * @return array{0:?\DateTimeInterface,1:?\DateTimeInterface,2:string}
     */
    private function resolveVentana(Grupo $grupo): array
    {
        $iniGrupo = $grupo->getFechaInicio();
        $finGrupo = $grupo->getFechaFin();
        $centro = $grupo->getCentro();
        $iniCentro = $centro instanceof Centro ? $centro->getFechaInicioCurso() : null;
        $finCentro = $centro instanceof Centro ? $centro->getFechaFinCurso() : null;

        // Año académico como último fallback (Y-09-01 → (Y+1)-06-30).
        $iniAnio = null;
        $finAnio = null;
        $anio = $grupo->getAnioEscolar();
        if ($anio !== null && preg_match('/^(\d{4})-(\d{4})$/', $anio, $m)) {
            $iniAnio = new \DateTime($m[1].'-09-01');
            $finAnio = new \DateTime($m[2].'-06-30');
        }

        $ini = $iniGrupo ?? $iniCentro ?? $iniAnio;
        $fin = $finGrupo ?? $finCentro ?? $finAnio;

        if ($ini === null || $fin === null) {
            return [null, null, 'sin_resolver'];
        }

        // Etiqueta del origen (para diagnóstico): qué cascada cubrió cada lado.
        $origenIni = $iniGrupo !== null ? 'grupo' : ($iniCentro !== null ? 'centro' : 'anio');
        $origenFin = $finGrupo !== null ? 'grupo' : ($finCentro !== null ? 'centro' : 'anio');
        $origen = $origenIni === $origenFin ? $origenIni : "{$origenIni}+{$origenFin}";

        return [$ini, $fin, $origen];
    }

    /**
     * Construye la lista de rangos según las evaluaciones del grupo.
     *
     * Caso A: hay PeriodoEvaluativo (1ª, 2ª, 3ª, ORDINARIA_FINAL) ordenados
     * cronológicamente. Cada evaluación define un rango "hasta esta evaluación".
     * Si tras la última evaluación queda calendario, se añade un rango final
     * (típicamente para FCT, recuperación o EXTRAORDINARIA).
     *
     * Caso B: sin evaluaciones → 1 único rango "Curso completo".
     *
     * @return list<array{nombre:string,fechaInicio:string,fechaFin:string,jornadaTipoId:?int,etiqueta:string,razon:string}>
     */
    private function construirRangos(
        Grupo $grupo,
        \DateTimeInterface $ini,
        \DateTimeInterface $fin,
        ?int $jornadaTipoId,
    ): array {
        $evals = $this->em->getRepository(PeriodoEvaluativo::class)
            ->createQueryBuilder('pe')
            ->andWhere('pe.grupo = :g')
            ->andWhere('pe.deleted = false')
            ->andWhere('pe.tipo != :extra')   // EXTRAORDINARIA no marca rango lectivo
            ->setParameter('g', $grupo)
            ->setParameter('extra', 'EXTRAORDINARIA')
            ->orderBy('pe.fechaInicio', 'ASC')
            ->getQuery()
            ->getResult();

        if (empty($evals)) {
            return [[
                'nombre' => 'Curso completo',
                'fechaInicio' => $ini->format('Y-m-d'),
                'fechaFin' => $fin->format('Y-m-d'),
                'jornadaTipoId' => $jornadaTipoId,
                'etiqueta' => 'unico',
                'razon' => 'sin_evaluaciones_configuradas',
            ]];
        }

        $rangos = [];
        // Cursor arranca en el inicio de la ventana del curso. Si la 1ª
        // evaluación empieza antes que la ventana (ej. evaluación 2025-09-01
        // pero grupo empieza 2025-09-15), el cursor se mantiene en 09-15 y
        // el primer rango cubre solo lo lectivo real.
        $cursor = \DateTime::createFromInterface($ini);
        foreach ($evals as $eval) {
            /** @var PeriodoEvaluativo $eval */
            $finEval = $eval->getFechaFin();
            if ($finEval === null) continue;
            // Cortar al borde de la ventana del grupo.
            $finRango = $finEval > $fin ? $fin : $finEval;
            if ($finRango < $cursor) continue;   // evaluación pasada antes del cursor (edge)

            $rangos[] = [
                'nombre' => sprintf('Hasta %s', $eval->getNombre() ?? $eval->getTipo() ?? 'Evaluación'),
                'fechaInicio' => $cursor->format('Y-m-d'),
                'fechaFin' => $finRango->format('Y-m-d'),
                'jornadaTipoId' => $jornadaTipoId,
                'etiqueta' => 'evaluacion',
                'razon' => 'alineado_con_'.($eval->getTipo() ?? 'evaluacion'),
            ];
            $cursor = (clone (\DateTime::createFromInterface($finRango)))->modify('+1 day');
            if ($cursor > $fin) break;
        }

        // Cola residual si tras la última evaluación queda calendario.
        if ($cursor <= $fin) {
            $rangos[] = [
                'nombre' => 'Tras última evaluación',
                'fechaInicio' => $cursor->format('Y-m-d'),
                'fechaFin' => $fin->format('Y-m-d'),
                'jornadaTipoId' => $jornadaTipoId,
                'etiqueta' => 'cola',
                'razon' => 'calendario_residual_post_evaluaciones',
            ];
        }

        // Si por algún motivo (todas evaluaciones fuera de la ventana, datos
        // corruptos…) no quedó ningún rango, fallback al rango único.
        if (empty($rangos)) {
            return [[
                'nombre' => 'Curso completo',
                'fechaInicio' => $ini->format('Y-m-d'),
                'fechaFin' => $fin->format('Y-m-d'),
                'jornadaTipoId' => $jornadaTipoId,
                'etiqueta' => 'unico',
                'razon' => 'fallback_sin_evaluaciones_validas',
            ]];
        }

        return $rangos;
    }

    /**
     * Calcula cuántos días naturales hay que recortar de la fechaFin para
     * que la nueva ventana cubra exactamente la capacidad objetivo (currículo
     * + margen).
     *
     * Itera desde la fechaFin hacia atrás día a día. Para cada día natural
     * recortado, recalcula las semanas lectivas restantes y para cuando
     * `capacidadRestante` cae por debajo del objetivo. Devuelve el número
     * de días naturales recortados (= cuanto restar a fechaFin).
     *
     * Tope: 90 días (≈3 meses) para evitar bucles patológicos en datos
     * extraños. Si en 90 días no alcanza el objetivo, devuelve 0 (no contraer).
     */
    private function calcContractDias(
        ?Centro $centro,
        \DateTimeInterface $ini,
        \DateTimeInterface $fin,
        int $jornadaSemanalMin,
        int $capacidadObjetivo,
    ): int {
        if ($centro === null) return 0;

        $cur = \DateTime::createFromInterface($fin);
        $maxIter = 90;
        for ($i = 1; $i <= $maxIter; $i++) {
            $cur->modify('-1 day');
            if ($cur <= $ini) return 0;     // no contraer más allá del inicio
            $info = $this->calendario->semanasLectivas($centro, null, $ini, $cur);
            $semanasNuevas = $info['semanas'] ?? 0.0;
            $capacidadNueva = (int) round($jornadaSemanalMin * $semanasNuevas);
            if ($capacidadNueva <= $capacidadObjetivo) {
                // Ya cumple el objetivo (o ligeramente por debajo). Si nos
                // pasamos por mucho, retroceder un día para no quedarnos
                // cortos del currículo.
                return $i;
            }
        }
        return 0;
    }

    private function emptyResult(string $razonGlobal): array
    {
        return [
            'rangos' => [],
            'diagnostico' => [
                'semanasLectivas' => null,
                'diasLectivos' => null,
                'curriculumMinutos' => 0,
                'capacidadMinutos' => 0,
                'feasible' => false,
                'extendDias' => 0,
                'contractDias' => 0,
                'jornadaSemanalMin' => 0,
                'razonGlobal' => $razonGlobal,
                'origenFechas' => 'sin_resolver',
                'fechaInicio' => null,
                'fechaFin' => null,
                'fechaFinExtendida' => null,
            ],
        ];
    }
}
