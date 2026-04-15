import React, { useEffect, useMemo, useState, useCallback } from 'react';
import {
  DndContext,
  PointerSensor,
  TouchSensor,
  KeyboardSensor,
  useSensor,
  useSensors,
  useDraggable,
  useDroppable,
  DragOverlay,
} from '@dnd-kit/core';
import { useBlocker } from 'react-router-dom';
import Layout from '../components/Layout';
import CrudHeader from '../components/CrudHeader';
import Button from '../components/Button';
import ThemedSelect from '../components/ThemedSelect';
import ProfLoadPanel from '../components/ProfLoadPanel';
import ModalView from '../components/ModalView';
import { useAuth } from '../context/AuthContext';
import { useTranslation } from 'react-i18next';
import { CalendarClock, Save, CheckCircle2, AlertTriangle, XCircle, Ban, Sparkles, Shuffle } from 'lucide-react';
import { getApiUrl } from '../config/api';
import Lottie from 'lottie-react';
import timeAnim from '../../public/time.json';
import styles from './HorariosEditor.module.css';

// Convención del sistema: diaSemana 1=Lunes … 5=Viernes
const DIAS = [
  { idx: 1, i18n: 'days.monday' },
  { idx: 2, i18n: 'days.tuesday' },
  { idx: 3, i18n: 'days.wednesday' },
  { idx: 4, i18n: 'days.thursday' },
  { idx: 5, i18n: 'days.friday' },
];

const SLOTS_MANANA = [
  ['08:30:00', '09:30:00'],
  ['09:30:00', '10:30:00'],
  ['10:30:00', '11:30:00'],
  ['11:30:00', '12:30:00'],
  ['12:30:00', '13:30:00'],
  ['13:30:00', '14:30:00'],
];
const SLOTS_TARDE = [
  ['15:00:00', '16:00:00'],
  ['16:00:00', '17:00:00'],
  ['17:00:00', '18:00:00'],
  ['18:00:00', '19:00:00'],
  ['19:00:00', '20:00:00'],
  ['20:00:00', '21:00:00'],
];

const fmtHora = (s) => s.slice(0, 5);

// Paleta por módulo derivada de --color-primary (HSL shift determinístico)
const colorForModule = (mid) => {
  const hue = (mid * 47) % 360;  // determinista
  return `hsl(${hue}, 55%, 48%)`;
};

const getId = (obj) => {
  if (!obj) return null;
  if (typeof obj === 'string') return obj.split('/').pop();
  return obj.id || obj['@id']?.split('/').pop();
};

// ─── Componente chip de módulo (draggable desde el panel) ──────────────
const ModuleChip = ({ imparticion, horasTotales, horasColocadas, color, selected, onSelect }) => {
  const id = `mod:${imparticion.id}`;
  const disabled = horasColocadas >= horasTotales;
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id,
    data: { type: 'module', imparticionId: imparticion.id },
    disabled,
  });

  const done = horasColocadas >= horasTotales;

  return (
    <div
      ref={setNodeRef}
      className={`${styles.moduleChip} ${isDragging ? styles.moduleChipDragging : ''} ${done ? styles.moduleChipDone : ''} ${selected ? styles.moduleChipSelected : ''}`}
      {...listeners}
      {...attributes}
      onClick={(e) => {
        if (disabled) return;
        // El click no debe disparar si el drag lo interceptó; dnd-kit con distance:4 deja pasar clicks cortos.
        e.stopPropagation();
        onSelect?.(imparticion.id);
      }}
    >
      <span className={styles.moduleDot} style={{ backgroundColor: color }} />
      <div className={styles.moduleMeta}>
        <span className={styles.moduleName}>{imparticion.modulo?.nombre || '—'}</span>
        <span className={styles.moduleProfe}>
          {imparticion.profesor ? `${imparticion.profesor.nombre || ''} ${imparticion.profesor.apellidos || ''}`.trim() : '—'}
        </span>
      </div>
      <span className={styles.moduleCounter}>{horasColocadas}/{horasTotales}</span>
    </div>
  );
};

// ─── Bloque dentro de un slot (draggable para eliminar al panel) ───────
const SlotBlock = ({ slotId, imparticion, color, aula }) => {
  const id = `slot:${slotId}`;
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id,
    data: { type: 'placed', slotId, imparticionId: imparticion.id },
  });
  const profeFull = `${imparticion.profesor?.nombre || ''} ${imparticion.profesor?.apellidos || ''}`.trim() || '—';
  return (
    <div
      ref={setNodeRef}
      className={styles.slotBlock}
      style={{ backgroundColor: color, opacity: isDragging ? 0.4 : 1 }}
      {...listeners}
      {...attributes}
    >
      <span className={styles.slotBlockTitle}>{imparticion.modulo?.nombre}</span>
      <span className={styles.slotBlockProfe}>
        {(imparticion.profesor?.apellidos || '').split(' ')[0]}
      </span>
      <div className={styles.slotTooltip} role="tooltip">
        <strong>{imparticion.modulo?.nombre || '—'}</strong>
        <span>{profeFull}</span>
        {aula && <span className={styles.slotTooltipAula}>{aula}</span>}
      </div>
    </div>
  );
};

// ─── Celda droppable ───────────────────────────────────────────────────
const SlotCell = ({ dia, slot, content, dragActive, valid, tapMode, tapValid, onTap }) => {
  const id = `cell:${dia}:${slot}`;
  const { isOver, setNodeRef } = useDroppable({
    id,
    data: { type: 'cell', dia, slot },
  });
  let cls = styles.slot;
  if (!content) cls += ` ${styles.slotEmpty}`;
  if (dragActive) {
    if (valid === false) cls += ` ${styles.slotDropInvalid}`;
    else if (valid === true) cls += ` ${styles.slotDropValid}`;
  } else if (tapMode) {
    if (tapValid === false) cls += ` ${styles.slotDropInvalid}`;
    else if (tapValid === true) cls += ` ${styles.slotDropValid}`;
  }
  if (isOver) cls += ` ${styles.slotDropActive}`;
  return (
    <div ref={setNodeRef} className={cls} onClick={onTap}>
      {content}
    </div>
  );
};

// ─── Componente principal ──────────────────────────────────────────────
const HorariosEditor = ({ embedded = false, tabs = null }) => {
  const { t } = useTranslation();
  const { user } = useAuth();
  const isSuperAdmin = user?.roles?.includes('ROLE_SUPERADMIN');

  const [grupos, setGrupos] = useState([]);
  const [selectedYear, setSelectedYear] = useState('');
  const [selectedGrupo, setSelectedGrupo] = useState('');
  // imparticiones indexadas por grupo para conservar entre cambios de selector
  const [imparticiones, setImparticiones] = useState({});
  // Mapa de ocupación de profesores en grupos paralelos: "dia_hora" → Set<profesorId>
  const [parallelBusy, setParallelBusy] = useState({});
  // Horas semanales de cada profe en otros grupos (no el actual): { profId: N }
  const [otherGroupsHours, setOtherGroupsHours] = useState({});
  const [dragError, setDragError] = useState(null);
  // Estado por grupo: { [gid]: { placements: { "dia_slot": {imparticionId, aula, hid?} }, dirty: bool } }
  const [state, setState] = useState({});
  const [saving, setSaving] = useState(false);
  const [solving, setSolving] = useState(false);
  const [solverSeed, setSolverSeed] = useState(null);
  const [activeDrag, setActiveDrag] = useState(null);
  // Tap-to-place: id de imparticion seleccionada (o null)
  const [selectedImpId, setSelectedImpId] = useState(null);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 200, tolerance: 5 } }),
    useSensor(KeyboardSensor),
  );

  // 1) Cargar grupos accesibles por el usuario
  useEffect(() => {
    const url = isSuperAdmin
      ? '/api/grupos?pagination=false'
      : `/api/grupos?centro=${user?.centro?.id || ''}&pagination=false`;
    fetch(getApiUrl(url), { headers: { 'Accept': 'application/ld+json' }, credentials: 'include' })
      .then(r => r.json())
      .then(d => {
        const items = d['hydra:member'] || d.member || [];
        setGrupos(items);
        if (items.length === 0) return;
        // Año escolar inicial: el más reciente presente
        const years = [...new Set(items.map(g => g.anioEscolar).filter(Boolean))].sort().reverse();
        if (!selectedYear && years.length > 0) {
          setSelectedYear(years[0]);
          const primero = items.find(g => g.anioEscolar === years[0]);
          if (primero) setSelectedGrupo(String(primero.id));
        } else if (!selectedGrupo) {
          setSelectedGrupo(String(items[0].id));
        }
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isSuperAdmin, user?.centro?.id]);

  // 2) Cargar imparticiones y horarios del grupo seleccionado
  useEffect(() => {
    if (!selectedGrupo) return;
    if (state[selectedGrupo]) return;  // ya cargado, mantener trabajo en progreso

    const noCache = { 'Accept': 'application/ld+json', 'Cache-Control': 'no-cache', 'Pragma': 'no-cache' };
    const bust = Date.now();
    Promise.all([
      fetch(getApiUrl(`/api/imparticions?grupo=${selectedGrupo}&pagination=false&_=${bust}`),
        { headers: noCache, credentials: 'include', cache: 'no-store' }).then(r => r.json()),
      fetch(getApiUrl(`/api/horarios?imparticion.grupo=${selectedGrupo}&itemsPerPage=500&_=${bust}`),
        { headers: noCache, credentials: 'include', cache: 'no-store' }).then(r => r.json()),
    ]).then(([impData, horData]) => {
      const imps = impData['hydra:member'] || impData.member || [];
      const impIds = new Set(imps.map(i => Number(i.id)));
      let horarios = horData['hydra:member'] || horData.member || [];
      // Fallback defensivo: si el filtro del backend no filtra (cache viejo),
      // filtramos en cliente por las imparticiones del grupo.
      horarios = horarios.filter(h => impIds.has(Number(getId(h.imparticion))));

      // horaInicio puede venir como ISO ("1970-01-01T08:30:00+00:00") o como "HH:MM:SS" o "HH:MM".
      const normHora = (v) => {
        if (!v) return null;
        const s = String(v);
        const m = s.match(/(\d{2}):(\d{2})(?::(\d{2}))?/);
        if (!m) return null;
        return `${m[1]}:${m[2]}:${m[3] || '00'}`;
      };

      const placements = {};
      horarios.forEach(h => {
        const hi = normHora(h.horaInicio);
        const hf = normHora(h.horaFin);
        if (!hi) return;
        const key = `${h.diaSemana}_${hi}`;
        placements[key] = {
          imparticionId: Number(getId(h.imparticion)),
          aula: h.aula,
          hid: h.id,
          horaInicio: hi,
          horaFin: hf,
        };
      });
      setImparticiones(prev => ({ ...prev, [selectedGrupo]: imps }));
      setState(prev => ({ ...prev, [selectedGrupo]: { placements, dirty: false, baseline: { ...placements } } }));
    });
  }, [selectedGrupo, state]);

  // Cargar ocupación de profes en grupos paralelos (mismo turno, mismo centro)
  useEffect(() => {
    if (!selectedGrupo || grupos.length === 0) return;
    const gActual = grupos.find(g => String(g.id) === String(selectedGrupo));
    if (!gActual) return;
    const cicloNombre = (gActual.ciclo?.nombre || '').toUpperCase();
    const mismoTurno = (g) => {
      if (String(g.id) === String(selectedGrupo)) return false;
      const cn = (g.ciclo?.nombre || '').toUpperCase();
      if (cicloNombre.includes('WEB')) return cn.includes('WEB');
      if (cicloNombre.includes('MULTIPLATAFORMA')) return cn.includes('MULTIPLATAFORMA');
      return false;
    };
    const paralelos = grupos.filter(mismoTurno).map(g => g.id);
    if (paralelos.length === 0) { setParallelBusy({}); return; }
    const bust = Date.now();
    const noCache = { 'Accept': 'application/ld+json', 'Cache-Control': 'no-cache' };
    Promise.all(paralelos.map(gid =>
      fetch(getApiUrl(`/api/horarios?imparticion.grupo=${gid}&itemsPerPage=500&_=${bust}`),
        { headers: noCache, credentials: 'include', cache: 'no-store' }).then(r => r.json())
    )).then(results => {
      const normHora = (v) => {
        if (!v) return null;
        const m = String(v).match(/(\d{2}):(\d{2})(?::(\d{2}))?/);
        return m ? `${m[1]}:${m[2]}:${m[3] || '00'}` : null;
      };
      const busy = {};
      results.forEach(d => {
        const items = d['hydra:member'] || d.member || [];
        items.forEach(h => {
          const hi = normHora(h.horaInicio);
          if (!hi) return;
          const profId = h.imparticion?.profesor?.id
            ?? h.imparticion?.profesor?.['@id']?.split('/').pop()
            ?? (typeof h.imparticion?.profesor === 'string' ? h.imparticion.profesor.split('/').pop() : null);
          if (!profId) return;
          const key = `${h.diaSemana}_${hi}`;
          if (!busy[key]) busy[key] = new Set();
          busy[key].add(Number(profId));
        });
      });
      setParallelBusy(busy);
    });

    // Horas semanales de cada profe en OTROS grupos (no el actual)
    const paralelosYRestoIds = grupos.filter(g => String(g.id) !== String(selectedGrupo)).map(g => g.id);
    if (paralelosYRestoIds.length === 0) { setOtherGroupsHours({}); return; }
    const bust2 = Date.now();
    Promise.all(paralelosYRestoIds.map(gid =>
      fetch(getApiUrl(`/api/horarios?imparticion.grupo=${gid}&itemsPerPage=500&_=${bust2}`),
        { headers: { 'Accept': 'application/ld+json', 'Cache-Control': 'no-cache' },
          credentials: 'include', cache: 'no-store' }).then(r => r.json())
    )).then(results => {
      const hours = {};
      results.forEach(d => {
        const items = d['hydra:member'] || d.member || [];
        items.forEach(h => {
          const pid = h.imparticion?.profesor?.id
            ?? h.imparticion?.profesor?.['@id']?.split('/').pop();
          if (!pid) return;
          const key = String(pid);
          hours[key] = (hours[key] || 0) + 1;
        });
      });
      setOtherGroupsHours(hours);
    });
  }, [selectedGrupo, grupos]);

  const grupo = useMemo(() => grupos.find(g => String(g.id) === String(selectedGrupo)), [grupos, selectedGrupo]);
  const imps = imparticiones[selectedGrupo] || [];
  const grupoState = state[selectedGrupo];
  const placements = grupoState?.placements || {};

  // Turno del grupo: DAW (ciclo DAW en EAG es id 3) → mañana; DAM (id 4) → tarde.
  // Generalización: ciclo nombre contiene "DAW"? mañana; caso contrario tarde.
  const turnoGrupo = useMemo(() => {
    if (!grupo) return 'M';
    const cicloNombre = (grupo.ciclo?.nombre || '').toUpperCase();
    if (cicloNombre.includes('WEB')) return 'M';
    if (cicloNombre.includes('MULTIPLATAFORMA')) return 'T';
    return 'M';
  }, [grupo]);

  const slotsDia = turnoGrupo === 'M' ? SLOTS_MANANA : SLOTS_TARDE;

  // Horas colocadas por imparticion
  const horasColocadas = useMemo(() => {
    const h = {};
    Object.values(placements).forEach(p => {
      h[p.imparticionId] = (h[p.imparticionId] || 0) + 1;
    });
    return h;
  }, [placements]);

  const totalHoras = imps.reduce((a, i) => a + (i.modulo?.horasSemanales || 0), 0);
  const colocadasTotal = Object.keys(placements).length;
  const completitud = totalHoras ? (colocadasTotal / totalHoras) * 100 : 0;
  const estado =
    colocadasTotal === totalHoras && totalHoras > 0 ? 'complete' :
    completitud >= 80 ? 'draft' : 'incomplete';

  const estadoBadge = {
    complete:   { cls: styles.statusComplete,   icon: <CheckCircle2 size={16} />, label: t('scheduleEditor.statusComplete',   { done: colocadasTotal, total: totalHoras }) },
    draft:      { cls: styles.statusDraft,      icon: <AlertTriangle size={16} />, label: t('scheduleEditor.statusDraft',      { done: colocadasTotal, total: totalHoras }) },
    incomplete: { cls: styles.statusIncomplete, icon: <XCircle size={16} />,      label: t('scheduleEditor.statusIncomplete', { done: colocadasTotal, total: totalHoras }) },
  }[estado];

  // Mapa de imparticion por id (acceso rápido para validación)
  const impById = useMemo(() => {
    const m = {};
    imps.forEach(i => { m[i.id] = i; });
    return m;
  }, [imps]);

  // Carga semanal por profesor del grupo actual (live: otros grupos + placements actuales)
  const profeCarga = useMemo(() => {
    // Horas del grupo actual desde placements
    const currentHoursPerProf = {};
    Object.values(placements).forEach(p => {
      const imp = impById[p.imparticionId];
      const pid = imp?.profesor?.id;
      if (pid) currentHoursPerProf[pid] = (currentHoursPerProf[pid] || 0) + 1;
    });
    // Unificar profes (los del grupo actual)
    const profesUnicos = new Map();
    imps.forEach(i => {
      if (i.profesor?.id && !profesUnicos.has(i.profesor.id)) {
        profesUnicos.set(i.profesor.id, i.profesor);
      }
    });
    const result = [];
    profesUnicos.forEach((profe, pid) => {
      const enOtros = otherGroupsHours[pid] || 0;
      const enActual = currentHoursPerProf[pid] || 0;
      result.push({
        profe,
        enOtros,
        enActual,
        total: enOtros + enActual,
      });
    });
    result.sort((a, b) => b.total - a.total);
    return result;
  }, [placements, impById, imps, otherGroupsHours]);

  // Validación de drop: devuelve {ok, reason}
  const validateDrop = useCallback((drag, diaIdx, slotIdx) => {
    if (!drag) return { ok: true };
    const key = `${diaIdx}_${slotsDia[slotIdx][0]}`;
    const impId = drag.imparticionId;
    const imp = impById[impId];
    if (!imp) return { ok: false, reason: t('scheduleEditor.reasonUnknownImp') };

    // Regla 1: horas restantes > 0 (solo para panel → celda; en swap las horas no cambian globalmente)
    if (drag.type === 'module') {
      const total = imp.modulo?.horasSemanales || 0;
      if ((horasColocadas[impId] || 0) >= total) {
        return { ok: false, reason: t('scheduleEditor.reasonModuleFull', { total, module: imp.modulo?.nombre }) };
      }
      // Regla extra: la celda debe estar vacía
      if (placements[key]) {
        return { ok: false, reason: t('scheduleEditor.reasonCellOccupied') };
      }
    }

    // Regla 2: profesor ocupado en grupo paralelo
    const profId = imp.profesor?.id;
    if (profId && parallelBusy[key]?.has(Number(profId))) {
      const teacher = `${imp.profesor?.nombre || ''} ${imp.profesor?.apellidos || ''}`.trim();
      return { ok: false, reason: t('scheduleEditor.reasonTeacherBusy', { teacher }) };
    }

    return { ok: true };
  }, [slotsDia, impById, horasColocadas, placements, parallelBusy]);

  // Drag handlers
  const onDragStart = useCallback((e) => {
    setActiveDrag(e.active?.data?.current || null);
    setDragError(null);
  }, []);

  const onDragEnd = useCallback((e) => {
    setActiveDrag(null);
    const a = e.active?.data?.current;
    const o = e.over?.data?.current;
    if (!a) return;

    // Caso: de panel a celda
    if (a.type === 'module' && o?.type === 'cell') {
      const validation = validateDrop(a, o.dia, o.slot);
      if (!validation.ok) {
        setDragError(validation.reason);
        window.setTimeout(() => setDragError(null), 4000);
        return;
      }
      const key = `${o.dia}_${slotsDia[o.slot][0]}`;
      setState(prev => ({
        ...prev,
        [selectedGrupo]: {
          ...prev[selectedGrupo],
          placements: {
            ...prev[selectedGrupo].placements,
            [key]: {
              imparticionId: a.imparticionId,
              aula: grupo?.abreviatura ? `Aula ${grupo.abreviatura}` : 'Aula',
              horaInicio: slotsDia[o.slot][0],
              horaFin: slotsDia[o.slot][1],
            },
          },
          dirty: true,
        },
      }));
    }

    // Caso: de celda a panel (fuera de toda celda, o arrastrado y soltado sin over)
    if (a.type === 'placed' && !o) {
      setState(prev => {
        const p = { ...prev[selectedGrupo].placements };
        delete p[a.slotId];
        return { ...prev, [selectedGrupo]: { ...prev[selectedGrupo], placements: p, dirty: true } };
      });
    }

    // Caso: de celda a celda (swap/mover)
    if (a.type === 'placed' && o?.type === 'cell') {
      const srcKey = a.slotId;
      const dstHoraIni = slotsDia[o.slot][0];
      const dstHoraFin = slotsDia[o.slot][1];
      const dstKey = `${o.dia}_${dstHoraIni}`;
      if (srcKey === dstKey) return;
      // Validar que el profe del item movido no colisione en el destino con grupos paralelos
      const validation = validateDrop(a, o.dia, o.slot);
      if (!validation.ok) {
        setDragError(validation.reason);
        window.setTimeout(() => setDragError(null), 4000);
        return;
      }
      // Si hay un bloque en destino, validar también ese (va a ir a srcKey)
      const dstPlacement = placements[dstKey];
      if (dstPlacement) {
        const [srcDia, srcHoraIniKey] = srcKey.split('_');
        const srcSlotIdx = slotsDia.findIndex(s => s[0] === srcHoraIniKey);
        const dstDragLike = { type: 'placed', imparticionId: dstPlacement.imparticionId, slotId: dstKey };
        const v2 = validateDrop(dstDragLike, parseInt(srcDia, 10), srcSlotIdx);
        if (!v2.ok) {
          setDragError(v2.reason);
          window.setTimeout(() => setDragError(null), 4000);
          return;
        }
      }
      const [srcDia, srcHoraIni] = srcKey.split('_');
      const srcSlot = slotsDia.find(s => s[0] === srcHoraIni);
      const srcHoraFin = srcSlot ? srcSlot[1] : null;
      setState(prev => {
        const p = { ...prev[selectedGrupo].placements };
        const src = p[srcKey];
        const dst = p[dstKey];
        // Al mover, actualizamos horaInicio/horaFin del objeto a su NUEVA posición
        p[dstKey] = { ...src, horaInicio: dstHoraIni, horaFin: dstHoraFin };
        if (dst) p[srcKey] = { ...dst, horaInicio: srcHoraIni, horaFin: srcHoraFin };
        else delete p[srcKey];
        return { ...prev, [selectedGrupo]: { ...prev[selectedGrupo], placements: p, dirty: true } };
      });
    }
  }, [selectedGrupo, placements, imps, horasColocadas, slotsDia, grupo]);

  // Guardar cambios
  const handleSave = async () => {
    if (!grupoState?.dirty) return;
    setSaving(true);
    try {
      const baseline = grupoState.baseline || {};
      const current = grupoState.placements || {};
      const toCreate = [];
      const toDelete = [];
      // Creates + updates
      Object.entries(current).forEach(([key, v]) => {
        const old = baseline[key];
        if (!old) { toCreate.push({ key, v }); return; }
        if (old.imparticionId !== v.imparticionId) {
          // eliminamos el viejo y creamos el nuevo (simpler que hacer PUT cruzado)
          toDelete.push(old.hid);
          toCreate.push({ key, v });
        }
      });
      // Pure deletes
      Object.entries(baseline).forEach(([key, v]) => {
        if (!current[key] && v.hid) toDelete.push(v.hid);
      });

      // Apply deletes
      const errors = [];
      for (const hid of toDelete) {
        const res = await fetch(getApiUrl(`/api/horarios/${hid}`), { method: 'DELETE', credentials: 'include' });
        if (!res.ok) {
          errors.push(`DELETE ${hid} → ${res.status}`);
        }
      }
      // Apply creates
      const nuevos = [];
      for (const { key, v } of toCreate) {
        const [diaStr, hiFromKey] = key.split('_');
        // Hora derivada del KEY, no de v (v conserva horaInicio antigua tras swaps)
        const slot = slotsDia.find(s => s[0] === hiFromKey);
        const hi = (hiFromKey || '').slice(0, 5);
        const hf = slot ? slot[1].slice(0, 5) : (v.horaFin || '').slice(0, 5);
        const body = {
          diaSemana: parseInt(diaStr, 10),
          horaInicio: hi,
          horaFin: hf,
          aula: v.aula,
          imparticion: `/api/imparticions/${v.imparticionId}`,
        };
        const res = await fetch(getApiUrl('/api/horarios'), {
          method: 'POST',
          headers: { 'Content-Type': 'application/ld+json', 'Accept': 'application/ld+json' },
          credentials: 'include',
          body: JSON.stringify(body),
        });
        if (res.ok) {
          const data = await res.json();
          nuevos.push({ key, hid: data.id || getId(data['@id']) });
        } else {
          const txt = await res.text().catch(() => '');
          errors.push(`POST ${key} → ${res.status}: ${txt.slice(0, 200)}`);
        }
      }
      if (errors.length) {
        alert(`Algunos cambios no se guardaron:\n\n${errors.join('\n')}`);
      }

      // Actualizar baseline
      const newBaseline = { ...current };
      nuevos.forEach(({ key, hid }) => { newBaseline[key] = { ...newBaseline[key], hid }; });
      setState(prev => ({
        ...prev,
        [selectedGrupo]: { ...prev[selectedGrupo], placements: newBaseline, baseline: newBaseline, dirty: false },
      }));
    } catch (err) {
      alert(t('scheduleEditor.saveError', { message: err.message }));
    } finally {
      setSaving(false);
    }
  };

  // Tap-to-place: toggle selección del módulo en el panel
  const handleSelectModule = useCallback((impId) => {
    setSelectedImpId(prev => prev === impId ? null : impId);
  }, []);

  // Tap en celda: si hay módulo seleccionado, intentar colocar; si la celda está
  // ocupada y no hay selección, quitar el bloque.
  const handleTapCell = useCallback((diaIdx, slotIdx) => {
    const key = `${diaIdx}_${slotsDia[slotIdx][0]}`;
    const existing = placements[key];

    if (selectedImpId) {
      const drag = { type: 'module', imparticionId: selectedImpId };
      // Si la celda está ocupada con otra imparticion, tratar como "reemplazo":
      // validamos como si fuese drag desde panel (requiere celda vacía), así que
      // primero la vaciamos localmente para la validación.
      const effectivePlacements = existing ? (() => {
        const clone = { ...placements };
        delete clone[key];
        return clone;
      })() : placements;
      const imp = impById[selectedImpId];
      if (!imp) return;
      const total = imp.modulo?.horasSemanales || 0;
      const ya = Object.values(effectivePlacements).filter(p => p.imparticionId === selectedImpId).length;
      if (ya >= total) {
        setDragError(t('scheduleEditor.reasonModuleFull', { total, module: imp.modulo?.nombre }));
        window.setTimeout(() => setDragError(null), 4000);
        return;
      }
      const profId = imp.profesor?.id;
      if (profId && parallelBusy[key]?.has(Number(profId))) {
        const teacher = `${imp.profesor?.nombre || ''} ${imp.profesor?.apellidos || ''}`.trim();
        setDragError(t('scheduleEditor.reasonTeacherBusy', { teacher }));
        window.setTimeout(() => setDragError(null), 4000);
        return;
      }
      setState(prev => ({
        ...prev,
        [selectedGrupo]: {
          ...prev[selectedGrupo],
          placements: {
            ...effectivePlacements,
            [key]: {
              imparticionId: selectedImpId,
              aula: grupo?.abreviatura ? `Aula ${grupo.abreviatura}` : 'Aula',
              horaInicio: slotsDia[slotIdx][0],
              horaFin: slotsDia[slotIdx][1],
            },
          },
          dirty: true,
        },
      }));
      // Si el módulo ya alcanzó sus horas, deseleccionamos
      if (ya + 1 >= total) setSelectedImpId(null);
      return;
    }

    // Sin selección y celda ocupada → quitar
    if (existing) {
      setState(prev => {
        const p = { ...prev[selectedGrupo].placements };
        delete p[key];
        return { ...prev, [selectedGrupo]: { ...prev[selectedGrupo], placements: p, dirty: true } };
      });
    }
  }, [selectedImpId, placements, impById, parallelBusy, selectedGrupo, slotsDia, grupo, t]);

  // Validación ligera para pintar tap-mode
  const validateTap = useCallback((diaIdx, slotIdx) => {
    if (!selectedImpId) return null;
    const key = `${diaIdx}_${slotsDia[slotIdx][0]}`;
    if (placements[key]) return false;
    const imp = impById[selectedImpId];
    if (!imp) return false;
    const total = imp.modulo?.horasSemanales || 0;
    if ((horasColocadas[selectedImpId] || 0) >= total) return false;
    const profId = imp.profesor?.id;
    if (profId && parallelBusy[key]?.has(Number(profId))) return false;
    return true;
  }, [selectedImpId, slotsDia, placements, impById, horasColocadas, parallelBusy]);

  // ESC deselecciona
  useEffect(() => {
    if (!selectedImpId) return;
    const h = (e) => { if (e.key === 'Escape') setSelectedImpId(null); };
    window.addEventListener('keydown', h);
    return () => window.removeEventListener('keydown', h);
  }, [selectedImpId]);

  // Solver: pide propuesta al backend y pinta el estado (sin persistir)
  const runSolver = async (seed = null) => {
    if (!selectedGrupo) return;
    const hasContent = Object.keys(placements).length > 0;
    if (hasContent && !window.confirm(t('scheduleEditor.solverConfirmOverwrite'))) return;
    setSolving(true);
    setDragError(null);
    try {
      const res = await fetch(getApiUrl(`/api/v1/horarios/solver/${selectedGrupo}`), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(seed !== null ? { seed } : {}),
      });
      if (!res.ok) {
        const txt = await res.text().catch(() => '');
        throw new Error(`${res.status}: ${txt.slice(0, 200)}`);
      }
      const data = await res.json();
      // eslint-disable-next-line no-console
      console.groupCollapsed(`[Solver] grupo=${selectedGrupo} seed=${seed} complete=${data.complete} placed=${data.placements?.length}/${data.debug?.totalHorasAColocar}`);
      // eslint-disable-next-line no-console
      console.log('Respuesta cruda:', data);
      // eslint-disable-next-line no-console
      console.log('Debug:', data.debug);
      // eslint-disable-next-line no-console
      console.table(data.debug?.imparticiones || []);
      // eslint-disable-next-line no-console
      console.log('Parallel busy cells:', data.debug?.parallelBusy);
      // eslint-disable-next-line no-console
      console.log('Unplaced:', data.unplaced);
      // eslint-disable-next-line no-console
      console.log('Placements:', data.placements);
      // eslint-disable-next-line no-console
      console.groupEnd();
      const newPlacements = {};
      (data.placements || []).forEach(p => {
        const hi = String(p.horaInicio).slice(0, 8);
        const key = `${p.diaSemana}_${hi}`;
        newPlacements[key] = {
          imparticionId: p.imparticionId,
          aula: p.aula,
          horaInicio: hi,
          horaFin: String(p.horaFin).slice(0, 8),
        };
      });
      setState(prev => ({
        ...prev,
        [selectedGrupo]: {
          ...prev[selectedGrupo],
          placements: newPlacements,
          dirty: true,
        },
      }));
      setSolverSeed(seed);
      if (!data.complete && data.unplaced?.length) {
        const faltan = data.unplaced.map(u => `${u.modulo}: ${u.horasRestantes}h`).join(', ');
        setDragError(t('scheduleEditor.solverPartial', { items: faltan }));
        window.setTimeout(() => setDragError(null), 6000);
      }
    } catch (err) {
      alert(t('scheduleEditor.solverError', { message: err.message }));
    } finally {
      setSolving(false);
    }
  };

  const dirtyAny = Object.values(state).some(s => s?.dirty);

  // Bloquea navegación SPA (sidebar, atrás…) si hay cambios sin guardar.
  // El modal custom sustituye al beforeunload nativo (que mostraba un alert feo
  // y redundante con el modal).
  const blocker = useBlocker(({ currentLocation, nextLocation }) =>
    dirtyAny && currentLocation.pathname !== nextLocation.pathname
  );

  const renderSlotContent = (dia, slotIdx) => {
    const key = `${dia}_${slotsDia[slotIdx][0]}`;
    const p = placements[key];
    if (!p) return null;
    const imp = imps.find(i => i.id === p.imparticionId);
    if (!imp) return null;
    return (
      <SlotBlock
        slotId={key}
        imparticion={imp}
        color={colorForModule(imp.modulo?.id || p.imparticionId)}
        aula={p.aula}
      />
    );
  };

  const activeImp = activeDrag?.imparticionId ? imps.find(i => i.id === activeDrag.imparticionId) : null;

  const Wrapper = embedded ? React.Fragment : Layout;
  const Container = embedded ? React.Fragment : ({ children }) => <div className={styles.container}>{children}</div>;
  return (
    <Wrapper>
      <Container>
        <CrudHeader
          title={embedded ? t('schedules.title') : t('scheduleEditor.title')}
          logo={<Lottie animationData={timeAnim} loop={true} style={{ width: 60, height: 60 }} />}
          middle={tabs}
        >
          <ThemedSelect
            value={selectedYear}
            onChange={(y) => {
              setSelectedYear(y);
              // Primer grupo del año elegido queda seleccionado
              const primero = grupos.find(g => g.anioEscolar === y);
              setSelectedGrupo(primero ? String(primero.id) : '');
            }}
            minWidth={160}
            ariaLabel={t('scheduleEditor.selectYear')}
            options={[...new Set(grupos.map(g => g.anioEscolar).filter(Boolean))]
              .sort().reverse()
              .map(y => ({ value: y, label: y }))}
          />
          <ThemedSelect
            value={selectedGrupo}
            onChange={setSelectedGrupo}
            minWidth={220}
            ariaLabel={t('scheduleEditor.selectGroup')}
            options={grupos
              .filter(g => !selectedYear || g.anioEscolar === selectedYear)
              .map(g => ({
                value: String(g.id),
                label: g.nombre,
              }))}
          />
          <div className={styles.spacer} />
          <Button onClick={handleSave} disabled={!grupoState?.dirty || saving}>
            <Save size={16} style={{ marginRight: 6 }} />
            {saving ? t('scheduleEditor.saving') : (grupoState?.dirty ? t('scheduleEditor.saveChanges') : t('scheduleEditor.saved'))}
          </Button>
        </CrudHeader>

        {!selectedGrupo || !grupoState ? (
          <div className={styles.emptyState}>{t('scheduleEditor.emptyState')}</div>
        ) : (
          <DndContext sensors={sensors} onDragStart={onDragStart} onDragEnd={onDragEnd}>
            <div className={styles.editorLayout}>
              <aside className={styles.modulesPanel}>
                <h3 className={styles.panelTitle}>{t('scheduleEditor.panelModules', { count: imps.length })}</h3>
                {imps.map(imp => (
                  <ModuleChip
                    key={imp.id}
                    imparticion={imp}
                    horasTotales={imp.modulo?.horasSemanales || 0}
                    horasColocadas={horasColocadas[imp.id] || 0}
                    color={colorForModule(imp.modulo?.id || imp.id)}
                    selected={selectedImpId === imp.id}
                    onSelect={handleSelectModule}
                  />
                ))}
                <p style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)', marginTop: 'var(--space-3)' }}>
                  {t('scheduleEditor.panelHint')}
                </p>
                {estadoBadge && (
                  <span className={`${styles.statusBadge} ${estadoBadge.cls} ${styles.panelStatus}`}>
                    {estadoBadge.icon}
                    {estadoBadge.label}
                  </span>
                )}
              </aside>

              <div className={styles.grid}>
                <div className={styles.gridHeader}>
                  <div>Hora</div>
                  {DIAS.map(d => {
                    const full = t(d.i18n);
                    return (
                      <div key={d.idx}>
                        <span className={styles.dayFull}>{full}</span>
                        <span className={styles.dayShort}>{full.charAt(0).toUpperCase()}</span>
                      </div>
                    );
                  })}
                </div>
                {slotsDia.map((slotRange, slotIdx) => (
                  <div key={slotIdx} className={styles.gridRow}>
                    <div className={styles.timeLabel}>
                      <span>{fmtHora(slotRange[0])}</span>
                      <span className={styles.timeLabelSep}>–</span>
                      <span>{fmtHora(slotRange[1])}</span>
                    </div>
                    {DIAS.map((d) => {
                      const validation = activeDrag ? validateDrop(activeDrag, d.idx, slotIdx) : null;
                      const tapValid = !activeDrag && selectedImpId ? validateTap(d.idx, slotIdx) : null;
                      return (
                        <SlotCell
                          key={`${d.idx}_${slotIdx}`}
                          dia={d.idx}
                          slot={slotIdx}
                          content={renderSlotContent(d.idx, slotIdx)}
                          dragActive={!!activeDrag}
                          valid={validation ? validation.ok : null}
                          tapMode={!!selectedImpId}
                          tapValid={tapValid}
                          onTap={() => handleTapCell(d.idx, slotIdx)}
                        />
                      );
                    })}
                  </div>
                ))}
                <div className={styles.infoBar}>
                  <span><b>{t('scheduleEditor.turno')}:</b> {turnoGrupo === 'M' ? t('scheduleEditor.turnoMorning') : t('scheduleEditor.turnoAfternoon')}</span>
                  <span><b>{t('scheduleEditor.classroom')}:</b> {grupo?.abreviatura || grupo?.nombre || '—'}</span>
                  <div className={styles.infoBarActions}>
                    <Button
                      onClick={() => runSolver(null)}
                      disabled={!selectedGrupo || !grupoState || solving || saving}
                      variant="secondary"
                    >
                      <Sparkles size={14} style={{ marginRight: 4 }} />
                      {solving ? t('scheduleEditor.solving') : t('scheduleEditor.solverSuggest')}
                    </Button>
                    <Button
                      onClick={() => runSolver(Date.now())}
                      disabled={!selectedGrupo || !grupoState || solving || saving}
                      variant="secondary"
                      title={t('scheduleEditor.solverSuggestAnotherHint')}
                    >
                      <Shuffle size={14} style={{ marginRight: 4 }} />
                      {t('scheduleEditor.solverSuggestAnother')}
                    </Button>
                  </div>
                </div>
              </div>
            </div>

            <ProfLoadPanel profeCarga={profeCarga} max={40} />

            <DragOverlay dropAnimation={null}>
              {activeImp ? (
                <div className={styles.dragOverlay} style={{ backgroundColor: colorForModule(activeImp.modulo?.id || activeImp.id) }}>
                  {activeImp.modulo?.nombre}
                </div>
              ) : null}
            </DragOverlay>
          </DndContext>
        )}

        {dragError && (
          <div className={styles.errorToast} role="alert">
            <Ban size={18} />
            <span>{dragError}</span>
          </div>
        )}

        <ModalView
          isOpen={blocker?.state === 'blocked'}
          onClose={() => blocker.reset?.()}
          title={t('scheduleEditor.unsavedTitle')}
          size="small"
          cancelText={t('scheduleEditor.unsavedStay')}
          footer={
            <>
              <Button type="button" variant="secondary" onClick={() => blocker.reset?.()}>
                {t('scheduleEditor.unsavedStay')}
              </Button>
              <Button type="button" variant="danger" onClick={() => blocker.proceed?.()}>
                {t('scheduleEditor.unsavedDiscard')}
              </Button>
              <Button
                type="button"
                onClick={async () => {
                  await handleSave();
                  blocker.proceed?.();
                }}
                disabled={saving}
              >
                {saving ? t('scheduleEditor.saving') : t('scheduleEditor.unsavedSaveAndLeave')}
              </Button>
            </>
          }
        >
          <p>{t('scheduleEditor.unsavedBody')}</p>
        </ModalView>
      </Container>
    </Wrapper>
  );
};

export default HorariosEditor;
