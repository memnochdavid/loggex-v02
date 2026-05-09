import { useEffect, useRef, useState, useCallback } from 'react';

/**
 * Hook de cierre de sesión por inactividad.
 *
 * Escucha eventos de actividad (mousemove, keydown, click, scroll, touchstart)
 * con throttle para no resetear el timer en cada pixel de movimiento. Cuando
 * `enabled` es true:
 *   - A los `warningMs` ms sin actividad → estado `warning = true` (la UI
 *     muestra el modal con countdown).
 *   - A los `idleMs` ms sin actividad (warningMs + ventana de gracia) →
 *     `expired = true` y se invoca `onExpire()`.
 *   - Cualquier interacción durante el warning lo cancela y resetea el timer.
 *   - El consumidor puede llamar `extend()` para reset manual (útil al pulsar
 *     "Seguir sesión" en el modal, que también pinga al backend).
 *
 * No toca el backend ni los JWT — el TTL del lado servidor (1h por default
 * de LexikJWT) se mantiene como red de seguridad. Este hook solo cubre el
 * caso "el usuario se va a tomar un café y la sesión queda abierta".
 *
 * @param {object} options
 * @param {boolean} options.enabled - Si el timer debe estar activo (típicamente `!!user`).
 * @param {number} [options.idleMs=1800000] - Total ms hasta logout. Default 30 min.
 * @param {number} [options.warningOffsetMs=120000] - Ms antes del logout en los que se dispara el warning. Default 2 min (warning a los 28 min de inactividad si idleMs=30 min).
 * @param {function} options.onExpire - Callback cuando expira (logout).
 * @returns {{ warning: boolean, secondsLeft: number, extend: function, dismiss: function }}
 *   - `warning`: true durante la ventana de aviso.
 *   - `secondsLeft`: segundos restantes hasta el logout (solo válido si warning=true).
 *   - `extend`: reset manual del timer + cierra el warning.
 *   - `dismiss`: cierra el warning sin resetear (no usado típicamente).
 */
const ACTIVITY_EVENTS = ['mousemove', 'keydown', 'click', 'scroll', 'touchstart'];
const ACTIVITY_THROTTLE_MS = 5000;

export function useIdleTimeout({
    enabled,
    idleMs = 30 * 60 * 1000,
    warningOffsetMs = 2 * 60 * 1000,
    onExpire,
}) {
    const [warning, setWarning] = useState(false);
    const [secondsLeft, setSecondsLeft] = useState(Math.floor(warningOffsetMs / 1000));

    const lastActivityRef = useRef(Date.now());
    const warningTimerRef = useRef(null);
    const expireTimerRef = useRef(null);
    const countdownRef = useRef(null);
    const onExpireRef = useRef(onExpire);

    useEffect(() => {
        onExpireRef.current = onExpire;
    }, [onExpire]);

    const clearTimers = useCallback(() => {
        if (warningTimerRef.current) clearTimeout(warningTimerRef.current);
        if (expireTimerRef.current) clearTimeout(expireTimerRef.current);
        if (countdownRef.current) clearInterval(countdownRef.current);
        warningTimerRef.current = null;
        expireTimerRef.current = null;
        countdownRef.current = null;
    }, []);

    const scheduleTimers = useCallback(() => {
        clearTimers();
        const warnAt = idleMs - warningOffsetMs;
        warningTimerRef.current = setTimeout(() => {
            // Entra ventana de warning: arranca countdown 1Hz y modal.
            setSecondsLeft(Math.floor(warningOffsetMs / 1000));
            setWarning(true);
            countdownRef.current = setInterval(() => {
                setSecondsLeft(prev => Math.max(0, prev - 1));
            }, 1000);
        }, warnAt);
        expireTimerRef.current = setTimeout(() => {
            clearTimers();
            setWarning(false);
            if (typeof onExpireRef.current === 'function') {
                onExpireRef.current();
            }
        }, idleMs);
    }, [clearTimers, idleMs, warningOffsetMs]);

    const reset = useCallback(() => {
        lastActivityRef.current = Date.now();
        setWarning(false);
        scheduleTimers();
    }, [scheduleTimers]);

    const extend = useCallback(() => {
        reset();
    }, [reset]);

    const dismiss = useCallback(() => {
        setWarning(false);
    }, []);

    // Listeners de actividad — throttled para no provocar re-render por
    // cada pixel del mouse. El último timestamp guarda cuándo procesamos
    // el último evento; ignoramos los siguientes durante el throttle.
    useEffect(() => {
        if (!enabled) {
            clearTimers();
            setWarning(false);
            return undefined;
        }
        scheduleTimers();

        const handler = () => {
            const now = Date.now();
            if (now - lastActivityRef.current < ACTIVITY_THROTTLE_MS) return;
            // Si está la ventana de warning abierta, NO resetear automáticamente:
            // queremos que el usuario decida explícitamente (botón "Seguir") para
            // evitar que un mouse-over accidental tras irse de la mesa lo
            // mantenga logueado.
            if (warning) return;
            lastActivityRef.current = now;
            scheduleTimers();
        };

        ACTIVITY_EVENTS.forEach(ev => window.addEventListener(ev, handler, { passive: true }));
        return () => {
            ACTIVITY_EVENTS.forEach(ev => window.removeEventListener(ev, handler));
            clearTimers();
        };
    }, [enabled, scheduleTimers, clearTimers, warning]);

    return { warning, secondsLeft, extend, dismiss };
}
