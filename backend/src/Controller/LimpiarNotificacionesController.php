<?php

namespace App\Controller;

use App\Entity\User;
use App\Repository\NotificacionRepository;
use Symfony\Bundle\FrameworkBundle\Controller\AbstractController;
use Symfony\Component\HttpFoundation\JsonResponse;
use Symfony\Component\Routing\Attribute\Route;
use Symfony\Component\Security\Http\Attribute\CurrentUser;

/**
 * Borra (hard-delete) todas las notificaciones del usuario actual. Devuelve
 * `{ borradas: int }`.
 *
 * Hard-delete por diseño: las notificaciones son el "pulse" del evento (la
 * calificación / tarea / comunicado original sigue persistiendo en su
 * entidad). No hay valor de auditoría en mantener notificaciones leídas y
 * archivadas — al usuario le sirve "limpiar la bandeja".
 *
 * Operación idempotente: llamarla con la bandeja vacía devuelve 0.
 *
 * Doc: docs/hoja-de-ruta-notificaciones.md §1.3 (ampliado 2026-05-09 con
 * "limpiar todas").
 */
class LimpiarNotificacionesController extends AbstractController
{
    public function __construct(
        private readonly NotificacionRepository $repo,
    ) {
    }

    #[Route('/api/notificacions/limpiar-todas', name: 'api_notificacions_limpiar_todas', methods: ['POST'])]
    public function __invoke(#[CurrentUser] ?User $user): JsonResponse
    {
        if (!$user) {
            return $this->json(['error' => 'No autenticado'], 401);
        }

        $borradas = $this->repo->deleteAllFor($user);

        return $this->json([
            'borradas' => $borradas,
        ]);
    }
}
