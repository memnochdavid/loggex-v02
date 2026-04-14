import React, { useEffect, useState, useRef, useCallback, useMemo } from 'react';
import styles from './Crud.module.css'; // Usar estilos comunes
import Button from '../components/Button';
import DataTable from '../components/DataTable';
import SearchBar from '../components/SearchBar';
import ThemedSelect from '../components/ThemedSelect';
import Layout from '../components/Layout';
import ModalView from '../components/ModalView';
import CrudHeader from '../components/CrudHeader';
import { useAuth } from '../context/AuthContext';
import { usePagination } from '../hooks/usePagination';
import { Plus, Edit2, Trash2, Lock } from 'lucide-react';
import { getApiUrl } from '../config/api';
import Lottie from 'lottie-react';
import crudAnimation from '../../public/crud.json';
import { useTranslation } from 'react-i18next';

const Festivos = ({ embedded = false, tabs = null }) => {
  const { t } = useTranslation();
  const { user } = useAuth();
  const isSuperAdmin = user?.roles?.includes('ROLE_SUPERADMIN');
  const isAdmin = user?.roles?.includes('ROLE_ADMIN');
  const canCreate = isSuperAdmin || isAdmin;

  const [festivos, setFestivos] = useState([]);
  const [centros, setCentros] = useState([]);
  
  // Estado de carga único
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

  // Refs para control de flujo
  const debounceTimeout = useRef(null);
  const prevSearchTerm = useRef(searchTerm);
  const prevSearchField = useRef(searchField);
  const abortController = useRef(null);

  // Campos buscables
  const searchFields = [
      { value: 'nombre', label: t('holidays.name') }
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

  const getFestivoId = (f) => {
    if (f.id) return f.id;
    if (f['@id']) {
        const parts = f['@id'].split('/');
        return parts[parts.length - 1];
    }
    return null;
  };

  // Función de carga optimizada
  const fetchFestivosData = useCallback(async (params) => {
    if (abortController.current) {
        abortController.current.abort();
    }
    abortController.current = new AbortController();

    setLoading(true);

    try {
      let url = getApiUrl(`/api/festivos?page=${params.page}&itemsPerPage=${params.itemsPerPage}`);
      
      if (params.searchTerm) {
          url += `&${params.searchField}=${encodeURIComponent(params.searchTerm)}`; 
      }
      
      if (params.selectedCentro) {
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
      
      setFestivos(items);
      setTotalItems(total);
      setError(null);

    } catch (err) {
      if (err.name === 'AbortError') return;
      console.error("Error fetching festivos:", err);
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
          selectedCentro,
          sortColumn,
          sortDirection
      };

      if (searchChanged) {
          if (debounceTimeout.current) clearTimeout(debounceTimeout.current);
          debounceTimeout.current = setTimeout(() => {
              fetchFestivosData(params);
          }, 500);
      } else {
          if (debounceTimeout.current) clearTimeout(debounceTimeout.current);
          fetchFestivosData(params);
      }

      return () => {
          if (debounceTimeout.current) clearTimeout(debounceTimeout.current);
      };
  }, [
      currentPage, 
      itemsPerPage, 
      searchTerm, 
      searchField, 
      selectedCentro, 
      sortColumn, 
      sortDirection, 
      fetchFestivosData
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

  const handleOpenModal = useCallback((festivo = null) => {
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
        centro: isSuperAdmin ? '' : (user?.centro?.id || '')
      });
    }
    setIsModalOpen(true);
  }, [isSuperAdmin, user.centro]);

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
        ? getApiUrl(`/api/festivos/${id}`)
        : getApiUrl('/api/festivos');
      
      const method = currentFestivo ? 'PUT' : 'POST';

      const payload = {
        nombre: formData.nombre,
        fechaInicio: formData.fechaInicio,
        fechaFin: formData.fechaFin || null,
      };

      if (isSuperAdmin) {
          if (formData.centro) {
              payload.centro = `/api/centros/${formData.centro}`;
          } else {
              payload.centro = null;
          }
      } else {
          if (user?.centro) {
               const centroId = user.centro.id || (typeof user.centro === 'string' ? user.centro.split('/').pop() : null);
               if (centroId) {
                   payload.centro = `/api/centros/${centroId}`;
               }
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
        const errorMessage = errorData['hydra:description'] || errorData.detail || errorData.message || t('common.errorSaving', { message: 'Error desconocido' });
        throw new Error(errorMessage);
      }

      // Recargar datos
      fetchFestivosData({
          page: currentPage,
          itemsPerPage,
          searchTerm,
          searchField,
          selectedCentro,
          sortColumn,
          sortDirection
      });
      handleCloseModal();

    } catch (err) {
      console.error("Error saving festivo:", err);
      alert(t('common.errorSaving', { message: err.message }));
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = useCallback(async (festivo) => {
    if (!window.confirm(t('holidays.confirmDelete'))) {
      return;
    }

    const id = getFestivoId(festivo);
    if (!id) return;

    try {
      const response = await fetch(getApiUrl(`/api/festivos/${id}`), {
        method: 'DELETE',
        credentials: 'include'
      });

      if (!response.ok) {
        throw new Error(t('holidays.errorDelete'));
      }

      fetchFestivosData({
          page: currentPage,
          itemsPerPage,
          searchTerm,
          searchField,
          selectedCentro,
          sortColumn,
          sortDirection
      });

    } catch (err) {
      console.error("Error deleting festivo:", err);
      alert(t('common.errorDeletingMsg', { message: err.message }));
    }
  }, [currentPage, itemsPerPage, searchTerm, searchField, selectedCentro, sortColumn, sortDirection, fetchFestivosData]);

  const columns = useMemo(() => [
    { header: t('holidays.name'), accessor: 'nombre', sortable: true, sortKey: 'nombre' },
    { 
        header: t('holidays.startDate'), 
        accessor: (row) => new Date(row.fechaInicio).toLocaleDateString(), 
        sortable: true, 
        sortKey: 'fechaInicio' 
    },
    { 
        header: t('holidays.endDate'), 
        accessor: (row) => row.fechaFin ? new Date(row.fechaFin).toLocaleDateString() : '-', 
        sortable: true, 
        sortKey: 'fechaFin' 
    },
    { 
        header: t('holidays.center'), 
        accessor: (row) => row.centro ? (row.centro.nombre || t('common.loading')) : t('holidays.global'), 
        sortable: false 
    },
    { 
        header: t('common.actions'), 
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
                        </>
                    ) : (
                        <span title={t('holidays.readOnly')} style={{ color: 'var(--text-muted)', padding: '4px' }}>
                            <Lock size={16} />
                        </span>
                    )}
                </div>
            );
        },
        sortable: false
    }
  ], [isSuperAdmin, isAdmin, handleOpenModal, handleDelete]);

  const toolbar = (
    <>
        {isSuperAdmin && (
            <ThemedSelect
                value={selectedCentro}
                onChange={setSelectedCentro}
                minWidth={200}
                ariaLabel={t('common.allCenters')}
                options={[
                    { value: '', label: t('common.allCenters') },
                    ...centros.map(c => ({ value: String(c.id), label: c.nombre })),
                ]}
            />
        )}
        <SearchBar
            value={searchTerm}
            onChange={setSearchTerm}
            placeholder={t('holidays.searchPlaceholder')}
            fields={searchFields}
            selectedField={searchField}
            onFieldChange={setSearchField}
        />
        {canCreate && (
            <Button onClick={() => handleOpenModal()}>
                <Plus size={18} style={{ marginRight: '8px' }} />
                {t('common.new')}
            </Button>
        )}
    </>
  );

  const body = (
    <>
        <CrudHeader title={embedded ? t('dates.title') : t('holidays.title')}
                    logo={<Lottie animationData={crudAnimation} loop={true} style={{ width: 60, height: 60 }} />}
                    middle={tabs}
        >
            {toolbar}
        </CrudHeader>

        {error && (
            <div className={styles.errorContainer}>
            <p>{error}</p>
            <Button onClick={() => fetchFestivosData({ page: currentPage, itemsPerPage, searchTerm, searchField, selectedCentro, sortColumn, sortDirection })} variant="secondary" style={{ marginTop: '1rem' }}>{t('common.retry')}</Button>
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
            title={currentFestivo ? t('holidays.editTitle') : t('holidays.newTitle')}
            onSubmit={handleSubmit}
            isSubmitting={saving}
        >
            <div className={styles.formGroup}>
                <label className={styles.label}>{t('holidays.name')}</label>
                <input
                    type="text"
                    name="nombre"
                    value={formData.nombre}
                    onChange={handleInputChange}
                    className={styles.input}
                    required
                    placeholder={t('holidays.namePlaceholder')}
                />
            </div>

            <div className={styles.formGroup}>
                <label className={styles.label}>{t('holidays.startDate')}</label>
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
                <label className={styles.label}>{t('holidays.endDateOptional')}</label>
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
                    <label className={styles.label}>{t('holidays.centerOptional')}</label>
                    <select
                        name="centro"
                        value={formData.centro}
                        onChange={handleInputChange}
                        className={styles.select}
                        style={{ width: '100%' }}
                    >
                        <option value="">{t('holidays.globalOption')}</option>
                        {centros.map(c => (
                            <option key={c.id} value={c.id}>{c.nombre}</option>
                        ))}
                    </select>
                </div>
            )}
        </ModalView>
    </>
  );

  if (embedded) return body;
  return (
    <Layout>
        <div className={styles.container}>
            {body}
        </div>
    </Layout>
  );
};

export default Festivos;
