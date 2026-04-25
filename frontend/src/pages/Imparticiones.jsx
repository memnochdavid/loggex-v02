import React, { useEffect, useState, useMemo, useRef, useCallback } from 'react';
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
import { Plus, Edit2, Trash2 } from 'lucide-react';
import { usePagination } from "../hooks/usePagination.js";
import { getApiUrl } from '../config/api';
import Lottie from 'lottie-react';
import crudAnimation from '../../public/crud.json';
import { useTranslation } from 'react-i18next';
import { toast, parseErrorResponse } from '../utils/toast';
import { useConfirm } from '../context/ConfirmContext';


const Imparticiones = () => {
  const { t } = useTranslation();
  const confirm = useConfirm();
  const { user } = useAuth();
  const isSuperAdmin = user?.roles?.includes('ROLE_SUPERADMIN');

  const [imparticiones, setImparticiones] = useState([]);
  // Las listas auxiliares (profesores/modulos/grupos) ya no se cargan upfront:
  // los AsyncSearchSelect del modal hacen búsqueda on-demand contra la API.
  const [centros, setCentros] = useState([]);
  
  // Estado de carga único
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  
  // Filtros
  const [selectedCentro, setSelectedCentro] = useState('');
  
  // Paginación, Búsqueda y Ordenación
  const [currentPage, setCurrentPage] = useState(1);
  const [totalItems, setTotalItems] = useState(0);
  const [itemsPerPage, setItemsPerPage] = usePagination('imparticiones');
  const [searchTerm, setSearchTerm] = useState('');
  const [searchField, setSearchField] = useState('profesor.nombre');
  const [sortColumn, setSortColumn] = useState('id');
  const [sortDirection, setSortDirection] = useState('asc');

  // Refs para control de flujo
  const debounceTimeout = useRef(null);
  const prevSearchTerm = useRef(searchTerm);
  const prevSearchField = useRef(searchField);
  const abortController = useRef(null);

  // Campos buscables
  const searchFields = [
      { value: 'profesor.nombre', label: t('teaching.teacher') },
      { value: 'modulo.nombre', label: t('teaching.module') },
      { value: 'grupo.nombre', label: t('teaching.group') }
  ];

  // Estado para el modal
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [currentImparticion, setCurrentImparticion] = useState(null);
  const [formData, setFormData] = useState({
    profesor: '',
    modulo: '',
    grupo: ''
  });
  const [saving, setSaving] = useState(false);

  // Filtro derivado del grupo seleccionado para la cascada Grupo → Módulo:
  // un módulo elegible debe pertenecer al mismo ciclo y al mismo curso que el grupo.
  const [grupoFilter, setGrupoFilter] = useState({ ciclo: '', curso: '' });

  // Helper para extraer id de un valor que puede ser objeto, IRI string o id puro.
  const extractId = (raw) => {
    if (raw == null) return '';
    if (typeof raw === 'object') return String(raw.id || raw['@id']?.split('/').pop() || '');
    if (typeof raw === 'string') return String(raw.split('/').pop());
    return String(raw);
  };

  // El antiguo `filteredModulos` (cascada Grupo→Módulo en cliente) se ha sustituido
  // por extraParams del AsyncSearchSelect: el módulo se filtra en servidor por
  // ?ciclo=<grupo.ciclo>&curso=<grupo.curso>, derivado del state grupoFilter.

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

  // (Antes había aquí un useEffect que precargaba profesores+módulos+grupos al
  // montar la página. Ya no es necesario: cada AsyncSearchSelect del modal hace
  // su propia búsqueda servidor on-demand cuando el usuario teclea.)

  const getImparticionId = (i) => {
    if (i.id) return i.id;
    if (i['@id']) {
        const parts = i['@id'].split('/');
        return parts[parts.length - 1];
    }
    return null;
  };

  // Función de carga optimizada
  const fetchImparticionesData = useCallback(async (params) => {
    if (abortController.current) {
        abortController.current.abort();
    }
    abortController.current = new AbortController();

    setLoading(true);

    try {
      let url = getApiUrl(`/api/imparticions?page=${params.page}&itemsPerPage=${params.itemsPerPage}`);
      
      if (params.selectedCentro) {
          url += `&grupo.centro=${params.selectedCentro}`;
      }

      if (params.searchTerm) {
          url += `&${params.searchField}=${encodeURIComponent(params.searchTerm)}`;
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
      
      setImparticiones(items);
      setTotalItems(total);
      setError(null);

    } catch (err) {
      if (err.name === 'AbortError') return;
      console.error("Error fetching imparticiones:", err);
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
              fetchImparticionesData(params);
          }, 500);
      } else {
          if (debounceTimeout.current) clearTimeout(debounceTimeout.current);
          fetchImparticionesData(params);
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
      fetchImparticionesData
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

  const handleOpenModal = useCallback((imparticion = null) => {
    if (imparticion) {
      setCurrentImparticion(imparticion);

      const grupoId = extractId(imparticion.grupo);
      setFormData({
        profesor: extractId(imparticion.profesor),
        modulo: extractId(imparticion.modulo),
        grupo: grupoId
      });

      // Hidratar el filtro grupo→módulo para que el AsyncSearchSelect de módulo
      // restrinja al ciclo+curso correctos también en modo edición.
      if (grupoId) {
        fetch(getApiUrl(`/api/grupos/${grupoId}`), {
          headers: { Accept: 'application/ld+json' },
          credentials: 'include'
        })
          .then(r => r.ok ? r.json() : null)
          .then(g => {
            if (!g) return;
            setGrupoFilter({
              ciclo: extractId(g.ciclo),
              curso: g.curso != null ? String(g.curso) : ''
            });
          })
          .catch(() => { /* fallo silencioso: el modal sigue funcionando, solo sin filtro de cascada */ });
      } else {
        setGrupoFilter({ ciclo: '', curso: '' });
      }
    } else {
      setCurrentImparticion(null);
      setFormData({
        profesor: '',
        modulo: '',
        grupo: ''
      });
      setGrupoFilter({ ciclo: '', curso: '' });
    }
    setIsModalOpen(true);
  }, []);

  const handleCloseModal = () => {
    setIsModalOpen(false);
    setCurrentImparticion(null);
  };

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    
    setFormData(prev => {
        const newData = { ...prev, [name]: value };
        
        if (name === 'grupo') {
            newData.modulo = ''; 
        }

        return newData;
    });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);

    try {
      const id = currentImparticion ? getImparticionId(currentImparticion) : null;
      const url = currentImparticion 
        ? getApiUrl(`/api/imparticions/${id}`)
        : getApiUrl('/api/imparticions');
      
      const method = currentImparticion ? 'PUT' : 'POST';

      const profesorValue = String(formData.profesor);
      const moduloValue = String(formData.modulo);
      const grupoValue = String(formData.grupo);

      const payload = {
        profesor: profesorValue.includes('/api/') ? profesorValue : `/api/users/${profesorValue}`,
        modulo: moduloValue.includes('/api/') ? moduloValue : `/api/modulos/${moduloValue}`,
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
      fetchImparticionesData({
          page: currentPage,
          itemsPerPage,
          searchTerm,
          searchField,
          selectedCentro,
          sortColumn,
          sortDirection
      });
      handleCloseModal();
      toast.success(currentImparticion
        ? t('teaching.updatedSuccess', { defaultValue: 'Impartición actualizada' })
        : t('teaching.createdSuccess', { defaultValue: 'Impartición creada' }));

    } catch (err) {
      console.error("Error saving imparticion:", err);
      toast.error(err.message, {
        description: currentImparticion
          ? t('teaching.errorUpdating', { defaultValue: 'No se ha podido actualizar la impartición' })
          : t('teaching.errorCreating', { defaultValue: 'No se ha podido crear la impartición' })
      });
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = useCallback(async (imparticion) => {
    if (!(await confirm({ body: t('teaching.confirmDelete') }))) {
      return;
    }

    const id = getImparticionId(imparticion);
    if (!id) return;

    try {
      const response = await fetch(getApiUrl(`/api/imparticions/${id}`), {
        method: 'DELETE',
        credentials: 'include'
      });

      if (!response.ok) {
        const message = await parseErrorResponse(response, t('teaching.errorDelete'));
        throw new Error(message);
      }

      fetchImparticionesData({
          page: currentPage,
          itemsPerPage,
          searchTerm,
          searchField,
          selectedCentro,
          sortColumn,
          sortDirection
      });
      toast.success(t('teaching.deletedSuccess', { defaultValue: 'Impartición eliminada' }));

    } catch (err) {
      console.error("Error deleting imparticion:", err);
      toast.error(err.message, {
        description: t('teaching.errorDeletingCtx', { defaultValue: 'No se ha podido eliminar la impartición' })
      });
    }
  }, [currentPage, itemsPerPage, searchTerm, searchField, selectedCentro, sortColumn, sortDirection, fetchImparticionesData, t]);

  const columns = useMemo(() => [
    { 
        header: t('teaching.teacher'), 
        accessor: (row) => row.profesor ? `${row.profesor.nombre} ${row.profesor.apellidos}` : '-', 
        sortable: true, 
        sortKey: 'profesor.nombre' 
    },
    { 
        header: t('teaching.module'),
        accessor: (row) => row.modulo ? <ModuloLabel modulo={row.modulo} /> : '-',
        sortable: true,
        sortKey: 'modulo.nombre'
    },
    { 
        header: t('teaching.group'), 
        accessor: (row) => row.grupo ? (row.grupo.abreviatura || row.grupo.nombre) : '-', 
        sortable: true, 
        sortKey: 'grupo.nombre' 
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
        <CrudHeader title={t('teaching.title')}
                    logo={<Lottie animationData={crudAnimation} loop={true} style={{ width: 56, height: 56 }} />}
        >
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
                placeholder={t('common.search')}
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
            <Button onClick={() => fetchImparticionesData({ page: currentPage, itemsPerPage, searchTerm, searchField, selectedCentro, sortColumn, sortDirection })} variant="secondary" style={{ marginTop: '1rem' }}>{t('common.retry')}</Button>
            </div>
        )}

        <DataTable
            columns={columns}
            data={imparticiones}
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
            title={currentImparticion ? t('teaching.editTitle') : t('teaching.newTitle')}
            onSubmit={handleSubmit}
            isSubmitting={saving}
        >
            <div className={styles.formGroup}>
                <label className={styles.label}>{t('teaching.teacher', { defaultValue: 'Profesor' })}</label>
                <AsyncSearchSelect
                    name="profesor"
                    value={formData.profesor}
                    onChange={(v) => setFormData(p => ({ ...p, profesor: v }))}
                    endpoint="/api/users"
                    extraParams={{
                        rol_app: 'profesor',
                        ...(isSuperAdmin && selectedCentro ? { centro: selectedCentro } : {})
                    }}
                    getOptionLabel={(p) => `${p.nombre} ${p.apellidos}`}
                    getOptionValue={(p) => p.id || p['@id']?.split('/').pop()}
                    placeholder={t('common.selectTeacher')}
                    required
                />
            </div>

            <div className={styles.formGroup}>
                <label className={styles.label}>{t('teaching.group', { defaultValue: 'Grupo' })}</label>
                <AsyncSearchSelect
                    name="grupo"
                    value={formData.grupo}
                    onChange={(v, item) => {
                        // Cambiar grupo: vacía el módulo y actualiza el filtro de cascada.
                        setFormData(p => ({ ...p, grupo: v, modulo: '' }));
                        if (item) {
                            setGrupoFilter({
                                ciclo: extractId(item.ciclo),
                                curso: item.curso != null ? String(item.curso) : ''
                            });
                        } else {
                            setGrupoFilter({ ciclo: '', curso: '' });
                        }
                    }}
                    endpoint="/api/grupos"
                    extraParams={isSuperAdmin && selectedCentro ? { centro: selectedCentro } : {}}
                    getOptionLabel={(g) => g.abreviatura || g.nombre}
                    getOptionValue={(g) => g.id || g['@id']?.split('/').pop()}
                    placeholder={t('common.selectGroup')}
                    required
                />
            </div>

            <div className={styles.formGroup}>
                <label className={styles.label}>{t('teaching.module', { defaultValue: 'Módulo' })}</label>
                <AsyncSearchSelect
                    name="modulo"
                    value={formData.modulo}
                    onChange={(v) => setFormData(p => ({ ...p, modulo: v }))}
                    endpoint="/api/modulos"
                    extraParams={{
                        ...(grupoFilter.ciclo ? { ciclo: grupoFilter.ciclo } : {}),
                        ...(grupoFilter.curso ? { curso: grupoFilter.curso } : {}),
                    }}
                    getOptionLabel={(m) => `${m.nombre} (${m.codigoOficial}) - ${m.curso}º`}
                    getOptionValue={(m) => m.id || m['@id']?.split('/').pop()}
                    placeholder={formData.grupo ? t('common.selectModule') : t('teaching.selectGroupFirst')}
                    disabled={!formData.grupo}
                    required
                />
            </div>
        </ModalView>
        </div>
    </Layout>
  );
};

export default Imparticiones;
