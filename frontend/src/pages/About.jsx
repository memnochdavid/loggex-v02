import React from 'react';
import Layout from '../components/Layout';
import styles from './About.module.css';
import { Server, Database, Layout as LayoutIcon, Shield, Code, Terminal, Layers } from 'lucide-react';
import { useTranslation } from 'react-i18next';

const About = () => {
  const { t } = useTranslation();
  return (
    <Layout>
      <div className={styles.container}>
        <div className={styles.header}>
          <h1 className={styles.title}>{t('about.title')}</h1>
          <p className={styles.subtitle}>{t('about.subtitle')}</p>
        </div>

        <div className={styles.section}>
          <h2 className={styles.sectionTitle}>
            <Layers className={styles.icon} /> {t('about.descriptionTitle')}
          </h2>
          <p>
            {t('about.description')}
          </p>
        </div>

        <div className={styles.grid}>
          <div className={styles.card}>
            <h3 className={styles.cardTitle}>
              <Server className={styles.cardIcon} /> {t('about.backend')}
            </h3>
            <ul className={styles.list}>
              <li><strong>{t('about.framework')}</strong> Symfony 7 + API Platform 3</li>
              <li><strong>{t('about.language')}</strong> PHP 8.4</li>
              <li><strong>{t('about.api')}</strong> RESTful (JSON-LD, Hydra)</li>
              <li><strong>{t('about.security')}</strong> JWT Authentication</li>
            </ul>
          </div>

          <div className={styles.card}>
            <h3 className={styles.cardTitle}>
              <LayoutIcon className={styles.cardIcon} /> {t('about.frontend')}
            </h3>
            <ul className={styles.list}>
              <li><strong>{t('about.framework')}</strong> React 18 + Vite</li>
              <li><strong>{t('about.styles')}</strong> CSS Modules + Variables Dinámicas</li>
              <li><strong>{t('about.navigation')}</strong> React Router</li>
              <li><strong>{t('about.icons')}</strong> Lucide React</li>
            </ul>
          </div>

          <div className={styles.card}>
            <h3 className={styles.cardTitle}>
              <Database className={styles.cardIcon} /> {t('about.data')}
            </h3>
            <ul className={styles.list}>
              <li><strong>{t('about.engine')}</strong> MariaDB 10.11</li>
              <li><strong>{t('about.orm')}</strong> Doctrine</li>
              <li><strong>{t('about.migrations')}</strong> Doctrine Migrations</li>
              <li><strong>{t('about.fixtures')}</strong> Datos de prueba automatizados</li>
            </ul>
          </div>

          <div className={styles.card}>
            <h3 className={styles.cardTitle}>
              <Shield className={styles.cardIcon} /> {t('about.infrastructure')}
            </h3>
            <ul className={styles.list}>
              <li><strong>{t('about.containers')}</strong> Docker & Docker Compose</li>
              <li><strong>{t('about.proxy')}</strong> Caddy Web Server (HTTPS)</li>
              <li><strong>{t('about.persistence')}</strong> Volúmenes Docker</li>
            </ul>
          </div>
        </div>

        <div className={styles.section}>
          <h2 className={styles.sectionTitle}>
            <Code className={styles.icon} /> {t('about.featuresTitle')}
          </h2>
          <div className={styles.featuresGrid}>
            <div className={styles.featureItem}>
              <h4>{t('about.featureDynamicTheme')}</h4>
              <p>Sistema de temas que permite a cada centro adaptar los colores y estilos de la interfaz en tiempo real.</p>
            </div>
            <div className={styles.featureItem}>
              <h4>{t('about.featureSoftDelete')}</h4>
              <p>Implementación de borrado lógico para preservar la integridad histórica de los datos.</p>
            </div>
            <div className={styles.featureItem}>
              <h4>{t('about.featureGranularSecurity')}</h4>
              <p>Control de acceso basado en roles (RBAC) y filtrado automático de datos por centro mediante extensiones de Doctrine.</p>
            </div>
            <div className={styles.featureItem}>
              <h4>{t('about.featureScalableArch')}</h4>
              <p>Diseño basado en microservicios desacoplados, facilitando el mantenimiento y la escalabilidad.</p>
            </div>
          </div>
        </div>

      </div>
    </Layout>
  );
};

export default About;
