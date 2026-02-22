import React, { useState, useMemo, useEffect, useCallback } from 'react';
import styles from './TimeTable.module.css';
import { Clock, MapPin, Users, User, CalendarOff, CheckSquare, Save } from 'lucide-react';
import AccordionView from './AccordionView';
import ModalView from './ModalView';
import AsistenciaModal from './AsistenciaModal';
import Button from './Button';
import EventCard from './EventCard'; // Importar EventCard
import { useAuth } from '../context/AuthContext';
import { getApiUrl } from '../config/api'; // Importar getApiUrl

const TimeTable = ({ events = [], title, selectedDate, festivos = [], tareas = [] }) => {
    const { user } = useAuth();
    const isProfesor = user?.roles?.includes('ROLE_PROFESOR');
    const isAdmin = user?.roles?.includes('ROLE_ADMIN') || user?.roles?.includes('ROLE_SUPERADMIN');
    const canTakeAttendance = isProfesor || isAdmin;

    const days = ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes'];
    const [selectedEvent, setSelectedEvent] = useState(null);
    const [isTakingAttendance, setIsTakingAttendance] = useState(false);
    const [savingAttendance, setSavingAttendance] = useState(false);
    
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
    const morningSlots = useMemo(() => [
        { start: '08:30', end: '09:30' },
        { start: '09:30', end: '10:30' },
        { start: '10:30', end: '11:30' },
        { start: '11:30', end: '12:30' },
        { start: '12:30', end: '13:30' },
        { start: '13:30', end: '14:30' }
    ], []);

    const afternoonSlots = useMemo(() => [
        { start: '15:00', end: '16:00' },
        { start: '16:00', end: '17:00' },
        { start: '17:00', end: '18:00' },
        { start: '18:00', end: '19:00' },
        { start: '19:00', end: '20:00' },
        { start: '20:00', end: '21:00' }
    ], []);

    // Detectar turnos
    const hasAfternoon = useMemo(() => Array.isArray(events) && events.some(e => parseInt(e.horaInicio.split(':')[0]) >= 15), [events]);
    const hasMorning = useMemo(() => Array.isArray(events) && events.some(e => parseInt(e.horaInicio.split(':')[0]) < 15), [events]);

    // Función para procesar eventos y calcular rowSpan (pura, sin hooks)
    const processEvents = (slots) => {
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

        // 2. Colocar eventos en la matriz (solo si no es festivo)
        if (Array.isArray(events)) {
            slots.forEach((slot, hIndex) => {
                days.forEach((day, dIndex) => {
                    if (grid[hIndex][dIndex]) return;

                    const event = events.find(e =>
                        e.diaSemana === (dIndex + 1) &&
                        e.horaInicio === slot.start
                    );
                    if (event) {
                        grid[hIndex][dIndex] = { event, rowSpan: 1, skip: false };
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
                            next.event.modulo === current.event.modulo &&
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
        setAsistenciaData(null); // Limpiar datos al cerrar
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
                    <div className={styles.headerCell}>Hora</div>
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

                    {/* Filas Horas */}
                    {slots.map((slot, hIndex) => (
                        <React.Fragment key={hIndex}>
                            <div className={styles.timeCell}>
                                {slot.start} - {slot.end}
                            </div>
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
                                            style={{ gridRow: `span ${cellData.rowSpan}` }}
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
                                        style={{ gridRow: cellData && cellData.rowSpan > 1 ? `span ${cellData.rowSpan}` : 'auto' }}
                                    >
                                        {cellData && (
                                            <div
                                                className={styles.eventCard}
                                                onClick={() => handleEventClick(cellData.event)}
                                                title="Ver detalles"
                                            >
                                                <div className={styles.eventModulo}>{cellData.event.modulo}</div>
                                                <div className={styles.eventGroupSmall}>
                                                    {cellData.event.grupoAbreviatura && cellData.event.grupoAbreviatura.trim() !== ''
                                                        ? cellData.event.grupoAbreviatura
                                                        : cellData.event.grupo}
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                );
                            })}
                        </React.Fragment>
                    ))}
                </div>
            </div>
        );
    };

    // Preparar datos para AccordionView (Escritorio)
    const shiftsData = [];
    if (hasMorning) {
        shiftsData.push({
            id: 'morning',
            title: 'Turno de Mañana',
            slots: morningSlots,
            grid: morningGrid
        });
    }
    if (hasAfternoon) {
        shiftsData.push({
            id: 'afternoon',
            title: 'Turno de Tarde',
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

        const dateStr = date ? date.toLocaleDateString(undefined, {day: '2-digit', month: '2-digit'}) : '';

        return {
            id: dayIndex,
            title: `${dayName} ${dateStr}`, // Título con fecha
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
                            {event.modulo}
                        </div>
                        <div className={styles.mobileEventSubtitle}>
                            {event.grupo} • {event.aula}
                        </div>
                    </div>
                ))
            ) : (
                <div className={styles.empty} style={{ padding: '1rem' }}>
                    No hay clases
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
            } else {
                alert("Error al guardar asistencia");
            }
        } catch (error) {
            console.error(error);
            alert("Error de conexión");
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
                {shiftsData.length > 0 ? (
                    <AccordionView 
                        data={shiftsData}
                        renderItem={(item) => renderGrid(item.slots, item.grid)}
                        canAdd={false}
                        expandedId={activeShift}
                        onToggle={(id) => setActiveShift(activeShift === id ? null : id)}
                    />
                ) : (
                    <p className={styles.empty}>No hay clases programadas.</p>
                )}
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
                title={selectedEvent ? (isTakingAttendance ? `Pasar Lista: ${selectedEvent.modulo}` : selectedEvent.modulo) : ''}
                size={isTakingAttendance ? "large" : "small"}
                cancelText={isTakingAttendance ? "Cancelar" : "Cerrar"}
                // Footer personalizado para el modo de asistencia
                footer={isTakingAttendance ? (
                    <>
                        <Button variant="secondary" onClick={handleCloseModal}>Cancelar</Button>
                        <Button onClick={handleSaveAttendance} disabled={savingAttendance}>
                            <Save size={18} style={{ marginRight: '8px' }} />
                            {savingAttendance ? 'Guardando...' : 'Guardar'}
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
                    ) : (
                        <div className={styles.modalBody}>
                            <div className={styles.detailRow}>
                                <Clock size={18} className={styles.icon} />
                                <div>
                                    <span className={styles.label}>Horario:</span>
                                    <span className={styles.value}>
                                        {days[selectedEvent.diaSemana - 1]}, {selectedEvent.horaInicio} - {selectedEvent.horaFin}
                                    </span>
                                </div>
                            </div>
                            <div className={styles.detailRow}>
                                <Users size={18} className={styles.icon} />
                                <div>
                                    <span className={styles.label}>Grupo:</span>
                                    <span className={styles.value}>{selectedEvent.grupo}</span>
                                    {selectedEvent.grupoAbreviatura && (
                                        <span className={styles.subValue}> ({selectedEvent.grupoAbreviatura})</span>
                                    )}
                                </div>
                            </div>
                            <div className={styles.detailRow}>
                                <MapPin size={18} className={styles.icon} />
                                <div>
                                    <span className={styles.label}>Aula:</span>
                                    <span className={styles.value}>{selectedEvent.aula}</span>
                                </div>
                            </div>
                            <div className={styles.detailRow}>
                                <User size={18} className={styles.icon} />
                                <div>
                                    <span className={styles.label}>Profesor:</span>
                                    <span className={styles.value}>{selectedEvent.profesor}</span>
                                </div>
                            </div>

                            {/* Mostrar Tareas/Eventos del día */}
                            {tasksForSelectedEvent.length > 0 && (
                                <div style={{ marginTop: '1rem', borderTop: '1px solid var(--border-color)', paddingTop: '1rem' }}>
                                    <h4 style={{ fontSize: '0.9rem', marginBottom: '0.5rem', color: 'var(--text-main)' }}>Eventos del día:</h4>
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
                                <div style={{ marginTop: '1.5rem', display: 'flex', justifyContent: 'center' }}>
                                    <Button onClick={() => setIsTakingAttendance(true)} style={{ width: '100%' }}>
                                        <CheckSquare size={18} style={{ marginRight: '8px' }} />
                                        Pasar Lista
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
