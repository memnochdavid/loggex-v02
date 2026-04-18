/**
 * Tour de bienvenida — primera vez que un usuario entra a Loggex.
 * Muestra los 4 elementos clave de la chrome: navegación lateral,
 * mensajes, notificaciones y menú de usuario.
 *
 * Auto-start: sí, una vez por usuario.
 * Roles: todos.
 */
export default {
    id: 'primer-login',
    titleKey: 'tour.primerLogin.title',
    descKey:  'tour.primerLogin.desc',
    roles: ['ROLE_ALUMNO', 'ROLE_PROFESOR', 'ROLE_ADMIN', 'ROLE_SUPERADMIN'],
    isAutoStart: true,
    steps: [
        {
            targetId: 'sidebar-home',
            contentKey: 'tour.primerLogin.step1',
            titleKey:   'tour.primerLogin.step1Title',
            placement: 'right',
            disableBeacon: true,
        },
        {
            targetId: 'sidebar-mensajes',
            contentKey: 'tour.primerLogin.step2',
            titleKey:   'tour.primerLogin.step2Title',
            placement: 'right',
        },
        {
            targetId: 'header-notifications',
            contentKey: 'tour.primerLogin.step3',
            titleKey:   'tour.primerLogin.step3Title',
            placement: 'bottom',
        },
        {
            targetId: 'header-user-menu',
            contentKey: 'tour.primerLogin.step4',
            titleKey:   'tour.primerLogin.step4Title',
            placement: 'bottom-end',
        },
    ],
};
