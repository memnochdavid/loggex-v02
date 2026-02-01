import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';

const usePageTitle = (baseTitle = 'Loggex-Machina') => {
  const location = useLocation();

  useEffect(() => {
    const path = location.pathname;
    let title = '';

    // Mapeo de rutas a títulos
    switch (true) {
      case path === '/':
        title = 'Inicio';
        break;
      case path === '/login':
        title = 'Iniciar Sesión';
        break;
      case path === '/about':
        title = 'Acerca de';
        break;
      case path === '/centros':
        title = 'Centros Educativos';
        break;
      case path === '/usuarios':
        title = 'Gestión de Usuarios';
        break;
      case path === '/ciclos':
        title = 'Ciclos Formativos';
        break;
      case path === '/grupos':
        title = 'Grupos';
        break;
      case path === '/modulos':
        title = 'Módulos';
        break;
      case path === '/matriculas':
        title = 'Matrículas';
        break;
      case path === '/imparticiones':
        title = 'Asignación Docente';
        break;
      case path === '/horarios':
        title = 'Horarios';
        break;
      case path === '/festivos':
        title = 'Festivos';
        break;
      case path === '/perfil':
        title = 'Mi Perfil';
        break;
      case path === '/configuracion':
        title = 'Configuración';
        break;
      default:
        // Para rutas no mapeadas o 404
        title = '';
    }

    document.title = title ? `${title} | ${baseTitle}` : baseTitle;
  }, [location, baseTitle]);
};

export default usePageTitle;
