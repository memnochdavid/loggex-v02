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
import MateriaLabel from '../components/MateriaLabel';
import { useAuth } from '../context/AuthContext';
import { Plus, Edit2, Trash2 } from 'lucide-react';
import { usePagination } from "../hooks/usePagination.js";
import useLiveRefetch from '../hooks/useLiveRefetch';
import { useBulkDelete } from '../hooks/useBulkDelete';
import { getApiUrl } from '../config/api';
import Lottie from 'lottie-react';
import crudAnimation from '../../public/crud.json';
import { useTranslation } from 'react-i18next';
import { toast, parseErrorResponse } from '../utils/toast';
import { useConfirm } from '../context/ConfirmContext';
import { formatGrupoAbrev } from '../utils/grupo';


const Imparticiones = () => {
  const { t } = useTranslation();
  const confirm = useConfirm();
  const { user } = useAuth();
  const isSuperAdmin = user?.roles?.includes('ROLE_SUPERADMIN');

  const [imparticiones, setImparticiones] = useState([]);
  const [centros, setCentros] = useState([]);
  // Listas para los filtros del CrudHeader (no se usan en el modal: allí siguen
  // siendo AsyncSearchSelect on-demand). Aquí se cargan upfront porque ThemedSelect
  // necesita la lista completa para renderizar las opciones.
  const [grupos, setGrupos] = useState([]);
  const [profesores, setProfesores] = useState([]);

  // Estado de carga único
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Filtros
  const [selectedCentro, setSelectedCentro] = useState('');
  const [selectedGrupo, setSelectedGrupo] = useState('');
  const [selectedProfesor, setSelectedProfesor] = useState('');
  
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
      { value: 'materia.nombre', label: t('teaching.module') },
      { value: 'grupo.nombre', label: t('teaching.group') }
  ];

  // Estado para el modal
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [currentImparticion, setCurrentImparticion] = useState(null);
  const [formData, setFormData] = useState({
    profesor: '',
    materia: '',
    grupo: '',
    aulaEspecifica: '',
    // Override de modalidad. '' = heredar de Materia.modalidad. Solo se setea
    // cuando el admin quiere cambiar la modalidad SOLO para esta imparticion
    // (= grupo concreto), sin afectar la materia base.
    modalidad: '',
  });
  const [saving, setSaving] = useState(false);

  // Filtro derivado del grupo seleccionado para la cascada Grupo → Materia:
  // una materia elegible debe pertenecer al mismo itinerario y al mismo curso que el grupo.
  const [grupoFilter, setGrupoFilter] = useState({ itinerario: '', curso: '' });

  // Helper para extraer id de un valor que puede ser objeto, IRI string o id puro.
  const extractId = (raw) => {
    if (raw == null) return '';
    if (typeof raw === 'object') return String(raw.id || raw['@id']?.split('/').pop() || '');
    if (typeof raw === 'string') return String(raw.split('/').pop());
    return String(raw);
  };

  // El antiguo `filteredModulos` (cascada Grupo→Materia en cliente) se ha sustituido
  // por extraParams del AsyncSearchSelect: la materia se filtra en servidor por
  // ?itinerario=<grupo.itinerario>&curso=<grupo.curso>, derivado del state grupoFilter.

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

  // Cargar grupos y profesores para los filtros del CrudHeader. Se recarga
  // cuando cambia el centro (SuperAdmin); para no-superadmin la extension
  // CurrentUserExtension del backend ya filtra por centro automáticamente.
  useEffect(() => {
    const centroParam = isSuperAdmin && selectedCentro ? `&centro=${selectedCentro}` : '';
    fetch(getApiUrl(`/api/grupos?pagination=false${centroParam}`), {
        headers: { 'Accept': 'application/ld+json' },
        credentials: 'include'
    })
    .then(res => res.json())
    .then(data => setGrupos(data['hydra:member'] || data.member || []))
    .catch(err => console.error("Error cargando grupos:", err));

    fetch(getApiUrl(`/api/users?pagination=false&rol_app[]=profesor&rol_app[]=admin${centroParam}`), {
        headers: { 'Accept': 'application/ld+json' },
        credentials: 'include'
    })
    .then(res => res.json())
    .then(data => setProfesores(data['hydra:member'] || data.member || []))
    .catch(err => console.error("Error cargando profesores:", err));
  }, [isSuperAdmin, selectedCentro]);

  // (Antes había aquí un useEffect que precargaba profesores+materias+grupos al
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
      if (params.selectedGrupo) {
          url += `&grupo=${params.selectedGrupo}`;
      }
      if (params.selectedProfesor) {
          url += `&profesor=${params.selectedProfesor}`;
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

  // Mercure live: refetch automático cuando cualquier admin (incluido este
  // usuario en otra pestaña, otro admin del centro, comando CLI o seed) crea,
  // edita o borra una imparticion del centro visible. La extensión
  // CurrentUserExtension del backend ya filtra el GET por centro, así que
  // basta con refetch al evento.
  // - Admin: solo su centro.
  // - Superadmin con filtro: el centro filtrado.
  // - Superadmin sin filtro: URI template `{cid}` (matches cualquier centro).
  const liveTopics = useMemo(() => {
      const cid = isSuperAdmin ? (selectedCentro || '{cid}') : user?.centro?.id;
      return cid ? [`/admin/centros/${cid}/imparticiones`] : [];
  }, [isSuperAdmin, selectedCentro, user?.centro?.id]);

  useLiveRefetch(liveTopics, () => {
      fetchImparticionesData({
          page: currentPage,
          itemsPerPage,
          searchTerm,
          searchField,
          selectedCentro,
          selectedGrupo,
          selectedProfesor,
          sortColumn,
          sortDirection,
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
          selectedGrupo,
          selectedProfesor,
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
      selectedGrupo,
      selectedProfesor,
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
        materia: extractId(imparticion.materia),
        grupo: grupoId,
        aulaEspecifica: imparticion.aulaEspecifica || '',
        modalidad: imparticion.modalidad || '',
      });

      // Hidratar el filtro grupo→materia para que el AsyncSearchSelect de materia
      // restrinja al itinerario+curso correctos también en modo edición.
      if (grupoId) {
        fetch(getApiUrl(`/api/grupos/${grupoId}`), {
          headers: { Accept: 'application/ld+json' },
          credentials: 'include'
        })
          .then(r => r.ok ? r.json() : null)
          .then(g => {
            if (!g) return;
            setGrupoFilter({
              itinerario: extractId(g.itinerario),
              curso: g.curso != null ? String(g.curso) : ''
            });
          })
          .catch(() => { /* fallo silencioso: el modal sigue funcionando, solo sin filtro de cascada */ });
      } else {
        setGrupoFilter({ itinerario: '', curso: '' });
      }
    } else {
      setCurrentImparticion(null);
      setFormData({
        profesor: '',
        materia: '',
        grupo: '',
        aulaEspecifica: '',
        modalidad: '',
      });
      setGrupoFilter({ itinerario: '', curso: '' });
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
            newData.materia = '';
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
      const materiaValue = String(formData.materia);
      const grupoValue = String(formData.grupo);

      const payload = {
        profesor: profesorValue.includes('/api/') ? profesorValue : `/api/users/${profesorValue}`,
        materia: materiaValue.includes('/api/') ? materiaValue : `/api/materias/${materiaValue}`,
        grupo: grupoValue.includes('/api/') ? grupoValue : `/api/grupos/${grupoValue}`,
        aulaEspecifica: formData.aulaEspecifica?.trim() || null,
        // '' (string vacío del select) se traduce a null = "heredar de Materia".
        modalidad: formData.modalidad === '' ? null : formData.modalidad,
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

  const handleBulkDelete = useBulkDelete({
    endpointBase: '/api/imparticions',
    onSuccess: () => fetchImparticionesData({
      page: currentPage,
      itemsPerPage,
      searchTerm,
      searchField,
      selectedCentro,
      sortColumn,
      sortDirection,
    }),
  });

  const columns = useMemo(() => [
    {
        header: t('teaching.teacher'),
        accessor: (row) => row.profesor ? `${row.profesor.nombre} ${row.profesor.apellidos}` : '-', 
        sortable: true, 
        sortKey: 'profesor.nombre' 
    },
    {
        header: t('teaching.module'),
        accessor: (row) => row.materia ? <MateriaLabel materia={row.materia} /> : '-',
        sortable: true,
        sortKey: 'materia.nombre'
    },
    {
        header: t('teaching.group'),
        accessor: (row) => row.grupo ? (formatGrupoAbrev(row.grupo) || '-') : '-',
        sortable: true,
        sortKey: 'grupo.nombre'
    },
    {
        // Modalidad efectiva: override de Imparticion si existe, sino hereda
        // Materia.modalidad. Solo se muestra badge cuando el resultado NO es
        // 'presencial' (95% de los casos). El override visualmente lleva un
        // asterisco (*) para distinguirlo de la herencia.
        header: t('teaching.modality', { defaultValue: 'Modalidad' }),
        accessor: (row) => {
            const override = row.modalidad;
            const hereda = row.materia?.modalidad || 'presencial';
            const efectiva = override || hereda;
            if (efectiva === 'presencial') return <span className={styles.modalidadDefault}>—</span>;
            const labelKey = `modalidad.badge.${efectiva}`;
            const label = t(labelKey, {
                defaultValue: efectiva === 'fct' ? 'FCT'
                    : efectiva === 'no_regular' ? 'No regular'
                    : efectiva === 'autonoma' ? 'Autónoma'
                    : efectiva,
            });
            const sufijo = override ? '*' : '';
            return (
                <span
                    className={`${styles.modalidadBadge} ${styles[`modalidadBadge_${efectiva}`] || ''}`}
                    title={override
                        ? t('teaching.modalityOverridden', { defaultValue: 'Override (esta imparticion)' })
                        : t('teaching.modalityInherited', { defaultValue: 'Heredada de la materia' })
                    }
                >
                    {label}{sufijo}
                </span>
            );
        },
        sortable: false,
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
 subtitle={t('teaching.subtitle')}
                    breadcrumbs={[
                        { label: t('sidebar.home'), to: '/' },
                        { label: t('teaching.title') },
                    ]}
                    logo={<Lottie animationData={crudAnimation} loop={true} style={{ width: 56, height: 56 }} />}
        >
            {isSuperAdmin && (
                <ThemedSelect
                    value={selectedCentro}
                    onChange={(v) => { setSelectedCentro(v); setSelectedGrupo(''); setSelectedProfesor(''); }}
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
                ariaLabel={t('teaching.allGroups', { defaultValue: 'Todos los grupos' })}
                options={[
                    { value: '', label: t('teaching.allGroups', { defaultValue: 'Todos los grupos' }) },
                    ...grupos.map(g => ({
                        value: String(g.id || g['@id']?.split('/').pop()),
                        label: formatGrupoAbrev(g),
                    })),
                ]}
            />

            <ThemedSelect
                value={selectedProfesor}
                onChange={setSelectedProfesor}
                minWidth={220}
                ariaLabel={t('teaching.allTeachers', { defaultValue: 'Todos los profesores' })}
                options={[
                    { value: '', label: t('teaching.allTeachers', { defaultValue: 'Todos los profesores' }) },
                    ...profesores.map(p => ({
                        value: String(p.id || p['@id']?.split('/').pop()),
                        label: `${p.nombre} ${p.apellidos}`,
                    })),
                ]}
            />

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
            tableId="imparticiones"
            columns={columns}
            data={imparticiones}
            totalItems={totalItems}
            itemsPerPage={itemsPerPage}
            currentPage={currentPage}
            onPageChange={setCurrentPage}
            onItemsPerPageChange={handleItemsPerPageChange}
            loading={loading}
            selectable
            onBulkDelete={handleBulkDelete}
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
                        // Incluye admins porque pueden impartir docencia (rol funcional, no solo gestor).
                        // `rol_app` es un único string en User, por lo que un admin que también enseña
                        // se almacena como 'admin'; sin esto no aparecería en el selector de profesor.
                        rol_app: ['profesor', 'admin'],
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
                        // Cambiar grupo: vacía la materia y actualiza el filtro de cascada.
                        setFormData(p => ({ ...p, grupo: v, materia: '' }));
                        if (item) {
                            setGrupoFilter({
                                itinerario: extractId(item.itinerario),
                                curso: item.curso != null ? String(item.curso) : ''
                            });
                        } else {
                            setGrupoFilter({ itinerario: '', curso: '' });
                        }
                    }}
                    endpoint="/api/grupos"
                    extraParams={isSuperAdmin && selectedCentro ? { centro: selectedCentro } : {}}
                    getOptionLabel={(g) => formatGrupoAbrev(g)}
                    getOptionValue={(g) => g.id || g['@id']?.split('/').pop()}
                    placeholder={t('common.selectGroup')}
                    required
                />
            </div>

            <div className={styles.formGroup}>
                <label className={styles.label}>{t('teaching.module', { defaultValue: 'Materia' })}</label>
                <AsyncSearchSelect
                    name="materia"
                    value={formData.materia}
                    onChange={(v) => setFormData(p => ({ ...p, materia: v }))}
                    endpoint="/api/materias"
                    extraParams={{
                        // Materia.itinerarios es ManyToMany tras el refactor multi-itinerario
                        // (doc: hoja-de-ruta-materias-multi-itinerario.md). El filtro registrado
                        // en `Materia.php` es `itinerarios` (plural); mandando `itinerario`
                        // (singular) API Platform lo ignoraba y devolvía todas las materias
                        // del `curso`, mezclando p.ej. 2º DAM con 2º DAW.
                        ...(grupoFilter.itinerario ? { itinerarios: grupoFilter.itinerario } : {}),
                        ...(grupoFilter.curso ? { curso: grupoFilter.curso } : {}),
                    }}
                    getOptionLabel={(m) => `${m.nombre} (${m.codigoOficial}) - ${m.curso}º`}
                    getOptionValue={(m) => m.id || m['@id']?.split('/').pop()}
                    placeholder={formData.grupo ? t('common.selectModule') : t('teaching.selectGroupFirst')}
                    disabled={!formData.grupo}
                    required
                />
            </div>

            <div className={styles.formGroup}>
                <label className={styles.label}>
                    {t('teaching.aulaEspecifica', { defaultValue: 'Aula específica (override)' })}
                </label>
                <input
                    type="text"
                    name="aulaEspecifica"
                    value={formData.aulaEspecifica}
                    onChange={(e) => setFormData(p => ({ ...p, aulaEspecifica: e.target.value }))}
                    className={styles.input}
                    placeholder={t('teaching.aulaEspecificaPlaceholder', { defaultValue: 'ej. Lab Hardware, Aula Música…' })}
                />
                <small className={styles.helpText}>
                    {t('teaching.aulaEspecificaHint', {
                        defaultValue: 'Solo si esta materia se imparte en un aula distinta a la del grupo. Si vacío, se usa el aula por defecto del grupo.',
                    })}
                </small>
            </div>

            <div className={styles.formGroup}>
                <label className={styles.label}>
                    {t('teaching.modalityOverride', { defaultValue: 'Modalidad (override)' })}
                </label>
                <select
                    name="modalidad"
                    value={formData.modalidad}
                    onChange={handleInputChange}
                    className={styles.select}
                >
                    <option value="">{t('teaching.modalityInherit', { defaultValue: '— Heredar de la materia —' })}</option>
                    <option value="presencial">{t('modalidad.label.presencial', { defaultValue: 'Presencial (clase regular en aula)' })}</option>
                    <option value="fct">{t('modalidad.label.fct', { defaultValue: 'FCT (Formación en Centros de Trabajo)' })}</option>
                    <option value="no_regular">{t('modalidad.label.no_regular', { defaultValue: 'No regular (proyecto, libre configuración)' })}</option>
                    <option value="autonoma">{t('modalidad.label.autonoma', { defaultValue: 'Autónoma (trabajo del alumno)' })}</option>
                </select>
                <small className={styles.formHint}>
                    {t('teaching.modalityOverrideHint', {
                        defaultValue: 'Override solo para este grupo. Si dejas heredar, se usa la modalidad de la materia. Útil si una misma materia se imparte de forma distinta en grupos diferentes.',
                    })}
                </small>
            </div>
        </ModalView>
        </div>
    </Layout>
  );
};

export default Imparticiones;
