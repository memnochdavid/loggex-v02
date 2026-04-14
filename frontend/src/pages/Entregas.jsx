import React, { useEffect, useState, useMemo, useRef } from 'react';
import { useSearchParams } from 'react-router-dom';
import styles from './Academic.module.css';
import Layout from '../components/Layout';
import AccordionView from '../components/AccordionView';
import Button from '../components/Button';
import DataTable from '../components/DataTable';
import ModalView from '../components/ModalView';
import CrudHeader from '../components/CrudHeader';
import SuperAdminFilters from '../components/SuperAdminFilters';
import { useAuth } from '../context/AuthContext';
import useImparticiones from '../hooks/useImparticiones';
import { FileText, Calendar, Upload, Eye, Download, Award, MessageSquare, Edit2, Trash2, Paperclip } from 'lucide-react';
import { getApiUrl, getAssetUrl } from '../config/api';
import Lottie from 'lottie-react';
import bookAnimation from '../../public/book.json';
import { useTranslation } from 'react-i18next';
import LoadingView from '../components/LoadingView';

const Entregas = () => {
  const { t } = useTranslation();
  const { user } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  const tareaFileInputRef = useRef(null);

  const {
    asignaturas, loading, error, fetchData,
    isProfesor, isAlumno, isAdmin, isSuperAdmin,
    filters,
  } = useImparticiones();

  const [misEntregas, setMisEntregas] = useState({});
  const [expandedId, setExpandedId] = useState(null);
  const [activeTab, setActiveTab] = useState('todos');
  const [periodos, setPeriodos] = useState([]);
  const [selectedPeriodo, setSelectedPeriodo] = useState('');

  const tabs = [
    { key: 'todos', label: t('grades.filterAll') },
    { key: 'examen', label: t('grades.exam') },
    { key: 'tarea', label: t('grades.task') },
    { key: 'practica', label: t('grades.practice') },
  ];

  // Cargar períodos evaluativos de todos los grupos implicados
  useEffect(() => {
    if (!asignaturas || asignaturas.length === 0) { setPeriodos([]); return; }
    const grupoIds = [...new Set(asignaturas.map(a => {
      const g = a.grupo;
      if (!g) return null;
      if (typeof g === 'string') return g.split('/').pop();
      return g.id || g['@id']?.split('/').pop();
    }).filter(Boolean))];
    if (grupoIds.length === 0) { setPeriodos([]); return; }

    const fetchAll = async () => {
      try {
        const results = await Promise.all(grupoIds.map(gid =>
          fetch(getApiUrl(`/api/periodo_evaluativos?grupo=${gid}&order[fechaInicio]=asc`), {
            headers: { 'Accept': 'application/ld+json' }, credentials: 'include'
          }).then(r => r.ok ? r.json() : null)
        ));
        // Deduplicar por nombre+tipo (distintos grupos generan registros distintos con el mismo nombre)
        const byKey = new Map();
        results.forEach(r => {
          if (!r) return;
          const items = r['hydra:member'] || r.member || [];
          items.forEach(p => {
            const key = `${p.tipo || ''}::${p.nombre || ''}`;
            if (!byKey.has(key)) {
              byKey.set(key, { key, nombre: p.nombre, tipo: p.tipo, rangos: [] });
            }
            byKey.get(key).rangos.push({ fechaInicio: p.fechaInicio, fechaFin: p.fechaFin });
          });
        });
        const merged = Array.from(byKey.values()).sort((a, b) => {
          const aExtra = a.tipo === 'EXTRAORDINARIA' ? 1 : 0;
          const bExtra = b.tipo === 'EXTRAORDINARIA' ? 1 : 0;
          if (aExtra !== bExtra) return aExtra - bExtra;
          const aMin = a.rangos.map(r => r.fechaInicio).sort()[0] || '';
          const bMin = b.rangos.map(r => r.fechaInicio).sort()[0] || '';
          return aMin.localeCompare(bMin);
        });
        setPeriodos(merged);
      } catch { /* no crítico */ }
    };
    fetchAll();
  }, [asignaturas]);

  // Filtro de tareas por periodo (por fechaLimite). Un periodo puede venir de varios grupos → varios rangos.
  const periodoRanges = useMemo(() => {
    if (!selectedPeriodo) return null;
    const p = periodos.find(pp => pp.key === selectedPeriodo);
    if (!p) return null;
    return p.rangos.map(r => {
      const ini = new Date(r.fechaInicio);
      const fin = new Date(r.fechaFin);
      fin.setHours(23, 59, 59, 999);
      return { ini, fin };
    });
  }, [selectedPeriodo, periodos]);

  const enPeriodo = (tarea) => {
    if (!periodoRanges) return true;
    if (!tarea.fechaLimite) return false;
    const d = new Date(tarea.fechaLimite);
    return periodoRanges.some(r => d >= r.ini && d <= r.fin);
  };

  const globalCounts = useMemo(() => {
    const c = { todos: 0, examen: 0, tarea: 0, practica: 0 };
    asignaturas.forEach(a => (a.tareas || []).filter(enPeriodo).forEach(t => { c.todos++; if (c[t.tipo] !== undefined) c[t.tipo]++; }));
    return c;
  }, [asignaturas, periodoRanges]); // eslint-disable-line react-hooks/exhaustive-deps

  // Modal Alumno (Subir Entrega)
  const [isUploadModalOpen, setIsUploadModalOpen] = useState(false);
  const [currentTarea, setCurrentTarea] = useState(null);
  const [uploadFormData, setUploadFormData] = useState({ comentario: '', enlace: '', archivo: null });
  const [uploading, setUploading] = useState(false);

  // Modal Profesor (Ver Entregas)
  const [isViewModalOpen, setIsViewModalOpen] = useState(false);
  const [entregasTarea, setEntregasTarea] = useState([]);
  const [loadingEntregas, setLoadingEntregas] = useState(false);

  // Modal Calificar
  const [isGradeModalOpen, setIsGradeModalOpen] = useState(false);
  const [currentEntrega, setCurrentEntrega] = useState(null);
  const [gradeFormData, setGradeFormData] = useState({ nota: '', feedback: '' });
  const [savingGrade, setSavingGrade] = useState(false);

  // Modal Profesor: Crear/Editar Tarea
  const [isTareaModalOpen, setIsTareaModalOpen] = useState(false);
  const [editingTarea, setEditingTarea] = useState(null);
  const [tareaImparticionId, setTareaImparticionId] = useState(null);
  const [tareaForm, setTareaForm] = useState({
    titulo: '', descripcion: '', fechaLimite: '',
    tipo: 'tarea', visible: true, archivo: null,
  });
  const [savingTarea, setSavingTarea] = useState(false);

  const handleOpenTareaModal = (imparticionId, tarea = null) => {
    setTareaImparticionId(imparticionId);
    if (tarea) {
      setEditingTarea(tarea);
      setTareaForm({
        titulo: tarea.titulo,
        descripcion: tarea.descripcion || '',
        fechaLimite: tarea.fechaLimite ? tarea.fechaLimite.slice(0, 16) : '',
        tipo: tarea.tipo || 'tarea',
        visible: tarea.visible,
        archivo: null,
      });
    } else {
      setEditingTarea(null);
      setTareaForm({ titulo: '', descripcion: '', fechaLimite: '', tipo: 'tarea', visible: true, archivo: null });
    }
    setIsTareaModalOpen(true);
  };

  const handleCloseTareaModal = () => {
    setIsTareaModalOpen(false);
    setEditingTarea(null);
    setTareaImparticionId(null);
  };

  const handleTareaInput = (e) => {
    const { name, value, type, checked, files } = e.target;
    if (type === 'file') {
      setTareaForm(prev => ({ ...prev, archivo: files[0] }));
    } else {
      setTareaForm(prev => ({ ...prev, [name]: type === 'checkbox' ? checked : value }));
    }
  };

  const handleSaveTarea = async (e) => {
    e.preventDefault();
    setSavingTarea(true);
    try {
      const data = new FormData();
      data.append('titulo', tareaForm.titulo);
      data.append('descripcion', tareaForm.descripcion);
      data.append('fechaLimite', tareaForm.fechaLimite);
      data.append('tipo', tareaForm.tipo);
      data.append('visible', tareaForm.visible);
      data.append('imparticionId', tareaImparticionId);
      if (editingTarea) data.append('id', editingTarea.id);
      if (tareaForm.archivo) data.append('file', tareaForm.archivo);

      const response = await fetch(getApiUrl('/api/tareas/upload'), {
        method: 'POST', body: data, credentials: 'include',
      });
      if (!response.ok) {
        const errData = await response.json().catch(() => ({}));
        throw new Error(errData.message || t('common.errorSaving', { message: 'Error desconocido' }));
      }
      await fetchData();
      handleCloseTareaModal();
    } catch (err) {
      alert(t('common.errorSaving', { message: err.message }));
    } finally {
      setSavingTarea(false);
    }
  };

  const handleDeleteTarea = async (tareaId) => {
    if (!window.confirm(t('tasks.confirmDelete'))) return;
    try {
      const response = await fetch(getApiUrl(`/api/tareas/${tareaId}`), {
        method: 'DELETE', credentials: 'include',
      });
      if (!response.ok) throw new Error(t('tasks.errorDelete'));
      fetchData();
    } catch (err) {
      alert(err.message);
    }
  };

  // Cargar entregas del alumno
  useEffect(() => {
    if (!isAlumno || !user) return;
    const fetchEntregas = async () => {
      try {
        const res = await fetch(getApiUrl(`/api/entregas?alumno=${user.id}&pagination=false`), {
          headers: { 'Accept': 'application/ld+json' }, credentials: 'include'
        });
        const data = await res.json();
        const entregas = data['hydra:member'] || data.member || [];
        const map = {};
        entregas.forEach(e => {
          let tareaId;
          if (typeof e.tarea === 'string') tareaId = e.tarea.split('/').pop();
          else if (e.tarea?.id) tareaId = e.tarea.id.toString();
          else if (e.tarea?.['@id']) tareaId = e.tarea['@id'].split('/').pop();
          if (tareaId) map[tareaId] = e;
        });
        setMisEntregas(map);
      } catch (err) {
        console.error('Error cargando entregas:', err);
      }
    };
    fetchEntregas();
  }, [isAlumno, user, asignaturas]);

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
        method: 'POST', body: data, credentials: 'include'
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

  // Deep-link desde /tareas: ?imparticion=X&tarea=Y → abrir accordion + modal de entregas
  useEffect(() => {
    const impParam = searchParams.get('imparticion');
    const tareaParam = searchParams.get('tarea');
    if (!impParam || !tareaParam || asignaturas.length === 0) return;

    const imp = asignaturas.find(a => String(a.id) === String(impParam));
    if (!imp) return;
    const tarea = (imp.tareas || []).find(tr => String(tr.id) === String(tareaParam));
    if (!tarea) return;

    setExpandedId(imp.id);
    if (isAlumno) {
      handleOpenUploadModal(tarea);
    } else {
      handleViewEntregas(tarea);
    }

    // Limpiar los params para que no se vuelva a disparar
    const next = new URLSearchParams(searchParams);
    next.delete('imparticion');
    next.delete('tarea');
    setSearchParams(next, { replace: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [asignaturas]);

  const handleViewEntregas = async (tarea) => {
    setCurrentTarea(tarea);
    setIsViewModalOpen(true);
    setLoadingEntregas(true);
    try {
      const tareaId = tarea.id || tarea['@id'].split('/').pop();
      const response = await fetch(getApiUrl(`/api/entregas?tarea=${tareaId}&pagination=false`), {
        headers: { 'Accept': 'application/ld+json' }, credentials: 'include'
      });
      if (!response.ok) throw new Error(`Error ${response.status}`);
      const data = await response.json();
      setEntregasTarea(data['hydra:member'] || data.member || []);
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
        method,
        headers: { 'Content-Type': 'application/ld+json', 'Accept': 'application/ld+json' },
        body: JSON.stringify(payload),
        credentials: 'include'
      });
      if (!response.ok) throw new Error(t('deliveries.errorSaveGrade'));

      const calificacionGuardada = await response.json();
      setEntregasTarea(prev => prev.map(ent =>
        ent.id === currentEntrega.id ? { ...ent, calificacion: calificacionGuardada } : ent
      ));
      setIsGradeModalOpen(false);
    } catch (err) {
      alert(err.message);
    } finally {
      setSavingGrade(false);
    }
  };

  const renderContent = (imparticion) => {
    const allTareas = (imparticion.tareas || []).filter(enPeriodo);
    const tareas = activeTab === 'todos' ? allTareas : allTareas.filter(t => t.tipo === activeTab);
    if (allTareas.length === 0) return <div className={styles.emptyState}>{t('deliveries.noTasks')}</div>;
    if (tareas.length === 0) return <div className={styles.emptyState}>{t('grades.noTasksType')}</div>;

    return (
      <ul className={styles.list}>
        {tareas.map(tarea => {
          const entrega = misEntregas[tarea.id];
          const estado = entrega ? (entrega.calificacion ? t('deliveries.graded') : t('deliveries.delivered')) : t('deliveries.pending');
          const badgeClass = entrega ? (entrega.calificacion ? styles.badgeInfo : styles.badgeSuccess) : styles.badgePending;
          const isLate = new Date() > new Date(tarea.fechaLimite);

          return (
            <li key={tarea.id} className={styles.listItem}>
              <div className={styles.itemInfo}>
                <FileText size={18} className={styles.icon} />
                <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)', flexWrap: 'wrap' }}>
                    <span style={{ fontWeight: '600' }}>{tarea.titulo}</span>
                    <span className={styles.date}><Calendar size={12} /> {new Date(tarea.fechaLimite).toLocaleDateString()}</span>
                    {isAlumno && (
                      <span className={`${styles.badge} ${isLate && !entrega ? styles.badgeError : badgeClass}`}>
                        {isLate && !entrega ? t('deliveries.delayed') : estado}
                      </span>
                    )}
                  </div>
                  {isAlumno && entrega && entrega.calificacion && (
                    <div className={styles.feedbackContainer}>
                      <span className={styles.feedbackHeader}>
                        <Award size={14} /> {entrega.calificacion.nota}
                      </span>
                      {entrega.calificacion.feedbackProfesor && (
                        <span className={styles.feedbackText}>
                          <MessageSquare size={12} style={{ marginRight: '4px' }} />
                          {entrega.calificacion.feedbackProfesor}
                        </span>
                      )}
                    </div>
                  )}
                </div>
              </div>
              <div className={styles.itemActions}>
                {isAlumno && entrega?.archivo && (
                  <a
                    href={getAssetUrl(`/uploads/entregas/${entrega.id}/${entrega.archivo}`)}
                    target="_blank" rel="noopener noreferrer"
                    className={styles.downloadLink}
                    title={t('deliveries.downloadMine', { defaultValue: 'Descargar mi entrega' })}
                  >
                    <Download size={18} />
                  </a>
                )}
                {isAlumno && entrega?.enlace && (
                  <a
                    href={entrega.enlace}
                    target="_blank" rel="noopener noreferrer"
                    className={styles.downloadLink}
                    title={t('deliveries.link')}
                  >
                    <FileText size={18} />
                  </a>
                )}
                {isAlumno && !isLate && (
                  <Button size="sm" onClick={() => handleOpenUploadModal(tarea)}>
                    <Upload size={16} style={{ marginRight: '4px' }} />
                    {entrega ? t('common.edit') : t('deliveries.deliver')}
                  </Button>
                )}
                {(isProfesor || isAdmin || isSuperAdmin) && (
                  <>
                    {tarea.archivo && (
                      <a
                        href={getAssetUrl(`/uploads/tareas/${tarea.id}/${tarea.archivo}`)}
                        target="_blank" rel="noopener noreferrer"
                        className={styles.downloadLink}
                        title={t('tasks.downloadAttachment')}
                      >
                        <Paperclip size={18} />
                      </a>
                    )}
                    <Button size="sm" variant="secondary" onClick={() => handleViewEntregas(tarea)}>
                      <Eye size={16} style={{ marginRight: '4px' }} /> {t('deliveries.viewDeliveries')}
                    </Button>
                    <button
                      className={styles.iconButton}
                      onClick={() => handleOpenTareaModal(imparticion.id, tarea)}
                      title={t('common.edit')}
                    >
                      <Edit2 size={18} />
                    </button>
                    <button
                      className={`${styles.iconButton} ${styles.danger}`}
                      onClick={() => handleDeleteTarea(tarea.id)}
                      title={t('common.delete')}
                    >
                      <Trash2 size={18} />
                    </button>
                  </>
                )}
              </div>
            </li>
          );
        })}
      </ul>
    );
  };

  const entregasColumns = [
    { header: t('deliveries.studentCol'), accessor: (row) => row.alumno ? `${row.alumno.nombre} ${row.alumno.apellidos}` : t('common.unknown'), sortable: true },
    { header: t('deliveries.dateCol'), accessor: (row) => new Date(row.fechaEntrega).toLocaleString(), sortable: true },
    {
      header: t('deliveries.filesCol'),
      accessor: (row) => (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
          {row.archivo && <a href={getAssetUrl(`/uploads/entregas/${row.id}/${row.archivo}`)} target="_blank" className={styles.fileLink}><Download size={14} /> {t('deliveries.file')}</a>}
          {row.enlace && <a href={row.enlace} target="_blank" className={styles.fileLink}><FileText size={14} /> {t('deliveries.link')}</a>}
        </div>
      )
    },
    { header: t('deliveries.commentCol'), accessor: 'comentarioAlumno' },
    {
      header: t('deliveries.gradeCol'),
      accessor: (row) => (
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          {row.calificacion
            ? <span className={`${styles.badge} ${styles.badgeInfo}`}>{row.calificacion.nota}</span>
            : <span className={`${styles.badge} ${styles.badgePending}`}>{t('common.pending')}</span>}
          <button type="button" className={styles.iconButton} onClick={(e) => { e.stopPropagation(); handleOpenGradeModal(row); }} title={t('deliveries.gradeCol')}>
            <Award size={18} />
          </button>
        </div>
      )
    }
  ];

  return (
    <Layout>
      <div className={styles.container}>
        <CrudHeader
          title={t('deliveries.title')}
          logo={<Lottie animationData={bookAnimation} loop={true} style={{ width: 60, height: 60 }} />}
        >
          {isSuperAdmin && <SuperAdminFilters filters={filters} selectClassName={styles.select} />}
          {periodos.length > 0 && (
            <select
              className={styles.select}
              value={selectedPeriodo}
              onChange={(e) => setSelectedPeriodo(e.target.value)}
            >
              <option value="">{t('grades.allPeriods')}</option>
              {periodos.map(p => (
                <option key={p.key} value={p.key}>{p.nombre}</option>
              ))}
            </select>
          )}
        </CrudHeader>

        {loading ? (
          <LoadingView />
        ) : error ? (
          <div className={styles.errorContainer}>{error}</div>
        ) : asignaturas.length === 0 ? (
          <div className={styles.emptyState}>
            {isSuperAdmin && !filters.selectedCentro ? t('deliveries.selectCenter') : t('deliveries.noSubjects')}
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
            onAdd={(id) => handleOpenTareaModal(id)}
            expandedId={expandedId}
            onToggle={(id) => setExpandedId(prev => prev === id ? null : id)}
          />
          </>
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
          <div className={styles.formGroup}>
            <label className={styles.label}>{t('deliveries.linkLabel')}</label>
            <input
              type="url" className={styles.input}
              value={uploadFormData.enlace}
              onChange={e => setUploadFormData({ ...uploadFormData, enlace: e.target.value })}
              placeholder={t('deliveries.linkPlaceholder')}
            />
          </div>
          <div className={styles.formGroup}>
            <label className={styles.label}>{t('deliveries.commentLabel')}</label>
            <textarea
              className={styles.textarea}
              value={uploadFormData.comentario}
              onChange={e => setUploadFormData({ ...uploadFormData, comentario: e.target.value })}
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
              type="number" className={styles.input}
              value={gradeFormData.nota}
              onChange={e => setGradeFormData({ ...gradeFormData, nota: e.target.value })}
              min="0" max="10" step="0.1" required
            />
          </div>
          <div className={styles.formGroup}>
            <label className={styles.label}>{t('deliveries.feedbackLabel')}</label>
            <textarea
              className={styles.textarea}
              value={gradeFormData.feedback}
              onChange={e => setGradeFormData({ ...gradeFormData, feedback: e.target.value })}
              placeholder={t('deliveries.feedbackPlaceholder')}
            />
          </div>
        </ModalView>

        {/* Modal Profesor: Crear/Editar Tarea */}
        <ModalView
          isOpen={isTareaModalOpen}
          onClose={handleCloseTareaModal}
          title={editingTarea ? t('tasks.editTitle') : t('tasks.newTitle')}
          onSubmit={handleSaveTarea}
          isSubmitting={savingTarea}
        >
          <div className={styles.formGroup}>
            <label className={styles.label}>{t('tasks.titleLabel')}</label>
            <input className={styles.input} name="titulo" value={tareaForm.titulo} onChange={handleTareaInput} required />
          </div>
          <div className={styles.formGroup}>
            <label className={styles.label}>{t('tasks.descriptionLabel')}</label>
            <textarea className={styles.textarea} name="descripcion" value={tareaForm.descripcion} onChange={handleTareaInput} />
          </div>
          <div className={styles.formGroup}>
            <label className={styles.label}>{t('tasks.attachmentLabel')}</label>
            <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
              <input type="file" ref={tareaFileInputRef} className={styles.fileInput} name="archivo" onChange={handleTareaInput} style={{ display: 'none' }} />
              <Button type="button" variant="secondary" onClick={() => tareaFileInputRef.current.click()}>
                <Upload size={16} style={{ marginRight: '8px' }} />
                {tareaForm.archivo ? t('common.changeFile') : t('common.selectFile')}
              </Button>
              {tareaForm.archivo && <span style={{ fontSize: '0.9rem', color: 'var(--text-main)' }}>{tareaForm.archivo.name}</span>}
            </div>
            {editingTarea && editingTarea.archivo && !tareaForm.archivo && (
              <small style={{ color: 'var(--text-muted)', display: 'block', marginTop: '4px' }}>
                {t('common.currentFile')}: {editingTarea.archivo}
              </small>
            )}
          </div>
          <div className={styles.formGroup}>
            <label className={styles.label}>{t('tasks.dueDate')}</label>
            <input type="datetime-local" className={styles.input} name="fechaLimite" value={tareaForm.fechaLimite} onChange={handleTareaInput} required />
          </div>
          <div className={styles.formGroup}>
            <label className={styles.label}>{t('tasks.typeLabel')}</label>
            <select className={styles.select} name="tipo" value={tareaForm.tipo} onChange={handleTareaInput}>
              <option value="tarea">{t('tasks.typeTask')}</option>
              <option value="examen">{t('tasks.typeExam')}</option>
              <option value="practica">{t('tasks.typePractice')}</option>
            </select>
          </div>
          <div className={styles.formGroup}>
            <label style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <input type="checkbox" name="visible" checked={tareaForm.visible} onChange={handleTareaInput} />
              {t('tasks.visibleToStudents')}
            </label>
          </div>
        </ModalView>
      </div>
    </Layout>
  );
};

export default Entregas;
