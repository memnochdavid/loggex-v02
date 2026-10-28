import React, { useEffect, useState } from 'react';
import { Check, X, Clock, AlertCircle } from 'lucide-react';
import { getApiUrl, getAssetUrl } from '../config/api';
import styles from './AsistenciaModal.module.css';
import AccordionView from './AccordionView';
import { useTranslation } from 'react-i18next';

const AsistenciaModal = ({ imparticionId, fecha, hora, onClose, onDataChange }) => {
    const { t } = useTranslation();
    const [alumnos, setAlumnos] = useState([]);
    // Fase E clases-compartidas: si el bloque es compartido (1º DAW + 1º DAM),
    // el backend devuelve `gruposCompartidos[]` y la tabla añade columna Grupo.
    // Cada alumno trae su `imparticionId` natural (la de SU grupo) para que
    // las asistencias se registren contra la imp correcta — el handleSave del
    // padre lo lee y lo envía por asistencia.
    const [gruposCompartidos, setGruposCompartidos] = useState([]);
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
                // Fase E: el backend devuelve array flat si no hay gemelos
                // (compat con clientes viejos), o `{alumnos, gruposCompartidos}`
                // cuando el bloque es compartido entre grupos hermanos.
                const arr = Array.isArray(data) ? data : (data.alumnos ?? []);
                const grupos = Array.isArray(data) ? [] : (data.gruposCompartidos ?? []);
                const initializedData = arr.map(a => ({
                    ...a,
                    estado: a.asistencia ? a.asistencia.estado : 'P',
                    comentario: a.asistencia ? a.asistencia.comentario : ''
                }));
                setAlumnos(initializedData);
                setGruposCompartidos(grupos);
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

    if (loading) return <div className={styles.loading}>{t('attendance.loading')}</div>;

    const renderMobileItem = (alumno) => (
        <div className={styles.mobileItemContent}>
            <div className={styles.mobileActions}>
                <button
                    type="button"
                    onClick={() => handleEstadoChange(alumno.id, 'P')}
                    className={`${styles.mobileActionButton} ${alumno.estado === 'P' ? styles.mobileActionButtonActiveP : ''}`}
                >
                    <Check size={20} />
                    <span className={styles.mobileActionLabel}>{t('attendance.present')}</span>
                </button>
                <button
                    type="button"
                    onClick={() => handleEstadoChange(alumno.id, 'F')}
                    className={`${styles.mobileActionButton} ${alumno.estado === 'F' ? styles.mobileActionButtonActiveF : ''}`}
                >
                    <X size={20} />
                    <span className={styles.mobileActionLabel}>{t('attendance.absent')}</span>
                </button>
                <button
                    type="button"
                    onClick={() => handleEstadoChange(alumno.id, 'R')}
                    className={`${styles.mobileActionButton} ${alumno.estado === 'R' ? styles.mobileActionButtonActiveR : ''}`}
                >
                    <Clock size={20} />
                    <span className={styles.mobileActionLabel}>{t('attendance.late')}</span>
                </button>
                <button
                    type="button"
                    onClick={() => handleEstadoChange(alumno.id, 'J')}
                    className={`${styles.mobileActionButton} ${alumno.estado === 'J' ? styles.mobileActionButtonActiveJ : ''}`}
                >
                    <AlertCircle size={20} />
                    <span className={styles.mobileActionLabel}>{t('attendance.justifiedShort')}</span>
                </button>
            </div>
            <input
                type="text"
                value={alumno.comentario || ''}
                onChange={(e) => handleComentarioChange(alumno.id, e.target.value)}
                placeholder={t('attendance.commentPlaceholder')}
                className={styles.inputComentario}
            />
        </div>
    );

    const showGrupoCol = gruposCompartidos.length > 1;

    // Fase E: chip pequeño con el curso+abreviatura del grupo del alumno
    // (solo cuando la hoja es compartida entre grupos gemelos).
    const grupoChip = (alumno) => {
        if (!showGrupoCol || !alumno.grupo) return null;
        const g = alumno.grupo;
        const label = [
            g.curso ? `${g.curso}º` : null,
            (g.abreviatura && String(g.abreviatura).trim() !== '') ? g.abreviatura : g.nombre,
        ].filter(Boolean).join(' ');
        return <span className={styles.grupoChip}>{label}</span>;
    };

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
            <div className={styles.alumnoName}>
                {alumno.apellidos}, {alumno.nombre}
                {grupoChip(alumno)}
            </div>
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
                            <th className={styles.th}>{t('attendance.studentCol')}</th>
                            <th className={styles.thCenter}>{t('attendance.statusCol')}</th>
                            <th className={styles.th}>{t('attendance.commentCol')}</th>
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
                                        <div className={styles.alumnoName}>
                                            {alumno.apellidos}, {alumno.nombre}
                                            {grupoChip(alumno)}
                                        </div>
                                    </div>
                                </td>
                                <td className={styles.tdActions}>
                                    <div className={styles.actionsContainer}>
                                        <button
                                            type="button"
                                            onClick={() => handleEstadoChange(alumno.id, 'P')}
                                            title={t('attendance.present')}
                                            className={alumno.estado === 'P' ? styles.btnPresenteActive : styles.btnPresente}
                                        >
                                            <Check size={16} />
                                        </button>
                                        <button
                                            type="button"
                                            onClick={() => handleEstadoChange(alumno.id, 'F')}
                                            title={t('attendance.absent')}
                                            className={alumno.estado === 'F' ? styles.btnFaltaActive : styles.btnFalta}
                                        >
                                            <X size={16} />
                                        </button>
                                        <button
                                            type="button"
                                            onClick={() => handleEstadoChange(alumno.id, 'R')}
                                            title={t('attendance.late')}
                                            className={alumno.estado === 'R' ? styles.btnRetrasoActive : styles.btnRetraso}
                                        >
                                            <Clock size={16} />
                                        </button>
                                        <button
                                            type="button"
                                            onClick={() => handleEstadoChange(alumno.id, 'J')}
                                            title={t('attendance.justified')}
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
                                        placeholder={t('attendance.commentPlaceholderShort')}
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
