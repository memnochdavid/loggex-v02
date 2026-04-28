import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import Layout from '../components/Layout';
import CrudHeader from '../components/CrudHeader';
import SearchBar from '../components/SearchBar';
import UserCard from '../components/UserCard';
import ThemedSelect from '../components/ThemedSelect';
import { useAuth } from '../context/AuthContext';
import styles from './Academic.module.css'; // Usar estilos académicos unificados
import { getApiUrl } from '../config/api';
import Lottie from 'lottie-react';
import teacherAnimation from '../../public/teacher.json';
import { useTranslation } from 'react-i18next';
import LoadingView from '../components/LoadingView';

const MisProfesores = () => {
    const { t } = useTranslation();
    const { user } = useAuth();
    const navigate = useNavigate();
    const [profesores, setProfesores] = useState([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [searchField, setSearchField] = useState('nombre');

    const isSuperAdmin = user?.roles?.includes('ROLE_SUPER_ADMIN') || user?.roles?.includes('ROLE_SUPERADMIN');

    // Estados para filtros de SuperAdmin
    const [centros, setCentros] = useState([]);
    const [selectedCentro, setSelectedCentro] = useState('');
    const [grupos, setGrupos] = useState([]);
    const [selectedGrupo, setSelectedGrupo] = useState('');

    const searchFields = [
        { value: 'nombre', label: t('users.firstName') },
        { value: 'apellidos', label: t('users.lastName') }
    ];

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

    // Cargar grupos cuando cambia el centro seleccionado
    useEffect(() => {
        if (isSuperAdmin && selectedCentro) {
            fetch(getApiUrl(`/api/grupos?centro=${selectedCentro}&pagination=false`), {
                headers: { 'Accept': 'application/ld+json' },
                credentials: 'include'
            })
            .then(res => res.json())
            .then(data => {
                const items = data['hydra:member'] || data.member || [];
                setGrupos(items);
                setSelectedGrupo('');
            })
            .catch(err => console.error("Error cargando grupos:", err));
        } else {
            setGrupos([]);
            setSelectedGrupo('');
        }
    }, [selectedCentro, isSuperAdmin]);

    useEffect(() => {
        if (user) {
            fetchProfesores();
        }
    }, [user, selectedCentro, selectedGrupo]);

    const fetchProfesores = async () => {
        setLoading(true);
        try {
            if (isSuperAdmin) {
                // Lógica para SuperAdmin
                if (!selectedGrupo) {
                    setProfesores([]);
                    setLoading(false);
                    return;
                }

                // Obtener imparticiones del grupo seleccionado para sacar los profesores
                const response = await fetch(getApiUrl(`/api/imparticions?grupo=${selectedGrupo}&pagination=false`), {
                    headers: { 'Accept': 'application/ld+json' },
                    credentials: 'include'
                });

                if (response.ok) {
                    const data = await response.json();
                    const items = data['hydra:member'] || data.member || [];
                    
                    // Extraer profesores únicos y sus asignaturas
                    const profesoresMap = new Map();
                    
                    items.forEach(imp => {
                        const prof = imp.profesor;
                        if (prof) {
                            if (!profesoresMap.has(prof.id)) {
                                profesoresMap.set(prof.id, {
                                    ...prof,
                                    grupos: [] // Usamos 'grupos' para mostrar asignaturas en UserCard
                                });
                            }
                            // Añadir asignatura a la lista del profesor
                            if (imp.materia) {
                                profesoresMap.get(prof.id).grupos.push(imp.materia.nombre);
                            }
                        }
                    });
                    
                    setProfesores(Array.from(profesoresMap.values()));
                }
            } else {
                // Lógica para Alumno normal
                const response = await fetch(getApiUrl('/api/v1/alumno/profesores'), {
                    headers: { 'Accept': 'application/json' },
                    credentials: 'include'
                });

                if (response.ok) {
                    const data = await response.json();
                    // Adaptar datos para UserCard
                    const adaptedData = data.map(p => ({
                        ...p,
                        grupos: p.asignaturas // UserCard usa 'grupos' para mostrar lista extra
                    }));
                    setProfesores(adaptedData);
                }
            }
        } catch (error) {
            console.error("Error cargando profesores:", error);
        } finally {
            setLoading(false);
        }
    };

    const handleMessage = (targetUser) => {
        navigate('/mensajes', { state: { chatWith: targetUser } });
    };

    const filteredProfesores = profesores.filter(p => {
        if (!searchTerm) return true;
        const value = p[searchField]?.toLowerCase() || '';
        return value.includes(searchTerm.toLowerCase());
    });

    return (
        <Layout>
            <div className={styles.container}>
                <CrudHeader title={t('myTeachers.title')}
 subtitle={t('myTeachers.subtitle')}
                            logo={<Lottie animationData={teacherAnimation} loop={true} style={{ width: 56, height: 56 }} />}
                >
                    {isSuperAdmin && (
                        <div style={{ display: 'flex', gap: '1rem', alignItems: 'center', marginRight: '1rem' }}>
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
                            <ThemedSelect
                                value={selectedGrupo}
                                onChange={setSelectedGrupo}
                                disabled={!selectedCentro}
                                minWidth={150}
                                ariaLabel={t('common.allGroups')}
                                options={[
                                    { value: '', label: t('common.allGroups') },
                                    ...grupos.map(g => ({ value: String(g.id), label: g.nombre })),
                                ]}
                            />
                        </div>
                    )}
                    <SearchBar 
                        value={searchTerm} 
                        onChange={setSearchTerm} 
                        placeholder={t('myTeachers.searchPlaceholder')}
                        fields={searchFields}
                        selectedField={searchField}
                        onFieldChange={setSearchField}
                    />
                </CrudHeader>

                {loading ? (
                    <LoadingView />
                ) : (
                    <div className={styles.grid}>
                        {filteredProfesores.map(prof => (
                            <UserCard 
                                key={prof.id} 
                                user={prof} 
                                onMessage={handleMessage} 
                            />
                        ))}
                        {filteredProfesores.length === 0 && (
                            <div className={styles.emptyState}>
                                {isSuperAdmin && !selectedGrupo 
                                    ? t('myTeachers.selectGroup')
                                    : t('myTeachers.noTeachers')}
                            </div>
                        )}
                    </div>
                )}
            </div>
        </Layout>
    );
};

export default MisProfesores;
