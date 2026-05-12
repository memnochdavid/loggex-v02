import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { useTranslation } from 'react-i18next';

const usePageTitle = (baseTitle = 'Loggex-Machina') => {
  const location = useLocation();
  const { t } = useTranslation();

  useEffect(() => {
    const path = location.pathname;

    const routeTitles = {
      '/': t('sidebar.home'),
      '/login': t('login.title'),
      '/about': t('about.title'),
      '/centros': t('centers.title'),
      '/usuarios': t('users.title'),
      '/itinerarios': t('itinerarios.title'),
      '/grupos': t('groups.title'),
      '/materias': t('materias.title'),
      '/matriculas': t('enrollments.title'),
      '/docencia': t('teaching.title'),
      '/horarios': t('schedules.title'),
      '/fechas': 'Fechas',
      '/admin/horarios': t('sidebar.scheduleAdmin'),
      '/entregas': t('deliveries.title'),
      '/faltas': t('myAbsences.title'),
      '/mis-apuntes': t('studentMaterials.title'),
      '/mis-temarios': t('teacherMaterials.title'),
      '/mensajes': t('messages.title'),
      '/claustro': t('faculty.title'),
      '/companeros': t('classmates.title'),
      '/mis-profesores': t('myTeachers.title'),
      '/mis-alumnos': t('myStudents.title'),
      '/calificaciones': t('grades.title'),
      '/calificaciones/detalle': t('grades.title'),
      '/mis-calificaciones': t('grades.myGradesTitle'),
      '/admin/estadisticas': t('grades.adminTitle'),
      '/perfil': t('sidebar.profile'),
      '/personalizacion': t('config.title'),
    };

    const title = routeTitles[path] || '';
    document.title = title ? `${title} | ${baseTitle}` : baseTitle;
  }, [location, baseTitle, t]);
};

export default usePageTitle;
