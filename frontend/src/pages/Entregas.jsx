import React, { useEffect, useState, useMemo, useRef } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import styles from './Academic.module.css';
import Layout from '../components/Layout';
import AccordionView from '../components/AccordionView';
import Button from '../components/Button';
import DataTable from '../components/DataTable';
import ModalView from '../components/ModalView';
import CrudHeader from '../components/CrudHeader';
import SuperAdminFilters from '../components/SuperAdminFilters';
import ThemedSelect from '../components/ThemedSelect';
import { useAuth } from '../context/AuthContext';
import useImparticiones from '../hooks/useImparticiones';
import useLiveRefetch from '../hooks/useLiveRefetch';
import { FileText, Calendar, Upload, Eye, Download, Award, MessageSquare, Edit2, Trash2, Paperclip, BarChart3, RotateCcw } from 'lucide-react';
import { getApiUrl, getAssetUrl } from '../config/api';
import Lottie from 'lottie-react';
import bookAnimation from '../../public/book.json';
import { useTranslation } from 'react-i18next';
import LoadingView from '../components/LoadingView';
import { toast, parseErrorResponse } from '../utils/toast';
import { useConfirm } from '../context/ConfirmContext';

const Entregas = () => {
  const { t } = useTranslation();
  const confirm = useConfirm();
  const { user } = useAuth();
  const navigate = useNavigate();
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
  const [deliveryFilter, setDeliveryFilter] = useState('all'); // all | delivered | pending

  // Mercure live: refetch cuando llega una entrega (alumno entrega) o cambia
  // calificación / tarea de cualquier imparticion del usuario. Topics:
  // - /imparticiones/{id}/entregas: profesor recibe sus imparticiones
  // - /admin/tareas, /admin/calificaciones: admins también
  // El JWT firma /imparticiones/{id}/entregas con la lista del profe — si el
  // user no es profe de ninguna, no se suscribe al topic concreto.
  const liveTopics = useMemo(() => {
      if (!asignaturas?.length) return [];
      const impIds = asignaturas
          .map(a => a.id || a['@id']?.split('/').pop())
          .filter(Boolean);
      const topics = impIds.map(id => `/imparticiones/${id}/entregas`);
      // Tareas/calificaciones: solo admin, broadcast simple
      if (isAdmin || isSuperAdmin) {
          topics.push('/admin/tareas', '/admin/calificaciones');
      }
      return topics;
  }, [asignaturas, isAdmin, isSuperAdmin]);

  useLiveRefetch(liveTopics, () => fetchData());

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
        // Deduplicar por nombre+tipo, solo evaluaciones finalizadas (fechaFin < hoy)
        const hoy = new Date(); hoy.setHours(0,0,0,0);
        const byKey = new Map();
        results.forEach(r => {
          if (!r) return;
          const items = r['hydra:member'] || r.member || [];
          items.forEach(p => {
            if (!p.fechaFin || new Date(p.fechaFin) >= hoy) return;
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
    asignaturas.forEach(a => (a.tareas || []).filter(enPeriodo).forEach(t => {
      if (isAlumno && deliveryFilter !== 'all') {
        const hasEntrega = Boolean(misEntregas[t.id]);
        if (deliveryFilter === 'delivered' ? !hasEntrega : hasEntrega) return;
      }
      c.todos++;
      if (c[t.tipo] !== undefined) c[t.tipo]++;
    }));
    return c;
  }, [asignaturas, periodoRanges, isAlumno, deliveryFilter, misEntregas]); // eslint-disable-line react-hooks/exhaustive-deps

  // Modal Alumno (Subir Entrega)
  const [isUploadModalOpen, setIsUploadModalOpen] = useState(false);
  const [currentTarea, setCurrentTarea] = useState(null);
  const [uploadFormData, setUploadFormData] = useState({ comentario: '', enlace: '', archivo: null });
  const [uploading, setUploading] = useState(false);

  // Modal Profesor (Ver Entregas)
  const [isViewModalOpen, setIsViewModalOpen] = useState(false);
  const [entregasTarea, setEntregasTarea] = useState([]);
  const [loadingEntregas, setLoadingEntregas] = useState(false);
  const [viewImparticionId, setViewImparticionId] = useState(null);


  // Modal Profesor: Crear/Editar Tarea
  const [isTareaModalOpen, setIsTareaModalOpen] = useState(false);
  const [editingTarea, setEditingTarea] = useState(null);
  const [tareaImparticionId, setTareaImparticionId] = useState(null);
  const [tareaForm, setTareaForm] = useState({
    titulo: '', descripcion: '', fechaLimite: '',
    tipo: 'tarea', visible: true, archivo: null,
    obligatoria: true, notaMinima: '', tareaOriginalId: null,
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
        obligatoria: !!tarea.obligatoria,
        notaMinima: tarea.notaMinima != null ? String(tarea.notaMinima) : '',
        tareaOriginalId: null,
      });
    } else {
      setEditingTarea(null);
      setTareaForm({ titulo: '', descripcion: '', fechaLimite: '', tipo: 'tarea', visible: true, archivo: null, obligatoria: true, notaMinima: '', tareaOriginalId: null });
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
      data.append('obligatoria', tareaForm.obligatoria);
      data.append('notaMinima', tareaForm.notaMinima ?? '');
      data.append('imparticionId', tareaImparticionId);
      if (tareaForm.tareaOriginalId) data.append('tareaOriginalId', tareaForm.tareaOriginalId);
      if (editingTarea) data.append('id', editingTarea.id);
      if (tareaForm.archivo) data.append('file', tareaForm.archivo);

      const response = await fetch(getApiUrl('/api/tareas/upload'), {
        method: 'POST', body: data, credentials: 'include',
      });
      if (!response.ok) {
        const message = await parseErrorResponse(response);
        throw new Error(message);
      }
      await fetchData();
      handleCloseTareaModal();
      toast.success(editingTarea
        ? t('tasks.updatedSuccess', { defaultValue: 'Tarea actualizada' })
        : t('tasks.createdSuccess', { defaultValue: 'Tarea creada' }));
    } catch (err) {
      toast.error(err.message, {
        description: editingTarea
          ? t('tasks.errorUpdating', { defaultValue: 'No se ha podido actualizar la tarea' })
          : t('tasks.errorCreating', { defaultValue: 'No se ha podido crear la tarea' })
      });
    } finally {
      setSavingTarea(false);
    }
  };

  const handleDeleteTarea = async (tareaId) => {
    if (!(await confirm({ body: t('tasks.confirmDelete') }))) return;
    try {
      const response = await fetch(getApiUrl(`/api/tareas/${tareaId}`), {
        method: 'DELETE', credentials: 'include',
      });
      if (!response.ok) {
        const message = await parseErrorResponse(response, t('tasks.errorDelete'));
        throw new Error(message);
      }
      fetchData();
      toast.success(t('tasks.deletedSuccess', { defaultValue: 'Tarea eliminada' }));
    } catch (err) {
      toast.error(err.message, {
        description: t('tasks.errorDeletingCtx', { defaultValue: 'No se ha podido eliminar la tarea' })
      });
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
        const message = await parseErrorResponse(response, t('deliveries.errorUpload'));
        throw new Error(message);
      }
      await fetchData();
      setIsUploadModalOpen(false);
      toast.success(t('deliveries.uploadSuccess', { defaultValue: 'Entrega enviada' }));
    } catch (err) {
      toast.error(err.message, {
        description: t('deliveries.errorUploadCtx', { defaultValue: 'No se ha podido enviar la entrega' })
      });
    } finally {
      setUploading(false);
    }
  };

  // Deep-link desde /horarios, /tareas o notificaciones:
  //   ?imparticion=X&tarea=Y → abrir accordion + modal de entregas
  //   ?tarea=Y               → buscar la tarea en cualquier imparticion (fallback
  //                            cuando solo se conoce la tarea, p.ej. notificación
  //                            del alumno con tarea_nueva).
  //
  // Robustez (R2.3): aunque no se encuentre la tarea concreta, expandimos al
  // menos el accordion de la imparticion para que el usuario vea algo. Guard
  // con useRef para no re-disparar tras el refetch de useImparticiones.
  const deepLinkProcessedRef = useRef(false);
  useEffect(() => {
    if (deepLinkProcessedRef.current) return;
    if (asignaturas.length === 0) return;

    const impParam = searchParams.get('imparticion');
    const tareaParam = searchParams.get('tarea');
    if (!impParam && !tareaParam) return;

    // Resolver imparticion: por param explícito, o buscando la tarea entre todas.
    let imp = impParam
      ? asignaturas.find(a => String(a.id) === String(impParam))
      : null;
    let tarea = null;

    if (tareaParam) {
      if (imp) {
        tarea = (imp.tareas || []).find(tr => String(tr.id) === String(tareaParam));
      }
      // Fallback: si no la encontramos en la imparticion declarada (o no se
      // declaró), buscamos en TODAS las asignaturas. Cubre el caso del alumno
      // que sigue una notificación `tarea_nueva` con solo `?tarea=Y`.
      if (!tarea) {
        for (const a of asignaturas) {
          const t = (a.tareas || []).find(tr => String(tr.id) === String(tareaParam));
          if (t) {
            tarea = t;
            imp = a;
            break;
          }
        }
      }
    }

    if (!imp) return;  // ni imparticion ni tarea resoluble → nada que abrir.

    deepLinkProcessedRef.current = true;
    setExpandedId(imp.id);

    if (tarea) {
      if (isAlumno) {
        handleOpenUploadModal(tarea);
      } else {
        handleViewEntregas(tarea, imp.id);
      }
    }
    // Si no hay tarea concreta, ya hemos expandido el accordion — feedback
    // mínimo aceptable. El usuario ve la lista y puede actuar.

    const next = new URLSearchParams(searchParams);
    next.delete('imparticion');
    next.delete('tarea');
    setSearchParams(next, { replace: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [asignaturas]);

  const handleViewEntregas = async (tarea, imparticionId) => {
    setCurrentTarea(tarea);
    setViewImparticionId(imparticionId);
    setIsViewModalOpen(true);
    setLoadingEntregas(true);
    try {
      const tareaId = tarea.id || tarea['@id'].split('/').pop();
      const imparticion = asignaturas.find(a => String(a.id) === String(imparticionId));
      const grupoId = imparticion ? (
        typeof imparticion.grupo === 'string'
          ? imparticion.grupo.split('/').pop()
          : (imparticion.grupo?.id || imparticion.grupo?.['@id']?.split('/').pop())
      ) : null;

      const [entregasRes, matriculasRes] = await Promise.all([
        fetch(getApiUrl(`/api/entregas?tarea=${tareaId}&pagination=false`), {
          headers: { 'Accept': 'application/ld+json' }, credentials: 'include'
        }),
        grupoId ? fetch(getApiUrl(`/api/matriculas?grupo=${grupoId}&pagination=false`), {
          headers: { 'Accept': 'application/ld+json' }, credentials: 'include'
        }) : Promise.resolve(null),
      ]);
      if (!entregasRes.ok) throw new Error(`Error ${entregasRes.status}`);

      const entregasData = await entregasRes.json();
      const entregasList = entregasData['hydra:member'] || entregasData.member || [];

      let alumnosGrupo = [];
      if (matriculasRes && matriculasRes.ok) {
        const matData = await matriculasRes.json();
        const matriculas = matData['hydra:member'] || matData.member || [];
        const alumnosMap = new Map();
        matriculas.forEach(m => {
          if (m.alumno && !alumnosMap.has(m.alumno.id)) alumnosMap.set(m.alumno.id, m.alumno);
        });
        alumnosGrupo = Array.from(alumnosMap.values());
      }

      const entregasPorAlumnoId = new Map();
      entregasList.forEach(e => {
        const aId = e.alumno?.id || e.alumno?.['@id']?.split('/').pop();
        if (aId) entregasPorAlumnoId.set(String(aId), e);
      });

      const isPlazoVencido = tarea.fechaLimite ? new Date() > new Date(tarea.fechaLimite) : false;
      const filasVirtuales = alumnosGrupo
        .filter(a => !entregasPorAlumnoId.has(String(a.id)))
        .map(a => ({
          id: `virtual-${a.id}`,
          virtual: true,
          estadoEntrega: isPlazoVencido ? 'no_entregado' : 'pendiente',
          alumno: a,
          fechaEntrega: null,
          archivo: null,
          enlace: null,
          comentarioAlumno: null,
          calificacion: null,
        }));

      setEntregasTarea([...entregasList, ...filasVirtuales]);
    } catch (err) {
      console.error(err);
      toast.error(t('deliveries.errorLoadDeliveries'));
    } finally {
      setLoadingEntregas(false);
    }
  };

  // Devuelve las tareas de una imparticion tras aplicar TODOS los filtros activos
  // (período, tab global y deliveryFilter si es alumno).
  const filterTareas = (imparticion) => {
    const allTareas = (imparticion.tareas || []).filter(enPeriodo);
    let tareas = activeTab === 'todos' ? allTareas : allTareas.filter(t => t.tipo === activeTab);
    if (isAlumno && deliveryFilter !== 'all') {
      tareas = tareas.filter(tr => {
        const hasEntrega = Boolean(misEntregas[tr.id]);
        return deliveryFilter === 'delivered' ? hasEntrega : !hasEntrega;
      });
    }
    return { allTareas, tareas };
  };

  const renderContent = (imparticion) => {
    const { allTareas, tareas } = filterTareas(imparticion);
    if (allTareas.length === 0) return <div className={styles.emptyState}>{t('deliveries.noTasks')}</div>;
    if (tareas.length === 0) return <div className={styles.emptyState}>{t('grades.noTasksType')}</div>;

    return (
      <ul className={styles.list}>
        {tareas.map(tarea => {
          const entrega = misEntregas[tarea.id];
          const estado = entrega ? (entrega.calificacion ? t('deliveries.graded') : t('deliveries.delivered')) : t('deliveries.pending');
          const badgeClass = entrega ? (entrega.calificacion ? styles.badgeInfo : styles.badgeSuccess) : styles.badgePending;
          const isLate = new Date() > new Date(tarea.fechaLimite);

          // Detectar si esta tarea es hija (recuperación/subida de nota de otra)
          const padreObj = tarea.tareaOriginal;
          const padreId = padreObj
            ? (typeof padreObj === 'string' ? padreObj.split('/').pop() : (padreObj.id || padreObj['@id']?.split('/').pop()))
            : null;
          const padreTitulo = typeof padreObj === 'object' ? padreObj?.titulo : null;
          const esHija = !!padreId;
          // Para el alumno: ¿tenía aprobada la padre? → "↑ sube nota"; si no → "↩ recupera"
          const entregaPadre = padreId ? misEntregas[padreId] : null;
          const padreAprobada = entregaPadre?.calificacion?.nota != null && entregaPadre.calificacion.nota >= 5;
          const indicadorHija = esHija
            ? (isAlumno
                ? (padreAprobada
                    ? { txt: t('grades.upgradesIndicator', { title: padreTitulo || '', defaultValue: '↑ sube nota: {{title}}' }), cls: styles.badgeInfo }
                    : { txt: t('grades.recoversIndicator', { title: padreTitulo || '', defaultValue: '↩ recupera: {{title}}' }), cls: styles.badgePending })
                : { txt: t('grades.recoversIndicator', { title: padreTitulo || '', defaultValue: '↩ recupera: {{title}}' }), cls: styles.badgePending })
            : null;

          return (
            <li key={tarea.id} className={styles.listItem}>
              <div className={styles.itemInfo}>
                <FileText size={18} className={styles.icon} />
                <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)', flexWrap: 'wrap' }}>
                    <span style={{ fontWeight: '600' }}>{tarea.titulo}</span>
                    <span className={styles.date}><Calendar size={12} /> {new Date(tarea.fechaLimite).toLocaleDateString()}</span>
                    {indicadorHija && (
                      <span className={`${styles.badge} ${indicadorHija.cls}`} title={indicadorHija.txt}>
                        {indicadorHija.txt}
                      </span>
                    )}
                    {tarea.obligatoria && (
                      <span className={`${styles.badge} ${styles.badgeError}`} title={t('tasks.mandatoryHelp')}>
                        {t('tasks.mandatory')}
                      </span>
                    )}
                    {tarea.notaMinima != null && (
                      <span className={`${styles.badge} ${styles.badgePending}`} title={t('tasks.minGradeHelp')}>
                        {t('tasks.minGradeShort', { value: tarea.notaMinima })}
                      </span>
                    )}
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
                    <Button size="sm" variant="secondary" onClick={() => handleViewEntregas(tarea, imparticion.id)}>
                      <Eye size={16} style={{ marginRight: '4px' }} /> {t('deliveries.viewDeliveries')}
                    </Button>
                    {isLate && (
                      <Button size="sm" variant="secondary" onClick={() => handleOpenRecuModal(tarea, imparticion.id)} title={t('grades.openRecuperacion', { defaultValue: 'Registrar recuperaciones para este ítem' })}>
                        <RotateCcw size={16} style={{ marginRight: '4px' }} /> {t('grades.recuperacion', { defaultValue: 'Recuperación' })}
                      </Button>
                    )}
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

  // "Crear recuperación" = abrir el modal de nueva tarea precargado con datos de la original
  // y con tareaOriginal_id = esta. El profe ajusta título/fecha/etc y al guardar se crea como
  // tarea hija. Los alumnos entregan en ella como en cualquier otra tarea.
  const handleOpenRecuModal = (tarea, imparticionId) => {
    setTareaImparticionId(imparticionId);
    setEditingTarea(null);
    setTareaForm({
      titulo: `Recuperación: ${tarea.titulo}`,
      descripcion: tarea.descripcion || '',
      fechaLimite: '',
      tipo: tarea.tipo || 'tarea',
      visible: true,
      archivo: null,
      obligatoria: tarea.obligatoria !== false,
      notaMinima: tarea.notaMinima != null ? String(tarea.notaMinima) : '',
      tareaOriginalId: tarea.id || tarea['@id']?.split('/').pop(),
    });
    setIsTareaModalOpen(true);
  };

  const entregasColumns = [
    { header: t('deliveries.studentCol'), accessor: (row) => row.alumno ? `${row.alumno.nombre} ${row.alumno.apellidos}` : t('common.unknown'), sortable: true },
    { header: t('deliveries.dateCol'), accessor: (row) => row.fechaEntrega ? new Date(row.fechaEntrega).toLocaleString() : '—', sortable: true },
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
      accessor: (row) => {
        if (row.virtual) {
          const cls = row.estadoEntrega === 'no_entregado' ? styles.badgeError : styles.badgePending;
          const label = row.estadoEntrega === 'no_entregado' ? t('grades.notDelivered') : t('grades.pendingDelivery');
          return <span className={`${styles.badge} ${cls}`}>{label}</span>;
        }
        if (!row.calificacion) return <span className={`${styles.badge} ${styles.badgePending}`}>{t('common.pending')}</span>;
        const nota = row.calificacion.nota;
        const cls = nota < 5 ? styles.badgeError : nota < 7 ? styles.badgePending : styles.badgeSuccess;
        return <span className={`${styles.badge} ${cls}`}>{nota}</span>;
      }
    },
    {
      header: '',
      accessor: (row) => {
        const alumnoId = row.alumno?.id || row.alumno?.['@id']?.split('/').pop();
        if (!alumnoId || !viewImparticionId) return null;
        return (
          <button
            type="button"
            className={styles.iconButton}
            onClick={(e) => {
              e.stopPropagation();
              setIsViewModalOpen(false);
              const tareaId = currentTarea?.id || currentTarea?.['@id']?.split('/').pop();
              navigate(`/calificaciones/detalle?imparticion=${viewImparticionId}&alumno=${alumnoId}${tareaId ? `&tarea=${tareaId}` : ''}`);
            }}
            title={t('grades.viewDetail')}
          >
            <BarChart3 size={16} />
          </button>
        );
      }
    }
  ];

  return (
    <Layout>
      <div className={styles.container}>
        <CrudHeader
          title={t('deliveries.title')}
          breadcrumbs={[
              { label: t('sidebar.home'), to: '/' },
              { label: t('deliveries.title') },
          ]}

          subtitle={t('deliveries.subtitle')}
          logo={<Lottie animationData={bookAnimation} loop={true} style={{ width: 56, height: 56 }} />}
        >
          {isSuperAdmin && <SuperAdminFilters filters={filters} selectClassName={styles.select} />}
          {periodos.length > 0 && (
            <ThemedSelect
              value={selectedPeriodo}
              onChange={setSelectedPeriodo}
              minWidth={180}
              ariaLabel={t('grades.allPeriods')}
              options={[
                { value: '', label: t('grades.allPeriods') },
                ...periodos.map(p => ({ value: p.key, label: p.nombre })),
              ]}
            />
          )}
          {isAlumno && (
            <ThemedSelect
              value={deliveryFilter}
              onChange={setDeliveryFilter}
              minWidth={160}
              ariaLabel={t('deliveries.statusFilter', { defaultValue: 'Estado de entrega' })}
              options={[
                { value: 'all', label: t('grades.filterAll') },
                { value: 'delivered', label: t('deliveries.delivered') },
                { value: 'pending', label: t('deliveries.pending') },
              ]}
            />
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
          <div key={activeTab} className={styles.tabContent}>
          <AccordionView
            data={asignaturas}
            renderItem={renderContent}
            renderHeader={(imparticion) => {
              const { tareas } = filterTareas(imparticion);
              return (
                <span className="accordionHeaderWithCount">
                  <span className="accordionHeaderTitle">{imparticion.title}</span>
                  <span className="accordionHeaderCount">{tareas.length}</span>
                </span>
              );
            }}
            canAdd={isProfesor || isAdmin || isSuperAdmin}
            onAdd={(id) => handleOpenTareaModal(id)}
            expandedId={expandedId}
            onToggle={(id) => setExpandedId(prev => prev === id ? null : id)}
          />
          </div>
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
            tableId="entregas"
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
          <div className={styles.formGroup}>
            <label style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <input type="checkbox" name="obligatoria" checked={tareaForm.obligatoria} onChange={handleTareaInput} />
              {t('tasks.mandatory')}
            </label>
            <small style={{ color: 'var(--text-muted)', display: 'block', marginTop: '4px' }}>
              {t('tasks.mandatoryHelp')}
            </small>
          </div>
          <div className={styles.formGroup}>
            <label className={styles.label}>{t('tasks.minGrade')}</label>
            <input
              type="number" min="0" max="10" step="0.1"
              className={styles.input}
              name="notaMinima"
              value={tareaForm.notaMinima}
              onChange={handleTareaInput}
              placeholder={t('tasks.minGradePlaceholder')}
            />
            <small style={{ color: 'var(--text-muted)', display: 'block', marginTop: '4px' }}>
              {t('tasks.minGradeHelp')}
            </small>
          </div>
        </ModalView>
      </div>
    </Layout>
  );
};

export default Entregas;
