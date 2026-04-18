/**
 * Tour: personalización visual del centro (rol Admin/SuperAdmin).
 * Apunta a la entrada de Configuración donde se puede tematizar la UI:
 * colores, tipografías, fondos animados, layout, etc.
 */
export default {
    id: 'admin-personalizar-centro',
    titleKey: 'tour.adminPersonalizarCentro.title',
    descKey:  'tour.adminPersonalizarCentro.desc',
    roles: ['ROLE_ADMIN', 'ROLE_SUPERADMIN'],
    accordionSection: 'administracion',
    isAutoStart: false,
    trigger: { route: '/configuracion' },
    steps: [
        {
            targetId: 'sidebar-configuracion',
            contentKey: 'tour.adminPersonalizarCentro.step1',
            titleKey:   'tour.adminPersonalizarCentro.step1Title',
            placement: 'right',
            disableBeacon: true,
        },
    ],
};
