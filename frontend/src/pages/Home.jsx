import React, { useState, useEffect, useRef, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import styles from './Home.module.css';
import Button from '../components/Button';
import { useAuth } from '../context/AuthContext';
import Layout from '../components/Layout';
import { getApiUrl } from '../config/api';
import NotificationList from '../components/NotificationList';
import UpcomingEventsWidget from '../components/UpcomingEventsWidget';
import PendingTasksWidget from '../components/PendingTasksWidget';
import TablonWidget from '../components/TablonWidget';
import ModalView from '../components/ModalView';
import AsistenciaModal from '../components/AsistenciaModal';
import EventCard from '../components/EventCard';
import {
    MessageSquare, CalendarClock, ClipboardList, Megaphone,
    Clock, MapPin, Users, User, CheckSquare, Save,
    ArrowRight, FileCheck, Calendar, Plus,
} from 'lucide-react';
import Lottie from 'lottie-react';
import helloAnimation from '../../public/hello.json';
import { useTranslation } from 'react-i18next';
import useUnreadMessages from '../hooks/useUnreadMessages';
import useHomeStats from '../hooks/useHomeStats';

/* ========== Helpers locales ========== */

const getGreetingKey = () => {
    const h = new Date().getHours();
    if (h < 6) return 'home.greetingNight';
    if (h < 13) return 'home.greetingMorning';
    if (h < 21) return 'home.greetingAfternoon';
    return 'home.greetingNight';
};

const StatChip = ({ icon, value, label, onClick, accent = 'primary' }) => (
    <button
        type="button"
        className={`${styles.statChip} ${styles[`stat_${accent}`]}`}
        onClick={onClick}
        disabled={!onClick}
    >
        <span className={styles.statIcon}>{icon}</span>
        <span className={styles.statBody}>
            <span className={styles.statValue}>{value}</span>
            <span className={styles.statLabel}>{label}</span>
        </span>
    </button>
);

const WidgetCard = ({ title, icon, linkTo, action, children, areaClass = '', viewAllLabel }) => {
    const navigate = useNavigate();
    return (
        <section className={`${styles.widget} ${areaClass}`}>
            <header className={styles.widgetHeader}>
                <div className={styles.widgetTitle}>
                    {icon && <span className={styles.widgetIcon}>{icon}</span>}
                    <h3>{title}</h3>
                </div>
                <div className={styles.widgetActions}>
                    {action}
                    {linkTo && (
                        <button
                            type="button"
                            className={styles.widgetLink}
                            onClick={() => navigate(linkTo)}
                            aria-label={viewAllLabel}
                            title={viewAllLabel}
                        >
                            <ArrowRight size={16} />
                        </button>
                    )}
                </div>
            </header>
            <div className={styles.widgetBody}>
                {children}
            </div>
        </section>
    );
};

/* ========== Home ========== */

const Home = () => {
    const { t } = useTranslation();
    const { user } = useAuth();
    const navigate = useNavigate();
    const tablonRef = useRef(null);

    const isAlumno = user?.roles?.includes('ROLE_ALUMNO');
    const isProfesor = user?.roles?.includes('ROLE_PROFESOR');
    const isAdmin = user?.roles?.includes('ROLE_ADMIN');
    const isSuperAdmin = user?.roles?.includes('ROLE_SUPER_ADMIN') || user?.roles?.includes('ROLE_SUPERADMIN');
    const canTakeAttendance = isProfesor || isAdmin || isSuperAdmin;
    const canEditTablon = isAdmin || isSuperAdmin;

    const unreadMessages = useUnreadMessages();
    const { pendingTasks, pendingDeliveries, nextClass, weekEvents } = useHomeStats();

    // Modal de detalle del evento (misma lógica previa)
    const [selectedEvent, setSelectedEvent] = useState(null);
    const [isTakingAttendance, setIsTakingAttendance] = useState(false);
    const [savingAttendance, setSavingAttendance] = useState(false);
    const [asistenciaData, setAsistenciaData] = useState(null);
    const [tareas, setTareas] = useState([]);

    useEffect(() => {
        fetch(getApiUrl('/api/tareas?pagination=false'), {
            headers: { Accept: 'application/ld+json' },
            credentials: 'include',
        })
            .then(res => res.json())
            .then(data => setTareas(data['hydra:member'] || data.member || []))
            .catch(err => console.error('Error cargando tareas:', err));
    }, []);

    /* Saludo + resumen */
    const greeting = t(getGreetingKey(), 'Hola');
    const resumenLine = useMemo(() => {
        const bits = [];
        if (unreadMessages > 0) {
            bits.push(t('home.summaryMessages', { count: unreadMessages }));
        }
        if (isAlumno && pendingTasks > 0) {
            bits.push(t('home.summaryTasks', { count: pendingTasks }));
        }
        if (!isAlumno && pendingDeliveries > 0) {
            bits.push(t('home.summaryDeliveries', { count: pendingDeliveries }));
        }
        if (nextClass) {
            bits.push(t('home.summaryNextClass', { time: nextClass.horaInicio }));
        }
        if (bits.length === 0) return t('home.summaryAllClear', 'Nada pendiente. ¡Buen día!');
        return bits.join(' · ');
    }, [unreadMessages, pendingTasks, pendingDeliveries, nextClass, isAlumno, t]);

    /* Chips del stat ribbon */
    const statChips = useMemo(() => {
        const chips = [];
        chips.push({
            key: 'msgs',
            icon: <MessageSquare size={18} />,
            value: unreadMessages,
            label: t('home.unreadMessages', 'Mensajes sin leer'),
            onClick: () => navigate('/mensajes'),
            accent: 'primary',
        });
        if (isAlumno) {
            chips.push({
                key: 'tasks',
                icon: <ClipboardList size={18} />,
                value: pendingTasks,
                label: t('home.pendingTasksShort', 'Tareas pendientes'),
                onClick: () => navigate('/entregas'),
                accent: 'amber',
            });
        } else if (isProfesor || isAdmin || isSuperAdmin) {
            chips.push({
                key: 'deliveries',
                icon: <FileCheck size={18} />,
                value: pendingDeliveries,
                label: t('home.pendingDeliveries', 'Por corregir'),
                onClick: () => navigate('/entregas'),
                accent: 'amber',
            });
        }
        chips.push({
            key: 'next',
            icon: <Clock size={18} />,
            value: nextClass ? nextClass.horaInicio : '—',
            label: nextClass
                ? t('home.nextClassLabel', 'Próxima clase')
                : t('home.noMoreClasses', 'Sin más clases hoy'),
            onClick: nextClass ? () => navigate('/horarios') : null,
            accent: 'emerald',
        });
        chips.push({
            key: 'week',
            icon: <Calendar size={18} />,
            value: weekEvents,
            label: t('home.weekEvents', 'Eventos esta semana'),
            onClick: () => navigate('/horarios'),
            accent: 'violet',
        });
        return chips;
    }, [unreadMessages, pendingTasks, pendingDeliveries, nextClass, weekEvents,
        isAlumno, isProfesor, isAdmin, isSuperAdmin, navigate, t]);

    /* Lógica del modal — inalterada */
    const handleEventClick = (event) => {
        setSelectedEvent(event);
        setIsTakingAttendance(false);
    };
    const handleCloseModal = () => {
        setSelectedEvent(null);
        setIsTakingAttendance(false);
        setAsistenciaData(null);
    };
    const canPassAttendance = (event) => {
        if (!event || !canTakeAttendance) return false;
        const now = new Date();
        const [hours, minutes] = event.horaInicio.split(':');
        const eventDateTime = new Date();
        eventDateTime.setHours(parseInt(hours), parseInt(minutes), 0, 0);
        return now >= eventDateTime;
    };
    const getImparticionId = (event) => {
        if (!event) return null;
        if (event.imparticionId) return event.imparticionId;
        const imparticion = event.imparticion;
        if (!imparticion) return null;
        if (typeof imparticion === 'string') return imparticion.split('/').pop();
        if (imparticion.id) return imparticion.id;
        if (imparticion['@id']) return imparticion['@id'].split('/').pop();
        return null;
    };
    const getTasksForEvent = (event) => {
        if (!event || !tareas) return [];
        const today = new Date();
        const dateStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
        return tareas.filter(tr => {
            const taskDate = tr.fechaLimite?.split('T')[0];
            if (taskDate !== dateStr) return false;
            const horarioImpId = getImparticionId(event);
            let tareaImpId = null;
            if (tr.imparticion) {
                if (typeof tr.imparticion === 'string') tareaImpId = tr.imparticion.split('/').pop();
                else if (tr.imparticion.id) tareaImpId = tr.imparticion.id;
            }
            return String(horarioImpId) === String(tareaImpId);
        });
    };
    const handleSaveAttendance = async () => {
        if (!asistenciaData || !asistenciaData.alumnos) return;
        setSavingAttendance(true);
        try {
            const payload = {
                imparticion: asistenciaData.imparticionId,
                fecha: asistenciaData.fecha,
                hora: asistenciaData.hora,
                asistencias: asistenciaData.alumnos.map(a => ({
                    alumnoId: a.id,
                    estado: a.estado,
                    comentario: a.comentario,
                })),
            };
            const response = await fetch(getApiUrl('/api/v1/asistencia/batch'), {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload),
                credentials: 'include',
            });
            if (response.ok) handleCloseModal();
            else alert(t('home.errorSavingAttendance'));
        } catch (error) {
            console.error(error);
            alert(t('home.errorConnection'));
        } finally {
            setSavingAttendance(false);
        }
    };
    const handleAsistenciaDataChange = (data) => setAsistenciaData(data);
    const formatDateISO = (date) => {
        if (!date) return '';
        const d = new Date(date);
        return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    };
    const tasksForSelectedEvent = selectedEvent ? getTasksForEvent(selectedEvent) : [];
    const viewAllLabel = t('home.viewAll', 'Ver todo');

    return (
        <Layout>
            <div className={styles.container}>
                {/* ============ Saludo ============ */}
                <header className={styles.pageHeader}>
                    <div className={styles.greetingLottie} aria-hidden="true">
                        <Lottie animationData={helloAnimation} loop style={{ width: 56, height: 56 }} />
                    </div>
                    <div className={styles.greetingBlock}>
                        <h1 className={styles.greeting}>
                            {greeting}, <span className={styles.name}>{user?.nombre || 'Usuario'}</span>
                        </h1>
                        <p className={styles.greetingSub}>{resumenLine}</p>
                    </div>
                </header>

                {/* ============ Stat ribbon ============ */}
                <div className={styles.statRibbon} role="list">
                    {statChips.map(c => (
                        <StatChip
                            key={c.key}
                            icon={c.icon}
                            value={c.value}
                            label={c.label}
                            onClick={c.onClick}
                            accent={c.accent}
                        />
                    ))}
                </div>

                {/* ============ Bento grid de widgets ============ */}
                <div className={styles.bento}>
                    <WidgetCard
                        title={t('home.bulletinBoard')}
                        icon={<Megaphone size={18} />}
                        areaClass={styles.bentoTablon}
                        viewAllLabel={viewAllLabel}
                        action={canEditTablon && (
                            <button
                                type="button"
                                className={styles.widgetAction}
                                onClick={() => tablonRef.current?.openModal()}
                                title={t('common.new', 'Nuevo')}
                                aria-label={t('common.new', 'Nuevo')}
                            >
                                <Plus size={16} />
                            </button>
                        )}
                    >
                        <TablonWidget ref={tablonRef} hideHeader={true} />
                    </WidgetCard>

                    <WidgetCard
                        title={t('home.todaySchedule')}
                        icon={<CalendarClock size={18} />}
                        linkTo="/horarios"
                        areaClass={styles.bentoSchedule}
                        viewAllLabel={viewAllLabel}
                    >
                        <UpcomingEventsWidget hideHeader={true} onEventClick={handleEventClick} />
                    </WidgetCard>

                    <WidgetCard
                        title={t('home.recentMessages')}
                        icon={<MessageSquare size={18} />}
                        linkTo="/mensajes"
                        areaClass={styles.bentoMessages}
                        viewAllLabel={viewAllLabel}
                    >
                        <NotificationList limit={5} showViewAllButton={false} hideHeader={true} onlyUnread={false} />
                    </WidgetCard>

                    {isAlumno && (
                        <WidgetCard
                            title={t('home.pendingTasks')}
                            icon={<ClipboardList size={18} />}
                            linkTo="/entregas"
                            areaClass={styles.bentoTasks}
                            viewAllLabel={viewAllLabel}
                        >
                            <PendingTasksWidget hideHeader={true} />
                        </WidgetCard>
                    )}
                </div>

                {/* ============ Modal (sin cambios funcionales) ============ */}
                <ModalView
                    isOpen={!!selectedEvent}
                    onClose={handleCloseModal}
                    title={selectedEvent ? (isTakingAttendance ? t('home.rollCallTitle', { module: selectedEvent.modulo }) : selectedEvent.modulo) : ''}
                    size={isTakingAttendance ? 'large' : 'small'}
                    cancelText={isTakingAttendance ? t('common.cancel') : t('common.close')}
                    footer={isTakingAttendance ? (
                        <>
                            <Button variant="secondary" onClick={handleCloseModal}>{t('common.cancel')}</Button>
                            <Button onClick={handleSaveAttendance} disabled={savingAttendance}>
                                <Save size={18} style={{ marginRight: '8px' }} />
                                {savingAttendance ? t('common.saving') : t('common.save')}
                            </Button>
                        </>
                    ) : undefined}
                >
                    {selectedEvent && (
                        isTakingAttendance ? (
                            <AsistenciaModal
                                imparticionId={getImparticionId(selectedEvent)}
                                fecha={formatDateISO(new Date())}
                                hora={selectedEvent.horaInicio}
                                onClose={handleCloseModal}
                                onDataChange={handleAsistenciaDataChange}
                            />
                        ) : (
                            <div className={styles.modalBody}>
                                <div className={styles.detailRow}>
                                    <Clock size={18} className={styles.icon} />
                                    <div>
                                        <span className={styles.label}>{t('home.scheduleLabel')}</span>
                                        <span className={styles.value}>
                                            {selectedEvent.horaInicio} - {selectedEvent.horaFin}
                                        </span>
                                    </div>
                                </div>
                                <div className={styles.detailRow}>
                                    <Users size={18} className={styles.icon} />
                                    <div>
                                        <span className={styles.label}>{t('home.groupLabel')}</span>
                                        <span className={styles.value}>{selectedEvent.grupo}</span>
                                        {selectedEvent.grupoAbreviatura && (
                                            <span className={styles.subValue}> ({selectedEvent.grupoAbreviatura})</span>
                                        )}
                                    </div>
                                </div>
                                <div className={styles.detailRow}>
                                    <MapPin size={18} className={styles.icon} />
                                    <div>
                                        <span className={styles.label}>{t('home.classroomLabel')}</span>
                                        <span className={styles.value}>{selectedEvent.aula}</span>
                                    </div>
                                </div>
                                <div className={styles.detailRow}>
                                    <User size={18} className={styles.icon} />
                                    <div>
                                        <span className={styles.label}>{t('home.teacherLabel')}</span>
                                        <span className={styles.value}>{selectedEvent.profesor}</span>
                                    </div>
                                </div>
                                {tasksForSelectedEvent.length > 0 && (
                                    <div className={styles.eventsSection}>
                                        <h4 className={styles.eventsTitle}>{t('home.dayEvents')}</h4>
                                        <div className={styles.eventsList}>
                                            {tasksForSelectedEvent.map(task => (
                                                <EventCard
                                                    key={task.id}
                                                    title={task.titulo}
                                                    type={task.tipo}
                                                />
                                            ))}
                                        </div>
                                    </div>
                                )}
                                {canPassAttendance(selectedEvent) && (
                                    <div className={styles.attendanceButtonContainer}>
                                        <Button onClick={() => setIsTakingAttendance(true)} className={styles.attendanceButton}>
                                            <CheckSquare size={18} style={{ marginRight: '8px' }} />
                                            {t('home.rollCall')}
                                        </Button>
                                    </div>
                                )}
                            </div>
                        )
                    )}
                </ModalView>
            </div>
        </Layout>
    );
};

export default Home;
