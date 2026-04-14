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
import teacherAnimation from '../../public/teacher.json';
import { useTranslation } from 'react-i18next';
import LoadingView from '../components/LoadingView';

const Claustro = () => {
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

    const searchFields = [
        { value: 'nombre', label: t('users.firstName') },
        { value: 'apellidos', label: t('users.lastName') },
        { value: 'email', label: t('users.email') }
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

    useEffect(() => {
        if (user) {
            fetchProfesores();
        }
    }, [user, selectedCentro]);

    const fetchProfesores = async () => {
        setLoading(true);
        try {
            let url;
            let options = {
                headers: { 'Accept': 'application/json' }, // Por defecto JSON simple para endpoint custom
                credentials: 'include'
            };

            if (isSuperAdmin) {
                // Superadmin usa endpoint estándar de usuarios filtrado por rol y centro
                url = getApiUrl('/api/users?roles=ROLE_PROFESOR&pagination=false');
                if (selectedCentro) {
                    url += `&centro=${selectedCentro}`;
                }
                options.headers['Accept'] = 'application/ld+json'; // API Platform usa ld+json
            } else {
                // Usuarios normales usan el endpoint custom que ya filtra por su contexto
                url = getApiUrl('/api/v1/profesor/claustro');
            }

            const response = await fetch(url, options);

            if (response.ok) {
                const data = await response.json();
                // Normalizar respuesta (endpoint custom devuelve array directo, API Platform devuelve hydra:member)
                const items = Array.isArray(data) ? data : (data['hydra:member'] || data.member || []);
                setProfesores(items);
            }
        } catch (error) {
            console.error("Error cargando claustro:", error);
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
                <CrudHeader title={t('faculty.title')}
                            logo={<Lottie animationData={teacherAnimation} loop={true} style={{ width: 60, height: 60 }} />}
                >
                    {isSuperAdmin && (
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
                    )}
                    <SearchBar 
                        value={searchTerm} 
                        onChange={setSearchTerm} 
                        placeholder={t('faculty.searchPlaceholder')}
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
                                {isSuperAdmin && !selectedCentro 
                                    ? t('faculty.selectCenter') 
                                    : t('faculty.noTeachers')}
                            </div>
                        )}
                    </div>
                )}
            </div>
        </Layout>
    );
};

export default Claustro;
