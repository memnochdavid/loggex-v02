import React, {useState, useEffect, useRef} from 'react';
import {Link, useNavigate} from 'react-router-dom';
import {useAuth} from '../context/AuthContext';
import {useUI} from '../context/UIContext'; // Importar contexto UI
import viteLogo from '/logo_texto_horizontal.png';
import styles from './Header.module.css';
import Button from '../components/Button';
import UserAvatar from '../components/UserAvatar';
import NameTitle from '../components/NameTitle'; // Importar NameTitle
import { Bell, User } from 'lucide-react'; // Importar icono de campana
import { getApiUrl, getAssetUrl, POLLING_INTERVAL_NOTIFICATIONS } from '../config/api';

// Hook simple para media query
const useMediaQuery = (query) => {
    const [matches, setMatches] = useState(window.matchMedia(query).matches);

    useEffect(() => {
        const media = window.matchMedia(query);
        if (media.matches !== matches) {
            setMatches(media.matches);
        }
        const listener = () => setMatches(media.matches);
        media.addEventListener('change', listener);
        return () => media.removeEventListener('change', listener);
    }, [matches, query]);

    return matches;
};

const Header = () => {
    const {user} = useAuth();
    const {toggleSidebar} = useUI();
    const isMobile = useMediaQuery('(max-width: 1220px)'); // Coincide con el breakpoint del Sidebar
    const [unreadCount, setUnreadCount] = useState(0);
    const [unreadMessages, setUnreadMessages] = useState([]); // Almacenar mensajes para el dropdown
    const [isNotifOpen, setIsNotifOpen] = useState(false); // Estado del dropdown
    const notifRef = useRef(null);
    const navigate = useNavigate();

    // Función para obtener la URL del logo del centro
    const getCentroLogoUrl = () => {
        if (user && user.centro && user.centro.logo) {
            return getAssetUrl(`/uploads/logo-centro/${user.centro.logo}`);
        }
        return null;
    };
    const getCentroName = () => {
        return user?.centro?.nombre;
    }

    const centroLogo = getCentroLogoUrl();
    const isAdmin = user?.roles?.includes('ROLE_ADMIN') || user?.roles?.includes('ROLE_SUPERADMIN');

    // Cerrar dropdown al hacer clic fuera
    useEffect(() => {
        const handleClickOutside = (event) => {
            if (notifRef.current && !notifRef.current.contains(event.target)) {
                setIsNotifOpen(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    // Polling para mensajes no leídos
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
                    
                    // CORRECCIÓN: Usar la longitud del array directamente si totalItems falla o no viene
                    const count = messages.length;
                    setUnreadCount(count);
                    
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
                    
                    // Convertir a array y limitar a 5
                    setUnreadMessages(Object.values(grouped).slice(0, 5));
                }
            } catch (error) {
                console.error("Error checking messages:", error);
            }
        };

        fetchUnread(); // Primera carga
        const interval = setInterval(fetchUnread, POLLING_INTERVAL_NOTIFICATIONS); // Cada 30s

        return () => clearInterval(interval);
    }, [user]);

    const handleNotificationClick = (sender) => {
        setIsNotifOpen(false);
        navigate('/mensajes', { state: { chatWith: sender } });
    };

    const handleViewAll = () => {
        setIsNotifOpen(false);
        navigate('/mensajes');
    };

    const LogoImage = (
        <img
            src={centroLogo || viteLogo}
            alt="Logo"
            className={styles.logo}
            onError={(e) => {
                if (e.target.src !== viteLogo) {
                    e.target.src = viteLogo;
                }
            }}
        />
    );

    return (
        <header className={styles.header}>
            <div className={styles.logoContainer} style={user?.centro?.personalizacion?.nameTitleConfig?.alignment ? { alignItems: user.centro.personalizacion.nameTitleConfig.alignment } : {}}>
                {/* En móvil y logueado, el logo abre el sidebar. En desktop o sin login, va a home */}
                {isMobile && user ? (
                    <Link to="#" className={styles.logoLink} onClick={toggleSidebar}>
                        {LogoImage}
                    </Link>
                ) : (
                    <Link to="/" className={styles.logoLink} onClick={toggleSidebar}>
                        {LogoImage}
                    </Link>
                )}
                
                {/* Usar NameTitle en lugar de span directo */}
                <NameTitle name={getCentroName()} className={styles.nombrecentro} />
            </div>

            <nav style={{display: 'flex', gap: '1rem', alignItems: 'center'}}>

                {/* Enlaces de navegación (ocultos en móvil si están en el sidebar, o visibles si caben) */}
                <div className={styles.desktopNav}>
                    <Link to="/about" className={styles.navLink}>About</Link>
                </div>

                {user && user.roles && user.roles.includes('ROLE_SUPERADMIN') && (
                    <a
                        href="https://localhost:9443/api"
                        target="_blank"
                        rel="noopener noreferrer"
                        className={`${styles.navLink} ${styles.desktopNav}`}
                        title="Documentación API Platform"
                    >
                        API Docs
                    </a>
                )}

                {user ? (
                    <div style={{display: 'flex', alignItems: 'center', gap: '1rem', marginLeft: '1rem'}}>
                        {/* Dropdown de Notificaciones */}
                        <div className={styles.notificationContainer} ref={notifRef}>
                            <button 
                                className={styles.notificationButton}
                                onClick={() => setIsNotifOpen(!isNotifOpen)}
                                title="Notificaciones"
                            >
                                <Bell size={24} />
                            </button>
                            
                            {/* Badge fuera del botón para evitar problemas de overflow/clipping */}
                            {unreadCount > 0 && (
                                <span className={styles.badge} onClick={() => setIsNotifOpen(!isNotifOpen)}>
                                    {unreadCount > 9 ? '9+' : unreadCount}
                                </span>
                            )}

                            {isNotifOpen && (
                                <div className={styles.dropdown}>
                                    <div className={styles.dropdownHeader}>
                                        <span>Notificaciones</span>
                                        {unreadCount > 0 && (
                                            <span style={{fontSize: '0.8rem', color: '#64748b'}}>
                                                {unreadCount} no leídos
                                            </span>
                                        )}
                                    </div>
                                    
                                    <ul className={styles.dropdownList}>
                                        {unreadMessages.length > 0 ? (
                                            unreadMessages.map((item) => (
                                                <li key={item.user.id}>
                                                    <button 
                                                        className={styles.dropdownItem}
                                                        onClick={() => handleNotificationClick(item.user)}
                                                    >
                                                        {item.user.foto ? (
                                                            <img 
                                                                src={getAssetUrl(item.user.foto)} 
                                                                alt="" 
                                                                className={styles.itemAvatar}
                                                            />
                                                        ) : (
                                                            <div className={styles.itemAvatar} style={{display: 'flex', alignItems: 'center', justifyContent: 'center'}}>
                                                                <User size={20} color="#94a3b8" />
                                                            </div>
                                                        )}
                                                        <div className={styles.itemContent}>
                                                            <div style={{display: 'flex', justifyContent: 'space-between'}}>
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
                                            ))
                                        ) : (
                                            <div className={styles.emptyState}>
                                                No tienes mensajes nuevos
                                            </div>
                                        )}
                                    </ul>
                                    
                                    <div className={styles.dropdownFooter}>
                                        <button 
                                            className={styles.viewAllLink}
                                            onClick={handleViewAll}
                                            style={{background: 'none', border: 'none', cursor: 'pointer'}}
                                        >
                                            Ver todos los mensajes
                                        </button>
                                    </div>
                                </div>
                            )}
                        </div>

                        <UserAvatar size={40}/>
                    </div>
                ) : (
                    <Link to="/login" style={{textDecoration: 'none'}}>
                        <Button variant="primary" style={{padding: '0.25rem 0.75rem', fontSize: '0.875rem'}}>
                            Login
                        </Button>
                    </Link>
                )}
            </nav>
        </header>
    );
};

export default Header;
