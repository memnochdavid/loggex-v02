import React, {
    createContext,
    useCallback,
    useContext,
    useEffect,
    useMemo,
    useRef,
    useState,
} from 'react';
import { useLocation } from 'react-router-dom';
import { tourRegistry } from '../tours';
import { useAuth } from './AuthContext';
import { getApiUrl } from '../config/api';

const STORAGE_KEY          = 'loggex.tours.completed';
const STORAGE_BADGES_OFF   = 'loggex.tours.badgesDisabled';
const TourContext          = createContext(null);

/* ---------- helpers de persistencia (localStorage como fallback) ---------- */

const readLocal = () => {
    try {
        const raw = localStorage.getItem(STORAGE_KEY);
        if (!raw) return [];
        const parsed = JSON.parse(raw);
        return Array.isArray(parsed) ? parsed : [];
    } catch { return []; }
};

const writeLocal = (list) => {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(list)); }
    catch { /* quota o no disponible → silencio */ }
};

const readBadgesDisabled = () => {
    try { return localStorage.getItem(STORAGE_BADGES_OFF) === '1'; }
    catch { return false; }
};

const writeBadgesDisabled = (disabled) => {
    try { localStorage.setItem(STORAGE_BADGES_OFF, disabled ? '1' : '0'); }
    catch { /* silencio */ }
};

/* ---------- matching ---------- */

const userMatchesRoles = (user, allowedRoles) => {
    if (!user || !Array.isArray(allowedRoles) || allowedRoles.length === 0) {
        return false;
    }
    const userRoles = user.roles || [];
    return allowedRoles.some(r => userRoles.includes(r));
};

/**
 * Comprueba si `pathname` hace match con el `routePattern` declarado en un
 * trigger. Formatos soportados:
 *   '/entregas'           → exacto
 *   '/entregas/:id'       → segmentos dinámicos ( :foo matchea un segmento )
 *   /^\/admin\/.+$/       → regex directa (se puede pasar una RegExp)
 *   (pathname) => bool    → función predicado
 */
const routeMatches = (pattern, pathname) => {
    if (!pattern) return false;
    if (typeof pattern === 'function') return !!pattern(pathname);
    if (pattern instanceof RegExp) return pattern.test(pathname);
    if (typeof pattern !== 'string') return false;

    if (!pattern.includes(':')) {
        return pattern === pathname;
    }
    /* Convierte '/tareas/:id' en regex '^/tareas/[^/]+$'. */
    const re = new RegExp(
        '^' + pattern.replace(/:[A-Za-z0-9_]+/g, '[^/]+') + '$'
    );
    return re.test(pathname);
};

/* ---------- API backend ---------- */

const fetchBackendStatus = async () => {
    try {
        const res = await fetch(getApiUrl('/api/me/tutorials/status'), {
            credentials: 'include',
            headers: { 'Accept': 'application/json' },
        });
        if (!res.ok) return null;
        const data = await res.json();
        return Array.isArray(data.completed) ? data.completed : [];
    } catch { return null; }
};

const postBackendComplete = async (id) => {
    try {
        const res = await fetch(
            getApiUrl(`/api/me/tutorials/${encodeURIComponent(id)}/complete`),
            { method: 'POST', credentials: 'include', headers: { 'Accept': 'application/json' } },
        );
        return res.ok;
    } catch { return false; }
};

const postBackendReset = async () => {
    try {
        const res = await fetch(getApiUrl('/api/me/tutorials/reset'), {
            method: 'POST', credentials: 'include', headers: { 'Accept': 'application/json' },
        });
        return res.ok;
    } catch { return false; }
};

/* ============================================================ */

export const TourProvider = ({ children }) => {
    const { user } = useAuth();
    const location = useLocation();

    const [completed, setCompleted] = useState(() => readLocal());
    const [currentTour, setCurrentTour] = useState(null);
    const [badgesDisabled, setBadgesDisabled] = useState(() => readBadgesDisabled());

    /* Contexto publicable por cada página, usado por steps condicionales.
       Ej: HorariosEditor puede hacer setTourContext({ impartionesSinHorario: 3 }) */
    const [tourRuntimeCtx, setTourRuntimeCtx] = useState({});

    const [autoStartChecked, setAutoStartChecked] = useState(false);
    const lastSyncedUserId = useRef(null);

    /* ---------- Sync inicial cuando entra un user ---------- */
    useEffect(() => {
        if (!user) return;
        if (lastSyncedUserId.current === user.id) return;
        lastSyncedUserId.current = user.id;

        let cancelled = false;
        (async () => {
            const backend = await fetchBackendStatus();
            if (cancelled) return;
            if (backend === null) return;

            const local = readLocal();
            const merged = Array.from(new Set([...backend, ...local]));
            const missing = local.filter(id => !backend.includes(id));

            setCompleted(merged);
            writeLocal(merged);

            for (const id of missing) {
                postBackendComplete(id);
            }
        })();

        return () => { cancelled = true; };
    }, [user]);

    /* ---------- Reset al logout ---------- */
    useEffect(() => {
        if (!user) {
            lastSyncedUserId.current = null;
            setAutoStartChecked(false);
            setCurrentTour(null);
            setTourRuntimeCtx({});
        }
    }, [user]);

    /* ---------- API pública ---------- */

    const isCompleted = useCallback(
        (id) => completed.includes(id),
        [completed],
    );

    const startTour = useCallback((id) => {
        const tour = tourRegistry.find(t => t.id === id);
        if (!tour) {
            console.warn(`[TourContext] tour "${id}" no encontrado en el registro`);
            return;
        }
        setCurrentTour(tour);
    }, []);

    const finishTour = useCallback((outcome = 'completed') => {
        setCurrentTour(prev => {
            if (prev && (outcome === 'completed' || outcome === 'skipped')) {
                const id = prev.id;
                setCompleted(curr => {
                    if (curr.includes(id)) return curr;
                    const next = [...curr, id];
                    writeLocal(next);
                    return next;
                });
                if (user) postBackendComplete(id);
            }
            return null;
        });
    }, [user]);

    /** Marca un tour como "visto/saltado" sin lanzarlo — para el "No, gracias"
        del ContextualHelpBadge. Sin diferencia semántica con skipped. */
    const dismissTour = useCallback((id) => {
        setCompleted(curr => {
            if (curr.includes(id)) return curr;
            const next = [...curr, id];
            writeLocal(next);
            return next;
        });
        if (user) postBackendComplete(id);
    }, [user]);

    const resetTours = useCallback(async () => {
        setCompleted([]);
        writeLocal([]);
        if (user) await postBackendReset();
        setAutoStartChecked(false);
    }, [user]);

    const setBadges = useCallback((enabled) => {
        const disabled = !enabled;
        setBadgesDisabled(disabled);
        writeBadgesDisabled(disabled);
    }, []);

    /** Publica (merge) contexto de la página actual para pasos condicionales.
        Ej: useEffect(() => setTourContext({ impartionesSinHorario: n }), [n]) */
    const setTourContext = useCallback((partial) => {
        setTourRuntimeCtx(curr => ({ ...curr, ...partial }));
    }, []);

    /* ---------- tours disponibles por rol ---------- */
    const availableTours = useMemo(() => {
        if (!user) return [];
        return tourRegistry.filter(t => userMatchesRoles(user, t.roles));
    }, [user]);

    /* ---------- badge candidato para la ruta actual ----------
       Un tour es candidato si cumple TODAS estas condiciones:
         · el user tiene sus roles
         · el tour declara trigger.route y hace match con la ruta actual
         · el user aún no lo ha completado / saltado
         · los badges no están desactivados globalmente
         · NO hay ya un tour activo (no solapamos ayuda contextual sobre
           un tour en marcha) */
    const badgeCandidate = useMemo(() => {
        if (badgesDisabled) return null;
        if (currentTour) return null;
        if (!user) return null;
        return availableTours.find(t =>
            t.trigger?.route
            && routeMatches(t.trigger.route, location.pathname)
            && !completed.includes(t.id),
        ) || null;
    }, [availableTours, completed, currentTour, badgesDisabled, location.pathname, user]);

    /* ---------- auto-start ---------- */
    useEffect(() => {
        if (!user || autoStartChecked) return;
        if (lastSyncedUserId.current !== user.id) return;

        const candidate = availableTours.find(
            t => t.isAutoStart && !completed.includes(t.id),
        );
        if (candidate) {
            const timer = setTimeout(() => setCurrentTour(candidate), 700);
            setAutoStartChecked(true);
            return () => clearTimeout(timer);
        }
        setAutoStartChecked(true);
    }, [user, availableTours, completed, autoStartChecked]);

    /* ---------- value ---------- */
    const value = useMemo(() => ({
        currentTour,
        availableTours,
        completed,
        tourRuntimeCtx,
        badgesEnabled: !badgesDisabled,
        badgeCandidate,
        startTour,
        finishTour,
        dismissTour,
        isCompleted,
        resetTours,
        setBadges,
        setTourContext,
        location,
    }), [
        currentTour, availableTours, completed, tourRuntimeCtx, badgesDisabled,
        badgeCandidate, startTour, finishTour, dismissTour, isCompleted,
        resetTours, setBadges, setTourContext, location,
    ]);

    return (
        <TourContext.Provider value={value}>
            {children}
        </TourContext.Provider>
    );
};

export const useTour = () => {
    const ctx = useContext(TourContext);
    if (!ctx) {
        throw new Error('useTour debe usarse dentro de un <TourProvider>');
    }
    return ctx;
};

/**
 * Hook de conveniencia: publica un objeto de contexto (memoizado por el
 * llamante) que los steps condicionales pueden leer vía step.condition(ctx).
 * Limpia al desmontar para no contaminar entre páginas.
 */
export const useProvideTourContext = (data) => {
    const { setTourContext } = useTour();
    useEffect(() => {
        setTourContext(data);
        return () => {
            /* limpia SOLO las keys que esta página publicó */
            const keysToClear = Object.keys(data || {});
            setTourContext(
                keysToClear.reduce((acc, k) => { acc[k] = undefined; return acc; }, {}),
            );
        };
    }, [data, setTourContext]);
};
