import { useEffect, useRef } from 'react';
import { useAuth } from '../context/AuthContext';
import { getApiUrl } from '../config/api';

/**
 * Suscripción SSE al hub Mercure.
 *
 * Estrategia:
 *  1. Al montar, garantiza que existe la cookie `mercureAuthorization` (POST a
 *     /api/me/mercure-subscribe). El backend firma un JWT con los topics del
 *     usuario y devuelve la URL pública del hub.
 *  2. Abre un EventSource a esa URL con los topics pasados como parámetro.
 *  3. Cada mensaje SSE se parsea como JSON y se pasa a `onEvent`.
 *  4. Al desmontar o cambiar de usuario, cierra la conexión.
 *
 * El EventSource reconecta automáticamente con backoff si se corta la red.
 *
 * Uso:
 *   useMercure([`/users/${userId}/messages`], (evt) => {
 *     if (evt.type === 'new_message') ...
 *   });
 */

// Cache por userId de la promesa de suscripción y la URL del hub. Así múltiples
// componentes que usen useMercure en paralelo solo disparan un POST.
const subscriptionCache = new Map(); // userId -> Promise<{ hubPublicUrl, topics }>

function ensureSubscription(userId) {
    if (subscriptionCache.has(userId)) {
        return subscriptionCache.get(userId);
    }
    const promise = fetch(getApiUrl('/api/me/mercure-subscribe'), {
        method: 'POST',
        credentials: 'include',
        headers: { Accept: 'application/json' },
    })
        .then(async (res) => {
            if (!res.ok) throw new Error(`mercure-subscribe ${res.status}`);
            return res.json();
        })
        .catch((err) => {
            // Invalida cache para permitir reintento en el próximo uso.
            subscriptionCache.delete(userId);
            throw err;
        });
    subscriptionCache.set(userId, promise);
    return promise;
}

export function resetMercureSubscription() {
    subscriptionCache.clear();
}

export default function useMercure(topics, onEvent) {
    const { user } = useAuth();
    const callbackRef = useRef(onEvent);
    callbackRef.current = onEvent;

    // Serializamos topics para usar como dependencia estable del effect.
    const topicsKey = Array.isArray(topics) ? topics.join('|') : '';

    useEffect(() => {
        if (!user?.id || !topicsKey) return undefined;

        let cancelled = false;
        let source = null;

        ensureSubscription(user.id)
            .then(({ hubPublicUrl }) => {
                if (cancelled || !hubPublicUrl) return;

                const url = new URL(hubPublicUrl);
                topicsKey.split('|').forEach((t) => url.searchParams.append('topic', t));

                source = new EventSource(url, { withCredentials: true });

                source.addEventListener('message', (e) => {
                    try {
                        const parsed = JSON.parse(e.data);
                        callbackRef.current?.(parsed);
                    } catch {
                        // eventos no-JSON: los ignoramos
                    }
                });

                source.addEventListener('error', () => {
                    // EventSource reconecta solo; solo loggeamos.
                    // eslint-disable-next-line no-console
                    console.warn('[mercure] conexión perdida, reconectando…');
                });
            })
            .catch((err) => {
                // eslint-disable-next-line no-console
                console.warn('[mercure] suscripción fallida:', err?.message || err);
            });

        return () => {
            cancelled = true;
            if (source) source.close();
        };
    }, [user?.id, topicsKey]);
}
