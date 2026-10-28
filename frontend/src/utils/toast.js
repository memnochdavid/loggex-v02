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

/**
 * Parsea la respuesta de error del backend y devuelve el mensaje a mostrar.
 *
 * Tres niveles de prioridad:
 *
 *   1. **i18n key** del backend: si la respuesta trae `{ messageKey, messageParams }`
 *      y se pasó el `t` de i18next como tercer argumento, se traduce en el
 *      cliente (patrón canónico para errores con variables tipo "Ya existe
 *      un usuario con DNI X"). Permite mantener todos los textos visibles
 *      al usuario en el frontend, evitando hardcodear español en el backend.
 *
 *   2. **String del backend**: si trae `message` / `detail` / `hydra:description`
 *      (formato API Platform o response plana), se usa tal cual.
 *
 *   3. **Mapeo por status HTTP** + fallback genérico.
 *
 * @param {Response} response - fetch Response.
 * @param {string} [fallback] - mensaje por defecto si no se puede inferir nada.
 * @param {function} [t] - traductor i18next (opcional). Sin él, los `messageKey` se ignoran.
 * @returns {Promise<string>}
 */
export async function parseErrorResponse(response, fallback = 'No se ha podido completar la operación', t = null) {
    // 1. Intentar extraer un mensaje del backend (JSON)
    try {
        const text = await response.text();
        if (text) {
            try {
                const data = JSON.parse(text);
                // Patrón i18n: backend emite clave + params, cliente traduce.
                if (data.messageKey && typeof t === 'function') {
                    return t(data.messageKey, data.messageParams || {});
                }
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
