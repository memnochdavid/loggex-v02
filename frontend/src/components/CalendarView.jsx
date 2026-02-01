import React, { useState } from 'react';
import styles from './CalendarView.module.css';
import { ChevronLeft, ChevronRight } from 'lucide-react';

const CalendarView = ({ selectedDate, onDateSelect }) => {
    const [currentDate, setCurrentDate] = useState(new Date());

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
        setCurrentDate(new Date(year, month - 1, 1));
    };

    const handleNextMonth = () => {
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

    const monthNames = [
        'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
        'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'
    ];

    const weekDays = ['L', 'M', 'X', 'J', 'V', 'S', 'D'];

    const renderDays = () => {
        const days = [];
        
        // Días vacíos antes del primer día del mes
        for (let i = 0; i < firstDay; i++) {
            days.push(<div key={`empty-${i}`} className={styles.emptyDay}></div>);
        }

        // Días del mes
        for (let day = 1; day <= daysInMonth; day++) {
            const selected = isSelected(day);
            const today = isToday(day);
            
            days.push(
                <button
                    key={day}
                    className={`${styles.day} ${selected ? styles.selected : ''} ${today ? styles.today : ''}`}
                    onClick={() => handleDayClick(day)}
                >
                    {day}
                </button>
            );
        }

        return days;
    };

    return (
        <div className={styles.calendar}>
            <div className={styles.header}>
                <button className={styles.navButton} onClick={handlePrevMonth}>
                    <ChevronLeft size={20} />
                </button>
                <span className={styles.monthTitle}>
                    {monthNames[month]} {year}
                </span>
                <button className={styles.navButton} onClick={handleNextMonth}>
                    <ChevronRight size={20} />
                </button>
            </div>
            <div className={styles.weekDays}>
                {weekDays.map(day => (
                    <div key={day} className={styles.weekDay}>{day}</div>
                ))}
            </div>
            <div className={styles.daysGrid}>
                {renderDays()}
            </div>
        </div>
    );
};

export default CalendarView;
