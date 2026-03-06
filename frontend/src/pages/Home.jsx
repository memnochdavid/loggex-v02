import React, { useState, useEffect, useRef } from 'react';
import logoApp from '../../public/logo_app.png';
import styles from './Home.module.css';
import Button from '../components/Button';
import { useAuth } from '../context/AuthContext';
import Layout from '../components/Layout';
import { getApiUrl } from '../config/api';
import NotificationList from '../components/NotificationList';
import UpcomingEventsWidget from '../components/UpcomingEventsWidget';
import PendingTasksWidget from '../components/PendingTasksWidget';
import TablonWidget from '../components/TablonWidget';
import CrudHeader from '../components/CrudHeader';
import AccordionView from '../components/AccordionView';
import ModalView from '../components/ModalView';
import AsistenciaModal from '../components/AsistenciaModal';
import EventCard from '../components/EventCard';
import { MessageSquare, CalendarClock, ClipboardList, Megaphone, Clock, MapPin, Users, User, CheckSquare, Save } from 'lucide-react';
import Lottie from 'lottie-react';
import helloAnimation from '../../public/hello.json';

const Home = () => {
  const [backendMessage, setBackendMessage] = useState('Cargando...');
  const { user } = useAuth();
  const tablonRef = useRef(null);

  const isAlumno = user?.roles?.includes('ROLE_ALUMNO');
  const isProfesor = user?.roles?.includes('ROLE_PROFESOR');
  const isAdmin = user?.roles?.includes('ROLE_ADMIN');
  const isSuperAdmin = user?.roles?.includes('ROLE_SUPER_ADMIN') || user?.roles?.includes('ROLE_SUPERADMIN');
  const canTakeAttendance = isProfesor || isAdmin || isSuperAdmin;

  // Estados para el modal de Horario
  const [selectedEvent, setSelectedEvent] = useState(null);
  const [isTakingAttendance, setIsTakingAttendance] = useState(false);
  const [savingAttendance, setSavingAttendance] = useState(false);
  const [asistenciaData, setAsistenciaData] = useState(null);
  const [tareas, setTareas] = useState([]); // Necesitamos cargar las tareas para mostrarlas en el modal

  useEffect(() => {
    fetch(getApiUrl('/api/hello'), {
        credentials: 'include'
    })
      .then(response => {
          if (response.status === 401) return { message: 'No autorizado (Token expirado)' };
          return response.json();
      })
      .then(data => setBackendMessage(data.message))
      .catch(error => setBackendMessage('Error conectando al backend: ' + error));

    // Cargar tareas para el modal de eventos (si es necesario)
    fetch(getApiUrl('/api/tareas?pagination=false'), {
        headers: { 'Accept': 'application/ld+json' },
        credentials: 'include'
    })
    .then(res => res.json())
    .then(data => {
        const items = data['hydra:member'] || data.member || [];
        setTareas(items);
    })
    .catch(err => console.error("Error cargando tareas:", err));

  }, []);

  // --- Lógica del Modal de Horario (Copiada de TimeTable.jsx) ---

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
      // Asumimos que el evento es de hoy porque viene del widget "Horario de Hoy"
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
      
      // Asumimos que es hoy
      const today = new Date();
      const year = today.getFullYear();
      const month = String(today.getMonth() + 1).padStart(2, '0');
      const day = String(today.getDate()).padStart(2, '0');
      const dateStr = `${year}-${month}-${day}`;

      return tareas.filter(t => {
          const taskDate = t.fechaLimite.split('T')[0];
          if (taskDate !== dateStr) return false;
          
          const horarioImpId = getImparticionId(event);
          let tareaImpId = null;
          if (t.imparticion) {
              if (typeof t.imparticion === 'string') tareaImpId = t.imparticion.split('/').pop();
              else if (t.imparticion.id) tareaImpId = t.imparticion.id;
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
                  comentario: a.comentario
              }))
          };

          const response = await fetch(getApiUrl('/api/v1/asistencia/batch'), {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify(payload),
              credentials: 'include'
          });

          if (response.ok) {
              handleCloseModal();
          } else {
              alert("Error al guardar asistencia");
          }
      } catch (error) {
          console.error(error);
          alert("Error de conexión");
      } finally {
          setSavingAttendance(false);
      }
  };

  const handleAsistenciaDataChange = (data) => {
      setAsistenciaData(data);
  };

  const formatDateISO = (date) => {
      if (!date) return '';
      const d = new Date(date);
      const year = d.getFullYear();
      const month = String(d.getMonth() + 1).padStart(2, '0');
      const day = String(d.getDate()).padStart(2, '0');
      return `${year}-${month}-${day}`;
  };

  const days = ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Domingo'];

  // --- Fin Lógica Modal ---

  // Definición de los widgets para el AccordionView
  const widgets = [];

  // 0. Tablón de Anuncios
  widgets.push({
      id: 'tablon',
      title: 'Tablón de Anuncios',
      icon: <Megaphone size={20} />,
      component: <TablonWidget ref={tablonRef} hideHeader={true} />,
      canAdd: isAdmin || isSuperAdmin,
      onAdd: () => {
          if (tablonRef.current) {
              tablonRef.current.openModal();
          }
      }
  });

  // 1. Mensajes Recientes
  widgets.push({
      id: 'notifications',
      title: 'Mensajes Recientes',
      icon: <MessageSquare size={20} />,
      component: <NotificationList limit={5} showViewAllButton={true} hideHeader={true} onlyUnread={false} />
  });

  // 2. Tareas Pendientes (Si es alumno)
  if (isAlumno) {
      widgets.push({
          id: 'tasks',
          title: 'Tareas Pendientes',
          icon: <ClipboardList size={20} />,
          component: <PendingTasksWidget hideHeader={true} />
      });
  }

  // 3. Horario de Hoy
  widgets.push({
      id: 'events',
      title: 'Horario de Hoy',
      icon: <CalendarClock size={20} />,
      component: <UpcomingEventsWidget hideHeader={true} onEventClick={handleEventClick} />
  });

  // Renderizado personalizado del header del acordeón
  const renderWidgetHeader = (item, isOpen) => (
      <div className={styles.accordionHeaderContent}>
          <span className={styles.accordionIcon} style={{ color: 'var(--widget-icon-color, var(--color-primary))' }}>
              {item.icon}
          </span>
          <span className={styles.accordionTitle} style={{ color: 'var(--widget-header-text, var(--color-text-main))' }}>
              {item.title}
          </span>
      </div>
  );

  const tasksForSelectedEvent = selectedEvent ? getTasksForEvent(selectedEvent) : [];

  return (
    <Layout>
      <div className={styles.container}>
          <CrudHeader 
              title={`Hola, ${user?.nombre || 'Usuario'}, que tengas un buen día.`}
              logo={<Lottie animationData={helloAnimation} loop={true} style={{ width: 60, height: 60 }} />}
          >
          </CrudHeader>
          
          <div className={styles.dashboardGrid}>
              {widgets.map(widget => (
                  <AccordionView 
                      key={widget.id}
                      data={[widget]} 
                      renderItem={(item) => item.component}
                      renderHeader={renderWidgetHeader}
                      className={styles.widgetsAccordion}
                      defaultOpenAll={true}
                      canAdd={widget.canAdd}
                      onAdd={widget.onAdd}
                  />
              ))}
          </div>

          {/* Modal de Detalle / Asistencia (Copiado de TimeTable.jsx) */}
          <ModalView
                isOpen={!!selectedEvent}
                onClose={handleCloseModal}
                title={selectedEvent ? (isTakingAttendance ? `Pasar Lista: ${selectedEvent.modulo}` : selectedEvent.modulo) : ''}
                size={isTakingAttendance ? "large" : "small"}
                cancelText={isTakingAttendance ? "Cancelar" : "Cerrar"}
                footer={isTakingAttendance ? (
                    <>
                        <Button variant="secondary" onClick={handleCloseModal}>Cancelar</Button>
                        <Button onClick={handleSaveAttendance} disabled={savingAttendance}>
                            <Save size={18} style={{ marginRight: '8px' }} />
                            {savingAttendance ? 'Guardando...' : 'Guardar'}
                        </Button>
                    </>
                ) : undefined}
            >
                {selectedEvent && (
                    isTakingAttendance ? (
                        <AsistenciaModal
                            imparticionId={getImparticionId(selectedEvent)}
                            fecha={formatDateISO(new Date())} // Usamos la fecha de hoy
                            hora={selectedEvent.horaInicio}
                            onClose={handleCloseModal}
                            onDataChange={handleAsistenciaDataChange}
                        />
                    ) : (
                        <div className={styles.modalBody}>
                            <div className={styles.detailRow}>
                                <Clock size={18} className={styles.icon} />
                                <div>
                                    <span className={styles.label}>Horario:</span>
                                    <span className={styles.value}>
                                        {/* Como es "Horario de Hoy", el día es hoy */}
                                        {selectedEvent.horaInicio} - {selectedEvent.horaFin}
                                    </span>
                                </div>
                            </div>
                            <div className={styles.detailRow}>
                                <Users size={18} className={styles.icon} />
                                <div>
                                    <span className={styles.label}>Grupo:</span>
                                    <span className={styles.value}>{selectedEvent.grupo}</span>
                                    {selectedEvent.grupoAbreviatura && (
                                        <span className={styles.subValue}> ({selectedEvent.grupoAbreviatura})</span>
                                    )}
                                </div>
                            </div>
                            <div className={styles.detailRow}>
                                <MapPin size={18} className={styles.icon} />
                                <div>
                                    <span className={styles.label}>Aula:</span>
                                    <span className={styles.value}>{selectedEvent.aula}</span>
                                </div>
                            </div>
                            <div className={styles.detailRow}>
                                <User size={18} className={styles.icon} />
                                <div>
                                    <span className={styles.label}>Profesor:</span>
                                    <span className={styles.value}>{selectedEvent.profesor}</span>
                                </div>
                            </div>

                            {/* Mostrar Tareas/Eventos del día */}
                            {tasksForSelectedEvent.length > 0 && (
                                <div className={styles.eventsSection}>
                                    <h4 className={styles.eventsTitle}>Eventos del día:</h4>
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
                                        Pasar Lista
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
