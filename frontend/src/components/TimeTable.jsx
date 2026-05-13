import React, { useState, useMemo, useEffect, useCallback } from 'react';
import styles from './TimeTable.module.css';
import calStyles from '../pages/Calificaciones.module.css';
import crudStyles from '../pages/Crud.module.css';
import { Clock, MapPin, Users, User, CalendarOff, CheckSquare, Save, Shuffle, X } from 'lucide-react';
import AccordionView from './AccordionView';
import ModalView from './ModalView';
import AsistenciaModal from './AsistenciaModal';
import AsyncSearchSelect from './AsyncSearchSelect';
import HorarioGridPicker from './HorarioGridPicker';
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

// Fase E clases-compartidas (2026-05-13): formato unificado del grupo en la
// card y modal. Si el event llega del backend con `gruposCompartidos.length > 1`
// (profe que imparte la misma clase en grupos gemelos LOMLOE, ej. 1º DAW + 1º DAM)
// renderiza "1º DAW + 1º DAM". Si no, mantiene el formato singular previo.
const formatGruposLabel = (event) => {
    const arr = Array.isArray(event?.gruposCompartidos) ? event.gruposCompartidos : null;
    if (arr && arr.length > 1) {
        return arr.map(g => {
            const curso = g.curso ? `${g.curso}º` : '';
            const abrev = (g.abreviatura && String(g.abreviatura).trim() !== '') ? g.abreviatura : g.nombre;
            return [curso, abrev].filter(Boolean).join(' ');
        }).join(' + ');
    }
    return [
        event?.grupoCurso ? `${event.grupoCurso}º` : null,
        (event?.grupoAbreviatura && event.grupoAbreviatura.trim() !== '')
            ? event.grupoAbreviatura
            : event?.grupo,
    ].filter(Boolean).join(' ');
};

// Fusiona events contiguos del mismo bloque lógico (misma imparticion+aula+PL,
// mismo día, horaFin del anterior === horaInicio del siguiente). Razón:
// `/admin/horarios` puede persistir un placement como N mini-Horarios de 30 min
// en lugar de UN bloque grande (caso real EAG 1º DAW: "Entornos de desarrollo"
// y "DIG" son 3×30min, mientras que "Programación" es 1×90min). Sin esta
// fusión, tras el merge de slots a macro-tramos, solo el primer mini matchea
// `horaInicio === slot.start` y `processEvents` se queda con un evento de
// 13:00-13:30 dentro de un macro de 13:00-14:30 — el modal pinta el rango
// truncado aunque la card visual ocupe toda la franja. La fusión devuelve
// un único evento con `horaFin` extendida al final del último mini.
// Los sintéticos de excepción (`_overrideAssigned`) NO se fusionan: cada uno
// es una fecha puntual con su propio `_overrideExcepcionId`.
const mergeContiguousEvents = (events) => {
    if (!Array.isArray(events) || events.length === 0) return events;
    const sinteticos = [];
    const regulares = [];
    for (const e of events) {
        if (!e) continue;
        if (e._overrideAssigned) sinteticos.push(e);
        else regulares.push(e);
    }
    // Clave estable que define "es la misma clase":
    //   diaSemana + imparticion + aula + PL.
    // (Si imparticionId falta, fallback a moduloId para defenderse de events
    // mal formados, aunque en la práctica `imparticionId` siempre viene.)
    const byKey = new Map();
    for (const e of regulares) {
        const key = [
            e.diaSemana,
            e.imparticionId ?? e.moduloId ?? '',
            e.aula ?? '',
            e.periodoLectivoId ?? '',
        ].join('|');
        if (!byKey.has(key)) byKey.set(key, []);
        byKey.get(key).push(e);
    }
    const out = [...sinteticos];
    for (const group of byKey.values()) {
        group.sort((a, b) => String(a.horaInicio).localeCompare(String(b.horaInicio)));
        let buf = null;
        for (const e of group) {
            if (!buf) { buf = { ...e }; continue; }
            if (buf.horaFin === e.horaInicio) {
                buf.horaFin = e.horaFin;
            } else {
                out.push(buf);
                buf = { ...e };
            }
        }
        if (buf) out.push(buf);
    }
    return out;
};

// Fusiona slots SLOT contiguos en macro-slots. Mantiene los RECREO como
// separadores. Razón: `GetMyScheduleController::collectSlots` acumula slots
// de TODAS las jornadas tocadas por los horarios del user (mañana + tarde,
// varios grupos), dedup solo por "HH:MM-HH:MM". Si el profe imparte en
// grupos con jornadas de granularidad distinta (30 min vs 60 min), el set
// resultante tiene slots mezclados y el grid pinta líneas internas
// "fantasma" entre cada slot (capturas 2026-05-13: el tramo 08:30-10:30
// aparecía subdividido en 4 sub-filas en la vista profe). Aquí los
// colapsamos en macros como los que ve el alumno: 1 fila por tramo entre
// recreos. No afecta a backend, solver, capacity, ni al PDF.
// Edge case conocido: un evento que empiece en medio del macro (ej. 9:00
// dentro de macro 8:30-10:30) no encontrará slot exacto en `processEvents`
// y no se renderizará. En este proyecto los bloques son 60-120 min con
// `horaInicio` alineado al inicio del tramo, así que el caso no se da en
// la práctica.
const mergeContiguousSlots = (slots) => {
    if (!Array.isArray(slots) || slots.length === 0) return slots;
    const out = [];
    let buf = null;
    for (const s of slots) {
        if (!s) continue;
        if (s.tipo === 'recreo') {
            if (buf) { out.push(buf); buf = null; }
            out.push(s);
            continue;
        }
        // SLOT (default)
        if (!buf) {
            buf = { ...s };
        } else if (s.start === buf.end) {
            buf.end = s.end;
            // Etiqueta del macro queda neutra (puede contener varias).
            buf.etiqueta = null;
        } else {
            out.push(buf);
            buf = { ...s };
        }
    }
    if (buf) out.push(buf);
    return out;
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

const TimeTable = ({
    events = [],
    slots = null,
    title,
    selectedDate,
    festivos = [],
    tareas = [],
    autoOpenExcepcionId = null,
    onAutoOpenConsumed,
}) => {
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
    const [rejectingExcepcion, setRejectingExcepcion] = useState(false);
    const [excForm, setExcForm] = useState({
        tipo: 'sustitucion',
        profeOverride: '',
        motivo: '',
        observaciones: '',
        // Intercambio (Plan B 2026-05-08): array de bloques B que cubren
        // colectivamente al bloque A. Σ duración B == duración A.
        parejasB: [],
    });
    
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

    // Events fusionados para la rejilla y el modal (2026-05-13): junta los
    // mini-Horarios contiguos persistidos como 3×30min en BD (caso real EAG
    // DIG / Entornos de desarrollo). Sin esto, tras el merge de slots, solo
    // el primer mini matchea `slot.start` y el modal muestra el rango truncado.
    // `hasMorning/hasAfternoon` siguen usando `events` raw porque solo
    // necesitan detectar la presencia del turno, no el detalle.
    const mergedEvents = useMemo(() => mergeContiguousEvents(events), [events]);

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
        // Usamos `mergedEvents` (no `events` raw) para juntar mini-Horarios
        // contiguos persistidos como 3×30min en BD.
        if (Array.isArray(mergedEvents)) {
            slots.forEach((slot, hIndex) => {
                days.forEach((day, dIndex) => {
                    if (grid[hIndex][dIndex]) return;

                    const event = mergedEvents.find(e =>
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

    // Slots fusionados: macros entre recreos. Ver `mergeContiguousSlots`
    // arriba del archivo para la razón (2026-05-13).
    const morningSlotsMerged = useMemo(() => mergeContiguousSlots(morningSlots), [morningSlots]);
    const afternoonSlotsMerged = useMemo(() => mergeContiguousSlots(afternoonSlots), [afternoonSlots]);

    // Pre-calcular grids
    const morningGrid = useMemo(() => processEvents(morningSlotsMerged), [mergedEvents, morningSlotsMerged, weekDates, festivos]);
    const afternoonGrid = useMemo(() => processEvents(afternoonSlotsMerged), [mergedEvents, afternoonSlotsMerged, weekDates, festivos]);

    const handleEventClick = (event) => {
        setSelectedEvent(event);
        setIsTakingAttendance(false);
    };

    // Auto-open del modal de un placement sintético cuando llegamos vía
    // notificación con `?excepcion=ID` en la URL. Topic 1 (2026-05-07):
    // permite que el destinatario llegue del aviso y vea inmediatamente
    // el botón "Rechazar este cambio" sin tener que buscar el bloque.
    useEffect(() => {
        if (!autoOpenExcepcionId) return;
        if (!Array.isArray(events) || events.length === 0) return;
        const target = events.find((e) =>
            String(e?._overrideExcepcionId) === String(autoOpenExcepcionId)
        );
        if (!target) return;
        setSelectedEvent(target);
        setIsTakingAttendance(false);
        if (onAutoOpenConsumed) onAutoOpenConsumed();
    }, [autoOpenExcepcionId, events, onAutoOpenConsumed]);

    const handleCloseModal = () => {
        setSelectedEvent(null);
        setIsTakingAttendance(false);
        setIsRequestingException(false);
        setExcForm({ tipo: 'sustitucion', profeOverride: '', motivo: '', observaciones: '', parejasB: [] });
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

    const handleRejectExcepcion = async () => {
        if (!selectedEvent) return;
        const excId = selectedEvent._overrideExcepcionId || selectedEvent._excepcion?.excepcionId;
        if (!excId) return;
        setRejectingExcepcion(true);
        try {
            const response = await fetch(getApiUrl(`/api/v1/excepciones/${excId}/rechazar`), {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
                body: JSON.stringify({}),
                credentials: 'include',
            });
            if (!response.ok) {
                const message = await parseErrorResponse(response);
                throw new Error(message);
            }
            toast.success(t('exceptions.rejectedByDestinatario', { defaultValue: 'Has rechazado la incidencia' }), {
                description: t('exceptions.rejectedByDestinatarioDesc', { defaultValue: 'El solicitante recibirá la notificación.' }),
            });
            handleCloseModal();
        } catch (err) {
            console.error('Error rechazando incidencia:', err);
            toast.error(err.message);
        } finally {
            setRejectingExcepcion(false);
        }
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
        if (excForm.tipo === 'intercambio' && (!Array.isArray(excForm.parejasB) || excForm.parejasB.length === 0)) {
            toast.error(t('exceptions.errorRequired', { defaultValue: 'Selecciona los bloques que cubres del otro profesor' }));
            return;
        }

        setSavingExcepcion(true);

        try {
            let response;
            if (excForm.tipo === 'intercambio') {
                // Endpoint dedicado: crea las N+1 caras linked atómicamente
                // por intercambio_grupo_id (Plan B 2026-05-08).
                response = await fetch(getApiUrl('/api/v1/excepciones/intercambio'), {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
                    body: JSON.stringify({
                        horarioBaseA:   `/api/horarios/${selectedEvent.id}`,
                        fechaConcretaA: fecha,
                        parejasB: excForm.parejasB.map(s => ({
                            horarioBaseB:   `/api/horarios/${String(s.horarioId).split('/').pop()}`,
                            fechaConcretaB: s.fechaConcreta,
                        })),
                        motivo:         excForm.motivo || null,
                        observaciones:  excForm.observaciones || null,
                    }),
                    credentials: 'include',
                });
            } else {
                const payload = {
                    horarioBase: `/api/horarios/${selectedEvent.id}`,
                    fechaConcreta: fecha,
                    tipo: excForm.tipo,
                    motivo: excForm.motivo || null,
                    observaciones: excForm.observaciones || null,
                };
                if ((excForm.tipo === 'sustitucion' || excForm.tipo === 'evento_especial') && excForm.profeOverride) {
                    payload.profeOverride = `/api/users/${String(excForm.profeOverride).split('/').pop()}`;
                }
                response = await fetch(getApiUrl('/api/excepcion_horarios'), {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/ld+json', Accept: 'application/ld+json' },
                    body: JSON.stringify(payload),
                    credentials: 'include',
                });
            }
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
                            // Altura proporcional acotada (Fase B fix 2026-05-12,
                            // recalibrada 2026-05-13 a 2/3 del factor original
                            // para reducir espacio vertical desperdiciado en la
                            // rejilla tras la fusión de slots contiguos):
                            //   - SLOT normal: factor 1.0px/min (era 1.5),
                            //     cap 160px (era 240), min 32px (era 48).
                            //   - RECREO: factor 0.8px/min (era 1.2),
                            //     cap 54px (era 80), min 14px (era 20).
                            const slotMinH = slot.tipo === 'recreo'
                                ? `${Math.max(14, Math.min(Math.round(dMin * 0.8), 54))}px`
                                : `${Math.max(32, Math.min(Math.round(dMin * 1.0), 160))}px`;

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
                                                    asignada_pendiente: 'Cambio solicitado · pulsa para rechazarlo (si no haces nada queda pendiente del admin)',
                                                    titular_pendiente: 'Cambio solicitado sobre tu clase · esperando aprobación del admin',
                                                  }[exc.tipo] || 'Excepción'}${exc.motivo ? ` — ${exc.motivo}` : ''}`
                                                : t('timetable.viewDetails');
                                            const overrideName = exc?.profeOverride?.nombre
                                                || exc?.imparticionEfectiva?.profesor
                                                || null;
                                            return (
                                                <div
                                                    className={`${styles.eventCard}${exc ? ' ' + (styles.eventCardException || '') : ''}${cancelado ? ' ' + (styles.eventCardCancelled || '') : ''}${(exc?.tipo === 'asignada_pendiente' || exc?.tipo === 'titular_pendiente') ? ' ' + (styles.eventCardPending || '') : ''}`}
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
                                                        {formatGruposLabel(cellData.event)}
                                                    </div>
                                                    {exc && (
                                                        <div className={styles.eventExceptionTag}>
                                                            {cancelado
                                                                ? '✕ Cancelada'
                                                                : exc.tipo === 'asignada'
                                                                    ? '✦ Cubres'
                                                                    : (exc.tipo === 'asignada_pendiente' || exc.tipo === 'titular_pendiente')
                                                                        ? '⏳ Cambio solicitado'
                                                                        : exc.tipo === 'sustitucion' && overrideName
                                                                            ? `↔ ${overrideName}`
                                                                            : exc.tipo === 'intercambio' && overrideName
                                                                                ? `⇄ ${overrideName}`
                                                                                : exc.tipo === 'evento_especial'
                                                                                    ? '★ Evento'
                                                                                    : '● Excepción'}
                                                        </div>
                                                    )}
                                                    {cellData.event._overrideAssigned && cellData.event._overrideTitularNombre && (() => {
                                                        const baseAbrev = cellData.event._overrideMateriaBaseAbrev || cellData.event._overrideMateriaBase;
                                                        const myAbrev = cellData.event.moduloAbreviatura || cellData.event.materia;
                                                        const cambioMateria = baseAbrev && myAbrev && baseAbrev !== myAbrev;
                                                        return (
                                                            <div className={styles.eventOverrideMeta}>
                                                                Cubres a {cellData.event._overrideTitularNombre}
                                                                {cambioMateria && (
                                                                    <span className={styles.eventOverrideSwap}> · {baseAbrev}→{myAbrev}</span>
                                                                )}
                                                            </div>
                                                        );
                                                    })()}
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
            slots: morningSlotsMerged,
            grid: morningGrid
        });
    }
    if (hasAfternoon) {
        shiftsData.push({
            id: 'afternoon',
            title: t('timetable.afternoonShift'),
            slots: afternoonSlotsMerged,
            grid: afternoonGrid
        });
    }

    // Preparar datos para AccordionView (Móvil)
    const daysData = days.map((dayName, index) => {
        const dayIndex = index + 1;
        const date = weekDates[index];
        const festivo = getFestivoForDay(date);

        const dayEvents = Array.isArray(mergedEvents)
            ? mergedEvents
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
                            {formatGruposLabel(event)} • {event.aula}
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
                    comentario: a.comentario,
                    // Fase E clases-compartidas: alumnos de grupos gemelos
                    // traen su `imparticionId` natural (la de SU grupo). El
                    // backend usa éste si difiere del global para que la
                    // Asistencia se registre contra la imp correcta.
                    ...(a.imparticionId ? { imparticionId: a.imparticionId } : {}),
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
                size={(isTakingAttendance || (isRequestingException && excForm.tipo === 'intercambio')) ? "large" : "small"}
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
                                    <option value="intercambio">{t('exceptions.types.intercambio', { defaultValue: 'Intercambio' })}</option>
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
                                        // Incluye admins que también imparten (p.ej. sara@eag).
                                        extraParams={{ rol_app: ['profesor', 'admin'] }}
                                        getOptionLabel={(u) => [u.nombre, u.apellidos].filter(Boolean).join(' ').trim() || u.email || '—'}
                                        getOptionValue={(u) => u.id || u['@id']?.split('/').pop()}
                                        placeholder={t('exceptions.searchUser', { defaultValue: 'Buscar profesor…' })}
                                        required={excForm.tipo === 'sustitucion'}
                                    />
                                </div>
                            )}
                            {excForm.tipo === 'intercambio' && (() => {
                                // Duración del bloque A (clase del placement clicado)
                                // que tienen que cubrir las parejasB sumando minutos.
                                const [hH, hM] = (selectedEvent.horaInicio || '').split(':').map(Number);
                                const [fH, fM] = (selectedEvent.horaFin || '').split(':').map(Number);
                                const durA = (fH * 60 + fM) - (hH * 60 + hM);
                                return (
                                    <div className={crudStyles.formGroup}>
                                        <label className={crudStyles.label}>
                                            {t('exceptions.horarioBaseB', { defaultValue: 'Bloque(s) del otro profe que cubrirás' })}
                                        </label>
                                        <HorarioGridPicker
                                            selections={excForm.parejasB}
                                            onChange={(newSelections) => setExcForm(p => ({
                                                ...p,
                                                parejasB: newSelections,
                                            }))}
                                            weekAnchor={selectedDate}
                                            targetMinutes={durA}
                                            excludeProfesorId={user?.id}
                                        />
                                    </div>
                                );
                            })()}
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
                                    <span className={styles.label}>
                                        {Array.isArray(selectedEvent.gruposCompartidos) && selectedEvent.gruposCompartidos.length > 1
                                            ? t('timetable.groupsLabel', { defaultValue: 'Grupos' })
                                            : t('timetable.groupLabel')}
                                    </span>
                                    {Array.isArray(selectedEvent.gruposCompartidos) && selectedEvent.gruposCompartidos.length > 1 ? (
                                        <span className={styles.value}>
                                            {selectedEvent.gruposCompartidos.map(g => {
                                                const curso = g.curso ? `${g.curso}º ` : '';
                                                const abrev = (g.abreviatura && String(g.abreviatura).trim() !== '')
                                                    ? ` (${g.abreviatura})` : '';
                                                return `${curso}${g.nombre}${abrev}`;
                                            }).join(' + ')}
                                        </span>
                                    ) : (
                                        <>
                                            <span className={styles.value}>
                                                {selectedEvent.grupoCurso ? `${selectedEvent.grupoCurso}º ` : ''}{selectedEvent.grupo}
                                            </span>
                                            {selectedEvent.grupoAbreviatura && (
                                                <span className={styles.subValue}> ({selectedEvent.grupoAbreviatura})</span>
                                            )}
                                        </>
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

                            {selectedEvent._overrideAssigned && selectedEvent._overrideTitularNombre && (
                                <div className={styles.detailRow}>
                                    <Shuffle size={18} className={styles.icon} />
                                    <div>
                                        <span className={styles.label}>
                                            {t('exceptions.coveringFor', { defaultValue: 'Cubres a' })}
                                        </span>
                                        <span className={styles.value}>{selectedEvent._overrideTitularNombre}</span>
                                        {selectedEvent._overrideMateriaBase
                                            && selectedEvent._overrideMateriaBase !== selectedEvent.materia && (
                                            <span className={styles.subValue}>
                                                {' '}({t('exceptions.insteadOf', { defaultValue: 'en lugar de' })} {selectedEvent._overrideMateriaBase})
                                            </span>
                                        )}
                                    </div>
                                </div>
                            )}

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

                            {selectedEvent._overrideCanReject && (
                                <div style={{ marginTop: 'var(--space-3)', display: 'flex', justifyContent: 'center' }}>
                                    <Button
                                        variant="danger"
                                        onClick={handleRejectExcepcion}
                                        disabled={rejectingExcepcion}
                                        style={{ width: '100%' }}
                                    >
                                        <X size={18} style={{ marginRight: '8px' }} />
                                        {rejectingExcepcion
                                            ? t('common.saving', { defaultValue: 'Guardando…' })
                                            : t('exceptions.rejectChange', { defaultValue: 'Rechazar este cambio' })}
                                    </Button>
                                </div>
                            )}

                            {(isProfesor || isAdmin) && !selectedEvent._overrideAssigned && (
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
