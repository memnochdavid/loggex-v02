import React, { useEffect, useState, useRef } from 'react';
import styles from './Academic.module.css'; // Usar estilos académicos unificados
import Layout from '../components/Layout';
import AccordionView from '../components/AccordionView';
import Button from '../components/Button';
import ModalView from '../components/ModalView';
import CrudHeader from '../components/CrudHeader';
import { useAuth } from '../context/AuthContext';
import { Plus, Edit2, Trash2, FileText, Calendar, Paperclip, Upload } from 'lucide-react';
import { getApiUrl, getAssetUrl } from '../config/api';
import Lottie from 'lottie-react';
import bookAnimation from '../../public/book.json';

const Tareas = () => {
  const { user } = useAuth();
  const isProfesor = user?.roles?.includes('ROLE_PROFESOR');
  const isAlumno = user?.roles?.includes('ROLE_ALUMNO');
  const isAdmin = user?.roles?.includes('ROLE_ADMIN') || user?.roles?.includes('ROLE_SUPERADMIN');
  const fileInputRef = useRef(null);

  const [asignaturas, setAsignaturas] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [expandedId, setExpandedId] = useState(null);

  // Estado para modal de creación/edición (Solo Profesores)
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [currentTarea, setCurrentTarea] = useState(null);
  const [selectedImparticionId, setSelectedImparticionId] = useState(null);
  const [formData, setFormData] = useState({
    titulo: '',
    descripcion: '',
    fechaLimite: '',
    tipo: 'tarea',
    visible: true,
    archivo: null
  });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (user) {
        fetchData();
    }
  }, [user]);

  const fetchData = async () => {
    setLoading(true);
    try {
        let endpoint = '';
        
        if (isProfesor) {
            endpoint = getApiUrl(`/api/imparticions?profesor=${user.id}&pagination=false`);
        } else if (isAlumno) {
            const resMatriculas = await fetch(getApiUrl(`/api/matriculas?alumno=${user.id}&pagination=false`), {
                headers: { 'Accept': 'application/ld+json' }, credentials: 'include'
            });
            const dataMatriculas = await resMatriculas.json();
            const matriculas = dataMatriculas['hydra:member'] || dataMatriculas.member || [];
            const grupoIds = matriculas.map(m => typeof m.grupo === 'string' ? m.grupo.split('/').pop() : m.grupo.id);
            
            if (grupoIds.length > 0) {
                const gruposQuery = grupoIds.map(id => `grupo[]=${id}`).join('&');
                endpoint = getApiUrl(`/api/imparticions?${gruposQuery}&pagination=false`);
            } else {
                setAsignaturas([]);
                setLoading(false);
                return;
            }
        } else if (isAdmin) {
             endpoint = getApiUrl(`/api/imparticions?pagination=false`);
        }

        if (endpoint) {
            const response = await fetch(endpoint, {
                headers: { 'Accept': 'application/ld+json' },
                credentials: 'include'
            });
            
            if (!response.ok) {
                throw new Error(`Error fetching imparticiones: ${response.status} ${response.statusText}`);
            }

            const data = await response.json();
            const items = data['hydra:member'] || data.member || [];
            
            const asignaturasConTareas = items.map(imp => {
                const nombreModulo = imp.modulo?.nombre || 'Módulo desconocido';
                const nombreGrupo = imp.grupo?.nombre || 'Grupo desconocido';
                const nombreProfesor = imp.profesor ? `${imp.profesor.nombre} ${imp.profesor.apellidos}` : '';
                
                let title = `${nombreModulo} - ${nombreGrupo}`;
                if (isAlumno && nombreProfesor) {
                    title += ` (${nombreProfesor})`;
                }

                return {
                    ...imp,
                    id: imp.id || imp['@id'].split('/').pop(),
                    title: title,
                    tareas: imp.tareas || []
                };
            });
            
            setAsignaturas(asignaturasConTareas);
        }

    } catch (err) {
        console.error("Error cargando tareas:", err);
        setError("No se pudieron cargar las tareas.");
    } finally {
        setLoading(false);
    }
  };

  const handleOpenModal = (imparticionId, tarea = null) => {
    setSelectedImparticionId(imparticionId);
    if (tarea) {
      setCurrentTarea(tarea);
      setFormData({
        titulo: tarea.titulo,
        descripcion: tarea.descripcion || '',
        fechaLimite: tarea.fechaLimite ? tarea.fechaLimite.slice(0, 16) : '',
        tipo: tarea.tipo || 'tarea',
        visible: tarea.visible,
        archivo: null
      });
    } else {
      setCurrentTarea(null);
      setFormData({
        titulo: '',
        descripcion: '',
        fechaLimite: '',
        tipo: 'tarea',
        visible: true,
        archivo: null
      });
    }
    setIsModalOpen(true);
  };

  const handleCloseModal = () => {
    setIsModalOpen(false);
    setCurrentTarea(null);
    setSelectedImparticionId(null);
  };

  const handleInputChange = (e) => {
    const { name, value, type, checked, files } = e.target;
    if (type === 'file') {
        setFormData(prev => ({ ...prev, archivo: files[0] }));
    } else {
        setFormData(prev => ({
            ...prev,
            [name]: type === 'checkbox' ? checked : value
        }));
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);

    try {
      const data = new FormData();
      data.append('titulo', formData.titulo);
      data.append('descripcion', formData.descripcion);
      data.append('fechaLimite', formData.fechaLimite);
      data.append('tipo', formData.tipo);
      data.append('visible', formData.visible);
      data.append('imparticionId', selectedImparticionId);
      
      if (currentTarea) {
          data.append('id', currentTarea.id);
      }

      if (formData.archivo) {
          data.append('file', formData.archivo);
      }

      const url = getApiUrl('/api/tareas/upload');
      
      const response = await fetch(url, {
        method: 'POST',
        body: data,
        credentials: 'include'
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.message || 'Error al guardar la tarea');
      }

      await fetchData();
      handleCloseModal();

    } catch (err) {
      console.error(err);
      alert("Error al guardar: " + err.message);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (tareaId) => {
    if (!window.confirm('¿Eliminar esta tarea?')) return;

    try {
        const response = await fetch(getApiUrl(`/api/tareas/${tareaId}`), {
            method: 'DELETE',
            credentials: 'include'
        });
        if (!response.ok) throw new Error('Error al eliminar');
        fetchData();
    } catch (err) {
        alert(err.message);
    }
  };

  const handleToggle = (id) => {
      setExpandedId(prevId => (prevId === id ? null : id));
  };

  const renderContent = (imparticion) => {
      const tareas = imparticion.tareas || [];
      
      if (tareas.length === 0) {
          return <div className={styles.emptyState}>No hay tareas asignadas.</div>;
      }

      return (
          <ul className={styles.list}>
              {tareas.map(tarea => (
                  <li key={tarea.id} className={styles.listItem}>
                      <div className={styles.itemInfo}>
                          <FileText size={20} className={styles.icon} />
                          <div style={{ display: 'flex', flexDirection: 'column' }}>
                              <span style={{ fontWeight: '600' }}>{tarea.titulo}</span>
                              <span className={styles.date}>
                                  Entrega: {new Date(tarea.fechaLimite).toLocaleString()} • {tarea.tipo}
                                  {!tarea.visible && <span className={`${styles.badge} ${styles.badgeError}`} style={{ marginLeft: '8px' }}>Oculta</span>}
                              </span>
                          </div>
                      </div>
                      
                      <div className={styles.itemActions}>
                          {tarea.archivo && (
                              <a 
                                  href={getAssetUrl(`/uploads/tareas/${tarea.archivo}`)}
                                  target="_blank" 
                                  rel="noopener noreferrer"
                                  className={styles.downloadLink}
                                  title="Descargar adjunto"
                              >
                                  <Paperclip size={18} />
                              </a>
                          )}
                          
                          {(isProfesor || isAdmin) && (
                              <>
                                  <button className={styles.iconButton} onClick={() => handleOpenModal(imparticion.id, tarea)} title="Editar">
                                      <Edit2 size={18} />
                                  </button>
                                  <button className={`${styles.iconButton} ${styles.danger}`} onClick={() => handleDelete(tarea.id)} title="Eliminar">
                                      <Trash2 size={18} />
                                  </button>
                              </>
                          )}
                      </div>
                  </li>
              ))}
          </ul>
      );
  };

  return (
    <Layout>
      <div className={styles.container}>
        <CrudHeader title="Tareas y Actividades"
                    logo={<Lottie animationData={bookAnimation} loop={true} style={{ width: 60, height: 60 }} />}
        />

        {loading ? (
            <div className={styles.loadingContainer}>Cargando asignaturas...</div>
        ) : error ? (
            <div className={styles.errorContainer}>{error}</div>
        ) : asignaturas.length === 0 ? (
            <div className={styles.emptyState}>
                No tienes asignaturas asignadas.
            </div>
        ) : (
            <AccordionView 
                data={asignaturas}
                renderItem={renderContent}
                canAdd={isProfesor || isAdmin}
                onAdd={(id) => handleOpenModal(id)}
                expandedId={expandedId}
                onToggle={handleToggle}
            />
        )}

        <ModalView
            isOpen={isModalOpen}
            onClose={handleCloseModal}
            title={currentTarea ? 'Editar Tarea' : 'Nueva Tarea'}
            onSubmit={handleSubmit}
            isSubmitting={saving}
        >
            <div className={styles.formGroup}>
                <label className={styles.label}>Título</label>
                <input 
                    className={styles.input} 
                    name="titulo" 
                    value={formData.titulo} 
                    onChange={handleInputChange} 
                    required 
                />
            </div>
            <div className={styles.formGroup}>
                <label className={styles.label}>Descripción</label>
                <textarea 
                    className={styles.textarea} 
                    name="descripcion" 
                    value={formData.descripcion} 
                    onChange={handleInputChange} 
                />
            </div>
            <div className={styles.formGroup}>
                <label className={styles.label}>Archivo Adjunto (Opcional)</label>
                <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                    <input
                        type="file"
                        ref={fileInputRef}
                        className={styles.fileInput}
                        name="archivo"
                        onChange={handleInputChange}
                        style={{ display: 'none' }}
                    />
                    <Button 
                        type="button" 
                        variant="secondary" 
                        onClick={() => fileInputRef.current.click()}
                    >
                        <Upload size={16} style={{ marginRight: '8px' }} />
                        {formData.archivo ? 'Cambiar archivo' : 'Seleccionar archivo'}
                    </Button>
                    {formData.archivo && (
                        <span style={{ fontSize: '0.9rem', color: 'var(--text-main)' }}>
                            {formData.archivo.name}
                        </span>
                    )}
                </div>
                {currentTarea && currentTarea.archivo && !formData.archivo && (
                    <small style={{color: 'var(--text-muted)', display: 'block', marginTop: '4px'}}>
                        Archivo actual: {currentTarea.archivo}
                    </small>
                )}
            </div>
            <div className={styles.formGroup}>
                <label className={styles.label}>Fecha Límite</label>
                <input 
                    type="datetime-local" 
                    className={styles.input} 
                    name="fechaLimite" 
                    value={formData.fechaLimite} 
                    onChange={handleInputChange} 
                    required 
                />
            </div>
            <div className={styles.formGroup}>
                <label className={styles.label}>Tipo</label>
                <select 
                    className={styles.select} 
                    name="tipo" 
                    value={formData.tipo} 
                    onChange={handleInputChange}
                >
                    <option value="tarea">Tarea</option>
                    <option value="examen">Examen</option>
                    <option value="practica">Práctica</option>
                </select>
            </div>
            <div className={styles.formGroup}>
                <label style={{display:'flex', alignItems:'center', gap:'8px'}}>
                    <input 
                        type="checkbox" 
                        name="visible" 
                        checked={formData.visible} 
                        onChange={handleInputChange} 
                    />
                    Visible para alumnos
                </label>
            </div>
        </ModalView>
      </div>
    </Layout>
  );
};

export default Tareas;
