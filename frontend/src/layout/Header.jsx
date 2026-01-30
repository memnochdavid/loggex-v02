import React from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import viteLogo from '/logo_texto_horizontal.png';
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
        </Link>
      </div>
      <nav style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
        <Link to="/" className={styles.navLink}>Home</Link>
        {user && (
            <Link to="/centros" className={styles.navLink}>Centros</Link>
        )}
        <Link to="/about" className={styles.navLink}>About</Link>

        {/* Enlace a la documentación de la API */}
        {/* Ahora verificamos explícitamente el rol de SUPERADMIN */}

        {user && user.roles && user.roles.includes('ROLE_SUPERADMIN') && (
          <a
            href="https://localhost:9443/api"
            target="_blank"
            rel="noopener noreferrer"
            className={styles.navLink}
            title="Documentación API Platform"
          >
            API Docs
          </a>
        )}
        
        {user ? (
          <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginLeft: '1rem' }}>
            <span style={{ fontSize: '0.875rem' }}>Hola, <strong>{user.nombre}</strong></span>
            <Button variant="primary" onClick={handleLogout}>
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
