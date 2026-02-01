import React, { useState } from 'react';
import { NavLink } from 'react-router-dom';
import styles from './Sidebar.module.css';
import { useAuth } from '../context/AuthContext';
import { Home, User, Settings, LogOut, Menu, ChevronLeft, ChevronRight, Building, Users, BookOpen, Layers, GraduationCap, UsersRound } from 'lucide-react';

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
    const isAdmin = user?.roles?.includes('ROLE_ADMIN');

    // Helper para clases de NavLink
    const getNavLinkClass = ({ isActive }) => 
        isActive ? `${styles.navItem} ${styles.active}` : styles.navItem;

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
                            {/*{user && <small className={styles.email}>{user.email}</small>}*/}
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
                    <NavLink to="/" className={getNavLinkClass} title="Inicio" end>
                        <Home size={20} />
                        {!isCollapsed && <span>Inicio</span>}
                    </NavLink>
                    
                    {/* Centros solo para SuperAdmin */}
                    {isSuperAdmin && (
                        <NavLink to="/centros" className={getNavLinkClass} title="Centros">
                            <Building size={20} />
                            {!isCollapsed && <span>Centros</span>}
                        </NavLink>
                    )}

                    {/* Gestión Académica para Admin y SuperAdmin */}
                    {(isSuperAdmin || isAdmin) && (
                        <>
                            <NavLink to="/usuarios" className={getNavLinkClass} title="Usuarios">
                                <Users size={20} />
                                {!isCollapsed && <span>Usuarios</span>}
                            </NavLink>
                            <NavLink to="/ciclos" className={getNavLinkClass} title="Ciclos Formativos">
                                <Layers size={20} />
                                {!isCollapsed && <span>Ciclos</span>}
                            </NavLink>
                            <NavLink to="/grupos" className={getNavLinkClass} title="Grupos">
                                <UsersRound size={20} />
                                {!isCollapsed && <span>Grupos</span>}
                            </NavLink>
                            <NavLink to="/modulos" className={getNavLinkClass} title="Módulos">
                                <BookOpen size={20} />
                                {!isCollapsed && <span>Módulos</span>}
                            </NavLink>
                            <NavLink to="/matriculas" className={getNavLinkClass} title="Matrículas">
                                <GraduationCap size={20} />
                                {!isCollapsed && <span>Matrículas</span>}
                            </NavLink>
                        </>
                    )}

                    <NavLink to="/perfil" className={getNavLinkClass} title="Perfil">
                        <User size={20} />
                        {!isCollapsed && <span>Perfil</span>}
                    </NavLink>
                    <NavLink to="/configuracion" className={getNavLinkClass} title="Configuración">
                        <Settings size={20} />
                        {!isCollapsed && <span>Configuración</span>}
                    </NavLink>
                </nav>

                <div className={styles.footer}>
                    <div className={styles.navItem} onClick={logout} title="Cerrar Sesión" style={{ cursor: 'pointer' }}>
                        <LogOut size={20} />
                        {!isCollapsed && <span>Cerrar Sesión</span>}
                    </div>
                </div>
            </aside>
        </>
    );
};

export default Sidebar;
