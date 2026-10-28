<?php

namespace App\Controller;

use App\Entity\User;
use App\Repository\NotificacionRepository;
use Symfony\Bundle\FrameworkBundle\Controller\AbstractController;
use Symfony\Component\HttpFoundation\JsonResponse;
use Symfony\Component\Routing\Attribute\Route;
use Symfony\Component\Security\Http\Attribute\CurrentUser;

/**
 * Marca como leídas todas las notificaciones no leídas del usuario actual.
 *
 * Operación idempotente: llamarla dos veces seguidas afecta a 0 la segunda
 * vez. Devuelve `{ marcadas: int }`.
 *
 * No usamos PATCH masivo del recurso API Platform (que cambiaría una a una
 * con N llamadas) — un único endpoint custom es suficiente y barato.
 *
 * Doc: docs/hoja-de-ruta-notificaciones.md §1.3.
 */
class MarcarNotificacionesLeidasController extends AbstractController
{
    public function __construct(
        private readonly NotificacionRepository $repo,
    ) {
    }

    #[Route('/api/notificacions/marcar-todas-leidas', name: 'api_notificacions_marcar_todas_leidas', methods: ['POST'])]
    public function __invoke(#[CurrentUser] ?User $user): JsonResponse
    {
        if (!$user) {
            return $this->json(['error' => 'No autenticado'], 401);
        }

        $marcadas = $this->repo->markAllReadFor($user);

        return $this->json([
            'marcadas' => $marcadas,
        ]);
    }
}
