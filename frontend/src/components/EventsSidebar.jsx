import React, { useMemo } from 'react';
import styles from './EventsSidebar.module.css';
import CalendarView from './CalendarView';
import EventCard from './EventCard';
import { useTranslation } from 'react-i18next';

const EventsSidebar = ({ selectedDate, onDateSelect, events = [], festivos = [], onEventClick }) => {
    const { t } = useTranslation();
    
    // Calcular el rango de la semana seleccionada
    const weekRange = useMemo(() => {
        if (!selectedDate) return null;
        
        const d = new Date(selectedDate);
        const day = d.getDay();
        const diff = d.getDate() - day + (day === 0 ? -6 : 1); // Ajustar al lunes
        
        const monday = new Date(d);
        monday.setDate(diff);
        monday.setHours(0, 0, 0, 0);
        
        const sunday = new Date(monday);
        sunday.setDate(monday.getDate() + 6);
        sunday.setHours(23, 59, 59, 999);
        
        return { start: monday, end: sunday };
    }, [selectedDate]);

    // Filtrar eventos de la semana seleccionada
    const weeklyEvents = useMemo(() => {
        if (!weekRange) return [];

        return events.filter(event => {
            const eventDate = new Date(event.date);
            return eventDate >= weekRange.start && eventDate <= weekRange.end;
        }).sort((a, b) => new Date(a.date) - new Date(b.date));
    }, [events, weekRange]);

    return (
        <div className={styles.container}>
            <CalendarView 
                selectedDate={selectedDate} 
                onDateSelect={onDateSelect}
                festivos={festivos}
            />

            <div className={styles.eventsSection}>
                <h3 className={styles.sectionTitle}>{t('events.weekTitle')}</h3>
                
                <div className={styles.eventsList}>
                    {weeklyEvents.length === 0 ? (
                        <div className={styles.noEvents}>{t('events.empty')}</div>
                    ) : (
                        weeklyEvents.map((event, index) => (
                            <EventCard
                                key={event.id || index}
                                title={event.title}
                                subject={event.subject}
                                date={event.date}
                                time={event.time}
                                type={event.type}
                                color={event.color}
                                onClick={onEventClick ? () => onEventClick(event) : undefined}
                            />
                        ))
                    )}
                </div>
            </div>
        </div>
    );
};

export default EventsSidebar;
