import React from 'react';
import styles from './UserCard.module.css';
import { User, Mail, Phone, Users, MessageSquare } from 'lucide-react';
import Button from './Button'; // Importar componente Button
import { getAssetUrl } from '../config/api';

const UserCard = ({ user, onMessage }) => {
    const getAvatarUrl = (path) => {
        if (!path) return null;
        if (path.startsWith('http')) return path;
        return getAssetUrl(path);
    };

    return (
        <div className={styles.card}>
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
                    <a href={`mailto:${user.email}`}>{user.email}</a>
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
                    onClick={() => onMessage(user)}
                    style={{ width: '100%', justifyContent: 'center' }}
                >
                    <MessageSquare size={16} style={{ marginRight: '8px' }} />
                    Enviar Mensaje
                </Button>
            </div>
        </div>
    );
};

export default UserCard;
