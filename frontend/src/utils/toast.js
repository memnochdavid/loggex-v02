import { toast as sonnerToast } from 'sonner';

export const toast = {
    success: (message, options) => sonnerToast.success(message, options),
    error: (message, options) => sonnerToast.error(message, options),
    info: (message, options) => sonnerToast.info(message, options),
    warning: (message, options) => sonnerToast.warning(message, options),
    loading: (message, options) => sonnerToast.loading(message, options),
    promise: (promise, messages, options) => sonnerToast.promise(promise, messages, options),
    dismiss: (id) => sonnerToast.dismiss(id),
    message: (message, options) => sonnerToast(message, options),
};

// Mensajes amigables por código HTTP cuando el backend no devuelve uno propio.
const HTTP_STATUS_MESSAGES = {
    400: 'La solicitud no es válida',
    401: 'Tu sesión ha expirado. Vuelve a iniciar sesión',
    403: 'No tienes permisos para realizar esta acción',
    404: 'No se ha encontrado el recurso',
    409: 'Ya existe un registro en conflicto',
    413: 'El archivo es demasiado grande',
    422: 'Los datos introducidos no son válidos',
    429: 'Demasiadas peticiones. Espera unos segundos e inténtalo de nuevo',
};

export async function parseErrorResponse(response, fallback = 'No se ha podido completar la operación') {
    // 1. Intentar extraer un mensaje del backend (JSON)
    try {
        const text = await response.text();
        if (text) {
            try {
                const data = JSON.parse(text);
                const msg = data['hydra:description'] || data.message || data.detail || data.error;
                if (msg && typeof msg === 'string') return msg;
            } catch {
                // No era JSON (p. ej. página HTML de error) — caer al mapeo por status
            }
        }
    } catch {
        // Fallo leyendo el body — caer al mapeo por status
    }

    // 2. Mapeo amigable por código HTTP
    if (HTTP_STATUS_MESSAGES[response.status]) {
        return HTTP_STATUS_MESSAGES[response.status];
    }
    if (response.status >= 500) {
        return 'Error en el servidor. Inténtalo de nuevo en unos instantes';
    }

    // 3. Último recurso
    return fallback;
}
