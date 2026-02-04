import React, { useEffect, useState } from 'react';
import Layout from '../components/Layout';
import AccordionView from '../components/AccordionView';
import { useAuth } from '../context/AuthContext';
import { AlertCircle, Clock, XCircle, CheckCircle } from 'lucide-react';
import styles from './Materiales.module.css'; // Reutilizamos estilos de lista

const MisFaltas = () => {
    const { user } = useAuth();
    const [asignaturasConFaltas, setAsignaturasConFaltas] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    useEffect(() => {
        if (user) {
            fetchData();
        }
    }, [user]);

    const fetchData = async () => {
        setLoading(true);
        try {
            // Usar ruta personalizada
            const response = await fetch('https://localhost:9443/api/v1/asistencia/alumno/summary', {
                headers: { 'Accept': 'application/json' },
                credentials: 'include'
            });

            if (response.ok) {
                const data = await response.json();
                setAsignaturasConFaltas(data);
            } else {
                console.error("Error fetching summary:", response.status);
                setError("No se pudieron cargar las faltas. Inténtalo más tarde.");
            }
        } catch (err) {
            console.error("Error de conexión:", err);
            setError("Error de conexión con el servidor.");
        } finally {
            setLoading(false);
        }
    };

    const getStatusIcon = (estado) => {
        switch (estado) {
            case 'F': return <XCircle size={18} color="#ef4444" />;
            case 'R': return <Clock size={18} color="#eab308" />;
            case 'J': return <CheckCircle size={18} color="#3b82f6" />;
            default: return <AlertCircle size={18} color="#64748b" />;
        }
    };

    const getStatusLabel = (estado) => {
        switch (estado) {
            case 'F': return 'Falta Injustificada';
            case 'R': return 'Retraso';
            case 'J': return 'Falta Justificada';
            default: return estado;
        }
    };

    const renderDetalles = (asignatura) => {
        if (!asignatura.detalles || asignatura.detalles.length === 0) {
            return <p className={styles.emptyMessage}>¡Enhorabuena! No tienes faltas ni retrasos en esta asignatura.</p>;
        }

        return (
            <div style={{ padding: '0 1rem 1rem 1rem' }}>
                <div style={{ display: 'flex', gap: '1rem', marginBottom: '1rem', fontSize: '0.9rem', color: '#64748b' }}>
                    <span>Faltas: <b>{asignatura.faltas}</b></span>
                    <span>Retrasos: <b>{asignatura.retrasos}</b></span>
                    <span>Justificadas: <b>{asignatura.justificadas}</b></span>
                </div>
                <ul className={styles.materialList}>
                    {asignatura.detalles.map(detalle => (
                        <li key={detalle.id} className={styles.materialItem} style={{ alignItems: 'flex-start' }}>
                            <div className={styles.materialInfo}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontWeight: '500' }}>
                                    {getStatusIcon(detalle.estado)}
                                    <span>{getStatusLabel(detalle.estado)}</span>
                                </div>
                                <span className={styles.date}>
                                    {new Date(detalle.fecha).toLocaleDateString()} a las {detalle.hora}
                                </span>
                                {detalle.comentario && (
                                    <div style={{ fontSize: '0.85rem', color: '#64748b', marginTop: '0.25rem', fontStyle: 'italic' }}>
                                        "{detalle.comentario}"
                                    </div>
                                )}
                            </div>
                        </li>
                    ))}
                </ul>
            </div>
        );
    };

    return (
        <Layout>
            <div className={styles.container}>
                <h1 className={styles.pageTitle}>Mis Faltas de Asistencia</h1>
                {loading ? (
                    <p>Cargando...</p>
                ) : error ? (
                    <p className={styles.error}>{error}</p>
                ) : asignaturasConFaltas.length === 0 ? (
                    <div className={styles.emptyState}>No estás matriculado en ninguna asignatura.</div>
                ) : (
                    <AccordionView 
                        data={asignaturasConFaltas}
                        renderItem={renderDetalles} 
                        canAdd={false}
                    />
                )}
            </div>
        </Layout>
    );
};

export default MisFaltas;
