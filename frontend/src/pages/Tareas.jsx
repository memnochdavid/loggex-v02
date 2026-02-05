import React, { useEffect, useState } from 'react';
import styles from './Tareas.module.css';
import Layout from '../components/Layout';
import AccordionView from '../components/AccordionView';
import Button from '../components/Button';
import ModalView from '../components/ModalView'; // Importar ModalView
import CrudHeader from '../components/CrudHeader'; // Importar CrudHeader
import { useAuth } from '../context/AuthContext';
import { Plus, Edit2, Trash2, FileText, Calendar, Paperclip } from 'lucide-react';
import { getApiUrl, getAssetUrl } from '../config/api';

const Tareas = () => {
  const { user } = useAuth();
  const isProfesor = user?.roles?.includes('ROLE_PROFESOR');
  const isAlumno = user?.roles?.includes('ROLE_ALUMNO');
  const isAdmin = user?.roles?.includes('ROLE_ADMIN') || user?.roles?.includes('ROLE_SUPERADMIN');

  const [asignaturas, setAsignaturas] = useState([]); // Imparticiones agrupadas
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Estado para modal de creación/edición (Solo Profesores)
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [currentTarea, setCurrentTarea] = useState(null);
  const [selectedImparticionId, setSelectedImparticionId] = useState(null);
  const [formData, setFormData] = useState({
    titulo: '',
    descripcion: '',
    fechaLimite: '',
    tipo: 'tarea', // tarea, examen, practica
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
            
            // Transformar datos para AccordionView (necesita 'title')
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
                    title: title, // Propiedad requerida por AccordionView
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
        fechaLimite: tarea.fechaLimite ? tarea.fechaLimite.slice(0, 16) : '', // Formato datetime-local
        tipo: tarea.tipo || 'tarea',
        visible: tarea.visible,
        archivo: null // No precargamos archivo en edición, solo si se quiere cambiar
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
      // Usamos FormData para enviar archivo
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

      // Usamos el nuevo endpoint de subida que maneja creación y edición con archivo
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

      await fetchData(); // Recargar datos
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

  // Renderizado de contenido (Lista de tareas)
  const renderContent = (imparticion) => {
      const tareas = imparticion.tareas || [];
      
      return (
          <div className={styles.taskList}>
              {(isProfesor || isAdmin) && (
                  <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '1rem' }}>
                      <Button size="sm" onClick={() => handleOpenModal(imparticion.id)}>
                          <Plus size={16} style={{ marginRight: '4px' }} /> Nuevo
                      </Button>
                  </div>
              )}
              
              {tareas.length === 0 ? (
                  <div className={styles.emptyState}>No hay tareas asignadas.</div>
              ) : (
                  tareas.map(tarea => (
                      <div key={tarea.id} className={styles.taskCard}>
                          <div className={styles.taskInfo}>
                              <div className={styles.taskTitle}>
                                  <FileText size={18} className={styles.icon} />
                                  {tarea.titulo}
                                  {!tarea.visible && <span style={{fontSize:'0.7rem', color:'red', border:'1px solid red', padding:'0 4px', borderRadius:'4px', marginLeft: '8px'}}>Oculta</span>}
                              </div>
                              {tarea.descripcion && (
                                  <div className={styles.taskDescription} dangerouslySetInnerHTML={{ __html: tarea.descripcion }} />
                              )}
                              
                              {tarea.archivo && (
                                  <div className={styles.taskFile}>
                                      <a 
                                          href={getAssetUrl(`/uploads/tareas/${tarea.archivo}`)}
                                          target="_blank" 
                                          rel="noopener noreferrer"
                                          className={styles.fileLink}
                                      >
                                          <Paperclip size={16} />
                                          Descargar adjunto
                                      </a>
                                  </div>
                              )}

                              <div className={styles.taskMeta}>
                                  <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                                      <Calendar size={14} /> 
                                      Entrega: {new Date(tarea.fechaLimite).toLocaleString()}
                                  </span>
                                  <span className={`${styles.badge} ${styles.badgePending}`}>
                                      {tarea.tipo}
                                  </span>
                              </div>
                          </div>
                          
                          <div className={styles.taskActions}>
                              {(isProfesor || isAdmin) ? (
                                  <>
                                      <button className={styles.iconButton} onClick={() => handleOpenModal(imparticion.id, tarea)}>
                                          <Edit2 size={18} />
                                      </button>
                                      <button className={`${styles.iconButton} ${styles.danger}`} onClick={() => handleDelete(tarea.id)}>
                                          <Trash2 size={18} />
                                      </button>
                                  </>
                              ) : (
                                  <Button size="sm" variant="secondary">
                                      Ver / Entregar
                                  </Button>
                              )}
                          </div>
                      </div>
                  ))
              )}
          </div>
      );
  };

  return (
    <Layout>
      <div className={styles.container}>
        <CrudHeader title="Tareas y Actividades" />

        {loading ? (
            <div style={{ textAlign: 'center', padding: '2rem' }}>Cargando asignaturas...</div>
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
                canAdd={false}
            />
        )}

        {/* Modal Crear/Editar */}
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
                <input 
                    type="file" 
                    className={styles.input} 
                    name="archivo" 
                    onChange={handleInputChange} 
                />
                {currentTarea && currentTarea.archivo && (
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
