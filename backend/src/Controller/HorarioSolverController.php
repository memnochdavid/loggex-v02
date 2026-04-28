<?php

namespace App\Controller;

use App\Entity\Grupo;
use App\Entity\PeriodoLectivo;
use App\Service\CapacityPlanner;
use App\Service\HorarioSolver;
use Doctrine\ORM\EntityManagerInterface;
use Symfony\Bundle\FrameworkBundle\Controller\AbstractController;
use Symfony\Component\HttpFoundation\JsonResponse;
use Symfony\Component\HttpFoundation\Request;
use Symfony\Component\Routing\Attribute\Route;

class HorarioSolverController extends AbstractController
{
    #[Route('/api/v1/horarios/solver/{grupoId}', name: 'api_horarios_solver', methods: ['POST'], requirements: ['grupoId' => '\d+'])]
    public function solve(int $grupoId, Request $request, EntityManagerInterface $em, HorarioSolver $solver): JsonResponse
    {
        if (!$this->isGranted('ROLE_ADMIN') && !$this->isGranted('ROLE_SUPERADMIN')) {
            return $this->json(['message' => 'Acceso denegado'], 403);
        }

        $grupo = $em->getRepository(Grupo::class)->find($grupoId);
        if (!$grupo) {
            return $this->json(['message' => 'Grupo no encontrado'], 404);
        }

        $data = json_decode($request->getContent(), true) ?: [];
        $seed = isset($data['seed']) ? (int) $data['seed'] : null;

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

        $result = $solver->solve($grupo, $seed, $periodoLectivo);
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
}
