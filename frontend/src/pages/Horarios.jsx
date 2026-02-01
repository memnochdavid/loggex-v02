import React, { useEffect, useState } from 'react';
import styles from './Usuarios.module.css'; // Reutilizamos estilos
import Button from '../components/Button';
import DataTable from '../components/DataTable';
import SearchBar from '../components/SearchBar';
import Layout from '../components/Layout';
import TimeTable from '../components/TimeTable';
import CalendarView from '../components/CalendarView';
import { useAuth } from '../context/AuthContext';
import { Plus, Edit2, Trash2, X, Calendar as CalendarIcon, List } from 'lucide-react';

const Horarios = () => {
  const { user } = useAuth();
  const isSuperAdmin = user?.roles?.includes('ROLE_SUPERADMIN');
  const isAdmin = user?.roles?.includes('ROLE_ADMIN');
  const canEdit = isSuperAdmin || isAdmin;

  // Vista por defecto: Calendario para todos
  const [viewMode, setViewMode] = useState('calendar');
  const [selectedDate, setSelectedDate] = useState(new Date());

  const [horarios, setHorarios] = useState([]);
  const [mySchedule, setMySchedule] = useState([]);
  const [festivos, setFestivos] = useState([]); // Estado para festivos
  const [imparticiones, setImparticiones] = useState([]);
  const [centros, setCentros] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  
  // Filtros
  const [selectedCentro, setSelectedCentro] = useState('');
  
  // Paginación, Búsqueda y Ordenación
  const [currentPage, setCurrentPage] = useState(1);
  const [totalItems, setTotalItems] = useState(0);
  const [itemsPerPage, setItemsPerPage] = useState(20);
  const [searchTerm, setSearchTerm] = useState('');
  const [searchField, setSearchField] = useState('aula');
  const [sortColumn, setSortColumn] = useState('id');
  const [sortDirection, setSortDirection] = useState('asc');

  // Campos buscables
  const searchFields = [
      { value: 'aula', label: 'Aula' }
  ];

  // Estado para el modal
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

  const diasSemana = {
      1: 'Lunes',
      2: 'Martes',
      3: 'Miércoles',
      4: 'Jueves',
      5: 'Viernes',
      6: 'Sábado',
      7: 'Domingo'
  };

  // Cargar centros (solo SuperAdmin)
  useEffect(() => {
    if (isSuperAdmin) {
        fetch('https://localhost:9443/api/centros?pagination=false', {
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

  // Cargar imparticiones (filtradas por centro)
  useEffect(() => {
    if (!canEdit) return;

    let url = 'https://localhost:9443/api/imparticions?pagination=false';
    
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

  // Cargar Mi Horario y Festivos
  useEffect(() => {
      if (viewMode === 'calendar') {
          setLoading(true);
          
          // Cargar Horario
          const fetchSchedule = fetch('https://localhost:9443/api/my-schedule', {
              headers: { 'Accept': 'application/json' },
              credentials: 'include'
          }).then(res => res.json());

          // Cargar Festivos
          let urlFestivos = 'https://localhost:9443/api/festivos?pagination=false';
          
          const fetchFestivos = fetch(urlFestivos, {
              headers: { 'Accept': 'application/ld+json' },
              credentials: 'include'
          }).then(res => res.json());

          Promise.all([fetchSchedule, fetchFestivos])
          .then(([scheduleData, festivosData]) => {
              setMySchedule(scheduleData);
              
              let allFestivos = festivosData['hydra:member'] || festivosData.member || [];
              
              if (isSuperAdmin && selectedCentro) {
                  allFestivos = allFestivos.filter(f => {
                      if (!f.centro) return true; // Global
                      const centroId = typeof f.centro === 'string' ? f.centro.split('/').pop() : f.centro.id;
                      return String(centroId) === String(selectedCentro);
                  });
              }
              
              setFestivos(allFestivos);
              setLoading(false);
          })
          .catch(err => {
              console.error(err);
              setError("No se pudo cargar el horario o festivos.");
              setLoading(false);
          });
      }
  }, [viewMode, selectedCentro, isSuperAdmin]);

  // Debounce para búsqueda (solo lista)
  useEffect(() => {
    if (viewMode !== 'list') return;
    const timer = setTimeout(() => {
        fetchHorarios(1);
        setCurrentPage(1);
    }, 500);
    return () => clearTimeout(timer);
  }, [searchTerm, selectedCentro, searchField, viewMode]);

  // Fetch al cambiar página u orden (solo lista)
  useEffect(() => {
    if (viewMode === 'list') {
        fetchHorarios(currentPage);
    }
  }, [currentPage, sortColumn, sortDirection, itemsPerPage, viewMode]);

  const handleItemsPerPageChange = (newItemsPerPage) => {
      setItemsPerPage(newItemsPerPage);
      setCurrentPage(1);
  };

  const getHorarioId = (h) => {
    if (h.id) return h.id;
    if (h['@id']) {
        const parts = h['@id'].split('/');
        return parts[parts.length - 1];
    }
    return null;
  };

  const fetchHorarios = async (page) => {
    setLoading(true);
    try {
      let url = `https://localhost:9443/api/horarios?page=${page}&itemsPerPage=${itemsPerPage}`;
      
      if (searchTerm) {
          url += `&${searchField}=${encodeURIComponent(searchTerm)}`; 
      }
      
      if (sortColumn) {
          url += `&order[${sortColumn}]=${sortDirection}`;
      }

      const response = await fetch(url, {
        headers: {
          'Accept': 'application/ld+json',
        },
        credentials: 'include'
      });

      if (!response.ok) {
        throw new Error(`Error ${response.status}: ${response.statusText}`);
      }

      const data = await response.json();
      const items = data['hydra:member'] || data.member || [];
      const total = data['hydra:totalItems'] || data.totalItems || items.length;
      
      setHorarios(items);
      setTotalItems(total);
      setError(null);

    } catch (err) {
      console.error("Error fetching horarios:", err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleSort = (columnKey) => {
      if (sortColumn === columnKey) {
          setSortDirection(prev => prev === 'asc' ? 'desc' : 'asc');
      } else {
          setSortColumn(columnKey);
          setSortDirection('asc');
      }
  };

  const handleOpenModal = (horario = null) => {
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
  };

  const handleCloseModal = () => {
    setIsModalOpen(false);
    setCurrentHorario(null);
  };

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);

    try {
      const id = currentHorario ? getHorarioId(currentHorario) : null;
      const url = currentHorario 
        ? `https://localhost:9443/api/horarios/${id}`
        : 'https://localhost:9443/api/horarios';
      
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

      await fetchHorarios(currentPage);
      handleCloseModal();

    } catch (err) {
      console.error("Error saving horario:", err);
      alert(`Error: ${err.message}`);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (horario) => {
    if (!window.confirm('¿Estás seguro de que quieres eliminar este horario?')) {
      return;
    }

    const id = getHorarioId(horario);
    if (!id) return;

    try {
      const response = await fetch(`https://localhost:9443/api/horarios/${id}`, {
        method: 'DELETE',
        credentials: 'include'
      });

      if (!response.ok) {
        throw new Error('No se pudo eliminar el horario');
      }

      fetchHorarios(currentPage);

    } catch (err) {
      console.error("Error deleting horario:", err);
      alert(`Error al eliminar: ${err.message}`);
    }
  };

  const columns = [
    { 
        header: 'Día', 
        accessor: (row) => diasSemana[row.diaSemana] || row.diaSemana, 
        sortable: true, 
        sortKey: 'diaSemana' 
    },
    { 
        header: 'Hora', 
        accessor: (row) => {
            const start = new Date(row.horaInicio).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
            const end = new Date(row.horaFin).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
            return `${start} - ${end}`;
        }, 
        sortable: true, 
        sortKey: 'horaInicio' 
    },
    { header: 'Aula', accessor: 'aula', sortable: true, sortKey: 'aula' },
    { 
        header: 'Asignatura', 
        accessor: (row) => row.imparticion && row.imparticion.modulo ? row.imparticion.modulo.nombre : '-', 
        sortable: false 
    },
    { 
        header: 'Profesor', 
        accessor: (row) => row.imparticion && row.imparticion.profesor ? `${row.imparticion.profesor.nombre} ${row.imparticion.profesor.apellidos}` : '-', 
        sortable: false 
    },
    { 
        header: 'Acciones',
        accessor: (row) => (
            <div className={styles.actions}>
                <button 
                    className={styles.iconButton} 
                    onClick={() => handleOpenModal(row)}
                    title="Editar"
                >
                    <Edit2 size={18} />
                </button>
                <button 
                    className={`${styles.iconButton} ${styles.danger}`} 
                    onClick={() => handleDelete(row)}
                    title="Eliminar"
                >
                    <Trash2 size={18} />
                </button>
            </div>
        ),
        sortable: false
    }
  ];

  return (
    <Layout>
        <div className={styles.container}>
        <div className={styles.header}>
            <h1 className={styles.pageTitle}>Horarios</h1>
            
            <div className={styles.controls}>
                {/* Selector de vista (Lista / Calendario) */}
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
                            placeholder="Buscar aula..." 
                            fields={searchFields}
                            selectedField={searchField}
                            onFieldChange={setSearchField}
                        />
                        
                        <Button onClick={() => handleOpenModal()}>
                            <Plus size={18} style={{ marginRight: '8px' }} />
                            Nuevo Horario
                        </Button>
                    </>
                )}
            </div>
        </div>

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
            <div style={{ display: 'flex', gap: '2rem', alignItems: 'flex-start', flexWrap: 'wrap' }}>
                <div style={{ flex: 1, minWidth: '300px' }}>
                    <TimeTable 
                        events={mySchedule} 
                        festivos={festivos} 
                        title="Mi Horario" 
                        selectedDate={selectedDate}
                    />
                </div>
                <div style={{ flexShrink: 0, width: '100%', maxWidth: '350px' }}>
                    <CalendarView 
                        selectedDate={selectedDate} 
                        onDateSelect={setSelectedDate}
                    />
                </div>
            </div>
        )}

        {/* Modal */}
        {isModalOpen && (
            <div className={styles.modalOverlay} onClick={handleCloseModal}>
            <div className={styles.modal} onClick={e => e.stopPropagation()}>
                <div className={styles.modalHeader}>
                <h3 className={styles.modalTitle}>
                    {currentHorario ? 'Editar Horario' : 'Nuevo Horario'}
                </h3>
                <button className={styles.closeButton} onClick={handleCloseModal}>
                    <X size={20} />
                </button>
                </div>
                
                <form onSubmit={handleSubmit}>
                <div className={styles.modalBody}>
                    <div className={styles.formGroup}>
                        <label className={styles.label}>Día de la Semana</label>
                        <select
                            name="diaSemana"
                            value={formData.diaSemana}
                            onChange={handleInputChange}
                            className={styles.select}
                        >
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
                        <input
                            type="time"
                            name="horaInicio"
                            value={formData.horaInicio}
                            onChange={handleInputChange}
                            className={styles.input}
                            required
                        />
                    </div>

                    <div className={styles.formGroup}>
                        <label className={styles.label}>Hora Fin</label>
                        <input
                            type="time"
                            name="horaFin"
                            value={formData.horaFin}
                            onChange={handleInputChange}
                            className={styles.input}
                            required
                        />
                    </div>

                    <div className={styles.formGroup}>
                        <label className={styles.label}>Aula</label>
                        <input
                            type="text"
                            name="aula"
                            value={formData.aula}
                            onChange={handleInputChange}
                            className={styles.input}
                            required
                            placeholder="Ej: Aula 101"
                        />
                    </div>

                    <div className={styles.formGroup}>
                        <label className={styles.label}>Asignatura (Impartición)</label>
                        <select
                            name="imparticion"
                            value={formData.imparticion}
                            onChange={handleInputChange}
                            className={styles.select}
                            required
                        >
                            <option value="">Seleccionar asignatura...</option>
                            {imparticiones.map(i => (
                                <option key={i.id || i['@id']} value={i.id || i['@id'].split('/').pop()}>
                                    {i.modulo?.nombre} - {i.grupo?.nombre} ({i.profesor?.nombre})
                                </option>
                            ))}
                        </select>
                    </div>
                </div>

                <div className={styles.modalFooter}>
                    <Button type="button" variant="secondary" onClick={handleCloseModal}>
                    Cancelar
                    </Button>
                    <Button type="submit" disabled={saving}>
                    {saving ? 'Guardando...' : 'Guardar'}
                    </Button>
                </div>
                </form>
            </div>
            </div>
        )}
        </div>
    </Layout>
  );
};

export default Horarios;
