import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { User } from 'lucide-react';
import { getApiUrl, getAssetUrl, POLLING_INTERVAL_NOTIFICATIONS } from '../config/api';
import { useAuth } from '../context/AuthContext';
import styles from './NotificationList.module.css';
import { useTranslation } from 'react-i18next';

const NotificationList = ({ 
    title, 
    onUnreadCountChange, 
    onItemClick, 
    onViewAll, 
    limit = 5, 
    showViewAllButton = true, 
    showUnreadCountInHeader = false, 
    hideHeader = false,
    onlyUnread = true // Nueva prop para controlar el filtro
}) => {
    const { t } = useTranslation();
    const { user } = useAuth();
    const navigate = useNavigate();
    const [messages, setMessages] = useState([]);
    const [totalUnreadCount, setTotalUnreadCount] = useState(0);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        if (!user) return;

        const fetchMessages = async () => {
            try {
                const userIri = `/api/users/${user.id}`;
                let url = `/api/mensajes?destinatario=${encodeURIComponent(userIri)}&pagination=false&order[fechaEnvio]=desc`;
                
                // Si onlyUnread es true, añadimos el filtro leido=false
                if (onlyUnread) {
                    url += '&leido=false';
                }

                const response = await fetch(getApiUrl(url), {
                    headers: { 'Accept': 'application/ld+json' },
                    credentials: 'include'
                });
                
                if (response.ok) {
                    const data = await response.json();
                    const fetchedMessages = data['hydra:member'] || data.member || [];
                    
                    // Calcular total de no leídos independientemente de lo que mostremos
                    // Si onlyUnread es true, fetchedMessages.length es el total de no leídos
                    // Si onlyUnread es false, tendríamos que filtrar o hacer otra petición si queremos el dato exacto
                    // Para simplificar, si onlyUnread es true usamos length, si no, asumimos que el padre no necesita este dato exacto o lo gestiona aparte
                    if (onlyUnread) {
                        setTotalUnreadCount(fetchedMessages.length);
                        if (onUnreadCountChange) {
                            onUnreadCountChange(fetchedMessages.length);
                        }
                    } else if (onUnreadCountChange) {
                        // Si mostramos todos, quizás queramos saber cuántos hay sin leer de esos
                        const unread = fetchedMessages.filter(m => !m.leido).length;
                        setTotalUnreadCount(unread);
                        onUnreadCountChange(unread);
                    }
                    
                    // Agrupar mensajes por remitente
                    const grouped = {};
                    fetchedMessages.forEach(msg => {
                        const senderId = msg.remitente.id;
                        if (!grouped[senderId]) {
                            grouped[senderId] = {
                                user: msg.remitente,
                                count: 0,
                                lastMessage: msg,
                                hasUnread: false
                            };
                        }
                        
                        if (!msg.leido) {
                            grouped[senderId].count++;
                            grouped[senderId].hasUnread = true;
                        }
                        
                        // Como vienen ordenados por fecha desc, el primero es el último
                        if (new Date(msg.fechaEnvio) > new Date(grouped[senderId].lastMessage.fechaEnvio)) {
                            grouped[senderId].lastMessage = msg;
                        }
                    });
                    
                    // Convertir a array y limitar
                    setMessages(Object.values(grouped).slice(0, limit));
                }
            } catch (error) {
                console.error("Error checking messages:", error);
            } finally {
                setLoading(false);
            }
        };

        fetchMessages(); // Primera carga
        const interval = setInterval(fetchMessages, POLLING_INTERVAL_NOTIFICATIONS);

        return () => clearInterval(interval);
    }, [user, limit, onUnreadCountChange, onlyUnread]);

    const handleItemClick = (sender) => {
        if (onItemClick) {
            onItemClick(sender);
        } else {
            navigate('/mensajes', { state: { chatWith: sender } });
        }
    };

    const handleViewAllClick = () => {
        if (onViewAll) {
            onViewAll();
        } else {
            navigate('/mensajes');
        }
    };

    if (loading && messages.length === 0) {
        return (
            <div className={styles.listContainer}>
                {!hideHeader && title && <div className={styles.widgetHeader}><h3 className={styles.widgetTitle}>{title}</h3></div>}
                <div className={styles.loading}>{t('notifications.loading')}</div>
            </div>
        );
    }

    return (
        <div className={styles.listContainer}>
            {!hideHeader && title && (
                <div className={styles.widgetHeader}>
                    <h3 className={styles.widgetTitle}>{title}</h3>
                    {showUnreadCountInHeader && totalUnreadCount > 0 && (
                        <span className={styles.unreadCountBadge}>
                            {totalUnreadCount} {t('notifications.unread')}
                        </span>
                    )}
                </div>
            )}

            {messages.length === 0 ? (
                <div className={styles.emptyState}>
                    {onlyUnread ? t('notifications.noNewMessages') : t('notifications.noRecentMessages')}
                </div>
            ) : (
                <ul className={styles.list}>
                    {messages.map((item) => (
                        <li key={item.user.id} className={styles.listItem}>
                            <button 
                                className={styles.itemButton}
                                onClick={() => handleItemClick(item.user)}
                            >
                                {item.user.foto ? (
                                    <img 
                                        src={getAssetUrl(item.user.foto)} 
                                        alt="" 
                                        className={styles.itemAvatar}
                                    />
                                ) : (
                                    <div className={styles.itemAvatarPlaceholder}>
                                        <User size={20} color="#94a3b8" />
                                    </div>
                                )}
                                <div className={styles.itemContent}>
                                    <div className={styles.itemHeader}>
                                        <span className={styles.itemName}>
                                            {item.user.nombre} {item.user.apellidos}
                                        </span>
                                        {/* Mostrar contador solo si hay mensajes no leídos */}
                                        {item.count > 0 && (
                                            <span className={styles.itemCount}>{item.count}</span>
                                        )}
                                    </div>
                                    <span className={`${styles.itemMessage} ${!item.hasUnread && !onlyUnread ? styles.readMessage : ''}`}>
                                        {item.lastMessage.texto}
                                    </span>
                                    <div className={styles.itemMeta}>
                                        <span className={styles.itemTime}>
                                            {new Date(item.lastMessage.fechaEnvio).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
                                        </span>
                                    </div>
                                </div>
                            </button>
                        </li>
                    ))}
                </ul>
            )}
            
            {showViewAllButton && (
                <div className={styles.widgetFooter}>
                    <button 
                        className={styles.viewAllLink}
                        onClick={handleViewAllClick}
                    >
                        {t('notifications.viewAll')}
                    </button>
                </div>
            )}
        </div>
    );
};

export default NotificationList;
