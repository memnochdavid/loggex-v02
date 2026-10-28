import { useState, useEffect, useCallback } from 'react';

const KEY_PREFIX = 'dataTableHiddenCols_';

/**
 * Persiste el conjunto de IDs de columna ocultas por tableId en localStorage.
 * Si la lista de columnas existentes cambia (rename/eliminación), depura los
 * IDs huérfanos del set persistido para que no queden ocultando algo que ya
 * no existe.
 *
 * @param {string|null} tableId — Clave estable de la tabla. Si es falsy, el
 *   hook devuelve estado vacío y no persiste (la feature no aplica).
 * @param {string[]} allColumnIds — IDs de columnas actualmente en el render.
 *   Se usa solo para sanitizar el set persistido.
 */
export const useColumnVisibility = (tableId, allColumnIds = []) => {
    const storageKey = tableId ? `${KEY_PREFIX}${tableId}` : null;

    const readFromStorage = () => {
        if (!storageKey || typeof window === 'undefined') return [];
        try {
            const raw = window.localStorage.getItem(storageKey);
            if (!raw) return [];
            const parsed = JSON.parse(raw);
            return Array.isArray(parsed) ? parsed.filter(x => typeof x === 'string') : [];
        } catch {
            return [];
        }
    };

    const [hiddenIds, setHiddenIds] = useState(readFromStorage);

    const allKey = allColumnIds.join('|');
    useEffect(() => {
        if (!storageKey || allColumnIds.length === 0) return;
        setHiddenIds(prev => {
            const valid = prev.filter(id => allColumnIds.includes(id));
            if (valid.length === prev.length) return prev;
            try { window.localStorage.setItem(storageKey, JSON.stringify(valid)); } catch {}
            return valid;
        });
    }, [storageKey, allKey]); // eslint-disable-line react-hooks/exhaustive-deps

    const toggle = useCallback((id) => {
        setHiddenIds(prev => {
            const next = prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id];
            if (storageKey) {
                try { window.localStorage.setItem(storageKey, JSON.stringify(next)); } catch {}
            }
            return next;
        });
    }, [storageKey]);

    const reset = useCallback(() => {
        setHiddenIds([]);
        if (storageKey) {
            try { window.localStorage.removeItem(storageKey); } catch {}
        }
    }, [storageKey]);

    return [hiddenIds, toggle, reset];
};
