<?php

namespace App\Controller;

use App\Entity\Personalizacion;
use App\Entity\User;
use Doctrine\ORM\EntityManagerInterface;
use Psr\Log\LoggerInterface;
use Symfony\Bundle\FrameworkBundle\Controller\AbstractController;
use Symfony\Component\HttpFoundation\JsonResponse;
use Symfony\Component\HttpFoundation\Request;
use Symfony\Component\Routing\Attribute\Route;
use Symfony\Component\Security\Http\Attribute\CurrentUser;

class PersonalizacionController extends AbstractController
{
    #[Route('/api/configuracion/update', name: 'api_configuracion_update', methods: ['POST'])]
    public function update(
        Request $request,
        #[CurrentUser] ?User $user,
        EntityManagerInterface $entityManager,
        LoggerInterface $logger
    ): JsonResponse {
        if (!$user) {
            return $this->json(['message' => 'No autenticado'], 401);
        }

        $centro = $user->getCentro();
        $personalizacion = null;

        if ($centro) {
            $personalizacion = $centro->getPersonalizacion();
            if (!$personalizacion) {
                $personalizacion = new Personalizacion();
                $personalizacion->setCentro($centro);
            }
        } else {
            $repo = $entityManager->getRepository(Personalizacion::class);
            $personalizacion = $repo->findOneBy(['centro' => null]);

            if (!$personalizacion) {
                $personalizacion = new Personalizacion();
            }
        }

        $data = json_decode($request->getContent(), true);

        $logger->info('DATOS RECIBIDOS EN UPDATE:', $data);

        // Temas Guardados
        if (isset($data['savedThemes'])) {
            $personalizacion->setSavedThemes($data['savedThemes']);
        }

        // General
        if (isset($data['primaryColor'])) $personalizacion->setPrimaryColor($data['primaryColor']);
        if (isset($data['secondaryColor'])) $personalizacion->setSecondaryColor($data['secondaryColor']);

        // Sidebar
        if (isset($data['sidebarColor'])) $personalizacion->setSidebarColor($data['sidebarColor']);
        if (isset($data['sidebarActiveColor'])) $personalizacion->setSidebarActiveColor($data['sidebarActiveColor']);
        if (isset($data['sidebarActiveTextColor'])) $personalizacion->setSidebarActiveTextColor($data['sidebarActiveTextColor']);
        if (isset($data['sidebarHoverColor'])) $personalizacion->setSidebarHoverColor($data['sidebarHoverColor']);
        if (isset($data['sidebarHoverTextColor'])) $personalizacion->setSidebarHoverTextColor($data['sidebarHoverTextColor']);

        // Textos
        if (isset($data['textMainColor'])) $personalizacion->setTextMainColor($data['textMainColor']);
        if (isset($data['textSecondaryColor'])) $personalizacion->setTextSecondaryColor($data['textSecondaryColor']);

        // Botones
        if (isset($data['buttonPrimaryColor'])) $personalizacion->setButtonPrimaryColor($data['buttonPrimaryColor']);
        if (isset($data['buttonPrimaryTextColor'])) $personalizacion->setButtonPrimaryTextColor($data['buttonPrimaryTextColor']);
        if (isset($data['buttonSecondaryColor'])) $personalizacion->setButtonSecondaryColor($data['buttonSecondaryColor']);
        if (isset($data['buttonSecondaryTextColor'])) $personalizacion->setButtonSecondaryTextColor($data['buttonSecondaryTextColor']);

        // Header/Footer
        if (isset($data['headerFooterColor'])) $personalizacion->setHeaderFooterColor($data['headerFooterColor']);
        if (isset($data['headerFooterTextColor'])) $personalizacion->setHeaderFooterTextColor($data['headerFooterTextColor']);

        // Scrollbar
        if (isset($data['scrollbarThumbColor'])) $personalizacion->setScrollbarThumbColor($data['scrollbarThumbColor']);
        if (isset($data['scrollbarTrackColor'])) $personalizacion->setScrollbarTrackColor($data['scrollbarTrackColor']);
        if (isset($data['scrollbarHoverColor'])) $personalizacion->setScrollbarHoverColor($data['scrollbarHoverColor']);
        if (isset($data['scrollbarWidth'])) $personalizacion->setScrollbarWidth($data['scrollbarWidth']);

        // Calendario
        if (isset($data['calendarSelectedBgColor'])) $personalizacion->setCalendarSelectedBgColor($data['calendarSelectedBgColor']);
        if (isset($data['calendarSelectedTextColor'])) $personalizacion->setCalendarSelectedTextColor($data['calendarSelectedTextColor']);
        if (isset($data['calendarWeekendBgColor'])) $personalizacion->setCalendarWeekendBgColor($data['calendarWeekendBgColor']);
        if (isset($data['calendarWeekendTextColor'])) $personalizacion->setCalendarWeekendTextColor($data['calendarWeekendTextColor']);

        // Horario
        if (isset($data['timetableHeaderBgColor'])) $personalizacion->setTimetableHeaderBgColor($data['timetableHeaderBgColor']);
        if (isset($data['timetableHeaderTextColor'])) $personalizacion->setTimetableHeaderTextColor($data['timetableHeaderTextColor']);
        if (isset($data['timetableHoursBgColor'])) $personalizacion->setTimetableHoursBgColor($data['timetableHoursBgColor']);
        if (isset($data['timetableHoursTextColor'])) $personalizacion->setTimetableHoursTextColor($data['timetableHoursTextColor']);

        if (isset($data['timetableSelectedHeaderBg'])) $personalizacion->setTimetableSelectedHeaderBg($data['timetableSelectedHeaderBg']);
        if (isset($data['timetableSelectedHeaderText'])) $personalizacion->setTimetableSelectedHeaderText($data['timetableSelectedHeaderText']);
        if (isset($data['timetableSelectedCellBg'])) $personalizacion->setTimetableSelectedCellBg($data['timetableSelectedCellBg']);

        // DataTable
        if (isset($data['datatableHeaderBgColor'])) $personalizacion->setDatatableHeaderBgColor($data['datatableHeaderBgColor']);
        if (isset($data['datatableHeaderTextColor'])) $personalizacion->setDatatableHeaderTextColor($data['datatableHeaderTextColor']);
        if (isset($data['datatableHeaderHoverBgColor'])) $personalizacion->setDatatableHeaderHoverBgColor($data['datatableHeaderHoverBgColor']);
        if (isset($data['datatableHeaderHoverTextColor'])) $personalizacion->setDatatableHeaderHoverTextColor($data['datatableHeaderHoverTextColor']);
        if (isset($data['datatableHeaderActiveBgColor'])) $personalizacion->setDatatableHeaderActiveBgColor($data['datatableHeaderActiveBgColor']);
        if (isset($data['datatableHeaderActiveTextColor'])) $personalizacion->setDatatableHeaderActiveTextColor($data['datatableHeaderActiveTextColor']);

        if (isset($data['datatablePaginationBgColor'])) $personalizacion->setDatatablePaginationBgColor($data['datatablePaginationBgColor']);
        if (isset($data['datatablePaginationTextColor'])) $personalizacion->setDatatablePaginationTextColor($data['datatablePaginationTextColor']);
        if (isset($data['datatablePaginationButtonBgColor'])) $personalizacion->setDatatablePaginationButtonBgColor($data['datatablePaginationButtonBgColor']);
        if (isset($data['datatablePaginationButtonTextColor'])) $personalizacion->setDatatablePaginationButtonTextColor($data['datatablePaginationButtonTextColor']);
        if (isset($data['datatablePaginationButtonHoverBgColor'])) $personalizacion->setDatatablePaginationButtonHoverBgColor($data['datatablePaginationButtonHoverBgColor']);
        if (isset($data['datatablePaginationButtonHoverTextColor'])) $personalizacion->setDatatablePaginationButtonHoverTextColor($data['datatablePaginationButtonHoverTextColor']);
        if (isset($data['datatablePaginationButtonActiveBgColor'])) $personalizacion->setDatatablePaginationButtonActiveBgColor($data['datatablePaginationButtonActiveBgColor']);
        if (isset($data['datatablePaginationButtonActiveTextColor'])) $personalizacion->setDatatablePaginationButtonActiveTextColor($data['datatablePaginationButtonActiveTextColor']);

        // Accordion (Mobile)
        if (isset($data['accordionHeaderBgColor'])) $personalizacion->setAccordionHeaderBgColor($data['accordionHeaderBgColor']);
        if (isset($data['accordionHeaderTextColor'])) $personalizacion->setAccordionHeaderTextColor($data['accordionHeaderTextColor']);
        if (isset($data['accordionHeaderActiveBgColor'])) $personalizacion->setAccordionHeaderActiveBgColor($data['accordionHeaderActiveBgColor']);
        if (isset($data['accordionHeaderActiveTextColor'])) $personalizacion->setAccordionHeaderActiveTextColor($data['accordionHeaderActiveTextColor']);
        if (isset($data['accordionContentBgColor'])) $personalizacion->setAccordionContentBgColor($data['accordionContentBgColor']);
        if (isset($data['accordionContentTextColor'])) $personalizacion->setAccordionContentTextColor($data['accordionContentTextColor']);

        // Paginación (Items Per Page)
        if (isset($data['itemsPerPageUsuarios'])) $personalizacion->setItemsPerPageUsuarios((int)$data['itemsPerPageUsuarios']);
        if (isset($data['itemsPerPageCentros'])) $personalizacion->setItemsPerPageCentros((int)$data['itemsPerPageCentros']);
        if (isset($data['itemsPerPageCiclos'])) $personalizacion->setItemsPerPageCiclos((int)$data['itemsPerPageCiclos']);
        if (isset($data['itemsPerPageGrupos'])) $personalizacion->setItemsPerPageGrupos((int)$data['itemsPerPageGrupos']);
        if (isset($data['itemsPerPageModulos'])) $personalizacion->setItemsPerPageModulos((int)$data['itemsPerPageModulos']);
        if (isset($data['itemsPerPageMatriculas'])) $personalizacion->setItemsPerPageMatriculas((int)$data['itemsPerPageMatriculas']);
        if (isset($data['itemsPerPageImparticiones'])) $personalizacion->setItemsPerPageImparticiones((int)$data['itemsPerPageImparticiones']);
        if (isset($data['itemsPerPageHorarios'])) $personalizacion->setItemsPerPageHorarios((int)$data['itemsPerPageHorarios']);

        $entityManager->persist($personalizacion);
        $entityManager->flush();

        return $this->json([
            'message' => 'Configuración guardada correctamente',
            'personalizacion' => $data
        ]);
    }
}
