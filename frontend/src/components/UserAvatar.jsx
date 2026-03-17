import React, { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import styles from './UserAvatar.module.css';
import { User, LogOut, Settings } from 'lucide-react';
import { getAssetUrl } from '../config/api';
import { useTranslation } from 'react-i18next';

const UserAvatar = ({ size = 40, className = '' }) => {
    const { t } = useTranslation();
    const { user, logout } = useAuth();
    const [isOpen, setIsOpen] = useState(false);
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

    const handleLogout = () => {
        logout();
        setIsOpen(false);
        navigate('/login');
    };

    const handleProfile = () => {
        navigate('/perfil');
        setIsOpen(false);
    };

    if (!user) return null;

    const avatarUrl = getImageUrl(user.foto);
    const initials = user.nombre ? user.nombre.charAt(0).toUpperCase() : 'U';

    return (
        <div className={`${styles.container} ${className}`} ref={menuRef}>
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
                        {/* Podríamos añadir Configuración aquí si fuera diferente de Perfil */}
                        {/* <li>
                            <button className={styles.menuItem} onClick={() => navigate('/configuracion')}>
                                <Settings size={16} />
                                Configuración
                            </button>
                        </li> */}
                        <li>
                            <button className={`${styles.menuItem} ${styles.danger}`} onClick={handleLogout}>
                                <LogOut size={16} />
                                {t('userAvatar.logout')}
                            </button>
                        </li>
                    </ul>
                </div>
            )}
        </div>
    );
};

export default UserAvatar;
