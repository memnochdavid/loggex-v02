import React from 'react';
import styles from './Home.module.css'; // Reutilizamos estilos por simplicidad

const About = () => {
  return (
    <div className={styles.container}>
      <h1>Acerca de Loggex</h1>
      <div className={styles.card}>
        <p>
          Esta es una aplicación de demostración para mostrar cómo funciona
          el enrutamiento en React (SPA).
        </p>
        <p>
          El Header y el Footer se mantienen fijos, ¡solo cambia este contenido!
        </p>
      </div>
    </div>
  );
};

export default About;
