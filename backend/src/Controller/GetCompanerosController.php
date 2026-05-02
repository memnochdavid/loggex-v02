<?php

namespace App\Controller;

use App\Entity\User;
use App\Entity\Matricula;
use Doctrine\ORM\EntityManagerInterface;
use Symfony\Bundle\FrameworkBundle\Controller\AbstractController;
use Symfony\Component\HttpFoundation\JsonResponse;
use Symfony\Component\Routing\Attribute\Route;
use Symfony\Component\Security\Http\Attribute\CurrentUser;

class GetCompanerosController extends AbstractController
{
    #[Route('/api/v1/alumno/companeros', name: 'api_alumno_companeros', methods: ['GET'])]
    public function __invoke(#[CurrentUser] ?User $user, EntityManagerInterface $entityManager): JsonResponse
    {
        if (!$user) {
            return $this->json(['message' => 'No autenticado'], 401);
        }

        // 1. Obtener los grupos del alumno
        $matriculas = $entityManager->getRepository(Matricula::class)->findBy(['alumno' => $user]);
        $grupos = [];
        foreach ($matriculas as $m) {
            $grupos[] = $m->getGrupo();
        }

        if (empty($grupos)) {
            return $this->json([]);
        }

        // 2. Buscar otros alumnos en esos grupos
        $qb = $entityManager->createQueryBuilder();
        $qb->select('m', 'u', 'g')
           ->from(Matricula::class, 'm')
           ->join('m.alumno', 'u')
           ->join('m.grupo', 'g')
           ->where('m.grupo IN (:grupos)')
           ->andWhere('u.id != :userId')
           ->setParameter('grupos', $grupos)
           ->setParameter('userId', $user->getId())
           ->orderBy('u.apellidos', 'ASC');

        $matriculasCompaneros = $qb->getQuery()->getResult();

        $companeros = [];
        foreach ($matriculasCompaneros as $matricula) {
            $alumno = $matricula->getAlumno();
            $grupo = $matricula->getGrupo();
            $id = $alumno->getId();

            if (!isset($companeros[$id])) {
                $companeros[$id] = [
                    'id' => $id,
                    'nombre' => $alumno->getNombre(),
                    'apellidos' => $alumno->getApellidos(),
                    'email' => $alumno->getEmail(),
                    'foto' => $alumno->getFoto(),
                    'grupos' => []
                ];
            }
            // Evitar duplicados de grupo (clave: id del grupo). Devolvemos objeto
            // {curso, nombre, abreviatura} para que el frontend pueda formatearlo
            // con `formatGrupoNombre` ("1º DAW") en lugar de mostrar solo el
            // nombre suelto.
            $grupoId = $grupo->getId();
            $yaIncluido = false;
            foreach ($companeros[$id]['grupos'] as $g) {
                if (($g['id'] ?? null) === $grupoId) { $yaIncluido = true; break; }
            }
            if (!$yaIncluido) {
                $companeros[$id]['grupos'][] = [
                    'id' => $grupoId,
                    'curso' => $grupo->getCurso(),
                    'nombre' => $grupo->getNombre(),
                    'abreviatura' => $grupo->getAbreviatura(),
                ];
            }
        }

        return $this->json(array_values($companeros));
    }
}
