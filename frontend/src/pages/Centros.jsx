import React, { useEffect, useState } from 'react';
import styles from './Centros.module.css';
import Button from '../components/Button';
import DataTable from '../components/DataTable';
import { Plus, Edit2, Trash2, X, Image as ImageIcon } from 'lucide-react';

const Centros = () => {
  const [centros, setCentros] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  
  // Paginación
  const [currentPage, setCurrentPage] = useState(1);
  const [totalItems, setTotalItems] = useState(0);
  const itemsPerPage = 30;

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

  useEffect(() => {
    fetchCentros(currentPage);
  }, [currentPage]);

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
      const response = await fetch(`https://localhost:9443/api/centros?page=${page}`, {
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
    const { name, value, type, checked } = e.target;
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
      
      // Usamos los endpoints personalizados del CentroController
      const url = currentCentro 
        ? `https://localhost:9443/api/centro/${id}/update`
        : 'https://localhost:9443/api/centro/create';
      
      // Usamos FormData para enviar archivos y datos
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
        method: 'POST', // Siempre POST para FormData (incluso para update)
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

  // Definición de columnas para DataTable
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
                        onError={(e) => { e.target.style.display = 'none'; e.target.nextSibling.style.display = 'flex'; }}
                    />
                ) : null}
                <div 
                    className={styles.logoPlaceholder}
                    style={{ display: row.logo ? 'none' : 'flex' }}
                >
                    <ImageIcon size={16} />
                </div>
            </div>
        ),
        className: styles.colLogo
    },
    { header: 'Nombre', accessor: 'nombre' },
    { header: 'CIF', accessor: 'cif' },
    { header: 'Dirección', accessor: 'direccion' },
    { header: 'Teléfono', accessor: 'telefono' },
    { 
        header: 'Estado', 
        accessor: (row) => (
            <span className={`${styles.badge} ${row.activo ? styles.badgeActive : styles.badgeInactive}`}>
                {row.activo ? 'Activo' : 'Inactivo'}
            </span>
        )
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
                    <Edit2 size={18} />
                </button>
                <button 
                    className={`${styles.iconButton} ${styles.danger}`} 
                    onClick={() => handleDelete(row)}
                    title="Eliminar"
                >
                    <Trash2 size={18} />
                </button>
            </div>
        )
    }
  ];

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <h1 className={styles.pageTitle}>Centros Educativos</h1>
        <Button onClick={() => handleOpenModal()}>
          <Plus size={18} style={{ marginRight: '8px' }} />
          Nuevo Centro
        </Button>
      </div>

      {error && (
        <div className={styles.errorContainer}>
          <p>{error}</p>
          <Button onClick={() => fetchCentros(currentPage)} variant="secondary" style={{ marginTop: '1rem' }}>Reintentar</Button>
        </div>
      )}

      <DataTable
        columns={columns}
        data={centros}
        totalItems={totalItems}
        itemsPerPage={itemsPerPage}
        currentPage={currentPage}
        onPageChange={setCurrentPage}
        loading={loading}
      />

      {/* Modal de Creación/Edición */}
      {isModalOpen && (
        <div className={styles.modalOverlay} onClick={handleCloseModal}>
          <div className={styles.modal} onClick={e => e.stopPropagation()}>
            <div className={styles.modalHeader}>
              <h3 className={styles.modalTitle}>
                {currentCentro ? 'Editar Centro' : 'Nuevo Centro'}
              </h3>
              <button className={styles.closeButton} onClick={handleCloseModal}>
                <X size={20} />
              </button>
            </div>
            
            <form onSubmit={handleSubmit}>
              <div className={styles.modalBody}>
                
                {/* Campo de Logo */}
                <div className={styles.formGroup}>
                    <label className={styles.label}>Logo del Centro</label>
                    <div className={styles.logoPreviewContainer}>
                        {logoPreview ? (
                            <img src={logoPreview} alt="Previsualización" className={styles.logoPreview} />
                        ) : (
                            <div className={styles.logoPreview} style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                <ImageIcon size={24} color="#cbd5e1" />
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
              </div>

              <div className={styles.modalFooter}>
                <Button type="button" variant="secondary" onClick={handleCloseModal}>
                  Cancelar
                </Button>
                <Button type="submit" disabled={saving}>
                  {saving ? 'Guardando...' : 'Guardar'}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default Centros;
