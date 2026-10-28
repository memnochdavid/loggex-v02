import React, { useState } from 'react';
import styles from './CalendarView.module.css';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { useTranslation } from 'react-i18next';

const CalendarView = ({ selectedDate, onDateSelect, festivos = [] }) => {
    const { t } = useTranslation();
    const [currentDate, setCurrentDate] = useState(new Date());
    const [direction, setDirection] = useState(0); // -1 prev, +1 next, 0 initial

    const getDaysInMonth = (year, month) => new Date(year, month + 1, 0).getDate();
    const getFirstDayOfMonth = (year, month) => {
        const day = new Date(year, month, 1).getDay();
        return day === 0 ? 6 : day - 1; // Ajustar para que Lunes sea 0
    };

    const year = currentDate.getFullYear();
    const month = currentDate.getMonth();

    const daysInMonth = getDaysInMonth(year, month);
    const firstDay = getFirstDayOfMonth(year, month);

    const handlePrevMonth = () => {
        setDirection(-1);
        setCurrentDate(new Date(year, month - 1, 1));
    };

    const handleNextMonth = () => {
        setDirection(1);
        setCurrentDate(new Date(year, month + 1, 1));
    };

    const handleDayClick = (day) => {
        const newDate = new Date(year, month, day);
        onDateSelect(newDate);
    };

    const isSelected = (day) => {
        if (!selectedDate) return false;
        return (
            selectedDate.getDate() === day &&
            selectedDate.getMonth() === month &&
            selectedDate.getFullYear() === year
        );
    };

    const isToday = (day) => {
        const today = new Date();
        return (
            today.getDate() === day &&
            today.getMonth() === month &&
            today.getFullYear() === year
        );
    };

    const isFestivo = (day) => {
        if (!festivos || festivos.length === 0) return false;
        
        // Crear fecha actual del bucle (mediodía para evitar problemas de zona horaria)
        const currentDayDate = new Date(year, month, day, 12, 0, 0);
        
        return festivos.some(f => {
            const inicio = new Date(f.fechaInicio);
            // Ajustar horas para comparar solo fechas
            inicio.setHours(12, 0, 0, 0);
            
            if (f.fechaFin) {
                const fin = new Date(f.fechaFin);
                fin.setHours(12, 0, 0, 0);
                return currentDayDate >= inicio && currentDayDate <= fin;
            }
            
            return currentDayDate.getTime() === inicio.getTime();
        });
    };

    const monthNames = [
        t('months.january'), t('months.february'), t('months.march'), t('months.april'), t('months.may'), t('months.june'),
        t('months.july'), t('months.august'), t('months.september'), t('months.october'), t('months.november'), t('months.december')
    ];

    const weekDays = [
        t('days.shortMon'), t('days.shortTue'), t('days.shortWed'), t('days.shortThu'), t('days.shortFri'), t('days.shortSat'), t('days.shortSun')
    ];

    const renderDays = () => {
        const days = [];

        for (let i = 0; i < firstDay; i++) {
            days.push(<div key={`empty-${i}`} className={styles.emptyDay} />);
        }

        for (let day = 1; day <= daysInMonth; day++) {
            const selected = isSelected(day);
            const today = isToday(day);
            const festivo = isFestivo(day);
            const cellIndex = firstDay + day - 1;

            days.push(
                <button
                    key={day}
                    className={`
                        ${styles.day}
                        ${selected ? styles.selected : ''}
                        ${today ? styles.today : ''}
                        ${festivo ? styles.festivo : ''}
                    `}
                    style={{ '--i': cellIndex }}
                    onClick={() => handleDayClick(day)}
                    aria-label={`${day} ${monthNames[month]} ${year}`}
                    aria-pressed={selected}
                    title={festivo ? t('calendar.holiday') : ''}
                >
                    {day}
                </button>
            );
        }

        return days;
    };

    const gridDirectionClass =
        direction > 0 ? styles.slideFromRight :
        direction < 0 ? styles.slideFromLeft : '';

    return (
        <div className={styles.calendar}>
            <div className={styles.header}>
                <button
                    className={styles.navButton}
                    onClick={handlePrevMonth}
                    aria-label={t('calendar.prevMonth', 'Mes anterior')}
                    type="button"
                >
                    <ChevronLeft size={20} aria-hidden="true" />
                </button>
                <span
                    key={`${year}-${month}`}
                    className={styles.monthTitle}
                    aria-live="polite"
                >
                    {monthNames[month]} {year}
                </span>
                <button
                    className={styles.navButton}
                    onClick={handleNextMonth}
                    aria-label={t('calendar.nextMonth', 'Mes siguiente')}
                    type="button"
                >
                    <ChevronRight size={20} aria-hidden="true" />
                </button>
            </div>
            <div className={styles.weekDays}>
                {weekDays.map(day => (
                    <div key={day} className={styles.weekDay}>{day}</div>
                ))}
            </div>
            <div
                key={`${year}-${month}`}
                className={`${styles.daysGrid} ${gridDirectionClass}`}
            >
                {renderDays()}
            </div>
        </div>
    );
};

export default CalendarView;
