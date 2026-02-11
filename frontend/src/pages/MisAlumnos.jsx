import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import Layout from '../components/Layout';
import CrudHeader from '../components/CrudHeader';
import AccordionView from '../components/AccordionView';
import UserCard from '../components/UserCard';
import { useAuth } from '../context/AuthContext';
import styles from './Academic.module.css'; // Usar estilos académicos unificados
import { getApiUrl } from '../config/api';

const MisAlumnos = () => {
    const { user } = useAuth();
    const navigate = useNavigate();
    const [grupos, setGrupos] = useState([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        if (user) {
            fetchAlumnos();
        }
    }, [user]);

    const fetchAlumnos = async () => {
        setLoading(true);
        try {
            const response = await fetch(getApiUrl('/api/v1/profesor/alumnos'), {
                headers: { 'Accept': 'application/json' },
                credentials: 'include'
            });

            if (response.ok) {
                const data = await response.json();
                // Adaptar para AccordionView (necesita 'title')
                const adaptedData = data.map(g => ({
                    ...g,
                    title: `${g.nombre} ${g.abreviatura ? `(${g.abreviatura})` : ''} - ${g.alumnos.length} alumnos`
                }));
                setGrupos(adaptedData);
            }
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
        if (grupo.alumnos.length === 0) {
            return <p className={styles.emptyState}>No hay alumnos en este grupo.</p>;
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
                <CrudHeader title="Mis Alumnos" />

                {loading ? (
                    <div className={styles.loadingContainer}>Cargando...</div>
                ) : grupos.length === 0 ? (
                    <div className={styles.emptyState}>
                        No tienes alumnos asignados.
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
