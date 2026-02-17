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
import Lottie from 'lottie-react';
import crudAnimation from '../../public/crud.json';

const Grupos = () => {
  const { user } = useAuth();
  const isSuperAdmin = user?.roles?.includes('ROLE_SUPERADMIN');

  const [grupos, setGrupos] = useState([]);
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
  const [itemsPerPage, setItemsPerPage] = usePagination('grupos');

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
    fechaInicio: '',
    fechaFin: '',
    ciclo: '',
    centro: ''
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

  // Cargar ciclos (filtrados por centro si se selecciona uno)
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

  const getGrupoId = (g) => {
    if (g.id) return g.id;
    if (g['@id']) {
        const parts = g['@id'].split('/');
        return parts[parts.length - 1];
    }
    return null;
  };

  // Función de carga optimizada
  const fetchGruposData = useCallback(async (params) => {
    if (abortController.current) {
        abortController.current.abort();
    }
    abortController.current = new AbortController();

    setLoading(true);

    try {
      let url = getApiUrl(`/api/grupos?page=${params.page}&itemsPerPage=${params.itemsPerPage}`);
      
      if (params.searchTerm) {
          url += `&${params.searchField}=${encodeURIComponent(params.searchTerm)}`; 
      }
      
      if (params.selectedCiclo) {
          url += `&ciclo=${params.selectedCiclo}`;
      }
      
      if (params.isSuperAdmin && params.selectedCentro) {
          url += `&centro=${params.selectedCentro}`;
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
      
      setGrupos(items);
      setTotalItems(total);
      setError(null);

    } catch (err) {
      if (err.name === 'AbortError') return;
      console.error("Error fetching grupos:", err);
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
              fetchGruposData(params);
          }, 500);
      } else {
          if (debounceTimeout.current) clearTimeout(debounceTimeout.current);
          fetchGruposData(params);
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
      fetchGruposData
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

  const handleOpenModal = useCallback((grupo = null) => {
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
        fechaInicio: grupo.fechaInicio ? grupo.fechaInicio.split('T')[0] : '',
        fechaFin: grupo.fechaFin ? grupo.fechaFin.split('T')[0] : '',
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
        fechaInicio: '',
        fechaFin: '',
        ciclo: '',
        centro: isSuperAdmin ? '' : (user.centro ? user.centro.id : '')
      });
    }
    setIsModalOpen(true);
  }, [isSuperAdmin, user.centro]);

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
        ? getApiUrl(`/api/grupos/${id}`)
        : getApiUrl('/api/grupos');
      
      const method = currentGrupo ? 'PUT' : 'POST';

      // Asegurar que ciclo y centro sean strings antes de usar includes
      const cicloValue = String(formData.ciclo);
      const centroValue = formData.centro ? String(formData.centro) : null;

      const payload = {
        ...formData,
        curso: parseInt(formData.curso),
        ciclo: cicloValue.includes('/api/') ? cicloValue : `/api/ciclo_formativos/${cicloValue}`,
        centro: centroValue ? (centroValue.includes('/api/') ? centroValue : `/api/centros/${centroValue}`) : null,
        fechaInicio: formData.fechaInicio || null,
        fechaFin: formData.fechaFin || null
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

      // Recargar datos
      fetchGruposData({
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
      console.error("Error saving grupo:", err);
      alert(`Error: ${err.message}`);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = useCallback(async (grupo) => {
    if (!window.confirm('¿Estás seguro de que quieres eliminar este grupo?')) {
      return;
    }

    const id = getGrupoId(grupo);
    if (!id) return;

    try {
      const response = await fetch(getApiUrl(`/api/grupos/${id}`), {
        method: 'DELETE',
        credentials: 'include'
      });

      if (!response.ok) {
        throw new Error('No se pudo eliminar el grupo');
      }

      fetchGruposData({
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
      console.error("Error deleting grupo:", err);
      alert(`Error al eliminar: ${err.message}`);
    }
  }, [currentPage, itemsPerPage, searchTerm, searchField, selectedCiclo, selectedCentro, sortColumn, sortDirection, isSuperAdmin, fetchGruposData]);

  const columns = useMemo(() => [
    { header: 'Nombre', accessor: 'nombre', sortable: true, sortKey: 'nombre' },
    { header: 'Curso', accessor: 'curso', sortable: true, sortKey: 'curso' },
    { header: 'Año Escolar', accessor: 'anioEscolar', sortable: true, sortKey: 'anioEscolar' },
    { 
        header: 'Inicio', 
        accessor: (row) => row.fechaInicio ? new Date(row.fechaInicio).toLocaleDateString() : '-', 
        sortable: true, 
        sortKey: 'fechaInicio' 
    },
    { 
        header: 'Fin', 
        accessor: (row) => row.fechaFin ? new Date(row.fechaFin).toLocaleDateString() : '-', 
        sortable: true, 
        sortKey: 'fechaFin' 
    },
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
  ], [handleOpenModal, handleDelete]);

  return (
    <Layout>
        <div className={styles.container}>
        <CrudHeader title="Grupos"
                    logo={<Lottie animationData={crudAnimation} loop={true} style={{ width: 60, height: 60 }} />}
        >
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
                Nuevo
            </Button>
        </CrudHeader>

        {error && (
            <div className={styles.errorContainer}>
            <p>{error}</p>
            <Button onClick={() => fetchGruposData({ page: currentPage, itemsPerPage, searchTerm, searchField, selectedCiclo, selectedCentro, sortColumn, sortDirection, isSuperAdmin })} variant="secondary" style={{ marginTop: '1rem' }}>Reintentar</Button>
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
            mobileBreakpoint={'1000px'}
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
                <label className={styles.label}>Fecha Inicio Curso</label>
                <input
                    type="date"
                    name="fechaInicio"
                    value={formData.fechaInicio}
                    onChange={handleInputChange}
                    className={styles.input}
                />
            </div>

            <div className={styles.formGroup}>
                <label className={styles.label}>Fecha Fin Curso</label>
                <input
                    type="date"
                    name="fechaFin"
                    value={formData.fechaFin}
                    onChange={handleInputChange}
                    className={styles.input}
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
