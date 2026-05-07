import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
    Award, Edit3, BookOpen, Inbox, Megaphone, AlertTriangle, Bell as BellIcon,
    Shuffle, Check, X as XIcon, UserCheck, CalendarOff, ArrowLeftRight,
} from 'lucide-react';
import { getApiUrl } from '../config/api';
import { useAuth } from '../context/AuthContext';
import useMercure from '../hooks/useMercure';
import sharedStyles from './NotificationList.module.css';
import styles from './SystemNotificationsList.module.css';
import { useTranslation } from 'react-i18next';

/**
 * Lista de notificaciones del sistema (campanita del header).
 *
 * Difiere de `NotificationList` (mensajes inter-personales) en:
 *  - Endpoint: `/api/notificacions` (no `/api/mensajes`).
 *  - Filtra eventos Mercure por `entity === 'Notificacion'` para coexistir
 *    con los eventos de mensajes en el mismo topic `/users/{id}/notifications`.
 *  - Renderiza icono por tipo + título + cuerpo traducidos vía i18n
 *    (`notifications.types.{tipo}.{title|body}` interpolando `payload`).
 *  - Click → navega a `enlace` y marca como leída (PATCH leida=true).
 *  - Footer: "Marcar todas como leídas" (POST endpoint custom idempotente).
 *
 * Sin endpoint duplicado de "ver todas" — la campanita ES la vista; no hay
 * página de notificaciones del sistema separada (a diferencia de mensajes).
 */
const SystemNotificationsList = ({
    title,
    onUnreadCountChange,
    onItemClick,
    limit = 5,
    showUnreadCountInHeader = false,
    hideHeader = false,
}) => {
    const { t } = useTranslation();
    const { user } = useAuth();
    const [notifs, setNotifs] = useState([]);
    const [totalUnreadCount, setTotalUnreadCount] = useState(0);
    const [loading, setLoading] = useState(true);
    const [errored, setErrored] = useState(false);

    const fetchNotifs = useCallback(async () => {
        if (!user?.id) return;
        try {
            // Sin pagination=false: solo necesitamos las N primeras + el conteo
            // de no-leídas en el header. La paginación API Platform añade
            // `hydra:totalItems` que aprovecharíamos, pero al no estar
            // garantizado en todos los formatos, contamos manualmente con
            // un GET aparte de no-leídas total.
            const url = `/api/notificacions?order[fechaCreacion]=desc&itemsPerPage=${limit}`;
            const response = await fetch(getApiUrl(url), {
                headers: { Accept: 'application/ld+json' },
                credentials: 'include',
            });
            if (!response.ok) {
                throw new Error(`HTTP ${response.status}`);
            }
            const data = await response.json();
            const items = data['hydra:member'] || data.member || [];
            setNotifs(items);

            // Conteo de no-leídas (puede haber > limit). 1 GET ligero con itemsPerPage=1.
            const countUrl = `/api/notificacions?leida=false&itemsPerPage=1`;
            const countResp = await fetch(getApiUrl(countUrl), {
                headers: { Accept: 'application/ld+json' },
                credentials: 'include',
            });
            let unread = 0;
            if (countResp.ok) {
                const countData = await countResp.json();
                unread = countData['hydra:totalItems'] ?? countData.totalItems ?? items.filter(n => !n.leida).length;
            } else {
                unread = items.filter(n => !n.leida).length;
            }
            setTotalUnreadCount(unread);
            onUnreadCountChange?.(unread);
            setErrored(false);
        } catch (err) {
            // eslint-disable-next-line no-console
            console.error('[SystemNotificationsList] fetch fallido:', err);
            setErrored(true);
        } finally {
            setLoading(false);
        }
    }, [user?.id, limit, onUnreadCountChange]);

    useEffect(() => { fetchNotifs(); }, [fetchNotifs]);

    // Mismo topic que mensajes — filtramos por entidad para no refetch en cada
    // mensaje nuevo (ese caso lo cubre `NotificationList`).
    useMercure(
        user?.id ? [`/users/${user.id}/notifications`] : [],
        useCallback((event) => {
            if (event?.entity === 'Notificacion') {
                fetchNotifs();
            }
        }, [fetchNotifs])
    );

    const markAsRead = useCallback(async (notif) => {
        if (notif.leida) return;
        try {
            await fetch(getApiUrl(`/api/notificacions/${notif.id}`), {
                method: 'PATCH',
                credentials: 'include',
                headers: {
                    'Content-Type': 'application/merge-patch+json',
                    Accept: 'application/ld+json',
                },
                body: JSON.stringify({ leida: true }),
            });
            // Optimistic local update; el refetch via Mercure llegará después.
            setNotifs(prev => prev.map(n => n.id === notif.id ? { ...n, leida: true } : n));
            setTotalUnreadCount(c => Math.max(0, c - 1));
            onUnreadCountChange?.(Math.max(0, totalUnreadCount - 1));
        } catch (err) {
            // eslint-disable-next-line no-console
            console.error('[SystemNotificationsList] mark-read fallido:', err);
        }
    }, [onUnreadCountChange, totalUnreadCount]);

    const markAllRead = useCallback(async () => {
        try {
            await fetch(getApiUrl('/api/notificacions/marcar-todas-leidas'), {
                method: 'POST',
                credentials: 'include',
                headers: { Accept: 'application/json' },
            });
            setNotifs(prev => prev.map(n => ({ ...n, leida: true })));
            setTotalUnreadCount(0);
            onUnreadCountChange?.(0);
        } catch (err) {
            // eslint-disable-next-line no-console
            console.error('[SystemNotificationsList] mark-all-read fallido:', err);
        }
    }, [onUnreadCountChange]);

    const handleItemClick = (notif) => {
        markAsRead(notif);
        onItemClick?.(notif);
    };

    if (loading && notifs.length === 0) {
        return (
            <div className={sharedStyles.listContainer}>
                {!hideHeader && title && (
                    <div className={sharedStyles.widgetHeader}>
                        <h3 className={sharedStyles.widgetTitle}>{title}</h3>
                    </div>
                )}
                <div className={sharedStyles.loading}>{t('notifications.loading')}</div>
            </div>
        );
    }

    if (errored && notifs.length === 0) {
        return (
            <div className={sharedStyles.listContainer}>
                {!hideHeader && title && (
                    <div className={sharedStyles.widgetHeader}>
                        <h3 className={sharedStyles.widgetTitle}>{title}</h3>
                    </div>
                )}
                <div className={sharedStyles.emptyState}>{t('notifications.errorLoad')}</div>
            </div>
        );
    }

    return (
        <div className={sharedStyles.listContainer}>
            {!hideHeader && title && (
                <div className={sharedStyles.widgetHeader}>
                    <h3 className={sharedStyles.widgetTitle}>{title}</h3>
                    {showUnreadCountInHeader && totalUnreadCount > 0 && (
                        <span className={sharedStyles.unreadCountBadge}>
                            {totalUnreadCount} {t('notifications.unread')}
                        </span>
                    )}
                </div>
            )}

            {notifs.length === 0 ? (
                <div className={sharedStyles.emptyState}>{t('notifications.empty')}</div>
            ) : (
                <ul className={sharedStyles.list}>
                    {notifs.map((n) => (
                        <NotifItem
                            key={n.id}
                            notif={n}
                            onClick={() => handleItemClick(n)}
                            sharedStyles={sharedStyles}
                            styles={styles}
                            t={t}
                        />
                    ))}
                </ul>
            )}

            {totalUnreadCount > 0 && (
                <div className={sharedStyles.widgetFooter}>
                    <button
                        className={sharedStyles.viewAllLink}
                        onClick={markAllRead}
                        type="button"
                    >
                        {t('notifications.markAllRead')}
                    </button>
                </div>
            )}
        </div>
    );
};

/* ─────────────────────────────────────────────────────────────────────── */

const TYPE_ICONS = {
    calificacion_publicada: Award,
    calificacion_actualizada: Edit3,
    tarea_nueva: BookOpen,
    comunicado_nuevo: Megaphone,
    entrega_recibida: Inbox,
    tarea_vencida_sin_entrega: AlertTriangle,
    excepcion_pendiente: Shuffle,
    excepcion_aprobada: Check,
    excepcion_rechazada: XIcon,
    sustitucion_asignada: UserCheck,
    clase_cancelada: CalendarOff,
    clase_trasladada: ArrowLeftRight,
};

const NotifItem = ({ notif, onClick, sharedStyles, styles, t }) => {
    const Icon = TYPE_ICONS[notif.tipo] || BellIcon;

    // Título y cuerpo traducidos vía clave + payload. Si no existe la clave
    // (tipo desconocido), fallback al titulo/mensaje persistido en BD.
    const titleKey = `notifications.types.${notif.tipo}.title`;
    const bodyKey = `notifications.types.${notif.tipo}.body`;
    const payload = notif.payload || {};
    const translatedTitle = t(titleKey, { defaultValue: notif.titulo, ...payload });
    const translatedBody = t(bodyKey, { defaultValue: notif.mensaje || '', ...payload });

    const relativeTime = useRelativeTime(notif.fechaCreacion, t);

    return (
        <li className={`${sharedStyles.listItem} ${notif.leida ? styles.read : styles.unread}`}>
            <button className={sharedStyles.itemButton} onClick={onClick} type="button">
                <div className={`${sharedStyles.itemAvatarPlaceholder} ${styles.iconWrap}`}>
                    <Icon size={20} aria-hidden="true" />
                </div>
                <div className={sharedStyles.itemContent}>
                    <div className={sharedStyles.itemHeader}>
                        <span className={sharedStyles.itemName}>{translatedTitle}</span>
                        {!notif.leida && <span className={styles.unreadDot} aria-hidden="true" />}
                    </div>
                    <span className={`${sharedStyles.itemMessage} ${notif.leida ? sharedStyles.readMessage : ''}`}>
                        {translatedBody}
                    </span>
                    <div className={sharedStyles.itemMeta}>
                        <span className={sharedStyles.itemTime}>{relativeTime}</span>
                    </div>
                </div>
            </button>
        </li>
    );
};

/**
 * Tiempo relativo abreviado uniforme entre los 5 idiomas (decisión D7 en
 * `docs/hoja-de-ruta-notificaciones.md` — sin pluralización por simplicidad).
 *
 * Re-evalúa cada minuto mientras el componente está montado.
 */
function useRelativeTime(isoString, t) {
    const [, setTick] = useState(0);

    useEffect(() => {
        const id = setInterval(() => setTick(x => x + 1), 60_000);
        return () => clearInterval(id);
    }, []);

    return useMemo(() => {
        if (!isoString) return '';
        const then = new Date(isoString).getTime();
        const now = Date.now();
        const diffMin = Math.max(0, Math.floor((now - then) / 60_000));
        if (diffMin < 1) return t('notifications.justNow');
        if (diffMin < 60) return t('notifications.minutesAgo', { count: diffMin });
        const diffH = Math.floor(diffMin / 60);
        if (diffH < 24) return t('notifications.hoursAgo', { count: diffH });
        const diffD = Math.floor(diffH / 24);
        return t('notifications.daysAgo', { count: diffD });
    }, [isoString, t]);
}

export default SystemNotificationsList;
