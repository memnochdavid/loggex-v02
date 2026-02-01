import React from 'react';
import Sidebar from './Sidebar';
import styles from './Layout.module.css';
import { useAuth } from '../context/AuthContext';

const Layout = ({ children }) => {
  const { user } = useAuth();

  return (
    <div className={styles.container}>
        <div className={styles.mainBody}>
            {/* Solo mostrar Sidebar si el usuario está autenticado */}
            {user && <Sidebar />}
            
            <main className={styles.content} style={!user ? { width: '100%', maxWidth: '1000px', margin: '0 auto' } : {}}>
                {children}
            </main>
        </div>
    </div>
  );
};

export default Layout;
