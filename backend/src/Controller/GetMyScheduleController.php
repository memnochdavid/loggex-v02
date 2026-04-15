<?php

namespace App\Controller;

use App\Entity\Horario;
use App\Entity\User;
use Doctrine\ORM\EntityManagerInterface;
use Symfony\Bundle\FrameworkBundle\Controller\AbstractController;
use Symfony\Component\HttpFoundation\JsonResponse;
use Symfony\Component\Routing\Attribute\Route;
use Symfony\Component\Security\Http\Attribute\CurrentUser;

class GetMyScheduleController extends AbstractController
{
    #[Route('/api/my-schedule', name: 'api_my_schedule', methods: ['GET'])]
    public function __invoke(#[CurrentUser] ?User $user, EntityManagerInterface $entityManager): JsonResponse
    {
        if (!$user) {
            return $this->json(['message' => 'No autenticado'], 401);
        }

        $horarios = [];
        $roles = $user->getRoles();
        $userId = $user->getId();

        // 1. Buscar como ALUMNO
        if (in_array('ROLE_ALUMNO', $roles)) {
            $dql = "SELECT h, i, m, g, p
                    FROM App\Entity\Horario h
                    JOIN h.imparticion i
                    JOIN i.modulo m
                    JOIN i.grupo g
                    JOIN g.matriculas mat
                    LEFT JOIN i.profesor p
                    WHERE mat.alumno = :userId AND h.deleted = false";

            $query = $entityManager->createQuery($dql)->setParameter('userId', $userId);
            $horarios = array_merge($horarios, $query->getResult());
        }

        // 2. Buscar como PROFESOR/ADMIN
        if (in_array('ROLE_PROFESOR', $roles) || in_array('ROLE_ADMIN', $roles) || in_array('ROLE_SUPERADMIN', $roles)) {
            // Usamos IDENTITY() o comparamos con el ID de la relación para ser explícitos
            $dql = "SELECT h, i, m, g
                    FROM App\Entity\Horario h
                    JOIN h.imparticion i
                    JOIN i.modulo m
                    JOIN i.grupo g
                    WHERE i.profesor = :userId AND h.deleted = false";

            $query = $entityManager->createQuery($dql)->setParameter('userId', $userId);
            $resultadosProfesor = $query->getResult();

            // Fusionar
            foreach ($resultadosProfesor as $rp) {
                $existe = false;
                foreach ($horarios as $h) {
                    if ($h->getId() === $rp->getId()) {
                        $existe = true;
                        break;
                    }
                }
                if (!$existe) {
                    $horarios[] = $rp;
                }
            }
        }

        $data = [];
        foreach ($horarios as $h) {
            $grupo = $h->getImparticion()->getGrupo();
            $profesorNombre = 'Sin asignar';
            if ($h->getImparticion()->getProfesor()) {
                $profesorNombre = $h->getImparticion()->getProfesor()->getNombre() . ' ' . $h->getImparticion()->getProfesor()->getApellidos();
            }

            $data[] = [
                'id' => $h->getId(),
                'diaSemana' => $h->getDiaSemana(),
                'horaInicio' => $h->getHoraInicio()->format('H:i'),
                'horaFin' => $h->getHoraFin()->format('H:i'),
                'aula' => $h->getAula(),
                'modulo' => $h->getImparticion()->getModulo()->getNombre(),
                'moduloId' => $h->getImparticion()->getModulo()->getId(),
                'grupo' => $grupo->getNombre(),
                'grupoAbreviatura' => $grupo->getAbreviatura(),
                'profesor' => $profesorNombre,
                'imparticionId' => $h->getImparticion()->getId()
            ];
        }

        return $this->json($data);
    }
}
