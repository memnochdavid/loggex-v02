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
import MateriaLabel from '../components/MateriaLabel';
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

  const [materias, setMaterias] = useState([]);
  const [itinerarios, setItinerarios] = useState([]);
  const [centros, setCentros] = useState([]);
  
  // Estado de carga único
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  
  // Filtros
  const [selectedCentro, setSelectedCentro] = useState('');
  const [selectedItinerario, setSelectedItinerario] = useState('');
  
  // Paginación, Búsqueda y Ordenación
  const [currentPage, setCurrentPage] = useState(1);
  const [totalItems, setTotalItems] = useState(0);
  
  // Usar hook de paginación
  const [itemsPerPage, setItemsPerPage] = usePagination('materias');

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
      { value: 'itinerario.nombre', label: t('materias.cycle') }
  ];

  // Estado para el modal
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [currentMateria, setCurrentMateria] = useState(null);
  // formData.horasSemanales se mantiene en HORAS DECIMALES en la UI (1.5, 3.5)
  // pero la API trabaja en `minutosSemanales` (int). Conversión x60 al enviar y
  // /60 al recibir; ver mapToApi y mapFromApi.
  const [formData, setFormData] = useState({
    nombre: '',
    abreviatura: '',
    codigoOficial: '',
    curso: 1,
    horasSemanales: '',
    tipo: '',
    itinerario: ''
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

  // Cargar itinerarios (filtrados por centro si se selecciona uno, o todos si es admin de centro)
  useEffect(() => {
    let url = getApiUrl('/api/itinerarios?pagination=false');
    
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
    .catch(err => console.error("Error cargando itinerarios:", err));
  }, [selectedCentro, isSuperAdmin]);

  const getMateriaId = (m) => {
    if (m.id) return m.id;
    if (m['@id']) {
        const parts = m['@id'].split('/');
        return parts[parts.length - 1];
    }
    return null;
  };

  // Función de carga optimizada
  const fetchMateriasData = useCallback(async (params) => {
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
          url += `&itinerario=${params.selectedItinerario}`;
      } else if (params.isSuperAdmin && params.selectedCentro) {
          // Si no hay itinerario seleccionado pero sí centro, filtrar por centro del itinerario
          url += `&itinerario.centro=${params.selectedCentro}`;
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
      console.error("Error fetching materias:", err);
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
              fetchMateriasData(params);
          }, 500);
      } else {
          if (debounceTimeout.current) clearTimeout(debounceTimeout.current);
          fetchMateriasData(params);
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
      fetchMateriasData
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

  const handleOpenModal = useCallback((materia = null) => {
    if (materia) {
      setCurrentMateria(materia);

      // Extraer ID del itinerario de forma segura
      let itinerarioId = '';
      if (materia.itinerario) {
          if (typeof materia.itinerario === 'object') {
              itinerarioId = materia.itinerario.id || (materia.itinerario['@id'] ? materia.itinerario['@id'].split('/').pop() : '');
          } else if (typeof materia.itinerario === 'string') {
              itinerarioId = materia.itinerario.split('/').pop();
          }
      }

      setFormData({
        nombre: materia.nombre,
        abreviatura: materia.abreviatura || '',
        codigoOficial: materia.codigoOficial || '',
        curso: materia.curso,
        horasSemanales: materia.minutosSemanales != null ? (materia.minutosSemanales / 60) : '',
        tipo: materia.tipo || '',
        itinerario: itinerarioId
      });
    } else {
      setCurrentMateria(null);
      setFormData({
        nombre: '',
        abreviatura: '',
        codigoOficial: '',
        curso: 1,
        horasSemanales: '',
        tipo: '',
        itinerario: ''
      });
    }
    setIsModalOpen(true);
  }, []);

  const handleCloseModal = () => {
    setIsModalOpen(false);
    setCurrentMateria(null);
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
      const id = currentMateria ? getMateriaId(currentMateria) : null;
      const url = currentMateria 
        ? getApiUrl(`/api/materias/${id}`)
        : getApiUrl('/api/materias');
      
      const method = currentMateria ? 'PUT' : 'POST';

      const itinerarioValue = String(formData.itinerario ?? '');
      const horasSemRaw = formData.horasSemanales;
      // El formulario captura horas decimales; la API espera minutos enteros.
      // Permitir vacío para itinerarios no-FP (ESO/Bachillerato) donde el reparto
      // curso a curso lo decide cada CCAA y aún puede no estar definido.
      const minutosSemanales = horasSemRaw === '' || horasSemRaw === null || horasSemRaw === undefined
        ? null
        : Math.round(parseFloat(horasSemRaw) * 60);
      const { horasSemanales: _drop, ...rest } = formData;
      const payload = {
        ...rest,
        curso: parseInt(formData.curso),
        minutosSemanales,
        // tipo es enum nullable; '' del select equivale a sin valor.
        tipo: formData.tipo === '' ? null : formData.tipo,
        // Asegurar formato IRI para la relación al itinerario.
        itinerario: itinerarioValue.includes('/api/') ? itinerarioValue : `/api/itinerarios/${itinerarioValue}`,
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
      fetchMateriasData({
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
        ? t('materias.updatedSuccess', { defaultValue: 'Materia actualizada' })
        : t('materias.createdSuccess', { defaultValue: 'Materia creada' }));

    } catch (err) {
      console.error("Error saving materia:", err);
      toast.error(err.message, {
        description: currentMateria
          ? t('materias.errorUpdating', { defaultValue: 'No se ha podido actualizar la materia' })
          : t('materias.errorCreating', { defaultValue: 'No se ha podido crear la materia' })
      });
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = useCallback(async (materia) => {
    if (!(await confirm({ body: t('materias.confirmDelete') }))) {
      return;
    }

    const id = getMateriaId(materia);
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

      fetchMateriasData({
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
      toast.success(t('materias.deletedSuccess', { defaultValue: 'Materia eliminada' }));

    } catch (err) {
      console.error("Error deleting materia:", err);
      toast.error(err.message, {
        description: t('materias.errorDeletingCtx', { defaultValue: 'No se ha podido eliminar la materia' })
      });
    }
  }, [currentPage, itemsPerPage, searchTerm, searchField, selectedItinerario, selectedCentro, sortColumn, sortDirection, isSuperAdmin, fetchMateriasData, t]);

  const columns = useMemo(() => [
    {
      header: t('materias.name'),
      accessor: (row) => <MateriaLabel materia={row} />,
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
        accessor: (row) => row.itinerario ? row.itinerario.nombre : '-',
        sortable: true, 
        sortKey: 'itinerario.nombre' 
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
 subtitle={t('materias.subtitle')}
                    logo={<Lottie animationData={crudAnimation} loop={true} style={{ width: 56, height: 56 }} />}
        >
            {isSuperAdmin && (
                <ThemedSelect
                    value={selectedCentro}
                    onChange={(v) => { setSelectedCentro(v); setSelectedItinerario(''); }}
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
                onChange={setSelectedItinerario}
                minWidth={200}
                ariaLabel={t('common.allCycles')}
                options={[
                    { value: '', label: t('common.allCycles') },
                    ...itinerarios.map(c => ({
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
            <Button onClick={() => fetchMateriasData({ page: currentPage, itemsPerPage, searchTerm, searchField, selectedItinerario, selectedCentro, sortColumn, sortDirection, isSuperAdmin })} variant="secondary" style={{ marginTop: '1rem' }}>{t('common.retry')}</Button>
            </div>
        )}

        <DataTable
            columns={columns}
            data={materias}
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
                    name="itinerario"
                    value={formData.itinerario}
                    onChange={(v) => setFormData(p => ({ ...p, itinerario: v }))}
                    endpoint="/api/itinerarios"
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
                    <option value="3">{t('materias.course3', '3º')}</option>
                    <option value="4">{t('materias.course4', '4º')}</option>
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
                    min="0.25"
                    max="30"
                    step="0.25"
                />
            </div>

            <div className={styles.formGroup}>
                <label className={styles.label}>
                    {t('materias.type', { defaultValue: 'Tipo' })}
                </label>
                <select
                    name="tipo"
                    value={formData.tipo}
                    onChange={handleInputChange}
                    className={styles.select}
                >
                    <option value="">{t('materias.typeUnset', { defaultValue: '— Sin especificar —' })}</option>
                    <option value="modulo">{t('catalogo.tipoLabel.MODULO', 'Materia')}</option>
                    <option value="troncal">{t('catalogo.tipoLabel.TRONCAL', 'Troncal')}</option>
                    <option value="especifica">{t('catalogo.tipoLabel.ESPECIFICA', 'Específica')}</option>
                    <option value="optativa">{t('catalogo.tipoLabel.OPTATIVA', 'Optativa')}</option>
                    <option value="libre_configuracion">{t('catalogo.tipoLabel.LIBRE_CONFIGURACION', 'Libre configuración')}</option>
                    <option value="asignatura">{t('catalogo.tipoLabel.ASIGNATURA', 'Asignatura')}</option>
                    <option value="fct">{t('catalogo.tipoLabel.FCT', 'FCT')}</option>
                    <option value="proyecto">{t('catalogo.tipoLabel.PROYECTO', 'Proyecto')}</option>
                </select>
            </div>
        </ModalView>
        </div>
    </Layout>
  );
};

export default Materias;
