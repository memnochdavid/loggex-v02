# Solver bin-packing — Algoritmo de líquidos

> **Status (2026-04-29 noche)**: 🔴 Sin empezar. Plan diseñado tras observar que el solver físico actual (ILP backtracking) deja slots vacíos en jornadas con tramos heterogéneos (FP Mañanas 4×60+1×90 / día). El usuario propuso un modelo conceptual de "líquidos y recipientes" que es funcionalmente equivalente a un **bin-packing first-fit** con restricciones laterales.

---

## ⚡ Snapshot para retomar

### Problema observado

Con la jornada FP Mañanas (4 slots × 60min + 1 slot × 90min = 5h30/día = 27.5h/sem), el solver actual deja entre 2-5 slots vacíos por rango. Razón: cuando una materia tiene target múltiplo de 60, hay varios combos válidos:

- Target 240 = `4×60` (4 placements, NO usa slot de 90) **o** `1×60+2×90` (3 placements, usa slot de 90).
- El solver elige uno (criterio interno de minimización), y a veces deja el slot de 90 vacío.

Resultado real (2026-04-29) tras "Configurar curso óptimo" con tolerancia 5% y pase 2 saturador:

| Grupo | R1 placed | R2 placed | R3 placed | Cap (FP Mañ) | Vacíos |
|---|---|---|---|---|---|
| 1º DAW | 25 | 25 | 22 | 25 | 3 (R3) |
| 2º DAW | 25 | 25 | 21 | 25 | 4 (R3) |
| 1º DAM (FP Tardes) | 30 | 30 | 30 | 30 | **0** ✓ |
| 2º DAM | 23 | 23 | 20 | 25 | 9 |

FP Tardes NO sufre el bug porque todos los slots son de 60min uniformes. El bug es estructural de FP Mañanas (slot de 90 "incómodo" para combos de materias múltiplo de 60).

### Modelo conceptual del usuario

> "Por qué no visualizamos las horas de cada materia como un líquido y cada slot como un recipiente con un líquido (materia) asignado? se va llenando cada recipiente hasta que no quede líquido para ese recipiente. luego si al final de la asignación no queda líquido suficiente para llenar un recipiente, éste se llena, sobrepasando el límite de esas horas (líquido), pero sólo para un slot."

Equivalente a **bin-packing first-fit con overshoot per materia ≤ 1 slot**.

### Estado actual del solver

- `App\Service\HorarioSolver` ejecuta backtracking ILP recibiendo del `CapacityPlanner` la cantidad de slots por (materia, duración). El planner genera combos delta=0 (ó próximos a 0) y el solver coloca los slots en celdas día×hora respetando `parallelBusy`.
- `App\Service\CapacityPlanner` con `PENALTY_NONZERO_DELTA = 100000` prioriza combos con delta=0. Eso elimina overshoot pero a costa de dejar slots vacíos.

---

## 1. Algoritmo bin-packing propuesto

### Pseudocódigo

```
function solveBinPacking(grupo, periodoLectivo):
  # Inputs
  jornada = periodoLectivo.getEffectiveJornadaTipo()
  diasLectivos = jornada.diasLectivos                    # ej [1,2,3,4,5]
  slotsDelDia = jornada.tramos.filter(tipo=SLOT)         # ordenados por horaInicio
  parallelBusy = buildParallelBusy(grupo, turno)         # (día, hora) → set(profIds ocupados)
  semanas = (fechaFin - fechaInicio + 1) / 7             # semanas fraccionales del rango
  
  # Líquido por imparticion: minutos curriculares anuales que faltan colocar.
  # Solo presenciales (modalidad consume_aula).
  liquido = {}
  for imp in grupo.imparticiones presenciales:
    objetivoAnualMin = imp.materia.getObjetivoAnualMinutos()  # horasTotales × 60
    yaColocadoOtrosRangos = alreadyPlacedByImp[imp.id] || 0   # cap anual cross-rango
    liquidoEsteRango = (objetivoAnualMin - yaColocadoOtrosRangos) / numRangosRestantes
    # O mejor: usar pli.minutosSemanales × semanas (lo que el distribuidor pidió).
    liquido[imp.id] = pli.getEffectiveMinutosSemanales() × semanas
  
  # Iterar slots cronológicamente (por hora primero, después día — distribución uniforme).
  # Ej orden: 8:30 lun, 8:30 mar, ..., 8:30 vie, 9:30 lun, ..., 14:30 vie.
  placements = []
  for slot_pos in cartesianProduct(slotsDelDia, diasLectivos):  # primero hora, luego día
    duracion = slot_pos.duracion                                # 60 o 90
    # Encontrar materia con líquido > 0 y profe NO ocupado en ese slot
    candidatos = sorted by liquido[imp.id] desc                 # las grandes primero
    for imp in candidatos:
      if liquido[imp.id] <= 0: continue
      profe = imp.profesor
      if profe.id in parallelBusy[(día, hora)]: continue
      # Asignar slot a esta materia
      placements.append({impId: imp.id, día: slot_pos.día, hora: slot_pos.hora, dur: duracion, aula: imp.aulaPreferida})
      liquido[imp.id] -= duracion × semanas                     # restar contribución anual
      break  # siguiente slot
    # Si ningún candidato disponible, slot queda vacío (solo por conflict profe)
  
  return {placements, liquidoFinal: liquido}
```

### Decisiones clave

| ID | Decisión | Resolución |
|---|---|---|
| BP-A | Orden de iteración de slots | Por hora primero, luego día (distribución uniforme entre días para una misma materia) |
| BP-B | Orden de elección de materia | Líquido descendente (las más grandes primero, evita que se queden sin slots al final) |
| BP-C | Qué hacer cuando ninguna materia puede usar un slot (todas con profe ocupado o líquido agotado) | Slot queda vacío |
| BP-D | ¿Permitir overshoot? | Sí, hasta 1 slot por materia (último slot que se pasa del líquido). Igual que round-up D22=A actual |
| BP-E | ¿Respetar `pli.minutosSemanales` heredado del distribuidor o calcular líquido directamente desde `materia.horasTotales`? | Usar pli (respetar lo que pidió el distribuidor); si quedan slots vacíos al final, repartir extras equiproporcionalmente entre materias con menos overshoot |
| BP-F | Restricciones de aula | Mantener: si la materia tiene `aulaEspecifica`, ese aula no puede usarse a la misma hora por otro grupo paralelo |

---

## 2. Ventajas vs solver actual

| Aspecto | Solver ILP actual | Bin-packing |
|---|---|---|
| Slots vacíos | 2-5 / rango (combos delta=0 dejan slot 90 sin usar) | Solo por conflict profe (raro) |
| Cobertura per materia | 100-130% (con tolerancia 5%) | 100-110% (overshoot ≤ 1 slot por materia) |
| Complejidad algorítmica | Backtracking exponencial + ILP | O(N × M) donde N = slots, M = materias |
| Tiempo de ejecución | 100-1500ms / rango (con timeout 1.5s) | < 100ms / rango |
| Combos posibles | Múltiples (delta=0 con varios slot mixes) | Único (slot recibe la primera materia con líquido) |
| Predecibilidad | Baja (mismo input puede dar distintas distribuciones) | Alta (algoritmo determinista) |

---

## 3. Riesgos y mitigaciones

### Riesgo A: distribución no uniforme entre días

**Síntoma**: una materia ocupa todos sus slots los lunes y nada el resto.

**Mitigación**: orden de iteración "hora-primero, día-después" garantiza que las primeras N apariciones de la materia están en distintos días (una por día_semana).

### Riesgo B: profe muy ocupado en paralelos → muchos slots vacíos

**Síntoma**: el profe del único candidato está ocupado en otro grupo a esa hora → slot queda vacío.

**Mitigación**: si tras iterar todas las materias para ese slot ninguna cabe, **liberar uno de los placements ya hechos** (backtracking limitado): buscar materia ya colocada en otro slot que SÍ pueda asignarse aquí, mover. Esto añade complejidad pero es opcional (Fase 2 si es necesario).

### Riesgo C: overshoot acumulado

**Síntoma**: si Σ horasTotales < cap anual, hay slots de sobra. Asignarlos a materias causa overshoot.

**Mitigación**: distribuir slots extra entre materias **con menor overshoot relativo actual** (= la materia menos "overshooteada" recibe el slot extra). Tope 130% por materia (igual que pase 2 actual del distribuidor).

### Riesgo D: aulas específicas no consideradas

**Síntoma**: dos materias requieren la misma aula taller a la misma hora → conflict.

**Mitigación**: mantener el sistema actual de `aulaEspecifica` y verificar disponibilidad antes de asignar el slot.

---

## 4. Plan de implementación

### Fase 1 — Implementación bin-packing core (~3h)

1. Crear `App\Service\HorarioSolverBinPacking` (servicio nuevo, no reemplaza al actual).
2. Implementar el algoritmo según pseudocódigo §1.
3. Respetar `parallelBusy` (fetched igual que el solver actual).
4. Mantener interfaz compatible con `HorarioSolver::solve()` (mismo input/output).

### Fase 2 — Endpoint con switch de solver (~30 min)

1. Modificar `HorarioSolverController::solve()` para aceptar parámetro `?solver=binpacking|ilp` (default `binpacking` tras validación).
2. Frontend: por defecto usar binpacking. ILP queda como fallback manual.

### Fase 3 — Validación E2E (~1h)

1. Probar con los 4 grupos del centro EAG (1º/2º DAW, 1º/2º DAM).
2. Verificar:
   - **Saturación**: todos los slots ocupados (excepto conflict profe).
   - **Cobertura**: 95-110% per materia.
   - **Distribución**: cada materia distribuida entre los 5 días lectivos.

### Fase 4 — Integración (~30 min)

1. Si validación OK: hacer binpacking el default. Mantener ILP como fallback opcional.
2. Bitácora del cambio en este doc + commit.

### Fase 5 (opcional) — Backtracking limitado para Riesgo B

Si tras Fase 3 hay grupos con muchos slots vacíos por conflict profe, añadir el "swap" del Riesgo B (mover materia ya colocada).

---

## 5. Impacto en otros docs

- `hoja-de-ruta-jornadas-recreos.md` §14 (sub-fases del solver hardening): el bin-packing es **alternativa al hardening ILP**. Si funciona bien, las sub-fases L-N del ILP quedan obsoletas.
- `hoja-de-ruta-periodos-lectivos.md` §6 (bitácora): el `CurriculumDistributor` sigue siendo el responsable de definir cuotas per (rango, materia). El bin-packing solo cambia CÓMO se materializa esas cuotas en placements.

---

## 6. Probabilidad de éxito

**Estimación honesta** (declaración previa al usuario):

- 70% al primer intento: el algoritmo funciona pero pueden quedar 1-2 slots vacíos por rango por conflicts edge-case.
- 90% tras 1-2 iteraciones de ajuste (ej. cambiar orden de iteración o añadir backtracking limitado).
- < 5% probabilidad de regresión total (= peor que el ILP actual).

Si tras Fase 3 los resultados son peores: `git reset --hard` y volvemos al ILP actual.

---

## 7. Bitácora

### 2026-04-29 — Doc creado

Plan de bin-packing diseñado tras conversación donde el usuario observó slots vacíos persistentes en FP Mañanas y propuso el modelo de "líquidos y recipientes". Documentado como alternativa al ILP. Pendiente implementar Fase 1.
