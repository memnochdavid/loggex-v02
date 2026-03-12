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
      '/ciclos': t('cycles.title'),
      '/grupos': t('groups.title'),
      '/modulos': t('modules.title'),
      '/matriculas': t('enrollments.title'),
      '/imparticiones': t('teaching.title'),
      '/horarios': t('schedules.title'),
      '/festivos': t('holidays.title'),
      '/tareas': t('tasks.title'),
      '/entregas': t('deliveries.title'),
      '/faltas': t('myAbsences.title'),
      '/apuntes': t('studentMaterials.title'),
      '/mis-temarios': t('teacherMaterials.title'),
      '/mensajes': t('messages.title'),
      '/claustro': t('faculty.title'),
      '/companeros': t('classmates.title'),
      '/mis-profesores': t('myTeachers.title'),
      '/mis-alumnos': t('myStudents.title'),
      '/perfil': t('sidebar.profile'),
      '/configuracion': t('config.title'),
    };

    const title = routeTitles[path] || '';
    document.title = title ? `${title} | ${baseTitle}` : baseTitle;
  }, [location, baseTitle, t]);
};

export default usePageTitle;
