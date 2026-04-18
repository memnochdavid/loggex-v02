/**
 * Tour: cómo encontrar y usar el editor visual de horarios.
 * Apto para Profesor (que ve su propio horario) y para Admin
 * (que tiene acceso al editor de arrastrar-y-soltar).
 */
export default {
    id: 'profesor-editor-horarios',
    titleKey: 'tour.profesorEditorHorarios.title',
    descKey:  'tour.profesorEditorHorarios.desc',
    roles: ['ROLE_PROFESOR', 'ROLE_ADMIN', 'ROLE_SUPERADMIN'],
    accordionSection: 'general',
    isAutoStart: false,
    steps: [
        {
            targetId: 'sidebar-horarios',
            contentKey: 'tour.profesorEditorHorarios.step1',
            titleKey:   'tour.profesorEditorHorarios.step1Title',
            placement: 'right',
            disableBeacon: true,
        },
        {
            targetId: 'sidebar-admin-horarios',
            contentKey: 'tour.profesorEditorHorarios.step2',
            titleKey:   'tour.profesorEditorHorarios.step2Title',
            placement: 'right',
        },
    ],
};
