import React, { useEffect, useState } from 'react';
import styles from './Usuarios.module.css'; // Reutilizamos estilos
import Button from '../components/Button';
import DataTable from '../components/DataTable';
import SearchBar from '../components/SearchBar';
import Layout from '../components/Layout';
import { useAuth } from '../context/AuthContext';
import { Plus, Edit2, Trash2, X } from 'lucide-react';

const Modulos = () => {
  const { user } = useAuth();
  const isSuperAdmin = user?.roles?.includes('ROLE_SUPERADMIN');

  const [modulos, setModulos] = useState([]);
  const [ciclos, setCiclos] = useState([]);
  const [centros, setCentros] = useState([]); // Para SuperAdmin
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  
  // Filtros
  const [selectedCentro, setSelectedCentro] = useState('');
  const [selectedCiclo, setSelectedCiclo] = useState('');
  
  // Paginación, Búsqueda y Ordenación
  const [currentPage, setCurrentPage] = useState(1);
  const [totalItems, setTotalItems] = useState(0);
  
  // Inicializar itemsPerPage desde la configuración del usuario
  const [itemsPerPage, setItemsPerPage] = useState(() => {
      if (user?.centro?.personalizacion?.itemsPerPageModulos) {
          return user.centro.personalizacion.itemsPerPageModulos;
      }
      return 20;
  });

  const [searchTerm, setSearchTerm] = useState('');
  const [searchField, setSearchField] = useState('nombre');
  const [sortColumn, setSortColumn] = useState('id');
  const [sortDirection, setSortDirection] = useState('asc');

  // Campos buscables
  const searchFields = [
      { value: 'nombre', label: 'Nombre' },
      { value: 'codigoOficial', label: 'Código' },
      { value: 'ciclo.nombre', label: 'Ciclo' }
  ];

  // Estado para el modal
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [currentModulo, setCurrentModulo] = useState(null);
  const [formData, setFormData] = useState({
    nombre: '',
    codigoOficial: '',
    curso: 1,
    horasSemanales: 0,
    ciclo: ''
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

  // Cargar ciclos (filtrados por centro si se selecciona uno, o todos si es admin de centro)
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
        fetchModulos(1);
        setCurrentPage(1);
    }, 500);
    return () => clearTimeout(timer);
  }, [searchTerm, selectedCiclo, selectedCentro, searchField]); // Añadido selectedCentro

  // Fetch al cambiar página u orden
  useEffect(() => {
    fetchModulos(currentPage);
  }, [currentPage, sortColumn, sortDirection, itemsPerPage]);

  const handleItemsPerPageChange = (newItemsPerPage) => {
      setItemsPerPage(newItemsPerPage);
      setCurrentPage(1);
  };

  const getModuloId = (m) => {
    if (m.id) return m.id;
    if (m['@id']) {
        const parts = m['@id'].split('/');
        return parts[parts.length - 1];
    }
    return null;
  };

  const fetchModulos = async (page) => {
    setLoading(true);
    try {
      let url = `https://localhost:9443/api/modulos?page=${page}&itemsPerPage=${itemsPerPage}`;
      
      if (searchTerm) {
          url += `&${searchField}=${encodeURIComponent(searchTerm)}`; 
      }
      
      if (selectedCiclo) {
          url += `&ciclo=${selectedCiclo}`;
      } else if (isSuperAdmin && selectedCentro) {
          // Si no hay ciclo seleccionado pero sí centro, filtrar por centro del ciclo
          url += `&ciclo.centro=${selectedCentro}`;
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
      
      setModulos(items);
      setTotalItems(total);
      setError(null);

    } catch (err) {
      console.error("Error fetching modulos:", err);
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

  const handleOpenModal = (modulo = null) => {
    if (modulo) {
      setCurrentModulo(modulo);
      
      // Extraer ID del ciclo de forma segura
      let cicloId = '';
      if (modulo.ciclo) {
          if (typeof modulo.ciclo === 'object') {
              cicloId = modulo.ciclo.id || (modulo.ciclo['@id'] ? modulo.ciclo['@id'].split('/').pop() : '');
          } else if (typeof modulo.ciclo === 'string') {
              cicloId = modulo.ciclo.split('/').pop();
          }
      }

      setFormData({
        nombre: modulo.nombre,
        codigoOficial: modulo.codigoOficial || '',
        curso: modulo.curso,
        horasSemanales: modulo.horasSemanales,
        ciclo: cicloId
      });
    } else {
      setCurrentModulo(null);
      setFormData({
        nombre: '',
        codigoOficial: '',
        curso: 1,
        horasSemanales: 0,
        ciclo: ''
      });
    }
    setIsModalOpen(true);
  };

  const handleCloseModal = () => {
    setIsModalOpen(false);
    setCurrentModulo(null);
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
      const id = currentModulo ? getModuloId(currentModulo) : null;
      const url = currentModulo 
        ? `https://localhost:9443/api/modulos/${id}`
        : 'https://localhost:9443/api/modulos';
      
      const method = currentModulo ? 'PUT' : 'POST';

      const cicloValue = String(formData.ciclo);
      const payload = {
        ...formData,
        curso: parseInt(formData.curso),
        horasSemanales: parseInt(formData.horasSemanales),
        // Asegurar formato IRI para relación
        ciclo: cicloValue.includes('/api/') ? cicloValue : `/api/ciclo_formativos/${cicloValue}`
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

      await fetchModulos(currentPage);
      handleCloseModal();

    } catch (err) {
      console.error("Error saving modulo:", err);
      alert(`Error: ${err.message}`);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (modulo) => {
    if (!window.confirm('¿Estás seguro de que quieres eliminar este módulo?')) {
      return;
    }

    const id = getModuloId(modulo);
    if (!id) return;

    try {
      const response = await fetch(`https://localhost:9443/api/modulos/${id}`, {
        method: 'DELETE',
        credentials: 'include'
      });

      if (!response.ok) {
        throw new Error('No se pudo eliminar el módulo');
      }

      fetchModulos(currentPage);

    } catch (err) {
      console.error("Error deleting modulo:", err);
      alert(`Error al eliminar: ${err.message}`);
    }
  };

  const columns = [
    { header: 'Nombre', accessor: 'nombre', sortable: true, sortKey: 'nombre' },
    { header: 'Código', accessor: 'codigoOficial', sortable: true, sortKey: 'codigoOficial' },
    { header: 'Curso', accessor: 'curso', sortable: true, sortKey: 'curso' },
    { 
        header: 'Ciclo', 
        accessor: (row) => row.ciclo ? row.ciclo.nombre : '-', 
        sortable: true, 
        sortKey: 'ciclo.nombre' 
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
            <h1 className={styles.pageTitle}>Módulos Formativos</h1>
            
            <div className={styles.controls}>
                {isSuperAdmin && (
                    <select 
                        className={styles.select} 
                        value={selectedCentro} 
                        onChange={(e) => {
                            setSelectedCentro(e.target.value);
                            setSelectedCiclo(''); // Resetear ciclo al cambiar centro
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
                    placeholder="Buscar módulo..." 
                    fields={searchFields}
                    selectedField={searchField}
                    onFieldChange={setSearchField}
                />
                
                <Button onClick={() => handleOpenModal()}>
                    <Plus size={18} style={{ marginRight: '8px' }} />
                    Nuevo Módulo
                </Button>
            </div>
        </div>

        {error && (
            <div className={styles.errorContainer}>
            <p>{error}</p>
            <Button onClick={() => fetchModulos(currentPage)} variant="secondary" style={{ marginTop: '1rem' }}>Reintentar</Button>
            </div>
        )}

        <DataTable
            columns={columns}
            data={modulos}
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
                    {currentModulo ? 'Editar Módulo' : 'Nuevo Módulo'}
                </h3>
                <button className={styles.closeButton} onClick={handleCloseModal}>
                    <X size={20} />
                </button>
                </div>
                
                <form onSubmit={handleSubmit}>
                <div className={styles.modalBody}>
                    <div className={styles.formGroup}>
                        <label className={styles.label}>Nombre del Módulo</label>
                        <input
                            type="text"
                            name="nombre"
                            value={formData.nombre}
                            onChange={handleInputChange}
                            className={styles.input}
                            required
                            placeholder="Ej: Bases de Datos"
                        />
                    </div>

                    <div className={styles.formGroup}>
                        <label className={styles.label}>Código Oficial</label>
                        <input
                            type="text"
                            name="codigoOficial"
                            value={formData.codigoOficial}
                            onChange={handleInputChange}
                            className={styles.input}
                            placeholder="Ej: 0484"
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

                    <div className={styles.formGroup}>
                        <label className={styles.label}>Horas Semanales</label>
                        <input
                            type="number"
                            name="horasSemanales"
                            value={formData.horasSemanales}
                            onChange={handleInputChange}
                            className={styles.input}
                            min="1"
                            max="30"
                        />
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

export default Modulos;
