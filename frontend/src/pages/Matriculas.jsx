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
import { useAuth } from '../context/AuthContext';
import { usePagination } from '../hooks/usePagination';
import { Plus, Edit2, Trash2 } from 'lucide-react';
import { getApiUrl } from '../config/api';
import Lottie from 'lottie-react';
import crudAnimation from '../../public/crud.json';
import { useTranslation } from 'react-i18next';
import { toast, parseErrorResponse } from '../utils/toast';
import { useConfirm } from '../context/ConfirmContext';
import { formatGrupoNombre, formatGrupoAbrev } from '../utils/grupo';

const Matriculas = () => {
  const { t } = useTranslation();
  const confirm = useConfirm();
  const { user } = useAuth();
  const isSuperAdmin = user?.roles?.includes('ROLE_SUPERADMIN');

  const [matriculas, setMatriculas] = useState([]);
  const [grupos, setGrupos] = useState([]);
  const [centros, setCentros] = useState([]);
  
  // Estado de carga único
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  
  // Filtros
  const [selectedCentro, setSelectedCentro] = useState('');
  const [selectedGrupo, setSelectedGrupo] = useState('');
  
  // Paginación, Búsqueda y Ordenación
  const [currentPage, setCurrentPage] = useState(1);
  const [totalItems, setTotalItems] = useState(0);
  
  // Usar hook de paginación
  const [itemsPerPage, setItemsPerPage] = usePagination('matriculas');

  const [searchTerm, setSearchTerm] = useState('');
  const [searchField, setSearchField] = useState('alumno.nombre');
  const [sortColumn, setSortColumn] = useState('id');
  const [sortDirection, setSortDirection] = useState('asc');

  // Refs para control de flujo
  const debounceTimeout = useRef(null);
  const prevSearchTerm = useRef(searchTerm);
  const prevSearchField = useRef(searchField);
  const abortController = useRef(null);

  // Campos buscables
  const searchFields = [
      { value: 'alumno.nombre', label: t('enrollments.student') },
      { value: 'grupo.nombre', label: t('enrollments.group') }
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

  // Cargar grupos para el filtro de la cabecera (el alumno del modal lo busca AsyncSearchSelect)
  useEffect(() => {
    let urlGrupos = getApiUrl('/api/grupos?pagination=false');
    if (isSuperAdmin && selectedCentro) {
        urlGrupos += `&centro=${selectedCentro}`;
    }
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

  }, [selectedCentro, isSuperAdmin]);

  const getMatriculaId = (m) => {
    if (m.id) return m.id;
    if (m['@id']) {
        const parts = m['@id'].split('/');
        return parts[parts.length - 1];
    }
    return null;
  };

  // Función de carga optimizada
  const fetchMatriculasData = useCallback(async (params) => {
    if (abortController.current) {
        abortController.current.abort();
    }
    abortController.current = new AbortController();

    setLoading(true);

    try {
      let url = getApiUrl(`/api/matriculas?page=${params.page}&itemsPerPage=${params.itemsPerPage}`);
      
      if (params.selectedCentro) {
          url += `&grupo.centro=${params.selectedCentro}`;
      }

      if (params.searchTerm) {
          url += `&${params.searchField}=${encodeURIComponent(params.searchTerm)}`;
      }

      if (params.selectedGrupo) {
          url += `&grupo=${params.selectedGrupo}`;
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
      
      setMatriculas(items);
      setTotalItems(total);
      setError(null);

    } catch (err) {
      if (err.name === 'AbortError') return;
      console.error("Error fetching matriculas:", err);
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
          selectedGrupo,
          sortColumn,
          sortDirection
      };

      if (searchChanged) {
          if (debounceTimeout.current) clearTimeout(debounceTimeout.current);
          debounceTimeout.current = setTimeout(() => {
              fetchMatriculasData(params);
          }, 500);
      } else {
          if (debounceTimeout.current) clearTimeout(debounceTimeout.current);
          fetchMatriculasData(params);
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
      selectedGrupo,
      sortColumn,
      sortDirection,
      fetchMatriculasData
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

  const handleOpenModal = useCallback((matricula = null) => {
    if (matricula) {
      setCurrentMatricula(matricula);
      
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
  }, []);

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
        ? getApiUrl(`/api/matriculas/${id}`)
        : getApiUrl('/api/matriculas');
      
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
        const message = await parseErrorResponse(response);
        throw new Error(message);
      }

      // Recargar datos
      fetchMatriculasData({
          page: currentPage,
          itemsPerPage,
          searchTerm,
          searchField,
          selectedCentro,
          selectedGrupo,
          sortColumn,
          sortDirection
      });
      handleCloseModal();
      toast.success(currentMatricula
        ? t('enrollments.updatedSuccess', { defaultValue: 'Matrícula actualizada' })
        : t('enrollments.createdSuccess', { defaultValue: 'Matrícula creada' }));

    } catch (err) {
      console.error("Error saving matricula:", err);
      toast.error(err.message, {
        description: currentMatricula
          ? t('enrollments.errorUpdating', { defaultValue: 'No se ha podido actualizar la matrícula' })
          : t('enrollments.errorCreating', { defaultValue: 'No se ha podido crear la matrícula' })
      });
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = useCallback(async (matricula) => {
    if (!(await confirm({ body: t('enrollments.confirmDelete') }))) {
      return;
    }

    const id = getMatriculaId(matricula);
    if (!id) return;

    try {
      const response = await fetch(getApiUrl(`/api/matriculas/${id}`), {
        method: 'DELETE',
        credentials: 'include'
      });

      if (!response.ok) {
        const message = await parseErrorResponse(response, t('enrollments.errorDelete'));
        throw new Error(message);
      }

      fetchMatriculasData({
          page: currentPage,
          itemsPerPage,
          searchTerm,
          searchField,
          selectedCentro,
          selectedGrupo,
          sortColumn,
          sortDirection
      });
      toast.success(t('enrollments.deletedSuccess', { defaultValue: 'Matrícula eliminada' }));

    } catch (err) {
      console.error("Error deleting matricula:", err);
      toast.error(err.message, {
        description: t('enrollments.errorDeletingCtx', { defaultValue: 'No se ha podido eliminar la matrícula' })
      });
    }
  }, [currentPage, itemsPerPage, searchTerm, searchField, selectedCentro, selectedGrupo, sortColumn, sortDirection, fetchMatriculasData, t]);

  const columns = useMemo(() => [
    { 
        header: t('enrollments.student'), 
        accessor: (row) => row.alumno ? `${row.alumno.nombre} ${row.alumno.apellidos}` : '-', 
        sortable: true, 
        sortKey: 'alumno.nombre' 
    },
    {
        header: t('enrollments.group'),
        accessor: (row) => row.grupo ? formatGrupoAbrev(row.grupo) : '-',
        sortable: true,
        sortKey: 'grupo.nombre'
    },
    {
        header: t('enrollments.schoolYear'),
        accessor: (row) => row.grupo?.anioEscolar || '-',
        sortable: true,
        sortKey: 'grupo.anioEscolar'
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
        <CrudHeader title={t('enrollments.title')}
 subtitle={t('enrollments.subtitle')}
                    logo={<Lottie animationData={crudAnimation} loop={true} style={{ width: 56, height: 56 }} />}
        >
            {isSuperAdmin && (
                <ThemedSelect
                    value={selectedCentro}
                    onChange={(v) => { setSelectedCentro(v); setSelectedGrupo(''); }}
                    minWidth={200}
                    ariaLabel={t('common.allCenters')}
                    options={[
                        { value: '', label: t('common.allCenters') },
                        ...centros.map(c => ({ value: String(c.id), label: c.nombre })),
                    ]}
                />
            )}

            <ThemedSelect
                value={selectedGrupo}
                onChange={setSelectedGrupo}
                minWidth={200}
                ariaLabel={t('common.allGroups')}
                options={[
                    { value: '', label: t('common.allGroups') },
                    ...grupos.map(g => ({
                        value: String(g.id || g['@id']?.split('/').pop()),
                        label: formatGrupoNombre(g),
                    })),
                ]}
            />

            <SearchBar
                value={searchTerm} 
                onChange={setSearchTerm} 
                placeholder={t('enrollments.searchPlaceholder')}
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
            <Button onClick={() => fetchMatriculasData({ page: currentPage, itemsPerPage, searchTerm, searchField, selectedCentro, selectedGrupo, sortColumn, sortDirection })} variant="secondary" style={{ marginTop: '1rem' }}>{t('common.retry')}</Button>
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
            mobileBreakpoint={'600px'}
        />

        <ModalView
            isOpen={isModalOpen}
            onClose={handleCloseModal}
            title={currentMatricula ? t('enrollments.editTitle') : t('enrollments.newTitle')}
            onSubmit={handleSubmit}
            isSubmitting={saving}
        >
            <div className={styles.formGroup}>
                <label className={styles.label}>{t('enrollments.student')}</label>
                <AsyncSearchSelect
                    name="alumno"
                    value={formData.alumno}
                    onChange={(v) => setFormData(p => ({ ...p, alumno: v }))}
                    endpoint="/api/users"
                    extraParams={{
                        rol_app: 'alumno',
                        ...(isSuperAdmin && selectedCentro ? { centro: selectedCentro } : {})
                    }}
                    getOptionLabel={(a) => `${a.nombre} ${a.apellidos} (${a.email})`}
                    getOptionValue={(a) => a.id || a['@id']?.split('/').pop()}
                    placeholder={t('common.selectStudent')}
                    required
                />
            </div>

            <div className={styles.formGroup}>
                <label className={styles.label}>{t('enrollments.group')}</label>
                <AsyncSearchSelect
                    name="grupo"
                    value={formData.grupo}
                    onChange={(v) => setFormData(p => ({ ...p, grupo: v }))}
                    endpoint="/api/grupos"
                    extraParams={isSuperAdmin && selectedCentro ? { centro: selectedCentro } : {}}
                    getOptionLabel={(g) => formatGrupoNombre(g)}
                    getOptionValue={(g) => g.id || g['@id']?.split('/').pop()}
                    placeholder={t('common.selectGroup')}
                    required
                />
            </div>
        </ModalView>
        </div>
    </Layout>
  );
};

export default Matriculas;
