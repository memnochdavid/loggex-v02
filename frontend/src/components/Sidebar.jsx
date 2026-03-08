import React, { useState, useEffect } from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import styles from './Sidebar.module.css';
import { useAuth } from '../context/AuthContext';
import { useUI } from '../context/UIContext';
import { Home, User, Settings, LogOut, ChevronLeft, ChevronRight, Building, Users, BookOpen, Layers, GraduationCap, UsersRound, Calendar, Briefcase, CalendarDays, FileText, Book, ClipboardList, UploadCloud, AlertCircle, MessageSquare, UserCheck } from 'lucide-react';
import AccordionView from './AccordionView';

const Sidebar = () => {
    const { logout, user } = useAuth();
    const { isSidebarOpen, closeSidebar } = useUI();
    const [isCollapsed, setIsCollapsed] = useState(false);
    const location = useLocation();

    const isSuperAdmin = user?.roles?.includes('ROLE_SUPERADMIN');
    const isAdmin = user?.roles?.includes('ROLE_ADMIN');
    const isProfesor = user?.roles?.includes('ROLE_PROFESOR');
    const isAlumno = user?.roles?.includes('ROLE_ALUMNO');

    // Mapa de rutas a IDs de acordeón
    const routeToAccordionMap = {
        // Rutas más específicas primero
        '/horarios': 'general',
        '/mensajes': 'general',
        '/perfil': 'general',
        
        '/tareas': (isAlumno || isSuperAdmin) ? 'alumno' : 'profesor', // Priorizar alumno si es ambos o superadmin para ver ambas
        '/entregas': (isAlumno || isSuperAdmin) ? 'alumno' : 'profesor',
        '/mis-temarios': 'profesor',
        '/claustro': 'profesor',
        '/mis-alumnos': 'profesor',
        
        '/apuntes': 'alumno',
        '/faltas': 'alumno',
        '/companeros': 'alumno',
        '/mis-profesores': 'alumno',
        
        '/usuarios': 'administracion',
        '/ciclos': 'administracion',
        '/grupos': 'administracion',
        '/modulos': 'administracion',
        '/matriculas': 'administracion',
        '/imparticiones': 'administracion',
        '/festivos': isSuperAdmin ? 'superadmin' : 'administracion',
        '/configuracion': 'administracion',
        
        '/centros': 'superadmin',

        // Ruta raíz al final
        '/': 'general',
    };

    // Inicialización perezosa del estado
    const [expandedAccordion, setExpandedAccordion] = useState(() => {
        const currentPath = location.pathname;
        // Buscar la coincidencia más larga para priorizar rutas específicas
        const bestMatch = Object.keys(routeToAccordionMap)
            .filter(path => currentPath.startsWith(path))
            .sort((a, b) => b.length - a.length)[0]; // Ordenar por longitud descendente

        return bestMatch ? routeToAccordionMap[bestMatch] : null;
    });

    // Efecto para actualizar el acordeón si la ruta cambia (navegación)
    useEffect(() => {
        const currentPath = location.pathname;
        const bestMatch = Object.keys(routeToAccordionMap)
            .filter(path => currentPath.startsWith(path))
            .sort((a, b) => b.length - a.length)[0];
        
        if (bestMatch) {
            const targetId = routeToAccordionMap[bestMatch];
            setExpandedAccordion(targetId);
        }
    }, [location.pathname, isAlumno, isSuperAdmin]);

    const toggleSidebar = () => {
        setIsCollapsed(!isCollapsed);
    };

    const getNavLinkClass = ({ isActive }) => 
        isActive ? `${styles.navItem} ${styles.active}` : styles.navItem;

    const handleAccordionToggle = (id) => {
        setExpandedAccordion(expandedAccordion === id ? null : id);
    };

    // Definición de las secciones del acordeón
    const accordionData = [];

    // 1. General (Para todos)
    accordionData.push({
        id: 'general',
        title: 'General',
        content: (
            <>
                <NavLink to="/" className={getNavLinkClass} title="Inicio" onClick={closeSidebar}>
                    <Home size={20} />
                    {!isCollapsed && <span>Inicio</span>}
                </NavLink>
                <NavLink to="/horarios" className={getNavLinkClass} title="Horarios" onClick={closeSidebar}>
                    <Calendar size={20} />
                    {!isCollapsed && <span>Horarios</span>}
                </NavLink>
                <NavLink to="/mensajes" className={getNavLinkClass} title="Mensajería" onClick={closeSidebar}>
                    <MessageSquare size={20} />
                    {!isCollapsed && <span>Mensajería</span>}
                </NavLink>
                <NavLink to="/perfil" className={getNavLinkClass} title="Perfil" onClick={closeSidebar}>
                    <User size={20} />
                    {!isCollapsed && <span>Perfil</span>}
                </NavLink>
            </>
        )
    });

    // 2. Profesor
    if (isProfesor || isSuperAdmin || isAdmin) {
        accordionData.push({
            id: 'profesor',
            title: 'Profesor',
            content: (
                <>
                    <NavLink to="/tareas" className={getNavLinkClass} title="Tareas" onClick={closeSidebar}>
                        <ClipboardList size={20} />
                        {!isCollapsed && <span>Tareas</span>}
                    </NavLink>
                    <NavLink to="/entregas" className={getNavLinkClass} title="Entregas" onClick={closeSidebar}>
                        <UploadCloud size={20} />
                        {!isCollapsed && <span>Entregas</span>}
                    </NavLink>
                    <NavLink to="/mis-temarios" className={getNavLinkClass} title="Mis Temarios" onClick={closeSidebar}>
                        <Book size={20} />
                        {!isCollapsed && <span>Mis Temarios</span>}
                    </NavLink>
                    <NavLink to="/claustro" className={getNavLinkClass} title="Claustro" onClick={closeSidebar}>
                        <UserCheck size={20} />
                        {!isCollapsed && <span>Claustro</span>}
                    </NavLink>
                    <NavLink to="/mis-alumnos" className={getNavLinkClass} title="Mis Alumnos" onClick={closeSidebar}>
                        <UsersRound size={20} />
                        {!isCollapsed && <span>Mis Alumnos</span>}
                    </NavLink>
                </>
            )
        });
    }

    // 3. Alumno
    if (isAlumno || isSuperAdmin) { // AÑADIDO isSuperAdmin
        accordionData.push({
            id: 'alumno',
            title: 'Alumno',
            content: (
                <>
                    <NavLink to="/apuntes" className={getNavLinkClass} title="Mis Apuntes" onClick={closeSidebar}>
                        <FileText size={20} />
                        {!isCollapsed && <span>Mis Apuntes</span>}
                    </NavLink>
                    <NavLink to="/faltas" className={getNavLinkClass} title="Mis Faltas" onClick={closeSidebar}>
                        <AlertCircle size={20} />
                        {!isCollapsed && <span>Mis Faltas</span>}
                    </NavLink>
                    <NavLink to="/companeros" className={getNavLinkClass} title="Mis Compañeros" onClick={closeSidebar}>
                        <UsersRound size={20} />
                        {!isCollapsed && <span>Mis Compañeros</span>}
                    </NavLink>
                    <NavLink to="/mis-profesores" className={getNavLinkClass} title="Mis Profesores" onClick={closeSidebar}>
                        <UserCheck size={20} />
                        {!isCollapsed && <span>Mis Profesores</span>}
                    </NavLink>
                    {/* Tareas y Entregas también para alumnos (duplicado intencional o condicional) */}
                    {/* Si es Superadmin, ya las ve en Profesor, pero si quiere ver la vista de alumno... */}
                    {/* Dejamos que el Superadmin acceda a Tareas/Entregas desde Profesor, que es más completo */}
                    {isAlumno && (
                        <>
                            <NavLink to="/tareas" className={getNavLinkClass} title="Tareas" onClick={closeSidebar}>
                                <ClipboardList size={20} />
                                {!isCollapsed && <span>Tareas</span>}
                            </NavLink>
                            <NavLink to="/entregas" className={getNavLinkClass} title="Entregas" onClick={closeSidebar}>
                                <UploadCloud size={20} />
                                {!isCollapsed && <span>Entregas</span>}
                            </NavLink>
                        </>
                    )}
                </>
            )
        });
    }

    // 4. Administración
    if (isSuperAdmin || isAdmin) {
        accordionData.push({
            id: 'administracion',
            title: 'Administración',
            content: (
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
                    {!isSuperAdmin && ( // Superadmin ya tiene festivos globales arriba
                        <NavLink to="/festivos" className={getNavLinkClass} title="Festivos" onClick={closeSidebar}>
                            <CalendarDays size={20} />
                            {!isCollapsed && <span>Festivos</span>}
                        </NavLink>
                    )}
                    <NavLink to="/configuracion" className={getNavLinkClass} title="Configuración" onClick={closeSidebar}>
                        <Settings size={20} />
                        {!isCollapsed && <span>Configuración</span>}
                    </NavLink>
                </>
            )
        });
    }

    // 5. Superadmin
    if (isSuperAdmin) {
        accordionData.push({
            id: 'superadmin',
            title: 'Superadmin',
            content: (
                <>
                    <NavLink to="/centros" className={getNavLinkClass} title="Centros" onClick={closeSidebar}>
                        <Building size={20} />
                        {!isCollapsed && <span>Centros</span>}
                    </NavLink>
                    <NavLink to="/festivos" className={getNavLinkClass} title="Festivos Globales" onClick={closeSidebar}>
                        <CalendarDays size={20} />
                        {!isCollapsed && <span>Festivos Globales</span>}
                    </NavLink>
                </>
            )
        });
    }



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
                </div>

                <nav className={styles.nav}>


                    {/* Usamos AccordionView para las secciones */}
                    <div className={styles.accordionWrapper}>
                        <AccordionView 
                            data={accordionData}
                            renderItem={(item) => item.content}
                            renderHeader={(item) => !isCollapsed ? <span>{item.title}</span> : null}
                            expandedId={expandedAccordion}
                            onToggle={handleAccordionToggle}
                        />
                    </div>
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
