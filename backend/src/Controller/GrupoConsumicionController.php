<?php

namespace App\Controller;

use App\Entity\Grupo;
use App\Service\ConsumicionAnualService;
use Symfony\Bundle\FrameworkBundle\Controller\AbstractController;
use Symfony\Component\HttpFoundation\JsonResponse;
use Symfony\Component\HttpFoundation\Request;
use Symfony\Component\Routing\Attribute\Route;

/**
 * Endpoint para el dashboard "Consumición de horas anuales" (Fase 8 PL).
 *
 * Doc: docs/hoja-de-ruta-periodos-lectivos.md §3 Fase 8
 */
class GrupoConsumicionController extends AbstractController
{
    /**
     *   GET /api/v1/grupos/{id}/consumicion-anual
     *     ?fechaReferencia=YYYY-MM-DD   (opcional, default = hoy)
     */
    #[Route('/api/v1/grupos/{id}/consumicion-anual', name: 'api_grupo_consumicion_anual', methods: ['GET'])]
    public function __invoke(Grupo $grupo, Request $request, ConsumicionAnualService $service): JsonResponse
    {
        $fechaQ = $request->query->get('fechaReferencia');
        $fecha = null;
        if ($fechaQ) {
            try {
                $fecha = new \DateTime($fechaQ);
            } catch (\Exception) {
                return $this->json(['message' => 'fechaReferencia inválida (esperado YYYY-MM-DD)'], 400);
            }
        }
        return $this->json($service->computeForGrupo($grupo, $fecha));
    }
}
