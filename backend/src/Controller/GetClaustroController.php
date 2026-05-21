<?php

namespace App\Controller;

use App\Entity\Centro;
use App\Entity\User;
use Doctrine\ORM\EntityManagerInterface;
use Symfony\Bundle\FrameworkBundle\Controller\AbstractController;
use Symfony\Component\HttpFoundation\JsonResponse;
use Symfony\Component\HttpFoundation\Request;
use Symfony\Component\Routing\Attribute\Route;
use Symfony\Component\Security\Http\Attribute\CurrentUser;

class GetClaustroController extends AbstractController
{
    #[Route('/api/v1/profesor/claustro', name: 'api_profesor_claustro', methods: ['GET'])]
    public function __invoke(#[CurrentUser] ?User $user, EntityManagerInterface $entityManager, Request $request): JsonResponse
    {
        if (!$user) {
            return $this->json(['message' => 'No autenticado'], 401);
        }

        $isSuperAdmin = in_array('ROLE_SUPERADMIN', $user->getRoles(), true);

        // SuperAdmin puede pasar ?centroId para filtrar por centro
        $centroId = $isSuperAdmin ? $request->query->get('centroId') : null;
        $centro = $user->getCentro();

        if ($centroId) {
            $centro = $entityManager->getRepository(Centro::class)->find($centroId);
        }

        if (!$centro && !$isSuperAdmin) {
            return $this->json([]);
        }

        $qb = $entityManager->createQueryBuilder();
        $qb->select('u')
           ->from(User::class, 'u')
           ->where('u.deleted = 0');

        if ($centro) {
            $qb->andWhere('u.centro = :centro')
               ->setParameter('centro', $centro);
        }

        // Buscar usuarios que tengan ROLE_PROFESOR o ROLE_ADMIN en su JSON de roles
        // Nota: En MySQL/MariaDB JSON se busca con LIKE '%"ROLE_..."%' si es texto plano
        $qb->andWhere('u.roles LIKE :roleProfesor OR u.roles LIKE :roleAdmin')
           ->setParameter('roleProfesor', '%"ROLE_PROFESOR"%')
           ->setParameter('roleAdmin', '%"ROLE_ADMIN"%');

        $qb->orderBy('u.apellidos', 'ASC')
           ->addOrderBy('u.nombre', 'ASC');

        $profesores = $qb->getQuery()->getResult();

        $data = [];
        foreach ($profesores as $p) {
            $data[] = [
                'id' => $p->getId(),
                'nombre' => $p->getNombre(),
                'apellidos' => $p->getApellidos(),
                'email' => $p->getEmail(),
                'telefono' => $p->getTelefono(),
                'foto' => $p->getFoto(),
                'centro' => $p->getCentro() ? $p->getCentro()->getNombre() : null,
                'roles' => $p->getRoles() // Opcional: para mostrar etiquetas en el frontend
            ];
        }

        return $this->json($data);
    }
}
