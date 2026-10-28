/**
 * Registro central de tours interactivos.
 *
 * Cada tour es un objeto con la forma:
 *
 *   {
 *     id:                'identificador-unico',          // string, key de persistencia
 *     titleKey:          'tour.miTour.title',            // i18n key — menú Ayuda
 *     descKey:           'tour.miTour.desc',             // i18n key (opc.) — descripción corta
 *     roles:             ['ROLE_ALUMNO', ...],           // roles autorizados
 *     accordionSection:  'profesor',                     // (opc.) acordeón del Sidebar a expandir
 *     isAutoStart:       true,                           // si se lanza solo en el primer login
 *     steps: [
 *       {
 *         targetId:      'sidebar-home',                 // selector via [data-tour="..."]
 *         contentKey:    'tour.miTour.step1',
 *         titleKey:      'tour.miTour.step1Title',
 *         placement:     'right',                        // top|bottom|left|right|auto
 *         disableBeacon: true,
 *       },
 *       ...
 *     ],
 *   }
 *
 * Para añadir un tour: créalo en su carpeta (common/, alumno/, profesor/, admin/)
 * e impórtalo aquí. El orden del array es el orden de aparición en el menú Ayuda.
 */

import primerLogin            from './common/primer-login';
import alumnoEntregarTarea    from './alumno/entregar-tarea';
import alumnoVerCalificaciones from './alumno/ver-calificaciones';
import profesorPonerNota      from './profesor/poner-nota';
import profesorEditorHorarios from './profesor/editor-horarios';
import adminPersonalizarCentro from './admin/personalizar-centro';
import adminCrearGrupo        from './admin/crear-grupo';

export const tourRegistry = [
    primerLogin,
    /* Alumno */
    alumnoEntregarTarea,
    alumnoVerCalificaciones,
    /* Profesor (también accesibles para Admin/SuperAdmin) */
    profesorPonerNota,
    profesorEditorHorarios,
    /* Admin / SuperAdmin */
    adminPersonalizarCentro,
    adminCrearGrupo,
];
