import React, { useEffect, useState } from 'react';
import styles from './Entregas.module.css';
import Layout from '../components/Layout';
import AccordionView from '../components/AccordionView';
import Button from '../components/Button';
import DataTable from '../components/DataTable';
import ModalView from '../components/ModalView'; // Importar ModalView
import { useAuth } from '../context/AuthContext';
import { FileText, Calendar, Upload, Eye, Download, Award, MessageSquare } from 'lucide-react';
import { getApiUrl, getAssetUrl } from '../config/api';

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

  // Estado Modal Calificar
  const [isGradeModalOpen, setIsGradeModalOpen] = useState(false);
  const [currentEntrega, setCurrentEntrega] = useState(null);
  const [gradeFormData, setGradeFormData] = useState({
    nota: '',
    feedback: ''
  });
  const [savingGrade, setSavingGrade] = useState(false);

  useEffect(() => {
    if (user) {
        fetchData();
    }
  }, [user]);

  const fetchData = async () => {
    setLoading(true);
    try {
        // 1. Cargar Asignaturas y Tareas
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
            }
        } else if (isAdmin) {
             endpoint = getApiUrl(`/api/imparticions?pagination=false`);
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

        // 2. Si es alumno, cargar sus entregas
        if (isAlumno) {
            const resEntregas = await fetch(getApiUrl(`/api/entregas?alumno=${user.id}&pagination=false`), {
                headers: { 'Accept': 'application/ld+json' }, credentials: 'include'
            });
            const dataEntregas = await resEntregas.json();
            const entregas = dataEntregas['hydra:member'] || dataEntregas.member || [];
            
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

        const response = await fetch(getApiUrl('/api/entregas/upload'), {
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
          console.log("Cargando tarea completa para ver entregas. ID:", tareaId);

          // REVERTIDO: Pedir la tarea completa, que incluye 'entregas' gracias al grupo tarea:read
          const response = await fetch(getApiUrl(`/api/tareas/${tareaId}`), {
              headers: { 'Accept': 'application/ld+json' },
              credentials: 'include'
          });
          
          if (!response.ok) {
              throw new Error(`Error ${response.status}`);
          }

          const data = await response.json();
          const items = data.entregas || []; // Las entregas vienen dentro de la tarea
          console.log("Entregas recibidas (desde tarea):", items);
          setEntregasTarea(items);
      } catch (err) {
          console.error(err);
          alert("Error cargando entregas");
      } finally {
          setLoadingEntregas(false);
      }
  };

  const handleOpenGradeModal = (entrega) => {
      setCurrentEntrega(entrega);
      setGradeFormData({
          nota: entrega.calificacion ? entrega.calificacion.nota : '',
          feedback: entrega.calificacion ? entrega.calificacion.feedbackProfesor : ''
      });
      setIsGradeModalOpen(true);
  };

  const handleSaveGrade = async (e) => {
      e.preventDefault();
      setSavingGrade(true);

      try {
          const method = currentEntrega.calificacion ? 'PUT' : 'POST';
          const url = currentEntrega.calificacion 
            ? getApiUrl(`/api/calificacions/${currentEntrega.calificacion.id}`)
            : getApiUrl('/api/calificacions');

          const payload = {
              nota: parseFloat(gradeFormData.nota),
              feedbackProfesor: gradeFormData.feedback,
              entrega: `/api/entregas/${currentEntrega.id}`
          };

          const response = await fetch(url, {
              method: method,
              headers: {
                  'Content-Type': 'application/ld+json',
                  'Accept': 'application/ld+json'
              },
              body: JSON.stringify(payload),
              credentials: 'include'
          });

          if (!response.ok) throw new Error('Error al guardar calificación');

          await handleViewEntregas(currentTarea);
          setIsGradeModalOpen(false);

      } catch (err) {
          alert(err.message);
      } finally {
          setSavingGrade(false);
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
                              
                              {/* Mostrar Nota y Feedback para el Alumno */}
                              {isAlumno && entrega && entrega.calificacion && (
                                  <div style={{marginTop: '0.5rem', padding: '0.5rem', backgroundColor: '#f0f9ff', borderRadius: '6px', border: '1px solid #bae6fd'}}>
                                      <div style={{display: 'flex', alignItems: 'center', gap: '8px', fontWeight: 'bold', color: '#0369a1'}}>
                                          <Award size={16} /> Nota: {entrega.calificacion.nota}
                                      </div>
                                      {entrega.calificacion.feedbackProfesor && (
                                          <div style={{marginTop: '4px', fontSize: '0.9rem', color: '#0c4a6e', display: 'flex', gap: '8px'}}>
                                              <MessageSquare size={16} style={{flexShrink: 0, marginTop: '2px'}} />
                                              <span>{entrega.calificacion.feedbackProfesor}</span>
                                          </div>
                                      )}
                                  </div>
                              )}
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
                      <a href={getAssetUrl(`/uploads/entregas/${row.archivo}`)} target="_blank" className={styles.downloadLink}>
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
      },
      {
          header: 'Calificación',
          accessor: (row) => (
              <div style={{display:'flex', alignItems:'center', gap:'8px'}}>
                  {row.calificacion ? (
                      <span className={styles.badge} style={{backgroundColor: '#dbeafe', color: '#1e40af'}}>
                          {row.calificacion.nota}
                      </span>
                  ) : (
                      <span style={{color: 'var(--text-muted)', fontSize: '0.8rem'}}>Pendiente</span>
                  )}
                  <button 
                      className={styles.iconButton} 
                      onClick={() => handleOpenGradeModal(row)}
                      title="Calificar"
                  >
                      <Award size={18} />
                  </button>
              </div>
          )
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
        <ModalView
            isOpen={isUploadModalOpen}
            onClose={() => setIsUploadModalOpen(false)}
            title={`Entregar Tarea: ${currentTarea?.titulo}`}
            onSubmit={handleUploadSubmit}
            isSubmitting={uploading}
            submitText="Entregar"
        >
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
        </ModalView>

        {/* Modal Profesor: Ver Entregas */}
        <ModalView
            isOpen={isViewModalOpen}
            onClose={() => setIsViewModalOpen(false)}
            title={`Entregas: ${currentTarea?.titulo}`}
            size="large"
            footer={<Button type="button" variant="secondary" onClick={() => setIsViewModalOpen(false)}>Cerrar</Button>}
        >
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
        </ModalView>

        {/* Modal Calificar */}
        <ModalView
            isOpen={isGradeModalOpen}
            onClose={() => setIsGradeModalOpen(false)}
            title="Calificar Entrega"
            onSubmit={handleSaveGrade}
            isSubmitting={savingGrade}
            submitText="Guardar Calificación"
            size="small"
        >
            <div className={styles.formGroup}>
                <label className={styles.label}>Nota (0-10)</label>
                <input 
                    type="number" 
                    className={styles.input}
                    value={gradeFormData.nota}
                    onChange={e => setGradeFormData({...gradeFormData, nota: e.target.value})}
                    min="0" max="10" step="0.1"
                    required
                />
            </div>
            <div className={styles.formGroup}>
                <label className={styles.label}>Feedback</label>
                <textarea 
                    className={styles.textarea}
                    value={gradeFormData.feedback}
                    onChange={e => setGradeFormData({...gradeFormData, feedback: e.target.value})}
                    placeholder="Comentarios para el alumno..."
                />
            </div>
        </ModalView>
      </div>
    </Layout>
  );
};

export default Entregas;
