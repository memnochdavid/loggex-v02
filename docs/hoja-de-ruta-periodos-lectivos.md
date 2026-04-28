# Períodos lectivos (rangos de fecha) y solver por rango

> **Status (2026-04-28)**: 🟡 stepping stone implementado, modelo completo pendiente. **Override de jornada por grupo** (`Grupo.jornadaTipoOverride`) ya operativo — el admin puede cambiar la plantilla de jornada del solver desde el `infoBar` de `/admin/horarios` sin tocar el itinerario. Modelo completo `PeriodoLectivo` (rangos N por grupo) sigue sin empezar. Sustituye al **parche temporal** de `hoja-de-ruta-jornadas-recreos.md` (jornadas "pre Calendario Real" 35h/sem) y **funde la Fase 5** de `hoja-de-ruta-calendario-escolar.md` (calendario lectivo). Una vez completo, las jornadas vuelven a ser realistas (≈30h/sem incluyendo recreos, ≈27.5h lectivas) y el cumplimiento del currículo LOMLOE pasa por sumar horas anuales en N rangos en vez de forzar Σ semanal.

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
| D-A | Cómo expresar materia × rango | Entidad de unión `PeriodoLectivoImparticion` con `minutosSemanales` propio | Permite mismo Imparticion con distintos pesos por rango. Más flexible que enum en Materia. |
| D-B | Granularidad de PeriodoLectivo | Por **grupo** | Hereda granularidad de `PeriodoEvaluativo`. Cada grupo puede tener calendario distinto. |
| D-D | ¿Jornada distinta por rango? | Sí, FK opcional `PeriodoLectivo.jornadaTipo`. Si null, hereda de `Itinerario.jornadaTipo`. | Permite cambio de jornada en bloques especiales (ej: FCT con horario distinto). |
| D-E | ¿Imparticion troceada por rango? | No, `Imparticion` sigue siendo única; los minutos por rango viven en la entidad de unión | Evita explosión combinatoria y mantiene asistencia/calificación apuntando a una sola Imparticion. |
| D-F | ¿Pueden solaparse rangos del mismo grupo? | No (constraint), deben cubrir ventana del curso sin huecos validados al final | Más simple, refleja realidad. Un grupo solo tiene un horario activo en cada fecha. |

### Abiertas

| ID | Pregunta | Recomendación | Por decidir |
|---|---|---|---|
| D-C | Fecha-fin curso: ¿se computa o el usuario la fija? | **Manual** con aviso "te sobran/faltan X horas anuales para cumplir currículo" | Computada es elegante pero choca con calendario oficial CCAA (junio fijo). Usuario decide y sistema valida. |
| D-G | ¿Permitir crear rangos sin huecos obligatorio o validar solo al "cerrar curso"? | Validar al cerrar/publicar; durante edición se permiten huecos. | Edición incremental cómoda. |
| D-H | ¿Quién crea los rangos por defecto al crear un grupo? | Auto-crear un rango único `"Curso completo"` que cubre `Centro.fechaInicioCurso..Centro.fechaFinCurso` (Fase 5 calendario) | Que un grupo nuevo sea usable sin obligar a configurar rangos. El centro los partirá si lo necesita. |
| D-I | ¿La entidad se llama `PeriodoLectivo`? | Sí. Contrapunto natural de `PeriodoEvaluativo`. Alternativa descartada: `RangoHorario` (suena bajo nivel). | Confirmar con usuario antes de migrar. |

---

## 3. Fases de implementación

### Fase 1 — Modelo + migración (sin UI, sin solver)

- Crear `PeriodoLectivo` + `PeriodoLectivoImparticion` con `ApiResource`, `ApiFilter`, soft delete.
- FK `Horario.periodoLectivo` (nullable temporalmente).
- Migración: crear tabla, **auto-crear un PeriodoLectivo único `"Curso completo"` por grupo existente** (rellena fechas con `Centro.fechaInicio/FinCurso` si existen, o `01-09 → 30-06` por defecto), poblar `Horario.periodoLectivo` con ese rango único, y luego volver `Horario.periodoLectivo` a NOT NULL.
- Migrar `Imparticion` actuales: crear una fila `PeriodoLectivoImparticion` por cada Imparticion en el rango único `"Curso completo"`, copiando `minutosSemanales` desde la Materia.
- **Resultado**: data migrada sin pérdida, comportamiento idéntico al actual (un solo rango anual = mismo solver que hoy).

**Esfuerzo**: ~1 sesión.

### Fase 2 — Solver y CapacityPlanner por rango

- `HorarioSolver` recibe un `PeriodoLectivo` y opera con sus imparticiones (`PeriodoLectivoImparticion`) y su `JornadaTipo` resuelto (rango → itinerario).
- `CapacityPlanner` (sub-fase O) idem: corre por rango.
- `Imparticion.minutosSemanales` deja de leerse en el solver; se pasa a leer de `PeriodoLectivoImparticion`.
- Endpoint sugerir-horario gana parámetro `periodoLectivo` (default: rango activo en la fecha actual del grupo).
- Banner verde/amarillo/rojo del CapacityPlanner se calcula por rango.

**Esfuerzo**: ~1 sesión.

### Fase 3 — UI: timeline de rangos en `/admin/horarios`

- Pestaña/timeline horizontal con los rangos del grupo seleccionado.
- Botones "+ Añadir rango", editar fechas, asignar `JornadaTipo`, duplicar, borrar.
- Sub-vista por rango: cuadrícula horario actual (sin cambios) pero filtrada al rango seleccionado.
- Banner global del grupo: Σ horas anuales planificadas vs Σ horas currículo. Aviso D-C.

**Esfuerzo**: ~1.5 sesiones.

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
