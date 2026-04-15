import React, { useEffect, useState, useRef, useCallback, useMemo } from 'react';
import styles from './Horarios.module.css';
import Button from '../components/Button';
import DataTable from '../components/DataTable';
import SearchBar from '../components/SearchBar';
import ThemedSelect from '../components/ThemedSelect';
import Layout from '../components/Layout';
import TimeTable from '../components/TimeTable';
import EventsSidebar from '../components/EventsSidebar';
import ModalView from '../components/ModalView';
import CrudHeader from '../components/CrudHeader';
import { useAuth } from '../context/AuthContext';
import { Plus, Edit2, Trash2, Calendar as CalendarIcon, List, PanelRightOpen, PanelRightClose, LayoutGrid } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { getApiUrl } from '../config/api';
import useMediaQuery from '../hooks/useMediaQuery';
import { usePagination } from '../hooks/usePagination';
import Lottie from 'lottie-react';
import calendarAnimation from '../../public/time.json';
import { useTranslation } from 'react-i18next';

const Horarios = ({ embedded = false, tabs = null }) => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { user } = useAuth();
  const isSuperAdmin = user?.roles?.includes('ROLE_SUPERADMIN');
  const isAdmin = user?.roles?.includes('ROLE_ADMIN');
  const canEdit = isSuperAdmin || isAdmin;
  
  const isMobile = useMediaQuery('(max-width: 1200px)');

  const [viewMode, setViewMode] = useState(embedded ? 'list' : 'calendar');
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);

  const [horarios, setHorarios] = useState([]);
  const [mySchedule, setMySchedule] = useState([]);
  const [festivos, setFestivos] = useState([]);
  const [tareas, setTareas] = useState([]);
  const [imparticiones, setImparticiones] = useState([]);
  const [centros, setCentros] = useState([]);
  
  // Estado de carga único
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  
  const [selectedCentro, setSelectedCentro] = useState('');
  
  const [currentPage, setCurrentPage] = useState(1);
  const [totalItems, setTotalItems] = useState(0);
  
  const [itemsPerPage, setItemsPerPage] = usePagination('horarios');

  const [searchTerm, setSearchTerm] = useState('');
  const [searchField, setSearchField] = useState('aula');
  const [sortColumn, setSortColumn] = useState('id');
  const [sortDirection, setSortDirection] = useState('asc');

  // Refs para control de flujo
  const debounceTimeout = useRef(null);
  const prevSearchTerm = useRef(searchTerm);
  const prevSearchField = useRef(searchField);
  const abortController = useRef(null);

  const searchFields = [
      { value: 'aula', label: t('schedules.classroom') },
      { value: 'imparticion.modulo.nombre', label: t('schedules.subject') },
      { value: 'imparticion.profesor.nombre', label: t('schedules.teacher') },
      { value: 'diaSemana', label: t('schedules.day') }
  ];

  const diasSemana = {
      1: t('days.monday'), 2: t('days.tuesday'), 3: t('days.wednesday'), 4: t('days.thursday'), 5: t('days.friday'), 6: t('days.saturday'), 7: t('days.sunday')
  };

  // Necesitamos mapeo inverso para búsqueda si se usa texto
  // Pero como los días están traducidos, la búsqueda por texto exacto puede ser compleja si el backend espera números.
  // Asumiremos que la búsqueda por 'diaSemana' espera números o el usuario busca por otros campos.
  // Si queremos mapeo inverso:
  const diasSemanaInverso = {
      [t('days.monday').toLowerCase()]: 1, 
      [t('days.tuesday').toLowerCase()]: 2, 
      [t('days.wednesday').toLowerCase()]: 3, 
      [t('days.thursday').toLowerCase()]: 4, 
      [t('days.friday').toLowerCase()]: 5, 
      [t('days.saturday').toLowerCase()]: 6, 
      [t('days.sunday').toLowerCase()]: 7
  };

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [currentHorario, setCurrentHorario] = useState(null);
  const [formData, setFormData] = useState({
    diaSemana: 1,
    horaInicio: '08:00',
    horaFin: '09:00',
    aula: '',
    imparticion: ''
  });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (isSuperAdmin) {
        fetch(getApiUrl('/api/centros?pagination=false'), {
            headers: { 'Accept': 'application/ld+json' },
            credentials: 'include'
        })
        .then(res => res.json())
        .then(data => {
            const items = data['hydra:member'] || data.member || [];
            setCentros(items);
        })
        .catch(err => console.error("Error cargando centros:", err));
    }
  }, [isSuperAdmin]);

  useEffect(() => {
    if (!canEdit) return;

    let url = getApiUrl('/api/imparticions?pagination=false');
    
    fetch(url, {
        headers: { 'Accept': 'application/ld+json' },
        credentials: 'include'
    })
    .then(res => res.json())
    .then(data => {
        const items = data['hydra:member'] || data.member || [];
        setImparticiones(items);
    })
    .catch(err => console.error("Error cargando imparticiones:", err));
  }, [selectedCentro, isSuperAdmin, canEdit]);

  // Carga de vista calendario (no usa DataTable, lógica separada)
  useEffect(() => {
      if (viewMode === 'calendar') {
          setLoading(true);
          
          const fetchSchedule = fetch(getApiUrl(`/api/my-schedule?_=${Date.now()}`), {
              headers: { 'Accept': 'application/json', 'Cache-Control': 'no-cache', 'Pragma': 'no-cache' },
              credentials: 'include',
              cache: 'no-store',
          }).then(res => res.json());

          let urlFestivos = getApiUrl('/api/festivos?pagination=false');
          const fetchFestivos = fetch(urlFestivos, {
              headers: { 'Accept': 'application/ld+json' },
              credentials: 'include'
          }).then(res => res.json());

          let urlTareas = getApiUrl('/api/tareas?pagination=false');
          const fetchTareas = fetch(urlTareas, {
              headers: { 'Accept': 'application/ld+json' },
              credentials: 'include'
          }).then(res => res.json());

          Promise.all([fetchSchedule, fetchFestivos, fetchTareas])
          .then(([scheduleData, festivosData, tareasData]) => {
              setMySchedule(scheduleData);
              
              let allFestivos = festivosData['hydra:member'] || festivosData.member || [];
              if (isSuperAdmin && selectedCentro) {
                  allFestivos = allFestivos.filter(f => {
                      if (!f.centro) return true;
                      const centroId = typeof f.centro === 'string' ? f.centro.split('/').pop() : f.centro.id;
                      return String(centroId) === String(selectedCentro);
                  });
              }
              setFestivos(allFestivos);

              const allTareas = tareasData['hydra:member'] || tareasData.member || [];
              setTareas(allTareas);

              setLoading(false);
          })
          .catch(err => {
              console.error(err);
              setError(t('schedules.errorLoadSchedule'));
              setLoading(false);
          });
      }
  }, [viewMode, selectedCentro, isSuperAdmin]);

  const getHorarioId = (h) => {
    if (h.id) return h.id;
    if (h['@id']) {
        const parts = h['@id'].split('/');
        return parts[parts.length - 1];
    }
    return null;
  };

  // Función de carga optimizada para DataTable
  const fetchHorariosData = useCallback(async (params) => {
    if (abortController.current) {
        abortController.current.abort();
    }
    abortController.current = new AbortController();

    setLoading(true);

    try {
      let url = getApiUrl(`/api/horarios?page=${params.page}&itemsPerPage=${params.itemsPerPage}`);
      
      if (params.searchTerm) {
          let term = params.searchTerm;
          if (params.searchField === 'diaSemana') {
              const diaNum = diasSemanaInverso[params.searchTerm.toLowerCase()];
              if (diaNum) term = diaNum;
          }
          url += `&${params.searchField}=${encodeURIComponent(term)}`; 
      }
      
      if (params.sortColumn) {
          url += `&order[${params.sortColumn}]=${params.sortDirection}`;
      }

      const response = await fetch(url, {
        headers: { 'Accept': 'application/ld+json' },
        credentials: 'include',
        signal: abortController.current.signal
      });

      if (!response.ok) throw new Error(`Error ${response.status}`);

      const data = await response.json();
      const items = data['hydra:member'] || data.member || [];
      const total = data['hydra:totalItems'] || data.totalItems || items.length;
      
      setHorarios(items);
      setTotalItems(total);
      setError(null);

    } catch (err) {
      if (err.name === 'AbortError') return;
      console.error("Error fetching horarios:", err);
      setError(err.message);
    } finally {
      if (abortController.current && !abortController.current.signal.aborted) {
          setLoading(false);
      }
    }
  }, []); 

  // Efecto ÚNICO para cambios en modo lista
  useEffect(() => {
      if (viewMode !== 'list') return;

      const searchChanged = searchTerm !== prevSearchTerm.current || searchField !== prevSearchField.current;
      
      prevSearchTerm.current = searchTerm;
      prevSearchField.current = searchField;

      const params = {
          page: currentPage,
          itemsPerPage,
          searchTerm,
          searchField,
          sortColumn,
          sortDirection
      };

      if (searchChanged) {
          if (debounceTimeout.current) clearTimeout(debounceTimeout.current);
          debounceTimeout.current = setTimeout(() => {
              fetchHorariosData(params);
          }, 500);
      } else {
          if (debounceTimeout.current) clearTimeout(debounceTimeout.current);
          fetchHorariosData(params);
      }

      return () => {
          if (debounceTimeout.current) clearTimeout(debounceTimeout.current);
      };
  }, [
      currentPage, 
      itemsPerPage, 
      searchTerm, 
      searchField, 
      sortColumn, 
      sortDirection, 
      viewMode,
      fetchHorariosData
  ]);

  const handleItemsPerPageChange = (newItemsPerPage) => {
      setItemsPerPage(newItemsPerPage);
      setCurrentPage(1);
  };

  const handleSort = useCallback((columnKey) => {
      if (sortColumn === columnKey) {
          setSortDirection(prev => prev === 'asc' ? 'desc' : 'asc');
      } else {
          setSortColumn(columnKey);
          setSortDirection('asc');
      }
  }, [sortColumn]);

  const handleOpenModal = useCallback((horario = null) => {
    if (horario) {
      setCurrentHorario(horario);
      const getId = (obj) => obj ? (obj.id || (obj['@id'] ? obj['@id'].split('/').pop() : '')) : '';
      const formatTime = (dateStr) => {
          if (!dateStr) return '';
          const date = new Date(dateStr);
          return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
      };

      setFormData({
        diaSemana: horario.diaSemana,
        horaInicio: formatTime(horario.horaInicio),
        horaFin: formatTime(horario.horaFin),
        aula: horario.aula,
        imparticion: getId(horario.imparticion)
      });
    } else {
      setCurrentHorario(null);
      setFormData({
        diaSemana: 1,
        horaInicio: '08:00',
        horaFin: '09:00',
        aula: '',
        imparticion: ''
      });
    }
    setIsModalOpen(true);
  }, []);

  const handleCloseModal = () => {
    setIsModalOpen(false);
    setCurrentHorario(null);
  };

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);

    try {
      const id = currentHorario ? getHorarioId(currentHorario) : null;
      const url = currentHorario 
        ? getApiUrl(`/api/horarios/${id}`)
        : getApiUrl('/api/horarios');
      
      const method = currentHorario ? 'PUT' : 'POST';

      const payload = {
        diaSemana: parseInt(formData.diaSemana),
        horaInicio: formData.horaInicio,
        horaFin: formData.horaFin,
        aula: formData.aula,
        imparticion: formData.imparticion.includes('/api/') ? formData.imparticion : `/api/imparticions/${formData.imparticion}`
      };

      const response = await fetch(url, {
        method: method,
        headers: {
          'Content-Type': 'application/ld+json',
          'Accept': 'application/ld+json',
        },
        body: JSON.stringify(payload),
        credentials: 'include'
      });

      if (!response.ok) {
        const errorData = await response.json();
        const errorMessage = errorData['hydra:description'] || errorData.detail || errorData.message || t('common.errorSaving', { message: 'Error desconocido' });
        throw new Error(errorMessage);
      }

      // Recargar datos
      fetchHorariosData({
          page: currentPage,
          itemsPerPage,
          searchTerm,
          searchField,
          sortColumn,
          sortDirection
      });
      handleCloseModal();

    } catch (err) {
      console.error("Error saving horario:", err);
      alert(t('common.errorSaving', { message: err.message }));
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = useCallback(async (horario) => {
    if (!window.confirm(t('schedules.confirmDelete'))) return;

    const id = getHorarioId(horario);
    if (!id) return;

    try {
      const response = await fetch(getApiUrl(`/api/horarios/${id}`), {
        method: 'DELETE',
        credentials: 'include'
      });

      if (!response.ok) throw new Error(t('schedules.errorDelete'));
      fetchHorariosData({
          page: currentPage,
          itemsPerPage,
          searchTerm,
          searchField,
          sortColumn,
          sortDirection
      });
    } catch (err) {
      console.error("Error deleting horario:", err);
      alert(t('common.errorDeletingMsg', { message: err.message }));
    }
  }, [currentPage, itemsPerPage, searchTerm, searchField, sortColumn, sortDirection, fetchHorariosData]);

  const columns = useMemo(() => [
    { 
        header: t('schedules.day'), 
        accessor: (row) => diasSemana[row.diaSemana] || row.diaSemana, 
        sortable: true, sortKey: 'diaSemana' 
    },
    { 
        header: t('schedules.time'), 
        accessor: (row) => {
            const start = new Date(row.horaInicio).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
            const end = new Date(row.horaFin).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
            return `${start} - ${end}`;
        }, 
        sortable: true, sortKey: 'horaInicio' 
    },
    { header: t('schedules.classroom'), accessor: 'aula', sortable: true, sortKey: 'aula' },
    {
        header: t('schedules.subject'),
        accessor: (row) => row.imparticion && row.imparticion.modulo ? row.imparticion.modulo.nombre : '-',
        sortable: true, sortKey: 'imparticion.modulo.nombre'
    },
    {
        header: t('schedules.group'),
        accessor: (row) => row.imparticion && row.imparticion.grupo ? (row.imparticion.grupo.abreviatura || row.imparticion.grupo.nombre) : '-',
        sortable: true, sortKey: 'imparticion.grupo.nombre'
    },
    {
        header: t('schedules.teacher'),
        accessor: (row) => row.imparticion && row.imparticion.profesor ? `${row.imparticion.profesor.nombre} ${row.imparticion.profesor.apellidos}` : '-',
        sortable: true, sortKey: 'imparticion.profesor.nombre'
    },
    { 
        header: t('common.actions'), 
        accessor: (row) => (
            <div className={styles.actions}>
                <button className={styles.iconButton} onClick={() => handleOpenModal(row)} title={t('common.edit')}><Edit2 size={18} /></button>
                <button className={`${styles.iconButton} ${styles.danger}`} onClick={() => handleDelete(row)} title={t('common.delete')}><Trash2 size={18} /></button>
            </div>
        ),
        sortable: false
    }
  ], [handleOpenModal, handleDelete]);

  const Wrapper = embedded ? React.Fragment : Layout;
  const Container = embedded ? React.Fragment : ({ children }) => <div className={styles.container}>{children}</div>;
  return (
    <Wrapper>
        <Container>
        <CrudHeader title={embedded ? 'Horarios' : t('schedules.title')}
                    logo={<Lottie animationData={calendarAnimation} loop={true} style={{ width: 60, height: 60 }} />}
                    middle={tabs}
        >
            {!embedded && (
                <Button
                    variant={viewMode === 'calendar' ? 'primary' : 'secondary'}
                    onClick={() => setViewMode('calendar')}
                    title={t('schedules.calendarView')}
                >
                    <CalendarIcon size={18} />
                </Button>
            )}

            {viewMode === 'calendar' && isMobile && (
                <Button
                    variant="secondary"
                    onClick={() => setIsSidebarOpen(true)}
                    title={t('schedules.showCalendar')}
                >
                    <PanelRightOpen size={18} />
                </Button>
            )}

            {viewMode === 'list' && isSuperAdmin && (
                <ThemedSelect
                    value={selectedCentro}
                    onChange={setSelectedCentro}
                    minWidth={200}
                    ariaLabel={t('common.allCenters')}
                    options={[
                        { value: '', label: t('common.allCenters') },
                        ...centros.map(c => ({ value: String(c.id), label: c.nombre })),
                    ]}
                />
            )}
            
            {viewMode === 'list' && (
                <>
                    <SearchBar 
                        value={searchTerm} 
                        onChange={setSearchTerm} 
                        placeholder={t('common.search')}
                        fields={searchFields}
                        selectedField={searchField}
                        onFieldChange={setSearchField}
                    />
                    <Button onClick={() => handleOpenModal()}>
                        <Plus size={18} style={{ marginRight: '8px' }} /> {t('common.new')}
                    </Button>
                </>
            )}
        </CrudHeader>

        {error && (
            <div className={styles.errorContainer}>
            <p>{error}</p>
            <Button onClick={() => window.location.reload()} variant="secondary" style={{ marginTop: '1rem' }}>{t('common.retry')}</Button>
            </div>
        )}

        {viewMode === 'list' ? (
            <DataTable
                columns={columns}
                data={horarios}
                totalItems={totalItems}
                itemsPerPage={itemsPerPage}
                currentPage={currentPage}
                onPageChange={setCurrentPage}
                onItemsPerPageChange={handleItemsPerPageChange}
                loading={loading}
                sortColumn={sortColumn}
                sortDirection={sortDirection}
                onSort={handleSort}
            />
        ) : (
            <div className={styles.calendarViewModeContainer}>
                <div className={styles.timeTableWrapper}>
                    <TimeTable 
                        events={mySchedule} 
                        festivos={festivos} 
                        tareas={tareas} // Pasar tareas a TimeTable
                        title="Mi Horario" 
                        selectedDate={selectedDate}
                    />
                </div>
                
                {!isMobile && (
                    <div className={styles.eventsSidebarWrapper}>
                        <EventsSidebar 
                            selectedDate={selectedDate} 
                            onDateSelect={setSelectedDate}
                            festivos={festivos}
                            events={tareas.map(t => ({ // Formatear tareas para EventsSidebar
                                id: t.id,
                                title: t.titulo,
                                date: t.fechaLimite,
                                type: t.tipo
                            }))} 
                        />
                    </div>
                )}
            </div>
        )}

        {isMobile && isSidebarOpen && (
            <div className={styles.mobileSidebarOverlay} onClick={() => setIsSidebarOpen(false)}>
                <div className={styles.mobileSidebar} onClick={e => e.stopPropagation()}>
                    <div className={styles.mobileSidebarHeader}>
                        <h3 className={styles.sectionTitle}>{t('schedules.calendarAndEvents')}</h3>
                        <button onClick={() => setIsSidebarOpen(false)} className={styles.closeButton}>
                            <PanelRightClose size={20} />
                        </button>
                    </div>
                    <EventsSidebar 
                        selectedDate={selectedDate} 
                        onDateSelect={(date) => {
                            setSelectedDate(date);
                            setIsSidebarOpen(false);
                        }}
                        festivos={festivos}
                        events={tareas.map(t => ({ // Formatear tareas para EventsSidebar
                            id: t.id,
                            title: t.titulo,
                            date: t.fechaLimite,
                            type: t.tipo
                        }))}
                    />
                </div>
            </div>
        )}

        <ModalView
            isOpen={isModalOpen}
            onClose={handleCloseModal}
            title={currentHorario ? t('schedules.editTitle') : t('schedules.newTitle')}
            onSubmit={handleSubmit}
            isSubmitting={saving}
        >
            <div className={styles.formGroup}>
                <label className={styles.label}>{t('schedules.dayOfWeek')}</label>
                <select name="diaSemana" value={formData.diaSemana} onChange={handleInputChange} className={styles.select}>
                    <option value="1">{t('days.monday')}</option>
                    <option value="2">{t('days.tuesday')}</option>
                    <option value="3">{t('days.wednesday')}</option>
                    <option value="4">{t('days.thursday')}</option>
                    <option value="5">{t('days.friday')}</option>
                    <option value="6">{t('days.saturday')}</option>
                    <option value="7">{t('days.sunday')}</option>
                </select>
            </div>
            <div className={styles.formGroup}>
                <label className={styles.label}>{t('schedules.startTime')}</label>
                <input type="time" name="horaInicio" value={formData.horaInicio} onChange={handleInputChange} className={styles.input} required />
            </div>
            <div className={styles.formGroup}>
                <label className={styles.label}>{t('schedules.endTime')}</label>
                <input type="time" name="horaFin" value={formData.horaFin} onChange={handleInputChange} className={styles.input} required />
            </div>
            <div className={styles.formGroup}>
                <label className={styles.label}>{t('schedules.classroomLabel')}</label>
                <input type="text" name="aula" value={formData.aula} onChange={handleInputChange} className={styles.input} required placeholder={t('schedules.classroomPlaceholder')} />
            </div>
            <div className={styles.formGroup}>
                <label className={styles.label}>{t('schedules.subjectLabel')}</label>
                <select name="imparticion" value={formData.imparticion} onChange={handleInputChange} className={styles.select} required>
                    <option value="">{t('schedules.selectSubject')}</option>
                    {imparticiones.map(i => (
                        <option key={i.id || i['@id']} value={i.id || i['@id'].split('/').pop()}>
                            {i.modulo?.nombre} - {i.grupo?.abreviatura || i.grupo?.nombre} ({i.profesor?.nombre})
                        </option>
                    ))}
                </select>
            </div>
        </ModalView>
        </Container>
    </Wrapper>
  );
};

export default Horarios;
