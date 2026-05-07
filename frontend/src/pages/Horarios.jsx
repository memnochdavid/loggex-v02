import React, { useEffect, useState, useRef, useCallback, useMemo } from 'react';
import styles from './Horarios.module.css';
import Button from '../components/Button';
import DataTable from '../components/DataTable';
import SearchBar from '../components/SearchBar';
import ThemedSelect from '../components/ThemedSelect';
import Layout from '../components/Layout';
import TimeTable from '../components/TimeTable';
import EventsSidebar from '../components/EventsSidebar';
import MateriaLabel from '../components/MateriaLabel';
import CalendarView from '../components/CalendarView';
import WeekStrip from '../components/WeekStrip';
import ModalView from '../components/ModalView';
import AsyncSearchSelect from '../components/AsyncSearchSelect';
import CrudHeader from '../components/CrudHeader';
import { useAuth } from '../context/AuthContext';
import useLiveRefetch from '../hooks/useLiveRefetch';
import { Plus, Edit2, Trash2, PanelRightOpen, PanelRightClose, Download } from 'lucide-react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { getApiUrl } from '../config/api';
import { downloadFileFromApi } from '../utils/downloadFile';
import useMediaQuery from '../hooks/useMediaQuery';
import { usePagination } from '../hooks/usePagination';
import Lottie from 'lottie-react';
import calendarAnimation from '../../public/time.json';
import { useTranslation } from 'react-i18next';
import { toast, parseErrorResponse } from '../utils/toast';
import { formatGrupoAbrev } from '../utils/grupo';
import { useConfirm } from '../context/ConfirmContext';

const Horarios = ({ embedded = false, tabs = null }) => {
  const { t, i18n } = useTranslation();
  const confirm = useConfirm();
  const navigate = useNavigate();
  const { user } = useAuth();
  const isSuperAdmin = user?.roles?.includes('ROLE_SUPERADMIN');
  const isAdmin = user?.roles?.includes('ROLE_ADMIN');
  const canEdit = isSuperAdmin || isAdmin;
  
  const isMobile = useMediaQuery('(max-width: 900px)');

  const [viewMode, setViewMode] = useState(embedded ? 'list' : 'calendar');
  const [searchParams, setSearchParams] = useSearchParams();
  // Lee ?fecha=YYYY-MM-DD una sola vez al montar — usado para arrancar
  // el calendar en la fecha de una notificación de incidencia propuesta.
  const initialDate = useMemo(() => {
      const f = searchParams.get('fecha');
      if (!f) return new Date();
      const d = new Date(f + 'T00:00:00');
      return Number.isNaN(d.getTime()) ? new Date() : d;
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const [selectedDate, setSelectedDate] = useState(initialDate);
  // ?excepcion=ID auto-abre el modal del placement sintético correspondiente.
  // Estado interno para que tras consumirlo limpie el query y no re-dispare.
  const [autoOpenExcepcionId, setAutoOpenExcepcionId] = useState(() => {
      const v = searchParams.get('excepcion');
      return v ? parseInt(v, 10) : null;
  });
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);

  const [horarios, setHorarios] = useState([]);
  const [mySchedule, setMySchedule] = useState([]);
  const [myScheduleSlots, setMyScheduleSlots] = useState(null);  // null = no hay jornada conocida → fallback hardcoded en TimeTable
  // Excepciones APROBADAS aplicables a los horarios del usuario.
  // Cargadas desde /api/my-schedule (Fase B intercambio-imparticiones, 2026-05-07).
  // El overlay se aplica en visibleSchedule cruzando (horarioBaseId, fechaConcreta) con la semana visible.
  const [excepciones, setExcepciones] = useState([]);
  // Alineación del calendar con el grid del TimeTable: si hay mañana+tarde,
  // el TimeTable muestra tabs encima del grid → offset al calendar para que
  // sus días queden a la altura del grid, no de los tabs.
  // Filtra mySchedule por el PeriodoLectivo activo en `selectedDate`. Sin
  // este filtro, un grupo con N rangos cronológicos (típico: 3 evaluaciones)
  // muestra los N placements solapados en la rejilla cuando el alumno/profe
  // navega por semanas — síndrome equivalente al del widget Home arreglado
  // antes (`docs/home-widgets-roadmap.md` §8). El backend ya envía
  // `periodoLectivoFechaInicio/Fin` por evento; aquí lo consumimos.
  // Filtra mySchedule por la fecha seleccionada respetando la cascada del
  // modelo semanal (refactor 2026-05-06):
  //   - Para cada (grupoId, imparticionId): si HAY un evento de SEMANA cuya
  //     fecha cubre `selectedDate`, mostrarlo.
  //   - Si NO hay SEMANA que cubra, fallback a la PLANTILLA del grupo.
  //   - Eventos legacy sin `periodoLectivoTipo` se incluyen tal cual (compat).
  // Sin esta lógica, PLANTILLA + SEMANAs aparecían duplicados en la rejilla
  // (la PLANTILLA tiene fechas NULL → siempre "matchea" cualquier fecha →
  // se mezclaba con la SEMANA correspondiente).
  const visibleSchedule = useMemo(() => {
    if (!Array.isArray(mySchedule) || mySchedule.length === 0) return mySchedule;
    const y = selectedDate.getFullYear();
    const m = String(selectedDate.getMonth() + 1).padStart(2, '0');
    const d = String(selectedDate.getDate()).padStart(2, '0');
    const dateISO = `${y}-${m}-${d}`;

    // Detectar qué (grupoId) tienen SEMANA cubriendo la fecha → para esos
    // grupos, ocultar la PLANTILLA. Para los demás, usar la PLANTILLA.
    const semanaActivaPorGrupo = new Set();
    for (const e of mySchedule) {
      if (e.periodoLectivoTipo !== 'semana') continue;
      if (!e.periodoLectivoFechaInicio || !e.periodoLectivoFechaFin) continue;
      if (dateISO < e.periodoLectivoFechaInicio || dateISO > e.periodoLectivoFechaFin) continue;
      if (e.grupoId != null) semanaActivaPorGrupo.add(String(e.grupoId));
    }

    const filtered = mySchedule.filter(e => {
      // Eventos sintéticos por excepción asignada (Fase B.2): el user es
      // sustituto/override en una excepción aprobada para fecha concreta.
      // Se muestran SOLO en la semana que contiene esa fecha exacta.
      if (e._overrideDate) {
        if (!e._overrideDate) return false;
        // Calcular el rango de la semana visible (lunes-domingo) y comprobar.
        const a = new Date(selectedDate);
        const curIso = a.getDay() === 0 ? 7 : a.getDay();
        const monday = new Date(a);
        monday.setDate(a.getDate() - (curIso - 1));
        const sunday = new Date(monday);
        sunday.setDate(monday.getDate() + 6);
        const isoOf = (d) => {
          const yy = d.getFullYear();
          const mm = String(d.getMonth() + 1).padStart(2, '0');
          const dd = String(d.getDate()).padStart(2, '0');
          return `${yy}-${mm}-${dd}`;
        };
        return e._overrideDate >= isoOf(monday) && e._overrideDate <= isoOf(sunday);
      }
      // Eventos sin tipo: legacy/compat — incluir.
      if (!e.periodoLectivoTipo) {
        if (!e.periodoLectivoFechaInicio || !e.periodoLectivoFechaFin) return true;
        return dateISO >= e.periodoLectivoFechaInicio && dateISO <= e.periodoLectivoFechaFin;
      }
      if (e.periodoLectivoTipo === 'plantilla') {
        // PLANTILLA: solo se muestra si NO hay SEMANA activa para su grupo.
        return !semanaActivaPorGrupo.has(String(e.grupoId));
      }
      // SEMANA: solo si su rango cubre la fecha.
      if (!e.periodoLectivoFechaInicio || !e.periodoLectivoFechaFin) return false;
      return dateISO >= e.periodoLectivoFechaInicio && dateISO <= e.periodoLectivoFechaFin;
    });

    // Overlay de excepciones APROBADAS para la semana visible (Fase B
    // intercambio-imparticiones 2026-05-07). Cada event lleva diaSemana
    // ISO 1-7; calculamos la fecha real de ese día dentro de la semana
    // que contiene `selectedDate` y cruzamos con `excepciones[]` por
    // (horarioBaseId, fechaConcreta).
    if (!Array.isArray(excepciones) || excepciones.length === 0) {
      return filtered;
    }

    // Mapa rápido (eventId|fechaISO) → excepción.
    const excIndex = new Map();
    for (const ex of excepciones) {
      if (ex?.horarioBaseId != null && ex?.fechaConcreta) {
        excIndex.set(`${ex.horarioBaseId}|${ex.fechaConcreta}`, ex);
      }
    }
    if (excIndex.size === 0) return filtered;

    // Lunes ISO de la semana de selectedDate.
    const anchor = new Date(selectedDate);
    const curIso = anchor.getDay() === 0 ? 7 : anchor.getDay();
    const monday = new Date(anchor);
    monday.setDate(anchor.getDate() - (curIso - 1));

    const dateOfIsoDay = (isoDay) => {
      const d = new Date(monday);
      d.setDate(monday.getDate() + (isoDay - 1));
      const yy = d.getFullYear();
      const mm = String(d.getMonth() + 1).padStart(2, '0');
      const dd = String(d.getDate()).padStart(2, '0');
      return `${yy}-${mm}-${dd}`;
    };

    return filtered.map((ev) => {
      // Eventos sintéticos asignados (Fase B.2 + Topic 1): añadir marcador
      // propio para que TimeTable los pinte con border + tag.
      // Si está PENDIENTE_APROBACION, usar tipo 'asignada_pendiente' para
      // estilo distinto (color tenue, dashed border) y exponer
      // _overrideExcepcionId/_overrideCanReject al modal para el botón Rechazar.
      if (ev._overrideAssigned) {
        const pendiente = ev._overrideEstado === 'pendiente';
        return {
          ...ev,
          _excepcion: {
            tipo: pendiente ? 'asignada_pendiente' : 'asignada',
            motivo: ev._overrideMotivo,
            profeOverride: null,
            excepcionId: ev._overrideExcepcionId,
          },
          _excepcionTipo: pendiente ? 'asignada_pendiente' : 'asignada',
        };
      }

      const evDateISO = dateOfIsoDay(ev.diaSemana);
      const overlay = excIndex.get(`${ev.id}|${evDateISO}`);
      if (!overlay) return ev;

      // Si la excepción está pendiente, marcamos el event regular del
      // titular con tipo `titular_pendiente` para que TimeTable lo pinte
      // con cinta de advertencia + tag "Cambio solicitado". No alteramos
      // materia ni profesor — sigue siendo la clase normal del titular,
      // solo con un overlay visual de "hay una solicitud sobre esto".
      //
      // Caso especial INTERCAMBIO bilateral: cualquier profe del grupo
      // puede rechazar (Plan B 2026-05-08). Exponemos los flags que el
      // modal del TimeTable usa para mostrar el botón "Rechazar".
      if (overlay.estado === 'pendiente') {
        const out = {
          ...ev,
          _excepcion: {
            ...overlay,
            tipo: 'titular_pendiente',
            excepcionId: overlay.id,
          },
          _excepcionTipo: 'titular_pendiente',
        };
        if (overlay.tipo === 'intercambio') {
          out._overrideExcepcionId = overlay.id;
          out._overrideCanReject = true;
        }
        return out;
      }

      // Aplica overlay copiando el event y mutando los campos según tipo.
      const out = { ...ev, _excepcion: overlay, _excepcionTipo: overlay.tipo };
      if (overlay.tipo === 'cancelado') {
        out._cancelado = true;
      } else if (overlay.tipo === 'sustitucion' && overlay.profeOverride) {
        out.profesor = overlay.profeOverride.nombre;
      } else if (overlay.tipo === 'intercambio' && overlay.imparticionEfectiva) {
        const ie = overlay.imparticionEfectiva;
        if (ie.materia) out.materia = ie.materia;
        if (ie.moduloAbrv) out.moduloAbreviatura = ie.moduloAbrv;
        if (ie.moduloId != null) out.moduloId = ie.moduloId;
        if (ie.profesor) out.profesor = ie.profesor;
      } else if (overlay.tipo === 'evento_especial') {
        out.materia = overlay.motivo || 'Evento especial';
        out.moduloAbreviatura = '';
        if (overlay.profeOverride) out.profesor = overlay.profeOverride.nombre;
      }
      return out;
    });
  }, [mySchedule, selectedDate, excepciones]);

  const hasBothShifts = useMemo(() => {
    if (!Array.isArray(visibleSchedule) || visibleSchedule.length === 0) return false;
    const morning = visibleSchedule.some(e => parseInt(e.horaInicio.split(':')[0]) < 15);
    const afternoon = visibleSchedule.some(e => parseInt(e.horaInicio.split(':')[0]) >= 15);
    return morning && afternoon;
  }, [visibleSchedule]);
  const [festivos, setFestivos] = useState([]);
  const [tareas, setTareas] = useState([]);
  const [imparticiones, setImparticiones] = useState([]);
  const [centros, setCentros] = useState([]);
  
  // Estado de carga único
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  
  const [selectedCentro, setSelectedCentro] = useState('');
  
  const [currentPage, setCurrentPage] = useState(1);
  const [totalItems, setTotalItems] = useState(0);
  
  const [itemsPerPage, setItemsPerPage] = usePagination('horarios');

  const [searchTerm, setSearchTerm] = useState('');
  const [searchField, setSearchField] = useState('aula');
  const [sortColumn, setSortColumn] = useState('id');
  const [sortDirection, setSortDirection] = useState('asc');

  // Refs para control de flujo
  const debounceTimeout = useRef(null);
  const prevSearchTerm = useRef(searchTerm);
  const prevSearchField = useRef(searchField);
  const abortController = useRef(null);

  const searchFields = [
      { value: 'aula', label: t('schedules.classroom') },
      { value: 'imparticion.materia.nombre', label: t('schedules.subject') },
      { value: 'imparticion.profesor.nombre', label: t('schedules.teacher') },
      { value: 'diaSemana', label: t('schedules.day') }
  ];

  const diasSemana = {
      1: t('days.monday'), 2: t('days.tuesday'), 3: t('days.wednesday'), 4: t('days.thursday'), 5: t('days.friday'), 6: t('days.saturday'), 7: t('days.sunday')
  };

  // Necesitamos mapeo inverso para búsqueda si se usa texto
  // Pero como los días están traducidos, la búsqueda por texto exacto puede ser compleja si el backend espera números.
  // Asumiremos que la búsqueda por 'diaSemana' espera números o el usuario busca por otros campos.
  // Si queremos mapeo inverso:
  const diasSemanaInverso = {
      [t('days.monday').toLowerCase()]: 1, 
      [t('days.tuesday').toLowerCase()]: 2, 
      [t('days.wednesday').toLowerCase()]: 3, 
      [t('days.thursday').toLowerCase()]: 4, 
      [t('days.friday').toLowerCase()]: 5, 
      [t('days.saturday').toLowerCase()]: 6, 
      [t('days.sunday').toLowerCase()]: 7
  };

  const [exporting, setExporting] = useState(false);
  const handleExportPdf = async () => {
    setExporting(true);
    try {
      const lang = (i18n.language || 'es').substring(0, 2);
      // Pasar la fecha seleccionada en el calendario para que el backend
      // resuelva el PeriodoLectivo aplicable (cascada SEMANA→PLANTILLA) y
      // genere el PDF de la SEMANA visible en el editor (no mezcla todas
      // las SEMANAs del año, que era el comportamiento legacy).
      const y = selectedDate.getFullYear();
      const m = String(selectedDate.getMonth() + 1).padStart(2, '0');
      const d = String(selectedDate.getDate()).padStart(2, '0');
      const fechaISO = `${y}-${m}-${d}`;
      const url = getApiUrl(`/api/v1/informes/horario/me?lang=${lang}&fecha=${fechaISO}`);
      await downloadFileFromApi(url, `horario_${fechaISO}.pdf`);
    } catch (err) {
      toast.error(err.message, {
        description: t('schedules.exportErrorCtx', { defaultValue: 'No se ha podido exportar el horario' })
      });
    } finally {
      setExporting(false);
    }
  };

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [currentHorario, setCurrentHorario] = useState(null);
  const [formData, setFormData] = useState({
    diaSemana: 1,
    horaInicio: '08:00',
    horaFin: '09:00',
    aula: '',
    imparticion: ''
  });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (isSuperAdmin) {
        fetch(getApiUrl('/api/centros?pagination=false'), {
            headers: { 'Accept': 'application/ld+json' },
            credentials: 'include'
        })
        .then(res => res.json())
        .then(data => {
            const items = data['hydra:member'] || data.member || [];
            setCentros(items);
        })
        .catch(err => console.error("Error cargando centros:", err));
    }
  }, [isSuperAdmin]);

  useEffect(() => {
    if (!canEdit) return;

    let url = getApiUrl('/api/imparticions?pagination=false');
    
    fetch(url, {
        headers: { 'Accept': 'application/ld+json' },
        credentials: 'include'
    })
    .then(res => res.json())
    .then(data => {
        const items = data['hydra:member'] || data.member || [];
        setImparticiones(items);
    })
    .catch(err => console.error("Error cargando imparticiones:", err));
  }, [selectedCentro, isSuperAdmin, canEdit]);

  // Carga de vista calendario (no usa DataTable, lógica separada)
  const fetchCalendarData = useCallback(() => {
      setLoading(true);

      const fetchSchedule = fetch(getApiUrl(`/api/my-schedule?_=${Date.now()}`), {
          headers: { 'Accept': 'application/json', 'Cache-Control': 'no-cache', 'Pragma': 'no-cache' },
          credentials: 'include',
          cache: 'no-store',
      }).then(res => res.json());

      let urlFestivos = getApiUrl('/api/festivos?pagination=false');
      const fetchFestivos = fetch(urlFestivos, {
          headers: { 'Accept': 'application/ld+json' },
          credentials: 'include'
      }).then(res => res.json());

      let urlTareas = getApiUrl('/api/tareas?pagination=false');
      const fetchTareas = fetch(urlTareas, {
          headers: { 'Accept': 'application/ld+json' },
          credentials: 'include'
      }).then(res => res.json());

      Promise.all([fetchSchedule, fetchFestivos, fetchTareas])
      .then(([scheduleData, festivosData, tareasData]) => {
          // Endpoint puede devolver array (formato viejo) o {events, slots}
          // (formato nuevo, post-Fase 3 CCAA). Compat retroactiva.
          if (Array.isArray(scheduleData)) {
              setMySchedule(scheduleData);
              setMyScheduleSlots(null);
              setExcepciones([]);
          } else {
              setMySchedule(scheduleData?.events || []);
              setMyScheduleSlots(scheduleData?.slots?.length ? scheduleData.slots : null);
              setExcepciones(scheduleData?.excepciones || []);
          }

          let allFestivos = festivosData['hydra:member'] || festivosData.member || [];
          if (isSuperAdmin && selectedCentro) {
              allFestivos = allFestivos.filter(f => {
                  if (!f.centro) return true;
                  const centroId = typeof f.centro === 'string' ? f.centro.split('/').pop() : f.centro.id;
                  return String(centroId) === String(selectedCentro);
              });
          }
          setFestivos(allFestivos);

          const allTareas = tareasData['hydra:member'] || tareasData.member || [];
          setTareas(allTareas);

          setLoading(false);
      })
      .catch(err => {
          console.error(err);
          setError(t('schedules.errorLoadSchedule'));
          setLoading(false);
      });
  }, [selectedCentro, isSuperAdmin, t]);

  useEffect(() => {
      if (viewMode === 'calendar') fetchCalendarData();
  }, [viewMode, fetchCalendarData]);

  // Mercure live para vista calendario: suscribe a los grupos del user
  // (firmados en JWT como /grupos/{gid}/schedule) y al topic personal de
  // excepciones (Fase B intercambio-imparticiones, 2026-05-07). Los grupos
  // se extraen del propio mySchedule tras la carga inicial → en el primer
  // render no hay topics, en renders subsiguientes sí.
  const personalScheduleTopics = useMemo(() => {
      if (viewMode !== 'calendar' || !Array.isArray(mySchedule)) return [];
      const grupoIds = new Set();
      for (const e of mySchedule) {
          const g = e?.imparticion?.grupo;
          const gid = typeof g === 'object' ? g?.id : (typeof g === 'string' ? g.split('/').pop() : null);
          if (gid) grupoIds.add(gid);
      }
      const topics = Array.from(grupoIds).map(gid => `/grupos/${gid}/schedule`);
      if (user?.id) topics.push(`/users/${user.id}/excepciones`);
      return topics;
  }, [viewMode, mySchedule, user?.id]);

  useLiveRefetch(personalScheduleTopics, fetchCalendarData);

  const getHorarioId = (h) => {
    if (h.id) return h.id;
    if (h['@id']) {
        const parts = h['@id'].split('/');
        return parts[parts.length - 1];
    }
    return null;
  };

  // Función de carga optimizada para DataTable
  const fetchHorariosData = useCallback(async (params) => {
    if (abortController.current) {
        abortController.current.abort();
    }
    abortController.current = new AbortController();

    setLoading(true);

    try {
      let url = getApiUrl(`/api/horarios?page=${params.page}&itemsPerPage=${params.itemsPerPage}`);
      
      if (params.searchTerm) {
          let term = params.searchTerm;
          if (params.searchField === 'diaSemana') {
              const diaNum = diasSemanaInverso[params.searchTerm.toLowerCase()];
              if (diaNum) term = diaNum;
          }
          url += `&${params.searchField}=${encodeURIComponent(term)}`; 
      }
      
      if (params.sortColumn) {
          url += `&order[${params.sortColumn}]=${params.sortDirection}`;
      }

      const response = await fetch(url, {
        headers: { 'Accept': 'application/ld+json' },
        credentials: 'include',
        signal: abortController.current.signal
      });

      if (!response.ok) throw new Error(`Error ${response.status}`);

      const data = await response.json();
      const items = data['hydra:member'] || data.member || [];
      const total = data['hydra:totalItems'] || data.totalItems || items.length;
      
      setHorarios(items);
      setTotalItems(total);
      setError(null);

    } catch (err) {
      if (err.name === 'AbortError') return;
      console.error("Error fetching horarios:", err);
      setError(err.message);
    } finally {
      if (abortController.current && !abortController.current.signal.aborted) {
          setLoading(false);
      }
    }
  }, []); 

  // Mercure live: refetch ante alta/edición/borrado de horarios del centro.
  // Solo aplica a admins (vista lista); para usuario normal este hook no se
  // suscribe (topics vacíos) ya que /admin/centros/{cid}/horarios requiere
  // rol admin en JWT.
  // Nota: NO se aplica a HorariosEditor (el editor con pendingTx) — el refetch
  // colisionaría con el draft local. El editor mantiene su modelo de "todo
  // local hasta Guardar" por diseño.
  const liveTopics = useMemo(() => {
      if (!canEdit) return [];
      const cid = isSuperAdmin ? (selectedCentro || '{cid}') : user?.centro?.id;
      return cid && viewMode === 'list' ? [`/admin/centros/${cid}/horarios`] : [];
  }, [canEdit, isSuperAdmin, selectedCentro, user?.centro?.id, viewMode]);

  useLiveRefetch(liveTopics, () => {
      if (viewMode !== 'list') return;
      fetchHorariosData({
          page: currentPage,
          itemsPerPage,
          searchTerm,
          searchField,
          sortColumn,
          sortDirection,
      });
  });

  // Efecto ÚNICO para cambios en modo lista
  useEffect(() => {
      if (viewMode !== 'list') return;

      const searchChanged = searchTerm !== prevSearchTerm.current || searchField !== prevSearchField.current;
      
      prevSearchTerm.current = searchTerm;
      prevSearchField.current = searchField;

      const params = {
          page: currentPage,
          itemsPerPage,
          searchTerm,
          searchField,
          sortColumn,
          sortDirection
      };

      if (searchChanged) {
          if (debounceTimeout.current) clearTimeout(debounceTimeout.current);
          debounceTimeout.current = setTimeout(() => {
              fetchHorariosData(params);
          }, 500);
      } else {
          if (debounceTimeout.current) clearTimeout(debounceTimeout.current);
          fetchHorariosData(params);
      }

      return () => {
          if (debounceTimeout.current) clearTimeout(debounceTimeout.current);
      };
  }, [
      currentPage, 
      itemsPerPage, 
      searchTerm, 
      searchField, 
      sortColumn, 
      sortDirection, 
      viewMode,
      fetchHorariosData
  ]);

  const handleItemsPerPageChange = (newItemsPerPage) => {
      setItemsPerPage(newItemsPerPage);
      setCurrentPage(1);
  };

  const handleSort = useCallback((columnKey) => {
      if (sortColumn === columnKey) {
          setSortDirection(prev => prev === 'asc' ? 'desc' : 'asc');
      } else {
          setSortColumn(columnKey);
          setSortDirection('asc');
      }
  }, [sortColumn]);

  const handleOpenModal = useCallback((horario = null) => {
    if (horario) {
      setCurrentHorario(horario);
      const getId = (obj) => obj ? (obj.id || (obj['@id'] ? obj['@id'].split('/').pop() : '')) : '';
      const formatTime = (dateStr) => {
          if (!dateStr) return '';
          const date = new Date(dateStr);
          return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
      };

      setFormData({
        diaSemana: horario.diaSemana,
        horaInicio: formatTime(horario.horaInicio),
        horaFin: formatTime(horario.horaFin),
        aula: horario.aula,
        imparticion: getId(horario.imparticion)
      });
    } else {
      setCurrentHorario(null);
      setFormData({
        diaSemana: 1,
        horaInicio: '08:00',
        horaFin: '09:00',
        aula: '',
        imparticion: ''
      });
    }
    setIsModalOpen(true);
  }, []);

  const handleCloseModal = () => {
    setIsModalOpen(false);
    setCurrentHorario(null);
  };

  // Extrae el id de impartición desde una tarea (acepta IRI string u objeto)
  const getImparticionId = (tarea) => {
    const imp = tarea?.imparticion;
    if (!imp) return null;
    if (typeof imp === 'string') return imp.split('/').pop();
    if (imp.id) return imp.id;
    if (imp['@id']) return imp['@id'].split('/').pop();
    return null;
  };

  // Navegar a /entregas (mismo comportamiento que el widget Tareas Pendientes)
  const handleEventClick = useCallback((event) => {
    if (event?.imparticionId) {
      navigate(`/entregas?imparticion=${event.imparticionId}&tarea=${event.id}`);
    } else {
      navigate('/entregas');
    }
  }, [navigate]);

  // Eventos para EventsSidebar derivados de tareas, enriquecidos con imparticionId
  const sidebarEvents = useMemo(() => tareas.map(tr => ({
    id: tr.id,
    title: tr.titulo,
    date: tr.fechaLimite,
    type: tr.tipo,
    imparticionId: getImparticionId(tr),
  })), [tareas]);

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);

    try {
      const id = currentHorario ? getHorarioId(currentHorario) : null;
      const url = currentHorario 
        ? getApiUrl(`/api/horarios/${id}`)
        : getApiUrl('/api/horarios');
      
      const method = currentHorario ? 'PUT' : 'POST';

      const payload = {
        diaSemana: parseInt(formData.diaSemana),
        horaInicio: formData.horaInicio,
        horaFin: formData.horaFin,
        aula: formData.aula,
        imparticion: formData.imparticion.includes('/api/') ? formData.imparticion : `/api/imparticions/${formData.imparticion}`
      };

      const response = await fetch(url, {
        method: method,
        headers: {
          'Content-Type': 'application/ld+json',
          'Accept': 'application/ld+json',
        },
        body: JSON.stringify(payload),
        credentials: 'include'
      });

      if (!response.ok) {
        const message = await parseErrorResponse(response);
        throw new Error(message);
      }

      // Recargar datos
      fetchHorariosData({
          page: currentPage,
          itemsPerPage,
          searchTerm,
          searchField,
          sortColumn,
          sortDirection
      });
      handleCloseModal();
      toast.success(currentHorario
        ? t('schedules.updatedSuccess', { defaultValue: 'Horario actualizado' })
        : t('schedules.createdSuccess', { defaultValue: 'Horario creado' }));

    } catch (err) {
      console.error("Error saving horario:", err);
      toast.error(err.message, {
        description: currentHorario
          ? t('schedules.errorUpdating', { defaultValue: 'No se ha podido actualizar el horario' })
          : t('schedules.errorCreating', { defaultValue: 'No se ha podido crear el horario' })
      });
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = useCallback(async (horario) => {
    if (!(await confirm({ body: t('schedules.confirmDelete') }))) return;

    const id = getHorarioId(horario);
    if (!id) return;

    try {
      const response = await fetch(getApiUrl(`/api/horarios/${id}`), {
        method: 'DELETE',
        credentials: 'include'
      });

      if (!response.ok) {
        const message = await parseErrorResponse(response, t('schedules.errorDelete'));
        throw new Error(message);
      }
      fetchHorariosData({
          page: currentPage,
          itemsPerPage,
          searchTerm,
          searchField,
          sortColumn,
          sortDirection
      });
      toast.success(t('schedules.deletedSuccess', { defaultValue: 'Horario eliminado' }));
    } catch (err) {
      console.error("Error deleting horario:", err);
      toast.error(err.message, {
        description: t('schedules.errorDeletingCtx', { defaultValue: 'No se ha podido eliminar el horario' })
      });
    }
  }, [currentPage, itemsPerPage, searchTerm, searchField, sortColumn, sortDirection, fetchHorariosData, t]);

  const columns = useMemo(() => [
    { 
        header: t('schedules.day'), 
        accessor: (row) => diasSemana[row.diaSemana] || row.diaSemana, 
        sortable: true, sortKey: 'diaSemana' 
    },
    { 
        header: t('schedules.time'), 
        accessor: (row) => {
            const start = new Date(row.horaInicio).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
            const end = new Date(row.horaFin).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
            return `${start} - ${end}`;
        }, 
        sortable: true, sortKey: 'horaInicio' 
    },
    { header: t('schedules.classroom'), accessor: 'aula', sortable: true, sortKey: 'aula' },
    {
        header: t('schedules.subject'),
        accessor: (row) => row.imparticion && row.imparticion?.materia
            ? <MateriaLabel materia={row.imparticion?.materia} />
            : '-',
        sortable: true, sortKey: 'imparticion.materia.nombre'
    },
    {
        header: t('schedules.group'),
        accessor: (row) => {
            const g = row.imparticion?.grupo;
            return g ? (formatGrupoAbrev(g) || '-') : '-';
        },
        sortable: true, sortKey: 'imparticion.grupo.nombre'
    },
    {
        header: t('schedules.teacher'),
        accessor: (row) => row.imparticion && row.imparticion.profesor ? `${row.imparticion.profesor.nombre} ${row.imparticion.profesor.apellidos}` : '-',
        sortable: true, sortKey: 'imparticion.profesor.nombre'
    },
    { 
        header: t('common.actions'), 
        accessor: (row) => (
            <div className={styles.actions}>
                <button className={styles.iconButton} onClick={() => handleOpenModal(row)} title={t('common.edit')}><Edit2 size={18} /></button>
                <button className={`${styles.iconButton} ${styles.danger}`} onClick={() => handleDelete(row)} title={t('common.delete')}><Trash2 size={18} /></button>
            </div>
        ),
        sortable: false
    }
  ], [handleOpenModal, handleDelete]);

  const Wrapper = embedded ? React.Fragment : Layout;
  const content = (
    <>
        <CrudHeader title={embedded ? 'Horarios' : t('schedules.title')}
                    subtitle={t('schedules.subtitle')}
                    breadcrumbs={embedded ? [
                        { label: t('sidebar.home'), to: '/' },
                        { label: t('sidebar.scheduleAdmin') },
                    ] : [
                        { label: t('sidebar.home'), to: '/' },
                        { label: t('schedules.title') },
                    ]}
                    logo={<Lottie animationData={calendarAnimation} loop={true} style={{ width: 56, height: 56 }} />}
                    middle={tabs}
        >
            {viewMode === 'calendar' && isMobile && (
                <Button
                    variant="secondary"
                    onClick={() => setIsSidebarOpen(true)}
                    title={t('schedules.showCalendar')}
                >
                    <PanelRightOpen size={18} />
                </Button>
            )}

            {viewMode === 'calendar' && (
                <Button
                    variant="secondary"
                    onClick={handleExportPdf}
                    disabled={exporting || (mySchedule?.length ?? 0) === 0}
                    title={t('schedules.exportPdf')}
                >
                    <Download size={16} style={{ marginRight: 6 }} />
                    {exporting ? t('schedules.exporting') : t('schedules.exportPdf')}
                </Button>
            )}

            {viewMode === 'list' && isSuperAdmin && (
                <ThemedSelect
                    value={selectedCentro}
                    onChange={setSelectedCentro}
                    minWidth={200}
                    ariaLabel={t('common.allCenters')}
                    options={[
                        { value: '', label: t('common.allCenters') },
                        ...centros.map(c => ({ value: String(c.id), label: c.nombre })),
                    ]}
                />
            )}
            
            {viewMode === 'list' && (
                <>
                    <SearchBar 
                        value={searchTerm} 
                        onChange={setSearchTerm} 
                        placeholder={t('common.search')}
                        fields={searchFields}
                        selectedField={searchField}
                        onFieldChange={setSearchField}
                    />
                    <Button onClick={() => handleOpenModal()}>
                        <Plus size={18} style={{ marginRight: '8px' }} /> {t('common.new')}
                    </Button>
                </>
            )}
        </CrudHeader>

        {error && (
            <div className={styles.errorContainer}>
            <p>{error}</p>
            <Button onClick={() => window.location.reload()} variant="secondary" style={{ marginTop: '1rem' }}>{t('common.retry')}</Button>
            </div>
        )}

        {viewMode === 'list' ? (
            <DataTable
                columns={columns}
                data={horarios}
                totalItems={totalItems}
                itemsPerPage={itemsPerPage}
                currentPage={currentPage}
                onPageChange={setCurrentPage}
                onItemsPerPageChange={handleItemsPerPageChange}
                loading={loading}
                sortColumn={sortColumn}
                sortDirection={sortDirection}
                onSort={handleSort}
                mobileBreakpoint="640px"
            />
        ) : (
            <>
                <div className={styles.calendarViewModeContainer}>
                    <div className={styles.timeTableWrapper}>
                        <TimeTable
                            events={visibleSchedule}
                            slots={myScheduleSlots}
                            festivos={festivos}
                            tareas={tareas}
                            title="Mi Horario"
                            selectedDate={selectedDate}
                            autoOpenExcepcionId={autoOpenExcepcionId}
                            onAutoOpenConsumed={() => {
                                // Tras abrir el modal, limpia el query param para que
                                // un F5 no vuelva a abrirlo.
                                setAutoOpenExcepcionId(null);
                                setSearchParams((prev) => {
                                    const next = new URLSearchParams(prev);
                                    next.delete('excepcion');
                                    next.delete('fecha');
                                    return next;
                                }, { replace: true });
                            }}
                        />
                    </div>

                    {!isMobile && (
                        <div className={`${styles.calendarWrapper} ${hasBothShifts ? styles.calendarOffset : ''}`}>
                            <CalendarView
                                selectedDate={selectedDate}
                                onDateSelect={setSelectedDate}
                                festivos={festivos}
                            />
                        </div>
                    )}
                </div>

                {!isMobile && (
                    <WeekStrip
                        selectedDate={selectedDate}
                        events={sidebarEvents}
                        onEventClick={handleEventClick}
                    />
                )}
            </>
        )}

        {isMobile && isSidebarOpen && (
            <div className={styles.mobileSidebarOverlay} onClick={() => setIsSidebarOpen(false)}>
                <div className={styles.mobileSidebar} onClick={e => e.stopPropagation()}>
                    <div className={styles.mobileSidebarHeader}>
                        <h3 className={styles.sectionTitle}>{t('schedules.calendarAndEvents')}</h3>
                        <button onClick={() => setIsSidebarOpen(false)} className={styles.closeButton}>
                            <PanelRightClose size={20} />
                        </button>
                    </div>
                    <EventsSidebar
                        selectedDate={selectedDate}
                        onDateSelect={(date) => {
                            setSelectedDate(date);
                            setIsSidebarOpen(false);
                        }}
                        festivos={festivos}
                        events={sidebarEvents}
                        onEventClick={(event) => {
                            setIsSidebarOpen(false);
                            handleEventClick(event);
                        }}
                    />
                </div>
            </div>
        )}

        <ModalView
            isOpen={isModalOpen}
            onClose={handleCloseModal}
            title={currentHorario ? t('schedules.editTitle') : t('schedules.newTitle')}
            onSubmit={handleSubmit}
            isSubmitting={saving}
        >
            <div className={styles.formGroup}>
                <label className={styles.label}>{t('schedules.dayOfWeek')}</label>
                <select name="diaSemana" value={formData.diaSemana} onChange={handleInputChange} className={styles.select}>
                    <option value="1">{t('days.monday')}</option>
                    <option value="2">{t('days.tuesday')}</option>
                    <option value="3">{t('days.wednesday')}</option>
                    <option value="4">{t('days.thursday')}</option>
                    <option value="5">{t('days.friday')}</option>
                    <option value="6">{t('days.saturday')}</option>
                    <option value="7">{t('days.sunday')}</option>
                </select>
            </div>
            <div className={styles.formGroup}>
                <label className={styles.label}>{t('schedules.startTime')}</label>
                <input type="time" name="horaInicio" value={formData.horaInicio} onChange={handleInputChange} className={styles.input} required />
            </div>
            <div className={styles.formGroup}>
                <label className={styles.label}>{t('schedules.endTime')}</label>
                <input type="time" name="horaFin" value={formData.horaFin} onChange={handleInputChange} className={styles.input} required />
            </div>
            <div className={styles.formGroup}>
                <label className={styles.label}>{t('schedules.classroomLabel')}</label>
                <input type="text" name="aula" value={formData.aula} onChange={handleInputChange} className={styles.input} required placeholder={t('schedules.classroomPlaceholder')} />
            </div>
            <div className={styles.formGroup}>
                <label className={styles.label}>{t('schedules.subjectLabel')}</label>
                <AsyncSearchSelect
                    name="imparticion"
                    value={formData.imparticion}
                    onChange={(v) => setFormData(p => ({ ...p, imparticion: v }))}
                    endpoint="/api/imparticions"
                    extraParams={isSuperAdmin && selectedCentro ? { 'grupo.centro': selectedCentro } : {}}
                    getOptionLabel={(i) => `${i.materia?.nombre ?? ''} — ${i.grupo?.abreviatura || i.grupo?.nombre || ''} (${i.profesor?.nombre ?? ''} ${i.profesor?.apellidos ?? ''})`}
                    getOptionValue={(i) => i.id || i['@id']?.split('/').pop()}
                    placeholder={t('schedules.selectSubject')}
                    required
                />
            </div>
        </ModalView>
    </>
  );
  return (
    <Wrapper>
        {embedded ? content : <div className={styles.container}>{content}</div>}
    </Wrapper>
  );
};

export default Horarios;
