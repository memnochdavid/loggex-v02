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
import MateriaLabel from '../components/MateriaLabel';
import { useAuth } from '../context/AuthContext';
import { useTranslation } from 'react-i18next';
import { CalendarClock, Save, CheckCircle2, AlertTriangle, XCircle, Ban, Sparkles, Shuffle, Download } from 'lucide-react';
import { getApiUrl } from '../config/api';
import { downloadFileFromApi } from '../utils/downloadFile';
import { toast } from '../utils/toast';
import { useConfirm } from '../context/ConfirmContext';
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

// Slots y recreos ahora se derivan de `JornadaTipo` del itinerario del grupo
// (ver useEffect 1.5 + memo `jornadaActual` / `slotsDia` / `recreosDia` más abajo).
// Se eliminaron las constantes SLOTS_MANANA/SLOTS_TARDE hardcoded.

const fmtHora = (s) => s.slice(0, 5);

// "HH:MM:SS" o "HH:MM" → minutos desde medianoche.
const parseHmsToMin = (hms) => {
  if (!hms) return 0;
  const [h = '0', m = '0'] = String(hms).split(':');
  return (parseInt(h, 10) || 0) * 60 + (parseInt(m, 10) || 0);
};

// Convierte minutos a horas decimales (1 decimal); 90 → 1.5, 60 → 1.
const minToHoras = (min) => Math.round((min / 60) * 10) / 10;

// Paleta por materia derivada de --color-primary (HSL shift determinístico)
const colorForModule = (mid) => {
  const hue = (mid * 47) % 360;  // determinista
  return `hsl(${hue}, 55%, 48%)`;
};

const getId = (obj) => {
  if (!obj) return null;
  if (typeof obj === 'string') return obj.split('/').pop();
  return obj.id || obj['@id']?.split('/').pop();
};

// ─── Componente chip de materia (draggable desde el panel) ──────────────
const ModuleChip = ({ imparticion, minutosTotales, minutosColocados, color, selected, onSelect }) => {
  const id = `mod:${imparticion.id}`;
  const done = minutosColocados >= minutosTotales;
  const disabled = done;
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id,
    data: { type: 'module', imparticionId: imparticion.id },
    disabled,
  });

  const horasColocadas = minToHoras(minutosColocados);
  const horasTotales = minToHoras(minutosTotales);

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
        <span className={styles.moduleName}>
          {imparticion.materia
            ? <MateriaLabel materia={imparticion.materia} />
            : '—'}
        </span>
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
      <span className={styles.slotBlockTitle}>
        {imparticion.materia && <MateriaLabel materia={imparticion.materia} />}
      </span>
      <span className={styles.slotBlockProfe}>
        {(imparticion.profesor?.apellidos || '').split(' ')[0]}
      </span>
      <div className={styles.slotTooltip} role="tooltip">
        <strong>{imparticion.materia?.nombre || '—'}</strong>
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
  const { t, i18n } = useTranslation();
  const confirm = useConfirm();
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
  const [otherGroupsMinutes, setOtherGroupsMinutes] = useState({});
  const [dragError, setDragError] = useState(null);
  // Estado por grupo: { [gid]: { placements: { "dia_slot": {imparticionId, aula, hid?} }, dirty: bool } }
  const [state, setState] = useState({});
  const [saving, setSaving] = useState(false);
  const [solving, setSolving] = useState(false);
  const [solverSeed, setSolverSeed] = useState(null);
  const [activeDrag, setActiveDrag] = useState(null);
  // Tap-to-place: id de imparticion seleccionada (o null)
  const [selectedImpId, setSelectedImpId] = useState(null);
  // Cache de jornadas por id: { [jornadaId]: JornadaTipoConTramos | null (no asignada) }
  const [jornadasPorId, setJornadasPorId] = useState({});

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

  // 1.5) Cargar la jornada del itinerario del grupo seleccionado.
  // El GET /api/grupos no anida los tramos de la jornada (los serializer groups
  // no encadenan tan profundo), así que hacemos un fetch dedicado a /api/jornada_tipos/{id}.
  useEffect(() => {
    if (!selectedGrupo || grupos.length === 0) return;
    const grupoActual = grupos.find(g => String(g.id) === String(selectedGrupo));
    if (!grupoActual) return;

    const itin = grupoActual.itinerario;
    // Resolver el id de la jornada (puede venir como objeto, IRI string o nada).
    let jornadaId = null;
    const jt = itin?.jornadaTipo;
    if (jt) {
      if (typeof jt === 'object') {
        jornadaId = jt.id || (jt['@id'] ? jt['@id'].split('/').pop() : null);
      } else if (typeof jt === 'string') {
        jornadaId = jt.split('/').pop();
      }
    }

    if (!jornadaId) {
      // Itinerario sin jornada asignada: marcamos null para que el banner aparezca.
      const itinId = itin?.id || (itin?.['@id'] ? itin['@id'].split('/').pop() : null);
      if (itinId) setJornadasPorId(prev => ({ ...prev, [`itin:${itinId}`]: null }));
      return;
    }

    if (jornadasPorId[jornadaId] !== undefined) return;  // ya cargado

    fetch(getApiUrl(`/api/jornada_tipos/${jornadaId}`),
      { headers: { 'Accept': 'application/ld+json' }, credentials: 'include' })
      .then(r => r.ok ? r.json() : null)
      .then(j => {
        if (!j) return;
        setJornadasPorId(prev => ({ ...prev, [jornadaId]: j }));
      })
      .catch(err => console.error('Error cargando jornada:', err));
  }, [selectedGrupo, grupos, jornadasPorId]);

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
      // Captura del max(updatedAt) para detectar concurrencia al guardar
      const baselineMaxUpdatedAt = horarios.reduce((acc, h) => {
        const u = h.updatedAt || null;
        if (!u) return acc;
        return (!acc || u > acc) ? u : acc;
      }, null);
      setImparticiones(prev => ({ ...prev, [selectedGrupo]: imps }));
      setState(prev => ({
        ...prev,
        [selectedGrupo]: {
          placements,
          dirty: false,
          baseline: { ...placements },
          baselineMaxUpdatedAt,
        },
      }));
    });
  }, [selectedGrupo, state]);

  // Cargar ocupación de profes en grupos paralelos (mismo turno, mismo centro)
  useEffect(() => {
    if (!selectedGrupo || grupos.length === 0) return;
    const gActual = grupos.find(g => String(g.id) === String(selectedGrupo));
    if (!gActual) return;
    const itinerarioNombre = (gActual.itinerario?.nombre || '').toUpperCase();
    const mismoTurno = (g) => {
      if (String(g.id) === String(selectedGrupo)) return false;
      const cn = (g.itinerario?.nombre || '').toUpperCase();
      if (itinerarioNombre.includes('WEB')) return cn.includes('WEB');
      if (itinerarioNombre.includes('MULTIPLATAFORMA')) return cn.includes('MULTIPLATAFORMA');
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

    // Minutos semanales de cada profe en OTROS grupos (no el actual). Sumamos
    // duración real de cada horario (horaFin-horaInicio), no número de slots,
    // para que cuadre con jornadas de slots heterogéneos.
    const paralelosYRestoIds = grupos.filter(g => String(g.id) !== String(selectedGrupo)).map(g => g.id);
    if (paralelosYRestoIds.length === 0) { setOtherGroupsMinutes({}); return; }
    const bust2 = Date.now();
    Promise.all(paralelosYRestoIds.map(gid =>
      fetch(getApiUrl(`/api/horarios?imparticion.grupo=${gid}&itemsPerPage=500&_=${bust2}`),
        { headers: { 'Accept': 'application/ld+json', 'Cache-Control': 'no-cache' },
          credentials: 'include', cache: 'no-store' }).then(r => r.json())
    )).then(results => {
      const minutes = {};
      results.forEach(d => {
        const items = d['hydra:member'] || d.member || [];
        items.forEach(h => {
          const pid = h.imparticion?.profesor?.id
            ?? h.imparticion?.profesor?.['@id']?.split('/').pop();
          if (!pid) return;
          const dur = Math.max(0, parseHmsToMin(h.horaFin) - parseHmsToMin(h.horaInicio));
          const key = String(pid);
          minutes[key] = (minutes[key] || 0) + dur;
        });
      });
      setOtherGroupsMinutes(minutes);
    });
  }, [selectedGrupo, grupos]);

  const grupo = useMemo(() => grupos.find(g => String(g.id) === String(selectedGrupo)), [grupos, selectedGrupo]);
  const imps = imparticiones[selectedGrupo] || [];
  const grupoState = state[selectedGrupo];
  const placements = grupoState?.placements || {};

  // Resolver la jornada del itinerario del grupo. Cargada por el useEffect 1.5).
  const jornadaActual = useMemo(() => {
    if (!grupo) return null;
    const jt = grupo.itinerario?.jornadaTipo;
    let jornadaId = null;
    if (jt) {
      if (typeof jt === 'object') {
        jornadaId = jt.id || (jt['@id'] ? jt['@id'].split('/').pop() : null);
      } else if (typeof jt === 'string') {
        jornadaId = jt.split('/').pop();
      }
    }
    if (!jornadaId) return null;
    return jornadasPorId[jornadaId] || null;
  }, [grupo, jornadasPorId]);

  // Normaliza un valor de hora ("HH:MM" / "HH:MM:SS" / ISO) a "HH:MM:SS".
  const normHoraSlot = (v) => {
    if (!v) return null;
    const m = String(v).match(/(\d{2}):(\d{2})(?::(\d{2}))?/);
    return m ? `${m[1]}:${m[2]}:${m[3] || '00'}` : null;
  };

  // Tramos ordenados de la jornada (lista plana). Si no hay jornada, lista vacía.
  const tramosOrdenados = useMemo(() => {
    if (!jornadaActual?.tramos) return [];
    return [...jornadaActual.tramos]
      .sort((a, b) => (a.orden ?? 0) - (b.orden ?? 0))
      .map(t => ({
        ...t,
        horaInicio: normHoraSlot(t.horaInicio),
        horaFin: normHoraSlot(t.horaFin),
      }))
      .filter(t => t.horaInicio && t.horaFin);
  }, [jornadaActual]);

  // Solo SLOTS asignables, en formato [horaInicio, horaFin] (compatible con el resto del código).
  const slotsDia = useMemo(
    () => tramosOrdenados
      .filter(t => t.tipo === 'slot')
      .map(t => [t.horaInicio, t.horaFin]),
    [tramosOrdenados],
  );

  // Mapa horaInicio (HH:MM:SS) → duración en minutos del slot. Permite
  // calcular minutos colocados sin volver a parsear cada placement.
  const slotMinutosByHi = useMemo(() => {
    const m = {};
    tramosOrdenados.forEach(t => {
      if (t.tipo !== 'slot') return;
      m[t.horaInicio] = Math.max(0, parseHmsToMin(t.horaFin) - parseHmsToMin(t.horaInicio));
    });
    return m;
  }, [tramosOrdenados]);

  // Recreos para renderizar como bloques no asignables en la rejilla.
  const recreosDia = useMemo(
    () => tramosOrdenados.filter(t => t.tipo === 'recreo'),
    [tramosOrdenados],
  );

  // Etiqueta del turno (informativa, viene de la jornada). Sin jornada, queda en blanco.
  const turnoGrupo = jornadaActual?.turno === 'tarde' ? 'T' : 'M';

  // Minutos colocados por imparticion (suma duración real de los slots ocupados,
  // no número de slots — los slots pueden tener duración mixta 60/90/120 min).
  const minutosColocados = useMemo(() => {
    const m = {};
    Object.values(placements).forEach(p => {
      const dur = slotMinutosByHi[p.horaInicio] || 0;
      m[p.imparticionId] = (m[p.imparticionId] || 0) + dur;
    });
    return m;
  }, [placements, slotMinutosByHi]);

  const totalMinutos = imps.reduce((a, i) => a + (i.materia?.minutosSemanales || 0), 0);
  const colocadosMinutos = Object.values(placements).reduce(
    (a, p) => a + (slotMinutosByHi[p.horaInicio] || 0), 0
  );
  const totalHoras = minToHoras(totalMinutos);
  const colocadasTotal = minToHoras(colocadosMinutos);
  const completitud = totalMinutos ? (colocadosMinutos / totalMinutos) * 100 : 0;
  const estado =
    colocadosMinutos >= totalMinutos && totalMinutos > 0 ? 'complete' :
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

  // Carga semanal por profesor del grupo actual (live: otros grupos + placements actuales).
  // Trabajamos en minutos internamente y exponemos horas decimales al panel
  // (ProfLoadPanel sigue comparando contra `max=40` en horas).
  const profeCarga = useMemo(() => {
    const currentMinPerProf = {};
    Object.values(placements).forEach(p => {
      const imp = impById[p.imparticionId];
      const pid = imp?.profesor?.id;
      if (!pid) return;
      const dur = slotMinutosByHi[p.horaInicio] || 0;
      currentMinPerProf[pid] = (currentMinPerProf[pid] || 0) + dur;
    });
    const profesUnicos = new Map();
    imps.forEach(i => {
      if (i.profesor?.id && !profesUnicos.has(i.profesor.id)) {
        profesUnicos.set(i.profesor.id, i.profesor);
      }
    });
    const result = [];
    profesUnicos.forEach((profe, pid) => {
      const enOtrosMin = otherGroupsMinutes[pid] || 0;
      const enActualMin = currentMinPerProf[pid] || 0;
      result.push({
        profe,
        enOtros: minToHoras(enOtrosMin),
        enActual: minToHoras(enActualMin),
        total: minToHoras(enOtrosMin + enActualMin),
      });
    });
    result.sort((a, b) => b.total - a.total);
    return result;
  }, [placements, impById, imps, otherGroupsMinutes, slotMinutosByHi]);

  // Validación de drop: devuelve {ok, reason}
  const validateDrop = useCallback((drag, diaIdx, slotIdx) => {
    if (!drag) return { ok: true };
    const key = `${diaIdx}_${slotsDia[slotIdx][0]}`;
    const impId = drag.imparticionId;
    const imp = impById[impId];
    if (!imp) return { ok: false, reason: t('scheduleEditor.reasonUnknownImp') };

    // Regla 1: minutos restantes > 0 (solo para panel → celda; en swap los minutos no cambian globalmente)
    if (drag.type === 'module') {
      const totalMin = (imp.materia?.minutosSemanales || 0);
      if ((minutosColocados[impId] || 0) >= totalMin) {
        return { ok: false, reason: t('scheduleEditor.reasonModuleFull', { total: minToHoras(totalMin), module: imp.materia?.nombre }) };
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
  }, [slotsDia, impById, minutosColocados, placements, parallelBusy]);

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
  }, [selectedGrupo, placements, imps, minutosColocados, slotsDia, grupo]);

  // Estado para el modal de conflicto y el de confirmación de publicación incompleta
  const [conflictOpen, setConflictOpen] = useState(false);
  const [publishConfirmOpen, setPublishConfirmOpen] = useState(false);

  // Construye las operaciones de batch desde el diff baseline→current
  const buildBatchOps = () => {
    const baseline = grupoState?.baseline || {};
    const current = grupoState?.placements || {};
    const operations = [];
    // Crear / reemplazar
    Object.entries(current).forEach(([key, v]) => {
      const old = baseline[key];
      if (!old) {
        operations.push(opCreate(key, v));
        return;
      }
      if (old.imparticionId !== v.imparticionId) {
        if (old.hid) operations.push({ op: 'delete', id: old.hid });
        operations.push(opCreate(key, v));
      }
    });
    // Borrar puros
    Object.entries(baseline).forEach(([key, v]) => {
      if (!current[key] && v.hid) operations.push({ op: 'delete', id: v.hid });
    });
    return operations;
  };

  const opCreate = (key, v) => {
    const [diaStr, hiFromKey] = key.split('_');
    const slot = slotsDia.find(s => s[0] === hiFromKey);
    const hi = (hiFromKey || '').slice(0, 5);
    const hf = slot ? slot[1].slice(0, 5) : (v.horaFin || '').slice(0, 5);
    return {
      op: 'create',
      clientKey: key,
      diaSemana: parseInt(diaStr, 10),
      horaInicio: hi,
      horaFin: hf,
      aula: v.aula,
      imparticion: v.imparticionId,
    };
  };

  // Lista de imparticiones con horas pendientes (para el modal de publicar incompleto)
  const unplacedSummary = useMemo(() => {
    return imps
      .map(imp => {
        const totalMin = (imp.materia?.minutosSemanales || 0);
        const placedMin = minutosColocados[imp.id] || 0;
        if (placedMin >= totalMin) return null;
        return {
          nombre: imp.materia?.nombre || '—',
          faltan: minToHoras(totalMin - placedMin),
          total: minToHoras(totalMin),
        };
      })
      .filter(Boolean);
  }, [imps, minutosColocados]);

  // Ejecuta el guardado real (batch). Devuelve true si OK.
  const performBatchSave = async () => {
    setSaving(true);
    try {
      const operations = buildBatchOps();
      if (operations.length === 0) return true;
      const res = await fetch(getApiUrl('/api/v1/horarios/batch'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          grupoId: Number(selectedGrupo),
          baselineMaxUpdatedAt: grupoState?.baselineMaxUpdatedAt || null,
          operations,
        }),
      });
      if (res.status === 409) {
        setConflictOpen(true);
        return false;
      }
      if (!res.ok) {
        const txt = await res.text().catch(() => '');
        throw new Error(`${res.status}: ${txt.slice(0, 300)}`);
      }
      const data = await res.json();
      // Mapear ids creados → baseline nuevo
      const current = grupoState.placements || {};
      const newBaseline = { ...current };
      (data.created || []).forEach(({ clientKey, id }) => {
        if (clientKey && newBaseline[clientKey]) {
          newBaseline[clientKey] = { ...newBaseline[clientKey], hid: id };
        }
      });
      setState(prev => ({
        ...prev,
        [selectedGrupo]: {
          ...prev[selectedGrupo],
          placements: newBaseline,
          baseline: newBaseline,
          baselineMaxUpdatedAt: data.maxUpdatedAt || null,
          dirty: false,
        },
      }));
      return true;
    } catch (err) {
      toast.error(err.message, {
        description: t('scheduleEditor.saveErrorCtx', { defaultValue: 'No se ha podido guardar el horario' })
      });
      return false;
    } finally {
      setSaving(false);
    }
  };

  // Fuerza recarga del grupo actual descartando estado local (tras conflicto)
  const reloadCurrentGroup = () => {
    setState(prev => {
      const cp = { ...prev };
      delete cp[selectedGrupo];
      return cp;
    });
    setConflictOpen(false);
  };

  // Entry point del botón Guardar: si está incompleto, pedir confirmación primero
  const handleSave = async () => {
    if (!grupoState?.dirty) return;
    if (estado !== 'complete') {
      setPublishConfirmOpen(true);
      return;
    }
    return performBatchSave();
  };

  // ─── Exportación a PDF ────────────────────────────────────────────────
  const [exporting, setExporting] = useState(false);
  const [exportConfirmOpen, setExportConfirmOpen] = useState(false);

  const performExport = async () => {
    if (!selectedGrupo) return;
    setExporting(true);
    try {
      const lang = (i18n.language || 'es').substring(0, 2);
      const url = getApiUrl(`/api/v1/informes/horario/grupo/${selectedGrupo}?lang=${lang}`);
      const grupoNombre = grupo?.nombre ? grupo.nombre.replace(/[^a-zA-Z0-9]+/g, '_') : 'grupo';
      await downloadFileFromApi(url, `horario_${grupoNombre}.pdf`);
    } catch (err) {
      toast.error(err.message, {
        description: t('scheduleEditor.exportErrorCtx', { defaultValue: 'No se ha podido exportar el horario' })
      });
    } finally {
      setExporting(false);
    }
  };

  const handleExportPdf = () => {
    if (!selectedGrupo) return;
    if (grupoState?.dirty) {
      setExportConfirmOpen(true);
      return;
    }
    performExport();
  };

  // Tap-to-place: toggle selección de la materia en el panel
  const handleSelectModule = useCallback((impId) => {
    setSelectedImpId(prev => prev === impId ? null : impId);
  }, []);

  // Tap en celda: si hay materia seleccionada, intentar colocar; si la celda está
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
      const totalMin = (imp.materia?.minutosSemanales || 0);
      const yaMin = Object.values(effectivePlacements)
        .filter(p => p.imparticionId === selectedImpId)
        .reduce((acc, p) => acc + (slotMinutosByHi[p.horaInicio] || 0), 0);
      if (yaMin >= totalMin) {
        setDragError(t('scheduleEditor.reasonModuleFull', { total: minToHoras(totalMin), module: imp.materia?.nombre }));
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
      const tapDur = slotMinutosByHi[slotsDia[slotIdx][0]] || 0;
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
      // Si la materia ya alcanzó sus minutos totales, deseleccionamos.
      if (yaMin + tapDur >= totalMin) setSelectedImpId(null);
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
  }, [selectedImpId, placements, impById, parallelBusy, selectedGrupo, slotsDia, slotMinutosByHi, grupo, t]);

  // Validación ligera para pintar tap-mode
  const validateTap = useCallback((diaIdx, slotIdx) => {
    if (!selectedImpId) return null;
    const key = `${diaIdx}_${slotsDia[slotIdx][0]}`;
    if (placements[key]) return false;
    const imp = impById[selectedImpId];
    if (!imp) return false;
    const totalMin = (imp.materia?.minutosSemanales || 0);
    if ((minutosColocados[selectedImpId] || 0) >= totalMin) return false;
    const profId = imp.profesor?.id;
    if (profId && parallelBusy[key]?.has(Number(profId))) return false;
    return true;
  }, [selectedImpId, slotsDia, placements, impById, minutosColocados, parallelBusy]);

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
    if (hasContent && !(await confirm({ body: t('scheduleEditor.solverConfirmOverwrite') }))) return;
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
        const faltan = data.unplaced.map(u => `${u.materia}: ${u.horasRestantes}h`).join(', ');
        setDragError(t('scheduleEditor.solverPartial', { items: faltan }));
        window.setTimeout(() => setDragError(null), 6000);
      }
    } catch (err) {
      toast.error(err.message, {
        description: t('scheduleEditor.solverErrorCtx', { defaultValue: 'El solver ha fallado' })
      });
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
        color={colorForModule(imp.materia?.id || p.imparticionId)}
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
          logo={<Lottie animationData={timeAnim} loop={true} style={{ width: 56, height: 56 }} />}
          middle={tabs}
          stackActionsEarly
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
                label: `${g.curso}º ${g.nombre}`,
              }))}
          />
          <Button
            variant="secondary"
            onClick={handleExportPdf}
            disabled={!selectedGrupo || exporting}
            title={t('scheduleEditor.exportPdf')}
          >
            <Download size={16} style={{ marginRight: 6 }} />
            {exporting ? t('scheduleEditor.exporting') : t('scheduleEditor.exportPdf')}
          </Button>
          <Button onClick={handleSave} disabled={!grupoState?.dirty || saving}>
            <Save size={16} style={{ marginRight: 6 }} />
            {saving ? t('scheduleEditor.saving') : (grupoState?.dirty ? t('scheduleEditor.saveChanges') : t('scheduleEditor.saved'))}
          </Button>
        </CrudHeader>

        {!selectedGrupo || !grupoState ? (
          <div className={styles.emptyState}>{t('scheduleEditor.emptyState')}</div>
        ) : slotsDia.length === 0 ? (
          <div className={styles.emptyState} style={{ flexDirection: 'column', gap: '0.5rem', textAlign: 'center' }}>
            <div style={{ fontWeight: 600 }}>
              {t('scheduleEditor.noJornadaTitle', { defaultValue: 'El itinerario no tiene jornada asignada' })}
            </div>
            <div style={{ fontSize: '0.9rem', color: 'var(--color-text-secondary)', maxWidth: 480 }}>
              {t('scheduleEditor.noJornadaHint', {
                defaultValue: 'Asigna una jornada al itinerario "{{itin}}" desde /itinerarios o crea una nueva en /admin/jornadas.',
                itin: grupo?.itinerario?.nombre || '—',
              })}
            </div>
          </div>
        ) : (
          <DndContext sensors={sensors} onDragStart={onDragStart} onDragEnd={onDragEnd}>
            <div className={styles.editorLayout}>
              <aside className={styles.modulesPanel}>
                <h3 className={styles.panelTitle}>{t('scheduleEditor.panelModules', { count: imps.length })}</h3>
                {imps.map(imp => (
                  <ModuleChip
                    key={imp.id}
                    imparticion={imp}
                    minutosTotales={(imp.materia?.minutosSemanales || 0)}
                    minutosColocados={minutosColocados[imp.id] || 0}
                    color={colorForModule(imp.materia?.id || imp.id)}
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
                {(() => {
                  // Recorremos los tramos en orden y vamos contando los slots
                  // para mantener `slotIdx` consistente con `slotsDia` (que
                  // los placements ya usan como clave).
                  let slotIdxCounter = -1;
                  return tramosOrdenados.map((tramo, tramoPos) => {
                    if (tramo.tipo === 'recreo') {
                      return (
                        <div key={`recreo-${tramoPos}`} className={`${styles.gridRow} ${styles.gridRowRecreo}`}>
                          <div className={styles.timeLabel}>
                            <span>{fmtHora(tramo.horaInicio)}</span>
                            <span className={styles.timeLabelSep}>–</span>
                            <span>{fmtHora(tramo.horaFin)}</span>
                          </div>
                          <div
                            className={styles.recreoStrip}
                            style={{ gridColumn: `span ${DIAS.length}` }}
                            title={tramo.etiqueta || t('jornadas.tipoRecreo', { defaultValue: 'Recreo' })}
                          >
                            <span>{tramo.etiqueta || t('jornadas.tipoRecreo', { defaultValue: 'Recreo' })}</span>
                          </div>
                        </div>
                      );
                    }
                    slotIdxCounter += 1;
                    const slotIdx = slotIdxCounter;
                    return (
                      <div key={`slot-${slotIdx}`} className={styles.gridRow}>
                        <div className={styles.timeLabel}>
                          <span>{fmtHora(tramo.horaInicio)}</span>
                          <span className={styles.timeLabelSep}>–</span>
                          <span>{fmtHora(tramo.horaFin)}</span>
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
                    );
                  });
                })()}
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
                <div className={styles.dragOverlay} style={{ backgroundColor: colorForModule(activeImp.materia?.id || activeImp.id) }}>
                  {activeImp.materia && <MateriaLabel materia={activeImp.materia} />}
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

        {/* Modal de conflicto por edición concurrente */}
        <ModalView
          isOpen={conflictOpen}
          onClose={() => setConflictOpen(false)}
          title={t('scheduleEditor.conflictTitle')}
          size="small"
          footer={
            <>
              <Button type="button" variant="secondary" onClick={() => setConflictOpen(false)}>
                {t('scheduleEditor.conflictKeep')}
              </Button>
              <Button type="button" variant="danger" onClick={reloadCurrentGroup}>
                {t('scheduleEditor.conflictReload')}
              </Button>
            </>
          }
        >
          <p>{t('scheduleEditor.conflictBody')}</p>
        </ModalView>

        {/* Modal de confirmación al publicar horario incompleto */}
        <ModalView
          isOpen={publishConfirmOpen}
          onClose={() => setPublishConfirmOpen(false)}
          title={t('scheduleEditor.publishIncompleteTitle')}
          size="medium"
          footer={
            <>
              <Button type="button" variant="secondary" onClick={() => setPublishConfirmOpen(false)}>
                {t('scheduleEditor.publishIncompleteCancel')}
              </Button>
              <Button
                type="button"
                onClick={async () => {
                  setPublishConfirmOpen(false);
                  await performBatchSave();
                }}
                disabled={saving}
              >
                {saving ? t('scheduleEditor.saving') : t('scheduleEditor.publishIncompleteConfirm')}
              </Button>
            </>
          }
        >
          <p>{t('scheduleEditor.publishIncompleteBody')}</p>
          {unplacedSummary.length > 0 && (
            <ul style={{ marginTop: 'var(--space-2)', paddingLeft: 'var(--space-5)' }}>
              {unplacedSummary.map((u, i) => (
                <li key={i}>
                  <strong>{u.nombre}</strong>: {t('scheduleEditor.publishIncompleteItem', { faltan: u.faltan, total: u.total })}
                </li>
              ))}
            </ul>
          )}
        </ModalView>

        {/* Modal de confirmación al exportar con cambios sin guardar */}
        <ModalView
          isOpen={exportConfirmOpen}
          onClose={() => setExportConfirmOpen(false)}
          title={t('scheduleEditor.exportDirtyTitle')}
          size="small"
          footer={
            <>
              <Button type="button" variant="secondary" onClick={() => setExportConfirmOpen(false)}>
                {t('scheduleEditor.exportDirtyCancel')}
              </Button>
              <Button
                type="button"
                variant="secondary"
                onClick={async () => {
                  setExportConfirmOpen(false);
                  await performExport();
                }}
                disabled={exporting}
              >
                {t('scheduleEditor.exportDirtyExportSaved')}
              </Button>
              <Button
                type="button"
                onClick={async () => {
                  setExportConfirmOpen(false);
                  await handleSave();
                  await performExport();
                }}
                disabled={exporting || saving}
              >
                {(saving || exporting) ? t('scheduleEditor.exporting') : t('scheduleEditor.exportDirtySaveAndExport')}
              </Button>
            </>
          }
        >
          <p>{t('scheduleEditor.exportDirtyBody')}</p>
        </ModalView>
      </Container>
    </Wrapper>
  );
};

export default HorariosEditor;
