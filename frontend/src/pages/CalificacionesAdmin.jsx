import React, { useEffect, useState, useMemo } from 'react';
import styles from './Calificaciones.module.css';
import Layout from '../components/Layout';
import AccordionView from '../components/AccordionView';
import Button from '../components/Button';
import ThemedSelect from '../components/ThemedSelect';
import CrudHeader from '../components/CrudHeader';
import { useAuth } from '../context/AuthContext';
import { getApiUrl } from '../config/api';
import { useTranslation } from 'react-i18next';
import { Download } from 'lucide-react';
import Lottie from 'lottie-react';
import statsAnimation from '../../public/stats.json';

const CalificacionesAdmin = () => {
    const { t, i18n } = useTranslation();
    const { user } = useAuth();
    const isSuperAdmin = user?.roles?.includes('ROLE_SUPERADMIN');

    const [data, setData] = useState(null);
    const [periodos, setPeriodos] = useState([]);
    const [selectedPeriodo, setSelectedPeriodo] = useState('');
    const [selectedYear, setSelectedYear] = useState('');
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [expandedId, setExpandedId] = useState(null);
    const [downloading, setDownloading] = useState(null);

    const handleDownloadBoletines = async (grupoId, formato) => {
        if (!selectedPeriodo) {
            alert(t('grades.selectPeriodFirst'));
            return;
        }
        setDownloading(`${grupoId}-${formato}`);
        try {
            const res = await fetch(
                getApiUrl(`/api/v1/informes/boletines/${grupoId}/${selectedPeriodo}?formato=${formato}&lang=${(i18n.language || 'es').substring(0, 2)}`),
                { credentials: 'include' }
            );
            if (!res.ok) throw new Error();
            const blob = await res.blob();
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = formato === 'zip'
                ? `boletines_${grupoId}.zip`
                : `boletines_${grupoId}.pdf`;
            a.click();
            URL.revokeObjectURL(url);
        } catch {
            alert(t('grades.errorLoading'));
        } finally {
            setDownloading(null);
        }
    };

    // Filtro de centro para SuperAdmin
    const [centros, setCentros] = useState([]);
    const [selectedCentro, setSelectedCentro] = useState('');

    // Cargar centros para SuperAdmin
    useEffect(() => {
        if (!isSuperAdmin) return;
        fetch(getApiUrl('/api/centros?pagination=false'), {
            headers: { 'Accept': 'application/ld+json' }, credentials: 'include'
        })
        .then(res => res.json())
        .then(d => setCentros(d['hydra:member'] || d.member || []))
        .catch(() => {});
    }, [isSuperAdmin]);

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
                const hoy = new Date(); hoy.setHours(0,0,0,0);
                const all_fin = all.filter(p => p.fechaFin && new Date(p.fechaFin) < hoy);
                const byName = new Map();
                all_fin.forEach(p => { if (!byName.has(p.nombre)) byName.set(p.nombre, p); });
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

    // Cargar resumen (filtrado server-side por centro, año y periodo)
    useEffect(() => {
        // SuperAdmin debe seleccionar centro primero
        if (isSuperAdmin && !selectedCentro) {
            setData(null);
            setLoading(false);
            return;
        }
        const fetchResumen = async () => {
            setLoading(true);
            try {
                const params = new URLSearchParams();
                if (selectedPeriodo) params.set('periodo', selectedPeriodo);
                if (selectedYear) params.set('anioEscolar', selectedYear);
                if (selectedCentro) params.set('centro', selectedCentro);
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
    }, [selectedPeriodo, selectedYear, selectedCentro, isSuperAdmin, t]);

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
        <div>
            <div style={{ display: 'flex', gap: 'var(--space-2)', marginBottom: 'var(--space-3)', justifyContent: 'flex-end' }}>
                <Button
                    size="sm"
                    onClick={() => handleDownloadBoletines(item.id, 'pdf-unico')}
                    disabled={!selectedPeriodo || downloading === `${item.id}-pdf-unico`}
                >
                    <Download size={14} style={{ marginRight: '4px' }} />
                    {downloading === `${item.id}-pdf-unico` ? t('grades.generating') : t('grades.downloadAsPdf')}
                </Button>
                <Button
                    size="sm"
                    variant="secondary"
                    onClick={() => handleDownloadBoletines(item.id, 'zip')}
                    disabled={!selectedPeriodo || downloading === `${item.id}-zip`}
                >
                    <Download size={14} style={{ marginRight: '4px' }} />
                    {downloading === `${item.id}-zip` ? t('grades.generating') : t('grades.downloadAsZip')}
                </Button>
            </div>
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
        </div>
    );

    return (
        <Layout>
            <div className={styles.container}>
                <CrudHeader
                    title={t('grades.adminTitle')}
                    logo={<Lottie animationData={statsAnimation} loop={true} style={{ width: 56, height: 56 }} />}
                >
                    {isSuperAdmin && (
                        <ThemedSelect
                            value={selectedCentro}
                            onChange={(v) => { setSelectedCentro(v); setSelectedYear(''); setExpandedId(null); }}
                            minWidth={200}
                            ariaLabel={t('common.selectCenter')}
                            options={[
                                { value: '', label: t('common.selectCenter') },
                                ...centros.map(c => ({ value: String(c.id), label: c.nombre })),
                            ]}
                        />
                    )}
                    <ThemedSelect
                        value={selectedYear}
                        onChange={(v) => { setSelectedYear(v); setExpandedId(null); }}
                        minWidth={160}
                        ariaLabel={t('grades.allYears')}
                        options={[
                            { value: '', label: t('grades.allYears') },
                            ...availableYears.map(y => ({ value: y, label: y })),
                        ]}
                    />
                    <ThemedSelect
                        value={selectedPeriodo}
                        onChange={setSelectedPeriodo}
                        minWidth={180}
                        ariaLabel={t('grades.allPeriods')}
                        options={[
                            { value: '', label: t('grades.allPeriods') },
                            ...periodos.map(p => {
                                const id = p.id || p['@id']?.split('/').pop();
                                return { value: String(id), label: p.nombre };
                            }),
                        ]}
                    />
                </CrudHeader>

                {error && <div className={styles.errorContainer}>{error}</div>}

                {loading ? (
                    <div className={styles.loadingContainer}>{t('common.loading')}</div>
                ) : isSuperAdmin && !selectedCentro ? (
                    <div className={styles.loadingContainer}>{t('common.selectCenter')}</div>
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
