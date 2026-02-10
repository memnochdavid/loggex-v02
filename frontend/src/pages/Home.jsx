import React, { useState, useEffect } from 'react';
import logoApp from '../../public/logo_app.png';
import styles from './Home.module.css';
import Button from '../components/Button';
import { useAuth } from '../context/AuthContext';
import Layout from '../components/Layout';
import { getApiUrl } from '../config/api';
import NotificationList from '../components/NotificationList'; // Importar widget de notificaciones

const Home = () => {
  const [count, setCount] = useState(0);
  const [backendMessage, setBackendMessage] = useState('Cargando...');
  const { user } = useAuth();

  useEffect(() => {
    // Usamos la misma URL que en AuthContext
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
          <div className={styles.welcomeSection}>
              <img src={logoApp} className={styles.logo} alt="LM logo" />
              <h1>Bienvenido, {user?.nombre}</h1>
          </div>
          
          <div className={styles.dashboardGrid}>
              {/* Widget de Mensajes Recientes */}
              <div className={styles.card} style={{ padding: 0, overflow: 'hidden' }}>
                  <NotificationList 
                      title="Mensajes Recientes" 
                      limit={5} 
                      showViewAllButton={true} 
                  />
              </div>

              {/* Widget de Estado del Backend (Legacy/Debug) */}
              <div className={styles.card}>
                <h2>Estado del Backend:</h2>
                <p className={`${styles.backendStatus} ${isError ? styles.statusError : styles.statusSuccess}`}>
                  {backendMessage}
                </p>
              </div>
              
              {/* Widget de Contador (Legacy/Demo) */}
              <div className={styles.card}>
                <Button onClick={() => setCount((count) => count + 1)}>
                  Contador es {count}
                </Button>
              </div>
          </div>
      </div>
    </Layout>
  );
};

export default Home;
