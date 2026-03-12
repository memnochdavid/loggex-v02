import React, { useEffect, useState } from 'react';
import styles from './Academic.module.css'; // Usar estilos académicos unificados
import Layout from '../components/Layout';
import AccordionView from '../components/AccordionView';
import Button from '../components/Button';
import DataTable from '../components/DataTable';
import ModalView from '../components/ModalView';
import CrudHeader from '../components/CrudHeader'; // Importar CrudHeader
import { useAuth } from '../context/AuthContext';
import { FileText, Calendar, Upload, Eye, Download, Award, MessageSquare, Paperclip } from 'lucide-react';
import { getApiUrl, getAssetUrl } from '../config/api';
import Lottie from 'lottie-react';
import bookAnimation from '../../public/book.json';
import { useTranslation } from 'react-i18next';

const Entregas = () => {
  const { t } = useTranslation();
  const { user } = useAuth();
  const isProfesor = user?.roles?.includes('ROLE_PROFESOR');
  const isAlumno = user?.roles?.includes('ROLE_ALUMNO');
  const isAdmin = user?.roles?.includes('ROLE_ADMIN');
  const isSuperAdmin = user?.roles?.includes('ROLE_SUPER_ADMIN') || user?.roles?.includes('ROLE_SUPERADMIN');

  const [asignaturas, setAsignaturas] = useState([]);
  const [misEntregas, setMisEntregas] = useState({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Estados para filtros de SuperAdmin
  const [centros, setCentros] = useState([]);
  const [selectedCentro, setSelectedCentro] = useState('');
  const [grupos, setGrupos] = useState([]);
  const [selectedGrupo, setSelectedGrupo] = useState('');
  const [modulos, setModulos] = useState([]); // NUEVO
  const [selectedModulo, setSelectedModulo] = useState(''); // NUEVO

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

  // Cargar centros para SuperAdmin
  useEffect(() => {
      if (isSuperAdmin) {
          fetch(getApiUrl('/api/centros?pagination=false'), {
              headers: { 'Accept': 'application/ld+json' },
              credentials: 'include'
          })
          .then(res => res.json())
          .then(data => {
              const items = data['hydra:member'] || data.member || [];
              setCentros(items);
          })
          .catch(err => console.error("Error cargando centros:", err));
      }
  }, [isSuperAdmin]);

  // Cargar grupos cuando cambia el centro seleccionado
  useEffect(() => {
      if (isSuperAdmin && selectedCentro) {
          fetch(getApiUrl(`/api/grupos?centro=${selectedCentro}&pagination=false`), {
              headers: { 'Accept': 'application/ld+json' },
              credentials: 'include'
          })
          .then(res => res.json())
          .then(data => {
              const items = data['hydra:member'] || data.member || [];
              setGrupos(items);
              setSelectedGrupo(''); // Resetear grupo al cambiar centro
              setModulos([]); // Resetear módulos
              setSelectedModulo('');
          })
          .catch(err => console.error("Error cargando grupos:", err));
      } else {
          setGrupos([]);
          setSelectedGrupo('');
          setModulos([]);
          setSelectedModulo('');
      }
  }, [selectedCentro, isSuperAdmin]);

  // Cargar módulos cuando cambia el grupo seleccionado (NUEVO)
  useEffect(() => {
      if (isSuperAdmin && selectedGrupo) {
          // Obtener imparticiones del grupo para sacar los módulos
          fetch(getApiUrl(`/api/imparticions?grupo=${selectedGrupo}&pagination=false`), {
              headers: { 'Accept': 'application/ld+json' },
              credentials: 'include'
          })
          .then(res => res.json())
          .then(data => {
              const items = data['hydra:member'] || data.member || [];
              // Extraer módulos únicos
              const uniqueModulos = [];
              const map = new Map();
              for (const item of items) {
                  if (item.modulo && !map.has(item.modulo.id)) {
                      map.set(item.modulo.id, true);
                      uniqueModulos.push(item.modulo);
                  }
              }
              setModulos(uniqueModulos);
              setSelectedModulo('');
          })
          .catch(err => console.error("Error cargando módulos:", err));
      } else {
          setModulos([]);
          setSelectedModulo('');
      }
  }, [selectedGrupo, isSuperAdmin]);

  useEffect(() => {
    if (user) {
        fetchData();
    }
  }, [user, selectedCentro, selectedGrupo, selectedModulo]); // Añadidos filtros a dependencias

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
            }
        } else if (isSuperAdmin) {
             // Lógica de filtrado para SuperAdmin
             let query = 'pagination=false';
             if (selectedModulo) {
                 query += `&modulo=${selectedModulo}`;
                 if (selectedGrupo) query += `&grupo=${selectedGrupo}`;
             } else if (selectedGrupo) {
                 query += `&grupo=${selectedGrupo}`;
             } else if (selectedCentro) {
                 query += `&grupo.centro=${selectedCentro}`;
             }
             endpoint = getApiUrl(`/api/imparticions?${query}`);
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
                const nombreModulo = imp.modulo?.nombre || t('common.unknownModule');
                const nombreGrupo = imp.grupo?.nombre || t('common.unknownGroup');
                const nombreProfesor = imp.profesor ? `${imp.profesor.nombre} ${imp.profesor.apellidos}` : '';
                
                let title = `${nombreModulo} - ${nombreGrupo}`;
                if ((isAlumno || isSuperAdmin) && nombreProfesor) {
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
        setError(t('common.errorLoading'));
    } finally {
        setLoading(false);
    }
  };

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
            throw new Error(errorData.message || t('deliveries.errorUpload'));
        }

        await fetchData();
        setIsUploadModalOpen(false);
    } catch (err) {
        alert(err.message);
    } finally {
        setUploading(false);
    }
  };

  const handleViewEntregas = async (tarea) => {
      setCurrentTarea(tarea);
      setIsViewModalOpen(true);
      setLoadingEntregas(true);
      
      try {
          const tareaId = tarea.id || tarea['@id'].split('/').pop();
          const response = await fetch(getApiUrl(`/api/tareas/${tareaId}`), {
              headers: { 'Accept': 'application/ld+json' },
              credentials: 'include'
          });
          
          if (!response.ok) throw new Error(`Error ${response.status}`);

          const data = await response.json();
          const items = data.entregas || [];
          setEntregasTarea(items);
      } catch (err) {
          console.error(err);
          alert(t('deliveries.errorLoadDeliveries'));
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

          if (!response.ok) throw new Error(t('deliveries.errorSaveGrade'));

          const calificacionGuardada = await response.json();

          setEntregasTarea(prevEntregas => prevEntregas.map(ent => {
              if (ent.id === currentEntrega.id) {
                  return {
                      ...ent,
                      calificacion: calificacionGuardada
                  };
              }
              return ent;
          }));

          setIsGradeModalOpen(false);

      } catch (err) {
          alert(err.message);
      } finally {
          setSavingGrade(false);
      }
  };

  const renderContent = (imparticion) => {
      const tareas = imparticion.tareas || [];
      
      if (tareas.length === 0) return <div className={styles.emptyState}>{t('deliveries.noTasks')}</div>;

      return (
          <ul className={styles.list}>
              {tareas.map(tarea => {
                  const entrega = misEntregas[tarea.id];
                  const estado = entrega ? (entrega.calificacion ? t('deliveries.graded') : t('deliveries.delivered')) : t('deliveries.pending');
                  const badgeClass = entrega ? (entrega.calificacion ? styles.badgeInfo : styles.badgeSuccess) : styles.badgePending;
                  
                  // CORRECCIÓN: Calcular isLate correctamente
                  const isLate = new Date() > new Date(tarea.fechaLimite);
                  
                  return (
                      <li key={tarea.id} className={styles.listItem}>
                          <div className={styles.itemInfo}>
                              <FileText size={20} className={styles.icon} />
                              <div style={{ display: 'flex', flexDirection: 'column' }}>
                                  <span style={{ fontWeight: '600' }}>{tarea.titulo}</span>
                                  <div className={styles.cardMeta}>
                                      <span><Calendar size={14}/> {new Date(tarea.fechaLimite).toLocaleString()}</span>
                                      {isAlumno && (
                                          <span className={`${styles.badge} ${isLate && !entrega ? styles.badgeError : badgeClass}`} style={{ marginLeft: '8px' }}>
                                              {isLate && !entrega ? t('deliveries.delayed') : estado}
                                          </span>
                                      )}
                                  </div>
                                  
                                  {isAlumno && entrega && entrega.calificacion && (
                                      <div className={styles.feedbackContainer} style={{ marginTop: '0.5rem' }}>
                                          <div className={styles.feedbackHeader}>
                                              <Award size={16} /> {t('deliveries.grade', { grade: entrega.calificacion.nota })}
                                          </div>
                                          {entrega.calificacion.feedbackProfesor && (
                                              <div className={styles.feedbackText}>
                                                  <MessageSquare size={16} style={{flexShrink: 0, marginTop: '2px', display: 'inline', marginRight: '8px'}} />
                                                  <span>{entrega.calificacion.feedbackProfesor}</span>
                                              </div>
                                          )}
                                      </div>
                                  )}
                              </div>
                          </div>
                          
                          <div className={styles.itemActions}>
                              {/* CORRECCIÓN: Ocultar botón si es tarde */}
                              {isAlumno && !isLate && (
                                  <Button size="sm" onClick={() => handleOpenUploadModal(tarea)}>
                                      <Upload size={16} style={{marginRight:'4px'}}/> 
                                      {entrega ? t('common.edit') : t('deliveries.deliver')}
                                  </Button>
                              )}
                              
                              {(isProfesor || isAdmin || isSuperAdmin) && (
                                  <Button size="sm" variant="secondary" onClick={() => handleViewEntregas(tarea)}>
                                      <Eye size={16} style={{marginRight:'4px'}}/> {t('deliveries.viewDeliveries')}
                                  </Button>
                              )}
                          </div>
                      </li>
                  );
              })}
          </ul>
      );
  };

  const entregasColumns = [
      { 
          header: t('deliveries.studentCol'), 
          accessor: (row) => row.alumno ? `${row.alumno.nombre} ${row.alumno.apellidos}` : t('common.unknown'),
          sortable: true 
      },
      { 
          header: t('deliveries.dateCol'), 
          accessor: (row) => new Date(row.fechaEntrega).toLocaleString(),
          sortable: true 
      },
      {
          header: t('deliveries.filesCol'),
          accessor: (row) => (
              <div style={{display:'flex', flexDirection:'column', gap:'4px'}}>
                  {row.archivo && (
                      <a href={getAssetUrl(`/uploads/entregas/${row.archivo}`)} target="_blank" className={styles.fileLink}>
                          <Download size={14}/> {t('deliveries.file')}
                      </a>
                  )}
                  {row.enlace && (
                      <a href={row.enlace} target="_blank" className={styles.fileLink}>
                          <FileText size={14}/> {t('deliveries.link')}
                      </a>
                  )}
              </div>
          )
      },
      {
          header: t('deliveries.commentCol'),
          accessor: 'comentarioAlumno'
      },
      {
          header: t('deliveries.gradeCol'),
          accessor: (row) => (
              <div style={{display:'flex', alignItems:'center', gap:'8px'}}>
                  {row.calificacion ? (
                      <span className={`${styles.badge} ${styles.badgeInfo}`}>
                          {row.calificacion.nota}
                      </span>
                  ) : (
                      <span className={`${styles.badge} ${styles.badgePending}`}>{t('common.pending')}</span>
                  )}
                  <button
                      type={"button"}
                      className={styles.iconButton} 
                      onClick={(e) => {
                          e.stopPropagation();
                          handleOpenGradeModal(row);
                      }}
                      title={t('deliveries.gradeCol')}
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
        <CrudHeader title={t('deliveries.title')}
                    logo={<Lottie animationData={bookAnimation} loop={true} style={{ width: 60, height: 60 }} />}
        >
            {isSuperAdmin && (
                <div style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
                    <select 
                        className={styles.select} // Usar clase de Academic.module.css
                        value={selectedCentro}
                        onChange={(e) => setSelectedCentro(e.target.value)}
                        style={{ minWidth: '200px' }}
                    >
                        <option value="">{t('common.allCenters')}</option>
                        {centros.map(c => (
                            <option key={c.id} value={c.id}>{c.nombre}</option>
                        ))}
                    </select>

                    <select 
                        className={styles.select}
                        value={selectedGrupo}
                        onChange={(e) => setSelectedGrupo(e.target.value)}
                        disabled={!selectedCentro}
                        style={{ minWidth: '150px' }}
                    >
                        <option value="">{t('common.allGroups')}</option>
                        {grupos.map(g => (
                            <option key={g.id} value={g.id}>{g.nombre}</option>
                        ))}
                    </select>

                    <select 
                        className={styles.select}
                        value={selectedModulo}
                        onChange={(e) => setSelectedModulo(e.target.value)}
                        disabled={!selectedGrupo}
                        style={{ minWidth: '150px' }}
                    >
                        <option value="">{t('common.allModules')}</option>
                        {modulos.map(m => (
                            <option key={m.id} value={m.id}>{m.nombre}</option>
                        ))}
                    </select>
                </div>
            )}
        </CrudHeader>

        {loading ? (
            <div className={styles.loadingContainer}>{t('common.loading')}</div>
        ) : error ? (
            <div className={styles.errorContainer}>{error}</div>
        ) : asignaturas.length === 0 ? (
            <div className={styles.emptyState}>
                {isSuperAdmin && !selectedCentro 
                    ? t('deliveries.selectCenter')
                    : t('deliveries.noSubjects')}
            </div>
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
            title={t('deliveries.deliverTitle', { title: currentTarea?.titulo })}
            onSubmit={handleUploadSubmit}
            isSubmitting={uploading}
            submitText={t('deliveries.deliver')}
        >
            {/*mejor no subir archivos*/}
            {/*<div className={styles.formGroup}>*/}
            {/*    <label className={styles.label}>Archivo</label>*/}
            {/*    <input */}
            {/*        type="file" */}
            {/*        className={styles.fileInput}*/}
            {/*        onChange={e => setUploadFormData({...uploadFormData, archivo: e.target.files[0]})}*/}
            {/*    />*/}
            {/*</div>*/}
            <div className={styles.formGroup}>
                <label className={styles.label}>{t('deliveries.linkLabel')}</label>
                <input 
                    type="url" 
                    className={styles.input}
                    value={uploadFormData.enlace}
                    onChange={e => setUploadFormData({...uploadFormData, enlace: e.target.value})}
                    placeholder={t('deliveries.linkPlaceholder')}
                />
            </div>
            <div className={styles.formGroup}>
                <label className={styles.label}>{t('deliveries.commentLabel')}</label>
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
            title={t('deliveries.deliveriesTitle', { title: currentTarea?.titulo })}
            size="large"
            footer={<Button type="button" variant="secondary" onClick={() => setIsViewModalOpen(false)}>{t('common.close')}</Button>}
        >
            <DataTable 
                columns={entregasColumns}
                data={entregasTarea}
                loading={loadingEntregas}
                totalItems={entregasTarea.length}
                itemsPerPage={5}
                currentPage={1}
                onPageChange={() => {}}
                pageSizeOptions={[5, 10, 20, 50, 100]}
            />
        </ModalView>

        {/* Modal Calificar */}
        <ModalView
            isOpen={isGradeModalOpen}
            onClose={() => setIsGradeModalOpen(false)}
            title={t('deliveries.gradeTitle')}
            onSubmit={handleSaveGrade}
            isSubmitting={savingGrade}
            submitText={t('deliveries.saveGrade')}
            size="small"
        >
            <div className={styles.formGroup}>
                <label className={styles.label}>{t('deliveries.gradeLabel')}</label>
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
                <label className={styles.label}>{t('deliveries.feedbackLabel')}</label>
                <textarea 
                    className={styles.textarea}
                    value={gradeFormData.feedback}
                    onChange={e => setGradeFormData({...gradeFormData, feedback: e.target.value})}
                    placeholder={t('deliveries.feedbackPlaceholder')}
                />
            </div>
        </ModalView>
      </div>
    </Layout>
  );
};

export default Entregas;
