import React from 'react';
import styles from './EventsSidebar.module.css';
import CalendarView from './CalendarView';
import { Calendar, Clock, AlertCircle } from 'lucide-react';

const EventsSidebar = ({ selectedDate, onDateSelect, events = [], festivos = [] }) => {
    
    // Filtrar eventos próximos (desde hoy o desde la fecha seleccionada)
    // Por ahora mostramos todos los que se pasen, ordenados por fecha
    const sortedEvents = [...events].sort((a, b) => new Date(a.date) - new Date(b.date));

    return (
        <div className={styles.container}>
            <CalendarView 
                selectedDate={selectedDate} 
                onDateSelect={onDateSelect}
                festivos={festivos}
            />

            <div className={styles.eventsSection}>
                <h3 className={styles.sectionTitle}>Próximos Eventos</h3>
                
                <div className={styles.eventsList}>
                    {sortedEvents.length === 0 ? (
                        <div className={styles.noEvents}>No hay eventos próximos.</div>
                    ) : (
                        sortedEvents.map((event, index) => (
                            <div key={event.id || index} className={styles.eventCard} style={{ borderLeftColor: event.color || 'var(--color-primary-500)' }}>
                                <div className={styles.eventTitle}>{event.title}</div>
                                <div className={styles.eventMeta}>
                                    <Calendar size={14} />
                                    {new Date(event.date).toLocaleDateString()} 
                                    {event.time && (
                                        <>
                                            <Clock size={14} style={{ marginLeft: '8px' }} />
                                            {event.time}
                                        </>
                                    )}
                                </div>
                                {event.type && (
                                    <div className={styles.eventMeta} style={{ marginTop: '4px', textTransform: 'uppercase', fontSize: '0.7rem', fontWeight: 'bold' }}>
                                        {event.type}
                                    </div>
                                )}
                            </div>
                        ))
                    )}
                </div>
            </div>
        </div>
    );
};

export default EventsSidebar;
