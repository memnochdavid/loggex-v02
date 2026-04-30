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
