import React, { useEffect, useState, useMemo, useCallback } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import styles from './Calificaciones.module.css';
import Layout from '../components/Layout';
import ThemedSelect from '../components/ThemedSelect';
import ThemedNumberInput from '../components/ThemedNumberInput';
import Button from '../components/Button';
import ModalView from '../components/ModalView';
import { getApiUrl } from '../config/api';
import { useTranslation } from 'react-i18next';
import { ArrowLeft, Edit2, Check, X, AlertTriangle, RotateCcw, Plus, Trash2 } from 'lucide-react';

const CalificacionesDetalle = () => {
    const { t } = useTranslation();
    const navigate = useNavigate();
    const [searchParams] = useSearchParams();
    const imparticionId = searchParams.get('imparticion');
    const alumnoId = searchParams.get('alumno');
    const tareaParam = searchParams.get('tarea');

    const [mediaData, setMediaData] = useState(null);
    const [tareas, setTareas] = useState([]);
    const [periodos, setPeriodos] = useState([]);
    const [selectedPeriodo, setSelectedPeriodo] = useState('');
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [activeTab, setActiveTab] = useState('todos');
    const [statusFilter, setStatusFilter] = useState('all'); // all | ungraded | undelivered
    const [editingFeedback, setEditingFeedback] = useState(null);
    const [feedbackValue, setFeedbackValue] = useState('');
    const [editingNota, setEditingNota] = useState(null);
    const [notaValue, setNotaValue] = useState('');
    const [saving, setSaving] = useState(false);
    const [recuperaciones, setRecuperaciones] = useState([]);
    const [recModal, setRecModal] = useState({ open: false, tarea: null });
    const [recForm, setRecForm] = useState({ tipo: 'recuperacion', nota: '', feedbackProfesor: '' });
    const [savingRec, setSavingRec] = useState(false);

    // Cargar periodos del grupo al cargar la impartición
    useEffect(() => {
        if (!imparticionId) return;
        const fetchPeriodos = async () => {
            try {
                const impRes = await fetch(
                    getApiUrl(`/api/imparticions/${imparticionId}`),
                    { headers: { 'Accept': 'application/ld+json' }, credentials: 'include' }
                );
                if (!impRes.ok) return;
                const imp = await impRes.json();
                const grupoRef = imp.grupo;
                const grupoId = typeof grupoRef === 'string'
                    ? grupoRef.split('/').pop()
                    : (grupoRef?.id || grupoRef?.['@id']?.split('/').pop());
                if (!grupoId) return;

                const pRes = await fetch(
                    getApiUrl(`/api/periodo_evaluativos?grupo=${grupoId}&order[fechaInicio]=asc`),
                    { headers: { 'Accept': 'application/ld+json' }, credentials: 'include' }
                );
                if (!pRes.ok) return;
                const pData = await pRes.json();
                let items = pData['hydra:member'] || pData.member || [];
                const hoy = new Date(); hoy.setHours(0,0,0,0);
                items = items.filter(p => p.fechaFin && new Date(p.fechaFin) < hoy);
                items.sort((a, b) => {
                    const aExtra = a.tipo === 'EXTRAORDINARIA' ? 1 : 0;
                    const bExtra = b.tipo === 'EXTRAORDINARIA' ? 1 : 0;
                    if (aExtra !== bExtra) return aExtra - bExtra;
                    return (a.fechaInicio || '').localeCompare(b.fechaInicio || '');
                });
                setPeriodos(items);
            } catch { /* no crítico */ }
        };
        fetchPeriodos();
    }, [imparticionId]);

    const fetchData = useCallback(async () => {
        if (!imparticionId || !alumnoId) return;
        setLoading(true);
        try {
            const mediaUrl = selectedPeriodo
                ? `/api/v1/imparticion/${imparticionId}/media/${alumnoId}?periodo=${selectedPeriodo}`
                : `/api/v1/imparticion/${imparticionId}/media/${alumnoId}`;
            const mediaRes = await fetch(getApiUrl(mediaUrl), { credentials: 'include' });
            if (!mediaRes.ok) throw new Error();
            setMediaData(await mediaRes.json());

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

            const recRes = await fetch(
                getApiUrl(`/api/recuperacions?alumno=${alumnoId}&pagination=false&order[fecha]=asc`),
                { headers: { 'Accept': 'application/ld+json' }, credentials: 'include' }
            );
            if (recRes.ok) {
                const recData = await recRes.json();
                setRecuperaciones(recData['hydra:member'] || recData.member || []);
            }

            setError(null);
        } catch {
            setError(t('grades.errorLoading'));
        } finally {
            setLoading(false);
        }
    }, [imparticionId, alumnoId, selectedPeriodo, t]);

    // Map por tareaId -> array de recuperaciones (ordenadas por fecha asc)
    const recuperacionesByTarea = useMemo(() => {
        const map = {};
        recuperaciones.forEach(r => {
            const tId = r.tarea?.id || r.tarea?.['@id']?.split('/').pop() || r.tarea;
            const key = String(tId);
            if (!map[key]) map[key] = [];
            map[key].push(r);
        });
        return map;
    }, [recuperaciones]);

    const openRecModal = (tarea) => {
        setRecForm({ tipo: 'recuperacion', nota: '', feedbackProfesor: '' });
        setRecModal({ open: true, tarea });
    };
    const closeRecModal = () => setRecModal({ open: false, tarea: null });

    const handleSaveRecuperacion = async (e) => {
        e.preventDefault();
        const parsed = parseFloat(recForm.nota);
        if (isNaN(parsed) || parsed < 0 || parsed > 10) {
            alert(t('grades.gradeRange', { defaultValue: 'La nota debe estar entre 0 y 10' }));
            return;
        }
        setSavingRec(true);
        try {
            const tareaId = recModal.tarea.id || recModal.tarea['@id']?.split('/').pop();
            const res = await fetch(getApiUrl('/api/recuperacions'), {
                method: 'POST',
                headers: { 'Content-Type': 'application/ld+json', 'Accept': 'application/ld+json' },
                body: JSON.stringify({
                    tarea: `/api/tareas/${tareaId}`,
                    alumno: `/api/users/${alumnoId}`,
                    tipo: recForm.tipo,
                    nota: parsed,
                    fecha: new Date().toISOString(),
                    feedbackProfesor: recForm.feedbackProfesor || null,
                }),
                credentials: 'include',
            });
            if (!res.ok) throw new Error();
            closeRecModal();
            await fetchData();
        } catch {
            alert(t('grades.errorSavingRecuperacion', { defaultValue: 'Error al guardar la recuperación' }));
        } finally {
            setSavingRec(false);
        }
    };

    const handleDeleteRecuperacion = async (recId) => {
        if (!window.confirm(t('grades.confirmDeleteRec', { defaultValue: '¿Eliminar esta recuperación?' }))) return;
        try {
            const res = await fetch(getApiUrl(`/api/recuperacions/${recId}`), {
                method: 'DELETE', credentials: 'include',
            });
            if (!res.ok) throw new Error();
            await fetchData();
        } catch {
            alert(t('grades.errorDeletingRec', { defaultValue: 'Error al eliminar' }));
        }
    };

    useEffect(() => { fetchData(); }, [fetchData]);

    // Deep-link a tarea concreta: cambiar tab + scroll
    useEffect(() => {
        if (!tareaParam || tareas.length === 0) return;
        const tarea = tareas.find(t => String(t.id || t['@id']?.split('/').pop()) === String(tareaParam));
        if (!tarea) return;
        // Cambiar al tab del tipo de tarea (o "todos" si ya lo incluye)
        if (tarea.tipo && ['examen', 'tarea', 'practica'].includes(tarea.tipo)) {
            setActiveTab(tarea.tipo);
        }
        // Scroll al elemento tras el render
        requestAnimationFrame(() => {
            const el = document.getElementById(`tarea-${tareaParam}`);
            if (el) {
                el.scrollIntoView({ behavior: 'smooth', block: 'center' });
                // Highlight temporal
                el.style.boxShadow = `inset 3px 0 0 0 var(--color-primary-500), var(--shadow-md)`;
                setTimeout(() => { el.style.boxShadow = ''; }, 2000);
            }
        });
    }, [tareaParam, tareas]);

    const tabs = [
        { key: 'todos', label: t('grades.filterAll') },
        { key: 'examen', label: t('grades.exam') },
        { key: 'tarea', label: t('grades.task') },
        { key: 'practica', label: t('grades.practice') },
    ];

    // Filtrar por periodo en cliente (por fechaLimite)
    const tareasEnPeriodo = useMemo(() => {
        if (!selectedPeriodo) return tareas;
        const p = periodos.find(pp => String(pp.id || pp['@id']?.split('/').pop()) === String(selectedPeriodo));
        if (!p) return tareas;
        const ini = new Date(p.fechaInicio);
        const fin = new Date(p.fechaFin);
        fin.setHours(23, 59, 59, 999);
        return tareas.filter(tr => {
            if (!tr.fechaLimite) return false;
            const d = new Date(tr.fechaLimite);
            return d >= ini && d <= fin;
        });
    }, [tareas, periodos, selectedPeriodo]);

    const filteredTareas = useMemo(() => {
        let result = activeTab === 'todos' ? tareasEnPeriodo : tareasEnPeriodo.filter(tr => tr.tipo === activeTab);
        if (statusFilter === 'ungraded') result = result.filter(tr => tr.calificacion?.nota == null);
        else if (statusFilter === 'undelivered') result = result.filter(tr => !tr.entrega);
        return result;
    }, [tareasEnPeriodo, activeTab, statusFilter]);

    const counts = useMemo(() => {
        let base = tareasEnPeriodo;
        if (statusFilter === 'ungraded') base = base.filter(tr => tr.calificacion?.nota == null);
        else if (statusFilter === 'undelivered') base = base.filter(tr => !tr.entrega);
        const c = { todos: base.length, examen: 0, tarea: 0, practica: 0 };
        base.forEach(tr => { if (c[tr.tipo] !== undefined) c[tr.tipo]++; });
        return c;
    }, [tareasEnPeriodo, statusFilter]);

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

    // Asegurar que existe una entrega+calificacion para poder guardar nota/feedback
    const ensureCalificacion = async (tarea) => {
        let calId = tarea.calificacion?.id || tarea.calificacion?.['@id']?.split('/').pop();
        if (calId) return { calId, entregaId: tarea.entrega?.id || tarea.entrega?.['@id']?.split('/').pop() };

        let entregaId = tarea.entrega?.id || tarea.entrega?.['@id']?.split('/').pop();
        if (!entregaId) {
            const tareaId = tarea.id || tarea['@id']?.split('/').pop();
            const res = await fetch(getApiUrl('/api/entregas'), {
                method: 'POST',
                headers: { 'Content-Type': 'application/ld+json', 'Accept': 'application/ld+json' },
                body: JSON.stringify({
                    tarea: `/api/tareas/${tareaId}`,
                    alumno: `/api/users/${alumnoId}`,
                    fechaEntrega: new Date().toISOString(),
                }),
                credentials: 'include',
            });
            if (!res.ok) throw new Error('entrega');
            const eData = await res.json();
            entregaId = eData.id || eData['@id']?.split('/').pop();
        }
        return { calId: null, entregaId };
    };

    const handleSaveFeedback = async (tarea) => {
        setSaving(true);
        try {
            const { calId, entregaId } = await ensureCalificacion(tarea);
            if (calId) {
                const res = await fetch(getApiUrl(`/api/calificacions/${calId}`), {
                    method: 'PATCH',
                    headers: { 'Content-Type': 'application/merge-patch+json', 'Accept': 'application/ld+json' },
                    body: JSON.stringify({ feedbackProfesor: feedbackValue }),
                    credentials: 'include',
                });
                if (!res.ok) throw new Error();
            } else {
                const res = await fetch(getApiUrl('/api/calificacions'), {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/ld+json', 'Accept': 'application/ld+json' },
                    body: JSON.stringify({
                        entrega: `/api/entregas/${entregaId}`,
                        nota: 0,
                        feedbackProfesor: feedbackValue,
                    }),
                    credentials: 'include',
                });
                if (!res.ok) throw new Error();
            }
            setEditingFeedback(null);
            await fetchData();
        } catch {
            alert(t('grades.errorSavingFeedback'));
        } finally {
            setSaving(false);
        }
    };

    const handleSaveNota = async (tarea) => {
        const parsed = parseFloat(notaValue);
        if (isNaN(parsed) || parsed < 0 || parsed > 10) {
            alert('La nota debe estar entre 0 y 10');
            return;
        }
        setSaving(true);
        try {
            const { calId, entregaId } = await ensureCalificacion(tarea);
            if (calId) {
                const res = await fetch(getApiUrl(`/api/calificacions/${calId}`), {
                    method: 'PATCH',
                    headers: { 'Content-Type': 'application/merge-patch+json', 'Accept': 'application/ld+json' },
                    body: JSON.stringify({ nota: parsed }),
                    credentials: 'include',
                });
                if (!res.ok) throw new Error();
            } else {
                const res = await fetch(getApiUrl('/api/calificacions'), {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/ld+json', 'Accept': 'application/ld+json' },
                    body: JSON.stringify({
                        entrega: `/api/entregas/${entregaId}`,
                        nota: parsed,
                    }),
                    credentials: 'include',
                });
                if (!res.ok) throw new Error();
            }
            setEditingNota(null);
            await fetchData();
        } catch {
            alert('Error al guardar la nota');
        } finally {
            setSaving(false);
        }
    };

    const chartBars = mediaData ? [
        { label: t('grades.avgExams'), value: mediaData.mediaExamenes, fillClass: styles.barFillExam },
        { label: t('grades.avgTasks'), value: mediaData.mediaTareas, fillClass: styles.barFillTask },
        { label: t('grades.avgPractice'), value: mediaData.mediaPracticas, fillClass: styles.barFillPractice },
        { label: t('grades.finalGrade'), value: mediaData.notaFinal, fillClass: styles.barFillFinal },
    ] : [];

    if (!imparticionId || !alumnoId) {
        return <Layout><div className={styles.container}><div className={styles.errorContainer}>{t('grades.errorLoading')}</div></div></Layout>;
    }
    if (loading && !mediaData) {
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
                    <div>
                        <h1 className={styles.title}>
                            {mediaData?.alumno?.apellidos}, {mediaData?.alumno?.nombre}
                        </h1>
                        {mediaData?.imparticion && (
                            <div style={{ fontSize: 'var(--text-sm)', color: 'var(--text-muted)', marginTop: '4px' }}>
                                {mediaData.imparticion.modulo} — {mediaData.imparticion.grupo} — {mediaData.imparticion.profesor}
                            </div>
                        )}
                    </div>
                    <div className={styles.controls}>
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
                        <ThemedSelect
                            value={statusFilter}
                            onChange={setStatusFilter}
                            minWidth={160}
                            ariaLabel={t('grades.filterStatus')}
                            options={[
                                { value: 'all', label: t('grades.filterAll') },
                                { value: 'ungraded', label: t('grades.filterUngraded') },
                                { value: 'undelivered', label: t('grades.filterUndelivered') },
                            ]}
                        />
                    </div>
                </div>

                {/* Banner "No evaluable" */}
                {mediaData?.evaluable === false && (
                    <div style={{
                        display: 'flex', gap: 'var(--space-3)', alignItems: 'flex-start',
                        background: 'color-mix(in srgb, var(--color-error) 10%, transparent)',
                        border: '1px solid var(--color-error)',
                        borderRadius: 'var(--radius-md)',
                        padding: 'var(--space-3) var(--space-4)',
                        margin: 'var(--space-3) 0',
                    }}>
                        <AlertTriangle size={20} style={{ color: 'var(--color-error)', flexShrink: 0, marginTop: '2px' }} />
                        <div>
                            <div style={{ fontWeight: 'var(--font-bold)', color: 'var(--color-error)' }}>
                                {t('grades.notEvaluableTitle', { defaultValue: 'Alumno no evaluable' })}
                            </div>
                            <ul style={{ margin: '6px 0 0', paddingLeft: '1.2em', fontSize: 'var(--text-sm)' }}>
                                {(mediaData.motivosNoEvaluable || []).map((m, i) => (
                                    <li key={i}>
                                        <strong>{m.titulo}</strong>
                                        {m.razon === 'obligatoria_no_entregada' && (
                                            <> — {t('grades.reasonMandatoryMissing', { defaultValue: 'no entregada (obligatoria)' })}</>
                                        )}
                                        {m.razon === 'nota_minima_no_alcanzada' && (
                                            <> — {t('grades.reasonBelowMin', { defaultValue: 'por debajo del mínimo' })}: {m.nota} &lt; {m.notaMinima}</>
                                        )}
                                    </li>
                                ))}
                            </ul>
                        </div>
                    </div>
                )}

                {/* Resumen cards */}
                <div className={styles.cardGrid}>
                    {[
                        { val: mediaData?.mediaExamenes, label: t('grades.avgExams') },
                        { val: mediaData?.mediaTareas, label: t('grades.avgTasks') },
                        { val: mediaData?.mediaPracticas, label: t('grades.avgPractice') },
                        { val: mediaData?.notaFinal, label: t('grades.finalGrade'), isFinal: true },
                    ].map((item, i) => {
                        const isNotEvaluable = item.isFinal && mediaData?.evaluable === false;
                        return (
                            <div key={i} className={styles.statCard}>
                                <div className={`${styles.statValue} ${isNotEvaluable ? styles.gradeFail : getGradeClass(item.val)}`}>
                                    {isNotEvaluable ? t('grades.notEvaluable') : formatGrade(item.val)}
                                </div>
                                <div className={styles.statLabel}>{item.label}</div>
                            </div>
                        );
                    })}
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
                            const tareaIdStr = String(tarea.id || tarea['@id']?.split('/').pop());
                            const isEditingFb = editingFeedback === tareaKey;
                            const isEditingNt = editingNota === tareaKey;
                            const recsTarea = recuperacionesByTarea[tareaIdStr] || [];
                            const lastRec = recsTarea.length > 0 ? recsTarea[recsTarea.length - 1] : null;
                            const notaEfectiva = lastRec ? lastRec.nota : nota;

                            return (
                                <div key={tareaKey} id={`tarea-${tarea.id || tarea['@id']?.split('/').pop()}`} className={styles.taskItem}>
                                    <div className={styles.taskInfo}>
                                        <div className={styles.taskName}>
                                            {tarea.titulo}
                                            <span className={`${styles.taskBadge} ${getBadgeClass(tarea.tipo)}`} style={{ marginLeft: 'var(--space-2)' }}>
                                                {getTypeName(tarea.tipo)}
                                            </span>
                                            {tarea.obligatoria && (
                                                <span className={`${styles.taskBadge}`} style={{ marginLeft: 'var(--space-2)', background: 'var(--color-error)', color: 'white' }} title={t('tasks.mandatoryHelp')}>
                                                    {t('tasks.mandatory')}
                                                </span>
                                            )}
                                            {tarea.notaMinima != null && (
                                                <span className={`${styles.taskBadge}`} style={{ marginLeft: 'var(--space-2)', background: 'var(--color-warning)', color: 'white' }} title={t('tasks.minGradeHelp')}>
                                                    {t('tasks.minGradeShort', { value: tarea.notaMinima })}
                                                </span>
                                            )}
                                        </div>
                                        <div className={styles.taskMeta}>
                                            {t('grades.deadline')}: {tarea.fechaLimite ? new Date(tarea.fechaLimite).toLocaleDateString() : ''}
                                            {!tarea.entrega && (
                                                tarea.fechaLimite && new Date() > new Date(tarea.fechaLimite)
                                                    ? <> — <em>{t('grades.notDelivered')}</em></>
                                                    : <> — <em>{t('grades.pendingDelivery')}</em></>
                                            )}
                                        </div>

                                        {recsTarea.length > 0 && (
                                            <div style={{ marginTop: 'var(--space-2)', padding: 'var(--space-2)', background: 'color-mix(in srgb, var(--text-main) 4%, transparent)', borderRadius: 'var(--radius-sm)' }}>
                                                <div style={{ fontSize: 'var(--text-xs)', fontWeight: 'var(--font-bold)', color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: '4px' }}>
                                                    {t('grades.recoveriesTitle', { defaultValue: 'Recuperaciones / Subidas' })}
                                                </div>
                                                {recsTarea.map((r, idx) => {
                                                    const rId = r.id || r['@id']?.split('/').pop();
                                                    const isLast = idx === recsTarea.length - 1;
                                                    return (
                                                        <div key={rId} style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)', fontSize: 'var(--text-sm)', padding: '2px 0' }}>
                                                            <RotateCcw size={12} style={{ color: 'var(--text-muted)' }} />
                                                            <span style={{ color: 'var(--text-muted)' }}>
                                                                {r.tipo === 'mejora' ? t('grades.recTypeUpgrade', { defaultValue: 'Subida' }) : t('grades.recTypeRecovery', { defaultValue: 'Recuperación' })}
                                                            </span>
                                                            <span>— {new Date(r.fecha).toLocaleDateString()}</span>
                                                            <span className={`${styles.taskGrade} ${getGradeClass(r.nota)}`} style={{ fontWeight: 'var(--font-bold)' }}>
                                                                {formatGrade(r.nota)}
                                                            </span>
                                                            {isLast && <span style={{ fontSize: 'var(--text-xs)', color: 'var(--color-success)' }}>★ {t('grades.recCounts', { defaultValue: 'cuenta para media' })}</span>}
                                                            {r.feedbackProfesor && <span style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)', fontStyle: 'italic' }}>— {r.feedbackProfesor}</span>}
                                                            <button type="button" className={styles.iconButton} onClick={() => handleDeleteRecuperacion(rId)} title={t('common.delete')} style={{ marginLeft: 'auto' }}>
                                                                <Trash2 size={14} />
                                                            </button>
                                                        </div>
                                                    );
                                                })}
                                            </div>
                                        )}

                                        {/* Feedback editable inline */}
                                        <div className={styles.feedbackInline}>
                                            {isEditingFb ? (
                                                <>
                                                    <input
                                                        className={styles.feedbackInput}
                                                        value={feedbackValue}
                                                        onChange={(e) => setFeedbackValue(e.target.value)}
                                                        placeholder={t('grades.feedback')}
                                                        autoFocus
                                                    />
                                                    <button className={styles.feedbackSaveBtn} onClick={() => handleSaveFeedback(tarea)} disabled={saving}>
                                                        <Check size={14} />
                                                    </button>
                                                    <button className={styles.feedbackEditBtn} onClick={() => setEditingFeedback(null)}>
                                                        <X size={14} />
                                                    </button>
                                                </>
                                            ) : (
                                                <button
                                                    type="button"
                                                    className={styles.editableChip}
                                                    style={{ maxWidth: '100%' }}
                                                    onClick={() => { setEditingFeedback(tareaKey); setFeedbackValue(feedback || ''); }}
                                                    title={t('grades.editFeedback')}
                                                >
                                                    <Edit2 size={14} />
                                                    <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                                        {feedback ? `${t('grades.feedback')}: ${feedback}` : t('grades.noFeedback')}
                                                    </span>
                                                </button>
                                            )}
                                        </div>
                                    </div>

                                    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-2)', alignItems: 'flex-end' }}>
                                        {/* Nota editable (original) */}
                                        {isEditingNt ? (
                                            <div className={styles.feedbackInline} style={{ alignItems: 'center' }}>
                                                <ThemedNumberInput
                                                    min={0}
                                                    max={10}
                                                    step={0.1}
                                                    value={notaValue}
                                                    onChange={setNotaValue}
                                                    width={110}
                                                    ariaLabel={t('grades.gradeLabel', { defaultValue: 'Nota' })}
                                                />
                                                <button className={styles.feedbackSaveBtn} onClick={() => handleSaveNota(tarea)} disabled={saving}>
                                                    <Check size={14} />
                                                </button>
                                                <button className={styles.feedbackEditBtn} onClick={() => setEditingNota(null)}>
                                                    <X size={14} />
                                                </button>
                                            </div>
                                        ) : (
                                            <button
                                                type="button"
                                                className={`${styles.gradeEditable} ${nota == null ? styles.gradeEmpty : ''}`}
                                                onClick={() => { setEditingNota(tareaKey); setNotaValue(nota != null ? String(nota) : ''); }}
                                                title={lastRec ? t('grades.originalGradeHint', { defaultValue: 'Nota original (sustituida por recuperación)' }) : 'Editar nota'}
                                            >
                                                <Edit2 size={14} className={styles.editHint} />
                                                <span className={`${styles.taskGrade} ${lastRec ? styles.gradeNa : getGradeClass(nota)}`} style={lastRec ? { textDecoration: 'line-through', opacity: 0.6 } : undefined}>
                                                    {nota == null ? '+ Poner nota' : formatGrade(nota)}
                                                </span>
                                            </button>
                                        )}
                                        <Button size="sm" variant="secondary" onClick={() => openRecModal(tarea)} title={t('grades.addRecuperacion', { defaultValue: 'Añadir recuperación/subida' })}>
                                            <Plus size={14} style={{ marginRight: '4px' }} />
                                            {t('grades.addRec', { defaultValue: 'Recuperación' })}
                                        </Button>
                                    </div>
                                </div>
                            );
                        })
                    )}
                </div>

                <ModalView
                    isOpen={recModal.open}
                    onClose={closeRecModal}
                    title={t('grades.addRecuperacionTitle', { defaultValue: 'Añadir recuperación / subida de nota', tarea: recModal.tarea?.titulo })}
                    onSubmit={handleSaveRecuperacion}
                    isSubmitting={savingRec}
                    submitText={t('common.save')}
                >
                    <div style={{ marginBottom: 'var(--space-3)' }}>
                        <label style={{ display: 'block', marginBottom: '4px', fontSize: 'var(--text-sm)', fontWeight: 'var(--font-bold)' }}>
                            {t('grades.recType', { defaultValue: 'Tipo' })}
                        </label>
                        <ThemedSelect
                            value={recForm.tipo}
                            onChange={(v) => setRecForm(f => ({ ...f, tipo: v }))}
                            options={[
                                { value: 'recuperacion', label: t('grades.recTypeRecovery', { defaultValue: 'Recuperación' }) },
                                { value: 'mejora', label: t('grades.recTypeUpgrade', { defaultValue: 'Subida de nota' }) },
                            ]}
                        />
                    </div>
                    <div style={{ marginBottom: 'var(--space-3)' }}>
                        <label style={{ display: 'block', marginBottom: '4px', fontSize: 'var(--text-sm)', fontWeight: 'var(--font-bold)' }}>
                            {t('grades.gradeLabel', { defaultValue: 'Nota' })}
                        </label>
                        <ThemedNumberInput
                            min={0} max={10} step={0.1}
                            value={recForm.nota}
                            onChange={(v) => setRecForm(f => ({ ...f, nota: v }))}
                            width={120}
                            ariaLabel={t('grades.gradeLabel', { defaultValue: 'Nota' })}
                        />
                    </div>
                    <div style={{ marginBottom: 'var(--space-3)' }}>
                        <label style={{ display: 'block', marginBottom: '4px', fontSize: 'var(--text-sm)', fontWeight: 'var(--font-bold)' }}>
                            {t('grades.feedback')}
                        </label>
                        <textarea
                            value={recForm.feedbackProfesor}
                            onChange={(e) => setRecForm(f => ({ ...f, feedbackProfesor: e.target.value }))}
                            rows={3}
                            style={{ width: '100%', padding: 'var(--space-2)', border: '1px solid var(--border-color)', borderRadius: 'var(--radius-sm)', fontFamily: 'inherit' }}
                        />
                    </div>
                    <p style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)', margin: 0 }}>
                        {t('grades.recHint', { defaultValue: 'La última recuperación registrada prevalece sobre la nota original en el cálculo de la media.' })}
                    </p>
                </ModalView>
            </div>
        </Layout>
    );
};

export default CalificacionesDetalle;
