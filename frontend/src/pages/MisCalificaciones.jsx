import React, { useEffect, useState } from 'react';
import styles from './Calificaciones.module.css';
import Layout from '../components/Layout';
import { useAuth } from '../context/AuthContext';
import { getApiUrl } from '../config/api';
import { useTranslation } from 'react-i18next';

const MisCalificaciones = () => {
    const { t } = useTranslation();
    const { user } = useAuth();

    const [data, setData] = useState(null);
    const [periodos, setPeriodos] = useState([]);
    const [selectedPeriodo, setSelectedPeriodo] = useState('');
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    // Cargar periodos filtrados por los grupos del alumno
    useEffect(() => {
        if (!user) return;
        const fetchPeriodos = async () => {
            try {
                // Obtener matrículas del alumno para conocer sus grupos
                const matriculasRes = await fetch(getApiUrl(`/api/matriculas?alumno=${user.id}&pagination=false`), {
                    headers: { 'Accept': 'application/ld+json' },
                    credentials: 'include'
                });
                if (!matriculasRes.ok) return;
                const matriculasData = await matriculasRes.json();
                const matriculas = matriculasData['hydra:member'] || matriculasData.member || [];
                if (matriculas.length === 0) return;

                // Obtener IDs de grupos del alumno
                const grupoIds = matriculas.map(m => {
                    if (typeof m.grupo === 'string') return m.grupo.split('/').pop();
                    return m.grupo?.id || m.grupo?.['@id']?.split('/').pop();
                }).filter(Boolean);

                // Fetch periodos de cada grupo y deduplicar por nombre
                const allPeriodos = [];
                const seen = new Set();
                for (const grupoId of grupoIds) {
                    const res = await fetch(getApiUrl(`/api/periodo_evaluativos?grupo=${grupoId}&order[fechaInicio]=asc`), {
                        headers: { 'Accept': 'application/ld+json' },
                        credentials: 'include'
                    });
                    if (!res.ok) continue;
                    const data = await res.json();
                    const items = data['hydra:member'] || data.member || [];
                    items.forEach(p => {
                        const id = p.id || p['@id']?.split('/').pop();
                        if (!seen.has(id)) {
                            seen.add(id);
                            allPeriodos.push(p);
                        }
                    });
                }
                // Si el alumno está en un solo grupo, los periodos ya son únicos.
                // Si está en varios, deduplicar por nombre para el selector.
                if (grupoIds.length <= 1) {
                    setPeriodos(allPeriodos);
                } else {
                    // Deduplicar por nombre (ej: "1ª Evaluación" de varios grupos → mostrar una sola vez)
                    const byName = new Map();
                    allPeriodos.forEach(p => {
                        if (!byName.has(p.nombre)) byName.set(p.nombre, p);
                    });
                    setPeriodos([...byName.values()]);
                }
            } catch {
                // No es crítico
            }
        };
        fetchPeriodos();
    }, [user]);

    // Cargar calificaciones
    useEffect(() => {
        const fetchCalificaciones = async () => {
            setLoading(true);
            try {
                let url = getApiUrl('/api/v1/alumno/mis-calificaciones');
                if (selectedPeriodo) {
                    url += `?periodo=${selectedPeriodo}`;
                }
                const response = await fetch(url, { credentials: 'include' });
                if (!response.ok) throw new Error();
                const result = await response.json();
                setData(result);
                setError(null);
            } catch {
                setError(t('grades.errorLoading'));
            } finally {
                setLoading(false);
            }
        };
        fetchCalificaciones();
    }, [selectedPeriodo, t]);

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

    return (
        <Layout>
            <div className={styles.container}>
                <div className={styles.sectionHeader}>
                    <div>
                        <h1 className={styles.title}>{t('grades.myGradesTitle')}</h1>
                    </div>
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
                        {data.modulos.map((mod) => (
                            <div key={mod.imparticion.id} className={styles.moduleCard}>
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
                                        <div>
                                            <span style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)' }}>
                                                {t('grades.avgExams')}
                                            </span>
                                            <div className={`${getGradeClass(mod.mediaExamenes)}`} style={{ fontWeight: 'var(--font-bold)' }}>
                                                {formatGrade(mod.mediaExamenes)}
                                            </div>
                                        </div>
                                        <div>
                                            <span style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)' }}>
                                                {t('grades.avgTasks')}
                                            </span>
                                            <div className={`${getGradeClass(mod.mediaTareas)}`} style={{ fontWeight: 'var(--font-bold)' }}>
                                                {formatGrade(mod.mediaTareas)}
                                            </div>
                                        </div>
                                        <div>
                                            <span style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)' }}>
                                                {t('grades.avgPractice')}
                                            </span>
                                            <div className={`${getGradeClass(mod.mediaPracticas)}`} style={{ fontWeight: 'var(--font-bold)' }}>
                                                {formatGrade(mod.mediaPracticas)}
                                            </div>
                                        </div>
                                        <div>
                                            <span style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)' }}>
                                                {t('grades.pending')}
                                            </span>
                                            <div style={{ color: 'var(--text-muted)' }}>
                                                {mod.entregasPendientes}/{mod.totalTareas}
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </Layout>
    );
};

export default MisCalificaciones;
