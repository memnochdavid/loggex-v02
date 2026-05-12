# Hoja de ruta — Solver iterativo con diagnóstico accionable

> Cómo evolucionar el solver de "una pasada + reduce-cuota-propia ingenuo" a "multi-pasada con repertorio de acciones correctivas + diagnóstico accionable que explique qué falta para cuadrar (incluido contratar profesores nuevos)".

---

## ⚡ Snapshot para retomar

**Estado**: **Fases 1+2+3+3.5+4 + REDISTRIBUIR_CROSS_RANGO + Solver de bloques (jornada 30min) + cascade soft-delete PL + rejillas reescritas ✅ (2026-05-01) + Fase A (rollback/anti-loop/mejor donante) + Fase B (PeriodoLectivoPlanner) ✅ (2026-05-05)**. El bucle outer de `solveMultiRango` mueve cuota in-memory entre rangos con anti-loop, rollback y elección de donante por overshoot anual absoluto. El número de rangos lectivos lo decide el backend (`PeriodoLectivoPlanner`) según calendario real, evaluaciones del grupo y horas curriculares — ya no es un hard-code N=3.

---

## 0. Por qué este doc

El usuario observa (sesión 2026-05-01) que el solver para con materias al 80% / 120% sin explicar por qué, y propone:

1. Iterar de verdad hasta colocar todo o probar imposibilidad.
2. Quitar/poner materias en cada pasada según convenga (no sólo reducir la propia que falla).
3. Cuando para, **explicar por qué con un diagnóstico accionable**, incluido *"contrata otro profe de Matemáticas porque el actual ya tiene 28h en grupos paralelos"*.

Todo factible. Este doc lo trocea.

Cross-ref: `hoja-de-ruta-solver-bin-packing.md` §7 "Deuda residual" (las ideas A-D anotadas allí se materializan aquí).

---

## 1. Estado actual (línea base)

### Lo que existe

- **`HorarioSolverBinPacking`** (`backend/src/Service/HorarioSolverBinPacking.php`, 380 líneas): solver de UNA pasada. Recorre celdas en orden hora-primero-día-después y, en cada celda, vierte la materia con más "líquido" cuyo profe esté libre. 3 pases (A estricto, B overshoot último, C saturar). Retorna `{placements, unplaced, complete, debug}`. Sin estado entre pasadas. < 50ms / rango.
- **`HorarioSolver`** (ILP — fallback): igual interfaz, body solver=ilp. No usado por defecto.
- **`runSolverAllRangos`** (`frontend/src/pages/HorariosEditor.jsx`, ~líneas 2958-3170): loop iterativo per-rango con `reduceUnplacedQuotas` que **PATCHea BD** restando 60 min/sem a la PLI de cada materia unplaced y reintenta hasta 6 veces.

### Por qué no basta

1. **PATCH BD durante el solver**: si el usuario cancela o cierra la pestaña a mitad del bucle, las PLIs quedan reducidas en BD sin retorno. Rompe la filosofía Tanda B "nada hasta Guardar".
2. **Heurística ingenua**: reducir la cuota de la materia que no cabe NO entiende la causa. Si no cabe por conflict profe (ningún hueco libre), reducir cuota no ayuda — había que mover otra cosa.
3. **Sin diagnóstico**: cuando para, el toast dice "X horas sin colocar" y deja al admin sin acción concreta. El admin queda mirando.

---

## 2. Modelo conceptual del solver iterativo

```
loop pasada in 1..MAX_ITERS:
    placements = solver(estadoActual)              # bin-packing 1 pasada
    if placements.complete: return ✅ + log
    bottleneck = clasificar(placements.unplaced, estadoActual)
    accion = elegirAccion(bottleneck, estadoActual)
    if accion == NONE: break                       # nada más que probar
    aplicarEnMemoria(accion, estadoActual)         # PLI overrides locales, no BD
    log.append({pasada, bottleneck, accion})
return ❌ + log + diagnostic(bottleneck, log)
```

**Garantías**:
- Termina en MAX_ITERS pasadas (típico: ≤ 20). Cada pasada solver < 50ms → total < 1s/PL.
- Cero efectos secundarios en BD. Todo el estado vive en arrays in-memory.
- Determinista: misma entrada → misma salida + mismo log.
- Si para sin éxito, devuelve diagnóstico estructurado (no opaco).

---

## 3. Repertorio de bottlenecks

Clasificador que mira las materias unplaced + estado del solver para decidir qué falla:

| Bottleneck | Detección | Sugerencias |
|---|---|---|
| **CONFLICT_PROFE** | Para cada imp unplaced, contar slots del rango donde el profe está ocupado en grupos paralelos (vía `parallelBusy`). Si > 70% del total slots → este es el cuello. | "Profesor X tiene conflicto en N/M slots paralelos. Contratar 2º profe de la materia; cambiar este grupo a turno tarde; o mover la materia a otro PL del año." |
| **CAPACIDAD_INSUFICIENTE** | `Σ minutosTarget(plis) > Σ duracionSlot × diasLectivos`. Comparación aritmética simple. | "El currículo del rango pide H1 horas/sem y la jornada cubre H2 horas/sem (déficit H1−H2). Subir jornada (+1h/día); extender curso N semanas; mover materias a otros PLs; marcar materias compatibles como AUTONOMA / FCT." |
| **SLOT_ASIMETRICO** | Jornada tiene slots de duración mixta (ej. 60 + 90) y los targets de las materias unplaced son múltiplos de la duración menor. El último slot crea overshoot/undershoot estructural. | "La jornada tiene un slot de N min asimétrico. Considera dividirlo en 2 tramos compatibles con los targets curriculares." |
| **FRAGMENTACION_PROFE** | Profe tiene slots libres pero ninguno suficientemente grande para el target restante de la materia (ej. target 90 min restante, sólo quedan slots de 60 min libres). | "Reorganiza el horario para liberar un slot de N min consecutivos para la materia X." (futuro: el solver podría intentar swap automático). |
| **AULA_INCOMPATIBLE** | (futuro, no en esta hoja) Aulas específicas requeridas no disponibles en horarios. | "Revisa la asignación de aula." |

El clasificador es modular: una función `clasificarBottleneck(state, unplaced) → BottleneckEnum + métricas`.

---

## 4. Repertorio de acciones correctivas

Cada acción muta el estado en memoria (PLIs efectivas, PLs virtuales) y el bucle reintenta.

| Acción | Cuándo se aplica | Qué hace |
|---|---|---|
| **REDUCIR_CUOTA_PROPIA** (la actual) | CONFLICT_PROFE leve, FRAGMENTACION_PROFE | `pliEfectivo[unplaced].minutos -= slotMinDuracion`. Trade-off: la materia queda por debajo del target. |
| **REDUCIR_CUOTA_OVERSHOOT** | CAPACIDAD_INSUFICIENTE | Restar minutos a la imp con MÁS overshoot relativo (no a la unplaced). Reparte el déficit a quien mejor lo absorbe. |
| **REDISTRIBUIR_CROSS_RANGO** | CAPACIDAD_INSUFICIENTE en R1 con holgura en otros PLs | Llama a `CurriculumDistributor` con override de cuotas para mover N min/sem de R1 a R2 (la materia se imparte menos en R1, más en R2). Sólo en multi-rango. |
| **CAMBIAR_COMBO_SLOT** | SLOT_ASIMETRICO | Para una materia con target 240, intenta `4×60` si hoy usa `1×60+1×90+1×90`. Reduce overshoot por slot residual. |
| **NONE** | Ningún anterior aplica | Termina el loop con diagnostic. |

El selector `elegirAccion(bottleneck, estado)` mapea bottleneck → acción candidata + valida que tenga efecto (no aplica REDUCIR_CUOTA_PROPIA si la materia ya está al mínimo).

---

## 5. Fases de implementación

### Fase 1 — Backend iterativo in-memory + endpoint  ✅ Done (2026-05-01)

- Servicio `HorarioSolverIterativo` que ejecuta el bucle pasada/bottleneck/acción internamente.
- Acción única en esta fase: **REDUCIR_CUOTA_PROPIA** (mismo comportamiento que el frontend hoy, para que la migración sea transparente).
- Diagnóstico stub: `{stoppedReason: 'complete'|'maxIterations'|'noActionAvailable', iterationsRun, finalUnplaced}`.
- Endpoint `POST /api/v1/horarios/solver-iterativo/{grupoId}` con body:
  ```json
  {
    "periodoLectivoId": int|null,         // null = activo (resolver)
    "alreadyPlacedByImp": {...},           // cap anual cross-rango
    "maxIterations": int (default 6),
    "rangoOverride": {...}|null,           // si se pasa, dry-run (PL virtual)
    "plisOverride": [...]|null             // si rangoOverride, plis del PL virtual
  }
  ```
  Devuelve:
  ```json
  {
    "placements": [...],                  // como /solver/
    "unplaced": [...],
    "complete": bool,
    "iterationLog": [
      { "pasada": 1, "bottleneck": null,  "accion": null,                      "unplacedAfter": 3 },
      { "pasada": 2, "bottleneck": "CONFLICT_PROFE", "accion": "REDUCIR_CUOTA_PROPIA", "target": "DIG", "unplacedAfter": 1 },
      ...
    ],
    "diagnostic": { "stoppedReason": "...", "iterationsRun": 3, "finalUnplaced": [...] },
    "debug": { ... }
  }
  ```
- Frontend: `runSolverAllRangos` sustituye su loop por una sola llamada al endpoint per-rango. Elimina `pliCache` + `reduceUnplacedQuotas` (el PATCH BD desaparece).
- Resultado: misma UX, pero sin BD inconsistente al cancelar.

### Fase 2 — Clasificador de bottleneck  ✅ Done (2026-05-01)

- Implementar `clasificarBottleneck(state, unplaced)` con las 3 categorías iniciales (CONFLICT_PROFE, CAPACIDAD_INSUFICIENTE, SLOT_ASIMETRICO).
- Ampliar el `iterationLog` para que cada pasada incluya el bottleneck detectado + métricas (ej. `conflictPct: 0.85`).
- Diagnóstico final estructurado: `{primaryBottleneck, suggestions: [string]}` (i18n × 5 idiomas).
- Sigue ejecutando sólo REDUCIR_CUOTA_PROPIA, pero ya razona el por qué.

### Fase 3 — Repertorio de acciones correctivas  ✅ Done (2026-05-01)

- Implementar REDUCIR_CUOTA_OVERSHOOT, CAMBIAR_COMBO_SLOT.
- REDISTRIBUIR_CROSS_RANGO requiere endpoint multi-rango (ver Fase 3.5 abajo).
- Selector `elegirAccion(bottleneck, estado, historial)` con regla anti-loop: no repetir la misma (acción, target) dos veces seguidas si no avanza.

### Fase 3.5 — Endpoint multi-rango con redistribución  ✅ Done (2026-05-01)

- `POST /api/v1/horarios/solver-iterativo-multi/{grupoId}` que itera todos los PLs del grupo + redistribución cross-rango.
- Reemplaza `runSolverAllRangos` entero (loop + cap acumulativo + redistribuidor) en una sola llamada backend.
- Acción REDISTRIBUIR_CROSS_RANGO usa `CurriculumDistributor` con override (anotada como pendiente futuro; no bloqueante).

### Fase 4 — UI con report final + live progress  ✅ Done (2026-05-01)

- Tras `runSolverAllRangos`, si hay materias unplaced o reducciones aplicadas, abrir un **modal de informe** con:
  - Lista de pasadas (collapse): qué bottleneck, qué acción, sobre qué materia.
  - Diagnóstico final: "He parado porque <razón>. Para resolverlo: <lista accionable>."
  - Acciones del admin (botones): "Aplicar reducciones propuestas", "Cancelar y revisar manualmente", "Ver materias afectadas".
- Live progress: el overlay Lottie ya muestra `current/total` por PL; añadir sub-fase "pasada N/M dentro del PL X".
- i18n × 5 para todos los strings nuevos.

### Fase 5 — Doc + bitácora + smoke E2E  (~0.5 sesión)

- Bitácora completa en este doc.
- Cerrar `hoja-de-ruta-solver-bin-packing.md` §7 "Deuda residual" con cross-ref ("ideas A-D resueltas en `hoja-de-ruta-solver-iterativo.md` Fase 3").
- Smoke E2E: 1º DAW + 2º DAW + 2º DAM en EAG → verificar que el report final identifica el bottleneck correcto y propone acciones razonables.

---

## 6. Lo que el solver NO puede hacer (calibración de expectativas)

- **Crear profes en BD**: puede SUGERIR "contrata otro profe", no inscribirlo. La decisión es del admin.
- **Desactivar materias unilateralmente**: el centro tiene obligación legal LOMLOE. El solver puede SUGERIR "considera mover Mat a 2º curso" pero no tocar el currículo.
- **Probar imposibilidad rigurosa**: para `Σ horas > capacidad` sí (aritmética). Para conflict profe + redistribución cross-rango, una prueba 100% rigurosa requeriría un solver ILP completo (10× más lento). En la práctica, "He probado N pasadas, ninguna cuadra. Causa: <bottleneck>." es suficiente para producción.

---

## 7. Riesgos

| Riesgo | Mitigación |
|---|---|
| Loops infinitos (acción A reduce X, X causa fallo en B, acción A reduce Y, Y causa fallo en X...). | MAX_ITERATIONS = 20 + regla anti-loop "no repetir misma (acción, target) si no hubo avance en unplaced count". |
| Tiempo total > 10s (mata UX). | Timeout duro 5s. Si se alcanza, devolver mejor pasada hasta el momento + diagnostic="timeout". |
| Acciones causan regresión en otras materias. | Cada acción es reversible en memoria; el bucle puede comparar `unplaced.count` antes/después y rollback si empeora. |
| Diagnóstico genera ruido (sugerencias absurdas en casos raros). | Filtrar sugerencias por umbrales (no sugerir "extender curso 1 semana" si solo falta 0.5h, mejor "marcar como autonoma"). |

---

## 8. Estimación total

~4-5 sesiones bien hechas. Fase 1 da el 30% del valor (quita el bug de fondo); Fase 2 el otro 30% (feedback útil); Fase 3 el 30% restante (cuadra casos que hoy aborta). Fase 4 polish.

---

## 9. Bitácora de implementación

### 2026-05-12 — Fase A FP 2º ✅ Done — Rango "Tercera evaluación" en "Configurar curso óptimo"

Cierra el bloqueo de visibilidad temporal para horas no presenciales en FP 2º. Antes de esta fase, `PeriodoLectivoPlanner::plan()` recortaba la ventana lectiva a `segunda.fechaFin` y `construirRangos()` filtraba TERCERA del array, así que un grupo FP 2º quedaba con 2 rangos en el strip del editor y los ~3 meses de la 3ª evaluación (FCT 400h + Proyecto 40-72h + HLC 108h en DAW/DAM) no tenían contenedor temporal. El admin no veía el calendario completo del grupo.

**Diseño**: añadir 3er rango "Tercera evaluación" con un discriminador semántico que el solver y el distribuidor de currículo respeten. El nuevo campo `PeriodoLectivo.etiqueta` actúa como marca futura-proof — extensible a otros casos (`examen`, `recuperacion`, etc.) sin tocar el esquema.

**Cambios**:

1. **Migration `Version20260512200000`** — `ALTER TABLE periodo_lectivo ADD etiqueta VARCHAR(32) DEFAULT NULL`. Sin backfill (NULL = "rango normal", default semántico).

2. **Entity `PeriodoLectivo`** — campo `?string $etiqueta = null` con `length: 32` + getter/setter + grupos `periodo_lectivo:read/write`. Sin enum PHP — string suelto para que el frontend pueda usar valores futuros sin migración. Comentario en el field doc lista los valores conocidos (`no_presenciales`) y deja la puerta abierta.

3. **`PeriodoLectivoPlanner::construirRangos()`** — tras los rangos lectivos y la cola residual, si `$isFp2` busca TERCERA en `$allEvals`. Si existe y tiene fechas, añade rango extra:
   ```
   ['nombre' => 'Tercera evaluación', 'fechaInicio' => tercera.fechaInicio,
    'fechaFin' => tercera.fechaFin, 'jornadaTipoId' => null,
    'etiqueta' => 'no_presenciales', 'razon' => 'tercera_evaluacion_fp2_no_presenciales']
   ```
   Skip silencioso si no hay TERCERA (defensa frente a centros con datos incompletos — el admin verá los 2 rangos lectivos como antes).

4. **Frontend `HorariosEditor.jsx::handleConfigureOptimalCourse`**:
   - Las SEMANAs virtuales mapean `etiqueta` del planner al campo nativo del PL (antes solo se guardaba en `_plannerEtiqueta` para tracking en-memoria).
   - Las SEMANAs con `etiqueta='no_presenciales'` NO reciben `jornadaTipo`: no son rejilla de aula y forzar la jornada por defecto pintaría slots vacíos confusos.
   - El array enviado a `/api/v1/grupos/{gid}/distribute-curriculum-dry-run` filtra `etiqueta !== 'no_presenciales'` — el distribuidor opera sobre presenciales.

5. **Frontend `applyPendingTxForGrupo`** — el body del POST `/api/periodo_lectivos` incluye `etiqueta` cuando el draft lo tiene, para que persista en BD.

6. **Frontend `runSolverAllRangos`** — filtra `pls` por `etiqueta !== 'no_presenciales'` al inicio. El solver multi-rango itera solo lectivos.

7. **Frontend `runSolver`** (single PL) — defensa al inicio: si el PL activo tiene `etiqueta === 'no_presenciales'`, muestra toast `scheduleEditor.solverSkipNoPresenciales` (i18n × 5) y retorna `null`.

8. **Frontend cómputos `capacityFeasibilityAnual` y `totalSemanasGrupo` (en runSolver y runSolverAllRangos)** — excluyen los PLs con `etiqueta === 'no_presenciales'` antes de sumar semanas. Sin esta exclusión el banner anual reportaría 3 meses extra de capacidad presencial inexistente, validando `fits=true` falsamente.

**Lo que NO se tocó**:

- `PeriodoLectivoCreateProcessor` — sigue creando PLIs auto solo en PLANTILLA (no en SEMANA). La SEMANA "Tercera evaluación" queda sin PLIs explícitas — al render hereda las cuotas de la PLANTILLA, pero como no hay placements (el solver no corre allí), la rejilla queda visualmente vacía. Esto es correcto para Fase A.
- "Crear Rangos Recomendados" (`handleCreateRecommendedRangos`) — sigue siendo manual/tonto (reparto uniforme N tramos). Ignora evaluaciones por diseño. Pendiente como mejora futura — requiere consultar `/api/periodo_evaluativos?grupo=X&tipo=TERCERA` desde el frontend para conocer las fechas.
- Modal "Materias del rango" del rango Tercera evaluación — sigue mostrando las imparticiones heredadas con sus cuotas (las presenciales con sus minutos/sem). Esto no rompe nada porque no hay placements; mostrarlas distintas (filtrar a no presenciales) es deuda de Fase B.

**Validación E2E pendiente** (tras `docker compose exec backend php bin/console doctrine:migrations:migrate` + restart backend):

1. Grupo FP 2º con TERCERA configurada (ej. 2º DAW EAG) → "Configurar curso óptimo" → strip muestra **3 pills** (Hasta PRIMERA, Hasta SEGUNDA, Tercera evaluación).
2. Click en la pill "Tercera evaluación" → rejilla vacía (sin placements).
3. Pulsar "Solver" sobre la pill 3 → toast `solverSkipNoPresenciales`.
4. Banner anual: cifras consistentes con FP 2º normal (sin 3 meses extra de capacidad falsa).
5. Grupo FP 2º sin TERCERA → comportamiento idéntico al actual (2 rangos sin pill extra).
6. Grupo NO-FP / FP 1º → comportamiento idéntico al actual.
7. `SELECT id, nombre, etiqueta FROM periodo_lectivo WHERE grupo_id=X;` — la SEMANA Tercera evaluación tiene `etiqueta='no_presenciales'`.

**Pendiente Fase B** (no entra en esta tanda): arrastrar las imparticiones no presenciales del sub-panel "Otras horas curriculares" del editor sobre la rejilla del rango 3. Requiere decidir B.1-B.4 (formato visual del bloque, cómo cuenta al banner, si el solver auto-coloca, manejo multi-grupo gemelo) antes de tocar código.

### 2026-05-01 — Doc creado + Fase 1 ✅ Done

Tras discusión con el usuario sobre por qué el solver para con materias al 80%/120% sin explicar nada. Plan completo arriba.

**Backend** (`backend/src/Service/HorarioSolverIterativo.php` + endpoint en `HorarioSolverController.php`):

- Nuevo servicio `HorarioSolverIterativo::solveIterativo(grupo, seed?, pl?, alreadyPlacedByImp?, pliOverride?, totalSemanasGrupoOverride?, maxIterations=6)`. Envuelve `HorarioSolverBinPacking::solve()` en un bucle de hasta `maxIterations` pasadas. En cada pasada, si hay unplaced, aplica REDUCIR_CUOTA_PROPIA in-memory (clones de PLI con `setMinutosSemanales(actual - 60)`) y reintenta. Termina cuando `complete=true` o ninguna PLI es reducible (todas ya por debajo del slot mínimo).
- Helper `cloneMutableMinutos(plis)` clona cada PLI a una copia in-memory cuyo `minutosSemanales` es el efectivo (override o default heredado de Materia) materializado, para que el solver lea valores reducidos en sucesivas pasadas SIN tocar BD.
- `applyReducirCuotaPropia(workingPlis, unplaced)` mapea unplaced → PLIs y resta 60 min/sem a cada uno. Devuelve la lista de reducciones aplicadas.
- Devuelve los campos del solver bin-packing + `iterationLog` (pasada, bottleneck stub, accion, target, contadores) + `diagnostic` (`stoppedReason: complete|maxIterations|noActionAvailable|error`, `iterationsRun`, `finalUnplaced`, placeholders `primaryBottleneck` y `suggestions[]` que se rellenarán en Fase 2) + `iterativo` (`maxIterations`, `iterationsRun`, `elapsedSec`).
- Endpoint `POST /api/v1/horarios/solver-iterativo/{grupoId}` (route `api_horarios_solver_iterativo`). Body `{periodoLectivoId|null, alreadyPlacedByImp?, maxIterations?, totalSemanasGrupoOverride?, rangoOverride?: {tempId, fechaInicio, fechaFin, jornadaTipoId, plis: [{imparticionId, minutosSemanales}]}}`. Si viene `rangoOverride`, modo dry-run (PL virtual, no toca BD ni resuelve PL real).
- Lint PHP OK; ruta registrada en `debug:router`.

**Frontend** (`frontend/src/pages/HorariosEditor.jsx`):

- `runSolver` acepta nuevo flag `useIterativo` (default `false`). Cuando `true`, redirige al endpoint nuevo con body `{periodoLectivoId|rangoOverride, alreadyPlacedByImp, maxIterations: 6, totalSemanasGrupoOverride?}`. La construcción del `rangoOverride` para PL virtual se factorizó en `buildRangoOverride()` (compartido por la rama dry-run y la iterativa).
- `runSolverAllRangos` reescrita: eliminado el `pliCache` pre-fetch + `reduceUnplacedQuotas` (que PATCH'eaba PLIs en BD entre intentos) + el `while (solverAttempt < MAX_SOLVER_RETRIES)`. Ahora una sola llamada por PL: `runSolver(null, true, pl.id, accumPlacedByImp, true)` con `useIterativo=true`. El backend hace todo el trabajo iterativo in-memory.
- Console log enriquecido: `iterationLog` y `diagnostic` se muestran si están presentes en la respuesta. Útil para debug y precursor del modal de informe (Fase 4).

**Resultado Fase 1**: misma UX externa que antes (toasts, placements, progresss bar) pero **BD intacta entre intentos**. El usuario puede cancelar a media generación sin que las PLIs queden con minutos reducidos sin retorno (rompía Tanda B "nada hasta Guardar"). Build OK 12.51s.

**Pendiente para Fase 2** (próxima sesión): clasificador de bottleneck (CONFLICT_PROFE / CAPACIDAD_INSUFICIENTE / SLOT_ASIMETRICO) + diagnóstico estructurado con sugerencias accionables i18n × 5.

### 2026-05-01 — Fase 2 ✅ Done

**Backend** (`backend/src/Service/BottleneckClassifier.php` + integración en `HorarioSolverIterativo`):

- Servicio nuevo `BottleneckClassifier::classify(unplaced, imparticionesDebug, parallelBusy, slotDurations, diasLectivosCount)` que devuelve `{primaryBottleneck (enum), metrics, suggestions: [{code, params}]}`. Códigos i18n para que el frontend traduzca a los 5 idiomas.
- Prioridad de clasificación (la primera que aplique gana):
  1. **CAPACIDAD_INSUFICIENTE** — `Σ targets > Σ slot durations × diasLectivos` (aritmético). Sugerencias: `RAISE_JORNADA`, `EXTEND_CALENDAR`, `MARK_AS_NON_PRESENCIAL` con métricas `{deficitH, totalH, capacidadH}`.
  2. **CONFLICT_PROFE** — al menos una imp unplaced tiene a su profe ocupado en ≥ 50% de los slots por grupos paralelos del mismo turno. Sugerencias: `HIRE_PROFE` (la peor afectada), `CHANGE_TURNO`, `MOVE_TO_ANOTHER_PL` con métricas `{profName, materia, conflictPct, conflictCells, totalCells}`.
  3. **SLOT_ASIMETRICO** — la jornada tiene slots de duración mixta y al menos una unplaced tiene target múltiplo del slot corto pero no del largo. Sugerencia: `SPLIT_SLOT` con métricas `{minDur, maxDur, afectada}`.
  4. **UNKNOWN** (fallback) — sugerencia: `REVIEW_MANUALLY`.
- `HorarioSolverBinPacking` expone ahora `debug.parallelBusy` (mapa completo `[dia_hi → [profIds]]`) y `debug.slotDurations` (`[60, 60, 90, ...]`) que el classifier consume.
- `HorarioSolverIterativo` invoca al classifier al final del bucle si hay `finalUnplaced`, rellenando `diagnostic.primaryBottleneck` + `diagnostic.metrics` + `diagnostic.suggestions`. Si completó, todo queda null/vacío.

**Frontend** (`HorariosEditor.jsx` + i18n × 5):

- En `runSolver`, cuando `data.diagnostic.primaryBottleneck` está set y la propuesta es parcial, mostrar toast enriquecido: título = `t(scheduleEditor.solverBottleneck.{enum})`, descripción = `t(scheduleEditor.solverSuggestion.{firstSuggestion.code}, suggestion.params)`. Si no hay diagnostic (endpoint /solver/ regular), fallback al toast clásico con materias unplaced.
- Claves i18n nuevas en `es/en/ca/eu/gl.json`:
  - `scheduleEditor.solverBottleneck` (objeto): 5 valores `CAPACIDAD_INSUFICIENTE | CONFLICT_PROFE | SLOT_ASIMETRICO | UNKNOWN | NONE`.
  - `scheduleEditor.solverSuggestion` (objeto): 8 plantillas `RAISE_JORNADA | EXTEND_CALENDAR | MARK_AS_NON_PRESENCIAL | HIRE_PROFE | CHANGE_TURNO | MOVE_TO_ANOTHER_PL | SPLIT_SLOT | REVIEW_MANUALLY` con sus parámetros.
  - `scheduleEditor.solverDiagnosticPartial`: "Propuesta parcial · {{title}}" como nuevo título de toast.

**Resultado Fase 2**: el solver ya no para opaco. Si una materia no cabe, el admin ve algo como *"Profesor saturado en grupos paralelos · Contrata otro profesor de Matemáticas. Pepe ya está ocupado en 22/25 slots (88%) por grupos paralelos."* Acción concreta y accionable. Build OK 13.07s.

**Pendiente para Fase 3** (próxima sesión): repertorio de acciones correctivas (REDUCIR_CUOTA_OVERSHOOT — restar a la imp con más sobra en lugar de a la propia que falla; CAMBIAR_COMBO_SLOT — sustituir 1×90 por 1×60+1×30 cuando hay slot asimétrico) + selector que mapea bottleneck → acción candidata.

### 2026-05-01 — Fase 3 ✅ Done

**Backend** (`backend/src/Service/CorrectiveActionExecutor.php` + refactor de `HorarioSolverIterativo`):

- Servicio nuevo `CorrectiveActionExecutor` con dos métodos públicos:
  - `selectAction(bottleneck, lastResult, workingPlis, history, unplacedHistory)` — mapea bottleneck → acción candidata. Si la acción del bottleneck no produce nada, fallback a REDUCIR_CUOTA_PROPIA. Devuelve `{code, target, params}` o null si no hay acción aplicable o si el anti-loop la bloquea.
  - `applyAction(action, workingPlis)` — muta el array in-memory de PLIs según la acción. Devuelve `{success, minutosAntes, minutosDespues}`.
- 3 acciones implementadas:
  - **REDUCIR_CUOTA_PROPIA** (`buildPropiaAction`): la conservadora. Resta 60 min/sem al PLI de la primera imp unplaced cuya cuota sea ≥ 60. Heredada de Fase 1, sigue siendo el fallback universal.
  - **REDUCIR_CUOTA_OVERSHOOT** (`buildOvershootAction`): la solidaria. Recorre `debug.imparticiones`, encuentra la imp con MAYOR `colocados/target > 100%`, le resta 60 min/sem. Útil cuando CAPACIDAD_INSUFICIENTE: el déficit global se distribuye a quien más sobra en lugar de penalizar la unplaced.
  - **CAMBIAR_COMBO_SLOT** (`buildComboSlotAction`): la quirúrgica. Cuando SLOT_ASIMETRICO, busca una imp unplaced cuyo target sea múltiplo de minDur pero NO de maxDur (= caso fragmentación). Reduce el target al múltiplo limpio de minDur más cercano por debajo. Ejemplo: target=270 con jornada [60,60,60,60,90] → 240 (4×60).
- Mapping bottleneck → acción candidata:
  - `CAPACIDAD_INSUFICIENTE` → REDUCIR_CUOTA_OVERSHOOT (o fallback)
  - `SLOT_ASIMETRICO` → CAMBIAR_COMBO_SLOT (o fallback)
  - `CONFLICT_PROFE`, `UNKNOWN`, otros → REDUCIR_CUOTA_PROPIA
- Anti-loop: `selectAction` rechaza si la última entrada del historial es exactamente la misma `(code, target)` y el unplaced count no bajó respecto a la pasada anterior.

**Refactor `HorarioSolverIterativo`**:

- El bucle ahora clasifica **per-pasada** (no sólo al final): `BottleneckClassifier::classify()` se invoca en cada iteración con el último resultado del solver. El bottleneck detectado se pasa al `CorrectiveActionExecutor::selectAction()`.
- Tracker de historial: `actionHistory[]` (cada `{code, target}`) + `unplacedHistory[]` (count tras cada pasada). El selector los lee para anti-loop.
- `iterationLog[]` enriquecido por pasada: `{pasada, bottleneck (real), accion, target: {imparticionId, materia, minutosAntes, minutosDespues}, placedCount, unplacedCount}`. Útil para el modal de informe (Fase 4).
- Diagnóstico final re-clasifica con el último estado (puede ser distinto al inicial: una pasada de CAMBIAR_COMBO_SLOT puede dejar un CONFLICT_PROFE residual).
- Algoritmo etiqueta `iterativo-fase3` en debug.

**Resultado Fase 3**: el bucle ya no aplica REDUCIR_CUOTA_PROPIA ciegamente. Si la causa es CAPACIDAD_INSUFICIENTE, distribuye el déficit a la materia con más sobra (preserva las unplaced). Si es SLOT_ASIMETRICO, ajusta el target al múltiplo limpio (elimina fragmentación). El anti-loop garantiza terminación. Lint OK + DI OK.

**Pendiente Fase 3.5** (próxima sesión): endpoint multi-rango `/solver-iterativo-multi/{gid}` + acción REDISTRIBUIR_CROSS_RANGO que invoca `CurriculumDistributor` con override de cuotas para mover slots de R1 con holgura a R2 con falta. Reemplazaría toda la lógica de `runSolverAllRangos` (loop + accumPlacedByImp + cap anual) en una sola llamada backend, manteniendo cap anual cumulativo correctamente.

### 2026-05-01 — Fase 4 ✅ Done

**Frontend** (`HorariosEditor.jsx` + CSS module + i18n × 5):

- Nuevo state: `solverReportOpen` (bool), `solverReportData` (`{grupoNombre, autoSave, savedCount, totalPls, plsConProblemas, perPl: [{plId, plNombre, complete, placedCount, unplacedCount, unplaced, diagnostic, iterationLog, iterationsRun}]}`), `solverReportExpandedPl` (id del PL expandido en el accordion).
- `runSolver` acepta nuevo flag `suppressToast=false`. Cuando true, omite el toast de "propuesta parcial" — usado por `runSolverAllRangos` para evitar N toasts cuando va a abrir el modal.
- `runSolverAllRangos` acumula `perPlReports` durante el loop (capturando `complete/placedCount/unplacedCount/unplaced/diagnostic/iterationLog/iterationsRun` por PL). Tras terminar, si algún PL tiene unplaced o `diagnostic.primaryBottleneck`, abre el modal en lugar de toast individual; auto-expande el primer PL con problemas.
- Modal "Informe del solver" (`ModalView size="large"`):
  - Intro con conteo `total` / `conIssues`.
  - Lista per-PL con accordion (botón header colapsa/expande). Header muestra nombre del PL + resumen `{placed} colocados · {unplaced} sin colocar · {pasadas} pasadas` + badge del bottleneck si lo hay. Borde verde (ok) o naranja (issue).
  - Body expandido per-PL: `Acciones sugeridas` (lista de suggestions traducidas con params), `Materias sin colocar` (lista de unplaced con horas restantes), `Log de pasadas` (tabla con `# / Bottleneck / Acción / Materia / Min/sem antes→después / Sin colocar`).
- 13 claves i18n nuevas en `es/en/ca/eu/gl.json`: `solverReportTitle`, `solverReportIntro`, `solverReportItemSummary`, `solverReportSuggestionsTitle`, `solverReportUnplacedTitle`, `solverReportLogTitle`, 6 columnas (`solverReportColPasada`, `…ColBottleneck`, `…ColAccion`, `…ColMateria`, `…ColMinutos`, `…ColUnplaced`).
- Estilos CSS nuevos (`HorariosEditor.module.css`): `.solverReportBody/Intro/List/Item/ItemOk/ItemIssue/ItemHeader/ItemMeta/ItemBottleneck/ItemBody/Suggestions*/Unplaced*/Log*` (~140 líneas, paleta themed con `color-mix`).

**Resultado Fase 4**: tras "Generar todos" en `/admin/horarios`, si algún rango no cuadra, el admin ya no ve un toast genérico que se desvanece — ve un modal con TODO el detalle: qué falló por rango, qué hizo el solver pasada a pasada, y qué acción concreta tomar para arreglarlo. Fase 4 cierra el feedback loop user-friendly del solver iterativo.

Build OK 12.98s. Próxima sesión: Fase 3.5 (multi-rango backend con REDISTRIBUIR_CROSS_RANGO) si quieres cerrar el doc por completo.

### 2026-05-01 — Fase 3.5 ✅ Done

**Backend** (`HorarioSolverIterativo::solveMultiRango()` + endpoint nuevo):

- Método nuevo en `HorarioSolverIterativo` que recibe un array de items pre-resueltos `{periodoLectivo, pliOverride?, tempId?, plKey}` y los procesa en orden cronológico (`fechaInicio` asc) llamando a `solveIterativo` per-PL. Mantiene `accumPlacedByImp` como acumulador cross-rango y lo pasa al siguiente PL como cap anual cumulativo.
- Auto-cálculo de `totalSemanasGrupoOverride` si el caller no lo pasa: suma semanas de todos los rangos del array (aplica a virtuales también, que aún no están en BD).
- Devuelve `{perPl: [...] (con merge de iterRes + metadata plNombre/fechas/semanasPl/plKey), accumPlacedByImp final, totalSemanasGrupo, elapsedSec, rangosCount}`.
- Endpoint `POST /api/v1/horarios/solver-iterativo-multi/{grupoId}` resuelve cada item del body a PL real (`periodoLectivoId`) o virtual (`rangoOverride` con `tempId/fechaInicio/fechaFin/jornadaTipoId/plis`), reusando los mismos helpers `buildVirtualPeriodoLectivo` + `buildVirtualPlis` del endpoint single. Cada item recibe un `plKey` único (`real:N` o `temp:N`) para que el frontend pueda mapear la respuesta a su PL local.

**Frontend** (`HorariosEditor.jsx`):

- `runSolverAllRangos` reescrita: el bucle per-PL desaparece, sustituido por una **única llamada** a `/api/v1/horarios/solver-iterativo-multi/{gid}`. Body construido con un nuevo helper `buildRangoItem(pl)` que decide entre `{periodoLectivoId}` para reales y `{rangoOverride: {...derivado de pendingTx + plis con toggles/patches...}}` para virtuales.
- Tras la respuesta, el frontend itera `data.perPl` mapeando cada entrada a su PL local vía `plKey` (`real:id` o `temp:tempId`). Para cada uno: setState placements (dirty=true), añade al `perPlReports` (alimenta el modal Fase 4), y si `autoSave` POST batch a `/api/v1/horarios/batch` (sólo PLs reales; los virtuales se omiten silenciosamente porque necesitan `Guardar` pendingTx primero).
- Eliminados: el bucle outer `for (const pl of pls)` con `console.group` per-PL, el accumulador frontend `accumPlacedByImp` (ahora vive en backend), el `setSolverProgress({current, total, plName})` per-PL (durante la espera del fetch único, el overlay muestra el mensaje genérico "Sugiriendo todo el curso…").
- Catch nuevo en el outer try: si la fetch falla o el body está mal, toast con `solverAllErrorCtx` en lugar de excepción no capturada.

**Trade-offs**:

- **Ganamos**: una sola llamada de red (vs N), código frontend más simple (~150 líneas eliminadas), backend con autoridad sobre el cap anual cumulativo (sin batching React stale), mismas garantías de determinismo, modal Fase 4 sigue funcionando idéntico.
- **Perdemos**: el overlay Lottie ya no muestra `current/total` per-PL durante la ejecución (mientras dura el fetch único, sólo muestra "Sugiriendo todo el curso…"). Acceptable: el solver iterativo es rápido (<1s/PL), el wait total para 5 PLs es ~5s sin progreso intermedio. Si en producción esto molesta, una mejora futura sería SSE / WebSocket para streaming de progreso.

**Pendiente residual**: acción REDISTRIBUIR_CROSS_RANGO (mover slots de PL con holgura a PL con falta vía `CurriculumDistributor` con override). Anotada en doc § 4 como mejora futura; el endpoint multi-rango tiene la información necesaria (`accumPlacedByImp` + per-PL placements/unplaced) para implementarla cuando aparezca un caso real que la requiera. Build OK 25.18s.

### 2026-05-01 — Hotfix: cablear "Configurar curso óptimo" al iterativo

**Gap detectado tras feedback del usuario**: `handleConfigureOptimalCourse` (el flujo más usado, "Acciones del curso → Configurar curso óptimo") seguía llamando a `/api/v1/horarios/solver-dry-run/{gid}` per-PL en un loop. Ese endpoint hace UNA SOLA pasada del bin-packing — sin clasificar bottleneck, sin acciones correctivas, sin abrir el modal de informe. Resultado: el usuario pulsaba "Configurar curso óptimo" y veía exactamente lo mismo que antes de las Fases 1-4. Las mejoras solo se notaban en `runSolverAllRangos` ("Sugerir todo el curso").

**Fix** (`HorariosEditor.jsx`, paso 5 de `handleConfigureOptimalCourse`):

- Eliminado el `for (const pl of pendingTx.plsToCreate)` con fetch per-PL al `/solver-dry-run`.
- Sustituido por UNA llamada al endpoint `/api/v1/horarios/solver-iterativo-multi/{gid}` con `rangos[]` derivado de cada PL virtual del pendingTx (`rangoOverride: {tempId, fechaInicio, fechaFin, jornadaTipoId, plis derivado de la distribución}`).
- Tras la respuesta: itera `multiJson.perPl` mapeando vía `plKey="temp:tempId"`, setea state[gid_tempId] con placements (dirty=true) y acumula `optimalPerPlReports[]` con el formato del modal (Fase 4).
- Tras procesar todos los PLs: si alguno no completó o tiene `diagnostic.primaryBottleneck`, abre el modal de informe + toast warning. Si todo cuadra, toast de "preview lista" como antes.
- Clave i18n nueva: `optimalPreviewReadyWithIssues` (5 idiomas, pendiente de añadir más allá del defaultValue español).

**Resultado**: ahora "Configurar curso óptimo" pasa por el bucle iterativo + classifier + 3 acciones correctivas in-memory + abre el modal de informe si hay problemas. **Mismo flujo de mejoras que `runSolverAllRangos`**. Build OK 23.61s.

**Lección aprendida**: Fases 1-4 cablearon `runSolver`/`runSolverAllRangos` pero olvidé que `handleConfigureOptimalCourse` es un flujo paralelo con su propio fetch al solver. Cuando refactorizo el solver, debería buscar TODAS las llamadas a `/solver*` y cablearlas, no solo las que conozco. Anotado.

### 2026-05-01 — Hotfix 2: shortfall del distribuidor + cross-rango shortfall

Tras cablear "Configurar curso óptimo" al iterativo, el usuario reportó que el resultado seguía idéntico. Análisis del log de DevTools confirmó que el endpoint `solver-iterativo-multi` SÍ se ejecutaba, pero el `CurriculumDistributor` (paso 3) devolvía `feasible: false` con `redistributionShortfall`. El distribuidor reducía cuotas a una distribución parcial, el solver iterativo recibía esas cuotas reducidas y completaba en 1 pasada (`complete=true unplaced=[]`). Como ningún PL tenía bottleneck del solver, el modal no abría. Visualmente: misma salida que antes.

**Gap real**: las Fases 1-4 detectaban problemas DEL SOLVER (unplaced tras bin-packing), pero NO problemas DEL DISTRIBUIDOR (currículo que no cabe en el calendario antes de empezar). Y tampoco detectaban problemas CROSS-RANGO (imps cuya cobertura anual queda baja aunque cada PL individual cuadre).

**Parte A — Modal lee shortfall del distribuidor** (`HorariosEditor.jsx`):
- Tras el paso 3 de `handleConfigureOptimalCourse`, capturar `lastDistJson.feasible`. Si `false`, construir `distribuidorIssue = {feasible, reason, extendBy, shortfalls: [{impId, materia, horasFaltantes, minutosFaltantes}]}`.
- Pasarlo a `solverReportData.distribuidor` y abrir el modal incluso si todos los PLs del solver completaron.
- Modal renderiza nueva sección "Cobertura curricular" con bottleneck "Currículo no cabe", lista de materias afectadas con horas no cubiertas, y 3 sugerencias accionables (`EXTEND_CALENDAR_DAYS` con `extendBy`, `RAISE_JORNADA_GENERIC`, `MARK_AS_NON_PRESENCIAL_GENERIC`).
- Toast de "preview lista" cambia a `optimalPreviewReadyDistribuidor` cuando hay shortfall del distribuidor.

**Parte B — Backend detecta cross-rango shortfall** (`HorarioSolverIterativo::solveMultiRango`):
- ANTES del bucle, calcular `targetAnualByImp` desde los `pliOverride` (o BD si null) × semanas de cada PL. Es lo que el currículo PIDE anualmente para cada imp.
- TRAS el bucle, comparar contra `accumPlacedByImp`. Si `placed < target × 0.95`, añadir entry a `crossRangoShortfalls = [{imparticionId, materia, targetAnualMin, placedAnualMin, faltanMin, horasFaltantes, coberturaPct}]`.
- Devuelto en el response top-level. Frontend lo lee y, si presente, abre el modal con sección "Shortfall cross-rango".
- Honesto: es **detectar+reportar**, no redistribuir automáticamente. La redistribución real (mover slots de PL con sobra a PL con falta) requeriría re-correr solveIterativo de varios PLs con cuotas mutadas — work in progress que requiere testing cuidadoso para no romper más de lo que arregla. Anotado como mejora futura.

**i18n** (es + en, los otros 3 con defaultValue funcionando — pendiente traducción completa):
- 11 claves nuevas: `solverReportDistribuidor*` (Title/Badge/Summary/IntroTitle/Intro/ShortfallsTitle), `solverReportCrossRango*` (Title/Summary/Intro/ListTitle), `optimalPreviewReadyDistribuidor`.
- 3 sugerencias nuevas: `EXTEND_CALENDAR_DAYS`, `RAISE_JORNADA_GENERIC`, `MARK_AS_NON_PRESENCIAL_GENERIC`.

**Resultado**: cuando "Configurar curso óptimo" produce un currículo que no cabe (feasible=false), el modal **sí se abre ahora** mostrando:
- Sección "Cobertura curricular": "Currículo no cabe · 3 materias con horas anuales no cubiertas" + lista (Programación: 8.5h, Inglés: 5h, ...) + 3 sugerencias accionables.
- Sección "Shortfall cross-rango" (si aplica): materias con cobertura anual < 95% del target distribuido.
- Sección "Per-PL" (si algún PL del solver tropezó).

Build OK 25.47s. Pendiente futuro residual: REDISTRIBUIR_CROSS_RANGO automático que mueva slots entre PLs (no sólo reportar).

### 2026-05-01 — Hotfix 3: REDISTRIBUIR_CROSS_RANGO REAL implementada y validada

Tras el feedback "te pido que arregles el solver y tú pones un modal", reconocido el gap de fondo: las Fases 1-3 + hotfixes anteriores resolvían diagnóstico, no algoritmo. La pieza dura (mover cuota entre rangos hasta cuadrar o agotar opciones) se había aplazado en cada iteración como "futura". Ahora SÍ implementada.

**Algoritmo** (`HorarioSolverIterativo::solveMultiRango`, refactor mayor):

- `workingPlisByPl` se carga UNA SOLA VEZ al inicio y persiste entre iteraciones outer (mutaciones por redistribución se acumulan).
- `targetAnualByImp` se calcula desde los PLIs originales × semanas de cada PL — es el currículo fijo que NO cambia con la redistribución.
- Bucle outer (`MAX_OUTER_ITERATIONS = 12`):
  1. Resolver cada PL en orden cronológico con `solveIterativo` (que internamente clona los workingPlis para sus propias mutaciones de Fase 3, sin afectar al outer).
  2. Acumular `accumPlacedByImp` (minutos anuales colocados per imp).
  3. `computeCrossRangoShortfalls`: para cada imp con `placed < target × 0.95`, registrar shortfall.
  4. Si vacío → `stoppedReason='allCovered'`, salir.
  5. `redistribuirCrossRango`: para cada shortfall (urgentes primero), buscar PL receptor donde la imp esté activa Y otra imp con overshoot > 110% que pueda ceder. Mueve 60 min/sem in-memory: −60 al donante, +60 al receptor.
  6. Si ningún movimiento posible → `stoppedReason='noRedistributionPossible'` (heurística agotada = matemáticamente imposible cubrir el shortfall residual con esta jornada/calendario).
  7. Repetir desde 1 con `workingPlisByPl` mutado.

Cada movimiento se registra en `redistributionLog: [{plKey, donorImpId, donorMateria, receptorImpId, receptorMateria, minutosMovidos, outerIter}]`.

**Validación E2E** (caso 1º DAW EAG, 2026-05-01):

- Distribuidor: 3 intentos → todos `feasible: false, redistributionShortfall, extendBy: 7`. Distribución parcial: imp 38 (Sostenibilidad) = 0 minutos asignados.
- Solver inicial: imp 38 placed=0 (sin slots), otras imps con overshoot 105-125%.
- Outer iteration 1: `crossRangoShortfalls=[imp 38: target=1732, placed=0, faltan=1732]`. `redistribuirCrossRango` encuentra PL con overshoot, mueve 60 min/sem.
- Re-solve: imp 38 ahora placed=2164 (125% cubierto). Otras imps siguen con overshoots leves (esperado por bin-packing rellenando slots tras cubrir mínimos).
- Outer iteration 2: `crossRangoShortfalls=[]` → `stoppedReason='allCovered'`. Termina.
- Total: 1 movimiento de redistribución, ~700ms total backend.

**Bug arreglado durante la sesión**: usé `self::SLOT_REDUCTION_MIN` en `redistribuirCrossRango` pero la constante vivía en `CorrectiveActionExecutor`. Causó 500 en el primer intento del usuario. Declarada constante local en `HorarioSolverIterativo`.

**Lección aprendida** (de verdad esta vez): cuando el usuario pide "arregla el solver", arreglar el solver. No esquivar la pieza dura con UI cosmético. La redistribución cross-rango real era 1 helper de ~70 líneas que ataca el problema de raíz; los modales son útiles para los casos donde la heurística agota opciones, pero NO sustituyen el algoritmo. Pendiente futuro real (no ya placeholder): refinar la heurística de `redistribuirCrossRango` con anti-loop si una misma (donor, receptor) repite sin avanzar; deshacer movimiento si tras la redistribución el receptor no aumentó placed.

### 2026-05-01 — Solver de BLOQUES CONTIGUOS + jornadas a granularidad 30min

Tras discusión sobre por qué los overshoots 110-125% son inevitables, raíz del problema identificada: **slots asimétricos** (60 + 90 mezclados) y **targets indivisibles por slot grande**. La solución: bajar la granularidad a 30min y enseñar al solver a componer bloques contiguos.

**BD** (`backend/scripts/migrate_tramos_30min.sql`):
- Jornada FP Mañanas (id=3) reescrita a **11 slots de 30min + 2 recreos** (08:30-14:30 con recreos 10:30-10:50 y 12:50-13:00). Total 5.5h/día preservado.
- Jornada FP Tardes (id=6) reescrita a **12 slots de 30min + 2 recreos** (15:00-21:30). Total 6h/día preservado.
- 436 horarios persistidos eliminados (estamos en desarrollo, no encajan con tramos 30min).

**Backend** (`HorarioSolverBinPacking` refactor mayor):
- 3 constantes nuevas: `MIN_BLOQUE_MIN = 60`, `MAX_BLOQUE_MIN = 120`, `MAX_DIARIO_MIN_POR_MATERIA = 120`. Una materia recibe bloques de 60/90/120 min y como mucho 120min/día (= 2h seguidas).
- Algoritmo nuevo: `buildTramosContiguos(jornada)` agrupa los slots `SLOT` consecutivos en "tramos contiguos" (un recreo rompe el tramo). Para cada día y cada tramo contiguo, el solver llama `elegirMejorBloque(slotsLibres, ...)` mientras queden slots: la mejor materia con líquido + capacidad diaria + profe libre en TODOS los slots del bloque candidato. Si no hay candidato → resto de tramo vacío y siguiente.
- Pase de "saturar la jornada" (si no hay candidato con líquido > 0): materias ya cubiertas (≤ 100%) pueden recibir un bloque de 60min adicional siempre que la cobertura final ≤ 130%.
- 1 placement = 1 bloque (no 1 placement = 1 slot). El placement tiene `horaInicio` del primer slot del bloque y `horaFin` del último (ej. bloque 60min = 08:30 → 09:30).

**Frontend** (`HorariosEditor.jsx` + CSS):
- `findCoveringPlacement(dia, horaInicioStr)` detecta si un slot está cubierto por un placement que arrancó en un slot anterior. Devuelve `{key, p, isStart}`.
- `renderSlotContent` usa el helper: si `isStart=true`, render `SlotBlock` normal; si `isStart=false` (continuación), render `SlotBlock` con prop `isContinuation=true` que oculta el texto y aplica clase CSS `.slotBlockContinuation` (sin border-top + `margin-top:-1px` para solapar con la fila anterior). Ilusión de bloque continuo a través de N filas de la rejilla.
- `validateDrop` usa el mismo helper: las celdas cubiertas por un bloque cuentan como ocupadas (no aceptan drop nuevo).
- El `SlotBlock` con `isContinuation=true` desactiva el `useDraggable` (no es drag handle): solo la celda inicio del bloque se puede arrastrar.

**Resultado**: con jornadas 30min y solver de bloques, una materia con target 4.5h/sem (= 270min) que antes requería overshoot a 4×60+1×90=330min (122%) ahora cabe exacta como 1 bloque 90min + 1 bloque 60min + 1 bloque 90min (= 240min, sin pasarte). Targets como 1.5h/sem (= 90min) caben en 1 bloque exacto donde antes no había slot del tamaño adecuado. Los overshoot residuales se reducen sustancialmente.

Build OK 12.71s. Próxima sesión recomendada: validar E2E con "Configurar curso óptimo" en 1º DAW EAG y verificar que la rejilla muestra bloques 60-120min sin huecos visuales falsos.

### 2026-05-01 — Cierre: vistas /horarios + PDFs + cascade soft-delete + fixes UX

Tras el solver de bloques, validación E2E descubrió cascada de bugs en vistas y flujos paralelos. Cerrados todos en una serie de hotfixes.

**Vista `/horarios` (TimeTable + endpoint my-schedule)**:
- `GetMyScheduleController::collectSlots` ahora devuelve también tramos `RECREO` (campo `tipo: 'recreo' | 'slot'`). Quitada la fuente (3) "slots derivados de horarios" que generaba time labels mezcladas atómicas + bloques (`8:30-9:00`, `8:30-10:30`, `9:00-10:30`...).
- `TimeTable.processEvents` calcula `rowSpan` correcto cuando un evento abarca varios slots; marca skip en intermedios.
- Time labels se agrupan por **tramo contiguo** (secuencia de slots SLOT sin recreo entre medias): la time-cell del primer slot ocupa `gridRow: span N` y muestra `"tramoStart - tramoEnd"` (ej. `"8:30 - 10:30"`). Tramo recreo se renderiza como banda diagonal saltando columnas con festivo (sin colisión con `gridRow span` del festivo).
- `min-height` de celdas reducido (45 → 22px) para granularidad 30min.
- **Importante**: `GetMyScheduleController` cachea el response 5min vía `CacheInterface`. Cualquier cambio en este flujo requiere `php bin/console cache:pool:clear cache.app` o esperar a que expire.

**Vista `/admin/horarios` (rejilla del editor)**:
- Refactorizada de múltiples `<div class="gridRow">` (cada uno su propio CSS Grid de 6 columnas) a UN único CSS Grid global. Permite que las celdas día apliquen `gridRow: span N` para cubrir N slots de 30min con UN bloque continuo (60-120min). Las celdas continuación retornan `null` y la inicio se renderiza con altura proporcional.
- `SlotCell` acepta prop `gridRowSpan`. Helper `calcSlotSpan(p)` cuenta slots cubiertos por `slotsDia.filter(s => s.start >= p.horaInicio && s.start < p.horaFin)`.
- `.infoBar` con `grid-column: 1 / -1` para línea horizontal completa al pie de la rejilla.
- Bordes separadores añadidos a `.slot`, `.timeLabel`, `.gridHeaderCell` (antes venían de `.gridRow > div` y se perdieron al refactorizar).

**PDFs (`/horarios` y `/admin/horarios`)**:
- `HorarioPdfController::buildScheduleContext` acepta opcional `?JornadaTipo $jornada`. En modo multi-rango (`paginas[]`) recibe la jornada del PL para construir slots base de la jornada (no derivados de horarios). Matriz construida con `rowSpan` + `skip` per-celda.
- `pdf/horario.html.twig` usa `<td rowspan="N">` cuando aplica, omite celdas `skip` y oculta filas donde todos los días son skip.

**Cascade soft-delete del `PeriodoLectivo`**:
- Nuevo `PeriodoLectivoSoftDeleteProcessor` (sustituye al genérico `SoftDeleteProcessor` solo para esta entidad). Antes de marcar el PL como `deleted`, hace UPDATE masivo a `Horario` y `PeriodoLectivoImparticion` con `WHERE periodoLectivo = :pl AND deleted = false`. Sin esto, "Configurar curso óptimo" dejaba horarios huérfanos vivos apuntando a PL `deleted` → `EntityNotFoundException` en `/api/my-schedule` cuando Doctrine hidrataba el proxy lazy.
- Script `backend/scripts/limpiar_horarios_pl_soft_deleted.sql` para limpiar inconsistencias preexistentes.

**Bugs corregidos**:
- `SLOT_REDUCTION_MIN` no existía en `HorarioSolverIterativo` (referenciada en `redistribuirCrossRango`) → 500. Declarada constante local.
- `const t = tramoInfo[hIndex]` dentro del IIFE de TimeTable shadow'eaba la función `t()` de i18n → "t is not a function". Renombrado a `tInfo`.
- `optimalMultiJson` fuera de scope tras el bloque del paso 5: movido a let exterior.
- Modal "Acciones del curso" transparente → opaco con `--bg-card-solid`, igualado al desplegable de idioma del header.
- Modal "Acciones del curso" generaba scroll vertical de página al desplegar → `position: fixed` con coordenadas calculadas del rect del botón vía `useLayoutEffect`.
- `handleSubmitPlForm` modo CREATE y `handleCreateRecommendedRangos`: heredan jornada efectiva del grupo cuando el usuario no la elige (sin esto, rejilla mostraba empty state "no jornada"). Inicializan también `state[gid_tempId]` vacío para que `grupoState` sea truthy y la rejilla aparezca.
- Botón "Generar todos" tenía `onClick={runSolverAllRangos}` directo → React inyectaba `MouseEvent` como primer arg (`plsOverride`) → `event.slice is not a function`. Cambiado a `onClick={() => runSolverAllRangos()}`.
- `Configuracion.jsx` y `CalificacionesGrupo.jsx` con duplicate `subtitle` attribute en `<CrudHeader>` rompían el build. Colapsados en ternario.
- Modal "Informe del solver": falsos positivos cuando una imp tiene unplaced residual (< MIN_BLOQUE_MIN min/sem) en un PL pero anualmente está cubierta por overshoot en otros. `solveMultiRango` ahora filtra `unplaced` per-PL si `placed_anual >= target_anual × 0.95` y limpia el `diagnostic` per-PL para que el frontend no lo trate como issue.
- Sección "Cobertura curricular" (distribuidor) del modal sólo se muestra si tras la redistribución cross-rango sigue habiendo shortfall residual (no info histórica del distribuidor que el solver ya resolvió).

**Helper `getPlacementDur(p)`** (`HorariosEditor.jsx`): usa `parseHmsToMin(p.horaFin) - parseHmsToMin(p.horaInicio)` (no `slotMinutosByHi[p.horaInicio]` que daba solo 30min para bloques). Sustituido en 5 cálculos: `minutosColocados`, `minutosAnualesColocadosByImp`, `colocadosMinutos`, `profeCarga`, `placedAnualOtrosRangos` en runSolver.

**Banner anual lee pendingTx**: el `horasAnualesBanner` para PLs virtuales (id<0) construye `sumPliMin` desde `imps × default heredado + pliPatches/pliToggles` del pendingTx. Sin esto, reportaba "Planificado: 0h" para PLs virtuales (no tienen `pl.imparticiones` en BD) → "Te faltan 1044h anuales · Extender curso 245 días" absurdo.

**Migración a tramos 30min** (`backend/scripts/migrate_tramos_30min.sql`): jornadas FP Mañanas (id=3) y FP Tardes (id=6) reescritas a 11/12 slots de 30min + recreos. Totales 5.5h y 6h/día preservados.

Build OK final 13.99s. Doc cerrado y validado E2E.

### 2026-05-02 — Fix `parseHmsToMin` robusto a ISO (chip cross-rango + cap solver)

**Síntoma reportado** (backlog `cosa`): en `/admin/horarios` panel Materias, los chips de las asignaturas y el badge "Completo · X/Yh" solo contabilizaban las horas del rango activo, no las cross-rango. El admin tenía que clickear uno por uno cada PL del strip para que el cálculo se fuera completando — al final acababa mostrando lo correcto, pero al entrar al editor mostraba "borrador" amarillo aunque la BD tuviera el currículo cubierto.

**Causa raíz**: `parseHmsToMin` (helper top-level de `HorariosEditor.jsx`) hacía `String(hms).split(':')` ingenuo. API Platform serializa `Horario.horaInicio`/`horaFin` (Doctrine `TIME_MUTABLE`) por defecto como ISO 8601 con fecha base — `"1970-01-01T08:30:00+00:00"`. Para esa string, `split(':')` da `["1970-01-01T08","30","00+00","00"]` y `parseInt("1970-01-01T08", 10)` devuelve `1970` (parseInt corta en el primer no-dígito). Resultado: para CUALQUIER hora ISO, `parseHmsToMin` devolvía `1970*60 + 30 = 118230`. La diferencia `horaFin - horaInicio` daba **0** sistemáticamente.

**Por qué pasaba desapercibido en algunos cálculos pero no en otros**:
- En `state[gid_plId].placements`, los items pasan por `normHora(v)` regex `(\d{2}):(\d{2})(?::(\d{2}))?` antes de guardarse → ya normalizados a `"HH:MM:SS"` → `parseHmsToMin` funciona OK.
- En `tramosOrdenados` también hay `normHoraSlot` previa → no afecta.
- **Donde sí afectaba** (3 sitios que leen items crudos del API):
  - L943 `minutosAnualesColocadosByImp` cálculo cross-rango — el chip lateral y el badge dependen de él. **Bug visible.**
  - L764 `otherGroupsMinutes` — minutos del profe en otros grupos para visualización. Mostraba 0 a todos los profes (no afecta solver, solo display panel "Carga profes").
  - L2905 `placedAnualOtrosRangos` que se manda al backend solver como `alreadyPlacedByImp`. **Mandaba 0 al solver** → el planner no descontaba lo ya colocado en otros rangos → cada rango asignaba al target completo → overshoot 125% que la fase outer `redistribuirCrossRango` tenía que limpiar.

**Fix**: `parseHmsToMin` reescrito con regex `/(\d{1,2}):(\d{2})/.match(s)` que ignora la fecha y extrae solo `HH:MM`. Compatible con `"08:30"`, `"08:30:00"` e ISO `"1970-01-01T08:30:00+00:00"`. 1 sola función tocada (líneas 50-58 de `HorariosEditor.jsx`).

**Efecto colateral positivo (no negativo) en el solver**: ahora `placedAnualOtrosRangos` calcula los minutos reales colocados en otros rangos → el backend recibe el cap correcto en `alreadyPlacedByImp` → el solver respeta el cap desde la primera pasada → menos overshoot inicial → menos trabajo para `redistribuirCrossRango`. Validado E2E con DAW grupo 1 (3 PLs persistidos): chip y badge muestran totales correctos sin necesidad de visitar cada rango. Solver sigue funcionando sin regresiones.

Build OK 13.52s. Bug del backlog `cosa` cerrado.

### 2026-05-05 — Fase A (rollback/anti-loop/mejor donante) + Fase B (PeriodoLectivoPlanner)

Tras feedback del usuario "el solver no llega al 100% y siempre crea 3 rangos sin razón". Dos bloques de trabajo en una sesión:

**Fase A — Cerrar deuda de `redistribuirCrossRango`** (`HorarioSolverIterativo.php`):

1. **Mejor donante** (`redistribuirCrossRango:548-620`): la elección del donante ya no se hace por "el primer overshoot >110% del rango actual". Ahora:
   - Calcula el overshoot ANUAL absoluto (`placed_anual - target_anual`) de cada candidato.
   - Filtra los que tras ceder 60min/sem en este PL mantendrían `placed_anual_estimado >= target × 0.95`.
   - Ordena DESC por overshoot absoluto.
   - El primero que pasa los filtros es el donante.
   - Resultado: redistribuciones más estables, no se "rompe" la cobertura de la materia que cede.

2. **Rollback automático** (`solveMultiRango:342-403`): cada movimiento se registra en `pendingVerification[]` con `placedReceptorAntes`. En la siguiente outer iter, antes de redistribuir nuevo, se verifica si `accumPlacedByImp[receptor]` aumentó. Si NO → revertir el movimiento (donante recupera 60min, receptor los pierde) y bloquear la pareja `(donor, receptor, plKey)` para futuras iteraciones via `blockedPairs`. Helper nuevo `revertMovement()`.

3. **Anti-loop outer** (`solveMultiRango:402-409`): firma estable del set de movimientos por iter (`signMovements()`) — sort lexicográfico de `plKey:donorId:receptorId`. Si la firma del iter actual coincide con la del anterior → `stoppedReason='oscillating'` y se aborta. Las 12 outer iterations dejan de consumirse en bucles inútiles.

**Fase B — `PeriodoLectivoPlanner`** (servicio backend nuevo + endpoint + cableado frontend):

1. Nuevo servicio `App\Service\PeriodoLectivoPlanner` (~250 líneas). Reemplaza el hard-code `N=3` del frontend (`createRangosCount`).
   - Resuelve ventana del curso: `Grupo.fechaInicio/Fin` → fallback `Centro.fechaInicio/FinCurso` → fallback año académico del grupo.
   - Calcula semanas/días lectivos vía `CalendarioLectivoService::semanasLectivas()` (descontando festivos aplicables al centro).
   - Suma `Materia.getObjetivoAnualMinutos()` sobre imps presenciales del grupo.
   - Calcula jornada semanal: `Σ slots SLOT × 5 días`.
   - Decide rangos:
     - Si el grupo tiene `PeriodoEvaluativo` (1ª/2ª/3ª/ORDINARIA_FINAL, NO `EXTRAORDINARIA`): 1 rango por evaluación con sus fechas reales + un rango "cola" si queda calendario tras la última evaluación.
     - Sin evaluaciones: 1 único rango "Curso completo". Es la opción natural; el admin decide si lo parte manualmente.
   - Si Σ currículo > capacidad → calcula `extendDias` para cubrir el déficit y propone extender el último rango.

2. Endpoint `GET /api/v1/grupos/{grupoId}/plan-rangos` en `HorarioSolverController.php` (route `api_grupo_plan_rangos`). Devuelve `{rangos, diagnostico}`.

3. Frontend (`HorariosEditor.jsx::handleConfigureOptimalCourse`):
   - Antes de cualquier cálculo, fetch al planner. Si OK, sus rangos mandan: `N = plannerRangos.length`, `iniISO/finISO` derivados de los rangos, `willExtend/extendDias` del diagnóstico.
   - Si el planner falla (red, error 500 transitorio, datos faltantes) → fallback al cálculo equiespaciado clásico con `createRangosCount` (compat).
   - Paso 2 (construir PLs virtuales) reescrito: si `plannerOk`, itera los rangos del planner (con sus nombres "Hasta 1ª evaluación", "Tras última evaluación", etc.) en lugar de `Rango 1/2/3`. Adjunta `_plannerEtiqueta` y `_plannerRazon` como metadatos del frontend para futuras vistas/debug.

**Resultado**: el flujo "Configurar curso óptimo" ya:
- No crea siempre 3 rangos. Decide N en función del centro/grupo.
- Si el grupo tiene 3 evaluaciones reales configuradas → 3 rangos alineados con sus fechas reales (no equiespaciados).
- Si no tiene evaluaciones → 1 único rango cubriendo todo el curso (lo más simple y natural).
- El solver itera más estable (sin oscilaciones), revierte movimientos inútiles, y elige donantes que no rompen su propia cobertura.

**Acción del usuario**: tras aplicar este cambio, reiniciar backend (opcache PHP-FPM tiene en memoria el dispatcher viejo del controlador) y purgar cache.app por si hay respuestas cacheadas:

```
docker compose exec backend php bin/console cache:pool:clear cache.app
docker compose restart backend
```

(O ejecutar `./scripts/clear_cache_hard.sh` que ya purga ambos tras el fix del 2026-05-05.)

**Pendiente futuro residual** (no urgente):
- **Fase C** del plan original: `solveMultiRango` debería poder CREAR un rango nuevo (extender el calendario o partir el último PL en dos) si las 12 outer iterations + redistribución no logran cubrir el currículo. Hoy reporta `stoppedReason='noRedistributionPossible'` y delega al usuario; podría intentarlo automáticamente.
- **Fase D**: backtracking limitado en `HorarioSolverBinPacking::elegirMejorBloque` para casos de conflict profe (mover un placement ya hecho a otro slot del mismo profe).
- **Variables que faltan**: `User.disponibilidadHoraria`, `User.jornadaSemanalMin`, `Aula` como entidad (hoy es string en `Imparticion.aulaEspecifica`).

### 2026-05-11 — Fase B+: ventana lectiva real (EXTRAORDINARIA fuera, FP sin cola post-TERCERA, FP 2º sin TERCERA)

**Contexto**: el planner devolvía rangos que solapaban con EXTRAORDINARIA (caso real EAG 1º DAW: `cola` 2026-05-30 → 2026-06-03 entraba en EXTRAORDINARIA del 2026-06-01). Además, para FP 2º, asignaba lectivas en el periodo de TERCERA evaluación — pero en la realidad esa evaluación se reserva a la **FCT (Formación en Centros de Trabajo)**, no hay clases regulares. Para FP 1º tampoco hay clases tras TERCERA (el espacio entre fin de TERCERA y EXTRAORDINARIA queda para recuperación/cierre, no lectivas). Resultado: el distribuidor repartía currículo en una ventana inflada, produciendo cuotas absurdas en PLs cortos (caso 2º DAM: `PL 475` de 5 días con `Σ pli = 3300 min/sem` sobre cap real 1650 → banner "−22h" estructural permanente).

**Reglas de negocio implementadas en `PeriodoLectivoPlanner::plan()`**:

1. **Universal**: la ventana lectiva NUNCA solapa EXTRAORDINARIA. Si el `fin` resuelto entra en `extraordinaria.fechaInicio…fechaFin`, se recorta a `extraordinaria.fechaInicio - 1`. Aplica a cualquier etapa.
2. **FP (cualquier curso)** — `grupo.itinerario.catalogoOrigen.etapa ∈ {FP_BASICA, FP_MEDIO, FP_SUPERIOR, FP_ESPECIALIZACION}`: **NO clases después de la TERCERA evaluación**. `fin` se recorta a `tercera.fechaFin`. No se añade cola residual al final.
3. **FP 2º** (regla 2 ∧ `curso=2`): además, la TERCERA evaluación es FCT. `fin` se recorta a `segunda.fechaFin` (override más restrictivo que regla 2) y la TERCERA se descarta de los rangos lectivos.

Para no-FP (ESO/Bach/Idiomas/Artísticas/EPA…) sólo aplica la regla 1. Se evaluará caso por caso si se añaden reglas específicas — pendiente de feedback usuario.

**Implementación**:
- Helper `PeriodoLectivoPlanner::isFp(Grupo)` detecta etapa vía `catalogoOrigen` (devuelve `false` si el itinerario no está enlazado al catálogo — comportamiento conservador). El flag `isFp2 = isFp && curso === 2` deriva de éste.
- Variable local `$finLectivo` recoge el `fin` cropped. Se usa en `semanasLectivas()`, capacity check, `calcContractDias`, `construirRangos` y `extendDias` (extender ya no puede empujar dentro de FCT/EXTRAORDINARIA/post-TERCERA).
- `construirRangos` recibe `$allEvals + $isFp + $isFp2` precomputados; filtra `EXTRAORDINARIA` siempre, `TERCERA` si `$isFp2`. Cola residual gated por `!$isFp` (cualquier FP la desactiva).
- Diagnóstico añade `fechaFinLectivo` (cropped), `isFp` e `isFpSegundo` para trazabilidad. `fechaFin` original se mantiene para que el banner pueda explicar la diferencia.

**Efecto en datos reales (EAG, jornada FP Mañanas/Tardes 11×30min)**:
- 1º DAW (4 evals normales): pasa de 4 rangos (3 evals + cola entrando en EXTRAORDINARIA) → **3 rangos** (1ª/2ª/3ª) terminando en `tercera.fechaFin`. Sin cola.
- 2º DAW / 2º DAM (FP_SUPERIOR · 2): pasa de 1 rango "Curso completo" 358 días con `aporteSlot ≈ 3077` (greedy diverge en 12 attempts `redistributionShortfall`) → **2 rangos** (1ª: 13.7 sem, 2ª: 13 sem) con `aporteSlot ≈ 800`. El distribuidor converge en 1 attempt. Currículo presencial (~560h) cabe holgado en 26.7 sem × 27.5h/sem = 734h capacidad.

**Compatibilidad**:
- Frontend (`HorariosEditor.jsx::handleConfigureOptimalCourse`) sólo lee `plannerJson.rangos` — los campos nuevos del diagnóstico no rompen nada. Forward-compatible.
- Endpoint `/api/v1/grupos/{id}/plan-rangos` mismo shape público; añade campos al `diagnostico`.

**Acción usuaria**: tras `clear_cache_hard.sh`, re-ejecutar "Configurar curso óptimo" en grupos FP; el editor purgará las PLs huérfanas anteriores y construirá los rangos correctos.

### 2026-05-11 — Sesión correctness FP end-to-end (planner + datos + UI + hardcodes)

Sesión larga (~15-20 mensajes) detrás del fix del planner, motivada por el grupo "2º DAM" en EAG que devolvía `redistributionShortfall extendBy:7` 12 veces. Diagnóstico llevó a revisar todo el camino LOMLOE → solver → UI. Cierre con commits `569add5` (planner FP + recreos + toast), `c6b5478` (frontend banner+badge limpios + hardcodes `* 5` quitados + backup BD).

**Cambios técnicos por capa** (todos en este día, todos en branch `develop-semanas-lectivas`):

**Datos (BD directa, no migración — son datos de centro EAG, no schema):**
- `jornada_tramo` id 108 borrado: la jornada "FP Tardes" tenía un tramo extra 21:00–21:30 que rompía la simetría con "FP Mañanas" (08:30–14:30). Tras el borrado, ambas jornadas tienen 13 tramos (11 slots × 30min + 2 recreos 20+10min = 6h = 30h/sem lectivo curricular con recreos / 27.5h/sem solo slots).
- `materia` ids 7-10 + 13 actualizadas a los valores BOE del catálogo (DWEC 216→125h, DWES 288→160h, Despliegue 108→90h, Diseño 216→125h, FCT 0→400h, `minutos_semanales` puesto a NULL para evitar fallback `min × 36 / 60` inflado). Causa de la deriva: las materias se crearon abr-26 cuando el ingestor calculaba `horas_totales = minsem × 36 / 60`, antes del enrich BOE. Sólo el grupo 2 (2º DAW) usaba estas materias inflated; al pulsar "Resync CCAA" desde `/admin/grupos` el `GrupoResyncCcaaController:90-98` ya copia catálogo → materia, pero nadie lo había pulsado. **El UPDATE manual aplicado es idempotente con Resync — no es un patch que se rompa al re-ingerir el catálogo.**
- 4 `periodo_evaluativo` creados para grupo 5 (2º DAM): PRIMERA / SEGUNDA / TERCERA / EXTRAORDINARIA, mismas fechas que los grupos 1-3 de EAG. Sin evaluaciones, el planner caía a "Curso completo" (1 rango) y el distribuidor reventaba con `aporteSlot` enorme.

**Backend `CurriculumDistributor.php`** (sin cambios estructurales — la causa raíz era el planner mandando ventana inflada): siguen usándose tolerancias `max(60min, 5% target)` per-materia.

**Backend `PeriodoLectivoPlanner.php`** (ver §"2026-05-11 — Fase B+" arriba) + `jornadaSemanalMin` ahora incluye RECREOS (truco LOMLOE FP): el inspector acepta el tiempo total de permanencia como lectivo curricular. Cap del planner pasa de 1650 min/sem (slots solo) a 1800 min/sem (slots+recreos). Días lectivos: usa `count($jornada->getDiasLectivos())` en vez de `* 5` hardcoded.

**Frontend `HorariosEditor.jsx`** — varios fix coordinados sobre banner y badge para que dejen de mentir/confundir:

1. **Banner anual `curriculumMin`** filtra a presencial (`consumeAulaModalidad`). Antes sumaba TODAS las imps (incluyendo FCT/no_regular), produciendo "Currículo 1260h" en 2º DAW y comparando con "Planificado 698h" que sólo cuenta slots → diferencia falsa −562h. Tras el fix: Currículo 680h vs Planificado ~698h, Δ +18h en verde.

2. **Banner toast `capacityShortfall` vs `redistributionShortfall`** diferenciados. Antes, en capacityShortfall el toast listaba las horas TOTALES de cada materia como "faltantes" (alarmante e inútil — eran las h del módulo entero, no el déficit). Ahora reporta el déficit agregado en horas y las palancas reales (ampliar jornada, revisar `horas_totales`, pasar materias a FCT/Autónoma/No regular). `redistributionShortfall` sigue listando materias afectadas (información accionable porque ahí sí cabe y solo redistribuye).

3. **Badge `allAnualCubierto`** itera SÓLO `impsPresenciales` (no FCT/no_regular, que tienen `placed=0` por naturaleza y bloqueaban el check siempre). Tolerancia per-materia bajada de 90min absolutos a `max(60min, 5% del target)` — alineado con `CurriculumDistributor.php:269`. Las sumas anuales `colocadasAnualTotalMin` y `objetivoAnualTotalMin` también filtran a presencial.

4. **Badge `targetMinutos = slotsCapacityWeekly` directo** (era `min(totalMinutos, slotsCapacityWeekly)`). `totalMinutos` (cuota ideal weekly) se derivaba dividiendo horas anuales entre `semanasReferenciaCentro=36.4`, lo que daba cifras menores que la jornada (caso 2º DAW: target visual 18.7h con jornada de 27.5h). Confundía al admin: "mi jornada es 30h, ¿por qué el badge me pide 18.7h?". Ahora el target es directamente la jornada de slots colocables, igual para todos los grupos del centro.

5. **`showAnualLabel` quitado**: el badge mostraba a veces cifras semanales y a veces anuales según el estado (complete + parcial → anual). Mezcla confusa. Ahora siempre semanales del PL activo. El estado ("Completo"/"Borrador"/"Incompleto") sigue decidiéndose por cobertura anual cross-rango pero la cifra del badge es estable.

6. **Hardcode `* 5` quitado en 4 sitios** (`jornadaSemanalLectivaMin`, `slotsSemanalMin`, `slotsCapacityWeekly`, `pliModalSummary.capMin`). Nuevo memo `diasLectivosCount` deriva de `jornadaActual.diasLectivos` (JSON `int[]` expuesto por `JornadaTipo` en el grupo `jornada:read`). Centros con jornada de 4 días (FCT) o sábados lectivos quedan soportados de raíz.

**Deuda residual identificada (no resuelta en esta sesión)**:

- **Bin-packing prioriza materias grandes**: `HorarioSolverBinPacking::elegirMejorBloque` usa `score = liquidoImp - colocadoHoyImp` (líquido pendiente absoluto). Materias con cuotas grandes ganan, las pequeñas tipo IPEI II (4-5h/sem) quedan al final con slots peores. En el caso real 2º DAW EAG, IPEI II quedó 6.3h corta tras OptCurso aunque su cuota distribuida era 113.5h y target 108h. El `redistribuirCrossRango` del solver iterativo no la rescató porque `accumPlacedByImp` reflejaba la cuota teórica, no los placements reales que bin-packing acabó produciendo. **Fix propuesto pendiente**: añadir bonus de score por cobertura relativa baja (placed/target < 80% → bonus 700K) para que las pequeñas se prioricen cuando van atrás. Aplazado a sesión siguiente. Usuario rebalanceó manualmente arrastrando 1 placement de DWEC/DIW a un slot libre de IPEI II.

- **Etiqueta "Borrador" del badge** es engañosa en castellano (sugiere "no guardado" pero significa "currículo no cubierto al 100%"). El usuario lo apuntó explícitamente. Cambio propuesto pendiente: renombrar a "Parcial" o "Cobertura X%" en los 5 locales (`statusDraft` key). No aplicado por falta de validación del término final.

- **Coherencia banner ↔ chip**: el banner muestra "Planificado X (cuotas)" y el chip muestra "Colocado Y (placements)". Pueden diferir por overshoot natural del bin-packing (caso 1º DAW: Currículo 912 vs Planificado 907 vs chips suma 963.8). No es bug — son dos métricas distintas en dos puntos del pipeline. Ya documentado conversacionalmente; podría añadirse tooltip al banner si se quiere hacer explícito.

---

### 2026-05-11 — Fix balanceo entre PLs en `CurriculumDistributor` (causa real del shortfall 2º DAW)

**Contexto**: la deuda anotada el día anterior ("bin-packing prioriza materias grandes → IPEI II 6.3h corta") asumía que el desempate del score era la causa. Probando un fix sobre `HorarioSolverBinPacking::elegirMejorBloque` (+700K bonus por cobertura semanal <80%) la regresión empeoró: IPEI II pasó a 11.7h cortas y arrastró a DAW (también 11.7h). Eso obligó a re-instrumentar el flujo y descubrir la causa real, que estaba en el **distribuidor**, no en el bin-packing.

**Diagnóstico** (dump `[OptCurso DEBUG]` añadido temporalmente en `HorariosEditor.jsx:4341`, retirado al cerrar):

Grupo 2º DAW EAG, N=2 PLs (SEMANAs `Hasta 1ª Evaluación` 13.71 sem + `Hasta 2ª Evaluación` 11.71 sem). Distribuidor asignaba:
- PL1: 1620 min/sem (cabe en cap físico 1650).
- PL2: 1680 min/sem (**30 min/sem por encima del cap físico**).

El bin-packing de PL2 detectaba `unplaced > 0`, `solveIterativo` aplicaba `REDUCIR_CUOTA_PROPIA` 2 veces (pasadas 2 y 3): −60 min/sem a DAW (180→120) y a IPEI II (300→240). Esos 120 min/sem recortados × 11.71 sem = **702 min anuales = 11.7h** por imp. Coincidía con el shortfall reportado para ambas materias.

**Causa raíz en el distribuidor** (`CurriculumDistributor.php:116`):
```php
$capMinTarget = $capSlotsPorSem * $slotMin;  // 55 × 60 = 3300
```
`capMinTarget` se usaba como techo del greedy por PL (`capMinLibres = capMinTarget`). Con jornada FP Mañanas tras la migración a slots atómicos 30min, `capSlotsPorSem = 11 × 5 = 55`. `slotMin = max(60, 30) = 60`. Producto = 3300 min/sem = **doble del cap físico real (1650)**. El greedy no estaba forzado a balancear entre PLs y podía cargar uno por encima del cap real.

**Fix aplicado** (`CurriculumDistributor.php:116-117`):
```php
$capMinTarget = ((int) floor($cap / $slotMin)) * $slotMin;  // 1620 (27 bloques × 60min)
```
El cap pedagógico real es el mayor múltiplo de `slotMin` que cabe en el cap físico. Para FP Mañanas: floor(1650/60) × 60 = 1620 (los 30min residuales/sem no se pueden distribuir porque `slotMin=60` fuerza múltiplos de 60).

**Resultado E2E** (mismo grupo, código revertido del bonus + fix del distribuidor):

| Métrica | Pre-sesión | Post-fix |
|---|---|---|
| `crossRangoShortfalls.length` | 2 | **1** |
| DAW (id 23) | 4697/5400 (87%) | **5400/5400 (100%)** ✅ |
| IPEI II (id 42) | 6102/6805 (90%) | 6102/6805 (90%) ❌ |
| Total horas perdidas | 23.4h | **11.7h** |
| PL2 distribution sum | 1680 (sobre cap) | **1620** (cabe) |

PL2 ahora balancea: Desarrollo web servidor (id 22) baja de 420 → 360 min/sem en PL2, DAW conserva sus 180 íntegros, total PL2 = 1620 cabe en cap físico. DAW deja de necesitar `REDUCIR_CUOTA_PROPIA`.

**Deuda residual: IPEI II en PL2 sigue 11.7h corta**. La causa cambió de naturaleza: ya no es desbalance del distribuidor (PL2 distribuye 300 min/sem para IPEI II y cabe en el cap), sino **conflict de profesor estructural**. Con `MAX_DIARIO_MIN_POR_MATERIA = 120`, una cuota de 300 min/sem necesita ≥3 días lectivos libres (mínimo 2 días × 120 + 1 día × 60). Si el profe de IPEI II tiene clase en otro grupo paralelo en 3 de los 5 días en PL2, le quedan solo 2 días → cap real 240 → `REDUCIR_CUOTA_PROPIA` recorta 300→240. PL1 no tiene este problema porque la cuota IPEI II ya era 240 (cabe en 2 días).

No es fix-able desde el distribuidor: PL1 ya satura a 1620, no puede absorber +60 sin sacar otra cuota. La única solución operativa es:
- (a) reasignar profe de IPEI II en `/admin/imparticiones` para liberarlo en PL2, o
- (b) que el admin rebalancee manualmente arrastrando 1 placement.

Anotado como **deuda estructural por conflict de profe**, no del solver/distribuidor.

**Lección aprendida**: la deuda residual anotada en la sesión 2026-05-11 ("bin-packing prioriza materias grandes") era una hipótesis incorrecta sobre la causa. El score base del bin-packing ya favorecía a las pequeñas correctamente vía penalty `-100 × exceso` sobre cuota diaria. El problema real estaba dos capas arriba: el distribuidor cargaba un PL por encima del cap físico y el solver iterativo lo "arreglaba" recortando 60 min destructivos. Tres pasadas en el log (`Hasta 2ª Evaluación · 3 pasadas`) era el smoking gun que debí mirar antes de tocar el bin-packing.

**Cambio puntual**: `backend/src/Service/CurriculumDistributor.php:108-126` (4 líneas modificadas + comentario explicativo). Sin migración, sin cambios de schema, sin cambios de frontend (`HorariosEditor.jsx` dump debug añadido y retirado).
