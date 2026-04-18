/**
 * Tour: ciclo de calificación del profesor.
 * Recorre las herramientas docentes: entregas pendientes → calificación →
 * boletines → materiales y alumnado.
 */
export default {
    id: 'profesor-poner-nota',
    titleKey: 'tour.profesorPonerNota.title',
    descKey:  'tour.profesorPonerNota.desc',
    roles: ['ROLE_PROFESOR', 'ROLE_ADMIN', 'ROLE_SUPERADMIN'],
    accordionSection: 'profesor',
    isAutoStart: false,
    steps: [
        {
            targetId: 'sidebar-entregas',
            contentKey: 'tour.profesorPonerNota.step1',
            titleKey:   'tour.profesorPonerNota.step1Title',
            placement: 'right',
            disableBeacon: true,
        },
        {
            targetId: 'sidebar-calificaciones',
            contentKey: 'tour.profesorPonerNota.step2',
            titleKey:   'tour.profesorPonerNota.step2Title',
            placement: 'right',
        },
        {
            targetId: 'sidebar-mis-temarios',
            contentKey: 'tour.profesorPonerNota.step3',
            titleKey:   'tour.profesorPonerNota.step3Title',
            placement: 'right',
        },
        {
            targetId: 'sidebar-mis-alumnos',
            contentKey: 'tour.profesorPonerNota.step4',
            titleKey:   'tour.profesorPonerNota.step4Title',
            placement: 'right',
        },
    ],
};
