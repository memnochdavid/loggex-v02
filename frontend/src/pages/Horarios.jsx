import React, { useEffect, useState, useRef, useCallback, useMemo } from 'react';
import styles from './Horarios.module.css';
import Button from '../components/Button';
import DataTable from '../components/DataTable';
import SearchBar from '../components/SearchBar';
import Layout from '../components/Layout';
import TimeTable from '../components/TimeTable';
import EventsSidebar from '../components/EventsSidebar';
import ModalView from '../components/ModalView';
import CrudHeader from '../components/CrudHeader';
import { useAuth } from '../context/AuthContext';
import { Plus, Edit2, Trash2, Calendar as CalendarIcon, List, PanelRightOpen, PanelRightClose } from 'lucide-react';
import { getApiUrl } from '../config/api';
import useMediaQuery from '../hooks/useMediaQuery';
import { usePagination } from '../hooks/usePagination';

const Horarios = () => {
  const { user } = useAuth();
  const isSuperAdmin = user?.roles?.includes('ROLE_SUPERADMIN');
  const isAdmin = user?.roles?.includes('ROLE_ADMIN');
  const canEdit = isSuperAdmin || isAdmin;
  
  const isMobile = useMediaQuery('(max-width: 1200px)');

  const [viewMode, setViewMode] = useState('calendar');
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
      { value: 'aula', label: 'Aula' },
      { value: 'imparticion.modulo.nombre', label: 'Asignatura' },
      { value: 'imparticion.profesor.nombre', label: 'Profesor' },
      { value: 'diaSemana', label: 'Día' }
  ];

  const diasSemana = {
      1: 'Lunes', 2: 'Martes', 3: 'Miércoles', 4: 'Jueves', 5: 'Viernes', 6: 'Sábado', 7: 'Domingo'
  };

  const diasSemanaInverso = {
      'lunes': 1, 'martes': 2, 'miércoles': 3, 'miercoles': 3, 
      'jueves': 4, 'viernes': 5, 'sábado': 6, 'sabado': 6, 'domingo': 7
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
          
          const fetchSchedule = fetch(getApiUrl('/api/my-schedule'), {
              headers: { 'Accept': 'application/json' },
              credentials: 'include'
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
              setError("No se pudo cargar el horario o eventos.");
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
        const errorMessage = errorData['hydra:description'] || errorData.detail || errorData.message || 'Error al guardar';
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
      alert(`Error: ${err.message}`);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = useCallback(async (horario) => {
    if (!window.confirm('¿Estás seguro de que quieres eliminar este horario?')) return;

    const id = getHorarioId(horario);
    if (!id) return;

    try {
      const response = await fetch(getApiUrl(`/api/horarios/${id}`), {
        method: 'DELETE',
        credentials: 'include'
      });

      if (!response.ok) throw new Error('No se pudo eliminar el horario');
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
      alert(`Error al eliminar: ${err.message}`);
    }
  }, [currentPage, itemsPerPage, searchTerm, searchField, sortColumn, sortDirection, fetchHorariosData]);

  const columns = useMemo(() => [
    { 
        header: 'Día', 
        accessor: (row) => diasSemana[row.diaSemana] || row.diaSemana, 
        sortable: true, sortKey: 'diaSemana' 
    },
    { 
        header: 'Hora', 
        accessor: (row) => {
            const start = new Date(row.horaInicio).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
            const end = new Date(row.horaFin).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
            return `${start} - ${end}`;
        }, 
        sortable: true, sortKey: 'horaInicio' 
    },
    { header: 'Aula', accessor: 'aula', sortable: true, sortKey: 'aula' },
    { 
        header: 'Asignatura', 
        accessor: (row) => row.imparticion && row.imparticion.modulo ? row.imparticion.modulo.nombre : '-', 
        sortable: true, sortKey: 'imparticion.modulo.nombre'
    },
    { 
        header: 'Profesor', 
        accessor: (row) => row.imparticion && row.imparticion.profesor ? `${row.imparticion.profesor.nombre} ${row.imparticion.profesor.apellidos}` : '-', 
        sortable: true, sortKey: 'imparticion.profesor.nombre'
    },
    { 
        header: 'Acciones', 
        accessor: (row) => (
            <div className={styles.actions}>
                <button className={styles.iconButton} onClick={() => handleOpenModal(row)} title="Editar"><Edit2 size={18} /></button>
                <button className={`${styles.iconButton} ${styles.danger}`} onClick={() => handleDelete(row)} title="Eliminar"><Trash2 size={18} /></button>
            </div>
        ),
        sortable: false
    }
  ], [handleOpenModal, handleDelete]);

  return (
    <Layout>
        <div className={styles.container}>
        <CrudHeader title="Horarios">
            <div style={{ display: 'flex', gap: '0.5rem', marginRight: '1rem' }}>
                <Button 
                    variant={viewMode === 'calendar' ? 'primary' : 'secondary'}
                    onClick={() => setViewMode('calendar')}
                    title="Vista Calendario"
                >
                    <CalendarIcon size={18} />
                </Button>
                {canEdit && (
                    <Button 
                        variant={viewMode === 'list' ? 'primary' : 'secondary'}
                        onClick={() => setViewMode('list')}
                        title="Vista Lista (Gestión)"
                    >
                        <List size={18} />
                    </Button>
                )}
                
                {viewMode === 'calendar' && isMobile && (
                    <Button 
                        variant="secondary"
                        onClick={() => setIsSidebarOpen(true)}
                        title="Ver Calendario y Eventos"
                    >
                        <PanelRightOpen size={18} />
                    </Button>
                )}
            </div>

            {viewMode === 'list' && isSuperAdmin && (
                <select 
                    className={styles.select} 
                    value={selectedCentro} 
                    onChange={(e) => setSelectedCentro(e.target.value)}
                    style={{ width: '200px' }}
                >
                    <option value="">Todos los centros</option>
                    {centros.map(c => (
                        <option key={c.id} value={c.id}>{c.nombre}</option>
                    ))}
                </select>
            )}
            
            {viewMode === 'list' && (
                <>
                    <SearchBar 
                        value={searchTerm} 
                        onChange={setSearchTerm} 
                        placeholder="Buscar..." 
                        fields={searchFields}
                        selectedField={searchField}
                        onFieldChange={setSearchField}
                    />
                    <Button onClick={() => handleOpenModal()}>
                        <Plus size={18} style={{ marginRight: '8px' }} /> Nuevo
                    </Button>
                </>
            )}
        </CrudHeader>

        {error && (
            <div className={styles.errorContainer}>
            <p>{error}</p>
            <Button onClick={() => window.location.reload()} variant="secondary" style={{ marginTop: '1rem' }}>Reintentar</Button>
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
                        <h3 className={styles.sectionTitle}>Calendario y Eventos</h3>
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
            title={currentHorario ? 'Editar Horario' : 'Nuevo Horario'}
            onSubmit={handleSubmit}
            isSubmitting={saving}
        >
            <div className={styles.formGroup}>
                <label className={styles.label}>Día de la Semana</label>
                <select name="diaSemana" value={formData.diaSemana} onChange={handleInputChange} className={styles.select}>
                    <option value="1">Lunes</option>
                    <option value="2">Martes</option>
                    <option value="3">Miércoles</option>
                    <option value="4">Jueves</option>
                    <option value="5">Viernes</option>
                    <option value="6">Sábado</option>
                    <option value="7">Domingo</option>
                </select>
            </div>
            <div className={styles.formGroup}>
                <label className={styles.label}>Hora Inicio</label>
                <input type="time" name="horaInicio" value={formData.horaInicio} onChange={handleInputChange} className={styles.input} required />
            </div>
            <div className={styles.formGroup}>
                <label className={styles.label}>Hora Fin</label>
                <input type="time" name="horaFin" value={formData.horaFin} onChange={handleInputChange} className={styles.input} required />
            </div>
            <div className={styles.formGroup}>
                <label className={styles.label}>Aula</label>
                <input type="text" name="aula" value={formData.aula} onChange={handleInputChange} className={styles.input} required placeholder="Ej: Aula 101" />
            </div>
            <div className={styles.formGroup}>
                <label className={styles.label}>Asignatura (Impartición)</label>
                <select name="imparticion" value={formData.imparticion} onChange={handleInputChange} className={styles.select} required>
                    <option value="">Seleccionar asignatura...</option>
                    {imparticiones.map(i => (
                        <option key={i.id || i['@id']} value={i.id || i['@id'].split('/').pop()}>
                            {i.modulo?.nombre} - {i.grupo?.nombre} ({i.profesor?.nombre})
                        </option>
                    ))}
                </select>
            </div>
        </ModalView>
        </div>
    </Layout>
  );
};

export default Horarios;
