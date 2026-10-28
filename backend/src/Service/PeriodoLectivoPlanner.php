<?php

namespace App\Service;

use App\Entity\Catalogo\EtapaEducativa as CatalogoEtapa;
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
     *         contractDias:int,
     *         jornadaSemanalMin:int,
     *         razonGlobal:string,
     *         origenFechas:string,
     *         fechaInicio:?string,
     *         fechaFin:?string,
     *         fechaFinLectivo:?string,
     *         fechaFinExtendida:?string,
     *         isFp:bool,
     *         isFpSegundo:bool
     *     }
     * }
     */
    public function plan(Grupo $grupo): array
    {
        [$ini, $fin, $origenFechas] = $this->resolveVentana($grupo);

        if ($ini === null || $fin === null) {
            return $this->emptyResult('sin_fechas_resolubles');
        }

        // Cargar evaluaciones una sola vez — se usan para cropping del fin
        // lectivo + para `construirRangos` más abajo.
        $allEvals = $this->em->getRepository(PeriodoEvaluativo::class)
            ->createQueryBuilder('pe')
            ->andWhere('pe.grupo = :g')
            ->andWhere('pe.deleted = false')
            ->setParameter('g', $grupo)
            ->orderBy('pe.fechaInicio', 'ASC')
            ->getQuery()
            ->getResult();

        // Cropping de `fin` a la ventana LECTIVA real (reglas usuario 2026-05-11):
        //
        //  1) Universal: las clases NUNCA caen en EXTRAORDINARIA.
        //     `fin` se recorta a `extraordinaria.fechaInicio - 1` si lo solapa.
        //
        //  2) FP (cualquier curso): EN NINGÚN CASO hay clases después de la
        //     TERCERA evaluación. `fin` se recorta a `tercera.fechaFin` si lo
        //     solapa. Esta regla aplica también a FP 1º (donde no hay FCT en
        //     TERCERA — pero el calendario post-TERCERA está reservado a
        //     evaluación/repaso/EXTRAORDINARIA, no a clases lectivas).
        //
        //  3) FP 2º (etapa FP_* + curso=2): además, las prácticas (FCT) se
        //     cursan en la TERCERA evaluación. La repartición de horas lectivas
        //     debe terminar en SEGUNDA.fechaFin para dejar TERCERA libre para
        //     FCT. `fin` se recorta a `segunda.fechaFin` (más restrictivo que
        //     la regla 2 para 2º FP).
        //
        // Para no-FP (ESO/Bach/Idiomas/Artísticas/EPA…) sólo aplica la regla 1.
        // Se evaluará caso por caso si se añaden reglas específicas — pendiente
        // de feedback usuario.
        //
        // Mantenemos el `fin` original sin tocar en `diagnostico.fechaFin` por
        // trazabilidad; el cropping vive en `finLectivo`.
        $isFp = $this->isFp($grupo);
        $isFp2 = $isFp && $grupo->getCurso() === 2;
        $finLectivo = \DateTime::createFromInterface($fin);
        foreach ($allEvals as $e) {
            /** @var PeriodoEvaluativo $e */
            $tipo = $e->getTipo();
            // Regla 1 — universal.
            if ($tipo === 'EXTRAORDINARIA' && $e->getFechaInicio() !== null) {
                $cap = \DateTime::createFromInterface($e->getFechaInicio());
                $cap->modify('-1 day');
                if ($cap < $finLectivo) $finLectivo = $cap;
            }
            // Regla 2 — FP 1º (FP 2º recorta más con regla 3, pero también
            // pasa por aquí: el `min` por `<` se queda con la más restrictiva).
            if ($isFp && !$isFp2 && $tipo === 'TERCERA' && $e->getFechaFin() !== null) {
                $cap = \DateTime::createFromInterface($e->getFechaFin());
                if ($cap < $finLectivo) $finLectivo = $cap;
            }
            // Regla 3 — FP 2º.
            if ($isFp2 && $tipo === 'SEGUNDA' && $e->getFechaFin() !== null) {
                $cap = \DateTime::createFromInterface($e->getFechaFin());
                if ($cap < $finLectivo) $finLectivo = $cap;
            }
        }
        if ($finLectivo < \DateTime::createFromInterface($ini)) {
            // Edge: ventana lectiva vacía (datos extraños — p.ej. EXTRAORDINARIA
            // antes que el inicio del grupo). Mantenemos el `fin` original
            // para no devolver una ventana imposible.
            $finLectivo = \DateTime::createFromInterface($fin);
        }

        // Calcular días lectivos reales descontando festivos.
        $info = $this->calendario->semanasLectivas(
            $grupo->getCentro(),
            null,
            \DateTime::createFromInterface($ini),
            $finLectivo,
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

        // Jornada semanal "lectivo curricular" (truco LOMLOE FP — alineado con
        // `HorariosEditor.jsx:888` `jornadaSemanalLectivaMin`): suma SLOT +
        // RECREO de la jornada efectiva por los días lectivos del grupo.
        //
        // Los recreos NO son colocables (el solver/distributor sólo coloca en
        // SLOT), pero en FP el inspector LOMLOE acepta el tiempo total de
        // permanencia (slots + recreos) como tiempo "lectivo curricular" a
        // efectos de cumplir las horas totales del módulo. Por eso aquí
        // sumamos ambos: la cabida que reporta el planner debe ser coherente
        // con la cifra que ve el admin en el banner del frontend.
        //
        // Para etapas no-FP esta asunción puede sobreestimar capacidad ~10%
        // (no aplica el truco). Si en su día algún centro ESO/Bach quiere
        // descontar recreos, se parametrizará vía Centro/JornadaTipo. Hoy es
        // universal (consistente con frontend).
        $jornada = $grupo->getEffectiveJornadaTipo();
        $jornadaCurricularMinDia = 0;
        $jornadaTipoId = $jornada?->getId();
        if ($jornada !== null) {
            foreach ($jornada->getTramos() as $t) {
                $tipo = $t->getTipo();
                if ($tipo !== TipoTramo::SLOT && $tipo !== TipoTramo::RECREO) continue;
                $jornadaCurricularMinDia += $t->getDuracionMinutos() ?? 0;
            }
        }
        $diasLectivos = $jornada !== null
            ? ($jornada->getDiasLectivos() ?: [1, 2, 3, 4, 5])
            : [1, 2, 3, 4, 5];
        $jornadaSemanalMin = $jornadaCurricularMinDia * count($diasLectivos);

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
        // El cálculo de extend/contract opera sobre la ventana LECTIVA, no
        // sobre el `fin` calendario completo. Para FP 2º esto significa que
        // extender no puede empujar dentro del período FCT (3ª eval) ni de
        // EXTRAORDINARIA — el cropping ya las excluyó de `finLectivo`.
        $finExtendido = clone $finLectivo;
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
                    $finLectivo,
                    $jornadaSemanalMin,
                    $capacidadObjetivo,
                );
                if ($contractDias > 0 && $finExtendido instanceof \DateTime) {
                    $finExtendido->modify("-{$contractDias} days");
                }
            }
        }

        $rangos = $this->construirRangos($grupo, $ini, $finExtendido, $jornadaTipoId, $allEvals, $isFp, $isFp2);

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
                'fechaFinLectivo' => $finLectivo->format('Y-m-d'),
                'fechaFinExtendida' => $finExtendido->format('Y-m-d'),
                'isFp' => $isFp,
                'isFpSegundo' => $isFp2,
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
     * Caso A: hay PeriodoEvaluativo lectivas (1ª, 2ª, 3ª, ORDINARIA_FINAL)
     * ordenadas cronológicamente. Cada evaluación define un rango "hasta esta
     * evaluación". Si tras la última evaluación queda calendario lectivo
     * (no FP 2º), se añade un rango final.
     *
     * Caso B: sin evaluaciones lectivas → 1 único rango "Curso completo".
     *
     * Filtros aplicados sobre `$allEvals`:
     *  - EXTRAORDINARIA siempre descartada (no es período lectivo).
     *  - TERCERA descartada SOLO si `$isFp2` (es período FCT en FP 2º).
     *
     * Cola residual:
     *  - Desactivada para CUALQUIER grupo FP (`$isFp`): regla "no clases
     *    después de TERCERA" — el calendario post-TERCERA queda libre para
     *    EXTRAORDINARIA / recuperación / cierre, no para lectivas.
     *  - Para no-FP (ESO/Bach/…) se mantiene si tras la última evaluación
     *    sigue habiendo calendario lectivo (pendiente de feedback usuario).
     *
     * El `$fin` recibido aquí YA viene cropped a la ventana lectiva en `plan()`
     * (excluye EXTRAORDINARIA, post-TERCERA en FP, y SEGUNDA → adelante en
     * FP 2º). Aún así filtramos aquí por defensa.
     *
     * @param list<PeriodoEvaluativo> $allEvals
     * @return list<array{nombre:string,fechaInicio:string,fechaFin:string,jornadaTipoId:?int,etiqueta:string,razon:string}>
     */
    private function construirRangos(
        Grupo $grupo,
        \DateTimeInterface $ini,
        \DateTimeInterface $fin,
        ?int $jornadaTipoId,
        array $allEvals,
        bool $isFp,
        bool $isFp2,
    ): array {
        $evals = array_values(array_filter($allEvals, function (PeriodoEvaluativo $e) use ($isFp2): bool {
            $tipo = $e->getTipo();
            if ($tipo === 'EXTRAORDINARIA') return false;
            if ($isFp2 && $tipo === 'TERCERA') return false;
            return true;
        }));

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

        // Cola residual: sólo para grupos NO-FP. En FP (1º o 2º) el calendario
        // post-última-evaluación-lectiva queda libre (FCT en 2º, recuperación/
        // EXTRAORDINARIA en 1º) y no debe llevar clases. El cropping de `fin`
        // en `plan()` ya lo deja vacío para FP, pero mantenemos el guard
        // explícito por claridad.
        if (!$isFp && $cursor <= $fin) {
            $rangos[] = [
                'nombre' => 'Tras última evaluación',
                'fechaInicio' => $cursor->format('Y-m-d'),
                'fechaFin' => $fin->format('Y-m-d'),
                'jornadaTipoId' => $jornadaTipoId,
                'etiqueta' => 'cola',
                'razon' => 'calendario_residual_post_evaluaciones',
            ];
        }

        // Rango EXTRA para FP 2º: "Tercera evaluación" (Fase A 2026-05-12).
        //
        // En FP 2º la regla universal recorta `fin` a `segunda.fechaFin`
        // (regla 3 de `plan()`) para que las clases presenciales terminen
        // antes de la TERCERA, que es el período de FCT + Proyecto + HLC.
        // Hasta ahora ese período quedaba sin contenedor en el strip del
        // editor, así que las horas no presenciales del currículo (FCT 400h,
        // Proyecto 40-72h, HLC 108h) no tenían "donde aterrizar" temporalmente
        // y el admin no veía el calendario completo del grupo.
        //
        // Añadimos una entrada extra al array de rangos con:
        //   - nombre genérico "Tercera evaluación" (no se asume FCT — funciona
        //     para itinerarios FP 2º con otras configuraciones de TERCERA).
        //   - etiqueta='no_presenciales' como discriminador: frontend skipea
        //     este rango en el solver y el distribuidor de currículo. Persiste
        //     en BD via `PeriodoLectivo.etiqueta` (migration 20260512200000).
        //   - jornadaTipoId=null: el rango no tiene jornada lectiva (no se
        //     colocan clases regulares; las prácticas tienen horario propio).
        //   - razon='tercera_evaluacion_fp2_no_presenciales' para diagnóstico.
        //
        // Skip silencioso si no hay TERCERA configurada (centro no completó
        // sus evaluaciones — el admin solo verá los 2 rangos lectivos como
        // antes). No es error: es defensa frente a datos incompletos.
        if ($isFp2) {
            $tercera = null;
            foreach ($allEvals as $e) {
                /** @var PeriodoEvaluativo $e */
                if ($e->getTipo() === 'TERCERA'
                    && $e->getFechaInicio() !== null
                    && $e->getFechaFin() !== null
                ) {
                    $tercera = $e;
                    break;
                }
            }
            if ($tercera !== null) {
                $rangos[] = [
                    'nombre' => 'Tercera evaluación',
                    'fechaInicio' => $tercera->getFechaInicio()->format('Y-m-d'),
                    'fechaFin' => $tercera->getFechaFin()->format('Y-m-d'),
                    'jornadaTipoId' => null,
                    'etiqueta' => 'no_presenciales',
                    'razon' => 'tercera_evaluacion_fp2_no_presenciales',
                ];
            }
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

    /**
     * Detecta si el grupo pertenece a alguna etapa FP (cualquier curso).
     *
     * Detección vía `grupo.itinerario.catalogoOrigen.etapa` ∈ {FP_BASICA,
     * FP_MEDIO, FP_SUPERIOR, FP_ESPECIALIZACION}. Si el itinerario no está
     * enlazado al catálogo (itinerario manual pre-catálogo), devuelve false
     * — comportamiento conservador: las reglas FP no se aplican y se cae al
     * comportamiento estándar.
     *
     * Las reglas FP que dependen de esta detección (2026-05-11):
     *   - "No clases después de TERCERA" → cropping a `tercera.fechaFin`
     *     en `plan()` + skip cola residual en `construirRangos()`.
     *   - FP 2º (curso=2) suma "FCT en TERCERA" → cropping adicional a
     *     `segunda.fechaFin` + filtrado de la TERCERA en los rangos.
     */
    private function isFp(Grupo $grupo): bool
    {
        $itinerario = $grupo->getItinerario();
        if ($itinerario === null) return false;
        $catalogo = $itinerario->getCatalogoOrigen();
        if ($catalogo === null) return false;
        return in_array($catalogo->getEtapa(), [
            CatalogoEtapa::FP_BASICA,
            CatalogoEtapa::FP_MEDIO,
            CatalogoEtapa::FP_SUPERIOR,
            CatalogoEtapa::FP_ESPECIALIZACION,
        ], true);
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
                'fechaFinLectivo' => null,
                'fechaFinExtendida' => null,
                'isFp' => false,
                'isFpSegundo' => false,
            ],
        ];
    }
}
