import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import Layout from '../components/Layout';
import CrudHeader from '../components/CrudHeader';
import SearchBar from '../components/SearchBar';
import UserCard from '../components/UserCard';
import { useAuth } from '../context/AuthContext';
import styles from './Academic.module.css'; // Usar estilos académicos unificados
import { getApiUrl } from '../config/api';

const Companeros = () => {
    const { user } = useAuth();
    const navigate = useNavigate();
    const [companeros, setCompaneros] = useState([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [searchField, setSearchField] = useState('nombre');

    const searchFields = [
        { value: 'nombre', label: 'Nombre' },
        { value: 'apellidos', label: 'Apellidos' }
    ];

    useEffect(() => {
        if (user) {
            fetchCompaneros();
        }
    }, [user]);

    const fetchCompaneros = async () => {
        setLoading(true);
        try {
            const response = await fetch(getApiUrl('/api/v1/alumno/companeros'), {
                headers: { 'Accept': 'application/json' },
                credentials: 'include'
            });

            if (response.ok) {
                const data = await response.json();
                setCompaneros(data);
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
                <CrudHeader title="Mis Compañeros">
                    <SearchBar 
                        value={searchTerm} 
                        onChange={setSearchTerm} 
                        placeholder="Buscar compañero..." 
                        fields={searchFields}
                        selectedField={searchField}
                        onFieldChange={setSearchField}
                    />
                </CrudHeader>

                {loading ? (
                    <div className={styles.loadingContainer}>Cargando...</div>
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
                            <div className={styles.emptyState}>No se encontraron compañeros.</div>
                        )}
                    </div>
                )}
            </div>
        </Layout>
    );
};

export default Companeros;
