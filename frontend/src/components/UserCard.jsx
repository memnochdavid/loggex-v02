import React, { useState } from 'react';
import styles from './UserCard.module.css';
import { User, Mail, Phone, Users, MessageSquare } from 'lucide-react';
import Button from './Button'; // Importar componente Button
import { getAssetUrl } from '../config/api';
import ModalView from './ModalView';
import UserProfileView from './UserProfileView';
import { useTranslation } from 'react-i18next';

const UserCard = ({ user, onMessage }) => {
    const { t } = useTranslation();
    const [isProfileOpen, setIsProfileOpen] = useState(false);

    const getAvatarUrl = (path) => {
        if (!path) return null;
        if (path.startsWith('http')) return path;
        return getAssetUrl(path);
    };

    const handleCardClick = () => {
        setIsProfileOpen(true);
    };

    const handleMessageClick = (e) => {
        e.stopPropagation(); // Evitar abrir el perfil al hacer clic en mensaje
        onMessage(user);
    };

    return (
        <>
            <div className={styles.card} onClick={handleCardClick} style={{ cursor: 'pointer' }}>
                <div className={styles.avatarContainer}>
                    {user.foto ? (
                        <img src={getAvatarUrl(user.foto)} alt={user.nombre} className={styles.avatar} />
                    ) : (
                        <div className={styles.placeholderAvatar}>
                            <User size={40} />
                        </div>
                    )}
                </div>
                <div className={styles.info}>
                    <h3 className={styles.name}>{user.nombre} {user.apellidos}</h3>
                    
                    <div className={styles.detail}>
                        <Mail size={14} />
                        <a href={`mailto:${user.email}`} onClick={(e) => e.stopPropagation()}>{user.email}</a>
                    </div>
                    
                    {user.telefono && (
                        <div className={styles.detail}>
                            <Phone size={14} />
                            <span>{user.telefono}</span>
                        </div>
                    )}

                    {user.grupos && user.grupos.length > 0 && (
                        <div className={styles.groups}>
                            <Users size={14} />
                            <span>{user.grupos.join(', ')}</span>
                        </div>
                    )}
                </div>

                <div className={styles.actions}>
                    <Button 
                        variant="primary"
                        onClick={handleMessageClick}
                        style={{ width: '100%', justifyContent: 'center' }}
                    >
                        <MessageSquare size={16} style={{ marginRight: '8px' }} />
                        {t('userCard.sendMessage')}
                    </Button>
                </div>
            </div>

            {isProfileOpen && (
                <ModalView
                    isOpen={isProfileOpen}
                    onClose={() => setIsProfileOpen(false)}
                    title={t('userCard.profileTitle')}
                    size="large"
                    footer={<Button variant="secondary" onClick={() => setIsProfileOpen(false)}>{t('userCard.close')}</Button>}
                    bodyClassName={styles.noPaddingBody} // Quitar padding del cuerpo
                >
                    <UserProfileView user={user} />
                </ModalView>
            )}
        </>
    );
};

export default UserCard;
