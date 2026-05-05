import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import Layout from '../components/Layout';
import CrudHeader from '../components/CrudHeader';
import AccordionView from '../components/AccordionView';
import UserCard from '../components/UserCard';
import ThemedSelect from '../components/ThemedSelect';
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
    const [expandedId, setExpandedId] = useState(null);

    const isSuperAdmin = user?.roles?.includes('ROLE_SUPER_ADMIN') || user?.roles?.includes('ROLE_SUPERADMIN');

    // Estados para filtros de SuperAdmin
    const [centros, setCentros] = useState([]);
    const [selectedCentro, setSelectedCentro] = useState('');
    const [allGruposCentro, setAllGruposCentro] = useState([]);
    const [selectedYear, setSelectedYear] = useState('');
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

    // Cargar grupos del centro para filtro de año escolar
    useEffect(() => {
        if (isSuperAdmin && selectedCentro) {
            fetch(getApiUrl(`/api/grupos?centro=${selectedCentro}&pagination=false`), {
                headers: { 'Accept': 'application/ld+json' },
                credentials: 'include'
            })
            .then(res => res.json())
            .then(data => {
                const items = data['hydra:member'] || data.member || [];
                setAllGruposCentro(items);
                setSelectedYear('');
            })
            .catch(err => console.error("Error cargando grupos:", err));
        } else {
            setAllGruposCentro([]);
            setSelectedYear('');
        }
    }, [selectedCentro, isSuperAdmin]);

    const availableYears = [...new Set(allGruposCentro.map(g => g.anioEscolar).filter(Boolean))].sort().reverse();
    const filteredGrupoIds = selectedYear
        ? allGruposCentro.filter(g => g.anioEscolar === selectedYear).map(g => String(g.id))
        : null;

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
    }, [user, selectedCentro, selectedProfesor, selectedYear]);

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
                                moduloNombre: imp.materia?.nombre, // Nombre de la asignatura
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
                    let gruposList = gruposData['hydra:member'] || gruposData.member || [];

                    // Filtrar por año escolar si está seleccionado
                    if (selectedYear) {
                        gruposList = gruposList.filter(g => g.anioEscolar === selectedYear);
                    }

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

            // Adaptar para AccordionView. Formato exacto pedido: "[curso]º [grupo] - [n] alumnos"
            // donde [grupo] = nombre del grupo (no abreviatura).
            const adaptedData = data.map(item => {
                const cursoPrefix = item.curso ? `${item.curso}º ` : '';
                const count = item.alumnos ? item.alumnos.length : 0;
                const title = `${cursoPrefix}${item.nombre} - ${t('myStudents.studentCount', { count })}`;

                return {
                    ...item,
                    title,
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
 subtitle={t('myStudents.subtitle')}
                            breadcrumbs={[
                                { label: t('sidebar.home'), to: '/' },
                                { label: t('myStudents.title') },
                            ]}
                            logo={<Lottie animationData={pupilsAnimation} loop={true} style={{ width: 56, height: 56 }} />}
                >
                    {isSuperAdmin && (
                        <div style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
                            <ThemedSelect
                                value={selectedCentro}
                                onChange={setSelectedCentro}
                                minWidth={200}
                                ariaLabel={t('common.allCenters')}
                                options={[
                                    { value: '', label: t('common.allCenters') },
                                    ...centros.map(c => ({ value: String(c.id), label: c.nombre })),
                                ]}
                            />
                            {availableYears.length > 0 && (
                                <ThemedSelect
                                    value={selectedYear}
                                    onChange={(v) => { setSelectedYear(v); setSelectedProfesor(''); }}
                                    disabled={!selectedCentro}
                                    minWidth={140}
                                    ariaLabel={t('grades.allYears')}
                                    options={[
                                        { value: '', label: t('grades.allYears') },
                                        ...availableYears.map(y => ({ value: y, label: y })),
                                    ]}
                                />
                            )}
                            <ThemedSelect
                                value={selectedProfesor}
                                onChange={setSelectedProfesor}
                                disabled={!selectedCentro}
                                minWidth={200}
                                ariaLabel={t('common.allTeachers')}
                                options={[
                                    { value: '', label: t('common.allTeachers') },
                                    ...profesores.map(p => ({ value: String(p.id), label: `${p.nombre} ${p.apellidos}` })),
                                ]}
                            />
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
                        expandedId={expandedId}
                        onToggle={(id) => setExpandedId(prev => prev === id ? null : id)}
                    />
                )}
            </div>
        </Layout>
    );
};

export default MisAlumnos;
