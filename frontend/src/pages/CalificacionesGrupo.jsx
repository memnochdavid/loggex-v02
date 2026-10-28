import React, { useEffect, useState, useCallback } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import styles from './Calificaciones.module.css';
import Layout from '../components/Layout';
import Button from '../components/Button';
import ThemedSelect from '../components/ThemedSelect';
import ThemedNumberInput from '../components/ThemedNumberInput';
import CrudHeader from '../components/CrudHeader';
import AccordionView from '../components/AccordionView';
import useMediaQuery from '../hooks/useMediaQuery';
import { useAuth } from '../context/AuthContext';
import { getApiUrl } from '../config/api';
import { useTranslation } from 'react-i18next';
import { ArrowLeft, ChevronDown, ChevronUp } from 'lucide-react';
import Lottie from 'lottie-react';
import statsAnimation from '../../public/stats.json';
import { toast } from '../utils/toast';
import { useConfirm } from '../context/ConfirmContext';
import { formatGrupoNombre } from '../utils/grupo';

// Genera un tooltip en texto plano con los motivos por los que un alumno no es evaluable.
export const formatMotivos = (motivos, t) => {
    if (!motivos || motivos.length === 0) return '';
    return motivos.map(m => {
        if (m.razon === 'obligatoria_no_entregada') {
            return `${m.titulo}: ${t('grades.reasonMandatoryMissing', { defaultValue: 'no entregada (obligatoria)' })}`;
        }
        if (m.razon === 'nota_minima_no_alcanzada') {
            return `${m.titulo}: ${t('grades.reasonBelowMin', { defaultValue: 'por debajo del mínimo' })} (${m.nota} < ${m.notaMinima})`;
        }
        if (m.razon === 'falta_asistencia') {
            return t('grades.reasonAbsences', {
                defaultValue: 'Faltas de asistencia: {{porcentaje}}% (supera el {{umbral}}%)',
                porcentaje: m.porcentaje,
                umbral: m.umbral,
            });
        }
        return m.titulo;
    }).join('\n');
};

// Persistencia de los filtros de la vista (centro/año/grupo/materia/evaluación)
// en sessionStorage. Sin esto, al entrar al detalle de un alumno y volver, los
// selects se reseteaban a su opción genérica aunque la tabla siguiera mostrando
// el último grupo: `selectedImparticion` se rehidrata del query param pero el
// resto de la cascada no. Se guarda por sesión de pestaña.
const FILTROS_STORAGE_KEY = 'calificaciones:filtros';

const leerFiltrosGuardados = () => {
    try {
        const raw = sessionStorage.getItem(FILTROS_STORAGE_KEY);
        return raw ? JSON.parse(raw) : {};
    } catch {
        return {};
    }
};

// Editor de peso por item (tarea individual) — agrupado por tipo
const ItemsWeightEditor = ({ tareas, saving, onSave, periodos = [], selectedPeriodo = '', t }) => {
    const confirm = useConfirm();
    const [draft, setDraft] = React.useState({});
    // Filtrar por evaluación seleccionada (por fechaLimite dentro del rango)
    const tareasFiltradas = React.useMemo(() => {
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
    const grupos = React.useMemo(() => {
        const g = { examen: [], tarea: [], practica: [] };
        tareasFiltradas.forEach(tr => { if (g[tr.tipo]) g[tr.tipo].push(tr); });
        return g;
    }, [tareasFiltradas]);
    const getDraftField = (id, field, fallback) => {
        const d = draft[id];
        if (d && field in d) return d[field];
        return fallback;
    };
    const pesoOf = (tr) => {
        const id = tr.id || tr['@id']?.split('/').pop();
        return getDraftField(id, 'peso', tr.peso != null ? String(tr.peso) : '');
    };
    const obligatoriaOf = (tr) => {
        const id = tr.id || tr['@id']?.split('/').pop();
        return getDraftField(id, 'obligatoria', !!tr.obligatoria);
    };
    const notaMinimaOf = (tr) => {
        const id = tr.id || tr['@id']?.split('/').pop();
        return getDraftField(id, 'notaMinima', tr.notaMinima != null ? String(tr.notaMinima) : '');
    };
    const isDirty = (tr) => {
        const id = tr.id || tr['@id']?.split('/').pop();
        const d = draft[id];
        if (!d) return false;
        if ('peso' in d && String(d.peso || '') !== String(tr.peso != null ? tr.peso : '')) return true;
        if ('obligatoria' in d && Boolean(d.obligatoria) !== Boolean(tr.obligatoria)) return true;
        if ('notaMinima' in d && String(d.notaMinima || '') !== String(tr.notaMinima != null ? tr.notaMinima : '')) return true;
        return false;
    };
    const patchDraft = (id, field, value) => {
        setDraft(prev => ({ ...prev, [id]: { ...(prev[id] || {}), [field]: value } }));
    };
    const sumaTipo = (tipo) => {
        return grupos[tipo].reduce((acc, tr) => {
            const v = parseFloat(pesoOf(tr));
            return acc + (isNaN(v) ? 0 : v);
        }, 0);
    };
    const sectionLabels = {
        examen:   t('grades.weightExam'),
        tarea:    t('grades.weightTask'),
        practica: t('grades.weightPractice'),
    };

    if (tareasFiltradas.length === 0) {
        return <p style={{ color: 'var(--text-muted)' }}>{t('grades.noItemsForImp')}</p>;
    }

    // Resetear a "auto" (peso=null) todos los ítems mostrados
    const handleResetAll = async () => {
        if (!(await confirm({ body: t('grades.confirmResetWeights') }))) return;
        tareasFiltradas.forEach(tr => {
            const id = tr.id || tr['@id']?.split('/').pop();
            if (tr.peso != null) onSave(id, { peso: '' });
        });
        setDraft({});
    };

    return (
        <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 'var(--space-4)', marginBottom: 'var(--space-4)', flexWrap: 'wrap' }}>
                <p style={{ fontSize: 'var(--text-sm)', color: 'var(--text-muted)', margin: 0, flex: 1, minWidth: '240px' }}>
                    {t('grades.itemsHint')}
                </p>
                <Button
                    variant="secondary"
                    onClick={handleResetAll}
                    disabled={tareasFiltradas.every(tr => tr.peso == null)}
                >
                    {t('grades.weightDefaults')}
                </Button>
            </div>
            {['examen', 'tarea', 'practica'].map(tipo => {
                if (grupos[tipo].length === 0) return null;
                const suma = Math.round(sumaTipo(tipo) * 100) / 100;
                const ok = Math.abs(suma - 100) < 0.01;
                return (
                    <div key={tipo} style={{ marginBottom: 'var(--space-5)' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 'var(--space-2)' }}>
                            <h4 style={{ margin: 0, fontSize: 'var(--text-sm)', fontWeight: 'var(--font-bold)', textTransform: 'uppercase', color: 'var(--text-muted)', letterSpacing: '0.05em' }}>
                                {sectionLabels[tipo]} ({grupos[tipo].length})
                            </h4>
                            <span style={{ fontSize: 'var(--text-xs)', fontWeight: 'var(--font-bold)', color: ok ? 'var(--color-success)' : 'var(--color-error)' }}>
                                {t('grades.weightSumLabel')}: {suma}%{!ok && ` ${t('grades.weightSumWarn')}`}
                            </span>
                        </div>
                        {grupos[tipo].map(tr => {
                            const id = tr.id || tr['@id']?.split('/').pop();
                            const value = pesoOf(tr);
                            const dirty = isDirty(tr);
                            return (
                                <div key={id} style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)', padding: 'var(--space-2) 0', borderBottom: '1px solid var(--border-color)', flexWrap: 'wrap' }}>
                                    <span style={{ flex: 1, minWidth: '160px', fontSize: 'var(--text-sm)', color: 'var(--text-main)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                        {tr.titulo}
                                    </span>
                                    <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: 'var(--text-xs)', color: 'var(--text-muted)' }} title={t('tasks.mandatoryHelp')}>
                                        <input
                                            type="checkbox"
                                            checked={obligatoriaOf(tr)}
                                            onChange={(e) => patchDraft(id, 'obligatoria', e.target.checked)}
                                        />
                                        {t('tasks.mandatory')}
                                    </label>
                                    <ThemedNumberInput
                                        min={0}
                                        max={10}
                                        step={0.1}
                                        placeholder={t('tasks.minGradeShort', { value: '—' })}
                                        value={notaMinimaOf(tr)}
                                        onChange={(v) => patchDraft(id, 'notaMinima', v)}
                                        width={90}
                                        ariaLabel={t('tasks.minGrade')}
                                    />
                                    <ThemedNumberInput
                                        min={0}
                                        max={100}
                                        step={0.5}
                                        placeholder={t('grades.auto')}
                                        value={value}
                                        onChange={(v) => patchDraft(id, 'peso', v)}
                                        width={110}
                                        suffix="%"
                                        ariaLabel={t('grades.weightTabItems')}
                                    />
                                    <Button
                                        size="sm"
                                        onClick={() => {
                                            onSave(id, draft[id] || {});
                                            setDraft(prev => {
                                                const n = { ...prev }; delete n[id]; return n;
                                            });
                                        }}
                                        disabled={!dirty || saving[id]}
                                    >
                                        {saving[id] ? t('common.saving') : t('common.save')}
                                    </Button>
                                </div>
                            );
                        })}
                    </div>
                );
            })}
        </div>
    );
};

const CalificacionesGrupo = () => {
    const { t } = useTranslation();
    const { user } = useAuth();
    const navigate = useNavigate();
    const confirm = useConfirm();
    const [searchParams] = useSearchParams();
    const imparticionId = searchParams.get('imparticion');
    const isMobile = useMediaQuery('(max-width: 768px)');
    const [expandedAlumnoId, setExpandedAlumnoId] = useState(null);

    // Filtros rehidratados de sessionStorage (una sola lectura al montar).
    const [filtrosGuardados] = useState(leerFiltrosGuardados);

    // Data
    const [mediasData, setMediasData] = useState(null);
    const [periodos, setPeriodos] = useState([]);
    const [selectedPeriodo, setSelectedPeriodo] = useState(filtrosGuardados.periodo || '');
    const [imparticiones, setImparticiones] = useState([]);
    const [selectedImparticion, setSelectedImparticion] = useState(imparticionId || filtrosGuardados.imparticion || '');

    // Tabs principales: alumnos | ponderaciones
    const [mainTab, setMainTab] = useState('alumnos');

    // Ponderaciones
    const [pesos, setPesos] = useState({ examen: 50, tarea: 30, practica: 20 });
    const [savingWeights, setSavingWeights] = useState(false);
    const [weightTab, setWeightTab] = useState('global');
    const [tareasImp, setTareasImp] = useState([]);
    const [savingTareaPeso, setSavingTareaPeso] = useState({});

    // Estado
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [sortColumn, setSortColumn] = useState('notaFinal');
    const [sortDirection, setSortDirection] = useState('desc');

    const isProfesor = user?.roles?.includes('ROLE_PROFESOR');
    const isAdmin = user?.roles?.includes('ROLE_ADMIN');
    const isSuperAdmin = user?.roles?.includes('ROLE_SUPERADMIN');

    // Filtros SuperAdmin
    const [centros, setCentros] = useState([]);
    const [selectedCentro, setSelectedCentro] = useState(filtrosGuardados.centro || '');
    const [allImparticiones, setAllImparticiones] = useState([]);
    const [selectedYear, setSelectedYear] = useState(filtrosGuardados.year || '');
    // Grupo intermedio en la cascada Centro → Año → Grupo → Materia. Antes
    // el select de imparticiones mostraba "Modulo — Grupo" para todas las
    // del profesor/admin y crecía mucho. Filtrando primero por grupo, el
    // select de Materia solo lista las del grupo activo.
    const [selectedGrupo, setSelectedGrupo] = useState(filtrosGuardados.grupo || '');

    // Refs para distinguir "el usuario cambió este filtro" de "el efecto se
    // disparó solo porque acaban de cargar los datos". Sin esto, los efectos
    // de carga reseteaban la cascada y pisaban los filtros rehidratados.
    const prevSelectedYearRef = React.useRef(selectedYear);
    const prevSelectedCentroRef = React.useRef(selectedCentro);

    // Persistir los filtros en cada cambio para sobrevivir al ir/volver del
    // detalle de un alumno (el componente se remonta al cambiar de ruta).
    useEffect(() => {
        try {
            sessionStorage.setItem(FILTROS_STORAGE_KEY, JSON.stringify({
                centro: selectedCentro,
                year: selectedYear,
                grupo: selectedGrupo,
                imparticion: selectedImparticion,
                periodo: selectedPeriodo,
            }));
        } catch { /* sessionStorage no disponible: degradación silenciosa */ }
    }, [selectedCentro, selectedYear, selectedGrupo, selectedImparticion, selectedPeriodo]);

    // Años disponibles (extraídos de los grupos de las imparticiones)
    const availableYears = [...new Set(
        allImparticiones.map(i => i.grupo?.anioEscolar || i.grupo?.anio_escolar).filter(Boolean)
    )].sort().reverse();

    // Filtrar imparticiones por año y actualizar la lista visible
    useEffect(() => {
        const filtered = selectedYear
            ? allImparticiones.filter(i => (i.grupo?.anioEscolar || i.grupo?.anio_escolar) === selectedYear)
            : allImparticiones;
        setImparticiones(filtered);
        // Cambiar de año reinicia la cascada Grupo + Materia. Pero NO cuando el
        // efecto se dispara solo porque `allImparticiones` acaba de cargar: eso
        // borraría el grupo rehidratado de sessionStorage al volver del detalle.
        if (prevSelectedYearRef.current !== selectedYear) {
            prevSelectedYearRef.current = selectedYear;
            setSelectedGrupo('');
        }
        if (filtered.length === 0 && allImparticiones.length > 0) {
            setSelectedImparticion('');
            setMediasData(null);
        }
    }, [selectedYear, allImparticiones]);

    // Grupos únicos derivados de las imparticiones visibles. Se ordenan por
    // (curso, nombre) para que aparezcan agrupados de forma intuitiva.
    const gruposDisponibles = React.useMemo(() => {
        const seen = new Map();
        imparticiones.forEach(imp => {
            const g = imp.grupo;
            if (!g || typeof g === 'string') return;
            const id = g.id ?? g['@id']?.split('/').pop();
            if (id && !seen.has(String(id))) seen.set(String(id), g);
        });
        return Array.from(seen.values()).sort((a, b) => {
            const ca = a.curso ?? 0;
            const cb = b.curso ?? 0;
            if (ca !== cb) return ca - cb;
            return (a.nombre || '').localeCompare(b.nombre || '');
        });
    }, [imparticiones]);

    // Imparticiones filtradas por el grupo seleccionado. Cuando no hay grupo
    // elegido, no se muestra ninguna materia (forzamos la cascada).
    const imparticionesFiltradas = React.useMemo(() => {
        if (!selectedGrupo) return [];
        return imparticiones.filter(imp => {
            const gid = imp.grupo?.id ?? imp.grupo?.['@id']?.split('/').pop();
            return String(gid) === String(selectedGrupo);
        });
    }, [imparticiones, selectedGrupo]);

    // Auto-select del único grupo / única materia disponibles, para que el
    // profesor con un solo grupo no tenga que clicar dos selects.
    useEffect(() => {
        if (gruposDisponibles.length === 1 && !selectedGrupo) {
            const only = gruposDisponibles[0];
            const id = only.id ?? only['@id']?.split('/').pop();
            setSelectedGrupo(String(id));
        }
    }, [gruposDisponibles, selectedGrupo]);

    useEffect(() => {
        if (selectedGrupo && imparticionesFiltradas.length > 0 && !imparticionId) {
            const current = imparticionesFiltradas.find(imp => {
                const id = imp.id ?? imp['@id']?.split('/').pop();
                return String(id) === String(selectedImparticion);
            });
            if (!current) {
                const first = imparticionesFiltradas[0];
                setSelectedImparticion(String(first.id ?? first['@id']?.split('/').pop()));
            }
        } else if (selectedGrupo && imparticiones.length > 0 && imparticionesFiltradas.length === 0) {
            // Solo limpiar si la lista YA cargó y este grupo no tiene materias;
            // mientras `imparticiones` está vacía es que aún está cargando, y
            // limpiar aquí borraría la materia rehidratada de sessionStorage.
            setSelectedImparticion('');
            setMediasData(null);
        }
    }, [selectedGrupo, imparticionesFiltradas, imparticiones]); // eslint-disable-line react-hooks/exhaustive-deps

    // Cargar centros para SuperAdmin
    useEffect(() => {
        if (!isSuperAdmin) return;
        fetch(getApiUrl('/api/centros?pagination=false'), {
            headers: { 'Accept': 'application/ld+json' }, credentials: 'include'
        })
        .then(res => res.json())
        .then(data => setCentros(data['hydra:member'] || data.member || []))
        .catch(() => {});
    }, [isSuperAdmin]);

    // Cargar imparticiones (depende del centro para SuperAdmin)
    useEffect(() => {
        const fetchImparticiones = async () => {
            try {
                let url = getApiUrl('/api/imparticions?itemsPerPage=100');
                if (isProfesor && !isAdmin && !isSuperAdmin) {
                    url += `&profesor=${user.id}`;
                } else if (isSuperAdmin) {
                    if (!selectedCentro) {
                        setAllImparticiones([]);
                        setImparticiones([]);
                        setSelectedImparticion('');
                        setMediasData(null);
                        setLoading(false);
                        return;
                    }
                    url += `&grupo.centro=${selectedCentro}`;
                }
                const response = await fetch(url, {
                    headers: { 'Accept': 'application/ld+json' },
                    credentials: 'include'
                });
                if (!response.ok) throw new Error();
                const data = await response.json();
                const items = data['hydra:member'] || data.member || [];
                setAllImparticiones(items);
                // Resetear el año solo si el centro cambió de verdad; en el
                // montaje inicial borraría el año rehidratado de sessionStorage.
                if (prevSelectedCentroRef.current !== selectedCentro) {
                    prevSelectedCentroRef.current = selectedCentro;
                    setSelectedYear('');
                }
            } catch {
                setError(t('grades.errorLoading'));
                setLoading(false);
            }
        };
        fetchImparticiones();
    }, [selectedCentro]); // eslint-disable-line react-hooks/exhaustive-deps

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
                        let items = pData['hydra:member'] || pData.member || [];
                        items.sort((a, b) => {
                            const aExtra = a.tipo === 'EXTRAORDINARIA' ? 1 : 0;
                            const bExtra = b.tipo === 'EXTRAORDINARIA' ? 1 : 0;
                            if (aExtra !== bExtra) return aExtra - bExtra;
                            return (a.fechaInicio || '').localeCompare(b.fechaInicio || '');
                        });
                        setPeriodos(items);
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

    // Cierra con un 0 automático las tareas vencidas sin entrega de la
    // imparticion actual. Hace primero un dry-run (preview) y, si el usuario
    // confirma con número >0, ejecuta el cierre real y refresca medias+tareas.
    const [closingOverdue, setClosingOverdue] = useState(false);
    const handleCerrarVencidas = useCallback(async () => {
        if (!selectedImparticion) return;
        setClosingOverdue(true);
        try {
            const previewRes = await fetch(getApiUrl('/api/v1/tareas/cerrar-vencidas'), {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                credentials: 'include',
                body: JSON.stringify({ imparticionId: Number(selectedImparticion), dryRun: true }),
            });
            if (!previewRes.ok) {
                toast.error(t('grades.closeOverdueError', { defaultValue: 'Error al previsualizar el cierre.' }));
                return;
            }
            const preview = await previewRes.json();
            if ((preview.alumnosCerrados || 0) === 0) {
                toast.info(t('grades.closeOverdueNothing', { defaultValue: 'No hay tareas vencidas pendientes de cerrar.' }));
                return;
            }
            const ok = await confirm({
                title: t('grades.closeOverdueTitle', { defaultValue: 'Cerrar tareas vencidas' }),
                body: t('grades.closeOverdueConfirm', {
                    defaultValue: 'Se cerrarán {{count}} entregas de {{tareas}} tarea(s) vencida(s) con un 0 automático. ¿Continuar?',
                    count: preview.alumnosCerrados,
                    tareas: preview.tareasProcesadas,
                }),
                variant: 'warning',
            });
            if (!ok) return;
            const realRes = await fetch(getApiUrl('/api/v1/tareas/cerrar-vencidas'), {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                credentials: 'include',
                body: JSON.stringify({ imparticionId: Number(selectedImparticion), dryRun: false }),
            });
            if (!realRes.ok) {
                toast.error(t('grades.closeOverdueError', { defaultValue: 'Error al cerrar tareas vencidas.' }));
                return;
            }
            const stats = await realRes.json();
            toast.success(t('grades.closeOverdueOk', {
                defaultValue: 'Cerradas {{count}} entregas con 0 (de {{tareas}} tareas).',
                count: stats.alumnosCerrados,
                tareas: stats.tareasProcesadas,
            }));
            await reloadMedias();
        } catch {
            toast.error(t('grades.closeOverdueError', { defaultValue: 'Error al cerrar tareas vencidas.' }));
        } finally {
            setClosingOverdue(false);
        }
    }, [selectedImparticion, confirm, t]);

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

    // Cargar tareas de la impartición (para edición de peso por item)
    useEffect(() => {
        if (!selectedImparticion) { setTareasImp([]); return; }
        fetch(getApiUrl(`/api/tareas?imparticion=${selectedImparticion}&order[fechaLimite]=asc&itemsPerPage=200`), {
            headers: { 'Accept': 'application/ld+json' }, credentials: 'include',
        })
            .then(r => r.json())
            .then(d => {
                const items = d['hydra:member'] || d.member || [];
                setTareasImp(items);
            })
            .catch(() => setTareasImp([]));
    }, [selectedImparticion]);

    // Guardar cambios individuales de una tarea (peso / obligatoria / notaMinima)
    const handleSaveTareaPeso = async (tareaId, changes) => {
        const patch = {};
        if ('peso' in changes) {
            const raw = changes.peso;
            const parsed = raw === '' || raw == null ? null : parseFloat(raw);
            if (parsed !== null && (isNaN(parsed) || parsed < 0 || parsed > 100)) {
                toast.warning(t('grades.weightRange'));
                return;
            }
            patch.peso = parsed;
        }
        if ('obligatoria' in changes) {
            patch.obligatoria = Boolean(changes.obligatoria);
        }
        if ('notaMinima' in changes) {
            const raw = changes.notaMinima;
            const parsed = raw === '' || raw == null ? null : parseFloat(raw);
            if (parsed !== null && (isNaN(parsed) || parsed < 0 || parsed > 10)) {
                toast.warning(t('tasks.minGradeRange', { defaultValue: 'La nota mínima debe estar entre 0 y 10' }));
                return;
            }
            patch.notaMinima = parsed;
        }
        if (Object.keys(patch).length === 0) return;
        setSavingTareaPeso(prev => ({ ...prev, [tareaId]: true }));
        try {
            const res = await fetch(getApiUrl(`/api/tareas/${tareaId}`), {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/merge-patch+json', 'Accept': 'application/ld+json' },
                body: JSON.stringify(patch),
                credentials: 'include',
            });
            if (!res.ok) throw new Error();
            const data = await res.json();
            setTareasImp(prev => prev.map(tr => {
                const id = tr.id || tr['@id']?.split('/').pop();
                return String(id) === String(tareaId) ? { ...tr, peso: data.peso, obligatoria: data.obligatoria, notaMinima: data.notaMinima } : tr;
            }));
        } catch {
            toast.error(t('grades.errorSavingWeights'));
        } finally {
            setSavingTareaPeso(prev => ({ ...prev, [tareaId]: false }));
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

            toast.success(t('grades.weightSaved'));
            reloadMedias();
        } catch {
            toast.error(t('grades.errorSavingWeights'));
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
        // El select de Materia ya está scoped al grupo activo (cascada
        // Centro → Año → Grupo → Materia), así que basta con el nombre del
        // módulo. El grupo está implícito por el filtro previo.
        return imp.materia?.nombre || '';
    };

    return (
        <Layout>
            <div className={styles.container}>
                <CrudHeader
                    title={t('grades.title')}
                    breadcrumbs={[
                        { label: t('sidebar.home'), to: '/' },
                        { label: t('grades.title') },
                    ]}

                    subtitle={mediasData?.imparticion
                        ? `${mediasData.imparticion?.materia} — ${mediasData.imparticion.grupo} — ${mediasData.imparticion.profesor}`
                        : t('grades.subtitle')}
                    logo={<Lottie animationData={statsAnimation} loop={true} style={{ width: 56, height: 56 }} />}
                >
                    {isSuperAdmin && (
                        <>
                            <ThemedSelect
                                value={selectedCentro}
                                onChange={(v) => { setSelectedCentro(v); setSelectedGrupo(''); setSelectedImparticion(''); setSelectedPeriodo(''); }}
                                minWidth={180}
                                ariaLabel={t('common.selectCenter')}
                                options={[
                                    { value: '', label: t('common.selectCenter') },
                                    ...centros.map(c => ({ value: String(c.id), label: c.nombre })),
                                ]}
                            />
                            {availableYears.length > 0 && (
                                <ThemedSelect
                                    value={selectedYear}
                                    onChange={(v) => { setSelectedYear(v); setSelectedGrupo(''); setSelectedImparticion(''); setSelectedPeriodo(''); }}
                                    minWidth={140}
                                    ariaLabel={t('grades.allYears')}
                                    options={[
                                        { value: '', label: t('grades.allYears') },
                                        ...availableYears.map(y => ({ value: y, label: y })),
                                    ]}
                                />
                            )}
                        </>
                    )}
                    <ThemedSelect
                        value={selectedGrupo}
                        onChange={(v) => { setSelectedGrupo(v); setSelectedImparticion(''); setSelectedPeriodo(''); }}
                        minWidth={160}
                        ariaLabel={t('common.selectGroup')}
                        options={[
                            { value: '', label: t('common.selectGroup') },
                            ...gruposDisponibles.map(g => ({
                                value: String(g.id ?? g['@id']?.split('/').pop()),
                                label: formatGrupoNombre(g),
                            })),
                        ]}
                    />
                    <ThemedSelect
                        value={selectedImparticion}
                        onChange={(v) => { setSelectedImparticion(v); setSelectedPeriodo(''); }}
                        minWidth={200}
                        disabled={!selectedGrupo}
                        ariaLabel={t('common.selectModule')}
                        options={imparticionesFiltradas.length === 0
                            ? [{ value: '', label: t('grades.selectGroupFirst', { defaultValue: 'Selecciona un grupo primero' }) }]
                            : imparticionesFiltradas.map(imp => {
                                const id = imp.id || imp['@id']?.split('/').pop();
                                return { value: String(id), label: getImparticionLabel(imp) };
                            })}
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

                {/* Tabs principales: Alumnos | Ponderaciones + acción "Cerrar
                    tareas vencidas". Wrapper .tabBarWithAction: en desktop comparten
                    línea; en ≤768px el botón cae a fila propia para no quedar
                    oculto bajo el scroll horizontal del .tabBar. */}
                {isProfesor && selectedImparticion && (
                    <div className={styles.tabBarWithAction}>
                        <div className={styles.tabBar}>
                            <button
                                type="button"
                                className={`${styles.tab} ${mainTab === 'alumnos' ? styles.tabActive : ''}`}
                                onClick={() => setMainTab('alumnos')}
                            >
                                {t('grades.student')}
                            </button>
                            <button
                                type="button"
                                className={`${styles.tab} ${mainTab === 'ponderaciones' ? styles.tabActive : ''}`}
                                onClick={() => setMainTab('ponderaciones')}
                            >
                                {t('grades.weights')}
                            </button>
                        </div>
                        <Button
                            variant="secondary"
                            onClick={handleCerrarVencidas}
                            disabled={closingOverdue}
                            title={t('grades.closeOverdueTitle', { defaultValue: 'Cerrar tareas vencidas' })}
                        >
                            {closingOverdue
                                ? t('grades.closingOverdue', { defaultValue: 'Cerrando…' })
                                : t('grades.closeOverdueAction', { defaultValue: 'Cerrar tareas vencidas' })}
                        </Button>
                    </div>
                )}

                {error && <div className={styles.errorContainer}>{error}</div>}

                {/* Tab: Ponderaciones */}
                {mainTab === 'ponderaciones' && isProfesor && selectedImparticion ? (
                    <div key="ponderaciones" className={styles.tabContent}>
                        <div className={styles.card}>
                            <div className={styles.tabBar} style={{ marginTop: 0 }}>
                                <button
                                    type="button"
                                    className={`${styles.tab} ${weightTab === 'global' ? styles.tabActive : ''}`}
                                    onClick={() => setWeightTab('global')}
                                >
                                    {t('grades.weightTabGlobal')}
                                </button>
                                <button
                                    type="button"
                                    className={`${styles.tab} ${weightTab === 'items' ? styles.tabActive : ''}`}
                                    onClick={() => setWeightTab('items')}
                                >
                                    {t('grades.weightTabItems')}
                                </button>
                            </div>

                            {weightTab === 'global' && (<>
                            <h3 className={styles.cardTitle}>{t('grades.weightConfig')}</h3>
                            <div className={styles.weightsForm}>
                                {[
                                    { key: 'examen', label: t('grades.weightExam'), barClass: styles.weightBarExam },
                                    { key: 'tarea', label: t('grades.weightTask'), barClass: styles.weightBarTask },
                                    { key: 'practica', label: t('grades.weightPractice'), barClass: styles.weightBarPractice },
                                ].map(({ key, label, barClass }) => (
                                    <div key={key} className={styles.weightRow}>
                                        <span className={styles.weightLabel}>{label}</span>
                                        <ThemedNumberInput
                                            min={0}
                                            max={100}
                                            step={1}
                                            value={String(pesos[key])}
                                            onChange={(v) => setPesos({ ...pesos, [key]: parseInt(v, 10) || 0 })}
                                            width={110}
                                            suffix="%"
                                            ariaLabel={label}
                                        />
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
                            </>)}

                            {weightTab === 'items' && (
                                <ItemsWeightEditor
                                    tareas={tareasImp}
                                    saving={savingTareaPeso}
                                    onSave={handleSaveTareaPeso}
                                    periodos={periodos}
                                    selectedPeriodo={selectedPeriodo}
                                    t={t}
                                />
                            )}
                        </div>
                    </div>
                ) : loading ? (
                    <div className={styles.loadingContainer}>{t('common.loading')}</div>
                ) : sortedAlumnos.length === 0 ? (
                    <div className={styles.loadingContainer}>{t('grades.noGrades')}</div>
                ) : isMobile ? (
                    <AccordionView
                        data={sortedAlumnos.map(r => ({ ...r, id: r.alumno.id }))}
                        canAdd={false}
                        expandedId={expandedAlumnoId}
                        onToggle={(id) => setExpandedAlumnoId(prev => prev === id ? null : id)}
                        renderHeader={(row) => (
                            <span className="accordionHeaderTitle">
                                {row.alumno.apellidos}, {row.alumno.nombre}
                            </span>
                        )}
                        renderItem={(row) => (
                            <div className={styles.mobileRowInner}>
                                {/* Nota final — antes en el header, ahora movida aquí
                                    porque en mobile el header se quedaba sin espacio
                                    horizontal (especialmente con badge "No evaluable").
                                    Como es la info más importante de la fila, va arriba
                                    del todo con su propio bloque destacado, no como
                                    una chip más entre las medias parciales. */}
                                <div className={styles.mobileFinalGrade}>
                                    <span className={styles.mobileFinalGradeLabel}>
                                        {t('grades.finalGrade')}
                                    </span>
                                    {row.evaluable === false ? (
                                        <span
                                            className={`${styles.gradeBadge} ${styles.gradeFail}`}
                                            title={formatMotivos(row.motivosNoEvaluable, t)}
                                        >
                                            {t('grades.notEvaluable')}
                                        </span>
                                    ) : (
                                        <span
                                            className={`${styles.gradeBadge} ${getGradeClass(row.notaFinal)}`}
                                        >
                                            {formatGrade(row.notaFinal)}
                                        </span>
                                    )}
                                </div>
                                <div className={styles.mobileRowStats}>
                                    <div className={styles.mobileStatChip}>
                                        <span className={styles.mobileStatLabel}>{t('grades.avgExams')}</span>
                                        <span className={`${styles.mobileStatValue} ${getGradeClass(row.mediaExamenes)}`}>
                                            {formatGrade(row.mediaExamenes)}
                                        </span>
                                    </div>
                                    <div className={styles.mobileStatChip}>
                                        <span className={styles.mobileStatLabel}>{t('grades.avgTasks')}</span>
                                        <span className={`${styles.mobileStatValue} ${getGradeClass(row.mediaTareas)}`}>
                                            {formatGrade(row.mediaTareas)}
                                        </span>
                                    </div>
                                    <div className={styles.mobileStatChip}>
                                        <span className={styles.mobileStatLabel}>{t('grades.avgPractice')}</span>
                                        <span className={`${styles.mobileStatValue} ${getGradeClass(row.mediaPracticas)}`}>
                                            {formatGrade(row.mediaPracticas)}
                                        </span>
                                    </div>
                                    <div className={styles.mobileStatChip}>
                                        <span className={styles.mobileStatLabel}>{t('grades.pending')}</span>
                                        <span className={styles.mobileStatValue}>
                                            {row.entregasPendientes}/{row.totalTareas}
                                        </span>
                                    </div>
                                </div>
                                <Button
                                    variant="secondary"
                                    onClick={() => navigate(`/calificaciones/detalle?imparticion=${selectedImparticion}&alumno=${row.alumno.id}`)}
                                    style={{ marginTop: 'var(--space-3)', width: '100%' }}
                                >
                                    {t('grades.detail')}
                                </Button>
                            </div>
                        )}
                    />
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
                                        <td className={`${styles.gradeCell} ${row.evaluable === false ? styles.gradeFail : getGradeClass(row.notaFinal)}`}>
                                            {row.evaluable === false ? (
                                                <span title={formatMotivos(row.motivosNoEvaluable, t)}>{t('grades.notEvaluable')}</span>
                                            ) : formatGrade(row.notaFinal)}
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
