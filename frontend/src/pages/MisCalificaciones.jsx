import React, { useEffect, useState } from 'react';
import styles from './Calificaciones.module.css';
import Layout from '../components/Layout';
import { useAuth } from '../context/AuthContext';
import { getApiUrl } from '../config/api';
import { useTranslation } from 'react-i18next';
import { Download } from 'lucide-react';
import Button from '../components/Button';
import ThemedSelect from '../components/ThemedSelect';
import AccordionView from '../components/AccordionView';
import CrudHeader from '../components/CrudHeader';
import Lottie from 'lottie-react';
import statsAnimation from '../../public/stats.json';

// Header de cada módulo dentro del AccordionView. Dispara la carga lazy de
// tareas la primera vez que el item se expande.
const ModuleHeader = ({ mod, isExpanded, onExpand, getGradeClass, formatGrade, styles, t, filteredCount }) => {
    React.useEffect(() => {
        if (isExpanded) onExpand?.();
    }, [isExpanded]); // eslint-disable-line react-hooks/exhaustive-deps

    const stats = [
        { val: mod.mediaExamenes,  label: t('grades.avgExams') },
        { val: mod.mediaTareas,    label: t('grades.avgTasks') },
        { val: mod.mediaPracticas, label: t('grades.avgPractice') },
        { val: null, label: t('grades.pending'), text: `${mod.entregasPendientes}/${mod.totalTareas}` },
    ];

    return (
        <div className={styles.moduleHeaderRow}>
            <div className={styles.moduleHeaderMain}>
                <div className={styles.moduleName}>
                    {mod.imparticion.modulo}
                    <span className="accordionHeaderCount" style={{ marginLeft: 'var(--space-2)' }}>
                        {filteredCount}
                    </span>
                </div>
                <div className={styles.moduleTeacher}>{mod.imparticion.profesor} — {mod.imparticion.grupo}</div>
                <div className={styles.moduleStatsChips}>
                    {stats.map((s, i) => (
                        <span key={i} className={styles.statChip}>
                            <span className={styles.statChipLabel}>{s.label}</span>
                            <span className={styles.statChipValue}>
                                {s.text || formatGrade(s.val)}
                            </span>
                        </span>
                    ))}
                </div>
            </div>
            <div className={`${styles.moduleGrade} ${mod.evaluable === false ? styles.gradeFail : getGradeClass(mod.notaFinal)}`}
                 title={mod.evaluable === false ? (mod.motivosNoEvaluable || []).map(m =>
                    m.razon === 'obligatoria_no_entregada'
                        ? `${m.titulo}: ${t('grades.reasonMandatoryMissing', { defaultValue: 'no entregada (obligatoria)' })}`
                        : m.razon === 'nota_minima_no_alcanzada'
                            ? `${m.titulo}: ${t('grades.reasonBelowMin', { defaultValue: 'por debajo del mínimo' })} (${m.nota} < ${m.notaMinima})`
                            : m.titulo
                 ).join('\n') : ''}>
                {mod.evaluable === false ? t('grades.notEvaluable') : formatGrade(mod.notaFinal)}
            </div>
        </div>
    );
};

const MisCalificaciones = () => {
    const { t, i18n } = useTranslation();
    const { user } = useAuth();
    const isSuperAdmin = user?.roles?.includes('ROLE_SUPER_ADMIN') || user?.roles?.includes('ROLE_SUPERADMIN');

    const [data, setData] = useState(null);
    const [periodos, setPeriodos] = useState([]);
    const [selectedPeriodo, setSelectedPeriodo] = useState('');
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [moduleTasks, setModuleTasks] = useState({});
    const [expandedModuleId, setExpandedModuleId] = useState(null);
    const [loadingTasks, setLoadingTasks] = useState({});
    const [moduleTab, setModuleTab] = useState({}); // { impId: 'todos'|'examen'|'tarea'|'practica' }
    const [downloadingReport, setDownloadingReport] = useState(false);

    const handleDownloadBoletin = async () => {
        if (!selectedPeriodo) { alert(t('grades.selectPeriodFirst')); return; }
        const alumnoId = isSuperAdmin && selectedAlumno ? selectedAlumno : user.id;
        setDownloadingReport(true);
        try {
            const res = await fetch(
                getApiUrl(`/api/v1/informes/boletin/${alumnoId}/${selectedPeriodo}?lang=${(i18n.language || 'es').substring(0, 2)}`),
                { credentials: 'include' }
            );
            if (!res.ok) throw new Error();
            const blob = await res.blob();
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `boletin.pdf`;
            a.click();
            URL.revokeObjectURL(url);
        } catch { alert(t('grades.errorLoading')); }
        finally { setDownloadingReport(false); }
    };

    // Filtros SuperAdmin: Centro → Grupo → Alumno
    const [centros, setCentros] = useState([]);
    const [selectedCentro, setSelectedCentro] = useState('');
    const [allGrupos, setAllGrupos] = useState([]);
    const [selectedYear, setSelectedYear] = useState('');
    const [selectedGrupo, setSelectedGrupo] = useState('');
    const [alumnos, setAlumnos] = useState([]);
    const [selectedAlumno, setSelectedAlumno] = useState('');

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

    // Cargar grupos cuando cambia el centro
    useEffect(() => {
        if (!isSuperAdmin || !selectedCentro) {
            setAllGrupos([]); setSelectedYear(''); setSelectedGrupo(''); setAlumnos([]); setSelectedAlumno('');
            return;
        }
        fetch(getApiUrl(`/api/grupos?centro=${selectedCentro}&pagination=false`), {
            headers: { 'Accept': 'application/ld+json' }, credentials: 'include'
        })
        .then(res => res.json())
        .then(d => {
            setAllGrupos(d['hydra:member'] || d.member || []);
            setSelectedYear(''); setSelectedGrupo(''); setAlumnos([]); setSelectedAlumno('');
        })
        .catch(() => {});
    }, [selectedCentro, isSuperAdmin]);

    const availableYears = [...new Set(allGrupos.map(g => g.anioEscolar).filter(Boolean))].sort().reverse();
    const grupos = selectedYear ? allGrupos.filter(g => g.anioEscolar === selectedYear) : allGrupos;

    // Cargar alumnos cuando cambia el grupo
    useEffect(() => {
        if (!isSuperAdmin || !selectedGrupo) {
            setAlumnos([]); setSelectedAlumno('');
            return;
        }
        fetch(getApiUrl(`/api/matriculas?grupo=${selectedGrupo}&pagination=false`), {
            headers: { 'Accept': 'application/ld+json' }, credentials: 'include'
        })
        .then(res => res.json())
        .then(d => {
            const items = d['hydra:member'] || d.member || [];
            const list = items.map(m => m.alumno).filter(Boolean);
            list.sort((a, b) => `${a.apellidos} ${a.nombre}`.localeCompare(`${b.apellidos} ${b.nombre}`));
            setAlumnos(list);
            setSelectedAlumno('');
        })
        .catch(() => {});
    }, [selectedGrupo, isSuperAdmin]);

    // Cargar periodos filtrados por los grupos del alumno
    useEffect(() => {
        if (!user) return;
        const fetchPeriodos = async () => {
            try {
                let grupoIds = [];

                if (isSuperAdmin) {
                    if (!selectedAlumno) return;
                    // Usar el grupo seleccionado
                    if (selectedGrupo) grupoIds = [selectedGrupo];
                } else {
                    const matriculasRes = await fetch(getApiUrl(`/api/matriculas?alumno=${user.id}&pagination=false`), {
                        headers: { 'Accept': 'application/ld+json' }, credentials: 'include'
                    });
                    if (!matriculasRes.ok) return;
                    const matriculasData = await matriculasRes.json();
                    const matriculas = matriculasData['hydra:member'] || matriculasData.member || [];
                    grupoIds = matriculas.map(m => {
                        if (typeof m.grupo === 'string') return m.grupo.split('/').pop();
                        return m.grupo?.id || m.grupo?.['@id']?.split('/').pop();
                    }).filter(Boolean);
                }

                if (grupoIds.length === 0) { setPeriodos([]); return; }

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

                // Solo evaluaciones ya finalizadas
                const hoy = new Date(); hoy.setHours(0,0,0,0);
                let result = allPeriodos.filter(p => p.fechaFin && new Date(p.fechaFin) < hoy);
                if (grupoIds.length > 1) {
                    const byName = new Map();
                    result.forEach(p => { if (!byName.has(p.nombre)) byName.set(p.nombre, p); });
                    result = [...byName.values()];
                }
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
    }, [user, isSuperAdmin, selectedAlumno, selectedGrupo]);

    // Cargar calificaciones
    useEffect(() => {
        if (isSuperAdmin && !selectedAlumno) {
            setData(null);
            setLoading(false);
            return;
        }
        const fetchCalificaciones = async () => {
            setLoading(true);
            try {
                let url = getApiUrl('/api/v1/alumno/mis-calificaciones');
                const params = new URLSearchParams();
                if (selectedPeriodo) params.set('periodo', selectedPeriodo);
                if (isSuperAdmin && selectedAlumno) params.set('alumnoId', selectedAlumno);
                const qs = params.toString();
                if (qs) url += `?${qs}`;

                const response = await fetch(url, { credentials: 'include' });
                if (!response.ok) throw new Error();
                setData(await response.json());
                setError(null);
                setModuleTasks({});
                // No cerramos el accordion al cambiar de filtro. El useEffect de
                // sincronización (abajo) recargará las tareas del módulo expandido
                // o lo cerrará si ya no existe en los nuevos datos.
            } catch {
                setError(t('grades.errorLoading'));
            } finally {
                setLoading(false);
            }
        };
        fetchCalificaciones();
    }, [selectedPeriodo, selectedAlumno, isSuperAdmin, t]);

    // Tras cada fetch: si el módulo expandido sigue existiendo, recarga sus tareas
    // (se limpian al cambiar de filtro). Si ya no existe, cierra el accordion.
    useEffect(() => {
        if (!data?.modulos || !expandedModuleId) return;
        const stillExists = data.modulos.some(m => m.imparticion.id === expandedModuleId);
        if (!stillExists) {
            setExpandedModuleId(null);
            return;
        }
        if (!moduleTasks[expandedModuleId] && !loadingTasks[expandedModuleId]) {
            loadTasksForModule(expandedModuleId);
        }
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [data, expandedModuleId]);

    // Carga las tareas + entregas de un módulo (lazy). Idempotente: no recarga
    // si ya están en moduleTasks o en proceso de carga.
    const loadTasksForModule = async (impId) => {
        if (moduleTasks[impId] || loadingTasks[impId]) return;
        const targetAlumnoId = isSuperAdmin && selectedAlumno ? selectedAlumno : user.id;

        setLoadingTasks(prev => ({ ...prev, [impId]: true }));
        try {
            const tareasRes = await fetch(
                getApiUrl(`/api/tareas?imparticion=${impId}&order[fechaLimite]=asc&itemsPerPage=100`),
                { headers: { 'Accept': 'application/ld+json' }, credentials: 'include' }
            );
            if (!tareasRes.ok) throw new Error();
            const tareasData = await tareasRes.json();
            const tareasItems = tareasData['hydra:member'] || tareasData.member || [];

            const entregasRes = await fetch(
                getApiUrl(`/api/entregas?alumno=${targetAlumnoId}&itemsPerPage=200`),
                { headers: { 'Accept': 'application/ld+json' }, credentials: 'include' }
            );
            const entregasData = await entregasRes.json();
            const entregas = entregasData['hydra:member'] || entregasData.member || [];

            // Map rápido de calificaciones por tareaId (para saber si la padre está aprobada en el indicador)
            const calPorTareaId = new Map();
            entregas.forEach(e => {
                const tId = e.tarea?.id || e.tarea?.['@id']?.split('/').pop() || e.tarea;
                if (tId && e.calificacion) calPorTareaId.set(String(tId), e.calificacion);
            });

            let combined = tareasItems.map(tarea => {
                const tareaId = tarea.id || tarea['@id']?.split('/').pop();
                const entrega = entregas.find(e => {
                    const eTareaId = e.tarea?.id || e.tarea?.['@id']?.split('/').pop() || e.tarea;
                    return String(eTareaId) === String(tareaId);
                });
                const padreObj = tarea.tareaOriginal;
                const padreId = padreObj
                    ? (typeof padreObj === 'string' ? padreObj.split('/').pop() : (padreObj.id || padreObj['@id']?.split('/').pop()))
                    : null;
                const padreTitulo = typeof padreObj === 'object' ? padreObj?.titulo : null;
                const calPadre = padreId ? calPorTareaId.get(String(padreId)) : null;
                const padreAprobada = calPadre?.nota != null && calPadre.nota >= 5;
                return {
                    ...tarea,
                    calificacion: entrega?.calificacion || null,
                    _esHija: !!padreId,
                    _padreTitulo: padreTitulo,
                    _padreAprobada: padreAprobada,
                };
            });

            // Filtrar por período seleccionado (fechaLimite dentro del rango)
            if (selectedPeriodo) {
                const p = periodos.find(pp => String(pp.id || pp['@id']?.split('/').pop()) === String(selectedPeriodo));
                if (p) {
                    const ini = new Date(p.fechaInicio);
                    const fin = new Date(p.fechaFin);
                    fin.setHours(23, 59, 59, 999);
                    combined = combined.filter(tr => {
                        if (!tr.fechaLimite) return false;
                        const d = new Date(tr.fechaLimite);
                        return d >= ini && d <= fin;
                    });
                }
            }

            setModuleTasks(prev => ({ ...prev, [impId]: combined }));
        } catch { /* silencioso */ } finally {
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
                <CrudHeader
                    title={t('grades.myGradesTitle')}
                    subtitle={isSuperAdmin && data?.alumno ? `${data.alumno.apellidos}, ${data.alumno.nombre}` : undefined}
                    logo={<Lottie animationData={statsAnimation} loop={true} style={{ width: 56, height: 56 }} />}
                >
                    {isSuperAdmin && (
                        <>
                            <ThemedSelect
                                value={selectedCentro}
                                onChange={setSelectedCentro}
                                minWidth={200}
                                ariaLabel={t('common.selectCenter')}
                                options={[
                                    { value: '', label: t('common.selectCenter') },
                                    ...centros.map(c => ({ value: String(c.id), label: c.nombre })),
                                ]}
                            />
                            {availableYears.length > 0 && (
                                <ThemedSelect
                                    value={selectedYear}
                                    onChange={(v) => { setSelectedYear(v); setSelectedGrupo(''); }}
                                    disabled={!selectedCentro}
                                    minWidth={140}
                                    ariaLabel={t('grades.allYears')}
                                    options={[
                                        { value: '', label: t('grades.allYears') },
                                        ...availableYears.map(y => ({ value: y, label: y })),
                                    ]}
                                />
                            )}
                            <ThemedSelect
                                value={selectedGrupo}
                                onChange={setSelectedGrupo}
                                disabled={!selectedCentro}
                                minWidth={150}
                                ariaLabel={t('common.allGroups')}
                                options={[
                                    { value: '', label: t('common.allGroups') },
                                    ...grupos.map(g => ({ value: String(g.id), label: g.nombre })),
                                ]}
                            />
                            <ThemedSelect
                                value={selectedAlumno}
                                onChange={(v) => { setSelectedAlumno(v); setSelectedPeriodo(''); }}
                                disabled={!selectedGrupo}
                                minWidth={200}
                                ariaLabel={t('common.selectStudent')}
                                options={[
                                    { value: '', label: t('common.selectStudent') },
                                    ...alumnos.map(a => ({ value: String(a.id), label: `${a.apellidos}, ${a.nombre}` })),
                                ]}
                            />
                        </>
                    )}
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
                    <Button
                        size="sm"
                        onClick={handleDownloadBoletin}
                        disabled={!selectedPeriodo || downloadingReport}
                    >
                        <Download size={14} style={{ marginRight: '4px' }} />
                        {downloadingReport ? t('grades.generating') : t('grades.downloadReport')}
                    </Button>
                </CrudHeader>

                {error && <div className={styles.errorContainer}>{error}</div>}

                {loading ? (
                    <div className={styles.loadingContainer}>{t('common.loading')}</div>
                ) : isSuperAdmin && !selectedAlumno ? (
                    <div className={styles.loadingContainer}>{t('common.selectStudent')}</div>
                ) : !data?.modulos?.length ? (
                    <div className={styles.loadingContainer}>{t('grades.noGrades')}</div>
                ) : (
                    <AccordionView
                        data={data.modulos.map(m => ({ ...m, id: m.imparticion.id }))}
                        expandedId={expandedModuleId}
                        onToggle={(id) => setExpandedModuleId(prev => prev === id ? null : id)}
                        renderHeader={(mod, isExpanded) => {
                            const impId = mod.imparticion.id;
                            const tasks = moduleTasks[impId];
                            const tab = moduleTab[impId] || 'todos';
                            const filteredCount = tasks
                                ? (tab === 'todos' ? tasks.length : tasks.filter(x => x.tipo === tab).length)
                                : mod.totalTareas;
                            return (
                                <ModuleHeader
                                    mod={mod}
                                    isExpanded={isExpanded}
                                    onExpand={() => loadTasksForModule(impId)}
                                    getGradeClass={getGradeClass}
                                    formatGrade={formatGrade}
                                    styles={styles}
                                    t={t}
                                    filteredCount={filteredCount}
                                />
                            );
                        }}
                        renderItem={(mod) => {
                            const impId = mod.imparticion.id;
                            const tasks = moduleTasks[impId];
                            const isLoadingTasks = loadingTasks[impId];
                            if (isLoadingTasks) {
                                return <div style={{ color: 'var(--text-muted)', fontSize: 'var(--text-sm)' }}>{t('common.loading')}</div>;
                            }
                            if (!tasks?.length) {
                                return <div style={{ color: 'var(--text-muted)', fontSize: 'var(--text-sm)', fontStyle: 'italic' }}>{t('grades.noGrades')}</div>;
                            }
                            const activeTab = moduleTab[impId] || 'todos';
                            const filteredTasks = activeTab === 'todos' ? tasks : tasks.filter(t => t.tipo === activeTab);
                            const counts = { todos: tasks.length, examen: 0, tarea: 0, practica: 0 };
                            tasks.forEach(t => { if (counts[t.tipo] !== undefined) counts[t.tipo]++; });
                            return (
                                <>
                                    <div className={styles.tabBar} style={{ marginTop: 0 }}>
                                        {[
                                            { key: 'todos', label: t('grades.filterAll') },
                                            { key: 'examen', label: t('grades.exam') },
                                            { key: 'tarea', label: t('grades.task') },
                                            { key: 'practica', label: t('grades.practice') },
                                        ].map(tab => (
                                            <button
                                                key={tab.key}
                                                className={`${styles.tab} ${activeTab === tab.key ? styles.tabActive : ''}`}
                                                onClick={() => setModuleTab(prev => ({ ...prev, [impId]: tab.key }))}
                                            >
                                                {tab.label}
                                                <span className={styles.tabCount}>{counts[tab.key]}</span>
                                            </button>
                                        ))}
                                    </div>
                                    <div key={activeTab} className={styles.tabContent}>
                                        {filteredTasks.length === 0 ? (
                                            <div style={{ padding: 'var(--space-2)', color: 'var(--text-muted)', fontSize: 'var(--text-sm)', fontStyle: 'italic' }}>
                                                {t('grades.noTasksType')}
                                            </div>
                                        ) : filteredTasks.map(tarea => {
                                            const nota = tarea.calificacion?.nota ?? null;
                                            const feedback = tarea.calificacion?.feedbackProfesor;
                                            const indicador = tarea._esHija
                                                ? (tarea._padreAprobada
                                                    ? { txt: t('grades.upgradesIndicator', { title: tarea._padreTitulo || '', defaultValue: '↑ sube nota: {{title}}' }) }
                                                    : { txt: t('grades.recoversIndicator', { title: tarea._padreTitulo || '', defaultValue: '↩ recupera: {{title}}' }) })
                                                : null;
                                            return (
                                                <div key={tarea.id || tarea['@id']} className={styles.taskItem}>
                                                    <div className={styles.taskInfo}>
                                                        <div className={styles.taskName}>
                                                            {tarea.titulo}
                                                            <span className={`${styles.taskBadge} ${getBadgeClass(tarea.tipo)}`} style={{ marginLeft: 'var(--space-2)' }}>
                                                                {getTypeName(tarea.tipo)}
                                                            </span>
                                                            {indicador && (
                                                                <span style={{ marginLeft: 'var(--space-2)', fontSize: 'var(--text-xs)', color: 'var(--text-muted)', fontStyle: 'italic' }}>
                                                                    {indicador.txt}
                                                                </span>
                                                            )}
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
                                        })}
                                    </div>
                                </>
                            );
                        }}
                    />
                )}
            </div>
        </Layout>
    );
};

export default MisCalificaciones;
