import React, { useState, useEffect, useMemo, useRef } from 'react';
import { createPortal } from 'react-dom';
import { NavLink, useLocation } from 'react-router-dom';
import styles from './Sidebar.module.css';
import { useAuth } from '../context/AuthContext';
import { useUI } from '../context/UIContext';
import { useTour } from '../context/TourContext';
import { getLastPointer } from '../utils/pointerTracker';
import { Home, User, Settings, LogOut, Pin, PinOff, Building, Users, BookOpen, Layers, GraduationCap, UsersRound, Calendar, Briefcase, CalendarDays, FileText, Book, UploadCloud, AlertCircle, MessageSquare, UserCheck, BarChart3, Library, Database, Building2, Info, Clock } from 'lucide-react';
import AccordionView from './AccordionView';
import ConfirmLogoutModal from './ConfirmLogoutModal';
import { useTranslation } from 'react-i18next';
import useUnreadMessages from '../hooks/useUnreadMessages';

// Ancho del sidebar expandido — usado para estimar hover en el primer paint
// tras un remount, cuando aún no existe ref al nuevo aside.
const SIDEBAR_EXPANDED_WIDTH = 260;
const HEADER_HEIGHT_ESTIMATE = 84;

/* Clave del último step de tour cuyo acordeón ya se forzó. Vive a nivel de
   módulo para sobrevivir al remount del Sidebar que ocurre en cada navegación.
   Sin esto, cada remount re-aplicaba el "force" del step activo, lo que
   sobreescribía tanto la elección manual del usuario como el acordeón de la
   ruta destino en mitad del tour (el usuario pulsaba un ítem de otra sección
   y al remontar el Sidebar, effect2 volvía a abrir la sección del tour). */
let lastForcedTourStepKey = null;

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
    const { isSidebarOpen, openSidebar, closeSidebar } = useUI();
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

    /* En móvil el sidebar está display:none por defecto y solo se ve con la
       clase `.mobileOpen` (isSidebarOpen=true). Para que un tour pueda
       apuntar a items del sidebar (sidebar-horarios, etc.) forzamos abrir el
       drawer al arrancar el tour y lo cerramos al terminar.
       OJO: gateado al breakpoint móvil (<=1220px) — en desktop, setear
       isSidebarOpen=true portalea el Sidebar a body y rompe el layout flex
       (main content se expande al 100%). */
    useEffect(() => {
        if (!window.matchMedia('(max-width: 1220px)').matches) return;
        if (currentTour) openSidebar();
        else closeSidebar();
    }, [currentTour, openSidebar, closeSidebar]);

    const isSuperAdmin = user?.roles?.includes('ROLE_SUPERADMIN');
    const isAdmin = user?.roles?.includes('ROLE_ADMIN');
    const isProfesor = user?.roles?.includes('ROLE_PROFESOR');
    const isAlumno = user?.roles?.includes('ROLE_ALUMNO');

    // Mapa de rutas a IDs de acordeón
    const routeToAccordionMap = {
        // Rutas más específicas primero
        '/horarios': 'general',
        '/admin/horarios': 'administracion',
        '/admin/jornadas': 'administracion',
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
        '/itinerarios': 'administracion',
        '/grupos': 'administracion',
        '/materias': 'administracion',
        '/matriculas': 'administracion',
        '/imparticiones': 'administracion',
        '/fechas': isSuperAdmin ? 'superadmin' : 'administracion',
        '/admin/calificaciones': 'administracion',
        '/configuracion': 'administracion',

        '/admin/catalogo': 'catalogo',

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

    /* Al navegar, sincronizamos el acordeón a la sección de la ruta destino:
       así, pulsar un ítem dentro de un acordeón mantiene ese acordeón abierto
       (porque routeAccordion coincide) y pulsar un ítem de otro acordeón
       abre el correcto. Gated por !currentTour para que una navegación
       accidental durante un tour no cambie el acordeón que el step requiere. */
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
        if (!currentTour) {
            lastForcedTourStepKey = null;
            return;
        }
        const step = currentTour.steps?.[currentStepIndex];
        const stepAccordion = step?.accordionSection || currentTour.accordionSection;
        if (!stepAccordion) return;
        /* Sólo forzamos la primera vez que vemos este (tour, step). Si el
           Sidebar se remonta por una navegación pero el tour no ha avanzado,
           respetamos la elección del usuario (o el acordeón de la ruta
           destino, que ya entró por useState inicial) en lugar de reabrir
           la sección del tour. */
        const key = `${currentTour.id}#${currentStepIndex}`;
        if (key === lastForcedTourStepKey) return;
        lastForcedTourStepKey = key;
        setManualAccordion(stepAccordion);
    }, [currentTour, currentStepIndex]);

    const expandedAccordion = manualAccordion;

    const togglePin = () => {
        setIsPinned(prev => !prev);
    };

    const getNavLinkClass = ({ isActive }) =>
        isActive ? `${styles.navItem} ${styles.active}` : styles.navItem;

    const handleAccordionToggle = (id) => {
        setManualAccordion(prev => prev === id ? null : id);
    };

    /* closeSidebar tras navegar cierra el drawer móvil para liberar la
       pantalla. Pero durante un tour necesitamos que el drawer siga
       visible: los steps restantes pueden apuntar a más items del sidebar
       y si se cierra, Joyride pierde los targets. */
    const handleNavClose = () => {
        if (!currentTour) closeSidebar();
    };

    // Definición de las secciones del acordeón
    const accordionData = [];

    // 1. General (Para todos)
    accordionData.push({
        id: 'general',
        title: t('sidebar.general'),
        content: (
            <>
                <NavLink to="/" className={getNavLinkClass} title={t('sidebar.home')} onClick={handleNavClose} data-tour="sidebar-home">
                    <Home size={20} />
                    <span>{t('sidebar.home')}</span>
                </NavLink>
                <NavLink to="/horarios" className={getNavLinkClass} title={t('sidebar.schedule')} onClick={handleNavClose} data-tour="sidebar-horarios">
                    <Calendar size={20} />
                    <span>{t('sidebar.schedule')}</span>
                </NavLink>
                <NavLink to="/mensajes" className={getNavLinkClass} title={t('sidebar.messaging')} onClick={handleNavClose} data-tour="sidebar-mensajes">
                    <MessageSquare size={20} />
                    <span>{t('sidebar.messaging')}</span>
                    {unreadMessages > 0 && (
                        <span className={styles.badge} aria-label={`${unreadMessages} no leídos`}>
                            {unreadMessages > 99 ? '99+' : unreadMessages}
                        </span>
                    )}
                </NavLink>
                <NavLink to="/perfil" className={getNavLinkClass} title={t('sidebar.profile')} onClick={handleNavClose} data-tour="sidebar-perfil">
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
                    <NavLink to="/entregas" className={getNavLinkClass} title={t('sidebar.deliveries')} onClick={handleNavClose} data-tour="sidebar-entregas">
                        <UploadCloud size={20} />
                        <span>{t('sidebar.deliveries')}</span>
                    </NavLink>
                    <NavLink to="/calificaciones" className={getNavLinkClass} title={t('sidebar.grades')} onClick={handleNavClose} data-tour="sidebar-calificaciones">
                        <BarChart3 size={20} />
                        <span>{t('sidebar.grades')}</span>
                    </NavLink>
                    <NavLink to="/mis-temarios" className={getNavLinkClass} title={t('sidebar.myTemarios')} onClick={handleNavClose} data-tour="sidebar-mis-temarios">
                        <Book size={20} />
                        <span>{t('sidebar.myTemarios')}</span>
                    </NavLink>
                    <NavLink to="/claustro" className={getNavLinkClass} title={t('sidebar.faculty')} onClick={handleNavClose} data-tour="sidebar-claustro">
                        <UserCheck size={20} />
                        <span>{t('sidebar.faculty')}</span>
                    </NavLink>
                    <NavLink to="/mis-alumnos" className={getNavLinkClass} title={t('sidebar.myStudents')} onClick={handleNavClose} data-tour="sidebar-mis-alumnos">
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
                    <NavLink to="/apuntes" className={getNavLinkClass} title={t('sidebar.myNotes')} onClick={handleNavClose} data-tour="sidebar-apuntes">
                        <FileText size={20} />
                        <span>{t('sidebar.myNotes')}</span>
                    </NavLink>
                    <NavLink to="/faltas" className={getNavLinkClass} title={t('sidebar.myAbsences')} onClick={handleNavClose} data-tour="sidebar-faltas">
                        <AlertCircle size={20} />
                        <span>{t('sidebar.myAbsences')}</span>
                    </NavLink>
                    <NavLink to="/mis-calificaciones" className={getNavLinkClass} title={t('sidebar.myGrades')} onClick={handleNavClose} data-tour="sidebar-mis-calificaciones">
                        <BarChart3 size={20} />
                        <span>{t('sidebar.myGrades')}</span>
                    </NavLink>
                    <NavLink to="/companeros" className={getNavLinkClass} title={t('sidebar.myClassmates')} onClick={handleNavClose}>
                        <UsersRound size={20} />
                        <span>{t('sidebar.myClassmates')}</span>
                    </NavLink>
                    <NavLink to="/mis-profesores" className={getNavLinkClass} title={t('sidebar.myTeachers')} onClick={handleNavClose}>
                        <UserCheck size={20} />
                        <span>{t('sidebar.myTeachers')}</span>
                    </NavLink>
                    {/* Entregas solo si NO tiene sección Profesor (evitar duplicados) */}
                    {!isProfesor && !isAdmin && !isSuperAdmin && (
                        <NavLink to="/entregas" className={getNavLinkClass} title={t('sidebar.deliveries')} onClick={handleNavClose} data-tour="sidebar-entregas">
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
                    <NavLink to="/usuarios" className={getNavLinkClass} title={t('sidebar.users')} onClick={handleNavClose} data-tour="sidebar-usuarios">
                        <Users size={20} />
                        <span>{t('sidebar.users')}</span>
                    </NavLink>
                    <NavLink to="/itinerarios" className={getNavLinkClass} title={t('sidebar.itinerarios')} onClick={handleNavClose} data-tour="sidebar-itinerarios">
                        <Layers size={20} />
                        <span>{t('sidebar.itinerarios')}</span>
                    </NavLink>
                    <NavLink to="/grupos" className={getNavLinkClass} title={t('sidebar.groups')} onClick={handleNavClose} data-tour="sidebar-grupos">
                        <UsersRound size={20} />
                        <span>{t('sidebar.groups')}</span>
                    </NavLink>
                    <NavLink to="/materias" className={getNavLinkClass} title={t('sidebar.materias')} onClick={handleNavClose} data-tour="sidebar-materias">
                        <BookOpen size={20} />
                        <span>{t('sidebar.materias')}</span>
                    </NavLink>
                    <NavLink to="/matriculas" className={getNavLinkClass} title={t('sidebar.enrollments')} onClick={handleNavClose} data-tour="sidebar-matriculas">
                        <GraduationCap size={20} />
                        <span>{t('sidebar.enrollments')}</span>
                    </NavLink>
                    <NavLink to="/imparticiones" className={getNavLinkClass} title={t('sidebar.teachingAssignment')} onClick={handleNavClose} data-tour="sidebar-imparticiones">
                        <Briefcase size={20} />
                        <span>{t('sidebar.teaching')}</span>
                    </NavLink>
                    <NavLink to="/admin/horarios" className={getNavLinkClass} title={t('sidebar.scheduleAdmin')} onClick={handleNavClose} data-tour="sidebar-admin-horarios">
                        <Calendar size={20} />
                        <span>{t('sidebar.schedule')}</span>
                    </NavLink>
                    <NavLink to="/admin/jornadas" className={getNavLinkClass} title={t('sidebar.jornadas', { defaultValue: 'Jornadas' })} onClick={handleNavClose} data-tour="sidebar-admin-jornadas">
                        <Clock size={20} />
                        <span>{t('sidebar.jornadas', { defaultValue: 'Jornadas' })}</span>
                    </NavLink>
                    {!isSuperAdmin && ( // Superadmin ya tiene fechas globales arriba
                        <NavLink to="/fechas" className={getNavLinkClass} title="Fechas" onClick={handleNavClose}>
                            <CalendarDays size={20} />
                            <span>Fechas</span>
                        </NavLink>
                    )}
                    <NavLink to="/admin/calificaciones" className={getNavLinkClass} title={t('sidebar.stats')} onClick={handleNavClose}>
                        <BarChart3 size={20} />
                        <span>{t('sidebar.stats')}</span>
                    </NavLink>
                    <NavLink to="/configuracion" className={getNavLinkClass} title={t('sidebar.settings')} onClick={handleNavClose} data-tour="sidebar-configuracion">
                        <Settings size={20} />
                        <span>{t('sidebar.settings')}</span>
                    </NavLink>
                </>
            )
        });
    }

    // 5. Catálogo oficial (read-only del catálogo educativo nacional)
    if (isSuperAdmin || isAdmin) {
        accordionData.push({
            id: 'catalogo',
            title: t('sidebar.catalogo'),
            content: (
                <>
                    <NavLink to="/admin/catalogo/itinerarios" className={getNavLinkClass} title={t('sidebar.catalogoItinerarios')} onClick={handleNavClose}>
                        <Library size={20} />
                        <span>{t('sidebar.catalogoItinerarios')}</span>
                    </NavLink>
                    <NavLink to="/admin/catalogo/materias" className={getNavLinkClass} title={t('sidebar.catalogoMaterias')} onClick={handleNavClose}>
                        <Database size={20} />
                        <span>{t('sidebar.catalogoMaterias')}</span>
                    </NavLink>
                    {isSuperAdmin && (
                        <NavLink to="/admin/catalogo/centros" className={getNavLinkClass} title={t('sidebar.catalogoCentros')} onClick={handleNavClose}>
                            <Building2 size={20} />
                            <span>{t('sidebar.catalogoCentros')}</span>
                        </NavLink>
                    )}
                    <NavLink to="/admin/catalogo/acerca" className={getNavLinkClass} title={t('sidebar.catalogoAcerca')} onClick={handleNavClose}>
                        <Info size={20} />
                        <span>{t('sidebar.catalogoAcerca')}</span>
                    </NavLink>
                </>
            )
        });
    }

    // 6. Superadmin
    if (isSuperAdmin) {
        accordionData.push({
            id: 'superadmin',
            title: t('sidebar.superadmin'),
            content: (
                <>
                    <NavLink to="/centros" className={getNavLinkClass} title={t('sidebar.centers')} onClick={handleNavClose} data-tour="sidebar-centros">
                        <Building size={20} />
                        <span>{t('sidebar.centers')}</span>
                    </NavLink>
                    <NavLink to="/fechas" className={getNavLinkClass} title="Fechas" onClick={handleNavClose}>
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
                <div className={styles.overlay} onClick={handleNavClose} />
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
                                persistScrollKey="sidebar"
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
