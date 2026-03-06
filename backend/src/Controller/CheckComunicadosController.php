<?php

namespace App\Controller;

use App\Repository\ComunicadoRepository;
use Symfony\Bundle\FrameworkBundle\Controller\AbstractController;
use Symfony\Component\HttpFoundation\JsonResponse;
use Symfony\Component\Routing\Attribute\Route;

class CheckComunicadosController extends AbstractController
{
    #[Route('/api/check-comunicados', name: 'app_check_comunicados')]
    public function index(ComunicadoRepository $repository): JsonResponse
    {
        $all = $repository->findAll();
        return $this->json([
            'count' => count($all),
            'items' => array_map(fn($c) => [
                'id' => $c->getId(),
                'titulo' => $c->getTitulo(),
                'autor' => $c->getAutor() ? $c->getAutor()->getEmail() : 'null',
                'centro' => $c->getCentro() ? $c->getCentro()->getNombre() : 'null',
                'deleted' => method_exists($c, 'isDeleted') ? $c->isDeleted() : 'n/a'
            ], $all)
        ]);
    }
}
