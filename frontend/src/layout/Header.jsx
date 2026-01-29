import React from 'react';
import { Link } from 'react-router-dom';
import viteLogo from '/vite.svg';
import styles from './Header.module.css';

const Header = () => {
  return (
    <header className={styles.header}>
      <div className={styles.logoContainer}>
        <img src={viteLogo} alt="Logo" className={styles.logo} />
        <span className={styles.title}>Loggex v02</span>
      </div>
      <nav style={{ display: 'flex', gap: '1rem' }}>
        <Link to="/" className={styles.navLink}>Home</Link>
        <Link to="/about" className={styles.navLink}>About</Link>
      </nav>
    </header>
  );
};

export default Header;
