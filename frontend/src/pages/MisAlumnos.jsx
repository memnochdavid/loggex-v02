import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import Layout from '../components/Layout';
import CrudHeader from '../components/CrudHeader';
import AccordionView from '../components/AccordionView';
import UserCard from '../components/UserCard';
import { useAuth } from '../context/AuthContext';
import styles from './Academic.module.css'; // Usar estilos académicos unificados
import { getApiUrl } from '../config/api';
import Lottie from 'lottie-react';
import pupilsAnimation from '../../public/pupils.json';
import { useTranslation } from 'react-i18next';
import LoadingView from '../components/LoadingView';

const MisAlumnos = () => {
    const { t } = useTranslation();
    const { user } = useAuth();
    const navigate = useNavigate();
    const [grupos, setGrupos] = useState([]);
    const [loading, setLoading] = useState(true);

    const isSuperAdmin = user?.roles?.includes('ROLE_SUPER_ADMIN') || user?.roles?.includes('ROLE_SUPERADMIN');

    // Estados para filtros de SuperAdmin
    const [centros, setCentros] = useState([]);
    const [selectedCentro, setSelectedCentro] = useState('');
    const [profesores, setProfesores] = useState([]);
    const [selectedProfesor, setSelectedProfesor] = useState('');

    // Cargar centros para SuperAdmin
    useEffect(() => {
        if (isSuperAdmin) {
            fetch(getApiUrl('/api/centros?pagination=false'), {
                headers: { 'Accept': 'application/ld+json' },
                credentials: 'include'
            })
            .then(res => res.json())
            .then(data => {
                const items = data['hydra:member'] || data.member || [];
                setCentros(items);
            })
            .catch(err => console.error("Error cargando centros:", err));
        }
    }, [isSuperAdmin]);

    // Cargar profesores cuando cambia el centro seleccionado
    useEffect(() => {
        if (isSuperAdmin && selectedCentro) {
            // Pedimos todos los usuarios del centro y filtramos en cliente por rol
            fetch(getApiUrl(`/api/users?centro=${selectedCentro}&pagination=false`), {
                headers: { 'Accept': 'application/ld+json' },
                credentials: 'include'
            })
            .then(res => res.json())
            .then(data => {
                const items = data['hydra:member'] || data.member || [];
                // Filtrar solo profesores en el cliente
                const soloProfesores = items.filter(u => u.roles && u.roles.includes('ROLE_PROFESOR'));
                setProfesores(soloProfesores);
                setSelectedProfesor(''); // Resetear profesor al cambiar centro
            })
            .catch(err => console.error("Error cargando profesores:", err));
        } else {
            setProfesores([]);
            setSelectedProfesor('');
        }
    }, [selectedCentro, isSuperAdmin]);

    useEffect(() => {
        if (user) {
            fetchAlumnos();
        }
    }, [user, selectedCentro, selectedProfesor]);

    const fetchAlumnos = async () => {
        setLoading(true);
        try {
            let data = [];

            if (isSuperAdmin) {
                if (selectedProfesor) {
                    // Lógica por profesor: Obtener sus imparticiones
                    const impRes = await fetch(getApiUrl(`/api/imparticions?profesor=${selectedProfesor}&pagination=false`), {
                        headers: { 'Accept': 'application/ld+json' },
                        credentials: 'include'
                    });
                    const impData = await impRes.json();
                    const imps = impData['hydra:member'] || impData.member || [];

                    // Agrupar por IMPARTICIÓN (no solo por grupo)
                    // Usamos el ID de la impartición como clave
                    const imparticionesMap = {};
                    const gruposIdsSet = new Set();

                    imps.forEach(imp => {
                        const impId = String(imp.id || imp['@id'].split('/').pop());
                        const g = imp.grupo;
                        if (g) {
                            const gId = String(g.id || g['@id'].split('/').pop());
                            gruposIdsSet.add(gId);
                            
                            imparticionesMap[impId] = {
                                ...g, // Datos del grupo base
                                id: impId, // ID de la impartición (para la key del acordeón)
                                grupoId: gId, // ID real del grupo
                                moduloNombre: imp.modulo?.nombre, // Nombre de la asignatura
                                alumnos: []
                            };
                        }
                    });

                    // Obtener alumnos de los grupos involucrados
                    const grupoIds = Array.from(gruposIdsSet);
                    if (grupoIds.length > 0) {
                        const q = grupoIds.map(id => `grupo[]=${id}`).join('&');
                        const matRes = await fetch(getApiUrl(`/api/matriculas?${q}&pagination=false`), {
                            headers: { 'Accept': 'application/ld+json' },
                            credentials: 'include'
                        });
                        const matData = await matRes.json();
                        const mats = matData['hydra:member'] || matData.member || [];

                        mats.forEach(m => {
                            let gId;
                            if (typeof m.grupo === 'string') {
                                gId = m.grupo.split('/').pop();
                            } else if (m.grupo.id) {
                                gId = m.grupo.id.toString();
                            } else if (m.grupo['@id']) {
                                gId = m.grupo['@id'].split('/').pop();
                            }

                            // Añadir alumno a TODAS las imparticiones de ese grupo
                            if (gId) {
                                Object.values(imparticionesMap).forEach(imp => {
                                    if (imp.grupoId === gId) {
                                        imp.alumnos.push(m.alumno);
                                    }
                                });
                            }
                        });
                    }
                    data = Object.values(imparticionesMap);

                } else if (selectedCentro) {
                    // Lógica por centro: Obtener todos los grupos del centro
                    const gruposRes = await fetch(getApiUrl(`/api/grupos?centro=${selectedCentro}&pagination=false`), {
                        headers: { 'Accept': 'application/ld+json' },
                        credentials: 'include'
                    });
                    const gruposData = await gruposRes.json();
                    const gruposList = gruposData['hydra:member'] || gruposData.member || [];

                    // Obtener alumnos de esos grupos
                    const grupoIds = gruposList.map(g => String(g.id));
                    if (grupoIds.length > 0) {
                        const q = grupoIds.map(id => `grupo[]=${id}`).join('&');
                        const matRes = await fetch(getApiUrl(`/api/matriculas?${q}&pagination=false`), {
                            headers: { 'Accept': 'application/ld+json' },
                            credentials: 'include'
                        });
                        const matData = await matRes.json();
                        const mats = matData['hydra:member'] || matData.member || [];

                        const gruposMap = {};
                        gruposList.forEach(g => {
                            const gId = String(g.id);
                            gruposMap[gId] = { ...g, id: gId, alumnos: [] };
                        });

                        mats.forEach(m => {
                            let gId;
                            if (typeof m.grupo === 'string') {
                                gId = m.grupo.split('/').pop();
                            } else if (m.grupo.id) {
                                gId = m.grupo.id.toString();
                            } else if (m.grupo['@id']) {
                                gId = m.grupo['@id'].split('/').pop();
                            }

                            if (gId && gruposMap[gId]) {
                                gruposMap[gId].alumnos.push(m.alumno);
                            }
                        });
                        data = Object.values(gruposMap);
                    }
                }
            } else {
                // Profesor normal (endpoint custom)
                const response = await fetch(getApiUrl('/api/v1/profesor/alumnos'), {
                    headers: { 'Accept': 'application/json' },
                    credentials: 'include'
                });

                if (response.ok) {
                    data = await response.json();
                }
            }

            // Adaptar para AccordionView
            const adaptedData = data.map(item => {
                // Construir título: Grupo (Asignatura) - X alumnos
                let title = `${item.nombre} ${item.abreviatura ? `(${item.abreviatura})` : ''}`;
                
                // Si tenemos nombre de módulo (asignatura), lo añadimos
                if (item.moduloNombre) {
                    title += ` (${item.moduloNombre})`;
                }
                
                title += ` - ${t('myStudents.studentCount', { count: item.alumnos ? item.alumnos.length : 0 })}`;

                return {
                    ...item,
                    title: title,
                    alumnos: item.alumnos || []
                };
            });
            setGrupos(adaptedData);

        } catch (error) {
            console.error("Error cargando alumnos:", error);
        } finally {
            setLoading(false);
        }
    };

    const handleMessage = (targetUser) => {
        navigate('/mensajes', { state: { chatWith: targetUser } });
    };

    const renderGrupoContent = (grupo) => {
        if (!grupo.alumnos || grupo.alumnos.length === 0) {
            return <p className={styles.emptyState}>{t('myStudents.noStudentsInGroup')}</p>;
        }

        return (
            <div className={styles.grid} style={{ marginTop: 0, padding: '1rem' }}>
                {grupo.alumnos.map(alumno => (
                    <UserCard 
                        key={alumno.id} 
                        user={alumno} 
                        onMessage={handleMessage} 
                    />
                ))}
            </div>
        );
    };

    return (
        <Layout>
            <div className={styles.container}>
                <CrudHeader title={t('myStudents.title')}
                            logo={<Lottie animationData={pupilsAnimation} loop={true} style={{ width: 60, height: 60 }} />}
                >
                    {isSuperAdmin && (
                        <div style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
                            <select 
                                className={styles.select}
                                value={selectedCentro}
                                onChange={(e) => setSelectedCentro(e.target.value)}
                                style={{ minWidth: '200px' }}
                            >
                                <option value="">{t('common.allCenters')}</option>
                                {centros.map(c => (
                                    <option key={c.id} value={c.id}>{c.nombre}</option>
                                ))}
                            </select>

                            <select 
                                className={styles.select}
                                value={selectedProfesor}
                                onChange={(e) => setSelectedProfesor(e.target.value)}
                                disabled={!selectedCentro}
                                style={{ minWidth: '200px' }}
                            >
                                <option value="">{t('common.allTeachers')}</option>
                                {profesores.map(p => (
                                    <option key={p.id} value={p.id}>{p.nombre} {p.apellidos}</option>
                                ))}
                            </select>
                        </div>
                    )}
                </CrudHeader>

                {loading ? (
                    <LoadingView />
                ) : grupos.length === 0 ? (
                    <div className={styles.emptyState}>
                        {isSuperAdmin && !selectedCentro 
                            ? t('myStudents.selectCenter')
                            : t('myStudents.noStudents')}
                    </div>
                ) : (
                    <AccordionView 
                        data={grupos} 
                        renderItem={renderGrupoContent} 
                        canAdd={false}
                    />
                )}
            </div>
        </Layout>
    );
};

export default MisAlumnos;
