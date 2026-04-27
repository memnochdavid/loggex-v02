<?php

namespace App\Controller;

use App\Entity\Grupo;
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

        $result = $solver->solve($grupo, $seed);
        return $this->json($result);
    }

    #[Route('/api/v1/horarios/capacity-check/{grupoId}', name: 'api_horarios_capacity_check', methods: ['GET'], requirements: ['grupoId' => '\d+'])]
    public function capacityCheck(int $grupoId, EntityManagerInterface $em, CapacityPlanner $planner): JsonResponse
    {
        if (!$this->isGranted('ROLE_ADMIN') && !$this->isGranted('ROLE_SUPERADMIN')) {
            return $this->json(['message' => 'Acceso denegado'], 403);
        }

        $grupo = $em->getRepository(Grupo::class)->find($grupoId);
        if (!$grupo) {
            return $this->json(['message' => 'Grupo no encontrado'], 404);
        }

        return $this->json($planner->plan($grupo));
    }
}
