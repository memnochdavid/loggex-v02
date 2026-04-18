import React from 'react';
import styles from './Footer.module.css';
import { useTranslation } from 'react-i18next';

const Footer = () => {
  const { t } = useTranslation();
  const year = new Date().getFullYear();

  return (
    <footer className={styles.footer}>
      <div className={styles.developer}>
        <span className={styles.label}>{t('footer.developedBy')}</span>
        <strong className={styles.name}>David Duque Díaz</strong>
        <span className={styles.sep} aria-hidden="true">·</span>
        <span className={styles.role}>{t('footer.role')}</span>
      </div>
      <div className={styles.copyright}>
        {t('footer.copyright', { year })}
      </div>
    </footer>
  );
};

export default Footer;
