import React, { useEffect, useState } from 'react';
import { Check, X, Clock, AlertCircle } from 'lucide-react';
import { getApiUrl, getAssetUrl } from '../config/api';
import styles from './AsistenciaModal.module.css';
import AccordionView from './AccordionView';

const AsistenciaModal = ({ imparticionId, fecha, hora, onClose, onDataChange }) => {
    const [alumnos, setAlumnos] = useState([]);
    const [loading, setLoading] = useState(true);
    const [isMobile, setIsMobile] = useState(window.innerWidth <= 768);
    const [expandedId, setExpandedId] = useState(null);

    useEffect(() => {
        const handleResize = () => setIsMobile(window.innerWidth <= 768);
        window.addEventListener('resize', handleResize);
        return () => window.removeEventListener('resize', handleResize);
    }, []);

    useEffect(() => {
        fetchData();
    }, [imparticionId, fecha, hora]);

    // Notificar cambios al padre cada vez que cambian los alumnos
    useEffect(() => {
        if (onDataChange && !loading && alumnos.length > 0) {
            onDataChange({
                imparticionId,
                fecha,
                hora,
                alumnos
            });
        }
    }, [alumnos, loading, onDataChange, imparticionId, fecha, hora]);

    const fetchData = async () => {
        setLoading(true);
        try {
            const response = await fetch(getApiUrl(`/api/v1/asistencia/sheet?imparticion=${imparticionId}&fecha=${fecha}&hora=${hora}`), {
                headers: { 'Accept': 'application/json' },
                credentials: 'include'
            });
            if (response.ok) {
                const data = await response.json();
                const initializedData = data.map(a => ({
                    ...a,
                    estado: a.asistencia ? a.asistencia.estado : 'P',
                    comentario: a.asistencia ? a.asistencia.comentario : ''
                }));
                setAlumnos(initializedData);
            }
        } catch (error) {
            console.error("Error cargando alumnos:", error);
        } finally {
            setLoading(false);
        }
    };

    const handleEstadoChange = (alumnoId, nuevoEstado) => {
        setAlumnos(prev => prev.map(a =>
            a.id === alumnoId ? { ...a, estado: nuevoEstado } : a
        ));
    };

    const handleComentarioChange = (alumnoId, texto) => {
        setAlumnos(prev => prev.map(a =>
            a.id === alumnoId ? { ...a, comentario: texto } : a
        ));
    };

    const handleToggle = (id) => {
        setExpandedId(prevId => (prevId === id ? null : id));
    };

    if (loading) return <div className={styles.loading}>Cargando lista...</div>;

    const renderMobileItem = (alumno) => (
        <div className={styles.mobileItemContent}>
            <div className={styles.mobileActions}>
                <button
                    type="button"
                    onClick={() => handleEstadoChange(alumno.id, 'P')}
                    className={`${styles.mobileActionButton} ${alumno.estado === 'P' ? styles.mobileActionButtonActiveP : ''}`}
                >
                    <Check size={20} />
                    <span className={styles.mobileActionLabel}>Presente</span>
                </button>
                <button
                    type="button"
                    onClick={() => handleEstadoChange(alumno.id, 'F')}
                    className={`${styles.mobileActionButton} ${alumno.estado === 'F' ? styles.mobileActionButtonActiveF : ''}`}
                >
                    <X size={20} />
                    <span className={styles.mobileActionLabel}>Falta</span>
                </button>
                <button
                    type="button"
                    onClick={() => handleEstadoChange(alumno.id, 'R')}
                    className={`${styles.mobileActionButton} ${alumno.estado === 'R' ? styles.mobileActionButtonActiveR : ''}`}
                >
                    <Clock size={20} />
                    <span className={styles.mobileActionLabel}>Retraso</span>
                </button>
                <button
                    type="button"
                    onClick={() => handleEstadoChange(alumno.id, 'J')}
                    className={`${styles.mobileActionButton} ${alumno.estado === 'J' ? styles.mobileActionButtonActiveJ : ''}`}
                >
                    <AlertCircle size={20} />
                    <span className={styles.mobileActionLabel}>Justif.</span>
                </button>
            </div>
            <input
                type="text"
                value={alumno.comentario || ''}
                onChange={(e) => handleComentarioChange(alumno.id, e.target.value)}
                placeholder="Añadir comentario..."
                className={styles.inputComentario}
            />
        </div>
    );

    const renderMobileHeader = (alumno) => (
        <div className={styles.tdAlumno}>
            <div className={styles.avatar}>
                {alumno.foto ? (
                    <img src={getAssetUrl(alumno.foto)} alt="" className={styles.avatarImg} />
                ) : (
                    <div className={styles.avatarPlaceholder}>
                        {alumno.nombre.charAt(0)}
                    </div>
                )}
            </div>
            <div className={styles.alumnoName}>{alumno.apellidos}, {alumno.nombre}</div>
        </div>
    );

    return (
        <div className={styles.container}>
            <div className={styles.tableContainer}>
                {isMobile ? (
                    <AccordionView
                        data={alumnos}
                        renderItem={renderMobileItem}
                        renderHeader={renderMobileHeader}
                        expandedId={expandedId}
                        onToggle={handleToggle}
                    />
                ) : (
                    <table className={styles.table}>
                        <thead>
                        <tr className={styles.tr}>
                            <th className={styles.th}>Alumno</th>
                            <th className={styles.thCenter}>Estado</th>
                            <th className={styles.th}>Comentario</th>
                        </tr>
                        </thead>
                        <tbody>
                        {alumnos.map(alumno => (
                            <tr key={alumno.id} className={styles.tr}>
                                <td className={styles.tdAlumno}>
                                    <div className={styles.avatar}>
                                        {alumno.foto ? (
                                            <img src={getAssetUrl(alumno.foto)} alt="" className={styles.avatarImg} />
                                        ) : (
                                            <div className={styles.avatarPlaceholder}>
                                                {alumno.nombre.charAt(0)}
                                            </div>
                                        )}
                                    </div>
                                    <div>
                                        <div className={styles.alumnoName}>{alumno.apellidos}, {alumno.nombre}</div>
                                    </div>
                                </td>
                                <td className={styles.tdActions}>
                                    <div className={styles.actionsContainer}>
                                        <button
                                            type="button"
                                            onClick={() => handleEstadoChange(alumno.id, 'P')}
                                            title="Presente"
                                            className={alumno.estado === 'P' ? styles.btnPresenteActive : styles.btnPresente}
                                        >
                                            <Check size={16} />
                                        </button>
                                        <button
                                            type="button"
                                            onClick={() => handleEstadoChange(alumno.id, 'F')}
                                            title="Falta"
                                            className={alumno.estado === 'F' ? styles.btnFaltaActive : styles.btnFalta}
                                        >
                                            <X size={16} />
                                        </button>
                                        <button
                                            type="button"
                                            onClick={() => handleEstadoChange(alumno.id, 'R')}
                                            title="Retraso"
                                            className={alumno.estado === 'R' ? styles.btnRetrasoActive : styles.btnRetraso}
                                        >
                                            <Clock size={16} />
                                        </button>
                                        <button
                                            type="button"
                                            onClick={() => handleEstadoChange(alumno.id, 'J')}
                                            title="Justificada"
                                            className={alumno.estado === 'J' ? styles.btnJustificadaActive : styles.btnJustificada}
                                        >
                                            <AlertCircle size={16} />
                                        </button>
                                    </div>
                                </td>
                                <td className={styles.tdComentario}>
                                    <input
                                        type="text"
                                        value={alumno.comentario || ''}
                                        onChange={(e) => handleComentarioChange(alumno.id, e.target.value)}
                                        placeholder="..."
                                        className={styles.inputComentario}
                                    />
                                </td>
                            </tr>
                        ))}
                        </tbody>
                    </table>
                )}
            </div>
        </div>
    );
};

export default AsistenciaModal;