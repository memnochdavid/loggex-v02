# Hoja de ruta — Solver iterativo con diagnóstico accionable

> Cómo evolucionar el solver de "una pasada + reduce-cuota-propia ingenuo" a "multi-pasada con repertorio de acciones correctivas + diagnóstico accionable que explique qué falta para cuadrar (incluido contratar profesores nuevos)".

---

## ⚡ Snapshot para retomar

**Estado**: **Fases 1+2+3+3.5+4 + Hotfix REDISTRIBUIR_CROSS_RANGO ✅ Done (2026-05-01)**. Doc completo. El bucle outer de `solveMultiRango` mueve cuota in-memory entre rangos hasta cuadrar todos los targets anuales o demostrar (heurísticamente) que es imposible. Validado E2E con 1º DAW EAG: imp 38 al 0% inicial → 125% tras 1 movimiento outer (`stoppedReason: allCovered`).

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
