<?php

namespace App\Controller;

use Symfony\Bundle\FrameworkBundle\Controller\AbstractController;
use Symfony\Component\HttpFoundation\JsonResponse;
use Symfony\Component\Routing\Attribute\Route;
use Symfony\Component\Security\Http\Attribute\CurrentUser;
use App\Entity\User;

class SecurityController extends AbstractController
{
    #[Route('/api/login', name: 'api_login', methods: ['POST'])]
    public function login(#[CurrentUser] ?User $user): JsonResponse
    {
        if (null === $user) {
            return $this->json([
                'message' => 'Credenciales inválidas',
            ], 401);
        }

        return $this->json([
            'user' => $this->formatUser($user)
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
    public function me(#[CurrentUser] ?User $user): JsonResponse
    {
        if (null === $user) {
            return $this->json(['message' => 'No autenticado'], 401);
        }

        return $this->json([
            'user' => $this->formatUser($user)
        ]);
    }

    private function formatUser(User $user): array
    {
        $centroData = null;
        if ($user->getCentro()) {
            $personalizacionData = null;
            if ($user->getCentro()->getPersonalizacion()) {
                $p = $user->getCentro()->getPersonalizacion();
                $personalizacionData = [
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

            $centroData = [
                'id' => $user->getCentro()->getId(),
                'nombre' => $user->getCentro()->getNombre(),
                'logo' => $user->getCentro()->getLogo(),
                'personalizacion' => $personalizacionData,
            ];
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
}
