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

        if (in_array('ROLE_ALUMNO', $user->getRoles())) {
            $qb = $entityManager->createQueryBuilder();
            $qb->select('h', 'i', 'm', 'g', 'p')
               ->from(Horario::class, 'h')
               ->join('h.imparticion', 'i')
               ->join('i.modulo', 'm')
               ->join('i.grupo', 'g')
               ->join('g.matriculas', 'mat')
               ->leftJoin('i.profesor', 'p')
               ->where('mat.alumno = :user')
               ->setParameter('user', $user);

            $horarios = $qb->getQuery()->getResult();

        } elseif (in_array('ROLE_PROFESOR', $user->getRoles())) {
            $qb = $entityManager->createQueryBuilder();
            $qb->select('h', 'i', 'm', 'g')
               ->from(Horario::class, 'h')
               ->join('h.imparticion', 'i')
               ->join('i.modulo', 'm')
               ->join('i.grupo', 'g')
               ->where('i.profesor = :user')
               ->setParameter('user', $user);

            $horarios = $qb->getQuery()->getResult();
        }

        $data = [];
        foreach ($horarios as $h) {
            /** @var Horario $h */
            $grupo = $h->getImparticion()->getGrupo();
            $data[] = [
                'id' => $h->getId(),
                'diaSemana' => $h->getDiaSemana(),
                'horaInicio' => $h->getHoraInicio()->format('H:i'),
                'horaFin' => $h->getHoraFin()->format('H:i'),
                'aula' => $h->getAula(),
                'modulo' => $h->getImparticion()->getModulo()->getNombre(),
                'grupo' => $grupo->getNombre(),
                'grupoAbreviatura' => $grupo->getAbreviatura(),
                'profesor' => $h->getImparticion()->getProfesor() ?
                    $h->getImparticion()->getProfesor()->getNombre() . ' ' . $h->getImparticion()->getProfesor()->getApellidos() :
                    'Sin asignar',
                'imparticionId' => $h->getImparticion()->getId() // Añadido
            ];
        }

        return $this->json($data);
    }
}
