import React, { useState, useMemo } from 'react';
import styles from './TimeTable.module.css';
import { X, Clock, MapPin, Users, User, CalendarOff } from 'lucide-react';

const TimeTable = ({ events, title, selectedDate, festivos = [] }) => {
    const days = ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes'];
    const [selectedEvent, setSelectedEvent] = useState(null);

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
    const hasAfternoon = useMemo(() => events.some(e => parseInt(e.horaInicio.split(':')[0]) >= 15), [events]);
    const hasMorning = useMemo(() => events.some(e => parseInt(e.horaInicio.split(':')[0]) < 15), [events]);

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

    const renderGrid = (slots, gridData, label) => {
        return (
            <div className={styles.tableContainer}>
                <h3 className={styles.tableTitle}>{label}</h3>
                {/* Usar minmax para evitar colapso de columnas */}
                <div className={styles.grid} style={{ gridTemplateColumns: `80px repeat(5, minmax(100px, 1fr))` }}>
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
                                                onClick={() => setSelectedEvent(cellData.event)}
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

    return (
        <div className={styles.container}>
            {hasMorning && renderGrid(morningSlots, morningGrid, 'Turno de Mañana')}
            {hasAfternoon && renderGrid(afternoonSlots, afternoonGrid, 'Turno de Tarde')}
            {!hasMorning && !hasAfternoon && <p className={styles.empty}>No hay clases programadas.</p>}

            {/* Modal de Detalle */}
            {selectedEvent && (
                <div className={styles.modalOverlay} onClick={() => setSelectedEvent(null)}>
                    <div className={styles.modal} onClick={e => e.stopPropagation()}>
                        <div className={styles.modalHeader}>
                            <h3 className={styles.modalTitle}>{selectedEvent.modulo}</h3>
                            <button className={styles.closeButton} onClick={() => setSelectedEvent(null)}>
                                <X size={20} />
                            </button>
                        </div>
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
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default TimeTable;
