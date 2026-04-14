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
import Layout from '../components/Layout';
import CrudHeader from '../components/CrudHeader';
import Button from '../components/Button';
import ThemedSelect from '../components/ThemedSelect';
import { useAuth } from '../context/AuthContext';
import { useTranslation } from 'react-i18next';
import { CalendarClock, Save, CheckCircle2, AlertTriangle, XCircle } from 'lucide-react';
import { getApiUrl } from '../config/api';
import Lottie from 'lottie-react';
import timeAnim from '../../public/time.json';
import styles from './HorariosEditor.module.css';

// Convención del sistema: diaSemana 1=Lunes … 5=Viernes
const DIAS = [
  { idx: 1, label: 'Lunes' },
  { idx: 2, label: 'Martes' },
  { idx: 3, label: 'Miércoles' },
  { idx: 4, label: 'Jueves' },
  { idx: 5, label: 'Viernes' },
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
const ModuleChip = ({ imparticion, horasTotales, horasColocadas, color }) => {
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
      className={`${styles.moduleChip} ${isDragging ? styles.moduleChipDragging : ''} ${done ? styles.moduleChipDone : ''}`}
      {...listeners}
      {...attributes}
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
const SlotBlock = ({ slotId, imparticion, color }) => {
  const id = `slot:${slotId}`;
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id,
    data: { type: 'placed', slotId, imparticionId: imparticion.id },
  });
  return (
    <div
      ref={setNodeRef}
      className={styles.slotBlock}
      style={{ backgroundColor: color, opacity: isDragging ? 0.4 : 1 }}
      {...listeners}
      {...attributes}
      title={`${imparticion.modulo?.nombre} · ${imparticion.profesor?.nombre || ''} ${imparticion.profesor?.apellidos || ''}`}
    >
      <span className={styles.slotBlockTitle}>{imparticion.modulo?.nombre}</span>
      <span className={styles.slotBlockProfe}>
        {(imparticion.profesor?.apellidos || '').split(' ')[0]}
      </span>
    </div>
  );
};

// ─── Celda droppable ───────────────────────────────────────────────────
const SlotCell = ({ dia, slot, content }) => {
  const id = `cell:${dia}:${slot}`;
  const { isOver, setNodeRef } = useDroppable({
    id,
    data: { type: 'cell', dia, slot },
  });
  return (
    <div
      ref={setNodeRef}
      className={`${styles.slot} ${!content ? styles.slotEmpty : ''} ${isOver ? styles.slotDropActive : ''}`}
    >
      {content}
    </div>
  );
};

// ─── Componente principal ──────────────────────────────────────────────
const HorariosEditor = () => {
  const { t } = useTranslation();
  const { user } = useAuth();
  const isSuperAdmin = user?.roles?.includes('ROLE_SUPERADMIN');

  const [grupos, setGrupos] = useState([]);
  const [selectedGrupo, setSelectedGrupo] = useState('');
  // imparticiones indexadas por grupo para conservar entre cambios de selector
  const [imparticiones, setImparticiones] = useState({});
  // Estado por grupo: { [gid]: { placements: { "dia_slot": {imparticionId, aula, hid?} }, dirty: bool } }
  const [state, setState] = useState({});
  const [saving, setSaving] = useState(false);
  const [activeDrag, setActiveDrag] = useState(null);

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
        if (items.length > 0 && !selectedGrupo) setSelectedGrupo(String(items[0].id));
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
    complete:   { cls: styles.statusComplete,   icon: <CheckCircle2 size={16} />, label: `Completo · ${colocadasTotal}/${totalHoras}h` },
    draft:      { cls: styles.statusDraft,      icon: <AlertTriangle size={16} />, label: `Borrador · ${colocadasTotal}/${totalHoras}h` },
    incomplete: { cls: styles.statusIncomplete, icon: <XCircle size={16} />,      label: `Incompleto · ${colocadasTotal}/${totalHoras}h` },
  }[estado];

  // Drag handlers
  const onDragStart = useCallback((e) => {
    setActiveDrag(e.active?.data?.current || null);
  }, []);

  const onDragEnd = useCallback((e) => {
    setActiveDrag(null);
    const a = e.active?.data?.current;
    const o = e.over?.data?.current;
    if (!a) return;

    // Caso: de panel a celda
    if (a.type === 'module' && o?.type === 'cell') {
      const key = `${o.dia}_${slotsDia[o.slot][0]}`;
      // Si la celda está ocupada, no hacemos nada (la celda no acepta double)
      if (placements[key]) return;
      // Horas restantes del módulo
      const total = imps.find(i => i.id === a.imparticionId)?.modulo?.horasSemanales || 0;
      if ((horasColocadas[a.imparticionId] || 0) >= total) return;
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
      alert('Error al guardar: ' + err.message);
    } finally {
      setSaving(false);
    }
  };

  // Aviso al salir sin guardar
  useEffect(() => {
    const dirtyAny = Object.values(state).some(s => s?.dirty);
    if (!dirtyAny) return;
    const handler = (e) => { e.preventDefault(); e.returnValue = ''; };
    window.addEventListener('beforeunload', handler);
    return () => window.removeEventListener('beforeunload', handler);
  }, [state]);

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
      />
    );
  };

  const activeImp = activeDrag?.imparticionId ? imps.find(i => i.id === activeDrag.imparticionId) : null;

  return (
    <Layout>
      <div className={styles.container}>
        <CrudHeader
          title="Editor de horarios"
          logo={<Lottie animationData={timeAnim} loop={true} style={{ width: 60, height: 60 }} />}
        >
          <ThemedSelect
            value={selectedGrupo}
            onChange={setSelectedGrupo}
            minWidth={240}
            ariaLabel="Seleccionar grupo"
            options={grupos.map(g => ({
              value: String(g.id),
              label: `${g.nombre} — ${g.anioEscolar}`,
            }))}
          />
          {estadoBadge && (
            <span className={`${styles.statusBadge} ${estadoBadge.cls}`}>
              {estadoBadge.icon}
              {estadoBadge.label}
            </span>
          )}
          <div className={styles.spacer} />
          <Button onClick={handleSave} disabled={!grupoState?.dirty || saving}>
            <Save size={16} style={{ marginRight: 6 }} />
            {saving ? 'Guardando…' : (grupoState?.dirty ? 'Guardar cambios' : 'Guardado')}
          </Button>
        </CrudHeader>

        {!selectedGrupo || !grupoState ? (
          <div className={styles.emptyState}>Selecciona un grupo para empezar.</div>
        ) : (
          <DndContext sensors={sensors} onDragStart={onDragStart} onDragEnd={onDragEnd}>
            <div className={styles.editorLayout}>
              <aside className={styles.modulesPanel}>
                <h3 className={styles.panelTitle}>Módulos ({imps.length})</h3>
                {imps.map(imp => (
                  <ModuleChip
                    key={imp.id}
                    imparticion={imp}
                    horasTotales={imp.modulo?.horasSemanales || 0}
                    horasColocadas={horasColocadas[imp.id] || 0}
                    color={colorForModule(imp.modulo?.id || imp.id)}
                  />
                ))}
                <p style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)', marginTop: 'var(--space-3)' }}>
                  Arrastra un módulo al horario. Arrastra una clase del horario al panel para quitarla.
                </p>
              </aside>

              <div className={styles.grid}>
                <div className={styles.gridHeader}>
                  <div>Hora</div>
                  {DIAS.map(d => <div key={d.idx}>{d.label}</div>)}
                </div>
                {slotsDia.map((slotRange, slotIdx) => (
                  <div key={slotIdx} className={styles.gridRow}>
                    <div className={styles.timeLabel}>
                      {fmtHora(slotRange[0])}–{fmtHora(slotRange[1])}
                    </div>
                    {DIAS.map((d) => (
                      <SlotCell
                        key={`${d.idx}_${slotIdx}`}
                        dia={d.idx}
                        slot={slotIdx}
                        content={renderSlotContent(d.idx, slotIdx)}
                      />
                    ))}
                  </div>
                ))}
                <div className={styles.infoBar}>
                  <span><b>Turno:</b> {turnoGrupo === 'M' ? 'Mañana' : 'Tarde'}</span>
                  <span><b>Aula:</b> {grupo?.abreviatura || grupo?.nombre || '—'}</span>
                  <span><b>Franjas:</b> {colocadasTotal}/{totalHoras} colocadas</span>
                </div>
              </div>
            </div>

            <DragOverlay>
              {activeImp ? (
                <div className={styles.dragOverlay} style={{ backgroundColor: colorForModule(activeImp.modulo?.id || activeImp.id) }}>
                  {activeImp.modulo?.nombre}
                </div>
              ) : null}
            </DragOverlay>
          </DndContext>
        )}
      </div>
    </Layout>
  );
};

export default HorariosEditor;
