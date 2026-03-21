import React, { useEffect, useState, useRef, useCallback, useMemo } from 'react';
import styles from './Crud.module.css'; // Usar estilos comunes
import Button from '../components/Button';
import DataTable from '../components/DataTable';
import SearchBar from '../components/SearchBar';
import Layout from '../components/Layout';
import ModalView from '../components/ModalView';
import CrudHeader from '../components/CrudHeader';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { usePagination } from '../hooks/usePagination';
import useFormValidation from '../hooks/useFormValidation';
import FormField from '../components/FormField';
import { Plus, Edit2, Trash2, GraduationCap } from 'lucide-react';
import { getApiUrl } from '../config/api';
import Lottie from 'lottie-react';
import crudAnimation from '../../public/crud.json';
import { useTranslation } from 'react-i18next';
import ConfirmDialog from '../components/ConfirmDialog';
import useConfirm from '../hooks/useConfirm';


const CiclosFormativos = () => {
  const { t } = useTranslation();
  const { user } = useAuth();
  const { toast } = useToast();
  const { isOpen: confirmOpen, message: confirmMessage, confirm, handleConfirm, handleCancel } = useConfirm();
  const isSuperAdmin = user?.roles?.includes('ROLE_SUPERADMIN');

  const [ciclos, setCiclos] = useState([]);
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
  const [itemsPerPage, setItemsPerPage] = usePagination('ciclos');

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
      { value: 'nombre', label: t('cycles.name') },
      { value: 'nivel', label: t('cycles.level') }
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

  const validationRules = useMemo(() => ({
      nombre: { required: true, minLength: 2 },
  }), []);
  const { errors, handleBlur, validateAll, clearErrors } = useFormValidation(validationRules);

  // Cargar centros para el selector (solo si es SuperAdmin)
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

  const getCicloId = (c) => {
    if (c.id) return c.id;
    if (c['@id']) {
        const parts = c['@id'].split('/');
        return parts[parts.length - 1];
    }
    return null;
  };

  // Función de carga optimizada
  const fetchCiclosData = useCallback(async (params) => {
    if (abortController.current) {
        abortController.current.abort();
    }
    abortController.current = new AbortController();

    setLoading(true);

    try {
      let url = getApiUrl(`/api/ciclo_formativos?page=${params.page}&itemsPerPage=${params.itemsPerPage}`);
      
      if (params.searchTerm) {
          url += `&${params.searchField}=${encodeURIComponent(params.searchTerm)}`; 
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
      
      setCiclos(items);
      setTotalItems(total);
      setError(null);

    } catch (err) {
      if (err.name === 'AbortError') return;
      console.error("Error fetching ciclos:", err);
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
          sortDirection,
          isSuperAdmin
      };

      if (searchChanged) {
          if (debounceTimeout.current) clearTimeout(debounceTimeout.current);
          debounceTimeout.current = setTimeout(() => {
              fetchCiclosData(params);
          }, 500);
      } else {
          if (debounceTimeout.current) clearTimeout(debounceTimeout.current);
          fetchCiclosData(params);
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
      isSuperAdmin,
      fetchCiclosData
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

  const handleOpenModal = useCallback((ciclo = null) => {
    if (ciclo) {
      setCurrentCiclo(ciclo);
      
      let centroId = '';
      if (ciclo.centro) {
          if (typeof ciclo.centro === 'string') {
              centroId = ciclo.centro.split('/').pop();
          } else if (ciclo.centro.id) {
              centroId = ciclo.centro.id;
          }
      }

      setFormData({
        nombre: ciclo.nombre,
        nivel: ciclo.nivel,
        centro: centroId
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
  }, [isSuperAdmin, user.centro]);

  const handleCloseModal = () => {
    setIsModalOpen(false);
    setCurrentCiclo(null);
    clearErrors();
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
    if (!validateAll(formData)) return;
    setSaving(true);

    try {
      const id = currentCiclo ? getCicloId(currentCiclo) : null;
      const url = currentCiclo 
        ? getApiUrl(`/api/ciclo_formativos/${id}`)
        : getApiUrl('/api/ciclo_formativos');
      
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
        const errorMessage = errorData['hydra:description'] || errorData.detail || errorData.message || t('common.errorSaving', { message: 'Error desconocido' });
        throw new Error(errorMessage);
      }

      // Recargar datos
      fetchCiclosData({
          page: currentPage,
          itemsPerPage,
          searchTerm,
          searchField,
          selectedCentro,
          sortColumn,
          sortDirection,
          isSuperAdmin
      });
      handleCloseModal();
      toast.success(t('common.savedSuccessfully'));

    } catch (err) {
      console.error("Error saving ciclo:", err);
      toast.error(t('common.errorSaving', { message: err.message }));
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = useCallback(async (ciclo) => {
    if (!(await confirm(t('cycles.confirmDelete')))) {
      return;
    }

    const id = getCicloId(ciclo);
    if (!id) return;

    try {
      const response = await fetch(getApiUrl(`/api/ciclo_formativos/${id}`), {
        method: 'DELETE',
        credentials: 'include'
      });

      if (!response.ok) {
        throw new Error(t('cycles.errorDelete'));
      }

      fetchCiclosData({
          page: currentPage,
          itemsPerPage,
          searchTerm,
          searchField,
          selectedCentro,
          sortColumn,
          sortDirection,
          isSuperAdmin
      });
      toast.success(t('common.deletedSuccessfully'));

    } catch (err) {
      console.error("Error deleting ciclo:", err);
      toast.error(t('common.errorDeletingMsg', { message: err.message }));
    }
  }, [currentPage, itemsPerPage, searchTerm, searchField, selectedCentro, sortColumn, sortDirection, isSuperAdmin, fetchCiclosData]);

  const columns = useMemo(() => [
    { header: t('cycles.name'), accessor: 'nombre', sortable: true, sortKey: 'nombre' },
    { header: t('cycles.level'), accessor: 'nivel', sortable: true, sortKey: 'nivel' },
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
        <CrudHeader title={t('cycles.title')}
                    logo={<Lottie animationData={crudAnimation} loop={true} style={{ width: 60, height: 60 }} />}
        >
            {isSuperAdmin && (
                <select 
                    className={styles.select} 
                    value={selectedCentro} 
                    onChange={(e) => setSelectedCentro(e.target.value)}
                    style={{ width: '200px' }}
                >
                    <option value="">{t('common.allCenters')}</option>
                    {centros.map(c => (
                        <option key={c.id} value={c.id}>{c.nombre}</option>
                    ))}
                </select>
            )}
            
            <SearchBar 
                value={searchTerm} 
                onChange={setSearchTerm} 
                placeholder={t('cycles.searchPlaceholder')}
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
            <Button onClick={() => fetchCiclosData({ page: currentPage, itemsPerPage, searchTerm, searchField, selectedCentro, sortColumn, sortDirection, isSuperAdmin })} variant="secondary" style={{ marginTop: '1rem' }}>{t('common.retry')}</Button>
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
            emptyIcon={GraduationCap}
            emptyTitle={t('cycles.emptyTitle')}
            emptyDescription={t('cycles.emptyDescription')}
            emptyAction={t('cycles.newTitle')}
            onEmptyAction={() => handleOpenModal()}
        />

        {/* Modal */}
        <ModalView
            isOpen={isModalOpen}
            onClose={handleCloseModal}
            title={currentCiclo ? t('cycles.editTitle') : t('cycles.newTitle')}
            onSubmit={handleSubmit}
            isSubmitting={saving}
        >
            <FormField label={t('cycles.name')} error={errors.nombre} required>
                <input
                    type="text"
                    name="nombre"
                    value={formData.nombre}
                    onChange={handleInputChange}
                    onBlur={(e) => handleBlur(e, formData)}
                    className={styles.input}
                    placeholder={t('cycles.searchPlaceholder')}
                />
            </FormField>

            <div className={styles.formGroup}>
                <label className={styles.label}>{t('cycles.level')}</label>
                <select
                    name="nivel"
                    value={formData.nivel}
                    onChange={handleInputChange}
                    className={styles.select}
                >
                    <option value="Básico">{t('cycles.levelBasic')}</option>
                    <option value="Medio">{t('cycles.levelMiddle')}</option>
                    <option value="Superior">{t('cycles.levelHigher')}</option>
                    <option value="Curso de Especialización">{t('cycles.levelSpecialization')}</option>
                </select>
            </div>

            {isSuperAdmin && (
                <div className={styles.formGroup}>
                    <label className={styles.label}>{t('cycles.centerLabel')}</label>
                    <select
                        name="centro"
                        value={formData.centro}
                        onChange={handleInputChange}
                        className={styles.select}
                        required
                    >
                        <option value="">{t('common.selectCenter')}</option>
                        {centros.map(c => (
                            <option key={c.id} value={c.id}>{c.nombre}</option>
                        ))}
                    </select>
                </div>
            )}
        </ModalView>
        <ConfirmDialog
            isOpen={confirmOpen}
            message={confirmMessage}
            onConfirm={handleConfirm}
            onCancel={handleCancel}
        />
        </div>
    </Layout>
  );
};

export default CiclosFormativos;
