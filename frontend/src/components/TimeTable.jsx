import React, { useState, useMemo, useEffect, useCallback } from 'react';
import styles from './TimeTable.module.css';
import calStyles from '../pages/Calificaciones.module.css';
import crudStyles from '../pages/Crud.module.css';
import { Clock, MapPin, Users, User, CalendarOff, CheckSquare, Save, Shuffle } from 'lucide-react';
import AccordionView from './AccordionView';
import ModalView from './ModalView';
import AsistenciaModal from './AsistenciaModal';
import AsyncSearchSelect from './AsyncSearchSelect';
import Button from './Button';
import EventCard from './EventCard'; // Importar EventCard
import MateriaLabel from './MateriaLabel';
import { useAuth } from '../context/AuthContext';
import { getApiUrl } from '../config/api'; // Importar getApiUrl
import { useTranslation } from 'react-i18next';
import { toast, parseErrorResponse } from '../utils/toast';

// Misma paleta determinista que el editor (HorariosEditor): hue derivado del id
const colorForModule = (mid) => {
    const id = Number(mid) || 0;
    if (!id) return 'var(--bg-card)';  // sin id válido: neutro, NO rojo (hue=0).
    const hue = (id * 47) % 360;
    return `hsl(${hue}, 55%, 48%)`;
};

// Duración del slot en minutos (start/end formato 'HH:MM'). Usada para
// dar altura proporcional a la celda — sin esto, slots de 30 vs 90 min
// rendereaban con la misma altura mínima de 22px y la rejilla quedaba
// con filas chafadas/desproporcionadas.
const slotDurationMin = (slot) => {
    if (!slot?.start || !slot?.end) return 30;
    const [h1, m1] = slot.start.split(':').map(Number);
    const [h2, m2] = slot.end.split(':').map(Number);
    return Math.max(15, (h2 * 60 + m2) - (h1 * 60 + m1));
};

const TimeTable = ({ events = [], slots = null, title, selectedDate, festivos = [], tareas = [] }) => {
    const { t } = useTranslation();
    const { user } = useAuth();
    const isProfesor = user?.roles?.includes('ROLE_PROFESOR');
    const isAdmin = user?.roles?.includes('ROLE_ADMIN') || user?.roles?.includes('ROLE_SUPERADMIN');
    const canTakeAttendance = isProfesor || isAdmin;

    const days = [t('days.monday'), t('days.tuesday'), t('days.wednesday'), t('days.thursday'), t('days.friday')];
    const [selectedEvent, setSelectedEvent] = useState(null);
    const [isTakingAttendance, setIsTakingAttendance] = useState(false);
    const [savingAttendance, setSavingAttendance] = useState(false);
    // Solicitar excepción puntual sobre la fecha del placement clicado.
    // Profe ⇒ POST estado=pendiente (cola del admin). Admin ⇒ aprobada directa.
    const [isRequestingException, setIsRequestingException] = useState(false);
    const [savingExcepcion, setSavingExcepcion] = useState(false);
    const [excForm, setExcForm] = useState({ tipo: 'sustitucion', profeOverride: '', motivo: '', observaciones: '' });
    
    // Referencia para acceder a los datos del AsistenciaModal desde fuera
    const [asistenciaData, setAsistenciaData] = useState(null);

    // Estado para acordeón móvil (día expandido)
    const [expandedDayId, setExpandedDayId] = useState(null);

    // Estado para acordeón de turnos (Escritorio) - Controlado
    const [activeShift, setActiveShift] = useState('morning');

    // Efecto para abrir el día actual en móvil y el turno actual en escritorio
    useEffect(() => {
        if (selectedDate) {
            const day = selectedDate.getDay();
            const currentDayId = day === 0 || day > 5 ? 1 : day;
            setExpandedDayId(currentDayId);

            // Determinar turno actual
            const hour = selectedDate.getHours();
            if (hour >= 15) {
                setActiveShift('afternoon');
            } else {
                setActiveShift('morning');
            }
        }
    }, [selectedDate]);

    // Obtener el índice del día seleccionado (1=Lunes, 5=Viernes)
    const selectedDayIndex = useMemo(() => {
        if (!selectedDate) return null;
        const day = selectedDate.getDay(); // 0=Domingo, 1=Lunes
        return day === 0 ? 7 : day;
    }, [selectedDate]);

    // Calcular fechas de la semana
    const weekDates = useMemo(() => {
        if (!selectedDate) return [];
        const d = new Date(selectedDate);
        const day = d.getDay();
        const diff = d.getDate() - day + (day === 0 ? -6 : 1); // Ajustar al lunes
        const monday = new Date(d.setDate(diff));

        const dates = [];
        for (let i = 0; i < 5; i++) {
            const date = new Date(monday);
            date.setDate(monday.getDate() + i);
            dates.push(date);
        }
        return dates;
    }, [selectedDate]);

    // Helper para formatear fecha a YYYY-MM-DD local
    const formatDateISO = (date) => {
        if (!date) return '';
        const d = new Date(date);
        const year = d.getFullYear();
        const month = String(d.getMonth() + 1).padStart(2, '0');
        const day = String(d.getDate()).padStart(2, '0');
        return `${year}-${month}-${day}`;
    };

    // Comprobar si un día es festivo
    const getFestivoForDay = (date) => {
        if (!date) return null;
        const dateStr = formatDateISO(date);

        return festivos.find(f => {
            const startStr = f.fechaInicio.split('T')[0];
            const endStr = f.fechaFin ? f.fechaFin.split('T')[0] : startStr;
            return dateStr >= startStr && dateStr <= endStr;
        });
    };

    // Definir tramos horarios explícitos
    // Slots dinámicos: si el endpoint manda la unión de tramos de las jornadas
    // reales del usuario (alumno=1 grupo=1 jornada; profesor=N grupos=N jornadas
    // deduplicadas por hi-hf), los usamos. Si no viene `slots`, fallback a los
    // hardcoded por compatibilidad con vistas que aún no llaman al endpoint
    // nuevo. Split mañana/tarde por start < 15:00.
    const morningSlots = useMemo(() => {
        if (Array.isArray(slots) && slots.length > 0) {
            return slots
                .filter(s => parseInt(s.horaInicio.split(':')[0], 10) < 15)
                .map(s => ({
                    start: s.horaInicio,
                    end: s.horaFin,
                    tipo: s.tipo || 'slot',
                    etiqueta: s.etiqueta || null,
                }));
        }
        return [
            { start: '08:30', end: '09:30', tipo: 'slot' },
            { start: '09:30', end: '10:30', tipo: 'slot' },
            { start: '10:30', end: '11:30', tipo: 'slot' },
            { start: '11:30', end: '12:30', tipo: 'slot' },
            { start: '12:30', end: '13:30', tipo: 'slot' },
            { start: '13:30', end: '14:30', tipo: 'slot' },
        ];
    }, [slots]);

    const afternoonSlots = useMemo(() => {
        if (Array.isArray(slots) && slots.length > 0) {
            return slots
                .filter(s => parseInt(s.horaInicio.split(':')[0], 10) >= 15)
                .map(s => ({
                    start: s.horaInicio,
                    end: s.horaFin,
                    tipo: s.tipo || 'slot',
                    etiqueta: s.etiqueta || null,
                }));
        }
        return [
            { start: '15:00', end: '16:00', tipo: 'slot' },
            { start: '16:00', end: '17:00', tipo: 'slot' },
            { start: '17:00', end: '18:00', tipo: 'slot' },
            { start: '18:00', end: '19:00', tipo: 'slot' },
            { start: '19:00', end: '20:00', tipo: 'slot' },
            { start: '20:00', end: '21:00', tipo: 'slot' },
        ];
    }, [slots]);

    // Detectar turnos
    const hasAfternoon = useMemo(() => Array.isArray(events) && events.some(e => parseInt(e.horaInicio.split(':')[0]) >= 15), [events]);
    const hasMorning = useMemo(() => Array.isArray(events) && events.some(e => parseInt(e.horaInicio.split(':')[0]) < 15), [events]);

    // Si solo hay un turno disponible (caso típico de alumno), forzarlo como activo
    // para que el acordeón no aparezca cerrado cuando la hora actual no coincide con ese turno.
    useEffect(() => {
        if (hasMorning && !hasAfternoon) setActiveShift('morning');
        else if (hasAfternoon && !hasMorning) setActiveShift('afternoon');
    }, [hasMorning, hasAfternoon]);

    // Función para procesar eventos y calcular rowSpan (pura, sin hooks)
    const processEvents = (slots) => {
        if (!slots || slots.length === 0) return [];
        const grid = Array(slots.length).fill(null).map(() => Array(days.length).fill(null));

        // 1. Marcar festivos
        days.forEach((day, dIndex) => {
            const date = weekDates[dIndex];
            const festivo = getFestivoForDay(date);

            if (festivo) {
                grid[0][dIndex] = {
                    isFestivo: true,
                    nombre: festivo.nombre,
                    rowSpan: slots.length,
                    skip: false
                };
                for (let h = 1; h < slots.length; h++) {
                    grid[h][dIndex] = { isFestivo: true, skip: true };
                }
            }
        });

        // 2. Colocar eventos en la matriz (solo si no es festivo).
        // Soporta BLOQUES (1 evento que cubre varios slots de 30min, p.ej.
        // 8:30→9:30): el evento se coloca en su slot inicio con rowSpan = N
        // (cuántos slots de la jornada cubre); los slots intermedios y final
        // se marcan skip=true para no renderizarse.
        if (Array.isArray(events)) {
            slots.forEach((slot, hIndex) => {
                days.forEach((day, dIndex) => {
                    if (grid[hIndex][dIndex]) return;

                    const event = events.find(e =>
                        e.diaSemana === (dIndex + 1) &&
                        e.horaInicio === slot.start
                    );
                    if (!event) return;
                    // Skip eventos rotos (sin materia ni imparticionId / moduloId):
                    // antes se pintaban como caja roja con guion porque
                    // colorForModule(undefined) → hsl(0,...) y MateriaLabel
                    // con nombre null renderiza vacío. Ahora no se renderizan.
                    const hasMateria = event.materia || event.moduloAbreviatura;
                    const hasImpId = event.imparticionId || event.moduloId;
                    if (!hasMateria && !hasImpId) return;

                    // Calcular cuántos slots cubre el evento (event.horaFin > slot.start de cada uno).
                    let span = 1;
                    for (let k = hIndex + 1; k < slots.length; k++) {
                        if (slots[k].start >= event.horaFin) break;
                        span++;
                    }
                    grid[hIndex][dIndex] = { event, rowSpan: span, skip: false };
                    // Marcar slots cubiertos por el bloque como skip.
                    for (let k = 1; k < span; k++) {
                        if (grid[hIndex + k][dIndex]) continue;
                        grid[hIndex + k][dIndex] = { skip: true };
                    }
                });
            });
        }

        // 3. Calcular fusiones (verticales)
        for (let d = 0; d < days.length; d++) {
            if (grid[0][d] && grid[0][d].isFestivo) continue;

            for (let h = 0; h < slots.length - 1; h++) {
                const current = grid[h][d];

                if (current && !current.skip && !current.isFestivo) {
                    let k = h + 1;
                    while (k < slots.length) {
                        const next = grid[k][d];
                        if (next && !next.skip && !next.isFestivo &&
                            next.event.materia === current.event.materia &&
                            next.event.grupo === current.event.grupo &&
                            next.event.aula === current.event.aula
                        ) {
                            current.rowSpan++;
                            next.skip = true;
                            current.event = { ...current.event, horaFin: next.event.horaFin };
                            k++;
                        } else {
                            break;
                        }
                    }
                }
            }
        }
        return grid;
    };

    // Pre-calcular grids
    const morningGrid = useMemo(() => processEvents(morningSlots), [events, morningSlots, weekDates, festivos]);
    const afternoonGrid = useMemo(() => processEvents(afternoonSlots), [events, afternoonSlots, weekDates, festivos]);

    const handleEventClick = (event) => {
        setSelectedEvent(event);
        setIsTakingAttendance(false);
    };

    const handleCloseModal = () => {
        setSelectedEvent(null);
        setIsTakingAttendance(false);
        setIsRequestingException(false);
        setExcForm({ tipo: 'sustitucion', profeOverride: '', motivo: '', observaciones: '' });
        setAsistenciaData(null); // Limpiar datos al cerrar
    };

    // Fecha ISO del día del placement seleccionado dentro de la semana visible.
    // Devuelve null si no se puede calcular.
    const fechaConcretaDelEvento = (event) => {
        if (!event || !weekDates) return null;
        const d = weekDates[event.diaSemana - 1];
        if (!d) return null;
        const yy = d.getFullYear();
        const mm = String(d.getMonth() + 1).padStart(2, '0');
        const dd = String(d.getDate()).padStart(2, '0');
        return `${yy}-${mm}-${dd}`;
    };

    const handleSubmitExcepcion = async () => {
        if (!selectedEvent) return;
        const fecha = fechaConcretaDelEvento(selectedEvent);
        if (!fecha) {
            toast.error(t('exceptions.errorRequired', { defaultValue: 'Faltan datos del bloque' }));
            return;
        }
        if (excForm.tipo === 'sustitucion' && !excForm.profeOverride) {
            toast.error(t('exceptions.errorRequired', { defaultValue: 'Falta el profesor sustituto' }));
            return;
        }

        setSavingExcepcion(true);
        const payload = {
            horarioBase: `/api/horarios/${selectedEvent.id}`,
            fechaConcreta: fecha,
            tipo: excForm.tipo,
            motivo: excForm.motivo || null,
            observaciones: excForm.observaciones || null,
        };
        // Estado lo gestiona el processor: profe ⇒ pendiente, admin ⇒ respeta payload.
        // Como aquí el tipo se envía sin estado, el processor pondrá pendiente para
        // profe puro y mantendrá el default (pendiente) para admin si no lo cambia.
        // Si admin quiere aprobar directa, lo hará desde /admin/excepciones.
        if ((excForm.tipo === 'sustitucion' || excForm.tipo === 'evento_especial') && excForm.profeOverride) {
            payload.profeOverride = `/api/users/${String(excForm.profeOverride).split('/').pop()}`;
        }

        try {
            const response = await fetch(getApiUrl('/api/excepcion_horarios'), {
                method: 'POST',
                headers: { 'Content-Type': 'application/ld+json', Accept: 'application/ld+json' },
                body: JSON.stringify(payload),
                credentials: 'include',
            });
            if (!response.ok) {
                const message = await parseErrorResponse(response);
                throw new Error(message);
            }
            toast.success(t('exceptions.requested', { defaultValue: 'Solicitud enviada' }), {
                description: t('exceptions.requestedDesc', { defaultValue: 'El admin del centro la verá como pendiente.' }),
            });
            handleCloseModal();
        } catch (err) {
            console.error('Error solicitando excepción:', err);
            toast.error(err.message);
        } finally {
            setSavingExcepcion(false);
        }
    };

    const canPassAttendance = (event) => {
        if (!event || !canTakeAttendance) return false;
        const eventDate = weekDates[event.diaSemana - 1];
        if (!eventDate) return false;
        const now = new Date();
        const eventDateTime = new Date(eventDate);
        const [hours, minutes] = event.horaInicio.split(':');
        eventDateTime.setHours(parseInt(hours), parseInt(minutes), 0, 0);
        return now >= eventDateTime;
    };

    const getImparticionId = (event) => {
        if (!event) return null;
        if (event.imparticionId) return event.imparticionId;
        const imparticion = event.imparticion;
        if (!imparticion) return null;
        if (typeof imparticion === 'string') return imparticion.split('/').pop();
        if (imparticion.id) return imparticion.id;
        if (imparticion['@id']) return imparticion['@id'].split('/').pop();
        return null;
    };

    // Filtrar tareas para el evento seleccionado
    const getTasksForEvent = (event) => {
        if (!event || !tareas) return [];
        
        const eventDate = weekDates[event.diaSemana - 1];
        if (!eventDate) return [];
        const dateStr = formatDateISO(eventDate);

        return tareas.filter(t => {
            const taskDate = t.fechaLimite.split('T')[0];
            if (taskDate !== dateStr) return false;
            
            const horarioImpId = getImparticionId(event);
            let tareaImpId = null;
            if (t.imparticion) {
                if (typeof t.imparticion === 'string') tareaImpId = t.imparticion.split('/').pop();
                else if (t.imparticion.id) tareaImpId = t.imparticion.id;
            }
            
            return String(horarioImpId) === String(tareaImpId);
        });
    };

    const renderGrid = (slots, gridData) => {
        return (
            <div className={styles.tableContainer}>
                <div className={styles.grid} style={{ gridTemplateColumns: `80px repeat(5, minmax(85px, 1fr))` }}>
                    {/* Header Días */}
                    <div className={styles.headerCell}>{t('timetable.hour')}</div>
                    {days.map((day, index) => (
                        <div
                            key={day}
                            className={`${styles.headerCell} ${selectedDayIndex === (index + 1) ? styles.highlightDay : ''}`}
                        >
                            {day}
                            <div className={styles.dateLabel}>
                                {weekDates[index] ? weekDates[index].toLocaleDateString(undefined, {day: '2-digit', month: '2-digit'}) : ''}
                            </div>
                        </div>
                    ))}

                    {/* Filas Horas. La time-cell muestra el rango del TRAMO
                        CONTIGUO entero (sin recreos entre medias) — ej.
                        "8:30-10:30" cubre 4 slots de 30min consecutivos hasta
                        el siguiente recreo. La time-cell del primer slot del
                        tramo tiene gridRow span = N; las time-cells de los
                        slots siguientes dentro del mismo tramo NO se
                        renderizan (la time-cell del inicio las cubre). Las
                        celdas día siguen siendo per-slot con sus propios
                        rowSpan según la duración del evento (60-120min). */}
                    {(() => {
                        // Pre-calcular tramos contiguos de tipo SLOT (sin recreos
                        // entre medias). Los recreos rompen el tramo y se
                        // renderizan como una fila completa propia.
                        const tramoInfo = new Array(slots.length);
                        let i = 0;
                        while (i < slots.length) {
                            // Salto recreos: cada uno es su propio "tramo" de 1.
                            if (slots[i].tipo === 'recreo') {
                                tramoInfo[i] = { isStart: true, span: 1, tramoStart: slots[i].start, tramoEnd: slots[i].end, isRecreo: true };
                                i++;
                                continue;
                            }
                            let j = i;
                            while (j + 1 < slots.length
                                && slots[j + 1].tipo === 'slot'
                                && slots[j].end === slots[j + 1].start) {
                                j++;
                            }
                            const span = j - i + 1;
                            const tramoEnd = slots[j].end;
                            for (let k = i; k <= j; k++) {
                                tramoInfo[k] = {
                                    isStart: k === i,
                                    span: k === i ? span : 0,
                                    tramoEnd,
                                    tramoStart: slots[i].start,
                                    isRecreo: false,
                                };
                            }
                            i = j + 1;
                        }

                        return slots.map((slot, hIndex) => {
                            const tInfo = tramoInfo[hIndex];
                            // Recreo: renderizar como banda diagonal por día,
                            // saltando días con festivo (cuya celda ya está
                            // cubierta por rowSpan del festivo desde fila 0).
                            // Sin saltarlos, CSS Grid se desordena visualmente.
                            // Altura proporcional a la duración del slot.
                            // Diferenciamos recreo (compacto, ~24px) de slot
                            // lectivo (≥48px para que el eventCard tenga
                            // holgura real para mostrar materia + grupo sin
                            // cortarse, incluso cuando el cell se subdivide
                            // verticalmente por placements contiguos en el
                            // mismo tramo). Factor 1.5 px/min asegura que
                            // slots de 1h tienen 90px, 90min → 135px.
                            const dMin = slotDurationMin(slot);
                            const slotMinH = slot.tipo === 'recreo'
                                ? `${Math.max(20, Math.round(dMin * 1.2))}px`
                                : `${Math.max(48, Math.round(dMin * 1.5))}px`;

                            if (tInfo.isRecreo) {
                                return (
                                    <React.Fragment key={hIndex}>
                                        <div className={styles.timeCell} style={{ minHeight: slotMinH }}>
                                            {tInfo.tramoStart} - {tInfo.tramoEnd}
                                        </div>
                                        {days.map((_, dIndex) => {
                                            const cd = gridData[hIndex][dIndex];
                                            if (cd && cd.isFestivo) return null;
                                            return (
                                                <div
                                                    key={`recreo-${dIndex}`}
                                                    className={styles.recreoStrip}
                                                    style={{ minHeight: slotMinH }}
                                                >
                                                    {dIndex === 0 && (slot.etiqueta || t('timetable.recreo', { defaultValue: 'Recreo' }))}
                                                </div>
                                            );
                                        })}
                                    </React.Fragment>
                                );
                            }
                            return (
                        <React.Fragment key={hIndex}>
                            {tInfo.isStart && (
                                <div
                                    className={styles.timeCell}
                                    style={{
                                        ...(tInfo.span > 1 ? { gridRow: `span ${tInfo.span}` } : {}),
                                        minHeight: slotMinH,
                                    }}
                                >
                                    {tInfo.tramoStart} - {tInfo.tramoEnd}
                                </div>
                            )}
                            {days.map((day, dIndex) => {
                                const cellData = gridData[hIndex][dIndex];
                                const isHighlighted = selectedDayIndex === (dIndex + 1);

                                if (cellData && cellData.skip) {
                                    return null;
                                }

                                if (cellData && cellData.isFestivo) {
                                    return (
                                        <div
                                            key={`${day}-${hIndex}`}
                                            className={`${styles.cell} ${styles.festivoCell}`}
                                            style={{ gridRow: `span ${cellData.rowSpan}`, minHeight: slotMinH }}
                                        >
                                            <div className={styles.festivoContent}>
                                                <CalendarOff size={24} />
                                                <span>{cellData.nombre}</span>
                                            </div>
                                        </div>
                                    );
                                }

                                return (
                                    <div
                                        key={`${day}-${hIndex}`}
                                        className={`${styles.cell} ${isHighlighted ? styles.highlightCell : ''}`}
                                        style={{
                                            ...(cellData && cellData.rowSpan > 1 ? { gridRow: `span ${cellData.rowSpan}` } : {}),
                                            minHeight: slotMinH,
                                        }}
                                    >
                                        {cellData && (() => {
                                            const exc = cellData.event._excepcion;
                                            const cancelado = cellData.event._cancelado;
                                            const excTitle = exc
                                                ? `${{
                                                    intercambio: 'Intercambio',
                                                    sustitucion: 'Sustitución',
                                                    cancelado: 'Cancelada',
                                                    evento_especial: 'Evento especial',
                                                    asignada: 'Cubres esta clase',
                                                  }[exc.tipo] || 'Excepción'}${exc.motivo ? ` — ${exc.motivo}` : ''}`
                                                : t('timetable.viewDetails');
                                            const overrideName = exc?.profeOverride?.nombre
                                                || exc?.imparticionEfectiva?.profesor
                                                || null;
                                            return (
                                                <div
                                                    className={`${styles.eventCard}${exc ? ' ' + (styles.eventCardException || '') : ''}${cancelado ? ' ' + (styles.eventCardCancelled || '') : ''}`}
                                                    onClick={() => handleEventClick(cellData.event)}
                                                    title={excTitle}
                                                    style={{ backgroundColor: colorForModule(cellData.event.moduloId || cellData.event.imparticionId) }}
                                                >
                                                    <div className={styles.eventModulo}>
                                                        <MateriaLabel materia={{
                                                            nombre: cellData.event.materia,
                                                            abreviatura: cellData.event.moduloAbreviatura,
                                                        }} />
                                                    </div>
                                                    <div className={styles.eventGroupSmall}>
                                                        {[
                                                            cellData.event.grupoCurso ? `${cellData.event.grupoCurso}º` : null,
                                                            (cellData.event.grupoAbreviatura && cellData.event.grupoAbreviatura.trim() !== '')
                                                                ? cellData.event.grupoAbreviatura
                                                                : cellData.event.grupo,
                                                        ].filter(Boolean).join(' ')}
                                                    </div>
                                                    {exc && (
                                                        <div className={styles.eventExceptionTag}>
                                                            {cancelado
                                                                ? '✕ Cancelada'
                                                                : exc.tipo === 'asignada'
                                                                    ? '✦ Cubres'
                                                                    : exc.tipo === 'sustitucion' && overrideName
                                                                        ? `↔ ${overrideName}`
                                                                        : exc.tipo === 'intercambio' && overrideName
                                                                            ? `⇄ ${overrideName}`
                                                                            : exc.tipo === 'evento_especial'
                                                                                ? '★ Evento'
                                                                                : '● Excepción'}
                                                        </div>
                                                    )}
                                                </div>
                                            );
                                        })()}
                                    </div>
                                );
                            })}
                        </React.Fragment>
                        );
                    });
                    })()}
                </div>
            </div>
        );
    };

    // Preparar datos para AccordionView (Escritorio)
    const shiftsData = [];
    if (hasMorning) {
        shiftsData.push({
            id: 'morning',
            title: t('timetable.morningShift'),
            slots: morningSlots,
            grid: morningGrid
        });
    }
    if (hasAfternoon) {
        shiftsData.push({
            id: 'afternoon',
            title: t('timetable.afternoonShift'),
            slots: afternoonSlots,
            grid: afternoonGrid
        });
    }

    // Preparar datos para AccordionView (Móvil)
    const daysData = days.map((dayName, index) => {
        const dayIndex = index + 1;
        const date = weekDates[index];
        const festivo = getFestivoForDay(date);

        const dayEvents = Array.isArray(events) 
            ? events
                .filter(e => e.diaSemana === dayIndex)
                .sort((a, b) => a.horaInicio.localeCompare(b.horaInicio))
            : [];

        return {
            id: dayIndex,
            title: dayName,
            date: date,
            festivo: festivo,
            events: dayEvents
        };
    });

    const renderMobileItem = (item) => (
        <div className={styles.dayContent}>
            {item.festivo ? (
                <div className={styles.mobileFestivo}>
                    <CalendarOff size={24} style={{ marginBottom: '8px' }} />
                    <div>{item.festivo.nombre}</div>
                </div>
            ) : item.events.length > 0 ? (
                item.events.map((event, i) => (
                    <div
                        key={i}
                        className={styles.mobileEvent}
                        onClick={() => handleEventClick(event)}
                    >
                        <div className={styles.mobileEventTime}>
                            {event.horaInicio} - {event.horaFin}
                        </div>
                        <div className={styles.mobileEventTitle}>
                            <MateriaLabel materia={{
                                nombre: event.materia,
                                abreviatura: event.moduloAbreviatura,
                            }} />
                        </div>
                        <div className={styles.mobileEventSubtitle}>
                            {[
                                event.grupoCurso ? `${event.grupoCurso}º` : null,
                                (event.grupoAbreviatura && event.grupoAbreviatura.trim() !== '') ? event.grupoAbreviatura : event.grupo,
                            ].filter(Boolean).join(' ')} • {event.aula}
                        </div>
                    </div>
                ))
            ) : (
                <div className={styles.empty} style={{ padding: '1rem' }}>
                    {t('timetable.noClasses')}
                </div>
            )}
        </div>
    );

    const tasksForSelectedEvent = selectedEvent ? getTasksForEvent(selectedEvent) : [];

    // Función para manejar el guardado desde el footer del ModalView
    const handleSaveAttendance = async () => {
        if (!asistenciaData || !asistenciaData.alumnos) return;
        
        setSavingAttendance(true);
        try {
            const payload = {
                imparticion: asistenciaData.imparticionId,
                fecha: asistenciaData.fecha,
                hora: asistenciaData.hora,
                asistencias: asistenciaData.alumnos.map(a => ({
                    alumnoId: a.id,
                    estado: a.estado,
                    comentario: a.comentario
                }))
            };

            const response = await fetch(getApiUrl('/api/v1/asistencia/batch'), {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload),
                credentials: 'include'
            });

            if (response.ok) {
                handleCloseModal();
                toast.success(t('home.attendanceSaved', { defaultValue: 'Asistencia registrada' }));
            } else {
                toast.error(t('home.errorSavingAttendance'));
            }
        } catch (error) {
            console.error(error);
            toast.error(t('home.errorConnection'));
        } finally {
            setSavingAttendance(false);
        }
    };

    // Función para recibir datos desde AsistenciaModal
    const handleAsistenciaDataChange = useCallback((data) => {
        setAsistenciaData(data);
    }, []);

    return (
        <div className={styles.container}>
            {/* Vista Escritorio */}
            <div className={styles.desktopView}>
                {shiftsData.length === 0 ? (
                    <p className={styles.empty}>{t('timetable.noScheduledClasses')}</p>
                ) : shiftsData.length === 1 ? (
                    renderGrid(shiftsData[0].slots, shiftsData[0].grid)
                ) : (() => {
                    const currentShift = shiftsData.find(s => s.id === activeShift) || shiftsData[0];
                    return (
                        <>
                            <div
                                className={calStyles.tabBar}
                                role="tablist"
                                aria-label={t('timetable.shiftTabs', 'Turnos')}
                            >
                                {shiftsData.map(shift => (
                                    <button
                                        key={shift.id}
                                        type="button"
                                        role="tab"
                                        aria-selected={activeShift === shift.id}
                                        className={`${calStyles.tab} ${activeShift === shift.id ? calStyles.tabActive : ''}`}
                                        onClick={() => setActiveShift(shift.id)}
                                    >
                                        {shift.title}
                                    </button>
                                ))}
                            </div>
                            <div key={activeShift} className={calStyles.tabContent} role="tabpanel">
                                {renderGrid(currentShift.slots, currentShift.grid)}
                            </div>
                        </>
                    );
                })()}
            </div>

            {/* Vista Móvil */}
            <div className={styles.mobileView}>
                <AccordionView
                    data={daysData}
                    renderItem={renderMobileItem}
                    canAdd={false}
                    expandedId={expandedDayId}
                    onToggle={(id) => setExpandedDayId(expandedDayId === id ? null : id)}
                />
            </div>

            {/* Modal de Detalle / Asistencia */}
            <ModalView
                isOpen={!!selectedEvent}
                onClose={handleCloseModal}
                title={
                    selectedEvent
                        ? (isTakingAttendance
                            ? t('home.rollCallTitle', { module: selectedEvent.materia })
                            : isRequestingException
                                ? t('exceptions.newTitle', { defaultValue: 'Nueva excepción' })
                                : selectedEvent.materia)
                        : ''
                }
                size={isTakingAttendance ? "large" : "small"}
                cancelText={(isTakingAttendance || isRequestingException) ? t('common.cancel') : t('common.close')}
                // Footer personalizado para el modo de asistencia y solicitud de excepción
                footer={isTakingAttendance ? (
                    <>
                        <Button variant="secondary" onClick={handleCloseModal}>{t('common.cancel')}</Button>
                        <Button onClick={handleSaveAttendance} disabled={savingAttendance}>
                            <Save size={18} style={{ marginRight: '8px' }} />
                            {savingAttendance ? t('common.saving') : t('common.save')}
                        </Button>
                    </>
                ) : isRequestingException ? (
                    <>
                        <Button variant="secondary" onClick={() => setIsRequestingException(false)} disabled={savingExcepcion}>
                            {t('common.cancel')}
                        </Button>
                        <Button onClick={handleSubmitExcepcion} disabled={savingExcepcion}>
                            <Shuffle size={18} style={{ marginRight: '8px' }} />
                            {savingExcepcion
                                ? t('common.saving')
                                : (isAdmin
                                    ? t('exceptions.create', { defaultValue: 'Crear' })
                                    : t('exceptions.request', { defaultValue: 'Solicitar' }))}
                        </Button>
                    </>
                ) : undefined}
            >
                {selectedEvent && (
                    isTakingAttendance ? (
                        <AsistenciaModal
                            imparticionId={getImparticionId(selectedEvent)}
                            fecha={formatDateISO(weekDates[selectedEvent.diaSemana - 1])}
                            hora={selectedEvent.horaInicio}
                            onClose={handleCloseModal}
                            onDataChange={handleAsistenciaDataChange} // Pasar callback para recibir datos
                        />
                    ) : isRequestingException ? (
                        <div className={styles.modalBody}>
                            <p className={styles.subValue} style={{ marginBottom: 'var(--space-3)' }}>
                                {t('exceptions.modalHint', {
                                    defaultValue: 'Solicitas un cambio para {{fecha}} en el bloque {{hora}}.',
                                    fecha: fechaConcretaDelEvento(selectedEvent) || '',
                                    hora: `${selectedEvent.horaInicio}–${selectedEvent.horaFin}`,
                                })}
                            </p>
                            <div className={crudStyles.formGroup}>
                                <label className={crudStyles.label}>{t('exceptions.tipo', { defaultValue: 'Tipo' })}</label>
                                <select
                                    className={crudStyles.select}
                                    value={excForm.tipo}
                                    onChange={(e) => setExcForm(p => ({ ...p, tipo: e.target.value }))}
                                >
                                    <option value="sustitucion">{t('exceptions.types.sustitucion', { defaultValue: 'Sustitución' })}</option>
                                    <option value="cancelado">{t('exceptions.types.cancelado', { defaultValue: 'Cancelado' })}</option>
                                    <option value="evento_especial">{t('exceptions.types.evento_especial', { defaultValue: 'Evento especial' })}</option>
                                    {/* INTERCAMBIO se oculta del create hasta Fase E (UI atómica de pareja).
                                        Sin la pareja, una excepción intercambio queda huérfana y no aporta. */}
                                </select>
                            </div>
                            {(excForm.tipo === 'sustitucion' || excForm.tipo === 'evento_especial') && (
                                <div className={crudStyles.formGroup}>
                                    <label className={crudStyles.label}>
                                        {excForm.tipo === 'sustitucion'
                                            ? t('exceptions.profeOverride', { defaultValue: 'Profesor sustituto' })
                                            : t('exceptions.profeFacilitador', { defaultValue: 'Facilitador (opcional)' })}
                                    </label>
                                    <AsyncSearchSelect
                                        value={excForm.profeOverride}
                                        onChange={(v) => setExcForm(p => ({ ...p, profeOverride: v }))}
                                        endpoint="/api/users"
                                        extraParams={{ 'roles[]': 'ROLE_PROFESOR' }}
                                        getOptionLabel={(u) => [u.nombre, u.apellidos].filter(Boolean).join(' ').trim() || u.email || '—'}
                                        getOptionValue={(u) => u.id || u['@id']?.split('/').pop()}
                                        placeholder={t('exceptions.searchUser', { defaultValue: 'Buscar profesor…' })}
                                        required={excForm.tipo === 'sustitucion'}
                                    />
                                </div>
                            )}
                            <div className={crudStyles.formGroup}>
                                <label className={crudStyles.label}>{t('exceptions.motivo', { defaultValue: 'Motivo' })}</label>
                                <input
                                    type="text"
                                    className={crudStyles.input}
                                    value={excForm.motivo}
                                    onChange={(e) => setExcForm(p => ({ ...p, motivo: e.target.value }))}
                                    placeholder={t('exceptions.motivoPlaceholder', { defaultValue: 'Ej. ausencia justificada, charla externa…' })}
                                />
                            </div>
                            <div className={crudStyles.formGroup}>
                                <label className={crudStyles.label}>{t('exceptions.observaciones', { defaultValue: 'Observaciones (opcional)' })}</label>
                                <textarea
                                    className={crudStyles.textarea}
                                    value={excForm.observaciones}
                                    onChange={(e) => setExcForm(p => ({ ...p, observaciones: e.target.value }))}
                                    rows={2}
                                />
                            </div>
                        </div>
                    ) : (
                        <div className={styles.modalBody}>
                            <div className={styles.detailRow}>
                                <Clock size={18} className={styles.icon} />
                                <div>
                                    <span className={styles.label}>{t('timetable.scheduleLabel')}</span>
                                    <span className={styles.value}>
                                        {days[selectedEvent.diaSemana - 1]}, {selectedEvent.horaInicio} - {selectedEvent.horaFin}
                                    </span>
                                </div>
                            </div>
                            <div className={styles.detailRow}>
                                <Users size={18} className={styles.icon} />
                                <div>
                                    <span className={styles.label}>{t('timetable.groupLabel')}</span>
                                    <span className={styles.value}>
                                        {selectedEvent.grupoCurso ? `${selectedEvent.grupoCurso}º ` : ''}{selectedEvent.grupo}
                                    </span>
                                    {selectedEvent.grupoAbreviatura && (
                                        <span className={styles.subValue}> ({selectedEvent.grupoAbreviatura})</span>
                                    )}
                                </div>
                            </div>
                            <div className={styles.detailRow}>
                                <MapPin size={18} className={styles.icon} />
                                <div>
                                    <span className={styles.label}>{t('timetable.classroomLabel')}</span>
                                    <span className={styles.value}>{selectedEvent.aula}</span>
                                </div>
                            </div>
                            <div className={styles.detailRow}>
                                <User size={18} className={styles.icon} />
                                <div>
                                    <span className={styles.label}>{t('timetable.teacherLabel')}</span>
                                    <span className={styles.value}>{selectedEvent.profesor}</span>
                                </div>
                            </div>

                            {/* Mostrar Tareas/Eventos del día */}
                            {tasksForSelectedEvent.length > 0 && (
                                <div style={{ marginTop: '1rem', borderTop: '1px solid var(--border-color)', paddingTop: '1rem' }}>
                                    <h4 style={{ fontSize: '0.9rem', marginBottom: '0.5rem', color: 'var(--text-main)' }}>{t('timetable.dayEvents')}</h4>
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                                        {tasksForSelectedEvent.map(task => (
                                            <EventCard 
                                                key={task.id}
                                                title={task.titulo}
                                                type={task.tipo}
                                                // No mostramos fecha porque ya sabemos que es hoy
                                                // No mostramos asignatura porque ya estamos en el contexto de la asignatura
                                            />
                                        ))}
                                    </div>
                                </div>
                            )}

                            {canPassAttendance(selectedEvent) && (
                                <div style={{ marginTop: 'var(--space-4)', display: 'flex', justifyContent: 'center' }}>
                                    <Button onClick={() => setIsTakingAttendance(true)} style={{ width: '100%' }}>
                                        <CheckSquare size={18} style={{ marginRight: '8px' }} />
                                        {t('timetable.rollCall')}
                                    </Button>
                                </div>
                            )}

                            {(isProfesor || isAdmin) && (
                                <div style={{ marginTop: 'var(--space-3)', display: 'flex', justifyContent: 'center' }}>
                                    <Button
                                        variant="secondary"
                                        onClick={() => setIsRequestingException(true)}
                                        style={{ width: '100%' }}
                                    >
                                        <Shuffle size={18} style={{ marginRight: '8px' }} />
                                        {isAdmin
                                            ? t('exceptions.create', { defaultValue: 'Crear excepción' })
                                            : t('exceptions.requestChange', { defaultValue: 'Solicitar cambio' })}
                                    </Button>
                                </div>
                            )}
                        </div>
                    )
                )}
            </ModalView>
        </div>
    );
};

export default TimeTable;
