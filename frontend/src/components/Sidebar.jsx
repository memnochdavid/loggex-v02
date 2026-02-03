import React, { useState } from 'react';
import { NavLink } from 'react-router-dom';
import styles from './Sidebar.module.css';
import { useAuth } from '../context/AuthContext';
import { useUI } from '../context/UIContext'; // Importar contexto UI
import { Home, User, Settings, LogOut, ChevronLeft, ChevronRight, Building, Users, BookOpen, Layers, GraduationCap, UsersRound, Calendar, Briefcase, CalendarDays, FileText, Book, ClipboardList, UploadCloud } from 'lucide-react';

const Sidebar = () => {
    const { logout, user } = useAuth();
    const { isSidebarOpen, closeSidebar } = useUI(); // Usar contexto
    const [isCollapsed, setIsCollapsed] = useState(false);

    const toggleSidebar = () => {
        setIsCollapsed(!isCollapsed);
    };

    const isSuperAdmin = user?.roles?.includes('ROLE_SUPERADMIN');
    const isAdmin = user?.roles?.includes('ROLE_ADMIN');
    const isProfesor = user?.roles?.includes('ROLE_PROFESOR');
    const isAlumno = user?.roles?.includes('ROLE_ALUMNO');

    // Helper para clases de NavLink
    const getNavLinkClass = ({ isActive }) => 
        isActive ? `${styles.navItem} ${styles.active}` : styles.navItem;

    return (
        <>
            {/* Overlay para cerrar el menú en móvil al hacer click fuera */}
            {isSidebarOpen && (
                <div className={styles.overlay} onClick={closeSidebar} />
            )}

            <aside className={`${styles.sidebar} ${isCollapsed ? styles.collapsed : ''} ${isSidebarOpen ? styles.mobileOpen : ''}`}>
                <div className={styles.header}>
                    {!isCollapsed && (
                        <div className={styles.userInfo}>
                            <div className={styles.roles}>
                                {user?.roles
                                    .filter(role => role !== "ROLE_USER")
                                    .map(role => role.replace("ROLE_", ""))
                                    .join(", ")}
                            </div>
                        </div>
                    )}
                    
                    {/*<button */}
                    {/*    className={styles.collapseBtn} */}
                    {/*    onClick={toggleSidebar}*/}
                    {/*    aria-label={isCollapsed ? "Expand sidebar" : "Collapse sidebar"}*/}
                    {/*>*/}
                    {/*    {isCollapsed ? <ChevronRight size={20} /> : <ChevronLeft size={20} />}*/}
                    {/*</button>*/}
                </div>

                <nav className={styles.nav}>
                    <NavLink to="/" className={getNavLinkClass} title="Inicio" end onClick={closeSidebar}>
                        <Home size={20} />
                        {!isCollapsed && <span>Inicio</span>}
                    </NavLink>
                    
                    {/* Centros solo para SuperAdmin */}
                    {isSuperAdmin && (
                        <NavLink to="/centros" className={getNavLinkClass} title="Centros" onClick={closeSidebar}>
                            <Building size={20} />
                            {!isCollapsed && <span>Centros</span>}
                        </NavLink>
                    )}

                    {/* Gestión Académica para Admin y SuperAdmin */}
                    {(isSuperAdmin || isAdmin) && (
                        <>
                            <NavLink to="/usuarios" className={getNavLinkClass} title="Usuarios" onClick={closeSidebar}>
                                <Users size={20} />
                                {!isCollapsed && <span>Usuarios</span>}
                            </NavLink>
                            <NavLink to="/ciclos" className={getNavLinkClass} title="Ciclos Formativos" onClick={closeSidebar}>
                                <Layers size={20} />
                                {!isCollapsed && <span>Ciclos</span>}
                            </NavLink>
                            <NavLink to="/grupos" className={getNavLinkClass} title="Grupos" onClick={closeSidebar}>
                                <UsersRound size={20} />
                                {!isCollapsed && <span>Grupos</span>}
                            </NavLink>
                            <NavLink to="/modulos" className={getNavLinkClass} title="Módulos" onClick={closeSidebar}>
                                <BookOpen size={20} />
                                {!isCollapsed && <span>Módulos</span>}
                            </NavLink>
                            <NavLink to="/matriculas" className={getNavLinkClass} title="Matrículas" onClick={closeSidebar}>
                                <GraduationCap size={20} />
                                {!isCollapsed && <span>Matrículas</span>}
                            </NavLink>
                            <NavLink to="/imparticiones" className={getNavLinkClass} title="Asignación Docencia" onClick={closeSidebar}>
                                <Briefcase size={20} />
                                {!isCollapsed && <span>Docencia</span>}
                            </NavLink>
                            <NavLink to="/festivos" className={getNavLinkClass} title="Festivos" onClick={closeSidebar}>
                                <CalendarDays size={20} />
                                {!isCollapsed && <span>Festivos</span>}
                            </NavLink>
                        </>
                    )}

                    {/* Horarios para todos */}
                    <NavLink to="/horarios" className={getNavLinkClass} title="Horarios" onClick={closeSidebar}>
                        <Calendar size={20} />
                        {!isCollapsed && <span>Horarios</span>}
                    </NavLink>

                    {/* Tareas para todos */}
                    <NavLink to="/tareas" className={getNavLinkClass} title="Tareas" onClick={closeSidebar}>
                        <ClipboardList size={20} />
                        {!isCollapsed && <span>Tareas</span>}
                    </NavLink>

                    {/* Entregas para todos (Alumnos y Profesores) */}
                    {(isAlumno || isProfesor || isAdmin || isSuperAdmin) && (
                        <NavLink to="/entregas" className={getNavLinkClass} title="Entregas" onClick={closeSidebar}>
                            <UploadCloud size={20} />
                            {!isCollapsed && <span>Entregas</span>}
                        </NavLink>
                    )}

                    {/* Materiales Alumno */}
                    {isAlumno && (
                        <NavLink to="/apuntes" className={getNavLinkClass} title="Mis Apuntes" onClick={closeSidebar}>
                            <FileText size={20} />
                            {!isCollapsed && <span>Mis Apuntes</span>}
                        </NavLink>
                    )}

                    {/* Materiales Profesor */}
                    {(isProfesor || isSuperAdmin || isAdmin) && (
                        <NavLink to="/mis-temarios" className={getNavLinkClass} title="Mis Temarios" onClick={closeSidebar}>
                            <Book size={20} />
                            {!isCollapsed && <span>Mis Temarios</span>}
                        </NavLink>
                    )}

                    <NavLink to="/perfil" className={getNavLinkClass} title="Perfil" onClick={closeSidebar}>
                        <User size={20} />
                        {!isCollapsed && <span>Perfil</span>}
                    </NavLink>
                    
                    {/* Configuración solo para Admins */}
                    {(isSuperAdmin || isAdmin) && (
                        <NavLink to="/configuracion" className={getNavLinkClass} title="Configuración" onClick={closeSidebar}>
                            <Settings size={20} />
                            {!isCollapsed && <span>Configuración</span>}
                        </NavLink>
                    )}
                </nav>

                <div className={styles.footer}>
                    <div className={styles.navItem} onClick={() => { logout(); closeSidebar(); }} title="Cerrar Sesión" style={{ cursor: 'pointer' }}>
                        <LogOut size={20} />
                        {!isCollapsed && <span>Cerrar Sesión</span>}
                    </div>
                </div>
            </aside>
        </>
    );
};

export default Sidebar;
