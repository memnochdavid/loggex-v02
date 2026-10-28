<?php

namespace App\Controller;

use App\Entity\Imparticion;
use App\Entity\User;
use App\Service\CierreTareasVencidasService;
use Doctrine\ORM\EntityManagerInterface;
use Symfony\Bundle\FrameworkBundle\Controller\AbstractController;
use Symfony\Component\HttpFoundation\JsonResponse;
use Symfony\Component\HttpFoundation\Request;
use Symfony\Component\Routing\Attribute\Route;
use Symfony\Component\Security\Http\Attribute\CurrentUser;

class CierreTareasVencidasController extends AbstractController
{
    public function __construct(
        private readonly CierreTareasVencidasService $service,
        private readonly EntityManagerInterface $em,
    ) {
    }

    /**
     * POST /api/v1/tareas/cerrar-vencidas
     *
     * Body opcional (JSON): { "imparticionId": int, "dryRun": bool }
     *  - Sin `imparticionId`: cierra todo lo que el rol del usuario alcance.
     *  - Con `imparticionId`: limita a esa imparticion (el profe solo puede
     *    cerrar imparticiones donde es titular; el admin de centro cualquier
     *    imparticion del centro).
     *
     * Devuelve `{tareasProcesadas, tareasOmitidas, alumnosCerrados, dryRun}`.
     */
    #[Route('/api/v1/tareas/cerrar-vencidas', name: 'api_tareas_cerrar_vencidas', methods: ['POST'])]
    public function __invoke(Request $request, #[CurrentUser] ?User $user): JsonResponse
    {
        if (!$user) {
            return $this->json(['error' => 'No autenticado'], 401);
        }
        $isProfesor = in_array('ROLE_PROFESOR', $user->getRoles(), true);
        $isAdmin = in_array('ROLE_ADMIN', $user->getRoles(), true);
        $isSuper = in_array('ROLE_SUPERADMIN', $user->getRoles(), true);
        if (!($isProfesor || $isAdmin || $isSuper)) {
            return $this->json(['error' => 'No autorizado'], 403);
        }

        $body = json_decode($request->getContent() ?: '{}', true) ?? [];
        $impId = $body['imparticionId'] ?? null;
        $dryRun = (bool) ($body['dryRun'] ?? false);

        $imp = null;
        if ($impId !== null) {
            $imp = $this->em->getRepository(Imparticion::class)->find($impId);
            if (!$imp) {
                return $this->json(['error' => 'Imparticion no encontrada'], 404);
            }
            // Profesor: solo sus imparticiones. Admin: solo de su centro. Super: todas.
            if (!$isSuper) {
                if ($isAdmin) {
                    $centroImp = $imp->getGrupo()?->getItinerario()?->getCentro();
                    if ($centroImp?->getId() !== $user->getCentro()?->getId()) {
                        return $this->json(['error' => 'No autorizado para esta imparticion'], 403);
                    }
                } elseif ($isProfesor) {
                    if ($imp->getProfesor()?->getId() !== $user->getId()) {
                        return $this->json(['error' => 'No autorizado para esta imparticion'], 403);
                    }
                }
            }
        } else {
            // Sin imparticion: solo super admin puede cerrar globalmente. Profe/admin
            // deberían pasar siempre `imparticionId` desde la UI; esto evita que un
            // botón mal puesto cierre TODAS las del centro de un click.
            if (!$isSuper) {
                return $this->json(['error' => 'imparticionId requerido salvo super admin'], 400);
            }
        }

        $stats = $this->service->procesar($imp, $dryRun);
        return $this->json($stats);
    }
}
