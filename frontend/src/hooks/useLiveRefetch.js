import { useEffect, useRef } from 'react';
import useMercure from './useMercure';

/**
 * Versión ligera de `useLiveCollection` para páginas CRUD complejas que ya
 * tienen su propia lógica de fetch (paginación, filtros, search debouncing,
 * AbortController, etc.). En vez de reemplazar el fetch, esta hook solo:
 *
 *  1. Suscribe a los `topics` Mercure indicados.
 *  2. Cuando llega un evento, invoca `refetchFn` (debounced para colapsar ráfagas).
 *
 * `refetchFn` se mantiene en una ref para que pueda cerrar sobre el state /
 * params actuales sin reiniciar la suscripción cada render.
 *
 * Uso:
 *   useLiveRefetch(
 *     [`/admin/centros/${centroId}/imparticiones`],
 *     () => fetchImparticiones({ page, search, ... })
 *   );
 */
export default function useLiveRefetch(topics, refetchFn, { debounceMs = 200, enabled = true } = {}) {
    const refetchRef = useRef(refetchFn);
    refetchRef.current = refetchFn;

    const debounceRef = useRef(null);

    useEffect(() => () => {
        if (debounceRef.current) clearTimeout(debounceRef.current);
    }, []);

    useMercure(enabled ? topics : null, () => {
        if (debounceRef.current) clearTimeout(debounceRef.current);
        debounceRef.current = setTimeout(() => {
            debounceRef.current = null;
            refetchRef.current?.();
        }, debounceMs);
    });
}
