import React from 'react';
import viteLogo from '/vite.svg';
import styles from './Header.module.css';

const Header = () => {
  return (
    <header className={styles.header}>
      <div className={styles.logoContainer}>
        <img src={viteLogo} alt="Logo" className={styles.logo} />
        <span className={styles.title}>Loggex v02</span>
      </div>
      <nav>
        <a href="#" className={styles.navLink}>Home</a>
      </nav>
    </header>
  );
};

export default Header;
