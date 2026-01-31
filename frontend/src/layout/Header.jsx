import React from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import viteLogo from '/logo_texto_horizontal.png';
import styles from './Header.module.css';
import Button from '../components/Button';
import UserAvatar from '../components/UserAvatar';

const Header = () => {
  const { user } = useAuth();

  return (
    <header className={styles.header}>
      <div className={styles.logoContainer}>
        <Link to="/" style={{ textDecoration: 'none', color: 'inherit', display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <img src={viteLogo} alt="Logo" className={styles.logo} />
        </Link>
      </div>
      <nav style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>

        <Link to="/about" className={styles.navLink}>About</Link>

        {/* Enlace a la documentación de la API */}
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
            {/* Reemplazamos el saludo y botón de salir por el UserAvatar */}
            <UserAvatar size={40} />
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
