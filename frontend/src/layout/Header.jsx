import React, {useState, useEffect} from 'react';
import {Link, useNavigate} from 'react-router-dom';
import {useAuth} from '../context/AuthContext';
import {useUI} from '../context/UIContext'; // Importar contexto UI
import viteLogo from '/logo_texto_horizontal.png';
import styles from './Header.module.css';
import Button from '../components/Button';
import UserAvatar from '../components/UserAvatar';
import NameTitle from '../components/NameTitle'; // Importar NameTitle
import { Bell } from 'lucide-react'; // Importar icono de campana

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
    const navigate = useNavigate();

    // Función para obtener la URL del logo del centro
    const getCentroLogoUrl = () => {
        if (user && user.centro && user.centro.logo) {
            return `https://localhost:9443/uploads/logo-centro/${user.centro.logo}`;
        }
        return null;
    };
    const getCentroName = () => {
        return user?.centro?.nombre;
    }

    const centroLogo = getCentroLogoUrl();
    const isAdmin = user?.roles?.includes('ROLE_ADMIN') || user?.roles?.includes('ROLE_SUPERADMIN');

    // Polling para mensajes no leídos
    useEffect(() => {
        if (!user) return;

        const fetchUnread = async () => {
            try {
                // Filtramos por destinatario (yo) y leido=false
                // Nota: CurrentUserExtension ya filtra por "remitente O destinatario", 
                // así que debemos ser explícitos con el destinatario para contar SOLO los recibidos.
                // Usamos el IRI del usuario
                const userIri = `/api/users/${user.id}`;
                const response = await fetch(`https://localhost:9443/api/mensajes?destinatario=${encodeURIComponent(userIri)}&leido=false&pagination=false`, {
                    headers: { 'Accept': 'application/ld+json' },
                    credentials: 'include'
                });
                
                if (response.ok) {
                    const data = await response.json();
                    setUnreadCount(data['hydra:totalItems'] || data.length || 0);
                }
            } catch (error) {
                console.error("Error checking messages:", error);
            }
        };

        fetchUnread(); // Primera carga
        const interval = setInterval(fetchUnread, 30000); // Cada 30s

        return () => clearInterval(interval);
    }, [user]);

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
            <div className={styles.logoContainer}>
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
                        {/* Icono de Notificaciones */}
                        <div 
                            style={{ position: 'relative', cursor: 'pointer', color: 'inherit' }}
                            onClick={() => navigate('/mensajes')}
                            title="Mensajes"
                        >
                            <Bell size={24} />
                            {unreadCount > 0 && (
                                <span style={{
                                    position: 'absolute',
                                    top: '-5px',
                                    right: '-5px',
                                    backgroundColor: '#ef4444',
                                    color: 'white',
                                    borderRadius: '50%',
                                    width: '18px',
                                    height: '18px',
                                    fontSize: '11px',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    fontWeight: 'bold'
                                }}>
                                    {unreadCount > 9 ? '9+' : unreadCount}
                                </span>
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
