import React, { useEffect, useState } from 'react';
import styles from './Calificaciones.module.css';
import Layout from '../components/Layout';
import { useAuth } from '../context/AuthContext';
import { getApiUrl } from '../config/api';
import { useTranslation } from 'react-i18next';
import { ChevronDown, Download } from 'lucide-react';
import Button from '../components/Button';

const MisCalificaciones = () => {
    const { t, i18n } = useTranslation();
    const { user } = useAuth();
    const isSuperAdmin = user?.roles?.includes('ROLE_SUPER_ADMIN') || user?.roles?.includes('ROLE_SUPERADMIN');

    const [data, setData] = useState(null);
    const [periodos, setPeriodos] = useState([]);
    const [selectedPeriodo, setSelectedPeriodo] = useState('');
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [expandedModules, setExpandedModules] = useState({});
    const [moduleTasks, setModuleTasks] = useState({});
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

                let result = allPeriodos;
                if (grupoIds.length > 1) {
                    const byName = new Map();
                    allPeriodos.forEach(p => { if (!byName.has(p.nombre)) byName.set(p.nombre, p); });
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
                setExpandedModules({});
                setModuleTasks({});
            } catch {
                setError(t('grades.errorLoading'));
            } finally {
                setLoading(false);
            }
        };
        fetchCalificaciones();
    }, [selectedPeriodo, selectedAlumno, isSuperAdmin, t]);

    // Toggle módulo y cargar tareas lazy
    const toggleModule = async (impId) => {
        const isExpanded = expandedModules[impId];
        setExpandedModules(prev => ({ ...prev, [impId]: !isExpanded }));
        if (isExpanded || moduleTasks[impId]) return;

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

            const combined = tareasItems.map(tarea => {
                const tareaId = tarea.id || tarea['@id']?.split('/').pop();
                const entrega = entregas.find(e => {
                    const eTareaId = e.tarea?.id || e.tarea?.['@id']?.split('/').pop() || e.tarea;
                    return String(eTareaId) === String(tareaId);
                });
                return { ...tarea, calificacion: entrega?.calificacion || null };
            });

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
                <div className={styles.sectionHeader}>
                    <div>
                        <h1 className={styles.title}>{t('grades.myGradesTitle')}</h1>
                        {isSuperAdmin && data?.alumno && (
                            <p className={styles.subtitle}>
                                {data.alumno.apellidos}, {data.alumno.nombre}
                            </p>
                        )}
                    </div>
                    <div className={styles.controls}>
                        {isSuperAdmin && (
                            <>
                                <select
                                    className={styles.periodSelect}
                                    value={selectedCentro}
                                    onChange={(e) => setSelectedCentro(e.target.value)}
                                    style={{ minWidth: '200px' }}
                                >
                                    <option value="">{t('common.selectCenter')}</option>
                                    {centros.map(c => (
                                        <option key={c.id} value={c.id}>{c.nombre}</option>
                                    ))}
                                </select>
                                {availableYears.length > 0 && (
                                    <select
                                        className={styles.periodSelect}
                                        value={selectedYear}
                                        onChange={(e) => { setSelectedYear(e.target.value); setSelectedGrupo(''); }}
                                        disabled={!selectedCentro}
                                        style={{ minWidth: '140px' }}
                                    >
                                        <option value="">{t('grades.allYears')}</option>
                                        {availableYears.map(y => (
                                            <option key={y} value={y}>{y}</option>
                                        ))}
                                    </select>
                                )}
                                <select
                                    className={styles.periodSelect}
                                    value={selectedGrupo}
                                    onChange={(e) => setSelectedGrupo(e.target.value)}
                                    disabled={!selectedCentro}
                                >
                                    <option value="">{t('common.allGroups')}</option>
                                    {grupos.map(g => (
                                        <option key={g.id} value={g.id}>{g.nombre}</option>
                                    ))}
                                </select>
                                <select
                                    className={styles.periodSelect}
                                    value={selectedAlumno}
                                    onChange={(e) => { setSelectedAlumno(e.target.value); setSelectedPeriodo(''); }}
                                    disabled={!selectedGrupo}
                                >
                                    <option value="">{t('common.selectStudent')}</option>
                                    {alumnos.map(a => (
                                        <option key={a.id} value={a.id}>{a.apellidos}, {a.nombre}</option>
                                    ))}
                                </select>
                            </>
                        )}
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
                        <Button
                            size="sm"
                            onClick={handleDownloadBoletin}
                            disabled={!selectedPeriodo || downloadingReport}
                        >
                            <Download size={14} style={{ marginRight: '4px' }} />
                            {downloadingReport ? t('grades.generating') : t('grades.downloadReport')}
                        </Button>
                    </div>
                </div>

                {error && <div className={styles.errorContainer}>{error}</div>}

                {loading ? (
                    <div className={styles.loadingContainer}>{t('common.loading')}</div>
                ) : isSuperAdmin && !selectedAlumno ? (
                    <div className={styles.loadingContainer}>{t('common.selectStudent')}</div>
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

                                    <button className={styles.moduleToggle} onClick={() => toggleModule(impId)}>
                                        <ChevronDown size={16} className={`${styles.chevron} ${isExpanded ? styles.chevronOpen : ''}`} />
                                        {isExpanded ? t('grades.hideTasks') : t('grades.showTasks')}
                                    </button>

                                    <div className={`${styles.moduleTaskListWrapper} ${isExpanded ? styles.open : ''}`}>
                                        <div className={styles.moduleTaskListInner}>
                                        <div className={styles.moduleTaskList}>
                                            {isLoadingTasks ? (
                                                <div style={{ padding: 'var(--space-2)', color: 'var(--text-muted)', fontSize: 'var(--text-sm)' }}>
                                                    {t('common.loading')}
                                                </div>
                                            ) : !tasks?.length ? (
                                                <div style={{ padding: 'var(--space-2)', color: 'var(--text-muted)', fontSize: 'var(--text-sm)', fontStyle: 'italic' }}>
                                                    {t('grades.noGrades')}
                                                </div>
                                            ) : (() => {
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
                                                    {filteredTasks.length === 0 ? (
                                                        <div style={{ padding: 'var(--space-2)', color: 'var(--text-muted)', fontSize: 'var(--text-sm)', fontStyle: 'italic' }}>
                                                            {t('grades.noTasksType')}
                                                        </div>
                                                    ) : filteredTasks.map(tarea => {
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
                                                })}
                                                    </>
                                                );
                                            })()}
                                        </div>
                                        </div>
                                    </div>
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
