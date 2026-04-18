import React, { useState, useEffect, useMemo, useRef } from 'react';
import { createPortal } from 'react-dom';
import { NavLink, useLocation } from 'react-router-dom';
import styles from './Sidebar.module.css';
import { useAuth } from '../context/AuthContext';
import { useUI } from '../context/UIContext';
import { useTour } from '../context/TourContext';
import { getLastPointer } from '../utils/pointerTracker';
import { Home, User, Settings, LogOut, Pin, PinOff, Building, Users, BookOpen, Layers, GraduationCap, UsersRound, Calendar, Briefcase, CalendarDays, FileText, Book, UploadCloud, AlertCircle, MessageSquare, UserCheck, BarChart3 } from 'lucide-react';
import AccordionView from './AccordionView';
import ConfirmLogoutModal from './ConfirmLogoutModal';
import { useTranslation } from 'react-i18next';
import useUnreadMessages from '../hooks/useUnreadMessages';

// Ancho del sidebar expandido — usado para estimar hover en el primer paint
// tras un remount, cuando aún no existe ref al nuevo aside.
const SIDEBAR_EXPANDED_WIDTH = 260;
const HEADER_HEIGHT_ESTIMATE = 84;

// Decide si el cursor está sobre la "zona del sidebar expandido" según la
// última posición conocida del puntero. Usado para inicializar isHovered
// en el primer render tras remount (sin esperar a un mouseenter).
const estimateSidebarHover = () => {
    const { x, y } = getLastPointer();
    if (x < 0) return false;
    return x >= 0 && x <= SIDEBAR_EXPANDED_WIDTH && y >= HEADER_HEIGHT_ESTIMATE;
};

const Sidebar = () => {
    const { t } = useTranslation();
    const { logout, user } = useAuth();
    const { isSidebarOpen, closeSidebar } = useUI();
    const { currentTour, currentStepIndex } = useTour();
    const [isPinned, setIsPinned] = useState(() => {
        try { return JSON.parse(localStorage.getItem('sidebarPinned')) ?? false; }
        catch { return false; }
    });
    // Initial state consulta directamente la zona física donde el sidebar
    // expandido habría estado. Así, tras un remount con el cursor encima,
    // el primer paint ya sale expandido (sin bounce).
    const [isHovered, setIsHovered] = useState(estimateSidebarHover);
    const [logoutConfirmOpen, setLogoutConfirmOpen] = useState(false);
    const asideRef = useRef(null);
    /* Si hay un tour activo, forzamos sidebar expandido para que Joyride
       pueda localizar y medir los items diana (que quedarían colapsados
       a 72px con labels ocultos si no). */
    const isExpanded = isPinned || isHovered || isSidebarOpen || !!currentTour;
    const isCollapsed = !isExpanded;
    const unreadMessages = useUnreadMessages();
    const location = useLocation();

    useEffect(() => {
        localStorage.setItem('sidebarPinned', JSON.stringify(isPinned));
    }, [isPinned]);

    const isSuperAdmin = user?.roles?.includes('ROLE_SUPERADMIN');
    const isAdmin = user?.roles?.includes('ROLE_ADMIN');
    const isProfesor = user?.roles?.includes('ROLE_PROFESOR');
    const isAlumno = user?.roles?.includes('ROLE_ALUMNO');

    // Mapa de rutas a IDs de acordeón
    const routeToAccordionMap = {
        // Rutas más específicas primero
        '/horarios': 'general',
        '/admin/horarios': 'administracion',
        '/mensajes': 'general',
        '/perfil': 'general',
        
        '/entregas': (isAlumno && !isProfesor && !isAdmin && !isSuperAdmin) ? 'alumno' : 'profesor',
        '/calificaciones': 'profesor',
        '/mis-temarios': 'profesor',
        '/claustro': 'profesor',
        '/mis-alumnos': 'profesor',
        
        '/apuntes': 'alumno',
        '/mis-calificaciones': 'alumno',
        '/faltas': 'alumno',
        '/companeros': 'alumno',
        '/mis-profesores': 'alumno',
        
        '/usuarios': 'administracion',
        '/ciclos': 'administracion',
        '/grupos': 'administracion',
        '/modulos': 'administracion',
        '/matriculas': 'administracion',
        '/imparticiones': 'administracion',
        '/fechas': isSuperAdmin ? 'superadmin' : 'administracion',
        '/admin/calificaciones': 'administracion',
        '/configuracion': 'administracion',
        
        '/centros': 'superadmin',

        // Ruta raíz al final
        '/': 'general',
    };

    /* Resolución del acordeón expandido — PRIORIDAD:
       1) Tour activo con accordionSection → manda siempre (inmutable durante el tour).
       2) Elección manual del usuario (click en un header).
       3) Ruta actual (al navegar, se sugiere un acordeón coherente).
       En cuanto el tour termina, vuelve a mandar (2) o (3). */

    const routeAccordion = useMemo(() => {
        const bestMatch = Object.keys(routeToAccordionMap)
            .filter(path => location.pathname.startsWith(path))
            .sort((a, b) => b.length - a.length)[0];
        return bestMatch ? routeToAccordionMap[bestMatch] : null;
    }, [location.pathname, isAlumno, isSuperAdmin]);

    /* Elección manual del usuario. Se inicializa con la sección sugerida
       por la ruta actual para que al entrar ya haya algo abierto. */
    const [manualAccordion, setManualAccordion] = useState(routeAccordion);

    /* Al navegar, actualizamos la elección manual al acordeón de la nueva
       ruta (pero solo si NO hay un tour activo — no queremos que una
       navegación accidental cambie el acordeón mientras se muestra un tour). */
    useEffect(() => {
        if (!currentTour) {
            setManualAccordion(routeAccordion);
        }
    }, [routeAccordion, currentTour]);

    /* Al iniciar el tour o cambiar de step, abrimos automáticamente el
       acordeón que ese step necesita. El usuario puede cerrarlo después
       si quiere (single-select normal, sin bloqueos). Si cierra el del
       step actual, pierde el target del tour — es decisión suya. */
    useEffect(() => {
        if (!currentTour) return;
        const step = currentTour.steps?.[currentStepIndex];
        const stepAccordion = step?.accordionSection || currentTour.accordionSection;
        if (stepAccordion) {
            setManualAccordion(stepAccordion);
        }
    }, [currentTour, currentStepIndex]);

    const expandedAccordion = manualAccordion;

    /* Debug — queremos ver este log SIEMPRE que se renderice el Sidebar
       mientras arreglamos el fallo de los tours. */
    console.log('[SIDEBAR]', {
        currentTour: currentTour?.id ?? null,
        currentStepIndex,
        manualAccordion,
        expandedAccordion,
    });

    const togglePin = () => {
        setIsPinned(prev => !prev);
    };

    const getNavLinkClass = ({ isActive }) =>
        isActive ? `${styles.navItem} ${styles.active}` : styles.navItem;

    const handleAccordionToggle = (id) => {
        setManualAccordion(prev => prev === id ? null : id);
    };

    // Definición de las secciones del acordeón
    const accordionData = [];

    // 1. General (Para todos)
    accordionData.push({
        id: 'general',
        title: t('sidebar.general'),
        content: (
            <>
                <NavLink to="/" className={getNavLinkClass} title={t('sidebar.home')} onClick={closeSidebar} data-tour="sidebar-home">
                    <Home size={20} />
                    <span>{t('sidebar.home')}</span>
                </NavLink>
                <NavLink to="/horarios" className={getNavLinkClass} title={t('sidebar.schedule')} onClick={closeSidebar} data-tour="sidebar-horarios">
                    <Calendar size={20} />
                    <span>{t('sidebar.schedule')}</span>
                </NavLink>
                <NavLink to="/mensajes" className={getNavLinkClass} title={t('sidebar.messaging')} onClick={closeSidebar} data-tour="sidebar-mensajes">
                    <MessageSquare size={20} />
                    <span>{t('sidebar.messaging')}</span>
                    {unreadMessages > 0 && (
                        <span className={styles.badge} aria-label={`${unreadMessages} no leídos`}>
                            {unreadMessages > 99 ? '99+' : unreadMessages}
                        </span>
                    )}
                </NavLink>
                <NavLink to="/perfil" className={getNavLinkClass} title={t('sidebar.profile')} onClick={closeSidebar} data-tour="sidebar-perfil">
                    <User size={20} />
                    <span>{t('sidebar.profile')}</span>
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
                    <NavLink to="/entregas" className={getNavLinkClass} title={t('sidebar.deliveries')} onClick={closeSidebar} data-tour="sidebar-entregas">
                        <UploadCloud size={20} />
                        <span>{t('sidebar.deliveries')}</span>
                    </NavLink>
                    <NavLink to="/calificaciones" className={getNavLinkClass} title={t('sidebar.grades')} onClick={closeSidebar} data-tour="sidebar-calificaciones">
                        <BarChart3 size={20} />
                        <span>{t('sidebar.grades')}</span>
                    </NavLink>
                    <NavLink to="/mis-temarios" className={getNavLinkClass} title={t('sidebar.myMaterials')} onClick={closeSidebar} data-tour="sidebar-mis-temarios">
                        <Book size={20} />
                        <span>{t('sidebar.myMaterials')}</span>
                    </NavLink>
                    <NavLink to="/claustro" className={getNavLinkClass} title={t('sidebar.faculty')} onClick={closeSidebar} data-tour="sidebar-claustro">
                        <UserCheck size={20} />
                        <span>{t('sidebar.faculty')}</span>
                    </NavLink>
                    <NavLink to="/mis-alumnos" className={getNavLinkClass} title={t('sidebar.myStudents')} onClick={closeSidebar} data-tour="sidebar-mis-alumnos">
                        <UsersRound size={20} />
                        <span>{t('sidebar.myStudents')}</span>
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
                    <NavLink to="/apuntes" className={getNavLinkClass} title={t('sidebar.myNotes')} onClick={closeSidebar} data-tour="sidebar-apuntes">
                        <FileText size={20} />
                        <span>{t('sidebar.myNotes')}</span>
                    </NavLink>
                    <NavLink to="/faltas" className={getNavLinkClass} title={t('sidebar.myAbsences')} onClick={closeSidebar} data-tour="sidebar-faltas">
                        <AlertCircle size={20} />
                        <span>{t('sidebar.myAbsences')}</span>
                    </NavLink>
                    <NavLink to="/mis-calificaciones" className={getNavLinkClass} title={t('sidebar.myGrades')} onClick={closeSidebar} data-tour="sidebar-mis-calificaciones">
                        <BarChart3 size={20} />
                        <span>{t('sidebar.myGrades')}</span>
                    </NavLink>
                    <NavLink to="/companeros" className={getNavLinkClass} title={t('sidebar.myClassmates')} onClick={closeSidebar}>
                        <UsersRound size={20} />
                        <span>{t('sidebar.myClassmates')}</span>
                    </NavLink>
                    <NavLink to="/mis-profesores" className={getNavLinkClass} title={t('sidebar.myTeachers')} onClick={closeSidebar}>
                        <UserCheck size={20} />
                        <span>{t('sidebar.myTeachers')}</span>
                    </NavLink>
                    {/* Entregas solo si NO tiene sección Profesor (evitar duplicados) */}
                    {!isProfesor && !isAdmin && !isSuperAdmin && (
                        <NavLink to="/entregas" className={getNavLinkClass} title={t('sidebar.deliveries')} onClick={closeSidebar} data-tour="sidebar-entregas">
                            <UploadCloud size={20} />
                            <span>{t('sidebar.deliveries')}</span>
                        </NavLink>
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
                    <NavLink to="/usuarios" className={getNavLinkClass} title={t('sidebar.users')} onClick={closeSidebar} data-tour="sidebar-usuarios">
                        <Users size={20} />
                        <span>{t('sidebar.users')}</span>
                    </NavLink>
                    <NavLink to="/ciclos" className={getNavLinkClass} title={t('sidebar.cycles')} onClick={closeSidebar} data-tour="sidebar-ciclos">
                        <Layers size={20} />
                        <span>{t('sidebar.cycles')}</span>
                    </NavLink>
                    <NavLink to="/grupos" className={getNavLinkClass} title={t('sidebar.groups')} onClick={closeSidebar} data-tour="sidebar-grupos">
                        <UsersRound size={20} />
                        <span>{t('sidebar.groups')}</span>
                    </NavLink>
                    <NavLink to="/modulos" className={getNavLinkClass} title={t('sidebar.modules')} onClick={closeSidebar} data-tour="sidebar-modulos">
                        <BookOpen size={20} />
                        <span>{t('sidebar.modules')}</span>
                    </NavLink>
                    <NavLink to="/matriculas" className={getNavLinkClass} title={t('sidebar.enrollments')} onClick={closeSidebar} data-tour="sidebar-matriculas">
                        <GraduationCap size={20} />
                        <span>{t('sidebar.enrollments')}</span>
                    </NavLink>
                    <NavLink to="/imparticiones" className={getNavLinkClass} title={t('sidebar.teachingAssignment')} onClick={closeSidebar} data-tour="sidebar-imparticiones">
                        <Briefcase size={20} />
                        <span>{t('sidebar.teaching')}</span>
                    </NavLink>
                    <NavLink to="/admin/horarios" className={getNavLinkClass} title={t('sidebar.scheduleAdmin')} onClick={closeSidebar} data-tour="sidebar-admin-horarios">
                        <Calendar size={20} />
                        <span>{t('sidebar.schedule')}</span>
                    </NavLink>
                    {!isSuperAdmin && ( // Superadmin ya tiene fechas globales arriba
                        <NavLink to="/fechas" className={getNavLinkClass} title="Fechas" onClick={closeSidebar}>
                            <CalendarDays size={20} />
                            <span>Fechas</span>
                        </NavLink>
                    )}
                    <NavLink to="/admin/calificaciones" className={getNavLinkClass} title={t('sidebar.stats')} onClick={closeSidebar}>
                        <BarChart3 size={20} />
                        <span>{t('sidebar.stats')}</span>
                    </NavLink>
                    <NavLink to="/configuracion" className={getNavLinkClass} title={t('sidebar.settings')} onClick={closeSidebar} data-tour="sidebar-configuracion">
                        <Settings size={20} />
                        <span>{t('sidebar.settings')}</span>
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
                    <NavLink to="/centros" className={getNavLinkClass} title={t('sidebar.centers')} onClick={closeSidebar} data-tour="sidebar-centros">
                        <Building size={20} />
                        <span>{t('sidebar.centers')}</span>
                    </NavLink>
                    <NavLink to="/fechas" className={getNavLinkClass} title="Fechas" onClick={closeSidebar}>
                        <CalendarDays size={20} />
                        <span>Fechas</span>
                    </NavLink>
                </>
            )
        });
    }



    const sidebarContent = (
        <>
            {/* Overlay para cerrar el menú en móvil al hacer click fuera */}
            {isSidebarOpen && (
                <div className={styles.overlay} onClick={closeSidebar} />
            )}

            <aside
                ref={asideRef}
                className={`${styles.sidebar} ${isCollapsed ? styles.collapsed : ''} ${isPinned ? styles.pinned : ''} ${isSidebarOpen ? styles.mobileOpen : ''}`}
                onMouseEnter={() => setIsHovered(true)}
                onMouseLeave={() => setIsHovered(false)}
            >
                <div className={styles.inner}>
                    <nav className={styles.nav}>
                        <div className={styles.accordionWrapper}>
                            <AccordionView
                                data={accordionData}
                                renderItem={(item) => item.content}
                                renderHeader={(item) => <span>{item.title}</span>}
                                expandedId={expandedAccordion}
                                onToggle={handleAccordionToggle}
                            />
                        </div>
                    </nav>

                    <div className={styles.footer}>
                        {/* Botón pin — solo visible expandido o en hover.
                            En móvil se oculta por CSS. */}
                        <button
                            type="button"
                            className={styles.pinBtn}
                            onClick={togglePin}
                            aria-pressed={isPinned}
                            title={isPinned ? t('sidebar.unpin', 'Desanclar') : t('sidebar.pin', 'Anclar')}
                        >
                            {isPinned ? <PinOff size={18} /> : <Pin size={18} />}
                            <span>{isPinned ? t('sidebar.unpin', 'Desanclar') : t('sidebar.pin', 'Anclar')}</span>
                        </button>
                        <div
                            className={styles.navItem}
                            onClick={() => { setLogoutConfirmOpen(true); closeSidebar(); }}
                            title={t('sidebar.logout')}
                            style={{ cursor: 'pointer' }}
                        >
                            <LogOut size={20} />
                            <span>{t('sidebar.logout')}</span>
                        </div>
                    </div>
                </div>
            </aside>

            <ConfirmLogoutModal
                isOpen={logoutConfirmOpen}
                onClose={() => setLogoutConfirmOpen(false)}
                onConfirm={() => { setLogoutConfirmOpen(false); logout(); }}
            />
        </>
    );

    // En móvil, renderizar vía portal para escapar del stacking context de app-main
    if (isSidebarOpen) {
        return createPortal(sidebarContent, document.body);
    }

    return sidebarContent;
};

export default Sidebar;
