import React, { useEffect, useState } from 'react';
import Layout from '../components/Layout';
import AccordionView from '../components/AccordionView';
import Button from '../components/Button';
import ModalView from '../components/ModalView'; // Importar ModalView
import { useAuth } from '../context/AuthContext';
import { FileText, Download, Trash2 } from 'lucide-react';
import styles from './Materiales.module.css';
import modalStyles from './Usuarios.module.css'; // Importamos estilos del modal

const MaterialesProfesor = () => {
  const { user } = useAuth();
  const [asignaturas, setAsignaturas] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  
  // Estado Modal
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [currentImparticionId, setCurrentImparticionId] = useState(null);
  const [formData, setFormData] = useState({
    titulo: '',
    archivo: null
  });
  const [uploading, setUploading] = useState(false);

  const fetchData = async () => {
    if (!user) return;

    try {
      setLoading(true);

      // 1. Obtener imparticiones del profesor
      const impRes = await fetch(`https://localhost:9443/api/imparticions?profesor=${user.id}&pagination=false`, {
        headers: { 'Accept': 'application/ld+json' },
        credentials: 'include'
      });
      const impData = await impRes.json();
      const imparticiones = impData['hydra:member'] || impData.member || [];

      // 2. Obtener materiales para cada impartición
      const asignaturasData = [];

      for (const imp of imparticiones) {
          const impId = imp.id || imp['@id'].split('/').pop();
          const matRes = await fetch(`https://localhost:9443/api/materials?imparticion=${impId}&pagination=false`, {
              headers: { 'Accept': 'application/ld+json' },
              credentials: 'include'
          });
          const matData = await matRes.json();
          const materiales = matData['hydra:member'] || matData.member || [];

          asignaturasData.push({
              id: impId,
              title: `${imp.modulo.nombre} - ${imp.grupo.nombre}`,
              materiales: materiales
          });
      }

      setAsignaturas(asignaturasData);

    } catch (err) {
      console.error("Error cargando materiales:", err);
      setError("No se pudieron cargar los temarios.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [user]);

  const handleAddClick = (imparticionId) => {
    setCurrentImparticionId(imparticionId);
    setFormData({ titulo: '', archivo: null });
    setIsModalOpen(true);
  };

  const handleCloseModal = () => {
    setIsModalOpen(false);
    setCurrentImparticionId(null);
  };

  const handleInputChange = (e) => {
    const { name, value, files } = e.target;
    if (name === 'archivo') {
        setFormData(prev => ({ ...prev, archivo: files[0] }));
    } else {
        setFormData(prev => ({ ...prev, [name]: value }));
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!formData.archivo || !formData.titulo) {
        alert("Por favor completa todos los campos");
        return;
    }

    setUploading(true);

    try {
        const data = new FormData();
        data.append('file', formData.archivo);
        data.append('titulo', formData.titulo);
        data.append('imparticionId', currentImparticionId);

        const response = await fetch('https://localhost:9443/api/materiales/upload', {
            method: 'POST',
            body: data,
            credentials: 'include'
        });

        if (!response.ok) {
            const errorData = await response.json().catch(() => ({}));
            throw new Error(errorData.message || 'Error al subir el archivo');
        }

        await fetchData();
        handleCloseModal();

    } catch (err) {
        console.error("Error subiendo material:", err);
        alert(`Error al subir el material: ${err.message}`);
    } finally {
        setUploading(false);
    }
  };

  const handleDelete = async (materialId) => {
      if (!window.confirm("¿Seguro que quieres eliminar este material?")) return;

      try {
          const response = await fetch(`https://localhost:9443/api/materials/${materialId}`, {
              method: 'DELETE',
              credentials: 'include'
          });

          if (!response.ok) throw new Error("Error al eliminar");
          
          fetchData();
      } catch (err) {
          console.error(err);
          alert("No se pudo eliminar el material");
      }
  };

  const renderMateriales = (asignatura) => {
    if (asignatura.materiales.length === 0) {
      return <p className={styles.emptyMessage}>No has subido temarios aún.</p>;
    }

    return (
      <ul className={styles.materialList}>
        {asignatura.materiales.map(mat => (
          <li key={mat.id} className={styles.materialItem}>
            <div className={styles.materialInfo}>
                <FileText size={20} className={styles.icon} />
                <span>{mat.titulo}</span>
                <span className={styles.date}>
                    {new Date(mat.fechaSubida).toLocaleDateString()}
                </span>
            </div>
            <div style={{ display: 'flex', gap: '0.5rem' }}>
                <a 
                    href={`https://localhost:9443/uploads/materiales/${mat.archivo}`} 
                    target="_blank" 
                    rel="noopener noreferrer"
                    className={styles.downloadLink}
                    download
                >
                    <Download size={18} />
                </a>
                <button 
                    className={styles.closeButton} 
                    onClick={() => handleDelete(mat.id)}
                    style={{ color: '#ef4444', background: 'none', border: 'none', cursor: 'pointer' }}
                >
                    <Trash2 size={18} />
                </button>
            </div>
          </li>
        ))}
      </ul>
    );
  };

  return (
    <Layout>
      <div className={styles.container}>
        <h1 className={styles.pageTitle}>Mis Temarios</h1>
        {loading ? (
          <p>Cargando...</p>
        ) : error ? (
          <p className={styles.error}>{error}</p>
        ) : (
          <AccordionView 
            data={asignaturas} 
            renderItem={renderMateriales} 
            onAdd={handleAddClick}
            canAdd={true}
          />
        )}

        <ModalView
            isOpen={isModalOpen}
            onClose={handleCloseModal}
            title="Subir Nuevo Temario"
            onSubmit={handleSubmit}
            isSubmitting={uploading}
            submitText="Subir"
        >
            <div className={modalStyles.formGroup}>
                <label className={modalStyles.label}>Título</label>
                <input 
                    type="text" 
                    name="titulo" 
                    value={formData.titulo} 
                    onChange={handleInputChange} 
                    className={modalStyles.input} 
                    required 
                    placeholder="Ej: Tema 1 - Introducción"
                />
            </div>
            <div className={modalStyles.formGroup}>
                <label className={modalStyles.label}>Archivo (PDF, DOCX...)</label>
                <input 
                    type="file" 
                    name="archivo" 
                    onChange={handleInputChange} 
                    className={modalStyles.fileInput} 
                    required 
                />
            </div>
        </ModalView>
      </div>
    </Layout>
  );
};

export default MaterialesProfesor;
