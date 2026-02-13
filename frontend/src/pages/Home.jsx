import React, { useState, useEffect } from 'react';
import logoApp from '../../public/logo_app.png';
import styles from './Home.module.css';
import Button from '../components/Button';
import { useAuth } from '../context/AuthContext';
import Layout from '../components/Layout';
import { getApiUrl } from '../config/api';
import NotificationList from '../components/NotificationList';
import UpcomingEventsWidget from '../components/UpcomingEventsWidget';
import PendingTasksWidget from '../components/PendingTasksWidget';
import CrudHeader from '../components/CrudHeader';
import AccordionView from '../components/AccordionView';
import { MessageSquare, CalendarClock, ClipboardList } from 'lucide-react';

const Home = () => {
  const [count, setCount] = useState(0);
  const [backendMessage, setBackendMessage] = useState('Cargando...');
  const { user } = useAuth();

  const isAlumno = user?.roles?.includes('ROLE_ALUMNO');
  const isProfesor = user?.roles?.includes('ROLE_PROFESOR');
  const isAdmin = user?.roles?.includes('ROLE_ADMIN');

  useEffect(() => {
    fetch(getApiUrl('/api/hello'), {
        credentials: 'include'
    })
      .then(response => {
          if (response.status === 401) return { message: 'No autorizado (Token expirado)' };
          return response.json();
      })
      .then(data => setBackendMessage(data.message))
      .catch(error => setBackendMessage('Error conectando al backend: ' + error));
  }, []);

  const isError = backendMessage && backendMessage.includes('Error');

  // Definición de los widgets para el AccordionView
  // ORDEN IMPORTANTE PARA MASONRY (Columnas CSS):
  // Los elementos se apilan verticalmente en la primera columna y luego pasan a la segunda.
  // Queremos:
  // Columna 1: Mensajes + Tareas (se apilan sin huecos)
  // Columna 2: Horario (ocupa toda la altura)
  
  const widgets = [];

  // 1. Mensajes Recientes (Siempre primero, arriba a la izquierda)
  widgets.push({
      id: 'notifications',
      title: 'Mensajes Recientes',
      icon: <MessageSquare size={20} />,
      component: <NotificationList limit={5} showViewAllButton={true} hideHeader={true} onlyUnread={false} />
  });

  // 2. Tareas Pendientes (Si es alumno, va debajo de mensajes en la columna izquierda)
  if (isAlumno) {
      widgets.push({
          id: 'tasks',
          title: 'Tareas Pendientes',
          icon: <ClipboardList size={20} />,
          component: <PendingTasksWidget hideHeader={true} />
      });
  }

  // 3. Horario de Hoy (Va al final, forzando que caiga en la segunda columna en desktop)
  widgets.push({
      id: 'events',
      title: 'Horario de Hoy',
      icon: <CalendarClock size={20} />,
      component: <UpcomingEventsWidget hideHeader={true} />
  });

  // Renderizado personalizado del header del acordeón para incluir iconos y estilos de widget
  const renderWidgetHeader = (item, isOpen) => (
      <div className={styles.accordionHeaderContent}>
          <span className={styles.accordionIcon} style={{ color: 'var(--widget-icon-color, var(--color-primary))' }}>
              {item.icon}
          </span>
          <span className={styles.accordionTitle} style={{ color: 'var(--widget-header-text, var(--color-text-main))' }}>
              {item.title}
          </span>
      </div>
  );

  return (
    <Layout>
      <div className={styles.container}>
          <CrudHeader 
              title={`Hola, ${user?.nombre || 'Usuario'}, que tengas un buen día.`}
              logo={logoApp}
          >
          </CrudHeader>
          
          <div className={styles.dashboardGrid}>
              {/* Renderizamos cada widget en su propio AccordionView independiente */}
              {widgets.map(widget => (
                  <AccordionView 
                      key={widget.id}
                      data={[widget]} // Pasamos solo este widget como dato
                      renderItem={(item) => item.component}
                      renderHeader={renderWidgetHeader}
                      className={styles.widgetsAccordion}
                      defaultOpenAll={true} // Abrir por defecto
                  />
              ))}
          </div>
      </div>
    </Layout>
  );
};

export default Home;
