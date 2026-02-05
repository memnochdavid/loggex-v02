import React, {useEffect, useState} from 'react';
import styles from './Centros.module.css';
import Button from '../components/Button';
import DataTable from '../components/DataTable';
import SearchBar from '../components/SearchBar';
import Layout from '../components/Layout';
import ModalView from '../components/ModalView'; // Importar ModalView
import CrudHeader from '../components/CrudHeader'; // Importar CrudHeader
import {usePagination} from '../hooks/usePagination';
import {Plus, Edit2, Trash2, Image as ImageIcon} from 'lucide-react';

const Centros = () => {
    const [centros, setCentros] = useState([]);
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

    // Campos buscables
    const searchFields = [
        {value: 'nombre', label: 'Nombre'},
        {value: 'cif', label: 'CIF'},
        {value: 'direccion', label: 'Dirección'}
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

    // Debounce para búsqueda
    useEffect(() => {
        const timer = setTimeout(() => {
            fetchCentros(1); // Reset a página 1 al buscar
            setCurrentPage(1);
        }, 500);
        return () => clearTimeout(timer);
    }, [searchTerm, searchField]);

    // Fetch al cambiar página, orden o items por página
    useEffect(() => {
        fetchCentros(currentPage);
    }, [currentPage, sortColumn, sortDirection, itemsPerPage]);

    const handleItemsPerPageChange = (newItemsPerPage) => {
        setItemsPerPage(newItemsPerPage);
        setCurrentPage(1); // Resetear a página 1 al cambiar tamaño
    };

    const getCentroId = (centro) => {
        if (centro.id) return centro.id;
        if (centro['@id']) {
            const parts = centro['@id'].split('/');
            return parts[parts.length - 1];
        }
        return null;
    };

    const getLogoUrl = (logoName) => {
        if (!logoName) return null;
        return `https://localhost:9443/uploads/logo-centro/${logoName}`;
    };

    const fetchCentros = async (page) => {
        setLoading(true);
        try {
            // Construir URL con parámetros
            let url = `https://localhost:9443/api/centros?page=${page}&itemsPerPage=${itemsPerPage}`;

            if (searchTerm) {
                url += `&${searchField}=${encodeURIComponent(searchTerm)}`;
            }

            if (sortColumn) {
                url += `&order[${sortColumn}]=${sortDirection}`;
            }

            const response = await fetch(url, {
                headers: {
                    'Accept': 'application/ld+json',
                },
                credentials: 'include'
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
            console.error("Error fetching centros:", err);
            setError(err.message);
        } finally {
            setLoading(false);
        }
    };

    const handleSort = (columnKey) => {
        if (sortColumn === columnKey) {
            setSortDirection(prev => prev === 'asc' ? 'desc' : 'asc');
        } else {
            setSortColumn(columnKey);
            setSortDirection('asc');
        }
    };

    const handleOpenModal = (centro = null) => {
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
    };

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
                ? `https://localhost:9443/api/centro/${id}/update`
                : 'https://localhost:9443/api/centro/create';

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
                const errorMessage = errorData.message || errorData.detail || 'Error al guardar';
                throw new Error(errorMessage);
            }

            await fetchCentros(currentPage);
            handleCloseModal();

        } catch (err) {
            console.error("Error saving centro:", err);
            alert(`Error: ${err.message}`);
        } finally {
            setSaving(false);
        }
    };

    const handleDelete = async (centro) => {
        if (!window.confirm('¿Estás seguro de que quieres eliminar este centro? Esta acción no se puede deshacer.')) {
            return;
        }

        const id = getCentroId(centro);
        if (!id) return;

        try {
            const response = await fetch(`https://localhost:9443/api/centros/${id}`, {
                method: 'DELETE',
                credentials: 'include'
            });

            if (!response.ok) {
                throw new Error('No se pudo eliminar el centro');
            }

            fetchCentros(currentPage);

        } catch (err) {
            console.error("Error deleting centro:", err);
            alert(`Error al eliminar: ${err.message}`);
        }
    };

    const columns = [
        {
            header: 'Logo',
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
        {header: 'Nombre', accessor: 'nombre', sortable: true, sortKey: 'nombre'},
        {header: 'CIF', accessor: 'cif', sortable: true, sortKey: 'cif'},
        {header: 'Dirección', accessor: 'direccion', sortable: true, sortKey: 'direccion'},
        {header: 'Teléfono', accessor: 'telefono', sortable: false},
        {
            header: 'Estado',
            accessor: (row) => (
                <span className={`${styles.badge} ${row.activo ? styles.badgeActive : styles.badgeInactive}`}>
                {row.activo ? 'Activo' : 'Inactivo'}
            </span>
            ),
            sortable: true,
            sortKey: 'activo'
        },
        {
            header: 'Acciones',
            accessor: (row) => (
                <div className={styles.actions}>
                    <button
                        className={styles.iconButton}
                        onClick={() => handleOpenModal(row)}
                        title="Editar"
                    >
                        <Edit2 size={18}/>
                    </button>
                    <button
                        className={`${styles.iconButton} ${styles.danger}`}
                        onClick={() => handleDelete(row)}
                        title="Eliminar"
                    >
                        <Trash2 size={18}/>
                    </button>
                </div>
            ),
            sortable: false
        }
    ];

    return (
        <Layout>
            <div className={styles.container}>
                <CrudHeader title="Centros Educativos">
                    <SearchBar
                        value={searchTerm}
                        onChange={setSearchTerm}
                        placeholder="Buscar..."
                        fields={searchFields}
                        selectedField={searchField}
                        onFieldChange={setSearchField}
                    />
                    <Button onClick={() => handleOpenModal()}>
                        <Plus size={18} style={{marginRight: '8px'}}/>
                        Nuevo
                    </Button>
                </CrudHeader>

                {error && (
                    <div className={styles.errorContainer}>
                        <p>{error}</p>
                        <Button onClick={() => fetchCentros(currentPage)} variant="secondary"
                                style={{marginTop: '1rem'}}>Reintentar</Button>
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
                    title={currentCentro ? 'Editar Centro' : 'Nuevo Centro'}
                    onSubmit={handleSubmit}
                    isSubmitting={saving}
                >
                    {/* Campo de Logo */}
                    <div className={styles.formGroup}>
                        <label className={styles.label}>Logo del Centro</label>
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
                        <label className={styles.label}>Nombre del Centro</label>
                        <input
                            type="text"
                            name="nombre"
                            value={formData.nombre}
                            onChange={handleInputChange}
                            className={styles.input}
                            required
                            placeholder="Ej: IES Tecnológico"
                        />
                    </div>

                    <div className={styles.formGroup}>
                        <label className={styles.label}>CIF</label>
                        <input
                            type="text"
                            name="cif"
                            value={formData.cif}
                            onChange={handleInputChange}
                            className={styles.input}
                            required
                            placeholder="Ej: Q1234567A"
                        />
                    </div>

                    <div className={styles.formGroup}>
                        <label className={styles.label}>Dirección</label>
                        <input
                            type="text"
                            name="direccion"
                            value={formData.direccion}
                            onChange={handleInputChange}
                            className={styles.input}
                            required
                            placeholder="Calle Principal, 123"
                        />
                    </div>

                    <div className={styles.formGroup}>
                        <label className={styles.label}>Teléfono</label>
                        <input
                            type="tel"
                            name="telefono"
                            value={formData.telefono}
                            onChange={handleInputChange}
                            className={styles.input}
                            placeholder="912 345 678"
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
                            Centro Activo
                        </label>
                    </div>
                </ModalView>
            </div>
        </Layout>
    );
};

export default Centros;
