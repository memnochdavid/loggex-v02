import React, { useState, useEffect } from 'react';
import Layout from '../components/Layout';
import Button from '../components/Button';
import { useAuth } from '../context/AuthContext';
import styles from './Perfil.module.css';
import { Camera, Save, User } from 'lucide-react';

const Perfil = () => {
    const { user } = useAuth();
    const [formData, setFormData] = useState({
        nombre: '',
        email: '',
        telefono: '',
        cargo: ''
    });
    const [avatarPreview, setAvatarPreview] = useState(null);
    const [avatarFile, setAvatarFile] = useState(null); // Nuevo estado para el archivo real
    const [isEditing, setIsEditing] = useState(false);
    const [loading, setLoading] = useState(false);
    const [message, setMessage] = useState(null);

    // Función auxiliar para construir la URL completa de la imagen
    const getImageUrl = (path) => {
        if (!path) return null;
        if (path.startsWith('http')) return path;
        if (path.startsWith('data:')) return path; // Para previsualizaciones base64 antiguas si las hubiera
        // Asumiendo que el backend sirve las imágenes estáticas en el mismo host/puerto que la API
        // Ojo: BACKEND_URL en AuthContext es https://localhost:9443
        return `https://localhost:9443${path}`;
    };

    useEffect(() => {
        if (user) {
            setFormData({
                nombre: user.nombre || '',
                email: user.email || '',
                telefono: user.telefono || '', 
                cargo: user.roles ? user.roles.map(r => r.replace('ROLE_', '')).join(', ') : ''
            });
            if (user.foto) {
                setAvatarPreview(getImageUrl(user.foto));
            }
        }
    }, [user]);

    const handleChange = (e) => {
        const { name, value } = e.target;
        setFormData(prev => ({
            ...prev,
            [name]: value
        }));
    };

    const handleAvatarChange = (e) => {
        const file = e.target.files[0];
        if (file) {
            setAvatarFile(file); // Guardamos el archivo para enviarlo
            const reader = new FileReader();
            reader.onloadend = () => {
                setAvatarPreview(reader.result); // Previsualización local
            };
            reader.readAsDataURL(file);
        }
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setLoading(true);
        setMessage(null);
        
        try {
            // Usamos FormData para enviar archivos
            const data = new FormData();
            data.append('nombre', formData.nombre);
            if (avatarFile) {
                data.append('avatar', avatarFile);
            }

            const response = await fetch('https://localhost:9443/api/user/update', {
                method: 'POST',
                // No establecemos Content-Type manualmente con FormData, el navegador lo hace (multipart/form-data)
                body: data,
                credentials: 'include'
            });

            if (response.ok) {
                const responseData = await response.json();
                setMessage({ type: 'success', text: responseData.message });
                setIsEditing(false);
                setAvatarFile(null); // Limpiar el archivo seleccionado
                window.location.reload(); 
            } else {
                const errorData = await response.json();
                setMessage({ type: 'error', text: errorData.message || 'Error al actualizar perfil' });
            }
        } catch (error) {
            setMessage({ type: 'error', text: 'Error de conexión con el servidor' });
        } finally {
            setLoading(false);
        }
    };

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
                            
                            {isEditing && (
                                <label className={styles.avatarUpload}>
                                    <Camera size={16} />
                                    <input 
                                        type="file" 
                                        accept="image/*" 
                                        className={styles.hiddenInput}
                                        onChange={handleAvatarChange}
                                    />
                                </label>
                            )}
                        </div>
                        <h1 className={styles.title}>{formData.nombre || 'Usuario'}</h1>
                        <span className={styles.subtitle}>{formData.email}</span>
                    </div>

                    <form className={styles.form} onSubmit={handleSubmit}>
                        {message && (
                            <div style={{ 
                                padding: '1rem', 
                                marginBottom: '1rem', 
                                borderRadius: '0.375rem',
                                backgroundColor: message.type === 'error' ? '#fee2e2' : '#dcfce7',
                                color: message.type === 'error' ? '#ef4444' : '#16a34a',
                                textAlign: 'center'
                            }}>
                                {message.text}
                            </div>
                        )}

                        <div className={styles.formGroup}>
                            <label className={styles.label}>Nombre Completo</label>
                            <input
                                type="text"
                                name="nombre"
                                value={formData.nombre}
                                onChange={handleChange}
                                disabled={!isEditing}
                                className={styles.input}
                            />
                        </div>

                        <div className={styles.formGroup}>
                            <label className={styles.label}>Correo Electrónico</label>
                            <input
                                type="email"
                                name="email"
                                value={formData.email}
                                disabled={true} 
                                className={styles.input}
                            />
                        </div>

                        <div className={styles.formGroup}>
                            <label className={styles.label}>Rol / Cargo</label>
                            <input
                                type="text"
                                value={formData.cargo}
                                disabled={true}
                                className={styles.input}
                            />
                        </div>

                        <div className={styles.actions}>
                            {isEditing ? (
                                <>
                                    <Button 
                                        type="button" 
                                        variant="secondary" 
                                        onClick={() => {
                                            setIsEditing(false);
                                            setMessage(null);
                                            setAvatarFile(null);
                                            // Restaurar valores originales
                                            if (user) {
                                                setFormData(prev => ({ ...prev, nombre: user.nombre }));
                                                setAvatarPreview(user.foto ? getImageUrl(user.foto) : null);
                                            }
                                        }}
                                    >
                                        Cancelar
                                    </Button>
                                    <Button type="submit" disabled={loading}>
                                        <Save size={18} style={{ marginRight: '8px' }} />
                                        {loading ? 'Guardando...' : 'Guardar Cambios'}
                                    </Button>
                                </>
                            ) : (
                                <Button type="button" onClick={() => setIsEditing(true)}>
                                    Editar Perfil
                                </Button>
                            )}
                        </div>
                    </form>
                </div>
            </div>
        </Layout>
    );
};

export default Perfil;
