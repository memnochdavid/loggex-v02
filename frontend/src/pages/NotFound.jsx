import React from 'react';
import { Link } from 'react-router-dom';
import styles from './NotFound.module.css';
import Button from '../components/Button';

const NotFound = () => {
  return (
    <div className={styles.container}>
      <h1 className={styles.errorCode}>404</h1>
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
