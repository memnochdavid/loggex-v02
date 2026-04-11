import React, { useState, useRef, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import styles from './Academic.module.css';
import Layout from '../components/Layout';
import AccordionView from '../components/AccordionView';
import Button from '../components/Button';
import ModalView from '../components/ModalView';
import CrudHeader from '../components/CrudHeader';
import SuperAdminFilters from '../components/SuperAdminFilters';
import useImparticiones from '../hooks/useImparticiones';
import { Plus, Edit2, Trash2, FileText, Paperclip, Upload, Eye } from 'lucide-react';
import { getApiUrl, getAssetUrl } from '../config/api';
import Lottie from 'lottie-react';
import bookAnimation from '../../public/book.json';
import { useTranslation } from 'react-i18next';
import LoadingView from '../components/LoadingView';

const Tareas = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const fileInputRef = useRef(null);

  const {
    asignaturas, loading, error, fetchData,
    isProfesor, isAlumno, isAdmin, isSuperAdmin,
    filters,
  } = useImparticiones();

  const [expandedId, setExpandedId] = useState(null);
  const [activeTab, setActiveTab] = useState('todos');

  const tabs = [
    { key: 'todos', label: t('grades.filterAll') },
    { key: 'examen', label: t('grades.exam') },
    { key: 'tarea', label: t('grades.task') },
    { key: 'practica', label: t('grades.practice') },
  ];

  // Contadores globales por tipo
  const globalCounts = useMemo(() => {
    const c = { todos: 0, examen: 0, tarea: 0, practica: 0 };
    asignaturas.forEach(a => (a.tareas || []).forEach(t => { c.todos++; if (c[t.tipo] !== undefined) c[t.tipo]++; }));
    return c;
  }, [asignaturas]);

  // Modal de creación/edición
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [currentTarea, setCurrentTarea] = useState(null);
  const [selectedImparticionId, setSelectedImparticionId] = useState(null);
  const [formData, setFormData] = useState({
    titulo: '', descripcion: '', fechaLimite: '',
    tipo: 'tarea', visible: true, archivo: null
  });
  const [saving, setSaving] = useState(false);

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
      setFormData({ titulo: '', descripcion: '', fechaLimite: '', tipo: 'tarea', visible: true, archivo: null });
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
      setFormData(prev => ({ ...prev, [name]: type === 'checkbox' ? checked : value }));
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
      if (currentTarea) data.append('id', currentTarea.id);
      if (formData.archivo) data.append('file', formData.archivo);

      const response = await fetch(getApiUrl('/api/tareas/upload'), {
        method: 'POST', body: data, credentials: 'include'
      });
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.message || t('common.errorSaving', { message: 'Error desconocido' }));
      }
      await fetchData();
      handleCloseModal();
    } catch (err) {
      console.error(err);
      alert(t('common.errorSaving', { message: err.message }));
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (tareaId) => {
    if (!window.confirm(t('tasks.confirmDelete'))) return;
    try {
      const response = await fetch(getApiUrl(`/api/tareas/${tareaId}`), {
        method: 'DELETE', credentials: 'include'
      });
      if (!response.ok) throw new Error(t('tasks.errorDelete'));
      fetchData();
    } catch (err) {
      alert(err.message);
    }
  };

  const renderContent = (imparticion) => {
    const allTareas = imparticion.tareas || [];
    const tareas = activeTab === 'todos' ? allTareas : allTareas.filter(t => t.tipo === activeTab);
    if (allTareas.length === 0) return <div className={styles.emptyState}>{t('tasks.noTasks')}</div>;
    if (tareas.length === 0) return <div className={styles.emptyState}>{t('grades.noTasksType')}</div>;

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
                <a
                  href={getAssetUrl(`/uploads/tareas/${tarea.archivo}`)}
                  target="_blank" rel="noopener noreferrer"
                  className={styles.downloadLink}
                  title={t('tasks.downloadAttachment')}
                >
                  <Paperclip size={18} />
                </a>
              )}
              {/* Enlace cruzado a Entregas */}
              {(isProfesor || isAdmin || isSuperAdmin) && (
                <button
                  className={styles.iconButton}
                  onClick={() => navigate('/entregas')}
                  title={t('tasks.viewDeliveries')}
                >
                  <Eye size={18} />
                </button>
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
        <CrudHeader
          title={t('tasks.title')}
          logo={<Lottie animationData={bookAnimation} loop={true} style={{ width: 60, height: 60 }} />}
        >
          {isSuperAdmin && <SuperAdminFilters filters={filters} selectClassName={styles.select} />}
        </CrudHeader>

        {loading ? (
          <LoadingView text={t('tasks.loadingSubjects')} />
        ) : error ? (
          <div className={styles.errorContainer}>{error}</div>
        ) : asignaturas.length === 0 ? (
          <div className={styles.emptyState}>
            {isSuperAdmin && !filters.selectedCentro ? t('tasks.selectCenter') : t('tasks.noSubjects')}
          </div>
        ) : (
          <>
          <div className={styles.tabBar}>
            {tabs.map(tab => (
              <button
                key={tab.key}
                className={`${styles.tab} ${activeTab === tab.key ? styles.tabActive : ''}`}
                onClick={() => setActiveTab(tab.key)}
              >
                {tab.label}
                <span className={styles.tabCount}>{globalCounts[tab.key]}</span>
              </button>
            ))}
          </div>
          <AccordionView
            data={asignaturas}
            renderItem={renderContent}
            canAdd={isProfesor || isAdmin || isSuperAdmin}
            onAdd={(id) => handleOpenModal(id)}
            expandedId={expandedId}
            onToggle={(id) => setExpandedId(prev => prev === id ? null : id)}
          />
          </>
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
            <input className={styles.input} name="titulo" value={formData.titulo} onChange={handleInputChange} required />
          </div>
          <div className={styles.formGroup}>
            <label className={styles.label}>{t('tasks.descriptionLabel')}</label>
            <textarea className={styles.textarea} name="descripcion" value={formData.descripcion} onChange={handleInputChange} />
          </div>
          <div className={styles.formGroup}>
            <label className={styles.label}>{t('tasks.attachmentLabel')}</label>
            <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
              <input type="file" ref={fileInputRef} className={styles.fileInput} name="archivo" onChange={handleInputChange} style={{ display: 'none' }} />
              <Button type="button" variant="secondary" onClick={() => fileInputRef.current.click()}>
                <Upload size={16} style={{ marginRight: '8px' }} />
                {formData.archivo ? t('common.changeFile') : t('common.selectFile')}
              </Button>
              {formData.archivo && <span style={{ fontSize: '0.9rem', color: 'var(--text-main)' }}>{formData.archivo.name}</span>}
            </div>
            {currentTarea && currentTarea.archivo && !formData.archivo && (
              <small style={{ color: 'var(--text-muted)', display: 'block', marginTop: '4px' }}>
                {t('common.currentFile')}: {currentTarea.archivo}
              </small>
            )}
          </div>
          <div className={styles.formGroup}>
            <label className={styles.label}>{t('tasks.dueDate')}</label>
            <input type="datetime-local" className={styles.input} name="fechaLimite" value={formData.fechaLimite} onChange={handleInputChange} required />
          </div>
          <div className={styles.formGroup}>
            <label className={styles.label}>{t('tasks.typeLabel')}</label>
            <select className={styles.select} name="tipo" value={formData.tipo} onChange={handleInputChange}>
              <option value="tarea">{t('tasks.typeTask')}</option>
              <option value="examen">{t('tasks.typeExam')}</option>
              <option value="practica">{t('tasks.typePractice')}</option>
            </select>
          </div>
          <div className={styles.formGroup}>
            <label style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <input type="checkbox" name="visible" checked={formData.visible} onChange={handleInputChange} />
              {t('tasks.visibleToStudents')}
            </label>
          </div>
        </ModalView>
      </div>
    </Layout>
  );
};

export default Tareas;
