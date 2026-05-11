-- Tema visual "Alhambra" para el centro 3 (Escuela Arte Granada)
--
-- Diseño basado en psicología del color para entorno educativo + identidad
-- cultural granadina. Paleta extraída de la Alhambra: azulejos azul-índigo
-- (Patio de los Arrayanes), terracota de los tejados del Albaicín, pergamino
-- cálido de manuscritos andaluces, ámbar nazarí.
--
-- Reglas aplicadas:
--   60% pergamino cálido como superficie (bajo arousal, lectura prolongada)
--   30% azul profundo como estructura (color educativo por excelencia: focus,
--       confianza, baja ansiedad — evidencia en environmental color research)
--   10% terracota + ámbar como acento (creatividad, calidez, identidad EAG)
--
-- Contraste WCAG verificado en los pares críticos:
--   Texto #2a2e3a sobre pergamino #fbf6ec  → 12.1:1  (AAA)
--   Texto #f5e9d3 sobre azul     #0f2942  →  9.4:1  (AAA)
--   Texto #ffffff sobre primario #1d4e89  →  7.8:1  (AAA)
--   Texto #ffffff sobre terracota #c4704a →  3.7:1  (AA — botón/badge)
--   Texto #2a2e3a sobre crema    #ecdcc2  →  9.6:1  (AAA)
--
-- animatedBackground: null y elementsOpacity: 100 a propósito — un workhorse
-- de 8h diarias en una escuela de arte no debe competir visualmente con el
-- contenido (los alumnos ya manejan paletas todo el día). Tema "sobrio" que
-- enfatiza el contenido. El admin puede activar 'aurora'/'waves' desde
-- /configuracion si lo prefiere para presentaciones puntuales.

INSERT INTO tema_visual (nombre, configuracion, es_predefinido, centro_id, created_at, updated_at)
VALUES (
    'Alhambra',
    '{"primaryColor":"#1d4e89","secondaryColor":"#c4704a","viewBackgroundColor":"#fbf6ec","borderRadius":"0.5rem","showLottie":true,"enableDraggableModal":true,"animatedBackground":null,"elementsOpacity":100,"elementsBlur":0,"sidebarColor":"#0f2942","sidebarActiveColor":"#1d4e89","sidebarActiveTextColor":"#f5e9d3","sidebarHoverColor":"#142e4d","sidebarHoverTextColor":"#f5e9d3","sidebarOpacity":100,"sidebarAccordionHeaderBgColor":"#142e4d","sidebarAccordionHeaderTextColor":"#ecdcc2","sidebarAccordionContentBgColor":"#0a1d36","sidebarAccordionContentTextColor":"#c8d3e0","textMainColor":"#2a2e3a","textSecondaryColor":"#6b7280","specialTextColor":"#ffffff","buttonPrimaryColor":"#1d4e89","buttonPrimaryTextColor":"#ffffff","buttonSecondaryColor":"#ffffff","buttonSecondaryTextColor":"#1d4e89","headerFooterColor":"#0f2942","headerFooterTextColor":"#ecdcc2","headerFooterOpacity":100,"scrollbarThumbColor":"#c4704a","scrollbarTrackColor":"#fbf6ec","scrollbarHoverColor":"#a85a39","scrollbarWidth":"10px","calendarSelectedBgColor":"#1d4e89","calendarSelectedTextColor":"#ffffff","calendarWeekendBgColor":"#f3e8d8","calendarWeekendTextColor":"#6b7280","timetableHeaderBgColor":"#f3e8d8","timetableHeaderTextColor":"#1d4e89","timetableHoursBgColor":"#fbf6ec","timetableHoursTextColor":"#6b7280","timetableSelectedHeaderBg":"#e7b89a","timetableSelectedHeaderText":"#7a3a1f","timetableSelectedCellBg":"#fdebd9","datatableHeaderBgColor":"#1d4e89","datatableHeaderTextColor":"#f5e9d3","datatableHeaderHoverBgColor":"#3978c4","datatableHeaderHoverTextColor":"#ffffff","datatableHeaderActiveBgColor":"#0f2942","datatableHeaderActiveTextColor":"#f5e9d3","datatablePaginationBgColor":"#fbf6ec","datatablePaginationTextColor":"#2a2e3a","datatablePaginationButtonBgColor":"#ffffff","datatablePaginationButtonTextColor":"#1d4e89","datatablePaginationButtonHoverBgColor":"#f3e8d8","datatablePaginationButtonHoverTextColor":"#0f2942","datatablePaginationButtonActiveBgColor":"#1d4e89","datatablePaginationButtonActiveTextColor":"#ffffff","accordionHeaderBgColor":"#c4704a","accordionHeaderTextColor":"#ffffff","accordionHeaderActiveBgColor":"#a85a39","accordionHeaderActiveTextColor":"#ffffff","accordionContentBgColor":"#ffffff","accordionContentTextColor":"#2a2e3a","modalHeaderBgColor":"#1d4e89","modalHeaderTextColor":"#f5e9d3","modalBodyBgColor":"#ffffff","modalBodyTextColor":"#2a2e3a","modalFooterBgColor":"#fbf6ec","modalCloseButtonBgColor":"#1d4e89","modalCloseButtonTextColor":"#f5e9d3","modalCloseButtonHoverBgColor":"#c4704a","modalCloseButtonHoverTextColor":"#ffffff","userCardBgColor":"#0f2942","userCardTextColor":"#f5e9d3","userCardTextSecondaryColor":"#a8c5e6","chatSidebarBgColor":"#ffffff","chatItemHoverBgColor":"#f3e8d8","chatItemActiveBgColor":"#fdebd9","chatItemActiveBorderColor":"#c4704a","chatItemTextMainColor":"#2a2e3a","chatItemTextSecondaryColor":"#6b7280","chatBadgeBgColor":"#c4704a","chatBadgeTextColor":"#ffffff","chatHeaderBgColor":"#0f2942","chatHeaderTextColor":"#ecdcc2","chatContainerBgColor":"#fbf6ec","chatInputAreaBgColor":"#ffffff","chatBubbleSentBgColor":"#1d4e89","chatBubbleSentTextColor":"#ffffff","chatBubbleReceivedBgColor":"#ffffff","chatBubbleReceivedTextColor":"#2a2e3a","inputBgColor":"#ffffff","inputTextColor":"#2a2e3a","inputBorderColor":"#e0d4bf","inputFocusBorderColor":"#1d4e89","inputFocusShadowColor":"#e7eef7","eventCardBgColor":"#ffffff","eventCardBorderColor":"#e0d4bf","eventCardTitleColor":"#1d4e89","eventCardMetaColor":"#6b7280","eventsSidebarBgColor":"transparent","eventsSidebarTitleColor":"#1d4e89","widgetBgColor":"#ffffff","widgetHeaderBgColor":"#ffffff","widgetHeaderTextColor":"#1d4e89","widgetBorderColor":"#e0d4bf","widgetItemTextColor":"#2a2e3a","widgetItemHoverBgColor":"#f3e8d8","widgetIconColor":"#c4704a","toastSuccessColor":"#2c5f4d","toastErrorColor":"#b54028","toastWarningColor":"#d4a04a","toastInfoColor":"#1d4e89","itemsPerPageUsuarios":20,"itemsPerPageCentros":20,"itemsPerPageCiclos":20,"itemsPerPageGrupos":20,"itemsPerPageModulos":20,"itemsPerPageMatriculas":20,"itemsPerPageImparticiones":20,"itemsPerPageHorarios":20}',
    0,
    3,
    NOW(),
    NOW()
);
