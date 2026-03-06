import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { getApiUrl } from '../config/api';
import { useNavigate } from 'react-router-dom';
import styles from './PendingTasksWidget.module.css';
import { ClipboardList, AlertTriangle } from 'lucide-react';

const PendingTasksWidget = ({ hideHeader = false }) => {
    const { user } = useAuth();
    const [tasks, setTasks] = useState([]);
    const [loading, setLoading] = useState(true);
    const navigate = useNavigate();

    useEffect(() => {
        if (!user) return;

        const fetchPendingTasks = async () => {
            try {
                const today = new Date().toISOString();
                // Intentamos filtrar por API, pero reforzaremos en el frontend
                const response = await fetch(getApiUrl(`/api/tareas?fechaLimite[after]=${today}&pagination=false&order[fechaLimite]=asc`), {
                    headers: { 'Accept': 'application/ld+json' },
                    credentials: 'include'
                });

                if (!response.ok) throw new Error('Error fetching tasks');

                const data = await response.json();
                const allTasks = data['hydra:member'] || data.member || [];
                
                // Refuerzo de filtrado en frontend: solo tareas cuya fecha límite no haya pasado
                const now = new Date();
                const futureTasks = allTasks.filter(task => {
                    if (!task.fechaLimite) return false;
                    return new Date(task.fechaLimite) > now;
                });
                
                setTasks(futureTasks.slice(0, 5)); 

            } catch (error) {
                console.error("Error fetching pending tasks:", error);
            } finally {
                setLoading(false);
            }
        };

        fetchPendingTasks();
    }, [user]);

    const handleTaskClick = (task) => {
        navigate('/entregas', { state: { selectedTask: task } });
    };

    const getDaysRemaining = (dueDate) => {
        if (!dueDate) return { text: 'Sin fecha', urgent: false };
        
        const today = new Date();
        const due = new Date(dueDate);
        
        if (isNaN(due.getTime())) return { text: 'Fecha inválida', urgent: false };

        const diffTime = due.getTime() - today.getTime();
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
        
        if (diffDays <= 0) return { text: 'Vence hoy', urgent: true };
        if (diffDays === 1) return { text: 'Vence mañana', urgent: true };
        if (diffDays <= 3) return { text: `Vence en ${diffDays} días`, urgent: true };
        return { text: `Vence en ${diffDays} días`, urgent: false };
    };

    const renderContent = () => {
        if (loading) {
            return <p className={styles.loading}>Cargando tareas...</p>;
        }
        if (tasks.length === 0) {
            return <p className={styles.empty}>¡No tienes tareas pendientes!</p>;
        }

        return (
            <ul className={styles.taskList}>
                {tasks.map(task => {
                    const remaining = getDaysRemaining(task.fechaLimite);
                    return (
                        <li key={task.id} className={styles.taskItem} onClick={() => handleTaskClick(task)}>
                            <div className={styles.details}>
                                <span className={styles.title}>{task.titulo}</span>
                                <span className={styles.module}>
                                    {task.imparticion?.modulo?.nombre || 'Módulo desconocido'}
                                </span>
                            </div>
                            <div className={`${styles.dueDate} ${remaining.urgent ? styles.urgent : ''}`}>
                                {remaining.urgent && <AlertTriangle size={14} />}
                                {remaining.text}
                            </div>
                        </li>
                    );
                })}
            </ul>
        );
    };

    return (
        <div className={styles.widgetContainer}>
            {!hideHeader && (
                <div className={styles.widgetHeader}>
                    <ClipboardList size={20} className={styles.headerIcon} />
                    <h3 className={styles.widgetTitle}>Tareas Pendientes</h3>
                </div>
            )}
            <div className={styles.widgetContent}>
                {renderContent()}
            </div>
        </div>
    );
};

export default PendingTasksWidget;
