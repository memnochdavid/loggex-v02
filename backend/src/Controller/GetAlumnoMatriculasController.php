<?php

namespace App\Controller;

use App\Entity\Matricula;
use App\Entity\User;
use Doctrine\ORM\EntityManagerInterface;
use Symfony\Bundle\FrameworkBundle\Controller\AbstractController;
use Symfony\Component\HttpFoundation\JsonResponse;
use Symfony\Component\Routing\Attribute\Route;
use Symfony\Component\Security\Http\Attribute\CurrentUser;

class GetAlumnoMatriculasController extends AbstractController
{
    #[Route('/api/v1/alumno/matriculas', name: 'api_alumno_matriculas', methods: ['GET'])]
    public function __invoke(#[CurrentUser] ?User $user, EntityManagerInterface $entityManager): JsonResponse
    {
        if (!$user) {
            return $this->json(['message' => 'No autenticado'], 401);
        }

        $matriculas = $entityManager->getRepository(Matricula::class)->findBy(['alumno' => $user]);

        $data = [];
        foreach ($matriculas as $matricula) {
            $grupo = $matricula->getGrupo();
            $itinerario = $grupo->getItinerario();

            $data[] = [
                'id' => $matricula->getId(),
                'grupo' => [
                    'nombre' => $grupo->getNombre(),
                    'curso' => $grupo->getCurso(),
                    'anioEscolar' => $grupo->getAnioEscolar(),
                    'ciclo' => [
                        'nombre' => $itinerario->getNombre()
                    ]
                ]
            ];
        }

        return $this->json($data);
    }
}
