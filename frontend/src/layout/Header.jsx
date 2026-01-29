import React from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import viteLogo from '/vite.svg';
import styles from './Header.module.css';
import Button from '../components/Button';

const Header = () => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const handleLogout = async () => {
    await logout();
    navigate('/login');
  };

  return (
    <header className={styles.header}>
      <div className={styles.logoContainer}>
        <Link to="/" style={{ textDecoration: 'none', color: 'inherit', display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <img src={viteLogo} alt="Logo" className={styles.logo} />
            <span className={styles.title}>Loggex v02</span>
        </Link>
      </div>
      <nav style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
        <Link to="/" className={styles.navLink}>Home</Link>
        <Link to="/about" className={styles.navLink}>About</Link>
        
        {user ? (
          <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginLeft: '1rem' }}>
            <span style={{ fontSize: '0.875rem' }}>Hola, <strong>{user.nombre}</strong></span>
            <Button variant="secondary" onClick={handleLogout} style={{ padding: '0.25rem 0.75rem', fontSize: '0.875rem' }}>
              Salir
            </Button>
          </div>
        ) : (
          <Link to="/login" style={{ textDecoration: 'none' }}>
            <Button variant="primary" style={{ padding: '0.25rem 0.75rem', fontSize: '0.875rem' }}>
              Login
            </Button>
          </Link>
        )}
      </nav>
    </header>
  );
};

export default Header;
