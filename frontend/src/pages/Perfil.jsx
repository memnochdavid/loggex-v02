import React, { useState, useEffect } from 'react';
import Layout from '../components/Layout';
import { useAuth } from '../context/AuthContext';
import styles from './Perfil.module.css';
import { User, Mail, Phone, Lock, Image as ImageIcon, GraduationCap, Building, Camera, BookOpen } from 'lucide-react';
import { getApiUrl, getAssetUrl } from '../config/api';

const Perfil = () => {
    const { user, checkAuth } = useAuth();
    const [avatarPreview, setAvatarPreview] = useState(null);
    const [uploading, setUploading] = useState(false);
    
    // Estados para información académica
    const [matriculas, setMatriculas] = useState([]);
    const [imparticiones, setImparticiones] = useState([]);

    const getImageUrl = (path) => {
        if (!path) return null;
        if (path.startsWith('http')) return path;
        if (path.startsWith('data:')) return path;
        return getAssetUrl(path);
    };

    useEffect(() => {
        if (user) {
            setAvatarPreview(user.foto ? getImageUrl(user.foto) : null);

            // Cargar datos académicos según el rol
            if (user.roles?.includes('ROLE_ALUMNO')) {
                fetchMatriculas();
            }
            if (user.roles?.includes('ROLE_PROFESOR')) {
                fetchImparticiones();
            }
        }
    }, [user]);

    const fetchMatriculas = async () => {
        try {
            const response = await fetch(getApiUrl('/api/v1/alumno/matriculas'), {
                headers: { 'Accept': 'application/json' },
                credentials: 'include'
            });
            if (response.ok) {
                const data = await response.json();
                setMatriculas(data);
            }
        } catch (error) {
            console.error("Error cargando matrículas:", error);
        }
    };

    const fetchImparticiones = async () => {
        try {
            const response = await fetch(getApiUrl('/api/v1/profesor/imparticiones'), {
                headers: { 'Accept': 'application/json' },
                credentials: 'include'
            });
            if (response.ok) {
                const data = await response.json();
                setImparticiones(data);
            }
        } catch (error) {
            console.error("Error cargando imparticiones:", error);
        }
    };

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
            data.append('nombre', user.nombre); 
            data.append('avatar', file);

            const response = await fetch(getApiUrl('/api/user/update'), {
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

    const isAlumnoOnly = user.roles.includes('ROLE_ALUMNO') && !user.roles.includes('ROLE_PROFESOR') && !user.roles.includes('ROLE_ADMIN') && !user.roles.includes('ROLE_SUPERADMIN');
    const canEditAvatar = !isAlumnoOnly;

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
                            
                            {canEditAvatar && (
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
                            )}
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

                            {/* Matrículas para Alumnos */}
                            {matriculas.length > 0 && (
                                <div className={styles.section} style={{ marginTop: '2rem' }}>
                                    <h3 className={styles.sectionTitle}>
                                        <GraduationCap size={20} /> Matrículas Activas
                                    </h3>
                                    {matriculas.map(matricula => (
                                        <div key={matricula.id} className={styles.grid} style={{ marginTop: '1rem' }}>
                                            <div className={styles.field}>
                                                <span className={styles.label}>Ciclo Formativo</span>
                                                <span className={styles.value}>{matricula.grupo?.ciclo?.nombre || 'Ciclo desconocido'}</span>
                                            </div>
                                            <div className={styles.field}>
                                                <span className={styles.label}>Curso</span>
                                                <span className={styles.value}>{matricula.grupo?.curso}º</span>
                                            </div>
                                            <div className={styles.field}>
                                                <span className={styles.label}>Año Escolar</span>
                                                <span className={styles.value}>{matricula.grupo?.anioEscolar}</span>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}

                            {/* Imparticiones para Profesores */}
                            {imparticiones.length > 0 && (
                                <div className={styles.section} style={{ marginTop: '2rem' }}>
                                    <h3 className={styles.sectionTitle}>
                                        <BookOpen size={20} /> Asignaturas Impartidas
                                    </h3>
                                    {imparticiones.map(imp => (
                                        <div key={imp.id} className={styles.grid} style={{ marginTop: '1rem' }}>
                                            <div className={styles.field}>
                                                <span className={styles.label}>Módulo</span>
                                                <span className={styles.value}>{imp.modulo?.nombre || 'Módulo desconocido'}</span>
                                            </div>
                                            <div className={styles.field}>
                                                <span className={styles.label}>Grupo</span>
                                                <span className={styles.value}>{imp.grupo?.nombre}</span>
                                            </div>
                                            <div className={styles.field}>
                                                <span className={styles.label}>Curso</span>
                                                <span className={styles.value}>{imp.grupo?.curso}º</span>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            </div>
        </Layout>
    );
};

export default Perfil;
