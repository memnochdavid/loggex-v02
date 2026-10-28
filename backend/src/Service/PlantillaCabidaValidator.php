<?php

declare(strict_types=1);

namespace App\Service;

use App\Entity\EtapaEducativa;
use App\Entity\Grupo;
use App\Entity\JornadaTipo;
use App\Entity\TipoTramo;
use Doctrine\ORM\EntityManagerInterface;

/**
 * Valida la cabida del currículo de un Grupo en la jornada efectiva de su
 * PLANTILLA, en el modelo semanal puro (post-refactor 2026-05-06).
 *
 * Para cada PLI vivo en la PLANTILLA del grupo lee la cuota natural
 * (`materia.minutosSemanales`), suma las imparticiones cuya modalidad
 * efectiva consume aula (Modalidad::consumeAula() === true), y compara con
 * la jornada lectiva semanal (Σ duración tramos SLOT × días lectivos —
 * misma fórmula que `CapacityPlanner::slotsFromJornada()`).
 *
 * Devuelve `feasible` + el detalle por imparticion (incluyendo modalidad,
 * para que el frontend distinga "cuenta al currículo" vs "consume aula") +
 * shortfalls cuando la suma presencial excede la jornada.
 *
 * NO modifica BD. NO depende de CurriculumDistributor (que sigue vivo para
 * SEMANAs excepcionales con cuotas heterogéneas — caso fuera del alcance
 * de este servicio).
 *
 * Doc: docs/hoja-de-ruta-modelo-semanal.md §12 (Fase B reescritura
 * `handleConfigureOptimalCourse`).
 */
class PlantillaCabidaValidator
{
    public function __construct(
        private EntityManagerInterface $em,
        private PeriodoLectivoResolver $resolver,
        private CalendarioLectivoService $calendario,
    ) {
    }

    /**
     * @return array{
     *   feasible: bool,
     *   error: ?string,
     *   plantilla: ?array{id:int, nombre:?string},
     *   jornada: ?array{id:int, nombre:?string, semanalLectivaMin:int, diasLectivos:array<int>},
     *   semanasRefCentro: float,
     *   semanasOrigen: string,
     *   cuotas: array<int, array{
     *     plantillaImparticionId:int,
     *     imparticionId:int,
     *     materiaId:?int,
     *     materiaNombre:?string,
     *     modalidad:string,
     *     consumeAula:bool,
     *     cuotaCatalogoMin:int,
     *     objetivoAnualMin:int,
     *     cuotaSugeridaMin:int,
     *     cuotaActualMin:int
     *   }>,
     *   totalCuotaPresencialMin: int,
     *   totalCuotaCurricularMin: int,
     *   objetivoAnualPresencialMin: int,
     *   capacidadAnualSlotsMin: int,
     *   excedenteJornadaMin: int,
     *   semanasMinimasParaFeasible: ?float,
     *   semanasExtensionRecomendada: ?int,
     *   shortfalls: array<int, array{tipo:string, detalle:string, minutosFaltantes:int}>
     * }
     */
    public function validate(Grupo $grupo): array
    {
        $plantilla = $this->resolver->getPlantilla($grupo);
        if ($plantilla === null) {
            return $this->errorResult('Grupo sin PLANTILLA. Ejecuta `app:semanas:seed-plantillas` o crea el grupo de nuevo.');
        }

        $jornada = $plantilla->getEffectiveJornadaTipo();
        if ($jornada === null) {
            return $this->errorResult('La PLANTILLA del grupo no tiene jornada efectiva (ni propia, ni override del grupo, ni del itinerario).');
        }

        $diasLectivos = $jornada->getDiasLectivos() ?: [1, 2, 3, 4, 5];
        $jornadaSemanalLectivaMin = $this->computeJornadaSemanalLectivaMin($jornada, $diasLectivos);

        // Semanas lectivas reales del centro (descontando festivos). La cuota
        // sugerida por imparticion se escala para que `cuotaSugerida × semanasRef`
        // cubra `materia.objetivoAnualMin` (LOMLOE D-L). Sin esto, calendarios
        // <36 sem (típico tras descontar festivos) producen cross-rango
        // shortfalls del solver iterativo. Etapa hardcodeada FP — misma deuda
        // compartida con CapacityPlanner; cambiarla cuando exista
        // `Itinerario.etapa`. Doc: `hoja-de-ruta-modelo-semanal.md` §12.
        $centro = $grupo->getItinerario()?->getCentro();
        $semanasRefCentro = 36.0;
        $semanasOrigen = 'fallback_lomloe_36';
        if ($centro !== null) {
            $r = $this->calendario->semanasLectivas($centro, EtapaEducativa::FP);
            if ($r['semanas'] !== null && $r['semanas'] > 0) {
                $semanasRefCentro = (float) $r['semanas'];
                $semanasOrigen = $r['origen'] ?? 'calendario_lectivo';
            }
        }

        $cuotas = [];
        $totalPresencialMin = 0;
        $totalCurricularMin = 0;

        foreach ($plantilla->getImparticiones() as $pli) {
            if ($pli->isDeleted()) continue;
            $imp = $pli->getImparticion();
            if ($imp === null || $imp->isDeleted()) continue;
            $materia = $imp->getMateria();
            $modalidad = $imp->getEffectiveModalidad();
            $consumeAula = $modalidad->consumeAula();

            $cuotaCatalogoMin = (int) ($materia?->getMinutosSemanales() ?? 0);
            $objetivoAnualMin = (int) ($materia?->getObjetivoAnualMinutos() ?? 0);
            // Cuota escalada al calendario REAL del centro: si el centro tiene
            // 35 sem y la materia 130h legales, la cuota debe ser
            // ceil(7800/35) = 223 min/sem (no 200 del catálogo, que daría 117h).
            // Si `semanasRefCentro` no se pudo resolver, usa 36 LOMLOE como
            // último recurso (mismo comportamiento que el catálogo).
            $cuotaSugeridaMin = $semanasRefCentro > 0
                ? (int) ceil($objetivoAnualMin / $semanasRefCentro)
                : $cuotaCatalogoMin;
            $cuotaActualMin = $pli->getEffectiveMinutosSemanales();

            $cuotas[] = [
                'plantillaImparticionId' => (int) $pli->getId(),
                'imparticionId' => (int) $imp->getId(),
                'materiaId' => $materia?->getId(),
                'materiaNombre' => $materia?->getNombre(),
                'modalidad' => $modalidad->value,
                'consumeAula' => $consumeAula,
                'cuotaCatalogoMin' => $cuotaCatalogoMin,
                'objetivoAnualMin' => $objetivoAnualMin,
                'cuotaSugeridaMin' => $cuotaSugeridaMin,
                'cuotaActualMin' => $cuotaActualMin,
            ];

            $totalCurricularMin += $cuotaSugeridaMin;
            if ($consumeAula) {
                $totalPresencialMin += $cuotaSugeridaMin;
            }
        }

        $excedenteJornadaMin = max(0, $totalPresencialMin - $jornadaSemanalLectivaMin);
        $feasible = $excedenteJornadaMin === 0;

        // Σ objetivoAnualMin de las imparticiones presenciales: total de
        // minutos legales que el currículo exige cubrir en aula al año.
        $objetivoAnualPresencialMin = 0;
        foreach ($cuotas as $c) {
            if ($c['consumeAula']) {
                $objetivoAnualPresencialMin += $c['objetivoAnualMin'];
            }
        }

        // Capacidad ANUAL de aula (slots × días lectivos × semanas reales).
        // Si el currículo legal supera esta cifra, el déficit es estructural
        // y NINGÚN reparto semanal lo arregla (modelo semanal redistribuye,
        // no crea capacidad).
        $capacidadAnualSlotsMin = (int) round($jornadaSemanalLectivaMin * $semanasRefCentro);

        // Cuántas semanas lectivas haría falta tener para que la cuota
        // escalada de cada materia cupiera en la jornada (estimación lineal,
        // sin tener en cuenta geometría de slots — el solver puede dar
        // resultados ligeramente distintos por redondeos).
        $semanasMinimasParaFeasible = null;
        $semanasExtensionRecomendada = null;
        if (!$feasible && $jornadaSemanalLectivaMin > 0) {
            // semanasMinimas = Σ objetivoAnualPresencial / jornadaSemanalLectivaMin
            // (suficientes para que ceil(objetivo/sem) ≤ jornada agregada).
            $semanasMinimasParaFeasible = $jornadaSemanalLectivaMin > 0
                ? $objetivoAnualPresencialMin / $jornadaSemanalLectivaMin
                : null;
            if ($semanasMinimasParaFeasible !== null && $semanasMinimasParaFeasible > $semanasRefCentro) {
                $semanasExtensionRecomendada = (int) ceil($semanasMinimasParaFeasible - $semanasRefCentro);
            }
        }

        $shortfalls = [];
        if (!$feasible) {
            $shortfalls[] = [
                'tipo' => 'excedente_jornada',
                'detalle' => sprintf(
                    'Las materias presenciales suman %d min/sem (escaladas a %s sem reales del centro) pero la jornada lectiva tiene %d min/sem (excedente: %d min/sem).',
                    $totalPresencialMin,
                    rtrim(rtrim(number_format($semanasRefCentro, 2, '.', ''), '0'), '.'),
                    $jornadaSemanalLectivaMin,
                    $excedenteJornadaMin,
                ),
                'minutosFaltantes' => $excedenteJornadaMin,
            ];
            if ($semanasExtensionRecomendada !== null && $semanasExtensionRecomendada > 0) {
                $shortfalls[] = [
                    'tipo' => 'sugerencia_extension_calendario',
                    'detalle' => sprintf(
                        'Extender el calendario lectivo del centro en aproximadamente %d semana(s) más (de %s a ~%s sem) cubriría el currículo legal sin reducir cuotas. Edita las fechas del curso en /admin/centros si el calendario CCAA lo permite.',
                        $semanasExtensionRecomendada,
                        rtrim(rtrim(number_format($semanasRefCentro, 2, '.', ''), '0'), '.'),
                        rtrim(rtrim(number_format($semanasMinimasParaFeasible ?? 0.0, 2, '.', ''), '0'), '.'),
                    ),
                    'minutosFaltantes' => 0,
                ];
            }
        }

        return [
            'feasible' => $feasible,
            'error' => null,
            'plantilla' => [
                'id' => (int) $plantilla->getId(),
                'nombre' => $plantilla->getNombre(),
            ],
            'jornada' => [
                'id' => (int) $jornada->getId(),
                'nombre' => $jornada->getNombre(),
                'semanalLectivaMin' => $jornadaSemanalLectivaMin,
                'diasLectivos' => $diasLectivos,
            ],
            'semanasRefCentro' => $semanasRefCentro,
            'semanasOrigen' => $semanasOrigen,
            'cuotas' => $cuotas,
            'totalCuotaPresencialMin' => $totalPresencialMin,
            'totalCuotaCurricularMin' => $totalCurricularMin,
            'objetivoAnualPresencialMin' => $objetivoAnualPresencialMin,
            'capacidadAnualSlotsMin' => $capacidadAnualSlotsMin,
            'excedenteJornadaMin' => $excedenteJornadaMin,
            'semanasMinimasParaFeasible' => $semanasMinimasParaFeasible,
            'semanasExtensionRecomendada' => $semanasExtensionRecomendada,
            'shortfalls' => $shortfalls,
        ];
    }

    private function computeJornadaSemanalLectivaMin(JornadaTipo $jornada, array $diasLectivos): int
    {
        $minutosPorDia = 0;
        foreach ($jornada->getTramos() as $tramo) {
            if ($tramo->getTipo() !== TipoTramo::SLOT) continue;
            $duracion = $tramo->getDuracionMinutos();
            if ($duracion > 0) {
                $minutosPorDia += $duracion;
            }
        }
        return $minutosPorDia * count($diasLectivos);
    }

    /**
     * @return array{
     *   feasible: bool, error: string, plantilla: null, jornada: null,
     *   cuotas: array, totalCuotaPresencialMin: int, totalCuotaCurricularMin: int,
     *   excedenteJornadaMin: int, shortfalls: array
     * }
     */
    private function errorResult(string $msg): array
    {
        return [
            'feasible' => false,
            'error' => $msg,
            'plantilla' => null,
            'jornada' => null,
            'semanasRefCentro' => 36.0,
            'semanasOrigen' => 'fallback_lomloe_36',
            'cuotas' => [],
            'totalCuotaPresencialMin' => 0,
            'totalCuotaCurricularMin' => 0,
            'objetivoAnualPresencialMin' => 0,
            'capacidadAnualSlotsMin' => 0,
            'excedenteJornadaMin' => 0,
            'semanasMinimasParaFeasible' => null,
            'semanasExtensionRecomendada' => null,
            'shortfalls' => [],
        ];
    }
}
