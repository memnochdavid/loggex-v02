import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
    Award, Edit3, BookOpen, Inbox, Megaphone, AlertTriangle, Bell as BellIcon,
    Shuffle, Check, X as XIcon, UserCheck, CalendarOff, ArrowLeftRight, HelpCircle,
    Maximize2, Minimize2, Trash2,
} from 'lucide-react';
import { getApiUrl } from '../config/api';
import { useAuth } from '../context/AuthContext';
import { useConfirm } from '../context/ConfirmContext';
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
    expanded = false,
    onToggleExpand = null,
}) => {
    const { t } = useTranslation();
    const { user } = useAuth();
    const confirm = useConfirm();
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

    // Limpia (HARD-delete) todas las notificaciones del usuario. Confirm
    // explícito: aunque sea hard-delete sobre datos no críticos (el evento
    // original persiste en su entidad), perder el aviso visualmente puede
    // confundir si fue accidental.
    const clearAll = useCallback(async () => {
        const ok = await confirm({
            title: t('notifications.clearAllTitle', { defaultValue: 'Limpiar todas las notificaciones' }),
            body: t('notifications.confirmClearAll', { defaultValue: '¿Eliminar todas las notificaciones de tu bandeja? Esta acción no se puede deshacer.' }),
        });
        if (!ok) return;
        try {
            await fetch(getApiUrl('/api/notificacions/limpiar-todas'), {
                method: 'POST',
                credentials: 'include',
                headers: { Accept: 'application/json' },
            });
            setNotifs([]);
            setTotalUnreadCount(0);
            onUnreadCountChange?.(0);
        } catch (err) {
            // eslint-disable-next-line no-console
            console.error('[SystemNotificationsList] clear-all fallido:', err);
        }
    }, [confirm, t, onUnreadCountChange]);

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
                    {onToggleExpand && (
                        <button
                            type="button"
                            className={`${styles.iconButton} ${styles.expandButton}`}
                            onClick={(e) => { e.stopPropagation(); onToggleExpand(); }}
                            aria-label={expanded
                                ? t('notifications.collapse', { defaultValue: 'Contraer' })
                                : t('notifications.expand', { defaultValue: 'Expandir' })}
                            title={expanded
                                ? t('notifications.collapse', { defaultValue: 'Contraer' })
                                : t('notifications.expand', { defaultValue: 'Expandir' })}
                        >
                            {expanded ? <Minimize2 size={16} /> : <Maximize2 size={16} />}
                        </button>
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

            {notifs.length > 0 && (
                <div className={`${sharedStyles.widgetFooter} ${styles.footerActions}`}>
                    {totalUnreadCount > 0 ? (
                        <button
                            className={sharedStyles.viewAllLink}
                            onClick={markAllRead}
                            type="button"
                        >
                            {t('notifications.markAllRead')}
                        </button>
                    ) : (
                        /* Spacer para que el icono "Limpiar" se quede a la derecha
                           (justify-content: space-between) cuando no hay no-leídas. */
                        <span aria-hidden="true" />
                    )}
                    <button
                        className={`${styles.iconButton} ${styles.iconButtonDanger}`}
                        onClick={clearAll}
                        type="button"
                        aria-label={t('notifications.clearAll', { defaultValue: 'Limpiar todas' })}
                        title={t('notifications.clearAll', { defaultValue: 'Limpiar todas' })}
                    >
                        <Trash2 size={16} />
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
    incidencia_propuesta: HelpCircle,
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

    const formattedTime = useFormattedNotifTime(notif.fechaCreacion);

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
                        <span className={sharedStyles.itemTime}>{formattedTime}</span>
                    </div>
                </div>
            </button>
        </li>
    );
};

/**
 * Formato absoluto en español: "Vie 09/05/2026 · 14:35".
 *
 * El día de la semana abreviado se localiza al idioma activo (con la
 * primera letra capitalizada y sin punto final, que algunos navegadores
 * añaden por defecto). La fecha siempre se imprime como dd/mm/yyyy
 * — regla del proyecto: display al usuario en formato español, ISO
 * solo para inputs y payloads (ver memoria `feedback_formato_fechas_es`).
 * Hora en formato 24h.
 *
 * Reemplaza al anterior `useRelativeTime` ("Hace X min/h/d"). Decisión
 * 2026-05-09: el formato relativo perdía contexto cuando había varias
 * notificaciones del mismo día. La fecha + día de semana cubren los
 * dos casos a la vez (ubicación temporal + reconocimiento rápido).
 *
 * Pure: sin interval (la fecha es absoluta y no cambia con el tiempo).
 */
function useFormattedNotifTime(isoString) {
    const { i18n } = useTranslation();

    return useMemo(() => {
        if (!isoString) return '';
        const d = new Date(isoString);
        if (Number.isNaN(d.getTime())) return '';
        const weekdayRaw = new Intl.DateTimeFormat(i18n.language, { weekday: 'short' }).format(d);
        const weekday = weekdayRaw.replace(/\.$/, '').replace(/^./, c => c.toUpperCase());
        const dd = String(d.getDate()).padStart(2, '0');
        const mm = String(d.getMonth() + 1).padStart(2, '0');
        const yyyy = d.getFullYear();
        const hh = String(d.getHours()).padStart(2, '0');
        const min = String(d.getMinutes()).padStart(2, '0');
        return `${weekday} ${dd}/${mm}/${yyyy} · ${hh}:${min}`;
    }, [isoString, i18n.language]);
}

export default SystemNotificationsList;
