import React from 'react';
import styles from './EventCard.module.css';
import { Calendar, Clock, BookOpen } from 'lucide-react';

const EventCard = ({ 
    title, 
    subject, 
    date, 
    time, 
    type, 
    color = 'var(--color-primary-500)', 
    onClick 
}) => {
    
    const formattedDate = date ? new Date(date).toLocaleDateString(undefined, { weekday: 'short', day: 'numeric', month: 'short' }) : '';

    return (
        <div 
            className={styles.card} 
            style={{ borderLeftColor: color }}
            onClick={onClick}
        >
            <div className={styles.headerRow}>
                <div className={styles.title}>{title}</div>
                {type && (
                    <div className={styles.typeBadge}>
                        {type}
                    </div>
                )}
            </div>
            
            <div className={styles.metaRow}>
                {subject && (
                    <div className={styles.subject} title={subject}>
                        <BookOpen size={14} />
                        {subject}
                    </div>
                )}

                <div className={styles.dateInfo}>
                    {date && (
                        <>
                            <Calendar size={14} />
                            {formattedDate}
                        </>
                    )}
                    {time && (
                        <>
                            <Clock size={14} style={{ marginLeft: date ? '8px' : '0' }} />
                            {time}
                        </>
                    )}
                </div>
            </div>
        </div>
    );
};

export default EventCard;
