import React, { useEffect, useState } from 'react';
import styles from './Usuarios.module.css'; // Reutilizamos estilos por ahora
import Button from '../components/Button';
import DataTable from '../components/DataTable';
import SearchBar from '../components/SearchBar';
import Layout from '../components/Layout';
import { useAuth } from '../context/AuthContext';
import { usePagination } from '../hooks/usePagination'; // Importar hook
import { Plus, Edit2, Trash2, X } from 'lucide-react';

const CiclosFormativos = () => {
  const { user } = useAuth();
  const isSuperAdmin = user?.roles?.includes('ROLE_SUPERADMIN');

  const [ciclos, setCiclos] = useState([]);
  const [centros, setCentros] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  
  // Filtros
  const [selectedCentro, setSelectedCentro] = useState('');
  
  // Paginación, Búsqueda y Ordenación
  const [currentPage, setCurrentPage] = useState(1);
  const [totalItems, setTotalItems] = useState(0);
  
  // Usar hook de paginación
  const [itemsPerPage, setItemsPerPage] = usePagination('ciclos');

  const [searchTerm, setSearchTerm] = useState('');
  const [searchField, setSearchField] = useState('nombre');
  const [sortColumn, setSortColumn] = useState('id');
  const [sortDirection, setSortDirection] = useState('asc');

  // Campos buscables
  const searchFields = [
      { value: 'nombre', label: 'Nombre' },
      { value: 'nivel', label: 'Nivel' }
  ];

  // Estado para el modal
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [currentCiclo, setCurrentCiclo] = useState(null);
  const [formData, setFormData] = useState({
    nombre: '',
    nivel: 'Superior', // Default
    centro: ''
  });
  const [saving, setSaving] = useState(false);

  // Cargar centros para el selector (solo si es SuperAdmin)
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

  // Debounce para búsqueda
  useEffect(() => {
    const timer = setTimeout(() => {
        fetchCiclos(1);
        setCurrentPage(1);
    }, 500);
    return () => clearTimeout(timer);
  }, [searchTerm, selectedCentro, searchField]);

  // Fetch al cambiar página u orden
  useEffect(() => {
    fetchCiclos(currentPage);
  }, [currentPage, sortColumn, sortDirection, itemsPerPage]);

  const handleItemsPerPageChange = (newItemsPerPage) => {
      setItemsPerPage(newItemsPerPage);
      setCurrentPage(1);
  };

  const getCicloId = (c) => {
    if (c.id) return c.id;
    if (c['@id']) {
        const parts = c['@id'].split('/');
        return parts[parts.length - 1];
    }
    return null;
  };

  const fetchCiclos = async (page) => {
    setLoading(true);
    try {
      let url = `https://localhost:9443/api/ciclo_formativos?page=${page}&itemsPerPage=${itemsPerPage}`;
      
      if (searchTerm) {
          url += `&${searchField}=${encodeURIComponent(searchTerm)}`; 
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
      
      setCiclos(items);
      setTotalItems(total);
      setError(null);

    } catch (err) {
      console.error("Error fetching ciclos:", err);
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

  const handleOpenModal = (ciclo = null) => {
    if (ciclo) {
      setCurrentCiclo(ciclo);
      setFormData({
        nombre: ciclo.nombre,
        nivel: ciclo.nivel,
        centro: ciclo.centro ? (ciclo.centro.id || ciclo.centro.split('/').pop()) : ''
      });
    } else {
      setCurrentCiclo(null);
      setFormData({
        nombre: '',
        nivel: 'Superior',
        centro: isSuperAdmin ? '' : (user.centro ? user.centro.id : '')
      });
    }
    setIsModalOpen(true);
  };

  const handleCloseModal = () => {
    setIsModalOpen(false);
    setCurrentCiclo(null);
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
      const id = currentCiclo ? getCicloId(currentCiclo) : null;
      const url = currentCiclo 
        ? `https://localhost:9443/api/ciclo_formativos/${id}`
        : 'https://localhost:9443/api/ciclo_formativos';
      
      const method = currentCiclo ? 'PUT' : 'POST';

      const payload = {
        ...formData,
        centro: formData.centro ? `/api/centros/${formData.centro}` : null
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

      await fetchCiclos(currentPage);
      handleCloseModal();

    } catch (err) {
      console.error("Error saving ciclo:", err);
      alert(`Error: ${err.message}`);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (ciclo) => {
    if (!window.confirm('¿Estás seguro de que quieres eliminar este ciclo?')) {
      return;
    }

    const id = getCicloId(ciclo);
    if (!id) return;

    try {
      const response = await fetch(`https://localhost:9443/api/ciclo_formativos/${id}`, {
        method: 'DELETE',
        credentials: 'include'
      });

      if (!response.ok) {
        throw new Error('No se pudo eliminar el ciclo');
      }

      fetchCiclos(currentPage);

    } catch (err) {
      console.error("Error deleting ciclo:", err);
      alert(`Error al eliminar: ${err.message}`);
    }
  };

  const columns = [
    { header: 'Nombre', accessor: 'nombre', sortable: true, sortKey: 'nombre' },
    { header: 'Nivel', accessor: 'nivel', sortable: true, sortKey: 'nivel' },
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
            <h1 className={styles.pageTitle}>Ciclos Formativos</h1>
            
            <div className={styles.controls}>
                {isSuperAdmin && (
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
                
                <SearchBar 
                    value={searchTerm} 
                    onChange={setSearchTerm} 
                    placeholder="Buscar ciclo..." 
                    fields={searchFields}
                    selectedField={searchField}
                    onFieldChange={setSearchField}
                />
                
                <Button onClick={() => handleOpenModal()}>
                    <Plus size={18} style={{ marginRight: '8px' }} />
                    Nuevo Ciclo
                </Button>
            </div>
        </div>

        {error && (
            <div className={styles.errorContainer}>
            <p>{error}</p>
            <Button onClick={() => fetchCiclos(currentPage)} variant="secondary" style={{ marginTop: '1rem' }}>Reintentar</Button>
            </div>
        )}

        <DataTable
            columns={columns}
            data={ciclos}
            totalItems={totalItems}
            itemsPerPage={itemsPerPage}
            currentPage={currentPage}
            onPageChange={setCurrentPage}
            onItemsPerPageChange={handleItemsPerPageChange}
            loading={loading}
            sortColumn={sortColumn}
            sortDirection={sortDirection}
            onSort={handleSort}
            mobileBreakpoint={'600px'}
        />

        {/* Modal */}
        {isModalOpen && (
            <div className={styles.modalOverlay} onClick={handleCloseModal}>
            <div className={styles.modal} onClick={e => e.stopPropagation()}>
                <div className={styles.modalHeader}>
                <h3 className={styles.modalTitle}>
                    {currentCiclo ? 'Editar Ciclo' : 'Nuevo Ciclo'}
                </h3>
                <button className={styles.closeButton} onClick={handleCloseModal}>
                    <X size={20} />
                </button>
                </div>
                
                <form onSubmit={handleSubmit}>
                <div className={styles.modalBody}>
                    <div className={styles.formGroup}>
                        <label className={styles.label}>Nombre del Ciclo</label>
                        <input
                            type="text"
                            name="nombre"
                            value={formData.nombre}
                            onChange={handleInputChange}
                            className={styles.input}
                            required
                            placeholder="Ej: Desarrollo de Aplicaciones Web"
                        />
                    </div>

                    <div className={styles.formGroup}>
                        <label className={styles.label}>Nivel</label>
                        <select
                            name="nivel"
                            value={formData.nivel}
                            onChange={handleInputChange}
                            className={styles.select}
                        >
                            <option value="Básico">Básico</option>
                            <option value="Medio">Medio</option>
                            <option value="Superior">Superior</option>
                            <option value="Curso de Especialización">Curso de Especialización</option>
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

export default CiclosFormativos;
