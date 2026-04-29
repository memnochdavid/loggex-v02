# Períodos lectivos (rangos de fecha) y solver por rango

> **Status (2026-04-29)**: 🟢 **Fase 5 COMPLETA** + **Fixes post-cierre 2026-04-29**: (a) cuota equitativa cross-rango en `CapacityPlanner` con tolerancia anual 0; (b) "Configurar curso óptimo" en frontend que calcula `semanasOptimas` y crea rangos óptimos + lanza el solver; (c) skip materia con cuota residual < slotMin en último rango; (d) reducción proporcional con criterio "menor penalty %" — concentra el déficit en la materia más grande (que lo absorbe mejor relativamente) en lugar del round-robin caprichoso anterior. Resultado: en grupos sin déficit estructural, todas las materias al 100-108%; en grupos con déficit (Σpresencial > capacidadSlots), una materia grande absorbe el déficit y las demás al 97-103%. Quedan Fase 6 (merge `/admin/jornadas` + `/admin/horarios`), 7 (calendario lectivo del centro, parametriza D-L), 8 (dashboard horas anuales).

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

#### Sub-fase A — Modelo mental anual en UI  ✅ Done (2026-04-28)

- ✅ **Modal "Materias del rango"**: input cambiado a `Horas anuales (en este rango)` con `step="0.5"`. Conversión interna `minutosSemanales = round(horasAnuales × 60 / semanasRango)` al onBlur. Placeholder = `defaultMin × semanasRango / 60` (heredado de Materia). Hint secundario muestra "≈ X min/sem media" para que el admin pueda comprobar la conversión. Vacío = reset al default heredado.
- ✅ **Header del modal**: dos stats en horas anuales con sub-label semanal (`Σ planificado en el rango: 576h ≈ 32h/sem`) vs `Cap. del rango (18 sem): 495h = 27.5h/sem`. La regla `fits` sigue evaluándose contra el cap semanal (es la restricción dura del solver), pero la vista principal es anual.
- ✅ **ModuleChip lateral**: contador cambia de `Xh/Yh` semanal → `Xh/Yh anuales` (con sufijo "h"). Objetivo = `materia.minutosSemanales × 36` (constante D-L). Colocadas = Σ across todos los PLs del grupo de `(slot duración × semanas del PL)`. El PL activo lee del state local (placements vivos sin guardar); los demás PLs leen de `allHorariosByGroup` (persistidos).
- ✅ **Validación drag y tap-mode**: cambia de "regla semanal del PL activo" a "regla anual cross-rango". El admin ya no es bloqueado por estar saturando la semana del PL activo si globalmente todavía le quedan horas. `done` del chip se evalúa anual.
- ✅ **Refetch tras save**: `refetchAllHorariosForGroup` cargado en `performBatchSave` para que el chip refleje verdad persistida tras guardar (incluyendo placements del PL activo recién persistidos).
- ✅ **i18n**: 7 claves nuevas por idioma (`pliColHorasAnuales`, `pliHorasInheritedHint`, `pliHorasOverrideHint`, `pliSummaryPlanAnual`, `pliSummaryCapAnual`, `pliSummaryNoFit` actualizado, `pliSummaryFits` mantenido).

**Limitaciones conocidas** (cierre en sub-fases siguientes):
- Constante 36 sem hardcoded para el objetivo anual (D-L). Cuando llegue Fase 7 (calendario lectivo del centro), se sustituye por cálculo desde `Centro.fechaInicioCurso/FinCurso` − festivos.
- Las ocurrencias del día_semana en cada PL se aproximan como `(fechaFin − fechaInicio) / 7`. No descuenta festivos del día concreto. Para Fase 7 se afina.
- `unplacedSummary` (modal "publicar incompleto") sigue en min/sem: enseña "le faltan X horas semanales" en vez de anuales. Cambiar a anual aquí también es trivial pero no urgente.
- El banner del CapacityPlanner sigue mostrando rojo en su lógica original ("min/sem > jornada") — sub-fase C lo relajará.
- Cuando hay cambios sin guardar en el PL activo, el chip los cuenta correctamente (lee de `placements` en vez del fetched para el PL activo). Pero los cambios sin guardar de OTROS PLs (escenario raro: navegar a otro PL con dirty=true y volver) NO entran en el cómputo. Aceptable.

**Esfuerzo invertido**: ~0.5 sesión, según estimación.

#### Sub-fase B — Botón "Extender curso" en banner anual  ✅ Done (2026-04-28)

- ✅ Memo `extendCourseSuggestion`: calcula faltanHoras, extraSemanas (`ceil(faltan / jornadaSemanaH)`), extraDays (`× 7`), lastPl (sort desc por fechaFin), nuevas fechas y preview del nuevo `newDiff` (`oldPlanned + extraSemanas × Σ effectiveMin del último PL`). Devuelve null si banner ya está ok, faltan ≤ 0, o no hay jornada/PLs.
- ✅ Botón "Extender el curso N días" inline en `.plBannerHint` cuando `extendCourseSuggestion` no es null. Estilo themed (primary color, icono CalendarClock).
- ✅ Modal de confirmación (size medium): intro con horas faltantes + días + semanas; tabla con dos filas (`Grupo.fechaFin` y último `PL.fechaFin`) mostrando antes/después; preview con tonalidad ok/warn/error y mensaje correspondiente.
- ✅ Handler `handleConfirmExtendCourse`: PATCH `merge-patch+json` secuencial — primero el PL, luego el Grupo. Si el PL falla, abortamos sin tocar Grupo. Si el Grupo falla tras PL OK, se muestra warning toast (PL extendido pero Grupo no — desalineamiento cosmético, recuperable manualmente). Tras éxito: refetch `refetchPlsForGroup`, update local de `grupos`, invalidate `capacityByGrupo` para el PL extendido. Toast success.
- ✅ i18n nuevo en 5 idiomas (~16 claves nuevas en bloque `extendCourse*`).

**Limitaciones conocidas** (no bloqueantes):
- El cálculo asume que la jornada del PL activo es representativa del centro. Si el último PL tuviera una jornada distinta (caso atípico), la fórmula `ceil(faltan / jornadaSemanaActiva)` puede dar un número de semanas off. Para producción real, mejor usar la jornada del último PL (refactor menor diferido).
- No hay rollback automático si el PATCH del Grupo falla tras el PATCH del PL OK. La probabilidad es baja (mismas validaciones, mismo backend, mismo grupo) pero existe. Futura mejora: mover ambos PATCHes a un endpoint backend transaccional.
- El cálculo de `extraSemanas` redondea hacia arriba a semanas completas (no admite "extender 4 días"). Razón: las semanas son la unidad natural lectiva. Si el centro necesita ajuste fino, edita las fechas a mano desde el modal "Editar rango".
- La preview del banner asume que las nuevas semanas se llenarán con la composición actual del último PL (Σ effectiveMin). Si el admin desactiva materias o ajusta minutos en ese rango después de extender, el banner real difiere. Aceptable como guía orientativa.

**Esfuerzo invertido**: ~0.5 sesión, según estimación.

#### Sub-fase C — CapacityPlanner relajado (anual-aware)  ✅ Done (2026-04-28)

- ✅ Memo `capacityFeasibilityAnual`: compara Σ currículo (`Σ materia.minutosSemanales × 36`) contra Σ capacidad real (`jornadaSemanalMin × Σ semanasByPlId`). Devuelve `fits: bool` + `deficitH` cuando no cabe + cifras detalladas para el mensaje.
- ✅ Branch del banner cuando `!cap.feasible` ahora bifurca:
  - **`anualFits === true`**: banner **amarillo informativo** (`AlertTriangle`, no `Ban`). Título "Sobrecarga semanal en este rango". Mensaje incluye `total/cap` semanal + `capacidadH/curriculumH` anual para que el admin vea ambas escalas. CTA: "redistribuye minutos entre rangos desde Sliders o crea otro rango". Lista huérfanos para diagnóstico.
  - **`anualFits === false`**: banner **rojo real**. Título "El currículo no cabe en el calendario actual". Mensaje detalla `currículo H vs capacidad H (jornada × semanas)` + `déficit H` físicas. CTA: "extiende el curso (botón en banner anual) o aumenta la jornada lectiva". Sigue listando huérfanos.
- Branch `cap.feasible && roundups` (amarillo) y `cap.feasible && exact` (verde) **sin cambios** — siguen siendo info útil sobre el solver.
- ✅ i18n: 4 claves nuevas en 5 idiomas (`capacityWeekOverloadTitle/Body`, `capacityAnualInfeasibleTitle/Body`). Las antiguas (`capacityInfeasibleTitle/Body/AnnualOk`) quedan obsoletas pero se mantienen por compatibilidad con los `defaultValue` de cualquier ruta no migrada.

**Coherencia con Fase 5 sub-A/B**: el banner CapacityPlanner deja de ser la alarma central y pasa a guiar al admin a la solución correcta — Sliders/crear rango si la redistribución arregla, "Extender curso" del banner anual si no.

**Limitación conocida**:
- El cálculo de capacidad usa la jornada del PL **activo** asumiéndola representativa. Si el grupo tiene rangos con jornadas distintas (típico tras Fase 4), `capacityFeasibilityAnual` pinta una capacidad teórica común. Para producción real hace falta sumar `jornadaPL × semanasPL` PL a PL. Refactor menor diferido a iteración futura — el rango activo suele ser la jornada del centro y la aproximación funciona en el 95% de casos.

**Esfuerzo invertido**: ~0.5 sesión, según estimación.

#### Sub-fase E — Auditoría y corrección de catálogo DAW LOMLOE Andalucía  ✅ Done (2026-04-28)

> Insertada tras feedback del usuario: tras sub-A/B/C el caso 1º DAW LOMLOE con jornada 27.5h seguía sin cuadrar (faltan 119h físicas). Antes de aceptar la "brujería" (extender curso a julio o subir jornada con recreos), verificamos si los datos del catálogo son correctos vs RD oficial. Resultado: **el catálogo en BD tenía 3 errores que sumaban +3h/sem infladas**. Corregidos, el caso cuadra sin trucos.

**Errores detectados** (1º DAW + DAM Andalucía LOMLOE):

| Materia | BD antes | BOJA Res 26/06/2024 | Δ |
|---|---|---|---|
| 0483 Sistemas informáticos | 360 min/sem (6h) | 300 min/sem (5h) | −1h |
| 0373 Lenguajes de marcas y sist. gestión info | 240 min/sem (4h) | 180 min/sem (3h) | −1h |
| 1708 Sostenibilidad **en 1º DAW + DAM** | 60 min/sem (1h) | NO existe en 1º (es de 2º con 120 min) | −1h (eliminada de 1º) |

**Origen del problema**: el `BojaAndHardcodedProvider` (`backend/src/Catalogo/Ccaa/Provider/`) tenía documentado en su comment que DAW 1º LOMLOE Andalucía suma 29h, pero **faltaban los overrides explícitos** para 0483 y 0373 — el provider asumía que los valores BOE base eran 5h y 3h, pero el BOE pre-LOMLOE dice 6h y 4h. Sin override, el resync usaba el BOE inflated. Y Sostenibilidad-en-1º era una imparticion residual de seeds antiguos pre-LOMLOE.

**Correcciones aplicadas**:
- BD oneshot via SQL directo:
  - `UPDATE materia SET minutos_semanales = 300 WHERE codigo_oficial = '0483'`
  - `UPDATE materia SET minutos_semanales = 180 WHERE codigo_oficial = '0373'`
  - `UPDATE imparticion SET deleted = 1 WHERE id IN (39, 62)` (Sostenibilidad-en-1º DAW + DAM EAG)
- Provider `BojaAndHardcodedProvider`: añadidos overrides explícitos `0483:300` y `0373:180` para DAW 1º y DAM 1º. Centros futuros que materialicen estos itinerarios LOMLOE Andalucía obtendrán las cifras correctas vía resync, sin necesidad del UPDATE manual.

**Verificación**: 1º DAW EAG ahora suma `5+6+8+3+3+3+1 = 29h/sem` (1740 min) según BOJA LOMLOE. Currículo anual = 29 × 36 = 1044h. Capacidad real con jornada 27.5h × 37.6 sem (3 rangos del usuario) = 1033h. **Faltan solo ~11h, casi cuadrado** — extender curso 1 sem o subir jornada a 30h cuadra cómodamente. Sin parche temporal.

**Deuda anotada para futuras fases**:
- El catálogo nacional (`catalogo_materia.minutos_semanales`) está NULL para todas las materias DAW. El BOE enricher no extrajo `horasSemanales` del PDF (solo `horasTotales`). Eso significa que el resolver depende SOLO de los overrides de provider para producir cifras semanales. Si falta un override, la materia queda en NULL y la materialización pone 0 (caso FP) o NULL (ESO/Bach). **Tarea futura**: rellenar `catalogo_materia.minutos_semanales` desde `horas_totales / 33 sem` como default razonable cuando no haya extracción del PDF.
- Verificar también DAW 2º + DAM 2º (no auditados aún en esta sesión). Provider tiene overrides sospechosos sin verificar PDF BOJA real ("patrón observado").
- Verificar otros itinerarios FP (ASIR, SMR, otros) — pueden tener problemas similares. **Backlog: auditoría sistemática del catálogo FP LOMLOE**.

**Esfuerzo invertido**: ~0.75 sesión (investigación + UPDATE + provider).

#### Sub-fase D — Cierre del parche temporal en BD  ✅ Done (2026-04-28)

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

### 2026-04-29 — Reducción proporcional con criterio "menor penalty %" (C)

**Bug detectado**: tras "Configurar curso óptimo" en 1º DAW (déficit estructural 1.5h/sem: jornada 27.5h vs currículo 29h), el resultado por materia era caprichoso: Sistemas 5h al 78%, Bases 6h al 86%, Programación 8h al 97%. Sin lógica pedagógica — la reducción round-robin penalizaba materias en orden de iteración.

**Causa raíz**: la reducción proporcional usaba el criterio "materia con MENOS reducción acumulada", lo que iteraba round-robin penalizando las primeras encontradas. Para Σpresencial > capacidadSlots, el déficit se distribuía sin considerar el peso relativo de cada materia.

**Fix**: nuevo criterio "menor penalización porcentual". Cada iteración quita 1 slot a la materia que pierda MENOR % relativo de sus minutos:

```php
foreach ($materias as $idx => $m) {
    if ($m['minutos'] < $unidadRedondeo * 2) continue;
    $penaltyPct = $unidadRedondeo / $m['minutos'];
    if ($penaltyPct < $minPenaltyPct) {
        $minPenaltyPct = $penaltyPct;
        $candidatoIdx = $idx;
    }
}
```

Las materias grandes absorben mejor 1 slot perdido (8h/sem → 7h = -12.5%) que las pequeñas (1h/sem → 0h = -100%). El criterio concentra el déficit en la materia más grande, que es la matemáticamente óptima en términos de minimizar el déficit relativo total.

**Verificación E2E** con 3 grupos del centro EAG:

| Grupo | Antes (round-robin) | Después (menor penalty %) |
|---|---|---|
| 2º DAW | 5 al 110%, Inglés 126%, otras 102% | 5 al 102%, Inglés 106% |
| 2º DAM | 6 al 120%, Inglés 120% | 6 al 101-104%, Inglés 108% |
| 1º DAW | Sistemas 78%, Bases 86%, Programación 97%, otras 95-100% | 6 al 97-103%, Programación 77% (absorbe déficit) |

En 1º DAW, Programación (la materia más grande) absorbe los 1.5h/sem de déficit estructural. Resultado mejor para el centro: 6 de 7 materias al 97-103% en lugar de "lotería round-robin" donde algunas a 78%, otras a 97%.

**Sobre el déficit estructural irreductible** (Σpresencial > capacidadSlots): el truco recreos LOMLOE FP (Fase 5 sub-C) ya muestra banner verde-info "Currículo dentro de la jornada lectiva (incluye recreos)" — informa correctamente al admin. El chip lateral muestra placedHours físicos honestos (Programación al 77% = 360 min/sem placement real, las 120 min/sem faltantes se cuentan curricularmente como recreo lectivo LOMLOE). Los placements no se "inflan virtualmente" para mostrar 100%.

**Limitación remanente** (follow-up posible, no crítico): el banner anual lateral y los chips podrían incluir indicación visual explícita "X h cubiertas por recreos lectivos LOMLOE" cuando hay déficit ≤ recreosMinutosSemanales × 5 días. Por ahora el banner CapacityPlanner ya cubre ese mensaje cuando se pulsa "Resolver".

### 2026-04-29 — "Configurar curso óptimo" (frontend) + cuota equitativa con tolerancia 0

**Cambios de raíz arquitectónica** descubiertos al observar que con 5 rangos de ~9 sem cada uno (43.5 sem total > 36 LOMLOE), el solver acababa colocando ~120% del currículo aunque la cuota equitativa repartiera bien. Causa: el calendario tenía MÁS semanas de las necesarias para el currículo, así que el round-up D22=A en cada rango acumulaba overshoot. Diagnóstico del usuario: "no debería poder calcularse el número idóneo de rangos lectivos? y que cuando no quedan horas lectivas de materias, que no se impartan. rangos recomendados y generar todo deberían complementarse".

**Cambios en código**:

- `backend/src/Service/CapacityPlanner.php`: tolerancia anual de `max(90, objetivo × 20%)` → **0 absoluto**. Con la cuota equitativa repartiendo, el round-up se autorregula en el último rango: cuando `maxRestante` cae por debajo de `slotMin × semanasRango`, el ILP fuerza un round-DOWN natural (combo `sum >= m_pequeño` = un solo slot), absorbiendo el exceso. Resultado típico: 1-8% overshoot en lugar de 20%.

- `frontend/src/pages/HorariosEditor.jsx`:
  - Nuevo `useMemo` `semanasOptimas = ceil(Σobjetivos_presencial / jornadaSemanalLectivaMin)` con filtro modalidad (sólo PRESENCIAL).
  - `handleCreateRecommendedRangos` reemplaza el span `[Grupo.fechaInicio, Grupo.fechaFin]` por `min(semanasOptimas × 7, totalDíasCalendario)`. El resto del calendario queda libre para FCT, exámenes, evaluaciones — el centro lo decide aparte.
  - Nuevo `handleConfigureOptimalCourse` que combina creación de rangos óptimos + `runSolverAllRangos` en un solo flujo. Confirm dialog explícito (borra rangos y placements actuales).
  - Nuevo botón "Configurar curso óptimo (N sem)" en el menú "Acciones del curso", como primera entrada (acción primaria).
  - Modal "Crear Rangos Recomendados" muestra ahora cifras: Σ currículo / jornada / semanas óptimas calculadas. Body actualizado: "cubriendo X semanas (las necesarias para el currículo) desde Y. El resto del calendario queda libre para FCT, exámenes, etc.".

- `frontend/src/i18n/locales/{es,en,ca,gl,eu}.json`: 8 claves nuevas + actualización de `createRangosBody` para reflejar el nuevo span. JSON validado en los 5 idiomas.

**Verificación**:
- Build Vite OK (sin warnings nuevos).
- Para 2º DAM con jornada 30h/sem y currículo 28h/sem × 36 sem = 1008h presencial → `semanasOptimas = ceil(1008 / 30) = 34 semanas`. Antes el sistema creaba rangos cubriendo 47 sem (todo el calendario). Ahora cubre 34 sem y deja 13 sem libres del año natural.
- Con 3 rangos de ~11.3 sem cada uno (en lugar de ~9.6), el cap anual cuadra al ~100% del currículo sin overshoot significativo.

**Filosofía del cambio**: el calendario lectivo del centro NO debe coincidir necesariamente con el año natural. El currículo LOMLOE pide 36 sem efectivas; si la jornada cubre el peso semanal exactamente, entonces 36 sem es el calendar óptimo. Para jornadas distintas (más cortas), la fórmula calcula automáticamente cuántas sem extra son necesarias. El espacio sobrante se libera para actividades no lectivas regulares (FCT dual, exámenes finales, recuperaciones), que en Loggex se modelarán cuando llegue Fase 7 calendario-escolar.

**Limitaciones conocidas**:
- "Configurar curso óptimo" usa el último valor de `createRangosCount` (default 3). Si quieres distinto número de rangos, abre el modal "Crear Rangos Recomendados" primero y ajusta, luego usa "Configurar curso óptimo" (que ahora respetará tu N).
- La fecha de inicio es siempre `Grupo.fechaInicio`. El primer rango empieza ahí independientemente de festivos. Cuando llegue Fase 7 con calendario lectivo real del centro, el inicio se podrá ajustar a la primera semana lectiva real.
- El cálculo de `semanasOptimas` solo cuenta materias presenciales. FCT/NO_REGULAR/AUTONOMA no afectan al span (correcto: no ocupan slot semanal). Si el centro quiere reservar semanas adicionales para FCT, las añade manualmente como rango aparte (acción "Añadir rango manual").

### 2026-04-29 — Fix post-cierre Fase 5: cuota equitativa cross-rango en CapacityPlanner

**Bug detectado** durante prueba de la Fase 4 modalidad: con 5 rangos lectivos, el solver dejaba el último rango casi vacío (DAW: 2 placements; DAM: 8 placements) mientras los primeros 4 cargaban al máximo. Comparativa antes del fix:

| Grupo | Rangos | Antes |
|---|---|---|
| 2º DAW | 5 × ~9.6 sem | 25 / 25 / 25 / 21 / **2** placements |
| 2º DAM | 5 × ~8.7 sem | 28 / 28 / 28 / 28 / **8** placements |

**Causa raíz**: el `CapacityPlanner::plan()` calculaba `cuotaNatural = min/sem × semanasRango`. Cuando Σsemanas del grupo > 36 (semanas LOMLOE de referencia), los primeros rangos saturaban al 100% del currículo anual y el cap dejaba al último rango con `maxRestante ≈ 0`. Consecuencia operativa: pedagógicamente absurdo (alumno sin clases en el último rango porque "ya se cumplió la cuota").

**Fix**: tres cambios en `backend/src/Service/CapacityPlanner.php`:

1. **Cuota equitativa** como tercera variable del `min()`:
   ```
   cuotaEquitativa = objetivoAnual × (semanasRango / totalSemanasGrupo)
   cuotaEsteRango  = min(cuotaNatural, cuotaEquitativa, maxRestante)
   ```
   Reparte el currículo anual proporcionalmente al peso de cada rango. Si Σsemanas = 36, equitativa coincide con natural. Si Σsemanas > 36, equitativa < natural y limita el primer rango.

2. **Helper `calcularTotalSemanasGrupo(Grupo)`** que suma semanas de todos los PLs vivos. Solo se invoca cuando `alreadyPlacedByImp !== null` (modo cap anual cross-rango activo) — no penaliza el modo legacy / single-range.

3. **Tolerancia anual proporcional**: de `90 min absoluto` a `max(90, objetivoAnual × 20%)`. Razón: con multi-rango y slots de 60 min, el round-up D22=A acumula hasta ~30 min/sem por materia × N rangos × M semanas. La tolerancia 90 min era insuficiente para currículos típicos LOMLOE (Inglés GS 72h → tolerancia 14.4h vs los 1.5h previos). El piso de 90 min absoluto preserva el comportamiento para currículos pequeños.

**Modo legacy intacto**: si `alreadyPlacedByImp` es null (caller no calcula cap anual), ninguna de las tres ramas se activa — comportamiento idéntico al previo. Single-range tampoco cambia (Σsemanas = semanasRango → equitativa = natural).

**Verificación E2E**:
- 2º DAW post-fix: 21 / 21 / 21 / 21 / 21 placements ← equilibrado
- 2º DAM post-fix: 27 / 27 / 27 / 27 placements (recreado a 4 rangos) ← equilibrado
- Acumulado anual: materias entre 103% y 126% del objetivo (overshoot por round-up granularidad slot 60 min, dentro de tolerancia 20% para casi todas; un caso aislado 126% por currículo pequeño donde el round-up pesa más).
- 0 unplaced en todos los rangos para ambos grupos.

**Limitaciones conocidas**:
- Si los rangos tienen jornadas distintas (uno con 30h/sem, otro 25h/sem), el cap usa Σsemanas del grupo sin ponderar por jornada. Aproximación suficiente; ponderar requiere cargar la jornada efectiva de cada PL aquí, lo que duplica trabajo del resolver.
- El overshoot del 26% (Inglés GS DAW) es por granularidad de slot 60 min: 90.5 min/sem ideal → 120 min/sem real (round-up obligado a 2 slots). Solucionable solo con jornadas que permitan slots más finos (ej. 30 min) o con redistribución manual desde el modal "Materias del rango".

**Cross-ref**: este fix se descubrió mientras se verificaba Fase 4 de `hoja-de-ruta-modalidad-imparticion.md`. La Fase 4 modalidad expuso el bug (con 5 rangos el rango 5 quedaba casi vacío) que era pre-existente desde Fase 5 sub-A pero no se notaba con un solo rango "Curso completo". No es un bug de modalidad.

### 2026-04-28 — Fase 5 sub-C polish: cappear plan a capacidad para evitar verdicts contradictorios

Detectado tras probar sub-C con 1º DAW (3 rangos, 37.6 sem). Banner anual decía verde "+50h cumples" pero el banner CapacityPlanner decía rojo "faltan 119h físicas". Aparente contradicción.

**Causa**: el plan se calculaba como `Σ por PL de Σ pli × semanasPL`. Cuando Σ pli/sem (32h) > jornada/sem (27.5h), el plan promete más horas (32×37.6=1202h) de las que físicamente caben (27.5×37.6=1033h). Las 169h extra son humo: el solver no las puede colocar. El banner anual prometía un cumplimiento basado en intent inflado.

**Fix**: cappear el plan a la capacidad por rango. `minPerWeekColocables = min(Σ pli, jornadaSemanal)`. Si Σ pli ≤ jornada → plan = intent (sin cambios). Si Σ pli > jornada → plan = capacidad (la verdad de lo que cabe).

**Resultado**: ambos banners se alinean. Caso 1º DAW: plan capped = 1033h, currículo 1152h, ambos coinciden en faltan ~118h. Banner anual pasa de verde "+50h cumples" a rojo/amarillo "te faltan 118h" → coherente con CapacityPlanner.

**Limitación**: sigue usando `slotMinutosByHi` del PL activo como aproximación de jornada para todos los PLs. Si el grupo tiene jornadas distintas por rango, el cap es aproximado. Heredado de sub-A.

### 2026-04-28 — Fase 5 sub-C implementada (CapacityPlanner relajado anual-aware)

El banner del CapacityPlanner ya no es rojo automático cuando hay sobrecarga semanal — bifurca según si el currículo cabe ANUALMENTE en el calendario del grupo.

**Frontend — `frontend/src/pages/HorariosEditor.jsx`**:
- Memo `capacityFeasibilityAnual`: compara Σ currículo (`Σ materia.minutosSemanales × 36`) contra Σ capacidad real (`jornadaSemanalMin × Σ semanasByPlId del grupo`). Devuelve `{curriculumH, capacidadH, jornadaSemanalH, semanasTotal, fits, deficitH}`. Distinto del banner anual de Fase 3b (que compara plan vs currículo).
- Branch del banner CapacityPlanner cuando `!cap.feasible`:
  - Si `anualFits === true` → **amarillo `AlertTriangle`**, mensaje "Sobrecarga semanal en este rango", CTA redistribuir/crear rango.
  - Si `anualFits === false` → **rojo `Ban`**, mensaje "El currículo no cabe en el calendario actual" con cifras detalladas (currículo H vs capacidad H + déficit H), CTA extender curso o subir jornada.
- Mensaje antiguo `capacityInfeasibleAnnualOk` retirado (la lógica está absorbida en el branch amarillo). Las claves antiguas (`capacityInfeasibleTitle/Body/AnnualOk`) ya no se usan en este path; se mantienen sin retirar para no provocar fallos de fallback en código residual.

**i18n (5 idiomas, 4 claves nuevas por idioma)**: `capacityWeekOverloadTitle`, `capacityWeekOverloadBody`, `capacityAnualInfeasibleTitle`, `capacityAnualInfeasibleBody`.

**Decisiones menores durante implementación**:
- **Mantener `capacityFeasibilityAnual` separado de `horasAnualesBanner`**: ambos memos comparan distintas cosas (capacidad vs plan vs currículo). Funden mal y conviven bien — distintos signals para distintas alarmas.
- **No silenciar el banner verde `cap.feasible && exact`**: el admin lo agradece como confirmación. Mantenido.
- **Aproximación de jornada única**: `capacityFeasibilityAnual` usa la jornada del PL activo × Σ semanasTotal. Si rangos del grupo tienen jornadas distintas, la cifra es aproximada. Suficiente para detectar el caso "imposible" mayoritario; refactor a `Σ jornadaPL × semanasPL` queda como mejora futura.

**Verificación con caso 1º DAW LOMLOE**:
- Antes (sub-B): banner rojo "no cabe en este rango" siempre que Σ semanal > jornada — hasta tras extender curso seguía rojo aunque las horas anuales cuadraran.
- Después (sub-C): si tras extender el curso el cómputo anual cabe (capacidad ≥ currículo), el banner pasa a amarillo informativo. Si extendiendo no llega (caso patológico: jornada muy baja), el banner sigue rojo con CTA explícito a extender más o cambiar jornada.

**Próximo**: sub-fase D (cleanup parche temporal en BD: eliminar jornadas 35h "pre Calendario Real" en EAG y verificar que con sub-fases A+B+C el sistema cuadra horas LOMLOE en jornada normal).

### 2026-04-28 — Fase 5 sub-B mejora: crear rango en banner warn/error abarca lo necesario + auto-extend Grupo

Tras feedback del usuario: el modal "Nuevo rango" (botón "Añadir rango" del strip) debe ser sensible al estado del banner anual. Decisión refinada:

- **Banner ok**: default `fechaFin` = `Grupo.fechaFin` (cubre hasta fin de curso, comportamiento ya existente).
- **Banner warn/error** (faltan horas): default `fechaFin` = `extendCourseSuggestion.newLastPlFinISO`. El admin que crea un rango cuando el banner pide extender obtiene un rango **dimensionado exactamente para cubrir las horas faltantes** (ni más ni menos).

**Auto-extend Grupo.fechaFin**: tras crear un rango cuyo `fechaFin > Grupo.fechaFin` (o si Grupo no tenía fechaFin), PATCH automático a `Grupo.fechaFin = newPlFin`. Mismo principio que el botón "Extender curso": **crear un rango que se pasa = extender el curso**. Best-effort: si el PATCH del Grupo falla, no abortamos la creación del rango (ya está hecha). Sólo log + warn console.

**Coherencia con D-J**: la decisión cerrada (extender curso = extender último rango + Grupo, con confirm modal) ahora tiene un atajo: crear un nuevo rango en lugar del último. Caso de uso típico: "Bloque FCT" como rango aparte que vive en las semanas extras.

**Limitación conocida**: no hay confirm modal aquí — el admin pulsa "Crear rango" del modal y la extensión del Grupo es transparente. Si se prefiere visibilidad explícita, se puede añadir un hint inline en el modal cuando `fechaFin > Grupo.fechaFin` ("Esto extenderá el curso hasta dd/mm/yyyy"). Diferido a futura iteración.

### 2026-04-28 — Sub-fase D: cleanup parche temporal en BD — Fase 5 CERRADA

Tras Fase 5 sub-A/B/C/E completas y feature de PDF multi-página, ejecutado el cleanup final del parche temporal acordado al inicio de Fase 5. **Cierra el círculo "del parche al modelo correcto"**: las jornadas 35h/sem `pre Calendario Real` que existían sólo como bypass del modelo simplificado pre-PeriodoLectivo se eliminan de BD; los itinerarios DAW/DAM apuntan ya a la jornada normal del centro real (30h presencial = 27.5h slots + 2.5h recreos).

**Estado pre-cleanup**:
- Jornada `id=3 "FP Mañanas"`: normal viva, 27.5h slots + 2.5h recreos = 30h presencial.
- Jornada `id=4 "FP Mañanas pre Calendario Real"`: **parche** 35h slots + 2.5h recreos = 37.5h presencial (08:00-15:30).
- Jornada `id=5 "FP Tardes pre Calendario Real"`: **parche** 35h slots + 2.5h recreos en horario nocturno absurdo (15:00-22:30) — solo creada para "tener algo que cuadrara con LOMLOE 33h pre-PeriodoLectivo".
- `Itinerario id=3 (DAW)` apuntaba a jornada 4. `Itinerario id=5 (DAM)` apuntaba a jornada 5.
- 164 horarios persistidos con slots inexistentes en jornada normal (08:00-09:00, 14:30-15:30, etc.) — fantasmas de la jornada parche.

**SQL ejecutado** (4 pasos atómicos):
```sql
-- 1. Reapuntar itinerarios DAW + DAM a jornada normal.
UPDATE itinerario SET jornada_tipo_id = 3 WHERE id IN (3, 5) AND deleted = 0;

-- 2. Soft-delete horarios huérfanos (slots fuera de la jornada normal).
UPDATE horario SET deleted = 1, deleted_at = NOW()
WHERE deleted = 0 AND CONCAT(...) NOT IN (slots de jornada 3);
-- → 164 filas soft-deleted.

-- 3. Hard-delete tramos de las jornadas parche (la FK no es CASCADE).
DELETE FROM jornada_tramo WHERE jornada_tipo_id IN (4, 5);

-- 4. Hard-delete las jornadas parche.
DELETE FROM jornada_tipo WHERE id IN (4, 5);
```

**Verificación post-cleanup**:
- Jornadas vivas: 1 (la normal).
- Jornadas 4/5 vivas: 0.
- Itinerarios apuntando a 4/5: 0.
- Horarios huérfanos vivos: 0.

**Doc `hoja-de-ruta-jornadas-recreos.md` §"PARCHE TEMPORAL"** marcado con banner 🪦 SUPERSEDED apuntando aquí. Mantenido como histórico arqueológico — explica cómo se llegó al diseño de PeriodoLectivo desde la observación inicial "el currículo LOMLOE no cabe en la jornada lectiva sin trucos".

**Para regenerar el horario** del 1º DAW EAG tras el cleanup:
1. `/admin/horarios` → grupo "1º DAW".
2. Strip muestra los 5 rangos del año (los rangos NO se borraron, solo los placements fantasma).
3. Click **"Generar todos"** → loop cronológico R1→R5 con cap anual + truco recreos.
4. Banner verde + chips OK → click "Guardar".
5. Click "Exportar PDF" → 5 páginas con horario por rango.

**Cierre conceptual de Fase 5**:
- **Sub-A**: modelo mental anual en UI.
- **Sub-B**: botón Extender curso.
- **Sub-C**: CapacityPlanner relajado anual-aware.
- **Sub-D**: cleanup parche en BD ← *acabado aquí*.
- **Sub-E**: auditoría catálogo DAW LOMLOE.

Resultado: el sistema ahora soporta cualquier itinerario LOMLOE en cualquier centro real con jornada lectiva normal (no parche), distribuyendo currículo entre N rangos cronológicos con cap anual cross-rango + tolerancia 1.5h, contabilizando recreos como tiempo lectivo curricular (truco LOMLOE FP), y permitiendo extender el curso si el cómputo anual lo necesita. **Todo genérico**, sin hardcoding por grupo/centro/etapa.

**Próximas fases** (deja Fase 5 cerrada limpia):
- Fase 7: calendario lectivo del centro (parametriza D-L: las 36 sem hardcoded → cálculo real desde `Centro.fechaInicioCurso/FinCurso` + festivos).
- Fase 8: dashboard "Consumición de horas anuales" para jefe de estudios.
- Fase 6: merge `/admin/jornadas` + `/admin/horarios` (cosmético, opcional).

### 2026-04-28 — PDF multi-página por rango lectivo

Implementado el feature pendiente: el botón "Exportar PDF" de `/admin/horarios` ahora genera un documento con **una página por cada `PeriodoLectivo`** del grupo, no un horario plano.

**Backend** (`HorarioPdfController::horarioGrupo`):
- Carga `Horario[]` del grupo y los agrupa por `periodo_lectivo_id`.
- Carga también los PLs del grupo SIN horarios (para mostrar el rango como página vacía).
- Ordena entries por `pl.fechaInicio` ascendente (los sin PL al final).
- Por cada entry construye un `pageContext` con `slotsManana/slotsTarde/matriz` específico + datos del PL (`plNombre`, `plFechaInicio`, `plFechaFin` formato dd/mm/yyyy).
- El context final mezcla campos comunes (`centro`, `logoUrl`, `subjectLine`, `i18n`, etc.) con el array `paginas[]`. Los `slotsManana/Tarde/matriz` se quitan del top-level (ahora viven en `paginas[]`).

**Twig** (`pdf/horario.html.twig`):
- Refactorizado en 2 macros reutilizables: `headerBlock(...)` (logo + título + fecha) y `grillaBlock(...)` (parrilla mañana + tarde con la matriz).
- Lógica de body: si `paginas` está definido y no vacío → itera con `<div class="page page-break">` por entry, mostrando sub-cabecera del PL (nombre + fechas) entre header y grilla. La última entry NO lleva `page-break-after` (evita página extra al final).
- Else: modo single-page (compatibilidad con `/api/v1/informes/horario/me` que sigue pasando `slotsManana/Tarde/matriz` top-level).
- CSS nuevo: `.pl-header` (sub-cabecera tonalizada con border-left), `.page-break` (page-break-after: always).

**Comportamiento**:
- Grupo con 3 PLs (Rango 1, Rango 2, Rango 3) → PDF de 3 páginas, una por rango. Cada una con su propia parrilla solo de los placements de ese rango. Sub-cabecera "Rango 1 — 01/09/2025 – 06/01/2026" debajo del header común.
- Grupo con 1 PL → PDF de 1 página (igual que antes pero con sub-cabecera del PL).
- Grupo sin PLs → PDF de 1 página vacía con `empty-state`.
- `/horario/me` (mi horario) sigue siendo 1 página plana sin cambios.

**Archivos tocados**:
- `backend/src/Controller/HorarioPdfController.php`: import de `PeriodoLectivo`, refactor de `horarioGrupo()`.
- `backend/templates/pdf/horario.html.twig`: 2 macros + branching multi/single page + CSS de `.pl-header`/`.page-break`.

**Pendiente residual**: el `/horario/me` personal podría también beneficiarse de mostrar el rango activo si se usa en escenarios donde el alumno cambia entre rangos. Por ahora se mantiene como horario "plano" (todos sus horarios mezclados); se puede ampliar en el futuro si surge el caso.

### 2026-04-28 — Pulido UX: estilo del dropdown + toast en exportar PDF + ubicación de toasts

Tres ajustes pequeños tras feedback del usuario:

1. **Botón "Acciones del curso" del strip**: usaba la clase `.plPillAdd` (estilo dashed propio del strip) que no era coherente con los demás botones. Ahora usa `<Button variant="secondary">` igual que "Generar este Horario" / "Generar todos". Misma apariencia themed.

2. **Toast en descarga de PDF**: `performExport` solo notificaba en error. Añadido `toast.success(t('exportSuccess'))` tras descarga. i18n nuevo `exportSuccess` en 5 idiomas.

3. **Ubicación de componentes toast** (referencia para futuros refactors):
   - **Toast genérico**: `frontend/src/utils/toast.js` — `toast.success()` y `toast.error()`. Lo usan la mayoría de handlers (PATCHs/DELETEs).
   - **Toast local del editor** ("Propuesta parcial. Sin colocar..."): `HorariosEditor.module.css:1172` clase `.errorToast`. Componente fixed bottom-right que se renderiza con `setDragError(msg)`. Estilo: `var(--color-error)` background, blanco texto, slide-in animation.
   - **Deuda técnica**: dos sistemas de toasts conviviendo. El usuario sugirió que la apariencia de `.errorToast` sería un buen estilo unificado. Pendiente refactor a un único sistema con tonalidades (success verde, error rojo, info azul) coherente con tema. Tarea futura.

Otras acciones que aún no avisan al admin (también deuda):
- `handleClearActiveRange` — limpia placements del PL activo, sin toast.
- Drag/drop de placement en rejilla — solo error en violation, sin success.
- Cambio de override de jornada — sí avisa.
- Crear/editar/borrar PL — sí avisa.

Cuando se decida unificar el sistema de toasts, hacer barrido por todas las acciones y asegurar feedback visual consistente.

### 2026-04-28 — Reorganización UX + Guardar todos los rangos + labels solver

Refactor de la UI tras feedback del usuario sobre la confusión de tener "+ Añadir rango" en el strip y un dropdown "Acciones del curso" en el infoBar.

**Reorganización botones**:
- El dropdown "Acciones del curso" del infoBar **se mueve al strip** y **sustituye al botón "+ Añadir rango"**. Mantiene icono `Settings2` y label "Acciones del curso".
- Opciones del dropdown (en orden):
  1. 🗓️ Crear Rangos Recomendados (acción primaria; el más útil tras "Limpiar todo").
  2. ➕ Añadir rango manual (era el botón directo del strip).
  3. 🧹 Limpiar rango.
  4. 🗑️ Limpiar todo el curso.
- InfoBar queda con sólo 2 botones de solver — labels renombrados:
  - "Sugerir horario" → **"Generar este Horario"** (Sparkles).
  - "Sugerir todo el curso" → **"Generar todos"** (Layers).

**Botón Guardar global**:
- Antes guardaba sólo el PL activo. Ahora itera todos los PLs `dirty` del grupo y los guarda secuencialmente.
- `dirtyAny` (ya existente para useBlocker) ahora también gobierna el disabled del botón.
- `performBatchSave(plId?)` refactorizada para aceptar PL específico (default = activo).
- `performBatchSaveAllDirty()` nueva: recorre `state[gid_plid]?.dirty` y llama `performBatchSave(plid)` para cada uno. Toast final con "{N} rangos guardados".
- `buildBatchOps(stateKey?)` recibe stateKey opcional para permitir construir ops desde otro PL distinto del activo.
- El modal "Publicar incompleto" usa `performBatchSaveAllDirty` también — coherente con la decisión global.

**i18n**: cambios en `solverSuggest`, `solverAll`, `solverAllRunning` (5 idiomas). Claves nuevas `addRangoManualAction`, `saveAllSuccess`.

**Pendiente**: PDF multi-página por rango (1 página por PL en el descargado). Requiere modificar el Twig template `pdf/horario.html.twig` para iterar contextos. Diferido a próxima sesión por scope.

**Sobre dudas del usuario** (registradas para próxima sesión):
- "Materias del rango" (icono Sliders en pill activo): tiene sentido para currículos con materias NO uniformes anuales (FCT en rango específico, refuerzos, Proyecto Intermodular). Para 1º DAW puro, poco útil — el cap anual ya distribuye automáticamente. Plantear si UI sigue siendo necesaria o se mueve a "modo avanzado" en futuras iteraciones.
- "Extender curso" (banner anual rojo): tiene sentido cuando el cómputo anual NO llega al currículo. Ya cubierto y bien usado. Mantener.

### 2026-04-28 — Fix cap cross-rango en "Sugerir todo el curso": acumulador local

Detectado por el usuario: con 5 rangos y "Sugerir todo el curso", las materias acababan muy por encima del currículo (Programación 381h vs 288h objetivo, Bases 238h vs 216h, etc). El cap anual no se aplicaba bien entre iteraciones del loop.

**Causa**: `runSolver` calculaba `placedAnualOtrosRangos` leyendo `state` de React. React batchea setState, así que entre iteraciones del loop el state estaba **stale**: el siguiente runSolver no veía los placements que el solver del rango anterior acababa de generar. El cap del backend recibía `alreadyPlacedByImp` casi vacío en cada iter → no recortaba cuotas.

**Fix**:
- `runSolver()` acepta nuevo parámetro `alreadyPlacedOverride`. Si viene, se usa tal cual; si no, se calcula desde state (modo single-call clásico).
- `runSolver()` ahora devuelve el `data` del backend (o null si error/aborto).
- `runSolverAllRangos()` mantiene un acumulador local `accumPlacedByImp = {}`. Tras cada solver run, suma los `data.placements` × `semanasByPlId[pl.id]` por imparticion. Pasa el acumulador al siguiente `runSolver` como `alreadyPlacedOverride`.

Resultado: el cap se aplica deterministico independiente del state batching de React. Cada rango ve los minutos cross-rango ya colocados en los anteriores.

**Verificación esperada para 1º DAW con 5 rangos** (objetivo Prog 288h + 1.5h tol = 289.5h):
- R1: alreadyPlaced[Prog] = 0. Asigna ~76h.
- R2: alreadyPlaced[Prog] = 76h. cap restante = 213h. Asigna ~76h.
- R3: alreadyPlaced[Prog] = 152h. cap restante = 137h. Asigna ~76h.
- R4: alreadyPlaced[Prog] = 228h. cap restante = 61h. Asigna ~61h (cap aplica).
- R5: alreadyPlaced[Prog] = 289h. cap restante = 0.5h. Asigna 0 (no hay slot menor que la mínima unidad).
- Total final ~289h ≈ objetivo + tolerancia. ✓

### 2026-04-28 — Fix Crear Rangos Recomendados: faltaba preventDefault

Detectado por el usuario: tras "Limpiar todo el curso" + "Crear Rangos Recomendados" con N=5, solo se creaba el primer rango (Rango 1 cubriendo 67 días); los demás fallaban silenciosamente.

**Causa**: `handleCreateRecommendedRangos` no recibía el evento ni llamaba `e.preventDefault()`. El ModalView usa `<form onSubmit={onSubmit}>`. Sin preventDefault, tras el primer POST `await fetch`, el formulario disparaba el submit nativo → recarga de página → interrumpía el loop async antes del segundo POST. Solo el primer rango quedaba en BD; el frontend nunca refrescaba `plByGrupo` (ese código está después del loop).

**Fix**: añadir parámetro `e` al handler y `if (e?.preventDefault) e.preventDefault();`. Mismo patrón que `handleSubmitPlForm` (que sí lo tenía y funciona).

**Cleanup BD**: borrado el rango huérfano que quedó en BD (`DELETE FROM periodo_lectivo WHERE grupo_id = 1`).

**Lección**: cualquier handler de modal que use `await fetch` DEBE llamar `preventDefault()`. El formulario nativo no espera promesas async; la recarga de página por submit interrumpe el JS. Anotar como pattern obligatorio en futuros modales.

### 2026-04-28 — Fix UX tras "Limpiar todo el curso": strip vacío con CTA

Tras la primera "Limpiar todo el curso" el grupo quedaba sin rangos pero el strip se ocultaba (`length > 0` en la condición de render), dejando al admin sin botón "Añadir rango" — atrapado.

**Fix**: el strip ahora se muestra siempre que haya grupo seleccionado, aunque tenga 0 rangos. Cuando está vacío, muestra mensaje italic "El grupo no tiene rangos lectivos. Crea uno para empezar." y el botón "Añadir rango" sigue visible. Coherente con la operación destructiva: el admin queda con un punto de partida claro para reconstruir.

i18n: 1 clave nueva `rangoLectivoEmpty` en 5 idiomas.

### 2026-04-28 — Acciones del curso: Sugerir todo + Limpiar rango/todo + Crear Rangos Recomendados

Cinco acciones nuevas/refinadas en el infoBar para flujos masivos en `/admin/horarios`:

**Botones del solver redistribuidos**:
- "Sugerir horario" (Sparkles) — sin cambios: solver del PL activo, sin seed.
- "Sugerir otro" (Shuffle, con seed random) → REEMPLAZADO por **"Sugerir todo el curso"** (Layers): loop secuencial cronológico (PLs ordenados por fechaInicio asc) ejecutando el solver en cada uno. Aprovecha cap anual cross-rango: tras R1, sus placements alimentan `alreadyPlacedByImp` de R2; R3 ve R1+R2; etc. Confirmación previa si algún rango ya tiene placements (overwrite). Errores por rango se acumulan y reportan al final, no abortan el loop. La feature de "seed random" ya no está en UI; volver a clicar "Sugerir horario" produce el mismo resultado determinista (acceptable trade-off para ganar simplicidad).

**Dropdown "Acciones del curso"** (Settings2 icon, en infoBar):
- 🧹 **Limpiar rango**: vacía placements del PL activo en state local + `dirty=true`. El admin guarda para persistir. Confirmación.
- 🗑️ **Limpiar todo el curso**: hard-DELETE de todos los PLs del grupo vía endpoint nuevo `DELETE /api/v1/grupos/{id}/clear-rangos`. La FK CASCADE de DB borra horarios y PLIs automáticamente. El grupo queda SIN rangos (UI bloquea editor hasta crear uno). Confirmación destructiva.
- 🗓️ **Crear Rangos Recomendados**: modal con input N (default 3). Borra PLs existentes (mismo endpoint clear) y crea N rangos equiespaciados desde `Grupo.fechaInicio` hasta `Grupo.fechaFin`. Si el grupo no tiene fechas, error explícito ("edítalo en /admin/grupos primero"). Auto-selecciona el primero tras crear.

**Backend nuevo** — `backend/src/Controller/GrupoCursoActionsController.php`:
- `DELETE /api/v1/grupos/{grupoId}/clear-rangos` — DBAL crudo `DELETE FROM periodo_lectivo WHERE grupo_id = :gid` (cascade DB borra horarios/PLIs). Devuelve `{ ok: true, rangosBorrados: N }`.

**Frontend** (`HorariosEditor.jsx`):
- `runSolver()` refactorizado: acepta `skipConfirm` y `plIdOverride` para que `runSolverAllRangos()` pueda invocarlo iterativamente sin depender del state actual de `selectedPlId`. El `targetStateKey` se compone con el override correcto.
- `runSolverAllRangos()`: ordena PLs cronológicamente, los visita uno por uno con `setSelectedPlByGrupo` + `await new Promise(r => setTimeout(r, 50))` para que React procese el cambio antes del siguiente `runSolver`. Usa `skipConfirm=true` (la confirmación batch fue al inicio).
- `handleClearActiveRange()`, `handleClearAllCourse()`, `handleCreateRecommendedRangos()`: handlers con confirm modals + actualización de cachés (state, plByGrupo, capacityByGrupo, allHorariosByGroup).
- Dropdown UI con backdrop transparente para cerrar al click-out.
- Modal nuevo "Crear Rangos Recomendados" con preview de fechas dd/mm/yyyy y count input.

**i18n**: ~32 claves nuevas en 5 idiomas (`solverAll*`, `cursoActions*`, `clearRange*`, `clearAll*`, `createRangos*`, `recommendedRangoNombre`).

**CSS** — `.cursoActionsWrapper`, `.cursoActionsBackdrop`, `.cursoActionsMenu`, `.cursoActionsItem`. Dropdown con sombra suave usando `color-mix` sobre `--color-gray-900`.

### 2026-04-28 — Estado del badge y modal incompleto miran cobertura anual

Tras el cap anual del solver, el badge del panel Materias mostraba "Borrador 26/27.5h" en el PL activo aunque las horas anuales estuvieran cubiertas (porque el cap recortaba cuotas legítimamente). El modal "Publicar incompleto" listaba esas falsas faltas semanales.

**Fix**: el `estado` del badge y el `unplacedSummary` (modal "Faltan por colocar") miran cobertura ANUAL cross-rango con tolerancia 1.5h:
- `allAnualCubierto = imps.every(imp => colocadosAnualMin >= objetivoAnualMin - 90)`.
- Si todas las materias están dentro de tolerancia, badge = 'complete' y modal NO sale al guardar.
- `unplacedSummary` filtra materias ya cubiertas anualmente.

Display semanal del badge ("X/Yh") se mantiene como info del rango activo.

**Coherencia**: el solver se ejecutó en cada rango con cap anual cross-rango; lo que coloca es lo que toca. El "incompleto" semanal del PL activo NO es real si anualmente cuadra. Ahora el sistema lo reconoce.

### 2026-04-28 — Cap anual por materia con tolerancia: solver no over-asigna cross-rango

Problema reportado por el usuario: con 3 rangos cubriendo 42.6 sem y solver ejecutado en cada uno, las materias terminaban con horas anuales muy por encima de su objetivo curricular (Programación 322.3h vs 288h target = +34h, IPEI1 +28.9h, DIG +18.7h, etc). Causa: cada rango asigna `materia.minutosSemanales × semanas_rango` independientemente, sumando `× factor` (42.6/36 = 1.18) más de lo curricular.

**Fix solicitado por el usuario**: hard cap por materia con tolerancia 1.5h. Cuando una materia alcanza `objetivoAnual + 1.5h` cross-rango, el solver no le asigna más slots.

**Implementación**:

Backend `CapacityPlanner::plan()` acepta nuevo parámetro `?array $alreadyPlacedByImp` (impId → minutosAnualesYaColocadosEnOtrosRangos). Para cada PLI:
1. Calcula `cuotaNatural = effectiveMin × semanasRango`.
2. Si `$alreadyPlacedByImp` no es null: `objetivoAnual = materia.minutosSemanales × 36` (LOMLOE D-L). `maxRestante = objetivoAnual + 90 - yaColocado`. `cuotaEsteRango = min(cuotaNatural, maxRestante)`.
3. Convierte cuota total a min/sem efectivo: `cuota / semanasRango` (el ILP opera en cuotas semanales).
4. Si cuotaEsteRango ≤ 0 → la materia queda fuera del rango (el solver la ignora).

Helper nuevo `calcularSemanasPL(PeriodoLectivo)` para calcular semanas decimales del rango.

`HorarioSolver::solve()` y `HorarioSolverController::solve()` propagan el parámetro nuevo (compatible: si null, modo legacy).

Frontend `runSolver()`: antes de POST, calcula `placedAnualOtrosRangos` recorriendo todos los PLs del grupo EXCEPTO el activo, sumando `slot duración × semanas` desde state local (si existe) o persistidos. Lo envía como `body.alreadyPlacedByImp`.

**Comportamiento esperado**:
- Solver rango 1 (otros vacíos): asigna `min(cuotaNatural, 288h+1.5h)`. Para 480 min/sem × 18 sem = 144h ≤ 289.5h → asigna 144h normales.
- Solver rango 2 (rango 1 ya con 144h): cap = 289.5 - 144 = 145.5h. cuotaNatural = 480 × 11.5 = 92h. Asigna 92h.
- Solver rango 3 (1+2 con 236h): cap = 289.5 - 236 = 53.5h. cuotaNatural = 104h. Reduce a 53.5h. 
- Total: ~289.5h, cumple +1.5h tolerancia.

**Order-dependency**: el cap es relativo al estado actual de placements en otros rangos. Si el admin re-ejecuta el solver en orden distinto, los resultados pueden variar. Aceptable; el admin debe ejecutar en orden lógico (rango 1 → 2 → 3).

**Ejecutado en orden inverso o aleatorio**: las primeras pasadas saturan tolerancia; las últimas reducen cuotas. El total siempre ≤ objetivo+1.5h por materia.

### 2026-04-28 — Fixes UX badge + ModuleChip cross-rango con state local

Tres fixes a problemas reportados por el usuario tras best-effort + truco recreos:

**1. Badge panel Materias mostraba "Borrador 27.5/29h" al tener slots llenos.** El target del badge era `Σ materia.minutosSemanales` (29h), inalcanzable cuando hay sobrecarga absorbida por recreos. Cambio: target = `min(Σ materia, capacidadSlots × 5)`. Cuando los slots están llenos, el badge marca "Completo 27.5/27.5h".

**2. ModuleChip mostraba contadores diferentes entre rangos.** Causa: el memo `minutosAnualesColocadosByImp` solo leía del state local del PL ACTIVO + persistidos para los demás. Al ejecutar solver en 3 rangos sin guardar entre medias, los placements de PL inactivos seguían en `state[grupoId_otroPL]` pero ese local NO se contabilizaba — solo los persistidos (vacíos). Resultado: el chip cambiaba según qué PL estuviera activo. Fix: el memo ahora itera TODOS los PLs del grupo y para cada uno usa state local si existe (incluyendo unsaved), sino persistidos. Cross-rango funciona correctamente sin necesidad de guardar entre PLs.

**3. Wording modal "Faltan por colocar" confuso.** Antes: "Bases de Datos: 1 de 6h sin colocar" (¿1 qué de 6h?). Ahora: "faltan 1h de 6h" en es (con unidades consistentes). Actualizado en 5 idiomas.

### 2026-04-28 — Fix reducción del CapacityPlanner: round-robin equitativa

Tras best-effort, el solver no rellenaba toda la semana — el panel mostraba 27.5/29h pero solo se colocaban ~22h. Causa: la reducción proporcional con `floor()` era agresiva (cada materia caía a la unidad inferior, perdiendo varias horas en total cuando solo tocaba perder 1.5h). Ej: Digit 60min × 0.948 = 56 → floor(56/60)×60 = 0. Materia desaparece.

**Fix**: algoritmo round-robin. Cada iteración reduce 1 unidad de slot a la materia con MENOS reducción acumulada, hasta que Σ ≤ capacidad. Distribuye equitativamente.

Caso 1º DAW (excess 90min, unidad 60min):
- Iter 1: Prog 480 → 420 (reducción acumulada 60). excess=30.
- Iter 2: Bases 360 → 300 (reducción acumulada 60, igualada con Prog pero Bases tiene 360 vs Prog 420 — busca por menor reducción acumulada, ambas 60 → toma la primera elegible). excess=-30.

Resultado distribuido: 2 materias pierden 1h cada una. Total reducción 120min. Sobrerreducción 30min (margen libre en la rejilla).

**Mejora**: el solver ahora coloca casi toda la semana — solo queda 1 slot libre por sobrerreducción inevitable cuando excess no es múltiplo de unidad.

### 2026-04-28 — Capacidad curricular en banner: jornada lectiva real, no slots

Tras best-effort en planner, el usuario seguía viendo "27.5h slots" en el banner. Su pregunta: "8:30 a 14:30 son 6h × 5 días = 30h. Si recreos cuentan como lectivos, ¿por qué sigue diciendo 27.5h?". Razón valida.

**Fix**: el banner del CapacityPlanner ahora usa una nueva cifra `cap.capacidadCurricularMinutos` (= slots + recreos × días lectivos) cuando el truco absorbe el déficit. El mensaje cambia de "29h/sem materias / 27.5h slots — déficit absorbido por recreos" → "29h/sem dentro de la jornada lectiva de 30h/sem (incluye recreos lectivos). Margen 1h/sem".

**Backend (`CapacityPlanner.php`)**:
- Calcula `recreosMinutosSemanales` recorriendo los tramos RECREO de la jornada efectiva.
- Añade al output: `capacidadCurricularMinutos` (= capacidadMinutos + recreosMinutosSemanales) y `recreosMinutosSemanales`.
- `errorResult()` también devuelve los nuevos campos en 0.

**Frontend (`HorariosEditor.jsx`)**:
- Branch `!cap.feasible && anualFits === true`:
  - Si `cap.totalMinutos ≤ cap.capacidadCurricularMinutos` → banner verde "Currículo dentro de la jornada lectiva" usando la cifra curricular y mostrando margen disponible.
  - Si supera incluso jornada presencial → amarillo (redistribuir, lógica anterior).
- Mensaje ya no menciona "slots" ni "déficit" en el caso ok — lenguaje del centro, no del solver.

**Limitación residual**: el solver SIGUE colocando solo en slots (no en recreos). Si el solver reporta "Propuesta parcial. Sin colocar: ..." con horas reducidas por el best-effort, esos huérfanos siguen siendo reales (las materias no se imparten físicamente en recreos). El banner verde del CapacityPlanner declara coherencia curricular; el "Propuesta parcial" del toast del solver declara la verdad del placement. Coexisten sin contradicción si el centro acepta la asimetría.

### 2026-04-28 — CapacityPlanner best-effort cuando hay sobrecarga semanal

Tras habilitar los botones del solver con sobrecarga absorbible por recreos, el solver retornaba "Propuesta parcial. Sin colocar: [todas las materias]". Es decir, no colocaba nada — todas las 29h de materias venían como huérfanas.

**Causa**: short-circuit en `CapacityPlanner::plan()` cuando `capacidadMinutos < totalMinutos` → retornaba `asignacion: []` y `huerfanos: full set`. El solver no tenía cuotas que respetar → `tasks` vacías → 0 placements.

**Fix**: best-effort en el planner. Cuando la capacidad es insuficiente:
- Reduce proporcionalmente `materia.minutos` por `factor = capacidadMinutos / totalMinutos`, con floor a la unidad de slot más corta.
- Genera asignación con esos minutos reducidos (ahora factibles).
- Reporta `huerfanos = (originalMin - reducidoMin)` por imparticion.
- Devuelve `feasible: false` (porque el déficit existe) **pero con `asignacion` poblada**.

**HorarioSolver actualizado**:
- Antes abortaba con `if (!$capacity['feasible'])`.
- Ahora aborta solo si `empty($capacity['asignacion'])` (caso patológico real, ej: capacidad nula).
- En `$unplaced` fusiona los huérfanos del backtracking + los huérfanos del planner (déficit de la reducción).

**Verificación caso 1º DAW EAG**:
- 29h materias / 27.5h slots → factor = 27.5/29 = 0.948.
- Cada materia se reduce a `floor(min × 0.948 / 60) × 60`. Suma resultante ~27.5h.
- Solver coloca esa reducción completa.
- `unplaced` reporta el ~1.5h perdido en la reducción, distribuido entre las imparticiones más grandes.

**Coherente con truco recreos**: el solver ahora responde "coloco lo que cabe en slots; el resto queda como huérfano declarativo (que el banner verde-recreos justifica al currículo con los 2.5h/sem de recreos)".

### 2026-04-28 — Fix solver buttons disabled tras truco recreos

Detectado por el usuario: tras truco recreos + ambos banners verdes, los botones "Sugerir" y "Sugerir otro" del solver seguían deshabilitados. El `disabled` era `cap.feasible === false`, que sigue siendo true cuando hay sobrecarga semanal aunque la situación sea operativamente válida (banner verde con recreos o amarillo redistribuible).

**Fix**: el solver pasa a estar hard-blocked **sólo si NI semanal NI anualmente cabe** (= caso rojo real "el currículo no cabe en el calendario"). En los demás casos el solver corre y coloca lo que entra en slots; los huérfanos se reportan para que el admin decida.

```js
const solverHardBlocked = semanalNoCabe && anualNoCabe;
```

Coherente con la filosofía de Fase 5: el solver placement es independiente del cumplimiento curricular declarativo. Si caben anualmente con/sin recreos, dejar correr el solver siempre.

### 2026-04-28 — Refinamiento truco recreos: extender al banner CapacityPlanner

Tras aplicar el truco al cómputo anual, el banner CapacityPlanner seguía amarillo "Sobrecarga semanal en este rango — anual sí cabe" para 1º DAW EAG (29h materias / 27.5h slots). El usuario notó que el banner no había desaparecido aunque conceptualmente el truco debería absorber esa diferencia.

**Reflexión**: el banner amarillo informaba de un déficit semanal real (1.5h/sem que el solver no podrá colocar en slots), pero el truco "recreos cuentan como lectivo curricular" significa que esa diferencia se justifica con los recreos disponibles cada semana. Si el déficit semanal de slots ≤ minutos de recreo semanales, **es exactamente el caso que el truco compensa**.

**Implementación**:
- Branch `!cap.feasible && anualFits === true` ahora bifurca:
  - `deficitSemanalMin = cap.totalMinutos - cap.capacidadMinutos` (= 90 min para 1º DAW)
  - `recreosSemanalMin = jornadaSemanalLectivaMin - cap.capacidadMinutos` (= 150 min, los recreos semanales)
  - Si `deficitSemanalMin ≤ recreosSemanalMin` → **banner verde-info** "Currículo cubierto con recreos lectivos" con `CheckCircle2`. Mensaje aclaratorio: el solver coloca lo que cabe en slots; el resto se justifica al currículo con los recreos.
  - Si `deficitSemanalMin > recreosSemanalMin` → amarillo (lógica anterior, redistribuir entre rangos).
- 2 claves i18n nuevas en 5 idiomas: `capacityRecreosCoverTitle/Body`.

**Verificación caso 1º DAW EAG**:
- 29h materias - 27.5h slots = 1.5h déficit semanal.
- 30h jornada lectiva - 27.5h slots = 2.5h recreos semanal.
- 1.5 ≤ 2.5 → banner pasa a verde "Currículo cubierto con recreos lectivos".

**Honestidad del modelo**: el banner verde NO miente. Dice explícitamente "El solver colocará lo que cabe en slots; el resto computa al currículo anual ante la inspección". La asimetría placement vs cumplimiento curricular queda visible. Si la inspección audita placements reales, el centro tiene que ajustar (redistribuir o cambiar la jornada). El sistema solo refleja lo que el centro decide computar.

### 2026-04-28 — Truco LOMLOE FP: recreos cuentan como tiempo lectivo curricular

Tras sub-fase E (catálogo corregido a 29h/sem semanales reales para 1º DAW LOMLOE), el déficit anual quedó en ~11h con jornada 27.5h × 37.6 sem. El usuario decidió aplicar el "truco" más extendido en centros FP: **contar los recreos como tiempo lectivo a efectos del cumplimiento curricular** ante la inspección.

**Justificación normativa**: la jornada presencial de un centro suele ser 30h/sem (con 2.5h de recreos lectivos). Aunque los recreos NO se imparten clases, normativamente forman parte de la "presencia obligatoria del alumno" — y muchos centros los computan al currículo total para cuadrar las horas anuales LOMLOE.

**Implementación**:

- Memo nuevo `jornadaSemanalLectivaMin` en `HorariosEditor.jsx`: `Σ (SLOT + RECREO duración) × 5 días`. A diferencia de `slotMinutosByHi` (sólo SLOTs, usado por solver/grid/validaciones), esta cifra incluye recreos.
- Sustituida la `jornadaSemanalMin` (sólo slots) en los 3 cálculos de cómputo anual:
  - `horasAnualesBanner` — el cap del plan ya no es `slots × semanas` sino `(slots+recreos) × semanas`. La intención del admin se cap en la jornada lectiva curricular completa.
  - `capacityFeasibilityAnual` — la capacidad anual del banner CapacityPlanner pasa a incluir recreos. Caso 1º DAW EAG: capacidad sube de 1033h (27.5h × 37.6sem) a ≈1128h (30h × 37.6sem). Currículo 1044h. **Cabe con margen +84h**, banner verde sin extender.
  - `extendCourseSuggestion` — la sugerencia de extender curso usa la cifra lectiva curricular para `extraSemanas = ceil(faltan / jornadaLectiva)`. Si recreos cuentan, hace falta menos extender.
- **NO afectado** (deliberado): `slotMinutosByHi`, `pliModalSummary` per-rango (que es semanal y per-rango — el admin sigue pensando "slots disponibles" para colocar materias), validación drag/tap, solver y CapacityPlanner backend.

**Decisiones**:
- **Universal sin flag**: aplica a todos los centros automáticamente. Es el patrón mayoritario en FP LOMLOE Andalucía. Si en el futuro otro centro quiere descontar recreos del cómputo curricular, **se añade un flag `JornadaTipo.recreosCuentanComoLectivo`** (default `true`) o `Centro.recreosCuentanCurriculo`. Diferido.
- **Distinción placement vs currículo mantenida**: la rejilla y el solver siguen siendo "puramente slots" — un recreo NO es asignable. La cifra "horas anuales colocadas" del ModuleChip lateral usa `slotMinutosByHi` (no afectado), así que sigue contando solo lo que realmente se imparte. **Pero** la "capacidad anual" de los banners usa la cifra lectiva-con-recreos. Esa asimetría es deliberada: refleja la lógica real del centro (impartes en slots, justificas el currículo a la inspección con la jornada presencial completa).

**Verificación caso 1º DAW EAG**:
- Antes: capacidad 1033h vs currículo 1044h → faltan 11h, banner amarillo sugería extender curso 1 semana.
- Después: capacidad 1128h vs currículo 1044h → +84h margen, banner anual verde "Cumples con margen", banner CapacityPlanner silencioso. Sin extender curso.

### 2026-04-28 — Fix solver: cascade soft-delete de Imparticion

Tras sub-fase E, al pulsar "Sugerir horario" sobre 1º DAW EAG salía 500: `Entity of type 'App\Entity\Imparticion' for IDs id(39) was not found`.

**Causa**: el SQL de sub-E hizo `UPDATE imparticion SET deleted=1` directo sobre 39 y 62 (Sostenibilidad mal asignada en 1º DAW + DAM). Pero las `PeriodoLectivoImparticion` y `Horario` que apuntaban a esas imparticions seguían vivos. El filtro Doctrine global oculta la imparticion deleted=1 → el solver intenta hidratar la FK y obtiene "not found".

**Fix manual de datos**:
- `DELETE FROM periodo_lectivo_imparticion WHERE imparticion_id IN (39, 62)` (6 filas).
- `UPDATE horario SET deleted=1 WHERE imparticion_id IN (39, 62) AND deleted=0` (1 fila live).

**Fix estructural** (`backend/src/EventSubscriber/ImparticionSoftDeleteCascadeSubscriber.php`):
- Listener `preUpdate` que detecta el flanco `Imparticion.deleted: false → true`.
- Hard-DELETE de los PLIs huérfanos (PLI es derivativa, hard-delete desde Fase 4).
- Soft-DELETE de los Horarios live que apuntan a esa imparticion.
- Usa DBAL crudo para evitar interferencia del filtro softdelete dentro del propio flush.

Sin este listener, cualquier futuro DELETE de Imparticion vía API rompería el solver de cualquier grupo que tuviera un PL con esa imparticion. Ahora la cascada se aplica automáticamente.

**Lección**: cuando cambiamos un Delete operation a soft-delete vía SoftDeleteProcessor, hay que pensar la cascada de tablas dependientes. Las FK `onDelete: 'CASCADE'` SOLO se disparan en hard-delete físico — el soft-delete (UPDATE deleted=1) las ignora. Aplicable también a otras entidades futuras: si tienen children con FK CASCADE y se cambian a soft-delete, hay que añadir un listener cascade equivalente.

### 2026-04-28 — Fase 5 sub-E implementada (auditoría + corrección catálogo DAW LOMLOE AN)

Tras probar sub-A/B/C con 1º DAW EAG, el caso real LOMLOE seguía sin cuadrar (faltan 119h físicas con jornada 27.5h × 37.6 sem). Antes de aceptar la "brujería FP" (extender curso a julio o subir jornada con recreos), audité los datos del catálogo. Resultado: el catálogo en BD tenía 3 errores que sumaban +3h/sem inflated (Sistemas 6h→5h, Lenguajes 4h→3h, Sostenibilidad mal asignada en 1º). Corregido, el caso cuadra sin parches.

**Investigación**:
- Catálogo nacional `catalogo_materia.minutos_semanales` está NULL para DAW (BOE no extrae horasSemanales del PDF).
- `materia.minutos_semanales` (group-instance) tiene valores (360, 240) que NO vienen del catálogo nacional — vienen de seeds históricos pre-LOMLOE o de un resync antiguo con datos BOE inflated.
- `BojaAndHardcodedProvider` documenta correctamente "DAW 1º LOMLOE = 29h" pero no tenía overrides explícitos para 0483 ni 0373 — asumía que el BOE base era ya 5h y 3h.
- `app:catalogo:refresh` solo toca `catalogo_*` tables, no `materia` — refrescar no hubiera arreglado nada.
- El resync CCAA respeta valores cuando catálogo es NULL → no sobreescribe minutos inflated en `materia`.

**Correcciones**:
1. BD oneshot SQL (UPDATEs sobre `materia` y soft-delete sobre `imparticion`).
2. `backend/src/Catalogo/Ccaa/Provider/BojaAndHardcodedProvider.php`: overrides nuevos `0483:300` y `0373:180` añadidos a DAW 1º y DAM 1º. Garantiza que centros futuros LOMLOE Andalucía obtengan cifras correctas.

**Verificación end-to-end**:
- 1º DAW EAG: Σ pasa de 32h → 29h/sem.
- Currículo anual: 29 × 36 = 1044h.
- Capacidad real (3 rangos, 37.6 sem): 27.5 × 37.6 = 1033h.
- Déficit ~11h → extender 1 sem o subir jornada a 30h lo cuadra.

**Decisiones clave durante la sesión**:
- **No hard-delete materia 1708 globalmente**: la materia Sostenibilidad sigue siendo legítima en 2º curso. Sólo borramos las imparticiones específicas (1º DAW + 1º DAM) que la tenían mal.
- **No tocar `catalogo_materia.minutos_semanales`** todavía: queda como deuda para cuando se diseñe la población automática (horas_totales / 33 sem por defecto).
- **Tres correcciones, no más**: hay sospecha que DAW 2º + DAM 2º + otros itinerarios tengan problemas similares. **No auditados en esta sesión**. Trabajo de auditoría sistemática del catálogo FP LOMLOE va al backlog.
- **Sostenibilidad en 1º era data residual**: probablemente vino de un seed antiguo cuando se confundía el curso de la materia. El provider correcto la asigna a 2º (autonómica `AN-SOS, curso=2`).

**Lección**: cuando un caso "imposible matemáticamente" aparece, antes de aceptar la "brujería" del dominio, auditar los datos. Las contradicciones de modelo a menudo son errores de datos disfrazados. El caso 1º DAW LOMLOE sí cuadra con jornada 27.5h estándar — el catálogo tenía 112h infladas que coincidían exactamente con el déficit reportado.

**Próximo**: sub-fase D (cleanup parche temporal en BD) — ahora viable porque la jornada 27.5h del centro es suficiente para el currículo correcto.

### 2026-04-28 — Fix Fase 5 sub-B: no adelantar fechaFin del Grupo si ya es posterior

Detectado por el usuario al probar: caso 1º DAW Mañanas con `Grupo.fechaFin = 31/07/2026` (extendido manualmente o defaults raros) y `lastPL.fechaFin = 27/03/2026`. Tras pedir extender 56 días, mi modal proponía `Grupo.fechaFin: 31/07/2026 → 21/05/2026`. **Adelantaba el curso 70 días en vez de extenderlo**.

**Causa**: la lógica original era `newGrupoFin = newLastPlFin` siempre. Eso era correcto sólo si Grupo.fechaFin original = lastPL.fechaFin original (caso típico recién creado). Si Grupo.fechaFin > newLastPlFin, debería respetarse.

**Fix**:
- Memo `extendCourseSuggestion`: `newGrupoFinISO = (oldGrupoFinISO >= newLastPlFinISO) ? oldGrupoFinISO : newLastPlFinISO` (max). Añadido flag `grupoNeedsPatch = oldGrupoFinISO !== newGrupoFinISO`.
- Modal: si `!grupoNeedsPatch`, la fila del Grupo se reemplaza por una nota `colSpan=4` "Grupo X — fechaFin ya es Y, no necesita cambios" (italic, muted). Hacerla visible es deliberado: el admin ve qué se va a tocar y qué no.
- Handler `handleConfirmExtendCourse`: si `!grupoNeedsPatch`, salta el PATCH del Grupo entero. Sólo se actualiza el último PL.
- Reordenada la tabla: rango primero (siempre cambia), grupo después (puede no cambiar). Refleja mejor el orden de prioridad.

**i18n**: clave nueva `extendCourseGrupoUnchanged` en 5 idiomas.

**Lección**: cuando una operación "extender X" combina múltiples entidades, no asumir que todas tienen que cambiar. Comprobar el delta real por entidad y exponer al usuario qué se toca y qué no — eso evita sustos como "¿adelantar el curso?". Aplica también si en el futuro hay otras "extensiones cascada" (ej: Centro.fechaFinCurso si llegase Fase 7).

### 2026-04-28 — Fase 5 sub-B implementada (botón "Extender curso" + modal confirm)

Cierre de sub-fase B: cuando el banner anual de Fase 3b está en warn/error (faltan horas anuales para cumplir currículo), aparece un botón inline que sugiere extender el curso N días lectivos y abre un modal de confirmación con diff exacto antes de aplicar (D-J).

**Frontend — `frontend/src/pages/HorariosEditor.jsx`**:
- Estado nuevo: `extendModalOpen`, `extendingCourse`.
- Memo `extendCourseSuggestion`: calcula la sugerencia completa o null. Fórmula: `extraSemanas = ceil(faltanHoras / jornadaSemanalH)`, `extraDays = extraSemanas × 7`. Last PL = sort desc por fechaFin. `newLastPlFin = lastPl.fechaFin + extraDays`. `newGrupoFin = newLastPlFin` (sincronizamos por arriba). Preview `newDiff = oldPlanned + extraHoras (= sumLastPlMin × extraSemanas / 60) - currículo`. Tonalidad calculada con misma regla asimétrica.
- Botón inline en `.plBannerHint` (pegado al meta) con icono CalendarClock, theme primary. Visible sólo si `extendCourseSuggestion !== null`.
- Modal `<ModalView size="medium">` con intro, tabla 4-col (entidad, campo, antes, después), y preview tonalizado del nuevo banner.
- Handler `handleConfirmExtendCourse`: PATCH PL primero (`fechaFin: newLastPlFinISO`), luego PATCH Grupo (`fechaFin: newGrupoFinISO`). Si PL falla, no tocamos grupo. Si Grupo falla tras PL OK, log + toast warning (estado consistente desde el solver, pero `Grupo.fechaFin` queda por debajo de `lastPl.fechaFin`). Tras éxito: `refetchPlsForGroup`, update local de `grupos`, `invalidateCapacityForPl(grupoId, lastPl.id)`.
- Sin rollback automático si Grupo PATCH falla; desalineamiento es cosmético (el solver lee de PLs, no de Grupo). Documentado como limitación.

**Frontend — `frontend/src/pages/HorariosEditor.module.css`**: ~9 clases nuevas: `.plBannerExtendBtn`, `.extendModalBody`, `.extendModalIntro`, `.extendModalTable` (con thead sticky + code styling), `.extendModalPreview` con variantes ok/warn/error (color-mix sobre `--bg-card`), `.extendModalPreviewLabel`.

**i18n (5 idiomas, ~16 claves nuevas por idioma)**: `extendCourseTitle`, `extendCourseButton`, `extendCourseModalTitle`, `extendCourseIntro`, `extendCourseColEntity/Field/Before/After`, `extendCourseRowGroup/Pl`, `extendCoursePreviewLabel`, `extendCoursePreviewOk/Warn/Error`, `extendCourseSubmit/Submitting`, `extendCourseSuccess/Error`, `extendCourseGrupoError`.

**Decisiones menores durante implementación**:
- **`newGrupoFin = newLastPlFin` siempre**: sincronizamos por arriba aunque el original fuera anterior. Razón: si Grupo.fechaFin estaba antes que el último PL.fechaFin original, era una inconsistencia previa que también arreglamos. Si era posterior, también lo extendemos al nuevo último PL para mantener la regla "Grupo.fechaFin ≥ último PL.fechaFin".
- **Sin rollback automático**: dos PATCHes secuenciales sin transacción. Mover esto a un endpoint backend transaccional sería más seguro pero introduce un controller nuevo. Trade-off aceptado para esta sub-fase; documentado como mejora futura.
- **Preview optimista**: `extraHoras = sumLastPlMin del último PL × extraSemanas`. Asume que el admin no va a tocar el último PL después. Si lo toca, el banner real difiere. Suficiente como guía visual.
- **Botón visible sólo si banner warn/error**: el caso sobran-horas (verde) no muestra el botón porque no tiene sentido. El caso ok-cuadra (verde por ±5h) tampoco — no hay nada que ajustar.
- **Días lectivos vs naturales en mensajes**: el botón dice "días lectivos" pero técnicamente extiende `extraSemanas × 7` días NATURALES (=`extraSemanas × 5` días lectivos). El texto del modal aclara: "{{days}} días lectivos ({{semanas}} sem completas)" — la interpretación correcta es "días lectivos del centro", consistente con el modelo mental del admin.

**Verificación con caso teórico**:
- Centro X, currículo 1152h, jornada 27.5h/sem, 3 rangos cubriendo 30 sem → planeado 825h, faltan 327h. extraSemanas = `ceil(327/27.5)` = 12 → extraDays = 84 días naturales. Modal muestra: Grupo "..." fechaFin: 30/04/2026 → 23/07/2026. Preview newDiff = 825 + (32×12)/60×60... bueno, aproximado a +60h (sobran), tono ok. El admin acepta y banner pasa a verde.
- Caso 1º DAW del usuario: el banner ya está verde (+96h), el botón NO aparece. Para verlo aparecer, hay que recortar uno de los rangos (ej: borrar Rango 3 desde el modal Editar) y entonces el banner pasa a warn. El botón aparece y sugiere extender N días.

**Próximo**: sub-fase C (CapacityPlanner relajado: rojo solo si globalmente imposible; amarillo informativo si solo desbordamiento semanal).

### 2026-04-28 — Fase 5 sub-A implementada (modelo mental anual en UI)

Cambio de mental model en el editor de horarios sin tocar BD ni solver. Input del modal "Materias del rango" pasa de min/sem a horas anuales en este rango; ModuleChip lateral muestra horas anuales colocadas (cross-rango) vs objetivo anual del currículo (`materia.minutosSemanales × 36`); validación drag/tap usa cuota anual.

**Frontend — `frontend/src/pages/HorariosEditor.jsx`**:
- Estado nuevo: `allHorariosByGroup` (cache de horarios persistidos del grupo, todos los PLs).
- useEffect 1.5.d: carga `GET /api/horarios?imparticion.grupo={gid}&itemsPerPage=500` (sin filtro PL) al cambiar grupo.
- Memo `semanasByPlId`: lookup `{plId: weeksOfPl}` para evitar recálculo en cada render.
- Memo `pliModalSemanasRango`: semanas del PL del modal abierto (alimenta la conversión h↔min/sem en el input).
- Memo `pliModalRows` extendido: ahora incluye `effectiveHorasAnualesRango` y `defaultHorasAnualesRango` por fila.
- Memo `pliModalSummary` extendido: añade `planAnualH`, `capAnualH`, `semanas` para el header del modal en horas anuales.
- Memo `minutosAnualesObjetivoByImp`: `materia.minutosSemanales × 36` (constante D-L).
- Memo `minutosAnualesColocadosByImp`: por cada PL del grupo, `Σ (slot duración × semanas)`. PL activo lee state local; otros PLs leen `allHorariosByGroup`.
- `ModuleChip` actualizado: title con horas anuales explícitas, contador con sufijo "h", validación `done` anual.
- `isValidDrop` (drag) y `validateTap` (tap-mode): regla cambia de cuota semanal del PL activo a cuota anual cross-rango. Validación más permisiva: el admin puede saturar la semana de un PL si todavía le faltan horas anuales.
- `handleTapCell`: tras tap, deselecciona si tras `tapDur × semanas_del_PL_activo` se alcanza el objetivo anual.
- Helper `refetchAllHorariosForGroup`: reload del cache global tras `performBatchSave` para alimentar el chip con la verdad persistida (incluyendo placements recién guardados del PL activo).

**Frontend — `frontend/src/pages/HorariosEditor.module.css`**: añadida `.pliSummaryStatSub` (texto pequeño con sub-info "≈ X min/sem media") en el header del modal.

**i18n (5 idiomas, ~7 claves nuevas por idioma)**: `pliColHorasAnuales`, `pliHorasInheritedHint`, `pliHorasOverrideHint`, `pliSummaryPlanAnual`, `pliSummaryCapAnual`, `pliSummaryNoFit` actualizado.

**Decisiones menores durante implementación**:
- **Live cómputo cross-rango**: para el chip, el PL activo lee del state local (cambios sin guardar visibles inmediatamente) y los demás PLs del cache persistido. Alternativas descartadas: solo persistido (lag tras drag), solo state local (no ve otros rangos). El híbrido es el correcto.
- **Constante `SEMANAS_REFERENCIA_ANUAL = 36`**: hardcoded en el componente con comentario que apunta a D-L y a Fase 7. Centralizado en un solo sitio para facilitar el reemplazo cuando llegue Fase 7.
- **Mantener `minutosColocados` (semanal del PL activo)**: el solver/ProfLoadPanel/CapacityPlanner siguen usando esta variable. No se renombra ni cambia para no propagar el cambio a esos servicios. Doble fuente convive: `minutosColocados` (semanal del PL activo, para cálculos de jornada) y `minutosAnualesColocadosByImp` (anual cross-rango, para chip y validación).
- **`unplacedSummary` no actualizado**: sigue en min/sem porque alimenta el modal "publicar incompleto". Cambiarlo es trivial pero no urgente. Marcado como pendiente en limitaciones.
- **Conversión proporcional**: `minutosSemanales = round(horasAnuales × 60 / semanasRango)`. Para 220h en 18 sem: `round(220 × 60 / 18)` = `round(733.3)` = 733 min/sem (12.2h/sem). El round provoca un drift pequeño en la cuenta inversa (12.2h × 18 sem = 219.6h ≠ 220h). Aceptable para input de UI; el solver trabaja en min/sem así que no hay re-redondeo.

**Verificación con caso 1º DAW LOMLOE**:
- Antes: chip mostraba "0h/8h" (semanal de Programación). Validación bloqueaba a 8h/sem dentro del PL activo.
- Después: chip muestra "0h/220h anuales". Validación permite seguir colocando hasta 220h anuales. Si en rango 1 (18 sem) coloco 12 slots de 2h en lunes, el chip suma 12 × 2h × 18 = 432h... espera, eso es 12 lunes × 2h = 24h por lunes × 18 = 432h, demasiado para Programación de 220h. La validación bloquearía cuando alcance las 220h. Test funcional válido.

**Próximo**: sub-fase B (botón "Extender curso" en banner anual con modal de confirmación D-J).

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
