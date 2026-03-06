import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { getApiUrl } from '../config/api';
import styles from './UpcomingEventsWidget.module.css';
import { CalendarClock, Sun } from 'lucide-react';

const UpcomingEventsWidget = ({ hideHeader = false, onEventClick }) => {
    const { user } = useAuth();
    const [events, setEvents] = useState([]);
    const [loading, setLoading] = useState(true);
    const [isHoliday, setIsHoliday] = useState(false);

    useEffect(() => {
        if (!user) return;

        const fetchTodayData = async () => {
            setLoading(true);
            try {
                const today = new Date();
                const year = today.getFullYear();
                const month = String(today.getMonth() + 1).padStart(2, '0');
                const day = String(today.getDate()).padStart(2, '0');
                const todayISO = `${year}-${month}-${day}`;
                
                const dayOfWeek = today.getDay(); // 0=Domingo, 1=Lunes...
                const isoDayOfWeek = dayOfWeek === 0 ? 7 : dayOfWeek;

                // 1. Comprobar si hoy es festivo
                const holidayResponse = await fetch(getApiUrl(`/api/festivos?pagination=false`), {
                    headers: { 'Accept': 'application/ld+json' },
                    credentials: 'include'
                });

                let holidayFound = false;
                if (holidayResponse.ok) {
                    const holidayData = await holidayResponse.json();
                    const holidays = holidayData['hydra:member'] || holidayData.member || [];
                    
                    const targetDate = new Date(todayISO);
                    holidayFound = holidays.some(h => {
                        const start = new Date(h.fechaInicio);
                        const end = new Date(h.fechaFin);
                        start.setHours(0,0,0,0);
                        end.setHours(0,0,0,0);
                        targetDate.setHours(0,0,0,0);
                        
                        return targetDate >= start && targetDate <= end;
                    });
                }
                
                setIsHoliday(holidayFound);

                // 2. Obtener el horario del usuario
                // Usamos application/json para coincidir con Horarios.jsx y evitar problemas de formato Hydra
                const scheduleResponse = await fetch(getApiUrl('/api/my-schedule'), {
                    headers: { 'Accept': 'application/json' },
                    credentials: 'include'
                });
                
                if (!scheduleResponse.ok) throw new Error('Error fetching schedule');
                
                const scheduleData = await scheduleResponse.json();
                
                // CORRECCIÓN CRÍTICA: El controlador devuelve un array directo, no un objeto Hydra
                let allSlots = [];
                if (Array.isArray(scheduleData)) {
                    allSlots = scheduleData;
                } else {
                    allSlots = scheduleData['hydra:member'] || scheduleData.member || [];
                }

                // 3. Filtrar por el día de hoy
                const todaySlots = allSlots
                    .filter(slot => parseInt(slot.diaSemana) === isoDayOfWeek)
                    .sort((a, b) => a.horaInicio.localeCompare(b.horaInicio));
                
                setEvents(todaySlots);

            } catch (error) {
                console.error("Error fetching upcoming events:", error);
                setEvents([]);
            } finally {
                setLoading(false);
            }
        };

        fetchTodayData();
    }, [user]);

    const renderContent = () => {
        if (loading) {
            return <p className={styles.loading}>Cargando horario...</p>;
        }
        
        if (isHoliday && events.length === 0) {
            return <p className={styles.empty}>Hoy es festivo. ¡Disfruta del día!</p>;
        }
        
        if (!isHoliday && events.length === 0) {
            return <p className={styles.empty}>No tienes más clases hoy.</p>;
        }

        return (
            <>
                {isHoliday && (
                    <div className={styles.holidayBanner}>
                        <Sun size={16} /> Hoy es festivo
                    </div>
                )}
                <ul className={styles.eventList}>
                    {events.map(event => (
                        <li 
                            key={event.id} 
                            className={styles.eventItem}
                            onClick={() => onEventClick && onEventClick(event)}
                            style={{ cursor: onEventClick ? 'pointer' : 'default' }}
                        >
                            <div className={styles.time}>{event.horaInicio.substring(0, 5)}</div>
                            <div className={styles.details}>
                                <span className={styles.subject}>{event.modulo}</span>
                                <span className={styles.group}>{event.grupo}</span>
                            </div>
                        </li>
                    ))}
                </ul>
            </>
        );
    };

    return (
        <div className={styles.widgetContainer}>
            {!hideHeader && (
                <div className={styles.widgetHeader}>
                    <CalendarClock size={20} className={styles.headerIcon} />
                    <h3 className={styles.widgetTitle}>Horario de Hoy</h3>
                </div>
            )}
            <div className={styles.widgetContent}>
                {renderContent()}
            </div>
        </div>
    );
};

export default UpcomingEventsWidget;
