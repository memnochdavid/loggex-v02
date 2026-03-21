import React, {useEffect, useState, useRef, useCallback, useMemo} from 'react';
import styles from './Crud.module.css'; // Usar estilos comunes
import Button from '../components/Button';
import DataTable from '../components/DataTable';
import SearchBar from '../components/SearchBar';
import Layout from '../components/Layout';
import ModalView from '../components/ModalView';
import CrudHeader from '../components/CrudHeader';
import {usePagination} from '../hooks/usePagination';
import {Plus, Edit2, Trash2, Image as ImageIcon, Building} from 'lucide-react';
import { getApiUrl, getAssetUrl } from '../config/api';
import Lottie from 'lottie-react';
import crudAnimation from '../../public/crud.json';
import helloAnimation from "../../public/hello.json";
import { useTranslation } from 'react-i18next';
import { useToast } from '../context/ToastContext';
import ConfirmDialog from '../components/ConfirmDialog';
import useConfirm from '../hooks/useConfirm';

const Centros = () => {
    const { t } = useTranslation();
    const { toast } = useToast();
    const { isOpen: confirmOpen, message: confirmMessage, confirm, handleConfirm, handleCancel } = useConfirm();
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
        activo: true
    });
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
            setFormData({
                nombre: centro.nombre,
                cif: centro.cif,
                direccion: centro.direccion,
                telefono: centro.telefono || '',
                activo: centro.activo
            });
            setLogoPreview(centro.logo ? getLogoUrl(centro.logo) : null);
        } else {
            setCurrentCentro(null);
            setFormData({
                nombre: '',
                cif: '',
                direccion: '',
                telefono: '',
                activo: true
            });
            setLogoPreview(null);
        }
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

            if (logoFile) {
                data.append('logo', logoFile);
            }

            const response = await fetch(url, {
                method: method,
                body: data,
                credentials: 'include'
            });

            if (!response.ok) {
                const errorData = await response.json();
                const errorMessage = errorData.message || errorData.detail || t('common.errorSaving', { message: 'Error desconocido' });
                throw new Error(errorMessage);
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
            toast.success(t('common.savedSuccessfully'));

        } catch (err) {
            console.error("Error saving centro:", err);
            toast.error(t('common.errorSaving', { message: err.message }));
        } finally {
            setSaving(false);
        }
    };

    const handleDelete = useCallback(async (centro) => {
        if (!(await confirm(t('centers.confirmDelete')))) {
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
                throw new Error(t('centers.errorDelete'));
            }

            fetchCentrosData({
                page: currentPage,
                itemsPerPage,
                searchTerm,
                searchField,
                sortColumn,
                sortDirection
            });
            toast.success(t('common.deletedSuccessfully'));

        } catch (err) {
            console.error("Error deleting centro:", err);
            toast.error(t('common.errorDeletingMsg', { message: err.message }));
        }
    }, [currentPage, itemsPerPage, searchTerm, searchField, sortColumn, sortDirection, fetchCentrosData]);

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
                            logo={<Lottie animationData={crudAnimation} loop={true} style={{ width: 60, height: 60 }} />}
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
                    emptyIcon={Building}
                    emptyTitle={t('centers.emptyTitle')}
                    emptyDescription={t('centers.emptyDescription')}
                    emptyAction={t('centers.newTitle')}
                    onEmptyAction={() => handleOpenModal()}
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

export default Centros;
