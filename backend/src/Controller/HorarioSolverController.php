<?php

namespace App\Controller;

use App\Entity\Grupo;
use App\Entity\Imparticion;
use App\Entity\JornadaTipo;
use App\Entity\PeriodoLectivo;
use App\Entity\PeriodoLectivoImparticion;
use App\Service\CapacityPlanner;
use App\Service\CurriculumDistributor;
use App\Service\HorarioSolver;
use App\Service\HorarioSolverBinPacking;
use App\Service\HorarioSolverIterativo;
use App\Service\PeriodoLectivoPlanner;
use App\Service\PlantillaCabidaValidator;
use Doctrine\ORM\EntityManagerInterface;
use Symfony\Bundle\FrameworkBundle\Controller\AbstractController;
use Symfony\Component\HttpFoundation\JsonResponse;
use Symfony\Component\HttpFoundation\Request;
use Symfony\Component\Routing\Attribute\Route;

class HorarioSolverController extends AbstractController
{
    #[Route('/api/v1/horarios/solver/{grupoId}', name: 'api_horarios_solver', methods: ['POST'], requirements: ['grupoId' => '\d+'])]
    public function solve(
        int $grupoId,
        Request $request,
        EntityManagerInterface $em,
        HorarioSolver $solverIlp,
        HorarioSolverBinPacking $solverBinPacking,
    ): JsonResponse {
        if (!$this->isGranted('ROLE_ADMIN') && !$this->isGranted('ROLE_SUPERADMIN')) {
            return $this->json(['message' => 'Acceso denegado'], 403);
        }

        $grupo = $em->getRepository(Grupo::class)->find($grupoId);
        if (!$grupo) {
            return $this->json(['message' => 'Grupo no encontrado'], 404);
        }

        $data = json_decode($request->getContent(), true) ?: [];
        $seed = isset($data['seed']) ? (int) $data['seed'] : null;

        // Switch de solver (2026-04-29): `binpacking` es default desde la
        // implementación del bin-packing first-fit (`HorarioSolverBinPacking`).
        // El ILP previo (`HorarioSolver`) sigue disponible como fallback con
        // `solver=ilp` para A/B testing o si bin-packing falla en algún caso.
        $solverKind = isset($data['solver']) && $data['solver'] === 'ilp' ? 'ilp' : 'binpacking';

        // PeriodoLectivo opcional: si no viene, el solver resuelve el activo
        // del grupo. El frontend de Fase 2 todavía no lo envía; Fase 3 lo
        // cableará desde el selector de timeline.
        $periodoLectivo = null;
        if (isset($data['periodoLectivoId'])) {
            $pl = $em->getRepository(PeriodoLectivo::class)->find((int) $data['periodoLectivoId']);
            if ($pl === null || $pl->getGrupo()?->getId() !== $grupo->getId()) {
                return $this->json(['message' => 'PeriodoLectivo no encontrado o no pertenece al grupo'], 422);
            }
            $periodoLectivo = $pl;
        }

        // Cap anual por materia (Fase 5 fix afinado): el frontend pasa
        // `alreadyPlacedByImp` con minutos anuales ya colocados en OTROS rangos
        // del grupo (cross-rango). Solo aplicado por el solver ILP — el bin-
        // packing usa el `pli.minutosSemanales` que el distribuidor ya ajustó
        // cross-rango.
        $alreadyPlacedByImp = null;
        if (isset($data['alreadyPlacedByImp']) && is_array($data['alreadyPlacedByImp'])) {
            $alreadyPlacedByImp = [];
            foreach ($data['alreadyPlacedByImp'] as $impId => $min) {
                $alreadyPlacedByImp[(int) $impId] = (int) $min;
            }
        }

        $result = $solverKind === 'ilp'
            ? $solverIlp->solve($grupo, $seed, $periodoLectivo, $alreadyPlacedByImp)
            : $solverBinPacking->solve($grupo, $seed, $periodoLectivo, $alreadyPlacedByImp);
        $result['solver'] = $solverKind;
        return $this->json($result);
    }

    #[Route('/api/v1/horarios/capacity-check/{grupoId}', name: 'api_horarios_capacity_check', methods: ['GET'], requirements: ['grupoId' => '\d+'])]
    public function capacityCheck(int $grupoId, Request $request, EntityManagerInterface $em, CapacityPlanner $planner): JsonResponse
    {
        if (!$this->isGranted('ROLE_ADMIN') && !$this->isGranted('ROLE_SUPERADMIN')) {
            return $this->json(['message' => 'Acceso denegado'], 403);
        }

        $grupo = $em->getRepository(Grupo::class)->find($grupoId);
        if (!$grupo) {
            return $this->json(['message' => 'Grupo no encontrado'], 404);
        }

        // PeriodoLectivo opcional via ?periodoLectivo=N (default = activo).
        $periodoLectivo = null;
        $plParam = $request->query->get('periodoLectivo');
        if ($plParam !== null && $plParam !== '') {
            $pl = $em->getRepository(PeriodoLectivo::class)->find((int) $plParam);
            if ($pl === null || $pl->getGrupo()?->getId() !== $grupo->getId()) {
                return $this->json(['message' => 'PeriodoLectivo no encontrado o no pertenece al grupo'], 422);
            }
            $periodoLectivo = $pl;
        }

        return $this->json($planner->plan($grupo, $periodoLectivo));
    }

    /**
     * Distribuye horas curriculares heterogéneamente entre los rangos lectivos
     * del grupo, respetando la jornada efectiva de cada rango. Devuelve la
     * sugerencia de minutosSemanales por (rango, imparticion) que el frontend
     * persistirá en `PeriodoLectivoImparticion` antes de invocar el solver.
     *
     * Si el currículo no cabe (anualmente o tras redistribución), devuelve
     * `extendBy` (días naturales que el calendario debe alargarse) y `reason`
     * para que el frontend extienda `Grupo.fechaFin` y reintente.
     *
     * Doc: docs/hoja-de-ruta-periodos-lectivos.md §6 (CurriculumDistributor 2026-04-29).
     */
    #[Route('/api/v1/grupos/{grupoId}/distribute-curriculum', name: 'api_grupo_distribute_curriculum', methods: ['POST'], requirements: ['grupoId' => '\d+'])]
    public function distributeCurriculum(int $grupoId, EntityManagerInterface $em, CurriculumDistributor $distributor): JsonResponse
    {
        if (!$this->isGranted('ROLE_ADMIN') && !$this->isGranted('ROLE_SUPERADMIN')) {
            return $this->json(['message' => 'Acceso denegado'], 403);
        }

        $grupo = $em->getRepository(Grupo::class)->find($grupoId);
        if (!$grupo) {
            return $this->json(['message' => 'Grupo no encontrado'], 404);
        }

        return $this->json($distributor->distribute($grupo));
    }

    /**
     * Versión dry-run del solver: acepta un PeriodoLectivo + PLIs virtuales
     * en el body (sin persistir) y devuelve los placements que el solver
     * habría producido. Lo usa la cola pendingActions del editor para
     * mostrar preview antes de Guardar (Tanda B "todo en preview").
     *
     * Body esperado:
     * {
     *   "rango": {
     *     "tempId": int,                    // id artificial (negativo recomendado)
     *     "fechaInicio": "YYYY-MM-DD",
     *     "fechaFin": "YYYY-MM-DD",
     *     "jornadaTipoId": int|null,        // null = hereda Grupo.jornadaTipoOverride
     *     "nombre": string|null,
     *     "plis": [
     *       { "imparticionId": int, "minutosSemanales": int|null }
     *     ]
     *   },
     *   "seed": int|null,
     *   "solver": "binpacking"|"ilp",
     *   "alreadyPlacedByImp": { "<impId>": minutosAnualesYaColocados, ... },
     *   "totalSemanasGrupoOverride": float|null
     * }
     */
    #[Route('/api/v1/horarios/solver-dry-run/{grupoId}', name: 'api_horarios_solver_dry_run', methods: ['POST'], requirements: ['grupoId' => '\d+'])]
    public function solveDryRun(
        int $grupoId,
        Request $request,
        EntityManagerInterface $em,
        HorarioSolver $solverIlp,
        HorarioSolverBinPacking $solverBinPacking,
    ): JsonResponse {
        if (!$this->isGranted('ROLE_ADMIN') && !$this->isGranted('ROLE_SUPERADMIN')) {
            return $this->json(['message' => 'Acceso denegado'], 403);
        }

        $grupo = $em->getRepository(Grupo::class)->find($grupoId);
        if (!$grupo) {
            return $this->json(['message' => 'Grupo no encontrado'], 404);
        }

        $data = json_decode($request->getContent(), true) ?: [];
        $rango = $data['rango'] ?? null;
        if (!is_array($rango) || empty($rango['fechaInicio']) || empty($rango['fechaFin'])) {
            return $this->json(['message' => 'rango.fechaInicio/fechaFin obligatorios'], 422);
        }

        $pl = $this->buildVirtualPeriodoLectivo($em, $grupo, $rango);
        $plis = $this->buildVirtualPlis($em, $pl, $rango['plis'] ?? []);

        $seed = isset($data['seed']) ? (int) $data['seed'] : null;
        $solverKind = isset($data['solver']) && $data['solver'] === 'ilp' ? 'ilp' : 'binpacking';

        $alreadyPlacedByImp = null;
        if (isset($data['alreadyPlacedByImp']) && is_array($data['alreadyPlacedByImp'])) {
            $alreadyPlacedByImp = [];
            foreach ($data['alreadyPlacedByImp'] as $impId => $min) {
                $alreadyPlacedByImp[(int) $impId] = (int) $min;
            }
        }
        $totalSemanasOverride = isset($data['totalSemanasGrupoOverride'])
            ? (float) $data['totalSemanasGrupoOverride'] : null;

        $result = $solverKind === 'ilp'
            ? $solverIlp->solve($grupo, $seed, $pl, $alreadyPlacedByImp, $plis, $totalSemanasOverride)
            : $solverBinPacking->solve($grupo, $seed, $pl, $alreadyPlacedByImp, $plis, $totalSemanasOverride);
        $result['solver'] = $solverKind;
        $result['dryRun'] = true;
        $result['tempId'] = $rango['tempId'] ?? null;
        return $this->json($result);
    }

    /**
     * Versión dry-run del distribuidor: acepta un array de PeriodoLectivos
     * virtuales y devuelve la distribución de minutos semanales por (rango,
     * imparticion) sin persistir nada. La clave de cada rango en
     * `distribution` es el `tempId` que el caller ha asignado.
     *
     * Body:
     * {
     *   "rangos": [
     *     { "tempId": int, "fechaInicio": "YYYY-MM-DD", "fechaFin": "YYYY-MM-DD",
     *       "jornadaTipoId": int|null, "nombre": string|null }, ...
     *   ]
     * }
     */
    #[Route('/api/v1/grupos/{grupoId}/distribute-curriculum-dry-run', name: 'api_grupo_distribute_curriculum_dry_run', methods: ['POST'], requirements: ['grupoId' => '\d+'])]
    public function distributeCurriculumDryRun(
        int $grupoId,
        Request $request,
        EntityManagerInterface $em,
        CurriculumDistributor $distributor,
    ): JsonResponse {
        if (!$this->isGranted('ROLE_ADMIN') && !$this->isGranted('ROLE_SUPERADMIN')) {
            return $this->json(['message' => 'Acceso denegado'], 403);
        }

        $grupo = $em->getRepository(Grupo::class)->find($grupoId);
        if (!$grupo) {
            return $this->json(['message' => 'Grupo no encontrado'], 404);
        }

        $data = json_decode($request->getContent(), true) ?: [];
        $rangos = $data['rangos'] ?? null;
        if (!is_array($rangos) || empty($rangos)) {
            return $this->json(['message' => 'rangos[] obligatorio'], 422);
        }

        $pls = [];
        foreach ($rangos as $rango) {
            if (empty($rango['fechaInicio']) || empty($rango['fechaFin'])) {
                return $this->json(['message' => 'cada rango requiere fechaInicio/fechaFin'], 422);
            }
            $pls[] = $this->buildVirtualPeriodoLectivo($em, $grupo, $rango);
        }

        $result = $distributor->distribute($grupo, $pls);
        $result['dryRun'] = true;
        return $this->json($result);
    }

    /**
     * Cabida del currículo en la PLANTILLA del grupo (modelo semanal puro,
     * Fase B 2026-05-06).
     *
     * Devuelve si la suma de `materia.minutosSemanales` de las imparticiones
     * presenciales (Modalidad::consumeAula) cabe en la jornada lectiva
     * semanal de la PLANTILLA (Σ tramos SLOT × días lectivos), junto con el
     * detalle por imparticion (cuota natural, cuota actual, modalidad) para
     * que el frontend prepare los PLI patches y dispare el solver sobre la
     * PLANTILLA real.
     *
     * Idempotente, no toca BD. Sustituye en el frontend la cadena
     * `plan-rangos` + `distribute-curriculum-dry-run` cuando el flujo es
     * "configurar curso óptimo" (ya no se crean rangos: la PLANTILLA es el
     * único objetivo).
     *
     * Doc: docs/hoja-de-ruta-modelo-semanal.md §12.
     */
    #[Route('/api/v1/grupos/{grupoId}/plantilla-cabida', name: 'api_grupo_plantilla_cabida', methods: ['GET'], requirements: ['grupoId' => '\d+'])]
    public function plantillaCabida(int $grupoId, EntityManagerInterface $em, PlantillaCabidaValidator $validator): JsonResponse
    {
        if (!$this->isGranted('ROLE_ADMIN') && !$this->isGranted('ROLE_SUPERADMIN')) {
            return $this->json(['message' => 'Acceso denegado'], 403);
        }

        $grupo = $em->getRepository(Grupo::class)->find($grupoId);
        if (!$grupo) {
            return $this->json(['message' => 'Grupo no encontrado'], 404);
        }

        return $this->json($validator->validate($grupo));
    }

    /**
     * Solver iterativo (Fase 1, 2026-05-01). Envuelve el bin-packing en un
     * bucle de pasadas que aplica REDUCIR_CUOTA_PROPIA in-memory cuando hay
     * unplaced, hasta cuadrar o agotar opciones. NO toca BD entre pasadas.
     *
     * Body:
     * {
     *   "periodoLectivoId": int|null,         // null = activo (resolver)
     *   "alreadyPlacedByImp": {impId: min},   // cap anual cross-rango
     *   "maxIterations": int (default 6),
     *   "totalSemanasGrupoOverride": float|null,
     *   "rangoOverride": { tempId, fechaInicio, fechaFin, jornadaTipoId, plis: [...] }|null
     *                                          // si presente, dry-run con PL virtual
     *                                          // (mismo formato que /solver-dry-run)
     * }
     *
     * Devuelve los campos de /solver/ + `iterationLog` + `diagnostic`. El
     * `diagnostic` en Fase 1 es stub; el clasificador real llega en Fase 2.
     *
     * Doc: docs/hoja-de-ruta-solver-iterativo.md Fase 1.
     */
    #[Route('/api/v1/horarios/solver-iterativo/{grupoId}', name: 'api_horarios_solver_iterativo', methods: ['POST'], requirements: ['grupoId' => '\d+'])]
    public function solveIterativo(
        int $grupoId,
        Request $request,
        EntityManagerInterface $em,
        HorarioSolverIterativo $solverIterativo,
    ): JsonResponse {
        if (!$this->isGranted('ROLE_ADMIN') && !$this->isGranted('ROLE_SUPERADMIN')) {
            return $this->json(['message' => 'Acceso denegado'], 403);
        }

        $grupo = $em->getRepository(Grupo::class)->find($grupoId);
        if (!$grupo) {
            return $this->json(['message' => 'Grupo no encontrado'], 404);
        }

        $data = json_decode($request->getContent(), true) ?: [];
        $seed = isset($data['seed']) ? (int) $data['seed'] : null;
        $maxIterations = isset($data['maxIterations']) ? max(1, min(20, (int) $data['maxIterations'])) : 6;

        $alreadyPlacedByImp = null;
        if (isset($data['alreadyPlacedByImp']) && is_array($data['alreadyPlacedByImp'])) {
            $alreadyPlacedByImp = [];
            foreach ($data['alreadyPlacedByImp'] as $impId => $min) {
                $alreadyPlacedByImp[(int) $impId] = (int) $min;
            }
        }
        $totalSemanasOverride = isset($data['totalSemanasGrupoOverride'])
            ? (float) $data['totalSemanasGrupoOverride'] : null;

        // Modo dry-run (PL virtual): si viene `rangoOverride`, construimos PL
        // + PLIs in-memory. Si no, resolvemos el PL real por id (o el activo).
        $periodoLectivo = null;
        $pliOverride = null;
        if (isset($data['rangoOverride']) && is_array($data['rangoOverride'])) {
            $rango = $data['rangoOverride'];
            if (empty($rango['fechaInicio']) || empty($rango['fechaFin'])) {
                return $this->json(['message' => 'rangoOverride.fechaInicio/fechaFin obligatorios'], 422);
            }
            $periodoLectivo = $this->buildVirtualPeriodoLectivo($em, $grupo, $rango);
            $pliOverride = $this->buildVirtualPlis($em, $periodoLectivo, $rango['plis'] ?? []);
        } elseif (isset($data['periodoLectivoId'])) {
            $pl = $em->getRepository(PeriodoLectivo::class)->find((int) $data['periodoLectivoId']);
            if ($pl === null || $pl->getGrupo()?->getId() !== $grupo->getId()) {
                return $this->json(['message' => 'PeriodoLectivo no encontrado o no pertenece al grupo'], 422);
            }
            $periodoLectivo = $pl;
        }

        $result = $solverIterativo->solveIterativo(
            $grupo,
            $seed,
            $periodoLectivo,
            $alreadyPlacedByImp,
            $pliOverride,
            $totalSemanasOverride,
            $maxIterations,
        );
        $result['solver'] = 'iterativo-fase1';
        if ($pliOverride !== null) {
            $result['dryRun'] = true;
            $result['tempId'] = $data['rangoOverride']['tempId'] ?? null;
        }
        return $this->json($result);
    }

    /**
     * Solver iterativo MULTI-RANGO (Fase 3.5, 2026-05-01). Acepta una lista
     * de PLs (reales por id o virtuales con rangoOverride) y los procesa en
     * orden cronológico, manteniendo el cap anual cumulativo entre ellos.
     * Reemplaza la lógica equivalente que vivía en `runSolverAllRangos`
     * frontend (loop con accumPlacedByImp local).
     *
     * Body:
     * {
     *   "rangos": [
     *     {
     *       "periodoLectivoId": int|null,             // resolver por id
     *       "rangoOverride": {tempId, fechaInicio, fechaFin, jornadaTipoId, plis}|null,  // virtual
     *     }, ...
     *   ],
     *   "seed": int|null,
     *   "maxIterations": int (default 6),
     *   "totalSemanasGrupoOverride": float|null
     * }
     *
     * Devuelve `{perPl: [...], accumPlacedByImp, elapsedSec, rangosCount}`.
     * Cada item de `perPl` incluye el resultado completo de `solveIterativo`
     * (placements, unplaced, complete, iterationLog, diagnostic, iterativo)
     * + metadata del PL (periodoLectivoId|tempId, plNombre, fechas, semanasPl).
     */
    #[Route('/api/v1/horarios/solver-iterativo-multi/{grupoId}', name: 'api_horarios_solver_iterativo_multi', methods: ['POST'], requirements: ['grupoId' => '\d+'])]
    public function solveIterativoMulti(
        int $grupoId,
        Request $request,
        EntityManagerInterface $em,
        HorarioSolverIterativo $solverIterativo,
    ): JsonResponse {
        if (!$this->isGranted('ROLE_ADMIN') && !$this->isGranted('ROLE_SUPERADMIN')) {
            return $this->json(['message' => 'Acceso denegado'], 403);
        }

        $grupo = $em->getRepository(Grupo::class)->find($grupoId);
        if (!$grupo) {
            return $this->json(['message' => 'Grupo no encontrado'], 404);
        }

        $data = json_decode($request->getContent(), true) ?: [];
        $rangosBody = $data['rangos'] ?? null;
        if (!is_array($rangosBody) || empty($rangosBody)) {
            return $this->json(['message' => 'rangos[] obligatorio'], 422);
        }

        $seed = isset($data['seed']) ? (int) $data['seed'] : null;
        $maxIterations = isset($data['maxIterations']) ? max(1, min(20, (int) $data['maxIterations'])) : 6;
        $totalSemanasOverride = isset($data['totalSemanasGrupoOverride'])
            ? (float) $data['totalSemanasGrupoOverride'] : null;

        // Resolver cada item del body a {periodoLectivo, pliOverride, tempId, plKey}.
        // periodoLectivoId → real PL de BD. rangoOverride → PL virtual + plis in-memory.
        $rangos = [];
        foreach ($rangosBody as $idx => $item) {
            if (!is_array($item)) {
                return $this->json(['message' => "rangos[$idx] no es objeto"], 422);
            }
            if (isset($item['rangoOverride']) && is_array($item['rangoOverride'])) {
                $r = $item['rangoOverride'];
                if (empty($r['fechaInicio']) || empty($r['fechaFin'])) {
                    return $this->json(['message' => "rangos[$idx].rangoOverride requiere fechaInicio/fechaFin"], 422);
                }
                $pl = $this->buildVirtualPeriodoLectivo($em, $grupo, $r);
                $plis = $this->buildVirtualPlis($em, $pl, $r['plis'] ?? []);
                $tempId = isset($r['tempId']) ? (int) $r['tempId'] : null;
                $rangos[] = [
                    'periodoLectivo' => $pl,
                    'pliOverride' => $plis,
                    'tempId' => $tempId,
                    'plKey' => 'temp:' . ($tempId ?? "idx$idx"),
                ];
            } elseif (isset($item['periodoLectivoId'])) {
                $pl = $em->getRepository(PeriodoLectivo::class)->find((int) $item['periodoLectivoId']);
                if ($pl === null || $pl->getGrupo()?->getId() !== $grupo->getId()) {
                    return $this->json(['message' => "rangos[$idx].periodoLectivoId no pertenece al grupo"], 422);
                }
                $rangos[] = [
                    'periodoLectivo' => $pl,
                    'pliOverride' => null,
                    'tempId' => null,
                    'plKey' => 'real:' . $pl->getId(),
                ];
            } else {
                return $this->json(['message' => "rangos[$idx] debe traer periodoLectivoId o rangoOverride"], 422);
            }
        }

        $result = $solverIterativo->solveMultiRango(
            $grupo,
            $rangos,
            $seed,
            $totalSemanasOverride,
            $maxIterations,
        );
        $result['solver'] = 'iterativo-multi-fase35';
        return $this->json($result);
    }

    /**
     * Devuelve la propuesta dinámica de rangos lectivos óptima para un grupo.
     *
     * Reemplaza el hard-code N=3 del frontend (`createRangosCount`). El
     * planner combina calendario real, horas curriculares y evaluaciones
     * configuradas para decidir cuántos rangos crear y con qué fechas.
     *
     * Output: lista de rangos sugeridos + diagnóstico (semanas lectivas,
     * curriculum vs capacidad, si requiere extender).
     *
     * Doc: `docs/hoja-de-ruta-solver-iterativo.md` Fase B (2026-05-05).
     */
    #[Route('/api/v1/grupos/{grupoId}/plan-rangos', name: 'api_grupo_plan_rangos', methods: ['GET'], requirements: ['grupoId' => '\d+'])]
    public function planRangos(
        int $grupoId,
        EntityManagerInterface $em,
        PeriodoLectivoPlanner $planner,
    ): JsonResponse {
        $grupo = $em->getRepository(Grupo::class)->find($grupoId);
        if (!$grupo) {
            return $this->json(['error' => 'Grupo no encontrado'], 404);
        }
        return $this->json($planner->plan($grupo));
    }

    /**
     * Construye un `PeriodoLectivo` in-memory con un id artificial (vía
     * Reflection) para que el solver/distributor lo traten como uno real.
     * Solo se usa en endpoints dry-run; nunca se persiste.
     */
    private function buildVirtualPeriodoLectivo(EntityManagerInterface $em, Grupo $grupo, array $rango): PeriodoLectivo
    {
        $pl = new PeriodoLectivo();
        $pl->setGrupo($grupo);
        $pl->setNombre($rango['nombre'] ?? sprintf('Virtual %s', $rango['tempId'] ?? '?'));
        $pl->setFechaInicio(new \DateTime($rango['fechaInicio']));
        $pl->setFechaFin(new \DateTime($rango['fechaFin']));
        if (!empty($rango['jornadaTipoId'])) {
            $jornada = $em->getRepository(JornadaTipo::class)->find((int) $rango['jornadaTipoId']);
            if ($jornada) {
                $pl->setJornadaTipo($jornada);
            }
        }
        // Asignar id artificial: el solver/distributor usan `getId()` como key
        // de array. Si fuera null, las claves colisionarían entre rangos.
        $tempId = isset($rango['tempId']) ? (int) $rango['tempId'] : null;
        if ($tempId !== null) {
            $ref = new \ReflectionProperty(PeriodoLectivo::class, 'id');
            $ref->setValue($pl, $tempId);
        }
        return $pl;
    }

    /**
     * Construye los `PeriodoLectivoImparticion` in-memory para un rango
     * virtual. Cada `plis[]` referencia una `Imparticion` real (existe en BD)
     * por id; el `minutosSemanales` se aplica como override del rango.
     *
     * @return array<PeriodoLectivoImparticion>
     */
    private function buildVirtualPlis(EntityManagerInterface $em, PeriodoLectivo $pl, array $plisData): array
    {
        $impRepo = $em->getRepository(Imparticion::class);
        $out = [];
        foreach ($plisData as $p) {
            $impId = (int) ($p['imparticionId'] ?? 0);
            if ($impId <= 0) continue;
            $imp = $impRepo->find($impId);
            if (!$imp || $imp->isDeleted()) continue;
            $pli = new PeriodoLectivoImparticion();
            $pli->setPeriodoLectivo($pl);
            $pli->setImparticion($imp);
            if (array_key_exists('minutosSemanales', $p) && $p['minutosSemanales'] !== null) {
                $pli->setMinutosSemanales((int) $p['minutosSemanales']);
            }
            $out[] = $pli;
        }
        return $out;
    }
}
