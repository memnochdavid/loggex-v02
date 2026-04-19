import React, {useState, useEffect, useRef} from 'react';
import {Link, useNavigate} from 'react-router-dom';
import {useAuth} from '../context/AuthContext';
import {useUI} from '../context/UIContext';
import viteLogo from '/logo_texto_horizontal.png';
import styles from './Header.module.css';
import Button from '../components/Button';
import UserAvatar from '../components/UserAvatar';
import NameTitle from '../components/NameTitle';
import NotificationList from '../components/NotificationList';
import { Bell, MessageCircleQuestion } from 'lucide-react';
import { getApiUrl, getAssetUrl } from '../config/api';
import LanguageSelector from '../components/LanguageSelector';
import { useTranslation } from 'react-i18next';

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
    const { t } = useTranslation();
    const {user} = useAuth();
    const {toggleSidebar} = useUI();
    const isMobile = useMediaQuery('(max-width: 1220px)');
    const [unreadCount, setUnreadCount] = useState(0);
    const [isNotifOpen, setIsNotifOpen] = useState(false);
    const [supportLoading, setSupportLoading] = useState(false);
    const [scrolled, setScrolled] = useState(false);
    const notifRef = useRef(null);
    const navigate = useNavigate();

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
    const isAdmin = user?.roles?.includes('ROLE_ADMIN');
    const isSuperAdmin = user?.roles?.includes('ROLE_SUPERADMIN');

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

    // Cerrar dropdown con Escape (devolver foco al trigger)
    useEffect(() => {
        if (!isNotifOpen) return;
        const onKey = (e) => {
            if (e.key === 'Escape') {
                setIsNotifOpen(false);
                notifRef.current?.querySelector('button')?.focus();
            }
        };
        document.addEventListener('keydown', onKey);
        return () => document.removeEventListener('keydown', onKey);
    }, [isNotifOpen]);

    // Elevación progresiva al hacer scroll (throttle vía rAF).
    useEffect(() => {
        let raf = null;
        const update = () => {
            raf = null;
            setScrolled(window.scrollY > 4);
        };
        const onScroll = () => {
            if (raf === null) raf = requestAnimationFrame(update);
        };
        window.addEventListener('scroll', onScroll, { passive: true });
        update();
        return () => {
            window.removeEventListener('scroll', onScroll);
            if (raf !== null) cancelAnimationFrame(raf);
        };
    }, []);

    const handleNotificationClick = (sender) => {
        setIsNotifOpen(false);
        navigate('/mensajes', { state: { chatWith: sender } });
    };

    const handleViewAll = () => {
        setIsNotifOpen(false);
        navigate('/mensajes');
    };

    const handleSupportClick = async (e) => {
        e.preventDefault();
        if (supportLoading) return;
        setSupportLoading(true);

        try {
            let targetUser = null;

            if (isAdmin) {
                // Si es Admin, busca al SuperAdmin
                // Añadimos roles=ROLE_SUPERADMIN para saltar el filtro de CurrentUserExtension
                const response = await fetch(getApiUrl('/api/users?roles=ROLE_SUPERADMIN&pagination=false'), {
                    headers: { 'Accept': 'application/ld+json' },
                    credentials: 'include'
                });

                if (response.ok) {
                    const data = await response.json();
                    const users = data['hydra:member'] || data.member || [];
                    // Buscar cualquier usuario que tenga el rol SUPERADMIN
                    targetUser = users.find(u => u.roles.includes('ROLE_SUPERADMIN') || u.roles.includes('ROLE_SUPER_ADMIN'));
                }

            } else {
                // Si es usuario normal, busca al Admin de su centro
                if (user.centro && user.centro.id) {
                    const response = await fetch(getApiUrl(`/api/users?centro=${user.centro.id}&pagination=false`), {
                        headers: { 'Accept': 'application/ld+json' },
                        credentials: 'include'
                    });

                    if (response.ok) {
                        const data = await response.json();
                        const users = data['hydra:member'] || data.member || [];
                        targetUser = users.find(u => u.roles.includes('ROLE_ADMIN'));
                    }
                }
            }

            if (targetUser) {
                navigate('/mensajes', { state: { chatWith: targetUser } });
            } else {
                alert(t('header.noSupportFound'));
            }

        } catch (error) {
            console.error("Error buscando soporte:", error);
            alert(t('header.errorSupport'));
        } finally {
            setSupportLoading(false);
        }
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

    const hasUnread = unreadCount > 0;

    return (
        <header className={`${styles.header} ${scrolled ? styles.scrolled : ''}`}>
            <div
                className={styles.logoContainer}
                style={{
                    '--i': 0,
                    ...(user?.centro?.personalizacion?.nameTitleConfig?.alignment
                        ? { alignItems: user.centro.personalizacion.nameTitleConfig.alignment }
                        : {}),
                }}
            >
                {isMobile && user ? (
                    <Link to="#" className={styles.logoLink} onClick={toggleSidebar}>
                        {LogoImage}
                    </Link>
                ) : (
                    <Link to="/" className={styles.logoLink}>
                        {LogoImage}
                    </Link>
                )}

                <NameTitle name={getCentroName()} className={styles.nombrecentro} />
            </div>

            <nav className={styles.nav} style={{ '--i': 1 }}>
                <div className={styles.desktopNav}>
                    {(!user || isSuperAdmin) && (
                        <Link to="/about" className={styles.navLink}>
                            <span className={styles.navLinkLabel}>{t('header.about')}</span>
                        </Link>
                    )}

                    {user && !isSuperAdmin && (
                        <a
                            href="#"
                            onClick={handleSupportClick}
                            className={`${styles.navLink} ${supportLoading ? styles.navLinkLoading : ''}`}
                        >
                            <MessageCircleQuestion size={18} className={styles.navLinkIcon} />
                            <span className={styles.navLinkLabel}>{t('header.support')}</span>
                        </a>
                    )}
                </div>

                {user && isSuperAdmin && (
                    <a
                        href="/api"
                        target="_blank"
                        rel="noopener noreferrer"
                        className={`${styles.navLink} ${styles.desktopNav}`}
                        title={t('header.apiDocsTooltip')}
                    >
                        <span className={styles.navLinkLabel}>{t('header.apiDocs')}</span>
                    </a>
                )}

                <LanguageSelector />

                {user ? (
                    <div className={styles.userActions}>
                        <div
                            className={`${styles.notificationContainer} ${hasUnread ? styles.hasUnread : ''}`}
                            ref={notifRef}
                            data-tour="header-notifications"
                        >
                            <button
                                className={styles.notificationButton}
                                onClick={() => setIsNotifOpen(!isNotifOpen)}
                                title={t('header.notifications')}
                                aria-label={t('header.notifications')}
                                aria-haspopup="dialog"
                                aria-expanded={isNotifOpen}
                            >
                                <Bell size={22} aria-hidden="true" />
                            </button>

                            {hasUnread && (
                                <span
                                    className={styles.badge}
                                    onClick={() => setIsNotifOpen(!isNotifOpen)}
                                    aria-hidden="true"
                                >
                                    {unreadCount > 9 ? '9+' : unreadCount}
                                </span>
                            )}

                            {isNotifOpen && (
                                <div className={styles.dropdown} role="dialog" aria-label={t('header.notifications')}>
                                    <NotificationList
                                        title={t('header.notifications')}
                                        showUnreadCountInHeader={true}
                                        onUnreadCountChange={setUnreadCount}
                                        onItemClick={handleNotificationClick}
                                        onViewAll={handleViewAll}
                                        limit={5}
                                    />
                                </div>
                            )}

                            {!isNotifOpen && (
                                <div style={{ display: 'none' }}>
                                    <NotificationList
                                        onUnreadCountChange={setUnreadCount}
                                        limit={0}
                                    />
                                </div>
                            )}
                        </div>

                        <UserAvatar size={40}/>
                    </div>
                ) : (
                    <Link to="/login" style={{textDecoration: 'none'}}>
                        <Button variant="primary" style={{padding: '0.25rem 0.75rem', fontSize: '0.875rem'}}>
                            {t('header.login')}
                        </Button>
                    </Link>
                )}
            </nav>
        </header>
    );
};

export default Header;
