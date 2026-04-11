import React, { useEffect, useState, useMemo } from 'react';
import styles from './Calificaciones.module.css';
import Layout from '../components/Layout';
import AccordionView from '../components/AccordionView';
import { getApiUrl } from '../config/api';
import { useTranslation } from 'react-i18next';

const CalificacionesAdmin = () => {
    const { t } = useTranslation();

    const [data, setData] = useState(null);
    const [periodos, setPeriodos] = useState([]);
    const [selectedPeriodo, setSelectedPeriodo] = useState('');
    const [selectedYear, setSelectedYear] = useState('');
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [expandedId, setExpandedId] = useState(null);

    // Cargar periodos deduplicados por nombre
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
                const byName = new Map();
                all.forEach(p => { if (!byName.has(p.nombre)) byName.set(p.nombre, p); });
                const unique = [...byName.values()];
                // Ordinarias primero por fecha, extraordinaria siempre al final
                unique.sort((a, b) => {
                    const aExtra = a.tipo === 'EXTRAORDINARIA' ? 1 : 0;
                    const bExtra = b.tipo === 'EXTRAORDINARIA' ? 1 : 0;
                    if (aExtra !== bExtra) return aExtra - bExtra;
                    return (a.fechaInicio || '').localeCompare(b.fechaInicio || '');
                });
                setPeriodos(unique);
            } catch { /* No crítico */ }
        };
        fetchPeriodos();
    }, []);

    // Cargar resumen (filtrado server-side por año y periodo)
    useEffect(() => {
        const fetchResumen = async () => {
            setLoading(true);
            try {
                const params = new URLSearchParams();
                if (selectedPeriodo) params.set('periodo', selectedPeriodo);
                if (selectedYear) params.set('anioEscolar', selectedYear);
                const qs = params.toString();
                const url = getApiUrl(`/api/v1/centro/resumen-calificaciones${qs ? `?${qs}` : ''}`);
                const response = await fetch(url, { credentials: 'include' });
                if (!response.ok) throw new Error();
                setData(await response.json());
                setError(null);
            } catch {
                setError(t('grades.errorLoading'));
            } finally {
                setLoading(false);
            }
        };
        fetchResumen();
    }, [selectedPeriodo, selectedYear, t]);

    // Años disponibles vienen del backend
    const availableYears = data?.aniosDisponibles || [];

    // Los grupos ya vienen filtrados del servidor
    const filteredGrupos = data?.grupos || [];

    // Resumen global del centro
    const summary = useMemo(() => {
        if (!filteredGrupos.length) return null;
        let totalAlumnos = 0, totalAprobados = 0, totalModulos = 0;
        const allNotas = [];
        filteredGrupos.forEach(g => {
            g.modulos.forEach(mod => {
                totalModulos++;
                totalAprobados += mod.aprobados;
                totalAlumnos += mod.totalAlumnos;
                if (mod.mediaGrupo != null) allNotas.push(mod.mediaGrupo);
            });
        });
        const mediaCentro = allNotas.length > 0
            ? allNotas.reduce((a, b) => a + b, 0) / allNotas.length
            : null;
        const tasaGlobal = totalAlumnos > 0
            ? ((totalAprobados / totalAlumnos) * 100)
            : null;
        return {
            grupos: filteredGrupos.length,
            modulos: totalModulos,
            mediaCentro,
            tasaGlobal,
        };
    }, [filteredGrupos]);

    // Agrupar por ciclo
    const groupedByCiclo = useMemo(() => {
        const result = {};
        filteredGrupos.forEach(g => {
            const ciclo = g.grupo.ciclo;
            if (!result[ciclo]) result[ciclo] = [];
            result[ciclo].push({
                id: g.grupo.id,
                title: `${g.grupo.nombre} (${g.grupo.anioEscolar})`,
                modulos: g.modulos,
            });
        });
        return result;
    }, [filteredGrupos]);

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

    const renderGrupoContent = (item) => (
        <div style={{ overflowX: 'auto' }}>
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
                    {item.modulos.map((mod, idx) => (
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
                                <span
                                    className={getGradeClass(mod.tasaAprobados != null ? mod.tasaAprobados / 10 : null)}
                                    style={{ fontWeight: 'var(--font-bold)' }}
                                >
                                    {mod.tasaAprobados != null ? `${mod.tasaAprobados}%` : '—'}
                                </span>
                            </td>
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>
    );

    return (
        <Layout>
            <div className={styles.container}>
                <div className={styles.sectionHeader}>
                    <h1 className={styles.title}>{t('grades.adminTitle')}</h1>
                    <div className={styles.controls}>
                        <select
                            className={styles.periodSelect}
                            value={selectedYear}
                            onChange={(e) => { setSelectedYear(e.target.value); setExpandedId(null); }}
                            style={{ minWidth: '160px' }}
                        >
                            <option value="">{t('grades.allYears')}</option>
                            {availableYears.map(y => (
                                <option key={y} value={y}>{y}</option>
                            ))}
                        </select>
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
                    <>
                        {/* Resumen global del centro */}
                        {summary && (
                            <div className={styles.cardGrid} style={{ marginBottom: 'var(--space-6)' }}>
                                <div className={styles.statCard}>
                                    <div className={styles.statValue} style={{ color: 'var(--color-primary-600)' }}>
                                        {summary.grupos}
                                    </div>
                                    <div className={styles.statLabel}>{t('grades.group')}s</div>
                                </div>
                                <div className={styles.statCard}>
                                    <div className={styles.statValue} style={{ color: 'var(--color-primary-600)' }}>
                                        {summary.modulos}
                                    </div>
                                    <div className={styles.statLabel}>{t('grades.module')}s</div>
                                </div>
                                <div className={styles.statCard}>
                                    <div className={`${styles.statValue} ${getGradeClass(summary.mediaCentro)}`}>
                                        {formatGrade(summary.mediaCentro)}
                                    </div>
                                    <div className={styles.statLabel}>{t('grades.groupAvg')}</div>
                                </div>
                                <div className={styles.statCard}>
                                    <div className={`${styles.statValue} ${getGradeClass(summary.tasaGlobal != null ? summary.tasaGlobal / 10 : null)}`}>
                                        {summary.tasaGlobal != null ? `${summary.tasaGlobal.toFixed(1)}%` : '—'}
                                    </div>
                                    <div className={styles.statLabel}>{t('grades.passRate')}</div>
                                </div>
                            </div>
                        )}

                        {/* Grupos por ciclo */}
                        {filteredGrupos.length === 0 ? (
                            <div className={styles.loadingContainer}>{t('grades.noGrades')}</div>
                        ) : (
                            Object.entries(groupedByCiclo).map(([ciclo, grupos]) => (
                                <div key={ciclo} style={{ marginBottom: 'var(--space-6)' }}>
                                    <h2 style={{ fontSize: 'var(--text-lg)', fontWeight: 'var(--font-bold)', color: 'var(--text-main)', marginBottom: 'var(--space-3)' }}>
                                        {ciclo}
                                    </h2>
                                    <AccordionView
                                        data={grupos}
                                        renderItem={renderGrupoContent}
                                        canAdd={false}
                                        expandedId={expandedId}
                                        onToggle={(id) => setExpandedId(prev => prev === id ? null : id)}
                                    />
                                </div>
                            ))
                        )}
                    </>
                )}
            </div>
        </Layout>
    );
};

export default CalificacionesAdmin;
