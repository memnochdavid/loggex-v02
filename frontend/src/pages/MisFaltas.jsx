import React, { useEffect, useState } from 'react';
import Layout from '../components/Layout';
import AccordionView from '../components/AccordionView';
import CrudHeader from '../components/CrudHeader';
import { useAuth } from '../context/AuthContext';
import { AlertCircle, Clock, XCircle, CheckCircle } from 'lucide-react';
import styles from './Academic.module.css'; // Usar estilos académicos unificados
import { getApiUrl } from '../config/api';
import ShowProgress from '../components/ShowProgress'; // Importar el nuevo componente

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
            const response = await fetch(getApiUrl('/api/v1/asistencia/alumno/summary'), {
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

    const renderHeader = (item, isOpen) => {
        return (
            <div style={{ width: '100%', paddingRight: '1rem' }}>
                <div className={styles.accordionHeaderContentAttendance}>
                    <span style={{ flex: 1 }}>{item.title}</span>
                    <ShowProgress percentage={item.porcentajeFaltas} height="15px" showLabel={true} />
                </div>
            </div>
        );
    };

    const renderDetalles = (asignatura) => {
        if (!asignatura.detalles || asignatura.detalles.length === 0) {
            return <div className={styles.emptyState}>¡Enhorabuena! No tienes faltas ni retrasos en esta asignatura.</div>;
        }

        return (
            <div style={{ padding: '0 1rem 1rem 1rem' }}>
                <div style={{ display: 'flex', gap: '1rem', marginBottom: '1rem', fontSize: '0.9rem', color: '#64748b', flexWrap: 'wrap' }}>
                    <span>Faltas: <b>{asignatura.faltas}</b></span>
                    <span>Retrasos: <b>{asignatura.retrasos}</b></span>
                    <span>Justificadas: <b>{asignatura.justificadas}</b></span>
                    {asignatura.totalHoras > 0 && (
                        <span>Total Horas Impartidas: <b>{asignatura.totalHoras}</b></span>
                    )}
                </div>
                <ul className={styles.list}>
                    {asignatura.detalles.map(detalle => (
                        <li key={detalle.id} className={styles.listItem} style={{ alignItems: 'flex-start' }}>
                            <div className={styles.itemInfo}>
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
                <CrudHeader title="Mis Faltas de Asistencia" />
                
                {loading ? (
                    <div className={styles.loadingContainer}>Cargando...</div>
                ) : error ? (
                    <div className={styles.errorContainer}>{error}</div>
                ) : asignaturasConFaltas.length === 0 ? (
                    <div className={styles.emptyState}>No estás matriculado en ninguna asignatura.</div>
                ) : (
                    <AccordionView 
                        data={asignaturasConFaltas}
                        renderItem={renderDetalles}
                        renderHeader={renderHeader}
                        canAdd={false}
                    />
                )}
            </div>
        </Layout>
    );
};

export default MisFaltas;
