<?php

namespace App\Controller;

use App\Entity\User;
use Doctrine\ORM\EntityManagerInterface;
use Symfony\Bundle\FrameworkBundle\Controller\AbstractController;
use Symfony\Component\HttpFoundation\JsonResponse;
use Symfony\Component\Routing\Attribute\Route;
use Symfony\Component\Security\Http\Attribute\CurrentUser;

/**
 * Endpoints para el progreso de tutoriales interactivos del usuario actual.
 *
 * Diseño: simple JSON column en usuario.tutorials_completed con la lista de
 * IDs ya vistos (completados o saltados). El frontend define el catálogo
 * completo de tours; el backend solo guarda los IDs marcados.
 */
class TutorialController extends AbstractController
{
    /**
     * Devuelve los tours que el usuario ya ha completado/saltado.
     * Respuesta: { "completed": ["primer-login", "alumno-entregar-tarea"] }
     */
    #[Route('/api/me/tutorials/status', name: 'api_me_tutorials_status', methods: ['GET'])]
    public function status(#[CurrentUser] ?User $user): JsonResponse
    {
        if (!$user) {
            return $this->json(['message' => 'No autenticado'], 401);
        }

        return $this->json([
            'completed' => $user->getTutorialsCompleted(),
        ]);
    }

    /**
     * Marca un tour como completado para el usuario actual. Idempotente:
     * si ya estaba marcado, no falla ni duplica.
     *
     * El ID viaja en la URL para que sea legible en logs/Network DevTools.
     * Validación: solo IDs con caracteres seguros (letras, dígitos, guiones).
     */
    #[Route(
        '/api/me/tutorials/{id}/complete',
        name: 'api_me_tutorials_complete',
        methods: ['POST'],
        requirements: ['id' => '[a-zA-Z0-9_-]{1,80}'],
    )]
    public function complete(
        string $id,
        #[CurrentUser] ?User $user,
        EntityManagerInterface $em,
    ): JsonResponse {
        if (!$user) {
            return $this->json(['message' => 'No autenticado'], 401);
        }

        $user->markTutorialCompleted($id);
        $em->flush();

        return $this->json([
            'ok' => true,
            'completed' => $user->getTutorialsCompleted(),
        ]);
    }

    /**
     * Reinicia el progreso de tutoriales del usuario actual. Útil para QA
     * y para que el usuario pueda volver a ver el auto-start de bienvenida
     * desde el menú Ayuda.
     */
    #[Route('/api/me/tutorials/reset', name: 'api_me_tutorials_reset', methods: ['POST'])]
    public function reset(
        #[CurrentUser] ?User $user,
        EntityManagerInterface $em,
    ): JsonResponse {
        if (!$user) {
            return $this->json(['message' => 'No autenticado'], 401);
        }

        $user->setTutorialsCompleted([]);
        $em->flush();

        return $this->json(['ok' => true, 'completed' => []]);
    }
}
