import React, { useEffect, useState, useMemo } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import styles from './Calificaciones.module.css';
import Layout from '../components/Layout';
import { getApiUrl } from '../config/api';
import { useTranslation } from 'react-i18next';
import { ArrowLeft, Edit2, Check, X } from 'lucide-react';

const CalificacionesDetalle = () => {
    const { t } = useTranslation();
    const navigate = useNavigate();
    const [searchParams] = useSearchParams();
    const imparticionId = searchParams.get('imparticion');
    const alumnoId = searchParams.get('alumno');

    const [mediaData, setMediaData] = useState(null);
    const [tareas, setTareas] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [activeTab, setActiveTab] = useState('todos');
    const [editingFeedback, setEditingFeedback] = useState(null); // tareaId being edited
    const [feedbackValue, setFeedbackValue] = useState('');
    const [savingFeedback, setSavingFeedback] = useState(false);

    useEffect(() => {
        if (!imparticionId || !alumnoId) return;

        const fetchData = async () => {
            setLoading(true);
            try {
                const mediaRes = await fetch(
                    getApiUrl(`/api/v1/imparticion/${imparticionId}/media/${alumnoId}`),
                    { credentials: 'include' }
                );
                if (!mediaRes.ok) throw new Error();
                const media = await mediaRes.json();
                setMediaData(media);

                const tareasRes = await fetch(
                    getApiUrl(`/api/tareas?imparticion=${imparticionId}&order[fechaLimite]=asc&itemsPerPage=100`),
                    { headers: { 'Accept': 'application/ld+json' }, credentials: 'include' }
                );
                if (!tareasRes.ok) throw new Error();
                const tareasData = await tareasRes.json();
                const tareasItems = tareasData['hydra:member'] || tareasData.member || [];

                const entregasRes = await fetch(
                    getApiUrl(`/api/entregas?alumno=${alumnoId}&itemsPerPage=200`),
                    { headers: { 'Accept': 'application/ld+json' }, credentials: 'include' }
                );
                if (!entregasRes.ok) throw new Error();
                const entregasData = await entregasRes.json();
                const entregas = entregasData['hydra:member'] || entregasData.member || [];

                const tareasConNotas = tareasItems.map(tarea => {
                    const tareaId = tarea.id || tarea['@id']?.split('/').pop();
                    const entrega = entregas.find(e => {
                        const eTareaId = e.tarea?.id || e.tarea?.['@id']?.split('/').pop() || e.tarea;
                        return String(eTareaId) === String(tareaId);
                    });
                    return { ...tarea, entrega, calificacion: entrega?.calificacion || null };
                });

                setTareas(tareasConNotas);
                setError(null);
            } catch {
                setError(t('grades.errorLoading'));
            } finally {
                setLoading(false);
            }
        };
        fetchData();
    }, [imparticionId, alumnoId, t]);

    const tabs = [
        { key: 'todos', label: t('grades.filterAll') },
        { key: 'examen', label: t('grades.exam') },
        { key: 'tarea', label: t('grades.task') },
        { key: 'practica', label: t('grades.practice') },
    ];

    const filteredTareas = useMemo(() => {
        if (activeTab === 'todos') return tareas;
        return tareas.filter(t => t.tipo === activeTab);
    }, [tareas, activeTab]);

    const counts = useMemo(() => {
        const c = { todos: tareas.length, examen: 0, tarea: 0, practica: 0 };
        tareas.forEach(t => { if (c[t.tipo] !== undefined) c[t.tipo]++; });
        return c;
    }, [tareas]);

    const getGradeClass = (nota) => {
        if (nota === null || nota === undefined) return styles.gradeNa;
        if (nota < 5) return styles.gradeFail;
        if (nota < 7) return styles.gradePass;
        return styles.gradeGood;
    };

    const formatGrade = (nota) => {
        if (nota === null || nota === undefined) return '—';
        return typeof nota === 'number' ? nota.toFixed(1) : nota;
    };

    const getBadgeClass = (tipo) => {
        switch (tipo) {
            case 'examen': return styles.badgeExam;
            case 'tarea': return styles.badgeTarea;
            case 'practica': return styles.badgePractica;
            default: return '';
        }
    };

    const getTypeName = (tipo) => {
        switch (tipo) {
            case 'examen': return t('grades.exam');
            case 'tarea': return t('grades.task');
            case 'practica': return t('grades.practice');
            default: return tipo;
        }
    };

    // Guardar feedback inline
    const handleSaveFeedback = async (tarea) => {
        if (!tarea.calificacion) return;
        setSavingFeedback(true);
        try {
            const calId = tarea.calificacion.id || tarea.calificacion['@id']?.split('/').pop();
            const res = await fetch(getApiUrl(`/api/calificacions/${calId}`), {
                method: 'PUT',
                headers: { 'Content-Type': 'application/ld+json', 'Accept': 'application/ld+json' },
                body: JSON.stringify({ feedbackProfesor: feedbackValue }),
                credentials: 'include'
            });
            if (!res.ok) throw new Error();
            // Actualizar en local
            setTareas(prev => prev.map(t => {
                if ((t.id || t['@id']) === (tarea.id || tarea['@id'])) {
                    return { ...t, calificacion: { ...t.calificacion, feedbackProfesor: feedbackValue } };
                }
                return t;
            }));
            setEditingFeedback(null);
        } catch {
            alert(t('grades.errorSavingFeedback'));
        } finally {
            setSavingFeedback(false);
        }
    };

    // Barras del gráfico
    const chartBars = mediaData ? [
        { label: t('grades.avgExams'), value: mediaData.mediaExamenes, fillClass: styles.barFillExam },
        { label: t('grades.avgTasks'), value: mediaData.mediaTareas, fillClass: styles.barFillTask },
        { label: t('grades.avgPractice'), value: mediaData.mediaPracticas, fillClass: styles.barFillPractice },
        { label: t('grades.finalGrade'), value: mediaData.notaFinal, fillClass: styles.barFillFinal },
    ] : [];

    if (loading) {
        return <Layout><div className={styles.container}><div className={styles.loadingContainer}>{t('common.loading')}</div></div></Layout>;
    }
    if (error) {
        return <Layout><div className={styles.container}><div className={styles.errorContainer}>{error}</div></div></Layout>;
    }

    return (
        <Layout>
            <div className={styles.container}>
                <span className={styles.backLink} onClick={() => navigate(`/calificaciones?imparticion=${imparticionId}`)}>
                    <ArrowLeft size={16} /> {t('grades.backToList')}
                </span>

                <div className={styles.sectionHeader}>
                    <h1 className={styles.title}>
                        {mediaData?.alumno?.apellidos}, {mediaData?.alumno?.nombre}
                    </h1>
                </div>

                {/* Resumen cards */}
                <div className={styles.cardGrid}>
                    {[
                        { val: mediaData?.mediaExamenes, label: t('grades.avgExams') },
                        { val: mediaData?.mediaTareas, label: t('grades.avgTasks') },
                        { val: mediaData?.mediaPracticas, label: t('grades.avgPractice') },
                        { val: mediaData?.notaFinal, label: t('grades.finalGrade') },
                    ].map((item, i) => (
                        <div key={i} className={styles.statCard}>
                            <div className={`${styles.statValue} ${getGradeClass(item.val)}`}>
                                {formatGrade(item.val)}
                            </div>
                            <div className={styles.statLabel}>{item.label}</div>
                        </div>
                    ))}
                </div>

                {/* Gráfico de barras horizontales */}
                <div className={styles.barChart}>
                    <h3 className={styles.cardTitle}>{t('grades.gradeChart')}</h3>
                    {chartBars.map((bar, i) => (
                        <div key={i} className={styles.barRow}>
                            <span className={styles.barLabel}>{bar.label}</span>
                            <div className={styles.barTrack}>
                                <div
                                    className={`${styles.barFill} ${bar.fillClass}`}
                                    style={{ width: bar.value != null ? `${(bar.value / 10) * 100}%` : '0%' }}
                                />
                            </div>
                            <span className={`${styles.barValue} ${getGradeClass(bar.value)}`}>
                                {formatGrade(bar.value)}
                            </span>
                        </div>
                    ))}
                </div>

                {/* Tabs */}
                <div className={styles.tabBar}>
                    {tabs.map(tab => (
                        <button
                            key={tab.key}
                            className={`${styles.tab} ${activeTab === tab.key ? styles.tabActive : ''}`}
                            onClick={() => setActiveTab(tab.key)}
                        >
                            {tab.label}
                            <span className={styles.tabCount}>{counts[tab.key]}</span>
                        </button>
                    ))}
                </div>

                {/* Lista de tareas */}
                <div className={styles.taskList}>
                    {filteredTareas.length === 0 ? (
                        <div className={styles.loadingContainer}>{t('grades.noTasksType')}</div>
                    ) : (
                        filteredTareas.map((tarea) => {
                            const nota = tarea.calificacion?.nota ?? null;
                            const feedback = tarea.calificacion?.feedbackProfesor ?? null;
                            const tareaKey = tarea.id || tarea['@id'];
                            const isEditing = editingFeedback === tareaKey;

                            return (
                                <div key={tareaKey} className={styles.taskItem}>
                                    <div className={styles.taskInfo}>
                                        <div className={styles.taskName}>
                                            {tarea.titulo}
                                            <span className={`${styles.taskBadge} ${getBadgeClass(tarea.tipo)}`} style={{ marginLeft: 'var(--space-2)' }}>
                                                {getTypeName(tarea.tipo)}
                                            </span>
                                        </div>
                                        <div className={styles.taskMeta}>
                                            {t('grades.deadline')}: {tarea.fechaLimite ? new Date(tarea.fechaLimite).toLocaleDateString() : ''}
                                            {!tarea.entrega && <> — <em>{t('grades.noDelivery')}</em></>}
                                        </div>
                                        {/* Feedback editable inline */}
                                        {tarea.calificacion && (
                                            <div className={styles.feedbackInline}>
                                                {isEditing ? (
                                                    <>
                                                        <input
                                                            className={styles.feedbackInput}
                                                            value={feedbackValue}
                                                            onChange={(e) => setFeedbackValue(e.target.value)}
                                                            placeholder={t('grades.feedback')}
                                                            autoFocus
                                                        />
                                                        <button
                                                            className={styles.feedbackSaveBtn}
                                                            onClick={() => handleSaveFeedback(tarea)}
                                                            disabled={savingFeedback}
                                                        >
                                                            <Check size={14} />
                                                        </button>
                                                        <button
                                                            className={styles.feedbackEditBtn}
                                                            onClick={() => setEditingFeedback(null)}
                                                        >
                                                            <X size={14} />
                                                        </button>
                                                    </>
                                                ) : (
                                                    <>
                                                        <span className={styles.taskMeta} style={{ margin: 0 }}>
                                                            {feedback ? `${t('grades.feedback')}: ${feedback}` : t('grades.noFeedback')}
                                                        </span>
                                                        <button
                                                            className={styles.feedbackEditBtn}
                                                            onClick={() => { setEditingFeedback(tareaKey); setFeedbackValue(feedback || ''); }}
                                                            title={t('grades.editFeedback')}
                                                        >
                                                            <Edit2 size={12} />
                                                        </button>
                                                    </>
                                                )}
                                            </div>
                                        )}
                                    </div>
                                    <div className={`${styles.taskGrade} ${getGradeClass(nota)}`}>
                                        {formatGrade(nota)}
                                    </div>
                                </div>
                            );
                        })
                    )}
                </div>
            </div>
        </Layout>
    );
};

export default CalificacionesDetalle;
