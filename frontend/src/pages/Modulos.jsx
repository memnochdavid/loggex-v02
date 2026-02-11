import React, { useEffect, useState, useRef, useCallback, useMemo } from 'react';
import styles from './Crud.module.css'; // Usar estilos comunes
import Button from '../components/Button';
import DataTable from '../components/DataTable';
import SearchBar from '../components/SearchBar';
import Layout from '../components/Layout';
import ModalView from '../components/ModalView';
import CrudHeader from '../components/CrudHeader';
import { useAuth } from '../context/AuthContext';
import { usePagination } from '../hooks/usePagination';
import { Plus, Edit2, Trash2 } from 'lucide-react';
import { getApiUrl } from '../config/api';

const Modulos = () => {
  const { user } = useAuth();
  const isSuperAdmin = user?.roles?.includes('ROLE_SUPERADMIN');

  const [modulos, setModulos] = useState([]);
  const [ciclos, setCiclos] = useState([]);
  const [centros, setCentros] = useState([]);
  
  // Estado de carga único
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  
  // Filtros
  const [selectedCentro, setSelectedCentro] = useState('');
  const [selectedCiclo, setSelectedCiclo] = useState('');
  
  // Paginación, Búsqueda y Ordenación
  const [currentPage, setCurrentPage] = useState(1);
  const [totalItems, setTotalItems] = useState(0);
  
  // Usar hook de paginación
  const [itemsPerPage, setItemsPerPage] = usePagination('modulos');

  const [searchTerm, setSearchTerm] = useState('');
  const [searchField, setSearchField] = useState('nombre');
  const [sortColumn, setSortColumn] = useState('id');
  const [sortDirection, setSortDirection] = useState('asc');

  // Refs para control de flujo
  const debounceTimeout = useRef(null);
  const prevSearchTerm = useRef(searchTerm);
  const prevSearchField = useRef(searchField);
  const abortController = useRef(null);

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

  // Cargar ciclos (filtrados por centro si se selecciona uno, o todos si es admin de centro)
  useEffect(() => {
    let url = getApiUrl('/api/ciclo_formativos?pagination=false');
    
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

  const getModuloId = (m) => {
    if (m.id) return m.id;
    if (m['@id']) {
        const parts = m['@id'].split('/');
        return parts[parts.length - 1];
    }
    return null;
  };

  // Función de carga optimizada
  const fetchModulosData = useCallback(async (params) => {
    if (abortController.current) {
        abortController.current.abort();
    }
    abortController.current = new AbortController();

    setLoading(true);

    try {
      let url = getApiUrl(`/api/modulos?page=${params.page}&itemsPerPage=${params.itemsPerPage}`);
      
      if (params.searchTerm) {
          url += `&${params.searchField}=${encodeURIComponent(params.searchTerm)}`; 
      }
      
      if (params.selectedCiclo) {
          url += `&ciclo=${params.selectedCiclo}`;
      } else if (params.isSuperAdmin && params.selectedCentro) {
          // Si no hay ciclo seleccionado pero sí centro, filtrar por centro del ciclo
          url += `&ciclo.centro=${params.selectedCentro}`;
      }
      
      if (params.sortColumn) {
          url += `&order[${params.sortColumn}]=${params.sortDirection}`;
      }

      const response = await fetch(url, {
        headers: {
          'Accept': 'application/ld+json',
        },
        credentials: 'include',
        signal: abortController.current.signal
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
      if (err.name === 'AbortError') return;
      console.error("Error fetching modulos:", err);
      setError(err.message);
    } finally {
      if (abortController.current && !abortController.current.signal.aborted) {
          setLoading(false);
      }
    }
  }, []); 

  // Efecto ÚNICO para cambios
  useEffect(() => {
      const searchChanged = searchTerm !== prevSearchTerm.current || searchField !== prevSearchField.current;
      
      prevSearchTerm.current = searchTerm;
      prevSearchField.current = searchField;

      const params = {
          page: currentPage,
          itemsPerPage,
          searchTerm,
          searchField,
          selectedCiclo,
          selectedCentro,
          sortColumn,
          sortDirection,
          isSuperAdmin
      };

      if (searchChanged) {
          if (debounceTimeout.current) clearTimeout(debounceTimeout.current);
          debounceTimeout.current = setTimeout(() => {
              fetchModulosData(params);
          }, 500);
      } else {
          if (debounceTimeout.current) clearTimeout(debounceTimeout.current);
          fetchModulosData(params);
      }

      return () => {
          if (debounceTimeout.current) clearTimeout(debounceTimeout.current);
      };
  }, [
      currentPage, 
      itemsPerPage, 
      searchTerm, 
      searchField, 
      selectedCiclo,
      selectedCentro, 
      sortColumn, 
      sortDirection, 
      isSuperAdmin,
      fetchModulosData
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

  const handleOpenModal = useCallback((modulo = null) => {
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
  }, []);

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
        ? getApiUrl(`/api/modulos/${id}`)
        : getApiUrl('/api/modulos');
      
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

      // Recargar datos
      fetchModulosData({
          page: currentPage,
          itemsPerPage,
          searchTerm,
          searchField,
          selectedCiclo,
          selectedCentro,
          sortColumn,
          sortDirection,
          isSuperAdmin
      });
      handleCloseModal();

    } catch (err) {
      console.error("Error saving modulo:", err);
      alert(`Error: ${err.message}`);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = useCallback(async (modulo) => {
    if (!window.confirm('¿Estás seguro de que quieres eliminar este módulo?')) {
      return;
    }

    const id = getModuloId(modulo);
    if (!id) return;

    try {
      const response = await fetch(getApiUrl(`/api/modulos/${id}`), {
        method: 'DELETE',
        credentials: 'include'
      });

      if (!response.ok) {
        throw new Error('No se pudo eliminar el módulo');
      }

      fetchModulosData({
          page: currentPage,
          itemsPerPage,
          searchTerm,
          searchField,
          selectedCiclo,
          selectedCentro,
          sortColumn,
          sortDirection,
          isSuperAdmin
      });

    } catch (err) {
      console.error("Error deleting modulo:", err);
      alert(`Error al eliminar: ${err.message}`);
    }
  }, [currentPage, itemsPerPage, searchTerm, searchField, selectedCiclo, selectedCentro, sortColumn, sortDirection, isSuperAdmin, fetchModulosData]);

  const columns = useMemo(() => [
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
  ], [handleOpenModal, handleDelete]);

  return (
    <Layout>
        <div className={styles.container}>
        <CrudHeader title="Módulos Formativos">
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
                Nuevo
            </Button>
        </CrudHeader>

        {error && (
            <div className={styles.errorContainer}>
            <p>{error}</p>
            <Button onClick={() => fetchModulosData({ page: currentPage, itemsPerPage, searchTerm, searchField, selectedCiclo, selectedCentro, sortColumn, sortDirection, isSuperAdmin })} variant="secondary" style={{ marginTop: '1rem' }}>Reintentar</Button>
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
            mobileBreakpoint={'600px'}
        />

        {/* Modal */}
        <ModalView
            isOpen={isModalOpen}
            onClose={handleCloseModal}
            title={currentModulo ? 'Editar Módulo' : 'Nuevo Módulo'}
            onSubmit={handleSubmit}
            isSubmitting={saving}
        >
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
        </ModalView>
        </div>
    </Layout>
  );
};

export default Modulos;
