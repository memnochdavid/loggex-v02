<?php

namespace App\Controller;

use Symfony\Bundle\FrameworkBundle\Controller\AbstractController;
use Symfony\Component\HttpFoundation\JsonResponse;
//use Symfony\Component\Routing\Annotation\Route;
use Symfony\Component\Routing\Attribute\Route;

class ApiController extends AbstractController
{
    #[Route('/api/hello', name: 'api_hello', methods: ['GET'])]
    public function index(): JsonResponse
    {
        return $this->json([
            'message' => '¡Hola desde Symfony Backend!',
            'timestamp' => time(),
        ]);
    }
}
