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
import useLiveRefetch from '../hooks/useLiveRefetch';
import { Plus, Edit2, Trash2 } from 'lucide-react';
import { getApiUrl } from '../config/api';
import Lottie from 'lottie-react';
import crudAnimation from '../../public/crud.json';
import { useTranslation } from 'react-i18next';
import { toast, parseErrorResponse } from '../utils/toast';
import { useConfirm } from '../context/ConfirmContext';

// Códigos ISO 3166-2:ES con su nombre. Cubren las 19 entidades autonómicas.
// Si la lista crece o cambia (no debería: están fijadas constitucionalmente)
// mover a un endpoint backend. Mientras tanto hard-coded para evitar fetch extra.
const CCAA_OPTIONS = [
  { value: 'AN', label: 'Andalucía' },
  { value: 'AR', label: 'Aragón' },
  { value: 'AS', label: 'Asturias' },
  { value: 'CB', label: 'Cantabria' },
  { value: 'CE', label: 'Ceuta' },
  { value: 'CL', label: 'Castilla y León' },
  { value: 'CM', label: 'Castilla-La Mancha' },
  { value: 'CN', label: 'Canarias' },
  { value: 'CT', label: 'Cataluña' },
  { value: 'EX', label: 'Extremadura' },
  { value: 'GA', label: 'Galicia' },
  { value: 'IB', label: 'Illes Balears' },
  { value: 'MC', label: 'Murcia' },
  { value: 'MD', label: 'Madrid' },
  { value: 'ML', label: 'Melilla' },
  { value: 'NC', label: 'Navarra' },
  { value: 'PV', label: 'País Vasco' },
  { value: 'RI', label: 'La Rioja' },
  { value: 'VC', label: 'C. Valenciana' },
];


const Itinerarios = () => {
  const { t } = useTranslation();
  const confirm = useConfirm();
  const { user } = useAuth();
  const isSuperAdmin = user?.roles?.includes('ROLE_SUPERADMIN');

  const [itinerarios, setItinerarios] = useState([]);
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
      { value: 'nombre', label: t('itinerarios.name') },
      { value: 'nivel', label: t('itinerarios.level') }
  ];

  // Estado para el modal
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [currentItinerario, setCurrentItinerario] = useState(null);
  const [formData, setFormData] = useState({
    nombre: '',
    nivel: 'Superior', // Default
    centro: '',
    jornadaTipo: '',
    ccaa: '',
  });
  const [saving, setSaving] = useState(false);
  const [applyingOverlay, setApplyingOverlay] = useState(false);

  // Modo de creación: 'catalogo' usa AsyncSearchSelect contra el catálogo oficial
  // y materializa el itinerario + sus materias en backend. 'manual' es el formulario
  // tradicional. En modo edición no aplica (siempre manual). Default: catálogo.
  const [createMode, setCreateMode] = useState('catalogo');
  const [selectedCatalogoItinerarioId, setSelectedCatalogoItinerarioId] = useState('');
  const [selectedCatalogoItinerario, setSelectedCatalogoItinerario] = useState(null);

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

  const getItinerarioId = (c) => {
    if (c.id) return c.id;
    if (c['@id']) {
        const parts = c['@id'].split('/');
        return parts[parts.length - 1];
    }
    return null;
  };

  // Función de carga optimizada
  const fetchItinerariosData = useCallback(async (params) => {
    if (abortController.current) {
        abortController.current.abort();
    }
    abortController.current = new AbortController();

    setLoading(true);

    try {
      let url = getApiUrl(`/api/itinerarios?page=${params.page}&itemsPerPage=${params.itemsPerPage}`);
      
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
      
      setItinerarios(items);
      setTotalItems(total);
      setError(null);

    } catch (err) {
      if (err.name === 'AbortError') return;
      console.error("Error fetching itinerarios:", err);
      setError(err.message);
    } finally {
      if (abortController.current && !abortController.current.signal.aborted) {
          setLoading(false);
      }
    }
  }, []); 

  // Mercure live: refetch ante alta/edición/borrado de itinerarios del centro.
  const liveTopics = useMemo(() => {
      const cid = isSuperAdmin ? (selectedCentro || '{cid}') : user?.centro?.id;
      return cid ? [`/admin/centros/${cid}/itinerarios`] : [];
  }, [isSuperAdmin, selectedCentro, user?.centro?.id]);

  useLiveRefetch(liveTopics, () => {
      fetchItinerariosData({
          page: currentPage,
          itemsPerPage,
          searchTerm,
          searchField,
          selectedCentro,
          sortColumn,
          sortDirection,
          isSuperAdmin,
      });
  });

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
              fetchItinerariosData(params);
          }, 500);
      } else {
          if (debounceTimeout.current) clearTimeout(debounceTimeout.current);
          fetchItinerariosData(params);
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
      fetchItinerariosData
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

  const handleOpenModal = useCallback((itinerario = null) => {
    if (itinerario) {
      setCurrentItinerario(itinerario);

      // El backend serializa FKs en uno de tres formatos según el contexto:
      // string IRI, objeto con `.id`, u objeto JSON-LD con `@id`.
      const extractIdFromRef = (ref) => {
          if (!ref) return '';
          if (typeof ref === 'string') return ref.split('/').pop();
          if (typeof ref === 'object') {
              return String(ref.id || (ref['@id'] ? ref['@id'].split('/').pop() : ''));
          }
          return '';
      };
      const centroId = extractIdFromRef(itinerario.centro);
      const jornadaTipoId = extractIdFromRef(itinerario.jornadaTipo);
      const catalogoOrigenId = extractIdFromRef(itinerario.catalogoOrigen);

      setFormData({
        nombre: itinerario.nombre,
        nivel: itinerario.nivel,
        centro: centroId,
        jornadaTipo: jornadaTipoId,
        ccaa: itinerario.ccaa || '',
        catalogoOrigen: catalogoOrigenId,
      });
    } else {
      setCurrentItinerario(null);
      // Resolver centro del usuario (puede venir como objeto, IRI o JSON-LD).
      let centroDefault = '';
      let ccaaDefault = '';
      if (!isSuperAdmin && user?.centro) {
        if (typeof user.centro === 'object' && user.centro.id) {
          centroDefault = String(user.centro.id);
          ccaaDefault = user.centro.ccaa || '';
        } else if (typeof user.centro === 'string') {
          centroDefault = user.centro.split('/').pop();
        } else if (typeof user.centro === 'object' && user.centro['@id']) {
          centroDefault = user.centro['@id'].split('/').pop();
          ccaaDefault = user.centro.ccaa || '';
        }
      }
      setFormData({
        nombre: '',
        nivel: 'Superior',
        centro: centroDefault,
        jornadaTipo: '',
        ccaa: ccaaDefault,
      });
      // Reset del modo creación: por defecto catálogo (es la vía recomendada).
      setCreateMode('catalogo');
      setSelectedCatalogoItinerarioId('');
      setSelectedCatalogoItinerario(null);
    }
    setIsModalOpen(true);
  }, [isSuperAdmin, user.centro]);

  const handleCloseModal = () => {
    setIsModalOpen(false);
    setCurrentItinerario(null);
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

    // Caso especial: creación desde el catálogo oficial. Llama al endpoint
    // /api/itinerarios/from-catalogo que materializa el itinerario + sus materias.
    if (!currentItinerario && createMode === 'catalogo') {
      try {
        if (!selectedCatalogoItinerarioId) {
          toast.warning(t('itinerarios.catalogo.selectRequired', { defaultValue: 'Selecciona un itinerario del catálogo o cambia a modo manual.' }));
          setSaving(false);
          return;
        }

        const payload = {
          catalogoItinerarioId: parseInt(selectedCatalogoItinerarioId, 10),
        };
        if (isSuperAdmin && formData.centro) {
          payload.centroId = parseInt(formData.centro, 10);
        }

        const response = await fetch(getApiUrl('/api/itinerarios/from-catalogo'), {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify(payload),
        });

        if (!response.ok) {
          const message = await parseErrorResponse(response);
          throw new Error(message);
        }

        const data = await response.json();
        fetchItinerariosData({
          page: currentPage, itemsPerPage, searchTerm, searchField,
          selectedCentro, sortColumn, sortDirection, isSuperAdmin
        });
        handleCloseModal();
        toast.success(t('itinerarios.catalogo.createdSuccess', {
          defaultValue: 'Itinerario creado desde el catálogo con {{count}} materias',
          count: data.modulosCreados ?? 0,
        }));
      } catch (err) {
        console.error('Error creando itinerario desde catálogo:', err);
        toast.error(err.message, {
          description: t('itinerarios.errorCreating', { defaultValue: 'No se ha podido crear el itinerario' }),
        });
      } finally {
        setSaving(false);
      }
      return;
    }

    // Flujo manual (creación tradicional o edición).
    if (!formData.centro) {
      toast.error(t('itinerarios.centroRequired', { defaultValue: 'Selecciona un centro antes de guardar.' }));
      setSaving(false);
      return;
    }
    try {
      const id = currentItinerario ? getItinerarioId(currentItinerario) : null;
      const url = currentItinerario
        ? getApiUrl(`/api/itinerarios/${id}`)
        : getApiUrl('/api/itinerarios');

      const method = currentItinerario ? 'PUT' : 'POST';

      const payload = {
        ...formData,
        centro: `/api/centros/${formData.centro}`,
        jornadaTipo: formData.jornadaTipo ? `/api/jornada_tipos/${formData.jornadaTipo}` : null,
        ccaa: formData.ccaa || null,
        // Preserva la FK al catálogo si existe; necesario para que el resync CCAA
        // pueda resolver overrides (sin esto, el PUT borra la FK).
        catalogoOrigen: formData.catalogoOrigen ? `/api/catalogo_itinerarios/${formData.catalogoOrigen}` : null,
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
      fetchItinerariosData({
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
      toast.success(currentItinerario
        ? t('itinerarios.updatedSuccess', { defaultValue: 'Itinerario actualizado' })
        : t('itinerarios.createdSuccess', { defaultValue: 'Itinerario creado' }));

    } catch (err) {
      console.error("Error saving itinerario:", err);
      toast.error(err.message, {
        description: currentItinerario
          ? t('itinerarios.errorUpdating', { defaultValue: 'No se ha podido actualizar el itinerario' })
          : t('itinerarios.errorCreating', { defaultValue: 'No se ha podido crear el itinerario' })
      });
    } finally {
      setSaving(false);
    }
  };

  // Re-sincroniza los grupos del itinerario aplicando el overlay CCAA vigente.
  // Llama al endpoint /api/v1/grupos/{id}/resync-ccaa por cada grupo y acumula
  // estadísticas para mostrar en el toast.
  const handleAplicarOverlay = async (itinerario) => {
    const itinId = getItinerarioId(itinerario);
    if (!itinId) return;
    if (!(await confirm({
      body: t('itinerarios.confirmApplyOverlay', {
        defaultValue: 'Esto re-sincronizará todos los grupos del itinerario con el overlay CCAA. Las materias del catálogo que no apliquen se desactivarán y se crearán las autonómicas. Las materias manuales se conservan. ¿Continuar?'
      })
    }))) return;

    setApplyingOverlay(true);
    try {
      const gruposRes = await fetch(getApiUrl(`/api/grupos?itinerario=${itinId}&pagination=false`),
        { headers: { 'Accept': 'application/ld+json' }, credentials: 'include' });
      const gruposData = await gruposRes.json();
      const grupos = gruposData['hydra:member'] || gruposData.member || [];

      if (grupos.length === 0) {
        toast.info(t('itinerarios.applyOverlayNoGroups', { defaultValue: 'El itinerario no tiene grupos. Solo se actualizó el itinerario.' }));
        return;
      }

      const totals = { actualizadas: 0, creadas: 0, desactivadas: 0, sinCambios: 0, manualesIgnoradas: 0, errores: 0 };
      for (const g of grupos) {
        try {
          const r = await fetch(getApiUrl(`/api/v1/grupos/${g.id}/resync-ccaa`), {
            method: 'POST', credentials: 'include',
          });
          if (!r.ok) { totals.errores++; continue; }
          const data = await r.json();
          for (const k of Object.keys(totals)) {
            if (data.stats?.[k] !== undefined) totals[k] += data.stats[k];
          }
        } catch (err) {
          console.error('Resync ccaa error:', err);
          totals.errores++;
        }
      }

      if (totals.errores > 0) {
        toast.error(t('itinerarios.applyOverlayErrors', {
          defaultValue: 'Overlay aplicado parcialmente: {{e}} grupos fallaron (revisa logs del backend). Creadas: {{c}}, actualizadas: {{u}}, desactivadas: {{d}}.',
          e: totals.errores, c: totals.creadas, u: totals.actualizadas, d: totals.desactivadas,
        }));
      } else {
        toast.success(t('itinerarios.applyOverlayDone', {
          defaultValue: 'Overlay aplicado a {{groups}} grupos. Creadas: {{c}}, actualizadas: {{u}}, desactivadas: {{d}}, sin cambios: {{n}}.',
          groups: grupos.length, c: totals.creadas, u: totals.actualizadas, d: totals.desactivadas, n: totals.sinCambios,
        }));
      }
    } catch (err) {
      console.error('Error aplicando overlay:', err);
      toast.error(err.message || t('itinerarios.applyOverlayError', { defaultValue: 'Error aplicando overlay CCAA.' }));
    } finally {
      setApplyingOverlay(false);
    }
  };

  const handleDelete = useCallback(async (itinerario) => {
    if (!(await confirm({ body: t('itinerarios.confirmDelete') }))) {
      return;
    }

    const id = getItinerarioId(itinerario);
    if (!id) return;

    try {
      const response = await fetch(getApiUrl(`/api/itinerarios/${id}`), {
        method: 'DELETE',
        credentials: 'include'
      });

      if (!response.ok) {
        const message = await parseErrorResponse(response, t('itinerarios.errorDelete'));
        throw new Error(message);
      }

      fetchItinerariosData({
          page: currentPage,
          itemsPerPage,
          searchTerm,
          searchField,
          selectedCentro,
          sortColumn,
          sortDirection,
          isSuperAdmin
      });
      toast.success(t('itinerarios.deletedSuccess', { defaultValue: 'Itinerario eliminado' }));

    } catch (err) {
      console.error("Error deleting itinerario:", err);
      toast.error(err.message, {
        description: t('itinerarios.errorDeletingCtx', { defaultValue: 'No se ha podido eliminar el itinerario' })
      });
    }
  }, [currentPage, itemsPerPage, searchTerm, searchField, selectedCentro, sortColumn, sortDirection, isSuperAdmin, fetchItinerariosData, t]);

  const columns = useMemo(() => [
    { header: t('itinerarios.name'), accessor: 'nombre', sortable: true, sortKey: 'nombre' },
    { header: t('itinerarios.level'), accessor: 'nivel', sortable: true, sortKey: 'nivel' },
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
        <CrudHeader title={t('itinerarios.title')}
 subtitle={t('itinerarios.subtitle')}
                    breadcrumbs={[
                        { label: t('sidebar.home'), to: '/' },
                        { label: t('itinerarios.title') },
                    ]}
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
                placeholder={t('itinerarios.searchPlaceholder')}
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
            <Button onClick={() => fetchItinerariosData({ page: currentPage, itemsPerPage, searchTerm, searchField, selectedCentro, sortColumn, sortDirection, isSuperAdmin })} variant="secondary" style={{ marginTop: '1rem' }}>{t('common.retry')}</Button>
            </div>
        )}

        <DataTable
            columns={columns}
            data={itinerarios}
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
            title={currentItinerario ? t('itinerarios.editTitle') : t('itinerarios.newTitle')}
            onSubmit={handleSubmit}
            isSubmitting={saving}
        >
            {/* Toggle de modo (solo en creación). Edición siempre es manual. */}
            {!currentItinerario && (
                <div className={styles.formGroup}>
                    <div className={styles.modeToggle} role="tablist" aria-label={t('itinerarios.modeToggleAria', { defaultValue: 'Modo de creación' })}>
                        <button
                            type="button"
                            role="tab"
                            aria-selected={createMode === 'catalogo'}
                            className={`${styles.modeToggleBtn} ${createMode === 'catalogo' ? styles.modeToggleActive : ''}`}
                            onClick={() => setCreateMode('catalogo')}
                        >
                            {t('itinerarios.modeCatalogo', { defaultValue: 'Catálogo oficial' })}
                        </button>
                        <button
                            type="button"
                            role="tab"
                            aria-selected={createMode === 'manual'}
                            className={`${styles.modeToggleBtn} ${createMode === 'manual' ? styles.modeToggleActive : ''}`}
                            onClick={() => setCreateMode('manual')}
                        >
                            {t('itinerarios.modeManual', { defaultValue: 'Manual' })}
                        </button>
                    </div>
                </div>
            )}

            {/* MODO CATÁLOGO: AsyncSearchSelect contra /api/catalogo_itinerarios + preview + centro */}
            {!currentItinerario && createMode === 'catalogo' ? (
                <>
                    <div className={styles.formGroup}>
                        <label className={styles.label}>
                            {t('itinerarios.catalogo.searchLabel', { defaultValue: 'Buscar en el catálogo oficial' })}
                        </label>
                        <AsyncSearchSelect
                            name="catalogoItinerario"
                            value={selectedCatalogoItinerarioId}
                            onChange={(id, item) => {
                                setSelectedCatalogoItinerarioId(id);
                                setSelectedCatalogoItinerario(item);
                            }}
                            endpoint="/api/catalogo_itinerarios"
                            // Sin filtro por etapa: mostramos todas las etapas implementadas
                            // (FP + ESO; en el futuro Bach, Universidad…). El admin discrimina
                            // tecleando el nombre. Si se añaden etapas no deseadas, este es el
                            // sitio para acotar.
                            extraParams={{}}
                            getOptionLabel={(i) => `${i.codigoOficial} — ${i.nombre}`}
                            getOptionValue={(i) => i.id}
                            placeholder={t('itinerarios.catalogo.searchPlaceholder', { defaultValue: 'Escribe nombre o código del itinerario…' })}
                            required
                        />
                    </div>

                    {selectedCatalogoItinerario && (
                        <div className={styles.catalogoPreview}>
                            {selectedCatalogoItinerario.familia && (
                                <p><strong>{t('itinerarios.catalogo.familyLabel', { defaultValue: 'Familia' })}:</strong> {selectedCatalogoItinerario.familia}</p>
                            )}
                            {selectedCatalogoItinerario.nivel && (
                                <p><strong>{t('itinerarios.catalogo.levelLabel', { defaultValue: 'Nivel' })}:</strong> {selectedCatalogoItinerario.nivel}</p>
                            )}
                            {selectedCatalogoItinerario.duracionTotalHoras && (
                                <p><strong>{t('itinerarios.catalogo.durationLabel', { defaultValue: 'Duración total' })}:</strong> {selectedCatalogoItinerario.duracionTotalHoras} h</p>
                            )}
                            <p>
                                <strong>{t('itinerarios.catalogo.modulesLabel', { defaultValue: 'Módulos' })}:</strong>{' '}
                                {selectedCatalogoItinerario.materias?.length ?? 0}{' '}
                                <em>({t('itinerarios.catalogo.modulesAuto', { defaultValue: 'se crearán automáticamente' })})</em>
                            </p>
                            {selectedCatalogoItinerario.normativa && (
                                <p className={styles.catalogoMeta}>
                                    <strong>{t('itinerarios.catalogo.regulationLabel', { defaultValue: 'Normativa' })}:</strong> {selectedCatalogoItinerario.normativa}
                                </p>
                            )}
                        </div>
                    )}

                    {isSuperAdmin && (
                        <div className={styles.formGroup}>
                            <label className={styles.label}>{t('itinerarios.centerLabel')}</label>
                            <AsyncSearchSelect
                                name="centro"
                                value={formData.centro}
                                onChange={(v) => setFormData(p => ({ ...p, centro: v }))}
                                endpoint="/api/centros"
                                getOptionLabel={(c) => c.nombre}
                                getOptionValue={(c) => c.id || c['@id']?.split('/').pop()}
                                placeholder={t('common.selectCenter')}
                                required
                            />
                        </div>
                    )}
                </>
            ) : (
                /* MODO MANUAL (creación libre o edición) */
                <>
                    <div className={styles.formGroup}>
                        <label className={styles.label}>{t('itinerarios.nameLabel')}</label>
                        <input
                            type="text"
                            name="nombre"
                            value={formData.nombre}
                            onChange={handleInputChange}
                            className={styles.input}
                            required
                            placeholder={t('itinerarios.namePlaceholder')}
                        />
                    </div>

                    <div className={styles.formGroup}>
                        <label className={styles.label}>{t('itinerarios.level')}</label>
                        <select
                            name="nivel"
                            value={formData.nivel}
                            onChange={handleInputChange}
                            className={styles.select}
                        >
                            <option value="Básico">{t('itinerarios.levelBasic')}</option>
                            <option value="Medio">{t('itinerarios.levelMiddle')}</option>
                            <option value="Superior">{t('itinerarios.levelHigher')}</option>
                            <option value="Curso de Especialización">{t('itinerarios.levelSpecialization')}</option>
                        </select>
                    </div>

                    {isSuperAdmin && (
                        <div className={styles.formGroup}>
                            <label className={styles.label}>{t('itinerarios.centerLabel')}</label>
                            <AsyncSearchSelect
                                name="centro"
                                value={formData.centro}
                                onChange={(v) => setFormData(p => ({ ...p, centro: v, jornadaTipo: '' }))}
                                endpoint="/api/centros"
                                getOptionLabel={(c) => c.nombre}
                                getOptionValue={(c) => c.id || c['@id']?.split('/').pop()}
                                placeholder={t('common.selectCenter')}
                                required
                            />
                        </div>
                    )}

                    <div className={styles.formGroup}>
                        <label className={styles.label}>
                            {t('itinerarios.ccaaLabel', { defaultValue: 'Comunidad Autónoma' })}
                        </label>
                        <select
                            name="ccaa"
                            value={formData.ccaa}
                            onChange={handleInputChange}
                            className={styles.select}
                        >
                            <option value="">{t('itinerarios.ccaaNational', { defaultValue: '— Sin CCAA (currículo nacional puro) —' })}</option>
                            {CCAA_OPTIONS.map(o => (
                                <option key={o.value} value={o.value}>{o.label}</option>
                            ))}
                        </select>
                        <small className={styles.helpText}>
                            {t('itinerarios.ccaaHint', { defaultValue: 'Aplica overlay del decreto autonómico (BOJA, DOGC, BOCM…) sobre el catálogo nacional. Si seleccionas una CCAA, recuerda re-sincronizar los grupos del itinerario.' })}
                        </small>
                    </div>

                    {currentItinerario && formData.ccaa && (
                        <div className={styles.formGroup}>
                            <Button
                                type="button"
                                variant="secondary"
                                onClick={() => handleAplicarOverlay(currentItinerario)}
                                disabled={applyingOverlay}
                            >
                                {applyingOverlay
                                    ? t('itinerarios.applyingOverlay', { defaultValue: 'Aplicando overlay…' })
                                    : t('itinerarios.applyOverlay', { defaultValue: 'Aplicar overlay CCAA a los grupos del itinerario' })
                                }
                            </Button>
                            <small className={styles.helpText}>
                                {t('itinerarios.applyOverlayHint', { defaultValue: 'Re-sincroniza materias y horas de cada grupo según el overlay vigente. Las materias manuales se conservan.' })}
                            </small>
                        </div>
                    )}

                    <div className={styles.formGroup}>
                        <label className={styles.label}>
                            {t('itinerarios.jornadaLabel', { defaultValue: 'Jornada' })}
                        </label>
                        <AsyncSearchSelect
                            name="jornadaTipo"
                            value={formData.jornadaTipo}
                            onChange={(v) => setFormData(p => ({ ...p, jornadaTipo: v }))}
                            endpoint="/api/jornada_tipos"
                            extraParams={(() => {
                                const centroId = isSuperAdmin ? formData.centro : (user.centro?.id || '');
                                return centroId ? { centro: centroId } : {};
                            })()}
                            getOptionLabel={(j) => `${j.nombre} (${j.turno === 'manana' ? 'M' : 'T'})`}
                            getOptionValue={(j) => j.id || j['@id']?.split('/').pop()}
                            placeholder={t('itinerarios.jornadaPlaceholder', { defaultValue: 'Selecciona una jornada (recomendado)…' })}
                        />
                        {!formData.jornadaTipo && (
                            <small className={styles.helpText}>
                                {t('itinerarios.jornadaHint', { defaultValue: 'Sin jornada el editor de horarios usa slots por defecto. Crea una en /admin/jornadas para personalizarla.' })}
                            </small>
                        )}
                    </div>
                </>
            )}
        </ModalView>
        </div>
    </Layout>
  );
};

export default Itinerarios;
