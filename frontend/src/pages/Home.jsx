import React, { useState, useEffect } from 'react';
import reactLogo from '../assets/react.svg';
import styles from './Home.module.css';
import Button from '../components/Button'; // Importamos el componente

const Home = () => {
  const [count, setCount] = useState(0);
  const [backendMessage, setBackendMessage] = useState('Cargando...');

  useEffect(() => {
    fetch('https://localhost:9443/api/hello')
      .then(response => response.json())
      .then(data => setBackendMessage(data.message))
      .catch(error => setBackendMessage('Error conectando al backend: ' + error));
  }, []);

  const isError = backendMessage.includes('Error');

  return (
    <div className={styles.container}>
      <div>
        <a href="https://react.dev" target="_blank" rel="noreferrer">
          <img src={reactLogo} className={styles.logo} alt="React logo" />
        </a>
      </div>
      <h1>Bienvenido a Loggex v02</h1>
      
      <div className={styles.card}>
        <h2>Estado del Backend:</h2>
        <p className={`${styles.backendStatus} ${isError ? styles.statusError : styles.statusSuccess}`}>
          {backendMessage}
        </p>
      </div>

      <div className={styles.card}>
        {/* Usamos nuestro componente Button */}
        <Button onClick={() => setCount((count) => count + 1)} variant="primary">
          Contador es {count}
        </Button>
        
        <div style={{ marginTop: '1rem' }}>
            <Button variant="secondary" onClick={() => alert('Hola')}>
                Botón Secundario
            </Button>
        </div>
      </div>
    </div>
  );
};

export default Home;
