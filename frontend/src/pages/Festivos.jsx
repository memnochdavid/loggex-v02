import React, { useEffect, useState, useRef } from 'react';
import styles from './Festivos.module.css';
import Button from '../components/Button';
import DataTable from '../components/DataTable';
import SearchBar from '../components/SearchBar';
import Layout from '../components/Layout';
import ModalView from '../components/ModalView';
import CrudHeader from '../components/CrudHeader'; // Importar CrudHeader
import { useAuth } from '../context/AuthContext';
import { usePagination } from '../hooks/usePagination';
import { Plus, Edit2, Trash2, Lock } from 'lucide-react';

const Festivos = () => {
  const { user } = useAuth();
  const isSuperAdmin = user?.roles?.includes('ROLE_SUPERADMIN');
  const isAdmin = user?.roles?.includes('ROLE_ADMIN');
  const canCreate = isSuperAdmin || isAdmin;

  const [festivos, setFestivos] = useState([]);
  const [centros, setCentros] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  
  // Filtros
  const [selectedCentro, setSelectedCentro] = useState('');
  
  // Paginación, Búsqueda y Ordenación
  const [currentPage, setCurrentPage] = useState(1);
  const [totalItems, setTotalItems] = useState(0);
  
  // Usar hook de paginación
  const [itemsPerPage, setItemsPerPage] = usePagination('festivos');

  const [searchTerm, setSearchTerm] = useState('');
  const [searchField, setSearchField] = useState('nombre');
  const [sortColumn, setSortColumn] = useState('fechaInicio');
  const [sortDirection, setSortDirection] = useState('asc');

  // Estado para forzar recarga (ej: tras borrar/guardar)
  const [forceReload, setForceReload] = useState(0);

  // Referencia para evitar peticiones duplicadas con los mismos parámetros
  const lastParamsRef = useRef(null);
  
  // Referencia para controlar el primer renderizado del buscador
  const isFirstSearchRender = useRef(true);

  // Campos buscables
  const searchFields = [
      { value: 'nombre', label: 'Nombre' }
  ];

  // Estado para el modal
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [currentFestivo, setCurrentFestivo] = useState(null);
  const [formData, setFormData] = useState({
    nombre: '',
    fechaInicio: '',
    fechaFin: '',
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

  // Debounce para búsqueda
  useEffect(() => {
    if (isFirstSearchRender.current) {
        isFirstSearchRender.current = false;
        return;
    }

    const timer = setTimeout(() => {
        setCurrentPage(1);
        // Forzamos recarga incrementando este contador
        setForceReload(prev => prev + 1);
    }, 500);
    return () => clearTimeout(timer);
  }, [searchTerm, selectedCentro, searchField]);

  // Efecto Principal de Carga
  useEffect(() => {
    if (!itemsPerPage) return;
    
    const controller = new AbortController();
    fetchFestivos(currentPage, controller.signal);

    return () => controller.abort();
  }, [currentPage, sortColumn, sortDirection, itemsPerPage, forceReload]);

  const handleItemsPerPageChange = (newItemsPerPage) => {
      setItemsPerPage(newItemsPerPage);
      setCurrentPage(1);
  };

  const getFestivoId = (f) => {
    if (f.id) return f.id;
    if (f['@id']) {
        const parts = f['@id'].split('/');
        return parts[parts.length - 1];
    }
    return null;
  };

  const fetchFestivos = async (page, signal) => {
    // Construir parámetros actuales
    const currentParams = {
        page,
        itemsPerPage,
        sortColumn,
        sortDirection,
        searchTerm,
        selectedCentro,
        searchField,
        forceReload // Incluimos forceReload para que si cambia, los params sean distintos
    };

    // Verificar si son idénticos a la última petición exitosa
    // Esto evita la doble carga inicial
    if (lastParamsRef.current && JSON.stringify(lastParamsRef.current) === JSON.stringify(currentParams)) {
        return;
    }

    setLoading(true);
    try {
      let url = `https://localhost:9443/api/festivos?page=${page}&itemsPerPage=${itemsPerPage}`;
      
      if (searchTerm) {
          url += `&${searchField}=${encodeURIComponent(searchTerm)}`; 
      }
      
      if (selectedCentro) {
          url += `&centro=${selectedCentro}`;
      }
      
      if (sortColumn) {
          url += `&order[${sortColumn}]=${sortDirection}`;
      }

      const response = await fetch(url, {
        headers: {
          'Accept': 'application/ld+json',
        },
        credentials: 'include',
        signal
      });

      if (!response.ok) {
        throw new Error(`Error ${response.status}: ${response.statusText}`);
      }

      const data = await response.json();
      const items = data['hydra:member'] || data.member || [];
      const total = data['hydra:totalItems'] || data.totalItems || items.length;
      
      setFestivos(items);
      setTotalItems(total);
      setError(null);
      
      // Actualizar referencia de últimos parámetros solo si tuvo éxito
      lastParamsRef.current = currentParams;

    } catch (err) {
      if (err.name !== 'AbortError') {
          console.error("Error fetching festivos:", err);
          setError(err.message);
      }
    } finally {
        if (!signal?.aborted) {
            setLoading(false);
        }
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

  const handleOpenModal = (festivo = null) => {
    if (festivo) {
      setCurrentFestivo(festivo);
      
      const getId = (obj) => obj ? (obj.id || (obj['@id'] ? obj['@id'].split('/').pop() : '')) : '';

      setFormData({
        nombre: festivo.nombre,
        fechaInicio: festivo.fechaInicio ? festivo.fechaInicio.split('T')[0] : '',
        fechaFin: festivo.fechaFin ? festivo.fechaFin.split('T')[0] : '',
        centro: getId(festivo.centro)
      });
    } else {
      setCurrentFestivo(null);
      setFormData({
        nombre: '',
        fechaInicio: '',
        fechaFin: '',
        centro: isSuperAdmin ? '' : (user?.centro?.id || '') // Preseleccionar centro si no es superadmin
      });
    }
    setIsModalOpen(true);
  };

  const handleCloseModal = () => {
    setIsModalOpen(false);
    setCurrentFestivo(null);
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
      const id = currentFestivo ? getFestivoId(currentFestivo) : null;
      const url = currentFestivo 
        ? `https://localhost:9443/api/festivos/${id}`
        : 'https://localhost:9443/api/festivos';
      
      const method = currentFestivo ? 'PUT' : 'POST';

      // Preparar payload
      const payload = {
        nombre: formData.nombre,
        fechaInicio: formData.fechaInicio,
        fechaFin: formData.fechaFin || null,
      };

      if (isSuperAdmin && formData.centro) {
          payload.centro = `/api/centros/${formData.centro}`;
      } else if (!isSuperAdmin && !currentFestivo && user?.centro) {
           const centroId = user.centro.id || (typeof user.centro === 'string' ? user.centro.split('/').pop() : null);
           if (centroId) {
               payload.centro = `/api/centros/${centroId}`;
           }
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

      // Forzar recarga
      setForceReload(prev => prev + 1);
      handleCloseModal();

    } catch (err) {
      console.error("Error saving festivo:", err);
      alert(`Error: ${err.message}`);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (festivo) => {
    if (!window.confirm('¿Estás seguro de que quieres eliminar este festivo?')) {
      return;
    }

    const id = getFestivoId(festivo);
    if (!id) return;

    try {
      const response = await fetch(`https://localhost:9443/api/festivos/${id}`, {
        method: 'DELETE',
        credentials: 'include'
      });

      if (!response.ok) {
        throw new Error('No se pudo eliminar el festivo');
      }

      setForceReload(prev => prev + 1);

    } catch (err) {
      console.error("Error deleting festivo:", err);
      alert(`Error al eliminar: ${err.message}`);
    }
  };

  const columns = [
    { header: 'Nombre', accessor: 'nombre', sortable: true, sortKey: 'nombre' },
    { 
        header: 'Fecha Inicio', 
        accessor: (row) => new Date(row.fechaInicio).toLocaleDateString(), 
        sortable: true, 
        sortKey: 'fechaInicio' 
    },
    { 
        header: 'Fecha Fin', 
        accessor: (row) => row.fechaFin ? new Date(row.fechaFin).toLocaleDateString() : '-', 
        sortable: true, 
        sortKey: 'fechaFin' 
    },
    { 
        header: 'Centro', 
        accessor: (row) => row.centro ? (row.centro.nombre || 'Cargando...') : 'Global', 
        sortable: false 
    },
    { 
        header: 'Acciones',
        accessor: (row) => {
            const isGlobal = !row.centro;
            const canEditRow = isSuperAdmin || (!isGlobal && isAdmin);

            return (
                <div className={styles.actions}>
                    {canEditRow ? (
                        <>
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
                        </>
                    ) : (
                        <span title="Festivo Global (Solo lectura)" style={{ color: 'var(--text-muted)', padding: '4px' }}>
                            <Lock size={16} />
                        </span>
                    )}
                </div>
            );
        },
        sortable: false
    }
  ];

  return (
    <Layout>
        <div className={styles.container}>
        <CrudHeader title="Festivos">
            {isSuperAdmin && (
                <select 
                    className={styles.select} 
                    value={selectedCentro} 
                    onChange={(e) => setSelectedCentro(e.target.value)}
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
                placeholder="Buscar festivo..." 
                fields={searchFields}
                selectedField={searchField}
                onFieldChange={setSearchField}
            />
            
            {canCreate && (
                <Button onClick={() => handleOpenModal()}>
                    <Plus size={18} style={{ marginRight: '8px' }} />
                    Nuevo Festivo
                </Button>
            )}
        </CrudHeader>

        {error && (
            <div className={styles.errorContainer}>
            <p>{error}</p>
            <Button onClick={() => window.location.reload()} variant="secondary" style={{ marginTop: '1rem' }}>Reintentar</Button>
            </div>
        )}

        <DataTable
            columns={columns}
            data={festivos}
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
            title={currentFestivo ? 'Editar Festivo' : 'Nuevo Festivo'}
            onSubmit={handleSubmit}
            isSubmitting={saving}
        >
            <div className={styles.formGroup}>
                <label className={styles.label}>Nombre</label>
                <input
                    type="text"
                    name="nombre"
                    value={formData.nombre}
                    onChange={handleInputChange}
                    className={styles.input}
                    required
                    placeholder="Ej: Navidad"
                />
            </div>

            <div className={styles.formGroup}>
                <label className={styles.label}>Fecha Inicio</label>
                <input
                    type="date"
                    name="fechaInicio"
                    value={formData.fechaInicio}
                    onChange={handleInputChange}
                    className={styles.input}
                    required
                />
            </div>

            <div className={styles.formGroup}>
                <label className={styles.label}>Fecha Fin (Opcional)</label>
                <input
                    type="date"
                    name="fechaFin"
                    value={formData.fechaFin}
                    onChange={handleInputChange}
                    className={styles.input}
                />
            </div>

            {isSuperAdmin && (
                <div className={styles.formGroup}>
                    <label className={styles.label}>Centro (Opcional - Global si vacío)</label>
                    <select
                        name="centro"
                        value={formData.centro}
                        onChange={handleInputChange}
                        className={styles.select}
                        style={{ width: '100%' }}
                    >
                        <option value="">Global (Todos los centros)</option>
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

export default Festivos;
