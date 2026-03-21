import React from 'react';
import Sidebar from './Sidebar';
import styles from './Layout.module.css';
import { useAuth } from '../context/AuthContext';
import { useLocation } from 'react-router-dom';

const Layout = ({ children, fullHeight = false }) => {
  const { user } = useAuth();
  const location = useLocation();

  return (
    <div className={styles.container}>
        <div className={styles.mainBody}>
            {/* Solo mostrar Sidebar si el usuario está autenticado */}
            {user && <Sidebar />}

            <main
                key={location.pathname}
                className={`${fullHeight ? styles.contentFullHeight : styles.content} ${styles.pageTransition}`}
            >
                {children}
            </main>
        </div>
    </div>
  );
};

export default Layout;
