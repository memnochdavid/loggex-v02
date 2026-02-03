import React, { useEffect, useState } from 'react';
import styles from './Entregas.module.css';
import Layout from '../components/Layout';
import AccordionView from '../components/AccordionView';
import Button from '../components/Button';
import DataTable from '../components/DataTable';
import { useAuth } from '../context/AuthContext';
import { FileText, Calendar, Upload, Eye, X, Download, CheckCircle, Clock } from 'lucide-react';

const Entregas = () => {
  const { user } = useAuth();
  const isProfesor = user?.roles?.includes('ROLE_PROFESOR');
  const isAlumno = user?.roles?.includes('ROLE_ALUMNO');
  const isAdmin = user?.roles?.includes('ROLE_ADMIN') || user?.roles?.includes('ROLE_SUPERADMIN');

  const [asignaturas, setAsignaturas] = useState([]);
  const [misEntregas, setMisEntregas] = useState({}); // Mapa tareaId -> entrega (Solo alumno)
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Estado Modal Alumno (Subir Entrega)
  const [isUploadModalOpen, setIsUploadModalOpen] = useState(false);
  const [currentTarea, setCurrentTarea] = useState(null);
  const [uploadFormData, setUploadFormData] = useState({
    comentario: '',
    enlace: '',
    archivo: null
  });
  const [uploading, setUploading] = useState(false);

  // Estado Modal Profesor (Ver Entregas)
  const [isViewModalOpen, setIsViewModalOpen] = useState(false);
  const [entregasTarea, setEntregasTarea] = useState([]);
  const [loadingEntregas, setLoadingEntregas] = useState(false);

  useEffect(() => {
    if (user) {
        fetchData();
    }
  }, [user]);

  const fetchData = async () => {
    setLoading(true);
    try {
        // 1. Cargar Asignaturas y Tareas (Igual que en Tareas.jsx)
        let endpoint = '';
        if (isProfesor) {
            endpoint = `https://localhost:9443/api/imparticions?profesor=${user.id}&pagination=false`;
        } else if (isAlumno) {
            const resMatriculas = await fetch(`https://localhost:9443/api/matriculas?alumno=${user.id}&pagination=false`, {
                headers: { 'Accept': 'application/ld+json' }, credentials: 'include'
            });
            const dataMatriculas = await resMatriculas.json();
            const matriculas = dataMatriculas['hydra:member'] || dataMatriculas.member || [];
            const grupoIds = matriculas.map(m => typeof m.grupo === 'string' ? m.grupo.split('/').pop() : m.grupo.id);
            
            if (grupoIds.length > 0) {
                const gruposQuery = grupoIds.map(id => `grupo[]=${id}`).join('&');
                endpoint = `https://localhost:9443/api/imparticions?${gruposQuery}&pagination=false`;
            }
        } else if (isAdmin) {
             endpoint = `https://localhost:9443/api/imparticions?pagination=false`;
        }

        if (endpoint) {
            const response = await fetch(endpoint, {
                headers: { 'Accept': 'application/ld+json' },
                credentials: 'include'
            });
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

        // 2. Si es alumno, cargar sus entregas para saber el estado
        if (isAlumno) {
            const resEntregas = await fetch(`https://localhost:9443/api/entregas?alumno=${user.id}&pagination=false`, {
                headers: { 'Accept': 'application/ld+json' }, credentials: 'include'
            });
            const dataEntregas = await resEntregas.json();
            const entregas = dataEntregas['hydra:member'] || dataEntregas.member || [];
            
            console.log("Entregas recuperadas:", entregas);

            const entregasMap = {};
            entregas.forEach(e => {
                let tareaId;
                if (typeof e.tarea === 'string') {
                    tareaId = e.tarea.split('/').pop();
                } else if (e.tarea && e.tarea.id) {
                    tareaId = e.tarea.id.toString();
                } else if (e.tarea && e.tarea['@id']) {
                    tareaId = e.tarea['@id'].split('/').pop();
                }
                
                if (tareaId) {
                    entregasMap[tareaId] = e;
                }
            });
            setMisEntregas(entregasMap);
        }

    } catch (err) {
        console.error("Error cargando datos:", err);
        setError("No se pudieron cargar los datos.");
    } finally {
        setLoading(false);
    }
  };

  // --- Lógica Alumno ---

  const handleOpenUploadModal = (tarea) => {
    setCurrentTarea(tarea);
    const entregaExistente = misEntregas[tarea.id];
    
    setUploadFormData({
        comentario: entregaExistente?.comentarioAlumno || '',
        enlace: entregaExistente?.enlace || '',
        archivo: null
    });
    setIsUploadModalOpen(true);
  };

  const handleUploadSubmit = async (e) => {
    e.preventDefault();
    setUploading(true);

    try {
        const data = new FormData();
        data.append('tareaId', currentTarea.id);
        if (uploadFormData.comentario) data.append('comentario', uploadFormData.comentario);
        if (uploadFormData.enlace) data.append('enlace', uploadFormData.enlace);
        if (uploadFormData.archivo) data.append('file', uploadFormData.archivo);

        const response = await fetch('https://localhost:9443/api/entregas/upload', {
            method: 'POST',
            body: data,
            credentials: 'include'
        });

        if (!response.ok) {
            const errorData = await response.json().catch(() => ({}));
            throw new Error(errorData.message || 'Error al subir entrega');
        }

        await fetchData();
        
        setIsUploadModalOpen(false);
    } catch (err) {
        alert(err.message);
    } finally {
        setUploading(false);
    }
  };

  // --- Lógica Profesor ---

  const handleViewEntregas = async (tarea) => {
      setCurrentTarea(tarea);
      setIsViewModalOpen(true);
      setLoadingEntregas(true);
      
      try {
          const tareaId = tarea.id || tarea['@id'].split('/').pop();
          const tareaIri = `/api/tareas/${tareaId}`;
          
          console.log("Cargando entregas para tarea IRI:", tareaIri);

          // Usamos el endpoint de entregas filtrando por tarea (IRI)
          // Esto usa el grupo 'entrega:read' que sabemos que funciona bien
          const response = await fetch(`https://localhost:9443/api/entregas?tarea=${encodeURIComponent(tareaIri)}`, {
              headers: { 'Accept': 'application/ld+json' },
              credentials: 'include'
          });
          
          if (!response.ok) {
              throw new Error(`Error ${response.status}`);
          }

          const data = await response.json();
          const items = data['hydra:member'] || data.member || [];
          console.log("Entregas recibidas:", items);
          setEntregasTarea(items);
      } catch (err) {
          console.error(err);
          alert("Error cargando entregas");
      } finally {
          setLoadingEntregas(false);
      }
  };

  // --- Renderizado ---

  const renderContent = (imparticion) => {
      const tareas = imparticion.tareas || [];
      
      if (tareas.length === 0) return <div className={styles.emptyState}>No hay tareas.</div>;

      return (
          <div className={styles.taskList}>
              {tareas.map(tarea => {
                  const entrega = misEntregas[tarea.id];
                  const estado = entrega ? (entrega.calificacion ? 'Calificado' : 'Entregado') : 'Pendiente';
                  const badgeClass = entrega ? (entrega.calificacion ? styles.badgeGraded : styles.badgeSubmitted) : styles.badgePending;
                  
                  const isLate = !entrega && new Date() > new Date(tarea.fechaLimite);
                  
                  return (
                      <div key={tarea.id} className={styles.taskCard}>
                          <div className={styles.taskInfo}>
                              <div className={styles.taskTitle}>
                                  <FileText size={18} /> {tarea.titulo}
                              </div>
                              <div className={styles.taskMeta}>
                                  <span><Calendar size={14}/> {new Date(tarea.fechaLimite).toLocaleString()}</span>
                                  {isAlumno && (
                                      <span className={`${styles.badge} ${isLate ? styles.badgeLate : badgeClass}`}>
                                          {isLate ? 'Retrasada' : estado}
                                      </span>
                                  )}
                              </div>
                          </div>
                          
                          <div className={styles.taskActions}>
                              {isAlumno && (
                                  <Button size="sm" onClick={() => handleOpenUploadModal(tarea)}>
                                      <Upload size={16} style={{marginRight:'4px'}}/> 
                                      {entrega ? 'Editar Entrega' : 'Entregar'}
                                  </Button>
                              )}
                              
                              {(isProfesor || isAdmin) && (
                                  <Button size="sm" variant="secondary" onClick={() => handleViewEntregas(tarea)}>
                                      <Eye size={16} style={{marginRight:'4px'}}/> Ver Entregas
                                  </Button>
                              )}
                          </div>
                      </div>
                  );
              })}
          </div>
      );
  };

  const entregasColumns = [
      { 
          header: 'Alumno', 
          accessor: (row) => row.alumno ? `${row.alumno.nombre} ${row.alumno.apellidos}` : 'Desconocido',
          sortable: true 
      },
      { 
          header: 'Fecha', 
          accessor: (row) => new Date(row.fechaEntrega).toLocaleString(),
          sortable: true 
      },
      {
          header: 'Archivos/Enlaces',
          accessor: (row) => (
              <div style={{display:'flex', flexDirection:'column', gap:'4px'}}>
                  {row.archivo && (
                      <a href={`https://localhost:9443/uploads/entregas/${row.archivo}`} target="_blank" className={styles.downloadLink}>
                          <Download size={14}/> Archivo
                      </a>
                  )}
                  {row.enlace && (
                      <a href={row.enlace} target="_blank" className={styles.downloadLink}>
                          <FileText size={14}/> Enlace
                      </a>
                  )}
              </div>
          )
      },
      {
          header: 'Comentario',
          accessor: 'comentarioAlumno'
      }
  ];

  return (
    <Layout>
      <div className={styles.container}>
        <div className={styles.header}>
          <h1 className={styles.pageTitle}>Entregas</h1>
        </div>

        {loading ? (
            <div style={{ textAlign: 'center', padding: '2rem' }}>Cargando...</div>
        ) : (
            <AccordionView 
                data={asignaturas}
                renderItem={renderContent}
                canAdd={false}
            />
        )}

        {/* Modal Alumno: Subir Entrega */}
        {isUploadModalOpen && (
            <div className={styles.modalOverlay} onClick={() => setIsUploadModalOpen(false)}>
                <div className={styles.modal} onClick={e => e.stopPropagation()}>
                    <div className={styles.modalHeader}>
                        <h3 className={styles.modalTitle}>Entregar Tarea: {currentTarea?.titulo}</h3>
                        <button className={styles.closeButton} onClick={() => setIsUploadModalOpen(false)}><X size={20}/></button>
                    </div>
                    <form onSubmit={handleUploadSubmit}>
                        <div className={styles.modalBody}>
                            <div className={styles.formGroup}>
                                <label className={styles.label}>Archivo</label>
                                <input 
                                    type="file" 
                                    className={styles.fileInput}
                                    onChange={e => setUploadFormData({...uploadFormData, archivo: e.target.files[0]})}
                                />
                            </div>
                            <div className={styles.formGroup}>
                                <label className={styles.label}>Enlace (Opcional)</label>
                                <input 
                                    type="url" 
                                    className={styles.input}
                                    value={uploadFormData.enlace}
                                    onChange={e => setUploadFormData({...uploadFormData, enlace: e.target.value})}
                                    placeholder="https://..."
                                />
                            </div>
                            <div className={styles.formGroup}>
                                <label className={styles.label}>Comentario</label>
                                <textarea 
                                    className={styles.textarea}
                                    value={uploadFormData.comentario}
                                    onChange={e => setUploadFormData({...uploadFormData, comentario: e.target.value})}
                                />
                            </div>
                        </div>
                        <div className={styles.modalFooter}>
                            <Button type="button" variant="secondary" onClick={() => setIsUploadModalOpen(false)}>Cancelar</Button>
                            <Button type="submit" disabled={uploading}>{uploading ? 'Subiendo...' : 'Entregar'}</Button>
                        </div>
                    </form>
                </div>
            </div>
        )}

        {/* Modal Profesor: Ver Entregas */}
        {isViewModalOpen && (
            <div className={styles.modalOverlay} onClick={() => setIsViewModalOpen(false)}>
                <div className={styles.modal} onClick={e => e.stopPropagation()} style={{maxWidth: '900px'}}>
                    <div className={styles.modalHeader}>
                        <h3 className={styles.modalTitle}>Entregas: {currentTarea?.titulo}</h3>
                        <button className={styles.closeButton} onClick={() => setIsViewModalOpen(false)}><X size={20}/></button>
                    </div>
                    <div className={styles.modalBody}>
                        <DataTable 
                            columns={entregasColumns}
                            data={entregasTarea}
                            loading={loadingEntregas}
                            totalItems={entregasTarea.length}
                            itemsPerPage={100}
                            currentPage={1}
                            onPageChange={() => {}}
                            pageSizeOptions={[100]}
                        />
                    </div>
                </div>
            </div>
        )}
      </div>
    </Layout>
  );
};

export default Entregas;
