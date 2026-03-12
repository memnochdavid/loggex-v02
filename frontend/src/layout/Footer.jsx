import React from 'react';
import styles from './Footer.module.css';
import { useTranslation } from 'react-i18next';

const Footer = () => {
  const { t } = useTranslation();
  return (
    <footer className={styles.footer}>
      <p>{t('footer.copyright', { year: new Date().getFullYear() })}</p>
    </footer>
  );
};

export default Footer;
