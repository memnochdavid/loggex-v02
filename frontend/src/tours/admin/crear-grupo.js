/**
 * Tour: estructura académica completa (rol Admin/SuperAdmin).
 * Recorre Usuarios → Ciclos → Grupos → Módulos → Imparticiones, en el
 * orden lógico para montar un centro desde cero.
 */
export default {
    id: 'admin-crear-grupo',
    titleKey: 'tour.adminCrearGrupo.title',
    descKey:  'tour.adminCrearGrupo.desc',
    roles: ['ROLE_ADMIN', 'ROLE_SUPERADMIN'],
    accordionSection: 'administracion',
    isAutoStart: false,
    trigger: { route: '/grupos' },
    steps: [
        {
            targetId: 'sidebar-usuarios',
            contentKey: 'tour.adminCrearGrupo.step1',
            titleKey:   'tour.adminCrearGrupo.step1Title',
            placement: 'right',
            disableBeacon: true,
        },
        {
            targetId: 'sidebar-itinerarios',
            contentKey: 'tour.adminCrearGrupo.step2',
            titleKey:   'tour.adminCrearGrupo.step2Title',
            placement: 'right',
        },
        {
            targetId: 'sidebar-materias',
            contentKey: 'tour.adminCrearGrupo.step3',
            titleKey:   'tour.adminCrearGrupo.step3Title',
            placement: 'right',
        },
        {
            targetId: 'sidebar-grupos',
            contentKey: 'tour.adminCrearGrupo.step4',
            titleKey:   'tour.adminCrearGrupo.step4Title',
            placement: 'right',
        },
        {
            targetId: 'sidebar-matriculas',
            contentKey: 'tour.adminCrearGrupo.step5',
            titleKey:   'tour.adminCrearGrupo.step5Title',
            placement: 'right',
        },
        {
            targetId: 'sidebar-imparticiones',
            contentKey: 'tour.adminCrearGrupo.step6',
            titleKey:   'tour.adminCrearGrupo.step6Title',
            placement: 'right',
        },
    ],
};
