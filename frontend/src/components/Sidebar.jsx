import React, { useState, useEffect, useMemo, useRef } from 'react';
import { createPortal } from 'react-dom';
import { NavLink, useLocation } from 'react-router-dom';
import styles from './Sidebar.module.css';
import { useAuth } from '../context/AuthContext';
import { useUI } from '../context/UIContext';
import { useTour } from '../context/TourContext';
import { getLastPointer } from '../utils/pointerTracker';
import { Home, User, Settings, LogOut, Pin, PinOff, Building, Users, BookOpen, Layers, GraduationCap, UsersRound, Calendar, Briefcase, CalendarDays, FileText, Book, UploadCloud, AlertCircle, MessageSquare, UserCheck, BarChart3, Library, Database, Building2, Info, Clock, Shuffle, Search, X as XIcon, List, LayoutList } from 'lucide-react';
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

// Normaliza un string para búsqueda case/diacrítico-insensitive.
const normalizeForSearch = (s) => (s || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '');

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
    const [searchQuery, setSearchQuery] = useState('');
    const asideRef = useRef(null);
    const searchInputRef = useRef(null);
    /* Ref al contenedor scrollable del modo plano agrupado.
       En modo acordeón, cada `AccordionItem` persiste su propio scrollTop
       (via `persistScrollKey="sidebar"`), así que al navegar y remontar
       el Sidebar el scroll del panel abierto se restaura. En modo plano
       no hay acordeón: la lista entera vive en `.flatGrouped` con su
       propio overflow, por lo que necesitamos persistir aquí también
       para que pulsar un acceso no rebobine al inicio. */
    const flatGroupedRef = useRef(null);
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

    /* Al colapsar el sidebar (mouseleave / unpin), el input de búsqueda se
       oculta visualmente: limpiamos la query también para que al volver a
       expandir no aparezca el modo plano con resultados de una búsqueda
       olvidada. Cosmético pero evita "estado fantasma". */
    useEffect(() => {
        if (isCollapsed && searchQuery !== '') {
            setSearchQuery('');
        }
    }, [isCollapsed, searchQuery]);

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
        '/admin/incidencias': 'administracion',
        '/mensajes': 'general',
        '/perfil': 'general',

        '/entregas': (isAlumno && !isProfesor && !isAdmin && !isSuperAdmin) ? 'alumno' : 'profesor',
        '/calificaciones': 'profesor',
        '/mis-temarios': 'profesor',
        '/claustro': 'profesor',
        '/mis-alumnos': 'profesor',

        '/mis-apuntes': 'alumno',
        '/mis-calificaciones': 'alumno',
        '/faltas': 'alumno',
        '/companeros': 'alumno',
        '/mis-profesores': 'alumno',

        '/usuarios': 'administracion',
        '/itinerarios': 'administracion',
        '/grupos': 'administracion',
        '/materias': 'administracion',
        '/matriculas': 'administracion',
        '/docencia': 'administracion',
        '/centros': 'administracion',
        '/fechas': 'administracion',
        '/admin/estadisticas': 'administracion',
        '/personalizacion': 'administracion',

        '/admin/catalogo': 'catalogo',

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
        // Tras navegar, vaciamos el filtro: el usuario ya encontró lo que buscaba.
        if (searchQuery) setSearchQuery('');
    };

    /* Definición de las secciones como datos, no JSX. Esto permite:
       1) renderizar dentro de un AccordionView en modo normal,
       2) aplanar y filtrar en modo búsqueda sin duplicar markup. */
    const accordionData = useMemo(() => {
        const sections = [];

        // 1. General (Para todos)
        sections.push({
            id: 'general',
            title: t('sidebar.general'),
            items: [
                { to: '/', Icon: Home, label: t('sidebar.home'), tour: 'sidebar-home' },
                { to: '/horarios', Icon: Calendar, label: t('sidebar.schedule'), tour: 'sidebar-horarios' },
                {
                    to: '/mensajes',
                    Icon: MessageSquare,
                    label: t('sidebar.messaging'),
                    tour: 'sidebar-mensajes',
                    badge: unreadMessages > 0 ? (
                        <span className={styles.badge} aria-label={`${unreadMessages} no leídos`}>
                            {unreadMessages > 99 ? '99+' : unreadMessages}
                        </span>
                    ) : null,
                },
                { to: '/perfil', Icon: User, label: t('sidebar.profile'), tour: 'sidebar-perfil' },
            ],
        });

        // 2. Profesor
        if (isProfesor || isSuperAdmin || isAdmin) {
            sections.push({
                id: 'profesor',
                title: t('sidebar.teacher'),
                items: [
                    { to: '/entregas', Icon: UploadCloud, label: t('sidebar.deliveries'), tour: 'sidebar-entregas' },
                    { to: '/calificaciones', Icon: BarChart3, label: t('sidebar.grades'), tour: 'sidebar-calificaciones' },
                    { to: '/mis-temarios', Icon: Book, label: t('sidebar.myTemarios'), tour: 'sidebar-mis-temarios' },
                    { to: '/claustro', Icon: UserCheck, label: t('sidebar.faculty'), tour: 'sidebar-claustro' },
                    { to: '/mis-alumnos', Icon: UsersRound, label: t('sidebar.myStudents'), tour: 'sidebar-mis-alumnos' },
                ],
            });
        }

        // 3. Alumno
        if (isAlumno || isSuperAdmin) {
            const items = [
                { to: '/mis-apuntes', Icon: FileText, label: t('sidebar.myNotes'), tour: 'sidebar-apuntes' },
                { to: '/faltas', Icon: AlertCircle, label: t('sidebar.myAbsences'), tour: 'sidebar-faltas' },
                { to: '/mis-calificaciones', Icon: BarChart3, label: t('sidebar.myGrades'), tour: 'sidebar-mis-calificaciones' },
                { to: '/companeros', Icon: UsersRound, label: t('sidebar.myClassmates') },
                { to: '/mis-profesores', Icon: UserCheck, label: t('sidebar.myTeachers') },
            ];
            // Entregas solo si NO tiene sección Profesor (evitar duplicados).
            if (!isProfesor && !isAdmin && !isSuperAdmin) {
                items.push({ to: '/entregas', Icon: UploadCloud, label: t('sidebar.deliveries'), tour: 'sidebar-entregas' });
            }
            sections.push({ id: 'alumno', title: t('sidebar.student'), items });
        }

        // 4. Administración (incluye Centros y Fechas, antes en Superadmin).
        if (isSuperAdmin || isAdmin) {
            const items = [
                { to: '/usuarios', Icon: Users, label: t('sidebar.users'), tour: 'sidebar-usuarios' },
                { to: '/itinerarios', Icon: Layers, label: t('sidebar.itinerarios'), tour: 'sidebar-itinerarios' },
                { to: '/grupos', Icon: UsersRound, label: t('sidebar.groups'), tour: 'sidebar-grupos' },
                { to: '/materias', Icon: BookOpen, label: t('sidebar.materias'), tour: 'sidebar-materias' },
                { to: '/matriculas', Icon: GraduationCap, label: t('sidebar.enrollments'), tour: 'sidebar-matriculas' },
                { to: '/docencia', Icon: Briefcase, label: t('sidebar.teaching'), tour: 'sidebar-imparticiones' },
                { to: '/admin/horarios', Icon: Calendar, label: t('sidebar.schedule'), tour: 'sidebar-admin-horarios' },
                { to: '/admin/jornadas', Icon: Clock, label: t('sidebar.jornadas', { defaultValue: 'Jornadas' }), tour: 'sidebar-admin-jornadas' },
                { to: '/admin/incidencias', Icon: Shuffle, label: t('sidebar.exceptions', { defaultValue: 'Excepciones' }), tour: 'sidebar-admin-excepciones' },
                { to: '/fechas', Icon: CalendarDays, label: t('sidebar.dates', { defaultValue: 'Fechas' }) },
                { to: '/admin/estadisticas', Icon: BarChart3, label: t('sidebar.stats') },
            ];
            if (isSuperAdmin) {
                // Centros solo lo gestiona el SuperAdmin (la ruta tiene guard
                // ROLE_SUPERADMIN tanto en frontend como en API Platform).
                items.push({ to: '/centros', Icon: Building, label: t('sidebar.centers'), tour: 'sidebar-centros' });
            }
            items.push({ to: '/personalizacion', Icon: Settings, label: t('sidebar.settings'), tour: 'sidebar-configuracion' });
            sections.push({ id: 'administracion', title: t('sidebar.admin'), items });
        }

        // 5. Catálogo oficial
        if (isSuperAdmin || isAdmin) {
            const items = [
                { to: '/admin/catalogo/itinerarios', Icon: Library, label: t('sidebar.catalogoItinerarios') },
                { to: '/admin/catalogo/materias', Icon: Database, label: t('sidebar.catalogoMaterias') },
            ];
            if (isSuperAdmin) {
                items.push({ to: '/admin/catalogo/centros', Icon: Building2, label: t('sidebar.catalogoCentros') });
            }
            items.push({ to: '/admin/catalogo/acerca', Icon: Info, label: t('sidebar.catalogoAcerca') });
            sections.push({ id: 'catalogo', title: t('sidebar.catalogo'), items });
        }

        return sections;
    }, [t, isProfesor, isAlumno, isAdmin, isSuperAdmin, unreadMessages]);

    /* Lista plana de items con su sección — para el modo búsqueda. */
    const allItems = useMemo(() => {
        const flat = [];
        for (const section of accordionData) {
            for (const it of section.items) {
                flat.push({ ...it, sectionId: section.id, sectionTitle: section.title });
            }
        }
        return flat;
    }, [accordionData]);

    const queryNorm = normalizeForSearch(searchQuery.trim());
    const filteredItems = useMemo(() => {
        if (!queryNorm) return null;
        return allItems.filter(it => {
            const inLabel = normalizeForSearch(it.label).includes(queryNorm);
            const inSection = normalizeForSearch(it.sectionTitle).includes(queryNorm);
            return inLabel || inSection;
        });
    }, [allItems, queryNorm]);

    /* Detección de altura insuficiente para acordeones.
       Si el viewport no da para mostrar todas las cabeceras + la sección
       con más ítems abierta sin scroll interno asfixiado, conmutamos a
       modo plano agrupado (toda la nav scrollea en bloque). Las constantes
       siguen los valores reales del CSS (header acordeón 52, gap 8, item 36,
       paddings 32, header app 84, buscador+footer 180). */
    const { sectionCount, largestSection } = useMemo(() => ({
        sectionCount: accordionData.length,
        largestSection: accordionData.reduce((m, s) => Math.max(m, s.items.length), 0),
    }), [accordionData]);

    const [autoFlat, setAutoFlat] = useState(false);

    useEffect(() => {
        const HEADER_PX = 84;
        const NAV_OVERHEAD_PX = 180;
        const ACC_HEADER_PX = 52;
        const ACC_GAP_PX = 8;
        const ACC_INNER_PAD_PX = 32;
        const NAV_ITEM_PX = 36;

        const compute = () => {
            if (sectionCount === 0) { setAutoFlat(false); return; }
            const navH = window.innerHeight - HEADER_PX - NAV_OVERHEAD_PX;
            const headersBlock = sectionCount * ACC_HEADER_PX + Math.max(0, sectionCount - 1) * ACC_GAP_PX;
            const openContent = ACC_INNER_PAD_PX + largestSection * NAV_ITEM_PX;
            setAutoFlat(headersBlock + openContent > navH);
        };
        compute();
        window.addEventListener('resize', compute);
        return () => window.removeEventListener('resize', compute);
    }, [sectionCount, largestSection]);

    /* Preferencia explícita del usuario: null = automático (lo decide la
       heurística por resolución), true/false = elección manual que prevalece
       en cualquier resolución. Persistida igual que el pin. */
    const [flatPreference, setFlatPreference] = useState(() => {
        try {
            const raw = localStorage.getItem('sidebarFlatPreference');
            return raw === null ? null : JSON.parse(raw);
        } catch { return null; }
    });

    useEffect(() => {
        try {
            if (flatPreference === null) localStorage.removeItem('sidebarFlatPreference');
            else localStorage.setItem('sidebarFlatPreference', JSON.stringify(flatPreference));
        } catch {}
    }, [flatPreference]);

    const effectiveFlat = flatPreference !== null ? flatPreference : autoFlat;

    /* Flag transitorio sólo durante el toggle manual — usado para animar el
       fade+slide del nuevo modo al entrar. En remounts del Sidebar (cada
       navegación monta de nuevo Layout) este flag queda en false, así no se
       reintroduce el flicker que se eliminó deshabilitando el stagger del
       acordeón en .accordionWrapper. */
    const [modeSwapping, setModeSwapping] = useState(false);
    useEffect(() => {
        if (!modeSwapping) return;
        const t = setTimeout(() => setModeSwapping(false), 500);
        return () => clearTimeout(t);
    }, [modeSwapping]);

    const toggleFlatLayout = () => {
        setFlatPreference(prev => prev === null ? !autoFlat : !prev);
        setModeSwapping(true);
    };

    /* Persistencia de scroll del modo plano agrupado. Misma idea que
       `AccordionItem.persistScrollKey`: al remontar (tras navegar a una
       ruta), restauramos la posición previa. El tour (Joyride) hace su
       propio scroll sobre el padre scrollable cuando lo necesita; ocurre
       después de este restore, así que no chocamos con `scrollToFirstStep`
       ni con el reposicionamiento entre steps. */
    const FLAT_SCROLL_KEY = 'sidebar_flat_scroll';

    useEffect(() => {
        // Sólo aplica en modo plano y fuera del modo búsqueda.
        if (!effectiveFlat || filteredItems !== null) return;
        const el = flatGroupedRef.current;
        if (!el) return;
        try {
            const stored = sessionStorage.getItem(FLAT_SCROLL_KEY);
            if (stored !== null) el.scrollTop = parseInt(stored, 10) || 0;
        } catch {}
    }, [effectiveFlat, filteredItems]);

    const handleFlatScroll = (e) => {
        try {
            sessionStorage.setItem(FLAT_SCROLL_KEY, String(e.currentTarget.scrollTop));
        } catch {}
    };

    const renderNavItem = (item, opts = {}) => {
        const { showSection = false } = opts;
        const tourAttrs = item.tour ? { 'data-tour': item.tour } : {};
        return (
            <NavLink
                key={`${item.sectionId || ''}:${item.to}`}
                to={item.to}
                className={getNavLinkClass}
                title={item.label}
                onClick={handleNavClose}
                {...tourAttrs}
            >
                <item.Icon size={20} />
                <span className={styles.navItemLabel}>
                    {item.label}
                    {showSection && item.sectionTitle && (
                        <span className={styles.navItemSection}>{item.sectionTitle}</span>
                    )}
                </span>
                {item.badge}
            </NavLink>
        );
    };

    const renderSectionItems = (section) => section.items.map(it => renderNavItem({ ...it, sectionId: section.id }));

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
                    {/* Buscador del sidebar. Aparece solo expandido para no
                        colisionar con la zona de iconos en modo colapsado. Sin
                        query, comportamiento normal (acordeones); con query,
                        modo plano filtrado en toda la nav. */}
                    <div className={styles.searchWrap}>
                        <Search size={16} className={styles.searchIcon} aria-hidden="true" />
                        <input
                            ref={searchInputRef}
                            type="search"
                            className={styles.searchInput}
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            placeholder={t('sidebar.searchPlaceholder', { defaultValue: 'Buscar accesos…' })}
                            aria-label={t('sidebar.searchPlaceholder', { defaultValue: 'Buscar accesos…' })}
                            spellCheck={false}
                            autoComplete="off"
                        />
                        {searchQuery && (
                            <button
                                type="button"
                                className={styles.searchClear}
                                onClick={() => { setSearchQuery(''); searchInputRef.current?.focus(); }}
                                aria-label={t('sidebar.searchClear', { defaultValue: 'Limpiar búsqueda' })}
                                title={t('sidebar.searchClear', { defaultValue: 'Limpiar búsqueda' })}
                            >
                                <XIcon size={14} />
                            </button>
                        )}
                    </div>

                    <nav className={styles.nav}>
                        {filteredItems !== null ? (
                            <div className={styles.flatResults} role="list">
                                {filteredItems.length > 0 ? (
                                    filteredItems.map(it => renderNavItem(it, { showSection: true }))
                                ) : (
                                    <p className={styles.noResults}>
                                        {t('sidebar.searchNoResults', { defaultValue: 'Sin resultados.' })}
                                    </p>
                                )}
                            </div>
                        ) : effectiveFlat ? (
                            <div
                                ref={flatGroupedRef}
                                onScroll={handleFlatScroll}
                                className={`${styles.flatGrouped} ${modeSwapping ? styles.modeSwapIn : ''}`}
                                role="list"
                            >
                                {accordionData.map(section => (
                                    <div key={section.id} className={styles.flatSection}>
                                        <h3 className={styles.flatSectionLabel}>{section.title}</h3>
                                        {section.items.map(it => renderNavItem({ ...it, sectionId: section.id }))}
                                    </div>
                                ))}
                            </div>
                        ) : (
                            <div className={`${styles.accordionWrapper} ${modeSwapping ? styles.modeSwapIn : ''}`}>
                                <AccordionView
                                    data={accordionData}
                                    renderItem={renderSectionItems}
                                    renderHeader={(item) => <span>{item.title}</span>}
                                    expandedId={expandedAccordion}
                                    onToggle={handleAccordionToggle}
                                    persistScrollKey="sidebar"
                                />
                            </div>
                        )}
                    </nav>

                    <div className={styles.footer}>
                        {/* Fila de acciones del footer: anclar + alternar modo de
                            navegación (acordeones / listado plano). Comparten línea
                            en expandido y se apilan icon-only en colapsado. En móvil
                            el pin está oculto por CSS, así que el toggle queda solo. */}
                        <div className={styles.footerActions}>
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
                            <button
                                type="button"
                                className={styles.flatBtn}
                                onClick={toggleFlatLayout}
                                aria-pressed={effectiveFlat}
                                title={effectiveFlat
                                    ? t('sidebar.groupAccordion', 'Agrupar en acordeones')
                                    : t('sidebar.flatLayout', 'Listado plano')}
                                aria-label={effectiveFlat
                                    ? t('sidebar.groupAccordion', 'Agrupar en acordeones')
                                    : t('sidebar.flatLayout', 'Listado plano')}
                            >
                                {effectiveFlat ? <LayoutList size={18} /> : <List size={18} />}
                            </button>
                        </div>
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
