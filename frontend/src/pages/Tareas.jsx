import React, { useEffect, useState } from 'react';
import styles from './Tareas.module.css';
import Layout from '../components/Layout';
import AccordionView from '../components/AccordionView';
import Button from '../components/Button';
import { useAuth } from '../context/AuthContext';
import { Plus, Edit2, Trash2, X, FileText, Calendar, CheckCircle, AlertCircle } from 'lucide-react';

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
    visible: true
  });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (user) {
        fetchData();
    }
  }, [user]);

  const fetchData = async () => {
    setLoading(true);
    console.log("Iniciando carga de tareas para:", user.email, "ID:", user.id);
    try {
        // DEBUG: Petición sin filtros para ver si llega algo
        console.log("DEBUG: Fetching ALL imparticiones...");
        const debugResponse = await fetch('https://localhost:9443/api/imparticions?page=1', {
            headers: { 'Accept': 'application/ld+json' },
            credentials: 'include'
        });
        const debugData = await debugResponse.json();
        console.log("DEBUG: Todas las imparticiones:", debugData['hydra:member']);


        let endpoint = '';
        
        if (isProfesor) {
            // Volvemos a intentar con el filtro, pero asegurándonos de que el ID es un número
            endpoint = `https://localhost:9443/api/imparticions?profesor=${Number(user.id)}`;
        } else if (isAlumno) {
            const resMatriculas = await fetch(`https://localhost:9443/api/matriculas?alumno=${user.id}`, {
                headers: { 'Accept': 'application/ld+json' }, credentials: 'include'
            });
            const dataMatriculas = await resMatriculas.json();
            const matriculas = dataMatriculas['hydra:member'] || [];
            const grupoIds = matriculas.map(m => typeof m.grupo === 'string' ? m.grupo.split('/').pop() : m.grupo.id);
            
            if (grupoIds.length > 0) {
                const gruposQuery = grupoIds.map(id => `grupo[]=${id}`).join('&');
                endpoint = `https://localhost:9443/api/imparticions?${gruposQuery}`;
            } else {
                setAsignaturas([]);
                setLoading(false);
                return;
            }
        } else if (isAdmin) {
             endpoint = `https://localhost:9443/api/imparticions`;
        }

        if (endpoint) {
            console.log("Fetching endpoint:", endpoint);
            const response = await fetch(endpoint, {
                headers: { 'Accept': 'application/ld+json' },
                credentials: 'include'
            });
            
            if (!response.ok) {
                throw new Error(`Error fetching imparticiones: ${response.status} ${response.statusText}`);
            }

            const data = await response.json();
            const items = data['hydra:member'] || [];
            console.log("Imparticiones recibidas (filtradas):", items);
            
            const asignaturasConTareas = items.map(imp => ({
                ...imp,
                tareas: imp.tareas || []
            }));
            
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
        visible: tarea.visible
      });
    } else {
      setCurrentTarea(null);
      setFormData({
        titulo: '',
        descripcion: '',
        fechaLimite: '',
        tipo: 'tarea',
        visible: true
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
    const { name, value, type, checked } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);

    try {
      const url = currentTarea 
        ? `https://localhost:9443/api/tareas/${currentTarea.id}`
        : 'https://localhost:9443/api/tareas';
      
      const method = currentTarea ? 'PUT' : 'POST';

      const payload = {
        ...formData,
        imparticion: `/api/imparticions/${selectedImparticionId}`
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
        throw new Error('Error al guardar la tarea');
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
        const response = await fetch(`https://localhost:9443/api/tareas/${tareaId}`, {
            method: 'DELETE',
            credentials: 'include'
        });
        if (!response.ok) throw new Error('Error al eliminar');
        fetchData();
    } catch (err) {
        alert(err.message);
    }
  };

  // Renderizado de cabecera de asignatura (Impartición)
  const renderHeader = (imparticion, isExpanded) => (
    <div style={{ display: 'flex', flexDirection: 'column' }}>
        <span style={{ fontWeight: 'bold', fontSize: '1.1rem' }}>
            {imparticion.modulo?.nombre || 'Módulo desconocido'}
        </span>
        <span style={{ fontSize: '0.9rem', color: 'var(--text-muted)' }}>
            {imparticion.grupo?.nombre} {isAlumno && imparticion.profesor ? `• ${imparticion.profesor.nombre} ${imparticion.profesor.apellidos}` : ''}
        </span>
    </div>
  );

  // Renderizado de contenido (Lista de tareas)
  const renderContent = (imparticion) => {
      const tareas = imparticion.tareas || [];
      
      return (
          <div className={styles.taskList}>
              {(isProfesor || isAdmin) && (
                  <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '1rem' }}>
                      <Button size="sm" onClick={() => handleOpenModal(imparticion.id)}>
                          <Plus size={16} style={{ marginRight: '4px' }} /> Nueva Tarea
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
                                  {!tarea.visible && <span style={{fontSize:'0.7rem', color:'red', border:'1px solid red', padding:'0 4px', borderRadius:'4px'}}>Oculta</span>}
                              </div>
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
        <div className={styles.header}>
          <h1 className={styles.pageTitle}>Tareas y Actividades</h1>
        </div>

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
                renderHeader={renderHeader}
                renderItem={renderContent}
            />
        )}

        {/* Modal Crear/Editar */}
        {isModalOpen && (
            <div className={styles.modalOverlay} onClick={handleCloseModal}>
                <div className={styles.modal} onClick={e => e.stopPropagation()}>
                    <div className={styles.modalHeader}>
                        <h3 className={styles.modalTitle}>{currentTarea ? 'Editar Tarea' : 'Nueva Tarea'}</h3>
                        <button className={styles.closeButton} onClick={handleCloseModal}><X size={20}/></button>
                    </div>
                    <form onSubmit={handleSubmit}>
                        <div className={styles.modalBody}>
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
                        </div>
                        <div className={styles.modalFooter}>
                            <Button type="button" variant="secondary" onClick={handleCloseModal}>Cancelar</Button>
                            <Button type="submit" disabled={saving}>{saving ? 'Guardando...' : 'Guardar'}</Button>
                        </div>
                    </form>
                </div>
            </div>
        )}
      </div>
    </Layout>
  );
};

export default Tareas;
