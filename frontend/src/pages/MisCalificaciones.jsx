import React, { useEffect, useState } from 'react';
import styles from './Calificaciones.module.css';
import Layout from '../components/Layout';
import { useAuth } from '../context/AuthContext';
import { getApiUrl } from '../config/api';
import { useTranslation } from 'react-i18next';
import { ChevronDown, ChevronRight } from 'lucide-react';

const MisCalificaciones = () => {
    const { t } = useTranslation();
    const { user } = useAuth();

    const [data, setData] = useState(null);
    const [periodos, setPeriodos] = useState([]);
    const [selectedPeriodo, setSelectedPeriodo] = useState('');
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    // Módulos expandidos con sus tareas cargadas
    const [expandedModules, setExpandedModules] = useState({});
    const [moduleTasks, setModuleTasks] = useState({}); // { impId: [tareas] }
    const [loadingTasks, setLoadingTasks] = useState({});

    // Cargar periodos filtrados por los grupos del alumno
    useEffect(() => {
        if (!user) return;
        const fetchPeriodos = async () => {
            try {
                const matriculasRes = await fetch(getApiUrl(`/api/matriculas?alumno=${user.id}&pagination=false`), {
                    headers: { 'Accept': 'application/ld+json' }, credentials: 'include'
                });
                if (!matriculasRes.ok) return;
                const matriculasData = await matriculasRes.json();
                const matriculas = matriculasData['hydra:member'] || matriculasData.member || [];
                if (matriculas.length === 0) return;

                const grupoIds = matriculas.map(m => {
                    if (typeof m.grupo === 'string') return m.grupo.split('/').pop();
                    return m.grupo?.id || m.grupo?.['@id']?.split('/').pop();
                }).filter(Boolean);

                const allPeriodos = [];
                const seen = new Set();
                for (const grupoId of grupoIds) {
                    const res = await fetch(getApiUrl(`/api/periodo_evaluativos?grupo=${grupoId}&order[fechaInicio]=asc`), {
                        headers: { 'Accept': 'application/ld+json' }, credentials: 'include'
                    });
                    if (!res.ok) continue;
                    const d = await res.json();
                    (d['hydra:member'] || d.member || []).forEach(p => {
                        const id = p.id || p['@id']?.split('/').pop();
                        if (!seen.has(id)) { seen.add(id); allPeriodos.push(p); }
                    });
                }
                let result;
                if (grupoIds.length <= 1) {
                    result = allPeriodos;
                } else {
                    const byName = new Map();
                    allPeriodos.forEach(p => { if (!byName.has(p.nombre)) byName.set(p.nombre, p); });
                    result = [...byName.values()];
                }
                // Extraordinaria siempre al final
                result.sort((a, b) => {
                    const aExtra = a.tipo === 'EXTRAORDINARIA' ? 1 : 0;
                    const bExtra = b.tipo === 'EXTRAORDINARIA' ? 1 : 0;
                    if (aExtra !== bExtra) return aExtra - bExtra;
                    return (a.fechaInicio || '').localeCompare(b.fechaInicio || '');
                });
                setPeriodos(result);
            } catch { /* No es crítico */ }
        };
        fetchPeriodos();
    }, [user]);

    // Cargar calificaciones
    useEffect(() => {
        const fetchCalificaciones = async () => {
            setLoading(true);
            try {
                let url = getApiUrl('/api/v1/alumno/mis-calificaciones');
                if (selectedPeriodo) url += `?periodo=${selectedPeriodo}`;
                const response = await fetch(url, { credentials: 'include' });
                if (!response.ok) throw new Error();
                setData(await response.json());
                setError(null);
                // Reset tareas expandidas al cambiar periodo
                setExpandedModules({});
                setModuleTasks({});
            } catch {
                setError(t('grades.errorLoading'));
            } finally {
                setLoading(false);
            }
        };
        fetchCalificaciones();
    }, [selectedPeriodo, t]);

    // Toggle módulo y cargar tareas lazy
    const toggleModule = async (impId) => {
        const isExpanded = expandedModules[impId];
        setExpandedModules(prev => ({ ...prev, [impId]: !isExpanded }));

        // Si ya tenemos las tareas o estamos colapsando, no hacer fetch
        if (isExpanded || moduleTasks[impId]) return;

        setLoadingTasks(prev => ({ ...prev, [impId]: true }));
        try {
            // Fetch tareas de la impartición
            const tareasRes = await fetch(
                getApiUrl(`/api/tareas?imparticion=${impId}&order[fechaLimite]=asc&itemsPerPage=100`),
                { headers: { 'Accept': 'application/ld+json' }, credentials: 'include' }
            );
            if (!tareasRes.ok) throw new Error();
            const tareasData = await tareasRes.json();
            const tareasItems = tareasData['hydra:member'] || tareasData.member || [];

            // Fetch entregas del alumno
            const entregasRes = await fetch(
                getApiUrl(`/api/entregas?alumno=${user.id}&itemsPerPage=200`),
                { headers: { 'Accept': 'application/ld+json' }, credentials: 'include' }
            );
            const entregasData = await entregasRes.json();
            const entregas = entregasData['hydra:member'] || entregasData.member || [];

            const combined = tareasItems.map(tarea => {
                const tareaId = tarea.id || tarea['@id']?.split('/').pop();
                const entrega = entregas.find(e => {
                    const eTareaId = e.tarea?.id || e.tarea?.['@id']?.split('/').pop() || e.tarea;
                    return String(eTareaId) === String(tareaId);
                });
                return { ...tarea, calificacion: entrega?.calificacion || null };
            });

            setModuleTasks(prev => ({ ...prev, [impId]: combined }));
        } catch {
            // Si falla, al menos no crashea
        } finally {
            setLoadingTasks(prev => ({ ...prev, [impId]: false }));
        }
    };

    const getGradeClass = (nota) => {
        if (nota === null || nota === undefined) return styles.gradeNa;
        if (nota < 5) return styles.gradeFail;
        if (nota < 7) return styles.gradePass;
        return styles.gradeGood;
    };

    const formatGrade = (nota) => {
        if (nota === null || nota === undefined) return '—';
        return nota.toFixed(2);
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

    return (
        <Layout>
            <div className={styles.container}>
                <div className={styles.sectionHeader}>
                    <h1 className={styles.title}>{t('grades.myGradesTitle')}</h1>
                    <div className={styles.controls}>
                        <select
                            className={styles.periodSelect}
                            value={selectedPeriodo}
                            onChange={(e) => setSelectedPeriodo(e.target.value)}
                        >
                            <option value="">{t('grades.allPeriods')}</option>
                            {periodos.map(p => {
                                const id = p.id || p['@id']?.split('/').pop();
                                return <option key={id} value={id}>{p.nombre}</option>;
                            })}
                        </select>
                    </div>
                </div>

                {error && <div className={styles.errorContainer}>{error}</div>}

                {loading ? (
                    <div className={styles.loadingContainer}>{t('common.loading')}</div>
                ) : !data?.modulos?.length ? (
                    <div className={styles.loadingContainer}>{t('grades.noGrades')}</div>
                ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
                        {data.modulos.map((mod) => {
                            const impId = mod.imparticion.id;
                            const isExpanded = expandedModules[impId];
                            const tasks = moduleTasks[impId];
                            const isLoadingTasks = loadingTasks[impId];

                            return (
                                <div key={impId} className={styles.moduleCard}>
                                    <div className={styles.moduleHeader}>
                                        <div>
                                            <div className={styles.moduleName}>{mod.imparticion.modulo}</div>
                                            <div className={styles.moduleTeacher}>
                                                {mod.imparticion.profesor} — {mod.imparticion.grupo}
                                            </div>
                                        </div>
                                        <div className={`${styles.moduleGrade} ${getGradeClass(mod.notaFinal)}`}>
                                            {formatGrade(mod.notaFinal)}
                                        </div>
                                    </div>
                                    <div className={styles.moduleBody}>
                                        <div style={{ display: 'flex', gap: 'var(--space-6)', flexWrap: 'wrap' }}>
                                            {[
                                                { val: mod.mediaExamenes, label: t('grades.avgExams') },
                                                { val: mod.mediaTareas, label: t('grades.avgTasks') },
                                                { val: mod.mediaPracticas, label: t('grades.avgPractice') },
                                                { val: null, label: t('grades.pending'), text: `${mod.entregasPendientes}/${mod.totalTareas}` },
                                            ].map((item, i) => (
                                                <div key={i}>
                                                    <span style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)' }}>
                                                        {item.label}
                                                    </span>
                                                    <div className={item.text ? '' : getGradeClass(item.val)} style={{ fontWeight: 'var(--font-bold)', color: item.text ? 'var(--text-muted)' : undefined }}>
                                                        {item.text || formatGrade(item.val)}
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    </div>

                                    {/* Botón para expandir/colapsar tareas */}
                                    <button className={styles.moduleToggle} onClick={() => toggleModule(impId)}>
                                        {isExpanded ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
                                        {isExpanded ? t('grades.hideTasks') : t('grades.showTasks')}
                                    </button>

                                    {/* Lista de tareas expandida */}
                                    {isExpanded && (
                                        <div className={styles.moduleTaskList}>
                                            {isLoadingTasks ? (
                                                <div style={{ padding: 'var(--space-2)', color: 'var(--text-muted)', fontSize: 'var(--text-sm)' }}>
                                                    {t('common.loading')}
                                                </div>
                                            ) : !tasks?.length ? (
                                                <div style={{ padding: 'var(--space-2)', color: 'var(--text-muted)', fontSize: 'var(--text-sm)', fontStyle: 'italic' }}>
                                                    {t('grades.noGrades')}
                                                </div>
                                            ) : (
                                                tasks.map(tarea => {
                                                    const nota = tarea.calificacion?.nota ?? null;
                                                    const feedback = tarea.calificacion?.feedbackProfesor;
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
                                                                    {tarea.fechaLimite && new Date(tarea.fechaLimite).toLocaleDateString()}
                                                                    {feedback && <> — {feedback}</>}
                                                                </div>
                                                            </div>
                                                            <div className={`${styles.taskGrade} ${getGradeClass(nota)}`}>
                                                                {nota != null ? nota.toFixed(1) : '—'}
                                                            </div>
                                                        </div>
                                                    );
                                                })
                                            )}
                                        </div>
                                    )}
                                </div>
                            );
                        })}
                    </div>
                )}
            </div>
        </Layout>
    );
};

export default MisCalificaciones;
