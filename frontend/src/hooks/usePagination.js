import { useState } from 'react';

const STORAGE_KEY = 'itemsPerPageGlobal';

/**
 * Hook compartido para el tamaño de página de las tablas CRUD.
 * Persiste en localStorage bajo una única clave global, así todas las vistas
 * comparten el mismo valor y se evitan discrepancias entre tablas.
 *
 * @param {string} [_viewName] - Mantenido por compatibilidad con los call sites
 *                               existentes; ya no se usa para distinguir vistas.
 * @param {number} [defaultFallback=20] - Valor por defecto si no hay nada en localStorage.
 */
export const usePagination = (_viewName, defaultFallback = 20) => {
    const readFromStorage = () => {
        if (typeof window === 'undefined') return defaultFallback;
        const raw = window.localStorage.getItem(STORAGE_KEY);
        const parsed = Number(raw);
        return Number.isFinite(parsed) && parsed > 0 ? parsed : defaultFallback;
    };

    const [itemsPerPage, setItemsPerPage] = useState(readFromStorage);

    const setAndPersist = (value) => {
        const numeric = Number(value);
        if (!Number.isFinite(numeric) || numeric <= 0) return;
        setItemsPerPage(numeric);
        if (typeof window !== 'undefined') {
            window.localStorage.setItem(STORAGE_KEY, String(numeric));
        }
    };

    return [itemsPerPage, setAndPersist];
};
