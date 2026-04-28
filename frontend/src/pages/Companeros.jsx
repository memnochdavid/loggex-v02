import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import Layout from '../components/Layout';
import CrudHeader from '../components/CrudHeader';
import SearchBar from '../components/SearchBar';
import ThemedSelect from '../components/ThemedSelect';
import UserCard from '../components/UserCard';
import { useAuth } from '../context/AuthContext';
import styles from './Academic.module.css'; // Usar estilos académicos unificados
import { getApiUrl } from '../config/api';
import Lottie from 'lottie-react';
import bookAnimation from '../../public/book.json';
import { useTranslation } from 'react-i18next';
import LoadingView from '../components/LoadingView';

const Companeros = () => {
    const { t } = useTranslation();
    const { user } = useAuth();
    const navigate = useNavigate();
    const [companeros, setCompaneros] = useState([]);
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
            fetchCompaneros();
        }
    }, [user, selectedCentro, selectedGrupo]);

    const fetchCompaneros = async () => {
        setLoading(true);
        try {
            if (isSuperAdmin) {
                // Lógica para SuperAdmin
                if (!selectedGrupo) {
                    setCompaneros([]);
                    setLoading(false);
                    return;
                }

                // Obtener alumnos del grupo seleccionado (vía matrículas)
                const response = await fetch(getApiUrl(`/api/matriculas?grupo=${selectedGrupo}&pagination=false`), {
                    headers: { 'Accept': 'application/ld+json' },
                    credentials: 'include'
                });

                if (response.ok) {
                    const data = await response.json();
                    const items = data['hydra:member'] || data.member || [];
                    // Extraer alumnos únicos
                    const alumnosMap = new Map();
                    items.forEach(m => {
                        if (m.alumno && !alumnosMap.has(m.alumno.id)) {
                            alumnosMap.set(m.alumno.id, m.alumno);
                        }
                    });
                    setCompaneros(Array.from(alumnosMap.values()));
                }
            } else {
                // Lógica para Alumno normal
                const response = await fetch(getApiUrl('/api/v1/alumno/companeros'), {
                    headers: { 'Accept': 'application/json' },
                    credentials: 'include'
                });

                if (response.ok) {
                    const data = await response.json();
                    setCompaneros(data);
                }
            }
        } catch (error) {
            console.error("Error cargando compañeros:", error);
        } finally {
            setLoading(false);
        }
    };

    const handleMessage = (targetUser) => {
        navigate('/mensajes', { state: { chatWith: targetUser } });
    };

    const filteredCompaneros = companeros.filter(c => {
        if (!searchTerm) return true;
        const value = c[searchField]?.toLowerCase() || '';
        return value.includes(searchTerm.toLowerCase());
    });

    return (
        <Layout>
            <div className={styles.container}>
                <CrudHeader title={t('classmates.title')}
 subtitle={t('classmates.subtitle')}
                            logo={<Lottie animationData={bookAnimation} loop={true} style={{ width: 56, height: 56 }} />}
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
                        placeholder={t('classmates.searchPlaceholder')}
                        fields={searchFields}
                        selectedField={searchField}
                        onFieldChange={setSearchField}
                    />
                </CrudHeader>

                {loading ? (
                    <LoadingView />
                ) : (
                    <div className={styles.grid}>
                        {filteredCompaneros.map(comp => (
                            <UserCard 
                                key={comp.id} 
                                user={comp} 
                                onMessage={handleMessage} 
                            />
                        ))}
                        {filteredCompaneros.length === 0 && (
                            <div className={styles.emptyState}>
                                {isSuperAdmin && !selectedGrupo 
                                    ? t('classmates.selectGroup')
                                    : t('classmates.noClassmates')}
                            </div>
                        )}
                    </div>
                )}
            </div>
        </Layout>
    );
};

export default Companeros;
