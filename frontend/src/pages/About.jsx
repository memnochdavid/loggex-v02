import React from 'react';
import Layout from '../components/Layout';
import styles from './About.module.css';
import { Server, Database, Layout as LayoutIcon, Shield, Code, Layers, HardDrive } from 'lucide-react';
import { useTranslation } from 'react-i18next';

const About = () => {
  const { t } = useTranslation();
  return (
    <Layout>
      <div className={styles.container}>
        <div className={styles.header}>
          <img src="/logo_app.png" alt="Loggex" className={styles.headerLogo} />
          <h1 className={styles.title}>{t('about.title')}</h1>
          <p className={styles.subtitle}>{t('about.subtitle')}</p>
        </div>

        <div className={styles.section}>
          <h2 className={styles.sectionTitle}>
            <Layers className={styles.icon} /> {t('about.descriptionTitle')}
          </h2>
          <p>{t('about.description')}</p>
        </div>

        <div className={styles.grid}>
          <div className={styles.card}>
            <h3 className={styles.cardTitle}>
              <Server className={styles.cardIcon} /> {t('about.backend')}
            </h3>
            <ul className={styles.list}>
              <li><strong>{t('about.framework')}</strong> Symfony 8 + API Platform 4</li>
              <li><strong>{t('about.language')}</strong> PHP 8.4</li>
              <li><strong>{t('about.api')}</strong> RESTful (JSON-LD, Hydra)</li>
              <li><strong>{t('about.security')}</strong> JWT (LexikJWT)</li>
              <li><strong>{t('about.orm')}</strong> Doctrine ORM 3</li>
            </ul>
          </div>

          <div className={styles.card}>
            <h3 className={styles.cardTitle}>
              <LayoutIcon className={styles.cardIcon} /> {t('about.frontend')}
            </h3>
            <ul className={styles.list}>
              <li><strong>{t('about.framework')}</strong> React 19 + Vite 7</li>
              <li><strong>{t('about.navigation')}</strong> React Router 7</li>
              <li><strong>{t('about.styles')}</strong> CSS Modules</li>
              <li><strong>{t('about.icons')}</strong> Lucide React</li>
              <li><strong>{t('about.i18n')}</strong> i18next + react-i18next</li>
              <li><strong>{t('about.animations')}</strong> Lottie React</li>
            </ul>
          </div>

          <div className={styles.card}>
            <h3 className={styles.cardTitle}>
              <Database className={styles.cardIcon} /> {t('about.data')}
            </h3>
            <ul className={styles.list}>
              <li><strong>{t('about.engine')}</strong> MariaDB 10.11</li>
              <li><strong>{t('about.orm')}</strong> Doctrine ORM 3</li>
              <li><strong>{t('about.migrations')}</strong> Doctrine Migrations</li>
              <li><strong>{t('about.storage')}</strong> MinIO (S3)</li>
            </ul>
          </div>

          <div className={styles.card}>
            <h3 className={styles.cardTitle}>
              <HardDrive className={styles.cardIcon} /> {t('about.infrastructure')}
            </h3>
            <ul className={styles.list}>
              <li><strong>{t('about.containers')}</strong> Docker Compose</li>
              <li><strong>{t('about.proxy')}</strong> Caddy 2 (HTTPS)</li>
              <li><strong>{t('about.storage')}</strong> MinIO (S3-compatible)</li>
              <li><strong>{t('about.persistence')}</strong> {t('about.dockerVolumes')}</li>
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
              <p>{t('about.featureDynamicThemeDesc')}</p>
            </div>
            <div className={styles.featureItem}>
              <h4>{t('about.featureMultilang')}</h4>
              <p>{t('about.featureMultilangDesc')}</p>
            </div>
            <div className={styles.featureItem}>
              <h4>{t('about.featureSoftDelete')}</h4>
              <p>{t('about.featureSoftDeleteDesc')}</p>
            </div>
            <div className={styles.featureItem}>
              <h4>{t('about.featureGranularSecurity')}</h4>
              <p>{t('about.featureGranularSecurityDesc')}</p>
            </div>
            <div className={styles.featureItem}>
              <h4>{t('about.featureAttendance')}</h4>
              <p>{t('about.featureAttendanceDesc')}</p>
            </div>
            <div className={styles.featureItem}>
              <h4>{t('about.featureMessaging')}</h4>
              <p>{t('about.featureMessagingDesc')}</p>
            </div>
          </div>
        </div>

        <div className={styles.footer}>
          <span>Loggex &copy; {new Date().getFullYear()}</span>
        </div>
      </div>
    </Layout>
  );
};

export default About;
