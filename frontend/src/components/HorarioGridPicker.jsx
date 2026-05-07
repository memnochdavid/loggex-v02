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

    // Slots únicos = (horaInicio, horaFin) ordenados por horaInicio.
    const slots = useMemo(() => {
        const seen = new Set();
        const out = [];
        for (const h of horarios) {
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
    }, [horarios]);

    // Mapa (diaSemana, slotKey) → horario.
    const matrix = useMemo(() => {
        const m = new Map();
        for (const h of horarios) {
            const hi = parseHora(h.horaInicio);
            const hf = parseHora(h.horaFin);
            const dia = h.diaSemana;
            if (!hi || !hf || !dia) continue;
            m.set(`${dia}|${hi}-${hf}`, h);
        }
        return m;
    }, [horarios]);

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
                        extraParams={{ rol_app: 'profesor' }}
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
                                const moduloId = h.imparticion?.materia?.id || 0;
                                const materia = h.imparticion?.materia?.nombre || '?';
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
                                        title={`${materia} · ${grupoLabel} · ${s.hi}-${s.hf} (${durMinutes(s.hi, s.hf)}min)`}
                                    >
                                        <div className={styles.blockMateria}>{materia}</div>
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
