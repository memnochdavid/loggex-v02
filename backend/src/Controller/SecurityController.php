<?php

namespace App\Controller;

use App\Entity\Personalizacion;
use Symfony\Bundle\FrameworkBundle\Controller\AbstractController;
use Symfony\Component\HttpFoundation\JsonResponse;
use Symfony\Component\Routing\Attribute\Route;
use Symfony\Component\Security\Http\Attribute\CurrentUser;
use App\Entity\User;
use Doctrine\ORM\EntityManagerInterface;
use Psr\Log\LoggerInterface;

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
    public function me(#[CurrentUser] ?User $user, EntityManagerInterface $entityManager, LoggerInterface $logger): JsonResponse
    {
        if (null === $user) {
            return $this->json(['message' => 'No autenticado'], 401);
        }

        $userData = $this->formatUser($user, $entityManager);

        return $this->json([
            'user' => $userData
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
                    'nombre' => '',
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
            'telefono' => $user->getTelefono(),
            'nif' => $user->getNif(),
            'rol_app' => $user->getRolApp(),
            'roles' => $user->getRoles(),
            'foto' => $user->getFoto(),
            'centro' => $centroData,
        ];
    }

    private function formatPersonalizacion(Personalizacion $p): array
    {
        $v = fn($val, $default) => $val !== null ? $val : $default;

        return [
            'primaryColor' => $v($p->getPrimaryColor(), '#6366f1'),
            'secondaryColor' => $v($p->getSecondaryColor(), '#64748b'),
            'viewBackgroundColor' => $v($p->getViewBackgroundColor(), '#ffffff'),
            'borderRadius' => $v($p->getBorderRadius(), '0.5rem'), // NUEVO
            'showLottie' => $p->isShowLottie(), // NUEVO
            'enableDraggableModal' => $p->isEnableDraggableModal(), // NUEVO
            'animatedBackground' => $p->getAnimatedBackground(),

            'sidebarColor' => $v($p->getSidebarColor(), '#1e293b'),
            'sidebarActiveColor' => $v($p->getSidebarActiveColor(), '#334155'),
            'sidebarActiveTextColor' => $v($p->getSidebarActiveTextColor(), '#ffffff'),
            'sidebarHoverColor' => $v($p->getSidebarHoverColor(), '#334155'),
            'sidebarHoverTextColor' => $v($p->getSidebarHoverTextColor(), '#ffffff'),
            'sidebarOpacity' => $p->getSidebarOpacity(),

            'sidebarAccordionHeaderBgColor' => $v($p->getSidebarAccordionHeaderBgColor(), '#1e293b'),
            'sidebarAccordionHeaderTextColor' => $v($p->getSidebarAccordionHeaderTextColor(), '#ffffff'),
            'sidebarAccordionContentBgColor' => $v($p->getSidebarAccordionContentBgColor(), '#0f172a'),
            'sidebarAccordionContentTextColor' => $v($p->getSidebarAccordionContentTextColor(), '#cbd5e1'),

            'textMainColor' => $v($p->getTextMainColor(), '#334155'),
            'textSecondaryColor' => $v($p->getTextSecondaryColor(), '#64748b'),
            'specialTextColor' => $v($p->getSpecialTextColor(), '#ffffff'),
            'buttonPrimaryColor' => $v($p->getButtonPrimaryColor(), '#6366f1'),
            'buttonPrimaryTextColor' => $v($p->getButtonPrimaryTextColor(), '#ffffff'),
            'buttonSecondaryColor' => $v($p->getButtonSecondaryColor(), '#ffffff'),
            'buttonSecondaryTextColor' => $v($p->getButtonSecondaryTextColor(), '#334155'),
            'headerFooterColor' => $v($p->getHeaderFooterColor(), '#1e293b'),
            'headerFooterTextColor' => $v($p->getHeaderFooterTextColor(), '#ffffff'),
            'headerFooterOpacity' => $p->getHeaderFooterOpacity(),
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

            // Accordion (Sincronizado con frontend)
            'accordionHeaderBgColor' => $v($p->getAccordionHeaderBgColor(), '#f8fafc'),
            'accordionHeaderTextColor' => $v($p->getAccordionHeaderTextColor(), '#64748b'),
            'accordionHeaderActiveBgColor' => $v($p->getAccordionHeaderActiveBgColor(), '#f1f5f9'),
            'accordionHeaderActiveTextColor' => $v($p->getAccordionHeaderActiveTextColor(), '#334155'),
            'accordionContentBgColor' => $v($p->getAccordionContentBgColor(), '#ffffff'),
            'accordionContentTextColor' => $v($p->getAccordionContentTextColor(), '#334155'),

            'modalHeaderBgColor' => $v($p->getModalHeaderBgColor(), '#ffffff'),
            'modalHeaderTextColor' => $v($p->getModalHeaderTextColor(), '#334155'),
            'modalBodyBgColor' => $v($p->getModalBodyBgColor(), '#ffffff'),
            'modalBodyTextColor' => $v($p->getModalBodyTextColor(), '#334155'),
            'modalFooterBgColor' => $v($p->getModalFooterBgColor(), '#f8fafc'),
            'modalCloseButtonBgColor' => $v($p->getModalCloseButtonBgColor(), '#ffffff'),
            'modalCloseButtonTextColor' => $v($p->getModalCloseButtonTextColor(), '#64748b'),
            'modalCloseButtonHoverBgColor' => $v($p->getModalCloseButtonHoverBgColor(), '#f1f5f9'),
            'modalCloseButtonHoverTextColor' => $v($p->getModalCloseButtonHoverTextColor(), '#334155'),

            'userCardBgColor' => $v($p->getUserCardBgColor(), '#1e293b'),
            'userCardTextColor' => $v($p->getUserCardTextColor(), '#ffffff'),
            'userCardTextSecondaryColor' => $v($p->getUserCardTextSecondaryColor(), '#cbd5e1'),

            'chatSidebarBgColor' => $v($p->getChatSidebarBgColor(), '#ffffff'),
            'chatItemHoverBgColor' => $v($p->getChatItemHoverBgColor(), '#f1f5f9'),
            'chatItemActiveBgColor' => $v($p->getChatItemActiveBgColor(), '#e0e7ff'),
            'chatItemActiveBorderColor' => $v($p->getChatItemActiveBorderColor(), '#6366f1'),
            'chatItemTextMainColor' => $v($p->getChatItemTextMainColor(), '#334155'),
            'chatItemTextSecondaryColor' => $v($p->getChatItemTextSecondaryColor(), '#64748b'),
            'chatBadgeBgColor' => $v($p->getChatBadgeBgColor(), '#6366f1'),
            'chatBadgeTextColor' => $v($p->getChatBadgeTextColor(), '#ffffff'),
            'chatHeaderBgColor' => $v($p->getChatHeaderBgColor(), '#1e293b'),
            'chatHeaderTextColor' => $v($p->getChatHeaderTextColor(), '#ffffff'),
            'chatContainerBgColor' => $v($p->getChatContainerBgColor(), '#f8fafc'),
            'chatInputAreaBgColor' => $v($p->getChatInputAreaBgColor(), '#ffffff'),
            'chatBubbleSentBgColor' => $v($p->getChatBubbleSentBgColor(), '#6366f1'),
            'chatBubbleSentTextColor' => $v($p->getChatBubbleSentTextColor(), '#ffffff'),
            'chatBubbleReceivedBgColor' => $v($p->getChatBubbleReceivedBgColor(), '#ffffff'),
            'chatBubbleReceivedTextColor' => $v($p->getChatBubbleReceivedTextColor(), '#334155'),

            'inputBgColor' => $v($p->getInputBgColor(), '#ffffff'),
            'inputTextColor' => $v($p->getInputTextColor(), '#334155'),
            'inputBorderColor' => $v($p->getInputBorderColor(), '#e2e8f0'),
            'inputFocusBorderColor' => $v($p->getInputFocusBorderColor(), '#6366f1'),
            'inputFocusShadowColor' => $v($p->getInputFocusShadowColor(), '#e0e7ff'),

            'eventCardBgColor' => $v($p->getEventCardBgColor(), '#ffffff'),
            'eventCardBorderColor' => $v($p->getEventCardBorderColor(), '#e2e8f0'),
            'eventCardTitleColor' => $v($p->getEventCardTitleColor(), '#334155'),
            'eventCardMetaColor' => $v($p->getEventCardMetaColor(), '#64748b'),
            'eventsSidebarBgColor' => $v($p->getEventsSidebarBgColor(), 'transparent'),
            'eventsSidebarTitleColor' => $v($p->getEventsSidebarTitleColor(), '#334155'),

            'widgetBgColor' => $v($p->getWidgetBgColor(), '#ffffff'),
            'widgetHeaderBgColor' => $v($p->getWidgetHeaderBgColor(), '#ffffff'),
            'widgetHeaderTextColor' => $v($p->getWidgetHeaderTextColor(), '#334155'),
            'widgetBorderColor' => $v($p->getWidgetBorderColor(), '#e2e8f0'),
            'widgetItemTextColor' => $v($p->getWidgetItemTextColor(), '#334155'),
            'widgetItemHoverBgColor' => $v($p->getWidgetItemHoverBgColor(), '#f1f5f9'),
            'widgetIconColor' => $v($p->getWidgetIconColor(), '#6366f1'),

            'itemsPerPageUsuarios' => $p->getItemsPerPageUsuarios(),
            'itemsPerPageCentros' => $p->getItemsPerPageCentros(),
            'itemsPerPageCiclos' => $p->getItemsPerPageCiclos(),
            'itemsPerPageGrupos' => $p->getItemsPerPageGrupos(),
            'itemsPerPageModulos' => $p->getItemsPerPageModulos(),
            'itemsPerPageMatriculas' => $p->getItemsPerPageMatriculas(),
            'itemsPerPageImparticiones' => $p->getItemsPerPageImparticiones(),
            'itemsPerPageHorarios' => $p->getItemsPerPageHorarios(),
            'nameTitleConfig' => $p->getNameTitleConfig(),
        ];
    }
}
