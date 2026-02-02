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

        // Log para depuración de temas guardados
        if (isset($userData['centro']['personalizacion']['savedThemes'])) {
            $themes = $userData['centro']['personalizacion']['savedThemes'];
            $logger->info('API/ME - Temas guardados encontrados:', ['count' => count($themes), 'data' => $themes]);
        } else {
            $logger->info('API/ME - No se encontraron temas guardados o estructura inesperada.');
        }

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
            'scrollbarThumbColor' => $p->getScrollbarThumbColor(),
            'scrollbarTrackColor' => $p->getScrollbarTrackColor(),
            'scrollbarHoverColor' => $p->getScrollbarHoverColor(),
            'scrollbarWidth' => $p->getScrollbarWidth(),
            'calendarSelectedBgColor' => $p->getCalendarSelectedBgColor(),
            'calendarSelectedTextColor' => $p->getCalendarSelectedTextColor(),
            'calendarWeekendBgColor' => $p->getCalendarWeekendBgColor(),
            'calendarWeekendTextColor' => $p->getCalendarWeekendTextColor(),
            'timetableHeaderBgColor' => $p->getTimetableHeaderBgColor(),
            'timetableHeaderTextColor' => $p->getTimetableHeaderTextColor(),
            'timetableHoursBgColor' => $p->getTimetableHoursBgColor(),
            'timetableHoursTextColor' => $p->getTimetableHoursTextColor(),
            'timetableSelectedHeaderBg' => $p->getTimetableSelectedHeaderBg(),
            'timetableSelectedHeaderText' => $p->getTimetableSelectedHeaderText(),
            'timetableSelectedCellBg' => $p->getTimetableSelectedCellBg(),
            'datatableHeaderBgColor' => $p->getDatatableHeaderBgColor(),
            'datatableHeaderTextColor' => $p->getDatatableHeaderTextColor(),
            'datatableHeaderHoverBgColor' => $p->getDatatableHeaderHoverBgColor(),
            'datatableHeaderHoverTextColor' => $p->getDatatableHeaderHoverTextColor(),
            'datatableHeaderActiveBgColor' => $p->getDatatableHeaderActiveBgColor(),
            'datatableHeaderActiveTextColor' => $p->getDatatableHeaderActiveTextColor(),
            'datatablePaginationBgColor' => $p->getDatatablePaginationBgColor(),
            'datatablePaginationTextColor' => $p->getDatatablePaginationTextColor(),
            'datatablePaginationButtonBgColor' => $p->getDatatablePaginationButtonBgColor(),
            'datatablePaginationButtonTextColor' => $p->getDatatablePaginationButtonTextColor(),
            'datatablePaginationButtonHoverBgColor' => $p->getDatatablePaginationButtonHoverBgColor(),
            'datatablePaginationButtonHoverTextColor' => $p->getDatatablePaginationButtonHoverTextColor(),
            'datatablePaginationButtonActiveBgColor' => $p->getDatatablePaginationButtonActiveBgColor(),
            'datatablePaginationButtonActiveTextColor' => $p->getDatatablePaginationButtonActiveTextColor(),
            'itemsPerPageUsuarios' => $p->getItemsPerPageUsuarios(),
            'itemsPerPageCentros' => $p->getItemsPerPageCentros(),
            'itemsPerPageCiclos' => $p->getItemsPerPageCiclos(),
            'itemsPerPageGrupos' => $p->getItemsPerPageGrupos(),
            'itemsPerPageModulos' => $p->getItemsPerPageModulos(),
            'itemsPerPageMatriculas' => $p->getItemsPerPageMatriculas(),
            'itemsPerPageImparticiones' => $p->getItemsPerPageImparticiones(),
            'itemsPerPageHorarios' => $p->getItemsPerPageHorarios(),
            'accordionHeaderBgColor' => $p->getAccordionHeaderBgColor(),
            'accordionHeaderTextColor' => $p->getAccordionHeaderTextColor(),
            'accordionContentBgColor' => $p->getAccordionContentBgColor(),
            'accordionContentTextColor' => $p->getAccordionContentTextColor(),
            'savedThemes' => $p->getSavedThemes() ?? [], // Asegurar array vacío si es null
        ];
    }
}
