import React, { useState } from 'react';
import styles from './Sidebar.module.css';
import { useAuth } from '../context/AuthContext';
import { Home, User, Settings, LogOut, Menu, ChevronLeft, ChevronRight, Building, Users } from 'lucide-react';

const Sidebar = () => {
    const { logout, user } = useAuth();
    const [isCollapsed, setIsCollapsed] = useState(false);
    const [isMobileOpen, setIsMobileOpen] = useState(false);

    const toggleSidebar = () => {
        setIsCollapsed(!isCollapsed);
    };

    const toggleMobileMenu = () => {
        setIsMobileOpen(!isMobileOpen);
    };

    const isSuperAdmin = user?.roles?.includes('ROLE_SUPERADMIN');

    return (
        <>
            {/* Botón hamburguesa para móvil */}
            <button 
                className={styles.mobileToggle} 
                onClick={toggleMobileMenu}
                aria-label="Toggle menu"
            >
                <Menu size={24} />
            </button>

            {/* Overlay para cerrar el menú en móvil al hacer click fuera */}
            {isMobileOpen && (
                <div className={styles.overlay} onClick={() => setIsMobileOpen(false)} />
            )}

            <aside className={`${styles.sidebar} ${isCollapsed ? styles.collapsed : ''} ${isMobileOpen ? styles.mobileOpen : ''}`}>
                <div className={styles.header}>
                    {!isCollapsed && (
                        <div className={styles.userInfo}>
                            {user && <small className={styles.email}>{user.email}</small>}
                            <div className={styles.roles}>
                                {user?.roles
                                    .filter(role => role !== "ROLE_USER")
                                    .map(role => role.replace("ROLE_", ""))
                                    .join(", ")}
                            </div>
                        </div>
                    )}
                    
                    <button 
                        className={styles.collapseBtn} 
                        onClick={toggleSidebar}
                        aria-label={isCollapsed ? "Expand sidebar" : "Collapse sidebar"}
                    >
                        {isCollapsed ? <ChevronRight size={20} /> : <ChevronLeft size={20} />}
                    </button>
                </div>

                <nav className={styles.nav}>
                    <a href="/" className={styles.navItem} title="Inicio">
                        <Home size={20} />
                        {!isCollapsed && <span>Inicio</span>}
                    </a>
                    
                    {isSuperAdmin && (
                        <>
                            <a href="/centros" className={styles.navItem} title="Centros">
                                <Building size={20} />
                                {!isCollapsed && <span>Centros</span>}
                            </a>
                            <a href="/usuarios" className={styles.navItem} title="Usuarios">
                                <Users size={20} />
                                {!isCollapsed && <span>Usuarios</span>}
                            </a>
                        </>
                    )}

                    <a href="/perfil" className={styles.navItem} title="Perfil">
                        <User size={20} />
                        {!isCollapsed && <span>Perfil</span>}
                    </a>
                    <a href="/configuracion" className={styles.navItem} title="Configuración">
                        <Settings size={20} />
                        {!isCollapsed && <span>Configuración</span>}
                    </a>
                </nav>

                <div className={styles.footer}>
                    <div className={styles.navItem} onClick={logout} title="Cerrar Sesión">
                        <LogOut size={20} />
                        {!isCollapsed && <span>Cerrar Sesión</span>}
                    </div>
                </div>
            </aside>
        </>
    );
};

export default Sidebar;
