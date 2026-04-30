import React, {useEffect, useState, useRef, useCallback, useMemo} from 'react';
import styles from './Crud.module.css'; // Usar estilos comunes
import Button from '../components/Button';
import DataTable from '../components/DataTable';
import SearchBar from '../components/SearchBar';
import Layout from '../components/Layout';
import ModalView from '../components/ModalView';
import CrudHeader from '../components/CrudHeader';
import {usePagination} from '../hooks/usePagination';
import {Plus, Edit2, Trash2, Image as ImageIcon} from 'lucide-react';
import ThemedSelect from '../components/ThemedSelect';

// Códigos ISO 3166-2:ES de las 19 entidades autonómicas. Idéntico a CCAA_OPTIONS
// de Itinerarios/CatalogoItinerarios — duplicado intencional hasta que se
// extraiga a constante compartida.
const CCAA_OPTIONS = [
  { value: 'AN', label: 'Andalucía' }, { value: 'AR', label: 'Aragón' },
  { value: 'AS', label: 'Asturias' }, { value: 'CB', label: 'Cantabria' },
  { value: 'CE', label: 'Ceuta' }, { value: 'CL', label: 'Castilla y León' },
  { value: 'CM', label: 'Castilla-La Mancha' }, { value: 'CN', label: 'Canarias' },
  { value: 'CT', label: 'Cataluña' }, { value: 'EX', label: 'Extremadura' },
  { value: 'GA', label: 'Galicia' }, { value: 'IB', label: 'Illes Balears' },
  { value: 'MC', label: 'Murcia' }, { value: 'MD', label: 'Madrid' },
  { value: 'ML', label: 'Melilla' }, { value: 'NC', label: 'Navarra' },
  { value: 'PV', label: 'País Vasco' }, { value: 'RI', label: 'La Rioja' },
  { value: 'VC', label: 'C. Valenciana' },
];
import { getApiUrl, getAssetUrl } from '../config/api';
import Lottie from 'lottie-react';
import crudAnimation from '../../public/crud.json';
import helloAnimation from "../../public/hello.json";
import { useTranslation } from 'react-i18next';
import { toast, parseErrorResponse } from '../utils/toast';
import { useConfirm } from '../context/ConfirmContext';

const Centros = () => {
    const { t } = useTranslation();
    const confirm = useConfirm();
    const [centros, setCentros] = useState([]);
    
    // Estado de carga único
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    // Paginación, Búsqueda y Ordenación
    const [currentPage, setCurrentPage] = useState(1);
    const [totalItems, setTotalItems] = useState(0);

    // Usar hook de paginación
    const [itemsPerPage, setItemsPerPage] = usePagination('centros');

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
        {value: 'nombre', label: t('centers.name')},
        {value: 'cif', label: t('centers.cif')},
        {value: 'direccion', label: t('centers.address')}
    ];

    // Estado para el modal
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [currentCentro, setCurrentCentro] = useState(null);
    const [formData, setFormData] = useState({
        nombre: '',
        cif: '',
        direccion: '',
        telefono: '',
        activo: true,
        ccaa: '',
        provincia: '',  // código INE
        fechaInicioCurso: '',  // ISO YYYY-MM-DD ('' = sin override)
        fechaFinCurso: '',
    });
    // Lista de provincias cargada upfront (52 fijas, no cambia).
    const [provincias, setProvincias] = useState([]);
    // Sugerencia (CalendarioEscolarCcaa) para la CCAA actual del modal.
    // Se rellena cuando ccaa cambia y se usa como hint y placeholder de las
    // fechas del curso.
    const [calendarioSugerido, setCalendarioSugerido] = useState(null);
    const [logoFile, setLogoFile] = useState(null);
    const [logoPreview, setLogoPreview] = useState(null);
    const [saving, setSaving] = useState(false);

    const getCentroId = (centro) => {
        if (centro.id) return centro.id;
        if (centro['@id']) {
            const parts = centro['@id'].split('/');
            return parts[parts.length - 1];
        }
        return null;
    };

    const getLogoUrl = useCallback((logoName) => {
        if (!logoName) return null;
        return getAssetUrl(`/uploads/logo-centro/${logoName}`);
    }, []);

    // Función de carga optimizada
    const fetchCentrosData = useCallback(async (params) => {
        if (abortController.current) {
            abortController.current.abort();
        }
        abortController.current = new AbortController();

        setLoading(true);

        try {
            // Construir URL con parámetros
            let url = getApiUrl(`/api/centros?page=${params.page}&itemsPerPage=${params.itemsPerPage}`);

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

            setCentros(items);
            setTotalItems(total);
            setError(null);

        } catch (err) {
            if (err.name === 'AbortError') return;
            console.error("Error fetching centros:", err);
            setError(err.message);
        } finally {
            if (abortController.current && !abortController.current.signal.aborted) {
                setLoading(false);
            }
        }
    }, []);

    // Carga única de provincias (52 fijas, no cambian).
    useEffect(() => {
        fetch(getApiUrl('/api/provincias?pagination=false'), {
            headers: { 'Accept': 'application/ld+json' },
            credentials: 'include',
        })
            .then(r => r.ok ? r.json() : null)
            .then(data => {
                if (!data) return;
                const items = data['hydra:member'] || data.member || [];
                setProvincias(items);
            })
            .catch(err => console.error('Error cargando provincias:', err));
    }, []);

    // Sugerencia de fechas del curso desde CalendarioEscolarCcaa cuando el
    // modal está abierto y hay CCAA. La etapa por defecto es FP (única
    // soportada hoy en EAG); cuando el centro tenga itinerarios mixtos será
    // razonable inferirla del itinerario predominante. Hint informativo: el
    // admin sigue pudiendo override.
    useEffect(() => {
        if (!isModalOpen || !formData.ccaa) {
            setCalendarioSugerido(null);
            return;
        }
        const today = new Date();
        const y = today.getFullYear();
        const anio = today.getMonth() + 1 >= 7 ? `${y}-${y + 1}` : `${y - 1}-${y}`;
        const url = getApiUrl(`/api/calendario_escolar_ccaas?ccaa=${formData.ccaa}&anioAcademico=${anio}&etapa=fp`);
        let cancelled = false;
        fetch(url, { headers: { 'Accept': 'application/ld+json' }, credentials: 'include' })
            .then(r => r.ok ? r.json() : null)
            .then(data => {
                if (cancelled || !data) return;
                const items = data['hydra:member'] || data.member || [];
                setCalendarioSugerido(items[0] || null);
            })
            .catch(() => { if (!cancelled) setCalendarioSugerido(null); });
        return () => { cancelled = true; };
    }, [isModalOpen, formData.ccaa]);

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
            sortColumn,
            sortDirection
        };

        if (searchChanged) {
            if (debounceTimeout.current) clearTimeout(debounceTimeout.current);
            debounceTimeout.current = setTimeout(() => {
                fetchCentrosData(params);
            }, 500);
        } else {
            if (debounceTimeout.current) clearTimeout(debounceTimeout.current);
            fetchCentrosData(params);
        }

        return () => {
            if (debounceTimeout.current) clearTimeout(debounceTimeout.current);
        };
    }, [
        currentPage, 
        itemsPerPage, 
        searchTerm, 
        searchField, 
        sortColumn, 
        sortDirection,
        fetchCentrosData
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

    const handleOpenModal = useCallback((centro = null) => {
        setLogoFile(null);
        if (centro) {
            setCurrentCentro(centro);
            // Provincia puede venir como objeto Provincia (con `codigo`) o IRI string.
            let provinciaCodigo = '';
            if (centro.provincia) {
                provinciaCodigo = typeof centro.provincia === 'string'
                    ? centro.provincia.split('/').pop()
                    : (centro.provincia.codigo || '');
            }
            setFormData({
                nombre: centro.nombre,
                cif: centro.cif,
                direccion: centro.direccion,
                telefono: centro.telefono || '',
                activo: centro.activo,
                ccaa: centro.ccaa || '',
                provincia: provinciaCodigo,
                fechaInicioCurso: centro.fechaInicioCurso ? centro.fechaInicioCurso.slice(0, 10) : '',
                fechaFinCurso: centro.fechaFinCurso ? centro.fechaFinCurso.slice(0, 10) : '',
            });
            setLogoPreview(centro.logo ? getLogoUrl(centro.logo) : null);
        } else {
            setCurrentCentro(null);
            setFormData({
                nombre: '',
                cif: '',
                direccion: '',
                telefono: '',
                activo: true,
                ccaa: '',
                provincia: '',
                fechaInicioCurso: '',
                fechaFinCurso: '',
            });
            setLogoPreview(null);
        }
        setCalendarioSugerido(null);
        setIsModalOpen(true);
    }, [getLogoUrl]);

    const handleCloseModal = () => {
        setIsModalOpen(false);
        setCurrentCentro(null);
        setLogoFile(null);
        setLogoPreview(null);
    };

    const handleInputChange = (e) => {
        const {name, value, type, checked} = e.target;
        setFormData(prev => ({
            ...prev,
            [name]: type === 'checkbox' ? checked : value
        }));
    };

    const handleFileChange = (e) => {
        const file = e.target.files[0];
        if (file) {
            setLogoFile(file);
            const reader = new FileReader();
            reader.onloadend = () => {
                setLogoPreview(reader.result);
            };
            reader.readAsDataURL(file);
        }
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setSaving(true);

        try {
            const id = currentCentro ? getCentroId(currentCentro) : null;
            const url = currentCentro
                ? getApiUrl(`/api/centro/${id}/update`)
                : getApiUrl('/api/centro/create');

            const method = 'POST';

            const data = new FormData();
            data.append('nombre', formData.nombre);
            data.append('cif', formData.cif);
            data.append('direccion', formData.direccion);
            data.append('telefono', formData.telefono);
            data.append('activo', formData.activo ? 'true' : 'false');
            data.append('ccaa', formData.ccaa || '');
            data.append('provincia', formData.provincia || '');
            data.append('fechaInicioCurso', formData.fechaInicioCurso || '');
            data.append('fechaFinCurso', formData.fechaFinCurso || '');

            if (logoFile) {
                data.append('logo', logoFile);
            }

            const response = await fetch(url, {
                method: method,
                body: data,
                credentials: 'include'
            });

            if (!response.ok) {
                const message = await parseErrorResponse(response);
                throw new Error(message);
            }

            // Recargar datos
            fetchCentrosData({
                page: currentPage,
                itemsPerPage,
                searchTerm,
                searchField,
                sortColumn,
                sortDirection
            });
            handleCloseModal();
            toast.success(currentCentro
                ? t('centers.updatedSuccess', { defaultValue: 'Centro actualizado' })
                : t('centers.createdSuccess', { defaultValue: 'Centro creado' }));

        } catch (err) {
            console.error("Error saving centro:", err);
            toast.error(err.message, {
                description: currentCentro
                    ? t('centers.errorUpdating', { defaultValue: 'No se ha podido actualizar el centro' })
                    : t('centers.errorCreating', { defaultValue: 'No se ha podido crear el centro' })
            });
        } finally {
            setSaving(false);
        }
    };

    const handleDelete = useCallback(async (centro) => {
        if (!(await confirm({ body: t('centers.confirmDelete') }))) {
            return;
        }

        const id = getCentroId(centro);
        if (!id) return;

        try {
            const response = await fetch(getApiUrl(`/api/centros/${id}`), {
                method: 'DELETE',
                credentials: 'include'
            });

            if (!response.ok) {
                const message = await parseErrorResponse(response, t('centers.errorDelete'));
                throw new Error(message);
            }

            fetchCentrosData({
                page: currentPage,
                itemsPerPage,
                searchTerm,
                searchField,
                sortColumn,
                sortDirection
            });
            toast.success(t('centers.deletedSuccess', { defaultValue: 'Centro eliminado' }));

        } catch (err) {
            console.error("Error deleting centro:", err);
            toast.error(err.message, {
                description: t('centers.errorDeletingCtx', { defaultValue: 'No se ha podido eliminar el centro' })
            });
        }
    }, [currentPage, itemsPerPage, searchTerm, searchField, sortColumn, sortDirection, fetchCentrosData, t]);

    const columns = useMemo(() => [
        {
            header: t('centers.logo'),
            accessor: (row) => (
                <div className={styles.logoCell}>
                    {row.logo ? (
                        <img
                            src={getLogoUrl(row.logo)}
                            alt={row.nombre}
                            className={styles.logoImage}
                            onError={(e) => {
                                e.target.style.display = 'none';
                                e.target.nextSibling.style.display = 'flex';
                            }}
                        />
                    ) : null}
                    <div
                        className={styles.logoPlaceholder}
                        style={{display: row.logo ? 'none' : 'flex'}}
                    >
                        <ImageIcon size={16}/>
                    </div>
                </div>
            ),
            className: styles.colLogo,
            sortable: false
        },
        {header: t('centers.name'), accessor: 'nombre', sortable: true, sortKey: 'nombre'},
        {header: t('centers.cif'), accessor: 'cif', sortable: true, sortKey: 'cif'},
        {header: t('centers.address'), accessor: 'direccion', sortable: true, sortKey: 'direccion'},
        {header: t('centers.phone'), accessor: 'telefono', sortable: false},
        {
            header: t('centers.status'),
            accessor: (row) => (
                <span className={`${styles.badge} ${row.activo ? styles.badgeActive : styles.badgeInactive}`}>
                {row.activo ? t('centers.active') : t('centers.inactive')}
            </span>
            ),
            sortable: true,
            sortKey: 'activo'
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
                        <Edit2 size={18}/>
                    </button>
                    <button
                        className={`${styles.iconButton} ${styles.danger}`}
                        onClick={() => handleDelete(row)}
                        title={t('common.delete')}
                    >
                        <Trash2 size={18}/>
                    </button>
                </div>
            ),
            sortable: false
        }
    ], [getLogoUrl, handleOpenModal, handleDelete]);

    return (
        <Layout>
            <div className={styles.container}>
                <CrudHeader title={t('centers.title')}
 subtitle={t('centers.subtitle')}
                            logo={<Lottie animationData={crudAnimation} loop={true} style={{ width: 56, height: 56 }} />}
                >
                    <SearchBar
                        value={searchTerm}
                        onChange={setSearchTerm}
                        placeholder={t('common.search')}
                        fields={searchFields}
                        selectedField={searchField}
                        onFieldChange={setSearchField}
                    />
                    <Button onClick={() => handleOpenModal()}>
                        <Plus size={18} style={{marginRight: '8px'}}/>
                        {t('common.new')}
                    </Button>
                </CrudHeader>

                {error && (
                    <div className={styles.errorContainer}>
                        <p>{error}</p>
                        <Button onClick={() => fetchCentrosData({ page: currentPage, itemsPerPage, searchTerm, searchField, sortColumn, sortDirection })} variant="secondary"
                                style={{marginTop: '1rem'}}>{t('common.retry')}</Button>
                    </div>
                )}

                <DataTable
                    columns={columns}
                    data={centros}
                    totalItems={totalItems}
                    itemsPerPage={itemsPerPage}
                    currentPage={currentPage}
                    onPageChange={setCurrentPage}
                    onItemsPerPageChange={handleItemsPerPageChange}
                    loading={loading}
                    sortColumn={sortColumn}
                    sortDirection={sortDirection}
                    onSort={handleSort}
                />

                <ModalView
                    isOpen={isModalOpen}
                    onClose={handleCloseModal}
                    title={currentCentro ? t('centers.editTitle') : t('centers.newTitle')}
                    onSubmit={handleSubmit}
                    isSubmitting={saving}
                >
                    {/* Campo de Logo */}
                    <div className={styles.formGroup}>
                        <label className={styles.label}>{t('centers.logoLabel')}</label>
                        <div className={styles.logoPreviewContainer}>
                            {logoPreview ? (
                                <img src={logoPreview} alt="Previsualización" className={styles.logoPreview}/>
                            ) : (
                                <div className={styles.logoPreview}
                                     style={{display: 'flex', alignItems: 'center', justifyContent: 'center'}}>
                                    <ImageIcon size={24} color="#cbd5e1"/>
                                </div>
                            )}
                            <input
                                type="file"
                                accept="image/*"
                                onChange={handleFileChange}
                                className={styles.fileInput}
                            />
                        </div>
                    </div>

                    <div className={styles.formGroup}>
                        <label className={styles.label}>{t('centers.nameLabel')}</label>
                        <input
                            type="text"
                            name="nombre"
                            value={formData.nombre}
                            onChange={handleInputChange}
                            className={styles.input}
                            required
                            placeholder={t('centers.namePlaceholder')}
                        />
                    </div>

                    <div className={styles.formGroup}>
                        <label className={styles.label}>{t('centers.cif')}</label>
                        <input
                            type="text"
                            name="cif"
                            value={formData.cif}
                            onChange={handleInputChange}
                            className={styles.input}
                            required
                            placeholder={t('centers.cifPlaceholder')}
                        />
                    </div>

                    <div className={styles.formGroup}>
                        <label className={styles.label}>{t('centers.address')}</label>
                        <input
                            type="text"
                            name="direccion"
                            value={formData.direccion}
                            onChange={handleInputChange}
                            className={styles.input}
                            required
                            placeholder={t('centers.addressPlaceholder')}
                        />
                    </div>

                    <div className={styles.formGroup}>
                        <label className={styles.label}>
                            {t('centers.ccaa', { defaultValue: 'Comunidad Autónoma' })}
                        </label>
                        <ThemedSelect
                            value={formData.ccaa}
                            onChange={(v) => setFormData(p => ({ ...p, ccaa: v, provincia: '' }))}
                            options={[
                                { value: '', label: t('centers.ccaaNone', { defaultValue: '— Sin asignar —' }) },
                                ...CCAA_OPTIONS,
                            ]}
                        />
                        <small className={styles.helpText}>
                            {t('centers.ccaaHint', { defaultValue: 'Determina los festivos autonómicos aplicables. Cambiarla resetea la provincia.' })}
                        </small>
                    </div>

                    <div className={styles.formGroup}>
                        <label className={styles.label}>
                            {t('centers.provincia', { defaultValue: 'Provincia' })}
                        </label>
                        <ThemedSelect
                            value={formData.provincia}
                            onChange={(v) => setFormData(p => ({ ...p, provincia: v }))}
                            options={[
                                { value: '', label: t('centers.provinciaNone', { defaultValue: '— Sin asignar —' }) },
                                ...provincias
                                    .filter(p => !formData.ccaa || p.ccaa === formData.ccaa)
                                    .map(p => ({ value: p.codigo, label: `${p.nombre} (${p.codigo})` })),
                            ]}
                        />
                        <small className={styles.helpText}>
                            {t('centers.provinciaHint', { defaultValue: 'Filtrada por CCAA seleccionada. Necesaria para festivos provinciales y locales.' })}
                        </small>
                    </div>

                    <div className={styles.formGroup}>
                        <label className={styles.label}>
                            {t('centers.fechaInicioCurso', { defaultValue: 'Inicio del curso académico' })}
                        </label>
                        <input
                            type="date"
                            name="fechaInicioCurso"
                            value={formData.fechaInicioCurso}
                            onChange={handleInputChange}
                            className={styles.input}
                            placeholder={calendarioSugerido?.fechaInicio?.slice(0, 10) || ''}
                        />
                        <small className={styles.helpText}>
                            {calendarioSugerido?.fechaInicio
                                ? t('centers.fechaCursoSuggested', {
                                    defaultValue: 'Sugerido por calendario {{ccaa}}: {{fecha}} (puedes editar).',
                                    ccaa: formData.ccaa,
                                    fecha: new Date(calendarioSugerido.fechaInicio).toLocaleDateString('es-ES'),
                                })
                                : t('centers.fechaCursoHint', {
                                    defaultValue: 'Override del calendario CCAA. Si lo dejas vacío, se usará el oficial autonómico.',
                                })}
                        </small>
                    </div>

                    <div className={styles.formGroup}>
                        <label className={styles.label}>
                            {t('centers.fechaFinCurso', { defaultValue: 'Fin del curso académico' })}
                        </label>
                        <input
                            type="date"
                            name="fechaFinCurso"
                            value={formData.fechaFinCurso}
                            onChange={handleInputChange}
                            className={styles.input}
                            placeholder={calendarioSugerido?.fechaFin?.slice(0, 10) || ''}
                        />
                        <small className={styles.helpText}>
                            {calendarioSugerido?.fechaFin
                                ? t('centers.fechaCursoSuggested', {
                                    defaultValue: 'Sugerido por calendario {{ccaa}}: {{fecha}} (puedes editar).',
                                    ccaa: formData.ccaa,
                                    fecha: new Date(calendarioSugerido.fechaFin).toLocaleDateString('es-ES'),
                                })
                                : t('centers.fechaCursoHint', {
                                    defaultValue: 'Override del calendario CCAA. Si lo dejas vacío, se usará el oficial autonómico.',
                                })}
                        </small>
                    </div>

                    <div className={styles.formGroup}>
                        <label className={styles.label}>{t('centers.phone')}</label>
                        <input
                            type="tel"
                            name="telefono"
                            value={formData.telefono}
                            onChange={handleInputChange}
                            className={styles.input}
                            placeholder={t('centers.phonePlaceholder')}
                        />
                    </div>

                    <div className={styles.formGroup}>
                        <label className={styles.checkboxLabel}>
                            <input
                                type="checkbox"
                                name="activo"
                                checked={formData.activo}
                                onChange={handleInputChange}
                            />
                            {t('centers.activeCheckbox')}
                        </label>
                    </div>
                </ModalView>
            </div>
        </Layout>
    );
};

export default Centros;
