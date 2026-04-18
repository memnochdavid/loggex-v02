import { useCallback, useEffect, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { getApiUrl } from '../config/api';
import useMercure from './useMercure';

/**
 * Devuelve el número de mensajes no leídos del usuario actual.
 *
 * - Carga inicial vía GET /api/mensajes?leido=false (1 sola vez por sesión/montaje).
 * - Actualizaciones en tiempo real vía Mercure: incrementa al recibir new_message
 *   y refetch al recibir message_read (puede bajar el contador).
 */
export default function useUnreadMessages() {
    const { user } = useAuth();
    const [count, setCount] = useState(0);

    const fetchCount = useCallback(async () => {
        if (!user?.id) return;
        try {
            const url = getApiUrl(
                `/api/mensajes?destinatario=/api/users/${user.id}&leido=false&pagination=false`
            );
            const res = await fetch(url, {
                headers: { Accept: 'application/ld+json' },
                credentials: 'include',
            });
            if (!res.ok) return;
            const data = await res.json();
            const items = data['hydra:member'] || data.member || [];
            setCount(items.length);
        } catch { /* silencio */ }
    }, [user?.id]);

    useEffect(() => { fetchCount(); }, [fetchCount]);

    useMercure(
        user?.id ? [`/users/${user.id}/notifications`] : [],
        useCallback((event) => {
            if (event?.type === 'new_message') {
                setCount((c) => c + 1);
            } else if (event?.type === 'message_read') {
                // Refetch: no sabemos cuántos quedan realmente (pueden marcarse varios a la vez).
                fetchCount();
            }
        }, [fetchCount])
    );

    return count;
}
