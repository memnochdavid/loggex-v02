# Períodos lectivos (rangos de fecha) y solver por rango

> **Status (2026-04-28)**: 🟡 Fases 1+2+3a ✅ Done (modelo + migración + solver/planner por rango + UI timeline read-only y "Añadir rango"). Stepping stone (override jornada por grupo) ✅ Done. Fase 3b (editar/borrar PLs, jornada por rango inline, banner Σ horas) pendiente. La UI de `/admin/horarios` ya muestra un strip horizontal con los rangos del grupo y permite crear nuevos. El solver, CapacityPlanner, batch save y horarios fetch están todos cableados al PL activo. Sustituye al **parche temporal** de `hoja-de-ruta-jornadas-recreos.md` (jornadas "pre Calendario Real" 35h/sem) y **funde la Fase 5** de `hoja-de-ruta-calendario-escolar.md`. Una vez completo (Fase 3b + Fases 4-7), las jornadas vuelven a ser realistas (≈30h/sem incluyendo recreos, ≈27.5h lectivas) y el cumplimiento del currículo LOMLOE pasa por sumar horas anuales en N rangos en vez de forzar Σ semanal.

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

### Fase 3b — pendiente

- Editar PL inline (nombre, fechas, jornada).
- Borrar PL (con confirm + warning si tiene horarios persistidos).
- Selector de jornada **por rango** en cada pill (en vez de tener que recrear el PL).
- Banner global del grupo: Σ horas anuales planificadas vs Σ horas currículo. Aviso D-C ("te sobran/faltan X horas").
- Gestión de PLI por rango (UI para activar/desactivar imparticiones por rango y ajustar minutos cuando se desvía del default).

**Esfuerzo estimado**: ~1 sesión.

### Fase 4 — UI gestión imparticiones por rango

- En `/admin/imparticiones` o pestaña dedicada en el editor del rango: añadir/quitar materias del rango, ajustar `minutosSemanales` por rango.
- Auto-rellenar minutos por defecto desde Materia al añadir.

**Esfuerzo**: ~0.5 sesión.

### Fase 5 — Eliminar parche temporal

- Borrar jornadas `id 4 Mañanas pre Calendario Real` y `id 5 Tardes pre Calendario Real` del seed/BD.
- Migrar EAG a jornada normal de 30h/sem (≈27.5h lectivas).
- En el rango LOMLOE, partir el curso si las horas anuales no cuadran con un solo rango (ej: rango FCT separado).
- Marcar entrada "PARCHE TEMPORAL" en `hoja-de-ruta-jornadas-recreos.md` como **superseded por este doc**.

**Esfuerzo**: ~0.5 sesión.

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
