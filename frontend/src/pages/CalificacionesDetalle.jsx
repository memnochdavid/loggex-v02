import React, { useEffect, useState, useMemo } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import styles from './Calificaciones.module.css';
import Layout from '../components/Layout';
import { getApiUrl } from '../config/api';
import { useTranslation } from 'react-i18next';
import { ArrowLeft } from 'lucide-react';

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

    useEffect(() => {
        if (!imparticionId || !alumnoId) return;

        const fetchData = async () => {
            setLoading(true);
            try {
                // Fetch media del alumno
                const mediaRes = await fetch(
                    getApiUrl(`/api/v1/imparticion/${imparticionId}/media/${alumnoId}`),
                    { credentials: 'include' }
                );
                if (!mediaRes.ok) throw new Error();
                const media = await mediaRes.json();
                setMediaData(media);

                // Fetch tareas de la impartición con entregas del alumno
                const tareasRes = await fetch(
                    getApiUrl(`/api/tareas?imparticion=${imparticionId}&order[fechaLimite]=asc&itemsPerPage=100`),
                    { headers: { 'Accept': 'application/ld+json' }, credentials: 'include' }
                );
                if (!tareasRes.ok) throw new Error();
                const tareasData = await tareasRes.json();
                const tareasItems = tareasData['hydra:member'] || tareasData.member || [];

                // Fetch entregas del alumno para esta impartición
                const entregasRes = await fetch(
                    getApiUrl(`/api/entregas?alumno=${alumnoId}&itemsPerPage=200`),
                    { headers: { 'Accept': 'application/ld+json' }, credentials: 'include' }
                );
                if (!entregasRes.ok) throw new Error();
                const entregasData = await entregasRes.json();
                const entregas = entregasData['hydra:member'] || entregasData.member || [];

                // Combinar tareas con entregas y calificaciones
                const tareasConNotas = tareasItems.map(tarea => {
                    const tareaId = tarea.id || tarea['@id']?.split('/').pop();
                    const entrega = entregas.find(e => {
                        const eTareaId = e.tarea?.id || e.tarea?.['@id']?.split('/').pop() || e.tarea;
                        return String(eTareaId) === String(tareaId);
                    });
                    return {
                        ...tarea,
                        entrega,
                        calificacion: entrega?.calificacion || null
                    };
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

    // Contadores por tipo
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

    if (loading) {
        return (
            <Layout>
                <div className={styles.container}>
                    <div className={styles.loadingContainer}>{t('common.loading')}</div>
                </div>
            </Layout>
        );
    }

    if (error) {
        return (
            <Layout>
                <div className={styles.container}>
                    <div className={styles.errorContainer}>{error}</div>
                </div>
            </Layout>
        );
    }

    return (
        <Layout>
            <div className={styles.container}>
                <span
                    className={styles.backLink}
                    onClick={() => navigate(`/calificaciones?imparticion=${imparticionId}`)}
                >
                    <ArrowLeft size={16} /> {t('grades.backToList')}
                </span>

                <div className={styles.sectionHeader}>
                    <div>
                        <h1 className={styles.title}>
                            {mediaData?.alumno?.apellidos}, {mediaData?.alumno?.nombre}
                        </h1>
                    </div>
                </div>

                {/* Resumen de medias */}
                <div className={styles.cardGrid}>
                    <div className={styles.statCard}>
                        <div className={`${styles.statValue} ${getGradeClass(mediaData?.mediaExamenes)}`}>
                            {formatGrade(mediaData?.mediaExamenes)}
                        </div>
                        <div className={styles.statLabel}>{t('grades.avgExams')}</div>
                    </div>
                    <div className={styles.statCard}>
                        <div className={`${styles.statValue} ${getGradeClass(mediaData?.mediaTareas)}`}>
                            {formatGrade(mediaData?.mediaTareas)}
                        </div>
                        <div className={styles.statLabel}>{t('grades.avgTasks')}</div>
                    </div>
                    <div className={styles.statCard}>
                        <div className={`${styles.statValue} ${getGradeClass(mediaData?.mediaPracticas)}`}>
                            {formatGrade(mediaData?.mediaPracticas)}
                        </div>
                        <div className={styles.statLabel}>{t('grades.avgPractice')}</div>
                    </div>
                    <div className={styles.statCard}>
                        <div className={`${styles.statValue} ${getGradeClass(mediaData?.notaFinal)}`}>
                            {formatGrade(mediaData?.notaFinal)}
                        </div>
                        <div className={styles.statLabel}>{t('grades.finalGrade')}</div>
                    </div>
                </div>

                {/* Tabs de filtrado por tipo */}
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

                {/* Lista de tareas filtrada */}
                <div className={styles.taskList}>
                    {filteredTareas.length === 0 ? (
                        <div className={styles.loadingContainer}>{t('grades.noTasksType')}</div>
                    ) : (
                        filteredTareas.map((tarea) => {
                            const nota = tarea.calificacion?.nota ?? null;
                            const feedback = tarea.calificacion?.feedbackProfesor ?? null;
                            const fechaLimite = tarea.fechaLimite
                                ? new Date(tarea.fechaLimite).toLocaleDateString()
                                : '';

                            return (
                                <div key={tarea.id || tarea['@id']} className={styles.taskItem}>
                                    <div className={styles.taskInfo}>
                                        <div className={styles.taskName}>
                                            {tarea.titulo}
                                            <span className={`${styles.taskBadge} ${getBadgeClass(tarea.tipo)}`} style={{ marginLeft: 'var(--space-2)' }}>
                                                {getTypeName(tarea.tipo)}
                                            </span>
                                        </div>
                                        <div className={styles.taskMeta}>
                                            {t('grades.deadline')}: {fechaLimite}
                                            {feedback && (
                                                <> — {t('grades.feedback')}: {feedback}</>
                                            )}
                                            {!tarea.entrega && (
                                                <> — <em>{t('grades.noDelivery')}</em></>
                                            )}
                                        </div>
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
