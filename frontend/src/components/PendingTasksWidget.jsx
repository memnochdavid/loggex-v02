import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { getApiUrl } from '../config/api';
import { useNavigate } from 'react-router-dom';
import styles from './PendingTasksWidget.module.css';
import { ClipboardList, AlertTriangle } from 'lucide-react';
import { useTranslation } from 'react-i18next';

const PendingTasksWidget = ({ hideHeader = false }) => {
    const { t } = useTranslation();
    const { user } = useAuth();
    const [tasks, setTasks] = useState([]);
    const [loading, setLoading] = useState(true);
    const navigate = useNavigate();

    const isAlumno = user?.rolApp === 'alumno' || user?.roles?.includes('ROLE_ALUMNO');

    useEffect(() => {
        if (!user) return;

        const fetchPendingTasks = async () => {
            try {
                // Obtener tareas a través de las imparticiones del usuario (misma fuente que /entregas)
                let impEndpoint;
                if (isAlumno) {
                    const matRes = await fetch(getApiUrl(`/api/matriculas?alumno=${user.id}&pagination=false`), {
                        headers: { 'Accept': 'application/ld+json' }, credentials: 'include'
                    });
                    if (!matRes.ok) throw new Error('matriculas');
                    const matData = await matRes.json();
                    const matriculas = matData['hydra:member'] || matData.member || [];
                    const grupoIds = matriculas.map(m => typeof m.grupo === 'string' ? m.grupo.split('/').pop() : (m.grupo?.id || m.grupo?.['@id']?.split('/').pop())).filter(Boolean);
                    if (grupoIds.length === 0) { setTasks([]); return; }
                    const q = grupoIds.map(g => `grupo[]=${g}`).join('&');
                    impEndpoint = getApiUrl(`/api/imparticions?${q}&pagination=false`);
                } else {
                    // profesor/admin: sus imparticiones
                    impEndpoint = getApiUrl(`/api/imparticions?profesor=${user.id}&pagination=false`);
                }

                const impRes = await fetch(impEndpoint, { headers: { 'Accept': 'application/ld+json' }, credentials: 'include' });
                if (!impRes.ok) throw new Error('imparticions');
                const impData = await impRes.json();
                const imparticiones = impData['hydra:member'] || impData.member || [];

                const now = new Date();
                let futureTasks = [];
                imparticiones.forEach(imp => {
                    (imp.tareas || []).forEach(tr => {
                        if (!tr.fechaLimite) return;
                        if (new Date(tr.fechaLimite) <= now) return;
                        if (isAlumno && tr.visible === false) return;
                        // Enriquecer con referencia a la impartición para navegar
                        futureTasks.push({ ...tr, imparticion: { id: imp.id, modulo: imp.modulo } });
                    });
                });
                futureTasks.sort((a, b) => new Date(a.fechaLimite) - new Date(b.fechaLimite));

                // Si es alumno, filtrar las ya entregadas
                if (isAlumno) {
                    const entRes = await fetch(
                        getApiUrl(`/api/entregas?alumno=${user.id}&pagination=false`),
                        { headers: { 'Accept': 'application/ld+json' }, credentials: 'include' }
                    );
                    if (entRes.ok) {
                        const entData = await entRes.json();
                        const entregas = entData['hydra:member'] || entData.member || [];
                        const tareasEntregadas = new Set();
                        entregas.forEach(e => {
                            let tId;
                            if (typeof e.tarea === 'string') tId = e.tarea.split('/').pop();
                            else if (e.tarea?.id) tId = String(e.tarea.id);
                            else if (e.tarea?.['@id']) tId = e.tarea['@id'].split('/').pop();
                            if (tId) tareasEntregadas.add(String(tId));
                        });
                        futureTasks = futureTasks.filter(tr => !tareasEntregadas.has(String(tr.id)));
                    }
                }

                setTasks(futureTasks);
            } catch (error) {
                console.error("Error fetching pending tasks:", error);
            } finally {
                setLoading(false);
            }
        };

        fetchPendingTasks();
    }, [user, isAlumno]);

    const handleTaskClick = (task) => {
        const impId = task.imparticion?.id
            ?? (typeof task.imparticion === 'string' ? task.imparticion.split('/').pop() : null)
            ?? task.imparticion?.['@id']?.split('/').pop();
        if (impId) {
            navigate(`/entregas?imparticion=${impId}&tarea=${task.id}`);
        } else {
            navigate('/entregas');
        }
    };

    const getDaysRemaining = (dueDate) => {
        if (!dueDate) return { text: t('pendingTasks.noDate'), urgent: false };
        const today = new Date();
        const due = new Date(dueDate);
        if (isNaN(due.getTime())) return { text: t('pendingTasks.invalidDate'), urgent: false };

        const diffTime = due.getTime() - today.getTime();
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
        if (diffDays <= 0) return { text: t('pendingTasks.dueToday'), urgent: true };
        if (diffDays === 1) return { text: t('pendingTasks.dueTomorrow'), urgent: true };
        if (diffDays <= 3) return { text: t('pendingTasks.dueInDays', { days: diffDays }), urgent: true };
        return { text: t('pendingTasks.dueInDays', { days: diffDays }), urgent: false };
    };

    const renderContent = () => {
        if (loading) return <p className={styles.loading}>{t('pendingTasks.loading')}</p>;
        if (tasks.length === 0) return <p className={styles.empty}>{t('pendingTasks.empty')}</p>;

        return (
            <ul className={styles.taskList}>
                {tasks.map(task => {
                    const remaining = getDaysRemaining(task.fechaLimite);
                    return (
                        <li key={task.id} className={styles.taskItem} onClick={() => handleTaskClick(task)}>
                            <div className={styles.details}>
                                <span className={styles.title}>{task.titulo}</span>
                                <span className={styles.module}>
                                    {task.imparticion?.modulo?.nombre || t('common.unknownModule')}
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
                    <h3 className={styles.widgetTitle}>{t('pendingTasks.title')}</h3>
                </div>
            )}
            <div className={styles.widgetContent}>
                {renderContent()}
            </div>
        </div>
    );
};

export default PendingTasksWidget;
