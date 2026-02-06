import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import Lottie from 'lottie-react';
import styles from './NotFound.module.css';
import Button from '../components/Button';
import { getAssetUrl } from '../config/api';

const NotFound = () => {
  const [animationData, setAnimationData] = useState(null);

  useEffect(() => {
    fetch(getAssetUrl('/404.json'))
      .then(response => response.json())
      .then(data => setAnimationData(data))
      .catch(error => console.error("Error loading lottie:", error));
  }, []);

  return (
    <div className={styles.container}>
      <div className={styles.lottieContainer}>
        {animationData ? (
          <Lottie animationData={animationData} loop={true} />
        ) : (
          <h1 className={styles.errorCode}>404</h1>
        )}
      </div>

      <h2 className={styles.title}>Página no encontrada</h2>
      <p className={styles.message}>
        Lo sentimos, la página que estás buscando no existe o ha sido movida.
      </p>
      
      <Link to="/" style={{ textDecoration: 'none' }}>
        <Button>
          Volver al Inicio
        </Button>
      </Link>
    </div>
  );
};

export default NotFound;
