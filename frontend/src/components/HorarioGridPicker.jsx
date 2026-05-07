import React, { useEffect, useMemo, useState } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import AsyncSearchSelect from './AsyncSearchSelect';
import { getApiUrl } from '../config/api';
import { useTranslation } from 'react-i18next';
import styles from './HorarioGridPicker.module.css';

/**
 * Mini-timetable picker. El usuario elige primero un profesor, navega por
 * semanas, y hace click en uno de sus bloques. El componente devuelve
 * `(horarioId, fechaConcretaISO)` al onChange.
 *
 * Reemplaza al AsyncSearchSelect de listado largo cuando el dominio es
 * "elige una clase concreta" — gráficamente es más rápido y evita el
 * problema de paginación (no hay lista que pueda cortarse).
 *
 * Props:
 *   value:              id del horario seleccionado (string|number) o ''
 *   selectedFecha:      fecha concreta ISO 'YYYY-MM-DD' o ''
 *   weekAnchor:         Date inicial para localizar la semana visible
 *   excludeProfesorId:  user id a excluir del select de profe (típicamente self)
 *   onChange:           ({ horarioId, fechaConcreta, horario }) => void
 *
 * Doc: docs/hoja-de-ruta-intercambio-imparticiones.md Fase E (mejora UX).
 */
const dayLabels = ['', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'];

function isoOf(d) {
    const yy = d.getFullYear();
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    const dd = String(d.getDate()).padStart(2, '0');
    return `${yy}-${mm}-${dd}`;
}

function mondayOf(d) {
    const a = new Date(d);
    const cur = a.getDay() === 0 ? 7 : a.getDay();
    a.setDate(a.getDate() - (cur - 1));
    a.setHours(0, 0, 0, 0);
    return a;
}

function parseHora(iso) {
    if (!iso) return '';
    const m = String(iso).match(/T(\d{2}:\d{2})/);
    return m ? m[1] : '';
}

function durMinutes(hi, hf) {
    if (!hi || !hf) return 0;
    const [h1, m1] = hi.split(':').map(Number);
    const [h2, m2] = hf.split(':').map(Number);
    return (h2 * 60 + m2) - (h1 * 60 + m1);
}

const HorarioGridPicker = ({
    value,
    selectedFecha,
    weekAnchor,
    excludeProfesorId,
    onChange,
}) => {
    const { t } = useTranslation();
    const [pickedProfe, setPickedProfe] = useState('');
    const [horarios, setHorarios] = useState([]);
    const [loading, setLoading] = useState(false);
    const [weekStart, setWeekStart] = useState(() => mondayOf(weekAnchor || new Date()));

    // Cuando cambia el profe seleccionado, fetch sus horarios.
    useEffect(() => {
        if (!pickedProfe) {
            setHorarios([]);
            return;
        }
        const id = String(pickedProfe).split('/').pop();
        const ctrl = new AbortController();
        setLoading(true);
        fetch(getApiUrl(`/api/horarios?imparticion.profesor=${id}&itemsPerPage=100&order%5BdiaSemana%5D=asc&order%5BhoraInicio%5D=asc`), {
            headers: { Accept: 'application/ld+json' },
            credentials: 'include',
            signal: ctrl.signal,
        })
            .then(r => r.json())
            .then(d => {
                const items = d['hydra:member'] || d.member || [];
                setHorarios(items);
            })
            .catch(() => {})
            .finally(() => setLoading(false));
        return () => ctrl.abort();
    }, [pickedProfe]);

    const weekDates = useMemo(() => {
        const arr = [];
        for (let i = 0; i < 5; i++) {
            const d = new Date(weekStart);
            d.setDate(weekStart.getDate() + i);
            arr.push(d);
        }
        return arr;
    }, [weekStart]);

    // Cascada SEMANA→PLANTILLA por semana visible: para cada (grupoId,
    // imparticionId), si hay un horario de SEMANA cuyo PL cubre la fecha
    // del lunes visible, se queda; si no, fallback a horarios de PLANTILLA
    // del mismo (grupoId, imparticionId). Sin esto el grid muestra
    // PLANTILLA + SEMANAs apilados (3 bloques en la misma celda).
    // Misma lógica que Horarios.jsx::visibleSchedule pero adaptada a la
    // estructura raw de /api/horarios.
    const horariosFiltrados = useMemo(() => {
        if (!Array.isArray(horarios) || horarios.length === 0) return [];
        const isoOfDate = (d) => {
            const yy = d.getFullYear();
            const mm = String(d.getMonth() + 1).padStart(2, '0');
            const dd = String(d.getDate()).padStart(2, '0');
            return `${yy}-${mm}-${dd}`;
        };
        // Conjunto de (grupoId+impId) que tienen una SEMANA cubriendo la
        // semana visible — para esos pares, ocultamos PLANTILLA.
        const semanaActiva = new Set();
        for (const h of horarios) {
            const pl = h.periodoLectivo;
            if (!pl || pl.tipo !== 'semana') continue;
            const fi = pl.fechaInicio ? String(pl.fechaInicio).slice(0, 10) : null;
            const ff = pl.fechaFin ? String(pl.fechaFin).slice(0, 10) : null;
            if (!fi || !ff) continue;
            // SEMANA cubre la semana visible si solapa con cualquier día Lun-Vie.
            const overlaps = weekDates.some(d => {
                const iso = isoOfDate(d);
                return iso >= fi && iso <= ff;
            });
            if (!overlaps) continue;
            const grupoId = h.imparticion?.grupo?.id ?? h.imparticion?.grupo?.['@id'];
            const impId = h.imparticion?.id ?? h.imparticion?.['@id'];
            if (grupoId != null && impId != null) {
                semanaActiva.add(`${grupoId}|${impId}`);
            }
        }
        return horarios.filter(h => {
            const pl = h.periodoLectivo;
            if (!pl) return true;  // legacy sin PL → mostrar.
            const grupoId = h.imparticion?.grupo?.id ?? h.imparticion?.grupo?.['@id'];
            const impId = h.imparticion?.id ?? h.imparticion?.['@id'];
            const key = `${grupoId}|${impId}`;
            if (pl.tipo === 'plantilla') {
                // Solo si NO hay SEMANA activa para este (grupo, imparticion).
                return !semanaActiva.has(key);
            }
            if (pl.tipo === 'semana') {
                // Solo si su rango cubre la semana visible.
                const fi = pl.fechaInicio ? String(pl.fechaInicio).slice(0, 10) : null;
                const ff = pl.fechaFin ? String(pl.fechaFin).slice(0, 10) : null;
                if (!fi || !ff) return false;
                return weekDates.some(d => {
                    const iso = isoOfDate(d);
                    return iso >= fi && iso <= ff;
                });
            }
            return true;
        });
    }, [horarios, weekDates]);

    // Slots únicos = (horaInicio, horaFin) ordenados por horaInicio.
    const slots = useMemo(() => {
        const seen = new Set();
        const out = [];
        for (const h of horariosFiltrados) {
            const hi = parseHora(h.horaInicio);
            const hf = parseHora(h.horaFin);
            if (!hi || !hf) continue;
            const key = `${hi}-${hf}`;
            if (seen.has(key)) continue;
            seen.add(key);
            out.push({ key, hi, hf });
        }
        out.sort((a, b) => a.hi.localeCompare(b.hi));
        return out;
    }, [horariosFiltrados]);

    // Mapa (diaSemana, slotKey) → horario.
    const matrix = useMemo(() => {
        const m = new Map();
        for (const h of horariosFiltrados) {
            const hi = parseHora(h.horaInicio);
            const hf = parseHora(h.horaFin);
            const dia = h.diaSemana;
            if (!hi || !hf || !dia) continue;
            m.set(`${dia}|${hi}-${hf}`, h);
        }
        return m;
    }, [horariosFiltrados]);

    const colorForModule = (mid) => {
        const id = Number(mid) || 0;
        if (!id) return 'var(--bg-card)';
        const hue = (id * 47) % 360;
        return `hsl(${hue}, 55%, 48%)`;
    };

    const handleClickCell = (h, fechaISO) => {
        if (!h) return;
        onChange?.({
            horarioId: String(h.id || (h['@id'] || '').split('/').pop() || ''),
            fechaConcreta: fechaISO,
            horario: h,
        });
    };

    const fmtDateShort = (d) => `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}`;

    return (
        <div className={styles.container}>
            <div className={styles.header}>
                <div className={styles.profeField}>
                    <AsyncSearchSelect
                        value={pickedProfe}
                        onChange={setPickedProfe}
                        endpoint="/api/users"
                        // Incluye admins que también imparten (Sara). Pure admins
                        // sin imparticiones aparecen pero el grid se renderiza
                        // vacío con el placeholder "este profesor no tiene horario".
                        extraParams={{ rol_app: ['profesor', 'admin'] }}
                        getOptionLabel={(u) => [u.nombre, u.apellidos].filter(Boolean).join(' ').trim() || u.email || '—'}
                        getOptionValue={(u) => u.id || u['@id']?.split('/').pop()}
                        placeholder={t('exceptions.searchUser', { defaultValue: 'Buscar profesor…' })}
                    />
                </div>
                <div className={styles.weekNav}>
                    <button
                        type="button"
                        className={styles.navBtn}
                        onClick={() => {
                            const d = new Date(weekStart);
                            d.setDate(weekStart.getDate() - 7);
                            setWeekStart(d);
                        }}
                        aria-label={t('common.previous', { defaultValue: 'Anterior' })}
                    >
                        <ChevronLeft size={16} />
                    </button>
                    <span className={styles.weekLabel}>
                        {fmtDateShort(weekDates[0])} – {fmtDateShort(weekDates[4])}
                    </span>
                    <button
                        type="button"
                        className={styles.navBtn}
                        onClick={() => {
                            const d = new Date(weekStart);
                            d.setDate(weekStart.getDate() + 7);
                            setWeekStart(d);
                        }}
                        aria-label={t('common.next', { defaultValue: 'Siguiente' })}
                    >
                        <ChevronRight size={16} />
                    </button>
                </div>
            </div>

            {!pickedProfe && (
                <div className={styles.placeholder}>
                    {t('exceptions.pickerHint', { defaultValue: 'Elige un profesor para ver su horario semanal.' })}
                </div>
            )}

            {pickedProfe && loading && (
                <div className={styles.placeholder}>
                    {t('common.loading', { defaultValue: 'Cargando…' })}
                </div>
            )}

            {pickedProfe && !loading && slots.length === 0 && (
                <div className={styles.placeholder}>
                    {t('exceptions.pickerEmpty', { defaultValue: 'Este profesor no tiene horario asignado.' })}
                </div>
            )}

            {pickedProfe && !loading && slots.length > 0 && (
                <div
                    className={styles.grid}
                    role="grid"
                >
                    {/* Cabecera */}
                    <div className={`${styles.cell} ${styles.cellCorner}`} aria-hidden="true" />
                    {weekDates.map((d, i) => (
                        <div key={`hd-${i}`} className={`${styles.cell} ${styles.cellHeader}`}>
                            <div className={styles.dayName}>{dayLabels[i + 1]}</div>
                            <div className={styles.dayDate}>{fmtDateShort(d)}</div>
                        </div>
                    ))}
                    {/* Filas por slot */}
                    {slots.map((s) => (
                        <React.Fragment key={s.key}>
                            <div className={`${styles.cell} ${styles.cellHour}`}>
                                <div className={styles.hourMain}>{s.hi}</div>
                                <div className={styles.hourMeta}>{durMinutes(s.hi, s.hf)} min</div>
                            </div>
                            {weekDates.map((d, di) => {
                                const dia = di + 1;
                                const fechaISO = isoOf(d);
                                const h = matrix.get(`${dia}|${s.key}`);
                                if (!h) {
                                    return <div key={`${s.key}-${dia}`} className={`${styles.cell} ${styles.cellEmpty}`} />;
                                }
                                const isSelected = String(h.id) === String(value)
                                    && fechaISO === selectedFecha;
                                const mat = h.imparticion?.materia;
                                const moduloId = mat?.id || 0;
                                // Abreviatura primero (cabe en 145px), nombre completo
                                // como fallback si no hay abreviatura definida en el catálogo.
                                const materiaShort = mat?.abreviatura || mat?.nombre || '?';
                                const materiaLong = mat?.nombre || materiaShort;
                                const grupo = h.imparticion?.grupo;
                                const grupoLabel = grupo
                                    ? `${grupo.curso ? `${grupo.curso}º` : ''} ${grupo.abreviatura || grupo.nombre || ''}`.trim()
                                    : '';
                                return (
                                    <button
                                        type="button"
                                        key={`${s.key}-${dia}`}
                                        className={`${styles.cell} ${styles.block}${isSelected ? ' ' + styles.blockSelected : ''}`}
                                        style={{ backgroundColor: colorForModule(moduloId) }}
                                        onClick={() => handleClickCell(h, fechaISO)}
                                        title={`${materiaLong} · ${grupoLabel} · ${s.hi}-${s.hf} (${durMinutes(s.hi, s.hf)}min)`}
                                    >
                                        <div className={styles.blockMateria}>{materiaShort}</div>
                                        <div className={styles.blockMeta}>{grupoLabel}</div>
                                    </button>
                                );
                            })}
                        </React.Fragment>
                    ))}
                </div>
            )}
        </div>
    );
};

export default HorarioGridPicker;
