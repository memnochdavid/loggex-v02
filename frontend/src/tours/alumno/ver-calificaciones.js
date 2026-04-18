/**
 * Tour: dónde consultar tus notas, faltas y compañeros (rol Alumno).
 * Pequeño tour de orientación dentro de la sección "Alumno" del Sidebar.
 */
export default {
    id: 'alumno-ver-calificaciones',
    titleKey: 'tour.alumnoVerCalificaciones.title',
    descKey:  'tour.alumnoVerCalificaciones.desc',
    roles: ['ROLE_ALUMNO', 'ROLE_SUPERADMIN'],
    accordionSection: 'alumno',
    isAutoStart: false,
    steps: [
        {
            targetId: 'sidebar-mis-calificaciones',
            contentKey: 'tour.alumnoVerCalificaciones.step1',
            titleKey:   'tour.alumnoVerCalificaciones.step1Title',
            placement: 'right',
            disableBeacon: true,
        },
        {
            targetId: 'sidebar-faltas',
            contentKey: 'tour.alumnoVerCalificaciones.step2',
            titleKey:   'tour.alumnoVerCalificaciones.step2Title',
            placement: 'right',
        },
        {
            targetId: 'sidebar-companeros',
            contentKey: 'tour.alumnoVerCalificaciones.step3',
            titleKey:   'tour.alumnoVerCalificaciones.step3Title',
            placement: 'right',
        },
        {
            targetId: 'sidebar-mis-profesores',
            contentKey: 'tour.alumnoVerCalificaciones.step4',
            titleKey:   'tour.alumnoVerCalificaciones.step4Title',
            placement: 'right',
        },
    ],
};
