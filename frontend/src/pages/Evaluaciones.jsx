import React, { useEffect, useState, useRef, useCallback, useMemo } from 'react';
import styles from './Crud.module.css';
import Button from '../components/Button';
import DataTable from '../components/DataTable';
import Layout from '../components/Layout';
import ModalView from '../components/ModalView';
import ThemedSelect from '../components/ThemedSelect';
import CrudHeader from '../components/CrudHeader';
import { useAuth } from '../context/AuthContext';
import { usePagination } from '../hooks/usePagination';
import { Plus, Edit2, Trash2 } from 'lucide-react';
import { getApiUrl } from '../config/api';
import Lottie from 'lottie-react';
import crudAnimation from '../../public/crud.json';
import { useTranslation } from 'react-i18next';
import { toast, parseErrorResponse } from '../utils/toast';

const TIPOS = ['PRIMERA', 'SEGUNDA', 'TERCERA', 'ORDINARIA_FINAL', 'EXTRAORDINARIA'];

const Evaluaciones = ({ embedded = false, tabs = null }) => {
  const { t } = useTranslation();
  const { user } = useAuth();
  const isSuperAdmin = user?.roles?.includes('ROLE_SUPERADMIN');
  const isAdmin = user?.roles?.includes('ROLE_ADMIN');
  const canCreate = isSuperAdmin || isAdmin;

  const [periodos, setPeriodos] = useState([]);
  const [centros, setCentros] = useState([]);
  const [grupos, setGrupos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const [selectedCentro, setSelectedCentro] = useState('');
  const [selectedGrupo, setSelectedGrupo] = useState('');

  const [currentPage, setCurrentPage] = useState(1);
  const [totalItems, setTotalItems] = useState(0);
  const [itemsPerPage, setItemsPerPage] = usePagination('evaluaciones');

  const [sortColumn, setSortColumn] = useState('fechaInicio');
  const [sortDirection, setSortDirection] = useState('asc');

  const abortController = useRef(null);

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [current, setCurrent] = useState(null);
  const [formData, setFormData] = useState({
    nombre: '', tipo: 'PRIMERA', fechaInicio: '', fechaFin: '', peso: '', grupo: '',
  });
  const [saving, setSaving] = useState(false);

  // Centros (solo SuperAdmin)
  useEffect(() => {
    if (isSuperAdmin) {
      fetch(getApiUrl('/api/centros?pagination=false'), {
        headers: { 'Accept': 'application/ld+json' }, credentials: 'include',
      })
        .then(r => r.json())
        .then(d => setCentros(d['hydra:member'] || d.member || []))
        .catch(e => console.error(e));
    }
  }, [isSuperAdmin]);

  // Grupos (del centro del admin, o todos si es superadmin sin filtro)
  useEffect(() => {
    const centroId = isSuperAdmin ? selectedCentro : (user?.centro?.id || user?.centro?.['@id']?.split('/').pop());
    const url = centroId
      ? getApiUrl(`/api/grupos?centro=${centroId}&pagination=false`)
      : getApiUrl('/api/grupos?pagination=false');
    fetch(url, { headers: { 'Accept': 'application/ld+json' }, credentials: 'include' })
      .then(r => r.json())
      .then(d => setGrupos(d['hydra:member'] || d.member || []))
      .catch(e => console.error(e));
  }, [isSuperAdmin, selectedCentro, user?.centro]);

  const fetchPeriodos = useCallback(async () => {
    if (abortController.current) abortController.current.abort();
    abortController.current = new AbortController();
    setLoading(true);
    try {
      let url = getApiUrl(`/api/periodo_evaluativos?page=${currentPage}&itemsPerPage=${itemsPerPage}`);
      if (selectedGrupo) {
        url += `&grupo=${selectedGrupo}`;
      } else if (isSuperAdmin && selectedCentro) {
        url += `&grupo.centro=${selectedCentro}`;
      } else if (!isSuperAdmin) {
        const centroId = user?.centro?.id || user?.centro?.['@id']?.split('/').pop();
        if (centroId) url += `&grupo.centro=${centroId}`;
      }
      if (sortColumn) url += `&order[${sortColumn}]=${sortDirection}`;

      const res = await fetch(url, {
        headers: { 'Accept': 'application/ld+json' },
        credentials: 'include',
        signal: abortController.current.signal,
      });
      if (!res.ok) throw new Error(`Error ${res.status}`);
      const data = await res.json();
      setPeriodos(data['hydra:member'] || data.member || []);
      setTotalItems(data['hydra:totalItems'] || data.totalItems || 0);
      setError(null);
    } catch (err) {
      if (err.name === 'AbortError') return;
      setError(err.message);
    } finally {
      if (abortController.current && !abortController.current.signal.aborted) setLoading(false);
    }
  }, [currentPage, itemsPerPage, selectedCentro, selectedGrupo, sortColumn, sortDirection, isSuperAdmin, user?.centro]);

  useEffect(() => { fetchPeriodos(); }, [fetchPeriodos]);

  const handleSort = (col) => {
    if (sortColumn === col) setSortDirection(d => d === 'asc' ? 'desc' : 'asc');
    else { setSortColumn(col); setSortDirection('asc'); }
  };

  const getId = (p) => p.id || p['@id']?.split('/').pop();

  const handleOpen = (p = null) => {
    if (p) {
      setCurrent(p);
      setFormData({
        nombre: p.nombre || '',
        tipo: p.tipo || 'PRIMERA',
        fechaInicio: p.fechaInicio ? p.fechaInicio.split('T')[0] : '',
        fechaFin: p.fechaFin ? p.fechaFin.split('T')[0] : '',
        peso: p.peso != null ? String(p.peso) : '',
        grupo: p.grupo?.id || p.grupo?.['@id']?.split('/').pop() || '',
      });
    } else {
      setCurrent(null);
      setFormData({ nombre: '', tipo: 'PRIMERA', fechaInicio: '', fechaFin: '', peso: '', grupo: selectedGrupo || '' });
    }
    setIsModalOpen(true);
  };

  const handleInput = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!formData.grupo) {
      toast.warning(t('evaluations.selectGroup', { defaultValue: 'Selecciona un grupo' }));
      return;
    }
    setSaving(true);
    try {
      const id = current ? getId(current) : null;
      const url = current ? getApiUrl(`/api/periodo_evaluativos/${id}`) : getApiUrl('/api/periodo_evaluativos');
      const method = current ? 'PUT' : 'POST';

      const payload = {
        nombre: formData.nombre,
        tipo: formData.tipo,
        fechaInicio: formData.fechaInicio,
        fechaFin: formData.fechaFin,
        peso: formData.peso === '' ? null : parseFloat(formData.peso),
        grupo: `/api/grupos/${formData.grupo}`,
      };

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/ld+json', 'Accept': 'application/ld+json' },
        body: JSON.stringify(payload),
        credentials: 'include',
      });
      if (!res.ok) {
        const message = await parseErrorResponse(res);
        throw new Error(message);
      }
      fetchPeriodos();
      setIsModalOpen(false);
      toast.success(current
        ? t('evaluations.updatedSuccess', { defaultValue: 'Evaluación actualizada' })
        : t('evaluations.createdSuccess', { defaultValue: 'Evaluación creada' }));
    } catch (err) {
      toast.error(err.message, {
        description: current
          ? t('evaluations.errorUpdating', { defaultValue: 'No se ha podido actualizar la evaluación' })
          : t('evaluations.errorCreating', { defaultValue: 'No se ha podido crear la evaluación' })
      });
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (p) => {
    if (!window.confirm('¿Eliminar esta evaluación?')) return;
    try {
      const id = getId(p);
      const res = await fetch(getApiUrl(`/api/periodo_evaluativos/${id}`), { method: 'DELETE', credentials: 'include' });
      if (!res.ok) {
        const message = await parseErrorResponse(res, t('evaluations.errorDelete', { defaultValue: 'Error al eliminar' }));
        throw new Error(message);
      }
      fetchPeriodos();
      toast.success(t('evaluations.deletedSuccess', { defaultValue: 'Evaluación eliminada' }));
    } catch (err) {
      toast.error(err.message, {
        description: t('evaluations.errorDeletingCtx', { defaultValue: 'No se ha podido eliminar la evaluación' })
      });
    }
  };

  const columns = useMemo(() => [
    { header: 'Nombre', accessor: 'nombre', sortable: true, sortKey: 'nombre' },
    { header: 'Tipo', accessor: (r) => r.tipo, sortable: false },
    {
      header: 'Grupo',
      accessor: (r) => {
        const gid = typeof r.grupo === 'string'
          ? r.grupo.split('/').pop()
          : (r.grupo?.id || r.grupo?.['@id']?.split('/').pop());
        const g = grupos.find(x => String(x.id) === String(gid));
        return g ? (g.nombre || g.abreviatura) : '—';
      },
      sortable: false,
    },
    { header: 'Inicio', accessor: (r) => r.fechaInicio ? new Date(r.fechaInicio).toLocaleDateString() : '—', sortable: true, sortKey: 'fechaInicio' },
    { header: 'Fin', accessor: (r) => r.fechaFin ? new Date(r.fechaFin).toLocaleDateString() : '—', sortable: false },
    { header: 'Peso', accessor: (r) => r.peso != null ? r.peso : '—', sortable: false },
    {
      header: 'Acciones',
      accessor: (r) => (
        <div className={styles.actions}>
          <button className={styles.iconButton} onClick={() => handleOpen(r)} title={t('common.edit')}><Edit2 size={18} /></button>
          <button className={`${styles.iconButton} ${styles.danger}`} onClick={() => handleDelete(r)} title={t('common.delete')}><Trash2 size={18} /></button>
        </div>
      ),
      sortable: false,
    },
  // eslint-disable-next-line react-hooks/exhaustive-deps
  ], [t, grupos]);

  const gruposFiltrados = grupos;

  const toolbar = (
    <>
      {isSuperAdmin && (
        <ThemedSelect
          value={selectedCentro}
          onChange={(v) => { setSelectedCentro(v); setSelectedGrupo(''); }}
          minWidth={200}
          ariaLabel={t('common.allCenters')}
          options={[
            { value: '', label: t('common.allCenters') },
            ...centros.map(c => ({ value: String(c.id), label: c.nombre })),
          ]}
        />
      )}
      <ThemedSelect
        value={selectedGrupo}
        onChange={setSelectedGrupo}
        minWidth={200}
        ariaLabel={t('common.allGroups')}
        options={[
          { value: '', label: t('common.allGroups') },
          ...gruposFiltrados.map(g => ({ value: String(g.id), label: g.nombre })),
        ]}
      />
      {canCreate && (
        <Button onClick={() => handleOpen()}>
          <Plus size={18} style={{ marginRight: '8px' }} />
          {t('common.new')}
        </Button>
      )}
    </>
  );

  const body = (
    <>
      <CrudHeader title={embedded ? t('dates.title') : t('dates.tabEvaluations')}
                  logo={<Lottie animationData={crudAnimation} loop={true} style={{ width: 56, height: 56 }} />}
                  middle={tabs}>
        {toolbar}
      </CrudHeader>

      {error && <div className={styles.errorContainer}><p>{error}</p></div>}

      <DataTable
        columns={columns}
        data={periodos}
        totalItems={totalItems}
        itemsPerPage={itemsPerPage}
        currentPage={currentPage}
        onPageChange={setCurrentPage}
        onItemsPerPageChange={(n) => { setItemsPerPage(n); setCurrentPage(1); }}
        loading={loading}
        sortColumn={sortColumn}
        sortDirection={sortDirection}
        onSort={handleSort}
        mobileBreakpoint={'650px'}
      />

      <ModalView
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title={current ? 'Editar evaluación' : 'Nueva evaluación'}
        onSubmit={handleSubmit}
        isSubmitting={saving}
      >
        <div className={styles.formGroup}>
          <label className={styles.label}>Nombre</label>
          <input type="text" name="nombre" value={formData.nombre} onChange={handleInput} className={styles.input} required />
        </div>
        <div className={styles.formGroup}>
          <label className={styles.label}>Tipo</label>
          <select name="tipo" value={formData.tipo} onChange={handleInput} className={styles.select} style={{ width: '100%' }}>
            {TIPOS.map(tp => <option key={tp} value={tp}>{tp}</option>)}
          </select>
        </div>
        <div className={styles.formGroup}>
          <label className={styles.label}>Grupo</label>
          <select name="grupo" value={formData.grupo} onChange={handleInput} className={styles.select} style={{ width: '100%' }} required>
            <option value="">Selecciona un grupo</option>
            {gruposFiltrados.map(g => <option key={g.id} value={g.id}>{g.nombre}</option>)}
          </select>
        </div>
        <div className={styles.formGroup}>
          <label className={styles.label}>Fecha inicio</label>
          <input type="date" name="fechaInicio" value={formData.fechaInicio} onChange={handleInput} className={styles.input} required />
        </div>
        <div className={styles.formGroup}>
          <label className={styles.label}>Fecha fin</label>
          <input type="date" name="fechaFin" value={formData.fechaFin} onChange={handleInput} className={styles.input} required />
        </div>
        <div className={styles.formGroup}>
          <label className={styles.label}>Peso en nota final (0–1, opcional)</label>
          <input type="number" step="0.01" min="0" max="1" name="peso" value={formData.peso} onChange={handleInput} className={styles.input} placeholder="p. ej. 0.33" />
        </div>
      </ModalView>
    </>
  );

  if (embedded) return body;
  return (
    <Layout>
      <div className={styles.container}>{body}</div>
    </Layout>
  );
};

export default Evaluaciones;
