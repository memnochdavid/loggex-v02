import React, { useEffect, useState, useRef, useCallback, useMemo } from 'react';
import styles from './Crud.module.css';
import jStyles from './JornadasAdmin.module.css';
import Button from '../components/Button';
import DataTable from '../components/DataTable';
import SearchBar from '../components/SearchBar';
import ThemedSelect from '../components/ThemedSelect';
import Layout from '../components/Layout';
import ModalView from '../components/ModalView';
import CrudHeader from '../components/CrudHeader';
import { useAuth } from '../context/AuthContext';
import { usePagination } from '../hooks/usePagination';
import { Plus, Edit2, Trash2, ArrowUp, ArrowDown, X as Cross } from 'lucide-react';
import { getApiUrl } from '../config/api';
import Lottie from 'lottie-react';
import crudAnimation from '../../public/crud.json';
import { useTranslation } from 'react-i18next';
import { toast, parseErrorResponse } from '../utils/toast';
import { useConfirm } from '../context/ConfirmContext';

const DIAS_SEMANA = [
  { value: 1, key: 'days.monday' },
  { value: 2, key: 'days.tuesday' },
  { value: 3, key: 'days.wednesday' },
  { value: 4, key: 'days.thursday' },
  { value: 5, key: 'days.friday' },
  { value: 6, key: 'days.saturday' },
  { value: 7, key: 'days.sunday' },
];

const TURNOS = [
  { value: 'manana', key: 'jornadas.turnoManana' },
  { value: 'tarde',  key: 'jornadas.turnoTarde' },
];

// Helpers de tiempo: las TIME columns vienen como "HH:MM:SS" del backend.
const normalizeHora = (raw) => {
  if (!raw) return '';
  const m = String(raw).match(/(\d{2}):(\d{2})/);
  return m ? `${m[1]}:${m[2]}` : '';
};
const horaToMinutos = (h) => {
  if (!h) return 0;
  const [hh, mm] = h.split(':').map(Number);
  return hh * 60 + mm;
};

const newTramo = (orden, tipo, horaInicio, horaFin) => ({
  orden,
  tipo,
  horaInicio,
  horaFin,
  etiqueta: '',
});

const JornadasAdmin = () => {
  const { t } = useTranslation();
  const confirm = useConfirm();
  const { user } = useAuth();
  const isSuperAdmin = user?.roles?.includes('ROLE_SUPERADMIN');

  const [jornadas, setJornadas] = useState([]);
  const [centros, setCentros] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const [selectedCentro, setSelectedCentro] = useState('');
  const [selectedTurno, setSelectedTurno] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [totalItems, setTotalItems] = useState(0);
  const [itemsPerPage, setItemsPerPage] = usePagination('jornadas');
  const [searchTerm, setSearchTerm] = useState('');
  const [searchField, setSearchField] = useState('nombre');
  const [sortColumn, setSortColumn] = useState('id');
  const [sortDirection, setSortDirection] = useState('asc');

  const debounceTimeout = useRef(null);
  const prevSearchTerm = useRef(searchTerm);
  const prevSearchField = useRef(searchField);
  const abortController = useRef(null);

  const handleItemsPerPageChange = (n) => { setItemsPerPage(n); setCurrentPage(1); };
  const handleSort = useCallback((columnKey) => {
    if (sortColumn === columnKey) {
      setSortDirection(prev => prev === 'asc' ? 'desc' : 'asc');
    } else {
      setSortColumn(columnKey);
      setSortDirection('asc');
    }
  }, [sortColumn]);

  const searchFields = [
    { value: 'nombre', label: t('jornadas.name', { defaultValue: 'Nombre' }) },
  ];

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [current, setCurrent] = useState(null);
  const [formData, setFormData] = useState({
    nombre: '',
    centro: '',
    turno: 'manana',
    diasLectivos: [1, 2, 3, 4, 5],
    tramos: [],
  });
  const [saving, setSaving] = useState(false);

  // Cargar centros (solo SuperAdmin)
  useEffect(() => {
    if (!isSuperAdmin) return;
    fetch(getApiUrl('/api/centros?pagination=false'), {
      headers: { 'Accept': 'application/ld+json' },
      credentials: 'include',
    })
      .then(r => r.json())
      .then(data => setCentros(data['hydra:member'] || data.member || []))
      .catch(err => console.error('Error cargando centros:', err));
  }, [isSuperAdmin]);

  const getJornadaId = (j) => {
    if (j.id) return j.id;
    if (j['@id']) return j['@id'].split('/').pop();
    return null;
  };

  const fetchJornadas = useCallback(async (params) => {
    if (abortController.current) abortController.current.abort();
    abortController.current = new AbortController();
    setLoading(true);

    try {
      let url = getApiUrl(`/api/jornada_tipos?page=${params.page}&itemsPerPage=${params.itemsPerPage}`);
      if (params.searchTerm) {
        url += `&${params.searchField}=${encodeURIComponent(params.searchTerm)}`;
      }
      if (params.selectedCentro) url += `&centro=${params.selectedCentro}`;
      if (params.selectedTurno) url += `&turno=${params.selectedTurno}`;
      if (params.sortColumn) url += `&order[${params.sortColumn}]=${params.sortDirection}`;

      const r = await fetch(url, {
        headers: { 'Accept': 'application/ld+json' },
        credentials: 'include',
        signal: abortController.current.signal,
      });
      if (!r.ok) throw new Error(`Error ${r.status}: ${r.statusText}`);

      const data = await r.json();
      const items = data['hydra:member'] || data.member || [];
      setJornadas(items);
      setTotalItems(data['hydra:totalItems'] || data.totalItems || items.length);
      setError(null);
    } catch (err) {
      if (err.name === 'AbortError') return;
      console.error('Error fetching jornadas:', err);
      setError(err.message);
    } finally {
      if (abortController.current && !abortController.current.signal.aborted) {
        setLoading(false);
      }
    }
  }, []);

  useEffect(() => {
    const searchChanged = searchTerm !== prevSearchTerm.current || searchField !== prevSearchField.current;
    prevSearchTerm.current = searchTerm;
    prevSearchField.current = searchField;
    const params = {
      page: currentPage,
      itemsPerPage,
      searchTerm,
      searchField,
      selectedCentro,
      selectedTurno,
      sortColumn,
      sortDirection,
    };
    if (searchChanged) {
      if (debounceTimeout.current) clearTimeout(debounceTimeout.current);
      debounceTimeout.current = setTimeout(() => fetchJornadas(params), 500);
    } else {
      if (debounceTimeout.current) clearTimeout(debounceTimeout.current);
      fetchJornadas(params);
    }
    return () => { if (debounceTimeout.current) clearTimeout(debounceTimeout.current); };
  }, [currentPage, itemsPerPage, searchTerm, searchField, selectedCentro, selectedTurno, sortColumn, sortDirection, fetchJornadas]);

  const handleOpenModal = useCallback((jornada = null) => {
    if (jornada) {
      setCurrent(jornada);
      // El centro puede venir como string IRI, como objeto JSON-LD con @id, o como objeto con .id.
      let centroId = '';
      if (jornada.centro) {
        if (typeof jornada.centro === 'string') {
          centroId = jornada.centro.split('/').pop();
        } else if (typeof jornada.centro === 'object') {
          centroId = String(jornada.centro.id
            || (jornada.centro['@id'] ? jornada.centro['@id'].split('/').pop() : ''));
        }
      }
      setFormData({
        nombre: jornada.nombre || '',
        centro: centroId,
        turno: jornada.turno || 'manana',
        diasLectivos: jornada.diasLectivos || [1, 2, 3, 4, 5],
        tramos: (jornada.tramos || []).map(t => ({
          orden: t.orden,
          tipo: t.tipo,
          horaInicio: normalizeHora(t.horaInicio),
          horaFin: normalizeHora(t.horaFin),
          etiqueta: t.etiqueta || '',
        })).sort((a, b) => a.orden - b.orden),
      });
    } else {
      setCurrent(null);
      // Resolver centro del usuario: puede venir como objeto, IRI string o nada.
      let centroId = '';
      if (!isSuperAdmin && user?.centro) {
        if (typeof user.centro === 'object' && user.centro.id) {
          centroId = String(user.centro.id);
        } else if (typeof user.centro === 'string') {
          centroId = user.centro.split('/').pop();
        }
      }
      setFormData({
        nombre: '',
        centro: centroId,
        turno: 'manana',
        diasLectivos: [1, 2, 3, 4, 5],
        tramos: [],
      });
    }
    setIsModalOpen(true);
  }, [isSuperAdmin, user]);

  const handleCloseModal = () => { setIsModalOpen(false); setCurrent(null); };

  const handleAddTramo = (tipo) => {
    setFormData(prev => {
      const ult = prev.tramos[prev.tramos.length - 1];
      const horaInicio = ult ? ult.horaFin : (prev.turno === 'tarde' ? '15:00' : '08:30');
      const duracion = tipo === 'recreo' ? 30 : 60;
      const horaFin = (() => {
        const [h, m] = horaInicio.split(':').map(Number);
        const finMin = h * 60 + m + duracion;
        return `${String(Math.floor(finMin / 60)).padStart(2, '0')}:${String(finMin % 60).padStart(2, '0')}`;
      })();
      return {
        ...prev,
        tramos: [...prev.tramos, newTramo(prev.tramos.length, tipo, horaInicio, horaFin)],
      };
    });
  };

  const handleUpdateTramo = (idx, field, value) => {
    setFormData(prev => {
      const tramos = [...prev.tramos];
      tramos[idx] = { ...tramos[idx], [field]: value };
      return { ...prev, tramos };
    });
  };

  const handleRemoveTramo = (idx) => {
    setFormData(prev => {
      const tramos = prev.tramos.filter((_, i) => i !== idx).map((t, i) => ({ ...t, orden: i }));
      return { ...prev, tramos };
    });
  };

  const handleMoveTramo = (idx, dir) => {
    setFormData(prev => {
      const tramos = [...prev.tramos];
      const j = idx + dir;
      if (j < 0 || j >= tramos.length) return prev;
      [tramos[idx], tramos[j]] = [tramos[j], tramos[idx]];
      return { ...prev, tramos: tramos.map((t, i) => ({ ...t, orden: i })) };
    });
  };

  const handleToggleDia = (dia) => {
    setFormData(prev => {
      const has = prev.diasLectivos.includes(dia);
      const dl = has ? prev.diasLectivos.filter(d => d !== dia) : [...prev.diasLectivos, dia];
      return { ...prev, diasLectivos: dl.sort((a, b) => a - b) };
    });
  };

  // Métricas y validaciones derivadas
  const metricas = useMemo(() => {
    const slots = formData.tramos.filter(t => t.tipo === 'slot');
    const minutosLectivos = slots.reduce((acc, t) => acc + (horaToMinutos(t.horaFin) - horaToMinutos(t.horaInicio)), 0);
    const horasLectivasDia = minutosLectivos / 60;
    const horasLectivasSem = horasLectivasDia * formData.diasLectivos.length;
    return { slots: slots.length, horasLectivasDia, horasLectivasSem };
  }, [formData.tramos, formData.diasLectivos]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!formData.centro) {
      toast.error(t('jornadas.centroRequired', { defaultValue: 'Selecciona un centro antes de guardar.' }));
      return;
    }
    if (formData.tramos.length === 0) {
      toast.error(t('jornadas.tramosRequired', { defaultValue: 'Añade al menos un tramo a la jornada.' }));
      return;
    }
    setSaving(true);
    try {
      const id = current ? getJornadaId(current) : null;
      const url = current ? getApiUrl(`/api/jornada_tipos/${id}`) : getApiUrl('/api/jornada_tipos');
      const method = current ? 'PUT' : 'POST';
      const payload = {
        nombre: formData.nombre,
        centro: `/api/centros/${formData.centro}`,
        turno: formData.turno,
        diasLectivos: formData.diasLectivos,
        tramos: formData.tramos.map((t, idx) => ({
          orden: idx,
          tipo: t.tipo,
          horaInicio: `${t.horaInicio}:00`,
          horaFin: `${t.horaFin}:00`,
          etiqueta: t.etiqueta || null,
        })),
      };
      const r = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/ld+json', 'Accept': 'application/ld+json' },
        body: JSON.stringify(payload),
        credentials: 'include',
      });
      if (!r.ok) {
        const msg = await parseErrorResponse(r);
        throw new Error(msg);
      }
      fetchJornadas({ page: currentPage, itemsPerPage, searchTerm, searchField, selectedCentro, selectedTurno, sortColumn, sortDirection });
      handleCloseModal();
      toast.success(current
        ? t('jornadas.updatedSuccess', { defaultValue: 'Jornada actualizada' })
        : t('jornadas.createdSuccess', { defaultValue: 'Jornada creada' }));
    } catch (err) {
      console.error('Error saving jornada:', err);
      toast.error(err.message, {
        description: current
          ? t('jornadas.errorUpdating', { defaultValue: 'No se pudo actualizar la jornada' })
          : t('jornadas.errorCreating', { defaultValue: 'No se pudo crear la jornada' }),
      });
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = useCallback(async (jornada) => {
    if (!(await confirm({ body: t('jornadas.confirmDelete', { defaultValue: '¿Eliminar esta jornada?' }) }))) return;
    const id = getJornadaId(jornada);
    if (!id) return;
    try {
      const r = await fetch(getApiUrl(`/api/jornada_tipos/${id}`), { method: 'DELETE', credentials: 'include' });
      if (!r.ok) {
        const msg = await parseErrorResponse(r, t('jornadas.errorDelete', { defaultValue: 'No se pudo eliminar' }));
        throw new Error(msg);
      }
      fetchJornadas({ page: currentPage, itemsPerPage, searchTerm, searchField, selectedCentro, selectedTurno, sortColumn, sortDirection });
      toast.success(t('jornadas.deletedSuccess', { defaultValue: 'Jornada eliminada' }));
    } catch (err) {
      console.error('Error deleting jornada:', err);
      toast.error(err.message);
    }
  }, [confirm, fetchJornadas, currentPage, itemsPerPage, searchTerm, searchField, selectedCentro, selectedTurno, sortColumn, sortDirection, t]);

  const columns = useMemo(() => [
    { header: t('jornadas.name', { defaultValue: 'Nombre' }), accessor: 'nombre', sortable: true, sortKey: 'nombre' },
    {
      header: t('jornadas.turno', { defaultValue: 'Turno' }),
      accessor: (row) => row.turno === 'manana'
        ? t('jornadas.turnoManana', { defaultValue: 'Mañana' })
        : t('jornadas.turnoTarde', { defaultValue: 'Tarde' }),
      sortable: true, sortKey: 'turno',
    },
    {
      header: t('jornadas.tramosCount', { defaultValue: 'Tramos' }),
      accessor: (row) => `${(row.tramos || []).filter(x => x.tipo === 'slot').length} slot · ${(row.tramos || []).filter(x => x.tipo === 'recreo').length} recreo`,
    },
    {
      header: t('jornadas.diasLectivos', { defaultValue: 'Días' }),
      accessor: (row) => (row.diasLectivos || []).map(d => t(DIAS_SEMANA.find(x => x.value === d)?.key, { defaultValue: '' }).slice(0, 3)).join(' '),
    },
    {
      header: t('common.actions', { defaultValue: 'Acciones' }),
      accessor: (row) => (
        <div className={styles.actions}>
          <button className={styles.iconButton} onClick={() => handleOpenModal(row)} title={t('common.edit')}>
            <Edit2 size={18} />
          </button>
          <button className={`${styles.iconButton} ${styles.danger}`} onClick={() => handleDelete(row)} title={t('common.delete')}>
            <Trash2 size={18} />
          </button>
        </div>
      ),
    },
  ], [t, handleOpenModal, handleDelete]);

  // Timeline preview: anchos proporcionales a la duración de cada tramo.
  const timelineSegments = useMemo(() => {
    if (formData.tramos.length === 0) return [];
    const minutosTotal = formData.tramos.reduce((acc, t) => acc + (horaToMinutos(t.horaFin) - horaToMinutos(t.horaInicio)), 0);
    if (minutosTotal === 0) return [];
    return formData.tramos.map((t, i) => {
      const dur = horaToMinutos(t.horaFin) - horaToMinutos(t.horaInicio);
      return {
        idx: i,
        tipo: t.tipo,
        horaInicio: t.horaInicio,
        horaFin: t.horaFin,
        widthPct: (dur * 100) / minutosTotal,
      };
    });
  }, [formData.tramos]);

  return (
    <Layout>
      <div className={styles.container}>
        <CrudHeader
          title={t('jornadas.title', { defaultValue: 'Jornadas' })}
          subtitle={t('jornadas.subtitle')}
          logo={<Lottie animationData={crudAnimation} loop={true} style={{ width: 56, height: 56 }} />}
        >
          {isSuperAdmin && (
            <ThemedSelect
              value={selectedCentro}
              onChange={setSelectedCentro}
              minWidth={180}
              ariaLabel={t('common.allCenters', { defaultValue: 'Todos los centros' })}
              options={[
                { value: '', label: t('common.allCenters', { defaultValue: 'Todos los centros' }) },
                ...centros.map(c => ({ value: String(c.id), label: c.nombre })),
              ]}
            />
          )}
          <ThemedSelect
            value={selectedTurno}
            onChange={setSelectedTurno}
            minWidth={150}
            ariaLabel={t('jornadas.allTurnos', { defaultValue: 'Todos los turnos' })}
            options={[
              { value: '', label: t('jornadas.allTurnos', { defaultValue: 'Todos los turnos' }) },
              { value: 'manana', label: t('jornadas.turnoManana', { defaultValue: 'Mañana' }) },
              { value: 'tarde',  label: t('jornadas.turnoTarde',  { defaultValue: 'Tarde' }) },
            ]}
          />
          <SearchBar
            value={searchTerm}
            onChange={setSearchTerm}
            placeholder={t('jornadas.searchPlaceholder', { defaultValue: 'Buscar jornada…' })}
            fields={searchFields}
            selectedField={searchField}
            onFieldChange={setSearchField}
          />
          <Button onClick={() => handleOpenModal()}>
            <Plus size={18} style={{ marginRight: '8px' }} />
            {t('common.new')}
          </Button>
        </CrudHeader>

        {error && <div className={styles.error}>{error}</div>}

        <DataTable
          columns={columns}
          data={jornadas}
          totalItems={totalItems}
          itemsPerPage={itemsPerPage}
          currentPage={currentPage}
          onPageChange={setCurrentPage}
          onItemsPerPageChange={handleItemsPerPageChange}
          loading={loading}
          sortColumn={sortColumn}
          sortDirection={sortDirection}
          onSort={handleSort}
          mobileBreakpoint={'600px'}
        />
      </div>

      <ModalView
        isOpen={isModalOpen}
        onClose={handleCloseModal}
        title={current
          ? t('jornadas.editTitle', { defaultValue: 'Editar jornada' })
          : t('jornadas.newTitle', { defaultValue: 'Nueva jornada' })}
        onSubmit={handleSubmit}
        submitLabel={t('common.save')}
        isSubmitting={saving}
      >
        <div className={styles.formGroup}>
          <label className={styles.label}>{t('jornadas.name', { defaultValue: 'Nombre' })}</label>
          <input
            type="text"
            className={styles.input}
            value={formData.nombre}
            onChange={e => setFormData(p => ({ ...p, nombre: e.target.value }))}
            placeholder={t('jornadas.namePlaceholder', { defaultValue: 'Ej: FP Superior Mañana' })}
            required
          />
        </div>

        {isSuperAdmin && (
          <div className={styles.formGroup}>
            <label className={styles.label}>{t('jornadas.centro', { defaultValue: 'Centro' })}</label>
            <ThemedSelect
              value={formData.centro}
              onChange={v => setFormData(p => ({ ...p, centro: v }))}
              options={[
                { value: '', label: '—' },
                ...centros.map(c => ({ value: String(c.id), label: c.nombre })),
              ]}
            />
          </div>
        )}

        <div className={styles.formGroup}>
          <label className={styles.label}>{t('jornadas.turno', { defaultValue: 'Turno' })}</label>
          <div className={jStyles.radioGroup}>
            {TURNOS.map(t_ => (
              <label key={t_.value} className={jStyles.radioOption}>
                <input
                  type="radio"
                  name="turno"
                  checked={formData.turno === t_.value}
                  onChange={() => setFormData(p => ({ ...p, turno: t_.value }))}
                />
                {t(t_.key, { defaultValue: t_.value })}
              </label>
            ))}
          </div>
        </div>

        <div className={styles.formGroup}>
          <label className={styles.label}>{t('jornadas.diasLectivos', { defaultValue: 'Días lectivos' })}</label>
          <div className={jStyles.diasGrid}>
            {DIAS_SEMANA.map(d => (
              <label key={d.value} className={jStyles.diaOption}>
                <input
                  type="checkbox"
                  checked={formData.diasLectivos.includes(d.value)}
                  onChange={() => handleToggleDia(d.value)}
                />
                {t(d.key, { defaultValue: '' }).slice(0, 3)}
              </label>
            ))}
          </div>
        </div>

        <div className={styles.formGroup}>
          <label className={styles.label}>{t('jornadas.tramos', { defaultValue: 'Tramos de la jornada' })}</label>
          <table className={jStyles.tramosTable}>
            <thead>
              <tr>
                <th>#</th>
                <th>{t('jornadas.tramoTipo', { defaultValue: 'Tipo' })}</th>
                <th>{t('jornadas.tramoInicio', { defaultValue: 'Inicio' })}</th>
                <th>{t('jornadas.tramoFin', { defaultValue: 'Fin' })}</th>
                <th>{t('jornadas.tramoEtiqueta', { defaultValue: 'Etiqueta' })}</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {formData.tramos.length === 0 && (
                <tr><td colSpan={6} className={jStyles.emptyTramos}>
                  {t('jornadas.tramosEmpty', { defaultValue: 'Aún no hay tramos. Añade slots y recreos abajo.' })}
                </td></tr>
              )}
              {formData.tramos.map((tr, idx) => (
                <tr key={idx} className={tr.tipo === 'recreo' ? jStyles.rowRecreo : ''}>
                  <td>{idx}</td>
                  <td>
                    <select
                      value={tr.tipo}
                      onChange={e => handleUpdateTramo(idx, 'tipo', e.target.value)}
                      className={jStyles.tramoSelect}
                    >
                      <option value="slot">{t('jornadas.tipoSlot', { defaultValue: 'Slot' })}</option>
                      <option value="recreo">{t('jornadas.tipoRecreo', { defaultValue: 'Recreo' })}</option>
                    </select>
                  </td>
                  <td>
                    <input
                      type="time"
                      value={tr.horaInicio}
                      onChange={e => handleUpdateTramo(idx, 'horaInicio', e.target.value)}
                      className={jStyles.tramoTime}
                      required
                    />
                  </td>
                  <td>
                    <input
                      type="time"
                      value={tr.horaFin}
                      onChange={e => handleUpdateTramo(idx, 'horaFin', e.target.value)}
                      className={jStyles.tramoTime}
                      required
                    />
                  </td>
                  <td>
                    <input
                      type="text"
                      value={tr.etiqueta}
                      onChange={e => handleUpdateTramo(idx, 'etiqueta', e.target.value)}
                      className={jStyles.tramoEtiqueta}
                      placeholder={tr.tipo === 'recreo' ? 'Patio' : ''}
                    />
                  </td>
                  <td className={jStyles.tramoActions}>
                    <button type="button" onClick={() => handleMoveTramo(idx, -1)} title="Subir" disabled={idx === 0}><ArrowUp size={14} /></button>
                    <button type="button" onClick={() => handleMoveTramo(idx, +1)} title="Bajar" disabled={idx === formData.tramos.length - 1}><ArrowDown size={14} /></button>
                    <button type="button" onClick={() => handleRemoveTramo(idx)} title="Eliminar" className={jStyles.btnDanger}><Cross size={14} /></button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <div className={jStyles.tramoButtons}>
            <Button variant="secondary" type="button" onClick={() => handleAddTramo('slot')} icon={<Plus size={14} />}>
              {t('jornadas.addSlot', { defaultValue: 'Añadir slot' })}
            </Button>
            <Button variant="secondary" type="button" onClick={() => handleAddTramo('recreo')} icon={<Plus size={14} />}>
              {t('jornadas.addRecreo', { defaultValue: 'Añadir recreo' })}
            </Button>
          </div>
        </div>

        {timelineSegments.length > 0 && (
          <div className={styles.formGroup}>
            <label className={styles.label}>{t('jornadas.timelinePreview', { defaultValue: 'Vista previa' })}</label>
            <div className={jStyles.timeline}>
              {timelineSegments.map(seg => (
                <div
                  key={seg.idx}
                  className={`${jStyles.tlSeg} ${seg.tipo === 'recreo' ? jStyles.tlRecreo : jStyles.tlSlot}`}
                  style={{ width: `${seg.widthPct}%` }}
                  title={`${seg.horaInicio}–${seg.horaFin}`}
                >
                  <span className={jStyles.tlHora}>{seg.horaInicio}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        <div className={jStyles.metricas}>
          <span><b>{t('jornadas.metricaSlots', { defaultValue: 'Slots' })}:</b> {metricas.slots}</span>
          <span><b>{t('jornadas.metricaHorasDia', { defaultValue: 'Horas/día' })}:</b> {metricas.horasLectivasDia.toFixed(2)}</span>
          <span><b>{t('jornadas.metricaHorasSem', { defaultValue: 'Horas/sem' })}:</b> {metricas.horasLectivasSem.toFixed(2)}</span>
        </div>
      </ModalView>
    </Layout>
  );
};

export default JornadasAdmin;
