import React from 'react';
import Layout from '../components/Layout';
import styles from './About.module.css';
import { Server, Database, Layout as LayoutIcon, Shield, Code, Terminal, Layers } from 'lucide-react';

const About = () => {
  return (
    <Layout>
      <div className={styles.container}>
        <div className={styles.header}>
          <h1 className={styles.title}>Loggex v02</h1>
          <p className={styles.subtitle}>Plataforma de Gestión Académica Integral</p>
        </div>

        <div className={styles.section}>
          <h2 className={styles.sectionTitle}>
            <Layers className={styles.icon} /> Descripción General
          </h2>
          <p>
            Loggex v02 es una plataforma diseñada para la administración eficiente de centros educativos. 
            Permite la gestión centralizada de usuarios, centros, ciclos formativos, módulos, grupos y matrículas, 
            ofreciendo una experiencia moderna y personalizable.
          </p>
        </div>

        <div className={styles.grid}>
          <div className={styles.card}>
            <h3 className={styles.cardTitle}>
              <Server className={styles.cardIcon} /> Backend
            </h3>
            <ul className={styles.list}>
              <li><strong>Framework:</strong> Symfony 7 + API Platform 3</li>
              <li><strong>Lenguaje:</strong> PHP 8.4</li>
              <li><strong>API:</strong> RESTful (JSON-LD, Hydra)</li>
              <li><strong>Seguridad:</strong> JWT Authentication</li>
            </ul>
          </div>

          <div className={styles.card}>
            <h3 className={styles.cardTitle}>
              <LayoutIcon className={styles.cardIcon} /> Frontend
            </h3>
            <ul className={styles.list}>
              <li><strong>Framework:</strong> React 18 + Vite</li>
              <li><strong>Estilos:</strong> CSS Modules + Variables Dinámicas</li>
              <li><strong>Navegación:</strong> React Router</li>
              <li><strong>Iconos:</strong> Lucide React</li>
            </ul>
          </div>

          <div className={styles.card}>
            <h3 className={styles.cardTitle}>
              <Database className={styles.cardIcon} /> Datos
            </h3>
            <ul className={styles.list}>
              <li><strong>Motor:</strong> MariaDB 10.11</li>
              <li><strong>ORM:</strong> Doctrine</li>
              <li><strong>Migraciones:</strong> Doctrine Migrations</li>
              <li><strong>Fixtures:</strong> Datos de prueba automatizados</li>
            </ul>
          </div>

          <div className={styles.card}>
            <h3 className={styles.cardTitle}>
              <Shield className={styles.cardIcon} /> Infraestructura
            </h3>
            <ul className={styles.list}>
              <li><strong>Contenedores:</strong> Docker & Docker Compose</li>
              <li><strong>Proxy:</strong> Caddy Web Server (HTTPS)</li>
              <li><strong>Persistencia:</strong> Volúmenes Docker</li>
            </ul>
          </div>
        </div>

        <div className={styles.section}>
          <h2 className={styles.sectionTitle}>
            <Code className={styles.icon} /> Características Técnicas Destacadas
          </h2>
          <div className={styles.featuresGrid}>
            <div className={styles.featureItem}>
              <h4>Personalización Dinámica</h4>
              <p>Sistema de temas que permite a cada centro adaptar los colores y estilos de la interfaz en tiempo real.</p>
            </div>
            <div className={styles.featureItem}>
              <h4>Soft Delete</h4>
              <p>Implementación de borrado lógico para preservar la integridad histórica de los datos.</p>
            </div>
            <div className={styles.featureItem}>
              <h4>Seguridad Granular</h4>
              <p>Control de acceso basado en roles (RBAC) y filtrado automático de datos por centro mediante extensiones de Doctrine.</p>
            </div>
            <div className={styles.featureItem}>
              <h4>Arquitectura Escalable</h4>
              <p>Diseño basado en microservicios desacoplados, facilitando el mantenimiento y la escalabilidad.</p>
            </div>
          </div>
        </div>

      </div>
    </Layout>
  );
};

export default About;
