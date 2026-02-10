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

  return (
    <Layout>
      <div className={styles.container}>
          <CrudHeader 
              title={`Hola, ${user?.nombre || 'Usuario'}, que tengas un buen día.`}
              logo={logoApp}
              // subtitle="Panel de control" // Opcional
          >
              {/* Acciones extra si fueran necesarias */}
          </CrudHeader>
          
          <div className={styles.dashboardGrid}>
              {/* Widget de Mensajes Recientes (Para todos) */}
              <div className={styles.card} style={{ padding: 0, overflow: 'hidden' }}>
                  <NotificationList 
                      title="Mensajes Recientes" 
                      limit={5} 
                      showViewAllButton={true} 
                  />
              </div>

              {/* Widget de Próximos Eventos (Para todos) */}
              <div className={styles.card} style={{ padding: 0, overflow: 'hidden' }}>
                  <UpcomingEventsWidget />
              </div>

              {/* Widget de Tareas Pendientes (Solo Alumnos) */}
              {isAlumno && (
                  <div className={styles.card} style={{ padding: 0, overflow: 'hidden' }}>
                      <PendingTasksWidget />
                  </div>
              )}
          </div>
      </div>
    </Layout>
  );
};

export default Home;
