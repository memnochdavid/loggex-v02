import React, { useState, useEffect, useRef } from 'react';
import logoApp from '../../public/logo_app.png';
import styles from './Home.module.css';
import Button from '../components/Button';
import { useAuth } from '../context/AuthContext';
import Layout from '../components/Layout';
import { getApiUrl } from '../config/api';
import NotificationList from '../components/NotificationList';
import UpcomingEventsWidget from '../components/UpcomingEventsWidget';
import PendingTasksWidget from '../components/PendingTasksWidget';
import TablonWidget from '../components/TablonWidget';
import CrudHeader from '../components/CrudHeader';
import AccordionView from '../components/AccordionView';
import { MessageSquare, CalendarClock, ClipboardList, Megaphone } from 'lucide-react';

const Home = () => {
  const [backendMessage, setBackendMessage] = useState('Cargando...');
  const { user } = useAuth();
  const tablonRef = useRef(null);

  const isAlumno = user?.roles?.includes('ROLE_ALUMNO');
  const isAdmin = user?.roles?.includes('ROLE_ADMIN');
  const isSuperAdmin = user?.roles?.includes('ROLE_SUPER_ADMIN') || user?.roles?.includes('ROLE_SUPERADMIN');

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

  // Definición de los widgets para el AccordionView
  const widgets = [];

  // 0. Tablón de Anuncios
  widgets.push({
      id: 'tablon',
      title: 'Tablón de Anuncios',
      icon: <Megaphone size={20} />,
      component: <TablonWidget ref={tablonRef} hideHeader={true} />,
      canAdd: isAdmin || isSuperAdmin,
      onAdd: () => {
          if (tablonRef.current) {
              tablonRef.current.openModal();
          }
      }
  });

  // 1. Mensajes Recientes
  widgets.push({
      id: 'notifications',
      title: 'Mensajes Recientes',
      icon: <MessageSquare size={20} />,
      component: <NotificationList limit={5} showViewAllButton={true} hideHeader={true} onlyUnread={false} />
  });

  // 2. Tareas Pendientes (Si es alumno)
  if (isAlumno) {
      widgets.push({
          id: 'tasks',
          title: 'Tareas Pendientes',
          icon: <ClipboardList size={20} />,
          component: <PendingTasksWidget hideHeader={true} />
      });
  }

  // 3. Horario de Hoy
  widgets.push({
      id: 'events',
      title: 'Horario de Hoy',
      icon: <CalendarClock size={20} />,
      component: <UpcomingEventsWidget hideHeader={true} />
  });

  // Renderizado personalizado del header del acordeón
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
              {widgets.map(widget => (
                  <AccordionView 
                      key={widget.id}
                      data={[widget]} 
                      renderItem={(item) => item.component}
                      renderHeader={renderWidgetHeader}
                      className={styles.widgetsAccordion}
                      defaultOpenAll={true}
                      canAdd={widget.canAdd}
                      onAdd={widget.onAdd}
                  />
              ))}
          </div>
      </div>
    </Layout>
  );
};

export default Home;
