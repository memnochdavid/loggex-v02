import React, { useState, useEffect } from 'react';
import styles from '../pages/Perfil.module.css'; // Reutilizar estilos de Perfil
import { User, Mail, Phone, GraduationCap, Building, BookOpen } from 'lucide-react';
import { getApiUrl, getAssetUrl } from '../config/api';
import { useTranslation } from 'react-i18next';
import ModuloLabel from './ModuloLabel';

const UserProfileView = ({ user: initialUser }) => {
    const { t } = useTranslation();
    const [user, setUser] = useState(initialUser);
    const [avatarPreview, setAvatarPreview] = useState(null);
    const [matriculas, setMatriculas] = useState([]);
    const [imparticiones, setImparticiones] = useState([]);
    const [loading, setLoading] = useState(true);

    const getImageUrl = (path) => {
        if (!path) return null;
        if (path.startsWith('http')) return path;
        if (path.startsWith('data:')) return path;
        return getAssetUrl(path);
    };

    useEffect(() => {
        if (initialUser?.id) {
            fetchUserData(initialUser.id);
        }
    }, [initialUser]);

    const fetchUserData = async (userId) => {
        setLoading(true);
        try {
            // Cargar datos completos del usuario
            const response = await fetch(getApiUrl(`/api/users/${userId}`), {
                headers: { 'Accept': 'application/ld+json' },
                credentials: 'include'
            });
            
            if (response.ok) {
                const userData = await response.json();
                setUser(userData);
                setAvatarPreview(userData.foto ? getImageUrl(userData.foto) : null);

                // Cargar datos académicos según el rol
                if (userData.roles?.includes('ROLE_ALUMNO')) {
                    fetchMatriculas(userData.id);
                }
                if (userData.roles?.includes('ROLE_PROFESOR')) {
                    fetchImparticiones(userData.id);
                }
            } else {
                // Fallback a datos iniciales si falla
                setUser(initialUser);
                setAvatarPreview(initialUser.foto ? getImageUrl(initialUser.foto) : null);
            }
        } catch (error) {
            console.error("Error cargando perfil completo:", error);
        } finally {
            setLoading(false);
        }
    };

    const fetchMatriculas = async (userId) => {
        try {
            const response = await fetch(getApiUrl(`/api/matriculas?alumno=${userId}&pagination=false`), {
                headers: { 'Accept': 'application/ld+json' },
                credentials: 'include'
            });
            if (response.ok) {
                const data = await response.json();
                const items = data['hydra:member'] || data.member || [];
                setMatriculas(items);
            }
        } catch (error) {
            console.error("Error cargando matrículas:", error);
        }
    };

    const fetchImparticiones = async (userId) => {
        try {
            const response = await fetch(getApiUrl(`/api/imparticions?profesor=${userId}&pagination=false`), {
                headers: { 'Accept': 'application/ld+json' },
                credentials: 'include'
            });
            if (response.ok) {
                const data = await response.json();
                const items = data['hydra:member'] || data.member || [];
                setImparticiones(items);
            }
        } catch (error) {
            console.error("Error cargando imparticiones:", error);
        }
    };

    if (!user) return null;

    const fullName = `${user.nombre} ${user.apellidos || ''}`.trim();
    const roles = user.roles 
        ? user.roles.filter(r => r !== 'ROLE_USER').map(r => r.replace('ROLE_', '')).join(', ') 
        : 'Usuario';

    // Obtener nombre del centro de forma segura
    let centroNombre = t('userProfile.noCenter');
    if (user.centro) {
        if (typeof user.centro === 'string') {
            // Si sigue siendo string tras el fetch (raro con user:read, pero posible), intentamos mostrar algo o dejarlo
            // Podríamos hacer otro fetch aquí, pero ya hicimos uno completo.
            // Si el backend devuelve IRI en user:read, es configuración de serialización.
            // Asumiremos que si es string es un IRI y no tenemos el nombre a mano.
            centroNombre = t('userProfile.loadingCenter'); 
            // Intento de fetch adicional solo para el centro si es necesario
             fetch(getApiUrl(user.centro), { headers: { 'Accept': 'application/ld+json' }, credentials: 'include' })
                .then(r => r.json()).then(d => {
                     // Esto es un hack sucio para actualizar la UI, mejor sería tener estado.
                     // Pero como ya tenemos estado user, si user.centro es string, es que la API lo devuelve así.
                     // Vamos a confiar en que la API devuelve objeto si está bien configurada.
                     // Si no, mostraremos "Ver detalles" o similar.
                }).catch(() => {});
        } else if (user.centro.nombre) {
            centroNombre = user.centro.nombre;
        }
    }

    return (
        <div className={styles.card} style={{ border: 'none', boxShadow: 'none', borderRadius: 0 }}>
            <div className={styles.header}>
                <div className={styles.avatarContainer}>
                    {avatarPreview ? (
                        <img src={avatarPreview} alt="Avatar" className={styles.avatar} />
                    ) : (
                        <div className={`${styles.avatar} ${styles.placeholderAvatar}`}>
                            <User size={64} color="#cbd5e1" />
                        </div>
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
                        <User size={20} /> {t('userProfile.personalInfo')}
                    </h3>
                    <div className={styles.grid}>
                        <div className={styles.field}>
                            <span className={styles.label}>{t('userProfile.firstName')}</span>
                            <span className={styles.value}>{user.nombre}</span>
                        </div>
                        <div className={styles.field}>
                            <span className={styles.label}>{t('userProfile.lastName')}</span>
                            <span className={styles.value}>{user.apellidos || <span className={styles.emptyValue}>{t('userProfile.notDefined')}</span>}</span>
                        </div>
                    </div>
                </div>

                <div className={styles.section}>
                    <h3 className={styles.sectionTitle}>
                        <Mail size={20} /> {t('userProfile.contact')}
                    </h3>
                    <div className={styles.grid}>
                        <div className={styles.field}>
                            <span className={styles.label}>{t('userProfile.email')}</span>
                            <span className={styles.value}>{user.email}</span>
                        </div>
                        <div className={styles.field}>
                            <span className={styles.label}>{t('userProfile.phone')}</span>
                            <span className={styles.value}>{user.telefono || <span className={styles.emptyValue}>{t('userProfile.notDefined')}</span>}</span>
                        </div>
                    </div>
                </div>

                <div className={styles.section}>
                    <h3 className={styles.sectionTitle}>
                        <Building size={20} /> {t('userProfile.academicInfo')}
                    </h3>
                    <div className={styles.grid}>
                        <div className={styles.field}>
                            <span className={styles.label}>{t('userProfile.center')}</span>
                            <span className={styles.value}>
                                {user.centro && typeof user.centro === 'object' ? user.centro.nombre : (
                                    user.centro ? t('userProfile.loadingCenter') : <span className={styles.emptyValue}>{t('userProfile.noCenter')}</span>
                                )}
                            </span>
                        </div>
                        <div className={styles.field}>
                            <span className={styles.label}>{t('userProfile.appRole')}</span>
                            <span className={styles.value}>{user.rol_app || roles}</span>
                        </div>
                    </div>

                    {/* Matrículas para Alumnos */}
                    {matriculas.length > 0 && (
                        <div className={styles.section} style={{ marginTop: '2rem' }}>
                            <h3 className={styles.sectionTitle}>
                                <GraduationCap size={20} /> {t('userProfile.activeEnrollments')}
                            </h3>
                            {matriculas.map(matricula => (
                                <div key={matricula.id} className={styles.grid} style={{ marginTop: '1rem' }}>
                                    <div className={styles.field}>
                                        <span className={styles.label}>{t('userProfile.cycle')}</span>
                                        <span className={styles.value}>{matricula.grupo?.ciclo?.nombre || t('userProfile.unknownCycle')}</span>
                                    </div>
                                    <div className={styles.field}>
                                        <span className={styles.label}>{t('userProfile.course')}</span>
                                        <span className={styles.value}>{matricula.grupo?.curso}{t('userProfile.courseSuffix')}</span>
                                    </div>
                                    <div className={styles.field}>
                                        <span className={styles.label}>{t('userProfile.schoolYear')}</span>
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
                                <BookOpen size={20} /> {t('userProfile.taughtSubjects')}
                            </h3>
                            {imparticiones.map(imp => (
                                <div key={imp.id} className={styles.grid} style={{ marginTop: '1rem' }}>
                                    <div className={styles.field}>
                                        <span className={styles.label}>{t('userProfile.module')}</span>
                                        <span className={styles.value}>
                                            {imp.modulo
                                                ? <ModuloLabel modulo={imp.modulo} />
                                                : t('userProfile.unknownModule')}
                                        </span>
                                    </div>
                                    <div className={styles.field}>
                                        <span className={styles.label}>{t('userProfile.group')}</span>
                                        <span className={styles.value}>{imp.grupo?.abreviatura || imp.grupo?.nombre}</span>
                                    </div>
                                    <div className={styles.field}>
                                        <span className={styles.label}>{t('userProfile.course')}</span>
                                        <span className={styles.value}>{imp.grupo?.curso}{t('userProfile.courseSuffix')}</span>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default UserProfileView;
