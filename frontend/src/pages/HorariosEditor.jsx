import React, { useEffect, useMemo, useState, useCallback, useRef } from 'react';
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
import { CalendarClock, Save, CheckCircle2, AlertTriangle, XCircle, Ban, Sparkles, Download, Plus, Pencil, Trash2, Sliders, RotateCcw, Layers, Settings2, Eraser, CalendarDays } from 'lucide-react';
import { getApiUrl } from '../config/api';
import { downloadFileFromApi } from '../utils/downloadFile';
import { toast } from '../utils/toast';
import { formatGrupoNombre } from '../utils/grupo';
import { useConfirm } from '../context/ConfirmContext';
import Lottie from 'lottie-react';
import timeAnim from '../../public/time.json';
import solverAnim from '../../public/solver.json';
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

// Espejo en JS de Imparticion::resolveAula() del backend (cascada del aula).
// Mantener sincronizados ambos lados; el backend es la fuente de verdad cuando
// el solver inicia un placement, este helper se usa al colocar manualmente.
const resolveAulaJs = (imp, grupo) => {
  return imp?.aulaEspecifica
    || grupo?.aulaDefault
    || (grupo?.abreviatura ? `Aula ${grupo.abreviatura}` : 'Aula');
};

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

// ─── Helpers de modalidad ──────────────────────────────────────────────
// Mirror del backend `Imparticion::getEffectiveModalidad()` (Fase 1):
// override per-imparticion → modalidad de la materia → fallback PRESENCIAL.
// La API expone modalidad como string ("presencial" | "fct" | "no_regular" |
// "autonoma") en `imp.modalidad` e `imp.materia.modalidad`.
const getEffectiveModalidad = (imp) => imp?.modalidad ?? imp?.materia?.modalidad ?? 'presencial';
// Único punto de verdad para "¿esta materia ocupa slot de aula?".
// Solo PRESENCIAL → drag panel + grilla. El resto va al panel "Otras horas".
const consumeAulaModalidad = (modalidad) => modalidad === 'presencial';

// ─── Componente chip de materia (draggable desde el panel) ──────────────
// Contador en horas ANUALES (Fase 5 sub-A): minutosTotales = currículo anual,
// minutosColocados = Σ placements del grupo × ocurrencias del día_semana en
// cada rango. El admin coloca placements en cualquier rango hasta que el chip
// llegue al 100% del objetivo anual.
const ModuleChip = ({ imparticion, minutosTotales, minutosColocados, color, selected, onSelect }) => {
  const id = `mod:${imparticion.id}`;
  const done = minutosColocados >= minutosTotales && minutosTotales > 0;
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
      title={`${horasColocadas}h / ${horasTotales}h anuales`}
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
      <span className={styles.moduleCounter}>{horasColocadas}/{horasTotales}h</span>
    </div>
  );
};

// ─── Item del panel "Otras horas curriculares" (no draggable) ─────────
// Lista las materias no presenciales (FCT, NO_REGULAR, AUTONOMA) sin drag-
// and-drop ni contador de progreso: cuentan al currículo anual pero no
// ocupan slots. Su carga se ve en el banner anual; aquí solo se enumeran
// con badge de modalidad para que el admin entienda dónde quedan.
const OtrasHorasItem = ({ imparticion, minutosSemanales, modalidad, color, t }) => {
  const horasSem = minutosSemanales > 0 ? minToHoras(minutosSemanales) : null;
  // Etiqueta del badge i18n. Default values en español.
  const badgeLabel = t(`modalidad.badge.${modalidad}`, {
    defaultValue: modalidad === 'fct' ? 'FCT'
      : modalidad === 'no_regular' ? 'No regular'
      : modalidad === 'autonoma' ? 'Autónoma'
      : modalidad,
  });
  return (
    <div className={styles.otrasHorasItem} title={badgeLabel}>
      <span className={styles.moduleDot} style={{ backgroundColor: color }} />
      <div className={styles.moduleMeta}>
        <span className={styles.moduleName}>
          {imparticion.materia ? <MateriaLabel materia={imparticion.materia} /> : '—'}
        </span>
        <span className={`${styles.modalidadBadge} ${styles[`modalidadBadge_${modalidad}`] || ''}`}>
          {badgeLabel}
        </span>
      </div>
      {horasSem !== null && (
        <span className={styles.moduleCounter}>{horasSem}h/sem</span>
      )}
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
  // Lista de jornadas disponibles por centro: { [centroId]: [{id, nombre, turno}, ...] }.
  // Alimenta el selector de jornada del infoBar (override por grupo, persistido en BD).
  const [jornadasByCentro, setJornadasByCentro] = useState({});
  // Cache de semanas lectivas REALES por centro (Fase 7): consulta el endpoint
  // GET /api/v1/centros/{id}/semanas-lectivas que descuenta festivos del rango
  // del centro o, si no rellena fechas, del CalendarioEscolarCcaa(centro.ccaa,
  // anioActual, etapa=fp). Cae a 36 LOMLOE si no hay calendario CCAA.
  // Forma: { [centroId]: { semanas: float|null, diasLectivos: int|null, origen: 'centro'|'ccaa'|'fallback' } }
  const [semanasLectivasByCentro, setSemanasLectivasByCentro] = useState({});
  // Cache de capacity-check por (grupo, PL): { [`${grupoId}_${plId}`]: { feasible, ... } }.
  // El PL afecta a la jornada efectiva y a las imparticiones activas, así que la
  // cache se invalida al cambiar de PL o al cambiar la jornada del grupo.
  const [capacityByGrupo, setCapacityByGrupo] = useState({});
  // Periodos lectivos por grupo: { [grupoId]: PL[] } ordenados por orden+fechaInicio.
  // Cargados al seleccionar un grupo. Fase 3a — cada grupo tiene 1 PL ("Curso completo")
  // tras la migración Fase 1; Fase 3b expondrá CRUD para crear más rangos.
  const [plByGrupo, setPlByGrupo] = useState({});
  // PL seleccionado (timeline strip): { [grupoId]: plId }. Default = el activo
  // por fecha (contiene today o, si no, el primero por fechaInicio).
  const [selectedPlByGrupo, setSelectedPlByGrupo] = useState({});
  // Flag de PUT en curso para el override de jornada (deshabilita el selector mientras llega el ack).
  const [savingJornadaOverride, setSavingJornadaOverride] = useState(false);
  // Modal "Rango lectivo" (Fase 3a/b): mismo modal para crear y editar.
  // mode = 'create' | 'edit'; editingPlId guarda el id del PL que se está
  // editando (null en modo create). El form pre-rellena valores actuales en
  // edit y vacíos / continuación del último rango en create.
  const [plPickerOpen, setPlPickerOpen] = useState(false);
  const [plPickerMode, setPlPickerMode] = useState('create');
  const [editingPlId, setEditingPlId] = useState(null);
  const [plForm, setPlForm] = useState({ nombre: '', fechaInicio: '', fechaFin: '', jornadaTipoId: '' });
  const [addingPl, setAddingPl] = useState(false);
  const [deletingPlId, setDeletingPlId] = useState(null);
  // Modal "Materias del rango" (Fase 4): editor de PLI por rango activo.
  // pliByPl: cache local { [plId]: PLI[] } recargado cada vez que se abre el
  // modal, para reflejar cambios concurrentes. pliRowSaving: Set<impId> con
  // las filas con PATCH/POST/DELETE en vuelo (deshabilita los inputs de
  // esa fila para evitar carreras).
  const [pliModalOpen, setPliModalOpen] = useState(false);
  const [pliModalPlId, setPliModalPlId] = useState(null);
  const [pliByPl, setPliByPl] = useState({});
  const [pliLoading, setPliLoading] = useState(false);
  const [pliRowSaving, setPliRowSaving] = useState({});
  // Horarios persistidos del grupo entero (todos los PLs) — para que el chip
  // lateral pueda contar "horas anuales colocadas" sumando placements de TODOS
  // los rangos (Fase 5 sub-A). { [grupoId]: Horario[] }. El state local del
  // editor (placements) se compone encima para el PL activo.
  const [allHorariosByGroup, setAllHorariosByGroup] = useState({});
  // Modal "Extender curso" (Fase 5 sub-B): se dispara desde el botón del banner
  // anual cuando faltan horas para cumplir currículo. Aplica PATCH al último PL
  // y al Grupo en cascada.
  const [extendModalOpen, setExtendModalOpen] = useState(false);
  const [extendingCourse, setExtendingCourse] = useState(false);
  // Acciones del curso (dropdown infoBar + modal Crear Rangos Recomendados).
  const [cursoActionsOpen, setCursoActionsOpen] = useState(false);
  const [createRangosModalOpen, setCreateRangosModalOpen] = useState(false);
  const [createRangosCount, setCreateRangosCount] = useState(3);
  const [creatingRangos, setCreatingRangos] = useState(false);
  // Solver multi-rango: bandera para deshabilitar UI mientras corre el loop.
  const [solverAllRunning, setSolverAllRunning] = useState(false);
  // Progreso multi-rango para el overlay Lottie: { current, total, plName? }.
  const [solverProgress, setSolverProgress] = useState(null);
  // "Configurar curso óptimo" engloba PATCH grupo + crear PLs + distribuir
  // currículo + correr solver. El overlay Lottie debe cubrir TODA la
  // secuencia para evitar que el usuario crea que la operación ya terminó
  // entre pasos. Levantado al principio de handleConfigureOptimalCourse y
  // bajado en su finally; el overlay se muestra si cualquiera de
  // (solving, solverAllRunning, configuringOptimal) está a true.
  const [configuringOptimal, setConfiguringOptimal] = useState(false);
  const [configuringStep, setConfiguringStep] = useState(null);
  // Cola de transacción pendiente por grupo (Tanda B 2026-04-30 — "todo en
  // preview hasta Guardar"). Ninguna acción del curso (manual o auto) toca
  // BD; los cambios se acumulan aquí y se aplican secuencialmente al pulsar
  // Guardar.
  //
  //   pendingTxByGrupo[gid] = {
  //     grupoFechaFin: 'YYYY-MM-DD' | null,    // PATCH al Guardar (null = sin cambio)
  //     grupoFechaFinOriginal: ...,             // captura para descartar
  //     plsToDelete: [realPlId, ...],           // PLs reales a borrar (cascade horarios)
  //     plsToCreate: [
  //       { tempId: -1, nombre, fechaInicio, fechaFin, jornadaTipoId,
  //         plisSeed: [{imparticionId, minutosSemanales}] },
  //       ...
  //     ],
  //     pliPatches: [
  //       { plId|tempId, imparticionId, minutosSemanales }, ...
  //     ],
  //   }
  //
  // Los PLs virtuales aparecen en `plByGrupo[gid]` con `_pending: 'create'`
  // y `id < 0`, para que el strip y el banner anual los traten como reales
  // sin tocar 30+ accesos al estado.
  const [pendingTxByGrupo, setPendingTxByGrupo] = useState({});
  const [applyingPendingTx, setApplyingPendingTx] = useState(false);
  const tempIdSeqRef = useRef(-1);

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

  // Helper local: formatea una fecha (ISO YYYY-MM-DD o "...T00:00:00...") al
  // formato español dd/mm/yyyy. Devuelve cadena vacía si la entrada es inválida.
  const fmtDateEs = (s) => {
    if (!s) return '';
    const m = String(s).match(/^(\d{4})-(\d{2})-(\d{2})/);
    if (!m) return String(s);
    return `${m[3]}/${m[2]}/${m[1]}`;
  };

  // Helper local: extrae id de una FK que puede llegar como objeto, IRI string u objeto JSON-LD.
  const extractFkId = (ref) => {
    if (!ref) return null;
    if (typeof ref === 'string') return ref.split('/').pop();
    if (typeof ref === 'object') {
      return ref.id != null
        ? String(ref.id)
        : (ref['@id'] ? ref['@id'].split('/').pop() : null);
    }
    return null;
  };

  // Resuelve el id de la jornada efectiva con la cadena
  // PL.jornadaTipo > Grupo.jornadaTipoOverride > Itinerario.jornadaTipo,
  // espejo de PeriodoLectivo::getEffectiveJornadaTipo() del backend.
  const resolveEffectiveJornadaId = (g, pl = null) => {
    const plJ = extractFkId(pl?.jornadaTipo);
    if (plJ) return plJ;
    const overrideId = extractFkId(g?.jornadaTipoOverride);
    if (overrideId) return overrideId;
    return extractFkId(g?.itinerario?.jornadaTipo);
  };

  // PL actualmente seleccionado para el grupo en pantalla (puede ser undefined
  // mientras se resuelve la carga inicial — el resto del código maneja ese caso).
  // Declarado aquí (antes de los useEffect que lo consumen) para evitar TDZ.
  const selectedPlId = selectedPlByGrupo[selectedGrupo];
  // Clave compuesta para el estado del editor: cada (grupo, PL) mantiene su
  // propio set de placements/baseline/dirty. Cambiar de PL no descarta el
  // trabajo en progreso del PL anterior.
  const stateKey = (selectedGrupo && selectedPlId) ? `${selectedGrupo}_${selectedPlId}` : '';

  // 1.5) Cargar la jornada efectiva del (grupo, PL) seleccionado.
  // El GET /api/grupos no anida los tramos de la jornada (los serializer groups
  // no encadenan tan profundo), así que hacemos un fetch dedicado a /api/jornada_tipos/{id}.
  // Cadena resuelta: PL.jornadaTipo > Grupo.jornadaTipoOverride > Itinerario.jornadaTipo.
  useEffect(() => {
    if (!selectedGrupo || grupos.length === 0) return;
    const grupoActual = grupos.find(g => String(g.id) === String(selectedGrupo));
    if (!grupoActual) return;
    const plActual = (plByGrupo[selectedGrupo] || []).find(pl => String(pl.id) === String(selectedPlId)) || null;

    const jornadaId = resolveEffectiveJornadaId(grupoActual, plActual);

    if (!jornadaId) {
      // Sin jornada efectiva: marcamos para que el banner aparezca.
      const itinId = extractFkId(grupoActual.itinerario);
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
  }, [selectedGrupo, selectedPlId, grupos, plByGrupo, jornadasPorId]);

  // 1.5.b) Cargar las jornadas disponibles del centro del grupo seleccionado.
  // Alimenta el selector de jornada del infoBar (override por grupo).
  // Un fetch por centro, cacheado en jornadasByCentro.
  useEffect(() => {
    if (!selectedGrupo || grupos.length === 0) return;
    const grupoActual = grupos.find(g => String(g.id) === String(selectedGrupo));
    if (!grupoActual) return;
    const centroId = extractFkId(grupoActual.centro);
    if (!centroId) return;
    if (jornadasByCentro[centroId] !== undefined) return;

    fetch(getApiUrl(`/api/jornada_tipos?centro=${centroId}&pagination=false`),
      { headers: { 'Accept': 'application/ld+json' }, credentials: 'include' })
      .then(r => r.ok ? r.json() : null)
      .then(d => {
        if (!d) return;
        const items = d['hydra:member'] || d.member || [];
        setJornadasByCentro(prev => ({ ...prev, [centroId]: items }));
      })
      .catch(err => console.error('Error cargando jornadas del centro:', err));
  }, [selectedGrupo, grupos, jornadasByCentro]);

  // 1.5.b.bis) Cargar semanas lectivas reales del centro del grupo (Fase 7).
  // Un fetch por centro, cacheado en `semanasLectivasByCentro`. La etapa se
  // pasa como 'fp' por defecto (única soportada hoy en EAG); cuando lleguen
  // grupos ESO/Bach se podrá inferir del Itinerario.
  useEffect(() => {
    if (!selectedGrupo || grupos.length === 0) return;
    const grupoActual = grupos.find(g => String(g.id) === String(selectedGrupo));
    if (!grupoActual) return;
    const centroId = extractFkId(grupoActual.centro);
    if (!centroId) return;
    if (semanasLectivasByCentro[centroId] !== undefined) return;

    fetch(getApiUrl(`/api/v1/centros/${centroId}/semanas-lectivas?etapa=fp`),
      { headers: { 'Accept': 'application/json' }, credentials: 'include' })
      .then(r => r.ok ? r.json() : null)
      .then(d => {
        if (!d) return;
        setSemanasLectivasByCentro(prev => ({ ...prev, [centroId]: d }));
      })
      .catch(err => console.error('Error cargando semanas lectivas del centro:', err));
  }, [selectedGrupo, grupos, semanasLectivasByCentro]);

  // 1.5.c) Cargar los PeriodoLectivo del grupo seleccionado.
  // Fase 3a: alimenta el timeline strip y el cableado del solver/capacity-check
  // al PL activo. La selección por defecto es el rango que contiene today() o,
  // si no hay match, el primero por fechaInicio (mismo criterio que el
  // PeriodoLectivoResolver del backend).
  useEffect(() => {
    if (!selectedGrupo) return;
    if (plByGrupo[selectedGrupo] !== undefined) return;
    fetch(getApiUrl(`/api/periodo_lectivos?grupo=${selectedGrupo}&pagination=false&order[orden]=asc&order[fechaInicio]=asc`),
      { headers: { 'Accept': 'application/ld+json' }, credentials: 'include' })
      .then(r => r.ok ? r.json() : null)
      .then(d => {
        if (!d) return;
        const items = d['hydra:member'] || d.member || [];
        setPlByGrupo(prev => ({ ...prev, [selectedGrupo]: items }));
        // Fijar selección por defecto si aún no hay
        if (!selectedPlByGrupo[selectedGrupo] && items.length > 0) {
          const today = new Date().toISOString().slice(0, 10);
          const active = items.find(pl => pl.fechaInicio <= today && pl.fechaFin >= today)
            || items[0];
          setSelectedPlByGrupo(prev => ({ ...prev, [selectedGrupo]: active.id }));
        }
      })
      .catch(err => console.error('Error cargando PeriodoLectivos:', err));
  }, [selectedGrupo, plByGrupo, selectedPlByGrupo]);

  // 1.5.d) Cargar TODOS los horarios persistidos del grupo (todos los PLs).
  // Necesario para Fase 5 sub-A: el ModuleChip lateral suma horas anuales
  // colocadas a través de TODOS los rangos del grupo. Refetch tras cualquier
  // save (ver `refetchAllHorariosForGroup` y handleSave).
  useEffect(() => {
    if (!selectedGrupo) return;
    if (allHorariosByGroup[selectedGrupo] !== undefined) return;
    fetch(getApiUrl(`/api/horarios?imparticion.grupo=${selectedGrupo}&itemsPerPage=500`),
      { headers: { 'Accept': 'application/ld+json', 'Cache-Control': 'no-cache' }, credentials: 'include' })
      .then(r => r.ok ? r.json() : null)
      .then(d => {
        if (!d) return;
        const items = d['hydra:member'] || d.member || [];
        setAllHorariosByGroup(prev => ({ ...prev, [selectedGrupo]: items }));
      })
      .catch(err => console.error('Error cargando horarios globales:', err));
  }, [selectedGrupo, allHorariosByGroup]);

  // 1.6) Capacity-check del (grupo, PL) seleccionado (sub-fase O, §14.7).
  // Pre-calcula el ILP de asignación slots→materias antes de pulsar "Sugerir".
  // Devuelve feasible/desajuste/roundups/huerfanos para el banner pre-resolución.
  useEffect(() => {
    if (!stateKey) return;
    if (capacityByGrupo[stateKey] !== undefined) return;
    // Skip capacity-check para PLs virtuales (tempId negativo) — el backend
    // no los conoce; el cap se calcula localmente vía capacityFeasibilityAnual
    // que usa los placements del state[gid_tempId] del solver dry-run.
    if (Number(selectedPlId) < 0) return;
    fetch(getApiUrl(`/api/v1/horarios/capacity-check/${selectedGrupo}?periodoLectivo=${selectedPlId}`),
      { headers: { 'Accept': 'application/json' }, credentials: 'include' })
      .then(r => r.ok ? r.json() : null)
      .then(c => {
        if (!c) return;
        setCapacityByGrupo(prev => ({ ...prev, [stateKey]: c }));
      })
      .catch(err => console.error('Error capacity-check:', err));
  }, [stateKey, selectedGrupo, selectedPlId, capacityByGrupo]);

  // 2.a) Cargar imparticiones del grupo INDEPENDIENTEMENTE del PL. Necesario
  // para que `semanasOptimas`, `imps`, ModuleChip y los cálculos de currículo
  // funcionen incluso cuando no hay PL seleccionado (caso típico tras "Limpiar
  // todo el curso", o primera entrada al grupo antes de que se monte stateKey).
  useEffect(() => {
    if (!selectedGrupo) return;
    if (imparticiones[selectedGrupo]) return; // ya cargado en cache
    const noCache = { 'Accept': 'application/ld+json', 'Cache-Control': 'no-cache', 'Pragma': 'no-cache' };
    const bust = Date.now();
    fetch(getApiUrl(`/api/imparticions?grupo=${selectedGrupo}&pagination=false&_=${bust}`),
      { headers: noCache, credentials: 'include', cache: 'no-store' })
      .then(r => r.ok ? r.json() : null)
      .then(d => {
        if (!d) return;
        const items = d['hydra:member'] || d.member || [];
        setImparticiones(prev => ({ ...prev, [selectedGrupo]: items }));
      })
      .catch(err => console.error('Error cargando imparticiones del grupo:', err));
  }, [selectedGrupo, imparticiones]);

  // 2.b) Cargar horarios del PL seleccionado (placements de la rejilla).
  // Las imparticiones se cargan en 2.a (independiente de PL); aquí solo
  // poblamos `state[stateKey].placements` para el rango activo. Si las
  // imparticiones aún no están en cache, las traemos también para evitar
  // race con 2.a.
  useEffect(() => {
    if (!stateKey) return;
    if (state[stateKey]) return;  // ya cargado, mantener trabajo en progreso
    // PL virtual (tempId<0): el backend no lo conoce. Los placements ya
    // están populados desde el dry-run del solver — no necesitamos fetch.
    if (Number(selectedPlId) < 0) return;

    const noCache = { 'Accept': 'application/ld+json', 'Cache-Control': 'no-cache', 'Pragma': 'no-cache' };
    const bust = Date.now();
    const cachedImps = imparticiones[selectedGrupo];
    const impPromise = cachedImps
      ? Promise.resolve({ 'hydra:member': cachedImps })
      : fetch(getApiUrl(`/api/imparticions?grupo=${selectedGrupo}&pagination=false&_=${bust}`),
          { headers: noCache, credentials: 'include', cache: 'no-store' }).then(r => r.json());
    Promise.all([
      impPromise,
      fetch(getApiUrl(`/api/horarios?imparticion.grupo=${selectedGrupo}&periodoLectivo=${selectedPlId}&itemsPerPage=500&_=${bust}`),
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
        [stateKey]: {
          placements,
          dirty: false,
          baseline: { ...placements },
          baselineMaxUpdatedAt,
        },
      }));
    });
  }, [stateKey, selectedGrupo, selectedPlId, state, imparticiones]);

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
  const grupoState = state[stateKey];
  const placements = grupoState?.placements || {};

  // Split de imparticiones por modalidad (Fase 4): solo PRESENCIAL va al panel
  // arrastrable; el resto al sub-panel "Otras horas curriculares" sin drag.
  // Mirror estricto del filtro del backend (CapacityPlanner / HorarioSolver).
  const impsPresenciales = useMemo(
    () => imps.filter(i => consumeAulaModalidad(getEffectiveModalidad(i))),
    [imps],
  );
  const impsNoPresenciales = useMemo(
    () => imps.filter(i => !consumeAulaModalidad(getEffectiveModalidad(i))),
    [imps],
  );

  // Resolver la jornada efectiva del (grupo, PL). Cargada por el useEffect 1.5).
  // Cadena: PL.jornadaTipo > Grupo.jornadaTipoOverride > Itinerario.jornadaTipo
  // (ver PeriodoLectivo::getEffectiveJornadaTipo() en backend).
  const selectedPl = useMemo(() => {
    if (!selectedGrupo || !selectedPlId) return null;
    return (plByGrupo[selectedGrupo] || []).find(pl => String(pl.id) === String(selectedPlId)) || null;
  }, [selectedGrupo, selectedPlId, plByGrupo]);

  const jornadaActual = useMemo(() => {
    if (!grupo) return null;
    const jornadaId = resolveEffectiveJornadaId(grupo, selectedPl);
    if (!jornadaId) return null;
    return jornadasPorId[jornadaId] || null;
  }, [grupo, selectedPl, jornadasPorId]);

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

  // Jornada semanal "lectiva curricular" (Fase 5 — truco recreos): incluye
  // SLOT + RECREO × 5 días. Razón: en muchos centros (LOMLOE FP típicamente)
  // los recreos cuentan como tiempo lectivo a efectos de cumplir el currículo
  // anual ante la inspección. La rejilla y el solver siguen ignorando recreos
  // (no se colocan materias en ellos), pero el cómputo de capacidad anual los
  // suma. Distinto de `slotMinutosByHi` que es solo SLOTs (placement).
  // Asunción universal por ahora; parametrizable a futuro vía Centro/JornadaTipo
  // si algún centro quiere descontarlos del cómputo curricular.
  const jornadaSemanalLectivaMin = useMemo(() => {
    let total = 0;
    tramosOrdenados.forEach(t => {
      if (t.tipo !== 'slot' && t.tipo !== 'recreo') return;
      total += Math.max(0, parseHmsToMin(t.horaFin) - parseHmsToMin(t.horaInicio));
    });
    return total * 5;
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
  // OJO: este es SEMANAL del PL activo (lo usan solver/CapacityPlanner). Para
  // el chip lateral usamos `minutosAnualesColocadosByImp` (Fase 5 sub-A).
  const minutosColocados = useMemo(() => {
    const m = {};
    Object.values(placements).forEach(p => {
      const dur = slotMinutosByHi[p.horaInicio] || 0;
      m[p.imparticionId] = (m[p.imparticionId] || 0) + dur;
    });
    return m;
  }, [placements, slotMinutosByHi]);

  // Semanas por PL del grupo (lookup table) — usado por los memos anuales.
  // Calcula `(fechaFin - fechaInicio + 1) / 7` igual que el resto del código.
  const semanasByPlId = useMemo(() => {
    const m = {};
    (plByGrupo[selectedGrupo] || []).forEach(pl => {
      if (!pl.fechaInicio || !pl.fechaFin) return;
      const ini = new Date(pl.fechaInicio.slice(0, 10));
      const fin = new Date(pl.fechaFin.slice(0, 10));
      const days = Math.max(0, Math.round((fin - ini) / 86400000) + 1);
      m[pl.id] = days / 7;
    });
    return m;
  }, [plByGrupo, selectedGrupo]);

  // Minutos ANUALES colocados por imparticion (Fase 5 sub-A): suma a través
  // de TODOS los rangos del grupo. Por cada PL del grupo:
  //  · Si hay state local (placements en memoria, posiblemente sin guardar):
  //    usar el local. Eso incluye cambios del solver y drag-and-drop pendientes.
  //  · Si no hay state local: usar persistidos de `allHorariosByGroup`.
  // De este modo, ejecutar el solver en los 3 rangos uno tras otro suma los 3
  // sin necesidad de guardar entre medias (siempre que no haya hard-refresh).
  const minutosAnualesColocadosByImp = useMemo(() => {
    const acc = {};
    if (!selectedGrupo) return acc;
    const pls = plByGrupo[selectedGrupo] || [];
    const persistedByPl = {};
    (allHorariosByGroup[selectedGrupo] || []).forEach(h => {
      const plId = extractFkId(h.periodoLectivo);
      if (!plId) return;
      if (!persistedByPl[plId]) persistedByPl[plId] = [];
      persistedByPl[plId].push(h);
    });
    pls.forEach(pl => {
      const semanas = semanasByPlId[pl.id] || 0;
      if (semanas <= 0) return;
      const localKey = `${selectedGrupo}_${pl.id}`;
      const localState = state[localKey];
      if (localState?.placements) {
        // State local (sin guardar incluido). Usa la duración del slot map del PL
        // activo como aproximación (jornada típicamente igual entre rangos).
        Object.values(localState.placements).forEach(p => {
          const dur = slotMinutosByHi[p.horaInicio] || 0;
          if (dur <= 0) return;
          acc[p.imparticionId] = (acc[p.imparticionId] || 0) + dur * semanas;
        });
      } else {
        // Sin state local: leer persistidos del PL.
        (persistedByPl[pl.id] || []).forEach(h => {
          const dur = parseHmsToMin(h.horaFin) - parseHmsToMin(h.horaInicio);
          if (dur <= 0) return;
          const impId = Number(getId(h.imparticion));
          if (!impId) return;
          acc[impId] = (acc[impId] || 0) + dur * semanas;
        });
      }
    });
    return acc;
  }, [selectedGrupo, plByGrupo, allHorariosByGroup, semanasByPlId, state, slotMinutosByHi]);

  // Objetivo anual por imparticion (Opción A 2026-04-29): usa
  // `materia.horasTotales × 60` que es la "ley LOMLOE" (RD del título).
  // Fallback a `min/sem × semanasReferenciaCentro` solo si horasTotales no
  // está set (caso edge). Antes el sistema asumía calendario rígido de 36
  // sem; ahora (Fase 7) lo lee del calendario real del centro descontando
  // festivos. Si el centro no tiene ni overrides ni CalendarioEscolarCcaa
  // disponible, cae a 36 LOMLOE.
  const semanasReferenciaCentro = useMemo(() => {
    if (!selectedGrupo) return 36;
    const grupo = grupos.find(g => String(g.id) === String(selectedGrupo));
    const centroId = grupo ? extractFkId(grupo.centro) : null;
    const r = centroId ? semanasLectivasByCentro[centroId] : null;
    return (r && r.semanas != null && r.semanas > 0) ? r.semanas : 36;
  }, [selectedGrupo, grupos, semanasLectivasByCentro]);
  const minutosAnualesObjetivoByImp = useMemo(() => {
    const m = {};
    imps.forEach(imp => {
      const horasTot = imp.materia?.horasTotales;
      if (horasTot != null && horasTot > 0) {
        m[imp.id] = horasTot * 60;
      } else {
        m[imp.id] = (imp.materia?.minutosSemanales || 0) * semanasReferenciaCentro;
      }
    });
    return m;
  }, [imps, semanasReferenciaCentro]);

  const totalMinutos = imps.reduce((a, i) => a + (i.materia?.minutosSemanales || 0), 0);

  // Capacidad SOLO de slots colocables por semana (sin recreos). Necesario
  // para semanasOptimas: el solver físicamente solo coloca placements en
  // slots, no en recreos. Las horas a impartir deben caber en slots reales.
  const slotsSemanalMin = useMemo(() => {
    let total = 0;
    tramosOrdenados.forEach(t => {
      if (t.tipo !== 'slot') return;
      total += Math.max(0, parseHmsToMin(t.horaFin) - parseHmsToMin(t.horaInicio));
    });
    return total * 5;
  }, [tramosOrdenados]);

  // Semanas óptimas necesarias para cubrir el currículo presencial al 100%
  // (Opción A 2026-04-29):
  //   semanasOptimas = ceil(Σ horasTotalesAnuales × 60 / capSlotsSemanal)
  //
  // Principio "tiempos fluidos" (consenso usuario, ver Fase 5 §Visión y
  // bitácora 2026-04-28):
  // - La jornada del centro NO es discutible (27.5h/sem o lo que toque).
  // - `horasTotales` por materia NO es discutible (ley LOMLOE, BOE/BOJA).
  // - El **calendario** ES la variable: si la jornada × semanas calendario
  //   no llega al currículo, se extiende `Grupo.fechaFin` las semanas que
  //   hagan falta. Si sobra calendario, el centro decide qué hacer con el
  //   tiempo libre (FCT, exámenes, repaso). El sistema NO impone un suelo
  //   de 36 sem LOMLOE — eso es convención, no obligación legal.
  //
  // Para 1º DAW EAG: 1044h × 60 / 1650 (27.5h slots) = ceil(37.96) = 38 sem.
  // Para 2º DAM con jornada generosa que cabe en 32 sem: devuelve 32 sem.
  const semanasOptimas = useMemo(() => {
    const objetivoAnualPresencialMin = imps.reduce((a, i) => {
      if (!consumeAulaModalidad(getEffectiveModalidad(i))) return a;
      // Opción A: usa horasTotales (h × 60 = min anuales). Fallback a
      // min/sem × semanasReferenciaCentro solo si la materia no tiene h totales.
      const horasTot = i.materia?.horasTotales;
      if (horasTot != null && horasTot > 0) return a + horasTot * 60;
      return a + (i.materia?.minutosSemanales || 0) * semanasReferenciaCentro;
    }, 0);
    if (objetivoAnualPresencialMin <= 0 || slotsSemanalMin <= 0) return 0;
    return Math.ceil(objetivoAnualPresencialMin / slotsSemanalMin);
  }, [imps, slotsSemanalMin, semanasReferenciaCentro]);
  const colocadosMinutos = Object.values(placements).reduce(
    (a, p) => a + (slotMinutosByHi[p.horaInicio] || 0), 0
  );
  // Display semanal del badge: muestra "X/Yh" con cap a slots colocables si
  // hay sobrecarga (no engañar al admin con un target inalcanzable).
  const slotsCapacityWeekly = Object.values(slotMinutosByHi).reduce((a, b) => a + b, 0) * 5;
  const targetMinutos = slotsCapacityWeekly > 0
    ? Math.min(totalMinutos, slotsCapacityWeekly)
    : totalMinutos;
  const totalHoras = minToHoras(targetMinutos);
  const colocadasTotal = minToHoras(colocadosMinutos);
  const completitud = targetMinutos ? (colocadosMinutos / targetMinutos) * 100 : 0;
  // Estado del badge se decide por COBERTURA ANUAL cross-rango: complete si
  // TODAS las materias del grupo están a ≤1.5h por debajo de su objetivo
  // curricular (LOMLOE 36 sem). El cap del solver puede dejar slots vacíos en
  // el rango activo cuando otros rangos ya cubrieron — eso no es "incompleto",
  // es el comportamiento correcto del modelo cross-rango.
  const TOLERANCIA_ANUAL_MIN = 90;
  const allAnualCubierto = imps.length > 0 && imps.every(imp => {
    const target = minutosAnualesObjetivoByImp[imp.id] || 0;
    if (target <= 0) return true;
    const placed = minutosAnualesColocadosByImp[imp.id] || 0;
    return placed >= target - TOLERANCIA_ANUAL_MIN;
  });
  const estado =
    allAnualCubierto ? 'complete' :
    completitud >= 80 ? 'draft' : 'incomplete';

  // Cuando estado=complete por cobertura ANUAL (cross-rango) pero el rango
  // activo está parcialmente lleno (semanal<target), las cifras semanales
  // ("25/27.5h") generan disonancia con la etiqueta verde "Completo". Si el
  // rango activo no está lleno semanalmente pero el currículo anual sí está
  // cubierto, mostramos la cifra anual cross-rango para que el badge sea
  // coherente con el color.
  const colocadasAnualTotalMin = Object.values(minutosAnualesColocadosByImp)
    .reduce((a, b) => a + b, 0);
  const objetivoAnualTotalMin = Object.values(minutosAnualesObjetivoByImp)
    .reduce((a, b) => a + b, 0);
  const showAnualLabel = estado === 'complete' && colocadosMinutos < targetMinutos;
  const labelDone = showAnualLabel ? minToHoras(colocadasAnualTotalMin) : colocadasTotal;
  const labelTotal = showAnualLabel ? minToHoras(objetivoAnualTotalMin) : totalHoras;

  const estadoBadge = {
    complete:   {
      cls: styles.statusComplete,
      icon: <CheckCircle2 size={16} />,
      label: t(
        showAnualLabel ? 'scheduleEditor.statusCompleteAnual' : 'scheduleEditor.statusComplete',
        { done: labelDone, total: labelTotal },
      ),
    },
    draft:      { cls: styles.statusDraft,      icon: <AlertTriangle size={16} />, label: t('scheduleEditor.statusDraft',      { done: labelDone, total: labelTotal }) },
    incomplete: { cls: styles.statusIncomplete, icon: <XCircle size={16} />,      label: t('scheduleEditor.statusIncomplete', { done: labelDone, total: labelTotal }) },
  }[estado];

  // Mapa de imparticion por id (acceso rápido para validación)
  const impById = useMemo(() => {
    const m = {};
    imps.forEach(i => { m[i.id] = i; });
    return m;
  }, [imps]);

  // Banner Σ horas anuales: compara horas curriculares del grupo (Σ
  // materia.minutosSemanales × 36 semanas estándar) contra horas planificadas
  // (Σ por PL de Σ PLI.effectiveMinutosSemanales × semanasDelRango). El cálculo
  // ignora festivos por simplicidad (Fase 3b); cuando llegue Fase 7 con el
  // calendario lectivo del centro, la Σ de semanas se podrá ajustar restando
  // semanas no lectivas. Tonalidad asimétrica (D-C): SOBRAR horas no es un
  // problema (cumples el currículo y tienes margen, caso típico cuando la
  // jornada lectiva real es 27.5h/sem y hace falta más semanas para meter las
  // 32h/sem del currículo). Lo que sí alarma es FALTAR horas (incumplimiento).
  //   - Verde: |diff| ≤ 5h (cuadra) o diff > 5h (sobran — cumples)
  //   - Amarillo: faltan entre 5h y 15h (margen pequeño de incumplimiento)
  //   - Rojo: faltan más de 15h (incumplimiento real del currículo)
  const horasAnualesBanner = useMemo(() => {
    // Semanas de referencia: las reales del centro (Fase 7 — descuenta
    // festivos del calendario lectivo). Si no hay calendario disponible, 36
    // LOMLOE como fallback. Solo afecta al fallback de currículo cuando una
    // materia no tiene horasTotales (caso edge tras backfill).
    const semanasReferencia = semanasReferenciaCentro;
    const TOL_OK = 5;             // ±5h se considera cuadrado
    const TOL_WARN = 15;          // si faltan entre 5h y 15h, amarillo; más, rojo
    if (!selectedGrupo) return null;
    const pls = plByGrupo[selectedGrupo] || [];
    if (pls.length === 0 || imps.length === 0) return null;

    // Currículo (Opción A 2026-04-29): Σ horas totales anuales × 60 (ley LOMLOE).
    // Fallback a min/sem × semanasReferencia si la materia no tiene horasTotales.
    const curriculumMin = imps.reduce((acc, i) => {
      const horasTot = i.materia?.horasTotales;
      if (horasTot != null && horasTot > 0) return acc + horasTot * 60;
      return acc + (i.materia?.minutosSemanales || 0) * semanasReferencia;
    }, 0);

    // Cap semanal "lectivo curricular" (slots + recreos × 5 días). Asumimos
    // que la jornada del PL activo es representativa de todos los PLs del
    // grupo — approximación; rangos con jornadas distintas darán cifra
    // ~aproximada. Necesario para que el plan no prometa más horas que las
    // que físicamente caben (Fase 5 sub-C polish): si Σ pli/sem > jornada/sem,
    // el plan debe cap a la capacidad. Recreos cuentan aquí (truco LOMLOE FP).
    const jornadaSemanalMin = jornadaSemanalLectivaMin;

    // Planificado: por cada PL, semanas del rango × min(Σ minutos efectivos
    // PLI, jornadaSemanalMin). El min cap evita el caso "plan > capacity"
    // que producía verdicts contradictorios entre este banner y el del
    // CapacityPlanner ("plan +50h cumple" vs "capacidad -119h faltan").
    let plannedMin = 0;
    let semanasTotal = 0;
    pls.forEach(pl => {
      if (!pl.fechaInicio || !pl.fechaFin) return;
      const ini = new Date(pl.fechaInicio.slice(0, 10));
      const fin = new Date(pl.fechaFin.slice(0, 10));
      const days = Math.max(0, Math.round((fin - ini) / 86400000) + 1);
      const semanas = days / 7;
      semanasTotal += semanas;
      const plis = pl.imparticiones || [];
      const sumPliMin = plis.reduce((acc, pli) => {
        if (pli.deleted) return acc;
        const overrideMin = pli.minutosSemanales;
        if (overrideMin != null) return acc + overrideMin;
        const impId = extractFkId(pli.imparticion);
        const imp = impById[impId];
        return acc + (imp?.materia?.minutosSemanales || 0);
      }, 0);
      const minPerWeekColocables = jornadaSemanalMin > 0
        ? Math.min(sumPliMin, jornadaSemanalMin)
        : sumPliMin;
      plannedMin += minPerWeekColocables * semanas;
    });

    const curriculumHoras = Math.round(curriculumMin / 60);
    const plannedHoras = Math.round(plannedMin / 60);
    const diff = plannedHoras - curriculumHoras;
    // Tonalidad asimétrica: sobrar horas no es problema; faltar sí.
    let tone;
    if (Math.abs(diff) <= TOL_OK) tone = 'ok';        // cuadra (±5h)
    else if (diff > 0) tone = 'ok';                    // sobran ≥ 5h (cumples currículo)
    else if (-diff <= TOL_WARN) tone = 'warn';         // faltan entre 5 y 15h
    else tone = 'error';                                // faltan más de 15h
    const diffSigned = diff > 0 ? `+${diff}` : `${diff}`;
    return {
      curriculumHoras,
      plannedHoras,
      diff,
      diffSigned,
      tone,
      plCount: pls.length,
      semanasTotal: Math.round(semanasTotal * 10) / 10,
    };
  }, [selectedGrupo, plByGrupo, imps, impById, jornadaSemanalLectivaMin]);

  // Sugerencia de extensión de curso (Fase 5 sub-B): cuando el banner anual
  // muestra que faltan horas (tone warn/error), calcula cuántos días lectivos
  // habría que extender el curso para que el banner pase a verde. El cálculo:
  //   - jornadaSemanal = jornadaSemanalLectivaMin (slots + recreos × 5 días,
  //     truco LOMLOE FP que cuenta recreos como lectivo curricular)
  //   - extraSemanas = ceil(faltanHoras / jornadaSemanal_en_horas)
  //   - extraDays = extraSemanas × 7 (días naturales)
  //   - lastPl = PL del grupo con mayor fechaFin (= "el último rango")
  //   - newLastPlFin = lastPl.fechaFin + extraDays
  //   - newGrupoFin = lastPl.fechaFin + extraDays (sincronizamos por arriba)
  //   - preview de newDiff: lo que aporta el último PL en horas extra (Σ
  //     minEffective del último PL × extraSemanas) sumado al planificado actual.
  // Devuelve null si: banner ok, jornada vacía, no hay PLs, o si Grupo no
  // tiene fechaFin (caso edge, no debería pasar en producción).
  const extendCourseSuggestion = useMemo(() => {
    if (!horasAnualesBanner) return null;
    if (horasAnualesBanner.tone === 'ok') return null;        // ya cuadrado o sobran
    const faltanHoras = -horasAnualesBanner.diff;             // tone warn/error → diff < 0
    if (faltanHoras <= 0) return null;
    const jornadaSemanaMin = jornadaSemanalLectivaMin;
    if (jornadaSemanaMin <= 0) return null;
    const jornadaSemanaH = jornadaSemanaMin / 60;
    const extraSemanas = Math.ceil(faltanHoras / jornadaSemanaH);
    if (extraSemanas <= 0) return null;
    const extraDays = extraSemanas * 7;
    const pls = plByGrupo[selectedGrupo] || [];
    if (pls.length === 0) return null;
    // Último PL por fechaFin (lex sort funciona con ISO YYYY-MM-DD)
    const lastPl = [...pls].sort((a, b) => (b.fechaFin || '').localeCompare(a.fechaFin || ''))[0];
    if (!lastPl?.fechaFin) return null;
    const oldLastPlFinISO = lastPl.fechaFin.slice(0, 10);
    const oldLastPlFinDate = new Date(oldLastPlFinISO);
    const newLastPlFinDate = new Date(oldLastPlFinDate);
    newLastPlFinDate.setDate(newLastPlFinDate.getDate() + extraDays);
    const newLastPlFinISO = newLastPlFinDate.toISOString().slice(0, 10);
    const oldGrupoFinISO = grupo?.fechaFin ? grupo.fechaFin.slice(0, 10) : null;
    // Grupo.fechaFin se sincroniza por arriba: si el grupo ya termina DESPUÉS
    // del nuevo último rango, no lo tocamos (sería adelantar el curso, bug).
    // Sólo lo extendemos si el último rango ahora se pasa de la fecha actual
    // del grupo.
    const newGrupoFinISO = (oldGrupoFinISO && oldGrupoFinISO >= newLastPlFinISO)
      ? oldGrupoFinISO
      : newLastPlFinISO;
    const grupoNeedsPatch = oldGrupoFinISO !== newGrupoFinISO;
    // Σ min/sem efectivos del último PL: lo que aporta una semana extra de ese
    // rango al planificado anual.
    const lastPlPlis = lastPl.imparticiones || [];
    const sumLastPlMin = lastPlPlis.reduce((acc, pli) => {
      if (pli.deleted) return acc;
      if (pli.minutosSemanales != null) return acc + pli.minutosSemanales;
      const impId = extractFkId(pli.imparticion);
      const imp = impById[impId];
      return acc + (imp?.materia?.minutosSemanales || 0);
    }, 0);
    const extraHoras = (sumLastPlMin * extraSemanas) / 60;
    const newPlanned = horasAnualesBanner.plannedHoras + extraHoras;
    const newDiff = Math.round(newPlanned - horasAnualesBanner.curriculumHoras);
    let newTone;
    if (Math.abs(newDiff) <= 5) newTone = 'ok';
    else if (newDiff > 0) newTone = 'ok';
    else if (-newDiff <= 15) newTone = 'warn';
    else newTone = 'error';
    return {
      faltanHoras,
      extraSemanas,
      extraDays,
      lastPl,
      lastPlNombre: lastPl.nombre || `#${lastPl.id}`,
      oldLastPlFinISO,
      newLastPlFinISO,
      oldGrupoFinISO,
      newGrupoFinISO,
      grupoNeedsPatch,
      newDiff,
      newDiffSigned: newDiff > 0 ? `+${newDiff}` : `${newDiff}`,
      newTone,
    };
  }, [horasAnualesBanner, jornadaSemanalLectivaMin, plByGrupo, selectedGrupo, grupo, impById]);

  // Feasibility ANUAL global del grupo (Fase 5 sub-C): compara Σ currículo
  // anual contra Σ capacidad real (jornada × semanas total del grupo). Si
  // cabe globalmente, una sobrecarga semanal en un rango concreto no es alarma
  // — sólo informativa (el admin redistribuye desde Sliders o crea otro rango).
  // Si NO cabe globalmente, el banner del CapacityPlanner pasa a rojo real:
  // hay que extender curso o subir jornada (no hay redistribución que arregle
  // un déficit físico de capacidad).
  // Distinto del banner anual de Fase 3b (que compara plan vs currículo, no
  // capacidad vs currículo).
  // Opción A (2026-04-29): el objetivo curricular se lee de
  // `minutosAnualesObjetivoByImp` (horasTotales×60 con fallback min/sem×36),
  // no de `min/sem × 36` rígido. Y solo cuentan las materias presenciales:
  // FCT/NO_REGULAR/AUTONOMA no compiten por la jornada lectiva del centro.
  const capacityFeasibilityAnual = useMemo(() => {
    if (!selectedGrupo) return null;
    if (imps.length === 0) return null;
    const sumCurriculumMin = imps.reduce((acc, i) => {
      if (!consumeAulaModalidad(getEffectiveModalidad(i))) return acc;
      return acc + (minutosAnualesObjetivoByImp[i.id] || 0);
    }, 0);
    if (sumCurriculumMin <= 0) return null;
    // Capacidad lectiva curricular: incluye recreos (truco LOMLOE FP).
    const jornadaSemanalMin = jornadaSemanalLectivaMin;
    if (jornadaSemanalMin <= 0) return null;
    const semanasTotal = Object.values(semanasByPlId).reduce((a, b) => a + b, 0);
    if (semanasTotal <= 0) return null;
    const capacidadAnualMin = jornadaSemanalMin * semanasTotal;
    const fits = capacidadAnualMin >= sumCurriculumMin;
    const deficitH = fits ? 0 : Math.round((sumCurriculumMin - capacidadAnualMin) / 60);
    return {
      curriculumH: Math.round(sumCurriculumMin / 60),
      capacidadH: Math.round(capacidadAnualMin / 60),
      jornadaSemanalH: Math.round((jornadaSemanalMin / 60) * 10) / 10,
      semanasTotal: Math.round(semanasTotal * 10) / 10,
      fits,
      deficitH,
    };
  }, [selectedGrupo, imps, jornadaSemanalLectivaMin, semanasByPlId, minutosAnualesObjetivoByImp]);

  // Semanas del rango activo en el modal (Fase 5 sub-A): se usa para convertir
  // entre min/sem ↔ horas anuales. Cálculo: ceil((fechaFin - fechaInicio) / 7).
  // Si el PL no tiene fechas válidas, fallback a 1 (evita división por cero;
  // muestra valores inflados pero al menos no crashea).
  const pliModalSemanasRango = useMemo(() => {
    if (!pliModalPlId) return 0;
    const pl = (plByGrupo[selectedGrupo] || []).find(p => String(p.id) === String(pliModalPlId));
    if (!pl?.fechaInicio || !pl?.fechaFin) return 0;
    const ini = new Date(pl.fechaInicio.slice(0, 10));
    const fin = new Date(pl.fechaFin.slice(0, 10));
    const days = Math.max(0, Math.round((fin - ini) / 86400000) + 1);
    return days / 7;
  }, [pliModalPlId, plByGrupo, selectedGrupo]);

  // Filas del modal "Materias del rango" (Fase 4): join de imparticiones del
  // grupo con los PLIs del PL seleccionado en el modal. Cada fila incluye:
  // - imp: la Imparticion (siempre presente)
  // - pli: el PLI vivo en el rango (null si la materia no está activa)
  // - isActive: derivado de pli !== null
  // - isOverride: pli existe y minutosSemanales != null
  // - effectiveMin: minutos semanales efectivos (override o default heredado de Materia)
  // - defaultMin: el default semanal de la materia (para el placeholder/reset)
  // - effectiveHorasAnualesRango: horas anuales que esta imparticion aporta en
  //   este rango concreto (Fase 5 sub-A). Es la cifra que el admin edita.
  // - defaultHorasAnualesRango: horas anuales que daría el default heredado en
  //   las semanas de este rango (placeholder).
  const pliModalRows = useMemo(() => {
    if (!pliModalPlId) return [];
    const plis = pliByPl[pliModalPlId] || [];
    const byImpId = {};
    plis.forEach(pli => {
      const impId = extractFkId(pli.imparticion);
      if (impId) byImpId[String(impId)] = pli;
    });
    const semanas = pliModalSemanasRango || 0;
    const minToHorasRango = (m) => semanas > 0 ? Math.round((m * semanas / 60) * 10) / 10 : 0;
    return imps.map(imp => {
      const pli = byImpId[String(imp.id)] || null;
      const defaultMin = imp.materia?.minutosSemanales || 0;
      const isActive = !!pli;
      const isOverride = !!(pli && pli.minutosSemanales != null);
      const effectiveMin = isActive
        ? (pli.minutosSemanales != null ? pli.minutosSemanales : defaultMin)
        : 0;
      return {
        imp,
        pli,
        isActive,
        isOverride,
        effectiveMin,
        defaultMin,
        effectiveHorasAnualesRango: minToHorasRango(effectiveMin),
        defaultHorasAnualesRango: minToHorasRango(defaultMin),
      };
    });
  }, [pliModalPlId, pliByPl, imps, pliModalSemanasRango]);

  const pliModalSummary = useMemo(() => {
    if (!pliModalPlId) return null;
    // Σ semanal del rango: con qué peso semanal está el rango planificado.
    const planMin = pliModalRows.reduce((acc, r) => acc + (r.isActive ? r.effectiveMin : 0), 0);
    // Cap semanal de la jornada del rango: Σ slot durations × 5 días.
    const slotsMin = Object.values(slotMinutosByHi).reduce((a, b) => a + b, 0);
    const capMin = slotsMin * 5;
    // Conversión a horas anuales para el rango (Fase 5 sub-A): peso semanal × semanas.
    const semanas = pliModalSemanasRango || 0;
    const planAnualH = semanas > 0 ? Math.round((planMin * semanas / 60) * 10) / 10 : 0;
    const capAnualH = semanas > 0 ? Math.round((capMin * semanas / 60) * 10) / 10 : 0;
    return {
      planMin,
      capMin,
      planH: Math.round((planMin / 60) * 10) / 10,
      capH: Math.round((capMin / 60) * 10) / 10,
      planAnualH,
      capAnualH,
      semanas: Math.round(semanas * 10) / 10,
      fits: capMin > 0 ? planMin <= capMin : null,
    };
  }, [pliModalPlId, pliModalRows, slotMinutosByHi, pliModalSemanasRango]);

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

    // Regla 1: horas anuales restantes > 0 (Fase 5 sub-A — antes era semanal del
    // PL activo; ahora bloqueamos sólo cuando se han colocado las horas anuales
    // completas del currículo en cualquier rango del grupo).
    if (drag.type === 'module') {
      const totalAnualMin = minutosAnualesObjetivoByImp[impId] || 0;
      const colocadasAnualMin = minutosAnualesColocadosByImp[impId] || 0;
      if (totalAnualMin > 0 && colocadasAnualMin >= totalAnualMin) {
        return { ok: false, reason: t('scheduleEditor.reasonModuleFull', { total: minToHoras(totalAnualMin), module: imp.materia?.nombre }) };
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
        toast.error(validation.reason);
        return;
      }
      const key = `${o.dia}_${slotsDia[o.slot][0]}`;
      setState(prev => ({
        ...prev,
        [stateKey]: {
          ...prev[stateKey],
          placements: {
            ...prev[stateKey].placements,
            [key]: {
              imparticionId: a.imparticionId,
              aula: resolveAulaJs(imps.find(i => i.id === a.imparticionId), grupo),
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
        const p = { ...prev[stateKey].placements };
        delete p[a.slotId];
        return { ...prev, [stateKey]: { ...prev[stateKey], placements: p, dirty: true } };
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
        toast.error(validation.reason);
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
          toast.error(v2.reason);
          return;
        }
      }
      const [srcDia, srcHoraIni] = srcKey.split('_');
      const srcSlot = slotsDia.find(s => s[0] === srcHoraIni);
      const srcHoraFin = srcSlot ? srcSlot[1] : null;
      setState(prev => {
        const p = { ...prev[stateKey].placements };
        const src = p[srcKey];
        const dst = p[dstKey];
        // Al mover, actualizamos horaInicio/horaFin del objeto a su NUEVA posición
        p[dstKey] = { ...src, horaInicio: dstHoraIni, horaFin: dstHoraFin };
        if (dst) p[srcKey] = { ...dst, horaInicio: srcHoraIni, horaFin: srcHoraFin };
        else delete p[srcKey];
        return { ...prev, [stateKey]: { ...prev[stateKey], placements: p, dirty: true } };
      });
    }
  }, [selectedGrupo, placements, imps, minutosColocados, slotsDia, grupo]);

  // Estado para el modal de conflicto y el de confirmación de publicación incompleta
  const [conflictOpen, setConflictOpen] = useState(false);
  const [publishConfirmOpen, setPublishConfirmOpen] = useState(false);

  // Construye las operaciones de batch desde el diff baseline→current.
  // Acepta un stateKey opcional (default: el del PL activo) para que el guardar
  // multi-rango pueda iterar sobre cada PL del grupo.
  const buildBatchOps = (stKey = stateKey) => {
    const st = state[stKey];
    const baseline = st?.baseline || {};
    const current = st?.placements || {};
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

  // Lista de imparticiones con horas anuales pendientes (modal de publicar
  // incompleto). Comparación cross-rango con tolerancia 1.5h: solo lista las
  // materias que de verdad no llegan al currículo anual sumando todos los PLs.
  // Antes era semanal del PL activo, lo que confundía cuando el cap anual del
  // solver recortaba cuotas legítimamente.
  const unplacedSummary = useMemo(() => {
    const TOL_MIN = 90;
    return imps
      .map(imp => {
        const objetivoAnualMin = minutosAnualesObjetivoByImp[imp.id] || 0;
        if (objetivoAnualMin <= 0) return null;
        const colocadosAnualMin = minutosAnualesColocadosByImp[imp.id] || 0;
        if (colocadosAnualMin >= objetivoAnualMin - TOL_MIN) return null;
        const faltanMin = objetivoAnualMin - colocadosAnualMin;
        return {
          nombre: imp.materia?.nombre || '—',
          faltan: minToHoras(faltanMin),
          total: minToHoras(objetivoAnualMin),
        };
      })
      .filter(Boolean);
  }, [imps, minutosAnualesObjetivoByImp, minutosAnualesColocadosByImp]);

  // Ejecuta el guardado real (batch) para el PL especificado. Devuelve true
  // si OK. Si plId es null, usa el activo. El multi-save de "Guardar todos"
  // recorre los PLs dirty del grupo y llama a esta función para cada uno.
  const performBatchSave = async (plId = null) => {
    const targetPlId = plId ?? selectedPlId;
    const targetKey = (selectedGrupo && targetPlId) ? `${selectedGrupo}_${targetPlId}` : '';
    if (!targetKey) return true;
    const targetState = state[targetKey];
    if (!targetState) return true;
    setSaving(true);
    try {
      const operations = buildBatchOps(targetKey);
      if (operations.length === 0) {
        // Aun así, marca dirty=false por consistencia (puede haber sido un
        // toggle limpiado).
        setState(prev => ({
          ...prev,
          [targetKey]: { ...prev[targetKey], dirty: false },
        }));
        return true;
      }
      const res = await fetch(getApiUrl('/api/v1/horarios/batch'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          grupoId: Number(selectedGrupo),
          periodoLectivoId: targetPlId ? Number(targetPlId) : null,
          baselineMaxUpdatedAt: targetState?.baselineMaxUpdatedAt || null,
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
      const current = targetState.placements || {};
      const newBaseline = { ...current };
      (data.created || []).forEach(({ clientKey, id }) => {
        if (clientKey && newBaseline[clientKey]) {
          newBaseline[clientKey] = { ...newBaseline[clientKey], hid: id };
        }
      });
      setState(prev => ({
        ...prev,
        [targetKey]: {
          ...prev[targetKey],
          placements: newBaseline,
          baseline: newBaseline,
          baselineMaxUpdatedAt: data.maxUpdatedAt || null,
          dirty: false,
        },
      }));
      refetchAllHorariosForGroup(selectedGrupo);
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

  // Aplica la cola pendingTxByGrupo[gid] a BD en orden estricto:
  //   1. PATCH Grupo.fechaFin si está pendiente.
  //   2. DELETE PLs marcados.
  //   3. POST PLs nuevos (los virtuales) y captura el mapping tempId→realId.
  //   4. PATCH PLI minutosSemanales (sobre los reales recién creados via
  //      mapping, o sobre los reales existentes).
  //   5. Refetch PLs reales del grupo (alimenta el strip con datos definitivos).
  //   6. Reescribe state[gid_tempId] → state[gid_realId] para que el batch
  //      save de placements use el realId al POSTear horarios.
  // Si cualquier paso falla, aborta y devuelve false; los placements no se
  // tocan, así el usuario puede corregir y reintentar.
  const applyPendingTxForGrupo = async (gid) => {
    const tx = pendingTxByGrupo[gid];
    if (!tx) return { ok: true, tempIdToRealId: {} };

    // 1. PATCH Grupo.fechaFin
    if (tx.grupoFechaFin) {
      const r = await fetch(getApiUrl(`/api/grupos/${gid}`), {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/merge-patch+json', 'Accept': 'application/ld+json' },
        credentials: 'include',
        body: JSON.stringify({ fechaFin: tx.grupoFechaFin }),
      });
      if (!r.ok) return { ok: false, error: `PATCH grupo: ${r.status}` };
      const updated = await r.json();
      setGrupos(prev => prev.map(g => String(g.id) === String(gid) ? { ...g, ...updated } : g));
    }

    // 2. DELETE PLs marcados
    for (const realPlId of (tx.plsToDelete || [])) {
      const r = await fetch(getApiUrl(`/api/periodo_lectivos/${realPlId}`), {
        method: 'DELETE',
        credentials: 'include',
      });
      if (!r.ok && r.status !== 404) return { ok: false, error: `DELETE PL ${realPlId}: ${r.status}` };
    }

    // 2.b PATCH PLs reales editados (cambiar nombre/fechas/jornada).
    for (const upd of (tx.plsToUpdate || [])) {
      const body = {};
      if (upd.nombre !== undefined) body.nombre = upd.nombre;
      if (upd.fechaInicio !== undefined) body.fechaInicio = upd.fechaInicio;
      if (upd.fechaFin !== undefined) body.fechaFin = upd.fechaFin;
      if (upd.jornadaTipoId !== undefined) {
        body.jornadaTipo = upd.jornadaTipoId ? `/api/jornada_tipos/${upd.jornadaTipoId}` : null;
      }
      if (Object.keys(body).length === 0) continue;
      const r = await fetch(getApiUrl(`/api/periodo_lectivos/${upd.realId}`), {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/merge-patch+json', 'Accept': 'application/ld+json' },
        credentials: 'include',
        body: JSON.stringify(body),
      });
      if (!r.ok) return { ok: false, error: `PATCH PL ${upd.realId}: ${r.status}` };
    }

    // 3. POST PLs nuevos. PeriodoLectivoCreateProcessor del backend crea
    //    automáticamente un PLI por cada Imparticion del grupo (minutos
    //    NULL = hereda Materia). El mapping tempId→realId nos sirve para
    //    el patcheo de PLIs y para reescribir state[gid_tempId].
    const tempIdToRealId = {};
    for (const draft of (tx.plsToCreate || [])) {
      const body = {
        grupo: `/api/grupos/${gid}`,
        nombre: draft.nombre,
        fechaInicio: draft.fechaInicio,
        fechaFin: draft.fechaFin,
        orden: draft.orden ?? 0,
      };
      if (draft.jornadaTipoId) body.jornadaTipo = `/api/jornada_tipos/${draft.jornadaTipoId}`;
      const r = await fetch(getApiUrl('/api/periodo_lectivos'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/ld+json', 'Accept': 'application/ld+json' },
        credentials: 'include',
        body: JSON.stringify(body),
      });
      if (!r.ok) return { ok: false, error: `POST PL: ${r.status}` };
      const created = await r.json();
      tempIdToRealId[draft.tempId] = created.id ?? Number(created['@id']?.split('/').pop());
    }

    // 4. PATCH PLI minutosSemanales con la distribución calculada en dry-run.
    //    pliPatches es [{ plKey, imparticionId, minutosSemanales }] donde
    //    plKey puede ser un tempId (mapear a realId) o un realId existente.
    if ((tx.pliPatches || []).length > 0) {
      // Refetch de PLIs por (PL real) para conocer el id de cada PLI.
      const plKeys = [...new Set(tx.pliPatches.map(p => {
        const realId = tempIdToRealId[p.plKey] ?? p.plKey;
        return Number(realId);
      }).filter(Boolean))];
      const pliByPlReal = {};
      for (const realPlId of plKeys) {
        const r = await fetch(getApiUrl(`/api/periodo_lectivo_imparticions?periodoLectivo=${realPlId}&pagination=false`), {
          headers: { 'Accept': 'application/ld+json' }, credentials: 'include',
        });
        if (!r.ok) return { ok: false, error: `Fetch PLIs ${realPlId}: ${r.status}` };
        const dd = await r.json();
        const items = dd['hydra:member'] || dd.member || [];
        const mapByImp = {};
        items.forEach(pli => {
          const impId = extractFkId(pli.imparticion);
          if (impId) mapByImp[impId] = pli.id ?? Number(pli['@id']?.split('/').pop());
        });
        pliByPlReal[realPlId] = mapByImp;
      }
      for (const patch of tx.pliPatches) {
        const realPlId = Number(tempIdToRealId[patch.plKey] ?? patch.plKey);
        const pliId = pliByPlReal[realPlId]?.[patch.imparticionId];
        if (!pliId) continue;
        const r = await fetch(getApiUrl(`/api/periodo_lectivo_imparticions/${pliId}`), {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/merge-patch+json', 'Accept': 'application/ld+json' },
          credentials: 'include',
          body: JSON.stringify({ minutosSemanales: patch.minutosSemanales }),
        });
        if (!r.ok) return { ok: false, error: `PATCH PLI ${pliId}: ${r.status}` };
      }
    }

    // 5. POST horarios (placements del dry-run) para cada PL recién creado,
    //    leyendo del `state` ACTUAL (no del closure post-setState que aún no
    //    se ha aplicado). Sin esto, los placements se quedaban como dirty
    //    locales tras el Guardar y al refrescar la página los horarios
    //    aparecían vacíos en BD.
    let totalPlacementsPosted = 0;
    for (const draft of (tx.plsToCreate || [])) {
      const realId = tempIdToRealId[draft.tempId];
      if (!realId) continue;
      const placementsState = state[`${gid}_${draft.tempId}`];
      const placements = placementsState?.placements || {};
      if (Object.keys(placements).length === 0) continue;

      const operations = Object.entries(placements).map(([key, v]) => {
        const [diaStr, hiFromKey] = key.split('_');
        const hi = (hiFromKey || '').slice(0, 5);
        const hf = (v.horaFin || '').slice(0, 5);
        return {
          op: 'create',
          clientKey: key,
          diaSemana: parseInt(diaStr, 10),
          horaInicio: hi,
          horaFin: hf,
          aula: v.aula,
          imparticion: v.imparticionId,
        };
      });
      if (operations.length === 0) continue;

      const r = await fetch(getApiUrl('/api/v1/horarios/batch'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          grupoId: Number(gid),
          periodoLectivoId: Number(realId),
          baselineMaxUpdatedAt: null,
          operations,
        }),
      });
      if (!r.ok) {
        const txt = await r.text().catch(() => '');
        return { ok: false, error: `POST horarios PL ${realId}: ${r.status}: ${txt.slice(0, 200)}` };
      }
      totalPlacementsPosted += operations.length;
    }

    return { ok: true, tempIdToRealId, placementsPosted: totalPlacementsPosted };
  };

  // Tras aplicar la tx, los virtuales pasan a ser reales y los placements
  // ya se persistieron dentro de applyPendingTxForGrupo. Migramos el state
  // de placements del tempId al realId marcándolo `dirty: false` (ya está
  // en BD) para que performBatchSaveAllDirty NO vuelva a POSTearlos.
  const migrateStateAfterTx = (gid, tempIdToRealId) => {
    setState(prev => {
      const next = { ...prev };
      Object.entries(tempIdToRealId).forEach(([tempId, realId]) => {
        const oldKey = `${gid}_${tempId}`;
        const newKey = `${gid}_${realId}`;
        if (next[oldKey]) {
          const placements = next[oldKey].placements || {};
          next[newKey] = {
            ...next[oldKey],
            baseline: placements,
            dirty: false,
          };
          delete next[oldKey];
        }
      });
      return next;
    });
    setSelectedPlByGrupo(prev => {
      const cur = prev[gid];
      if (cur && tempIdToRealId[cur] !== undefined) {
        return { ...prev, [gid]: String(tempIdToRealId[cur]) };
      }
      return prev;
    });
  };

  // Descarta la tx pendiente del grupo: restaura el snapshot pre-tx
  // (plsRealesOriginales) en plByGrupo, limpia state de los tempIds y
  // reinstala el PL activo si era virtual.
  const discardPendingTxForGrupo = (gid) => {
    const tx = pendingTxByGrupo[gid];
    if (!tx) return;
    // Restaurar plByGrupo desde el snapshot original.
    const reales = tx.plsRealesOriginales || [];
    setPlByGrupo(prev => ({ ...prev, [gid]: reales.slice() }));
    // Limpiar state de tempIds.
    setState(prev => {
      const next = { ...prev };
      (tx.plsToCreate || []).forEach(d => {
        delete next[`${gid}_${d.tempId}`];
      });
      return next;
    });
    setCapacityByGrupo(prev => {
      const next = { ...prev };
      (tx.plsToCreate || []).forEach(d => {
        delete next[`${gid}_${d.tempId}`];
      });
      return next;
    });
    // Si el seleccionado era virtual o estaba borrado, mover al activo
    // por fecha de los reales restaurados (mismo criterio que el resolver).
    setSelectedPlByGrupo(prev => {
      const cur = prev[gid];
      const stillExists = cur != null && reales.some(r => String(r.id) === String(cur));
      if (stillExists) return prev;
      const today = new Date().toISOString().slice(0, 10);
      const fallback = reales.find(p => p.fechaInicio?.slice(0, 10) <= today && p.fechaFin?.slice(0, 10) >= today)
        || reales[0];
      const next = { ...prev };
      if (fallback) next[gid] = String(fallback.id);
      else delete next[gid];
      return next;
    });
    setPendingTxByGrupo(prev => {
      const next = { ...prev };
      delete next[gid];
      return next;
    });
    toast.success(t('scheduleEditor.discardTxSuccess', { defaultValue: 'Cambios descartados' }));
  };

  const hasPendingTx = (gid) => {
    const tx = pendingTxByGrupo[gid];
    if (!tx) return false;
    return Boolean(tx.grupoFechaFin) || (tx.plsToDelete?.length || 0) > 0
      || (tx.plsToCreate?.length || 0) > 0 || (tx.plsToUpdate?.length || 0) > 0
      || (tx.pliPatches?.length || 0) > 0;
  };

  // Guardar TODOS los rangos dirty del grupo en una sola pasada. Si el grupo
  // tiene tx pendiente (cambios estructurales acumulados por las acciones
  // del curso), aplicarla PRIMERO — los PLs reales que resulten de los
  // virtuales son a quienes se POSTean los placements después.
  const performBatchSaveAllDirty = async () => {
    if (!selectedGrupo) return false;

    let tempIdToRealId = {};
    let placementsPosted = 0;
    if (hasPendingTx(selectedGrupo)) {
      setApplyingPendingTx(true);
      try {
        const res = await applyPendingTxForGrupo(selectedGrupo);
        if (!res.ok) {
          toast.error(t('scheduleEditor.applyTxError', {
            defaultValue: 'Error aplicando los cambios estructurales: {{err}}',
            err: res.error,
          }));
          return false;
        }
        tempIdToRealId = res.tempIdToRealId;
        placementsPosted = res.placementsPosted || 0;
        migrateStateAfterTx(selectedGrupo, tempIdToRealId);
        // Refetch PLs reales — los virtuales desaparecen, los nuevos aparecen
        // con sus IDs reales. También refetch los horarios persistidos del
        // grupo para que allHorariosByGroup refleje los placements recién
        // POSTeados.
        await refetchPlsForGroup(selectedGrupo);
        if (typeof refetchAllHorariosForGroup === 'function') {
          refetchAllHorariosForGroup(selectedGrupo);
        }
        // Limpia la cola.
        setPendingTxByGrupo(prev => {
          const next = { ...prev };
          delete next[selectedGrupo];
          return next;
        });
        if (placementsPosted > 0) {
          toast.success(t('scheduleEditor.applyTxSuccess', {
            defaultValue: 'Cambios aplicados: {{plsCreated}} rangos creados, {{placements}} placements persistidos.',
            plsCreated: Object.keys(tempIdToRealId).length,
            placements: placementsPosted,
          }));
        }
      } finally {
        setApplyingPendingTx(false);
      }
    }

    const pls = plByGrupo[selectedGrupo] || [];
    const dirtyPls = pls.filter(pl => !pl._pending && state[`${selectedGrupo}_${pl.id}`]?.dirty);
    let allOk = true;
    for (const pl of dirtyPls) {
      const ok = await performBatchSave(pl.id);
      if (!ok) allOk = false;
    }
    if (allOk) {
      toast.success(t('scheduleEditor.saveAllSuccess', {
        defaultValue: '{{count}} rangos guardados',
        count: dirtyPls.length,
      }));
    }
    return allOk;
  };

  // Fuerza recarga del (grupo, PL) actual descartando estado local (tras conflicto)
  const reloadCurrentGroup = () => {
    setState(prev => {
      const cp = { ...prev };
      delete cp[stateKey];
      return cp;
    });
    setConflictOpen(false);
  };

  // Entry point del botón Guardar: guarda TODOS los rangos dirty del grupo,
  // no sólo el activo. Si el horario está incompleto (cobertura anual), pide
  // confirmación primero — pero la confirmación se evalúa contra el cómputo
  // global del grupo, no per-rango.
  const handleSave = async () => {
    if (!dirtyAny) return;
    if (estado !== 'complete') {
      setPublishConfirmOpen(true);
      return;
    }
    return performBatchSaveAllDirty();
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
      toast.success(t('scheduleEditor.exportSuccess', { defaultValue: 'PDF descargado' }));
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
      // Tap-mode: misma regla anual que el drag (Fase 5 sub-A).
      const totalAnualMin = minutosAnualesObjetivoByImp[selectedImpId] || 0;
      const colocadasAnualMin = minutosAnualesColocadosByImp[selectedImpId] || 0;
      if (totalAnualMin > 0 && colocadasAnualMin >= totalAnualMin) {
        toast.error(t('scheduleEditor.reasonModuleFull', { total: minToHoras(totalAnualMin), module: imp.materia?.nombre }));
        return;
      }
      const profId = imp.profesor?.id;
      if (profId && parallelBusy[key]?.has(Number(profId))) {
        const teacher = `${imp.profesor?.nombre || ''} ${imp.profesor?.apellidos || ''}`.trim();
        toast.error(t('scheduleEditor.reasonTeacherBusy', { teacher }));
        return;
      }
      const tapDur = slotMinutosByHi[slotsDia[slotIdx][0]] || 0;
      setState(prev => ({
        ...prev,
        [stateKey]: {
          ...prev[stateKey],
          placements: {
            ...effectivePlacements,
            [key]: {
              imparticionId: selectedImpId,
              aula: resolveAulaJs(imps.find(i => i.id === selectedImpId), grupo),
              horaInicio: slotsDia[slotIdx][0],
              horaFin: slotsDia[slotIdx][1],
            },
          },
          dirty: true,
        },
      }));
      // Si la materia, tras este tap, alcanza el objetivo anual, deseleccionamos.
      // Aproximación: añadimos al colocado anual el tap como `tapDur × semanas activo`.
      const semanasActivo = selectedPlId ? (semanasByPlId[selectedPlId] || 0) : 0;
      if (totalAnualMin > 0 && colocadasAnualMin + tapDur * semanasActivo >= totalAnualMin) {
        setSelectedImpId(null);
      }
      return;
    }

    // Sin selección y celda ocupada → quitar
    if (existing) {
      setState(prev => {
        const p = { ...prev[stateKey].placements };
        delete p[key];
        return { ...prev, [stateKey]: { ...prev[stateKey], placements: p, dirty: true } };
      });
    }
  }, [selectedImpId, placements, impById, parallelBusy, selectedGrupo, slotsDia, slotMinutosByHi, grupo, t]);

  // Validación ligera para pintar tap-mode (Fase 5 sub-A: usa cuota anual igual
  // que el drag y el handler de tap; estaban desincronizados con el modelo).
  const validateTap = useCallback((diaIdx, slotIdx) => {
    if (!selectedImpId) return null;
    const key = `${diaIdx}_${slotsDia[slotIdx][0]}`;
    if (placements[key]) return false;
    const imp = impById[selectedImpId];
    if (!imp) return false;
    const totalAnualMin = minutosAnualesObjetivoByImp[selectedImpId] || 0;
    const colocadasAnualMin = minutosAnualesColocadosByImp[selectedImpId] || 0;
    if (totalAnualMin > 0 && colocadasAnualMin >= totalAnualMin) return false;
    const profId = imp.profesor?.id;
    if (profId && parallelBusy[key]?.has(Number(profId))) return false;
    return true;
  }, [selectedImpId, slotsDia, placements, impById, minutosAnualesObjetivoByImp, minutosAnualesColocadosByImp, parallelBusy]);

  // ESC deselecciona
  useEffect(() => {
    if (!selectedImpId) return;
    const h = (e) => { if (e.key === 'Escape') setSelectedImpId(null); };
    window.addEventListener('keydown', h);
    return () => window.removeEventListener('keydown', h);
  }, [selectedImpId]);

  // Abrir modal "Nuevo rango lectivo": pre-rellena con defaults sensatos.
  // - `fechaInicio`: día siguiente al último PL si existe, sino `Grupo.fechaInicio`.
  // - `fechaFin`: depende del estado del banner anual:
  //     · Banner ok (cubre currículo): default = `Grupo.fechaFin` (el rango
  //       llega al fin de curso, el admin lo recortará si quiere).
  //     · Banner warn/error (faltan horas): default = `extendCourseSuggestion.
  //       newLastPlFinISO`, es decir el rango cubre exactamente las semanas que
  //       faltan para cuadrar el currículo. Crear el rango = atajo de "extender
  //       curso" pero con un PL nuevo en vez de extender el último.
  const openCreatePlModal = () => {
    const existing = (selectedGrupo && plByGrupo[selectedGrupo]) || [];
    const grupoFin = grupo?.fechaFin ? grupo.fechaFin.slice(0, 10) : '';
    const grupoIni = grupo?.fechaInicio ? grupo.fechaInicio.slice(0, 10) : '';
    let inicio = '';
    let fin = grupoFin;
    if (existing.length > 0) {
      // Fecha inicio del nuevo rango = día siguiente al fechaFin del último.
      const last = [...existing].sort((a, b) => a.fechaFin.localeCompare(b.fechaFin)).at(-1);
      const lastFin = new Date(last.fechaFin);
      const dayAfter = new Date(lastFin); dayAfter.setDate(dayAfter.getDate() + 1);
      inicio = dayAfter.toISOString().slice(0, 10);
      // Si el banner anual sugiere extender (faltan horas), el default es la
      // fecha que cubre exactamente las semanas faltantes — cubrir lo necesario,
      // ni más ni menos. El admin ajustará si quiere otra cosa.
      if (extendCourseSuggestion?.newLastPlFinISO) {
        fin = extendCourseSuggestion.newLastPlFinISO;
      }
      // Edge case: el último rango ya se pasa del fin del curso (Grupo.fechaFin
      // < inicio sugerido). Dejamos `fin` vacío para que el admin escriba algo
      // sensato a mano en vez de proponer una duración negativa.
      if (fin && fin < inicio) {
        fin = '';
      }
    } else {
      // Primer rango del grupo: si conocemos las fechas del grupo, usarlas.
      inicio = grupoIni;
    }
    setPlForm({
      nombre: '',
      fechaInicio: inicio,
      fechaFin: fin,
      jornadaTipoId: '',
    });
    setPlPickerMode('create');
    setEditingPlId(null);
    setPlPickerOpen(true);
  };

  // Abrir modal en modo edición: pre-rellena con el PL pasado.
  const openEditPlModal = (pl) => {
    if (!pl) return;
    setPlForm({
      nombre: pl.nombre || '',
      fechaInicio: pl.fechaInicio?.slice(0, 10) || '',
      fechaFin: pl.fechaFin?.slice(0, 10) || '',
      jornadaTipoId: extractFkId(pl.jornadaTipo) || '',
    });
    setPlPickerMode('edit');
    setEditingPlId(pl.id);
    setPlPickerOpen(true);
  };

  // Submit del modal: crea (POST) o actualiza (PATCH) según `plPickerMode`.
  // Crear: el State Processor backend auto-crea PLIs por cada Imparticion del
  // grupo. Editar: si cambia la jornada, invalidamos jornadaActual y
  // capacity-check del PL para que el editor recargue tramos efectivos.
  const handleSubmitPlForm = async (e) => {
    if (e?.preventDefault) e.preventDefault();
    if (!selectedGrupo || !plForm.nombre || !plForm.fechaInicio || !plForm.fechaFin) {
      toast.error(t('scheduleEditor.rangoMissingFields', { defaultValue: 'Completa nombre y fechas' }));
      return;
    }

    // Tanda B parte 2: NO toca BD. Acumula en pendingTxByGrupo.
    if (plPickerMode === 'edit') {
      if (!editingPlId) return;
      const isVirtual = Number(editingPlId) < 0;
      if (isVirtual) {
        // Editar un PL virtual: modifica el draft en plsToCreate.
        setPendingTxByGrupo(prev => {
          const tx = prev[selectedGrupo] || {};
          const newCreate = (tx.plsToCreate || []).map(d => String(d.tempId) === String(editingPlId)
            ? {
                ...d,
                nombre: plForm.nombre,
                fechaInicio: plForm.fechaInicio,
                fechaFin: plForm.fechaFin,
                jornadaTipoId: plForm.jornadaTipoId ? Number(plForm.jornadaTipoId) : null,
                jornadaTipo: plForm.jornadaTipoId ? { id: Number(plForm.jornadaTipoId) } : null,
              }
            : d);
          return { ...prev, [selectedGrupo]: { ...tx, plsToCreate: newCreate } };
        });
        // Reflect en plByGrupo.
        setPlByGrupo(prev => {
          const cur = prev[selectedGrupo] || [];
          const next = cur.map(pl => (String(pl.id) === String(editingPlId)
            ? { ...pl,
                nombre: plForm.nombre,
                fechaInicio: plForm.fechaInicio,
                fechaFin: plForm.fechaFin,
                jornadaTipo: plForm.jornadaTipoId ? { id: Number(plForm.jornadaTipoId) } : null,
              }
            : pl));
          return { ...prev, [selectedGrupo]: next };
        });
      } else {
        // Editar un PL real: añade/actualiza en plsToUpdate.
        const realId = Number(editingPlId);
        setPendingTxByGrupo(prev => {
          const tx = prev[selectedGrupo] || {};
          const others = (tx.plsToUpdate || []).filter(u => u.realId !== realId);
          return {
            ...prev,
            [selectedGrupo]: {
              ...tx,
              grupoFechaFinOriginal: tx.grupoFechaFinOriginal ?? grupo?.fechaFin ?? null,
              plsRealesOriginales: tx.plsRealesOriginales ?? (plByGrupo[selectedGrupo] || []).filter(p => !p._pending),
              plsToUpdate: [
                ...others,
                {
                  realId,
                  nombre: plForm.nombre,
                  fechaInicio: plForm.fechaInicio,
                  fechaFin: plForm.fechaFin,
                  jornadaTipoId: plForm.jornadaTipoId ? Number(plForm.jornadaTipoId) : null,
                },
              ],
            },
          };
        });
        // Reflect en plByGrupo (preview).
        setPlByGrupo(prev => {
          const cur = prev[selectedGrupo] || [];
          const next = cur.map(pl => (String(pl.id) === String(editingPlId)
            ? { ...pl,
                nombre: plForm.nombre,
                fechaInicio: plForm.fechaInicio,
                fechaFin: plForm.fechaFin,
                jornadaTipo: plForm.jornadaTipoId ? { id: Number(plForm.jornadaTipoId) } : null,
                _pending: pl._pending || 'edit',
              }
            : pl));
          return {
            ...prev,
            [selectedGrupo]: next.sort((a, b) => (a.orden ?? 0) - (b.orden ?? 0) || a.fechaInicio.localeCompare(b.fechaInicio)),
          };
        });
      }
      setPlPickerOpen(false);
      toast.success(t('scheduleEditor.rangoUpdatedPreview', {
        defaultValue: 'Rango actualizado (preview). Pulsa Guardar para persistir.',
      }));
      return;
    }

    // Modo CREATE: añadir un PL virtual a plsToCreate.
    const tempId = tempIdSeqRef.current;
    tempIdSeqRef.current -= 1;
    const draft = {
      tempId,
      id: tempId,
      _pending: 'create',
      nombre: plForm.nombre,
      fechaInicio: plForm.fechaInicio,
      fechaFin: plForm.fechaFin,
      jornadaTipoId: plForm.jornadaTipoId ? Number(plForm.jornadaTipoId) : null,
      jornadaTipo: plForm.jornadaTipoId ? { id: Number(plForm.jornadaTipoId) } : null,
      orden: (plByGrupo[selectedGrupo]?.length || 0),
    };
    setPendingTxByGrupo(prev => {
      const tx = prev[selectedGrupo] || {};
      return {
        ...prev,
        [selectedGrupo]: {
          ...tx,
          grupoFechaFinOriginal: tx.grupoFechaFinOriginal ?? grupo?.fechaFin ?? null,
          plsRealesOriginales: tx.plsRealesOriginales ?? (plByGrupo[selectedGrupo] || []).filter(p => !p._pending),
          plsToCreate: [...(tx.plsToCreate || []), draft],
        },
      };
    });
    setPlByGrupo(prev => {
      const cur = prev[selectedGrupo] || [];
      return {
        ...prev,
        [selectedGrupo]: [...cur, draft].sort((a, b) =>
          (a.orden ?? 0) - (b.orden ?? 0) || a.fechaInicio.localeCompare(b.fechaInicio)),
      };
    });
    setSelectedPlByGrupo(prev => ({ ...prev, [selectedGrupo]: String(tempId) }));
    setPlPickerOpen(false);
    toast.success(t('scheduleEditor.rangoCreatedPreview', {
      defaultValue: 'Rango creado (preview). Pulsa Guardar para persistir.',
    }));
  };

  // Borrar un PL: confirma + DELETE (soft-delete vía SoftDeleteProcessor).
  // Bloqueado si es el único rango del grupo (debe quedar al menos uno para
  // que el editor tenga contexto). Si tiene horarios persistidos, lo avisamos
  // explícitamente en el confirm body — el cascade DELETE de Horario los
  // borrará junto con el PL.
  const handleDeletePl = async (pl) => {
    if (!pl || !selectedGrupo) return;
    const list = plByGrupo[selectedGrupo] || [];
    if (list.length <= 1) {
      toast.error(t('scheduleEditor.deleteRangoOnlyOne', { defaultValue: 'No puedes borrar el único rango del grupo. Crea otro antes.' }));
      return;
    }
    // Conteo de horarios persistidos en este PL (sólo del state cargado;
    // si nunca se ha visitado el PL, asumimos 0 visualmente — la BD tiene
    // la verdad. El usuario verá el aviso genérico de "horarios asociados".)
    const cacheKey = `${selectedGrupo}_${pl.id}`;
    const cachedPlacements = state[cacheKey]?.placements || {};
    const horariosCount = Object.values(cachedPlacements).filter(p => p?.hid).length;
    const body = horariosCount > 0
      ? t('scheduleEditor.deleteRangoConfirmBodyWith', {
          defaultValue: 'Vas a borrar el rango "{{nombre}}". Se eliminarán {{count}} horario(s) asociados a este rango. Esta acción no se puede deshacer.',
          nombre: pl.nombre,
          count: horariosCount,
        })
      : t('scheduleEditor.deleteRangoConfirmBody', {
          defaultValue: 'Vas a borrar el rango "{{nombre}}". Esta acción no se puede deshacer.',
          nombre: pl.nombre,
        });
    const ok = await confirm({
      title: t('scheduleEditor.deleteRangoConfirmTitle', { defaultValue: 'Borrar rango lectivo' }),
      body,
      confirmLabel: t('scheduleEditor.deleteRango', { defaultValue: 'Borrar rango' }),
      cancelLabel: t('common.cancel', { defaultValue: 'Cancelar' }),
      confirmVariant: 'danger',
    });
    if (!ok) return;

    // Tanda B parte 2: NO toca BD. Si es virtual, lo quitamos de
    // plsToCreate; si es real, lo añadimos a plsToDelete.
    const isVirtual = Number(pl.id) < 0;
    setPendingTxByGrupo(prev => {
      const tx = prev[selectedGrupo] || {};
      if (isVirtual) {
        const newCreate = (tx.plsToCreate || []).filter(d => String(d.tempId) !== String(pl.id));
        return { ...prev, [selectedGrupo]: { ...tx, plsToCreate: newCreate } };
      }
      const realId = Number(pl.id);
      const newDelete = [...new Set([...(tx.plsToDelete || []), realId])];
      // Si el PL real estaba en plsToUpdate, lo quitamos (no tiene sentido
      // PATCHearlo y luego DELETE).
      const newUpdate = (tx.plsToUpdate || []).filter(u => u.realId !== realId);
      return {
        ...prev,
        [selectedGrupo]: {
          ...tx,
          grupoFechaFinOriginal: tx.grupoFechaFinOriginal ?? grupo?.fechaFin ?? null,
          plsRealesOriginales: tx.plsRealesOriginales ?? (plByGrupo[selectedGrupo] || []).filter(p => !p._pending),
          plsToDelete: newDelete,
          plsToUpdate: newUpdate,
        },
      };
    });
    // Quita el PL del strip + limpia state/capacity.
    setPlByGrupo(prev => ({
      ...prev,
      [selectedGrupo]: (prev[selectedGrupo] || []).filter(p => String(p.id) !== String(pl.id)),
    }));
    setState(prev => {
      const next = { ...prev };
      delete next[cacheKey];
      return next;
    });
    setCapacityByGrupo(prev => {
      const next = { ...prev };
      delete next[cacheKey];
      return next;
    });
    if (String(selectedPlId) === String(pl.id)) {
      const remaining = (plByGrupo[selectedGrupo] || []).filter(p => String(p.id) !== String(pl.id));
      const today = new Date().toISOString().slice(0, 10);
      const next = remaining.find(p => p.fechaInicio <= today && p.fechaFin >= today) || remaining[0];
      setSelectedPlByGrupo(prev => ({
        ...prev,
        [selectedGrupo]: next ? String(next.id) : undefined,
      }));
    }
    toast.success(t('scheduleEditor.deleteRangoSuccessPreview', {
      defaultValue: 'Rango borrado (preview). Pulsa Guardar para confirmar.',
    }));
  };

  // ── PLI por rango (Fase 4) ────────────────────────────────────────────
  // Helpers internos: tras cualquier mutación de PLI, invalidamos la
  // capacity-check del PL y refrescamos los PLs del grupo (cuyos PLIs
  // embebidos alimentan el banner anual de Fase 3b). El refetch es ligero:
  // un GET de los PLs del grupo trae todo lo necesario.
  const refetchPlsForGroup = async (gid) => {
    if (!gid) return;
    try {
      const res = await fetch(getApiUrl(`/api/periodo_lectivos?grupo=${gid}&pagination=false&order[orden]=asc&order[fechaInicio]=asc`),
        { headers: { 'Accept': 'application/ld+json' }, credentials: 'include' });
      if (!res.ok) return;
      const d = await res.json();
      const items = d['hydra:member'] || d.member || [];
      setPlByGrupo(prev => ({ ...prev, [gid]: items }));
    } catch (err) {
      console.error('Error refetch PLs:', err);
    }
  };

  // Refetch de TODOS los horarios persistidos del grupo (Fase 5 sub-A): usado
  // tras un save batch para que el chip lateral con horas anuales colocadas
  // refleje la verdad persistida (incluyendo placements del PL activo que
  // antes vivían sólo en state local).
  const refetchAllHorariosForGroup = async (gid) => {
    if (!gid) return;
    try {
      const res = await fetch(getApiUrl(`/api/horarios?imparticion.grupo=${gid}&itemsPerPage=500`),
        { headers: { 'Accept': 'application/ld+json', 'Cache-Control': 'no-cache' }, credentials: 'include' });
      if (!res.ok) return;
      const d = await res.json();
      const items = d['hydra:member'] || d.member || [];
      setAllHorariosByGroup(prev => ({ ...prev, [gid]: items }));
    } catch (err) {
      console.error('Error refetch horarios globales:', err);
    }
  };

  const invalidateCapacityForPl = (gid, plId) => {
    setCapacityByGrupo(prev => {
      const next = { ...prev };
      delete next[`${gid}_${plId}`];
      return next;
    });
  };

  // Abre el modal "Materias del rango" para el PL pasado. Carga las PLIs vivas
  // (la lista refleja el estado actual de la BD; soft-deletes no aplican —
  // PLI usa hard-delete, ver entidad).
  const openPliModal = async (pl) => {
    if (!pl) return;
    setPliModalPlId(pl.id);
    setPliModalOpen(true);
    // Refresca siempre al abrir para evitar trabajar contra cache stale tras
    // ediciones del mismo modal en una sesión anterior.
    setPliLoading(true);
    try {
      const res = await fetch(getApiUrl(`/api/periodo_lectivo_imparticions?periodoLectivo=${pl.id}&pagination=false`),
        { headers: { 'Accept': 'application/ld+json' }, credentials: 'include' });
      if (!res.ok) throw new Error(`${res.status}`);
      const d = await res.json();
      const items = d['hydra:member'] || d.member || [];
      setPliByPl(prev => ({ ...prev, [pl.id]: items }));
    } catch (err) {
      console.error('Error cargando PLIs:', err);
      toast.error(t('scheduleEditor.pliLoadError', { defaultValue: 'No se pudo cargar las materias del rango' }));
    } finally {
      setPliLoading(false);
    }
  };

  const closePliModal = () => {
    setPliModalOpen(false);
    setPliModalPlId(null);
  };

  // Marca una fila como saving (true) o libre (false).
  const markRowSaving = (impId, value) => {
    setPliRowSaving(prev => {
      const next = { ...prev };
      if (value) next[impId] = true;
      else delete next[impId];
      return next;
    });
  };

  // Activa una imparticion en el rango: POST /api/periodo_lectivo_imparticions
  // con minutosSemanales NULL (= hereda Materia). El modal seguirá viendo el
  // PLI tras el insert.
  const activatePli = async (impId) => {
    if (!pliModalPlId) return;
    markRowSaving(impId, true);
    try {
      const body = {
        periodoLectivo: `/api/periodo_lectivos/${pliModalPlId}`,
        imparticion: `/api/imparticions/${impId}`,
        minutosSemanales: null,
      };
      const res = await fetch(getApiUrl('/api/periodo_lectivo_imparticions'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/ld+json', 'Accept': 'application/ld+json' },
        credentials: 'include',
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const txt = await res.text().catch(() => '');
        throw new Error(`${res.status}: ${txt.slice(0, 200)}`);
      }
      const created = await res.json();
      setPliByPl(prev => ({
        ...prev,
        [pliModalPlId]: [...(prev[pliModalPlId] || []), created],
      }));
      invalidateCapacityForPl(selectedGrupo, pliModalPlId);
      await refetchPlsForGroup(selectedGrupo);
    } catch (err) {
      console.error('Error activando PLI:', err);
      toast.error(t('scheduleEditor.pliActivateError', { defaultValue: 'No se pudo activar la materia en el rango' }));
    } finally {
      markRowSaving(impId, false);
    }
  };

  // Desactiva (hard-delete) una PLI del rango.
  const deactivatePli = async (pli) => {
    if (!pli || !pliModalPlId) return;
    const impId = extractFkId(pli.imparticion);
    markRowSaving(impId, true);
    try {
      const res = await fetch(getApiUrl(`/api/periodo_lectivo_imparticions/${pli.id}`), {
        method: 'DELETE',
        headers: { 'Accept': 'application/ld+json' },
        credentials: 'include',
      });
      if (!res.ok && res.status !== 204) {
        const txt = await res.text().catch(() => '');
        throw new Error(`${res.status}: ${txt.slice(0, 200)}`);
      }
      setPliByPl(prev => ({
        ...prev,
        [pliModalPlId]: (prev[pliModalPlId] || []).filter(p => String(p.id) !== String(pli.id)),
      }));
      invalidateCapacityForPl(selectedGrupo, pliModalPlId);
      await refetchPlsForGroup(selectedGrupo);
    } catch (err) {
      console.error('Error desactivando PLI:', err);
      toast.error(t('scheduleEditor.pliDeactivateError', { defaultValue: 'No se pudo quitar la materia del rango' }));
    } finally {
      markRowSaving(impId, false);
    }
  };

  // PATCH minutos del PLI. Si valor es null → reset al default heredado de
  // Materia. Si valor es un número, ese override manda en el rango.
  const updatePliMinutos = async (pli, newMinutos) => {
    if (!pli || !pliModalPlId) return;
    const impId = extractFkId(pli.imparticion);
    markRowSaving(impId, true);
    try {
      const res = await fetch(getApiUrl(`/api/periodo_lectivo_imparticions/${pli.id}`), {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/merge-patch+json', 'Accept': 'application/ld+json' },
        credentials: 'include',
        body: JSON.stringify({ minutosSemanales: newMinutos }),
      });
      if (!res.ok) {
        const txt = await res.text().catch(() => '');
        throw new Error(`${res.status}: ${txt.slice(0, 200)}`);
      }
      const updated = await res.json();
      setPliByPl(prev => ({
        ...prev,
        [pliModalPlId]: (prev[pliModalPlId] || []).map(p => String(p.id) === String(pli.id) ? { ...p, ...updated } : p),
      }));
      invalidateCapacityForPl(selectedGrupo, pliModalPlId);
      await refetchPlsForGroup(selectedGrupo);
    } catch (err) {
      console.error('Error guardando minutos PLI:', err);
      toast.error(t('scheduleEditor.pliSaveError', { defaultValue: 'No se pudo guardar el cambio' }));
    } finally {
      markRowSaving(impId, false);
    }
  };

  // ── Extender curso (Fase 5 sub-B) ────────────────────────────────────
  // PATCH secuencial: primero el PL (extiende su fechaFin), luego el Grupo
  // (extiende su fechaFin para abarcar el nuevo último rango). Si el PL falla,
  // no tocamos el Grupo. Si el Grupo falla tras el PL OK, queda inconsistente
  // (PL extendido pero Grupo no): aceptable porque la cadena de jornada usa
  // PL.fechaFin para el solver y banners — el desalineamiento es cosmético y
  // recuperable manualmente.
  const handleConfirmExtendCourse = async () => {
    if (!extendCourseSuggestion || !selectedGrupo) return;
    const sug = extendCourseSuggestion;
    setExtendingCourse(true);
    try {
      const r1 = await fetch(getApiUrl(`/api/periodo_lectivos/${sug.lastPl.id}`), {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/merge-patch+json', 'Accept': 'application/ld+json' },
        credentials: 'include',
        body: JSON.stringify({ fechaFin: sug.newLastPlFinISO }),
      });
      if (!r1.ok) {
        const txt = await r1.text().catch(() => '');
        throw new Error(`PL: ${r1.status}: ${txt.slice(0, 200)}`);
      }
      // Sólo PATCH al Grupo si la fecha realmente cambia (caso típico: el Grupo
      // ya termina más tarde que el último rango → no tocamos nada).
      let updatedGrupo = null;
      if (sug.grupoNeedsPatch) {
        const r2 = await fetch(getApiUrl(`/api/grupos/${selectedGrupo}`), {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/merge-patch+json', 'Accept': 'application/ld+json' },
          credentials: 'include',
          body: JSON.stringify({ fechaFin: sug.newGrupoFinISO }),
        });
        if (!r2.ok) {
          const txt = await r2.text().catch(() => '');
          // PL ya extendido, no rollback automático — alerta y log.
          console.warn('Grupo PATCH falló tras PL OK:', r2.status, txt);
          toast.error(t('scheduleEditor.extendCourseGrupoError', { defaultValue: 'El rango se extendió pero la fecha del grupo no se pudo actualizar. Revisa /admin/grupos.' }));
        } else {
          updatedGrupo = await r2.json().catch(() => null);
        }
      }
      // Refrescar caches: PLs (banner anual + strip), grupos (memo grupo),
      // capacity-check (la jornada efectiva no cambió, pero por si acaso).
      await refetchPlsForGroup(selectedGrupo);
      if (updatedGrupo) {
        setGrupos(prev => prev.map(g => String(g.id) === String(selectedGrupo) ? { ...g, ...updatedGrupo } : g));
      } else if (sug.grupoNeedsPatch) {
        // Patch local optimista para que el banner refleje la fecha nueva
        // aunque la respuesta del PATCH no se pudiera parsear.
        setGrupos(prev => prev.map(g => String(g.id) === String(selectedGrupo) ? { ...g, fechaFin: sug.newGrupoFinISO } : g));
      }
      invalidateCapacityForPl(selectedGrupo, sug.lastPl.id);
      setExtendModalOpen(false);
      toast.success(t('scheduleEditor.extendCourseSuccess', { defaultValue: 'Curso extendido' }));
    } catch (err) {
      console.error('Error extendiendo curso:', err);
      toast.error(t('scheduleEditor.extendCourseError', { defaultValue: 'No se pudo extender el curso' }));
    } finally {
      setExtendingCourse(false);
    }
  };

  // Cambio de override de jornada para el grupo actual.
  // Persiste vía PUT /api/grupos/{id} y refresca grupos + caches dependientes.
  // Nota: los placements ya guardados que no encajen con los slots de la nueva
  // jornada no se borran de BD; quedan silenciosamente no renderizados (la
  // rejilla itera sobre tramosOrdenados, así que solo aparece lo que coincide).
  const handleJornadaOverrideChange = async (newJornadaIdRaw) => {
    if (!selectedGrupo || !grupo) return;
    const currentEffectiveId = resolveEffectiveJornadaId(grupo);
    // Normaliza '' / undefined a null (= sin override → fallback al itinerario).
    const newOverrideId = newJornadaIdRaw ? String(newJornadaIdRaw) : null;
    // Si el usuario elige el id que ya es la jornada efectiva por herencia del
    // itinerario, mejor no fijar override (mantiene la cadena limpia).
    const inheritedItinId = extractFkId(grupo.itinerario?.jornadaTipo);
    const effectiveOverride = (newOverrideId && newOverrideId === inheritedItinId) ? null : newOverrideId;
    const currentOverrideId = extractFkId(grupo.jornadaTipoOverride);
    if ((currentOverrideId || null) === (effectiveOverride || null)) return;  // no-op

    setSavingJornadaOverride(true);
    try {
      // PATCH (merge-patch+json) en vez de PUT: API Platform 3 trata PUT como
      // reemplazo total y nullificaría nombre/curso/anioEscolar/itinerario/centro.
      const body = { jornadaTipoOverride: effectiveOverride ? `/api/jornada_tipos/${effectiveOverride}` : null };
      const res = await fetch(getApiUrl(`/api/grupos/${selectedGrupo}`), {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/merge-patch+json', 'Accept': 'application/ld+json' },
        credentials: 'include',
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const txt = await res.text().catch(() => '');
        throw new Error(`${res.status}: ${txt.slice(0, 200)}`);
      }
      const updated = await res.json();
      // Reemplaza el grupo en la lista para que jornadaActual se recalcule.
      setGrupos(prev => prev.map(g => String(g.id) === String(selectedGrupo) ? { ...g, ...updated } : g));
      // Invalida el capacity-check de TODOS los PLs de este grupo (la jornada
      // efectiva del grupo afecta a cualquier PL cuyo jornadaTipo sea NULL).
      setCapacityByGrupo(prev => {
        const next = { ...prev };
        Object.keys(next).forEach(k => {
          if (k.startsWith(`${selectedGrupo}_`)) delete next[k];
        });
        return next;
      });
      const newEffectiveId = effectiveOverride || inheritedItinId;
      if (newEffectiveId && newEffectiveId !== currentEffectiveId) {
        toast.success(t('scheduleEditor.jornadaChanged', { defaultValue: 'Jornada cambiada' }));
      }
    } catch (err) {
      console.error('Error al cambiar jornada override:', err);
      toast.error(t('scheduleEditor.jornadaChangeError', { defaultValue: 'No se pudo cambiar la jornada' }));
    } finally {
      setSavingJornadaOverride(false);
    }
  };

  // Solver: pide propuesta al backend y pinta el estado (sin persistir).
  // Parámetros opcionales para que `runSolverAllRangos` pueda invocar al
  // solver iterativamente sin depender de selectedPlId (que cambia con state):
  //   - skipConfirm: omite el confirm-overwrite cuando ya se confirmó el
  //     batch al inicio del loop multi-rango.
  //   - plIdOverride: PL específico para este run (si null, usa selectedPlId).
  //   - alreadyPlacedOverride: mapa { impId → minutosAnualesYaColocados } que
  //     se pasa tal cual al backend. Si null, se calcula desde state local
  //     excluyendo el PL activo (modo single-call). Cuando viene desde
  //     `runSolverAllRangos`, evita el problema de batching de React state
  //     entre iteraciones del loop.
  // Devuelve el `data` del backend (o null si no se pudo ejecutar).
  const runSolver = async (seed = null, skipConfirm = false, plIdOverride = null, alreadyPlacedOverride = null) => {
    if (!selectedGrupo) return null;
    const targetPlId = plIdOverride ?? selectedPlId;
    const targetStateKey = (selectedGrupo && targetPlId) ? `${selectedGrupo}_${targetPlId}` : '';
    const targetPlacements = (state[targetStateKey]?.placements) || {};
    const hasContent = Object.keys(targetPlacements).length > 0;
    if (!skipConfirm && hasContent && !(await confirm({ body: t('scheduleEditor.solverConfirmOverwrite') }))) return null;
    setSolving(true);
    try {
      // Cap anual por materia (Fase 5 fix afinado): pasamos al backend los
      // minutos anuales ya colocados en OTROS rangos del grupo. El planner
      // descuenta del objetivo curricular y limita cuotas para que el solver
      // no asigne más allá del objetivo + 1.5h tolerancia (sumando todos los
      // rangos). Si el caller pasa `alreadyPlacedOverride` (caso loop multi-
      // rango), lo usamos tal cual para evitar batching stale de React state.
      // Si no, calculamos desde state local excluyendo el PL activo.
      const placedAnualOtrosRangos = alreadyPlacedOverride ?? (() => {
        const acc = {};
        const pls = plByGrupo[selectedGrupo] || [];
        const persistedByPl = {};
        (allHorariosByGroup[selectedGrupo] || []).forEach(h => {
          const plId = extractFkId(h.periodoLectivo);
          if (!plId) return;
          if (!persistedByPl[plId]) persistedByPl[plId] = [];
          persistedByPl[plId].push(h);
        });
        pls.forEach(pl => {
          // Excluir el PL que vamos a regenerar (override o activo).
          if (targetPlId && String(pl.id) === String(targetPlId)) return;
          const semanas = semanasByPlId[pl.id] || 0;
          if (semanas <= 0) return;
          const localKey = `${selectedGrupo}_${pl.id}`;
          const localState = state[localKey];
          if (localState?.placements) {
            Object.values(localState.placements).forEach(p => {
              const dur = slotMinutosByHi[p.horaInicio] || 0;
              if (dur <= 0) return;
              acc[p.imparticionId] = (acc[p.imparticionId] || 0) + dur * semanas;
            });
          } else {
            (persistedByPl[pl.id] || []).forEach(h => {
              const dur = parseHmsToMin(h.horaFin) - parseHmsToMin(h.horaInicio);
              if (dur <= 0) return;
              const impId = Number(getId(h.imparticion));
              if (!impId) return;
              acc[impId] = (acc[impId] || 0) + dur * semanas;
            });
          }
        });
        return acc;
      })();
      const body = {
        ...(seed !== null ? { seed } : {}),
        ...(targetPlId ? { periodoLectivoId: targetPlId } : {}),
        alreadyPlacedByImp: placedAnualOtrosRangos,
      };
      const res = await fetch(getApiUrl(`/api/v1/horarios/solver/${selectedGrupo}`), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(body),
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
        [targetStateKey]: {
          ...(prev[targetStateKey] || {}),
          placements: newPlacements,
          dirty: true,
        },
      }));
      setSolverSeed(seed);
      if (!data.complete && data.unplaced?.length) {
        const faltan = data.unplaced.map(u => `${u.materia}: ${u.horasRestantes}h`).join(', ');
        toast.warning(t('scheduleEditor.solverPartial', { items: faltan }), { duration: 6000 });
      }
      return data;
    } catch (err) {
      toast.error(err.message, {
        description: t('scheduleEditor.solverErrorCtx', { defaultValue: 'El solver ha fallado' })
      });
      return null;
    } finally {
      setSolving(false);
    }
  };

  // ── Acciones del curso (Fase 5 acciones) ─────────────────────────────
  // Solver "todos los rangos": loop secuencial cronológico (rangos por
  // fechaInicio asc). Cada rango aprovecha el cap anual cross-rango: tras
  // ejecutar R1, sus placements pasan al state local; R2 los ve vía
  // alreadyPlacedByImp en runSolver; R3 ve R1+R2; etc. Ejecutar en orden
  // garantiza que las cuotas finales por materia respeten objetivo+1.5h.
  // Si un rango falla, continuamos con el resto y reportamos al final.
  // `plsOverride`: si se pasa, ignora `plByGrupo[selectedGrupo]` (que puede
  // estar batch-stale tras un setPlByGrupo síncrono dentro del mismo handler).
  // Útil para "Configurar curso óptimo" que crea rangos y ejecuta el solver en
  // un solo flujo, donde React aún no ha re-rendereado tras el setState.
  const runSolverAllRangos = async (plsOverride = null, autoSave = false) => {
    if (!selectedGrupo) return;
    const pls = (plsOverride ?? plByGrupo[selectedGrupo] ?? []).slice().sort((a, b) =>
      (a.fechaInicio || '').localeCompare(b.fechaInicio || ''));
    if (pls.length === 0) {
      toast.error(t('scheduleEditor.solverAllNoRangos', { defaultValue: 'El grupo no tiene rangos lectivos.' }));
      return;
    }
    // Confirmación: si algún rango ya tiene placements, advertir.
    const algunoTienePlacements = pls.some(pl => {
      const localKey = `${selectedGrupo}_${pl.id}`;
      const local = state[localKey];
      if (local?.placements && Object.keys(local.placements).length > 0) return true;
      const persistidos = (allHorariosByGroup[selectedGrupo] || []).some(h => extractFkId(h.periodoLectivo) === String(pl.id));
      return persistidos;
    });
    if (algunoTienePlacements) {
      const ok = await confirm({
        title: t('scheduleEditor.solverAllConfirmTitle', { defaultValue: 'Sugerir todo el curso' }),
        body: t('scheduleEditor.solverAllConfirmBody', {
          defaultValue: 'Esto recalculará el horario de los {{count}} rangos del grupo en orden cronológico. Los placements actuales se sustituirán. ¿Continuar?',
          count: pls.length,
        }),
        confirmLabel: t('scheduleEditor.solverAllConfirmLabel', { defaultValue: 'Sí, recalcular' }),
        confirmVariant: 'primary',
      });
      if (!ok) return;
    }
    setSolverAllRunning(true);
    const errores = [];
    // Acumulador de minutos anuales colocados por imparticion. Lo mantenemos
    // localmente (en vez de leer state entre iteraciones) para evitar el
    // problema de batching de React: setState es async, así que el siguiente
    // runSolver podría leer state stale y NO ver los placements del rango
    // anterior → cap anual no se aplicaría correctamente. Pasando este
    // acumulador como `alreadyPlacedOverride`, el cap funciona deterministico.
    const accumPlacedByImp = {};
    let savedCount = 0;
    console.group(`[SolverAll] grupo=${selectedGrupo} pls=${pls.length} autoSave=${autoSave}`);

    // Pre-cache de PLIs del grupo (mapa "plId_impId" → pli).
    // Lo usamos para reducir cuotas iterativamente cuando el solver da
    // unplaced. Cargamos UNA VEZ al inicio y vamos actualizando local.
    const pliCache = {};
    try {
      const pliRes = await fetch(getApiUrl(`/api/periodo_lectivo_imparticions?periodoLectivo.grupo=${selectedGrupo}&pagination=false`), {
        headers: { 'Accept': 'application/ld+json' }, credentials: 'include',
      });
      if (pliRes.ok) {
        const pliData = await pliRes.json();
        const plis = pliData['hydra:member'] || pliData.member || [];
        plis.forEach(pli => {
          const plId = extractFkId(pli.periodoLectivo);
          const impId = extractFkId(pli.imparticion);
          if (plId && impId) pliCache[`${plId}_${impId}`] = pli;
        });
      }
    } catch (err) {
      console.warn('[SolverAll] No se pudo cargar pliCache (iteración solver no funcionará):', err);
    }

    // Helper: reducir cuotas de las materias unplaced. Devuelve true si
    // hubo reducción (=> reintentar solver); false si no se puede reducir más.
    const reduceUnplacedQuotas = async (plId, unplaced) => {
      const SLOT_MIN = 60; // asumir slot mínimo 60 (FP Mañanas/Tardes)
      let reduced = false;
      for (const u of unplaced) {
        const impId = u.imparticionId || u.impId;
        if (!impId) continue;
        const key = `${plId}_${impId}`;
        const pli = pliCache[key];
        if (!pli) continue;
        const currentMin = (pli.minutosSemanales != null) ? pli.minutosSemanales : 0;
        if (currentMin < SLOT_MIN) continue; // ya está en 0, no se puede reducir más
        const newMin = currentMin - SLOT_MIN;
        try {
          const r = await fetch(getApiUrl(`/api/periodo_lectivo_imparticions/${pli.id}`), {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/merge-patch+json', 'Accept': 'application/ld+json' },
            credentials: 'include',
            body: JSON.stringify({ minutosSemanales: newMin }),
          });
          if (r.ok) {
            pliCache[key] = { ...pli, minutosSemanales: newMin };
            reduced = true;
            console.log(`[SolverAll] reducida cuota PLI #${pli.id} (mat ${u.materia || impId}): ${currentMin} → ${newMin} min/sem`);
          }
        } catch (err) {
          console.warn(`[SolverAll] error reduciendo PLI #${pli.id}:`, err);
        }
      }
      return reduced;
    };

    try {
      let plIdx = 0;
      for (const pl of pls) {
        plIdx++;
        setSolverProgress({ current: plIdx, total: pls.length, plName: pl.nombre || '' });
        // Switch al PL para que la UI lo refleje durante la ejecución.
        setSelectedPlByGrupo(prev => ({ ...prev, [selectedGrupo]: pl.id }));
        await new Promise(r => setTimeout(r, 50));
        console.group(`[SolverAll] PL #${pl.id} ${pl.nombre} ${pl.fechaInicio?.slice(0, 10)} → ${pl.fechaFin?.slice(0, 10)}`);
        console.log('[SolverAll] alreadyPlaced (cross-rango cumulativo):', { ...accumPlacedByImp });
        try {
          // Loop iterativo: si el solver da unplaced, reducir cuotas y reintentar.
          // Garantiza que al final el rango esté `complete=true unplaced=0`.
          const MAX_SOLVER_RETRIES = 6;
          let solverAttempt = 0;
          let data = null;
          while (solverAttempt < MAX_SOLVER_RETRIES) {
            data = await runSolver(null, /* skipConfirm */ true, pl.id, { ...accumPlacedByImp });
            console.log(`[SolverAll] solver response (attempt ${solverAttempt + 1}): complete=${data?.complete} placed=${data?.placements?.length} unplaced=${data?.unplaced?.length}`);
            if (!data?.unplaced?.length && data?.complete) break;
            if (data?.unplaced?.length) {
              console.warn('[SolverAll] UNPLACED:', data.unplaced);
              const reduced = await reduceUnplacedQuotas(pl.id, data.unplaced);
              if (!reduced) {
                console.warn('[SolverAll] no se pudo reducir más, abandonando reintentos');
                break;
              }
              solverAttempt++;
              continue;
            }
            // complete=false sin unplaced: caso raro, abandonar
            break;
          }
          if (data?.debug) {
            console.log('[SolverAll] solver debug final:', data.debug);
          }
          // Acumular los minutos anuales colocados por imparticion en este rango.
          // Usamos `pl.id` para mirar las semanas y multiplicar.
          if (data?.placements) {
            // Cuando viene de "Configurar curso óptimo" con plsOverride, el
            // memo `semanasByPlId` puede no haberse re-renderizado todavía.
            // Calculamos las semanas directamente del PL para evitar el stale.
            let semanasPL = semanasByPlId[pl.id] || 0;
            if (semanasPL === 0 && pl.fechaInicio && pl.fechaFin) {
              const ini = new Date(pl.fechaInicio.slice(0, 10));
              const fin = new Date(pl.fechaFin.slice(0, 10));
              const days = Math.max(0, Math.round((fin - ini) / 86400000) + 1);
              semanasPL = days / 7;
            }
            const semanalMinPorImp = {};
            data.placements.forEach(p => {
              const dur = parseHmsToMin(p.horaFin) - parseHmsToMin(p.horaInicio);
              if (dur <= 0) return;
              semanalMinPorImp[p.imparticionId] = (semanalMinPorImp[p.imparticionId] || 0) + dur;
            });
            console.log(`[SolverAll] PL #${pl.id} sem=${semanasPL.toFixed(2)} placed by materia (sem):`,
              Object.fromEntries(Object.entries(semanalMinPorImp).map(([impId, m]) => [
                imps.find(i => String(i.id) === String(impId))?.materia?.nombre || impId,
                `${m} min/sem (${(m / 60).toFixed(2)}h)`,
              ])));
            Object.entries(semanalMinPorImp).forEach(([impId, semanalMin]) => {
              accumPlacedByImp[impId] = (accumPlacedByImp[impId] || 0) + semanalMin * semanasPL;
            });

            // autoSave: persistir el rango DIRECTAMENTE con los placements recién
            // devueltos por el solver (evitamos closure-stale en `state`: los
            // setState del solver son async y `performBatchSaveAllDirty` leería
            // un `state` capturado anterior al solver → no encontraría dirty).
            if (autoSave) {
              const ops = data.placements.map(p => {
                const hi = String(p.horaInicio).slice(0, 8);
                const hf = String(p.horaFin).slice(0, 8);
                return {
                  op: 'create',
                  clientKey: `${p.diaSemana}_${hi}`,
                  diaSemana: p.diaSemana,
                  horaInicio: hi.slice(0, 5),
                  horaFin: hf.slice(0, 5),
                  aula: p.aula,
                  imparticion: p.imparticionId,
                };
              });
              try {
                const res = await fetch(getApiUrl('/api/v1/horarios/batch'), {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
                  credentials: 'include',
                  body: JSON.stringify({
                    grupoId: Number(selectedGrupo),
                    periodoLectivoId: Number(pl.id),
                    baselineMaxUpdatedAt: null,
                    operations: ops,
                  }),
                });
                if (!res.ok) {
                  const txt = await res.text().catch(() => '');
                  throw new Error(`${res.status}: ${txt.slice(0, 200)}`);
                }
                const sd = await res.json();
                // Marcar dirty=false en state local con baseline = newPlacements.
                const newPlacements = {};
                data.placements.forEach(p => {
                  const hi = String(p.horaInicio).slice(0, 8);
                  newPlacements[`${p.diaSemana}_${hi}`] = {
                    imparticionId: p.imparticionId,
                    aula: p.aula,
                    horaInicio: hi,
                    horaFin: String(p.horaFin).slice(0, 8),
                  };
                });
                // Ajustar hid de los created.
                (sd.created || []).forEach(({ clientKey, id }) => {
                  if (clientKey && newPlacements[clientKey]) {
                    newPlacements[clientKey] = { ...newPlacements[clientKey], hid: id };
                  }
                });
                const skey = `${selectedGrupo}_${pl.id}`;
                setState(prev => ({
                  ...prev,
                  [skey]: {
                    ...(prev[skey] || {}),
                    placements: newPlacements,
                    baseline: { ...newPlacements },
                    baselineMaxUpdatedAt: sd.maxUpdatedAt || null,
                    dirty: false,
                  },
                }));
                savedCount++;
                console.log(`[SolverAll] PL #${pl.id} guardado: ${ops.length} placements persistidos`);
              } catch (err) {
                console.error(`[SolverAll] PL #${pl.id} save FAIL:`, err);
                errores.push({ pl: pl.nombre || `#${pl.id}`, error: `Save: ${err?.message || String(err)}` });
              }
            }
          }
        } catch (err) {
          console.error(`[SolverAll] PL #${pl.id} solver FAIL:`, err);
          errores.push({ pl: pl.nombre || `#${pl.id}`, error: err?.message || String(err) });
        }
        console.groupEnd(); // PL group
      }
      // Refetch global de horarios para que el cómputo cross-rango refleje BD.
      if (autoSave && savedCount > 0) {
        await refetchAllHorariosForGroup(selectedGrupo);
      }
      if (errores.length > 0) {
        toast.error(t('scheduleEditor.solverAllPartial', {
          defaultValue: '{{count}} rangos fallaron: {{names}}',
          count: errores.length,
          names: errores.map(e => e.pl).join(', '),
        }));
      } else if (autoSave) {
        toast.success(t('scheduleEditor.solverAllSavedSuccess', {
          defaultValue: 'Curso configurado y guardado: {{count}} rangos.',
          count: savedCount,
        }));
      } else {
        toast.success(t('scheduleEditor.solverAllSuccess', {
          defaultValue: 'Solver ejecutado en {{count}} rangos del curso.',
          count: pls.length,
        }));
      }
    } finally {
      setSolverAllRunning(false);
      setSolverProgress(null);
    }
    console.log(`[SolverAll] FIN: ${savedCount} guardados, ${errores.length} errores. accumPlacedFinal:`, accumPlacedByImp);
    console.groupEnd(); // SolverAll group
  };

  // Limpiar rango activo: vacía placements del PL activo en state local.
  // Marca dirty=true; el admin guarda para persistir el vaciado.
  const handleClearActiveRange = async () => {
    if (!stateKey || !grupoState) return;
    const ok = await confirm({
      title: t('scheduleEditor.clearRangeTitle', { defaultValue: 'Limpiar rango' }),
      body: t('scheduleEditor.clearRangeBody', {
        defaultValue: '¿Vaciar los placements del rango activo? El cambio no se persiste hasta pulsar Guardar.',
      }),
      confirmLabel: t('scheduleEditor.clearConfirmLabel', { defaultValue: 'Limpiar' }),
      confirmVariant: 'danger',
    });
    if (!ok) return;
    setState(prev => ({
      ...prev,
      [stateKey]: {
        ...prev[stateKey],
        placements: {},
        dirty: true,
      },
    }));
    setCursoActionsOpen(false);
    toast.success(t('scheduleEditor.clearRangeSuccess', { defaultValue: 'Rango limpiado' }));
  };

  // Limpiar todo el curso: borra TODOS los rangos del grupo + sus horarios y
  // PLIs (cascade DB). Hard-delete vía endpoint `DELETE /api/v1/grupos/{id}
  // /clear-rangos`. Tras éxito, refetch de PLs (lista quedará vacía → editor
  // bloqueado hasta crear rango).
  const handleClearAllCourse = async () => {
    if (!selectedGrupo) return;
    const ok = await confirm({
      title: t('scheduleEditor.clearAllTitle', { defaultValue: 'Limpiar todo el curso' }),
      body: t('scheduleEditor.clearAllBodyPreview', {
        defaultValue: 'Se vaciará el strip de rangos en preview. Pulsa Guardar para confirmar el borrado en BD, o Descartar para revertir. ¿Continuar?',
      }),
      confirmLabel: t('scheduleEditor.clearConfirmLabel', { defaultValue: 'Limpiar' }),
      confirmVariant: 'danger',
    });
    if (!ok) return;
    setCursoActionsOpen(false);

    // Tanda B parte 2: NO toca BD. Marca todos los reales como pending
    // delete; al pulsar Guardar se ejecuta el DELETE secuencial.
    const previaTx = pendingTxByGrupo[selectedGrupo];
    const realesActuales = (plByGrupo[selectedGrupo] || []).filter(p => !p._pending);
    const plsToDelete = previaTx?.plsToDelete ?? realesActuales.map(p => p.id);
    const plsRealesOriginales = previaTx?.plsRealesOriginales ?? realesActuales;

    setPendingTxByGrupo(prev => ({
      ...prev,
      [selectedGrupo]: {
        ...(previaTx || {}),
        grupoFechaFin: previaTx?.grupoFechaFin || null,
        grupoFechaFinOriginal: previaTx?.grupoFechaFinOriginal || grupo?.fechaFin || null,
        plsToDelete,
        plsRealesOriginales,
        plsToCreate: [],     // limpiar virtuales (si los había)
        pliPatches: [],
      },
    }));
    // Vaciar el strip y caches locales.
    setPlByGrupo(prev => ({ ...prev, [selectedGrupo]: [] }));
    setSelectedPlByGrupo(prev => { const n = { ...prev }; delete n[selectedGrupo]; return n; });
    setState(prev => {
      const next = { ...prev };
      Object.keys(next).forEach(k => { if (k.startsWith(`${selectedGrupo}_`)) delete next[k]; });
      return next;
    });
    setCapacityByGrupo(prev => {
      const next = { ...prev };
      Object.keys(next).forEach(k => { if (k.startsWith(`${selectedGrupo}_`)) delete next[k]; });
      return next;
    });
    toast.success(t('scheduleEditor.clearAllSuccessPreview', {
      defaultValue: 'Curso limpiado (preview). Pulsa Guardar para confirmar.',
    }));
  };

  // Crear Rangos Recomendados: borra los PLs existentes y crea N nuevos
  // equiespaciados desde Grupo.fechaInicio cubriendo SOLO las semanas óptimas
  // necesarias para el currículo (Fase 5 fix post-cierre 2026-04-29). El resto
  // del año natural queda sin rangos lectivos para FCT, exámenes, evaluaciones,
  // etc. Si el currículo no cabe en el calendario disponible, se usa todo el
  // calendario (caso déficit físico, banner rojo lo indicará aparte).
  // `nOverride`: si se pasa, ignora `createRangosCount` del state. Útil para
  // "Configurar curso óptimo" que invoca esta función sin abrir el modal y
  // necesita garantizar un N concreto independiente de interacciones previas.
  // Devuelve la lista de PLs creados (o null si falló) — el caller lo usa
  // como fuente de verdad en lugar de leer state batch-stale.
  const handleCreateRecommendedRangos = async (e, nOverride = null, fechasOverride = null) => {
    if (e?.preventDefault) e.preventDefault();  // evita submit nativo del <form> del ModalView
    if (!selectedGrupo || !grupo) return null;
    const N = nOverride !== null
      ? Math.max(1, nOverride)
      : Math.max(1, parseInt(createRangosCount, 10) || 3);
    const iniISO = fechasOverride?.iniISO
      || grupo.fechaInicio?.slice(0, 10)
      || (grupo.anioEscolar ? `${grupo.anioEscolar.split('-')[0]}-09-01` : null);
    const finISO = fechasOverride?.finISO
      || grupo.fechaFin?.slice(0, 10)
      || (grupo.anioEscolar ? `${grupo.anioEscolar.split('-')[1] || (Number(grupo.anioEscolar.split('-')[0]) + 1)}-06-30` : null);
    if (!iniISO || !finISO) {
      toast.error(t('scheduleEditor.createRangosNoFechas', { defaultValue: 'El grupo no tiene fechaInicio/fechaFin. Edítalo primero en /admin/grupos.' }));
      return null;
    }

    // Tanda B parte 2: NO toca BD. Acumula en pendingTxByGrupo[gid] para
    // que el botón Guardar aplique el plan completo al final.
    const previaTx = pendingTxByGrupo[selectedGrupo];
    const realesActuales = (plByGrupo[selectedGrupo] || []).filter(p => !p._pending);
    // Si ya había tx previa, conservamos plsToDelete + plsRealesOriginales
    // (los REALES originales antes de cualquier edit) y solo regeneramos los
    // virtuales. Si no hay tx previa, los reales actuales serán plsToDelete.
    const plsToDelete = previaTx?.plsToDelete ?? realesActuales.map(p => p.id);
    const plsRealesOriginales = previaTx?.plsRealesOriginales ?? realesActuales;

    // Calcular tramos.
    const ini = new Date(iniISO);
    const fin = new Date(finISO);
    const totalDiasCalendario = Math.max(1, Math.round((fin - ini) / 86400000) + 1);
    const diasOptimos = (semanasOptimas > 0) ? semanasOptimas * 7 : totalDiasCalendario;
    const totalDias = Math.min(diasOptimos, totalDiasCalendario);
    const diasPorTramo = Math.floor(totalDias / N);
    const remainder = totalDias - diasPorTramo * N;

    // Construir N virtuales con tempIds negativos.
    const plsToCreate = [];
    let cursor = new Date(ini);
    for (let i = 0; i < N; i++) {
      const dias = diasPorTramo + (i < remainder ? 1 : 0);
      const tramoIni = new Date(cursor);
      const tramoFin = new Date(cursor);
      tramoFin.setDate(tramoFin.getDate() + dias - 1);
      const tempId = tempIdSeqRef.current;
      tempIdSeqRef.current -= 1;
      plsToCreate.push({
        tempId,
        id: tempId,
        _pending: 'create',
        nombre: t('scheduleEditor.recommendedRangoNombre', { defaultValue: 'Rango {{n}}', n: i + 1 }),
        fechaInicio: tramoIni.toISOString().slice(0, 10),
        fechaFin: tramoFin.toISOString().slice(0, 10),
        jornadaTipo: null,
        jornadaTipoId: null,
        orden: i,
      });
      cursor.setDate(cursor.getDate() + dias);
    }

    setPendingTxByGrupo(prev => ({
      ...prev,
      [selectedGrupo]: {
        ...(previaTx || {}),
        grupoFechaFin: previaTx?.grupoFechaFin || null,
        grupoFechaFinOriginal: previaTx?.grupoFechaFinOriginal || grupo.fechaFin,
        plsToDelete,
        plsRealesOriginales,
        plsToCreate,
        pliPatches: [],
      },
    }));
    setPlByGrupo(prev => ({ ...prev, [selectedGrupo]: plsToCreate.slice() }));
    // Limpia state de PLs reales viejos y de virtuales previos.
    setState(prev => {
      const next = { ...prev };
      Object.keys(next).forEach(k => { if (k.startsWith(`${selectedGrupo}_`)) delete next[k]; });
      return next;
    });
    setCapacityByGrupo(prev => {
      const next = { ...prev };
      Object.keys(next).forEach(k => { if (k.startsWith(`${selectedGrupo}_`)) delete next[k]; });
      return next;
    });
    if (plsToCreate[0]) {
      setSelectedPlByGrupo(prev => ({ ...prev, [selectedGrupo]: String(plsToCreate[0].tempId) }));
    }
    setCreateRangosModalOpen(false);
    setCursoActionsOpen(false);
    toast.success(t('scheduleEditor.createRangosSuccessPreview', {
      defaultValue: '{{count}} rangos creados (preview). Pulsa Guardar para persistir.',
      count: plsToCreate.length,
    }));
    return plsToCreate;
  };

  // Configurar curso óptimo (Fase 5 fix post-cierre 2026-04-29 + Distributor
  // 2026-04-29): aplica el principio "tiempos fluidos" — adapta el calendario
  // al currículo y a la jornada del centro/rango. Pipeline completo:
  //   1. Si `semanasOptimas × 7` excede el calendario actual del grupo:
  //      extender `Grupo.fechaFin` los días que hagan falta.
  //   2. Borrar PLs actuales y crear N rangos cubriendo `semanasOptimas`.
  //   3. Llamar `distribute-curriculum` (backend `CurriculumDistributor`) que
  //      reparte minutos heterogéneos por (rango, materia) respetando jornada
  //      efectiva de cada rango. Si dice `extendBy > 0`, extender más y
  //      reintentar (hasta 3 intentos).
  //   4. PATCH `pli.minutosSemanales` con la distribución sugerida.
  //   5. Lanzar el solver per-rango con `runSolverAllRangos`.
  // Resultado esperado: TODAS las materias colocadas al ~100% del currículo,
  // sin que ninguna absorba déficit estructural per-semana (ya no hay
  // necesidad porque los minutos varían por rango).
  const handleConfigureOptimalCourse = async () => {
    if (!selectedGrupo || !grupo) return;
    if (semanasOptimas <= 0) {
      toast.error(t('scheduleEditor.optimalNoData', {
        defaultValue: 'No se puede calcular el curso óptimo: faltan datos de jornada o materias.',
      }));
      return;
    }
    const N = Math.max(1, parseInt(createRangosCount, 10) || 3);
    const iniISO = grupo.fechaInicio?.slice(0, 10);
    if (!iniISO) {
      toast.error(t('scheduleEditor.createRangosNoFechas', { defaultValue: 'El grupo no tiene fechaInicio/fechaFin. Edítalo primero en /admin/grupos.' }));
      return;
    }
    // Base ideal de fechaFin: junio 30 del segundo año académico. Esto resetea
    // cualquier acumulación de extends de pruebas anteriores (ej fechaFin
    // 2030-11-20 tras múltiples ejecuciones de "Configurar curso óptimo").
    // El sistema extenderá DESDE esta base si hace falta, no desde fechaFin
    // acumulado.
    let finISO;
    if (grupo.anioEscolar) {
      const partes = grupo.anioEscolar.split('-');
      const segundoAnio = partes[1] || String(Number(partes[0]) + 1);
      finISO = `${segundoAnio}-06-30`;
    } else {
      const yearIni = parseInt(iniISO.slice(0, 4), 10);
      finISO = `${yearIni + 1}-06-30`;
    }
    const finISOPrev = grupo.fechaFin?.slice(0, 10);
    const finResetNeeded = finISOPrev && finISOPrev !== finISO;
    if (finResetNeeded) {
      console.log(`[OptCurso] Reset Grupo.fechaFin: ${finISOPrev} → ${finISO} (eliminando acumulación previa)`);
    }

    // Calcular si hay que extender Grupo.fechaFin para cubrir semanasOptimas.
    const ini = new Date(iniISO);
    const fin = new Date(finISO);
    const totalDiasCalendario = Math.max(1, Math.round((fin - ini) / 86400000) + 1);
    const diasNecesarios = semanasOptimas * 7;
    const willExtend = diasNecesarios > totalDiasCalendario;
    const diasExtension = willExtend ? (diasNecesarios - totalDiasCalendario) : 0;
    const newFechaFinDate = willExtend
      ? new Date(fin.getTime() + diasExtension * 86400000)
      : fin;
    const newFinISO = newFechaFinDate.toISOString().slice(0, 10);

    console.group(`[OptCurso] grupo=${selectedGrupo} (${grupo?.nombre || '?'})`);
    console.log('[OptCurso] inputs:', {
      grupoId: selectedGrupo,
      grupoNombre: grupo?.nombre,
      itinerario: grupo?.itinerario?.nombre,
      iniISO, finISO,
      totalDiasCalendario,
      semanasOptimas,
      diasNecesarios,
      willExtend, diasExtension, newFinISO,
      N,
      slotsSemanalMin,
      jornadaSemanalLectivaMin,
      impsCount: imps.length,
      impsPresenciales: impsPresenciales.length,
      objetivoAnualPorImp: imps.map(i => ({
        materia: i.materia?.nombre,
        horasTotales: i.materia?.horasTotales,
        minSemanales: i.materia?.minutosSemanales,
        modalidad: getEffectiveModalidad(i),
        objetivoMin: minutosAnualesObjetivoByImp[i.id] || 0,
      })),
    });

    // Confirmación con preview.
    const ok = await confirm({
      title: t('scheduleEditor.optimalConfirmTitle', { defaultValue: 'Configurar curso óptimo' }),
      body: willExtend
        ? t('scheduleEditor.optimalConfirmBodyExtend', {
            defaultValue: 'Esto extenderá la fecha de fin del curso de {{oldFin}} a {{newFin}} ({{dias}} días) para cubrir las {{semanas}} semanas necesarias del currículo, borrará todos los rangos y placements actuales, creará {{count}} rangos y ejecutará el solver con minutos heterogéneos por rango. ¿Continuar?',
            oldFin: fmtDateEs(finISO),
            newFin: fmtDateEs(newFinISO),
            dias: diasExtension,
            semanas: semanasOptimas,
            count: N,
          })
        : t('scheduleEditor.optimalConfirmBody', {
            defaultValue: 'Esto borrará todos los rangos y placements actuales del grupo, creará {{count}} rangos cubriendo {{semanas}} semanas desde {{ini}}, distribuirá los minutos por rango heterogéneamente y ejecutará el solver. ¿Continuar?',
            count: N,
            semanas: semanasOptimas,
            ini: fmtDateEs(iniISO),
          }),
      confirmLabel: t('scheduleEditor.optimalConfirmLabel', { defaultValue: 'Sí, configurar' }),
      confirmVariant: 'primary',
    });
    if (!ok) { console.groupEnd(); return; }
    setCursoActionsOpen(false);

    // Resolver la jornada efectiva del grupo ANTES de empezar — los PLs
    // virtuales necesitan jornadaTipoId explícito porque el backend, sin él,
    // cae a la cadena Grupo.override → Itinerario.jornadaTipo, y si está
    // todo NULL devuelve "PL sin jornada efectiva" con extendBy:0 (que el
    // frontend interpretaría erróneamente como shortfall irreductible).
    const jornadaIdEfectiva = resolveEffectiveJornadaId(grupo);
    if (!jornadaIdEfectiva) {
      toast.error(t('scheduleEditor.optimalNoJornada', {
        defaultValue: 'El grupo no tiene jornada asignada (ni override ni en el itinerario). Asigna una desde /admin/jornadas o el selector del editor antes de configurar el curso óptimo.',
      }));
      console.groupEnd();
      return;
    }

    // Tanda B (2026-04-30) — "Nada persiste hasta Guardar":
    // Esta secuencia ya NO toca BD. Construimos los rangos virtuales en
    // pendingTxByGrupo[gid] + plByGrupo[gid] (con _pending: 'create' y
    // tempIds negativos), llamamos a los endpoints solver-dry-run /
    // distribute-curriculum-dry-run para previsualizar la distribución y
    // los placements, y populamos state[gid_tempId] con los placements del
    // solver. Al pulsar "Guardar" el flow aplica todo (PATCH grupo, DELETE
    // PLs viejos, POST PLs nuevos, PATCH PLIs, POST horarios). Al pulsar
    // "Descartar" la cola se vacía y el state local vuelve atrás.
    setConfiguringOptimal(true);
    setConfiguringStep('1/5');
    try {

    // Paso 1 (DRY): registrar pendingTx + capturar snapshot.
    const realesActuales = (plByGrupo[selectedGrupo] || []).filter(p => !p._pending);
    const grupoFechaFinFinal = (willExtend || finResetNeeded) ? newFinISO : null;
    const pendingTx = {
      grupoFechaFin: grupoFechaFinFinal,
      grupoFechaFinOriginal: grupo.fechaFin,
      plsToDelete: realesActuales.map(p => p.id),
      plsRealesOriginales: realesActuales,  // snapshot para restaurar al descartar
      plsToCreate: [],
      pliPatches: [],
    };

    // Paso 2 (DRY): construir N PLs virtuales con tempIds negativos.
    setConfiguringStep('2/5');
    {
      const totalDias = Math.max(1, Math.round((new Date(newFinISO) - new Date(iniISO)) / 86400000) + 1);
      const diasPorRango = Math.floor(totalDias / N);
      let cursor = new Date(iniISO);
      for (let i = 0; i < N; i++) {
        const tempId = tempIdSeqRef.current;
        tempIdSeqRef.current -= 1;
        const inicioRango = new Date(cursor);
        const finRango = (i === N - 1)
          ? new Date(newFinISO)
          : new Date(cursor.getTime() + (diasPorRango - 1) * 86400000);
        pendingTx.plsToCreate.push({
          tempId,
          id: tempId,                // así el strip lo trata como cualquier PL
          _pending: 'create',
          nombre: `Rango ${i + 1}`,
          fechaInicio: inicioRango.toISOString().slice(0, 10),
          fechaFin: finRango.toISOString().slice(0, 10),
          // Jornada explícita: heredamos la efectiva del grupo aquí mismo
          // para que el backend dry-run no dependa de la cadena de fallback
          // (que podría fallar si grupo.override + itinerario.jornadaTipo
          // ambos son null al mismo tiempo).
          jornadaTipo: { id: jornadaIdEfectiva },
          jornadaTipoId: jornadaIdEfectiva,
          orden: i,
        });
        cursor = new Date(finRango.getTime() + 86400000);
      }
    }

    // Reemplaza plByGrupo[gid] por los virtuales (los reales se borrarán
    // cuando se aplique la tx — el usuario los ve "desaparecer" del strip,
    // que es coherente con la intención de la operación).
    setPlByGrupo(prev => ({ ...prev, [selectedGrupo]: pendingTx.plsToCreate.slice() }));
    // Limpia state de PLs reales que se van a borrar.
    setState(prev => {
      const next = { ...prev };
      pendingTx.plsToDelete.forEach(realId => {
        delete next[`${selectedGrupo}_${realId}`];
      });
      return next;
    });

    // Paso 3 (DRY): distribuir currículo via dry-run. Si extendBy > 0,
    // ajustar último rango virtual y reintentar. Si tras N intentos no se
    // logra feasible, NO abortar — el distribuidor devuelve una distribución
    // PARCIAL (lo que sí pudo asignar) y dejamos que el solver corra con
    // esa distribución parcial. El usuario ve los placements en el editor
    // y retoca a mano lo que quede sin cubrir (comportamiento del flow
    // antiguo: best-effort, no aborto en redistributionShortfall).
    setConfiguringStep('3/5');
    let distribution = null;
    let attempts = 0;
    let lastShortfallSignature = null;
    let stuck = false;
    let lastDistJson = null;
    const MAX_DISTRIBUTE_ATTEMPTS = 20;
    while (attempts < MAX_DISTRIBUTE_ATTEMPTS) {
      const distRes = await fetch(getApiUrl(`/api/v1/grupos/${selectedGrupo}/distribute-curriculum-dry-run`), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          rangos: pendingTx.plsToCreate.map(pl => ({
            tempId: pl.tempId,
            nombre: pl.nombre,
            fechaInicio: pl.fechaInicio,
            fechaFin: pl.fechaFin,
            jornadaTipoId: pl.jornadaTipoId,
          })),
        }),
      });
      if (!distRes.ok) {
        toast.error(t('scheduleEditor.distributeError', { defaultValue: 'No se pudo distribuir el currículo entre los rangos.' }));
        console.groupEnd();
        return;
      }
      const distJson = await distRes.json();
      lastDistJson = distJson;
      console.log(`[OptCurso] Paso 3.${attempts + 1} response:`, distJson);
      if (distJson.feasible) {
        distribution = distJson.distribution;
        break;
      }
      const extendBy = distJson.extendBy || 0;
      // Detectar loop atascado: si el shortfall no progresa, salir y usar
      // la distribución parcial.
      const shortfallSignature = JSON.stringify(distJson.shortfalls || {});
      if (extendBy > 0 && shortfallSignature === lastShortfallSignature) {
        console.warn('[OptCurso] Loop atascado en distribuidor — uso distribución parcial.');
        stuck = true;
        break;
      }
      lastShortfallSignature = shortfallSignature;
      if (extendBy > 0 && attempts < MAX_DISTRIBUTE_ATTEMPTS - 1) {
        // Extender último PL virtual + grupoFechaFin pendiente.
        const lastVirt = pendingTx.plsToCreate[pendingTx.plsToCreate.length - 1];
        const lastFin = new Date(lastVirt.fechaFin);
        lastFin.setDate(lastFin.getDate() + extendBy);
        lastVirt.fechaFin = lastFin.toISOString().slice(0, 10);
        const newGrupoFin = new Date(pendingTx.grupoFechaFin || grupo.fechaFin);
        newGrupoFin.setDate(newGrupoFin.getDate() + extendBy);
        pendingTx.grupoFechaFin = newGrupoFin.toISOString().slice(0, 10);
        setPlByGrupo(prev => ({ ...prev, [selectedGrupo]: pendingTx.plsToCreate.slice() }));
        attempts++;
        continue;
      }
      // Sin extendBy y sin progreso → salir del loop con distribución parcial.
      console.warn('[OptCurso] Distribuidor sin extendBy: uso distribución parcial.');
      break;
    }

    // Si no hay feasible, usar la distribución parcial del último response.
    // El backend siempre devuelve `distribution` aun en redistributionShortfall
    // (lo que sí se logró asignar). El solver corre con esa distribución y
    // el usuario retoca manualmente las materias atascadas.
    if (!distribution && lastDistJson?.distribution) {
      distribution = lastDistJson.distribution;
      const shortfallsHuman = Object.entries(lastDistJson.shortfalls || {})
        .map(([impId, min]) => {
          const imp = imps.find(i => String(i.id) === String(impId));
          const nombre = imp?.materia?.nombre || `imp ${impId}`;
          return `${nombre}: ${Math.round(min / 60 * 10) / 10}h`;
        })
        .join(', ');
      if (shortfallsHuman) {
        toast.warning(t('scheduleEditor.distributePartial', {
          defaultValue: 'Distribución parcial: {{materias}}. El solver se ejecutará con lo que cabe; ajusta a mano lo que falte.',
          materias: shortfallsHuman,
        }), { duration: 10000 });
      }
    }
    if (!distribution) {
      // Caso patológico: el distribuidor no devolvió ni distribución parcial.
      const detail = lastDistJson?.debug?.error || lastDistJson?.reason || 'sin detalle';
      toast.error(t('scheduleEditor.distributeShortfall', {
        defaultValue: 'El currículo no cabe en el calendario actual ni extendiendo el curso ({{detail}}).',
        detail,
      }));
      console.groupEnd();
      return;
    }

    // Paso 4 (DRY): registrar pliPatches con la distribución por rango.
    setConfiguringStep('4/5');
    for (const [plKeyStr, byImp] of Object.entries(distribution)) {
      const plKey = Number(plKeyStr);
      for (const [impIdStr, minutos] of Object.entries(byImp)) {
        pendingTx.pliPatches.push({
          plKey,
          imparticionId: Number(impIdStr),
          minutosSemanales: Number(minutos),
        });
      }
    }

    // Paso 5 (DRY): solver-dry-run por cada PL virtual, acumulando placements
    // en state[gid_tempId] con dirty=true. alreadyPlacedByImp se acumula
    // entre rangos para que el cap anual cross-rango funcione.
    setConfiguringStep('5/5');
    {
      const totalSemanasGrupo = pendingTx.plsToCreate.reduce((acc, pl) => {
        const dias = (new Date(pl.fechaFin) - new Date(pl.fechaInicio)) / 86400000 + 1;
        return acc + dias / 7;
      }, 0);
      const alreadyPlacedByImp = {};
      for (const pl of pendingTx.plsToCreate) {
        const distForPl = distribution[pl.tempId] || {};
        const plisBody = Object.entries(distForPl).map(([impIdStr, minutos]) => ({
          imparticionId: Number(impIdStr),
          minutosSemanales: Number(minutos),
        }));
        const solverRes = await fetch(getApiUrl(`/api/v1/horarios/solver-dry-run/${selectedGrupo}`), {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({
            rango: {
              tempId: pl.tempId,
              fechaInicio: pl.fechaInicio,
              fechaFin: pl.fechaFin,
              jornadaTipoId: pl.jornadaTipoId,
              plis: plisBody,
            },
            alreadyPlacedByImp,
            totalSemanasGrupoOverride: totalSemanasGrupo,
          }),
        });
        if (!solverRes.ok) {
          toast.error(t('scheduleEditor.solverError', { defaultValue: 'El solver ha fallado en uno de los rangos virtuales.' }));
          console.groupEnd();
          return;
        }
        const solverJson = await solverRes.json();
        const placements = {};
        (solverJson.placements || []).forEach(p => {
          const hi = String(p.horaInicio).slice(0, 8);
          const key = `${p.diaSemana}_${hi}`;
          placements[key] = {
            imparticionId: p.imparticionId,
            aula: p.aula,
            horaInicio: hi,
            horaFin: String(p.horaFin).slice(0, 8),
          };
        });
        setState(prev => ({
          ...prev,
          [`${selectedGrupo}_${pl.tempId}`]: {
            placements,
            baseline: {},
            dirty: true,
          },
        }));
        const semanasPl = (new Date(pl.fechaFin) - new Date(pl.fechaInicio)) / 86400000 / 7 + 1/7;
        Object.values(placements).forEach(p => {
          const dur = parseHmsToMin(p.horaFin) - parseHmsToMin(p.horaInicio);
          if (dur <= 0) return;
          alreadyPlacedByImp[p.imparticionId] = (alreadyPlacedByImp[p.imparticionId] || 0) + dur * semanasPl;
        });
      }
    }

    // Persistir pendingTx en estado y seleccionar el primer virtual.
    setPendingTxByGrupo(prev => ({ ...prev, [selectedGrupo]: pendingTx }));
    if (pendingTx.plsToCreate[0]) {
      setSelectedPlByGrupo(prev => ({ ...prev, [selectedGrupo]: String(pendingTx.plsToCreate[0].tempId) }));
    }
    console.groupEnd();
    toast.success(t('scheduleEditor.optimalPreviewReady', {
      defaultValue: 'Preview lista. Pulsa "Guardar" para persistir o "Descartar" para revertir.',
    }), { duration: 6000 });
    } catch (err) {
      console.error('[OptCurso] FAIL:', err);
      toast.error(err.message || t('scheduleEditor.optimalGenericError', { defaultValue: 'Error generando el curso óptimo.' }));
      console.groupEnd();
    } finally {
      setConfiguringOptimal(false);
      setConfiguringStep(null);
    }
    return;

  };

  // dirtyAny: hay placements editados sin guardar O hay tx pendiente
  // (cambios estructurales del grupo activo). El botón Guardar usa este
  // flag para activarse y para decidir si abrir el modal "publicar
  // incompleto" cuando la cobertura anual no llega al currículo.
  const dirtyAny = Object.values(state).some(s => s?.dirty)
    || (selectedGrupo && hasPendingTx(selectedGrupo));

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
          subtitle={embedded ? t('schedules.subtitle') : t('scheduleEditor.subtitle')}
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
                label: formatGrupoNombre(g),
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
          <Button onClick={handleSave} disabled={!dirtyAny || saving}>
            <Save size={16} style={{ marginRight: 6 }} />
            {saving ? t('scheduleEditor.saving') : (dirtyAny ? t('scheduleEditor.saveChanges') : t('scheduleEditor.saved'))}
          </Button>
        </CrudHeader>

        {selectedGrupo && plByGrupo[selectedGrupo] && (
          <div className={styles.plStrip}>
            <span className={styles.plStripLabel}>
              <CalendarClock size={14} style={{ marginRight: 4 }} />
              {t('scheduleEditor.rangoLectivo', { defaultValue: 'Rango lectivo' })}:
            </span>
            {plByGrupo[selectedGrupo].length === 0 && (
              <span className={styles.plStripEmpty}>
                {t('scheduleEditor.rangoLectivoEmpty', { defaultValue: 'El grupo no tiene rangos lectivos. Crea uno para empezar.' })}
              </span>
            )}
            <div className={styles.plPills}>
              {plByGrupo[selectedGrupo].map(pl => {
                const isActive = String(pl.id) === String(selectedPlId);
                const fmt = (s) => s ? s.slice(0, 10).split('-').reverse().slice(0, 2).join('/') : '';
                const isDeleting = String(deletingPlId) === String(pl.id);
                return (
                  <div
                    key={pl.id}
                    className={`${styles.plPill} ${isActive ? styles.plPillActive : ''} ${isDeleting ? styles.plPillDisabled : ''}`}
                    role="button"
                    tabIndex={isDeleting ? -1 : 0}
                    onClick={() => {
                      if (isDeleting) return;
                      setSelectedPlByGrupo(prev => ({ ...prev, [selectedGrupo]: pl.id }));
                    }}
                    onKeyDown={(e) => {
                      if (isDeleting) return;
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault();
                        setSelectedPlByGrupo(prev => ({ ...prev, [selectedGrupo]: pl.id }));
                      }
                    }}
                    title={`${fmtDateEs(pl.fechaInicio)} → ${fmtDateEs(pl.fechaFin)}`}
                  >
                    <div className={styles.plPillBody}>
                      <span className={styles.plPillName}>{pl.nombre}</span>
                      <span className={styles.plPillDates}>{fmt(pl.fechaInicio)} – {fmt(pl.fechaFin)}</span>
                    </div>
                    {isActive && (
                      <div className={styles.plPillActions}>
                        <button
                          type="button"
                          className={styles.plPillActionBtn}
                          onClick={(e) => { e.stopPropagation(); openPliModal(pl); }}
                          aria-label={t('scheduleEditor.pliConfigure', { defaultValue: 'Materias del rango' })}
                          title={t('scheduleEditor.pliConfigure', { defaultValue: 'Materias del rango' })}
                          disabled={isDeleting}
                        >
                          <Sliders size={13} />
                        </button>
                        <button
                          type="button"
                          className={styles.plPillActionBtn}
                          onClick={(e) => { e.stopPropagation(); openEditPlModal(pl); }}
                          aria-label={t('scheduleEditor.editRango', { defaultValue: 'Editar rango' })}
                          title={t('scheduleEditor.editRango', { defaultValue: 'Editar rango' })}
                          disabled={isDeleting}
                        >
                          <Pencil size={13} />
                        </button>
                        <button
                          type="button"
                          className={`${styles.plPillActionBtn} ${styles.plPillActionDanger}`}
                          onClick={(e) => { e.stopPropagation(); handleDeletePl(pl); }}
                          aria-label={t('scheduleEditor.deleteRango', { defaultValue: 'Borrar rango' })}
                          title={t('scheduleEditor.deleteRango', { defaultValue: 'Borrar rango' })}
                          disabled={isDeleting || (plByGrupo[selectedGrupo] || []).length <= 1}
                        >
                          <Trash2 size={13} />
                        </button>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
            <div className={styles.cursoActionsWrapper}>
              <Button
                type="button"
                onClick={() => setCursoActionsOpen(v => !v)}
                disabled={!selectedGrupo || solving || saving || solverAllRunning || creatingRangos || configuringOptimal}
                variant="secondary"
                title={t('scheduleEditor.cursoActionsTitle', { defaultValue: 'Acciones del curso' })}
              >
                <Settings2 size={14} style={{ marginRight: 4 }} />
                {t('scheduleEditor.cursoActions', { defaultValue: 'Acciones del curso' })}
              </Button>
              {cursoActionsOpen && (
                <>
                  <div
                    className={styles.cursoActionsBackdrop}
                    onClick={() => setCursoActionsOpen(false)}
                  />
                  <div className={styles.cursoActionsMenu} role="menu">
                    <button
                      type="button"
                      className={`${styles.cursoActionsItem} ${styles.cursoActionsItemPrimary || ''}`}
                      onClick={handleConfigureOptimalCourse}
                      disabled={semanasOptimas <= 0}
                      title={semanasOptimas > 0
                        ? t('scheduleEditor.optimalActionTitle', {
                            defaultValue: 'Crear rangos óptimos ({{semanas}} sem) + lanzar solver',
                            semanas: semanasOptimas,
                          })
                        : t('scheduleEditor.optimalNoData', { defaultValue: 'Sin datos para calcular el curso óptimo' })}
                    >
                      <Sparkles size={14} />
                      <span>
                        {t('scheduleEditor.optimalAction', {
                          defaultValue: 'Configurar curso óptimo ({{semanas}} sem)',
                          semanas: semanasOptimas || '?',
                        })}
                      </span>
                    </button>
                    <button
                      type="button"
                      className={styles.cursoActionsItem}
                      onClick={() => { setCursoActionsOpen(false); setCreateRangosCount(3); setCreateRangosModalOpen(true); }}
                    >
                      <CalendarDays size={14} />
                      <span>{t('scheduleEditor.createRecommendedAction', { defaultValue: 'Crear Rangos Recomendados' })}</span>
                    </button>
                    <button
                      type="button"
                      className={styles.cursoActionsItem}
                      onClick={() => { setCursoActionsOpen(false); openCreatePlModal(); }}
                    >
                      <Plus size={14} />
                      <span>{t('scheduleEditor.addRangoManualAction', { defaultValue: 'Añadir rango manual' })}</span>
                    </button>
                    <button
                      type="button"
                      className={styles.cursoActionsItem}
                      onClick={handleClearActiveRange}
                      disabled={!grupoState}
                    >
                      <Eraser size={14} />
                      <span>{t('scheduleEditor.clearRangeAction', { defaultValue: 'Limpiar rango' })}</span>
                    </button>
                    <button
                      type="button"
                      className={styles.cursoActionsItem}
                      onClick={handleClearAllCourse}
                    >
                      <Trash2 size={14} />
                      <span>{t('scheduleEditor.clearAllAction', { defaultValue: 'Limpiar todo el curso' })}</span>
                    </button>
                  </div>
                </>
              )}
            </div>
          </div>
        )}

        {selectedGrupo && hasPendingTx(selectedGrupo) && (
          <div
            className={styles.plBanner}
            style={{
              borderColor: 'var(--accent-warning, var(--color-warning, #d97706))',
              background: 'var(--surface-warning-soft, color-mix(in oklab, var(--accent-warning, #d97706) 12%, var(--bg-elevated, transparent)))',
            }}
            role="alert"
          >
            <div className={styles.plBannerStats}>
              <strong>{t('scheduleEditor.pendingTxTitle', { defaultValue: 'Cambios pendientes (sin guardar)' })}</strong>
              <span className={styles.plBannerMeta}>
                {t('scheduleEditor.pendingTxSummary', {
                  defaultValue: '{{create}} crear · {{update}} editar · {{del}} borrar · {{patches}} ajustes minutos',
                  create: pendingTxByGrupo[selectedGrupo]?.plsToCreate?.length || 0,
                  update: pendingTxByGrupo[selectedGrupo]?.plsToUpdate?.length || 0,
                  del: pendingTxByGrupo[selectedGrupo]?.plsToDelete?.length || 0,
                  patches: pendingTxByGrupo[selectedGrupo]?.pliPatches?.length || 0,
                })}
              </span>
            </div>
            <div className={styles.plBannerHint}>
              <span style={{ marginRight: 12, color: 'var(--text-muted)' }}>
                {t('scheduleEditor.pendingTxHint', {
                  defaultValue: 'Pulsa "Guardar" en el editor para confirmar, o descarta para revertir.',
                })}
              </span>
              <Button
                type="button"
                variant="secondary"
                disabled={applyingPendingTx || saving}
                onClick={() => discardPendingTxForGrupo(selectedGrupo)}
              >
                {t('scheduleEditor.pendingTxDiscard', { defaultValue: 'Descartar' })}
              </Button>
            </div>
          </div>
        )}

        {selectedGrupo && horasAnualesBanner && (
          <div className={`${styles.plBanner} ${styles[`plBanner_${horasAnualesBanner.tone}`]}`}>
            <div className={styles.plBannerStats}>
              <span className={styles.plBannerStat}>
                <span className={styles.plBannerStatLabel}>{t('scheduleEditor.horasBannerCurriculum', { defaultValue: 'Currículo' })}</span>
                <strong>{horasAnualesBanner.curriculumHoras}h</strong>
              </span>
              <span className={styles.plBannerArrow}>→</span>
              <span className={styles.plBannerStat}>
                <span className={styles.plBannerStatLabel}>{t('scheduleEditor.horasBannerPlanned', { defaultValue: 'Planificado' })}</span>
                <strong>{horasAnualesBanner.plannedHoras}h</strong>
              </span>
              <span className={styles.plBannerStat}>
                <span className={styles.plBannerStatLabel}>{t('scheduleEditor.horasBannerDiff', { defaultValue: 'Diferencia' })}</span>
                <strong>{horasAnualesBanner.diffSigned}h</strong>
              </span>
            </div>
            <div className={styles.plBannerHint}>
              {horasAnualesBanner.tone === 'ok' && horasAnualesBanner.diff > 0 && (
                <span><CheckCircle2 size={14} style={{ marginRight: 4 }} />
                  {t('scheduleEditor.horasBannerOverOk', {
                    defaultValue: 'Cumples el currículo con margen (+{{horas}}h anuales).',
                    horas: horasAnualesBanner.diff,
                  })}
                </span>
              )}
              {horasAnualesBanner.tone === 'ok' && horasAnualesBanner.diff <= 0 && (
                <span><CheckCircle2 size={14} style={{ marginRight: 4 }} />{t('scheduleEditor.horasBannerOk', { defaultValue: 'El plan cuadra con el currículo (±5h).' })}</span>
              )}
              {horasAnualesBanner.tone === 'warn' && (
                <span><AlertTriangle size={14} style={{ marginRight: 4 }} />
                  {t('scheduleEditor.horasBannerUnder', { defaultValue: 'Te faltan {{horas}}h anuales.', horas: Math.abs(horasAnualesBanner.diff) })}
                </span>
              )}
              {horasAnualesBanner.tone === 'error' && (
                <span><XCircle size={14} style={{ marginRight: 4 }} />
                  {t('scheduleEditor.horasBannerUnder', { defaultValue: 'Te faltan {{horas}}h anuales.', horas: Math.abs(horasAnualesBanner.diff) })}
                </span>
              )}
              <span className={styles.plBannerMeta}>
                {t('scheduleEditor.horasBannerHint', {
                  defaultValue: '{{plCount}} rangos · {{semanasTotal}} sem totales',
                  plCount: horasAnualesBanner.plCount,
                  semanasTotal: horasAnualesBanner.semanasTotal,
                })}
              </span>
              {extendCourseSuggestion && (
                <button
                  type="button"
                  className={styles.plBannerExtendBtn}
                  onClick={() => setExtendModalOpen(true)}
                  title={t('scheduleEditor.extendCourseTitle', { defaultValue: 'Extender el curso para cuadrar el currículo' })}
                >
                  <CalendarClock size={13} style={{ marginRight: 4 }} />
                  {t('scheduleEditor.extendCourseButton', {
                    defaultValue: 'Extender el curso {{days}} días',
                    days: extendCourseSuggestion.extraDays,
                  })}
                </button>
              )}
            </div>
          </div>
        )}

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
            {capacityByGrupo[stateKey] && (() => {
              const cap = capacityByGrupo[stateKey];
              const totalH = (cap.totalMinutos / 60).toFixed(2).replace(/\.?0+$/, '');
              const capH = (cap.capacidadMinutos / 60).toFixed(2).replace(/\.?0+$/, '');
              if (!cap.feasible) {
                // Fase 5 sub-C/truco recreos: la regla pasa a ser "rojo si no
                // cabe ANUALMENTE" (capacidad < currículo). Si anualmente cabe
                // pero hay sobrecarga semanal, hay dos sub-casos:
                //  · Las materias caben en la jornada presencial completa
                //    (slots + recreos) → verde-info: "cabe en jornada lectiva".
                //  · Las materias superan incluso jornada presencial → amarillo:
                //    redistribuir entre rangos o crear otro rango.
                const anualFits = capacityFeasibilityAnual?.fits ?? null;
                if (anualFits === true) {
                  // Capacidad curricular = slots + recreos × días (truco LOMLOE).
                  const capCurricularMin = cap.capacidadCurricularMinutos ?? cap.capacidadMinutos;
                  const cabeEnJornadaPresencial = cap.totalMinutos <= capCurricularMin;
                  if (cabeEnJornadaPresencial) {
                    const capCurricularH = (capCurricularMin / 60).toFixed(2).replace(/\.?0+$/, '');
                    const margenH = Math.round(((capCurricularMin - cap.totalMinutos) / 60) * 10) / 10;
                    return (
                      <div className={`${styles.capacityBanner} ${styles.capacityBannerGreen}`}>
                        <CheckCircle2 size={16} />
                        <div>
                          <b>{t('scheduleEditor.capacityRecreosCoverTitle', { defaultValue: 'Currículo dentro de la jornada lectiva' })}</b>
                          <div>
                            {t('scheduleEditor.capacityRecreosCoverBody', {
                              defaultValue: 'Las materias suman {{total}}h/sem dentro de la jornada lectiva de {{capCurricular}}h/sem (incluye recreos lectivos). Margen disponible: {{margenH}}h/sem.',
                              total: totalH,
                              capCurricular: capCurricularH,
                              margenH,
                            })}
                          </div>
                        </div>
                      </div>
                    );
                  }
                  return (
                    <div className={`${styles.capacityBanner} ${styles.capacityBannerYellow}`}>
                      <AlertTriangle size={16} />
                      <div>
                        <b>{t('scheduleEditor.capacityWeekOverloadTitle', { defaultValue: 'Sobrecarga semanal en este rango' })}</b>
                        <div>
                          {t('scheduleEditor.capacityWeekOverloadBody', {
                            defaultValue: 'En el rango activo las materias suman {{total}}h/sem pero la jornada cubre {{cap}}h/sem. El cómputo anual sí cabe ({{capacidadH}}h capacidad vs {{curriculumH}}h currículo); redistribuye minutos entre rangos desde Sliders o crea otro rango para repartir la carga.',
                            total: totalH,
                            cap: capH,
                            capacidadH: capacityFeasibilityAnual.capacidadH,
                            curriculumH: capacityFeasibilityAnual.curriculumH,
                          })}
                        </div>
                        {cap.huerfanos?.length > 0 && (
                          <ul className={styles.capacityList}>
                            {cap.huerfanos.map(h => (
                              <li key={h.impId}>{h.materia} ({h.horasRestantes}h sin cubrir)</li>
                            ))}
                          </ul>
                        )}
                      </div>
                    </div>
                  );
                }
                // Anual NO cabe: alarma real. CTA = extender curso o subir jornada.
                return (
                  <div className={`${styles.capacityBanner} ${styles.capacityBannerRed}`} role="alert">
                    <Ban size={16} />
                    <div>
                      <b>{t('scheduleEditor.capacityAnualInfeasibleTitle', { defaultValue: 'El currículo no cabe en el calendario actual' })}</b>
                      <div>
                        {t('scheduleEditor.capacityAnualInfeasibleBody', {
                          defaultValue: 'Currículo anual {{curriculumH}}h vs capacidad real {{capacidadH}}h ({{jornadaH}}h/sem × {{semanas}} sem). Faltan {{deficitH}}h físicas. Extiende el curso (botón en banner anual) o aumenta la jornada lectiva.',
                          curriculumH: capacityFeasibilityAnual?.curriculumH ?? '?',
                          capacidadH: capacityFeasibilityAnual?.capacidadH ?? '?',
                          jornadaH: capacityFeasibilityAnual?.jornadaSemanalH ?? '?',
                          semanas: capacityFeasibilityAnual?.semanasTotal ?? '?',
                          deficitH: capacityFeasibilityAnual?.deficitH ?? '?',
                        })}
                      </div>
                      {cap.huerfanos?.length > 0 && (
                        <ul className={styles.capacityList}>
                          {cap.huerfanos.map(h => (
                            <li key={h.impId}>{h.materia} ({h.horasRestantes}h sin cubrir)</li>
                          ))}
                        </ul>
                      )}
                    </div>
                  </div>
                );
              }
              if (cap.roundups?.length > 0) {
                return (
                  <div className={`${styles.capacityBanner} ${styles.capacityBannerYellow}`}>
                    <Sparkles size={16} />
                    <div>
                      <b>{t('scheduleEditor.capacityRoundupTitle', { defaultValue: 'Encaje con redondeo inevitable' })}</b>
                      <div>
                        {t('scheduleEditor.capacityRoundupBody', {
                          defaultValue: 'La jornada y las materias no cuadran exactos. Las siguientes materias se redondearán hacia arriba:',
                        })}
                      </div>
                      <ul className={styles.capacityList}>
                        {cap.roundups.map(r => (
                          <li key={r.impId}>{r.materia}: <b>+{r.deltaMin}min</b></li>
                        ))}
                      </ul>
                    </div>
                  </div>
                );
              }
              return (
                <div className={`${styles.capacityBanner} ${styles.capacityBannerGreen}`}>
                  <Sparkles size={16} />
                  <span>
                    {t('scheduleEditor.capacityExactBody', {
                      defaultValue: 'La jornada cubre exactamente las {{total}}h/sem del itinerario.',
                      total: totalH,
                    })}
                  </span>
                </div>
              );
            })()}
            <div className={styles.editorLayout}>
              <aside className={styles.modulesPanel}>
                <h3 className={styles.panelTitle}>{t('scheduleEditor.panelModules', { count: impsPresenciales.length })}</h3>
                {impsPresenciales.map(imp => (
                  <ModuleChip
                    key={imp.id}
                    imparticion={imp}
                    minutosTotales={minutosAnualesObjetivoByImp[imp.id] || 0}
                    minutosColocados={minutosAnualesColocadosByImp[imp.id] || 0}
                    color={colorForModule(imp.materia?.id || imp.id)}
                    selected={selectedImpId === imp.id}
                    onSelect={handleSelectModule}
                  />
                ))}
                <p style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)', marginTop: 'var(--space-3)' }}>
                  {t('scheduleEditor.panelHint')}
                </p>
                {/* Sub-panel "Otras horas curriculares" — Fase 4. Lista materias
                    no presenciales (FCT, NO_REGULAR, AUTONOMA) sin drag, solo
                    informativo. Cuenta al banner anual pero no ocupa slot. */}
                {impsNoPresenciales.length > 0 && (
                  <div className={styles.otrasHorasSection}>
                    <h4 className={styles.otrasHorasTitle}>
                      {t('scheduleEditor.panelOtrasHoras', {
                        count: impsNoPresenciales.length,
                        defaultValue: 'Otras horas curriculares ({{count}})',
                      })}
                    </h4>
                    <p className={styles.otrasHorasHint}>
                      {t('scheduleEditor.panelOtrasHorasHint', {
                        defaultValue: 'No ocupan slot de aula pero cuentan al currículo anual.',
                      })}
                    </p>
                    {impsNoPresenciales.map(imp => (
                      <OtrasHorasItem
                        key={imp.id}
                        imparticion={imp}
                        minutosSemanales={imp.materia?.minutosSemanales || 0}
                        modalidad={getEffectiveModalidad(imp)}
                        color={colorForModule(imp.materia?.id || imp.id)}
                        t={t}
                      />
                    ))}
                  </div>
                )}
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
                  {(() => {
                    const centroId = extractFkId(grupo?.centro);
                    const opciones = (centroId && jornadasByCentro[centroId]) || [];
                    const inheritedItinId = extractFkId(grupo?.itinerario?.jornadaTipo);
                    // Valor del selector: id efectivo (override si lo hay, sino el del itinerario).
                    const valor = String(resolveEffectiveJornadaId(grupo) || '');
                    const options = opciones.map(j => {
                      const turnoLabel = j.turno === 'tarde'
                        ? t('scheduleEditor.turnoAfternoon')
                        : t('scheduleEditor.turnoMorning');
                      const isInherited = String(j.id) === String(inheritedItinId || '');
                      const inheritedSuffix = isInherited
                        ? ` ${t('scheduleEditor.jornadaInheritedSuffix', { defaultValue: '(itinerario)' })}`
                        : '';
                      return {
                        value: String(j.id),
                        label: `${j.nombre} · ${turnoLabel}${inheritedSuffix}`,
                      };
                    });
                    return (
                      <span className={styles.infoBarSelect}>
                        <b>{t('scheduleEditor.jornada', { defaultValue: 'Jornada' })}:</b>
                        <ThemedSelect
                          value={valor}
                          onChange={handleJornadaOverrideChange}
                          options={options}
                          placeholder={t('scheduleEditor.jornadaPlaceholder', { defaultValue: '— Sin jornada —' })}
                          ariaLabel={t('scheduleEditor.jornada', { defaultValue: 'Jornada' })}
                          minWidth={220}
                          disabled={savingJornadaOverride || options.length === 0}
                          placement="top"
                        />
                      </span>
                    );
                  })()}
                  <span><b>{t('scheduleEditor.turno')}:</b> {turnoGrupo === 'M' ? t('scheduleEditor.turnoMorning') : t('scheduleEditor.turnoAfternoon')}</span>
                  <span><b>{t('scheduleEditor.classroom')}:</b> {grupo?.aulaDefault || (grupo?.abreviatura ? `Aula ${grupo.abreviatura}` : '—')}</span>
                  <div className={styles.infoBarActions}>
                    {(() => {
                      // Solver hard-blocked sólo si NI semanal NI anualmente cabe
                      // (caso rojo "currículo no cabe en el calendario"). Si la
                      // sobrecarga semanal es absorbible por recreos (banner verde
                      // "cubierto con recreos") o redistribuible (banner amarillo),
                      // el solver puede correr — colocará lo que cabe en slots y
                      // reportará huérfanos para que el admin decida.
                      const semanalNoCabe = capacityByGrupo[stateKey]?.feasible === false;
                      const anualNoCabe = capacityFeasibilityAnual?.fits === false;
                      const solverHardBlocked = semanalNoCabe && anualNoCabe;
                      const baseDisabled = !selectedGrupo || !grupoState || solving || saving;
                      const blockTitle = solverHardBlocked
                        ? t('scheduleEditor.capacityAnualInfeasibleTitle', { defaultValue: 'El currículo no cabe en el calendario actual' })
                        : undefined;
                      return (
                        <>
                          <Button
                            onClick={() => runSolver(null)}
                            disabled={baseDisabled || solverHardBlocked || solverAllRunning}
                            variant="secondary"
                            title={blockTitle}
                          >
                            <Sparkles size={14} style={{ marginRight: 4 }} />
                            {solving ? t('scheduleEditor.solving') : t('scheduleEditor.solverSuggest')}
                          </Button>
                          <Button
                            onClick={runSolverAllRangos}
                            disabled={baseDisabled || solverHardBlocked || solverAllRunning || (plByGrupo[selectedGrupo] || []).length === 0}
                            variant="secondary"
                            title={blockTitle || t('scheduleEditor.solverAllHint', { defaultValue: 'Ejecuta el solver en todos los rangos del curso, en orden cronológico' })}
                          >
                            <Layers size={14} style={{ marginRight: 4 }} />
                            {solverAllRunning
                              ? t('scheduleEditor.solverAllRunning', { defaultValue: 'Sugiriendo todo el curso…' })
                              : t('scheduleEditor.solverAll', { defaultValue: 'Sugerir todo el curso' })}
                          </Button>
                        </>
                      );
                    })()}
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

        {(solving || solverAllRunning || configuringOptimal) && (
          <div className={styles.solverOverlay} role="status" aria-live="polite">
            <div className={styles.solverOverlayInner}>
              <Lottie animationData={solverAnim} loop style={{ width: 220, height: 220 }} />
              <div className={styles.solverOverlayText}>
                {solverAllRunning && solverProgress
                  ? t('scheduleEditor.solverAllProgress', {
                      defaultValue: 'Sugiriendo rangos del curso… {{current}}/{{total}}',
                      current: solverProgress.current,
                      total: solverProgress.total,
                    })
                  : solverAllRunning
                    ? t('scheduleEditor.solverAllRunning', { defaultValue: 'Sugiriendo todo el curso…' })
                    : configuringOptimal
                      ? t('scheduleEditor.configuringOptimal', {
                          defaultValue: 'Configurando curso óptimo… {{step}}',
                          step: configuringStep || '',
                        })
                      : t('scheduleEditor.solving', { defaultValue: 'Sugiriendo horario…' })}
              </div>
              {solverAllRunning && solverProgress?.plName && (
                <div className={styles.solverOverlaySub}>{solverProgress.plName}</div>
              )}
            </div>
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
                  await performBatchSaveAllDirty();
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

        <ModalView
          isOpen={plPickerOpen}
          onClose={() => setPlPickerOpen(false)}
          title={plPickerMode === 'edit'
            ? t('scheduleEditor.editRangoTitle', { defaultValue: 'Editar rango lectivo' })
            : t('scheduleEditor.addRangoTitle', { defaultValue: 'Nuevo rango lectivo' })}
          onSubmit={handleSubmitPlForm}
          submitText={addingPl
            ? (plPickerMode === 'edit'
                ? t('scheduleEditor.editRangoSubmitting', { defaultValue: 'Guardando…' })
                : t('scheduleEditor.addRangoSubmitting', { defaultValue: 'Creando…' }))
            : (plPickerMode === 'edit'
                ? t('scheduleEditor.editRangoSubmit', { defaultValue: 'Guardar cambios' })
                : t('scheduleEditor.addRangoSubmit', { defaultValue: 'Crear rango' }))}
          cancelText={t('common.cancel', { defaultValue: 'Cancelar' })}
          isSubmitting={addingPl}
          size="small"
        >
          <div className={styles.plForm}>
            <label className={styles.plFormField}>
              <span>{t('scheduleEditor.rangoNombre', { defaultValue: 'Nombre' })}</span>
              <input
                type="text"
                value={plForm.nombre}
                onChange={(e) => setPlForm(prev => ({ ...prev, nombre: e.target.value }))}
                required
                autoFocus
                placeholder={t('scheduleEditor.rangoNombrePlaceholder', { defaultValue: 'Ej: Bloque FCT' })}
              />
            </label>
            <div className={styles.plFormRow}>
              <label className={styles.plFormField}>
                <span>{t('scheduleEditor.rangoFechaInicio', { defaultValue: 'Inicio' })}</span>
                <input
                  type="date"
                  value={plForm.fechaInicio}
                  onChange={(e) => setPlForm(prev => ({ ...prev, fechaInicio: e.target.value }))}
                  required
                />
              </label>
              <label className={styles.plFormField}>
                <span>{t('scheduleEditor.rangoFechaFin', { defaultValue: 'Fin' })}</span>
                <input
                  type="date"
                  value={plForm.fechaFin}
                  onChange={(e) => setPlForm(prev => ({ ...prev, fechaFin: e.target.value }))}
                  required
                />
              </label>
            </div>
            <label className={styles.plFormField}>
              <span>{t('scheduleEditor.rangoJornada', { defaultValue: 'Jornada (opcional)' })}</span>
              <ThemedSelect
                value={plForm.jornadaTipoId}
                onChange={(v) => setPlForm(prev => ({ ...prev, jornadaTipoId: v }))}
                options={[
                  { value: '', label: t('scheduleEditor.rangoJornadaInherit', { defaultValue: '— Heredar del grupo —' }) },
                  ...((extractFkId(grupo?.centro) && jornadasByCentro[extractFkId(grupo?.centro)]) || []).map(j => ({
                    value: String(j.id),
                    label: `${j.nombre} · ${j.turno === 'tarde' ? t('scheduleEditor.turnoAfternoon') : t('scheduleEditor.turnoMorning')}`,
                  })),
                ]}
                placeholder={t('scheduleEditor.rangoJornadaInherit', { defaultValue: '— Heredar del grupo —' })}
                ariaLabel={t('scheduleEditor.rangoJornada', { defaultValue: 'Jornada' })}
                minWidth={260}
              />
              <small className={styles.plFormHint}>
                {t('scheduleEditor.rangoJornadaHint', { defaultValue: 'Déjalo en blanco para usar la jornada del selector general del editor.' })}
              </small>
            </label>
          </div>
        </ModalView>

        {/* Modal "Materias del rango" — editor de PLI por rango (Fase 4) */}
        <ModalView
          isOpen={pliModalOpen}
          onClose={closePliModal}
          title={t('scheduleEditor.pliModalTitle', {
            defaultValue: 'Materias del rango "{{nombre}}"',
            nombre: (plByGrupo[selectedGrupo] || []).find(p => String(p.id) === String(pliModalPlId))?.nombre || '—',
          })}
          cancelText={t('common.close', { defaultValue: 'Cerrar' })}
          size="large"
        >
          {pliLoading ? (
            <div className={styles.pliLoading}>{t('scheduleEditor.pliLoading', { defaultValue: 'Cargando materias…' })}</div>
          ) : (
            <div className={styles.pliModalBody}>
              {pliModalSummary && (
                <div className={`${styles.pliSummary} ${pliModalSummary.fits === false ? styles.pliSummaryRed : (pliModalSummary.fits === true ? styles.pliSummaryGreen : '')}`}>
                  <div className={styles.pliSummaryStat}>
                    <span className={styles.pliSummaryLabel}>{t('scheduleEditor.pliSummaryPlanAnual', { defaultValue: 'Σ planificado en el rango' })}</span>
                    <strong>{pliModalSummary.planAnualH}h</strong>
                    <span className={styles.pliSummaryStatSub}>≈ {pliModalSummary.planH}h/sem</span>
                  </div>
                  <span className={styles.pliSummaryArrow}>vs</span>
                  <div className={styles.pliSummaryStat}>
                    <span className={styles.pliSummaryLabel}>{t('scheduleEditor.pliSummaryCapAnual', { defaultValue: 'Cap. del rango ({{semanas}} sem)', semanas: pliModalSummary.semanas })}</span>
                    <strong>{pliModalSummary.capAnualH}h</strong>
                    <span className={styles.pliSummaryStatSub}>= {pliModalSummary.capH}h/sem</span>
                  </div>
                  <span className={styles.pliSummaryHint}>
                    {pliModalSummary.fits === true && (
                      <><CheckCircle2 size={14} style={{ marginRight: 4 }} />{t('scheduleEditor.pliSummaryFits', { defaultValue: 'La semana cuadra.' })}</>
                    )}
                    {pliModalSummary.fits === false && (
                      <><Ban size={14} style={{ marginRight: 4 }} />{t('scheduleEditor.pliSummaryNoFit', { defaultValue: 'La semana no cabe — reduce horas o desactiva materias.' })}</>
                    )}
                  </span>
                </div>
              )}
              <div className={styles.pliTableWrapper}>
                <table className={styles.pliTable}>
                  <thead>
                    <tr>
                      <th className={styles.pliColActive}>{t('scheduleEditor.pliColActive', { defaultValue: 'Activa' })}</th>
                      <th>{t('scheduleEditor.pliColMateria', { defaultValue: 'Materia' })}</th>
                      <th>{t('scheduleEditor.pliColProfesor', { defaultValue: 'Profesor' })}</th>
                      <th className={styles.pliColMinutos}>
                        {t('scheduleEditor.pliColHorasAnuales', { defaultValue: 'Horas anuales (en este rango)' })}
                      </th>
                      <th className={styles.pliColReset}></th>
                    </tr>
                  </thead>
                  <tbody>
                    {pliModalRows.map(row => {
                      const saving = !!pliRowSaving[row.imp.id];
                      // Key compuesta: fuerza re-mount del input tras cada save para
                      // sincronizar defaultValue con el backend (uncontrolled pattern).
                      const inputKey = `${row.pli?.id || 'noPli'}_${row.pli?.minutosSemanales ?? 'null'}_${row.imp.id}_${pliModalSemanasRango}`;
                      return (
                        <tr key={row.imp.id} className={`${row.isActive ? '' : styles.pliRowInactive} ${saving ? styles.pliRowSaving : ''}`}>
                          <td className={styles.pliColActive}>
                            <label className={styles.pliCheckbox}>
                              <input
                                type="checkbox"
                                checked={row.isActive}
                                disabled={saving}
                                onChange={() => {
                                  if (row.isActive && row.pli) deactivatePli(row.pli);
                                  else activatePli(row.imp.id);
                                }}
                              />
                            </label>
                          </td>
                          <td>
                            <span className={styles.pliMateria}>
                              <span className={styles.pliMateriaDot} style={{ backgroundColor: colorForModule(row.imp.materia?.id || row.imp.id) }} />
                              {row.imp.materia?.nombre || '—'}
                              {(() => {
                                // Badge de modalidad cuando NO es presencial (las
                                // no presenciales aparecen aquí porque pueden ser
                                // activadas/desactivadas pero los minutos no
                                // tienen sentido editarlos por rango).
                                const mod = getEffectiveModalidad(row.imp);
                                if (mod === 'presencial') return null;
                                const labelKey = `modalidad.badge.${mod}`;
                                const label = t(labelKey, {
                                  defaultValue: mod === 'fct' ? 'FCT'
                                    : mod === 'no_regular' ? 'No regular'
                                    : mod === 'autonoma' ? 'Autónoma'
                                    : mod,
                                });
                                return (
                                  <span
                                    className={`${styles.modalidadBadge} ${styles[`modalidadBadge_${mod}`] || ''}`}
                                    style={{ marginLeft: 'var(--space-2)' }}
                                  >
                                    {label}
                                  </span>
                                );
                              })()}
                            </span>
                          </td>
                          <td className={styles.pliProfesor}>
                            {row.imp.profesor
                              ? `${row.imp.profesor.nombre || ''} ${row.imp.profesor.apellidos || ''}`.trim()
                              : '—'}
                          </td>
                          <td className={styles.pliColMinutos}>
                            <input
                              key={inputKey}
                              type="number"
                              min="0"
                              step="0.5"
                              className={styles.pliMinutosInput}
                              defaultValue={row.isOverride ? row.effectiveHorasAnualesRango : ''}
                              placeholder={row.defaultHorasAnualesRango > 0 ? String(row.defaultHorasAnualesRango) : '0'}
                              disabled={!row.isActive || saving || pliModalSemanasRango <= 0}
                              onBlur={(e) => {
                                if (!row.pli || pliModalSemanasRango <= 0) return;
                                const raw = e.target.value.trim();
                                if (raw === '') {
                                  if (row.isOverride) updatePliMinutos(row.pli, null);
                                  return;
                                }
                                const horas = parseFloat(raw.replace(',', '.'));
                                if (!Number.isFinite(horas) || horas < 0) return;
                                // Convertir a min/sem (BD trabaja en minutos semanales).
                                const minSem = Math.round(horas * 60 / pliModalSemanasRango);
                                const current = row.pli.minutosSemanales;
                                if (current === minSem) return;  // no-op si igual al guardado
                                if (current == null && minSem === row.defaultMin) return;  // no-op si igual al default
                                updatePliMinutos(row.pli, minSem);
                              }}
                            />
                            {row.isActive && (
                              <span className={styles.pliMinutosHint}>
                                {row.isOverride
                                  ? t('scheduleEditor.pliHorasOverrideHint', {
                                      defaultValue: '≈ {{minSem}} min/sem · default {{defH}}h',
                                      minSem: row.effectiveMin,
                                      defH: row.defaultHorasAnualesRango,
                                    })
                                  : t('scheduleEditor.pliHorasInheritedHint', {
                                      defaultValue: 'heredado · {{minSem}} min/sem media',
                                      minSem: row.effectiveMin,
                                    })}
                              </span>
                            )}
                          </td>
                          <td className={styles.pliColReset}>
                            {row.isOverride && (
                              <button
                                type="button"
                                className={styles.pliResetBtn}
                                disabled={saving}
                                onClick={() => updatePliMinutos(row.pli, null)}
                                aria-label={t('scheduleEditor.pliReset', { defaultValue: 'Volver al default' })}
                                title={t('scheduleEditor.pliReset', { defaultValue: 'Volver al default' })}
                              >
                                <RotateCcw size={13} />
                              </button>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                    {pliModalRows.length === 0 && (
                      <tr>
                        <td colSpan={5} className={styles.pliEmpty}>
                          {t('scheduleEditor.pliEmpty', { defaultValue: 'No hay imparticiones en este grupo. Crea primero la imparticion en /admin/imparticiones.' })}
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </ModalView>

        {/* Modal "Extender curso" — Fase 5 sub-B (D-J) */}
        <ModalView
          isOpen={extendModalOpen}
          onClose={() => setExtendModalOpen(false)}
          title={t('scheduleEditor.extendCourseModalTitle', { defaultValue: 'Extender el curso' })}
          size="medium"
          footer={
            <>
              <Button type="button" variant="secondary" onClick={() => setExtendModalOpen(false)} disabled={extendingCourse}>
                {t('common.cancel', { defaultValue: 'Cancelar' })}
              </Button>
              <Button type="button" onClick={handleConfirmExtendCourse} disabled={extendingCourse}>
                {extendingCourse
                  ? t('scheduleEditor.extendCourseSubmitting', { defaultValue: 'Aplicando…' })
                  : t('scheduleEditor.extendCourseSubmit', { defaultValue: 'Confirmar y aplicar' })}
              </Button>
            </>
          }
        >
          {extendCourseSuggestion && (
            <div className={styles.extendModalBody}>
              <p className={styles.extendModalIntro}>
                {t('scheduleEditor.extendCourseIntro', {
                  defaultValue: 'Te faltan {{horas}}h anuales para cumplir el currículo. Para cuadrar, hace falta extender el curso {{days}} días lectivos ({{semanas}} sem completas).',
                  horas: extendCourseSuggestion.faltanHoras,
                  days: extendCourseSuggestion.extraDays,
                  semanas: extendCourseSuggestion.extraSemanas,
                })}
              </p>
              <table className={styles.extendModalTable}>
                <thead>
                  <tr>
                    <th>{t('scheduleEditor.extendCourseColEntity', { defaultValue: 'Entidad' })}</th>
                    <th>{t('scheduleEditor.extendCourseColField', { defaultValue: 'Campo' })}</th>
                    <th>{t('scheduleEditor.extendCourseColBefore', { defaultValue: 'Antes' })}</th>
                    <th>{t('scheduleEditor.extendCourseColAfter', { defaultValue: 'Después' })}</th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td>{t('scheduleEditor.extendCourseRowPl', { defaultValue: 'Rango "{{nombre}}"', nombre: extendCourseSuggestion.lastPlNombre })}</td>
                    <td><code>fechaFin</code></td>
                    <td>{fmtDateEs(extendCourseSuggestion.oldLastPlFinISO)}</td>
                    <td><strong>{fmtDateEs(extendCourseSuggestion.newLastPlFinISO)}</strong></td>
                  </tr>
                  {extendCourseSuggestion.grupoNeedsPatch ? (
                    <tr>
                      <td>{t('scheduleEditor.extendCourseRowGroup', { defaultValue: 'Grupo "{{nombre}}"', nombre: grupo ? `${grupo.curso}º ${grupo.nombre}` : '—' })}</td>
                      <td><code>fechaFin</code></td>
                      <td>{fmtDateEs(extendCourseSuggestion.oldGrupoFinISO) || '—'}</td>
                      <td><strong>{fmtDateEs(extendCourseSuggestion.newGrupoFinISO)}</strong></td>
                    </tr>
                  ) : (
                    <tr>
                      <td colSpan={4} className={styles.extendModalNoChange}>
                        {t('scheduleEditor.extendCourseGrupoUnchanged', {
                          defaultValue: 'Grupo "{{nombre}}" — fechaFin ya es {{fecha}}, no necesita cambios.',
                          nombre: grupo ? `${grupo.curso}º ${grupo.nombre}` : '—',
                          fecha: fmtDateEs(extendCourseSuggestion.oldGrupoFinISO),
                        })}
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
              <div className={`${styles.extendModalPreview} ${styles[`extendModalPreview_${extendCourseSuggestion.newTone}`]}`}>
                <span className={styles.extendModalPreviewLabel}>
                  {t('scheduleEditor.extendCoursePreviewLabel', { defaultValue: 'Tras extender, el banner anual quedará en:' })}
                </span>
                <strong>{extendCourseSuggestion.newDiffSigned}h</strong>
                {extendCourseSuggestion.newTone === 'ok' && (
                  <span><CheckCircle2 size={14} style={{ marginLeft: 6 }} />{t('scheduleEditor.extendCoursePreviewOk', { defaultValue: 'Cumple el currículo' })}</span>
                )}
                {extendCourseSuggestion.newTone === 'warn' && (
                  <span><AlertTriangle size={14} style={{ marginLeft: 6 }} />{t('scheduleEditor.extendCoursePreviewWarn', { defaultValue: 'Aún faltan algunas horas — considera extender más' })}</span>
                )}
                {extendCourseSuggestion.newTone === 'error' && (
                  <span><XCircle size={14} style={{ marginLeft: 6 }} />{t('scheduleEditor.extendCoursePreviewError', { defaultValue: 'Sigue faltando bastante — revisa los rangos' })}</span>
                )}
              </div>
            </div>
          )}
        </ModalView>

        {/* Modal "Crear Rangos Recomendados" */}
        <ModalView
          isOpen={createRangosModalOpen}
          onClose={() => !creatingRangos && setCreateRangosModalOpen(false)}
          title={t('scheduleEditor.createRangosTitle', { defaultValue: 'Crear Rangos Recomendados' })}
          onSubmit={handleCreateRecommendedRangos}
          submitText={creatingRangos
            ? t('scheduleEditor.createRangosSubmitting', { defaultValue: 'Creando…' })
            : t('scheduleEditor.createRangosSubmit', { defaultValue: 'Crear y reemplazar' })}
          cancelText={t('common.cancel', { defaultValue: 'Cancelar' })}
          isSubmitting={creatingRangos}
          size="small"
        >
          <div className={styles.plForm}>
            <p style={{ margin: 0, lineHeight: 1.5 }}>
              {t('scheduleEditor.createRangosBody', {
                defaultValue: 'Esto borrará TODOS los rangos actuales del grupo y creará {{count}} rangos equiespaciados cubriendo {{semanas}} semanas (las necesarias para el currículo) desde {{ini}}. El resto del calendario queda libre para FCT, exámenes, etc. Los placements existentes se perderán.',
                count: Math.max(1, parseInt(createRangosCount, 10) || 0),
                semanas: semanasOptimas || '?',
                ini: fmtDateEs(grupo?.fechaInicio) || '?',
              })}
            </p>
            {semanasOptimas > 0 && (
              <small className={styles.plFormHint} style={{ display: 'block', marginTop: 'var(--space-2)' }}>
                {t('scheduleEditor.createRangosOptimalCalc', {
                  defaultValue: 'Cálculo: Σ horas totales anuales {{horasObj}}h ÷ slots colocables {{horasJornada}}h/sem = {{semanas}} sem',
                  horasObj: Math.round(imps.reduce((a, i) => {
                    if (!consumeAulaModalidad(getEffectiveModalidad(i))) return a;
                    const horasTot = i.materia?.horasTotales;
                    if (horasTot != null && horasTot > 0) return a + horasTot;
                    return a + (i.materia?.minutosSemanales || 0) * semanasReferenciaCentro / 60;
                  }, 0)),
                  horasJornada: Math.round(slotsSemanalMin / 60 * 10) / 10,
                  semanas: semanasOptimas,
                })}
              </small>
            )}
            <label className={styles.plFormField}>
              <span>{t('scheduleEditor.createRangosCountLabel', { defaultValue: 'Número de rangos' })}</span>
              <input
                type="number"
                min="1"
                max="36"
                step="1"
                value={createRangosCount}
                onChange={(e) => setCreateRangosCount(e.target.value)}
                disabled={creatingRangos}
                autoFocus
              />
              <small className={styles.plFormHint}>
                {t('scheduleEditor.createRangosCountHint', { defaultValue: 'Recomendado: 3 (trimestres) para cursos típicos. Más rangos = más control fino.' })}
              </small>
            </label>
          </div>
        </ModalView>
      </Container>
    </Wrapper>
  );
};

export default HorariosEditor;
