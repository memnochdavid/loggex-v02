// Función para convertir hex a rgb
const hexToRgb = (hex) => {
    const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
    return result ? {
        r: parseInt(result[1], 16),
        g: parseInt(result[2], 16),
        b: parseInt(result[3], 16)
    } : null;
};

// Función para mezclar colores
const mixColors = (color1, color2, weight) => {
    const w1 = weight;
    const w2 = 1 - w1;
    const rgb1 = hexToRgb(color1);
    const rgb2 = hexToRgb(color2);

    if (!rgb1 || !rgb2) return color1;

    const r = Math.round(rgb1.r * w1 + rgb2.r * w2);
    const g = Math.round(rgb1.g * w1 + rgb2.g * w2);
    const b = Math.round(rgb1.b * w1 + rgb2.b * w2);

    return `rgb(${r}, ${g}, ${b})`;
};

export const applyTheme = (colors) => {
    const root = document.documentElement;
    
    // Valores por defecto
    const defaults = {
        primaryColor: '#6366f1',
        secondaryColor: '#64748b',
        viewBackgroundColor: '#ffffff',
        borderRadius: '0.5rem',
        showLottie: true,
        enableDraggableModal: true,
        showAnimatedBackground: false,
        sidebarColor: '#1e293b',
        sidebarActiveColor: '#334155',
        sidebarActiveTextColor: '#ffffff',
        sidebarHoverColor: '#334155',
        sidebarHoverTextColor: '#ffffff',
        
        // Sidebar Accordion
        sidebarAccordionHeaderBgColor: '#1e293b',
        sidebarAccordionHeaderTextColor: '#ffffff',
        sidebarAccordionContentBgColor: '#0f172a',
        sidebarAccordionContentTextColor: '#cbd5e1',

        textMainColor: '#334155',
        textSecondaryColor: '#64748b',
        specialTextColor: '#ffffff',
        buttonPrimaryColor: '#6366f1',
        buttonPrimaryTextColor: '#ffffff',
        buttonSecondaryColor: '#ffffff',
        buttonSecondaryTextColor: '#334155',
        headerFooterColor: '#1e293b',
        headerFooterTextColor: '#ffffff',
        scrollbarThumbColor: '#cbd5e1',
        scrollbarTrackColor: '#f1f5f9',
        scrollbarHoverColor: '#94a3b8',
        scrollbarWidth: '12px',
        calendarSelectedBgColor: '#6366f1',
        calendarSelectedTextColor: '#ffffff',
        calendarWeekendBgColor: '#f1f5f9',
        calendarWeekendTextColor: '#64748b',
        timetableHeaderBgColor: '#f1f5f9',
        timetableHeaderTextColor: '#334155',
        timetableHoursBgColor: '#f8fafc',
        timetableHoursTextColor: '#64748b',
        timetableSelectedHeaderBg: '#e0e7ff',
        timetableSelectedHeaderText: '#4338ca',
        timetableSelectedCellBg: '#eef2ff',
        datatableHeaderBgColor: '#f8fafc',
        datatableHeaderTextColor: '#64748b',
        datatableHeaderHoverBgColor: '#f1f5f9',
        datatableHeaderHoverTextColor: '#334155',
        datatableHeaderActiveBgColor: '#e2e8f0',
        datatableHeaderActiveTextColor: '#1e293b',
        datatablePaginationBgColor: '#f8fafc',
        datatablePaginationTextColor: '#64748b',
        datatablePaginationButtonBgColor: '#ffffff',
        datatablePaginationButtonTextColor: '#64748b',
        datatablePaginationButtonHoverBgColor: '#f1f5f9',
        datatablePaginationButtonHoverTextColor: '#334155',
        datatablePaginationButtonActiveBgColor: '#e2e8f0',
        datatablePaginationButtonActiveTextColor: '#1e293b',
        
        // Accordion
        accordionHeaderBgColor: '#5c94f0',
        accordionHeaderTextColor: '#ffffff',
        accordionHeaderActiveBgColor: '#77a9f8',
        accordionHeaderActiveTextColor: '#ffffff',
        accordionContentBgColor: '#f0f0f0',
        accordionContentTextColor: '#46505d',

        modalHeaderBgColor: '#ffffff',
        modalHeaderTextColor: '#334155',
        modalBodyBgColor: '#ffffff',
        modalBodyTextColor: '#334155',
        modalFooterBgColor: '#f8fafc',
        modalCloseButtonBgColor: '#ffffff',
        modalCloseButtonTextColor: '#64748b',
        modalCloseButtonHoverBgColor: '#f1f5f9',
        modalCloseButtonHoverTextColor: '#334155',
        
        userCardBgColor: '#1e293b',
        userCardTextColor: '#ffffff',
        userCardTextSecondaryColor: '#cbd5e1',
        
        chatSidebarBgColor: '#ffffff',
        chatItemHoverBgColor: '#f1f5f9',
        chatItemActiveBgColor: '#e0e7ff',
        chatItemActiveBorderColor: '#6366f1',
        chatItemTextMainColor: '#334155',
        chatItemTextSecondaryColor: '#64748b',
        chatBadgeBgColor: '#6366f1',
        chatBadgeTextColor: '#ffffff',
        
        chatHeaderBgColor: '#1e293b',
        chatHeaderTextColor: '#ffffff',
        chatContainerBgColor: '#f8fafc',
        chatInputAreaBgColor: '#ffffff',
        chatBubbleSentBgColor: '#6366f1',
        chatBubbleSentTextColor: '#ffffff',
        chatBubbleReceivedBgColor: '#ffffff',
        chatBubbleReceivedTextColor: '#334155',

        // EventCard
        eventCardBgColor: '#ffffff',
        eventCardBorderColor: '#e2e8f0',
        eventCardTitleColor: '#334155',
        eventCardMetaColor: '#64748b',
        
        // EventsSidebar
        eventsSidebarBgColor: 'transparent',
        eventsSidebarTitleColor: '#334155',

        // Dashboard Widgets
        widgetBgColor: '#ffffff',
        widgetHeaderBgColor: '#ffffff',
        widgetHeaderTextColor: '#334155',
        widgetBorderColor: '#e2e8f0',
        widgetItemTextColor: '#334155',
        widgetItemHoverBgColor: '#f1f5f9',
        widgetIconColor: '#6366f1'
    };

    const theme = { ...defaults, ...colors };

    // Guardar configuración global
    window.themeConfig = {
        showLottie: theme.showLottie,
        enableDraggableModal: theme.enableDraggableModal,
        showAnimatedBackground: theme.showAnimatedBackground
    };
    window.dispatchEvent(new Event('themeConfigChanged'));

    // Fondo semi-transparente para cuando el fondo animado está activo
    if (theme.showAnimatedBackground) {
        root.style.setProperty('--bg-view-alpha', `color-mix(in srgb, ${theme.viewBackgroundColor} 88%, transparent)`);
    } else {
        root.style.removeProperty('--bg-view-alpha');
    }

    // --- VARIABLES MAESTRAS DERIVADAS (Para consistencia global) ---
    // Usamos widgetBgColor como base para tarjetas genéricas si no hay otra
    root.style.setProperty('--bg-card', theme.widgetBgColor);
    
    // Usamos color-mix con valores directos para evitar problemas de orden de variables
    // CORRECCIÓN: Usar --border-color en lugar de --color-border para coincidir con CSS modules
    root.style.setProperty('--border-color', `color-mix(in srgb, ${theme.widgetBgColor}, ${theme.textMainColor} 15%)`);
    root.style.setProperty('--color-border', `color-mix(in srgb, ${theme.widgetBgColor}, ${theme.textMainColor} 15%)`); // Mantener alias por si acaso
    
    // Inputs: Si el fondo de la vista es oscuro, el input debe ser un poco más claro u oscuro
    // Usamos color-mix con valores directos
    root.style.setProperty('--bg-input', `color-mix(in srgb, ${theme.viewBackgroundColor}, ${theme.textMainColor} 5%)`);
    root.style.setProperty('--text-input', theme.textMainColor);
    
    // Borde de input derivado
    root.style.setProperty('--border-input', `color-mix(in srgb, ${theme.viewBackgroundColor}, ${theme.textMainColor} 20%)`);

    // --- FIN VARIABLES MAESTRAS ---

    // 1. Color Primario
    if (theme.primaryColor) {
        const p = theme.primaryColor;
        root.style.setProperty('--color-primary-50', mixColors(p, '#ffffff', 0.05));
        root.style.setProperty('--color-primary-100', mixColors(p, '#ffffff', 0.1));
        root.style.setProperty('--color-primary-200', mixColors(p, '#ffffff', 0.25));
        root.style.setProperty('--color-primary-300', mixColors(p, '#ffffff', 0.45));
        root.style.setProperty('--color-primary-400', mixColors(p, '#ffffff', 0.75));
        root.style.setProperty('--color-primary-500', p);
        const pRgb = hexToRgb(p);
        if (pRgb) root.style.setProperty('--color-primary-rgb', `${pRgb.r}, ${pRgb.g}, ${pRgb.b}`);
        root.style.setProperty('--color-primary-600', mixColors(p, '#000000', 0.9));
        root.style.setProperty('--color-primary-700', mixColors(p, '#000000', 0.75));
        root.style.setProperty('--color-primary-800', mixColors(p, '#000000', 0.6));
        root.style.setProperty('--color-primary-900', mixColors(p, '#000000', 0.45));
    }

    // 1.1 Fondo de Vistas
    if (theme.viewBackgroundColor) {
        root.style.setProperty('--bg-view', theme.viewBackgroundColor);
    }

    // 1.2 Border Radius
    if (theme.borderRadius) {
        root.style.setProperty('--border-radius', theme.borderRadius);
        root.style.setProperty('--radius-md', theme.borderRadius);
        root.style.setProperty('--radius-lg', `calc(${theme.borderRadius} + 0.25rem)`);
        root.style.setProperty('--radius-sm', `calc(${theme.borderRadius} - 0.125rem)`);
        root.style.setProperty('--border-radius-small', `calc(${theme.borderRadius} - 0.125rem)`);
    }

    // 2. Sidebar
    if (theme.sidebarColor) root.style.setProperty('--bg-sidebar', theme.sidebarColor);
    if (theme.sidebarActiveColor) root.style.setProperty('--bg-sidebar-active', theme.sidebarActiveColor);
    if (theme.sidebarActiveTextColor) root.style.setProperty('--text-sidebar-active', theme.sidebarActiveTextColor);
    if (theme.sidebarHoverColor) root.style.setProperty('--bg-sidebar-hover', theme.sidebarHoverColor);
    if (theme.sidebarHoverTextColor) root.style.setProperty('--text-sidebar-hover', theme.sidebarHoverTextColor);

    // Sidebar Accordion
    if (theme.sidebarAccordionHeaderBgColor) root.style.setProperty('--sidebar-accordion-header-bg', theme.sidebarAccordionHeaderBgColor);
    if (theme.sidebarAccordionHeaderTextColor) root.style.setProperty('--sidebar-accordion-header-text', theme.sidebarAccordionHeaderTextColor);
    if (theme.sidebarAccordionContentBgColor) root.style.setProperty('--sidebar-accordion-content-bg', theme.sidebarAccordionContentBgColor);
    if (theme.sidebarAccordionContentTextColor) root.style.setProperty('--sidebar-accordion-content-text', theme.sidebarAccordionContentTextColor);

    // 3. Textos
    if (theme.textMainColor) root.style.setProperty('--text-main', theme.textMainColor);
    if (theme.textSecondaryColor) root.style.setProperty('--text-muted', theme.textSecondaryColor);
    if (theme.specialTextColor) root.style.setProperty('--text-special', theme.specialTextColor);

    // 4. Botones
    if (theme.buttonPrimaryColor) {
        root.style.setProperty('--btn-primary-bg', theme.buttonPrimaryColor);
        root.style.setProperty('--btn-primary-hover', mixColors(theme.buttonPrimaryColor, '#000000', 0.9));
    }
    if (theme.buttonPrimaryTextColor) root.style.setProperty('--btn-primary-text', theme.buttonPrimaryTextColor);
    if (theme.buttonSecondaryColor) root.style.setProperty('--btn-secondary-bg', theme.buttonSecondaryColor);
    if (theme.buttonSecondaryTextColor) root.style.setProperty('--btn-secondary-text', theme.buttonSecondaryTextColor);

    // 5. Header y Footer
    if (theme.headerFooterColor) root.style.setProperty('--bg-header-footer', theme.headerFooterColor);
    if (theme.headerFooterTextColor) root.style.setProperty('--text-header-footer', theme.headerFooterTextColor);

    // 6. Calendario y Horario
    if (theme.calendarSelectedBgColor) root.style.setProperty('--calendar-selected-bg', theme.calendarSelectedBgColor);
    if (theme.calendarSelectedTextColor) root.style.setProperty('--calendar-selected-text', theme.calendarSelectedTextColor);
    if (theme.calendarWeekendBgColor) root.style.setProperty('--calendar-weekend-bg', theme.calendarWeekendBgColor);
    if (theme.calendarWeekendTextColor) root.style.setProperty('--calendar-weekend-text', theme.calendarWeekendTextColor);
    
    if (theme.timetableHeaderBgColor) root.style.setProperty('--timetable-header-bg', theme.timetableHeaderBgColor);
    if (theme.timetableHeaderTextColor) root.style.setProperty('--timetable-header-text', theme.timetableHeaderTextColor);
    if (theme.timetableHoursBgColor) root.style.setProperty('--timetable-hours-bg', theme.timetableHoursBgColor);
    if (theme.timetableHoursTextColor) root.style.setProperty('--timetable-hours-text', theme.timetableHoursTextColor);
    
    if (theme.timetableSelectedHeaderBg) root.style.setProperty('--timetable-active-header-bg', theme.timetableSelectedHeaderBg);
    if (theme.timetableSelectedHeaderText) root.style.setProperty('--timetable-active-header-text', theme.timetableSelectedHeaderText);
    if (theme.timetableSelectedCellBg) root.style.setProperty('--timetable-active-cell-bg', theme.timetableSelectedCellBg);

    // 7. DataTable
    if (theme.datatableHeaderBgColor) root.style.setProperty('--datatable-header-bg', theme.datatableHeaderBgColor);
    if (theme.datatableHeaderTextColor) root.style.setProperty('--datatable-header-text', theme.datatableHeaderTextColor);
    if (theme.datatableHeaderHoverBgColor) root.style.setProperty('--datatable-header-hover-bg', theme.datatableHeaderHoverBgColor);
    if (theme.datatableHeaderHoverTextColor) root.style.setProperty('--datatable-header-hover-text', theme.datatableHeaderHoverTextColor);
    if (theme.datatableHeaderActiveBgColor) root.style.setProperty('--datatable-header-active-bg', theme.datatableHeaderActiveBgColor);
    if (theme.datatableHeaderActiveTextColor) root.style.setProperty('--datatable-header-active-text', theme.datatableHeaderActiveTextColor);
    
    if (theme.datatablePaginationBgColor) root.style.setProperty('--datatable-pagination-bg', theme.datatablePaginationBgColor);
    if (theme.datatablePaginationTextColor) root.style.setProperty('--datatable-pagination-text', theme.datatablePaginationTextColor);
    if (theme.datatablePaginationButtonBgColor) root.style.setProperty('--datatable-pagination-btn-bg', theme.datatablePaginationButtonBgColor);
    if (theme.datatablePaginationButtonTextColor) root.style.setProperty('--datatable-pagination-btn-text', theme.datatablePaginationButtonTextColor);
    if (theme.datatablePaginationButtonHoverBgColor) root.style.setProperty('--datatable-pagination-btn-hover-bg', theme.datatablePaginationButtonHoverBgColor);
    if (theme.datatablePaginationButtonHoverTextColor) root.style.setProperty('--datatable-pagination-btn-hover-text', theme.datatablePaginationButtonHoverTextColor);
    if (theme.datatablePaginationButtonActiveBgColor) root.style.setProperty('--datatable-pagination-btn-active-bg', theme.datatablePaginationButtonActiveBgColor);
    if (theme.datatablePaginationButtonActiveTextColor) root.style.setProperty('--datatable-pagination-btn-active-text', theme.datatablePaginationButtonActiveTextColor);

    // 8. Accordion
    if (theme.accordionHeaderBgColor) root.style.setProperty('--accordion-header-bg', theme.accordionHeaderBgColor);
    if (theme.accordionHeaderTextColor) root.style.setProperty('--accordion-header-text', theme.accordionHeaderTextColor);
    if (theme.accordionHeaderActiveBgColor) root.style.setProperty('--accordion-header-active-bg', theme.accordionHeaderActiveBgColor);
    if (theme.accordionHeaderActiveTextColor) root.style.setProperty('--accordion-header-active-text', theme.accordionHeaderActiveTextColor);
    if (theme.accordionContentBgColor) root.style.setProperty('--accordion-content-bg', theme.accordionContentBgColor);
    if (theme.accordionContentTextColor) root.style.setProperty('--accordion-content-text', theme.accordionContentTextColor);

    // 9. Modal
    if (theme.modalHeaderBgColor) root.style.setProperty('--modal-header-bg', theme.modalHeaderBgColor);
    if (theme.modalHeaderTextColor) root.style.setProperty('--modal-header-text', theme.modalHeaderTextColor);
    if (theme.modalBodyBgColor) root.style.setProperty('--modal-body-bg', theme.modalBodyBgColor);
    if (theme.modalBodyTextColor) root.style.setProperty('--modal-body-text', theme.modalBodyTextColor);
    if (theme.modalFooterBgColor) root.style.setProperty('--modal-footer-bg', theme.modalFooterBgColor);

    // 10. Modal Close Button
    if (theme.modalCloseButtonBgColor) root.style.setProperty('--modal-close-btn-bg', theme.modalCloseButtonBgColor);
    if (theme.modalCloseButtonTextColor) root.style.setProperty('--modal-close-btn-text', theme.modalCloseButtonTextColor);
    if (theme.modalCloseButtonHoverBgColor) root.style.setProperty('--modal-close-btn-hover-bg', theme.modalCloseButtonHoverBgColor);
    if (theme.modalCloseButtonHoverTextColor) root.style.setProperty('--modal-close-btn-hover-text', theme.modalCloseButtonHoverTextColor);

    // 12. UserCard
    if (theme.userCardBgColor) root.style.setProperty('--usercard-bg', theme.userCardBgColor);
    if (theme.userCardTextColor) root.style.setProperty('--usercard-text', theme.userCardTextColor);
    if (theme.userCardTextSecondaryColor) root.style.setProperty('--usercard-text-secondary', theme.userCardTextSecondaryColor);

    // 13. Chat
    if (theme.chatSidebarBgColor) root.style.setProperty('--chat-sidebar-bg', theme.chatSidebarBgColor);
    if (theme.chatItemHoverBgColor) root.style.setProperty('--chat-item-hover-bg', theme.chatItemHoverBgColor);
    if (theme.chatItemActiveBgColor) root.style.setProperty('--chat-item-active-bg', theme.chatItemActiveBgColor);
    if (theme.chatItemActiveBorderColor) root.style.setProperty('--chat-item-active-border', theme.chatItemActiveBorderColor);
    if (theme.chatItemTextMainColor) root.style.setProperty('--chat-item-text-main', theme.chatItemTextMainColor);
    if (theme.chatItemTextSecondaryColor) root.style.setProperty('--chat-item-text-secondary', theme.chatItemTextSecondaryColor);
    if (theme.chatBadgeBgColor) root.style.setProperty('--chat-badge-bg', theme.chatBadgeBgColor);
    if (theme.chatBadgeTextColor) root.style.setProperty('--chat-badge-text', theme.chatBadgeTextColor);
    
    if (theme.chatHeaderBgColor) root.style.setProperty('--chat-header-bg', theme.chatHeaderBgColor);
    if (theme.chatHeaderTextColor) root.style.setProperty('--chat-header-text', theme.chatHeaderTextColor);
    if (theme.chatContainerBgColor) root.style.setProperty('--chat-container-bg', theme.chatContainerBgColor);
    if (theme.chatInputAreaBgColor) root.style.setProperty('--chat-input-area-bg', theme.chatInputAreaBgColor);
    if (theme.chatBubbleSentBgColor) root.style.setProperty('--chat-bubble-sent-bg', theme.chatBubbleSentBgColor);
    if (theme.chatBubbleSentTextColor) root.style.setProperty('--chat-bubble-sent-text', theme.chatBubbleSentTextColor);
    if (theme.chatBubbleReceivedBgColor) root.style.setProperty('--chat-bubble-received-bg', theme.chatBubbleReceivedBgColor);
    if (theme.chatBubbleReceivedTextColor) root.style.setProperty('--chat-bubble-received-text', theme.chatBubbleReceivedTextColor);

    // 14. EventCard
    if (theme.eventCardBgColor) root.style.setProperty('--event-card-bg', theme.eventCardBgColor);
    if (theme.eventCardBorderColor) root.style.setProperty('--event-card-border', theme.eventCardBorderColor);
    if (theme.eventCardTitleColor) root.style.setProperty('--event-card-title-color', theme.eventCardTitleColor);
    if (theme.eventCardMetaColor) root.style.setProperty('--event-card-meta-color', theme.eventCardMetaColor);

    // 15. EventsSidebar
    if (theme.eventsSidebarBgColor) root.style.setProperty('--events-sidebar-bg', theme.eventsSidebarBgColor);
    if (theme.eventsSidebarTitleColor) root.style.setProperty('--events-sidebar-title-color', theme.eventsSidebarTitleColor);

    // 16. Dashboard Widgets
    if (theme.widgetBgColor) root.style.setProperty('--widget-bg', theme.widgetBgColor);
    if (theme.widgetHeaderBgColor) root.style.setProperty('--widget-header-bg', theme.widgetHeaderBgColor);
    if (theme.widgetHeaderTextColor) root.style.setProperty('--widget-header-text', theme.widgetHeaderTextColor);
    if (theme.widgetBorderColor) root.style.setProperty('--widget-border', theme.widgetBorderColor);
    if (theme.widgetItemTextColor) root.style.setProperty('--widget-item-text', theme.widgetItemTextColor);
    if (theme.widgetItemHoverBgColor) root.style.setProperty('--widget-item-hover-bg', theme.widgetItemHoverBgColor);
    if (theme.widgetIconColor) root.style.setProperty('--widget-icon-color', theme.widgetIconColor);

    // 11. Scrollbar (Inyección de estilos dinámicos)
    let styleTag = document.getElementById('theme-scrollbar-styles');
    if (!styleTag) {
        styleTag = document.createElement('style');
        styleTag.id = 'theme-scrollbar-styles';
        document.head.appendChild(styleTag);
    }

    const width = theme.scrollbarWidth || '12px';

    styleTag.innerHTML = `
        /* Firefox Scrollbar */
        * {
            scrollbar-width: ${width === 'auto' ? 'auto' : 'auto'};
            scrollbar-color: ${theme.scrollbarThumbColor} ${theme.scrollbarTrackColor};
        }

        /* Webkit Scrollbar (Chrome, Safari, Edge) */
        ::-webkit-scrollbar {
            width: ${width};
            height: ${width};
        }
        
        ::-webkit-scrollbar-track,
        *::-webkit-scrollbar-track {
            background: ${theme.scrollbarTrackColor} !important;
            border-radius: 4px;
        }
        
        ::-webkit-scrollbar-thumb,
        *::-webkit-scrollbar-thumb {
            background-color: ${theme.scrollbarThumbColor} !important;
            border-radius: 4px;
            border: 3px solid ${theme.scrollbarTrackColor};
        }
        
        ::-webkit-scrollbar-thumb:hover,
        *::-webkit-scrollbar-thumb:hover {
            background-color: ${theme.scrollbarHoverColor} !important;
        }
        
        ::-webkit-scrollbar-corner,
        *::-webkit-scrollbar-corner {
            background-color: ${theme.scrollbarTrackColor};
        }
    `;
};
