import React, {
    createContext,
    useCallback,
    useContext,
    useEffect,
    useMemo,
    useState,
} from 'react';
import { useLocation } from 'react-router-dom';
import { tourRegistry } from '../tours';
import { useAuth } from './AuthContext';

const STORAGE_KEY = 'loggex.tours.completed';
const TourContext = createContext(null);

/* ---------- helpers de persistencia (localStorage) ---------- */

const readCompleted = () => {
    try {
        const raw = localStorage.getItem(STORAGE_KEY);
        if (!raw) return [];
        const parsed = JSON.parse(raw);
        return Array.isArray(parsed) ? parsed : [];
    } catch {
        return [];
    }
};

const writeCompleted = (list) => {
    try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(list));
    } catch {
        /* localStorage lleno o no disponible — fallamos silenciosamente */
    }
};

/* ---------- helpers de roles ---------- */

const userMatchesRoles = (user, allowedRoles) => {
    if (!user || !Array.isArray(allowedRoles) || allowedRoles.length === 0) {
        return false;
    }
    const userRoles = user.roles || [];
    return allowedRoles.some(r => userRoles.includes(r));
};

/* ============================================================ */

export const TourProvider = ({ children }) => {
    const { user } = useAuth();
    const location = useLocation();

    /* `completed` se mantiene en estado para que los componentes que consumen
       `isCompleted` se re-rendericen cuando se marca uno nuevo (vs. leer
       localStorage cada vez, que no dispara re-render). */
    const [completed, setCompleted] = useState(() => readCompleted());
    const [currentTour, setCurrentTour] = useState(null);
    /* Bandera para no relanzar auto-start múltiples veces en el mismo ciclo
       de vida de la sesión (ej. si el usuario navega entre páginas). */
    const [autoStartChecked, setAutoStartChecked] = useState(false);

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
                /* Tanto los completados como los explícitamente saltados se
                   marcan, así no vuelven a salir como auto-start. El menú
                   de Ayuda los listará para re-lanzarlos a demanda. */
                setCompleted(curr => {
                    if (curr.includes(prev.id)) return curr;
                    const next = [...curr, prev.id];
                    writeCompleted(next);
                    return next;
                });
            }
            return null;
        });
    }, []);

    const resetTours = useCallback(() => {
        /* Útil para QA / desarrollo: borra el progreso local. Expuesto en
           el menú Ayuda como "Reiniciar tutoriales". */
        setCompleted([]);
        writeCompleted([]);
    }, []);

    /* ---------- tours filtrados por rol del usuario actual ---------- */

    const availableTours = useMemo(() => {
        if (!user) return [];
        return tourRegistry.filter(t => userMatchesRoles(user, t.roles));
    }, [user]);

    /* ---------- auto-start del primer tour pendiente ----------
       Se ejecuta una sola vez por montaje del provider, cuando hay user
       autenticado y al menos un tour `isAutoStart` aún no completado. */
    useEffect(() => {
        if (!user || autoStartChecked) return;

        const candidate = availableTours.find(
            t => t.isAutoStart && !completed.includes(t.id),
        );
        if (candidate) {
            /* Pequeño delay para dar tiempo al DOM (Sidebar, Header) a
               montarse antes de que Joyride busque sus targets. */
            const timer = setTimeout(() => {
                setCurrentTour(candidate);
            }, 600);
            setAutoStartChecked(true);
            return () => clearTimeout(timer);
        }
        setAutoStartChecked(true);
    }, [user, availableTours, completed, autoStartChecked]);

    /* Si el usuario hace logout, se reinicia el flag para que la próxima
       sesión vuelva a comprobar auto-start. */
    useEffect(() => {
        if (!user) {
            setAutoStartChecked(false);
            setCurrentTour(null);
        }
    }, [user]);

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
