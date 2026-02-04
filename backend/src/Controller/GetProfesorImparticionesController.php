<?php

namespace App\Controller;

use App\Entity\Imparticion;
use App\Entity\User;
use Doctrine\ORM\EntityManagerInterface;
use Symfony\Bundle\FrameworkBundle\Controller\AbstractController;
use Symfony\Component\HttpFoundation\JsonResponse;
use Symfony\Component\Routing\Attribute\Route;
use Symfony\Component\Security\Http\Attribute\CurrentUser;

class GetProfesorImparticionesController extends AbstractController
{
    #[Route('/api/v1/profesor/imparticiones', name: 'api_profesor_imparticiones', methods: ['GET'])]
    public function __invoke(#[CurrentUser] ?User $user, EntityManagerInterface $entityManager): JsonResponse
    {
        if (!$user || !in_array('ROLE_PROFESOR', $user->getRoles())) {
            return $this->json(['message' => 'No autorizado'], 403);
        }

        $imparticiones = $entityManager->getRepository(Imparticion::class)->findBy(['profesor' => $user]);

        $data = [];
        foreach ($imparticiones as $imparticion) {
            $grupo = $imparticion->getGrupo();
            $modulo = $imparticion->getModulo();

            $data[] = [
                'id' => $imparticion->getId(),
                'modulo' => [
                    'nombre' => $modulo->getNombre()
                ],
                'grupo' => [
                    'nombre' => $grupo->getNombre(),
                    'curso' => $grupo->getCurso()
                ]
            ];
        }

        return $this->json($data);
    }
}
