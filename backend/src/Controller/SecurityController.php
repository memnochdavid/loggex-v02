<?php

namespace App\Controller;

use App\Entity\Personalizacion;
use Symfony\Bundle\FrameworkBundle\Controller\AbstractController;
use Symfony\Component\HttpFoundation\JsonResponse;
use Symfony\Component\Routing\Attribute\Route;
use Symfony\Component\Security\Http\Attribute\CurrentUser;
use App\Entity\User;
use Doctrine\ORM\EntityManagerInterface;

class SecurityController extends AbstractController
{
    #[Route('/api/login', name: 'api_login', methods: ['POST'])]
    public function login(#[CurrentUser] ?User $user, EntityManagerInterface $entityManager): JsonResponse
    {
        if (null === $user) {
            return $this->json([
                'message' => 'Credenciales inválidas',
            ], 401);
        }

        return $this->json([
            'user' => $this->formatUser($user, $entityManager)
        ]);
    }

    #[Route('/api/logout', name: 'api_logout', methods: ['POST'])]
    public function logout(): void
    {
        throw new \Exception('Don\'t forget to activate logout in security.yaml');
    }

    #[Route('/api/logout_success', name: 'api_logout_success', methods: ['GET'])]
    public function logoutSuccess(): JsonResponse
    {
        return $this->json(['message' => 'Sesión cerrada correctamente']);
    }

    #[Route('/api/me', name: 'api_me', methods: ['GET'])]
    public function me(#[CurrentUser] ?User $user, EntityManagerInterface $entityManager): JsonResponse
    {
        if (null === $user) {
            return $this->json(['message' => 'No autenticado'], 401);
        }

        return $this->json([
            'user' => $this->formatUser($user, $entityManager)
        ]);
    }

    private function formatUser(User $user, EntityManagerInterface $entityManager): array
    {
        $centroData = null;
        $personalizacionData = null;

        if ($user->getCentro()) {
            // Usuario de centro
            if ($user->getCentro()->getPersonalizacion()) {
                $p = $user->getCentro()->getPersonalizacion();
                $personalizacionData = $this->formatPersonalizacion($p);
            }

            $centroData = [
                'id' => $user->getCentro()->getId(),
                'nombre' => $user->getCentro()->getNombre(),
                'logo' => $user->getCentro()->getLogo(),
                'personalizacion' => $personalizacionData,
            ];
        } else {
            // Usuario global (SuperAdmin) -> Cargar personalización global
            $repo = $entityManager->getRepository(Personalizacion::class);
            $p = $repo->findOneBy(['centro' => null]);
            if ($p) {
                $personalizacionData = $this->formatPersonalizacion($p);
            }

            // Simulamos una estructura de centro para que el frontend aplique el tema global
            // O mejor, devolvemos 'personalizacion' a nivel de usuario si queremos
            // Pero para mantener compatibilidad con AuthContext actual, lo metemos en un objeto 'centro' ficticio o
            // modificamos AuthContext para buscar personalizacion en user.personalizacionGlobal

            // Modificaremos AuthContext para ser más flexible, pero por ahora:
            if ($personalizacionData) {
                // Hack temporal: inyectar personalización global como si fuera de un centro "Global"
                // para que el frontend actual lo pille sin cambios.
                $centroData = [
                    'id' => 'global',
                    'nombre' => 'Configuración Global',
                    'logo' => null,
                    'personalizacion' => $personalizacionData
                ];
            }
        }

        return [
            'id' => $user->getId(),
            'email' => $user->getEmail(),
            'nombre' => $user->getNombre(),
            'apellidos' => $user->getApellidos(),
            'roles' => $user->getRoles(),
            'foto' => $user->getFoto(),
            'centro' => $centroData,
        ];
    }

    private function formatPersonalizacion(Personalizacion $p): array
    {
        return [
            'primaryColor' => $p->getPrimaryColor(),
            'secondaryColor' => $p->getSecondaryColor(),
            'sidebarColor' => $p->getSidebarColor(),
            'sidebarActiveColor' => $p->getSidebarActiveColor(),
            'sidebarActiveTextColor' => $p->getSidebarActiveTextColor(),
            'sidebarHoverColor' => $p->getSidebarHoverColor(),
            'sidebarHoverTextColor' => $p->getSidebarHoverTextColor(),
            'textMainColor' => $p->getTextMainColor(),
            'textSecondaryColor' => $p->getTextSecondaryColor(),
            'buttonPrimaryColor' => $p->getButtonPrimaryColor(),
            'buttonPrimaryTextColor' => $p->getButtonPrimaryTextColor(),
            'buttonSecondaryColor' => $p->getButtonSecondaryColor(),
            'buttonSecondaryTextColor' => $p->getButtonSecondaryTextColor(),
            'headerFooterColor' => $p->getHeaderFooterColor(),
            'headerFooterTextColor' => $p->getHeaderFooterTextColor(),
        ];
    }
}
