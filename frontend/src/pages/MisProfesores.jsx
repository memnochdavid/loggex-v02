import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import Layout from '../components/Layout';
import CrudHeader from '../components/CrudHeader';
import SearchBar from '../components/SearchBar';
import UserCard from '../components/UserCard';
import { useAuth } from '../context/AuthContext';
import styles from './Claustro.module.css'; // Reutilizamos estilos
import { getApiUrl } from '../config/api';

const MisProfesores = () => {
    const { user } = useAuth();
    const navigate = useNavigate();
    const [profesores, setProfesores] = useState([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [searchField, setSearchField] = useState('nombre');

    const searchFields = [
        { value: 'nombre', label: 'Nombre' },
        { value: 'apellidos', label: 'Apellidos' }
    ];

    useEffect(() => {
        if (user) {
            fetchProfesores();
        }
    }, [user]);

    const fetchProfesores = async () => {
        setLoading(true);
        try {
            const response = await fetch(getApiUrl('/api/v1/alumno/profesores'), {
                headers: { 'Accept': 'application/json' },
                credentials: 'include'
            });

            if (response.ok) {
                const data = await response.json();
                // Adaptar datos para UserCard si es necesario
                const adaptedData = data.map(p => ({
                    ...p,
                    grupos: p.asignaturas // UserCard usa 'grupos' para mostrar lista extra
                }));
                setProfesores(adaptedData);
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
                <CrudHeader title="Mis Profesores">
                    <SearchBar 
                        value={searchTerm} 
                        onChange={setSearchTerm} 
                        placeholder="Buscar profesor..." 
                        fields={searchFields}
                        selectedField={searchField}
                        onFieldChange={setSearchField}
                    />
                </CrudHeader>

                {loading ? (
                    <p>Cargando...</p>
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
                            <p className={styles.empty}>No se encontraron profesores.</p>
                        )}
                    </div>
                )}
            </div>
        </Layout>
    );
};

export default MisProfesores;
