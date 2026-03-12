import React, { useState, useEffect } from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import styles from './Sidebar.module.css';
import { useAuth } from '../context/AuthContext';
import { useUI } from '../context/UIContext';
import { Home, User, Settings, LogOut, ChevronLeft, ChevronRight, Building, Users, BookOpen, Layers, GraduationCap, UsersRound, Calendar, Briefcase, CalendarDays, FileText, Book, ClipboardList, UploadCloud, AlertCircle, MessageSquare, UserCheck } from 'lucide-react';
import AccordionView from './AccordionView';
import { useTranslation } from 'react-i18next';

const Sidebar = () => {
    const { t } = useTranslation();
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
        title: t('sidebar.general'),
        content: (
            <>
                <NavLink to="/" className={getNavLinkClass} title={t('sidebar.home')} onClick={closeSidebar}>
                    <Home size={20} />
                    {!isCollapsed && <span>{t('sidebar.home')}</span>}
                </NavLink>
                <NavLink to="/horarios" className={getNavLinkClass} title={t('sidebar.schedule')} onClick={closeSidebar}>
                    <Calendar size={20} />
                    {!isCollapsed && <span>{t('sidebar.schedule')}</span>}
                </NavLink>
                <NavLink to="/mensajes" className={getNavLinkClass} title={t('sidebar.messaging')} onClick={closeSidebar}>
                    <MessageSquare size={20} />
                    {!isCollapsed && <span>{t('sidebar.messaging')}</span>}
                </NavLink>
                <NavLink to="/perfil" className={getNavLinkClass} title={t('sidebar.profile')} onClick={closeSidebar}>
                    <User size={20} />
                    {!isCollapsed && <span>{t('sidebar.profile')}</span>}
                </NavLink>
            </>
        )
    });

    // 2. Profesor
    if (isProfesor || isSuperAdmin || isAdmin) {
        accordionData.push({
            id: 'profesor',
            title: t('sidebar.teacher'),
            content: (
                <>
                    <NavLink to="/tareas" className={getNavLinkClass} title={t('sidebar.tasks')} onClick={closeSidebar}>
                        <ClipboardList size={20} />
                        {!isCollapsed && <span>{t('sidebar.tasks')}</span>}
                    </NavLink>
                    <NavLink to="/entregas" className={getNavLinkClass} title={t('sidebar.deliveries')} onClick={closeSidebar}>
                        <UploadCloud size={20} />
                        {!isCollapsed && <span>{t('sidebar.deliveries')}</span>}
                    </NavLink>
                    <NavLink to="/mis-temarios" className={getNavLinkClass} title={t('sidebar.myMaterials')} onClick={closeSidebar}>
                        <Book size={20} />
                        {!isCollapsed && <span>{t('sidebar.myMaterials')}</span>}
                    </NavLink>
                    <NavLink to="/claustro" className={getNavLinkClass} title={t('sidebar.faculty')} onClick={closeSidebar}>
                        <UserCheck size={20} />
                        {!isCollapsed && <span>{t('sidebar.faculty')}</span>}
                    </NavLink>
                    <NavLink to="/mis-alumnos" className={getNavLinkClass} title={t('sidebar.myStudents')} onClick={closeSidebar}>
                        <UsersRound size={20} />
                        {!isCollapsed && <span>{t('sidebar.myStudents')}</span>}
                    </NavLink>
                </>
            )
        });
    }

    // 3. Alumno
    if (isAlumno || isSuperAdmin) { // AÑADIDO isSuperAdmin
        accordionData.push({
            id: 'alumno',
            title: t('sidebar.student'),
            content: (
                <>
                    <NavLink to="/apuntes" className={getNavLinkClass} title={t('sidebar.myNotes')} onClick={closeSidebar}>
                        <FileText size={20} />
                        {!isCollapsed && <span>{t('sidebar.myNotes')}</span>}
                    </NavLink>
                    <NavLink to="/faltas" className={getNavLinkClass} title={t('sidebar.myAbsences')} onClick={closeSidebar}>
                        <AlertCircle size={20} />
                        {!isCollapsed && <span>{t('sidebar.myAbsences')}</span>}
                    </NavLink>
                    <NavLink to="/companeros" className={getNavLinkClass} title={t('sidebar.myClassmates')} onClick={closeSidebar}>
                        <UsersRound size={20} />
                        {!isCollapsed && <span>{t('sidebar.myClassmates')}</span>}
                    </NavLink>
                    <NavLink to="/mis-profesores" className={getNavLinkClass} title={t('sidebar.myTeachers')} onClick={closeSidebar}>
                        <UserCheck size={20} />
                        {!isCollapsed && <span>{t('sidebar.myTeachers')}</span>}
                    </NavLink>
                    {/* Tareas y Entregas también para alumnos (duplicado intencional o condicional) */}
                    {/* Si es Superadmin, ya las ve en Profesor, pero si quiere ver la vista de alumno... */}
                    {/* Dejamos que el Superadmin acceda a Tareas/Entregas desde Profesor, que es más completo */}
                    {isAlumno && (
                        <>
                            <NavLink to="/tareas" className={getNavLinkClass} title={t('sidebar.tasks')} onClick={closeSidebar}>
                                <ClipboardList size={20} />
                                {!isCollapsed && <span>{t('sidebar.tasks')}</span>}
                            </NavLink>
                            <NavLink to="/entregas" className={getNavLinkClass} title={t('sidebar.deliveries')} onClick={closeSidebar}>
                                <UploadCloud size={20} />
                                {!isCollapsed && <span>{t('sidebar.deliveries')}</span>}
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
            title: t('sidebar.admin'),
            content: (
                <>
                    <NavLink to="/usuarios" className={getNavLinkClass} title={t('sidebar.users')} onClick={closeSidebar}>
                        <Users size={20} />
                        {!isCollapsed && <span>{t('sidebar.users')}</span>}
                    </NavLink>
                    <NavLink to="/ciclos" className={getNavLinkClass} title={t('sidebar.cycles')} onClick={closeSidebar}>
                        <Layers size={20} />
                        {!isCollapsed && <span>{t('sidebar.cycles')}</span>}
                    </NavLink>
                    <NavLink to="/grupos" className={getNavLinkClass} title={t('sidebar.groups')} onClick={closeSidebar}>
                        <UsersRound size={20} />
                        {!isCollapsed && <span>{t('sidebar.groups')}</span>}
                    </NavLink>
                    <NavLink to="/modulos" className={getNavLinkClass} title={t('sidebar.modules')} onClick={closeSidebar}>
                        <BookOpen size={20} />
                        {!isCollapsed && <span>{t('sidebar.modules')}</span>}
                    </NavLink>
                    <NavLink to="/matriculas" className={getNavLinkClass} title={t('sidebar.enrollments')} onClick={closeSidebar}>
                        <GraduationCap size={20} />
                        {!isCollapsed && <span>{t('sidebar.enrollments')}</span>}
                    </NavLink>
                    <NavLink to="/imparticiones" className={getNavLinkClass} title={t('sidebar.teachingAssignment')} onClick={closeSidebar}>
                        <Briefcase size={20} />
                        {!isCollapsed && <span>{t('sidebar.teaching')}</span>}
                    </NavLink>
                    {!isSuperAdmin && ( // Superadmin ya tiene festivos globales arriba
                        <NavLink to="/festivos" className={getNavLinkClass} title={t('sidebar.holidays')} onClick={closeSidebar}>
                            <CalendarDays size={20} />
                            {!isCollapsed && <span>{t('sidebar.holidays')}</span>}
                        </NavLink>
                    )}
                    <NavLink to="/configuracion" className={getNavLinkClass} title={t('sidebar.settings')} onClick={closeSidebar}>
                        <Settings size={20} />
                        {!isCollapsed && <span>{t('sidebar.settings')}</span>}
                    </NavLink>
                </>
            )
        });
    }

    // 5. Superadmin
    if (isSuperAdmin) {
        accordionData.push({
            id: 'superadmin',
            title: t('sidebar.superadmin'),
            content: (
                <>
                    <NavLink to="/centros" className={getNavLinkClass} title={t('sidebar.centers')} onClick={closeSidebar}>
                        <Building size={20} />
                        {!isCollapsed && <span>{t('sidebar.centers')}</span>}
                    </NavLink>
                    <NavLink to="/festivos" className={getNavLinkClass} title={t('sidebar.globalHolidays')} onClick={closeSidebar}>
                        <CalendarDays size={20} />
                        {!isCollapsed && <span>{t('sidebar.globalHolidays')}</span>}
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
                    <div className={styles.navItem} onClick={() => { logout(); closeSidebar(); }} title={t('sidebar.logout')} style={{ cursor: 'pointer' }}>
                        <LogOut size={20} />
                        {!isCollapsed && <span>{t('sidebar.logout')}</span>}
                    </div>
                </div>
            </aside>
        </>
    );
};

export default Sidebar;
