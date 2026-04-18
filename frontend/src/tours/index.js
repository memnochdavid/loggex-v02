/**
 * Registro central de tours interactivos.
 *
 * Cada tour es un objeto con la forma:
 *
 *   {
 *     id:           'identificador-unico',          // string, usado como key de persistencia
 *     titleKey:     'tour.miTour.title',            // i18n key para el menú Ayuda
 *     descKey:      'tour.miTour.desc',             // i18n key (opcional) — descripción corta
 *     roles:        ['ROLE_ALUMNO', ...],           // roles autorizados a verlo
 *     isAutoStart:  true,                           // si se lanza solo en el primer login
 *     steps: [
 *       {
 *         targetId:   'sidebar-home',               // selector via [data-tour="sidebar-home"]
 *         contentKey: 'tour.miTour.step1',          // i18n key del contenido
 *         titleKey:   'tour.miTour.step1Title',     // opcional — header del tooltip
 *         placement:  'right',                      // top|bottom|left|right|auto (default auto)
 *         disableBeacon: true,                      // no mostrar el "ping" antes del paso
 *       },
 *       ...
 *     ],
 *   }
 *
 * Para añadir un tour: créalo en su carpeta (common/, alumno/, profesor/, admin/)
 * e impórtalo aquí. El orden del array es el orden de aparición en el menú Ayuda.
 */

import primerLogin from './common/primer-login';

export const tourRegistry = [
    primerLogin,
    // Próximas fases añadirán aquí: alumno-entregar-tarea, profesor-poner-nota, etc.
];
