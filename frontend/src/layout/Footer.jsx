import React from 'react';
import styles from './Footer.module.css';

const Footer = () => {
  return (
    <footer className={styles.footer}>
      <p>&copy; {new Date().getFullYear()} Loggex-Machina v0.2 - Propiedad de David Duque Díaz.</p>
    </footer>
  );
};

export default Footer;
