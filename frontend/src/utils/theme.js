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
        sidebarColor: '#1e293b',
        sidebarActiveColor: '#334155',
        sidebarActiveTextColor: '#ffffff',
        sidebarHoverColor: '#334155',
        sidebarHoverTextColor: '#ffffff',
        textMainColor: '#334155',
        textSecondaryColor: '#64748b',
        buttonPrimaryColor: '#6366f1',
        buttonPrimaryTextColor: '#ffffff',
        buttonSecondaryColor: '#ffffff',
        buttonSecondaryTextColor: '#334155',
        headerFooterColor: '#1e293b',
        headerFooterTextColor: '#ffffff',
        scrollbarThumbColor: '#cbd5e1',
        scrollbarTrackColor: '#f1f5f9',
        scrollbarHoverColor: '#94a3b8',
        calendarSelectedBgColor: '#6366f1',
        calendarSelectedTextColor: '#ffffff',
        calendarWeekendBgColor: '#f1f5f9',
        calendarWeekendTextColor: '#64748b',
        timetableHeaderBgColor: '#f1f5f9',
        timetableHeaderTextColor: '#334155',
        timetableHoursBgColor: '#f8fafc',
        timetableHoursTextColor: '#64748b',
        timetableSelectedHeaderBg: '#e0e7ff', // RENOMBRADO
        timetableSelectedHeaderText: '#4338ca', // RENOMBRADO
        timetableSelectedCellBg: '#eef2ff', // RENOMBRADO
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
        datatablePaginationButtonActiveTextColor: '#1e293b'
    };

    const theme = { ...defaults, ...colors };

    // 1. Color Primario
    if (theme.primaryColor) {
        const p = theme.primaryColor;
        root.style.setProperty('--color-primary-50', mixColors(p, '#ffffff', 0.05));
        root.style.setProperty('--color-primary-100', mixColors(p, '#ffffff', 0.1));
        root.style.setProperty('--color-primary-200', mixColors(p, '#ffffff', 0.25));
        root.style.setProperty('--color-primary-300', mixColors(p, '#ffffff', 0.45));
        root.style.setProperty('--color-primary-400', mixColors(p, '#ffffff', 0.75));
        root.style.setProperty('--color-primary-500', p);
        root.style.setProperty('--color-primary-600', mixColors(p, '#000000', 0.9));
        root.style.setProperty('--color-primary-700', mixColors(p, '#000000', 0.75));
        root.style.setProperty('--color-primary-800', mixColors(p, '#000000', 0.6));
        root.style.setProperty('--color-primary-900', mixColors(p, '#000000', 0.45));
    }

    // 2. Sidebar
    if (theme.sidebarColor) root.style.setProperty('--bg-sidebar', theme.sidebarColor);
    if (theme.sidebarActiveColor) root.style.setProperty('--bg-sidebar-active', theme.sidebarActiveColor);
    if (theme.sidebarActiveTextColor) root.style.setProperty('--text-sidebar-active', theme.sidebarActiveTextColor);
    if (theme.sidebarHoverColor) root.style.setProperty('--bg-sidebar-hover', theme.sidebarHoverColor);
    if (theme.sidebarHoverTextColor) root.style.setProperty('--text-sidebar-hover', theme.sidebarHoverTextColor);

    // 3. Textos
    if (theme.textMainColor) {
        root.style.setProperty('--text-main', theme.textMainColor);
    }
    if (theme.textSecondaryColor) {
        root.style.setProperty('--text-muted', theme.textSecondaryColor);
    }

    // 4. Botones
    if (theme.buttonPrimaryColor) {
        root.style.setProperty('--btn-primary-bg', theme.buttonPrimaryColor);
        root.style.setProperty('--btn-primary-hover', mixColors(theme.buttonPrimaryColor, '#000000', 0.9));
    }
    if (theme.buttonPrimaryTextColor) {
        root.style.setProperty('--btn-primary-text', theme.buttonPrimaryTextColor);
    }
    if (theme.buttonSecondaryColor) {
        root.style.setProperty('--btn-secondary-bg', theme.buttonSecondaryColor);
    }
    if (theme.buttonSecondaryTextColor) {
        root.style.setProperty('--btn-secondary-text', theme.buttonSecondaryTextColor);
    }

    // 5. Header y Footer
    if (theme.headerFooterColor) {
        root.style.setProperty('--bg-header-footer', theme.headerFooterColor);
    }
    if (theme.headerFooterTextColor) {
        root.style.setProperty('--text-header-footer', theme.headerFooterTextColor);
    }

    // 6. Calendario y Horario
    if (theme.calendarSelectedBgColor) root.style.setProperty('--calendar-selected-bg', theme.calendarSelectedBgColor);
    if (theme.calendarSelectedTextColor) root.style.setProperty('--calendar-selected-text', theme.calendarSelectedTextColor);
    if (theme.calendarWeekendBgColor) root.style.setProperty('--calendar-weekend-bg', theme.calendarWeekendBgColor);
    if (theme.calendarWeekendTextColor) root.style.setProperty('--calendar-weekend-text', theme.calendarWeekendTextColor);
    
    if (theme.timetableHeaderBgColor) root.style.setProperty('--timetable-header-bg', theme.timetableHeaderBgColor);
    if (theme.timetableHeaderTextColor) root.style.setProperty('--timetable-header-text', theme.timetableHeaderTextColor);
    if (theme.timetableHoursBgColor) root.style.setProperty('--timetable-hours-bg', theme.timetableHoursBgColor);
    if (theme.timetableHoursTextColor) root.style.setProperty('--timetable-hours-text', theme.timetableHoursTextColor);
    
    // Nuevos campos de Horario (Día Activo) - RENOMBRADOS
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

    // 8. Scrollbar (Inyección de estilos dinámicos)
    let styleTag = document.getElementById('theme-scrollbar-styles');
    if (!styleTag) {
        styleTag = document.createElement('style');
        styleTag.id = 'theme-scrollbar-styles';
        document.head.appendChild(styleTag);
    }

    styleTag.innerHTML = `
        /* Firefox Scrollbar */
        * {
            scrollbar-width: thin;
            scrollbar-color: ${theme.scrollbarThumbColor} ${theme.scrollbarTrackColor};
        }

        /* Webkit Scrollbar (Chrome, Safari, Edge) */
        ::-webkit-scrollbar {
            width: 12px;
            height: 12px;
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
