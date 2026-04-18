import React, { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import styles from './UserAvatar.module.css';
import { User, LogOut, Settings, GraduationCap } from 'lucide-react';
import { getAssetUrl } from '../config/api';
import { useTranslation } from 'react-i18next';
import HelpMenu from './HelpMenu';
import ConfirmLogoutModal from './ConfirmLogoutModal';

const UserAvatar = ({ size = 40, className = '' }) => {
    const { t } = useTranslation();
    const { user, logout } = useAuth();
    const [isOpen, setIsOpen] = useState(false);
    const [helpOpen, setHelpOpen] = useState(false);
    const [logoutConfirmOpen, setLogoutConfirmOpen] = useState(false);
    const menuRef = useRef(null);
    const navigate = useNavigate();

    // Función auxiliar para construir la URL completa de la imagen
    const getImageUrl = (path) => {
        if (!path) return null;
        if (path.startsWith('http')) return path;
        if (path.startsWith('data:')) return path;
        // Asumiendo que el backend sirve las imágenes estáticas en el mismo host/puerto que la API
        return getAssetUrl(path);
    };

    // Cerrar menú al hacer clic fuera
    useEffect(() => {
        const handleClickOutside = (event) => {
            if (menuRef.current && !menuRef.current.contains(event.target)) {
                setIsOpen(false);
            }
        };

        if (isOpen) {
            document.addEventListener('mousedown', handleClickOutside);
        }
        return () => {
            document.removeEventListener('mousedown', handleClickOutside);
        };
    }, [isOpen]);

    /* Paso 1: abrir modal de confirmación desde el dropdown. */
    const requestLogout = () => {
        setIsOpen(false);
        setLogoutConfirmOpen(true);
    };

    /* Paso 2: si el usuario confirma, ejecuta el logout real. */
    const performLogout = () => {
        setLogoutConfirmOpen(false);
        logout();
        navigate('/login');
    };

    const handleProfile = () => {
        navigate('/perfil');
        setIsOpen(false);
    };

    const handleOpenHelp = () => {
        setIsOpen(false);
        setHelpOpen(true);
    };

    if (!user) return null;

    const avatarUrl = getImageUrl(user.foto);
    const initials = user.nombre ? user.nombre.charAt(0).toUpperCase() : 'U';

    return (
        <div className={`${styles.container} ${className}`} ref={menuRef} data-tour="header-user-menu">
            <button
                className={styles.avatarButton}
                onClick={() => setIsOpen(!isOpen)}
                style={{ width: size, height: size }}
                aria-label={t('userAvatar.menuLabel')}
                aria-expanded={isOpen}
            >
                {avatarUrl ? (
                    <img 
                        src={avatarUrl} 
                        alt={user.nombre || 'Usuario'} 
                        className={styles.image} 
                        onError={(e) => { e.target.style.display = 'none'; e.target.nextSibling.style.display = 'flex'; }}
                    />
                ) : null}
                
                {/* Fallback o Placeholder si no hay imagen o falla la carga */}
                <div 
                    className={styles.placeholder} 
                    style={{ display: avatarUrl ? 'none' : 'flex', fontSize: size * 0.4 }}
                >
                    {initials}
                </div>
            </button>

            {isOpen && (
                <div className={styles.menu}>
                    <div className={styles.menuHeader}>
                        <span className={styles.userName}>{user.nombre || 'Usuario'}</span>
                        <span className={styles.userEmail}>{user.email}</span>
                        <span className={styles.userRoles}>
                            {user.roles
                                ?.filter(role => role !== "ROLE_USER")
                                .map(role => role.replace("ROLE_", ""))
                                .join(", ")}
                        </span>
                    </div>
                    <ul className={styles.menuList}>
                        <li>
                            <button className={styles.menuItem} onClick={handleProfile}>
                                <User size={16} />
                                {t('userAvatar.profile')}
                            </button>
                        </li>
                        <li>
                            <button className={styles.menuItem} onClick={handleOpenHelp}>
                                <GraduationCap size={16} />
                                {t('userAvatar.tutorials')}
                            </button>
                        </li>
                        <li>
                            <button className={`${styles.menuItem} ${styles.danger}`} onClick={requestLogout}>
                                <LogOut size={16} />
                                {t('userAvatar.logout')}
                            </button>
                        </li>
                    </ul>
                </div>
            )}

            <HelpMenu open={helpOpen} onClose={() => setHelpOpen(false)} />
            <ConfirmLogoutModal
                isOpen={logoutConfirmOpen}
                onClose={() => setLogoutConfirmOpen(false)}
                onConfirm={performLogout}
            />
        </div>
    );
};

export default UserAvatar;
