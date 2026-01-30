import React from 'react';
import styles from './Sidebar.module.css';
import {useAuth} from '../context/AuthContext';

const Sidebar = () => {
    const {logout, user, loading} = useAuth();

    return (
        <aside className={styles.sidebar}>
            <div className={styles.roles}>{user?.roles.map(role => role
                .replace("ROLE_", "")).join(', ')}</div>

            <nav className={styles.nav}>
                {/* Aquí podrías usar <Link> de react-router-dom si lo tienes configurado */}
                <a href="/" className={styles.navItem}>Inicio</a>
                <a href="/perfil" className={styles.navItem}>Perfil</a>
                <a href="/configuracion" className={styles.navItem}>Configuración</a>
            </nav>

            <div className={styles.footer}>
                <div className={styles.navItem} onClick={logout}>
                    Cerrar Sesión
                </div>
                {user && <small style={{
                    display: 'block',
                    marginTop: '10px',
                    textAlign: 'center',
                    color: '#95a5a6'
                }}>{user.email}</small>}
            </div>
        </aside>
    );
};

export default Sidebar;