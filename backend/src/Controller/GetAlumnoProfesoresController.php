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

class GetAlumnoProfesoresController extends AbstractController
{
    #[Route('/api/v1/alumno/profesores', name: 'api_alumno_profesores', methods: ['GET'])]
    public function __invoke(#[CurrentUser] ?User $user, EntityManagerInterface $entityManager): JsonResponse
    {
        if (!$user) {
            return $this->json(['message' => 'No autenticado'], 401);
        }

        $profesoresMap = [];

        // 1. Obtener profesores de las asignaturas (imparticiones)
        $matriculas = $entityManager->getRepository(Matricula::class)->findBy(['alumno' => $user]);
        $grupos = [];
        foreach ($matriculas as $m) {
            $grupos[] = $m->getGrupo();
        }

        if (!empty($grupos)) {
            $imparticiones = $entityManager->getRepository(Imparticion::class)->findBy(['grupo' => $grupos]);
            foreach ($imparticiones as $imp) {
                $profesor = $imp->getProfesor();
                if ($profesor) {
                    $id = $profesor->getId();
                    if (!isset($profesoresMap[$id])) {
                        $profesoresMap[$id] = [
                            'user' => $profesor,
                            'asignaturas' => []
                        ];
                    }
                    $profesoresMap[$id]['asignaturas'][] = $imp->getModulo()->getNombre();
                }
            }
        }

        // 2. Obtener administradores del centro
        if ($user->getCentro()) {
            $qb = $entityManager->createQueryBuilder();
            $qb->select('u')
               ->from(User::class, 'u')
               ->where('u.centro = :centro')
               ->andWhere('u.roles LIKE :roleAdmin')
               ->setParameter('centro', $user->getCentro())
               ->setParameter('roleAdmin', '%"ROLE_ADMIN"%');

            $admins = $qb->getQuery()->getResult();

            foreach ($admins as $admin) {
                $id = $admin->getId();
                if (!isset($profesoresMap[$id])) {
                    $profesoresMap[$id] = [
                        'user' => $admin,
                        'asignaturas' => []
                    ];
                }
                // Marcamos como admin si no tiene asignaturas (o añadimos etiqueta)
            }
        }

        // Formatear respuesta
        $data = [];
        foreach ($profesoresMap as $item) {
            $p = $item['user'];
            $data[] = [
                'id' => $p->getId(),
                'nombre' => $p->getNombre(),
                'apellidos' => $p->getApellidos(),
                'email' => $p->getEmail(),
                'foto' => $p->getFoto(),
                'asignaturas' => array_unique($item['asignaturas']),
                'esAdmin' => in_array('ROLE_ADMIN', $p->getRoles())
            ];
        }

        // Ordenar
        usort($data, function($a, $b) {
            return strcmp($a['apellidos'], $b['apellidos']);
        });

        return $this->json($data);
    }
}
