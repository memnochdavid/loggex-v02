/**
 * Tour: cómo entregar una tarea (rol Alumno).
 * Recorre el sidebar de alumno y desemboca en /entregas, donde el alumno
 * verá las tareas asignadas y podrá adjuntar archivo + enviar.
 */
export default {
    id: 'alumno-entregar-tarea',
    titleKey: 'tour.alumnoEntregarTarea.title',
    descKey:  'tour.alumnoEntregarTarea.desc',
    roles: ['ROLE_ALUMNO', 'ROLE_SUPERADMIN'],
    accordionSection: 'alumno',
    isAutoStart: false,
    /* Badge contextual en la página de entregas. */
    trigger: { route: '/entregas' },
    steps: [
        {
            targetId: 'sidebar-entregas',
            contentKey: 'tour.alumnoEntregarTarea.step1',
            titleKey:   'tour.alumnoEntregarTarea.step1Title',
            placement: 'right',
            disableBeacon: true,
        },
        {
            targetId: 'sidebar-faltas',
            contentKey: 'tour.alumnoEntregarTarea.step2',
            titleKey:   'tour.alumnoEntregarTarea.step2Title',
            placement: 'right',
        },
        {
            targetId: 'sidebar-apuntes',
            contentKey: 'tour.alumnoEntregarTarea.step3',
            titleKey:   'tour.alumnoEntregarTarea.step3Title',
            placement: 'right',
        },
    ],
};
