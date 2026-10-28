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

        $content = $request->getContent();
        $data = json_decode($content, true);

        $logger->info('DATOS RECIBIDOS EN UPDATE (RAW): ' . $content);

        // General
        if (isset($data['primaryColor'])) $personalizacion->setPrimaryColor($data['primaryColor']);
        if (isset($data['secondaryColor'])) $personalizacion->setSecondaryColor($data['secondaryColor']);
        if (isset($data['viewBackgroundColor'])) $personalizacion->setViewBackgroundColor($data['viewBackgroundColor']);
        if (isset($data['borderRadius'])) $personalizacion->setBorderRadius($data['borderRadius']); // NUEVO
        if (isset($data['showLottie'])) $personalizacion->setShowLottie($data['showLottie']); // NUEVO
        if (isset($data['enableDraggableModal'])) $personalizacion->setEnableDraggableModal($data['enableDraggableModal']); // NUEVO
        if (array_key_exists('animatedBackground', $data)) $personalizacion->setAnimatedBackground($data['animatedBackground']);
        if (isset($data['elementsOpacity'])) $personalizacion->setElementsOpacity((int)$data['elementsOpacity']);
        if (isset($data['elementsBlur'])) $personalizacion->setElementsBlur((int)$data['elementsBlur']);

        // Sidebar
        if (isset($data['sidebarColor'])) $personalizacion->setSidebarColor($data['sidebarColor']);
        if (isset($data['sidebarActiveColor'])) $personalizacion->setSidebarActiveColor($data['sidebarActiveColor']);
        if (isset($data['sidebarActiveTextColor'])) $personalizacion->setSidebarActiveTextColor($data['sidebarActiveTextColor']);
        if (isset($data['sidebarHoverColor'])) $personalizacion->setSidebarHoverColor($data['sidebarHoverColor']);
        if (isset($data['sidebarHoverTextColor'])) $personalizacion->setSidebarHoverTextColor($data['sidebarHoverTextColor']);
        if (isset($data['sidebarOpacity'])) $personalizacion->setSidebarOpacity((int)$data['sidebarOpacity']);

        // Sidebar Accordion
        if (isset($data['sidebarAccordionHeaderBgColor'])) $personalizacion->setSidebarAccordionHeaderBgColor($data['sidebarAccordionHeaderBgColor']);
        if (isset($data['sidebarAccordionHeaderTextColor'])) $personalizacion->setSidebarAccordionHeaderTextColor($data['sidebarAccordionHeaderTextColor']);
        if (isset($data['sidebarAccordionContentBgColor'])) $personalizacion->setSidebarAccordionContentBgColor($data['sidebarAccordionContentBgColor']);
        if (isset($data['sidebarAccordionContentTextColor'])) $personalizacion->setSidebarAccordionContentTextColor($data['sidebarAccordionContentTextColor']);

        // Textos
        if (isset($data['textMainColor'])) $personalizacion->setTextMainColor($data['textMainColor']);
        if (isset($data['textSecondaryColor'])) $personalizacion->setTextSecondaryColor($data['textSecondaryColor']);
        if (isset($data['specialTextColor'])) $personalizacion->setSpecialTextColor($data['specialTextColor']);

        // Botones
        if (isset($data['buttonPrimaryColor'])) $personalizacion->setButtonPrimaryColor($data['buttonPrimaryColor']);
        if (isset($data['buttonPrimaryTextColor'])) $personalizacion->setButtonPrimaryTextColor($data['buttonPrimaryTextColor']);
        if (isset($data['buttonSecondaryColor'])) $personalizacion->setButtonSecondaryColor($data['buttonSecondaryColor']);
        if (isset($data['buttonSecondaryTextColor'])) $personalizacion->setButtonSecondaryTextColor($data['buttonSecondaryTextColor']);

        // Header/Footer
        if (isset($data['headerFooterColor'])) $personalizacion->setHeaderFooterColor($data['headerFooterColor']);
        if (isset($data['headerFooterTextColor'])) $personalizacion->setHeaderFooterTextColor($data['headerFooterTextColor']);
        if (isset($data['headerFooterOpacity'])) $personalizacion->setHeaderFooterOpacity((int)$data['headerFooterOpacity']);

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

        // Accordion
        if (isset($data['accordionHeaderBgColor'])) $personalizacion->setAccordionHeaderBgColor($data['accordionHeaderBgColor']);
        if (isset($data['accordionHeaderTextColor'])) $personalizacion->setAccordionHeaderTextColor($data['accordionHeaderTextColor']);
        if (isset($data['accordionHeaderActiveBgColor'])) $personalizacion->setAccordionHeaderActiveBgColor($data['accordionHeaderActiveBgColor']);
        if (isset($data['accordionHeaderActiveTextColor'])) $personalizacion->setAccordionHeaderActiveTextColor($data['accordionHeaderActiveTextColor']);
        if (isset($data['accordionContentBgColor'])) $personalizacion->setAccordionContentBgColor($data['accordionContentBgColor']);
        if (isset($data['accordionContentTextColor'])) $personalizacion->setAccordionContentTextColor($data['accordionContentTextColor']);

        // Modal
        if (isset($data['modalHeaderBgColor'])) $personalizacion->setModalHeaderBgColor($data['modalHeaderBgColor']);
        if (isset($data['modalHeaderTextColor'])) $personalizacion->setModalHeaderTextColor($data['modalHeaderTextColor']);
        if (isset($data['modalBodyBgColor'])) $personalizacion->setModalBodyBgColor($data['modalBodyBgColor']);
        if (isset($data['modalBodyTextColor'])) $personalizacion->setModalBodyTextColor($data['modalBodyTextColor']);
        if (isset($data['modalFooterBgColor'])) $personalizacion->setModalFooterBgColor($data['modalFooterBgColor']);
        if (isset($data['modalBorderWidth'])) $personalizacion->setModalBorderWidth($data['modalBorderWidth']);

        // Modal Close Button
        if (isset($data['modalCloseButtonBgColor'])) $personalizacion->setModalCloseButtonBgColor($data['modalCloseButtonBgColor']);
        if (isset($data['modalCloseButtonTextColor'])) $personalizacion->setModalCloseButtonTextColor($data['modalCloseButtonTextColor']);
        if (isset($data['modalCloseButtonHoverBgColor'])) $personalizacion->setModalCloseButtonHoverBgColor($data['modalCloseButtonHoverBgColor']);
        if (isset($data['modalCloseButtonHoverTextColor'])) $personalizacion->setModalCloseButtonHoverTextColor($data['modalCloseButtonHoverTextColor']);

        // UserCard
        if (isset($data['userCardBgColor'])) $personalizacion->setUserCardBgColor($data['userCardBgColor']);
        if (isset($data['userCardTextColor'])) $personalizacion->setUserCardTextColor($data['userCardTextColor']);
        if (isset($data['userCardTextSecondaryColor'])) $personalizacion->setUserCardTextSecondaryColor($data['userCardTextSecondaryColor']);

        // Chat
        if (isset($data['chatSidebarBgColor'])) $personalizacion->setChatSidebarBgColor($data['chatSidebarBgColor']);
        if (isset($data['chatItemHoverBgColor'])) $personalizacion->setChatItemHoverBgColor($data['chatItemHoverBgColor']);
        if (isset($data['chatItemActiveBgColor'])) $personalizacion->setChatItemActiveBgColor($data['chatItemActiveBgColor']);
        if (isset($data['chatItemActiveBorderColor'])) $personalizacion->setChatItemActiveBorderColor($data['chatItemActiveBorderColor']);
        if (isset($data['chatItemTextMainColor'])) $personalizacion->setChatItemTextMainColor($data['chatItemTextMainColor']);
        if (isset($data['chatItemTextSecondaryColor'])) $personalizacion->setChatItemTextSecondaryColor($data['chatItemTextSecondaryColor']);
        if (isset($data['chatBadgeBgColor'])) $personalizacion->setChatBadgeBgColor($data['chatBadgeBgColor']);
        if (isset($data['chatBadgeTextColor'])) $personalizacion->setChatBadgeTextColor($data['chatBadgeTextColor']);

        if (isset($data['chatHeaderBgColor'])) $personalizacion->setChatHeaderBgColor($data['chatHeaderBgColor']);
        if (isset($data['chatHeaderTextColor'])) $personalizacion->setChatHeaderTextColor($data['chatHeaderTextColor']);
        if (isset($data['chatContainerBgColor'])) $personalizacion->setChatContainerBgColor($data['chatContainerBgColor']);
        if (isset($data['chatInputAreaBgColor'])) $personalizacion->setChatInputAreaBgColor($data['chatInputAreaBgColor']);
        if (isset($data['chatBubbleSentBgColor'])) $personalizacion->setChatBubbleSentBgColor($data['chatBubbleSentBgColor']);
        if (isset($data['chatBubbleSentTextColor'])) $personalizacion->setChatBubbleSentTextColor($data['chatBubbleSentTextColor']);
        if (isset($data['chatBubbleReceivedBgColor'])) $personalizacion->setChatBubbleReceivedBgColor($data['chatBubbleReceivedBgColor']);
        if (isset($data['chatBubbleReceivedTextColor'])) $personalizacion->setChatBubbleReceivedTextColor($data['chatBubbleReceivedTextColor']);

        // Inputs
        if (isset($data['inputBgColor'])) $personalizacion->setInputBgColor($data['inputBgColor']);
        if (isset($data['inputTextColor'])) $personalizacion->setInputTextColor($data['inputTextColor']);
        if (isset($data['inputBorderColor'])) $personalizacion->setInputBorderColor($data['inputBorderColor']);
        if (isset($data['inputFocusBorderColor'])) $personalizacion->setInputFocusBorderColor($data['inputFocusBorderColor']);
        if (isset($data['inputFocusShadowColor'])) $personalizacion->setInputFocusShadowColor($data['inputFocusShadowColor']);

        // EventCard & EventsSidebar
        if (isset($data['eventCardBgColor'])) $personalizacion->setEventCardBgColor($data['eventCardBgColor']);
        if (isset($data['eventCardBorderColor'])) $personalizacion->setEventCardBorderColor($data['eventCardBorderColor']);
        if (isset($data['eventCardTitleColor'])) $personalizacion->setEventCardTitleColor($data['eventCardTitleColor']);
        if (isset($data['eventCardMetaColor'])) $personalizacion->setEventCardMetaColor($data['eventCardMetaColor']);
        if (isset($data['eventsSidebarBgColor'])) $personalizacion->setEventsSidebarBgColor($data['eventsSidebarBgColor']);
        if (isset($data['eventsSidebarTitleColor'])) $personalizacion->setEventsSidebarTitleColor($data['eventsSidebarTitleColor']);

        // Dashboard Widgets
        if (isset($data['widgetBgColor'])) $personalizacion->setWidgetBgColor($data['widgetBgColor']);
        if (isset($data['widgetHeaderBgColor'])) $personalizacion->setWidgetHeaderBgColor($data['widgetHeaderBgColor']);
        if (isset($data['widgetHeaderTextColor'])) $personalizacion->setWidgetHeaderTextColor($data['widgetHeaderTextColor']);
        if (isset($data['widgetBorderColor'])) $personalizacion->setWidgetBorderColor($data['widgetBorderColor']);
        if (isset($data['widgetItemTextColor'])) $personalizacion->setWidgetItemTextColor($data['widgetItemTextColor']);
        if (isset($data['widgetItemHoverBgColor'])) $personalizacion->setWidgetItemHoverBgColor($data['widgetItemHoverBgColor']);
        if (isset($data['widgetIconColor'])) $personalizacion->setWidgetIconColor($data['widgetIconColor']);

        // Paginación (Items Per Page)
        if (isset($data['itemsPerPageUsuarios'])) $personalizacion->setItemsPerPageUsuarios((int)$data['itemsPerPageUsuarios']);
        if (isset($data['itemsPerPageCentros'])) $personalizacion->setItemsPerPageCentros((int)$data['itemsPerPageCentros']);
        if (isset($data['itemsPerPageCiclos'])) $personalizacion->setItemsPerPageCiclos((int)$data['itemsPerPageCiclos']);
        if (isset($data['itemsPerPageGrupos'])) $personalizacion->setItemsPerPageGrupos((int)$data['itemsPerPageGrupos']);
        if (isset($data['itemsPerPageModulos'])) $personalizacion->setItemsPerPageModulos((int)$data['itemsPerPageModulos']);
        if (isset($data['itemsPerPageMatriculas'])) $personalizacion->setItemsPerPageMatriculas((int)$data['itemsPerPageMatriculas']);
        if (isset($data['itemsPerPageImparticiones'])) $personalizacion->setItemsPerPageImparticiones((int)$data['itemsPerPageImparticiones']);
        if (isset($data['itemsPerPageHorarios'])) $personalizacion->setItemsPerPageHorarios((int)$data['itemsPerPageHorarios']);

        // Configuración Título Centro
        if (isset($data['nameTitleConfig'])) {
            $personalizacion->setNameTitleConfig($data['nameTitleConfig']);
        }

        try {
            $entityManager->persist($personalizacion);
            $entityManager->flush();

            // --- VERIFICACIÓN DE PERSISTENCIA ---
            $id = $personalizacion->getId();
            $entityManager->clear();

            $savedEntity = $entityManager->getRepository(Personalizacion::class)->find($id);

            if ($savedEntity) {
                $personalizacion = $savedEntity;
            } else {
                $logger->error('ERROR CRÍTICO: No se pudo recuperar la entidad después de guardar. ID: ' . $id);
            }

        } catch (\Exception $e) {
            $logger->error('ERROR AL GUARDAR PERSONALIZACION: ' . $e->getMessage());
            return $this->json(['message' => 'Error al guardar: ' . $e->getMessage()], 500);
        }

        return $this->json([
            'message' => 'Configuración guardada correctamente',
            'personalizacion' => $personalizacion
        ], 200, [], ['groups' => ['personalizacion:read']]);
    }
}
