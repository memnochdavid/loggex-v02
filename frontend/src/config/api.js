// Configuración de la URL de la API
// Usamos rutas relativas para que funcione tanto en localhost:8888 como en Ngrok
// Caddy se encarga de redirigir /api/* al backend

export const API_BASE_URL = '';

// Helper para construir URLs completas
export const getApiUrl = (path) => {
    // Asegurar que el path empiece con /
    const cleanPath = path.startsWith('/') ? path : `/${path}`;

    // Si el path ya incluye /api, lo dejamos tal cual (relativo a la raíz)
    // Si no, podríamos añadirlo, pero asumimos que los componentes pasan la ruta completa deseada
    return `${API_BASE_URL}${cleanPath}`;
};

// Helper para URLs de imágenes/uploads
export const getAssetUrl = (path) => {
    if (!path) return '';
    const cleanPath = path.startsWith('/') ? path : `/${path}`;
    return `${API_BASE_URL}${cleanPath}`;
};

/**
 * URL de la documentación API Platform (Swagger/Redoc UI).
 *
 * No usa la `API_BASE_URL` relativa porque la página de docs sirve sus
 * propios assets (CSS, JS de Swagger UI) desde el backend; Caddy no la
 * proxy-ea como las rutas REST. Por eso apunta directamente al puerto
 * del backend (9443 en docker-compose dev por defecto).
 *
 * Para entornos donde el backend esté en otro host/puerto, exponer
 * `VITE_BACKEND_URL` (p.ej. `https://api.tu-dominio.com`) en el `.env`
 * del frontend antes del build.
 */
export const API_DOCS_URL = import.meta.env.VITE_BACKEND_URL
    ? `${import.meta.env.VITE_BACKEND_URL}/api/docs`
    : 'https://localhost:9443/api/docs';
