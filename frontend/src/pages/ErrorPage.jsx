import React, { useState, useEffect } from 'react';
import { Link, useLocation } from 'react-router-dom';
import Lottie from 'lottie-react';
import styles from './NotFound.module.css'; // Reutilizamos estilos
import Button from '../components/Button';
import { getAssetUrl } from '../config/api';

const ErrorPage = () => {
  const location = useLocation();
  const [animationData, setAnimationData] = useState(null);
  
  // Obtener datos del error del estado de la navegación o valores por defecto
  const { errorCode = '403', title = 'Acceso Denegado', message = 'No tienes permiso para ver este recurso.' } = location.state || {};

  useEffect(() => {
    // Intentar cargar una animación de error (puedes añadir error.json en public)
    fetch(getAssetUrl('/error.json'))
      .then(response => response.ok ? response.json() : Promise.reject())
      .then(data => setAnimationData(data))
      .catch(() => {
          // Si falla, intentamos cargar la de 404 como fallback
          fetch(getAssetUrl('/404.json'))
            .then(res => res.json())
            .then(data => setAnimationData(data))
            .catch(e => console.error("Error loading lottie:", e));
      });
  }, []);

  return (
    <div className={styles.container}>
      <div className={styles.lottieContainer}>
        {animationData ? (
          <Lottie animationData={animationData} loop={true} />
        ) : (
          <h1 className={styles.errorCode}>{errorCode}</h1>
        )}
      </div>

      <h2 className={styles.title}>{title}</h2>
      <p className={styles.message}>{message}</p>
      
      <Link to="/" style={{ textDecoration: 'none' }}>
        <Button>
          Volver al Inicio
        </Button>
      </Link>
    </div>
  );
};

export default ErrorPage;
