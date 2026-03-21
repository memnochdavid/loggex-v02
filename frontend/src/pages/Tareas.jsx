import React, { useEffect, useState, useRef } from 'react';
import styles from './Academic.module.css'; // Usar estilos académicos unificados
import Layout from '../components/Layout';
import AccordionView from '../components/AccordionView';
import Button from '../components/Button';
import ModalView from '../components/ModalView';
import CrudHeader from '../components/CrudHeader';
import { useAuth } from '../context/AuthContext';
import { Plus, Edit2, Trash2, FileText, Calendar, Eye, Download, Upload, Filter } from 'lucide-react';
import { getApiUrl, getAssetUrl } from '../config/api';
import Lottie from 'lottie-react';
import bookAnimation from '../../public/book.json';
import { useTranslation } from 'react-i18next';
import LoadingView from '../components/LoadingView';
import { useToast } from '../context/ToastContext';
import ConfirmDialog from '../components/ConfirmDialog';
import useConfirm from '../hooks/useConfirm';

const Tareas = () => {
  const { t } = useTranslation();
  const { user } = useAuth();
  const { toast } = useToast();
  const { isOpen: confirmOpen, message: confirmMessage, confirm, handleConfirm, handleCancel } = useConfirm();
  const isProfesor = user?.roles?.includes('ROLE_PROFESOR');
  const isAlumno = user?.roles?.includes('ROLE_ALUMNO');
  const isAdmin = user?.roles?.includes('ROLE_ADMIN');
  const isSuperAdmin = user?.roles?.includes('ROLE_SUPER_ADMIN') || user?.roles?.includes('ROLE_SUPERADMIN');
  const fileInputRef = useRef(null);

  const [asignaturas, setAsignaturas] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [expandedId, setExpandedId] = useState(null);

  // Estados para filtros de SuperAdmin
  const [centros, setCentros] = useState([]);
  const [selectedCentro, setSelectedCentro] = useState('');
  const [grupos, setGrupos] = useState([]);
  const [selectedGrupo, setSelectedGrupo] = useState('');
  const [modulos, setModulos] = useState([]); // NUEVO
  const [selectedModulo, setSelectedModulo] = useState(''); // NUEVO

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
            } else {
                setAsignaturas([]);
                setLoading(false);
                return;
            }
        } else if (isSuperAdmin) {
             // Lógica de filtrado para SuperAdmin
             let query = 'pagination=false';
             if (selectedModulo) {
                 query += `&modulo=${selectedModulo}`;
                 // Si hay módulo, implícitamente hay grupo, pero añadimos grupo para asegurar contexto si es necesario
                 if (selectedGrupo) query += `&grupo=${selectedGrupo}`;
             } else if (selectedGrupo) {
                 query += `&grupo=${selectedGrupo}`;
             } else if (selectedCentro) {
                 query += `&grupo.centro=${selectedCentro}`;
             }
             // Si no hay centro seleccionado, trae todo (o podrías decidir no traer nada)
             endpoint = getApiUrl(`/api/imparticions?${query}`);
        } else if (isAdmin) {
             // Admin de centro ve todo lo de su centro (gestionado por CurrentUserExtension en backend idealmente, 
             // o filtrado aquí si el backend devuelve todo)
             // Asumimos que el backend filtra por el usuario logueado si es admin de centro
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
                const nombreModulo = imp.modulo?.nombre || t('common.unknownModule');
                const nombreGrupo = imp.grupo?.abreviatura || imp.grupo?.nombre || t('common.unknownGroup');
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

    } catch (err) {
        console.error("Error cargando tareas:", err);
        setError(t('tasks.errorLoading'));
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
        throw new Error(errorData.message || t('common.errorSaving', { message: 'Error desconocido' }));
      }

      await fetchData();
      handleCloseModal();
      toast.success(t('common.savedSuccessfully'));

    } catch (err) {
      console.error(err);
      toast.error(t('common.errorSaving', { message: err.message }));
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (tareaId) => {
    if (!(await confirm(t('tasks.confirmDelete')))) return;

    try {
        const response = await fetch(getApiUrl(`/api/tareas/${tareaId}`), {
            method: 'DELETE',
            credentials: 'include'
        });
        if (!response.ok) throw new Error(t('tasks.errorDelete'));
        toast.success(t('common.deletedSuccessfully'));
        fetchData();
    } catch (err) {
        toast.error(err.message);
    }
  };

  const handleToggle = (id) => {
      setExpandedId(prevId => (prevId === id ? null : id));
  };

  const renderContent = (imparticion) => {
      const tareas = imparticion.tareas || [];
      
      if (tareas.length === 0) {
          return <div className={styles.emptyState}>{t('tasks.noTasks')}</div>;
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
                                  {t('tasks.delivery')} {new Date(tarea.fechaLimite).toLocaleString()} • {tarea.tipo}
                                  {!tarea.visible && <span className={`${styles.badge} ${styles.badgeError}`} style={{ marginLeft: '8px' }}>{t('tasks.hidden')}</span>}
                              </span>
                          </div>
                      </div>
                      
                      <div className={styles.itemActions}>
                          {tarea.archivo && (
                              <>
                                  <a
                                      href={getAssetUrl(`/uploads/tareas/${tarea.archivo}`)}
                                      target="_blank"
                                      rel="noopener noreferrer"
                                      className={styles.downloadLink}
                                      title={t('common.view')}
                                  >
                                      <Eye size={18} />
                                  </a>
                                  <a
                                      href={getAssetUrl(`/uploads/tareas/${tarea.archivo}`)}
                                      className={styles.downloadLink}
                                      download
                                      title={t('common.download')}
                                  >
                                      <Download size={18} />
                                  </a>
                              </>
                          )}
                          
                          {(isProfesor || isAdmin || isSuperAdmin) && (
                              <>
                                  <button className={styles.iconButton} onClick={() => handleOpenModal(imparticion.id, tarea)} title={t('common.edit')}>
                                      <Edit2 size={18} />
                                  </button>
                                  <button className={`${styles.iconButton} ${styles.danger}`} onClick={() => handleDelete(tarea.id)} title={t('common.delete')}>
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
        <CrudHeader title={t('tasks.title')}
                    logo={<Lottie animationData={bookAnimation} loop={true} style={{ width: 60, height: 60 }} />}
        >
            {isSuperAdmin && (
                <div style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
                    <select 
                        className={styles.select}
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
            <LoadingView text={t('tasks.loadingSubjects')} />
        ) : error ? (
            <div className={styles.errorContainer}>{error}</div>
        ) : asignaturas.length === 0 ? (
            <div className={styles.emptyState}>
                {isSuperAdmin && !selectedCentro 
                    ? t('tasks.selectCenter')
                    : t('tasks.noSubjects')}
            </div>
        ) : (
            <AccordionView 
                data={asignaturas}
                renderItem={renderContent}
                canAdd={isProfesor || isAdmin || isSuperAdmin}
                onAdd={(id) => handleOpenModal(id)}
                expandedId={expandedId}
                onToggle={handleToggle}
            />
        )}

        <ModalView
            isOpen={isModalOpen}
            onClose={handleCloseModal}
            title={currentTarea ? t('tasks.editTitle') : t('tasks.newTitle')}
            onSubmit={handleSubmit}
            isSubmitting={saving}
        >
            <div className={styles.formGroup}>
                <label className={styles.label}>{t('tasks.titleLabel')}</label>
                <input 
                    className={styles.input} 
                    name="titulo" 
                    value={formData.titulo} 
                    onChange={handleInputChange} 
                    required 
                />
            </div>
            <div className={styles.formGroup}>
                <label className={styles.label}>{t('tasks.descriptionLabel')}</label>
                <textarea 
                    className={styles.textarea} 
                    name="descripcion" 
                    value={formData.descripcion} 
                    onChange={handleInputChange} 
                />
            </div>
            <div className={styles.formGroup}>
                <label className={styles.label}>{t('tasks.attachmentLabel')}</label>
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
                        {formData.archivo ? t('common.changeFile') : t('common.selectFile')}
                    </Button>
                    {formData.archivo && (
                        <span style={{ fontSize: '0.9rem', color: 'var(--text-main)' }}>
                            {formData.archivo.name}
                        </span>
                    )}
                </div>
                {currentTarea && currentTarea.archivo && !formData.archivo && (
                    <small style={{color: 'var(--text-muted)', display: 'block', marginTop: '4px'}}>
                        {t('common.currentFile')}: {currentTarea.archivo}
                    </small>
                )}
            </div>
            <div className={styles.formGroup}>
                <label className={styles.label}>{t('tasks.dueDate')}</label>
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
                <label className={styles.label}>{t('tasks.typeLabel')}</label>
                <select 
                    className={styles.select} 
                    name="tipo" 
                    value={formData.tipo} 
                    onChange={handleInputChange}
                >
                    <option value="tarea">{t('tasks.typeTask')}</option>
                    <option value="examen">{t('tasks.typeExam')}</option>
                    <option value="practica">{t('tasks.typePractice')}</option>
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
                    {t('tasks.visibleToStudents')}
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

export default Tareas;
