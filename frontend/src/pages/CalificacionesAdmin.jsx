import React, { useEffect, useState } from 'react';
import styles from './Calificaciones.module.css';
import Layout from '../components/Layout';
import { getApiUrl } from '../config/api';
import { useTranslation } from 'react-i18next';
import { ChevronDown, ChevronRight } from 'lucide-react';

const CalificacionesAdmin = () => {
    const { t } = useTranslation();

    const [data, setData] = useState(null);
    const [periodos, setPeriodos] = useState([]);
    const [selectedPeriodo, setSelectedPeriodo] = useState('');
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [expandedGroups, setExpandedGroups] = useState({});

    // Cargar periodos deduplicados por nombre (el admin ve todos los del centro)
    useEffect(() => {
        const fetchPeriodos = async () => {
            try {
                const res = await fetch(getApiUrl('/api/periodo_evaluativos?order[fechaInicio]=asc&itemsPerPage=100'), {
                    headers: { 'Accept': 'application/ld+json' },
                    credentials: 'include'
                });
                if (!res.ok) return;
                const d = await res.json();
                const all = d['hydra:member'] || d.member || [];
                // Deduplicar por nombre para el selector
                const byName = new Map();
                all.forEach(p => { if (!byName.has(p.nombre)) byName.set(p.nombre, p); });
                setPeriodos([...byName.values()]);
            } catch {
                // No crítico
            }
        };
        fetchPeriodos();
    }, []);

    // Cargar resumen
    useEffect(() => {
        const fetchResumen = async () => {
            setLoading(true);
            try {
                let url = getApiUrl('/api/v1/centro/resumen-calificaciones');
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
        fetchResumen();
    }, [selectedPeriodo, t]);

    const toggleGroup = (groupId) => {
        setExpandedGroups(prev => ({ ...prev, [groupId]: !prev[groupId] }));
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

    // Agrupar por ciclo
    const groupedByCiclo = {};
    if (data?.grupos) {
        data.grupos.forEach(g => {
            const ciclo = g.grupo.ciclo;
            if (!groupedByCiclo[ciclo]) groupedByCiclo[ciclo] = [];
            groupedByCiclo[ciclo].push(g);
        });
    }

    return (
        <Layout>
            <div className={styles.container}>
                <div className={styles.sectionHeader}>
                    <h1 className={styles.title}>{t('grades.adminTitle')}</h1>
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
                ) : !data?.grupos?.length ? (
                    <div className={styles.loadingContainer}>{t('grades.noGrades')}</div>
                ) : (
                    Object.entries(groupedByCiclo).map(([ciclo, grupos]) => (
                        <div key={ciclo} style={{ marginBottom: 'var(--space-6)' }}>
                            <h2 style={{ fontSize: 'var(--text-lg)', fontWeight: 'var(--font-bold)', color: 'var(--text-main)', marginBottom: 'var(--space-3)' }}>
                                {ciclo}
                            </h2>
                            {grupos.map(g => {
                                const isExpanded = expandedGroups[g.grupo.id];
                                return (
                                    <div key={g.grupo.id} className={styles.treeItem}>
                                        <div className={styles.treeHeader} onClick={() => toggleGroup(g.grupo.id)}>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
                                                {isExpanded ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
                                                <span className={styles.treeLabel}>
                                                    {g.grupo.nombre} ({g.grupo.anioEscolar})
                                                </span>
                                            </div>
                                            <span className={styles.treeStat}>
                                                {g.modulos.length} {t('grades.module').toLowerCase()}s
                                            </span>
                                        </div>
                                        {isExpanded && (
                                            <div className={styles.treeContent}>
                                                <table className={styles.gradesTable}>
                                                    <thead>
                                                        <tr>
                                                            <th>{t('grades.module')}</th>
                                                            <th>{t('grades.teacher')}</th>
                                                            <th>{t('grades.groupAvg')}</th>
                                                            <th>{t('grades.approved')}</th>
                                                            <th>{t('grades.failed')}</th>
                                                            <th>{t('grades.passRate')}</th>
                                                        </tr>
                                                    </thead>
                                                    <tbody>
                                                        {g.modulos.map((mod, idx) => (
                                                            <tr key={idx}>
                                                                <td>{mod.modulo}</td>
                                                                <td style={{ color: 'var(--text-muted)' }}>{mod.profesor}</td>
                                                                <td className={`${styles.gradeCell} ${getGradeClass(mod.mediaGrupo)}`}>
                                                                    {formatGrade(mod.mediaGrupo)}
                                                                </td>
                                                                <td style={{ textAlign: 'center', color: 'var(--color-success)' }}>
                                                                    {mod.aprobados}
                                                                </td>
                                                                <td style={{ textAlign: 'center', color: 'var(--color-error)' }}>
                                                                    {mod.suspensos}
                                                                </td>
                                                                <td style={{ textAlign: 'center' }}>
                                                                    <span className={`${getGradeClass(mod.tasaAprobados ? mod.tasaAprobados / 10 : null)}`} style={{ fontWeight: 'var(--font-bold)' }}>
                                                                        {mod.tasaAprobados !== null ? `${mod.tasaAprobados}%` : '—'}
                                                                    </span>
                                                                </td>
                                                            </tr>
                                                        ))}
                                                    </tbody>
                                                </table>
                                            </div>
                                        )}
                                    </div>
                                );
                            })}
                        </div>
                    ))
                )}
            </div>
        </Layout>
    );
};

export default CalificacionesAdmin;
