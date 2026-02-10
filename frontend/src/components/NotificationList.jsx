import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { User } from 'lucide-react';
import { getApiUrl, getAssetUrl, POLLING_INTERVAL_NOTIFICATIONS } from '../config/api';
import { useAuth } from '../context/AuthContext';
import styles from './NotificationList.module.css';

const NotificationList = ({ title, onUnreadCountChange, onItemClick, onViewAll, limit = 5, showViewAllButton = true, showUnreadCountInHeader = false }) => {
    const { user } = useAuth();
    const navigate = useNavigate();
    const [unreadMessages, setUnreadMessages] = useState([]);
    const [totalUnreadCount, setTotalUnreadCount] = useState(0); // Estado interno para el total de no leídos
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        if (!user) return;

        const fetchUnread = async () => {
            try {
                const userIri = `/api/users/${user.id}`;
                // Pedimos los mensajes no leídos ordenados por fecha descendente
                const response = await fetch(getApiUrl(`/api/mensajes?destinatario=${encodeURIComponent(userIri)}&leido=false&pagination=false&order[fechaEnvio]=desc`), {
                    headers: { 'Accept': 'application/ld+json' },
                    credentials: 'include'
                });
                
                if (response.ok) {
                    const data = await response.json();
                    const messages = data['hydra:member'] || data.member || [];
                    
                    setTotalUnreadCount(messages.length); // Actualizar estado interno
                    // Notificar al padre el número total de no leídos
                    if (onUnreadCountChange) {
                        onUnreadCountChange(messages.length);
                    }
                    
                    // Agrupar mensajes por remitente
                    const grouped = {};
                    messages.forEach(msg => {
                        const senderId = msg.remitente.id;
                        if (!grouped[senderId]) {
                            grouped[senderId] = {
                                user: msg.remitente,
                                count: 0,
                                lastMessage: msg
                            };
                        }
                        grouped[senderId].count++;
                        // Como vienen ordenados por fecha desc, el primero es el último
                        if (new Date(msg.fechaEnvio) > new Date(grouped[senderId].lastMessage.fechaEnvio)) {
                            grouped[senderId].lastMessage = msg;
                        }
                    });
                    
                    // Convertir a array y limitar
                    setUnreadMessages(Object.values(grouped).slice(0, limit));
                }
            } catch (error) {
                console.error("Error checking messages:", error);
            } finally {
                setLoading(false);
            }
        };

        fetchUnread(); // Primera carga
        const interval = setInterval(fetchUnread, POLLING_INTERVAL_NOTIFICATIONS);

        return () => clearInterval(interval);
    }, [user, limit, onUnreadCountChange]);

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

    if (loading && unreadMessages.length === 0) {
        return (
            <div className={styles.listContainer}>
                {title && <div className={styles.widgetHeader}><h3 className={styles.widgetTitle}>{title}</h3></div>}
                <div className={styles.loading}>Cargando notificaciones...</div>
            </div>
        );
    }

    return (
        <div className={styles.listContainer}>
            {title && (
                <div className={styles.widgetHeader}>
                    <h3 className={styles.widgetTitle}>{title}</h3>
                    {showUnreadCountInHeader && totalUnreadCount > 0 && (
                        <span className={styles.unreadCountBadge}>
                            {totalUnreadCount} no leídos
                        </span>
                    )}
                </div>
            )}

            {unreadMessages.length === 0 ? (
                <div className={styles.emptyState}>No tienes mensajes nuevos</div>
            ) : (
                <ul className={styles.list}>
                    {unreadMessages.map((item) => (
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
                                        {item.count > 1 && (
                                            <span className={styles.itemCount}>{item.count}</span>
                                        )}
                                    </div>
                                    <span className={styles.itemMessage}>
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
                        Ver todos los mensajes
                    </button>
                </div>
            )}
        </div>
    );
};

export default NotificationList;
