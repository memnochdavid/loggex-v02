import { useCallback, useEffect, useRef, useState } from 'react';
import useMercure from './useMercure';

/**
 * Mantiene una colección REST sincronizada en tiempo real vía Mercure.
 *
 *  1. Fetch inicial al endpoint indicado.
 *  2. Suscripción a los topics Mercure.
 *  3. Cuando llega un evento (persist/update/remove/invalidate del topic),
 *     refetch debounced para colapsar ráfagas.
 *
 * No mantiene la colección normalizada por id ni intenta reducer optimista —
 * el endpoint REST es la fuente de verdad. Esto evita inconsistencias por
 * filtros, ordenación o seguridad por centro hechas en el backend.
 *
 * Uso típico:
 *   const { items, loading, error, refetch } = useLiveCollection({
 *     endpoint: getApiUrl('/api/comunicados?order[createdAt]=desc'),
 *     topics: [`/centros/${centroId}/comunicados`],
 *   });
 *
 * Se puede observar el evento crudo con `onEvent` para reaccionar a tipos
 * concretos (p.ej. mostrar un toast "nuevo comunicado disponible") en
 * paralelo al refetch automático.
 */
export default function useLiveCollection({
    endpoint,
    topics,
    parseItems = defaultParseItems,
    parseTotal = defaultParseTotal,
    headers = DEFAULT_HEADERS,
    enabled = true,
    debounceMs = 200,
    onEvent,
} = {}) {
    const [items, setItems] = useState([]);
    const [total, setTotal] = useState(0);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    const debounceRef = useRef(null);
    const inFlightRef = useRef(0);
    const onEventRef = useRef(onEvent);
    onEventRef.current = onEvent;
    // Callbacks/headers en refs para que llamadas con arrow inline (identidad
    // nueva cada render) NO invaliden la identidad de fetchOnce y disparen
    // un loop de fetch + setLoading.
    const parseItemsRef = useRef(parseItems);
    parseItemsRef.current = parseItems;
    const parseTotalRef = useRef(parseTotal);
    parseTotalRef.current = parseTotal;
    const headersRef = useRef(headers);
    headersRef.current = headers;

    const fetchOnce = useCallback(async () => {
        if (!endpoint || !enabled) return;
        const myToken = ++inFlightRef.current;
        try {
            const res = await fetch(endpoint, { headers: headersRef.current, credentials: 'include' });
            if (!res.ok) throw new Error(`${res.status} ${res.statusText}`);
            const data = await res.json();
            // Si llegó otra petición posterior, descartar este resultado.
            if (myToken !== inFlightRef.current) return;
            setItems(parseItemsRef.current(data));
            setTotal(parseTotalRef.current(data));
            setError(null);
        } catch (err) {
            if (myToken !== inFlightRef.current) return;
            setError(err);
        } finally {
            if (myToken === inFlightRef.current) setLoading(false);
        }
    }, [endpoint, enabled]);

    useEffect(() => {
        if (!enabled) return;
        setLoading(true);
        fetchOnce();
    }, [endpoint, enabled, fetchOnce]);

    const scheduleRefetch = useCallback(() => {
        if (debounceRef.current) clearTimeout(debounceRef.current);
        debounceRef.current = setTimeout(() => {
            debounceRef.current = null;
            fetchOnce();
        }, debounceMs);
    }, [fetchOnce, debounceMs]);

    useEffect(() => () => {
        if (debounceRef.current) clearTimeout(debounceRef.current);
    }, []);

    useMercure(enabled ? topics : null, (evt) => {
        onEventRef.current?.(evt);
        scheduleRefetch();
    });

    return { items, total, loading, error, refetch: fetchOnce };
}

const DEFAULT_HEADERS = { Accept: 'application/ld+json' };

function defaultParseItems(data) {
    if (Array.isArray(data)) return data;
    return data?.['hydra:member'] || data?.member || [];
}

function defaultParseTotal(data) {
    return data?.['hydra:totalItems'] ?? data?.totalItems ?? 0;
}
