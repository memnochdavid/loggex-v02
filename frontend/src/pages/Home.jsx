import React, { useState, useEffect } from 'react';
import logoApp from '../../public/logo_app.png';
import styles from './Home.module.css';
import Button from '../components/Button';
import { useAuth } from '../context/AuthContext';
import Layout from '../components/Layout';

const Home = () => {
  const [count, setCount] = useState(0);
  const [backendMessage, setBackendMessage] = useState('Cargando...');
  const { user } = useAuth();

  useEffect(() => {
    // Usamos la misma URL que en AuthContext
    fetch('https://localhost:9443/api/hello', {
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
      <div>
        <a href="https://react.dev" target="_blank" rel="noreferrer">
          <img src={logoApp} className={styles.logo} alt="React logo" />
        </a>
      </div>
      <h1>Bienvenido, {user?.nombre}</h1>
      <div className={styles.card}>
        <h2>Estado del Backend:</h2>
        <p className={`${styles.backendStatus} ${isError ? styles.statusError : styles.statusSuccess}`}>
          {backendMessage}
        </p>
      </div>
      <div className={styles.card}>
        <Button onClick={() => setCount((count) => count + 1)}>
          Contador es {count}
        </Button>
      </div>
    </Layout>
  );
};

export default Home;
