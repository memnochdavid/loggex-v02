import React, { useMemo } from 'react';
import styles from './WeekStrip.module.css';
import EventCard from './EventCard';
import { useTranslation } from 'react-i18next';

const WeekStrip = ({ selectedDate, events = [], onEventClick }) => {
    const { t } = useTranslation();

    const weekRange = useMemo(() => {
        const base = selectedDate ? new Date(selectedDate) : new Date();
        const day = base.getDay();
        const diff = base.getDate() - day + (day === 0 ? -6 : 1);
        const monday = new Date(base);
        monday.setDate(diff);
        monday.setHours(0, 0, 0, 0);
        const sunday = new Date(monday);
        sunday.setDate(monday.getDate() + 6);
        sunday.setHours(23, 59, 59, 999);
        return { start: monday, end: sunday };
    }, [selectedDate]);

    const weeklyEvents = useMemo(() => {
        return events
            .filter(e => {
                if (!e.date) return false;
                const ed = new Date(e.date);
                return ed >= weekRange.start && ed <= weekRange.end;
            })
            .sort((a, b) => new Date(a.date) - new Date(b.date));
    }, [events, weekRange]);

    return (
        <section
            className={styles.strip}
            aria-label={t('events.weekTitle')}
        >
            <header className={styles.header}>
                <h3 className={styles.title}>{t('events.weekTitle')}</h3>
                {weeklyEvents.length > 0 && (
                    <span className={styles.count} aria-live="polite">
                        {weeklyEvents.length}
                    </span>
                )}
            </header>

            {weeklyEvents.length === 0 ? (
                <div className={styles.empty}>{t('events.empty')}</div>
            ) : (
                <div className={styles.list}>
                    {weeklyEvents.map((event, i) => (
                        <div
                            key={event.id || i}
                            className={styles.item}
                            style={{ '--i': i }}
                        >
                            <EventCard
                                title={event.title}
                                subject={event.subject}
                                date={event.date}
                                time={event.time}
                                type={event.type}
                                color={event.color}
                                onClick={onEventClick ? () => onEventClick(event) : undefined}
                            />
                        </div>
                    ))}
                </div>
            )}
        </section>
    );
};

export default WeekStrip;
