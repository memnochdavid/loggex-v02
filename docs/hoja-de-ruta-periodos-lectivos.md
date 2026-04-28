# Períodos lectivos (rangos de fecha) y solver por rango

> **Status (2026-04-28)**: 🟡 Fases 1+2+3a+3b+4 ✅ Done. Stepping stone (override jornada por grupo) ✅ Done. **Fase 5 reestructurada el 2026-04-28** tras feedback del usuario: modelo mental anual (D-K) + botón "extender curso" (D-J) + CapacityPlanner relajado + cierre del parche temporal absorbido como sub-fase D. Sub-fases A/B/C/D pendientes. Sustituye al **parche temporal** de `hoja-de-ruta-jornadas-recreos.md` (jornadas 35h/sem) y **funde la Fase 5** de `hoja-de-ruta-calendario-escolar.md`. Quedan Fases 5 (modelo anual + extender curso + cleanup parche), 6 (merge `/admin/jornadas` + `/admin/horarios`), 7 (calendario lectivo del centro, parametriza D-L), 8 (dashboard horas anuales).

---

## ⚡ Snapshot para retomar

### Problema que resuelve

1. **Tensión LOMLOE vs jornada real**: el currículo LOMLOE FP exige Σ minutosSemanales ≈ 32-33h, pero la jornada lectiva real es ≈27.5h (30h presencia − recreos). Hoy se "resuelve" con dos jornadas parche `pre Calendario Real` (id 4 y 5 en EAG, 35h/sem) que no son reales.
2. **Distribución temporal de materias**: hay materias que no son "regulares semanales todo el año" — Proyecto Intermodular, FCT, Libre configuración. El modelo actual no sabe expresarlas.
3. **Solver único anual demasiado rígido**: el centro real cambia horario varias veces al año (FCT bloque concentrado en mayo-junio, Proyecto Intermodular en abril, restructuración tras Semana Santa, profe nuevo a mitad de curso). Forzar un único horario anual obliga a parches.

### Idea de fondo

- **Fecha-fin de curso flexible**: la suma de horas anuales (Σ minutosSemanales × nº semanas lectivas) debe cuadrar con el currículo. Si la jornada es de 27.5h/sem, hace falta más semanas que con una de 32h/sem. Se cumple el cómputo anual, no el semanal.
- **Solver por rango de fecha** (no por evaluación): el centro define N rangos `PeriodoLectivo` con sus fechas, su jornada y su set de materias activas. Cada rango se resuelve independiente. Las evaluaciones (`PeriodoEvaluativo`) viven aparte para grading.
- **Decoupling scheduling ↔ grading**: `PeriodoLectivo` rige horario; `PeriodoEvaluativo` rige boletines. Pueden o no coincidir en fechas.

### Estado actual del modelo (lo que ya existe)

- ✅ `JornadaTipo` + `JornadaTramo` (cabecera + tramos SLOT/RECREO con duración en minutos).
- ✅ `Itinerario.jornadaTipo` (FK nullable).
- ✅ `PeriodoEvaluativo` (por grupo, tipos PRIMERA/SEGUNDA/TERCERA/ORDINARIA_FINAL/EXTRAORDINARIA, fechas, peso). **No conectado a Calificacion ni a solver hoy.**
- ✅ `Materia.minutosSemanales` (refactor D24=A en jornadas-recreos).
- ✅ `Imparticion` (materia × grupo × profesor) con minutos semanales heredados de Materia.
- ✅ `HorarioSolver` + `CapacityPlanner` ILP (sub-fase O) trabajando en minutos.

### Lo que NO existe

- ❌ Entidad `PeriodoLectivo`.
- ❌ Relación Imparticion ↔ PeriodoLectivo (en qué rangos vive una imparticion y con qué minutos).
- ❌ Solver corriendo por rango.
- ❌ UI de timeline de rangos en `/admin/horarios`.
- ❌ Merge UX `/admin/jornadas` + `/admin/horarios`.

---

## 1. Modelo propuesto

### `PeriodoLectivo` (entidad nueva)

```
PeriodoLectivo
├── id
├── grupo            ManyToOne (no-null) — granularidad por grupo (D-B)
├── nombre           string ("Curso normal", "Bloque FCT", "Repaso jun")
├── fechaInicio      date
├── fechaFin         date
├── jornadaTipo      ManyToOne nullable → JornadaTipo (puede variar por rango, D-D)
├── orden            int (timeline visual)
├── createdAt/updatedAt (TimestampableTrait)
└── deleted (SoftDeletableTrait)

Constraint:
- Dos rangos del mismo grupo no se solapan (D-F).
- fechaInicio < fechaFin.
```

### Distribución materia → rango

**Recomendación D-A**: entidad de unión `PeriodoLectivoImparticion`. Permite que una misma `Imparticion` viva en varios rangos con distinto peso semanal (ej: una materia anual con menos horas en el rango FCT).

```
PeriodoLectivoImparticion
├── id
├── periodoLectivo   ManyToOne (no-null)
├── imparticion      ManyToOne (no-null)
├── minutosSemanales int — minutos en este rango concreto (puede diferir del default de Materia)
└── timestamps + soft delete

Unique: (periodoLectivo, imparticion)
```

Si una imparticion no tiene fila en un rango, **no existe** en ese rango (no entra en el solver).

### Cómo se relaciona con lo existente

- `Imparticion` sigue siendo materia × grupo × profesor (sin tocar contrato actual).
- `Imparticion.minutosSemanales` se vuelve **valor default**; el valor efectivo en cada rango es `PeriodoLectivoImparticion.minutosSemanales`.
- `Horario` (placements del solver) **gana FK `periodoLectivo`** (no-null nuevo). Migración: para data existente, asignar al `PeriodoLectivo` único anual del grupo (creado por la migración).
- `PeriodoEvaluativo` **no se toca**. Sigue su lógica de grading.

---

## 2. Decisiones

### Cerradas

| ID | Decisión | Resolución | Razón |
|---|---|---|---|
| D-A | Cómo expresar materia × rango | Entidad de unión `PeriodoLectivoImparticion` con `minutosSemanales` propio (nullable: si NULL, hereda `Materia.minutosSemanales`) | Permite mismo Imparticion con distintos pesos por rango. Más flexible que enum en Materia. |
| D-B | Granularidad de PeriodoLectivo | Por **grupo** | Hereda granularidad de `PeriodoEvaluativo`. Cada grupo puede tener calendario distinto. |
| D-C | Fecha-fin curso: ¿se computa o el usuario la fija? | **Manual** con aviso "te sobran/faltan X horas anuales para cumplir currículo". Cerrada 2026-04-28. | Computada es elegante pero choca con calendario oficial CCAA (junio fijo). El usuario decide y el sistema valida con aviso no bloqueante. |
| D-D | ¿Jornada distinta por rango? | Sí, FK opcional `PeriodoLectivo.jornadaTipo`. Si null, fallback a `Grupo.getEffectiveJornadaTipo()` (override del grupo o jornada del itinerario). **El campo se queda NULL por defecto** (incluso en la migración Fase 1) — solo se rellena cuando el admin lo cambia explícitamente para ESE rango (caso FCT/Proyecto Intermodular en Fase 3). Razón: si se copia el override del grupo, se "congela" en BD y el cascade no propaga cambios posteriores del selector. | Permite cambio de jornada en bloques especiales (ej: FCT con horario distinto). El nullable encadena con el fallback ya implementado en el stepping stone. |
| D-E | ¿Imparticion troceada por rango? | No, `Imparticion` sigue siendo única; los minutos por rango viven en la entidad de unión | Evita explosión combinatoria y mantiene asistencia/calificación apuntando a una sola Imparticion. |
| D-F | ¿Pueden solaparse rangos del mismo grupo? | No (validación de servicio), deben cubrir ventana del curso sin huecos validados al "cerrar curso" (D-G) | Más simple, refleja realidad. Un grupo solo tiene un horario activo en cada fecha. |
| D-G | ¿Validar huecos en edición o solo al "cerrar curso"? | Validar **solo** al "cerrar curso" (acción explícita). Durante edición se permiten huecos y el frontend muestra aviso amarillo. Cerrada 2026-04-28. | Edición incremental cómoda. El admin parte un rango en dos sin que la UI le bloquee mientras configura el segundo. |
| D-H | ¿Quién crea los rangos por defecto al crear un grupo? | **Auto-crear** un rango único `"Curso completo"` con `fechaInicio = COALESCE(Grupo.fechaInicio, anioEscolar+0901)` y `fechaFin = COALESCE(Grupo.fechaFin, anioEscolar+0630)`, copiando `Grupo.jornadaTipoOverride` como `PeriodoLectivo.jornadaTipo`. La migración Fase 1 hace lo mismo retroactivamente para todos los grupos existentes. Cerrada 2026-04-28. | Un grupo nuevo es usable sin obligar a configurar rangos. El centro los partirá si lo necesita. |
| D-I | ¿La entidad se llama `PeriodoLectivo`? | **Sí**. Contrapunto natural de `PeriodoEvaluativo`. Alternativa descartada: `RangoHorario` (suena bajo nivel y se confunde con `JornadaTramo`). Cerrada 2026-04-28. | Coherencia con la familia `Periodo*` ya presente. La entidad de unión sigue el mismo prefijo: `PeriodoLectivoImparticion`. |
| D-J | ¿Cómo gestionar la extensión de curso cuando faltan horas anuales? | **Opción A con modal de confirmación**: extender automáticamente el `fechaFin` del último rango lectivo y, en cascada, `Grupo.fechaFin`. Modal previo enseña diff exacto (campo, antes → después) antes de aplicar. Cerrada 2026-04-28. | Lo simple es lo correcto el 90% del tiempo. El modal protege ante cambios accidentales. Si el centro quiere asignar las semanas extra a un rango específico (FCT puro, recuperación), siempre puede crear/editar rangos a mano después. |
| D-K | Modelo mental editor: ¿minutos semanales o horas anuales? | **Horas anuales** como vista principal del editor. Internamente `PLI.minutosSemanales` se mantiene (se calcula como `horasAnuales × 60 / semanasRango`). Cerrada 2026-04-28. | El currículo LOMLOE se mide en horas anuales; el admin piensa en horas anuales. Forzar a pensar en min/sem es una fricción artificial. El campo BD se mantiene para no romper solver y compatibilidad con CapacityPlanner. |
| D-L | ¿Cómo se validan las "semanas lectivas de referencia" (~36) sin Fase 7? | Constante 36 (estándar LOMLOE FP) usada como default. Hace falta una clave en `Centro` o `Itinerario` para parametrizarlo (ESO Andalucía 35, Bach 33-34, otras CCAA distintas). **Diferida a Fase 7** (calendario lectivo del centro): cuando exista `Centro.fechaInicioCurso/FinCurso` + `Festivo[]`, las semanas se calculan automáticamente. Mientras tanto, 36 fijo + tooltip explicativo. Cerrada 2026-04-28. | Implementarlo de forma genérica desde el principio (`Centro.semanasLectivasReferencia` nullable) tendría sentido pero lo correcto es ya delegar al calendario real cuando llegue Fase 7. Hardcoding temporal aceptable. |

### Abiertas

(ninguna pendiente — todas cerradas en 2026-04-28 antes de implementar Fase 1)

---

## 3. Fases de implementación

### Fase 1 — Modelo + migración (sin UI, sin solver)  ✅ Done (2026-04-28)

- ✅ `PeriodoLectivo` (`backend/src/Entity/PeriodoLectivo.php`) con `ApiResource` (Get/GetCollection/Post/Put/Patch/Delete), filtros por grupo/centro/jornadaTipo, traits TimestampableTrait + SoftDeletableTrait, validador `Assert\Expression` para fechaFin > fechaInicio, helper `getEffectiveJornadaTipo()` que cae a `Grupo.getEffectiveJornadaTipo()` si la del rango es NULL.
- ✅ `PeriodoLectivoImparticion` (`backend/src/Entity/PeriodoLectivoImparticion.php`) con UNIQUE(periodoLectivo, imparticion), `minutosSemanales` nullable (NULL = hereda `Materia.minutosSemanales`), helper `getEffectiveMinutosSemanales()`.
- ✅ `Horario.periodoLectivo` FK NOT NULL (cascade DELETE; en API es `horario:read`+`horario:write`).
- ✅ Migration `Version20260428180000` con backfill: un `PeriodoLectivo "Curso completo"` por cada grupo (incluyendo soft-deleted, por seguridad) con fechas `COALESCE(grupo.fecha_inicio/Fin, anio_escolar+'-09-01' / +'-06-30')` y `jornadaTipo = grupo.jornadaTipoOverride`; un `PeriodoLectivoImparticion(NULL minutos)` por cada imparticion existente; `Horario.periodoLectivo` poblado y luego pasa a NOT NULL.
- **Comportamiento idéntico al actual**: el solver (Fase 2 lo cableará) verá un solo rango por grupo con todas las imparticiones, exactamente como antes. La granularidad por rangos llega cuando el centro decida partir el "Curso completo" en N rangos desde la UI (Fase 3).

**Pendiente menor** (Fase 1.5, no bloqueante para correr la migración):
- Auto-crear un `PeriodoLectivo "Curso completo"` cuando se crea un Grupo nuevo vía API. Pendiente decidir si vía Doctrine `postPersist` listener, State Processor, o como parte de la UI de Fase 3 (ahí ya hay timeline de rangos y el admin puede crearlo a mano). Mientras tanto, los grupos creados por seed deben llevar su PL en el seed, o se ejecuta un comando manual.

**Esfuerzo invertido**: ~1 sesión.

### Fase 2 — Solver y CapacityPlanner por rango  ✅ Done (2026-04-28)

- ✅ `HorarioSolver::solve(Grupo, ?int $seed, ?PeriodoLectivo)` acepta el rango opcional. Si no se pasa, lo resuelve con `PeriodoLectivoResolver` (rango cuyo intervalo contiene `today()` o, si no hay match, el primero por `fechaInicio`).
- ✅ Lee `PeriodoLectivoImparticion[]` del rango (vía query Doctrine), no `Imparticion[]` del grupo. Cada PLI usa `getEffectiveMinutosSemanales()` (override del rango ?? `Materia.minutosSemanales`). Una imparticion sin PLI en el rango no existe en él (el solver no la considera).
- ✅ Jornada efectiva del rango: `PeriodoLectivo.getEffectiveJornadaTipo()` cae en cadena `rango.jornadaTipo → grupo.jornadaTipoOverride → itinerario.jornadaTipo`.
- ✅ `CapacityPlanner::plan(Grupo, ?PeriodoLectivo)` idem.
- ✅ `buildParallelBusy` actualizado: para cada grupo paralelo resuelve SU rango activo y filtra los `Horario` por `periodo_lectivo_id` (ya no cuentan los placements de rangos pasados/futuros como ocupación).
- ✅ Controller `HorarioSolverController` acepta `periodoLectivoId` en el body de `POST /solver/{grupoId}` y `?periodoLectivo=N` en `GET /capacity-check/{grupoId}`. Validación: el PL debe pertenecer al grupo (422 si no).
- ✅ `Horario.periodoLectivo` se auto-rellena en el `prePersist` (vía `HorarioPeriodoLectivoSubscriber`) si el frontend no lo envía. Mantiene compatibilidad con la UI pre-Fase 3 que sigue POSTeando horarios sin el campo.
- **Comportamiento observable**: idéntico al actual mientras solo haya un rango por grupo (caso post-migración Fase 1). El solver y el banner verde/amarillo/rojo siguen funcionando como hasta ahora; cualquier cambio pasaría por crear un segundo PL en el grupo.

**Esfuerzo invertido**: ~1 sesión.

### Fase 3a — UI: timeline read-only + selección + cableado API  ✅ Done (2026-04-28)

- ✅ Strip horizontal arriba del editor con un pill por cada `PeriodoLectivo` del grupo (nombre + fechas dd/mm), pill activo resaltado.
- ✅ Click en pill cambia `selectedPlByGrupo[grupoId]`. El editor recarga placements y CapacityPlanner del nuevo PL.
- ✅ Botón "Añadir rango" abre modal (nombre, fechaInicio, fechaFin, jornada opcional con "— Heredar del grupo —"). POST a `/api/periodo_lectivos`.
- ✅ State Processor backend `PeriodoLectivoCreateProcessor` auto-crea un `PeriodoLectivoImparticion` por cada `Imparticion` viva del grupo (minutos NULL = hereda Materia). Sin esto, el rango recién creado estaría vacío.
- ✅ Estado del editor refactorizado a clave compuesta `${grupoId}_${plId}`: `state`, `capacityByGrupo`. Cambiar de PL no descarta el trabajo en progreso del PL anterior (queda en memoria mientras la página viva).
- ✅ Cadena frontend de jornada efectiva alineada con el backend: `PL.jornadaTipo > Grupo.jornadaTipoOverride > Itinerario.jornadaTipo` en `resolveEffectiveJornadaId(g, pl)`.
- ✅ API calls cableadas:
   - `GET /api/horarios?...&periodoLectivo=N` (filtro nuevo añadido en `Horario` ApiFilter).
   - `GET /api/v1/horarios/capacity-check/{g}?periodoLectivo=N`.
   - `POST /api/v1/horarios/solver/{g}` body con `periodoLectivoId`.
   - `POST /api/v1/horarios/batch` body con `periodoLectivoId` (controller usa el PL para scope del check de concurrencia y para fijar `Horario.periodoLectivo` en cada create del lote).
- ✅ i18n nuevo (5 idiomas): `scheduleEditor.rangoLectivo`, `addRango/addRangoTitle/addRangoSubmit/addRangoSubmitting`, `rangoNombre/rangoNombrePlaceholder/rangoFechaInicio/rangoFechaFin/rangoJornada/rangoJornadaInherit/rangoJornadaHint`, `rangoMissingFields/rangoCreated/rangoCreateError`.

**Limitaciones conocidas** (cierre en Fase 3b):
- No se pueden editar ni borrar PLs desde la UI todavía. Si creas uno mal, hay que borrarlo en BD a mano (`DELETE FROM periodo_lectivo WHERE id=N`) o usar la API directamente.
- El selector de jornada del `infoBar` sigue controlando `Grupo.jornadaTipoOverride`, no la jornada del PL. Para cambiar la jornada de un PL específico, hoy hay que crear el PL con la jornada deseada (en el modal). Fase 3b añadirá un selector de jornada por rango inline.
- Si tienes cambios sin guardar en PL_A y cambias a PL_B, el `useBlocker` no avisa (porque `grupoState.dirty` se evalúa contra el PL activo). Los cambios siguen en memoria — al volver a PL_A reaparecen — pero un F5 los perdería.
- El strip aparece siempre (incluso con un solo "Curso completo"). Es deliberado: hace visible la nueva primitiva.

**Esfuerzo invertido**: ~1 sesión.

### Fase 3b — UI: editar/borrar PLs + banner Σ horas anuales  ✅ Done (2026-04-28)

- ✅ Editar PL inline (nombre, fechas, jornada). Mismo modal que la creación, con título/submit reactivos al modo (`plPickerMode = 'create' | 'edit'`). PATCH `/api/periodo_lectivos/{id}` con `application/merge-patch+json` (evita nullificar campos no enviados como hace PUT en API Platform 3). Tras editar, se invalida la cache de capacity-check de ese (grupo, PL) para forzar recálculo.
- ✅ Borrar PL desde el pill activo (icono Trash). Confirmación vía `useConfirm` con dos variantes de body: genérica si no hay horarios cacheados o explícita "se eliminarán N horario(s) asociados" cuando los hay (cuenta `placements[].hid` del state cargado). Bloqueado si es el último PL del grupo (toast informativo "Crea otro antes"). DELETE soft via `SoftDeleteProcessor`. Tras borrar: limpia `state[gid_plid]` y `capacityByGrupo[gid_plid]`, y si era el PL activo mueve la selección al rango que contiene `today()` o al primero por `fechaInicio` (mismo criterio que `PeriodoLectivoResolver`).
- ✅ Banner Σ horas anuales bajo el strip: tres counters (currículo / planificado / diferencia) con tonalidad verde (±5h), amarillo (±15h) o rojo (>15h). Currículo = Σ `materia.minutosSemanales` × 36 semanas (referencia LOMLOE). Planificado = Σ por PL de (Σ `pli.effectiveMinutosSemanales` × semanasDelRango). Aviso explícito D-C ("te sobran X h" / "te faltan X h"). Meta: nº rangos + semanas totales.
- ✅ i18n nuevo en 5 idiomas (~17 claves nuevas en bloque `scheduleEditor.*`): `editRango/editRangoTitle/editRangoSubmit/editRangoSubmitting/rangoUpdated/rangoUpdateError/deleteRango/deleteRangoConfirm{Title,Body,BodyWith}/deleteRangoOnlyOne/deleteRangoSuccess/deleteRangoError/horasBanner{Curriculum,Planned,Diff,Hint,Ok,Over,Under}`.

**Limitaciones conocidas** (cierre en Fase 4):
- El selector de jornada **por rango** ya está cubierto: editando el PL se cambia su `jornadaTipo`. No queda como item suelto.
- Los PLIs por rango no se gestionan aún desde UI: para un rango no se puede activar/desactivar imparticiones individualmente ni ajustar `minutosSemanales` override por rango. Eso es Fase 4.
- El cálculo del banner ignora festivos del centro/CCAA: usa `(fechaFin - fechaInicio) / 7` literal. Cuando llegue Fase 7 (calendario lectivo del centro) se podrá restar semanas no lectivas. Mientras tanto, el banner es una guía razonable para detectar desajustes grandes.
- La constante "36 semanas" del currículo es la referencia LOMLOE estándar; centros con calendarios atípicos verán desviaciones esperables.
- Si el último PL borrado tenía cambios sin guardar en otro PL del mismo grupo, esos cambios se quedan en memoria sólo si el PL al que se mueve la selección ya estaba cargado. Limitación heredada de Fase 3a.

**Esfuerzo invertido**: ~1 sesión.

### Fase 4 — UI gestión imparticiones por rango  ✅ Done (2026-04-28)

- ✅ Modal "Materias del rango" abierto desde icono Sliders en pill activo (junto a Editar/Borrar). Muestra todas las imparticiones del grupo (activas e inactivas en este rango) en una tabla con: checkbox activa, materia (chip color), profesor, input minutos/sem, botón reset al default.
- ✅ Activar imparticion en rango: POST `/api/periodo_lectivo_imparticions` con `minutosSemanales: null` (= hereda Materia).
- ✅ Desactivar: DELETE de la PLI. **Hard-delete** — la operación de Delete del entity cambió de `SoftDeleteProcessor` a delete físico para evitar choque con la unique `(periodoLectivo, imparticion)` cuando el admin desactiva-y-reactiva en el mismo rango. PLI es derivativa (la auditoría vive en PL), no hay valor en preservar el row borrado.
- ✅ Editar minutos por rango: PATCH `minutosSemanales: N` (override) o PATCH `null` (reset al default heredado). El input usa `key` con el valor actual para forzar re-mount tras cada save y mantener defaultValue en sync.
- ✅ Header del modal: Σ planificado en horas/sem vs jornada del rango en horas/sem, con tonalidad verde/rojo según si cabe.
- ✅ Tras cualquier mutación: invalida `capacityByGrupo[grupoId_plId]` y refresca `plByGrupo[grupoId]` (los PLIs embebidos alimentan el banner anual de Fase 3b → re-renderiza con los nuevos totales).
- ✅ i18n nuevo en 5 idiomas (~22 claves nuevas en bloque `scheduleEditor.pli*`).

**Comportamiento clave**: el admin puede ahora **redistribuir el peso semanal de cada materia entre rangos** sin tocar la jornada ni el catálogo de Materia. Ejemplo realista LOMLOE EAG/DAW: en el rango FCT, todas las materias regulares se desactivan y FCT pasa de 0 → 30h/sem; en los rangos normales, FCT está a 0h y las demás materias suman ≤27.5h/sem. Con Fase 4 cerrada, el sistema cumple el modelo de la Fase 1 (D-A) end-to-end desde UI.

**Limitaciones conocidas** (no bloqueantes):
- El input es uncontrolled con `key` para refresh tras save. Si el usuario está tipeando muy rápido y la red es lenta, el último valor puede sobreescribirse al llegar la respuesta. Mitigación práctica: el saving lock por fila (`pliRowSaving`) deshabilita el input mientras hay PATCH en vuelo.
- Cambiar minutos no recalcula automáticamente las celdas ya colocadas en el editor de horarios — si se recolocan, el solver/CapacityPlanner ya ven los nuevos minutos. Resolución: tras editar PLIs es prudente repulsar "Sugerir horario" si los slots ya tenían algo del PL activo.
- No hay batch update todavía: cada cambio es una request HTTP. Para grupos grandes (≫20 materias × 3 rangos) esto puede ser lento si el admin reordena masivamente. No prioritario.

**Esfuerzo invertido**: ~1 sesión (más larga que el estimado original 0.5 porque incluyó el fix backend de hard-delete + refetch del banner anual).

### Fase 5 — Modelo mental anual + extender curso + cierre del parche temporal

> **Acordada 2026-04-28** tras feedback del usuario sobre 1º DAW LOMLOE: con todas las materias anuales, no había forma de cuadrar Σ semanal en una jornada de 27.5h/sem usando sólo Fases 3b+4. Decisión D-J + D-K + D-L cerradas. Esta fase reemplaza la Fase 5 anterior ("Eliminar parche temporal") absorbiendo ese cierre como sub-fase D — eliminar el parche es la **consecuencia natural** de tener un modelo anual + curso extensible. No tiene sentido eliminarlo antes.

**Visión**: el admin piensa en horas anuales (como dicta el currículo LOMLOE). La jornada lectiva real (27.5h/sem) deja de ser una restricción semanal estricta — el sistema acepta que el currículo se cumple **sumando placements en N rangos**. Si las semanas disponibles del calendario lectivo no son suficientes, el sistema **sugiere extender el curso** ajustando `Grupo.fechaFin` y el último rango. Esto desbloquea cualquier itinerario en cualquier centro sin necesitar parches.

**Genericidad**: nada está hardcoded para etapa/itinerario/centro. El cómputo lee `Imparticion.materia.minutosSemanales` (currículo), `JornadaTipo.tramos` (capacidad semanal), `PeriodoLectivo.fechaInicio/Fin` (semanas reales). Constante temporal: 36 sem LOMLOE como referencia anual hasta Fase 7 (D-L).

#### Sub-fase A — Modelo mental anual en UI

- **Modal "Materias del rango" (Fase 4)**: cambiar input `Min/sem` por `Horas anuales en este rango`. Internamente persistimos `PLI.minutosSemanales = round(horasAnuales × 60 / semanasRango)` para mantener compatibilidad con solver/CapacityPlanner. Display secundario: "≈ X min/sem media (calculado)".
- **ModuleChip lateral del editor de horarios**: cambiar contador `Xh/Yh` (semanal) → `Xh/Yh anuales`. Cómputo "colocadas" = Σ por placement actual de `(slot duración × ocurrencias del día_semana en TODOS los rangos donde existe el placement)`. La cuenta es global del grupo, no por rango.
- **Banner anual de Fase 3b**: mantener pero añadir vista live "horas anuales colocadas" (visible cuando hay placements). Tonalidad sigue regla asimétrica (sobrar = ok, faltar = warn/error).

**Esfuerzo**: ~0.5 sesión.

#### Sub-fase B — Botón "Extender curso" en banner anual

- Cuando el banner anual muestra `diff < -tolerancia` (faltan horas), añadir un sub-botón **"Extender el curso N días lectivos para cuadrar"** (N = `ceil(faltan_horas / jornada_diaria) × 7/5`, redondeado hacia arriba a la siguiente semana completa).
- Click → modal de confirmación (D-J) con tabla:
  - `Grupo.fechaFin`: dd/mm/aaaa → dd/mm/aaaa (+N días)
  - `PeriodoLectivo "<último>"` `fechaFin`: dd/mm/aaaa → dd/mm/aaaa (+N días)
  - Banner final: "Banner anual quedará en: -3h (sigue ligeramente por debajo)" o "+12h (cumples con margen)".
- Confirma → PATCH `/api/grupos/{gid}` con `fechaFin` + PATCH `/api/periodo_lectivos/{plId}` con `fechaFin`. Atómico desde la perspectiva del usuario (un solo "deshacer mental"); técnicamente dos requests secuenciales con rollback si la segunda falla.
- Refresca cachés (`plByGrupo`, `capacityByGrupo`) → banner se vuelve verde.

**Esfuerzo**: ~0.5 sesión.

#### Sub-fase C — CapacityPlanner relajado (anual-aware)

- Regla de feasibility cambia:
  - **Rojo** sólo si físicamente imposible: `Σ horas_currículo > Σ jornada × Σ semanas_total_grupo` (no hay sitio aunque distribuyamos).
  - **Amarillo** informativo si en el rango activo `Σ min/sem > jornada/sem` pero el cómputo anual cuadra. Mensaje: "Este rango tiene sobrecarga semanal. Reasigna minutos a otros rangos desde el modal Materias del rango."
  - **Silencioso (verde)** si globalmente cabe y suma anual de placements < currículo: el admin sigue colocando, no es feedback útil.
- Banner del CapacityPlanner ya no es la alarma central — pasa a ser informativo. La alarma real es el banner anual de Fase 3b.

**Esfuerzo**: ~0.5 sesión.

#### Sub-fase D — Cierre del parche temporal en BD

> Era la Fase 5 antigua. Se mueve aquí porque depende de A+B+C estar implementadas.

- Bajar jornada de EAG de "Mañanas pre Calendario Real" 35h/sem → jornada normal 30h presenciales (≈27.5h lectivas con recreos).
- Verificar con sub-fase B que el sistema sugiere extender ~3 semanas (1º DAW LOMLOE) y el banner queda verde.
- Borrar jornadas parche `id 4` y `id 5` del seed/BD (o marcarlas deleted).
- Marcar §"PARCHE TEMPORAL" de `hoja-de-ruta-jornadas-recreos.md` como **superseded por este doc**.

**Esfuerzo**: ~0.25 sesión (verificación + cleanup).

#### Total Fase 5: ~1.75 sesiones

### Fase 6 — Merge `/admin/jornadas` + `/admin/horarios`

- Unificar UX: vista única donde, por grupo, ves su timeline de rangos, editas la jornada de cada rango inline (sin saltar a otra página) y el solver se lanza por rango.
- `/admin/jornadas` se vuelve sub-vista accesible solo para gestionar plantillas reutilizables.

**Esfuerzo**: ~1 sesión. Cosmético, puede aplazarse.

### Fase 7 — Calendario lectivo (funde Fase 5 calendario-escolar)

- Definir `Centro.fechaInicioCurso` / `fechaFinCurso` y vacaciones intermedias.
- Validador: rangos de un grupo deben cubrir el calendario lectivo del centro sin huecos (al "cerrar curso", D-G).
- Cross-ref a `hoja-de-ruta-calendario-escolar.md`: la antigua Fase 5 se cierra aquí.

**Esfuerzo**: ~1 sesión.

### Fase 8 — Tab "Consumición de horas anuales" por grupo

> Idea acordada 2026-04-28. Es la fase que justifica visualmente las decisiones de los rangos: el admin debe poder confirmar de un vistazo que el currículo cuadra al final del año.

**Ubicación decidida (2026-04-28)**: sub-pestaña dentro de `/admin/horarios` (no ruta propia, no en `/admin/grupos/{id}`). Razones:
- **Misma actividad**: editar horarios y verificar consumición son la misma tarea de planificación temporal — uno es "configuro", el otro es "compruebo". El admin que edita es el mismo que mira el dashboard.
- **Reuso del contexto**: el selector de grupo, la jornada efectiva y el banner del capacity-check ya están en `/admin/horarios`. Una ruta propia tendría que duplicar ese flujo.
- **Encaja con Fase 6**: la unificación `/admin/jornadas` + `/admin/horarios` deja un contenedor por grupo con pestañas; Fase 8 entra como una pestaña más (`[Editor] [Dashboard horas]`, mañana `[Rangos]` con Fase 3).
- **`/admin/grupos/{id}` queda fuera**: esa vista es CRUD del grupo (datos del sujeto), no operativa académica.
- Mitigación si crece demasiado: partir en sub-rutas tipo `/admin/horarios/{grupoId}/dashboard` manteniendo el contexto del selector — decisión diferida a cuando llegue la implementación.

Dos vistas combinadas dentro de la pestaña:

**Vista "ahora"** — instantánea de hoy:
- Por materia: horas previstas en el currículo (Σ minutos × semanas) vs horas ya impartidas hasta hoy (de `Asistencia` confirmadas o, en su defecto, deducidas del calendario y los `PeriodoLectivo` ya transcurridos).
- Diferencia: adelanto/retraso por materia.
- Banner: "vas X% del año, llevas Y% de horas impartidas — proyección Z".

**Vista "proyección"** — timeline anual:
- Eje X = semanas/meses del curso. Eje Y = horas acumuladas.
- Una línea por materia (o por categoría si hay ruido). Línea ideal del currículo + línea proyectada según los `PeriodoLectivo` configurados (jornadas, materias activas en cada rango, festivos).
- Si la proyección no llega al objetivo anual al final del curso → alerta con la diferencia exacta y sugerencia ("amplía el rango FCT en N días" / "añade X minutos/sem en el rango Y").

**Doble eje temporal**: además del "rango" (`PeriodoLectivo`), permitir alternar la línea de "evaluaciones" (`PeriodoEvaluativo`) para ver el cumplimiento por evaluación. Los dos modelos son ortogonales y útiles por separado:
- Rangos = "¿cuánto le queda a la materia X para terminar?"
- Evaluaciones = "¿qué materias terminan dentro de la 1ª evaluación a tiempo de poner nota?"

**Datos de entrada**:
- Currículo por materia (Σ minutos × semanas) — lo que ya tenemos.
- `PeriodoLectivo[]` del grupo + sus `PeriodoLectivoImparticion[]` con minutos por rango.
- `PeriodoEvaluativo[]` del grupo (fechas, peso) — ya existe.
- `Festivo[]` del centro/CCAA — ya cargado tras Calendario Fases 1-3.
- `Centro.fechaInicioCurso/FinCurso` — pendiente Fase 7.
- `Asistencia[]` confirmadas (vista "ahora") — opcional, fallback al cálculo teórico.

**Esfuerzo**: ~2-3 sesiones (1 backend de cálculo + 1-2 frontend con `recharts` o similar).

**Impacto comercial**: alto. Es el dashboard que un jefe de estudios revisa semanalmente. Sin este tab, los rangos son una caja negra — con él, son una herramienta de gestión real.

**Prerrequisitos**: Fases 1-7 completas. Funciona aún sin Asistencia (cálculo teórico) pero gana mucho con ella.

---

## 4. Impacto en otros docs

| Doc | Cambio |
|---|---|
| `hoja-de-ruta-jornadas-recreos.md` | Marcar §"PARCHE TEMPORAL" como **superseded por este doc** una vez Fase 5 esté hecha. Las sub-fases L/M/N (cosméticos solver) siguen vigentes. |
| `hoja-de-ruta-calendario-escolar.md` | Fase 5 (calendario lectivo) se funde aquí (Fase 7 de este doc). Fases 4 (Municipio) y 6 (cron BOE) siguen aparte. |
| `hoja-de-ruta-curriculum-ccaa.md` | Sin cambio directo. El currículo CCAA sigue alimentando `Materia.minutosSemanales` (default); los pesos por rango son ortogonales. El banner CCAA puede pasar a "verde" porque el solver ya no necesita meter 32h en 27.5h. |
| `hoja-de-ruta-calificaciones.md` | Sin cambio. `PeriodoEvaluativo` sigue su vida. |
| `INDEX.md` | Nueva ruta crítica con prioridad alta (resuelve parche temporal y desbloquea Bloque 3). |

---

## 5. Riesgos

- **Migración de data existente**: si hay `Horario` y `Imparticion` ya creados (hay seeds), la migración debe ser idempotente y no perder placements. Mitigación: rango único `"Curso completo"` autocreado preserva todo.
- **Live updates Mercure**: las nuevas entidades caen en la deuda existente — F5 manual hasta cobertura completa (ver `hoja-de-ruta-redis-workers.md`).
- **UX rango activo**: si el centro define 3 rangos pero el alumno entra "hoy", ¿qué horario ve? Lógica: el rango cuyo `[fechaInicio, fechaFin]` contiene `today`. Si none, el más cercano. Documentar en Fase 3.
- **Cambios de jornada a mitad de rango**: no soportado (un rango = una jornada). Si el centro lo necesita, parten el rango en dos. Trade-off aceptable.

---

## 6. Bitácora de implementación

### 2026-04-28 — Fase 5 reestructurada: modelo mental anual + extender curso

Tras probar Fase 4 con 1º DAW LOMLOE (3 rangos, 39 sem, currículo 1152h, jornada 27.5h/sem), el usuario detectó la limitación real del modelo actual: **todas las materias de DAW son anuales** — no hay materias "sólo trimestrales" para desactivar — y la suma semanal de las 32h/sem de currículo no cabe en una jornada de 27.5h/sem. Fase 4 (PLI por rango) NO arregla este caso porque desactivar materias por rango no aplica.

**Conversación clave**: el usuario propuso (a) cambiar el mental model a horas anuales y (b) usar `Grupo.fechaFin` (campo flexible que ya existe) para extender el curso cuando faltan horas. Ambas ideas son correctas y resuelven el caso DAW + cualquier otro itinerario sin parches.

**Decisiones cerradas durante la conversación**:
- **D-J**: extender curso = extender último rango con modal de confirmación que muestre el diff (Grupo.fechaFin antes/después + PL.fechaFin antes/después + impacto en banner anual).
- **D-K**: modelo mental editor = horas anuales (no min/sem). Internamente `PLI.minutosSemanales` se mantiene para no romper solver/CapacityPlanner; se calcula como `horasAnuales × 60 / semanasRango`.
- **D-L**: 36 semanas LOMLOE como referencia hardcoded hasta Fase 7. Cuando llegue calendario lectivo del centro, las semanas se calculan automáticamente.

**Reestructuración Fase 5**: la antigua Fase 5 ("Eliminar parche temporal") se vuelve sub-fase D dentro de la nueva Fase 5 ("Modelo mental anual + extender curso + cierre parche"). El cleanup del parche es **consecuencia natural** de tener el modelo correcto — eliminarlo antes habría dejado a EAG sin forma de cuadrar el currículo. Sub-fases A/B/C/D detalladas en §3.

**Genericidad confirmada con el usuario**: ningún número está hardcoded para DAW/EAG. Las fórmulas leen `Materia.minutosSemanales`, `JornadaTipo.tramos`, `PeriodoLectivo.fechaInicio/Fin` — válido para cualquier grupo de cualquier itinerario en cualquier centro. Ejemplos verificados con el user: 2º Bach 1050h en jornada 30h/sem 36 sem → verde sin acción. ESO 1º 1050h en jornada 25h/sem 38 sem → "faltan 100h, extender 4 semanas".

**Pendiente**: implementar sub-fase A (modelo mental anual en UI). Próxima sesión.

### 2026-04-28 — Fix Fase 4: ciclo de serialización en PLI normalization context

Detectado al probar el modal: `GET /api/periodo_lectivo_imparticions?periodoLectivo=N` devolvía 500 con `RuntimeException: The total number of joined relations has exceeded the specified maximum`. Causa: el `normalizationContext` de `PeriodoLectivoImparticion` incluía `periodo_lectivo:read`, lo que provocaba un ciclo de serialización:

- Al normalizar PLI con `pli:read + periodo_lectivo:read`, el campo `periodoLectivo` (Groups `pli:read, pli:write`) se incluye → se carga PL.
- PL serializa con `periodo_lectivo:read` → su campo `imparticiones` (Groups `periodo_lectivo:read`) se incluye → se cargan todos los PLIs.
- Cada PLI embebido dispara de nuevo la cadena → eager-loading dispara joins infinitos hasta exceder `max_joins`.

**Fix**: retirar `periodo_lectivo:read` del `normalizationContext` de la entidad PLI. Los Groups `periodo_lectivo:read` siguen presentes en los campos individuales de PLI (`id`, `imparticion`, `minutosSemanales`) — eso sigue funcionando cuando el contexto activo es el de PL (al fetchear PLs con sus PLIs embebidos, que es lo que alimenta el banner anual de Fase 3b y el modal). La diferencia es que PLI por sí mismo ya no propaga el grupo de PL hacia abajo, rompiendo el ciclo.

**Side-effect del bug previo**: el modal nunca cargaba PLIs → la tabla mostraba TODAS las imparticiones como `isActive = false` → al usuario marcar el checkbox, el handler intentaba POSTear un PLI nuevo → choque con la unique `(periodoLectivo, imparticion)` (porque el PLI YA existía pre-creado por `PeriodoLectivoCreateProcessor`). Con el GET arreglado, el flujo correcto es: cargar PLIs → mostrar las activas como activadas → el checkbox sólo se activa para POST cuando realmente no hay PLI → no hay duplicate key.

**Nota operativa**: el cambio en `ApiResource` requiere `php bin/console cache:clear` (la metadata del resource está cacheada).

### 2026-04-28 — Fase 4 implementada (modal "Materias del rango" + hard-delete PLI)

UI nueva en `/admin/horarios`: tercer icono (Sliders) en el pill activo del strip → abre modal con tabla de PLIs del rango. Cada fila permite activar/desactivar la imparticion en el rango, ajustar `minutosSemanales` (override o reset al default heredado de Materia). Cierra el ciclo Fase 1-4 del modelo de PeriodoLectivo: el admin ya puede gestionar end-to-end desde UI sin tocar BD.

**Backend — `backend/src/Entity/PeriodoLectivoImparticion.php`**:
- `Delete` operation cambiado de `SoftDeleteProcessor` a hard-delete físico. Razón: PLI tiene UNIQUE `(periodoLectivo, imparticion)` y el soft-delete deja el row con `deleted=true` pero la columna sigue ocupando el slot del unique → POST de revivir falla con duplicate key. PLI es derivativa (auditoría en PL padre), no hay valor en preservar el row borrado. Import `SoftDeleteProcessor` retirado.
- Trait `SoftDeletableTrait` se mantiene (la columna `deleted` sigue existiendo) para no romper el filtro Doctrine global ni requerir migración. Simplemente nunca se setea a true por la API.

**Frontend — `frontend/src/pages/HorariosEditor.jsx`**:
- Iconos nuevos: `Sliders` (abrir modal) y `RotateCcw` (reset al default).
- Estado nuevo: `pliModalOpen`, `pliModalPlId`, `pliByPl[plId] = PLI[]` (cache local), `pliLoading`, `pliRowSaving[impId]` (lock por fila).
- Helpers `refetchPlsForGroup(gid)` (recarga PLs del grupo con sus PLIs embebidos para que el banner anual Fase 3b refleje cambios) e `invalidateCapacityForPl(gid, plId)` (limpia el capacity-check).
- `openPliModal(pl)`: GET `/api/periodo_lectivo_imparticions?periodoLectivo={plId}&pagination=false` (siempre refresca al abrir, evita cache stale).
- `activatePli(impId)`: POST con `minutosSemanales: null`.
- `deactivatePli(pli)`: DELETE.
- `updatePliMinutos(pli, newMinutos)`: PATCH `merge-patch+json` (mismo patrón que el override de jornada). `null` = reset al default heredado.
- Memo `pliModalRows`: join de `imps` (group-level) con `pliByPl[plId]` (rango-level). Cada fila incluye `imp`, `pli|null`, `isActive`, `isOverride`, `effectiveMin`, `defaultMin`.
- Memo `pliModalSummary`: Σ planificado vs cap semanal (`Σ slotMinutosByHi × 5 días`), con `fits: boolean | null`.
- Modal `size="large"` con tabla, header de resumen (Σ planificado vs jornada con tonalidad verde/rojo), filas con checkbox/materia/profesor/input minutos/reset.
- Input minutos: uncontrolled con `key={pli.id}_${minutos}_${impId}` para forzar re-mount tras cada save (mantiene `defaultValue` en sync con backend). `onBlur` parsea valor: vacío → reset al default; número → PATCH si difiere del actual y del default (no-op si igualan).
- Lock por fila: `pliRowSaving[impId]` deshabilita el checkbox/input/reset mientras hay request en vuelo (evita carreras si el usuario clickea rápido).

**Frontend — `frontend/src/pages/HorariosEditor.module.css`**: ~14 clases nuevas en bloque `.pliModalBody`/`.pliSummary*`/`.pliTable*`/`.pliCheckbox`/`.pliMateria*`/`.pliMinutosInput`/`.pliResetBtn`/`.pliEmpty`/`.pliRowInactive`/`.pliRowSaving`. Tonalidad green/red para el resumen vía `color-mix(--color-success/danger, --bg-card)`. Sticky header en la tabla (la lista de imparticiones puede ser larga: max-height 60vh + scroll vertical interno).

**i18n (5 idiomas, ~22 claves nuevas por idioma)**: bloque `pliConfigure/pliModalTitle/pliLoading/pliLoadError/pliColActive/pliColMateria/pliColProfesor/pliColMinutos/pliInheritedHint/pliOverrideHint/pliReset/pliEmpty/pliSummary{Plan,Cap,Fits,NoFit}/pliActivateError/pliDeactivateError/pliSaveError`.

**Decisiones menores durante implementación**:
- **Hard-delete vs revive-on-POST**: barajado escribir un State Processor que detectara PLIs soft-deleted y los reviviera en POST. Descartado: introduce magia oculta y mantiene la columna `deleted` con valor histórico que nadie lee. Hard-delete es semánticamente más honesto para una entidad de unión derivativa.
- **Refetch completo de PLs vs patch local**: tras cada cambio refrescamos los PLs del grupo en vez de calcular delta local. Más sencillo, una request extra por edit, y garantiza que el banner anual ve datos exactos. Para volúmenes razonables (≤100 PLs/grupo) el coste es bajo.
- **Input uncontrolled con key trick**: alternativa sería local state controlado en un sub-componente `PliRow`. El key trick es más conciso y menos riesgo de drift entre estado local y backend. Trade-off aceptable.
- **No batch save**: cada cambio dispara su propio HTTP. Para volúmenes humanos (decenas de cambios por sesión) es bien. Si llega a doler, batch endpoint en una sesión futura.
- **Banner del CapacityPlanner sigue rojo si los minutos suman >jornada**: correcto — el modal es el lugar para arreglarlo, no para silenciar el aviso. La frase "Tu cómputo anual sí cuadra. Lo que falta es repartir las materias entre rangos" sigue siendo cierta y guía al admin al modal correcto.

**Próximo**: Fase 5 — eliminar parche temporal en BD (jornadas 35h "pre Calendario Real" en EAG, sustituir por jornada normal 30h/sem y verificar que con los rangos repartidos los horarios LOMLOE cuadran en cómputo anual). O Fase 7 si se prioriza calendario lectivo del centro para que el banner anual reste festivos. O Fase 6 (merge `/admin/jornadas` + `/admin/horarios`) si se prioriza UX.

### 2026-04-28 — Fix CTA del banner CapacityPlanner: rango-aware en vez de "amplía la jornada"

Detectado tras pruebas de Fase 3b. El usuario señaló (con razón) que la intención de los rangos lectivos es **precisamente** que una jornada de 27.5h/sem no sea problema, porque las horas no impartidas en el rango actual se cubrirán en otros rangos. Pero el banner del `CapacityPlanner` (Fase O) seguía mostrando el CTA de la era del parche: "Reduce horas en /admin/materias o amplía la jornada en /admin/jornadas". Eso contradice el modelo nuevo.

**Por qué el banner sigue siendo útil técnicamente**: el `CapacityPlanner` mira el rango activo y verifica feasibility semanal real. Hoy todos los `PLI` autocreados tienen `minutosSemanales = NULL` (heredan default de Materia), así que cada rango pide las 32h/sem completas y no caben en 27.5h. Eso es información verdadera: el solver no puede colocar 32h en 27.5h de slots. **Pero la solución correcta ya no es "ampliar la jornada"; es "redistribuir minutos por rango"** (Fase 4).

**Fix**:
- Título cambiado: "El itinerario no cabe **en la jornada**" → "El itinerario no cabe **en este rango**" (precisión: el problema es semanal en este rango, no una limitación global del centro).
- Body revisado: ahora explica que para cuadrar la semana sin tocar la jornada hay que redistribuir minutos por rango — Fase 4 desde UI, mientras tanto vía API o partiendo el curso en más rangos.
- Hint nuevo (`capacityHintAnnual`) que aparece SOLO si el banner anual de Fase 3b está en verde: "Tu cómputo anual sí cuadra (+96h vs currículo). Lo que falta es repartir las materias entre rangos para que cada semana quepa." Usa borde verde lateral para señalar que la situación global es buena, lo que falla es el detalle del rango.
- CSS nuevo: `.capacityHintAnnual` con fondo verde 10% y borde-izquierdo 60% para ese tono "tranquilizador dentro del banner rojo".

**i18n**: las claves `capacityInfeasibleTitle/Body` existían sólo como defaultValues en el JSX (no en los locale JSON), así que cambiar el default propaga el texto nuevo automáticamente. Si en futuras revisiones se vuelcan las claves a los 5 JSONs, copiar los nuevos defaults.

**Por qué importa documentarlo**: este es un cambio de mensaje, no de modelo, pero refleja la transición conceptual de la era parche → era rangos. El sistema sigue siendo conservador y honesto al avisar de la infeasibility semanal, pero ahora apunta a la solución correcta.

### 2026-04-28 — Fix Fase 3b: tonalidad asimétrica del banner Σ horas anuales

Detectado tras pruebas con EAG/DAW LOMLOE de 3 rangos cubriendo 01/09 → 31/05 (~39 semanas). El banner salía rojo con `+96h` de diferencia, lo que el usuario interpretó como un error. Al revisar, el caso es legítimo: 32h/sem × 39 semanas reales = 1248h vs Σ currículo 32h/sem × 36 semanas LOMLOE = 1152h. El centro adapta jornada lectiva 27.5h/sem y necesita más semanas para meter las 32h/sem del currículo — **sobrar horas no es un problema, es exactamente el patrón LOMLOE-friendly que justifica los rangos**. La regla original de tonalidad por valor absoluto (`|diff| > 15h → rojo`) era incorrecta semánticamente.

**Fix**:
- Tonalidad ahora asimétrica: `|diff| ≤ 5h → ok` (cuadra), `diff > 5h → ok` (sobran, cumples currículo), `5h < -diff ≤ 15h → warn` (faltan algunas), `-diff > 15h → error` (incumplimiento real).
- Mensaje verde dual: si cuadra muestra "el plan cuadra (±5h)", si sobran muestra "cumples el currículo con margen (+Xh anuales)".
- Mensaje rojo/amarillo siempre pone "te faltan Xh anuales" (`horasBannerUnder`); la rama "te sobran" (`horasBannerOver`) queda como i18n key disponible pero no se muestra (puede usarse en futuras vistas).
- i18n nuevo `horasBannerOverOk` en 5 idiomas.

**Por qué importa documentarlo**: la decisión D-C dice "aviso te sobran/faltan X horas" — ambas direcciones se calculan, pero la tonalidad debe reflejar **incumplimiento del currículo**, no desviación bruta. Anotado para que futuras revisiones del banner (Fase 7+) no vuelvan al modelo simétrico.

### 2026-04-28 — Fase 3b implementada (CRUD inline + banner Σ horas anuales)

UI completa de gestión de PeriodoLectivo en `/admin/horarios`. Cierra el Fase 3 entero: el admin ya puede crear, editar y borrar rangos sin tocar BD, y ve de un vistazo si el plan cuadra con el currículo.

**Frontend — `frontend/src/pages/HorariosEditor.jsx`**:
- Estado nuevo: `plPickerMode` ('create'|'edit'), `editingPlId`, `deletingPlId` (para deshabilitar UI durante DELETE).
- `openCreatePlModal` (renombrado de `openAddPlModal`) y `openEditPlModal(pl)` separados; ambos abren el mismo `ModalView` con título/submit reactivos al modo.
- `handleSubmitPlForm` reemplaza a `handleAddPl`: branch sobre `plPickerMode`. Edición = PATCH `/api/periodo_lectivos/{id}` con `application/merge-patch+json` (mismo patrón que el `handleJornadaOverrideChange` para evitar nullificar campos en API Platform 3).
- `handleDeletePl` con `useConfirm`: dos variantes de body según haya o no horarios persistidos cacheados (`placements[].hid`); bloquea si es el último PL del grupo (toast informativo); DELETE soft via `SoftDeleteProcessor`; al borrar limpia `state[gid_plid]` + `capacityByGrupo[gid_plid]` y, si era el activo, mueve la selección al rango que contiene `today()` (espejo de `PeriodoLectivoResolver`).
- Memo `horasAnualesBanner`: calcula currículo (Σ `materia.minutosSemanales` × 36 sem) vs planificado (Σ por PL de `Σ pli.effectiveMinutosSemanales × semanasDelRango`). Devuelve `{curriculumHoras, plannedHoras, diff, diffSigned, tone, plCount, semanasTotal}`. Tonalidad: ±5h verde, ±15h amarillo, más rojo. Aprovecha que `periodo_lectivo:read` ya serializa los PLIs embedidos.
- Pills del strip refactorizados de `<button>` a `<div role="button">` para poder anidar los iconos de acción (Pencil + Trash2) sin botones-dentro-de-botones. `onClick`/`onKeyDown` (Enter/Space) replican comportamiento accesible. Los iconos sólo aparecen en el pill activo y usan `e.stopPropagation()` para no disparar selección al pulsarlos.
- Banner renderizado debajo del strip cuando hay grupo seleccionado y datos suficientes.

**Frontend — `frontend/src/pages/HorariosEditor.module.css`**:
- `.plPill` reestructurado a `flex-direction: row` con `.plPillBody` interno (cuerpo nombre+fechas) y `.plPillActions` (botones edit/delete con borde-divisor).
- `.plPillActions`/`.plPillActionBtn`/`.plPillActionDanger` con hover themed (`color-mix` sobre `--button-primary-text-color` y `--color-danger`).
- `.plPillDisabled` (opacity 0.5 + pointer-events none) para feedback visual durante DELETE en curso.
- `.plBanner` + variantes `.plBanner_ok/_warn/_error` con backgrounds tematizados via `color-mix(--color-success/warning/danger, --bg-card)`. `.plBannerStats`, `.plBannerStat`, `.plBannerArrow`, `.plBannerHint`, `.plBannerMeta` para el layout interno.
- `.plPill:focus-visible` añadido (la accesibilidad básica que perdimos al cambiar de `<button>` a `<div role="button">`).

**i18n (5 idiomas, ~17 claves nuevas por idioma)**: `editRango/editRangoTitle/editRangoSubmit/editRangoSubmitting/rangoUpdated/rangoUpdateError/deleteRango/deleteRangoConfirmTitle/deleteRangoConfirmBody/deleteRangoConfirmBodyWith/deleteRangoOnlyOne/deleteRangoSuccess/deleteRangoError/horasBannerCurriculum/horasBannerPlanned/horasBannerDiff/horasBannerHint/horasBannerOk/horasBannerOver/horasBannerUnder`. Locales: `es.json`, `en.json`, `ca.json`, `eu.json`, `gl.json`.

**Decisiones menores durante implementación**:
- El selector de jornada por rango **se cubrió desde la edición del PL** (modal con campo `jornadaTipoId`) en vez de añadir un selector inline pegado a cada pill. Razón: el patrón `pill = ver/seleccionar; modal = configurar` es más limpio y consistente con el flow de creación. Si en el futuro pesa más la velocidad, se puede añadir un selector inline sin reestructurar.
- El banner ignora festivos del centro (usa `(fechaFin - fechaInicio) / 7` literal). Cuando llegue Fase 7 (calendario lectivo) podrá restar semanas no lectivas. Mientras tanto, sirve como detector de desajustes grandes (>15h de diferencia).
- El umbral de tonalidad se fijó en ±5h ok / ±15h amarillo / >15h rojo de forma intuitiva (no parametrizable por ahora). Si los centros piden más estricto/laxo, se externaliza más adelante.
- La cuenta de horarios persistidos en el confirm body sólo mira el `state[stateKey]` cacheado: si el admin nunca visitó el PL en esta sesión, mostramos el confirm body genérico. Es honesto: no engañamos diciendo "0 horarios" cuando podría haber, simplemente omitimos la cifra.
- `handleDeletePl` no invalida `plByGrupo[selectedGrupo]` con un re-fetch — actualiza el state filtrando localmente. Mismo patrón que `handleAddPl` original.

**Bug histórico residual (no introducido en esta sesión, pero relevante)**: el cascade de `setSelectedPlByGrupo` tras borrar usa `plByGrupo[selectedGrupo]` *antes* de aplicar el `setPlByGrupo`. Funciona porque el filter dentro del cascade lee la lista pre-update y aplica el mismo filter; el resultado es correcto, pero es un poco frágil si alguien añade una transformación intermedia. Mantenido tal cual para no inflar la sesión, anotado aquí por si vuelve a tocarse.

**Próximo**: Fase 4 (UI de gestión PLIs por rango — activar/desactivar imparticiones por rango, ajustar minutos override).

### 2026-04-28 — Doc creado

Escrito el doc completo a partir de la conversación con el usuario sobre el parche temporal de jornadas 35h. Modelo `PeriodoLectivo` + `PeriodoLectivoImparticion` decidido. D-A, D-B, D-D, D-E, D-F cerradas. D-C, D-G, D-H, D-I abiertas. 7 fases planteadas. Cross-ref a jornadas-recreos (parche), calendario-escolar (Fase 5 fusionada), curriculum-ccaa (banner verde), calificaciones (sin tocar). Pendiente: implementar Fase 1.

### 2026-04-28 — Stepping stone: override de jornada por grupo

Implementado **el override de jornada por grupo** (`Grupo.jornadaTipoOverride`) como paso previo a la migración a `PeriodoLectivo` Fase 1. Permite al admin elegir, desde el `infoBar` de `/admin/horarios`, qué plantilla de jornada usa el solver / `CapacityPlanner` / editor para un grupo concreto, sin tocar el itinerario.

**Por qué importa para este doc**: el override del grupo es **el dato que migrará** la migración de Fase 1. Cada grupo con override pasará a tener un `PeriodoLectivo` único `"Curso completo"` cuya `JornadaTipo` será exactamente ese override. Los grupos sin override heredarán la jornada del itinerario en su rango único. Esto significa que la migración Fase 1 ya tiene un dato real que migrar — no es solo "auto-creación con valores default".

**Bitácora detallada del override** (cambios de código, i18n, migration): ver `docs/hoja-de-ruta-jornadas-recreos.md` entrada `2026-04-28 — Override de jornada por grupo`.

**Pendiente** (sin cambios respecto al estado anterior del doc):
- D-C / D-G / D-H / D-I abiertas (decisiones del modelo `PeriodoLectivo`).
- Fase 1: modelo + migración (auto-crea rango único `"Curso completo"` por grupo, copia override → `PeriodoLectivo.jornadaTipo`).

### 2026-04-28 — Fase 8 añadida al roadmap

Acordada con el usuario una nueva **Fase 8: tab "Consumición de horas anuales" por grupo**. Es la fase que cierra el ciclo de gestión: dashboard con vista "ahora" (cuánto se ha impartido de cada materia hasta hoy vs el currículo) + proyección anual basada en los `PeriodoLectivo` configurados, con doble eje temporal `rango`/`evaluación`. Sin este tab los rangos son una caja negra; con él, son una herramienta de gestión real para el jefe de estudios. Esfuerzo estimado 2-3 sesiones. Detalles en §3 Fase 8.

### 2026-04-28 — Fase 3a implementada (timeline strip + selección + cableado API)

UI nueva en `/admin/horarios`: strip horizontal sobre el editor con un pill por cada `PeriodoLectivo` del grupo + botón "Añadir rango" que abre modal (nombre, fechas, jornada opcional). Cambiar de pill recarga editor y CapacityPlanner del nuevo PL. Estado del editor refactorizado a clave compuesta `${grupoId}_${plId}` para que cada PL mantenga su propio set de placements/baseline/dirty en memoria.

**Backend**:
- `App\State\PeriodoLectivoCreateProcessor` (nuevo): tras POST de un PL, auto-crea un PLI por cada Imparticion viva del grupo (minutos NULL = hereda Materia). Sin esto, un PL recién creado estaría vacío.
- `Horario` ApiFilter: añadido filtro `periodoLectivo` (exact) y `periodoLectivo.grupo` (exact) — necesario para que el frontend pueda hacer `?periodoLectivo=N` en la query de horarios.
- `HorarioBatchController`: acepta `periodoLectivoId` opcional en el body (cuando viene, lo usa para scope del check de concurrencia y para fijar `Horario.periodoLectivo` en cada create del lote).
- `services.yaml`: registrado el nuevo State Processor.

**Frontend**:
- Estado nuevo: `plByGrupo`, `selectedPlByGrupo`, `plPickerOpen`, `plForm`, `addingPl`.
- useEffect 1.5.c: fetch `/api/periodo_lectivos?grupo=N` al seleccionar grupo, fija default = PL activo (contiene today o, si no, primero por fechaInicio).
- `stateKey = ${grupoId}_${plId}` derivado, usado en todas las cachés del editor.
- `resolveEffectiveJornadaId(g, pl)` ampliado a la cadena `PL > Grupo.override > Itinerario`, espejo del backend.
- Strip + pills + modal con CSS themed (`.plStrip`, `.plPill`, `.plPillActive`, `.plPillAdd`, `.plForm*`).
- i18n en 5 idiomas (~12 claves nuevas en bloque `scheduleEditor.*`).

**Decisiones menores durante implementación**:
- El strip se muestra incluso con un solo PL ("Curso completo") tras la migración Fase 1, para hacer visible la primitiva (alternativa: ocultarlo si len=1, descartada por didactic value).
- El selector de jornada del `infoBar` sigue controlando `Grupo.jornadaTipoOverride` (no la jornada del PL). El PL tiene su propia jornada que se fija en el modal de creación. Fase 3b añadirá selector de jornada inline por rango.
- Estado del editor mantiene placements de todos los PLs visitados en memoria (composite key). Si la página se recarga, se pierden los no guardados — limitación documentada.

**Pendiente Fase 3b**: editar/borrar PLs desde UI, selector de jornada por rango inline, banner Σ horas anuales, gestión de PLIs por rango.

**Hotfix mismo día (TDZ en HorariosEditor)**: tras cargar `/admin/horarios` en el navegador la primera vez, fallaba con `ReferenceError: Cannot access 'selectedPlId' before initialization`. Causa: introduje `selectedPlId` y `stateKey` como dependencias en useEffect 1.5 (jornada loader) y 1.6 (capacity-check), pero las declaraciones `const` estaban después de esos useEffect en el cuerpo del componente. React ejecuta el cuerpo de arriba abajo en cada render → TDZ. Fix: mover ambas declaraciones justo después de los helpers (`extractFkId`, `resolveEffectiveJornadaId`) y antes del primer useEffect que las consume. Commit `006deeb`.

### 2026-04-28 — Fix post-Fase 2: PL.jornadaTipo debe quedar NULL por defecto

Detectado tras probar Fase 2: al cambiar la jornada desde el selector de `/admin/horarios`, el banner verde/amarillo/rojo del `CapacityPlanner` se quedaba en rojo aunque la nueva jornada SÍ encajara. Causa: la migración Fase 1 copió `Grupo.jornadaTipoOverride → PeriodoLectivo.jornadaTipo` literalmente, "congelando" la jornada en BD. Como `PL.getEffectiveJornadaTipo()` prioriza el campo propio sobre el cascade, los cambios posteriores del override del grupo no propagaban — el `CapacityPlanner` veía la jornada vieja (la del momento de la migración) y la rejilla la nueva (que el frontend lee en cliente). Desincronización total.

**Fix**:
- Migración Fase 1 (`Version20260428180000`) actualizada: `INSERT ... jornada_tipo_id = NULL` en vez de copiar el override.
- SQL one-shot para entornos ya migrados: `UPDATE periodo_lectivo SET jornada_tipo_id = NULL`. La cadena `PL → grupo (override) → itinerario` toma el control y todo vuelve a sincronizarse.
- Doc de D-D ampliada para dejar explícita la regla: el campo `PL.jornadaTipo` se queda NULL por defecto y solo se rellena cuando el admin lo cambia para ese rango concreto (caso FCT/Proyecto Intermodular).

### 2026-04-28 — Fase 2 implementada (solver y planner por rango)

Cableado backend de Fase 2. Servicios y controlador adaptados para que el solver y el `CapacityPlanner` operen sobre `PeriodoLectivo` en vez de `Grupo` directamente, manteniendo el comportamiento observable idéntico al actual mientras solo haya un rango por grupo.

**Archivos nuevos**:
- `backend/src/Service/PeriodoLectivoResolver.php` — resuelve rango activo (contiene `today()`, fallback al primero por `fechaInicio`).
- `backend/src/EventSubscriber/HorarioPeriodoLectivoSubscriber.php` — `prePersist` que auto-rellena `Horario.periodoLectivo` si el cliente no lo envía. Necesario porque la columna pasó a NOT NULL en Fase 1 y el frontend pre-Fase 3 sigue POSTeando horarios sin ese campo.

**Archivos modificados**:
- `HorarioSolver.php`: signature `solve(Grupo, ?int, ?PeriodoLectivo)`; lee imparticiones desde PLI (con `getEffectiveMinutosSemanales`); jornada vía `PeriodoLectivo.getEffectiveJornadaTipo()`; añade `periodoLectivoId/Nombre` al output. `buildParallelBusy` ahora pide PL activo de cada grupo paralelo y filtra `Horario.periodoLectivo` (no cuenta placements de rangos antiguos como ocupación).
- `CapacityPlanner.php`: signature `plan(Grupo, ?PeriodoLectivo)`; constructor recibe `PeriodoLectivoResolver`; lee imparticiones desde PLI.
- `HorarioSolverController.php`: ambos endpoints aceptan PL opcional (body `periodoLectivoId` en POST, query `?periodoLectivo=N` en GET); valida pertenencia al grupo (422 si no).

**Decisión menor durante implementación**: el resolver tiene fallback "primer rango por `fechaInicio`" cuando ningún rango contiene `today()` (caso típico antes de septiembre o tras junio). Permite que el editor siga funcionando fuera de horas lectivas sin errores en blanco.

**Pendiente Fase 3**: UI timeline de rangos en `/admin/horarios` (selector por rango, "+ añadir rango", botones de duplicar/borrar, banner Σ horas anuales por grupo).

### 2026-04-28 — Fase 1 implementada (modelo + migración con backfill)

Cerradas previamente D-C, D-G, D-H, D-I (sin pendientes en la lista de decisiones). Implementada la Fase 1 entera:

- Entidades `PeriodoLectivo` y `PeriodoLectivoImparticion` con sus repositorios, ApiResource (incluido Patch), filtros, traits y validators.
- `Horario.periodoLectivo` FK NOT NULL (con tránsito por nullable durante el backfill).
- Migration `Version20260428180000`: tablas + backfill que crea un rango único `"Curso completo"` por grupo (fechas con COALESCE de `Grupo.fechaInicio/Fin` o fallback a `anio_escolar` parseado en SQL con `SUBSTRING_INDEX`/`STR_TO_DATE`), copia `Grupo.jornadaTipoOverride` como `PeriodoLectivo.jornadaTipo`, crea PLI por cada imparticion (minutos NULL = hereda Materia), vincula horarios al rango único, y al final hace `ALTER TABLE horario MODIFY periodo_lectivo_id INT NOT NULL`.

**Decisión menor durante implementación** (no estaba prevista en el doc original): los datos backfilleados de `PeriodoLectivoImparticion` se persisten con `minutos_semanales = NULL` en vez de copiar `Materia.minutosSemanales`. Razón: el helper `getEffectiveMinutosSemanales()` ya cae a `Materia.minutosSemanales` cuando el override es NULL — copiarlo a la BD generaría duplicación innecesaria y desincronización si el admin cambia el default de la materia. Sólo se rellena `minutos_semanales` cuando el admin quiere desviarse del default en un rango concreto (caso típico: materia con menos peso semanal en el rango FCT).

**Pendiente Fase 1.5**: auto-crear `PeriodoLectivo "Curso completo"` cuando se crea un Grupo nuevo vía API (la migración solo cubre los existentes). Decisión diferida — se cierra como parte de Fase 3 cuando la UI de timeline esté lista, o antes si los seeds nuevos lo requieren. Mientras tanto, los seeds que creen grupos deben crear también su PL.

**Próximo**: Fase 2 (solver y `CapacityPlanner` por rango) — pendiente decisión de scope con el usuario.

### 2026-04-28 — Ubicación de Fase 8 cerrada

Decidido tras discusión con el usuario: la Fase 8 vive como **sub-pestaña dentro de `/admin/horarios`** (no ruta propia, no en `/admin/grupos/{id}`). Razón principal: editar horarios y verificar consumición son la misma tarea de planificación temporal, y el contexto (selector de grupo + jornada efectiva + capacity-check) ya está montado en `/admin/horarios`. Encaja con la unificación prevista en Fase 6 (`/admin/jornadas` + `/admin/horarios` → contenedor por grupo con pestañas). Mitigación si la pestaña crece: partir en sub-rutas tipo `/admin/horarios/{grupoId}/dashboard` manteniendo el contexto del selector — diferido. Doc actualizado en §3 Fase 8 ("Ubicación decidida").
