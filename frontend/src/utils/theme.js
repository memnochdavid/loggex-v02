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
        headerFooterTextColor: '#ffffff'
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

    // 2. Color Secundario (Nuevo)
    if (theme.secondaryColor) {
        // Podríamos generar paleta secundaria si fuera necesario
        // Por ahora lo usamos para elementos secundarios específicos si se requiere
        // Pero el texto secundario tiene su propia variable
    }

    // 3. Sidebar
    if (theme.sidebarColor) root.style.setProperty('--bg-sidebar', theme.sidebarColor);
    if (theme.sidebarActiveColor) root.style.setProperty('--bg-sidebar-active', theme.sidebarActiveColor);
    if (theme.sidebarActiveTextColor) root.style.setProperty('--text-sidebar-active', theme.sidebarActiveTextColor);
    if (theme.sidebarHoverColor) root.style.setProperty('--bg-sidebar-hover', theme.sidebarHoverColor);
    if (theme.sidebarHoverTextColor) root.style.setProperty('--text-sidebar-hover', theme.sidebarHoverTextColor);

    // 4. Textos
    if (theme.textMainColor) {
        root.style.setProperty('--text-main', theme.textMainColor);
    }
    if (theme.textSecondaryColor) {
        root.style.setProperty('--text-muted', theme.textSecondaryColor);
    }

    // 5. Botones
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

    // 6. Header y Footer
    if (theme.headerFooterColor) {
        root.style.setProperty('--bg-header-footer', theme.headerFooterColor);
    }
    if (theme.headerFooterTextColor) {
        root.style.setProperty('--text-header-footer', theme.headerFooterTextColor);
    }
};
