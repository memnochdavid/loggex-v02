import React, { useEffect, useState } from 'react';
import styles from './Usuarios.module.css'; // Reutilizamos estilos
import Button from '../components/Button';
import DataTable from '../components/DataTable';
import SearchBar from '../components/SearchBar';
import Layout from '../components/Layout';
import ModalView from '../components/ModalView'; // Importar ModalView
import { useAuth } from '../context/AuthContext';
import { usePagination } from '../hooks/usePagination';
import { Plus, Edit2, Trash2 } from 'lucide-react';

const Grupos = () => {
  const { user } = useAuth();
  const isSuperAdmin = user?.roles?.includes('ROLE_SUPERADMIN');

  const [grupos, setGrupos] = useState([]);
  const [ciclos, setCiclos] = useState([]);
  const [centros, setCentros] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  
  // Filtros
  const [selectedCentro, setSelectedCentro] = useState('');
  const [selectedCiclo, setSelectedCiclo] = useState('');
  
  // Paginación, Búsqueda y Ordenación
  const [currentPage, setCurrentPage] = useState(1);
  const [totalItems, setTotalItems] = useState(0);
  
  // Usar hook de paginación
  const [itemsPerPage, setItemsPerPage] = usePagination('grupos');

  const [searchTerm, setSearchTerm] = useState('');
  const [searchField, setSearchField] = useState('nombre');
  const [sortColumn, setSortColumn] = useState('id');
  const [sortDirection, setSortDirection] = useState('asc');

  // Campos buscables
  const searchFields = [
      { value: 'nombre', label: 'Nombre' },
      { value: 'anioEscolar', label: 'Año Escolar' }
  ];

  // Estado para el modal
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [currentGrupo, setCurrentGrupo] = useState(null);
  const [formData, setFormData] = useState({
    nombre: '',
    abreviatura: '',
    curso: 1,
    anioEscolar: new Date().getFullYear() + '-' + (new Date().getFullYear() + 1),
    ciclo: '',
    centro: ''
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

  // Cargar ciclos (filtrados por centro si se selecciona uno)
  useEffect(() => {
    let url = 'https://localhost:9443/api/ciclo_formativos?pagination=false';
    
    if (isSuperAdmin && selectedCentro) {
        url += `&centro=${selectedCentro}`;
    }
    
    fetch(url, {
        headers: { 'Accept': 'application/ld+json' },
        credentials: 'include'
    })
    .then(res => res.json())
    .then(data => {
        const items = data['hydra:member'] || data.member || [];
        setCiclos(items);
    })
    .catch(err => console.error("Error cargando ciclos:", err));
  }, [selectedCentro, isSuperAdmin]);

  // Debounce para búsqueda
  useEffect(() => {
    const timer = setTimeout(() => {
        fetchGrupos(1);
        setCurrentPage(1);
    }, 500);
    return () => clearTimeout(timer);
  }, [searchTerm, selectedCiclo, selectedCentro, searchField]);

  // Fetch al cambiar página u orden
  useEffect(() => {
    fetchGrupos(currentPage);
  }, [currentPage, sortColumn, sortDirection, itemsPerPage]);

  const handleItemsPerPageChange = (newItemsPerPage) => {
      setItemsPerPage(newItemsPerPage);
      setCurrentPage(1);
  };

  const getGrupoId = (g) => {
    if (g.id) return g.id;
    if (g['@id']) {
        const parts = g['@id'].split('/');
        return parts[parts.length - 1];
    }
    return null;
  };

  const fetchGrupos = async (page) => {
    setLoading(true);
    try {
      let url = `https://localhost:9443/api/grupos?page=${page}&itemsPerPage=${itemsPerPage}`;
      
      if (searchTerm) {
          url += `&${searchField}=${encodeURIComponent(searchTerm)}`; 
      }
      
      if (selectedCiclo) {
          url += `&ciclo=${selectedCiclo}`;
      }
      
      if (isSuperAdmin && selectedCentro) {
          url += `&centro=${selectedCentro}`;
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
      
      setGrupos(items);
      setTotalItems(total);
      setError(null);

    } catch (err) {
      console.error("Error fetching grupos:", err);
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

  const handleOpenModal = (grupo = null) => {
    if (grupo) {
      setCurrentGrupo(grupo);
      
      let cicloId = '';
      if (grupo.ciclo) {
          if (typeof grupo.ciclo === 'object') {
              cicloId = grupo.ciclo.id || (grupo.ciclo['@id'] ? grupo.ciclo['@id'].split('/').pop() : '');
          } else if (typeof grupo.ciclo === 'string') {
              cicloId = grupo.ciclo.split('/').pop();
          }
      }

      let centroId = '';
      if (grupo.centro) {
          if (typeof grupo.centro === 'object') {
              centroId = grupo.centro.id || (grupo.centro['@id'] ? grupo.centro['@id'].split('/').pop() : '');
          } else if (typeof grupo.centro === 'string') {
              centroId = grupo.centro.split('/').pop();
          }
      }

      setFormData({
        nombre: grupo.nombre,
        abreviatura: grupo.abreviatura || '',
        curso: grupo.curso,
        anioEscolar: grupo.anioEscolar,
        ciclo: cicloId,
        centro: centroId
      });
    } else {
      setCurrentGrupo(null);
      setFormData({
        nombre: '',
        abreviatura: '',
        curso: 1,
        anioEscolar: new Date().getFullYear() + '-' + (new Date().getFullYear() + 1),
        ciclo: '',
        centro: isSuperAdmin ? '' : (user.centro ? user.centro.id : '')
      });
    }
    setIsModalOpen(true);
  };

  const handleCloseModal = () => {
    setIsModalOpen(false);
    setCurrentGrupo(null);
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
      const id = currentGrupo ? getGrupoId(currentGrupo) : null;
      const url = currentGrupo 
        ? `https://localhost:9443/api/grupos/${id}`
        : 'https://localhost:9443/api/grupos';
      
      const method = currentGrupo ? 'PUT' : 'POST';

      // Asegurar que ciclo y centro sean strings antes de usar includes
      const cicloValue = String(formData.ciclo);
      const centroValue = formData.centro ? String(formData.centro) : null;

      const payload = {
        ...formData,
        curso: parseInt(formData.curso),
        ciclo: cicloValue.includes('/api/') ? cicloValue : `/api/ciclo_formativos/${cicloValue}`,
        centro: centroValue ? (centroValue.includes('/api/') ? centroValue : `/api/centros/${centroValue}`) : null
      };

      // Si no es superadmin, asignar centro automáticamente si es nuevo
      if (!isSuperAdmin && !currentGrupo && user.centro) {
          payload.centro = `/api/centros/${user.centro.id}`;
      }

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

      await fetchGrupos(currentPage);
      handleCloseModal();

    } catch (err) {
      console.error("Error saving grupo:", err);
      alert(`Error: ${err.message}`);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (grupo) => {
    if (!window.confirm('¿Estás seguro de que quieres eliminar este grupo?')) {
      return;
    }

    const id = getGrupoId(grupo);
    if (!id) return;

    try {
      const response = await fetch(`https://localhost:9443/api/grupos/${id}`, {
        method: 'DELETE',
        credentials: 'include'
      });

      if (!response.ok) {
        throw new Error('No se pudo eliminar el grupo');
      }

      fetchGrupos(currentPage);

    } catch (err) {
      console.error("Error deleting grupo:", err);
      alert(`Error al eliminar: ${err.message}`);
    }
  };

  const columns = [
    { header: 'Nombre', accessor: 'nombre', sortable: true, sortKey: 'nombre' },
    { header: 'Curso', accessor: 'curso', sortable: true, sortKey: 'curso' },
    { header: 'Año Escolar', accessor: 'anioEscolar', sortable: true, sortKey: 'anioEscolar' },
    { 
        header: 'Ciclo', 
        accessor: (row) => row.ciclo ? row.ciclo.nombre : '-', 
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
            <h1 className={styles.pageTitle}>Grupos</h1>
            
            <div className={styles.controls}>
                {isSuperAdmin && (
                    <select 
                        className={styles.select} 
                        value={selectedCentro} 
                        onChange={(e) => {
                            setSelectedCentro(e.target.value);
                            setSelectedCiclo('');
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
                    value={selectedCiclo} 
                    onChange={(e) => setSelectedCiclo(e.target.value)}
                    style={{ width: '200px' }}
                >
                    <option value="">Todos los ciclos</option>
                    {ciclos.map(c => (
                        <option key={c.id || c['@id']} value={c.id || c['@id'].split('/').pop()}>{c.nombre}</option>
                    ))}
                </select>
                
                <SearchBar 
                    value={searchTerm} 
                    onChange={setSearchTerm} 
                    placeholder="Buscar grupo..." 
                    fields={searchFields}
                    selectedField={searchField}
                    onFieldChange={setSearchField}
                />
                
                <Button onClick={() => handleOpenModal()}>
                    <Plus size={18} style={{ marginRight: '8px' }} />
                    Nuevo Grupo
                </Button>
            </div>
        </div>

        {error && (
            <div className={styles.errorContainer}>
            <p>{error}</p>
            <Button onClick={() => fetchGrupos(currentPage)} variant="secondary" style={{ marginTop: '1rem' }}>Reintentar</Button>
            </div>
        )}

        <DataTable
            columns={columns}
            data={grupos}
            totalItems={totalItems}
            itemsPerPage={itemsPerPage}
            currentPage={currentPage}
            onPageChange={setCurrentPage}
            onItemsPerPageChange={handleItemsPerPageChange}
            loading={loading}
            sortColumn={sortColumn}
            sortDirection={sortDirection}
            onSort={handleSort}
            mobileBreakpoint={'650px'}
        />

        <ModalView
            isOpen={isModalOpen}
            onClose={handleCloseModal}
            title={currentGrupo ? 'Editar Grupo' : 'Nuevo Grupo'}
            onSubmit={handleSubmit}
            isSubmitting={saving}
        >
            <div className={styles.formGroup}>
                <label className={styles.label}>Nombre del Grupo</label>
                <input
                    type="text"
                    name="nombre"
                    value={formData.nombre}
                    onChange={handleInputChange}
                    className={styles.input}
                    required
                    placeholder="Ej: 1º DAW A"
                />
            </div>

            <div className={styles.formGroup}>
                <label className={styles.label}>Abreviatura</label>
                <input
                    type="text"
                    name="abreviatura"
                    value={formData.abreviatura}
                    onChange={handleInputChange}
                    className={styles.input}
                    placeholder="Ej: 1DAWA"
                />
            </div>

            <div className={styles.formGroup}>
                <label className={styles.label}>Año Escolar</label>
                <input
                    type="text"
                    name="anioEscolar"
                    value={formData.anioEscolar}
                    onChange={handleInputChange}
                    className={styles.input}
                    required
                    placeholder="Ej: 2023-2024"
                />
            </div>

            <div className={styles.formGroup}>
                <label className={styles.label}>Ciclo Formativo</label>
                <select
                    name="ciclo"
                    value={formData.ciclo}
                    onChange={handleInputChange}
                    className={styles.select}
                    required
                >
                    <option value="">Seleccionar ciclo...</option>
                    {ciclos.map(c => (
                        <option key={c.id || c['@id']} value={c.id || c['@id']}>{c.nombre}</option>
                    ))}
                </select>
            </div>

            <div className={styles.formGroup}>
                <label className={styles.label}>Curso</label>
                <select
                    name="curso"
                    value={formData.curso}
                    onChange={handleInputChange}
                    className={styles.select}
                >
                    <option value="1">1º</option>
                    <option value="2">2º</option>
                </select>
            </div>

            {isSuperAdmin && (
                <div className={styles.formGroup}>
                    <label className={styles.label}>Centro</label>
                    <select
                        name="centro"
                        value={formData.centro}
                        onChange={handleInputChange}
                        className={styles.select}
                        required
                    >
                        <option value="">Seleccionar centro...</option>
                        {centros.map(c => (
                            <option key={c.id} value={c.id}>{c.nombre}</option>
                        ))}
                    </select>
                </div>
            )}
        </ModalView>
        </div>
    </Layout>
  );
};

export default Grupos;
