import React, { useEffect, useState } from 'react';
import styles from './Usuarios.module.css'; // Reutilizamos estilos
import Button from '../components/Button';
import DataTable from '../components/DataTable';
import SearchBar from '../components/SearchBar';
import Layout from '../components/Layout';
import { useAuth } from '../context/AuthContext';
import { Plus, Edit2, Trash2, X } from 'lucide-react';

const Matriculas = () => {
  const { user } = useAuth();
  const isSuperAdmin = user?.roles?.includes('ROLE_SUPERADMIN');

  const [matriculas, setMatriculas] = useState([]);
  const [grupos, setGrupos] = useState([]);
  const [alumnos, setAlumnos] = useState([]);
  const [centros, setCentros] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  
  // Filtros
  const [selectedCentro, setSelectedCentro] = useState('');
  const [selectedGrupo, setSelectedGrupo] = useState('');
  
  // Paginación, Búsqueda y Ordenación
  const [currentPage, setCurrentPage] = useState(1);
  const [totalItems, setTotalItems] = useState(0);
  
  // Inicializar itemsPerPage desde la configuración del usuario
  const [itemsPerPage, setItemsPerPage] = useState(() => {
      if (user?.centro?.personalizacion?.itemsPerPageMatriculas) {
          return user.centro.personalizacion.itemsPerPageMatriculas;
      }
      return 20;
  });

  const [searchTerm, setSearchTerm] = useState('');
  const [searchField, setSearchField] = useState('alumno.nombre');
  const [sortColumn, setSortColumn] = useState('id');
  const [sortDirection, setSortDirection] = useState('asc');

  // Campos buscables
  const searchFields = [
      { value: 'alumno.nombre', label: 'Alumno' },
      { value: 'grupo.nombre', label: 'Grupo' }
  ];

  // Estado para el modal
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [currentMatricula, setCurrentMatricula] = useState(null);
  const [formData, setFormData] = useState({
    alumno: '',
    grupo: ''
  });
  const [saving, setSaving] = useState(false);

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

  // Cargar grupos y alumnos (filtrados por centro si se selecciona uno)
  useEffect(() => {
    let urlGrupos = 'https://localhost:9443/api/grupos?pagination=false';
    let urlAlumnos = 'https://localhost:9443/api/users?pagination=false&rol_app=alumno';
    
    if (isSuperAdmin && selectedCentro) {
        urlGrupos += `&centro=${selectedCentro}`;
        urlAlumnos += `&centro=${selectedCentro}`;
    }
    
    // Cargar Grupos
    fetch(urlGrupos, {
        headers: { 'Accept': 'application/ld+json' },
        credentials: 'include'
    })
    .then(res => res.json())
    .then(data => {
        const items = data['hydra:member'] || data.member || [];
        setGrupos(items);
    })
    .catch(err => console.error("Error cargando grupos:", err));

    // Cargar Alumnos
    fetch(urlAlumnos, {
        headers: { 'Accept': 'application/ld+json' },
        credentials: 'include'
    })
    .then(res => res.json())
    .then(data => {
        const items = data['hydra:member'] || data.member || [];
        setAlumnos(items);
    })
    .catch(err => console.error("Error cargando alumnos:", err));

  }, [selectedCentro, isSuperAdmin]);

  // Debounce para búsqueda
  useEffect(() => {
    const timer = setTimeout(() => {
        fetchMatriculas(1);
        setCurrentPage(1);
    }, 500);
    return () => clearTimeout(timer);
  }, [searchTerm, selectedGrupo, selectedCentro, searchField]);

  // Fetch al cambiar página u orden
  useEffect(() => {
    fetchMatriculas(currentPage);
  }, [currentPage, sortColumn, sortDirection, itemsPerPage]);

  const handleItemsPerPageChange = (newItemsPerPage) => {
      setItemsPerPage(newItemsPerPage);
      setCurrentPage(1);
  };

  const getMatriculaId = (m) => {
    if (m.id) return m.id;
    if (m['@id']) {
        const parts = m['@id'].split('/');
        return parts[parts.length - 1];
    }
    return null;
  };

  const fetchMatriculas = async (page) => {
    setLoading(true);
    try {
      let url = `https://localhost:9443/api/matriculas?page=${page}&itemsPerPage=${itemsPerPage}`;
      
      if (searchTerm) {
          url += `&${searchField}=${encodeURIComponent(searchTerm)}`; 
      }
      
      if (selectedGrupo) {
          url += `&grupo=${selectedGrupo}`;
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
      
      setMatriculas(items);
      setTotalItems(total);
      setError(null);

    } catch (err) {
      console.error("Error fetching matriculas:", err);
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

  const handleOpenModal = (matricula = null) => {
    if (matricula) {
      setCurrentMatricula(matricula);
      
      // Función robusta para obtener ID
      const getId = (obj) => {
          if (!obj) return '';
          if (typeof obj === 'object') {
              return obj.id || (obj['@id'] ? obj['@id'].split('/').pop() : '');
          }
          if (typeof obj === 'string') {
              return obj.split('/').pop();
          }
          return obj;
      };

      setFormData({
        alumno: getId(matricula.alumno),
        grupo: getId(matricula.grupo)
      });
    } else {
      setCurrentMatricula(null);
      setFormData({
        alumno: '',
        grupo: ''
      });
    }
    setIsModalOpen(true);
  };

  const handleCloseModal = () => {
    setIsModalOpen(false);
    setCurrentMatricula(null);
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
      const id = currentMatricula ? getMatriculaId(currentMatricula) : null;
      const url = currentMatricula 
        ? `https://localhost:9443/api/matriculas/${id}`
        : 'https://localhost:9443/api/matriculas';
      
      const method = currentMatricula ? 'PUT' : 'POST';

      const alumnoValue = String(formData.alumno);
      const grupoValue = String(formData.grupo);

      const payload = {
        alumno: alumnoValue.includes('/api/') ? alumnoValue : `/api/users/${alumnoValue}`,
        grupo: grupoValue.includes('/api/') ? grupoValue : `/api/grupos/${grupoValue}`
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

      await fetchMatriculas(currentPage);
      handleCloseModal();

    } catch (err) {
      console.error("Error saving matricula:", err);
      alert(`Error: ${err.message}`);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (matricula) => {
    if (!window.confirm('¿Estás seguro de que quieres eliminar esta matrícula?')) {
      return;
    }

    const id = getMatriculaId(matricula);
    if (!id) return;

    try {
      const response = await fetch(`https://localhost:9443/api/matriculas/${id}`, {
        method: 'DELETE',
        credentials: 'include'
      });

      if (!response.ok) {
        throw new Error('No se pudo eliminar la matrícula');
      }

      fetchMatriculas(currentPage);

    } catch (err) {
      console.error("Error deleting matricula:", err);
      alert(`Error al eliminar: ${err.message}`);
    }
  };

  const columns = [
    { 
        header: 'Alumno', 
        accessor: (row) => row.alumno ? `${row.alumno.nombre} ${row.alumno.apellidos}` : '-', 
        sortable: true, 
        sortKey: 'alumno.nombre' 
    },
    { 
        header: 'Grupo', 
        accessor: (row) => row.grupo ? `${row.grupo.curso}º ${row.grupo.nombre}` : '-', 
        sortable: true, 
        sortKey: 'grupo.nombre' 
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
            <h1 className={styles.pageTitle}>Matrículas</h1>
            
            <div className={styles.controls}>
                {isSuperAdmin && (
                    <select 
                        className={styles.select} 
                        value={selectedCentro} 
                        onChange={(e) => {
                            setSelectedCentro(e.target.value);
                            setSelectedGrupo('');
                        }}
                        style={{ width: '200px' }}
                    >
                        <option value="">Todos los centros</option>
                        {centros.map(c => (
                            <option key={c.id} value={c.id}>{c.nombre}</option>
                        ))}
                    </select>
                )}

                <select 
                    className={styles.select} 
                    value={selectedGrupo} 
                    onChange={(e) => setSelectedGrupo(e.target.value)}
                    style={{ width: '200px' }}
                >
                    <option value="">Todos los grupos</option>
                    {grupos.map(g => (
                        <option key={g.id || g['@id']} value={g.id || g['@id'].split('/').pop()}>
                            {g.curso}º {g.nombre}
                        </option>
                    ))}
                </select>
                
                <SearchBar 
                    value={searchTerm} 
                    onChange={setSearchTerm} 
                    placeholder="Buscar matrícula..." 
                    fields={searchFields}
                    selectedField={searchField}
                    onFieldChange={setSearchField}
                />
                
                <Button onClick={() => handleOpenModal()}>
                    <Plus size={18} style={{ marginRight: '8px' }} />
                    Nueva Matrícula
                </Button>
            </div>
        </div>

        {error && (
            <div className={styles.errorContainer}>
            <p>{error}</p>
            <Button onClick={() => fetchMatriculas(currentPage)} variant="secondary" style={{ marginTop: '1rem' }}>Reintentar</Button>
            </div>
        )}

        <DataTable
            columns={columns}
            data={matriculas}
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

        {/* Modal */}
        {isModalOpen && (
            <div className={styles.modalOverlay} onClick={handleCloseModal}>
            <div className={styles.modal} onClick={e => e.stopPropagation()}>
                <div className={styles.modalHeader}>
                <h3 className={styles.modalTitle}>
                    {currentMatricula ? 'Editar Matrícula' : 'Nueva Matrícula'}
                </h3>
                <button className={styles.closeButton} onClick={handleCloseModal}>
                    <X size={20} />
                </button>
                </div>
                
                <form onSubmit={handleSubmit}>
                <div className={styles.modalBody}>
                    <div className={styles.formGroup}>
                        <label className={styles.label}>Alumno</label>
                        <select
                            name="alumno"
                            value={formData.alumno}
                            onChange={handleInputChange}
                            className={styles.select}
                            required
                        >
                            <option value="">Seleccionar alumno...</option>
                            {alumnos.map(a => (
                                <option key={a.id || a['@id']} value={a.id || a['@id'].split('/').pop()}>
                                    {a.nombre} {a.apellidos} ({a.email})
                                </option>
                            ))}
                        </select>
                    </div>

                    <div className={styles.formGroup}>
                        <label className={styles.label}>Grupo</label>
                        <select
                            name="grupo"
                            value={formData.grupo}
                            onChange={handleInputChange}
                            className={styles.select}
                            required
                        >
                            <option value="">Seleccionar grupo...</option>
                            {grupos.map(g => (
                                <option key={g.id || g['@id']} value={g.id || g['@id'].split('/').pop()}>
                                    {g.curso}º {g.nombre}
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

export default Matriculas;
