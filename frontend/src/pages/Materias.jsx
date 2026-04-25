import React, { useEffect, useState, useRef, useCallback, useMemo } from 'react';
import styles from './Crud.module.css'; // Usar estilos comunes
import Button from '../components/Button';
import DataTable from '../components/DataTable';
import SearchBar from '../components/SearchBar';
import ThemedSelect from '../components/ThemedSelect';
import Layout from '../components/Layout';
import ModalView from '../components/ModalView';
import AsyncSearchSelect from '../components/AsyncSearchSelect';
import CrudHeader from '../components/CrudHeader';
import ModuloLabel from '../components/ModuloLabel';
import { useAuth } from '../context/AuthContext';
import { usePagination } from '../hooks/usePagination';
import { Plus, Edit2, Trash2 } from 'lucide-react';
import { getApiUrl } from '../config/api';
import Lottie from 'lottie-react';
import crudAnimation from '../../public/crud.json';
import { useTranslation } from 'react-i18next';
import { toast, parseErrorResponse } from '../utils/toast';
import { useConfirm } from '../context/ConfirmContext';

const Materias = () => {
  const { t } = useTranslation();
  const confirm = useConfirm();
  const { user } = useAuth();
  const isSuperAdmin = user?.roles?.includes('ROLE_SUPERADMIN');

  const [modulos, setMaterias] = useState([]);
  const [ciclos, setItinerarios] = useState([]);
  const [centros, setCentros] = useState([]);
  
  // Estado de carga único
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  
  // Filtros
  const [selectedCentro, setSelectedCentro] = useState('');
  const [selectedItinerario, setSelectedCiclo] = useState('');
  
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
      { value: 'nombre', label: t('materias.name') },
      { value: 'codigoOficial', label: t('materias.code') },
      { value: 'ciclo.nombre', label: t('materias.cycle') }
  ];

  // Estado para el modal
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [currentMateria, setCurrentModulo] = useState(null);
  const [formData, setFormData] = useState({
    nombre: '',
    abreviatura: '',
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
        setItinerarios(items);
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
      let url = getApiUrl(`/api/materias?page=${params.page}&itemsPerPage=${params.itemsPerPage}`);
      
      if (params.searchTerm) {
          url += `&${params.searchField}=${encodeURIComponent(params.searchTerm)}`; 
      }
      
      if (params.selectedItinerario) {
          url += `&ciclo=${params.selectedItinerario}`;
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
      
      setMaterias(items);
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
          selectedItinerario,
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
      selectedItinerario, 
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
        abreviatura: modulo.abreviatura || '',
        codigoOficial: modulo.codigoOficial || '',
        curso: modulo.curso,
        horasSemanales: modulo.horasSemanales,
        ciclo: cicloId
      });
    } else {
      setCurrentModulo(null);
      setFormData({
        nombre: '',
        abreviatura: '',
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
      const id = currentMateria ? getModuloId(currentMateria) : null;
      const url = currentMateria 
        ? getApiUrl(`/api/materias/${id}`)
        : getApiUrl('/api/materias');
      
      const method = currentMateria ? 'PUT' : 'POST';

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
        const message = await parseErrorResponse(response);
        throw new Error(message);
      }

      // Recargar datos
      fetchModulosData({
          page: currentPage,
          itemsPerPage,
          searchTerm,
          searchField,
          selectedItinerario,
          selectedCentro,
          sortColumn,
          sortDirection,
          isSuperAdmin
      });
      handleCloseModal();
      toast.success(currentMateria
        ? t('materias.updatedSuccess', { defaultValue: 'Módulo actualizado' })
        : t('materias.createdSuccess', { defaultValue: 'Módulo creado' }));

    } catch (err) {
      console.error("Error saving modulo:", err);
      toast.error(err.message, {
        description: currentMateria
          ? t('materias.errorUpdating', { defaultValue: 'No se ha podido actualizar el módulo' })
          : t('materias.errorCreating', { defaultValue: 'No se ha podido crear el módulo' })
      });
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = useCallback(async (modulo) => {
    if (!(await confirm({ body: t('materias.confirmDelete') }))) {
      return;
    }

    const id = getModuloId(modulo);
    if (!id) return;

    try {
      const response = await fetch(getApiUrl(`/api/materias/${id}`), {
        method: 'DELETE',
        credentials: 'include'
      });

      if (!response.ok) {
        const message = await parseErrorResponse(response, t('materias.errorDelete'));
        throw new Error(message);
      }

      fetchModulosData({
          page: currentPage,
          itemsPerPage,
          searchTerm,
          searchField,
          selectedItinerario,
          selectedCentro,
          sortColumn,
          sortDirection,
          isSuperAdmin
      });
      toast.success(t('materias.deletedSuccess', { defaultValue: 'Módulo eliminado' }));

    } catch (err) {
      console.error("Error deleting modulo:", err);
      toast.error(err.message, {
        description: t('materias.errorDeletingCtx', { defaultValue: 'No se ha podido eliminar el módulo' })
      });
    }
  }, [currentPage, itemsPerPage, searchTerm, searchField, selectedItinerario, selectedCentro, sortColumn, sortDirection, isSuperAdmin, fetchModulosData, t]);

  const columns = useMemo(() => [
    {
      header: t('materias.name'),
      accessor: (row) => <ModuloLabel modulo={row} />,
      sortable: true,
      sortKey: 'nombre'
    },
    {
      header: t('materias.abbreviation'),
      accessor: (row) => row.abreviatura || '-',
      sortable: true,
      sortKey: 'abreviatura'
    },
    { header: t('materias.code'), accessor: 'codigoOficial', sortable: true, sortKey: 'codigoOficial' },
    { header: t('materias.course'), accessor: 'curso', sortable: true, sortKey: 'curso' },
    { 
        header: t('materias.cycle'), 
        accessor: (row) => row.ciclo ? row.ciclo.nombre : '-', 
        sortable: true, 
        sortKey: 'ciclo.nombre' 
    },
    { 
        header: t('common.actions'),
        accessor: (row) => (
            <div className={styles.actions}>
                <button 
                    className={styles.iconButton} 
                    onClick={() => handleOpenModal(row)}
                    title={t('common.edit')}
                >
                    <Edit2 size={18} />
                </button>
                <button 
                    className={`${styles.iconButton} ${styles.danger}`} 
                    onClick={() => handleDelete(row)}
                    title={t('common.delete')}
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
        <CrudHeader title={t('materias.title')}
                    logo={<Lottie animationData={crudAnimation} loop={true} style={{ width: 56, height: 56 }} />}
        >
            {isSuperAdmin && (
                <ThemedSelect
                    value={selectedCentro}
                    onChange={(v) => { setSelectedCentro(v); setSelectedCiclo(''); }}
                    minWidth={200}
                    ariaLabel={t('common.allCenters')}
                    options={[
                        { value: '', label: t('common.allCenters') },
                        ...centros.map(c => ({ value: String(c.id), label: c.nombre })),
                    ]}
                />
            )}

            <ThemedSelect
                value={selectedItinerario}
                onChange={setSelectedCiclo}
                minWidth={200}
                ariaLabel={t('common.allCycles')}
                options={[
                    { value: '', label: t('common.allCycles') },
                    ...ciclos.map(c => ({
                        value: String(c.id || c['@id']?.split('/').pop()),
                        label: c.nombre,
                    })),
                ]}
            />
            
            <SearchBar 
                value={searchTerm} 
                onChange={setSearchTerm} 
                placeholder={t('materias.searchPlaceholder')}
                fields={searchFields}
                selectedField={searchField}
                onFieldChange={setSearchField}
            />
            
            <Button onClick={() => handleOpenModal()}>
                <Plus size={18} style={{ marginRight: '8px' }} />
                {t('common.new')}
            </Button>
        </CrudHeader>

        {error && (
            <div className={styles.errorContainer}>
            <p>{error}</p>
            <Button onClick={() => fetchModulosData({ page: currentPage, itemsPerPage, searchTerm, searchField, selectedItinerario, selectedCentro, sortColumn, sortDirection, isSuperAdmin })} variant="secondary" style={{ marginTop: '1rem' }}>{t('common.retry')}</Button>
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
            title={currentMateria ? t('materias.editTitle') : t('materias.newTitle')}
            onSubmit={handleSubmit}
            isSubmitting={saving}
        >
            <div className={styles.formGroup}>
                <label className={styles.label}>{t('materias.nameLabel')}</label>
                <input
                    type="text"
                    name="nombre"
                    value={formData.nombre}
                    onChange={handleInputChange}
                    className={styles.input}
                    required
                    placeholder={t('materias.namePlaceholder')}
                />
            </div>

            <div className={styles.formGroup}>
                <label className={styles.label}>{t('materias.abbreviationLabel')}</label>
                <input
                    type="text"
                    name="abreviatura"
                    value={formData.abreviatura}
                    onChange={handleInputChange}
                    className={styles.input}
                    maxLength={16}
                    placeholder={t('materias.abbreviationPlaceholder')}
                />
            </div>

            <div className={styles.formGroup}>
                <label className={styles.label}>{t('materias.codeLabel')}</label>
                <input
                    type="text"
                    name="codigoOficial"
                    value={formData.codigoOficial}
                    onChange={handleInputChange}
                    className={styles.input}
                    placeholder={t('materias.codePlaceholder')}
                />
            </div>

            <div className={styles.formGroup}>
                <label className={styles.label}>{t('materias.cycleLabel')}</label>
                <AsyncSearchSelect
                    name="ciclo"
                    value={formData.ciclo}
                    onChange={(v) => setFormData(p => ({ ...p, ciclo: v }))}
                    endpoint="/api/ciclo_formativos"
                    extraParams={isSuperAdmin && selectedCentro ? { centro: selectedCentro } : {}}
                    getOptionLabel={(c) => c.nombre}
                    getOptionValue={(c) => c.id || c['@id']?.split('/').pop()}
                    placeholder={t('common.selectCycle')}
                    required
                />
            </div>

            <div className={styles.formGroup}>
                <label className={styles.label}>{t('materias.course')}</label>
                <select
                    name="curso"
                    value={formData.curso}
                    onChange={handleInputChange}
                    className={styles.select}
                >
                    <option value="1">{t('materias.course1')}</option>
                    <option value="2">{t('materias.course2')}</option>
                </select>
            </div>

            <div className={styles.formGroup}>
                <label className={styles.label}>{t('materias.weeklyHours')}</label>
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

export default Materias;
