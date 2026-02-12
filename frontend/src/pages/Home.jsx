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
  const widgets = [
      {
          id: 'notifications',
          title: 'Mensajes Recientes',
          icon: <MessageSquare size={20} />,
          component: <NotificationList limit={5} showViewAllButton={true} hideHeader={true} />
      },
      {
          id: 'events',
          title: 'Horario de Hoy',
          icon: <CalendarClock size={20} />,
          component: <UpcomingEventsWidget hideHeader={true} />
      }
  ];

  if (isAlumno) {
      widgets.push({
          id: 'tasks',
          title: 'Tareas Pendientes',
          icon: <ClipboardList size={20} />,
          component: <PendingTasksWidget hideHeader={true} />
      });
  }

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
              {/* Usamos AccordionView para renderizar los widgets */}
              <AccordionView 
                  data={widgets}
                  renderItem={(item) => item.component}
                  renderHeader={renderWidgetHeader}
                  className={styles.widgetsAccordion}
              />
          </div>
      </div>
    </Layout>
  );
};

export default Home;
