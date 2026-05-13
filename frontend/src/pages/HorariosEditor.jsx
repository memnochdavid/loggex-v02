import React, { useEffect, useLayoutEffect, useMemo, useState, useCallback, useRef } from 'react';
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
import NuevaExcepcionModal from '../components/NuevaExcepcionModal';
import AdjuntarGrupoModal from '../components/AdjuntarGrupoModal';
import { useAuth } from '../context/AuthContext';
import { useTranslation } from 'react-i18next';
import { CalendarClock, Save, CheckCircle2, AlertTriangle, XCircle, Ban, Sparkles, Download, Plus, Pencil, Trash2, Sliders, RotateCcw, Layers, Settings2, Eraser, CalendarDays, Copy } from 'lucide-react';
import { getApiUrl } from '../config/api';
import { downloadFileFromApi } from '../utils/downloadFile';
import { toast } from '../utils/toast';
import { formatGrupoNombre } from '../utils/grupo';
import { isPlantilla, isSemana, getSemanasOfPl, sortPlsForUi, selectActivePl, findPlantilla, labelForPl } from '../utils/pl-utils';
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
// También admite ISO 8601 con fecha base (p.ej. "1970-01-01T08:30:00+00:00"),
// que es como API Platform serializa por defecto los TIME_MUTABLE de Doctrine.
// Antes hacía split(':') ingenuo y convertía "1970-01-01T08" → parseInt = 1970,
// con lo que para items leídos crudos del API daba duración 0 (horaFin-horaInicio).
const parseHmsToMin = (hms) => {
  if (!hms) return 0;
  const m = String(hms).match(/(\d{1,2}):(\d{2})/);
  if (!m) return 0;
  return (parseInt(m[1], 10) || 0) * 60 + (parseInt(m[2], 10) || 0);
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
  // Antes done deshabilitaba drag y click. Eliminado (2026-05-05): el admin
  // debe poder añadir más bloques aunque la imp esté al 100% para cuadrar
  // casos reales (refuerzo, semana intensiva). El estilo `moduleChipDone`
  // sigue marcando visualmente la imp completa.
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id,
    data: { type: 'module', imparticionId: imparticion.id },
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

// ─── Item del panel "Otras horas curriculares" ────────────────────────
// Lista las materias no presenciales (FCT, NO_REGULAR, AUTONOMA). Por
// defecto NO arrastrable ni interactivo (cuentan al currículo anual pero
// no ocupan slots en los rangos lectivos). En rangos con
// `etiqueta='no_presenciales'` (Tercera evaluación de FP 2º) sí son
// arrastrables + tap-mode, para que el admin las ancle temporalmente al
// rango — la jornada del rango la define el centro vía "Editar PL"
// (típico: SLOT 08:30-15:30 + SLOT 18:00-20:00 para FCT + tutoría Proyecto).
//
// Apariencia idéntica a ModuleChip (Fase B fix 2026-05-12): mismo
// styles.moduleChip + dot + meta(nombre/profe) + counter. Sin badge de
// modalidad separado — el contador "h totales" ya diferencia respecto al
// "h/sem" de presenciales y el aspecto coherente facilita la lectura.
const OtrasHorasItem = ({ imparticion, minutosSemanales, color, t, draggable = false, minutosColocados = 0, selected = false, onSelect }) => {
  // Contador "colocadas/totales" coherente con ModuleChip:
  //   - Si hay horasTotales legales (LOMLOE — RD del título): "Nh/Yh totales".
  //   - Si no, fallback a "Nh/Yh/sem" usando minutosSemanales.
  //   - Si no hay ninguna: no se muestra contador.
  const horasTotalesLOMLOE = imparticion.materia?.horasTotales ?? null;
  const horasColocadas = minToHoras(minutosColocados);
  const counter = horasTotalesLOMLOE != null && horasTotalesLOMLOE > 0
    ? `${horasColocadas}/${horasTotalesLOMLOE}${t('scheduleEditor.hTotalSuffix', { defaultValue: 'h totales' })}`
    : minutosSemanales > 0
      ? `${horasColocadas}/${minToHoras(minutosSemanales)}${t('scheduleEditor.hWeekSuffix', { defaultValue: 'h/sem' })}`
      : null;
  // Hook siempre; aplicamos listeners solo si draggable.
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: `mod:${imparticion.id}`,
    data: { type: 'module', imparticionId: imparticion.id },
    disabled: !draggable,
  });
  // Detección "completo" para hint visual styles.moduleChipDone — paridad
  // con ModuleChip (cuando el objetivo anual está cubierto).
  const minutosTotalesObj = horasTotalesLOMLOE != null && horasTotalesLOMLOE > 0
    ? horasTotalesLOMLOE * 60
    : minutosSemanales > 0
      ? minutosSemanales * 36   // fallback LOMLOE estándar
      : 0;
  const done = minutosColocados >= minutosTotalesObj && minutosTotalesObj > 0;
  return (
    <div
      ref={draggable ? setNodeRef : undefined}
      className={`${styles.moduleChip}${isDragging ? ' ' + (styles.moduleChipDragging || '') : ''}${done ? ' ' + (styles.moduleChipDone || '') : ''}${selected ? ' ' + (styles.moduleChipSelected || '') : ''}${!draggable ? ' ' + (styles.moduleChipDisabled || '') : ''}`}
      style={!draggable ? { cursor: 'default', opacity: 0.85 } : undefined}
      {...(draggable ? listeners : {})}
      {...(draggable ? attributes : {})}
      onClick={draggable ? (e) => {
        e.stopPropagation();
        onSelect?.(imparticion.id);
      } : undefined}
      title={counter || undefined}
    >
      <span className={styles.moduleDot} style={{ backgroundColor: color }} />
      <div className={styles.moduleMeta}>
        <span className={styles.moduleName}>
          {imparticion.materia ? <MateriaLabel materia={imparticion.materia} /> : '—'}
        </span>
        <span className={styles.moduleProfe}>
          {imparticion.profesor ? `${imparticion.profesor.nombre || ''} ${imparticion.profesor.apellidos || ''}`.trim() : '—'}
        </span>
      </div>
      {counter !== null && (
        <span className={styles.moduleCounter}>{counter}</span>
      )}
    </div>
  );
};

// ─── Bloque dentro de un slot (draggable para eliminar al panel) ───────
const SlotBlock = ({ slotId, imparticion, color, aula, isContinuation = false }) => {
  const id = `slot:${slotId}`;
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id,
    data: { type: 'placed', slotId, imparticionId: imparticion.id },
    disabled: isContinuation,  // las continuaciones NO son drag handles
  });
  const profeFull = `${imparticion.profesor?.nombre || ''} ${imparticion.profesor?.apellidos || ''}`.trim() || '—';
  // Continuación = celda visualmente "tapada" por un bloque que empezó en
  // un slot anterior. Sin texto, sin border-top, mismo color de fondo →
  // ilusión de bloque continuo a través de varias filas de la rejilla.
  const cls = isContinuation
    ? `${styles.slotBlock} ${styles.slotBlockContinuation}`
    : styles.slotBlock;
  return (
    <div
      ref={setNodeRef}
      className={cls}
      style={{ backgroundColor: color, opacity: isDragging ? 0.4 : 1 }}
      {...(isContinuation ? {} : listeners)}
      {...(isContinuation ? {} : attributes)}
    >
      {!isContinuation && (
        <>
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
        </>
      )}
    </div>
  );
};

// ─── Celda droppable ───────────────────────────────────────────────────
const SlotCell = ({ dia, slot, content, dragActive, valid, tapMode, tapValid, onTap, onContextMenu, gridRowSpan = 1 }) => {
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
  const style = gridRowSpan > 1 ? { gridRow: `span ${gridRowSpan}` } : undefined;
  return (
    <div ref={setNodeRef} className={cls} style={style} onClick={onTap} onContextMenu={onContextMenu}>
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
  // Click derecho sobre placement persistido abre modal "Nueva excepción"
  // (Fase C.3 intercambio-imparticiones). Sólo se activa con placements que
  // tengan `hid` (Horario persistido en BD) — el modal POSTea contra él.
  const [exceptionTarget, setExceptionTarget] = useState(null);
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
  // modal con el estado base de BD. Las ediciones del modal NO tocan BD: se
  // acumulan en pendingTxByGrupo[gid].pliPatches / pliToggles y se aplican
  // tras Guardar (Tanda B parte 3, 2026-04-30).
  const [pliModalOpen, setPliModalOpen] = useState(false);
  const [pliModalPlId, setPliModalPlId] = useState(null);
  const [pliByPl, setPliByPl] = useState({});
  const [pliLoading, setPliLoading] = useState(false);
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
  // Ref al botón "Acciones del curso" + style calculado al abrir, para que el
  // menú flote con position: fixed sin contribuir al scroll de la página
  // (cuando había muchos items o el viewport era corto, el menú abs-positioned
  // empujaba el body y aparecía un scroll vertical no deseado).
  const cursoActionsBtnRef = useRef(null);
  const [cursoActionsMenuStyle, setCursoActionsMenuStyle] = useState(null);
  // Modal "Adjuntar a grupo existente" (Fase A clases-compartidas).
  const [adjuntarModalOpen, setAdjuntarModalOpen] = useState(false);
  useLayoutEffect(() => {
    if (!cursoActionsOpen) {
      setCursoActionsMenuStyle(null);
      return;
    }
    const reposition = () => {
      const el = cursoActionsBtnRef.current;
      if (!el) return;
      const r = el.getBoundingClientRect();
      const margin = 8;
      const top = r.bottom + 4;
      const right = Math.max(margin, window.innerWidth - r.right);
      const maxHeight = Math.max(160, window.innerHeight - top - margin);
      setCursoActionsMenuStyle({
        position: 'fixed',
        top: `${top}px`,
        right: `${right}px`,
        maxHeight: `${maxHeight}px`,
        overflowY: 'auto',
      });
    };
    reposition();
    window.addEventListener('resize', reposition);
    window.addEventListener('scroll', reposition, true);
    return () => {
      window.removeEventListener('resize', reposition);
      window.removeEventListener('scroll', reposition, true);
    };
  }, [cursoActionsOpen]);
  const [createRangosModalOpen, setCreateRangosModalOpen] = useState(false);
  const [createRangosCount, setCreateRangosCount] = useState(3);
  const [creatingRangos, setCreatingRangos] = useState(false);
  // Solver multi-rango: bandera para deshabilitar UI mientras corre el loop.
  const [solverAllRunning, setSolverAllRunning] = useState(false);
  // Progreso multi-rango para el overlay Lottie: { current, total, plName? }.
  const [solverProgress, setSolverProgress] = useState(null);
  // Modal "Informe del solver" (Fase 4 solver-iterativo, 2026-05-01): se abre
  // tras runSolverAllRangos cuando algún PL no completó. Incluye bottleneck
  // detectado, sugerencias accionables y log de pasadas para que el admin
  // entienda qué pasó y cómo arreglarlo.
  const [solverReportOpen, setSolverReportOpen] = useState(false);
  const [solverReportData, setSolverReportData] = useState(null);
  const [solverReportExpandedPl, setSolverReportExpandedPl] = useState(null);
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

  // 1.4) Refetch del grupo individual cuando cambia `selectedGrupo`. El GET
  //      colectivo /api/grupos del effect 1 puede traer state stale tras
  //      cambios externos (otra pestaña, /admin/grupos editado en paralelo)
  //      o no incluir todos los campos anidados refrescados (p.ej.
  //      `jornadaTipoOverride` cuando se cambió desde otra ventana). Sin esto,
  //      la rejilla puede mostrar la jornada del itinerario en lugar del
  //      override del grupo. Este fetch fuerza la verdad fresca de BD.
  useEffect(() => {
    if (!selectedGrupo) return;
    fetch(getApiUrl(`/api/grupos/${selectedGrupo}`),
      { headers: { 'Accept': 'application/ld+json' }, credentials: 'include' })
      .then(r => r.ok ? r.json() : null)
      .then(g => {
        if (!g) return;
        setGrupos(prev => {
          const exists = prev.some(x => String(x.id) === String(selectedGrupo));
          if (!exists) return [...prev, g];
          return prev.map(x => String(x.id) === String(selectedGrupo) ? { ...x, ...g } : x);
        });
      })
      .catch(err => console.warn('Error refetch grupo individual:', err));
  }, [selectedGrupo]);

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
      // Guard `key in jornadasPorId`: si ya marcamos esta itinerario.id con
      // null en una pasada anterior, NO reset — un nuevo objeto causaría que
      // jornadasPorId cambie por referencia y este mismo effect (que la lleva
      // en deps) se re-disparase indefinidamente. Maximum update depth.
      const itinId = extractFkId(grupoActual.itinerario);
      const itinKey = itinId ? `itin:${itinId}` : null;
      if (itinKey && !(itinKey in jornadasPorId)) {
        setJornadasPorId(prev => ({ ...prev, [itinKey]: null }));
      }
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
        const items = sortPlsForUi(d['hydra:member'] || d.member || []);
        setPlByGrupo(prev => ({ ...prev, [selectedGrupo]: items }));
        // Selección por defecto: SEMANA que cubre hoy si la hay,
        // sino la PLANTILLA del grupo (modelo semanal post-2026-05-06).
        if (!selectedPlByGrupo[selectedGrupo] && items.length > 0) {
          const active = selectActivePl(items) || items[0];
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
          // Fase B FP 2º (2026-05-12): skip si la imparticion es NO presencial
          // (FCT, NO_REGULAR, AUTONOMA). El profe tutor de FCT no está
          // físicamente con el alumno en empresa, así que no genera colisión
          // de paralelos. Igual aplica para Proyecto/HLC: tutorías no
          // presenciales no acaparan al profe a esa hora. Defensa con `??`
          // hacia 'presencial' si modalidad no llega serializada (legacy).
          const impMod = h.imparticion?.modalidad ?? h.imparticion?.materia?.modalidad ?? 'presencial';
          if (impMod !== 'presencial') return;
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
          // Fase B FP 2º (2026-05-12): skip imparticiones no presenciales
          // (FCT/Proyecto/HLC). El profe tutor no está físicamente
          // impartiendo a esa hora; sus horas no presenciales NO suman
          // carga semanal real para el panel `ProfLoadPanel`.
          const impMod = h.imparticion?.modalidad ?? h.imparticion?.materia?.modalidad ?? 'presencial';
          if (impMod !== 'presencial') return;
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

  // Días lectivos de la semana según la jornada (1=lun…7=dom). El backend
  // `JornadaTipo.diasLectivos` viene serializado como JSON `int[]` (default
  // `[1,2,3,4,5]`). Lo usamos como multiplicador en todos los cálculos
  // semanales — antes había `* 5` hardcoded en varios sitios, lo que rompe
  // en centros con jornada de 4 días (FCT) o sábados lectivos.
  const diasLectivosCount = useMemo(() => {
    const d = jornadaActual?.diasLectivos;
    return Array.isArray(d) && d.length > 0 ? d.length : 5;
  }, [jornadaActual]);

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
  // SLOT + RECREO × diasLectivos. Razón: en muchos centros (LOMLOE FP típicamente)
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
    return total * diasLectivosCount;
  }, [tramosOrdenados, diasLectivosCount]);

  // Recreos para renderizar como bloques no asignables en la rejilla.
  const recreosDia = useMemo(
    () => tramosOrdenados.filter(t => t.tipo === 'recreo'),
    [tramosOrdenados],
  );

  // Etiqueta del turno (informativa, viene de la jornada). Sin jornada, queda en blanco.
  const turnoGrupo = jornadaActual?.turno === 'tarde' ? 'T'
    : jornadaActual?.turno === 'especial' ? 'E'
    : 'M';

  // Helper: duración real de un placement. Con el solver de bloques (2026-05-01),
  // un placement puede abarcar N slots de 30min (bloques de 60-120min). La
  // duración correcta es `horaFin - horaInicio` del placement, NO la del slot
  // inicio. Si no hay horaFin (caso legacy), fallback a la duración del slot.
  const getPlacementDur = (p) => {
    if (!p) return 0;
    if (p.horaFin && p.horaInicio) {
      return Math.max(0, parseHmsToMin(p.horaFin) - parseHmsToMin(p.horaInicio));
    }
    return slotMinutosByHi[p.horaInicio] || 0;
  };

  // Minutos colocados por imparticion (suma duración real de los placements).
  // OJO: este es SEMANAL del PL activo (lo usan solver/CapacityPlanner). Para
  // el chip lateral usamos `minutosAnualesColocadosByImp` (Fase 5 sub-A).
  const minutosColocados = useMemo(() => {
    const m = {};
    Object.values(placements).forEach(p => {
      const dur = getPlacementDur(p);
      m[p.imparticionId] = (m[p.imparticionId] || 0) + dur;
    });
    return m;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [placements, slotMinutosByHi]);

  // Semanas lectivas de referencia del centro (calendario real con festivos
  // descontados, fallback 36 LOMLOE). Se usa como duración default de
  // PeriodoLectivo tipo PLANTILLA en el modelo semanal — definida arriba para
  // que `semanasByPlId` y otros memos puedan consumirla sin TDZ.
  const semanasReferenciaCentro = useMemo(() => {
    if (!selectedGrupo) return 36;
    const grupo = grupos.find(g => String(g.id) === String(selectedGrupo));
    const centroId = grupo ? extractFkId(grupo.centro) : null;
    const r = centroId ? semanasLectivasByCentro[centroId] : null;
    return (r && r.semanas != null && r.semanas > 0) ? r.semanas : 36;
  }, [selectedGrupo, grupos, semanasLectivasByCentro]);

  // Semanas por PL del grupo (lookup table) — usado por los memos anuales.
  // Modelo semanal (post-2026-05-06):
  //   - PLANTILLA → semanas lectivas del centro (CalendarioLectivoService).
  //   - SEMANA → `(fechaFin - fechaInicio + 1) / 7` (~1.0 en la mayoría).
  // El `semanasReferenciaCentro` ya cae a 36 LOMLOE si no hay calendario real.
  const semanasByPlId = useMemo(() => {
    const m = {};
    (plByGrupo[selectedGrupo] || []).forEach(pl => {
      m[pl.id] = getSemanasOfPl(pl, semanasReferenciaCentro);
    });
    return m;
  }, [plByGrupo, selectedGrupo, semanasReferenciaCentro]);

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
        // State local (sin guardar incluido). Duración real del placement
        // (puede ser bloque 60-120min, no solo slot 30min).
        Object.values(localState.placements).forEach(p => {
          const dur = getPlacementDur(p);
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedGrupo, plByGrupo, allHorariosByGroup, semanasByPlId, state, slotMinutosByHi]);

  // Objetivo anual por imparticion (Opción A 2026-04-29): usa
  // `materia.horasTotales × 60` que es la "ley LOMLOE" (RD del título).
  // Fallback a `min/sem × semanasReferenciaCentro` solo si horasTotales no
  // está set (caso edge). Antes el sistema asumía calendario rígido de 36
  // sem; ahora (Fase 7) lo lee del calendario real del centro descontando
  // festivos. Si el centro no tiene ni overrides ni CalendarioEscolarCcaa
  // disponible, cae a 36 LOMLOE. (Definición de `semanasReferenciaCentro`
  // movida arriba para evitar TDZ con `semanasByPlId` post-refactor semanal.)
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

  // Nota (2026-05-11): el badge muestra SIEMPRE cifras semanales del PL
  // activo. El target visual = `slotsCapacityWeekly` (= duración total de
  // slots SLOT × días lectivos de la jornada). La etiqueta del estado
  // ("Completo"/"Borrador"/"Incompleto") la decide la cobertura anual cross-
  // rango per materia (`allAnualCubierto`), independiente de las cifras
  // semanales del badge. Antes derivábamos un target "ideal weekly" desde
  // las horas anuales / semanas referencia, pero daba cifras menores que
  // la jornada (caso 2º DAW: 18.7h con jornada 27.5h), confundiendo al
  // admin: "mi jornada es 30h, ¿por qué me pides 18.7?". Mucho más simple:
  // el badge mide cuánto has llenado de tu jornada semanal.

  // Capacidad SOLO de slots colocables por semana (sin recreos). Necesario
  // para semanasOptimas: el solver físicamente solo coloca placements en
  // slots, no en recreos. Las horas a impartir deben caber en slots reales.
  const slotsSemanalMin = useMemo(() => {
    let total = 0;
    tramosOrdenados.forEach(t => {
      if (t.tipo !== 'slot') return;
      total += Math.max(0, parseHmsToMin(t.horaFin) - parseHmsToMin(t.horaInicio));
    });
    return total * diasLectivosCount;
  }, [tramosOrdenados, diasLectivosCount]);

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
    (a, p) => a + getPlacementDur(p), 0
  );
  // Target visual del badge: la jornada del centro en minutos colocables
  // (slots × días lectivos). No depende del grupo ni del curso — la jornada
  // es la misma para 1º y 2º (8:30-14:30 mañanas o 15:00-21:00 tardes en
  // EAG, etc.). Antes intentábamos derivarlo de las cuotas anuales/semanas
  // del grupo (caso 2º DAW: target 18.7h con jornada 27.5h), lo cual
  // confundía al admin sin aportar nada útil.
  const slotsCapacityWeekly = Object.values(slotMinutosByHi).reduce((a, b) => a + b, 0) * diasLectivosCount;
  const targetMinutos = slotsCapacityWeekly;
  const totalHoras = minToHoras(targetMinutos);
  const colocadasTotal = minToHoras(colocadosMinutos);
  const completitud = targetMinutos ? (colocadosMinutos / targetMinutos) * 100 : 0;
  // Estado del badge se decide por COBERTURA ANUAL cross-rango: complete si
  // TODAS las materias del grupo están a ≤1.5h por debajo de su objetivo
  // curricular (LOMLOE 36 sem). El cap del solver puede dejar slots vacíos en
  // el rango activo cuando otros rangos ya cubrieron — eso no es "incompleto",
  // es el comportamiento correcto del modelo cross-rango.
  // `allAnualCubierto` decide si el grupo está "completo" anualmente. Sólo
  // imps presenciales pueden cubrirse colocando placements en slots; las
  // imps no presenciales (FCT/NO_REGULAR/AUTONOMA) tienen `placed=0` por
  // naturaleza (no van a la rejilla), así que SU `target > 0` haría fallar
  // siempre el check y el badge nunca llegaría a "Completo" en grupos con
  // FCT/Proyecto/Libre — caso típico de FP 2º.
  // Filtramos igual que `curriculumMin` y `totalMinutos` (modificados
  // 2026-05-11 por la misma razón).
  //
  // Tolerancia per-materia alineada con backend `CurriculumDistributor.php:269`
  // → `max(60min, 5% del target)`. La versión antigua usaba 90min absolutos
  // (~0.5% sobre un módulo de 125h) — más estricta que el propio distribuidor
  // que declara la distribución `feasible`. Resultado: el distribuidor decía
  // "OK", el bin-packing colocaba cuotas con overshoot natural del orden 5%
  // por materia, y el badge frontend marcaba "Borrador" indefinidamente
  // porque alguna materia caía 100-400 min por debajo del strict 90min.
  // Reutilizamos `impsPresenciales` declarado arriba (línea 825).
  const allAnualCubierto = impsPresenciales.length > 0 && impsPresenciales.every(imp => {
    const target = minutosAnualesObjetivoByImp[imp.id] || 0;
    if (target <= 0) return true;
    const placed = minutosAnualesColocadosByImp[imp.id] || 0;
    const tol = Math.max(60, Math.round(target * 0.05));
    return placed >= target - tol;
  });
  const estado =
    allAnualCubierto ? 'complete' :
    completitud >= 80 ? 'draft' : 'incomplete';

  // El badge muestra SIEMPRE las cifras semanales del PL activo. Antes había
  // un fallback a cifras anuales cuando estado=complete y la jornada estaba
  // parcial, pero confundía más que ayudaba (mezclar h/sem y h-año en el
  // mismo badge según el contexto). La etiqueta "Completo" basta para
  // comunicar que el grupo está cubierto anualmente; las h/sem siempre se
  // refieren al PL activo.
  const labelDone = colocadasTotal;
  const labelTotal = totalHoras;

  const estadoBadge = {
    complete:   {
      cls: styles.statusComplete,
      icon: <CheckCircle2 size={16} />,
      label: t(
        'scheduleEditor.statusComplete',
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

    // Currículo PRESENCIAL anual (Opción A 2026-04-29 + filtro modalidad
    // 2026-05-11): Σ horas totales anuales × 60 (ley LOMLOE) SÓLO de imps
    // que consumen aula (modalidad `presencial`). FCT, NO_REGULAR y AUTONOMA
    // se entregan fuera del horario semanal (empresa, bloques concentrados,
    // trabajo autónomo del alumno) y aparecen en el panel "OTRAS HORAS
    // CURRICULARES" — no son comparables con `plannedMin`, que solamente
    // suma cuotas `pli.minutosSemanales` (= cuotas en slots).
    // Sin este filtro, en grupos con FCT/no_regular significativo (típico
    // de FP 2º) el banner reportaba diferencias enormes (caso 2º DAW EAG:
    // "−562h" cuando en realidad la planificación cubría el presencial con
    // +18h de margen — los 562h "faltantes" eran FCT 400 + Libre 108 +
    // Proyecto 72, todos no presenciales que no van a slots).
    // Fallback a min/sem × semanasReferencia si la materia no tiene horasTotales.
    const curriculumMin = imps.reduce((acc, i) => {
      if (!consumeAulaModalidad(getEffectiveModalidad(i))) return acc;
      const horasTot = i.materia?.horasTotales;
      if (horasTot != null && horasTot > 0) return acc + horasTot * 60;
      return acc + (i.materia?.minutosSemanales || 0) * semanasReferencia;
    }, 0);

    // Cap semanal "lectivo curricular" (slots + recreos × diasLectivos). Asumimos
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
    // pendingTx para PLs virtuales (Configurar curso óptimo): los virtuales
    // no tienen pl.imparticiones (no persistidas en BD), pero sus cuotas
    // viven en pendingTx.pliPatches + pliToggles del grupo. Sin esto el
    // banner reportaba "Planificado: 0h" para todo PL virtual.
    const tx = pendingTxByGrupo[selectedGrupo] || {};
    pls.forEach(pl => {
      if (!pl.fechaInicio || !pl.fechaFin) return;
      const ini = new Date(pl.fechaInicio.slice(0, 10));
      const fin = new Date(pl.fechaFin.slice(0, 10));
      const days = Math.max(0, Math.round((fin - ini) / 86400000) + 1);
      const semanas = days / 7;
      semanasTotal += semanas;

      let sumPliMin = 0;
      const isVirtualPl = Number(pl.id) < 0;
      if (isVirtualPl) {
        // PL virtual: base = todas las imps del grupo activas con minutos
        // heredados. Apply toggles ('deactivate' excluye) y patches (override
        // minutosSemanales) del pendingTx para este plKey.
        const togglesByImp = {};
        (tx.pliToggles || []).forEach(p => {
          if (String(p.plKey) === String(pl.id)) togglesByImp[String(p.imparticionId)] = p.action;
        });
        const patchesByImp = {};
        (tx.pliPatches || []).forEach(p => {
          if (String(p.plKey) === String(pl.id)) patchesByImp[String(p.imparticionId)] = p.minutosSemanales;
        });
        imps.forEach(imp => {
          const tog = togglesByImp[String(imp.id)];
          const isActive = tog ? tog === 'activate' : true;  // default activo
          if (!isActive) return;
          const patch = patchesByImp[String(imp.id)];
          const min = (patch !== undefined && patch !== null) ? patch : (imp.materia?.minutosSemanales || 0);
          sumPliMin += min;
        });
      } else {
        // PL real: usa pl.imparticiones de BD.
        const plis = pl.imparticiones || [];
        sumPliMin = plis.reduce((acc, pli) => {
          if (pli.deleted) return acc;
          const overrideMin = pli.minutosSemanales;
          if (overrideMin != null) return acc + overrideMin;
          const impId = extractFkId(pli.imparticion);
          const imp = impById[impId];
          return acc + (imp?.materia?.minutosSemanales || 0);
        }, 0);
      }

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
    // plCount: si hay SEMANAs vivas, contar solo SEMANAs (la PLANTILLA queda
    // oculta del strip y no debería contarse aquí — coherencia con la UI).
    // Si solo hay PLANTILLA, plCount = 1.
    const haySemanas = pls.some(p => isSemana(p));
    const plCountVisible = haySemanas
      ? pls.filter(p => isSemana(p)).length
      : pls.length;
    return {
      curriculumHoras,
      plannedHoras,
      diff,
      diffSigned,
      tone,
      plCount: plCountVisible,
      semanasTotal: Math.round(semanasTotal * 10) / 10,
    };
  }, [selectedGrupo, plByGrupo, imps, impById, jornadaSemanalLectivaMin, pendingTxByGrupo]);

  // Sugerencia de extensión de curso (Fase 5 sub-B): cuando el banner anual
  // muestra que faltan horas (tone warn/error), calcula cuántos días lectivos
  // habría que extender el curso para que el banner pase a verde. El cálculo:
  //   - jornadaSemanal = jornadaSemanalLectivaMin (slots + recreos × diasLectivos,
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
    // Fase A FP 2º: excluir PLs con etiqueta='no_presenciales' (Tercera
    // evaluación) del cómputo de capacidad — son contenedores de FCT/
    // Proyecto/HLC sin slots de aula. Si los sumáramos, el banner anual
    // reportaría 3 meses extra de capacidad presencial que no existe.
    const plsParaCap = (plByGrupo[selectedGrupo] || []).filter(pl => pl.etiqueta !== 'no_presenciales');
    const semanasTotal = plsParaCap.reduce((acc, pl) => acc + (semanasByPlId[pl.id] || 0), 0);
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

  // Semanas del PL activo en el modal (Fase 5 sub-A): se usa para convertir
  // entre min/sem ↔ horas anuales. Modelo semanal:
  //   - PLANTILLA → semanas lectivas del centro (D-default del curso).
  //   - SEMANA → ~1.0 (la duración del rango de la semana específica).
  const pliModalSemanasRango = useMemo(() => {
    if (!pliModalPlId) return 0;
    const pl = (plByGrupo[selectedGrupo] || []).find(p => String(p.id) === String(pliModalPlId));
    return getSemanasOfPl(pl, semanasReferenciaCentro);
  }, [pliModalPlId, plByGrupo, selectedGrupo, semanasReferenciaCentro]);

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
    const plKey = pliModalPlId;
    const isVirtualPl = Number(plKey) < 0;
    // Estado base por imp:
    //   - PL real: lo que está en pliByPl (cargado de BD).
    //   - PL virtual: todas las imps activas con minutos heredados (lo que
    //     PeriodoLectivoCreateProcessor del backend creará al persistir).
    const basePlis = isVirtualPl ? [] : (pliByPl[plKey] || []);
    const basePliByImpId = {};
    basePlis.forEach(pli => {
      const impId = extractFkId(pli.imparticion);
      if (impId) basePliByImpId[String(impId)] = pli;
    });
    // Overlay de pendingTx: toggles primero (cambian isActive), luego patches
    // (cambian minutos efectivos). Solo aplican al plKey en cuestión.
    const tx = pendingTxByGrupo[selectedGrupo] || {};
    const togglesByImp = {};
    (tx.pliToggles || []).forEach(p => {
      if (String(p.plKey) === String(plKey)) togglesByImp[String(p.imparticionId)] = p.action;
    });
    const patchesByImp = {};
    (tx.pliPatches || []).forEach(p => {
      if (String(p.plKey) === String(plKey)) patchesByImp[String(p.imparticionId)] = p.minutosSemanales;
    });
    const semanas = pliModalSemanasRango || 0;
    const minToHorasRango = (m) => semanas > 0 ? Math.round((m * semanas / 60) * 10) / 10 : 0;
    return imps.map(imp => {
      const basePli = basePliByImpId[String(imp.id)] || null;
      const baseActive = isVirtualPl ? true : !!basePli;
      const toggle = togglesByImp[String(imp.id)];
      const isActive = toggle ? toggle === 'activate' : baseActive;
      const defaultMin = imp.materia?.minutosSemanales || 0;
      // Minutos efectivos: patch overrides base. null = heredar del default.
      const hasPatch = Object.prototype.hasOwnProperty.call(patchesByImp, String(imp.id));
      const baseOverrideMin = basePli?.minutosSemanales != null ? basePli.minutosSemanales : null;
      const overrideMin = hasPatch ? patchesByImp[String(imp.id)] : baseOverrideMin;
      const isOverride = isActive && overrideMin != null;
      const effectiveMin = isActive ? (overrideMin != null ? overrideMin : defaultMin) : 0;
      return {
        imp,
        pli: basePli,
        isActive,
        isOverride,
        effectiveMin,
        defaultMin,
        effectiveHorasAnualesRango: minToHorasRango(effectiveMin),
        defaultHorasAnualesRango: minToHorasRango(defaultMin),
      };
    });
  }, [pliModalPlId, pliByPl, imps, pliModalSemanasRango, pendingTxByGrupo, selectedGrupo]);

  const pliModalSummary = useMemo(() => {
    if (!pliModalPlId) return null;
    // Σ semanal del rango: con qué peso semanal está el rango planificado.
    const planMin = pliModalRows.reduce((acc, r) => acc + (r.isActive ? r.effectiveMin : 0), 0);
    // Cap semanal de la jornada del rango: Σ slot durations × días lectivos
    // de la jornada (default 5, configurable vía `JornadaTipo.diasLectivos`).
    const slotsMin = Object.values(slotMinutosByHi).reduce((a, b) => a + b, 0);
    const capMin = slotsMin * diasLectivosCount;
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
  }, [pliModalPlId, pliModalRows, slotMinutosByHi, pliModalSemanasRango, diasLectivosCount]);

  // Carga semanal por profesor del grupo actual (live: otros grupos + placements actuales).
  // Trabajamos en minutos internamente y exponemos horas decimales al panel
  // (ProfLoadPanel sigue comparando contra `max=40` en horas).
  const profeCarga = useMemo(() => {
    const currentMinPerProf = {};
    Object.values(placements).forEach(p => {
      const imp = impById[p.imparticionId];
      const pid = imp?.profesor?.id;
      if (!pid) return;
      // Fase B FP 2º (2026-05-12): skip placements no presenciales (FCT/
      // Proyecto/HLC). El profe tutor no está físicamente con el alumno
      // — sus horas no presenciales NO suman a la carga real del panel.
      if (!consumeAulaModalidad(getEffectiveModalidad(imp))) return;
      const dur = getPlacementDur(p);
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

    // Antes había una regla "módulo lleno" que bloqueaba colocar si la imp
    // ya tenía su currículo anual cubierto. Eliminada (2026-05-05): el solver
    // automático respeta el currículo, pero el admin debe poder cuadrar
    // manualmente con overshoot cuando el caso real lo requiere (ej. clase
    // de refuerzo, semana intensiva). El chip lateral muestra X/Y horas y
    // colorea overshoot — feedback suficiente sin bloquear.
    if (drag.type === 'module') {
      // Regla extra: la celda debe estar vacía. Con bloques de 60-120min
      // (granularidad 30min), un slot puede estar cubierto por un placement
      // que arrancó en un slot anterior — comprobamos también ese caso.
      const horaInicioStr = slotsDia[slotIdx][0];
      const covered = (() => {
        for (const [k, p] of Object.entries(placements)) {
          const sep = k.indexOf('_');
          if (sep <= 0) continue;
          if (Number(k.slice(0, sep)) !== diaIdx) continue;
          const pHi = k.slice(sep + 1);
          if (pHi <= horaInicioStr && (p.horaFin || '') > horaInicioStr) return true;
        }
        return false;
      })();
      if (covered) {
        return { ok: false, reason: t('scheduleEditor.reasonCellOccupied') };
      }
    }

    // Regla 2: profesor ocupado en grupo paralelo.
    // Fase B FP 2º (2026-05-12): si la imp arrastrada NO es presencial
    // (FCT/Proyecto/HLC), el profe-tutor NO está físicamente impartiendo,
    // así que da igual que tenga clase regular en otro grupo a esa hora.
    // No hay colisión real. Skip del chequeo.
    const impMod = getEffectiveModalidad(imp);
    if (consumeAulaModalidad(impMod)) {
      const profId = imp.profesor?.id;
      if (profId && parallelBusy[key]?.has(Number(profId))) {
        const teacher = `${imp.profesor?.nombre || ''} ${imp.profesor?.apellidos || ''}`.trim();
        return { ok: false, reason: t('scheduleEditor.reasonTeacherBusy', { teacher }) };
      }
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
      // Fase D: el subscriber del backend propagó los cambios a los gemelos
      // de otros grupos. El editor está excluido del sistema live updates,
      // así que invalidamos las caches de esos grupos para que al cambiar
      // a uno hermano en el strip se refetche desde BD en lugar de servir
      // cache local. Doc: hoja-de-ruta-clases-compartidas.md Fase D.
      invalidateCachesForGroups(data.affectedGroups || []);
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
      // Modelo semanal: el draft trae `tipo` ('plantilla' | 'semana') desde
      // handleSubmitPlForm. PLANTILLA omite fechas; SEMANA las envía y enlaza
      // su plantillaBase. El backend processor también defaultea por presencia
      // de fecha si tipo viniera ausente.
      const body = {
        grupo: `/api/grupos/${gid}`,
        nombre: draft.nombre,
        orden: draft.orden ?? 0,
      };
      if (draft.tipo) body.tipo = draft.tipo;
      if (draft.tipo !== 'plantilla' && draft.fechaInicio) body.fechaInicio = draft.fechaInicio;
      if (draft.tipo !== 'plantilla' && draft.fechaFin) body.fechaFin = draft.fechaFin;
      if (draft.plantillaBase) body.plantillaBase = draft.plantillaBase;
      if (draft.semanaNumero != null) body.semanaNumero = draft.semanaNumero;
      if (draft.jornadaTipoId) body.jornadaTipo = `/api/jornada_tipos/${draft.jornadaTipoId}`;
      // Etiqueta semántica del planner (Fase A FP 2º): persistir para que
      // el solver/distribuidor la respete al recargar el editor.
      if (draft.etiqueta) body.etiqueta = draft.etiqueta;
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

    // 3.b PROCESAR pliToggles (activar/desactivar imparticiones por rango).
    //     'deactivate' → DELETE PLI si existe; 'activate' → POST PLI si no
    //     existe. Para PL virtual recién creado, el processor del backend ya
    //     ha auto-creado los PLIs de TODAS las imps del grupo, así que
    //     'activate' será no-op (ya existe) y 'deactivate' los borra.
    //     Tras procesar, refetch de PLIs por (PL real) afectado para que el
    //     paso 4 tenga ids actualizados.
    const togglesAndPatchesPlKeys = new Set([
      ...(tx.pliToggles || []).map(p => Number(tempIdToRealId[p.plKey] ?? p.plKey)),
      ...(tx.pliPatches || []).map(p => Number(tempIdToRealId[p.plKey] ?? p.plKey)),
    ].filter(Boolean));
    const pliByPlRealCache = {};
    const refetchPlisFor = async (realPlId) => {
      const r = await fetch(getApiUrl(`/api/periodo_lectivo_imparticions?periodoLectivo=${realPlId}&pagination=false`), {
        headers: { 'Accept': 'application/ld+json' }, credentials: 'include',
      });
      if (!r.ok) return null;
      const dd = await r.json();
      const items = dd['hydra:member'] || dd.member || [];
      const mapByImp = {};
      items.forEach(pli => {
        const impId = extractFkId(pli.imparticion);
        if (impId) mapByImp[impId] = pli.id ?? Number(pli['@id']?.split('/').pop());
      });
      pliByPlRealCache[realPlId] = mapByImp;
      return mapByImp;
    };
    if ((tx.pliToggles || []).length > 0) {
      // Pre-cargar el mapa actual de PLIs por PL afectado.
      for (const realPlId of togglesAndPatchesPlKeys) {
        if (await refetchPlisFor(realPlId) === null) {
          return { ok: false, error: `Fetch PLIs ${realPlId}` };
        }
      }
      for (const toggle of tx.pliToggles) {
        const realPlId = Number(tempIdToRealId[toggle.plKey] ?? toggle.plKey);
        const existingPliId = pliByPlRealCache[realPlId]?.[toggle.imparticionId];
        if (toggle.action === 'deactivate') {
          if (!existingPliId) continue;  // ya no existe → no-op
          const r = await fetch(getApiUrl(`/api/periodo_lectivo_imparticions/${existingPliId}`), {
            method: 'DELETE',
            credentials: 'include',
          });
          if (!r.ok && r.status !== 204) return { ok: false, error: `DELETE PLI ${existingPliId}: ${r.status}` };
          delete pliByPlRealCache[realPlId][toggle.imparticionId];
        } else if (toggle.action === 'activate') {
          if (existingPliId) continue;  // ya existe → no-op
          const r = await fetch(getApiUrl('/api/periodo_lectivo_imparticions'), {
            method: 'POST',
            headers: { 'Content-Type': 'application/ld+json', 'Accept': 'application/ld+json' },
            credentials: 'include',
            body: JSON.stringify({
              periodoLectivo: `/api/periodo_lectivos/${realPlId}`,
              imparticion: `/api/imparticions/${toggle.imparticionId}`,
              minutosSemanales: null,
            }),
          });
          if (!r.ok) {
            const txt = await r.text().catch(() => '');
            return { ok: false, error: `POST PLI: ${r.status}: ${txt.slice(0, 200)}` };
          }
          const created = await r.json();
          pliByPlRealCache[realPlId] = pliByPlRealCache[realPlId] || {};
          pliByPlRealCache[realPlId][toggle.imparticionId] = created.id ?? Number(created['@id']?.split('/').pop());
        }
      }
    }

    // 4. PATCH (o POST si no existe) PLI minutosSemanales con la distribución
    //    calculada en dry-run. pliPatches es [{ plKey, imparticionId,
    //    minutosSemanales }] donde plKey puede ser un tempId (mapear a realId)
    //    o un realId existente.
    //
    //    Caso "no existe" para PLs recién creados: el
    //    `PeriodoLectivoCreateProcessor` solo auto-crea PLIs en PLANTILLAs
    //    (modelo lazy on-demand del refactor semanal —
    //    `PeriodoLectivoCreateProcessor.php:54-59`). Las SEMANAs nacen sin
    //    PLIs y el `HorarioRenderService` hereda de la PLANTILLA. Si un
    //    pliPatch quiere asignar cuota override en una SEMANA recién creada,
    //    aquí hacemos POST PLI explícito (no PATCH). Sin esto los pliPatches
    //    se saltaban silenciosamente y las SEMANAs persistían "vacías" — bug
    //    detectado en sesión 3 (modelo semanal "Configurar curso óptimo").
    const newlyCreatedRealIds = new Set(
      (tx.plsToCreate || [])
        .map(d => Number(tempIdToRealId[d.tempId]))
        .filter(Boolean)
    );
    if ((tx.pliPatches || []).length > 0) {
      // Si los toggles no precargaron el cache para algún PL, hacerlo ahora.
      for (const realPlId of togglesAndPatchesPlKeys) {
        if (!pliByPlRealCache[realPlId]) {
          if (await refetchPlisFor(realPlId) === null) {
            return { ok: false, error: `Fetch PLIs ${realPlId}` };
          }
        }
      }
      for (const patch of tx.pliPatches) {
        const realPlId = Number(tempIdToRealId[patch.plKey] ?? patch.plKey);
        let pliId = pliByPlRealCache[realPlId]?.[patch.imparticionId];
        if (!pliId) {
          if (newlyCreatedRealIds.has(realPlId)) {
            // SEMANA recién creada sin PLI auto-creado → POST con la cuota
            // override directamente (no hace falta PATCH posterior).
            const r = await fetch(getApiUrl('/api/periodo_lectivo_imparticions'), {
              method: 'POST',
              headers: { 'Content-Type': 'application/ld+json', 'Accept': 'application/ld+json' },
              credentials: 'include',
              body: JSON.stringify({
                periodoLectivo: `/api/periodo_lectivos/${realPlId}`,
                imparticion: `/api/imparticions/${patch.imparticionId}`,
                minutosSemanales: patch.minutosSemanales,
              }),
            });
            if (!r.ok) {
              const txt = await r.text().catch(() => '');
              return { ok: false, error: `POST PLI ${realPlId}/${patch.imparticionId}: ${r.status}: ${txt.slice(0, 200)}` };
            }
            const created = await r.json();
            pliId = created.id ?? Number(created['@id']?.split('/').pop());
            pliByPlRealCache[realPlId] = pliByPlRealCache[realPlId] || {};
            pliByPlRealCache[realPlId][patch.imparticionId] = pliId;
            continue;
          }
          continue;  // PL existente y PLI ausente: imp desactivada por toggle previo → skip.
        }
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
    const affectedGroupsSet = new Set();
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
      try {
        const respData = await r.json();
        (respData.affectedGroups || []).forEach(g => affectedGroupsSet.add(g));
      } catch (_) { /* respuesta sin body legible — ignorar */ }
      totalPlacementsPosted += operations.length;
    }

    return {
      ok: true,
      tempIdToRealId,
      placementsPosted: totalPlacementsPosted,
      affectedGroups: Array.from(affectedGroupsSet),
    };
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
      || (tx.pliPatches?.length || 0) > 0 || (tx.pliToggles?.length || 0) > 0;
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
        // Fase D — invalidar caches de grupos hermanos cuyos placements
        // gemelos mutaron por el subscriber del backend (ver
        // `invalidateCachesForGroups`).
        invalidateCachesForGroups(res.affectedGroups || []);
        // Limpia la cola.
        setPendingTxByGrupo(prev => {
          const next = { ...prev };
          delete next[selectedGrupo];
          return next;
        });
        // Invalida cache de PLIs (el modal lo refresca al reabrir; los toggles
        // y patches del paso 3.b/4 cambiaron filas en BD).
        setPliByPl({});
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
      // Sin bloqueo por "módulo lleno" (2026-05-05): el admin puede colocar
      // con overshoot si el caso real lo requiere. El chip lateral indica
      // visualmente cuando se sobrepasa el target anual.
      // Fase B FP 2º (2026-05-12): si la imp no es presencial, el profe-
      // tutor no está físicamente en aula — skip el chequeo de paralelos.
      if (consumeAulaModalidad(getEffectiveModalidad(imp))) {
        const profId = imp.profesor?.id;
        if (profId && parallelBusy[key]?.has(Number(profId))) {
          const teacher = `${imp.profesor?.nombre || ''} ${imp.profesor?.apellidos || ''}`.trim();
          toast.error(t('scheduleEditor.reasonTeacherBusy', { teacher }));
          return;
        }
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
      const totalAnualMin = minutosAnualesObjetivoByImp[selectedImpId] || 0;
      const colocadasAnualMin = minutosAnualesColocadosByImp[selectedImpId] || 0;
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

  // Validación ligera para pintar tap-mode. Se ha quitado el bloqueo por
  // "imp completa" (2026-05-05): el admin puede tap-add aunque la imp ya
  // tenga su currículo cubierto.
  const validateTap = useCallback((diaIdx, slotIdx) => {
    if (!selectedImpId) return null;
    const key = `${diaIdx}_${slotsDia[slotIdx][0]}`;
    if (placements[key]) return false;
    const imp = impById[selectedImpId];
    if (!imp) return false;
    // Fase B FP 2º (2026-05-12): no presenciales no se bloquean por profe
    // paralelo (el profe-tutor no está físicamente en empresa con el alumno).
    if (consumeAulaModalidad(getEffectiveModalidad(imp))) {
      const profId = imp.profesor?.id;
      if (profId && parallelBusy[key]?.has(Number(profId))) return false;
    }
    return true;
  }, [selectedImpId, slotsDia, placements, impById, parallelBusy]);

  // Calcula la fecha ISO sugerida para un día de semana (1-5) considerando
  // el PL activo: SEMANA → lunes del PL + (diaIdx-1); PLANTILLA o sin fechas
  // → primer día de semana coincidente desde hoy hacia adelante.
  const computeFechaSugerida = useCallback((diaIdx) => {
    const addDays = (date, n) => {
      const d = new Date(date);
      d.setDate(d.getDate() + n);
      return d;
    };
    const toIso = (d) => {
      const y = d.getFullYear();
      const m = String(d.getMonth() + 1).padStart(2, '0');
      const day = String(d.getDate()).padStart(2, '0');
      return `${y}-${m}-${day}`;
    };
    if (selectedPl?.fechaInicio && isSemana(selectedPl)) {
      const inicio = new Date(`${selectedPl.fechaInicio}T00:00:00`);
      return toIso(addDays(inicio, diaIdx - 1));
    }
    // Fallback: próximo diaIdx desde hoy (o hoy si coincide).
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const todayDow = today.getDay() === 0 ? 7 : today.getDay(); // 1=Lun..7=Dom
    let delta = diaIdx - todayDow;
    if (delta < 0) delta += 7;
    return toIso(addDays(today, delta));
  }, [selectedPl]);

  // Click derecho sobre celda con placement persistido → abre modal de excepción.
  // Si hay tap-mode activo (selectedImpId) cedemos al menú nativo del navegador
  // para no robarle la opción "inspeccionar elemento" mientras coloca.
  const handleContextMenuPlacement = useCallback((e, diaIdx, slotIdx) => {
    if (selectedImpId) return; // tap-mode activo: no interceptar
    const key = `${diaIdx}_${slotsDia[slotIdx][0]}`;
    const placement = placements[key];
    if (!placement) return; // celda vacía: no menú
    e.preventDefault();
    if (!placement.hid) {
      toast.warning(t('exceptions.savePlacementFirst', {
        defaultValue: 'Guarda primero los cambios para crear una excepción sobre este bloque.',
      }));
      return;
    }
    const imp = impById[placement.imparticionId];
    const profe = imp?.profesor;
    const profeNombre = profe ? [profe.nombre, profe.apellidos].filter(Boolean).join(' ').trim() : '';
    const grupoNombre = grupo ? formatGrupoNombre(grupo) : '';
    setExceptionTarget({
      horarioId: placement.hid,
      fechaSugerida: computeFechaSugerida(diaIdx),
      diaSemana: diaIdx,
      horaInicio: fmtHora(placement.horaInicio || ''),
      horaFin: fmtHora(placement.horaFin || ''),
      materia: imp?.materia?.nombre || imp?.materia?.abreviatura || '',
      profesorId: profe?.id ? Number(profe.id) : undefined,
      profesorNombre: profeNombre,
      grupoNombre,
    });
  }, [selectedImpId, slotsDia, placements, impById, grupo, computeFechaSugerida, t]);

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
    // Modelo semanal: solo SEMANAs cuentan para "el último rango con fechaFin".
    // PLANTILLA no tiene fechas → la ignoramos en este sort.
    const existingSemanas = existing.filter(isSemana);
    if (existingSemanas.length > 0) {
      // Fecha inicio del nuevo rango = día siguiente al fechaFin del último.
      const last = [...existingSemanas].sort((a, b) => String(a.fechaFin).localeCompare(String(b.fechaFin))).at(-1);
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
    // Modelo semanal: la PLANTILLA no se edita desde este modal (no tiene
    // fechas; el formulario las exige). Los PLIs de la plantilla se editan
    // desde el modal "Materias del rango" / "Materias del curso".
    if (isPlantilla(pl)) {
      toast.info(t('scheduleEditor.editPlantillaUseSliders', {
        defaultValue: 'La plantilla del curso se edita desde el modal Materias del rango (icono Sliders).',
      }));
      return;
    }
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
            [selectedGrupo]: sortPlsForUi(next),
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
    // Si el usuario NO selecciona jornada en el modal, heredamos la jornada
    // efectiva del grupo (cadena Grupo.override → Itinerario.jornadaTipo).
    // Sin esto, un PL virtual sin jornada explícita rompía la rejilla
    // (slotsDia=[] → empty state "no jornada"), problema visible cuando el
    // itinerario no tiene jornada asignada y el grupo tampoco override.
    const tempId = tempIdSeqRef.current;
    tempIdSeqRef.current -= 1;
    const explicitJid = plForm.jornadaTipoId ? Number(plForm.jornadaTipoId) : null;
    const inheritedJid = explicitJid ?? (Number(resolveEffectiveJornadaId(grupo)) || null);
    // Modelo semanal: cualquier PL creado desde el modal "Crear/editar rango"
    // es tipo SEMANA (override puntual). La PLANTILLA del grupo ya existe
    // (creada por GrupoPlantillaSubscriber al persistir el grupo).
    const plantillaDelGrupo = findPlantilla(plByGrupo[selectedGrupo] || []);
    const draft = {
      tempId,
      id: tempId,
      _pending: 'create',
      tipo: 'semana',
      plantillaBase: plantillaDelGrupo ? `/api/periodo_lectivos/${plantillaDelGrupo.id}` : null,
      plantillaBaseId: plantillaDelGrupo?.id ?? null,
      nombre: plForm.nombre,
      fechaInicio: plForm.fechaInicio,
      fechaFin: plForm.fechaFin,
      jornadaTipoId: inheritedJid,
      jornadaTipo: inheritedJid ? { id: inheritedJid } : null,
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
        [selectedGrupo]: sortPlsForUi([...cur, draft]),
      };
    });
    // Inicializar state[gid_tempId] vacío para que grupoState sea truthy y
    // la rejilla se renderice (sin esto, empty state "Selecciona un grupo").
    setState(prev => ({
      ...prev,
      [`${selectedGrupo}_${tempId}`]: {
        placements: {},
        baseline: {},
        dirty: false,
      },
    }));
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
    // Modelo semanal: la PLANTILLA es el horario por defecto del grupo y no
    // se borra (el grupo no podría operar sin ella). Solo SEMANAs son borrables.
    if (isPlantilla(pl)) {
      toast.error(t('scheduleEditor.deletePlantillaDenied', {
        defaultValue: 'No puedes borrar la plantilla del curso. Borra solo semanas excepcionales.',
      }));
      return;
    }
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
      const next = selectActivePl(remaining) || remaining[0];
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

  // Fase D — invalida caches del editor para los grupos hermanos cuyos
  // placements gemelos acaban de mutarse en backend. El backend devuelve los
  // IDs de grupos afectados en la respuesta del batch (ver
  // `HorarioBatchController::resolveAffectedGemeloGroups`). Tras invalidar,
  // al seleccionar uno de esos grupos en el strip el effect ~619 detecta
  // `allHorariosByGroup[gid] === undefined` y refetchea automáticamente.
  // Doc: docs/hoja-de-ruta-clases-compartidas.md Fase D.
  const invalidateCachesForGroups = (groupIds) => {
    if (!Array.isArray(groupIds) || groupIds.length === 0) return;
    const idsStr = groupIds.map(String);
    setAllHorariosByGroup(prev => {
      const next = { ...prev };
      idsStr.forEach(gid => { delete next[gid]; });
      return next;
    });
    setState(prev => {
      const next = { ...prev };
      Object.keys(next).forEach(key => {
        const [gidPart] = key.split('_');
        if (idsStr.includes(gidPart)) delete next[key];
      });
      return next;
    });
    setCapacityByGrupo(prev => {
      const next = { ...prev };
      Object.keys(next).forEach(key => {
        const [gidPart] = key.split('_');
        if (idsStr.includes(gidPart)) delete next[key];
      });
      return next;
    });
  };

  // Abre el modal "Materias del rango" para el PL pasado. Para PL real carga las
  // PLIs vivas de BD; para PL virtual (id<0, aún no persistido) se inicializa
  // el cache vacío y `pliModalRows` sintetiza el estado base (todas las imps
  // activas con minutos heredados) que `pendingTx` puede overridear.
  const openPliModal = async (pl) => {
    if (!pl) return;
    setPliModalPlId(pl.id);
    setPliModalOpen(true);
    if (Number(pl.id) < 0) {
      // PL virtual: el processor del backend auto-creará un PLI por imp del
      // grupo al persistirlo, así que el "estado base" es: todas activas con
      // minutos heredados de Materia. Cualquier toggle/patch en pendingTx
      // se aplicará tras el POST del PL en applyPendingTxForGrupo.
      setPliByPl(prev => ({ ...prev, [pl.id]: [] }));
      return;
    }
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

  // Tanda B parte 3: las acciones del modal "Materias del rango" no tocan BD;
  // acumulan toggles/patches en pendingTxByGrupo. Se aplican en orden estricto
  // dentro de applyPendingTxForGrupo tras crear los PLs reales.
  //   - togglePliInTx(impId, true|false): activa/desactiva la imp en este PL.
  //   - setPliMinutosInTx(impId, minSem|null): setea (o resetea con null) los
  //     minutos semanales del PLI en este PL.
  // El estado "base" para overlays es:
  //   - PL real: lo que hay en pliByPl[plKey] cargado de BD.
  //   - PL virtual: todas las imps activas con minutos heredados (lo que el
  //     PeriodoLectivoCreateProcessor del backend creará al persistir).

  const ensureTxInitialized = (tx) => ({
    ...tx,
    grupoFechaFinOriginal: tx.grupoFechaFinOriginal ?? grupo?.fechaFin ?? null,
    plsRealesOriginales: tx.plsRealesOriginales ?? (plByGrupo[selectedGrupo] || []).filter(p => !p._pending),
  });

  // Devuelve true si la imparticion estaba activa en el PL antes de cualquier
  // pendingTx (estado base). Para PL virtual, el processor del backend creará
  // un PLI por cada Imparticion → todas activas por defecto.
  const isImpActiveInPlBase = (plKey, impId) => {
    if (Number(plKey) < 0) return true;
    const basePlis = pliByPl[plKey] || [];
    return basePlis.some(p => Number(extractFkId(p.imparticion)) === Number(impId));
  };

  const togglePliInTx = (impId, makeActive) => {
    if (!pliModalPlId || !selectedGrupo) return;
    const plKey = pliModalPlId;
    const baseActive = isImpActiveInPlBase(plKey, impId);
    setPendingTxByGrupo(prev => {
      const tx = ensureTxInitialized(prev[selectedGrupo] || {});
      // Quitar toggle previo de la misma (plKey, impId).
      const otherToggles = (tx.pliToggles || []).filter(p =>
        !(String(p.plKey) === String(plKey) && Number(p.imparticionId) === Number(impId))
      );
      let newToggles = otherToggles;
      // Si el nuevo estado coincide con el base, no hace falta toggle (no-op).
      if (makeActive !== baseActive) {
        newToggles = [...otherToggles, { plKey, imparticionId: Number(impId), action: makeActive ? 'activate' : 'deactivate' }];
      }
      // Al desactivar, limpiar cualquier patch pendiente de minutos para esa
      // imp en este PL (deja de tener sentido).
      let newPatches = (tx.pliPatches || []);
      if (!makeActive) {
        newPatches = newPatches.filter(p =>
          !(String(p.plKey) === String(plKey) && Number(p.imparticionId) === Number(impId))
        );
      }
      return {
        ...prev,
        [selectedGrupo]: {
          ...tx,
          pliToggles: newToggles,
          pliPatches: newPatches,
        },
      };
    });
    invalidateCapacityForPl(selectedGrupo, pliModalPlId);
  };

  const setPliMinutosInTx = (impId, newMinutos) => {
    if (!pliModalPlId || !selectedGrupo) return;
    const plKey = pliModalPlId;
    setPendingTxByGrupo(prev => {
      const tx = ensureTxInitialized(prev[selectedGrupo] || {});
      const others = (tx.pliPatches || []).filter(p =>
        !(String(p.plKey) === String(plKey) && Number(p.imparticionId) === Number(impId))
      );
      return {
        ...prev,
        [selectedGrupo]: {
          ...tx,
          pliPatches: [...others, { plKey, imparticionId: Number(impId), minutosSemanales: newMinutos }],
        },
      };
    });
    invalidateCapacityForPl(selectedGrupo, pliModalPlId);
  };

  // ── Extender curso (Fase 5 sub-B / Tanda B parte 3) ──────────────────
  // Tanda B parte 3: NO toca BD. Acumula los cambios en pendingTxByGrupo y
  // refleja el preview localmente. Se persiste al pulsar Guardar:
  //   - Si el último PL es real → push a tx.plsToUpdate.
  //   - Si el último PL es virtual (draft) → modifica fechaFin del draft.
  //   - Si el Grupo necesita extender fechaFin → set tx.grupoFechaFin.
  const handleConfirmExtendCourse = async () => {
    if (!extendCourseSuggestion || !selectedGrupo) return;
    const sug = extendCourseSuggestion;
    setExtendingCourse(true);
    try {
      const isVirtualLast = Number(sug.lastPl.id) < 0;
      setPendingTxByGrupo(prev => {
        const tx = ensureTxInitialized(prev[selectedGrupo] || {});
        let nextTx = { ...tx };
        if (isVirtualLast) {
          // Modificar el draft virtual: cambiar fechaFin in-place.
          nextTx.plsToCreate = (tx.plsToCreate || []).map(d =>
            String(d.tempId) === String(sug.lastPl.id)
              ? { ...d, fechaFin: sug.newLastPlFinISO }
              : d);
        } else {
          // PL real: añadir/actualizar entrada en plsToUpdate.
          const others = (tx.plsToUpdate || []).filter(u => String(u.realId) !== String(sug.lastPl.id));
          // Si ya había un update previo de este PL, conservamos sus otros campos.
          const previo = (tx.plsToUpdate || []).find(u => String(u.realId) === String(sug.lastPl.id)) || {};
          nextTx.plsToUpdate = [...others, { ...previo, realId: Number(sug.lastPl.id), fechaFin: sug.newLastPlFinISO }];
        }
        if (sug.grupoNeedsPatch) {
          nextTx.grupoFechaFin = sug.newGrupoFinISO;
        }
        return { ...prev, [selectedGrupo]: nextTx };
      });
      // Reflejar preview local: extender fechaFin del último PL en plByGrupo.
      setPlByGrupo(prev => {
        const cur = prev[selectedGrupo] || [];
        const next = cur.map(pl => String(pl.id) === String(sug.lastPl.id)
          ? { ...pl, fechaFin: sug.newLastPlFinISO, _pending: pl._pending || (isVirtualLast ? 'create' : 'edit') }
          : pl);
        return { ...prev, [selectedGrupo]: next };
      });
      // Reflejar preview local: extender fechaFin del grupo si aplica.
      if (sug.grupoNeedsPatch) {
        setGrupos(prev => prev.map(g => String(g.id) === String(selectedGrupo)
          ? { ...g, fechaFin: sug.newGrupoFinISO }
          : g));
      }
      invalidateCapacityForPl(selectedGrupo, sug.lastPl.id);
      setExtendModalOpen(false);
      toast.success(t('scheduleEditor.extendCoursePreview', {
        defaultValue: 'Extensión añadida al preview. Pulsa Guardar para persistir.',
      }));
    } catch (err) {
      console.error('Error extendiendo curso (preview):', err);
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
  //   - useIterativo: si true, redirige al endpoint /solver-iterativo/{gid}
  //     que ejecuta el bucle reductivo in-memory en backend (Fase 1 del doc
  //     `hoja-de-ruta-solver-iterativo.md`). Reemplaza el bucle frontend
  //     `reduceUnplacedQuotas` que PATCH'eaba PLIs en BD entre intentos.
  //   - suppressToast: si true, omite el toast de "propuesta parcial". Lo usa
  //     `runSolverAllRangos` cuando el modal de informe (Fase 4) reemplaza
  //     los toasts per-PL con un único modal final.
  // Devuelve el `data` del backend (o null si no se pudo ejecutar).
  const runSolver = async (seed = null, skipConfirm = false, plIdOverride = null, alreadyPlacedOverride = null, useIterativo = false, suppressToast = false) => {
    if (!selectedGrupo) return null;
    const targetPlId = plIdOverride ?? selectedPlId;
    // Fase A FP 2º (2026-05-12): el solver NO debe correrse sobre PLs
    // con etiqueta='no_presenciales' (Tercera evaluación de FP 2º) —
    // son contenedores temporales para FCT/Proyecto/HLC sin slots de aula.
    // Defensa por si el caller (UI o runSolverAllRangos) lo invoca.
    const targetPl = (plByGrupo[selectedGrupo] || []).find(p => String(p.id) === String(targetPlId));
    if (targetPl?.etiqueta === 'no_presenciales') {
      if (!suppressToast) {
        toast.info(t('scheduleEditor.solverSkipNoPresenciales', {
          defaultValue: 'El solver no aplica a "Tercera evaluación" — es un contenedor de horas no presenciales (FCT/Proyecto/HLC).',
        }));
      }
      return null;
    }
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
              const dur = getPlacementDur(p);
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
      // Construye `rangoOverride` (formato del endpoint /solver-dry-run y
      // /solver-iterativo) si el target es un PL virtual del pendingTx.
      // Tanda B parte 3 (PL virtual) + Fase 1 solver-iterativo (2026-05-01)
      // comparten esta misma estructura.
      const isVirtualTarget = targetPlId != null && Number(targetPlId) < 0;
      const buildRangoOverride = () => {
        const tx = pendingTxByGrupo[selectedGrupo] || {};
        const draft = (tx.plsToCreate || []).find(d => String(d.tempId) === String(targetPlId));
        if (!draft) throw new Error('PL virtual no encontrado en pendingTx');
        const togglesByImp = {};
        (tx.pliToggles || []).forEach(p => {
          if (String(p.plKey) === String(targetPlId)) togglesByImp[String(p.imparticionId)] = p.action;
        });
        const patchesByImp = {};
        (tx.pliPatches || []).forEach(p => {
          if (String(p.plKey) === String(targetPlId)) patchesByImp[String(p.imparticionId)] = p.minutosSemanales;
        });
        const plisBody = imps
          .filter(imp => {
            const tog = togglesByImp[String(imp.id)];
            return tog ? tog === 'activate' : true;
          })
          .map(imp => ({
            imparticionId: Number(imp.id),
            minutosSemanales: Object.prototype.hasOwnProperty.call(patchesByImp, String(imp.id))
              ? patchesByImp[String(imp.id)]
              : null,
          }));
        const txDeleteSet = new Set((tx.plsToDelete || []).map(String));
        const realesVivos = (plByGrupo[selectedGrupo] || [])
          .filter(p => !p._pending && !txDeleteSet.has(String(p.id)));
        // Fase A FP 2º: excluir no_presenciales del cap anual (no aporta
        // capacidad presencial — es contenedor de FCT/Proyecto/HLC).
        const allPlsForCap = [...realesVivos, ...(tx.plsToCreate || [])]
          .filter(p => p.etiqueta !== 'no_presenciales');
        // Modelo semanal: PLANTILLA → semanasReferenciaCentro; SEMANAs → ~1.
        const totalSemanasGrupo = allPlsForCap.reduce((acc, pl) =>
          acc + getSemanasOfPl(pl, semanasReferenciaCentro), 0);
        return {
          rango: {
            tempId: Number(targetPlId),
            nombre: draft.nombre,
            fechaInicio: draft.fechaInicio,
            fechaFin: draft.fechaFin,
            jornadaTipoId: draft.jornadaTipoId ?? null,
            plis: plisBody,
          },
          totalSemanasGrupo,
        };
      };

      let res;
      if (useIterativo) {
        // Fase 1 (2026-05-01): bucle reductivo in-memory en backend. Mismo
        // comportamiento que el viejo loop frontend pero sin PATCH a BD.
        const body = {
          ...(seed !== null ? { seed } : {}),
          alreadyPlacedByImp: placedAnualOtrosRangos,
          maxIterations: 6,
        };
        if (isVirtualTarget) {
          const { rango, totalSemanasGrupo } = buildRangoOverride();
          body.rangoOverride = rango;
          body.totalSemanasGrupoOverride = totalSemanasGrupo;
        } else if (targetPlId) {
          body.periodoLectivoId = targetPlId;
        }
        res = await fetch(getApiUrl(`/api/v1/horarios/solver-iterativo/${selectedGrupo}`), {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
          credentials: 'include',
          body: JSON.stringify(body),
        });
      } else if (isVirtualTarget) {
        const { rango, totalSemanasGrupo } = buildRangoOverride();
        const dryBody = {
          rango,
          ...(seed !== null ? { seed } : {}),
          alreadyPlacedByImp: placedAnualOtrosRangos,
          totalSemanasGrupoOverride: totalSemanasGrupo,
        };
        res = await fetch(getApiUrl(`/api/v1/horarios/solver-dry-run/${selectedGrupo}`), {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
          credentials: 'include',
          body: JSON.stringify(dryBody),
        });
      } else {
        const body = {
          ...(seed !== null ? { seed } : {}),
          ...(targetPlId ? { periodoLectivoId: targetPlId } : {}),
          alreadyPlacedByImp: placedAnualOtrosRangos,
        };
        res = await fetch(getApiUrl(`/api/v1/horarios/solver/${selectedGrupo}`), {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
          credentials: 'include',
          body: JSON.stringify(body),
        });
      }
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
      if (data.iterationLog) {
        // eslint-disable-next-line no-console
        console.log('Iteration log (Fase 1 solver-iterativo):', data.iterationLog);
        // eslint-disable-next-line no-console
        console.log('Diagnostic:', data.diagnostic);
      }
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
      if (!data.complete && data.unplaced?.length && !suppressToast) {
        // Fase 2 solver-iterativo (2026-05-01): si el backend devuelve
        // diagnostic con primaryBottleneck (sólo en endpoint /solver-iterativo),
        // mostramos toast enriquecido con título=bottleneck + descripción=
        // primera sugerencia traducida con sus params. Si no, fallback al
        // toast clásico con la lista de materias unplaced.
        const diag = data.diagnostic;
        if (diag?.primaryBottleneck && diag.primaryBottleneck !== 'NONE') {
          const titleKey = `scheduleEditor.solverBottleneck.${diag.primaryBottleneck}`;
          const title = t(titleKey, { defaultValue: diag.primaryBottleneck });
          const firstSug = diag.suggestions?.[0];
          const description = firstSug
            ? t(`scheduleEditor.solverSuggestion.${firstSug.code}`, {
                ...firstSug.params,
                defaultValue: firstSug.code,
              })
            : '';
          toast.warning(t('scheduleEditor.solverDiagnosticPartial', {
            title,
            defaultValue: 'Propuesta parcial · {{title}}',
          }), { description, duration: 9000 });
        } else {
          const faltan = data.unplaced.map(u => `${u.materia}: ${u.horasRestantes}h`).join(', ');
          toast.warning(t('scheduleEditor.solverPartial', { items: faltan }), { duration: 6000 });
        }
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
    // Fase A FP 2º (2026-05-12): los PLs con etiqueta='no_presenciales'
    // (Tercera evaluación en FP 2º) son contenedores temporales para
    // FCT/Proyecto/HLC sin slots de aula. El solver no debe iterarlos:
    // no hay imparticiones presenciales que colocar allí.
    const pls = (plsOverride ?? plByGrupo[selectedGrupo] ?? [])
      .filter(pl => pl.etiqueta !== 'no_presenciales')
      .slice()
      .sort((a, b) => (a.fechaInicio || '').localeCompare(b.fechaInicio || ''));
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
    let savedCount = 0;
    // Fase 4 solver-iterativo (2026-05-01): acumula el resultado per-PL para
    // poder abrir el modal "Informe del solver" al terminar. Cada entrada
    // incluye complete/placedCount/unplacedCount + diagnostic + iterationLog.
    const perPlReports = [];
    console.group(`[SolverAll] grupo=${selectedGrupo} pls=${pls.length} autoSave=${autoSave}`);

    // Fase 3.5 solver-iterativo (2026-05-01): UNA sola llamada al endpoint
    // multi-rango `/api/v1/horarios/solver-iterativo-multi/{gid}`. El backend
    // itera per-PL en orden cronológico, mantiene `accumPlacedByImp` cross-
    // rango cumulativo (cap anual) y devuelve `perPl[]` con placements +
    // diagnostic + iterationLog por rango. Sustituye el loop frontend.

    try {
      // Construir el body: cada PL es real (periodoLectivoId) o virtual del
      // pendingTx (rangoOverride con drafts + plis derivadas de toggles/patches).
      const tx = pendingTxByGrupo[selectedGrupo] || {};
      const txDeleteSet = new Set((tx.plsToDelete || []).map(String));
      const realesVivos = (plByGrupo[selectedGrupo] || [])
        .filter(p => !p._pending && !txDeleteSet.has(String(p.id)));
      // Fase A FP 2º: excluir no_presenciales del cap anual del solver
      // multi-rango — el rango Tercera evaluación no aporta capacidad
      // presencial y el solver no opera sobre él.
      const allPlsForCap = [...realesVivos, ...(tx.plsToCreate || [])]
        .filter(p => p.etiqueta !== 'no_presenciales');
      // Modelo semanal: PLANTILLA aporta `semanasReferenciaCentro` (calendario
      // real del centro o 36 LOMLOE de fallback). SEMANAs aportan ~1 cada una.
      const totalSemanasGrupo = allPlsForCap.reduce((acc, pl) => {
        return acc + getSemanasOfPl(pl, semanasReferenciaCentro);
      }, 0);

      const buildRangoItem = (pl) => {
        if (Number(pl.id) >= 0) {
          return { periodoLectivoId: Number(pl.id) };
        }
        // PL virtual del pendingTx: construir rangoOverride.
        const draft = (tx.plsToCreate || []).find(d => String(d.tempId) === String(pl.id));
        if (!draft) throw new Error(`PL virtual ${pl.id} no encontrado en pendingTx`);
        const togglesByImp = {};
        (tx.pliToggles || []).forEach(p => {
          if (String(p.plKey) === String(pl.id)) togglesByImp[String(p.imparticionId)] = p.action;
        });
        const patchesByImp = {};
        (tx.pliPatches || []).forEach(p => {
          if (String(p.plKey) === String(pl.id)) patchesByImp[String(p.imparticionId)] = p.minutosSemanales;
        });
        const plisBody = imps
          .filter(imp => {
            const tog = togglesByImp[String(imp.id)];
            return tog ? tog === 'activate' : true;
          })
          .map(imp => ({
            imparticionId: Number(imp.id),
            minutosSemanales: Object.prototype.hasOwnProperty.call(patchesByImp, String(imp.id))
              ? patchesByImp[String(imp.id)]
              : null,
          }));
        return {
          rangoOverride: {
            tempId: Number(pl.id),
            nombre: draft.nombre,
            fechaInicio: draft.fechaInicio,
            fechaFin: draft.fechaFin,
            jornadaTipoId: draft.jornadaTipoId ?? null,
            plis: plisBody,
          },
        };
      };

      const body = {
        rangos: pls.map(buildRangoItem),
        maxIterations: 6,
        totalSemanasGrupoOverride: totalSemanasGrupo,
      };

      const res = await fetch(getApiUrl(`/api/v1/horarios/solver-iterativo-multi/${selectedGrupo}`), {
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
      console.log(`[SolverAll] multi response: ${data.perPl?.length || 0} PLs en ${data.elapsedSec}s. accumFinal:`, data.accumPlacedByImp);

      // Procesar respuesta per-PL: actualizar state local + (si autoSave) POST batch.
      for (const pl of pls) {
        const isVirtual = Number(pl.id) < 0;
        const matchKey = isVirtual ? `temp:${pl.id}` : `real:${pl.id}`;
        const r = (data.perPl || []).find(p => p.plKey === matchKey);
        if (!r) {
          errores.push({ pl: pl.nombre || `#${pl.id}`, error: 'PL no encontrado en respuesta del solver multi' });
          continue;
        }
        console.log(`[SolverAll] PL #${pl.id} ${pl.nombre}: complete=${r.complete} placed=${r.placements?.length} unplaced=${r.unplaced?.length} pasadas=${r.iterativo?.iterationsRun}`);

        // Set placements en state local (dirty=true para que se guarden).
        const skey = `${selectedGrupo}_${pl.id}`;
        const newPlacements = {};
        (r.placements || []).forEach(p => {
          const hi = String(p.horaInicio).slice(0, 8);
          newPlacements[`${p.diaSemana}_${hi}`] = {
            imparticionId: p.imparticionId,
            aula: p.aula,
            horaInicio: hi,
            horaFin: String(p.horaFin).slice(0, 8),
          };
        });
        setState(prev => ({
          ...prev,
          [skey]: {
            ...(prev[skey] || {}),
            placements: newPlacements,
            dirty: true,
          },
        }));

        perPlReports.push({
          plId: pl.id,
          plNombre: pl.nombre || `PL #${pl.id}`,
          plFechaInicio: pl.fechaInicio,
          plFechaFin: pl.fechaFin,
          complete: !!r.complete,
          placedCount: (r.placements || []).length,
          unplacedCount: (r.unplaced || []).length,
          unplaced: r.unplaced || [],
          diagnostic: r.diagnostic || null,
          iterationLog: r.iterationLog || [],
          iterationsRun: r.iterativo?.iterationsRun || 0,
        });

        // autoSave: POST batch a BD para PLs reales (los virtuales necesitan
        // Guardar pendingTx primero; se omiten silenciosamente).
        if (autoSave && !isVirtual) {
          const ops = (r.placements || []).map(p => {
            const hi = String(p.horaInicio).slice(0, 8);
            return {
              op: 'create',
              clientKey: `${p.diaSemana}_${hi}`,
              diaSemana: p.diaSemana,
              horaInicio: hi.slice(0, 5),
              horaFin: String(p.horaFin).slice(0, 5),
              aula: p.aula,
              imparticion: p.imparticionId,
            };
          });
          try {
            const saveRes = await fetch(getApiUrl('/api/v1/horarios/batch'), {
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
            if (!saveRes.ok) {
              const txt = await saveRes.text().catch(() => '');
              throw new Error(`${saveRes.status}: ${txt.slice(0, 200)}`);
            }
            const sd = await saveRes.json();
            (sd.created || []).forEach(({ clientKey, id }) => {
              if (clientKey && newPlacements[clientKey]) {
                newPlacements[clientKey] = { ...newPlacements[clientKey], hid: id };
              }
            });
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
          } catch (err) {
            console.error(`[SolverAll] PL #${pl.id} save FAIL:`, err);
            errores.push({ pl: pl.nombre || `#${pl.id}`, error: `Save: ${err?.message || String(err)}` });
          }
        }
      }

      // Refetch global de horarios para que el cómputo cross-rango refleje BD.
      if (autoSave && savedCount > 0) {
        await refetchAllHorariosForGroup(selectedGrupo);
      }
      // Fase 4 + Parte B (2026-05-01): si algún PL no completó O hay
      // crossRangoShortfalls (cobertura anual < target), abrir el modal con
      // toda la info. Si todo completó y sin shortfalls, toast OK.
      const plsConProblemas = perPlReports.filter(r => !r.complete || (r.diagnostic?.primaryBottleneck && r.diagnostic.primaryBottleneck !== 'NONE'));
      const crossRangoShortfalls = data.crossRangoShortfalls || [];
      if (errores.length > 0) {
        toast.error(t('scheduleEditor.solverAllPartial', {
          defaultValue: '{{count}} rangos fallaron: {{names}}',
          count: errores.length,
          names: errores.map(e => e.pl).join(', '),
        }));
      } else if (plsConProblemas.length > 0 || crossRangoShortfalls.length > 0) {
        // Abre el modal con el informe per-PL + cross-rango shortfalls.
        const grupoNombre = grupos.find(g => String(g.id) === String(selectedGrupo));
        setSolverReportData({
          grupoNombre: grupoNombre ? `${grupoNombre.curso ?? ''}º ${grupoNombre.abreviatura || grupoNombre.nombre || ''}`.trim() : '',
          autoSave,
          savedCount,
          totalPls: pls.length,
          plsConProblemas: plsConProblemas.length,
          perPl: perPlReports,
          crossRangoShortfalls,
        });
        setSolverReportExpandedPl(plsConProblemas[0]?.plId ?? null);
        setSolverReportOpen(true);
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
    } catch (err) {
      console.error('[SolverAll] FAIL:', err);
      toast.error(err?.message || String(err), {
        description: t('scheduleEditor.solverAllErrorCtx', { defaultValue: 'No se pudo ejecutar el solver multi-rango' }),
      });
    } finally {
      setSolverAllRunning(false);
      setSolverProgress(null);
    }
    console.log(`[SolverAll] FIN: ${savedCount} guardados, ${errores.length} errores.`);
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

    // Heredar la jornada efectiva del grupo (cadena Grupo.override →
    // Itinerario.jornadaTipo) en cada PL virtual. Sin esto, si la cadena
    // de fallback a nivel de PL devolviera null, la rejilla del editor
    // mostraría empty state "no jornada" — caso visible cuando el itinerario
    // no tiene jornada asignada.
    const jornadaIdHeredada = Number(resolveEffectiveJornadaId(grupo)) || null;

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
        jornadaTipo: jornadaIdHeredada ? { id: jornadaIdHeredada } : null,
        jornadaTipoId: jornadaIdHeredada,
        orden: i,
      });
      cursor.setDate(cursor.getDate() + dias);
    }

    // Fase A FP 2º (2026-05-12): consultar al planner si hay rango extra
    // con `etiqueta='no_presenciales'` (Tercera evaluación en FP 2º) y
    // adjuntarlo al final. Esto reusa la detección isFp2 + TERCERA del
    // backend en lugar de duplicarla aquí. La acción sigue siendo "tonta"
    // (reparto uniforme); el rango extra solo se añade cuando el planner
    // lo identifica. Si el fetch falla o el grupo no es FP 2º, se sigue
    // sin añadirlo y el comportamiento queda como antes.
    try {
      const planRes = await fetch(getApiUrl(`/api/v1/grupos/${selectedGrupo}/plan-rangos`), {
        headers: { 'Accept': 'application/json' }, credentials: 'include',
      });
      if (planRes.ok) {
        const planJson = await planRes.json();
        const noPresRango = (planJson?.rangos || []).find(r => r.etiqueta === 'no_presenciales');
        if (noPresRango && noPresRango.fechaInicio && noPresRango.fechaFin) {
          const tempId = tempIdSeqRef.current;
          tempIdSeqRef.current -= 1;
          plsToCreate.push({
            tempId,
            id: tempId,
            _pending: 'create',
            nombre: noPresRango.nombre || t('scheduleEditor.recommendedRangoNoPresNombre', { defaultValue: 'Tercera evaluación' }),
            fechaInicio: noPresRango.fechaInicio,
            fechaFin: noPresRango.fechaFin,
            jornadaTipo: null,  // contenedor temporal sin rejilla de aula
            jornadaTipoId: null,
            orden: N,  // tras los N rangos lectivos
            etiqueta: 'no_presenciales',
          });
        }
      }
    } catch (err) {
      console.warn('[CrearRangos] planner no disponible para detectar no_presenciales:', err);
      // Fallthrough: el reparto uniforme N tramos sigue siendo válido.
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
    // Inicializar state[gid_tempId] vacío para cada PL virtual: sin esto,
    // grupoState es undefined y la rejilla muestra "Selecciona un grupo".
    setState(prev => {
      const next = { ...prev };
      plsToCreate.forEach(pl => {
        next[`${selectedGrupo}_${pl.tempId}`] = {
          placements: {},
          baseline: {},
          dirty: false,
        };
      });
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

  // Configurar curso óptimo — modelo semanal puro (Fase B, 2026-05-06).
  //
  // En el modelo semanal puro la PLANTILLA es el único objetivo: ya no se
  // crean N rangos equiespaciados ni se extiende `Grupo.fechaFin`. La
  // duración del curso vive en `Centro.fechaInicio/FinCurso` (Fase 7
  // PeriodoLectivo) y la PLANTILLA representa la "semana tipo" del grupo.
  //
  // Pipeline:
  //   1. GET /grupos/{id}/plantilla-cabida — el `PlantillaCabidaValidator`
  //      lee la PLANTILLA, calcula la jornada lectiva semanal y la cuota
  //      natural por imparticion (Materia.minutosSemanales). Reporta
  //      `feasible` + cuotas + shortfalls si Σ presenciales > jornada.
  //   2. Si !feasible → modal de informe sin tocar BD. La decisión de
  //      "subir jornada" o "reducir minutos por materia" es del admin del
  //      centro, no algorítmica.
  //   3. Si feasible → confirm + construir pendingTx con `pliPatches`
  //      apuntando al id REAL de la PLANTILLA (no tempIds). No hay
  //      `plsToDelete`/`plsToCreate`: las SEMANAs excepcionales del grupo
  //      no se tocan.
  //   4. POST /horarios/solver-iterativo-multi/{grupoId} con
  //      `{rangos: [{periodoLectivoId: plantillaId}]}`. El solver lee los
  //      PLIs persistidos de la PLANTILLA (NO los del pendingTx — esos se
  //      aplican al pulsar Guardar) y devuelve placements con
  //      `plKey: 'real:<plantillaId>'`.
  //   5. setState[gid_plantillaId] con los placements (dirty:true). Al
  //      pulsar Guardar, `applyPendingTxForGrupo` PATCHea los PLIs y
  //      `performBatchSaveAllDirty` POSTea los horarios de la PLANTILLA
  //      en la pasada de `dirtyPls` (no es `_pending`).
  //
  // Las cuotas heterogéneas cross-rango y `CurriculumDistributor` siguen
  // vivos en backend para SEMANAs excepcionales — fuera del alcance de
  // este flujo.
  //
  // Doc: docs/hoja-de-ruta-modelo-semanal.md §12.
  const handleConfigureOptimalCourse = async () => {
    if (!selectedGrupo || !grupo) return;

    // 0. Limpiar pendingTx anterior del grupo si lo hubiera. Sin esto, los
    //    virtuales del intento anterior se acumulaban en plByGrupo y el
    //    strip de pills mostraba duplicados (PLANTILLA + PLANTILLA virtual
    //    + 4 SEMANAs antiguas + 4 SEMANAs nuevas). Descartar deja el state
    //    limpio antes de calcular cabida y construir el nuevo pendingTx.
    if (hasPendingTx(selectedGrupo)) {
      const tx = pendingTxByGrupo[selectedGrupo];
      // Quitar virtuales del strip + restaurar reales originales si los hay.
      setPlByGrupo(prev => {
        const filtered = (prev[selectedGrupo] || []).filter(p => !p._pending);
        const restored = tx?.plsRealesOriginales || [];
        const restoredIds = new Set(restored.map(p => p.id));
        const merged = [...filtered.filter(p => !restoredIds.has(p.id)), ...restored];
        return { ...prev, [selectedGrupo]: merged };
      });
      // Limpiar state de tempIds.
      setState(prev => {
        const next = { ...prev };
        (tx?.plsToCreate || []).forEach(d => { delete next[`${selectedGrupo}_${d.tempId}`]; });
        return next;
      });
      setPendingTxByGrupo(prev => { const c = { ...prev }; delete c[selectedGrupo]; return c; });
    }

    // 1. Localizar la PLANTILLA del grupo. Hacemos un fetch DIRECTO al backend
    //    en lugar de leer `plByGrupo[selectedGrupo]` — el state local de React
    //    es asíncrono y un `setPlByGrupo` previo en `refetchPlsForGroup` no
    //    se ve en la siguiente línea. Sin esto, si el state estaba stale
    //    la auto-create disparaba duplicados (bug observado: 3 PLANTILLAs
    //    en BD para el grupo 1 tras varios reintentos). POST PL `tipo:
    //    plantilla` sin fechas; el backend processor auto-crea los PLIs
    //    heredados de cada Imparticion del grupo.
    let frescosPls = [];
    try {
      const fr = await fetch(getApiUrl(`/api/periodo_lectivos?grupo=${selectedGrupo}&pagination=false&order[orden]=asc&order[fechaInicio]=asc`),
        { headers: { 'Accept': 'application/ld+json' }, credentials: 'include' });
      if (fr.ok) {
        const dd = await fr.json();
        frescosPls = dd['hydra:member'] || dd.member || [];
      }
    } catch (e) {
      console.warn('[OptCurso] no pude refrescar PLs:', e);
    }
    setPlByGrupo(prev => ({ ...prev, [selectedGrupo]: frescosPls }));
    let plantilla = findPlantilla(frescosPls);
    if (!plantilla) {
      console.log('[OptCurso] sin PLANTILLA, creando una nueva…');
      try {
        const res = await fetch(getApiUrl('/api/periodo_lectivos'), {
          method: 'POST',
          headers: { 'Content-Type': 'application/ld+json', 'Accept': 'application/ld+json' },
          credentials: 'include',
          body: JSON.stringify({
            grupo: `/api/grupos/${selectedGrupo}`,
            nombre: 'Plantilla del curso',
            tipo: 'plantilla',
            orden: 0,
          }),
        });
        if (!res.ok) {
          const txt = await res.text().catch(() => '');
          toast.error(t('scheduleEditor.optimalCreatePlantillaError', {
            defaultValue: 'No se pudo crear la PLANTILLA del grupo: {{err}}',
            err: (txt.slice(0, 300) || `HTTP ${res.status}`),
          }));
          return;
        }
        const created = await res.json();
        const newPlantillaId = created.id ?? Number(created['@id']?.split('/').pop());
        // Refetch DIRECTO (no usamos plByGrupo porque setPlByGrupo es asíncrono).
        try {
          const fr2 = await fetch(getApiUrl(`/api/periodo_lectivos?grupo=${selectedGrupo}&pagination=false&order[orden]=asc&order[fechaInicio]=asc`),
            { headers: { 'Accept': 'application/ld+json' }, credentials: 'include' });
          if (fr2.ok) {
            const dd2 = await fr2.json();
            frescosPls = dd2['hydra:member'] || dd2.member || [];
            setPlByGrupo(prev => ({ ...prev, [selectedGrupo]: frescosPls }));
          }
        } catch (_) {}
        plantilla = frescosPls.find(p => p.id === newPlantillaId)
          || { id: newPlantillaId, tipo: 'plantilla', nombre: 'Plantilla del curso' };
        toast.success(t('scheduleEditor.optimalCreatedPlantilla', {
          defaultValue: 'PLANTILLA del grupo creada automáticamente.',
        }), { duration: 3000 });
      } catch (err) {
        toast.error(t('scheduleEditor.optimalCreatePlantillaNetwork', {
          defaultValue: 'Error de red al crear la PLANTILLA: {{err}}', err: err.message,
        }));
        return;
      }
    }

    // 2. Pedir cabida (informativo: detecta si Σ presencial cabe en jornada
    //    semanal, y sugiere extensión de calendario si no).
    let cabida;
    try {
      const res = await fetch(getApiUrl(`/api/v1/grupos/${selectedGrupo}/plantilla-cabida`), {
        headers: { 'Accept': 'application/json' }, credentials: 'include',
      });
      if (!res.ok) {
        const txt = await res.text().catch(() => '');
        toast.error(t('scheduleEditor.optimalCabidaError', {
          defaultValue: 'No se pudo validar la cabida del currículo: {{err}}',
          err: (txt.slice(0, 200) || `HTTP ${res.status}`),
        }));
        return;
      }
      cabida = await res.json();
    } catch (err) {
      toast.error(t('scheduleEditor.optimalCabidaNetwork', {
        defaultValue: 'Error de red al validar la cabida: {{err}}', err: err.message,
      }));
      return;
    }
    if (cabida?.error) { toast.error(cabida.error); return; }
    const jornadaSemMin = cabida.jornada?.semanalLectivaMin ?? 0;

    // 3. Pedir al planner los puntos de corte dinámicos (N tramos). El
    //    planner combina calendario real, evaluaciones del grupo y horas
    //    curriculares para devolver una propuesta razonada (1 tramo si todo
    //    cuadra, N>1 cuando conviene repartir heterogéneamente).
    let plannerJson = null;
    try {
      const planRes = await fetch(getApiUrl(`/api/v1/grupos/${selectedGrupo}/plan-rangos`), {
        headers: { 'Accept': 'application/json' }, credentials: 'include',
      });
      if (planRes.ok) plannerJson = await planRes.json();
    } catch (err) {
      console.warn('[OptCurso] planner falló, usaré fallback de 1 tramo:', err);
    }
    const plannerRangos = plannerJson?.rangos ?? [];
    const plannerOk = plannerRangos.length > 0;

    // Fallback si el planner no devolvió nada utilizable: 1 tramo cubriendo
    // grupo.fechaInicio→grupo.fechaFin (o desde hoy + semanasRefCentro días
    // si el grupo no tiene fechas). El distribuidor reparte uniformemente
    // ese único tramo — equivalente a "cuota uniforme escalada", como mi
    // versión simple anterior. Es degradación graceful, no debería ser el
    // caso típico (el planner sí responde si está bien configurado).
    const semanasRef = cabida.semanasRefCentro || semanasReferenciaCentro || 36;
    const grupoIniISO = grupo.fechaInicio?.slice(0, 10);
    const grupoFinISO = grupo.fechaFin?.slice(0, 10);
    let tramos;
    if (plannerOk) {
      tramos = plannerRangos.map((r, i) => ({
        nombre: r.nombre || `Tramo ${i + 1}`,
        fechaInicio: r.fechaInicio,
        fechaFin: r.fechaFin,
        jornadaTipoId: r.jornadaTipoId,
        etiqueta: r.etiqueta,
        razon: r.razon,
      }));
    } else {
      let iniISO, finISO;
      if (grupoIniISO && grupoFinISO) { iniISO = grupoIniISO; finISO = grupoFinISO; }
      else {
        const today = new Date();
        iniISO = today.toISOString().slice(0, 10);
        finISO = new Date(today.getTime() + Math.round(semanasRef * 7) * 86400000).toISOString().slice(0, 10);
      }
      tramos = [{ nombre: 'Curso completo', fechaInicio: iniISO, fechaFin: finISO, jornadaTipoId: null }];
    }
    // 3.b. NO se auto-extiende el último tramo. Una versión anterior lo hacía
    //      cuando detectaba déficit estructural (objetivoAnualPresencial >
    //      capacidadAnualSlots), pero esa extensión añadía días BRUTOS al
    //      calendario virtual. Si caían en zona no lectiva del calendario
    //      CCAA (típico: julio en FP), el `CalendarioLectivoService` los
    //      descontaba y la extensión sumaba 0 semanas lectivas reales —
    //      "cobertura aparente" que el banner del editor desmentía. El
    //      arreglo correcto requeriría consultar el calendario CCAA desde
    //      el frontend (out of scope Fase B). Mientras tanto: el distribuidor
    //      reparte lo posible con el calendario actual y el déficit residual
    //      lo reporta el banner anual como -Xh; las palancas reales (subir
    //      jornada / AUTÓNOMA / FCT / aceptar) las decide el admin.
    const extensionAplicada = null;
    const N = tramos.length;
    const jornadaIdEfectiva = resolveEffectiveJornadaId(grupo);

    // 4. Confirmar. Mensaje detalla N tramos + las palancas si hubiera
    //    déficit estructural; sugerencia de extensión del calendario cuando
    //    aplica (no inamovible — vive en Centro.fechaInicio/FinCurso).
    // huboExtension TIENE PREFERENCIA: si extendimos el último tramo para
    // cubrir el déficit estructural, las cuotas semanales se redistribuyen
    // heterogéneamente entre N tramos y no necesitan reducirse — la cabida
    // `feasible:false` del cálculo previo (que comparaba Σ cuotas semanales
    // contra jornada SIN saber de la extensión) deja de aplicar.
    const huboExtension = !!extensionAplicada;
    const huboReduccion = !cabida.feasible && !huboExtension;
    const sugExtension = cabida.semanasExtensionRecomendada;
    const confirmBodyDefault = (
      <div>
        <p>
          Esto reorganizará el curso en <strong>{N} tramo(s) (SEMANAs)</strong> con cuotas heterogéneas: las materias con menos horas legales se cursan más en los primeros tramos y dejan paso a las grandes en los últimos, maximizando la cobertura curricular.
        </p>
        <p>La PLANTILLA del grupo queda intacta como default. Cada tramo se persistirá como una SEMANA del modelo semanal puro al pulsar Guardar.</p>
        {extensionAplicada && (
          <p style={{ background: 'var(--bg-warning, #fff7ed)', padding: '8px 12px', borderRadius: 6 }}>
            <strong>⚠️ Auto-extensión aplicada</strong>: el currículo legal pide {Math.round(objetivoAnualMin / 60)}h pero el calendario actual solo da {Math.round(capacidadAnualMin / 60)}h en aula (déficit ~{Math.round(extensionAplicada.deficitMin / 60)}h). Para cubrirlo al 100%, el último tramo se extiende <strong>{extensionAplicada.semanasExtra} semana(s)</strong> ({fmtDateEs(extensionAplicada.finOriginal)} → <strong>{fmtDateEs(extensionAplicada.finExtendido)}</strong>). Si quieres respetar el calendario CCAA, edita <code>Centro.fechaFinCurso</code> en <code>/admin/centros</code> tras Guardar para que coincida.
          </p>
        )}
        <p>Tramos propuestos por el planner{extensionAplicada ? ' (con extensión aplicada en el último)' : ''}:</p>
        <ul>
          {tramos.map((r, i) => (
            <li key={i}>
              <strong>{r.nombre}</strong>: {fmtDateEs(r.fechaInicio)} → {fmtDateEs(r.fechaFin)}
              {r.razon ? ` — ${r.razon}` : ''}
            </li>
          ))}
        </ul>
        <p>¿Continuar?</p>
      </div>
    );
    const confirmBodyReducido = (
      <div>
        <p>
          El currículo legal pide <strong>{cabida.totalCuotaPresencialMin} min/sem</strong> pero la jornada solo tiene <strong>{jornadaSemMin} min/sem</strong>.
          Aun reorganizando en {N} tramos heterogéneos, parte del currículo puede no caber físicamente en aula.
        </p>
        <p>Para llegar al 100% sin reducir cuotas tienes varias palancas:</p>
        <ul>
          <li>
            {sugExtension && sugExtension > 0
              ? <>Extender el calendario lectivo del centro <strong>~{sugExtension} semana(s) más</strong> en <code>/admin/centros</code> (si el calendario CCAA lo permite).</>
              : <>Extender el calendario lectivo del centro en <code>/admin/centros</code> si el calendario CCAA lo permite.</>}
          </li>
          <li>Subir slots de la jornada del centro en <code>/admin/jornadas</code> (recortar recreos o añadir un slot al día).</li>
          <li>Marcar alguna materia como <strong>AUTÓNOMA</strong> o <strong>FCT</strong> en <code>/admin/imparticiones</code> — cuenta al currículo sin ocupar slot presencial.</li>
          <li>Aceptar el déficit ahora y completar la diferencia con trabajo autónomo del alumno (anexo del PDF).</li>
        </ul>
        <p>¿Continuar generando los {N} tramos con la mejor distribución posible?</p>
      </div>
    );
    const ok = await confirm({
      title: t('scheduleEditor.optimalConfirmTitle', { defaultValue: 'Configurar curso óptimo' }),
      body: huboReduccion ? confirmBodyReducido : confirmBodyDefault,
      confirmLabel: t('scheduleEditor.optimalConfirmLabel', { defaultValue: 'Sí, configurar' }),
      confirmVariant: huboReduccion ? 'warning' : 'primary',
      size: 'medium',
    });
    if (!ok) return;
    setCursoActionsOpen(false);

    console.group(`[OptCurso v3 modelo-semanal] grupo=${selectedGrupo} plantilla=${plantilla.id} N=${N}`);
    console.log('[OptCurso] cabida:', cabida);
    console.log('[OptCurso] tramos:', tramos);
    setConfiguringOptimal(true);
    setConfiguringStep('1/4');

    try {
      // 5. Construir N SEMANAs virtuales (tempIds negativos) con plantillaBase
      //    apuntando a la PLANTILLA real. plsToDelete vacío: la PLANTILLA NO
      //    se toca, y las SEMANAs anteriores (si las hubiera) tampoco se
      //    eliminan automáticamente — son excepciones que el admin gestiona
      //    aparte. Si quiere reseleccionar, primero borra a mano.
      const semanasVirtuales = tramos.map((tr, i) => {
        const tempId = tempIdSeqRef.current;
        tempIdSeqRef.current -= 1;
        // Fase B FP 2º (2026-05-12): el rango 'no_presenciales' (Tercera
        // evaluación) hereda la jornada del grupo igual que las demás
        // SEMANAs. El admin la cambia con "Editar PL" a una jornada
        // custom (p.ej. "FP 3ª evaluación" con slots 08:30-15:30 +
        // 18:00-20:00) para reflejar el horario real de prácticas+proyecto.
        // Sin esta jornada heredada el rango nacía sin rejilla y el admin
        // no podía arrastrar las no presenciales (FCT, Proyecto, HLC).
        const jornadaIdEfectivaSemana = tr.jornadaTipoId || jornadaIdEfectiva;
        return {
          tempId, id: tempId, _pending: 'create',
          tipo: 'semana',
          plantillaBase: `/api/periodo_lectivos/${plantilla.id}`,
          nombre: tr.nombre,
          fechaInicio: tr.fechaInicio,
          fechaFin: tr.fechaFin,
          jornadaTipo: jornadaIdEfectivaSemana ? { id: jornadaIdEfectivaSemana } : null,
          jornadaTipoId: jornadaIdEfectivaSemana,
          orden: i + 1,  // 0 reservado a la PLANTILLA conceptualmente
          semanaNumero: i + 1,
          etiqueta: tr.etiqueta || null,
          _plannerEtiqueta: tr.etiqueta,
          _plannerRazon: tr.razon,
        };
      });

      // 6. Distribuir currículo heterogéneamente entre las N SEMANAs (dry-run).
      //    Reintenta extendiendo el último tramo si el distribuidor pide
      //    extendBy>0 (hasta MAX intentos). Si tras ello no es feasible,
      //    avanza con la distribución parcial — igual que el flujo viejo.
      setConfiguringStep('2/4');
      let distribution = null, attempts = 0, lastSig = null, lastDistJson = null;
      const MAX = 12;
      while (attempts < MAX) {
        const distRes = await fetch(getApiUrl(`/api/v1/grupos/${selectedGrupo}/distribute-curriculum-dry-run`), {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({
            // Filtrar rangos no_presenciales (Fase A FP 2º): el distribuidor
            // opera sobre presenciales — la Tercera evaluación de FP 2º es
            // un contenedor temporal para FCT/Proyecto/HLC sin slots de aula.
            rangos: semanasVirtuales
              .filter(s => s.etiqueta !== 'no_presenciales')
              .map(s => ({
                tempId: s.tempId, nombre: s.nombre,
                fechaInicio: s.fechaInicio, fechaFin: s.fechaFin,
                jornadaTipoId: s.jornadaTipoId,
              })),
          }),
        });
        if (!distRes.ok) {
          toast.error(t('scheduleEditor.distributeError', { defaultValue: 'No se pudo distribuir el currículo entre los tramos.' }));
          return;
        }
        const distJson = await distRes.json();
        lastDistJson = distJson;
        console.log(`[OptCurso] distribute attempt ${attempts + 1}:`, distJson);
        if (distJson.feasible) { distribution = distJson.distribution; break; }
        const sig = JSON.stringify(distJson.shortfalls || {});
        if (distJson.extendBy > 0 && sig === lastSig) {
          console.warn('[OptCurso] distribuidor atascado, uso parcial.');
          break;
        }
        lastSig = sig;
        if (distJson.extendBy > 0 && attempts < MAX - 1) {
          // Extender el último tramo virtual los días pedidos. NO se toca
          // Grupo.fechaFin (el modelo semanal evita esa palanca aquí; la
          // sugerencia de extensión la hace el admin manualmente en /centros).
          const last = semanasVirtuales[semanasVirtuales.length - 1];
          const lf = new Date(last.fechaFin);
          lf.setDate(lf.getDate() + distJson.extendBy);
          last.fechaFin = lf.toISOString().slice(0, 10);
          attempts++;
          continue;
        }
        break;
      }
      if (!distribution && lastDistJson?.distribution) {
        distribution = lastDistJson.distribution;
        // Mensaje distinto según razón del distribuidor:
        //   - capacityShortfall = el currículo NO cabe en la ventana lectiva
        //     (Σ horas presencial > cap calendario × jornada). Reportar
        //     deficit agregado en horas + sugerir palancas, no listar full
        //     horas por materia (que serían las horas totales del módulo —
        //     señal alarmante e inútil para el admin).
        //   - redistributionShortfall = cabe globalmente pero el greedy
        //     dejó algunas materias por debajo de su target (caso típico
        //     de granularidad gruesa por slotMin=60). Listar las afectadas
        //     con cuánto les falta es accionable.
        if (lastDistJson?.reason === 'capacityShortfall') {
          const deficitMin = lastDistJson?.debug?.deficitMin || 0;
          const sumObjMin = lastDistJson?.debug?.sumObjetivosMin || 0;
          const capMin = lastDistJson?.debug?.capAnualMin || 0;
          toast.error(t('scheduleEditor.distributeCapacityShortfall', {
            defaultValue: 'El currículo presencial ({{currH}}h) no cabe en la ventana lectiva ({{capH}}h disponibles, faltan {{deficitH}}h). Acciones: ampliar la jornada del centro, revisar `materia.horasTotales` (puede estar sobreestimado), o pasar materias a modalidad FCT/Autónoma/No regular.',
            currH: Math.round(sumObjMin / 60),
            capH: Math.round(capMin / 60),
            deficitH: Math.round(deficitMin / 60),
          }), { duration: 14000 });
        } else {
          // redistributionShortfall o reasons futuras: listar materias.
          const sf = Object.entries(lastDistJson.shortfalls || {})
            .map(([impId, m]) => {
              const imp = imps.find(i => String(i.id) === String(impId));
              return `${imp?.materia?.nombre || `imp ${impId}`}: ${Math.round(m / 60 * 10) / 10}h`;
            }).join(', ');
          if (sf) {
            toast.warning(t('scheduleEditor.distributePartial', {
              defaultValue: 'Distribución parcial: faltan por cubrir {{materias}}. El solver hará lo que pueda; ajusta a mano lo que falte.',
              materias: sf,
            }), { duration: 10000 });
          }
        }
      }
      if (!distribution) {
        toast.error(t('scheduleEditor.distributeShortfall', {
          defaultValue: 'El currículo no cabe ni reorganizando ({{detail}}).',
          detail: lastDistJson?.debug?.error || lastDistJson?.reason || 'sin detalle',
        }));
        return;
      }
      const distribuidorIssue = (lastDistJson?.feasible === false)
        ? {
            feasible: false,
            reason: lastDistJson.reason || null,
            extendBy: lastDistJson.extendBy || 0,
            shortfalls: Object.entries(lastDistJson.shortfalls || {}).map(([impId, m]) => {
              const imp = imps.find(i => String(i.id) === String(impId));
              return {
                impId: Number(impId),
                materia: imp?.materia?.nombre || `imp ${impId}`,
                horasFaltantes: Math.round((Number(m) || 0) / 60 * 10) / 10,
                minutosFaltantes: Number(m) || 0,
              };
            }),
          } : null;

      // 7. pendingTx con plsToCreate (las N SEMANAs nuevas) + plsToDelete
      //    (las SEMANAs vivas existentes del grupo + las PLANTILLAs duplicadas
      //    si las hay). La PLANTILLA elegida (`plantilla.id`) NO se borra:
      //    es la que conservamos como default del grupo. Si por bugs previos
      //    quedaron varias PLANTILLAs en BD, este paso las consolida.
      //    Usamos `frescosPls` (BD directa) en lugar de `plByGrupo[selectedGrupo]`
      //    porque el state local es asíncrono y puede estar stale.
      const aBorrar = (frescosPls || []).filter(p =>
        isSemana(p) || (isPlantilla(p) && p.id !== plantilla.id)
      );
      const pendingTx = {
        grupoFechaFin: null,
        grupoFechaFinOriginal: grupo.fechaFin,
        plsToDelete: aBorrar.map(p => p.id),
        plsRealesOriginales: aBorrar,
        plsToCreate: semanasVirtuales,
        pliPatches: [],
      };
      for (const [plKeyStr, byImp] of Object.entries(distribution)) {
        const plKey = Number(plKeyStr);
        for (const [impIdStr, minutos] of Object.entries(byImp)) {
          pendingTx.pliPatches.push({
            plKey, imparticionId: Number(impIdStr), minutosSemanales: Number(minutos),
          });
        }
      }
      setPlByGrupo(prev => ({ ...prev, [selectedGrupo]: [...(prev[selectedGrupo] || []), ...semanasVirtuales] }));

      // 8. Solver iterativo-multi sobre los N rangoOverride (cada uno
      //    representa una SEMANA virtual con sus cuotas asignadas por el
      //    distribuidor).
      setConfiguringStep('3/4');
      const totalSemanasGrupo = semanasVirtuales.reduce((acc, s) =>
        acc + getSemanasOfPl(s, semanasRef), 0);
      const rangosBody = semanasVirtuales.map(s => {
        const distForPl = distribution[s.tempId] || {};
        const plisBody = Object.entries(distForPl).map(([impId, m]) => ({
          imparticionId: Number(impId), minutosSemanales: Number(m),
        }));
        return {
          rangoOverride: {
            tempId: s.tempId, nombre: s.nombre,
            fechaInicio: s.fechaInicio, fechaFin: s.fechaFin,
            jornadaTipoId: s.jornadaTipoId,
            plis: plisBody,
          },
        };
      });
      const multiRes = await fetch(getApiUrl(`/api/v1/horarios/solver-iterativo-multi/${selectedGrupo}`), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          rangos: rangosBody,
          maxIterations: 6,
          totalSemanasGrupoOverride: totalSemanasGrupo,
        }),
      });
      if (!multiRes.ok) {
        const txt = await multiRes.text().catch(() => '');
        toast.error(t('scheduleEditor.solverError', { defaultValue: 'El solver ha fallado en alguno de los tramos.' }));
        console.error('[OptCurso] solver-iterativo-multi FAIL:', multiRes.status, txt);
        return;
      }
      const multiJson = await multiRes.json();
      console.log('[OptCurso] solver:', multiJson);

      // 9. Mapear placements a state[gid_tempId] de cada SEMANA virtual.
      setConfiguringStep('4/4');
      const reports = [];
      for (const s of semanasVirtuales) {
        const matchKey = `temp:${s.tempId}`;
        const r = (multiJson.perPl || []).find(p => p.plKey === matchKey);
        if (!r) {
          console.warn(`[OptCurso] tramo ${s.tempId} no encontrado en respuesta`);
          continue;
        }
        const placements = {};
        (r.placements || []).forEach(p => {
          const hi = String(p.horaInicio).slice(0, 8);
          placements[`${p.diaSemana}_${hi}`] = {
            imparticionId: p.imparticionId,
            aula: p.aula,
            horaInicio: hi,
            horaFin: String(p.horaFin).slice(0, 8),
          };
        });
        setState(prev => ({
          ...prev,
          [`${selectedGrupo}_${s.tempId}`]: { placements, baseline: {}, dirty: true },
        }));
        reports.push({
          plId: s.tempId,
          plNombre: s.nombre,
          plFechaInicio: s.fechaInicio,
          plFechaFin: s.fechaFin,
          complete: !!r.complete,
          placedCount: (r.placements || []).length,
          unplacedCount: (r.unplaced || []).length,
          unplaced: r.unplaced || [],
          diagnostic: r.diagnostic || null,
          iterationLog: r.iterationLog || [],
          iterationsRun: r.iterativo?.iterationsRun || 0,
        });
      }

      setPendingTxByGrupo(prev => ({ ...prev, [selectedGrupo]: pendingTx }));
      if (semanasVirtuales[0]) {
        setSelectedPlByGrupo(prev => ({ ...prev, [selectedGrupo]: String(semanasVirtuales[0].tempId) }));
      }

      // 10. Modal de informe si bottleneck o crossRangoShortfalls residuales
      //     o el distribuidor reportó shortfall que el solver no logró cubrir.
      const conProblemas = reports.filter(r => !r.complete
        || (r.diagnostic?.primaryBottleneck && r.diagnostic.primaryBottleneck !== 'NONE'));
      const crossRangoShortfalls = multiJson.crossRangoShortfalls || [];
      const distribuidorEffective = (distribuidorIssue && crossRangoShortfalls.length > 0)
        ? distribuidorIssue : null;
      const shouldOpenReport = conProblemas.length > 0 || crossRangoShortfalls.length > 0;

      if (shouldOpenReport) {
        const grupoNombre = grupos.find(g => String(g.id) === String(selectedGrupo));
        setSolverReportData({
          grupoNombre: grupoNombre ? `${grupoNombre.curso ?? ''}º ${grupoNombre.abreviatura || grupoNombre.nombre || ''}`.trim() : '',
          autoSave: false, savedCount: 0,
          totalPls: reports.length,
          plsConProblemas: conProblemas.length,
          perPl: reports,
          distribuidor: distribuidorEffective,
          crossRangoShortfalls,
        });
        setSolverReportExpandedPl(conProblemas[0]?.plId ?? reports[0]?.plId ?? null);
        setSolverReportOpen(true);
        toast.warning(t('scheduleEditor.optimalPreviewReadyWithIssues', {
          defaultValue: 'Preview lista con {{count}} tramo(s) con problemas. Revisa el informe.',
          count: conProblemas.length,
        }), { duration: 6000 });
      } else {
        toast.success(t('scheduleEditor.optimalPreviewReady', {
          defaultValue: 'Preview lista. Pulsa "Guardar" para persistir o "Descartar" para revertir.',
        }), { duration: 6000 });
      }

      // Aviso adicional si se extendió el último tramo más allá del
      // calendario actual del centro/grupo: el admin debe saber que para
      // legalidad CCAA tendría que extender Centro.fechaFinCurso a mano.
      if (extensionAplicada) {
        toast.warning(t('scheduleEditor.optimalExtensionAplicada', {
          defaultValue: '⚠️ Se extendió el último tramo {{sem}} sem ({{fini}} → {{fext}}) para cubrir el currículo legal completo. Edita Centro.fechaFinCurso en /admin/centros si quieres respetar el calendario CCAA.',
          sem: extensionAplicada.semanasExtra,
          fini: fmtDateEs(extensionAplicada.finOriginal),
          fext: fmtDateEs(extensionAplicada.finExtendido),
        }), { duration: 12000 });
      }
    } catch (err) {
      console.error('[OptCurso] FAIL:', err);
      toast.error(err.message || t('scheduleEditor.optimalGenericError', { defaultValue: 'Error generando el curso óptimo.' }));
    } finally {
      setConfiguringOptimal(false);
      setConfiguringStep(null);
      console.groupEnd();
    }
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

  // Bloques contiguos (2026-05-01): un placement puede abarcar N slots de
  // 30min. El placement vive en el state con key = `${dia}_${horaInicioBloque}`
  // y `horaFin` = fin del bloque. Para renderizar la rejilla, cada slot de
  // 30min llama a findCoveringPlacement que detecta si está cubierto por algún
  // bloque (sea inicio o continuación). Las celdas continuación renderizan
  // un SlotBlock con isContinuation=true (sin texto, sin border-top).
  const findCoveringPlacement = (dia, horaInicioStr) => {
    for (const [key, p] of Object.entries(placements)) {
      const sep = key.indexOf('_');
      if (sep <= 0) continue;
      if (Number(key.slice(0, sep)) !== dia) continue;
      const pHi = key.slice(sep + 1);
      // pHi y horaInicioStr están en formato "HH:MM:SS" — comparación lex OK.
      if (pHi <= horaInicioStr && (p.horaFin || '') > horaInicioStr) {
        return { key, p, isStart: pHi === horaInicioStr };
      }
    }
    return null;
  };

  const renderSlotContent = (dia, slotIdx) => {
    const horaInicioStr = slotsDia[slotIdx][0];
    const found = findCoveringPlacement(dia, horaInicioStr);
    if (!found) return null;
    const { key, p, isStart } = found;
    const imp = imps.find(i => i.id === p.imparticionId);
    if (!imp) return null;
    return (
      <SlotBlock
        slotId={key}
        imparticion={imp}
        color={colorForModule(imp.materia?.id || p.imparticionId)}
        aula={p.aula}
        isContinuation={!isStart}
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
          breadcrumbs={embedded ? [
              { label: t('sidebar.home'), to: '/' },
              { label: t('sidebar.scheduleAdmin') },
          ] : [
              { label: t('sidebar.home'), to: '/' },
              { label: t('scheduleEditor.title') },
          ]}
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
              {(() => {
                // Modelo semanal puro (Fase D mejora 2026-05-06): ocultamos
                // la PLANTILLA del strip cuando hay SEMANAs vivas que cubren
                // el calendario. La PLANTILLA sigue existiendo en BD como
                // singleton + ancla FK + fallback del resolver, pero la UI
                // del editor solo la enseña como pill si NO hay SEMANAs
                // (caso edge: grupo recién creado sin haber ejecutado
                // "Configurar curso óptimo"). Esto mantiene "5 rangos · ..."
                // limpio (= solo las SEMANAs reales del año) y evita
                // confundir al admin con un pill que en la práctica está
                // tapado por las SEMANAs.
                const todosLosPls = plByGrupo[selectedGrupo] || [];
                const haySemanas = todosLosPls.some(p => isSemana(p));
                const plsVisibles = haySemanas
                  ? todosLosPls.filter(p => !isPlantilla(p) || p._pending)
                  : todosLosPls;
                return plsVisibles;
              })().map(pl => {
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
                    title={isPlantilla(pl)
                      ? t('scheduleEditor.plantillaTooltip', { defaultValue: 'Plantilla del curso (horario por defecto)' })
                      : `${fmtDateEs(pl.fechaInicio)} → ${fmtDateEs(pl.fechaFin)}`}
                  >
                    <div className={styles.plPillBody}>
                      <span className={styles.plPillName}>{pl.nombre}</span>
                      <span className={styles.plPillDates}>
                        {isPlantilla(pl)
                          ? t('scheduleEditor.plantillaSubtitle', { defaultValue: 'Por defecto' })
                          : `${fmt(pl.fechaInicio)} – ${fmt(pl.fechaFin)}`}
                      </span>
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
                        {!isPlantilla(pl) && (
                          <button
                            type="button"
                            className={`${styles.plPillActionBtn} ${styles.plPillActionDanger}`}
                            onClick={(e) => { e.stopPropagation(); handleDeletePl(pl); }}
                            aria-label={t('scheduleEditor.deleteRango', { defaultValue: 'Borrar rango' })}
                            title={t('scheduleEditor.deleteRango', { defaultValue: 'Borrar rango' })}
                            disabled={isDeleting}
                          >
                            <Trash2 size={13} />
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
            <div className={styles.cursoActionsWrapper} ref={cursoActionsBtnRef}>
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
                  <div className={styles.cursoActionsMenu} role="menu" style={cursoActionsMenuStyle || undefined}>
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
                      onClick={() => { setCursoActionsOpen(false); setAdjuntarModalOpen(true); }}
                      title={t('scheduleEditor.attachToGroupTitle', {
                        defaultValue: 'Replica el horario completo de otro grupo del centro mapeando materias por código LOMLOE — útil para grupos hermanos (1º DAW + 1º DAM, etc.)',
                      })}
                    >
                      <Copy size={14} />
                      <span>{t('scheduleEditor.attachToGroupAction', {
                        defaultValue: 'Adjuntar a grupo existente',
                      })}</span>
                    </button>
                    {/* "Crear Rangos Recomendados" ocultado 2026-05-12 por
                        decisión UX: solapaba con "Configurar curso óptimo"
                        (este último crea rangos alineados con evaluaciones,
                        que es lo que se quiere casi siempre). El handler
                        `handleCreateRecommendedRangos` se mantiene por si
                        se reactiva el botón en el futuro.
                    <button
                      type="button"
                      className={styles.cursoActionsItem}
                      onClick={() => { setCursoActionsOpen(false); setCreateRangosCount(3); setCreateRangosModalOpen(true); }}
                    >
                      <CalendarDays size={14} />
                      <span>{t('scheduleEditor.createRecommendedAction', { defaultValue: 'Crear Rangos Recomendados' })}</span>
                    </button>
                    */}
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
                  defaultValue: '{{create}} crear · {{update}} editar · {{del}} borrar · {{patches}} ajustes minutos · {{toggles}} activar/desactivar',
                  create: pendingTxByGrupo[selectedGrupo]?.plsToCreate?.length || 0,
                  update: pendingTxByGrupo[selectedGrupo]?.plsToUpdate?.length || 0,
                  del: pendingTxByGrupo[selectedGrupo]?.plsToDelete?.length || 0,
                  patches: pendingTxByGrupo[selectedGrupo]?.pliPatches?.length || 0,
                  toggles: pendingTxByGrupo[selectedGrupo]?.pliToggles?.length || 0,
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
                    informativo. NO se planifican en slots NI cuentan en el
                    banner anual (filtro `consumeAulaModalidad` en `curriculumMin`
                    desde 2026-05-11): se entregan fuera del horario semanal y
                    su seguimiento es responsabilidad del centro/profesor. */}
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
                        // Minutos colocados cross-rango (Fase B 2026-05-12):
                        // mismo cálculo que ModuleChip para coherencia visual.
                        // Suma placements de TODOS los rangos del grupo.
                        minutosColocados={minutosAnualesColocadosByImp[imp.id] || 0}
                        color={colorForModule(imp.materia?.id || imp.id)}
                        t={t}
                        // Fase B FP 2º (2026-05-12): solo arrastrable cuando el PL
                        // activo es 'no_presenciales' (Tercera evaluación). En
                        // rangos lectivos las no presenciales NO se arrastran
                        // (FCT no va en un rango con clases regulares).
                        draggable={selectedPl?.etiqueta === 'no_presenciales'}
                        // Tap-mode (Fase B 2026-05-12): reusa el mismo
                        // `selectedImpId` que ModuleChip — al hacer click en
                        // una celda vacía, `handleTapCell` coloca la imp
                        // seleccionada sin necesidad de arrastrar.
                        selected={selectedImpId === imp.id}
                        onSelect={selectedPl?.etiqueta === 'no_presenciales' ? handleSelectModule : undefined}
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
                <div className={styles.gridHeaderCell}>Hora</div>
                {DIAS.map(d => {
                  const full = t(d.i18n);
                  return (
                    <div key={`hd-${d.idx}`} className={styles.gridHeaderCell}>
                      <span className={styles.dayFull}>{full}</span>
                      <span className={styles.dayShort}>{full.charAt(0).toUpperCase()}</span>
                    </div>
                  );
                })}
                {(() => {
                  // Refactor 2026-05-01: rejilla del admin reescrita a UN
                  // único CSS Grid (vs múltiples .gridRow). Permite que los
                  // bloques de 60-120min ocupen N filas físicas con
                  // gridRow: span N (las celdas continuación retornan null).
                  // Visualmente: bloques continuos sin gaps internos, igual
                  // que TimeTable / PDF.
                  let slotIdxCounter = -1;
                  // Helper: cuántos slots de slotsDia cubre un placement.
                  const calcSlotSpan = (p) => {
                    if (!p || !p.horaFin || !p.horaInicio) return 1;
                    let n = 0;
                    for (const s of slotsDia) {
                      if (s[0] < p.horaInicio) continue;
                      if (s[0] >= p.horaFin) break;
                      n++;
                    }
                    return Math.max(1, n);
                  };
                  return tramosOrdenados.map((tramo, tramoPos) => {
                    if (tramo.tipo === 'recreo') {
                      return (
                        <React.Fragment key={`recreo-${tramoPos}`}>
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
                        </React.Fragment>
                      );
                    }
                    slotIdxCounter += 1;
                    const slotIdx = slotIdxCounter;
                    return (
                      <React.Fragment key={`slot-${slotIdx}`}>
                        <div className={styles.timeLabel}>
                          <span>{fmtHora(tramo.horaInicio)}</span>
                          <span className={styles.timeLabelSep}>–</span>
                          <span>{fmtHora(tramo.horaFin)}</span>
                        </div>
                        {DIAS.map((d) => {
                          // Si la celda está cubierta por un bloque que
                          // empezó en un slot anterior, no renderizar nada
                          // (el bloque la ocupa con gridRow: span N).
                          const found = findCoveringPlacement(d.idx, tramo.horaInicio);
                          if (found && !found.isStart) return null;
                          const span = found ? calcSlotSpan(found.p) : 1;
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
                              onContextMenu={(e) => handleContextMenuPlacement(e, d.idx, slotIdx)}
                              gridRowSpan={span}
                            />
                          );
                        })}
                      </React.Fragment>
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
                        : j.turno === 'especial'
                          ? t('scheduleEditor.turnoSpecial')
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
                  <span><b>{t('scheduleEditor.turno')}:</b> {
                    turnoGrupo === 'T' ? t('scheduleEditor.turnoAfternoon')
                    : turnoGrupo === 'E' ? t('scheduleEditor.turnoSpecial')
                    : t('scheduleEditor.turnoMorning')
                  }</span>
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
                      // Botones "Sugerir" (runSolver) y "Sugerir todo el curso"
                      // (runSolverAllRangos) ocultados 2026-05-12 por decisión
                      // UX: solapan con "Configurar curso óptimo" (que combina
                      // crear+distribuir+solver). Las funciones se mantienen
                      // por si se reactivan en el futuro (también las usa
                      // "Configurar curso óptimo" internamente).
                      // Variable `solverHardBlocked`/`baseDisabled`/`blockTitle`
                      // se calculan más arriba; quedan sin uso visible pero
                      // sin coste material para evitar churn al reactivar.
                      void solverHardBlocked; void baseDisabled; void blockTitle;
                      return null;
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
                    label: `${j.nombre} · ${
                      j.turno === 'tarde' ? t('scheduleEditor.turnoAfternoon')
                      : j.turno === 'especial' ? t('scheduleEditor.turnoSpecial')
                      : t('scheduleEditor.turnoMorning')
                    }`,
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
                      // Key compuesta: fuerza re-mount del input cuando el overlay
                      // de pendingTx cambia el valor efectivo (uncontrolled pattern).
                      const inputKey = `${pliModalPlId}_${row.imp.id}_${row.effectiveMin}_${row.isOverride ? 'ovr' : 'def'}_${pliModalSemanasRango}`;
                      return (
                        <tr key={row.imp.id} className={row.isActive ? '' : styles.pliRowInactive}>
                          <td className={styles.pliColActive}>
                            <label className={styles.pliCheckbox}>
                              <input
                                type="checkbox"
                                checked={row.isActive}
                                onChange={() => togglePliInTx(row.imp.id, !row.isActive)}
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
                              disabled={!row.isActive || pliModalSemanasRango <= 0}
                              onBlur={(e) => {
                                if (pliModalSemanasRango <= 0) return;
                                const raw = e.target.value.trim();
                                if (raw === '') {
                                  if (row.isOverride) setPliMinutosInTx(row.imp.id, null);
                                  return;
                                }
                                const horas = parseFloat(raw.replace(',', '.'));
                                if (!Number.isFinite(horas) || horas < 0) return;
                                // Convertir a min/sem (BD trabaja en minutos semanales).
                                const minSem = Math.round(horas * 60 / pliModalSemanasRango);
                                if (row.isOverride && row.effectiveMin === minSem) return;  // no-op si ya coincide con override
                                if (!row.isOverride && minSem === row.defaultMin) return;  // no-op si igual al default
                                setPliMinutosInTx(row.imp.id, minSem);
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
                                onClick={() => setPliMinutosInTx(row.imp.id, null)}
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

        {/* Modal "Informe del solver" — Fase 4 solver-iterativo (2026-05-01).
            Se abre tras runSolverAllRangos cuando algún PL no completó.
            Muestra resumen per-PL + bottleneck + sugerencias accionables +
            log de pasadas (collapsible). Reemplaza los toasts per-PL. */}
        <ModalView
          isOpen={solverReportOpen}
          onClose={() => setSolverReportOpen(false)}
          title={t('scheduleEditor.solverReportTitle', {
            defaultValue: 'Informe del solver — {{grupo}}',
            grupo: solverReportData?.grupoNombre || '',
          })}
          cancelText={t('common.close', { defaultValue: 'Cerrar' })}
          size="large"
        >
          {solverReportData && (
            <div className={styles.solverReportBody}>
              <p className={styles.solverReportIntro}>
                {t('scheduleEditor.solverReportIntro', {
                  defaultValue: 'El solver procesó {{total}} rangos. {{conIssues}} no quedaron completos. Revisa cada uno para entender qué falla y qué hacer al respecto.',
                  total: solverReportData.totalPls,
                  conIssues: solverReportData.plsConProblemas,
                })}
              </p>

              {/* Sección "Cobertura curricular del distribuidor" — Parte A
                  hotfix 2026-05-01. Se muestra cuando el distribuidor
                  dio feasible=false (currículo no cabe en el calendario).
                  Aunque el solver complete con cuotas reducidas, el
                  shortfall del currículo merece ser visible. */}
              {solverReportData.distribuidor && (
                <div className={`${styles.solverReportItem} ${styles.solverReportItemIssue}`}>
                  <div className={styles.solverReportItemHeader} style={{ cursor: 'default' }}>
                    <span className={styles.solverReportItemHeaderTitle}>
                      <AlertTriangle size={14} style={{ marginRight: 6 }} />
                      <strong>{t('scheduleEditor.solverReportDistribuidorTitle', { defaultValue: 'Cobertura curricular' })}</strong>
                      <span className={styles.solverReportItemMeta}>
                        {t('scheduleEditor.solverReportDistribuidorSummary', {
                          defaultValue: '{{count}} materia(s) con horas anuales no cubiertas',
                          count: solverReportData.distribuidor.shortfalls.length,
                        })}
                      </span>
                    </span>
                    <span className={styles.solverReportItemBottleneck}>
                      {t('scheduleEditor.solverReportDistribuidorBadge', { defaultValue: 'Currículo no cabe' })}
                    </span>
                  </div>
                  <div className={styles.solverReportItemBody}>
                    <div className={styles.solverReportSuggestions}>
                      <h4 className={styles.solverReportSuggestionsTitle}>
                        {t('scheduleEditor.solverReportDistribuidorIntroTitle', { defaultValue: 'Lo que está pasando' })}
                      </h4>
                      <p style={{ margin: 0, fontSize: 'var(--text-sm)', lineHeight: 1.5 }}>
                        {t('scheduleEditor.solverReportDistribuidorIntro', {
                          defaultValue: 'El currículo del grupo pide más horas anuales de las que caben en el calendario propuesto. El distribuidor ha repartido lo que sí entra; las materias siguientes quedan por debajo de su currículo:',
                        })}
                      </p>
                    </div>
                    <div className={styles.solverReportUnplaced}>
                      <h4 className={styles.solverReportUnplacedTitle}>
                        {t('scheduleEditor.solverReportDistribuidorShortfallsTitle', { defaultValue: 'Materias con shortfall' })}
                      </h4>
                      <ul className={styles.solverReportUnplacedList}>
                        {solverReportData.distribuidor.shortfalls.map((s, idx) => (
                          <li key={idx}>{s.materia} — <strong>{s.horasFaltantes}h anuales sin cubrir</strong></li>
                        ))}
                      </ul>
                    </div>
                    <div className={styles.solverReportSuggestions}>
                      <h4 className={styles.solverReportSuggestionsTitle}>
                        {t('scheduleEditor.solverReportSuggestionsTitle', { defaultValue: 'Acciones sugeridas' })}
                      </h4>
                      <ul className={styles.solverReportSuggestionsList}>
                        {solverReportData.distribuidor.extendBy > 0 && (
                          <li>
                            {t('scheduleEditor.solverSuggestion.EXTEND_CALENDAR_DAYS', {
                              defaultValue: 'Extiende el calendario {{dias}} días naturales para absorber las horas que faltan.',
                              dias: solverReportData.distribuidor.extendBy,
                            })}
                          </li>
                        )}
                        <li>
                          {t('scheduleEditor.solverSuggestion.RAISE_JORNADA_GENERIC', {
                            defaultValue: 'Sube la jornada del centro (más horas/día) en /admin/jornadas.',
                          })}
                        </li>
                        <li>
                          {t('scheduleEditor.solverSuggestion.MARK_AS_NON_PRESENCIAL_GENERIC', {
                            defaultValue: 'Marca alguna de las materias afectadas como AUTÓNOMA o FCT en /admin/materias o /admin/imparticiones — cuentan al currículo sin ocupar slot presencial.',
                          })}
                        </li>
                      </ul>
                    </div>
                  </div>
                </div>
              )}

              {/* Cross-rango shortfalls — Parte B 2026-05-01. Materias con
                  cobertura anual < 95% del target distribuido. Distinto del
                  shortfall del distribuidor: aquí el distribuidor sí cuadró
                  pero el solver no pudo colocar todo (típicamente por
                  conflict profe parcial cross-rango). */}
              {solverReportData.crossRangoShortfalls?.length > 0 && (
                <div className={`${styles.solverReportItem} ${styles.solverReportItemIssue}`}>
                  <div className={styles.solverReportItemHeader} style={{ cursor: 'default' }}>
                    <span className={styles.solverReportItemHeaderTitle}>
                      <AlertTriangle size={14} style={{ marginRight: 6 }} />
                      <strong>{t('scheduleEditor.solverReportCrossRangoTitle', { defaultValue: 'Shortfall cross-rango' })}</strong>
                      <span className={styles.solverReportItemMeta}>
                        {t('scheduleEditor.solverReportCrossRangoSummary', {
                          defaultValue: '{{count}} materia(s) por debajo del 95% del currículo anual',
                          count: solverReportData.crossRangoShortfalls.length,
                        })}
                      </span>
                    </span>
                  </div>
                  <div className={styles.solverReportItemBody}>
                    <div className={styles.solverReportSuggestions}>
                      <p style={{ margin: 0, fontSize: 'var(--text-sm)', lineHeight: 1.5 }}>
                        {t('scheduleEditor.solverReportCrossRangoIntro', {
                          defaultValue: 'Aunque cada rango individual cuadra, las siguientes materias quedan por debajo de su currículo anual sumando todos los rangos. Suele indicar conflict de profesor que aparece en algunos rangos pero no en otros.',
                        })}
                      </p>
                    </div>
                    <div className={styles.solverReportUnplaced}>
                      <h4 className={styles.solverReportUnplacedTitle}>
                        {t('scheduleEditor.solverReportCrossRangoListTitle', { defaultValue: 'Materias afectadas' })}
                      </h4>
                      <ul className={styles.solverReportUnplacedList}>
                        {solverReportData.crossRangoShortfalls.map((s, idx) => (
                          <li key={idx}>
                            {s.materia || `imp ${s.imparticionId}`} — <strong>{s.coberturaPct}%</strong>
                            {' '}({s.horasFaltantes}h sin cubrir)
                          </li>
                        ))}
                      </ul>
                    </div>
                  </div>
                </div>
              )}

              <div className={styles.solverReportList}>
                {solverReportData.perPl.map(plRep => {
                  const isExpanded = solverReportExpandedPl === plRep.plId;
                  const hasIssues = !plRep.complete || (plRep.diagnostic?.primaryBottleneck && plRep.diagnostic.primaryBottleneck !== 'NONE');
                  const bottleneckTitle = plRep.diagnostic?.primaryBottleneck
                    ? t(`scheduleEditor.solverBottleneck.${plRep.diagnostic.primaryBottleneck}`, { defaultValue: plRep.diagnostic.primaryBottleneck })
                    : null;
                  return (
                    <div
                      key={plRep.plId}
                      className={`${styles.solverReportItem} ${hasIssues ? styles.solverReportItemIssue : styles.solverReportItemOk}`}
                    >
                      <button
                        type="button"
                        className={styles.solverReportItemHeader}
                        onClick={() => setSolverReportExpandedPl(isExpanded ? null : plRep.plId)}
                      >
                        <span className={styles.solverReportItemHeaderTitle}>
                          {hasIssues
                            ? <AlertTriangle size={14} style={{ marginRight: 6 }} />
                            : <CheckCircle2 size={14} style={{ marginRight: 6 }} />}
                          <strong>{plRep.plNombre}</strong>
                          <span className={styles.solverReportItemMeta}>
                            {t('scheduleEditor.solverReportItemSummary', {
                              defaultValue: '{{placed}} colocados · {{unplaced}} sin colocar · {{pasadas}} pasadas',
                              placed: plRep.placedCount,
                              unplaced: plRep.unplacedCount,
                              pasadas: plRep.iterationsRun,
                            })}
                          </span>
                        </span>
                        {bottleneckTitle && (
                          <span className={styles.solverReportItemBottleneck}>{bottleneckTitle}</span>
                        )}
                      </button>
                      {isExpanded && hasIssues && (
                        <div className={styles.solverReportItemBody}>
                          {plRep.diagnostic?.suggestions?.length > 0 && (
                            <div className={styles.solverReportSuggestions}>
                              <h4 className={styles.solverReportSuggestionsTitle}>
                                {t('scheduleEditor.solverReportSuggestionsTitle', { defaultValue: 'Acciones sugeridas' })}
                              </h4>
                              <ul className={styles.solverReportSuggestionsList}>
                                {plRep.diagnostic.suggestions.map((sug, idx) => (
                                  <li key={idx}>
                                    {t(`scheduleEditor.solverSuggestion.${sug.code}`, { ...sug.params, defaultValue: sug.code })}
                                  </li>
                                ))}
                              </ul>
                            </div>
                          )}
                          {plRep.unplaced?.length > 0 && (
                            <div className={styles.solverReportUnplaced}>
                              <h4 className={styles.solverReportUnplacedTitle}>
                                {t('scheduleEditor.solverReportUnplacedTitle', { defaultValue: 'Materias sin colocar' })}
                              </h4>
                              <ul className={styles.solverReportUnplacedList}>
                                {plRep.unplaced.map((u, idx) => (
                                  <li key={idx}>{u.materia} — <strong>{u.horasRestantes ?? (u.minutosRestantes / 60).toFixed(1)}h</strong></li>
                                ))}
                              </ul>
                            </div>
                          )}
                          {plRep.iterationLog?.length > 0 && (
                            <div className={styles.solverReportLog}>
                              <h4 className={styles.solverReportLogTitle}>
                                {t('scheduleEditor.solverReportLogTitle', { defaultValue: 'Log de pasadas' })}
                              </h4>
                              <table className={styles.solverReportLogTable}>
                                <thead>
                                  <tr>
                                    <th>{t('scheduleEditor.solverReportColPasada', { defaultValue: '#' })}</th>
                                    <th>{t('scheduleEditor.solverReportColBottleneck', { defaultValue: 'Bottleneck' })}</th>
                                    <th>{t('scheduleEditor.solverReportColAccion', { defaultValue: 'Acción' })}</th>
                                    <th>{t('scheduleEditor.solverReportColMateria', { defaultValue: 'Materia' })}</th>
                                    <th>{t('scheduleEditor.solverReportColMinutos', { defaultValue: 'Min/sem' })}</th>
                                    <th>{t('scheduleEditor.solverReportColUnplaced', { defaultValue: 'Sin colocar' })}</th>
                                  </tr>
                                </thead>
                                <tbody>
                                  {plRep.iterationLog.map((step, idx) => (
                                    <tr key={idx}>
                                      <td>{step.pasada}</td>
                                      <td>
                                        {step.bottleneck
                                          ? t(`scheduleEditor.solverBottleneck.${step.bottleneck}`, { defaultValue: step.bottleneck })
                                          : '—'}
                                      </td>
                                      <td>{step.accion || '—'}</td>
                                      <td>{step.target?.materia || '—'}</td>
                                      <td>
                                        {step.target?.minutosAntes != null
                                          ? `${step.target.minutosAntes} → ${step.target.minutosDespues}`
                                          : '—'}
                                      </td>
                                      <td>{step.unplacedCount ?? '—'}</td>
                                    </tr>
                                  ))}
                                </tbody>
                              </table>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </ModalView>

        <NuevaExcepcionModal
          isOpen={!!exceptionTarget}
          target={exceptionTarget}
          onClose={() => setExceptionTarget(null)}
          onSuccess={() => {
            // Refetch horarios del PL activo para que la rejilla refleje el
            // override sin pasar por el ciclo de Mercure (que aquí está mute
            // por el draft pendingTx). El refetch usa el efecto enlazado
            // a `state` + `selectedPlId`.
            setExceptionTarget(null);
          }}
        />

        <AdjuntarGrupoModal
          isOpen={adjuntarModalOpen}
          grupoDestino={grupo}
          centroId={(() => {
            if (!grupo) return null;
            const c = grupo.centro;
            if (!c) return user?.centro?.id ?? null;
            if (typeof c === 'object') return c.id ?? c['@id']?.split('/').pop();
            if (typeof c === 'string') return c.split('/').pop();
            return c;
          })()}
          onClose={() => setAdjuntarModalOpen(false)}
          onSuccess={async () => {
            setAdjuntarModalOpen(false);
            if (!selectedGrupo) return;
            // Tras adjuntar:
            //  1. Refetch directo de PLs nuevos (los viejos quedan soft-deleted).
            //  2. Selección manual del PL activo entre los recién clonados (el
            //     effect que normalmente re-elige PL tiene guard
            //     `plByGrupo[gid] !== undefined`, así que con setPlByGrupo el
            //     guard pasa y NO entra en el branch de selección por defecto).
            //  3. Limpiar caches state[gid_*] y capacityByGrupo[gid_*] para que
            //     el effect que carga horarios del PL activo (~línea 679) los
            //     vuelva a pedir y poble la rejilla.
            //  4. Refetch de horarios globales del grupo (chip de horas anuales).
            try {
              const r = await fetch(
                getApiUrl(`/api/periodo_lectivos?grupo=${selectedGrupo}&pagination=false&order[orden]=asc&order[fechaInicio]=asc`),
                { headers: { 'Accept': 'application/ld+json' }, credentials: 'include' },
              );
              if (r.ok) {
                const d = await r.json();
                const items = sortPlsForUi(d['hydra:member'] || d.member || []);
                setPlByGrupo(prev => ({ ...prev, [selectedGrupo]: items }));
                if (items.length > 0) {
                  const active = selectActivePl(items) || items[0];
                  setSelectedPlByGrupo(prev => ({ ...prev, [selectedGrupo]: active.id }));
                }
              }
            } catch (err) {
              console.error('Error refrescando PLs tras adjuntar:', err);
            }
            setState(prev => {
              const next = { ...prev };
              Object.keys(next).forEach(k => {
                if (k.startsWith(`${selectedGrupo}_`)) delete next[k];
              });
              return next;
            });
            setCapacityByGrupo(prev => {
              const next = { ...prev };
              Object.keys(next).forEach(k => {
                if (k.startsWith(`${selectedGrupo}_`)) delete next[k];
              });
              return next;
            });
            // Forzar refetch de allHorariosByGroup borrando la entrada (el
            // effect ~619 tiene guard `!== undefined`).
            setAllHorariosByGroup(prev => {
              const next = { ...prev };
              delete next[selectedGrupo];
              return next;
            });
          }}
        />
      </Container>
    </Wrapper>
  );
};

export default HorariosEditor;
