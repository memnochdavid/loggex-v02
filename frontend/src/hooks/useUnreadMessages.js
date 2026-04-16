import { useEffect, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { getApiUrl } from '../config/api';

/**
 * Devuelve el número de mensajes no leídos del usuario actual.
 * Pollea cada `intervalMs` ms (default 30 s) y se desuscribe al desmontar.
 */
export default function useUnreadMessages(intervalMs = 30000) {
    const { user } = useAuth();
    const [count, setCount] = useState(0);

    useEffect(() => {
        if (!user?.id) return;
        let cancelled = false;

        const fetchCount = async () => {
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
                if (!cancelled) setCount(items.length);
            } catch { /* silencio */ }
        };

        fetchCount();
        const id = setInterval(fetchCount, intervalMs);
        return () => { cancelled = true; clearInterval(id); };
    }, [user?.id, intervalMs]);

    return count;
}
