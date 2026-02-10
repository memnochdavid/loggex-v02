// Configuración de la URL de la API
// Usamos rutas relativas para que funcione tanto en localhost:8888 como en Ngrok
// Caddy se encarga de redirigir /api/* al backend

export const API_BASE_URL = '';

// Intervalos de Polling (en milisegundos)
export const POLLING_INTERVAL_NOTIFICATIONS = 1000; // 30 segundos para el Header
export const POLLING_INTERVAL_CHAT = 1000;         // 5 segundos para el Chat activo

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
