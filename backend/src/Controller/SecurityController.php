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
            $repo = $entityManager->getRepository(Personalizacion::class);
            $p = $repo->findOneBy(['centro' => null]);
            if ($p) {
                $personalizacionData = $this->formatPersonalizacion($p);
            }

            if ($personalizacionData) {
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
        // Helper para valores por defecto
        $v = fn($val, $default) => $val !== null ? $val : $default;

        return [
            'primaryColor' => $v($p->getPrimaryColor(), '#6366f1'),
            'secondaryColor' => $v($p->getSecondaryColor(), '#64748b'),
            'sidebarColor' => $v($p->getSidebarColor(), '#1e293b'),
            'sidebarActiveColor' => $v($p->getSidebarActiveColor(), '#334155'),
            'sidebarActiveTextColor' => $v($p->getSidebarActiveTextColor(), '#ffffff'),
            'sidebarHoverColor' => $v($p->getSidebarHoverColor(), '#334155'),
            'sidebarHoverTextColor' => $v($p->getSidebarHoverTextColor(), '#ffffff'),
            'textMainColor' => $v($p->getTextMainColor(), '#334155'),
            'textSecondaryColor' => $v($p->getTextSecondaryColor(), '#64748b'),
            'buttonPrimaryColor' => $v($p->getButtonPrimaryColor(), '#6366f1'),
            'buttonPrimaryTextColor' => $v($p->getButtonPrimaryTextColor(), '#ffffff'),
            'buttonSecondaryColor' => $v($p->getButtonSecondaryColor(), '#ffffff'),
            'buttonSecondaryTextColor' => $v($p->getButtonSecondaryTextColor(), '#334155'),
            'headerFooterColor' => $v($p->getHeaderFooterColor(), '#1e293b'),
            'headerFooterTextColor' => $v($p->getHeaderFooterTextColor(), '#ffffff'),
            'scrollbarThumbColor' => $v($p->getScrollbarThumbColor(), '#cbd5e1'),
            'scrollbarTrackColor' => $v($p->getScrollbarTrackColor(), '#f1f5f9'),
            'scrollbarHoverColor' => $v($p->getScrollbarHoverColor(), '#94a3b8'),
            'scrollbarWidth' => $v($p->getScrollbarWidth(), '12px'),
            'calendarSelectedBgColor' => $v($p->getCalendarSelectedBgColor(), '#6366f1'),
            'calendarSelectedTextColor' => $v($p->getCalendarSelectedTextColor(), '#ffffff'),
            'calendarWeekendBgColor' => $v($p->getCalendarWeekendBgColor(), '#f1f5f9'),
            'calendarWeekendTextColor' => $v($p->getCalendarWeekendTextColor(), '#64748b'),
            'timetableHeaderBgColor' => $v($p->getTimetableHeaderBgColor(), '#f1f5f9'),
            'timetableHeaderTextColor' => $v($p->getTimetableHeaderTextColor(), '#334155'),
            'timetableHoursBgColor' => $v($p->getTimetableHoursBgColor(), '#f8fafc'),
            'timetableHoursTextColor' => $v($p->getTimetableHoursTextColor(), '#64748b'),
            'timetableSelectedHeaderBg' => $v($p->getTimetableSelectedHeaderBg(), '#e0e7ff'),
            'timetableSelectedHeaderText' => $v($p->getTimetableSelectedHeaderText(), '#4338ca'),
            'timetableSelectedCellBg' => $v($p->getTimetableSelectedCellBg(), '#eef2ff'),
            'datatableHeaderBgColor' => $v($p->getDatatableHeaderBgColor(), '#f8fafc'),
            'datatableHeaderTextColor' => $v($p->getDatatableHeaderTextColor(), '#64748b'),
            'datatableHeaderHoverBgColor' => $v($p->getDatatableHeaderHoverBgColor(), '#f1f5f9'),
            'datatableHeaderHoverTextColor' => $v($p->getDatatableHeaderHoverTextColor(), '#334155'),
            'datatableHeaderActiveBgColor' => $v($p->getDatatableHeaderActiveBgColor(), '#e2e8f0'),
            'datatableHeaderActiveTextColor' => $v($p->getDatatableHeaderActiveTextColor(), '#1e293b'),
            'datatablePaginationBgColor' => $v($p->getDatatablePaginationBgColor(), '#f8fafc'),
            'datatablePaginationTextColor' => $v($p->getDatatablePaginationTextColor(), '#64748b'),
            'datatablePaginationButtonBgColor' => $v($p->getDatatablePaginationButtonBgColor(), '#ffffff'),
            'datatablePaginationButtonTextColor' => $v($p->getDatatablePaginationButtonTextColor(), '#64748b'),
            'datatablePaginationButtonHoverBgColor' => $v($p->getDatatablePaginationButtonHoverBgColor(), '#f1f5f9'),
            'datatablePaginationButtonHoverTextColor' => $v($p->getDatatablePaginationButtonHoverTextColor(), '#334155'),
            'datatablePaginationButtonActiveBgColor' => $v($p->getDatatablePaginationButtonActiveBgColor(), '#e2e8f0'),
            'datatablePaginationButtonActiveTextColor' => $v($p->getDatatablePaginationButtonActiveTextColor(), '#1e293b'),

            // NUEVOS CAMPOS DE ACORDEÓN
            'accordionHeaderBgColor' => $v($p->getAccordionHeaderBgColor(), '#f8fafc'),
            'accordionHeaderTextColor' => $v($p->getAccordionHeaderTextColor(), '#64748b'),
            'accordionHeaderActiveBgColor' => $v($p->getAccordionHeaderActiveBgColor(), '#e2e8f0'),
            'accordionHeaderActiveTextColor' => $v($p->getAccordionHeaderActiveTextColor(), '#1e293b'),
            'accordionContentBgColor' => $v($p->getAccordionContentBgColor(), '#ffffff'),
            'accordionContentTextColor' => $v($p->getAccordionContentTextColor(), '#334155'),

            'itemsPerPageUsuarios' => $p->getItemsPerPageUsuarios(),
            'itemsPerPageCentros' => $p->getItemsPerPageCentros(),
            'itemsPerPageCiclos' => $p->getItemsPerPageCiclos(),
            'itemsPerPageGrupos' => $p->getItemsPerPageGrupos(),
            'itemsPerPageModulos' => $p->getItemsPerPageModulos(),
            'itemsPerPageMatriculas' => $p->getItemsPerPageMatriculas(),
            'itemsPerPageImparticiones' => $p->getItemsPerPageImparticiones(),
            'itemsPerPageHorarios' => $p->getItemsPerPageHorarios(),
        ];
    }
}
