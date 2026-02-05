<?php

namespace App\Controller;

use App\Entity\Imparticion;
use App\Entity\Matricula;
use App\Entity\User;
use Doctrine\ORM\EntityManagerInterface;
use Symfony\Bundle\FrameworkBundle\Controller\AbstractController;
use Symfony\Component\HttpFoundation\JsonResponse;
use Symfony\Component\Routing\Attribute\Route;
use Symfony\Component\Security\Http\Attribute\CurrentUser;

class GetProfesorAlumnosController extends AbstractController
{
    #[Route('/api/v1/profesor/alumnos', name: 'api_profesor_alumnos', methods: ['GET'])]
    public function __invoke(#[CurrentUser] ?User $user, EntityManagerInterface $entityManager): JsonResponse
    {
        if (!$user || !in_array('ROLE_PROFESOR', $user->getRoles())) {
            return $this->json(['message' => 'No autorizado'], 403);
        }

        // 1. Obtener grupos donde imparte el profesor
        $imparticiones = $entityManager->getRepository(Imparticion::class)->findBy(['profesor' => $user]);

        $gruposMap = [];
        foreach ($imparticiones as $imp) {
            $grupo = $imp->getGrupo();
            $grupoId = $grupo->getId();

            if (!isset($gruposMap[$grupoId])) {
                $gruposMap[$grupoId] = [
                    'id' => $grupoId,
                    'nombre' => $grupo->getNombre(),
                    'abreviatura' => $grupo->getAbreviatura(),
                    'alumnos' => []
                ];
            }
        }

        if (empty($gruposMap)) {
            return $this->json([]);
        }

        // 2. Obtener alumnos de esos grupos
        // Podríamos hacer una query por grupo, o una IN (...)
        $grupoIds = array_keys($gruposMap);

        $qb = $entityManager->createQueryBuilder();
        $qb->select('m', 'u', 'g')
           ->from(Matricula::class, 'm')
           ->join('m.alumno', 'u')
           ->join('m.grupo', 'g')
           ->where('g.id IN (:grupoIds)')
           ->andWhere('u.deleted = 0')
           ->setParameter('grupoIds', $grupoIds)
           ->orderBy('u.apellidos', 'ASC');

        $matriculas = $qb->getQuery()->getResult();

        foreach ($matriculas as $matricula) {
            $grupoId = $matricula->getGrupo()->getId();
            $alumno = $matricula->getAlumno();

            // Evitar duplicados si el alumno está matriculado varias veces en el mismo grupo (no debería pasar, pero por si acaso)
            // Usamos el ID del alumno como clave temporal para unicidad dentro del grupo
            $alumnoId = $alumno->getId();

            // Comprobamos si ya está añadido a este grupo
            $exists = false;
            foreach ($gruposMap[$grupoId]['alumnos'] as $a) {
                if ($a['id'] === $alumnoId) {
                    $exists = true;
                    break;
                }
            }

            if (!$exists) {
                $gruposMap[$grupoId]['alumnos'][] = [
                    'id' => $alumno->getId(),
                    'nombre' => $alumno->getNombre(),
                    'apellidos' => $alumno->getApellidos(),
                    'email' => $alumno->getEmail(),
                    'foto' => $alumno->getFoto(),
                    'telefono' => $alumno->getTelefono()
                ];
            }
        }

        // Convertir a array indexado y ordenar grupos por nombre
        $result = array_values($gruposMap);
        usort($result, function($a, $b) {
            return strcmp($a['nombre'], $b['nombre']);
        });

        return $this->json($result);
    }
}
