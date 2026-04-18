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

const STORAGE_KEY = 'loggex.tours.completed';
const TourContext = createContext(null);

/* ---------- helpers de persistencia (localStorage como fallback) ---------- */

const readLocal = () => {
    try {
        const raw = localStorage.getItem(STORAGE_KEY);
        if (!raw) return [];
        const parsed = JSON.parse(raw);
        return Array.isArray(parsed) ? parsed : [];
    } catch {
        return [];
    }
};

const writeLocal = (list) => {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(list)); }
    catch { /* localStorage lleno o no disponible — fallamos silenciosamente */ }
};

/* ---------- helpers de roles ---------- */

const userMatchesRoles = (user, allowedRoles) => {
    if (!user || !Array.isArray(allowedRoles) || allowedRoles.length === 0) {
        return false;
    }
    const userRoles = user.roles || [];
    return allowedRoles.some(r => userRoles.includes(r));
};

/* ---------- API backend ----------
   Si el backend falla (offline, error, no autenticado) caemos al localStorage
   y la UI sigue funcionando — el siguiente login intentará re-sincronizar. */

const fetchBackendStatus = async () => {
    try {
        const res = await fetch(getApiUrl('/api/me/tutorials/status'), {
            credentials: 'include',
            headers: { 'Accept': 'application/json' },
        });
        if (!res.ok) return null;
        const data = await res.json();
        return Array.isArray(data.completed) ? data.completed : [];
    } catch {
        return null;
    }
};

const postBackendComplete = async (id) => {
    try {
        const res = await fetch(
            getApiUrl(`/api/me/tutorials/${encodeURIComponent(id)}/complete`),
            {
                method: 'POST',
                credentials: 'include',
                headers: { 'Accept': 'application/json' },
            },
        );
        return res.ok;
    } catch {
        return false;
    }
};

const postBackendReset = async () => {
    try {
        const res = await fetch(getApiUrl('/api/me/tutorials/reset'), {
            method: 'POST',
            credentials: 'include',
            headers: { 'Accept': 'application/json' },
        });
        return res.ok;
    } catch {
        return false;
    }
};

/* ============================================================ */

export const TourProvider = ({ children }) => {
    const { user } = useAuth();
    const location = useLocation();

    /* `completed` arranca con el contenido de localStorage; cuando hay user
       logueado se sobrescribe con la fuente autoritativa (backend). */
    const [completed, setCompleted] = useState(() => readLocal());
    const [currentTour, setCurrentTour] = useState(null);

    /* Banderas para no relanzar auto-start o sync múltiples veces. */
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

            if (backend === null) {
                /* Backend no disponible → seguimos con localStorage. */
                return;
            }

            /* Unión backend + local: si algún ID está en local pero no en
               backend (ej. usuario que vino de la fase 1 o trabajó offline),
               lo subimos para que el backend converja. */
            const local = readLocal();
            const merged = Array.from(new Set([...backend, ...local]));
            const missing = local.filter(id => !backend.includes(id));

            setCompleted(merged);
            writeLocal(merged);

            /* Sube en background cualquier ID local que el backend no tuviera. */
            for (const id of missing) {
                postBackendComplete(id);
            }
        })();

        return () => { cancelled = true; };
    }, [user]);

    /* ---------- Reset cuando el usuario hace logout ---------- */
    useEffect(() => {
        if (!user) {
            lastSyncedUserId.current = null;
            setAutoStartChecked(false);
            setCurrentTour(null);
        }
    }, [user]);

    /* ---------- API pública del context ---------- */

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
                /* Optimistic update: marcamos local + state al instante
                   para que el menú de Ayuda refleje el cambio. */
                setCompleted(curr => {
                    if (curr.includes(id)) return curr;
                    const next = [...curr, id];
                    writeLocal(next);
                    return next;
                });
                /* Persistencia backend en background — fallo silencioso,
                   localStorage queda como fallback. */
                if (user) postBackendComplete(id);
            }
            return null;
        });
    }, [user]);

    const resetTours = useCallback(async () => {
        setCompleted([]);
        writeLocal([]);
        if (user) await postBackendReset();
        /* Permite que un nuevo auto-start se dispare tras reset. */
        setAutoStartChecked(false);
    }, [user]);

    /* ---------- tours filtrados por rol del usuario actual ---------- */

    const availableTours = useMemo(() => {
        if (!user) return [];
        return tourRegistry.filter(t => userMatchesRoles(user, t.roles));
    }, [user]);

    /* ---------- auto-start del primer tour pendiente ----------
       Se ejecuta una sola vez por sesión (autoStartChecked), tras la
       sincronización con backend (lastSyncedUserId.current === user.id). */
    useEffect(() => {
        if (!user || autoStartChecked) return;
        if (lastSyncedUserId.current !== user.id) return; // espera al sync

        const candidate = availableTours.find(
            t => t.isAutoStart && !completed.includes(t.id),
        );
        if (candidate) {
            /* Pequeño delay para dar tiempo al DOM (Sidebar, Header) a
               montarse antes de que Joyride busque sus targets. */
            const timer = setTimeout(() => setCurrentTour(candidate), 700);
            setAutoStartChecked(true);
            return () => clearTimeout(timer);
        }
        setAutoStartChecked(true);
    }, [user, availableTours, completed, autoStartChecked]);

    /* ---------- value memoizado ---------- */

    const value = useMemo(() => ({
        currentTour,
        availableTours,
        completed,
        startTour,
        finishTour,
        isCompleted,
        resetTours,
        location,
    }), [currentTour, availableTours, completed, startTour, finishTour, isCompleted, resetTours, location]);

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
