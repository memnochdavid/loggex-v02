import React, { useState, useEffect } from 'react';
import Layout from '../components/Layout';
import { useAuth } from '../context/AuthContext';
import styles from './Perfil.module.css';
import { User, Mail, Phone, CreditCard, Building, Shield, Camera } from 'lucide-react';

const Perfil = () => {
    const { user, checkAuth } = useAuth();
    const [avatarPreview, setAvatarPreview] = useState(null);
    const [uploading, setUploading] = useState(false);

    const getImageUrl = (path) => {
        if (!path) return null;
        if (path.startsWith('http')) return path;
        if (path.startsWith('data:')) return path;
        return `https://localhost:9443${path}`;
    };

    useEffect(() => {
        if (user && user.foto) {
            setAvatarPreview(getImageUrl(user.foto));
        }
    }, [user]);

    const handleAvatarChange = async (e) => {
        const file = e.target.files[0];
        if (!file) return;

        // Preview inmediato
        const reader = new FileReader();
        reader.onloadend = () => setAvatarPreview(reader.result);
        reader.readAsDataURL(file);

        // Subida
        setUploading(true);
        try {
            const data = new FormData();
            // Enviamos solo el avatar, asumiendo que el endpoint soporta actualización parcial o ignoramos nombre
            // Si el endpoint requiere nombre obligatorio, lo enviamos
            data.append('nombre', user.nombre); 
            data.append('avatar', file);

            const response = await fetch('https://localhost:9443/api/user/update', {
                method: 'POST',
                body: data,
                credentials: 'include'
            });

            if (response.ok) {
                await checkAuth(); // Recargar usuario
            } else {
                alert("Error al actualizar avatar");
            }
        } catch (error) {
            console.error(error);
            alert("Error de conexión");
        } finally {
            setUploading(false);
        }
    };

    if (!user) return null;

    const fullName = `${user.nombre} ${user.apellidos || ''}`.trim();
    const roles = user.roles 
        ? user.roles.filter(r => r !== 'ROLE_USER').map(r => r.replace('ROLE_', '')).join(', ') 
        : 'Usuario';

    return (
        <Layout>
            <div className={styles.container}>
                <div className={styles.card}>
                    <div className={styles.header}>
                        <div className={styles.avatarContainer}>
                            {avatarPreview ? (
                                <img src={avatarPreview} alt="Avatar" className={styles.avatar} />
                            ) : (
                                <div className={`${styles.avatar} ${styles.placeholderAvatar}`}>
                                    <User size={64} color="#cbd5e1" />
                                </div>
                            )}
                            
                            {/* Opción de cambiar avatar siempre visible para el propio usuario */}
                            <label className={styles.avatarUpload} title="Cambiar foto">
                                <Camera size={16} />
                                <input 
                                    type="file" 
                                    accept="image/*" 
                                    className={styles.hiddenInput}
                                    onChange={handleAvatarChange}
                                    disabled={uploading}
                                />
                            </label>
                        </div>
                        <div className={styles.headerInfo}>
                            <h1 className={styles.name}>{fullName}</h1>
                            <span className={styles.roleBadge}>{roles}</span>
                        </div>
                    </div>

                    <div className={styles.content}>
                        <div className={styles.section}>
                            <h3 className={styles.sectionTitle}>
                                <User size={20} /> Información Personal
                            </h3>
                            <div className={styles.grid}>
                                <div className={styles.field}>
                                    <span className={styles.label}>Nombre</span>
                                    <span className={styles.value}>{user.nombre}</span>
                                </div>
                                <div className={styles.field}>
                                    <span className={styles.label}>Apellidos</span>
                                    <span className={styles.value}>{user.apellidos || <span className={styles.emptyValue}>No definido</span>}</span>
                                </div>
                                <div className={styles.field}>
                                    <span className={styles.label}>NIF / DNI</span>
                                    <span className={styles.value}>{user.nif || <span className={styles.emptyValue}>No definido</span>}</span>
                                </div>
                            </div>
                        </div>

                        <div className={styles.section}>
                            <h3 className={styles.sectionTitle}>
                                <Mail size={20} /> Contacto
                            </h3>
                            <div className={styles.grid}>
                                <div className={styles.field}>
                                    <span className={styles.label}>Email</span>
                                    <span className={styles.value}>{user.email}</span>
                                </div>
                                <div className={styles.field}>
                                    <span className={styles.label}>Teléfono</span>
                                    <span className={styles.value}>{user.telefono || <span className={styles.emptyValue}>No definido</span>}</span>
                                </div>
                            </div>
                        </div>

                        <div className={styles.section}>
                            <h3 className={styles.sectionTitle}>
                                <Building size={20} /> Información Académica
                            </h3>
                            <div className={styles.grid}>
                                <div className={styles.field}>
                                    <span className={styles.label}>Centro</span>
                                    <span className={styles.value}>{user.centro ? user.centro.nombre : <span className={styles.emptyValue}>Sin centro asignado</span>}</span>
                                </div>
                                <div className={styles.field}>
                                    <span className={styles.label}>Rol en la App</span>
                                    <span className={styles.value}>{user.rol_app || roles}</span>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </Layout>
    );
};

export default Perfil;
