import React, { useEffect, useState, useCallback } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import styles from './Calificaciones.module.css';
import Layout from '../components/Layout';
import Button from '../components/Button';
import { useAuth } from '../context/AuthContext';
import { getApiUrl } from '../config/api';
import { useTranslation } from 'react-i18next';
import { Settings, ArrowLeft, ChevronDown, ChevronUp } from 'lucide-react';

const CalificacionesGrupo = () => {
    const { t } = useTranslation();
    const { user } = useAuth();
    const navigate = useNavigate();
    const [searchParams] = useSearchParams();
    const imparticionId = searchParams.get('imparticion');

    // Data
    const [mediasData, setMediasData] = useState(null);
    const [periodos, setPeriodos] = useState([]);
    const [selectedPeriodo, setSelectedPeriodo] = useState('');
    const [imparticiones, setImparticiones] = useState([]);
    const [selectedImparticion, setSelectedImparticion] = useState(imparticionId || '');

    // Ponderaciones
    const [pesos, setPesos] = useState({ examen: 50, tarea: 30, practica: 20 });
    const [showWeights, setShowWeights] = useState(false);
    const [savingWeights, setSavingWeights] = useState(false);

    // Estado
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [sortColumn, setSortColumn] = useState('notaFinal');
    const [sortDirection, setSortDirection] = useState('desc');

    const isProfesor = user?.roles?.includes('ROLE_PROFESOR');
    const isAdmin = user?.roles?.includes('ROLE_ADMIN');
    const isSuperAdmin = user?.roles?.includes('ROLE_SUPERADMIN');

    // Cargar imparticiones al montar
    useEffect(() => {
        const fetchImparticiones = async () => {
            try {
                let url = getApiUrl('/api/imparticions?itemsPerPage=100');
                if (isProfesor && !isAdmin && !isSuperAdmin) {
                    url += `&profesor=${user.id}`;
                }
                const response = await fetch(url, {
                    headers: { 'Accept': 'application/ld+json' },
                    credentials: 'include'
                });
                if (!response.ok) throw new Error();
                const data = await response.json();
                const items = data['hydra:member'] || data.member || [];
                setImparticiones(items);
                if (items.length > 0 && !imparticionId) {
                    const firstId = String(items[0].id ?? items[0]['@id']?.split('/').pop());
                    setSelectedImparticion(firstId);
                }
            } catch {
                setError(t('grades.errorLoading'));
                setLoading(false);
            }
        };
        fetchImparticiones();
    }, []); // eslint-disable-line react-hooks/exhaustive-deps

    // Cuando cambia la impartición seleccionada: cargar periodos, ponderaciones y medias
    useEffect(() => {
        if (!selectedImparticion) {
            setLoading(false);
            return;
        }

        const fetchAll = async () => {
            setLoading(true);

            // 1. Periodos del grupo
            try {
                const imp = imparticiones.find(i =>
                    String(i.id ?? i['@id']?.split('/').pop()) === String(selectedImparticion)
                );
                if (imp) {
                    const grupoId = imp.grupo?.id ?? imp.grupo?.['@id']?.split('/').pop() ?? imp.grupo;
                    const grupoIdNum = typeof grupoId === 'string' && grupoId.includes('/') ? grupoId.split('/').pop() : grupoId;
                    const pRes = await fetch(getApiUrl(`/api/periodo_evaluativos?grupo=${grupoIdNum}&order[fechaInicio]=asc`), {
                        headers: { 'Accept': 'application/ld+json' },
                        credentials: 'include'
                    });
                    if (pRes.ok) {
                        const pData = await pRes.json();
                        setPeriodos(pData['hydra:member'] || pData.member || []);
                    }
                }
            } catch { /* no crítico */ }

            // 2. Ponderaciones
            try {
                const wRes = await fetch(getApiUrl(`/api/ponderacion_imparticions?imparticion=${selectedImparticion}`), {
                    headers: { 'Accept': 'application/ld+json' },
                    credentials: 'include'
                });
                if (wRes.ok) {
                    const wData = await wRes.json();
                    const wItems = wData['hydra:member'] || wData.member || [];
                    if (wItems.length > 0) {
                        const pesosObj = { examen: 50, tarea: 30, practica: 20 };
                        wItems.forEach(p => { pesosObj[p.tipoTarea] = Math.round(p.peso * 100); });
                        setPesos(pesosObj);
                    } else {
                        setPesos({ examen: 50, tarea: 30, practica: 20 });
                    }
                }
            } catch { /* usar defaults */ }

            // 3. Medias
            try {
                let url = getApiUrl(`/api/v1/imparticion/${selectedImparticion}/medias`);
                if (selectedPeriodo) {
                    url += `?periodo=${selectedPeriodo}`;
                }
                const mRes = await fetch(url, { credentials: 'include' });
                if (!mRes.ok) throw new Error(`${mRes.status}`);
                const mData = await mRes.json();
                setMediasData(mData);
                setError(null);
            } catch (err) {
                setError(t('grades.errorLoading'));
            }

            setLoading(false);
        };

        fetchAll();
    }, [selectedImparticion, selectedPeriodo, imparticiones, t]);

    // Función para recargar medias (tras guardar ponderaciones)
    const reloadMedias = async () => {
        if (!selectedImparticion) return;
        setLoading(true);
        try {
            let url = getApiUrl(`/api/v1/imparticion/${selectedImparticion}/medias`);
            if (selectedPeriodo) url += `?periodo=${selectedPeriodo}`;
            const res = await fetch(url, { credentials: 'include' });
            if (!res.ok) throw new Error();
            setMediasData(await res.json());
        } catch {
            setError(t('grades.errorLoading'));
        } finally {
            setLoading(false);
        }
    };

    // Guardar ponderaciones
    const handleSaveWeights = async () => {
        setSavingWeights(true);
        try {
            // Borrar existentes y crear nuevas
            const existing = await fetch(getApiUrl(`/api/ponderacion_imparticions?imparticion=${selectedImparticion}`), {
                headers: { 'Accept': 'application/ld+json' },
                credentials: 'include'
            });
            const existingData = await existing.json();
            const existingItems = existingData['hydra:member'] || existingData.member || [];

            // Borrar existentes
            for (const item of existingItems) {
                const itemId = item.id || item['@id']?.split('/').pop();
                await fetch(getApiUrl(`/api/ponderacion_imparticions/${itemId}`), {
                    method: 'DELETE',
                    credentials: 'include'
                });
            }

            // Crear nuevas
            for (const [tipo, peso] of Object.entries(pesos)) {
                await fetch(getApiUrl('/api/ponderacion_imparticions'), {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/ld+json' },
                    body: JSON.stringify({
                        imparticion: `/api/imparticions/${selectedImparticion}`,
                        tipoTarea: tipo,
                        peso: peso / 100
                    }),
                    credentials: 'include'
                });
            }

            alert(t('grades.weightSaved'));
            reloadMedias();
        } catch {
            alert(t('grades.errorSavingWeights'));
        } finally {
            setSavingWeights(false);
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

    // Ordenar alumnos
    const sortedAlumnos = mediasData?.alumnos ? [...mediasData.alumnos].sort((a, b) => {
        let valA, valB;
        switch (sortColumn) {
            case 'nombre':
                valA = `${a.alumno.apellidos} ${a.alumno.nombre}`;
                valB = `${b.alumno.apellidos} ${b.alumno.nombre}`;
                return sortDirection === 'asc' ? valA.localeCompare(valB) : valB.localeCompare(valA);
            case 'mediaExamenes':
            case 'mediaTareas':
            case 'mediaPracticas':
            case 'notaFinal':
                valA = a[sortColumn] ?? -1;
                valB = b[sortColumn] ?? -1;
                return sortDirection === 'asc' ? valA - valB : valB - valA;
            default:
                return 0;
        }
    }) : [];

    const handleSort = (col) => {
        if (sortColumn === col) {
            setSortDirection(d => d === 'asc' ? 'desc' : 'asc');
        } else {
            setSortColumn(col);
            setSortDirection('desc');
        }
    };

    const SortIcon = ({ col }) => {
        if (sortColumn !== col) return null;
        return sortDirection === 'asc' ? <ChevronUp size={14} /> : <ChevronDown size={14} />;
    };

    const weightSum = pesos.examen + pesos.tarea + pesos.practica;
    const weightValid = weightSum === 100;

    const getImparticionLabel = (imp) => {
        const modulo = imp.modulo?.nombre || imp.modulo || '';
        const grupo = imp.grupo?.nombre || imp.grupo || '';
        return `${modulo} — ${grupo}`;
    };

    return (
        <Layout>
            <div className={styles.container}>
                <div className={styles.sectionHeader}>
                    <div>
                        <h1 className={styles.title}>{t('grades.title')}</h1>
                        {mediasData?.imparticion && (
                            <p className={styles.subtitle}>
                                {mediasData.imparticion.modulo} — {mediasData.imparticion.grupo} — {mediasData.imparticion.profesor}
                            </p>
                        )}
                    </div>
                    <div className={styles.controls}>
                        <select
                            className={styles.periodSelect}
                            value={selectedImparticion}
                            onChange={(e) => { setSelectedImparticion(e.target.value); setSelectedPeriodo(''); }}
                        >
                            {imparticiones.map(imp => {
                                const id = imp.id || imp['@id']?.split('/').pop();
                                return (
                                    <option key={id} value={id}>
                                        {getImparticionLabel(imp)}
                                    </option>
                                );
                            })}
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
                        {isProfesor && (
                            <Button onClick={() => setShowWeights(!showWeights)}>
                                <Settings size={16} />
                            </Button>
                        )}
                    </div>
                </div>

                {/* Panel de ponderaciones */}
                {showWeights && (
                    <div className={`${styles.card}`} style={{ marginBottom: 'var(--space-6)' }}>
                        <h3 className={styles.cardTitle}>{t('grades.weightConfig')}</h3>
                        <div className={styles.weightsForm}>
                            {[
                                { key: 'examen', label: t('grades.weightExam'), barClass: styles.weightBarExam },
                                { key: 'tarea', label: t('grades.weightTask'), barClass: styles.weightBarTask },
                                { key: 'practica', label: t('grades.weightPractice'), barClass: styles.weightBarPractice },
                            ].map(({ key, label, barClass }) => (
                                <div key={key} className={styles.weightRow}>
                                    <span className={styles.weightLabel}>{label}</span>
                                    <input
                                        type="number"
                                        min="0"
                                        max="100"
                                        value={pesos[key]}
                                        onChange={(e) => setPesos({ ...pesos, [key]: parseInt(e.target.value) || 0 })}
                                        className={styles.weightInput}
                                    />
                                    <span style={{ fontSize: 'var(--text-sm)', color: 'var(--text-muted)' }}>%</span>
                                    <div className={styles.weightBar}>
                                        <div className={`${styles.weightBarFill} ${barClass}`} style={{ width: `${pesos[key]}%` }} />
                                    </div>
                                </div>
                            ))}
                            <div className={styles.weightTotal}>
                                <span>{t('grades.weightSum')}:</span>
                                <span className={weightValid ? styles.weightTotalOk : styles.weightTotalError}>
                                    {weightSum}%
                                </span>
                                {!weightValid && (
                                    <span className={styles.weightTotalError} style={{ fontSize: 'var(--text-xs)' }}>
                                        {t('grades.weightSumError')}
                                    </span>
                                )}
                            </div>
                            {/* Barra apilada */}
                            <div className={styles.stackedBar}>
                                <div className={`${styles.stackedSegment} ${styles.weightBarExam}`} style={{ width: `${pesos.examen}%` }} />
                                <div className={`${styles.stackedSegment} ${styles.weightBarTask}`} style={{ width: `${pesos.tarea}%` }} />
                                <div className={`${styles.stackedSegment} ${styles.weightBarPractice}`} style={{ width: `${pesos.practica}%` }} />
                            </div>
                            <div className={styles.actionRow}>
                                <Button
                                    onClick={() => setPesos({ examen: 50, tarea: 30, practica: 20 })}
                                    variant="secondary"
                                >
                                    {t('grades.weightDefaults')}
                                </Button>
                                <Button
                                    onClick={handleSaveWeights}
                                    disabled={!weightValid || savingWeights}
                                >
                                    {savingWeights ? t('common.saving') : t('common.save')}
                                </Button>
                            </div>
                        </div>
                    </div>
                )}

                {error && <div className={styles.errorContainer}>{error}</div>}

                {loading ? (
                    <div className={styles.loadingContainer}>{t('common.loading')}</div>
                ) : sortedAlumnos.length === 0 ? (
                    <div className={styles.loadingContainer}>{t('grades.noGrades')}</div>
                ) : (
                    <div style={{ overflowX: 'auto' }}>
                        <table className={styles.gradesTable}>
                            <thead>
                                <tr>
                                    <th onClick={() => handleSort('nombre')} style={{ cursor: 'pointer' }}>
                                        {t('grades.student')} <SortIcon col="nombre" />
                                    </th>
                                    <th onClick={() => handleSort('mediaExamenes')} style={{ cursor: 'pointer' }}>
                                        {t('grades.avgExams')} <SortIcon col="mediaExamenes" />
                                    </th>
                                    <th onClick={() => handleSort('mediaTareas')} style={{ cursor: 'pointer' }}>
                                        {t('grades.avgTasks')} <SortIcon col="mediaTareas" />
                                    </th>
                                    <th onClick={() => handleSort('mediaPracticas')} style={{ cursor: 'pointer' }}>
                                        {t('grades.avgPractice')} <SortIcon col="mediaPracticas" />
                                    </th>
                                    <th onClick={() => handleSort('notaFinal')} style={{ cursor: 'pointer' }}>
                                        {t('grades.finalGrade')} <SortIcon col="notaFinal" />
                                    </th>
                                    <th>{t('grades.pending')}</th>
                                </tr>
                            </thead>
                            <tbody>
                                {sortedAlumnos.map((row) => (
                                    <tr
                                        key={row.alumno.id}
                                        className={styles.clickableRow}
                                        onClick={() => navigate(`/calificaciones/detalle?imparticion=${selectedImparticion}&alumno=${row.alumno.id}`)}
                                    >
                                        <td>{row.alumno.apellidos}, {row.alumno.nombre}</td>
                                        <td className={`${styles.gradeCell} ${getGradeClass(row.mediaExamenes)}`}>
                                            {formatGrade(row.mediaExamenes)}
                                        </td>
                                        <td className={`${styles.gradeCell} ${getGradeClass(row.mediaTareas)}`}>
                                            {formatGrade(row.mediaTareas)}
                                        </td>
                                        <td className={`${styles.gradeCell} ${getGradeClass(row.mediaPracticas)}`}>
                                            {formatGrade(row.mediaPracticas)}
                                        </td>
                                        <td className={`${styles.gradeCell} ${getGradeClass(row.notaFinal)}`}>
                                            {formatGrade(row.notaFinal)}
                                        </td>
                                        <td style={{ textAlign: 'center', color: 'var(--text-muted)' }}>
                                            {row.entregasPendientes}/{row.totalTareas}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>
        </Layout>
    );
};

export default CalificacionesGrupo;
