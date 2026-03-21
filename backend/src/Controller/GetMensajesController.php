<?php

namespace App\Controller;

use App\Entity\Mensaje;
use App\Entity\User;
use Doctrine\ORM\EntityManagerInterface;
use Symfony\Bundle\FrameworkBundle\Controller\AbstractController;
use Symfony\Component\HttpFoundation\JsonResponse;
use Symfony\Component\Routing\Attribute\Route;
use Symfony\Component\Security\Http\Attribute\CurrentUser;

class GetMensajesController extends AbstractController
{
    #[Route('/api/v1/mensajes', name: 'api_v1_mensajes', methods: ['GET'])]
    public function __invoke(#[CurrentUser] ?User $user, EntityManagerInterface $entityManager): JsonResponse
    {
        if (!$user) {
            return $this->json(['message' => 'No autenticado'], 401);
        }

        try {
            $qb = $entityManager->createQueryBuilder();
            $qb->select('m', 'r', 'd')
               ->from(Mensaje::class, 'm')
               ->leftJoin('m.remitente', 'r')
               ->leftJoin('m.destinatario', 'd')
               ->where('m.remitente = :user OR m.destinatario = :user')
               ->setParameter('user', $user)
               ->orderBy('m.fechaEnvio', 'DESC');

            $mensajes = $qb->getQuery()->getResult();

            $data = [];
            foreach ($mensajes as $m) {
                $data[] = [
                    'id' => $m->getId(),
                    'texto' => $m->getTexto(),
                    'fechaEnvio' => $m->getFechaEnvio()->format('Y-m-d H:i:s'),
                    'leido' => $m->isLeido(),
                    'remitente' => [
                        'id' => $m->getRemitente()->getId(),
                        'nombre' => $m->getRemitente()->getNombre(),
                        'apellidos' => $m->getRemitente()->getApellidos(),
                        'foto' => $m->getRemitente()->getFoto()
                    ],
                    'destinatario' => [
                        'id' => $m->getDestinatario()->getId(),
                        'nombre' => $m->getDestinatario()->getNombre(),
                        'apellidos' => $m->getDestinatario()->getApellidos(),
                        'foto' => $m->getDestinatario()->getFoto()
                    ]
                ];
            }

            return $this->json($data);

        } catch (\Exception $e) {
            return $this->json([
                'error' => 'Error interno del servidor'
            ], 500);
        }
    }
}
