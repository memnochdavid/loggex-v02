# Refactor a modelo semanal (PL = semana lectiva)

> **Status (2026-05-06)**: 🟡 **EN MARCHA — branch `develop-semanas-lectivas`**. D-PRINCIPAL cerrada con resultado **MODELO SEMANAL PURO**.
>
> **Razón del cambio de rama vs recomendación inicial**: tras el análisis counterfactual ("si hubiéramos arrancado con semanal de origen, ¿sería más sencillo?"), el usuario concluye que sí, y que el coste de rendimiento es despreciable a la escala del producto. La inversión de refactor (~5-6 sesiones) la decide quien la pasta porque desbloquea naturalmente toda la familia de excepciones puntuales (intercambios, sustituciones, ausencias, eventos especiales, semanas atípicas) sin necesidad de capas de override.
>
> **Bloquea durante el refactor**: la rama `develop` queda congelada para features que toquen `PeriodoLectivo`/`Horario`/`HorariosEditor` hasta que el refactor termine y se merge. Otras features paralelas (notificaciones, calificaciones, catálogo) pueden seguir.

---

## ⚡ Snapshot para retomar

### Decisión tomada

Refactorizamos `PeriodoLectivo` (PL) para que **cada PL sea una semana lectiva** (~36 por grupo) en vez de un rango contiguo (~3 por grupo). Cada grupo tiene además **un PL "plantilla"** con su horario semanal por defecto; las semanas específicas heredan la plantilla salvo que tengan overrides explícitos.

Esto desbloquea naturalmente:
- Intercambio puntual entre profes → modificar el `Horario` de la semana específica.
- Sustitución por ausencia → idem.
- Festivos no anticipados → la semana del festivo no genera cobertura.
- Semanas atípicas (exámenes, cultural, FCT) → cada semana tiene su propio set de Horarios.
- Cancelación puntual → idem.

### Estado actual del refactor (2026-05-06 noche)

| Fase | Estado | Commit |
|---|---|---|
| **A1** Diseño schema | ✅ Done | `059890c` (docs) |
| **A2** Migration Doctrine | ✅ Done | `a28d812` |
| **A3** Entity + processors + resolver + service + subscriber + seed cmd | ✅ Done | `a28d812` |
| **B** Frontend HorariosEditor | 🟡 **Parcial — 12 hot-spots arreglados, queda reescritura del flujo "Configurar curso óptimo" + UI dedicada de SEMANA management** | sin commitear todavía |
| **C** Solvers (iterativo + bottleneck + capacity + bin-packing) | 🔴 Pendiente | — |
| **D** Vistas dependientes (consumición, banner, my-schedule, PDF) | 🔴 Pendiente | — |

**Estado BD dev**: migration aplicada · 4 grupos con su PLANTILLA viva creada vía `app:semanas:seed-plantillas --with-plis` · 33 PLIs sembrados · `schema:validate` solo se queja de drift cosmético en `notificacion` (defaults) que no es de este refactor.

**Próxima acción al retomar**: leer §11 (schema final) + §12 (estado Fase B) + abrir `https://localhost:8443/admin/horarios` y validar visualmente que el editor renderiza un grupo con su PLANTILLA + completar los pendientes listados en §12.

Plan de fases en §7. Bitácora cronológica en §9.

---

## 1. Modelo actual (rangos lectivos)

```
Grupo
  └─ PeriodoLectivo[]  (~3 por grupo, contiguos, cubren el curso)
        ├─ jornadaTipo  (puede heredar del grupo)
        ├─ fechaInicio
        ├─ fechaFin
        ├─ PeriodoLectivoImparticion[]  (cuota de minutos/sem por imparticion)
        └─ Horario[]                    (bloques recurrentes del PL)
              └─ imparticion → profesor + materia
              └─ diaSemana, horaInicio, horaFin
```

**Volumen típico** (1 centro de 100 grupos):

| Tabla | Filas |
|---|---|
| PeriodoLectivo | ~300 |
| PeriodoLectivoImparticion | ~3 000 |
| Horario | ~7 500 |

**Lógica de cálculo:** cobertura anual = `Σ (pli.minutosSemanales × semanasDelPL)`. Capacidad = `jornada × semanasDelPL`. Solver opera por PL.

---

## 2. Modelo propuesto (semanal puro)

```
Grupo
  └─ PeriodoLectivo[]  (~36 por grupo, una por semana lectiva)
        ├─ semanaNumero (1..36)
        ├─ fechaInicio (lunes)
        ├─ fechaFin    (viernes/domingo)
        ├─ jornadaTipo
        ├─ PeriodoLectivoImparticion[]
        └─ Horario[]   (bloques de esa semana específica, no recurrentes)
```

**Volumen para mismo centro:**

| Tabla | Filas | Ratio |
|---|---|---|
| PeriodoLectivo | 3 600 | ×12 |
| PeriodoLectivoImparticion | 36 000 | ×12 |
| Horario | 90 000 | ×12 |

---

## 3. Análisis comparativo

### A favor del modelo semanal

| Beneficio | Detalle |
|---|---|
| **Excepciones puntuales naturales** | Intercambio profe X↔Y el lunes 12-may = clonar Horario de esa semana y editar. No necesita entidad de override. |
| **Festivos en mitad de PL** | Hoy: PL "1ª evaluación" cubre 12 semanas con 2 festivos en medio → cobertura calculada por aproximación, hay que descontar. Semanal: la semana del festivo simplemente no genera cobertura para ese día. |
| **Semanas atípicas** | Semana de exámenes, semana cultural, semana FCT, semana ajustada por puente — todas se modelan como "esa semana tiene su propio set de Horarios". |
| **Calendario lectivo real** | Los datos BOJA descontados por festivos encajan natural: cada semana lectiva es un PL; las semanas de vacaciones simplemente no existen como PL. |

### En contra del modelo semanal

| Coste | Detalle |
|---|---|
| **Volumen de datos × 12** | 7 500 → 90 000 Horarios para 1 centro de 100 grupos. Manejable pero significativo en consultas con JOINs (consumición, cobertura, banner anual). Índices y caché bien afinados lo absorben, pero lo absorben. |
| **Refactor masivo de `HorariosEditor`** | 5 600 líneas construidas alrededor del concepto de PL-rango: strip de pills, modal "Materias del rango", banner anual, "Configurar curso óptimo", "Crear rangos recomendados", "Extender curso", `pendingTx`. Toda la mental model cambia. |
| **No hay "plantilla por defecto" gratis** | El admin no quiere editar 36 semanas idénticas. Necesitaríamos un mecanismo "plantilla base + excepciones" — que es exactamente lo que ya existe en el modelo de rangos. Volveríamos al punto de partida con más filas. |
| **Solver multi-rango pierde sentido** | Los 4 algoritmos (`HorarioSolverIterativo`, `BinPacking`, `CapacityPlanner`, `CurriculumDistributor`) están diseñados para distribuir cuota entre rangos cronológicos. Atomizar a semana exige reescribir bucle outer + `BottleneckClassifier` + `CorrectiveActionExecutor`. |
| **Migración de datos producción** | Si el cambio llega después de tener centros reales (objetivo del producto), hay que migrar PLs existentes → 36 PLs por grupo. Coordinado pero no trivial. |

### Conclusión cuantitativa

| Beneficio del modelo semanal | Coste alternativo (HorarioOverride) |
|---|---|
| Excepciones puntuales naturales | Entidad nueva + lógica de composición en render: ~1 sesión |
| Festivos en mitad de PL | Ya cubierto por `CalendarioLectivoService` (Fase 7 PL) |
| Semanas atípicas (exámenes, cultural) | Override es el mismo mecanismo |

El único beneficio NO cubierto por overrides es el "modelo conceptualmente más limpio" — un argumento estético, no funcional.

---

## 4. Alternativa recomendada: `HorarioOverride`

### Modelo

```
HorarioOverride
  horarioBase            ManyToOne Horario     (bloque recurrente afectado)
  fechaConcreta          Date                  (la fecha específica del override)
  motivo                 Enum (INTERCAMBIO | SUSTITUCION | EVENTO_ESPECIAL | AUSENCIA | CANCELADO)
  imparticionEfectiva    ManyToOne Imparticion nullable
                                               (qué imparticion la sustituye;
                                                NULL = bloque cancelado ese día)
  origenIntercambio      ManyToOne IntercambioImparticion nullable
                                               (FK al causante si motivo=INTERCAMBIO)
  observaciones          text nullable
  + traits estándar
```

### Cómo lo usa la capa de render

`/horarios?fecha=2026-05-12`:
1. Cargar Horarios recurrentes del lunes (día de semana de la fecha).
2. Cargar `HorarioOverride` donde `fechaConcreta = 2026-05-12`.
3. Para cada Horario: si tiene override, sustituir `imparticion` por la del override (o ocultar si motivo=CANCELADO).

Coste de implementación: índice `(fechaConcreta, horarioBase)` + 1 query extra al renderizar cualquier vista de fecha concreta. Caché por fecha trivial.

### Features que se desbloquean

| Feature | Override hace que sea... |
|---|---|
| **Intercambio puntual entre profes** (la feature que motiva esta discusión) | trivial — 2 overrides, uno por bloque |
| **Sustitución por ausencia** (profe enfermo) | trivial — 1 override con `imparticionEfectiva` apuntando al sustituto |
| **Evento especial** (semana cultural, charla) | trivial — N overrides con motivo=EVENTO_ESPECIAL |
| **Cancelación puntual** (huelga, mal tiempo) | trivial — overrides con motivo=CANCELADO |
| **Festivos no anticipados** (luto, alerta meteorológica) | trivial |

### Trade-offs

- ✅ Cambio aditivo. No toca PL ni Horario.
- ✅ Reusable por múltiples features.
- ✅ Migración nula (modelo nuevo).
- ❌ El renderizador debe componer base + overrides en cada consulta de fecha concreta. Caché ayuda.
- ❌ Cobertura anual y banner: si el override cambia materia, el cálculo agregado por materia debe contar el override. Es 1 query extra y 1 línea de SQL.

---

## 5. Decisiones

### Abiertas

(ninguna; D-A a D-E cerradas tras analizar el codebase real, ver §11)

### Cerradas

#### D-PRINCIPAL — ¿Refactorizar a modelo semanal puro o quedarse con rangos + capa de overrides?

**Cerrada 2026-05-06 con resultado: MODELO SEMANAL PURO.**

Recomendación inicial del análisis era capa `HorarioOverride` por menor coste de refactor. Tras el counterfactual del usuario ("si hubiéramos arrancado así de origen") y el análisis de rendimiento (despreciable a la escala del producto), se invierte la decisión: el modelo semanal expresa naturalmente la realidad escolar (semanas pueden ser distintas) y desbloquea toda la familia de features de excepciones puntuales sin acumular capas. Acepta el coste de ~5-6 sesiones de refactor a cambio de simplicidad estructural a 5 años.

Branch: `develop-semanas-lectivas`. Bitácora de la sesión que cierra la decisión: §9 entrada 2026-05-06.

---

## 6. Impacto en otros docs (modelo semanal)

| Doc | Cambio |
|---|---|
| `hoja-de-ruta-periodos-lectivos.md` | Refactor de Fases 1-8: el modelo se replantea de raíz. Mantener bitácora histórica como referencia, añadir entrada de migración semanal |
| `hoja-de-ruta-jornadas-recreos.md` | Sin cambios estructurales (jornada se asocia a PL semanal igual que hoy a PL rango) |
| `hoja-de-ruta-solver-iterativo.md` | Reescribir bucle outer y `BottleneckClassifier` para operar sobre plantilla |
| `hoja-de-ruta-solver-bin-packing.md` | Solver opera sobre plantilla; semanas heredan; sin cambios estructurales en bin-packing |
| `hoja-de-ruta-curriculum-ccaa.md` | Sin cambios (overlay sigue aplicando a Materia) |
| `hoja-de-ruta-calendario-escolar.md` | Festivos integrados natural (semanas no lectivas no existen como PL `SEMANA`) |
| `hoja-de-ruta-cambio-turno.md` | Marcar SUPERSEDED por `hoja-de-ruta-intercambio-imparticiones.md` |
| **`hoja-de-ruta-intercambio-imparticiones.md`** (a crear post-refactor) | Diseño basado en clonar Horarios en el PL `SEMANA` específico |

---

## 7. Plan de fases (canon)

### Fase A — Modelo y migración backend

**A1**: Diseño schema final (D-A a D-E cerradas con datos del codebase).
**A2**: Migration Doctrine que convierte PLs existentes a modelo semanal (plantilla por grupo + lazy weeks).
**A3**: Adaptación de entities (`PeriodoLectivo.tipo`, `PeriodoLectivo.semanaNumero`), repos, `PeriodoLectivoResolver`, `HorarioRenderService`.
**Estimado**: ~1.5 sesiones.

### Fase B — Frontend HorariosEditor (~2 sesiones)
- Strip pasa de N pills (rangos) a vista calendario con 36 mini-celdas semanales agrupadas por mes + pill especial "Plantilla".
- "Configurar curso óptimo" se redefine: genera plantilla → semanas heredan.
- Modal "Materias del rango" → modal "Materias por defecto del curso" (sobre plantilla) + modal opcional "Excepciones de la semana N".
- `pendingTx` adaptado: tx sobre plantilla vs tx sobre semana específica.

### Fase C — Solvers (~1.5 sesiones)
- `HorarioSolverIterativo`: el bucle outer pasa a operar sobre la plantilla, no semanas individuales (las semanas heredan).
- `BottleneckClassifier` y `CorrectiveActionExecutor` reformulados para operar sobre plantilla.
- `CapacityPlanner` adapta semanas: cuenta semanas reales del grupo vía `CalendarioLectivoService`.
- `HorarioSolverBinPacking` opera sobre plantilla sin cambios de fondo.

### Fase D — Vistas dependientes (~0.5 sesión)
- Tab "Consumición" en `/admin/horarios` (Fase 8 actual): cálculo natural por agregación de semanas.
- Banner anual cobertura: similar.
- `/horario/me` (my-schedule) compone plantilla + overrides para la semana visible.
- `HorarioPdfController`: misma lógica de composición.

### Total estimado: 5-6 sesiones de refactor estructural

---

## 8. Riesgos y mitigaciones

| Riesgo | Mitigación |
|---|---|
| Backend sin arrancar a mitad de refactor | Migration backward-compatible: añadir `tipo`/`semanaNumero` con default `SEMANA` y filas existentes pasan a `PLANTILLA` por backfill. Código viejo sigue leyendo Horarios sin saber de la distinción. |
| Solver multi-rango con tests E2E que se rompen | Tras Fase A, validar `/horario/me` y banner siguen renderizando correcto antes de tocar solvers. |
| Frontend `pendingTx` se vuelve inmanejable | Mantener `pendingTx` como lo de hoy, pero adaptar las claves `pl_temporal` para cubrir plantilla y semanas específicas. |
| Migración de datos producción | A día de hoy aún no hay producción real. Los seeds se reaplicará en BD vacía. La migration de Doctrine cubre el caso "centro creado bajo modelo viejo" cuando llegue. |
| Volumen Horario × N en el largo plazo | Lazy on-demand (D-B): solo se materializan Horarios para semanas con overrides. Las semanas limpias delegan en plantilla. Volumen Horario igual al actual mientras no haya excepciones. |

---

## 9. Bitácora de implementación

### 2026-05-07 (sesión 7) — Cierre de pendientes 1, 2 y 3 de sesión 6

Sesión corta para liquidar los 3 ítems "que bloquean coherencia entre 1º DAW y 1º DAM" anotados al final de la bitácora sesión 6.

**Ítem 1 — Verificación de duplicados intra-itinerario ✅ Sin duplicados.**
Query del bitácora ejecutada sobre `materia` con `itinerario_id IN (3,5) AND curso=1 AND deleted=0`: **0 filas** devueltas. Listado completo confirma 9 materias en cada itinerario con `codigo_oficial` distintos (FOL es 0617 en DAW y 0493 en DAM por convención BOJA, no es duplicado). Ampliado a curso=2: tampoco hay duplicados. No hay nada que soft-deletear.

**Ítem 2 — Regenerar "Configurar curso óptimo" en 1º DAM ✅ Ya regenerado en sesión 6.**
Inspección de timestamps: las SEMANAs del grupo 3 (DAM) tienen `created_at = 2026-05-06 17:42:26` — fueron creadas en la propia sesión 6 después de los UPDATE manuales a las imparticiones. Estado actual:

| Tramo | DAW (min/sem) | DAM (min/sem) | sem | Notas |
|---|---|---|---|---|
| Hasta 1ª Eval | 1530 | 1530 | 13.71 | igual |
| Hasta 2ª Eval | 1530 | 1530 | 13.00 | igual |
| Hasta 3ª Eval | 1560 | 1500 | 10.00 | DAM 60min menos (geometría jornada tarde) |
| Tras última | 1650 | 1650 | 3.43 | igual |

Cobertura anual aproximada: DAW ≈ 1035h, DAM ≈ 1025h vs currículo legal 996h. **Ambos grupos sobrecubren con margen** (~3-4%). Último tramo termina 22/06/2026 en ambos (la fecha 06/07 que aparecía antes del UPDATE de `Centro.fechaFinCurso` ya no existe). El item solo necesita validación visual del banner anual en `/admin/horarios` por parte del usuario; los datos cuadran.

**Ítem 3 — Fix `GrupoResyncCcaaController` con `horasTotales` ✅ Done.**
Añadido bloque en la rama de match (líneas ~83-91) que compara `$r->catalogoMateria?->getHorasTotales()` con `$m->getHorasTotales()` y actualiza si difiere, siguiendo la misma filosofía conservadora que `minutosSemanales` (solo se actualiza si el catálogo trae valor concreto; NULL = "el catálogo no especifica" → preserva lo que hay). Sin esto, un resync tras enriquecer `catalogo_materia.horasTotales` vía `BoeRdEnricher` no propagaba las horas legales a las materias del grupo. Cambio mínimo (8 líneas), no requiere migración.

**Doc nuevo creado** (`hoja-de-ruta-intercambio-imparticiones.md`): roadmap dedicado para la feature objetivo del refactor. 7 secciones + 7 fases (A modelo + CRUD, B render, C UI creación, D notificaciones, E intercambios bilaterales, F semana atípica, G histórico). MVP estimado A-E en 4-5 sesiones. Decisión bloqueante de arranque: D-A (granularidad temporal) — recomendación argumentada Opción B (capa `ExcepcionHorario` aditiva) por encima de (A) lazy split y (C) atomización completa, dado que la implementación actual del modelo-semanal dejó SEMANAs multi-week (no atómicas como §2 sugería). Arrancar Fase A requiere cerrar D-A a D-G con el usuario en próxima sesión.

**Pendientes vivos tras esta sesión** (orden respeta lo que quedó en sesión 6):

1. ~~Verificar duplicados intra-itinerario~~ ✅ Sin duplicados.
2. ~~Regenerar "Configurar curso óptimo" en 1º DAM~~ ✅ Ya regenerado; falta validación visual del banner anual.
3. ~~Fix `GrupoResyncCcaaController.horasTotales`~~ ✅ Done.
4. **Mejora opcional `handleConfigureOptimalCourse`** — usar `{periodoLectivoId: plantilla.id}` directo en casos simples (cuotas naturales que caben en jornada sin distribución temporal). Reduciría ruido en BD para grupos "fáciles" y dejaría la PLANTILLA protagonista en su rol original.
5. ~~Crear `hoja-de-ruta-intercambio-imparticiones.md`~~ ✅ Doc creado. Próximo paso: cerrar decisiones D-A a D-G con usuario y arrancar Fase A.
6. **Comando `app:grupo:resync-curriculum`** para recalcular materias de grupos existentes desde el catálogo enriquecido.
7. **Roadmap `hoja-de-ruta-clases-compartidas.md`** ya creado en sesión 4 — esperando bloque dedicado.

### 2026-05-06 (noche, sesión 6) — Fase C ✅ + UX PLANTILLA oculta + descubrimiento de deudas adicionales

**Fase C solvers nativos sobre PLANTILLA ✅ Done** (commit `4a0d716`).

Cierre de la última fase pendiente del refactor.

**Bug interno**: `HorarioSolverIterativo::solveMultiRango` (líneas 285-313) y `CapacityPlanner::calcularSemanasPL` (línea 576-583) calculaban `semanas = (fechaFin - fechaInicio + 1) / 7` directamente. Para una PLANTILLA (`tipo=PLANTILLA`, fechas NULL) → 0 semanas → cap anual roto → solver no colocaba placements coherentes. Por eso el frontend simulaba `rangoOverride` con fechas ficticias del grupo (deuda anotada en bitácora sesión 3).

**Fix**: nuevo método `PeriodoLectivoResolver::calcularSemanas($pl)` como punto único de consulta:
- SEMANA con fechas → `(fechaFin - fechaInicio + 1) / 7`.
- PLANTILLA o PL sin fechas → `semanasReferenciaCentro` via `CalendarioLectivoService::semanasLectivas($centro, EtapaEducativa::FP)` (descontando festivos del calendario CCAA). Fallback 36 LOMLOE.

**Sustituciones**:
- `CapacityPlanner::calcularSemanasPL` delega en el resolver.
- `HorarioSolverIterativo::solveMultiRango` cálculo de `totalSemanasGrupoOverride` y `semanasByPlKey` vía resolver (eliminados los dos `->diff()`).
- `HorarioSolverBinPacking` ya era seguro con PLANTILLA (solo usa `getEffectiveJornadaTipo` y PLIs).

**Resultado**: el endpoint `solver-iterativo-multi` con `{rangos: [{periodoLectivoId: plantilla.id}]}` computa correctamente sin que el caller invente fechas. La rama `rangoOverride` con tempId sigue funcionando para preview con PLs virtuales (caso "Configurar curso óptimo" generando SEMANAs).

**Deuda residual anotada** (no urgente): el frontend del flow "Configurar curso óptimo" sigue generando SEMANAs siempre (rama `rangoOverride`). Con el fix de Fase C, casos simples (cuotas naturales que caben en jornada sin necesidad de distribución temporal cross-trimestre) podrían usar `{periodoLectivoId: plantilla.id}` directo y NO crear SEMANAs en BD. Reduciría ruido en grupos "fáciles" y dejaría la PLANTILLA protagonista en su rol original. Mejora opcional para próxima sesión si hace falta.

**Refactor modelo-semanal CERRADO**. Próximo objetivo: roadmap dedicado `hoja-de-ruta-intercambio-imparticiones.md` (por crear) sobre la base estable.

**Mejora UX adicional sesión 6 (commit `c3bf9bb`)**: ocultar PLANTILLA del strip de pills en `/admin/horarios` cuando hay SEMANAs vivas. Cambios:
- `HorariosEditor.jsx`: filtro en el render del strip (`plsVisibles = haySemanas ? filter(no PLANTILLA) : todos`). Banner anual (`plCount`) cuenta solo SEMANAs cuando las hay.
- La PLANTILLA sigue VIVA en BD: ancla FK de SEMANAs (plantillaBase), almacén de cuotas naturales, fallback del `PeriodoLectivoResolver`. Solo invisible en el editor admin cuando ya está tapada operativamente por las SEMANAs.

**Descubrimientos a depurar próxima sesión**:

1. **Materias DAM (1º DAM iti 5) no estaban alineadas con DAW** (1º DAW iti 3) tras el fix `25df9b6` del `MaterializationController`. El fix solo afecta a grupos NUEVOS — los existentes mantienen sus horas viejas infladas. Aplicado UPDATE manual en sesión 6 a las 7 imparticiones presenciales del grupo 3 (id 45-49 + 61) para alinearlas con DAW. Pendiente: regenerar "Configurar curso óptimo" en DAM con las horas legales y validar visualmente.

2. **Bug en `GrupoResyncCcaaController` líneas 71-97**: cuando una materia existe (match por `codigoOficial+curso`), actualiza `minutosSemanales`, `nombre` y `modalidad` pero **NO actualiza `horasTotales`**. Si se enriquece el catálogo BOE con horas legales nuevas, un resync no las propagará a las materias del grupo. Trivial de añadir: comparar `$m->getHorasTotales() !== $r->catalogoMateria?->getHorasTotales()` y `setHorasTotales` si difiere.

3. **Verificación pendiente — duplicados intra-itinerario**: SQL diagnóstico pendiente para detectar si hay materias activas con mismo `codigoOficial+curso` dentro del mismo itinerario (glitch histórico). Si los hay, soft-deletear los obsoletos. Query:
   ```sql
   SELECT itinerario_id, codigo_oficial, COUNT(*) AS n
   FROM materia WHERE itinerario_id IN (3,5) AND curso=1 AND deleted=0
   GROUP BY itinerario_id, codigo_oficial HAVING n > 1;
   ```

4. **Última fecha del tramo "Tras última evaluación" en DAM**: 06/07/2026 (debe ser 22/06 como en DAW). Causa: el "Configurar curso óptimo" para DAM se ejecutó ANTES del UPDATE `Centro.fechaFinCurso = 22/06`. Solución: regenerar el flow en DAM ahora que las fechas son correctas.

5. **Comando `app:grupo:resync-curriculum`** anotado anteriormente: cobra más sentido tras estos descubrimientos. Recalcularía horas desde el catálogo + alinearía duplicados. Próximo objetivo natural si hace falta limpiar BD existente al pasar a producción.

## Pendientes próxima sesión

Por orden de impacto (los 4 primeros bloquean la coherencia entre 1º DAW y 1º DAM, los demás son deuda residual):

1. **Verificar duplicados intra-itinerario** (SQL pendiente arriba). Si hay → soft-delete de obsoletos.
2. **Regenerar "Configurar curso óptimo" en 1º DAM** ahora que las horas legales están corregidas y el centro tiene fechaFinCurso correcta. Validar visualmente que ambos grupos cuadran al mismo currículo (modulo geometría de slots por jornada distinta).
3. **Fix `GrupoResyncCcaaController`**: añadir `horasTotales` a los campos que actualiza en match. Trivial.
4. **Mejora opcional `handleConfigureOptimalCourse`**: usar `{periodoLectivoId: plantilla.id}` directo en casos simples (cuotas naturales que caben en jornada sin distribución temporal). Reduciría ruido en BD para grupos "fáciles" y dejaría la PLANTILLA protagonista en su rol original.
5. **Crear `hoja-de-ruta-intercambio-imparticiones.md`** y arrancar feature objetivo (sustituciones, intercambios de turno, semanas atípicas) sobre PLANTILLA estable.
6. **Comando `app:grupo:resync-curriculum`** para recalcular materias de grupos existentes desde el catálogo enriquecido.
7. **Roadmap `hoja-de-ruta-clases-compartidas.md`** ya creado en sesión 4 — esperando bloque dedicado.

### 2026-05-06 (noche, sesión 5) — Fase D vistas dependientes ✅ Done

Tras cerrar Fase B, la sesión 5 cierra las 4 piezas de Fase D que faltaban para que las vistas que consumen el modelo de PLs reflejen correctamente PLANTILLA + SEMANAs.

**#2 `/horario/me` (vista profe/alumno) — commit `ede5361`**
- Bug: `PLANTILLA` tiene fechas NULL → el filtro de fecha del frontend siempre la incluía y aparecía duplicada con la SEMANA correspondiente.
- Backend `GetMyScheduleController`: añadidos `periodoLectivoTipo` y `grupoId` al payload de cada event.
- Frontend `Horarios.jsx::visibleSchedule`: implementada la cascada SEMANA-cubre-fecha → PLANTILLA por grupo. Para cada grupo, si hay una SEMANA cuyo rango contiene `selectedDate`, oculta la PLANTILLA del mismo grupo. Eventos sin `tipo` (legacy) se incluyen tal cual.

**#1 PDF horario personal — commit `2597a0a`**
- Bug: `/api/v1/informes/horario/me` devolvía TODOS los placements del usuario sin filtrar por fecha. El PDF mezclaba PLANTILLA + N SEMANAs.
- Backend `HorarioPdfController`: inyecta `PeriodoLectivoResolver`. El endpoint acepta `?fecha=YYYY-MM-DD` (default = hoy) y `loadHorariosForUser` filtra: por cada grupo distinto, resuelve el PL aplicable via `resolveActive($grupo, $fecha)` y conserva solo los horarios de ese PL. Si no hay PL aplicable (caso edge), pasa sin filtrar.
- Frontend `Horarios.jsx::handleExportPdf`: pasa la `selectedDate` del CalendarView de la página al endpoint como `?fecha=YYYY-MM-DD`. El filename del PDF incluye la fecha (`horario_2025-12-15.pdf`) para diferenciar descargas.

**#3 Tab Consumición — commit `c4b1297`**
- Bug: `ConsumicionAnualService::compute*` iteraba TODOS los PLs del grupo y crasheaba al hacer `$pl->getFechaInicio()->format('Y-m-d')` con NULL en la PLANTILLA.
- Fix: query Doctrine filtra `pl.tipo = 'semana'`. La PLANTILLA queda fuera del cómputo (no aporta días lectivos transcurridos). Si solo hay PLANTILLA, resultado vacío y el frontend muestra estado coherente.
- Pendiente menor anotable: si solo hay PLANTILLA, tratarla como rango virtual cubriendo el calendario lectivo del centro (caso edge no urgente).

**#4 Banner anual cobertura — sin cambios**
- Validado en sesión 4 (captura "Currículo 996h | Planificado 997h | +1h margen"). El banner ya filtra correctamente con `if (!pl.fechaInicio || !pl.fechaFin) return;` (HorariosEditor.jsx:1172) → salta PLANTILLAs y solo cuenta SEMANAs. Por construcción respeta el modelo semanal.

**Pendiente capa adicional** (no urgente, anotada): el endpoint `horarioGrupo` para PDF multi-página del grupo entero podría aceptar `?fecha` para limitar a la SEMANA aplicable. Hoy genera multi-página por PL — el admin que descarga el PDF del grupo recibe TODAS las SEMANAs+PLANTILLA como páginas separadas. Adecuado si quiere "el horario completo del año"; cuando se pida limitar a una semana concreta, replicar el patrón de `horarioPersonal`.

### 2026-05-06 (noche, sesión 3) — `handleConfigureOptimalCourse` v3: distribución temporal por SEMANAs

**Causa del giro**: la versión v2 (sesión 2) aplicaba una **cuota uniforme** sobre la PLANTILLA y reducía proporcionalmente cuando no cabía. Resultado: cualquier déficit estructural se concentraba en la materia menos elástica → "Sistemas Informáticos al 85%" para grupos con jornada apretada. El usuario señaló que el modelo semanal puro debía resolverlo redistribuyendo cuotas semana a semana ("hasta sem X se cursan todas; cuando una se acaba, las grandes absorben sus slots"). Mi v2 ignoraba esa promesa central del refactor.

**v3 implementa la distribución temporal**:
- **Pipeline**: cabida (informativo) → `plan-rangos` (puntos de corte dinámicos N) → `distribute-curriculum-dry-run` con N tramos virtuales → crear N **SEMANAs** (`tipo: 'semana'`, `plantillaBase: PLANTILLA.id`) en `pendingTx.plsToCreate` → `solver-iterativo-multi` con N `rangoOverride` → `state[gid_tempId]` por SEMANA.
- **PLANTILLA intacta**: NO se borra, NO se modifica. Cubre las semanas no incluidas en ninguna SEMANA explícita (cascada del `PeriodoLectivoResolver`).
- **Cuotas heterogéneas**: el `CurriculumDistributor` (que sigue vivo desde el flujo viejo) reparte minutos por (tramo, imparticion) respetando jornada de cada tramo + cap anual por materia. Materias pequeñas se concentran al inicio; materias grandes ocupan slots liberados al final → cobertura típica 100% del currículo legal cuando capacidad anual ≥ Σ horasTotales.
- **Confirm dialog rediseñado**: muestra los N tramos del planner con sus etiquetas/razones; cuando hay déficit estructural muestra las 4 palancas en una lista (extender calendario con N concreto, subir slots de jornada, marcar AUTÓNOMA/FCT, aceptar déficit).
- **Loop de extensión retrocompatible**: si el distribuidor pide `extendBy>0`, se extiende el último tramo virtual (NO se toca `Grupo.fechaFin`). Tras ≤12 intentos, si no hay feasible se avanza con la distribución parcial y el solver hace lo mejor posible — comportamiento idéntico al flujo viejo.
- **`tempIdSeqRef` para los tempIds negativos**, `applyPendingTxForGrupo` los mapea a IDs reales al guardar (ya soporta `tipo`/`plantillaBase` en el body POST PL — verificado en `HorariosEditor.jsx:1798-1823`).

**Diferencias respecto al flujo viejo (que sí usaba el distribuidor)**:
- Cada PL nuevo lleva `tipo: 'semana'` + `plantillaBase` apuntando a la PLANTILLA del grupo.
- NO se borran PLs anteriores (la PLANTILLA persiste, siempre).
- NO se extiende `Grupo.fechaFin` automáticamente. Si hace falta más calendario, el sistema lo sugiere y el admin edita `Centro.fechaInicio/FinCurso` a mano.

**Deuda Fase C anotada**: el solver iterativo aún calcula `semanasPlPre` desde fechas (`HorarioSolverIterativo:311`). Por eso pasamos las SEMANAs como `rangoOverride` con fechas, no como `periodoLectivoId` (que apuntaría a una PLANTILLA sin fechas). El refactor del solver para operar nativamente sobre `PeriodoLectivo.tipo=PLANTILLA` (con `semanasReferenciaCentro` como referencia) está pendiente.

**Bug fix #2 (sesión 3, mismo turno) — PLANTILLA borrable + déficit estructural oculto**:
- **Síntoma 1**: el admin podía ejecutar "Limpiar curso" o equivalente que borraba TODOS los PLs incluyendo la PLANTILLA. Tras eso, "Configurar curso óptimo" fallaba porque `findPlantilla()` retornaba null. **Fix**: el handler ahora detecta ausencia de PLANTILLA y la crea al vuelo (POST PL `tipo: plantilla` sin fechas; el processor auto-crea sus PLIs heredados), antes de continuar. Toast informativo "PLANTILLA del grupo creada automáticamente".
- **Síntoma 2** (más sutil, revelado por logs `crossRangoShortfalls: Array(0)` con currículo claramente sin cubrir): el `CurriculumDistributor` declara `feasible: true` cuando las cuotas SEMANALES reducidas cuadran con la jornada (Σ ≤ jornada lectiva), pero internamente OCULTA el déficit anual cuando `Σ horasTotales > capacidad anual del aula`. Caso 1º DAW EAG: currículo legal 1044h × 60 = 62.640 min/año, capacidad aula 1650 × 36.4 = 60.060 min/año → déficit estructural de 43h/año que NINGÚN reparto cross-rango resuelve. El usuario ve "el horario sigue sin tener todas las horas" porque `accumPlacedByImp` < `Σ horasTotales × 60`, aun con `crossRangoShortfalls: []`.
- **Intento de fix #1 (revertido)**: el handler detectaba `cabida.objetivoAnualPresencialMin > cabida.capacidadAnualSlotsMin` y AUTO-EXTENDÍA el último tramo virtual `ceil(deficit / jornadaSemanalLectivaMin)` semanas, pasándolo al distribuidor. **Pero**: la extensión añadía días BRUTOS al calendario virtual. Si caían en zona no lectiva del calendario CCAA del centro (típico: julio en FP — vacaciones de verano), el `CalendarioLectivoService` los descontaba y la extensión sumaba 0 semanas lectivas reales. Resultado en EAG 2025-26: el solver internamente declaraba 100% (semanas brutas 44.3) pero el banner del editor (que descuenta festivos/vacaciones) seguía mostrando −12h faltantes. **"Cobertura aparente" engañosa**.
- **Fix #2 (vigente)**: eliminada la auto-extensión. El distribuidor reparte heterogéneamente lo posible con el calendario actual del centro; si queda déficit residual, el banner anual del editor lo reporta y el admin recurre a las palancas reales (subir jornada en `/admin/jornadas`, marcar AUTÓNOMA/FCT en `/admin/imparticiones`, extender `Centro.fechaFinCurso` a mano si el calendario CCAA lo permite, o aceptar el déficit con anexo PDF). Volver a auto-extender de forma transparente requiere consultar el calendario CCAA desde el frontend (saber qué fechas son lectivas reales) — out of scope Fase B; anotable como deuda Fase D vistas dependientes / enriquecer `PlantillaCabidaValidator` con `extensionRealmenteUtil` calculado vía `CalendarioLectivoService::semanasLectivas(Centro, etapa, override...)`.

**Deuda mayor identificada en sesión 3 (PARCIALMENTE arreglada en sesión 4 2026-05-06)** — `materia.horas_totales` se infla sistemáticamente al materializar grupos:
- `CatalogoMaterializationController.php:138-141` y `GrupoResyncCcaaController.php:128-130` aplican fallback `horas_totales = round(min/sem × 36 / 60)` cuando el catálogo no trae horas legales explícitas. Esto **inflate** las horas anuales cuando AN (u otra CCAA) define `min/sem` generosos asumiendo X semanas reales del centro, pero el sistema convierte a horas asumiendo 36 sem LOMLOE puras.
- Casos donde el fallback dispara hoy:
  - **Módulos sólo CCAA** (IPE I, DIG, Sostenibilidad, IP, IPE II en AN): `catalogo_materia` no los tiene; `catalogo_materia_ccaa` **NO tiene columna `horas_totales`** (sólo `minutos_semanales`). El RD/Resolución autonómica SÍ define horas legales (ej. IPE I = 96h en LOMLOE FP) pero no se ingestan.
  - **Módulos nacionales no enriquecidos por `BoeRdEnricher`**: si el RD aún no se procesó, `catalogo_materia.horas_totales` es NULL.
- Resultado real para 1º DAW EAG (sesión 3): currículo "calculado" 1044h vs RD legal 996h → tramo 4 hasta julio innecesario. Manualmente corregido en BD vía UPDATE para esta sesión, pero la deuda estructural sigue.
- **Fix limpio en 3 capas**:
  1. Eliminar el fallback `min × 36 / 60` en ambos controllers. Si no hay `horas_totales` en el catálogo → dejar NULL en `materia` (downstream gestiona NULL gracefully).
  2. Añadir columna `horas_totales` a `catalogo_materia_ccaa` + ingestar el dato desde las Resoluciones autonómicas (BOJA, BOPA, BOPV, etc.) en los providers CCAA.
  3. Crear comando `app:grupo:resync-curriculum` que recalcule materias del grupo desde el catálogo actualizado, respetando `horas_totales` legales del catálogo y derivando `min/sem` del calendario real del centro (`horas_totales × 60 / semanasLectivasRealesCentro`).
- Roadmap candidato: nuevo doc `hoja-de-ruta-horas-legales-vs-calendario.md` o ampliación de `catalogo-oficial.md` (deuda ya parcialmente anotada en `hoja-de-ruta-periodos-lectivos.md` Fase 5 sub-E 2026-04-28 + Opción A 2026-04-29).
- **Fix capa 1+2 aplicado sesión 4 2026-05-06**:
  - `CatalogoMaterializationController.php:138-141` y `GrupoResyncCcaaController.php:128-130`: eliminado el fallback `min × 36 / 60`. Si el catálogo nacional no trae `horas_totales`, la materia se crea con NULL en lugar de inflado.
  - `Materia::getObjetivoAnualMinutos()`: cuando `horas_totales` es NULL, consulta primero `catalogoOrigen.horasTotales` (BOE) antes de caer al fallback histórico. Para materias creadas antes del enriquecimiento BoeRdEnricher, esto da las horas legales correctas sin tocar BD.
- **Pendiente capa 3** (out of scope sesión 4): añadir columna `horas_totales` a `catalogo_materia_ccaa` + ingestar el dato desde Resoluciones autonómicas para módulos sólo CCAA (IPE I, DIG, Sostenibilidad, IP, IPE II). Hoy esos módulos siguen requiriendo edición manual de `materia.horas_totales` por grupo.
- **Pendiente comando** `app:grupo:resync-curriculum` para recalcular materias de grupos existentes con horas legales correctas + min/sem derivado del calendario real.

**Deuda visual identificada y CERRADA en sesión 3** — `TimeTable.jsx` chafa filas (commit `b2785c6`):
- Vista profe (`/horarios`) y vista alumno mismas patologías visuales. Filas de la jornada sin evento del usuario mostraban "barras rojas con guion" delgadas. Causas:
  1. `colorForModule(undefined)` → `hsl(0°,55%,48%)` (rojo) por `Number(undefined)=NaN→0`. Fix: si no hay id válido devuelve `var(--bg-card)` (neutro temático).
  2. Eventos rotos del backend (sin materia ni imparticionId/moduloId) se renderizaban como caja vacía. Fix: filtrados en `processEvents` antes de colocarlos en grid.
  3. `.cell { min-height: 22px }` igual para slots de 30, 60 y 90 min. Filas vacías de slots largos quedaban a 22px mientras las contiguas con evento crecían por contenido. Fix: `minHeight` inline calculado por slot (`28px × duracionMin / 30`), aplicado a `.cell`, `.timeCell`, `.festivoCell` y `.recreoStrip`.

**Bug fix #1 (sesión 3, mismo turno)**:
- **Síntoma**: tras "Configurar curso óptimo" + Guardar, las 4 SEMANAs aparecen en BD pero **sin PLIs** propios. El render hereda cuotas de la PLANTILLA → todas las SEMANAs muestran el mismo horario, sin la distribución heterogénea. Usuario reporta "no viable".
- **Causa raíz**: `PeriodoLectivoCreateProcessor.php:54-59` solo auto-crea PLIs en PLANTILLAs (modelo lazy on-demand del refactor). Las SEMANAs nacen sin PLIs por contrato — los PLIs en SEMANAs son **overrides explícitos** que el caller debe POSTear. Pero `applyPendingTxForGrupo` (líneas 1893-1916 antes del fix) saltaba `pliPatches` con `if (!pliId) continue;` cuando no encontraba PLI, asumiendo "imp desactivada por toggle previo" — caso que NO aplica a una SEMANA recién creada con cuota override.
- **Fix `applyPendingTxForGrupo`**: ante un `pliPatch` cuyo `plKey` corresponde a un PL recién creado y sin PLI cargado en el cache, hace **POST PLI** con la cuota directamente (no PATCH). Mantiene el contrato lazy: solo se crean PLIs cuando hay override explícito. El PLI hereda como antes cuando NO se patchea. Líneas 1907-1942 del archivo tras el fix.
- **Fix `handleConfigureOptimalCourse`**: `pendingTx.plsToDelete` ahora incluye las SEMANAs vivas del grupo (filtradas con `isSemana()`). La PLANTILLA NO se borra. Esto permite rehacer el flujo limpiamente — el admin pulsa otra vez el botón y las 4 SEMANAs viejas se sustituyen por las nuevas (con sus PLIs override correctos). Limpieza automática de las 4 SEMANAs basura que quedaron en BD del primer intento.

### 2026-05-06 (noche, sesión 2) — Fase B avanza: `handleConfigureOptimalCourse` reescrita + endpoint `plantilla-cabida`

**Decisión arquitectónica**: para producción comercial se opta por **C + b** (vs A + a más rápido). Razones: contrato de API documentable, evita arrastrar deuda ("`solver-iterativo-multi` mintiéndose con `rangoOverride` ficticio sobre PLANTILLA"), y deja al `CurriculumDistributor` vivo para SEMANAs excepcionales con cuotas heterogéneas (caso real del modelo semanal cuando un centro reciba un cambio puntual de horario).

**Hallazgo positivo**: la rama **b** (solver acepta `periodoLectivoId` además de `rangoOverride`) **ya estaba implementada** en `HorarioSolverController:368-441`. Cero cambios backend en el solver — solo hay que consumirla desde el frontend.

**Backend**:
- Nuevo servicio `PlantillaCabidaValidator` (`backend/src/Service/PlantillaCabidaValidator.php`). Para un grupo: lee la PLANTILLA vía `PeriodoLectivoResolver::getPlantilla()`, resuelve la jornada efectiva (con cascada PL→Grupo→Itinerario), calcula `jornadaSemanalLectivaMin` con la misma fórmula que `CapacityPlanner::slotsFromJornada()` (Σ duración tramos SLOT × días lectivos), resuelve `semanasRefCentro` vía `CalendarioLectivoService::semanasLectivas(Centro, EtapaEducativa::FP)` (con fallback 36 LOMLOE), itera los PLI vivos de la PLANTILLA (filtra `pli.deleted` y `imp.deleted`), y devuelve `{feasible, plantilla, jornada, semanasRefCentro, semanasOrigen, cuotas[], totalCuotaPresencialMin, totalCuotaCurricularMin, excedenteJornadaMin, shortfalls[]}`.
- **Cuota sugerida ESCALADA al calendario real** (post-fix smoke test): `cuotaSugeridaMin = ceil(materia.objetivoAnualMinutos / semanasRefCentro)`. Sin esto, calendarios <36 sem (típico tras festivos) producían `crossRangoShortfalls` del solver iterativo porque `min/sem × semanasReales < horasTotales × 60`. Cada cuota lleva también `cuotaCatalogoMin` (`materia.minutosSemanales`) y `objetivoAnualMin` para transparencia. Solo cuentan a la jornada las imparticiones cuya `Modalidad::consumeAula()` es true (PRESENCIAL); FCT/NO_REGULAR/AUTONOMA cuentan al currículo (informativo en `totalCuotaCurricularMin`) pero NO a la jornada presencial. NO modifica BD. NO depende del distribuidor.
- **Sugerencia de extensión de calendario** (post-pregunta usuario "se está marcando como límite inamovible el final del curso?"): cuando `!feasible`, el validator devuelve `semanasMinimasParaFeasible` (Σ objetivoAnualPresencial / jornadaSemanalLectivaMin) y `semanasExtensionRecomendada` (`ceil(semanasMinimas - semanasRefCentro)`). El frontend lo enseña en el cuerpo del confirm: "Alternativa limpia: extender el calendario lectivo del centro ~N semana(s) más en /admin/centros (si el calendario CCAA lo permite) cubriría el currículo al 100% sin reducir cuotas." En modelo semanal puro la duración del curso vive en `Centro.fechaInicio/FinCurso` (Fase 7), editable por el admin — la auto-extensión del flujo viejo (`Grupo.fechaFin += extendBy`) era cuestionable porque chocaba con el calendario legal CCAA; ahora el sistema sugiere y el admin decide. También se devuelven `objetivoAnualPresencialMin` y `capacidadAnualSlotsMin` para que el frontend pueda razonar sobre déficit estructural (`objetivoAnual > capacidadAnual` ⇒ ningún reparto semanal lo arregla).
- Nuevo endpoint `GET /api/v1/grupos/{grupoId}/plantilla-cabida` en `HorarioSolverController.php` (idempotente, `ROLE_ADMIN|SUPERADMIN`).

**Frontend**:
- `handleConfigureOptimalCourse` reescrita (`HorariosEditor.jsx:3648-...`). Pipeline:
  - (1) `findPlantilla(plByGrupo[gid])`.
  - (2) GET `plantilla-cabida` → cuotas escaladas + `feasible`.
  - (3) **Calcular cuotas para el solver**: si `feasible`, usar `cuotaSugeridaMin` directamente; si `!feasible`, **reducir proporcionalmente** las presenciales por factor `f = jornada / Σ presenciales` (las no-presenciales no se tocan). Sin reducción, una jornada apretada haría que el solver no colocase nada (regresión grave del flujo viejo). Los shortfalls quedan visibles en el informe del solver. Avisamos en el confirm con un mensaje específico cuando hay reducción.
  - (4) Confirm con cuerpo distinto según huboReducción.
  - (5) `pendingTx.pliPatches` con `plKey: plantillaId` (id real, no tempId — `applyPendingTxForGrupo` ya lo soporta en líneas 1894-1916) y `minutosSemanales: c.cuotaSolverMin`.
  - (6) **POST `solver-iterativo-multi` en modo `rangoOverride`** con UN solo rango ficticio que representa la PLANTILLA + cuotas computadas in-memory. NO se usa la rama `periodoLectivoId` porque el solver interno calcula `semanasPlPre = (fechaFin - fechaInicio) / 7` (`HorarioSolverIterativo:311`), y la PLANTILLA no tiene fechas → `semanasPlPre = 0` → cap anual roto → solver no coloca nada. Pasamos fechas derivadas de `grupo.fechaInicio/fin` (o fallback a `semanasRefCentro` desde hoy) para que `semanasPlPre ≈ semanasRefCentro`. Esto es contrato existente del endpoint (igual que el viejo flujo de N rangos), no se inventa nada nuevo.
  - (7) Mapear placements desde `temp:<tempId>` al `state[gid_plantillaId]` REAL (id positivo). El solver respondió sobre el rangoOverride ficticio pero los placements son del horario de la PLANTILLA real — al guardar, `performBatchSaveAllDirty` POSTea horarios apuntando a `Horario.periodoLectivo = plantilla` real.
  - (8) Modal `SolverReport` si bottleneck o crossRangoShortfalls.
- **Deuda Fase C (solvers)** anotada: extender `HorarioSolverIterativo` para operar nativamente sobre PLANTILLA (sin fechas) usando `semanasReferenciaCentro` como referencia, eliminando el rangoOverride ficticio.
- Eliminada del handler toda la lógica de `plan-rangos`, `distribute-curriculum-dry-run`, extensión de `Grupo.fechaFin`, creación/borrado de PLs virtuales, loop de extendBy, y `distribuidorIssue`.
- Las claves i18n nuevas (`scheduleEditor.optimalNoPlantilla`, `optimalCabidaError`, `optimalCabidaNetwork`, `optimalCabidaInfeasible`, `optimalConfirmBodyPlantilla`, `solverNoMatch`) llevan `defaultValue` español, así que la UI funciona aunque no estén en los JSON × 5 idiomas todavía. Anotable: traducir cuando se cierre Fase B.

**Tests**: el proyecto no tiene infra PHPUnit (solo `bootstrap.php`). Se anotó como deuda — la validación se hará via smoke test desde la UI tras cache:clear.

**Pendientes Fase B**:
- ~~Reescribir `handleConfigureOptimalCourse`~~ ✅
- Eliminar `handleCreateRecommendedRangos` del menú (ya no tiene sentido en modelo semanal).
- Adaptar header del modal "Materias del rango" para mostrar "Materias del curso" cuando es PLANTILLA.
- UI dedicada para SEMANAs (botón "Crear semana excepcional" + flujo guiado).
- Revisar `runSolver` single-rango para garantizar compatibilidad PLANTILLA.
- i18n × 5 idiomas para las claves nuevas del flujo.

### 2026-05-06 (noche) — Fase A2+A3 ✅ + Fase B parcial

**Fase A2 (commit `a28d812`)**: migration `Version20260506180000` aplicada en BD dev. 8 SQL queries (3 DELETE + ALTER columns + 2 MODIFY fechas + 2 CREATE INDEX). Bug colateral: la migration `Version20260430120000` (calendario_escolar_ccaa, ajena al refactor) estaba como New porque la tabla la había creado otra sesión sin marcarla como ejecutada — se solucionó marcándola con `doctrine:migrations:version --add` y dejando que la mía corriese sola.

**Fase A3 (commit `a28d812`)**:
- `TipoPeriodoLectivo` enum (PLANTILLA | SEMANA).
- `PeriodoLectivo` entity con campos nuevos + `Assert\Callback` de coherencia + helpers `isPlantilla`/`isSemana`.
- `PeriodoLectivoCreateProcessor`: defaultea tipo + auto-PLIs solo en PLANTILLA.
- `PeriodoLectivoSoftDeleteProcessor`: cascade plantilla → semanas.
- `PeriodoLectivoResolver`: cascada SEMANA → PLANTILLA + `getPlantilla` + `getSemanas`.
- `HorarioRenderService` (nuevo): composición PLANTILLA + SEMANA al renderizar.
- `GrupoPlantillaSubscriber` (nuevo): postPersist auto-crea PLANTILLA del grupo.
- `SeedPlantillasCommand` (nuevo): `app:semanas:seed-plantillas [--with-plis]`.

Aplicado en BD: 4 PLANTILLAs + 33 PLIs sembrados. `schema:validate` solo señala drift cosmético en `notificacion` (defaults), ajeno al refactor.

**Fase B parcial (sin commitear todavía)**:
- Nuevo helper `frontend/src/utils/pl-utils.js` con 7 funciones puras.
- 12 cambios quirúrgicos en `HorariosEditor.jsx` (5 692 líneas — 90% sobrevive sin tocar).
- Bug fix TDZ: `semanasReferenciaCentro` movido arriba del archivo.
- Detalle por hot-spot en §12.
- Pendiente: reescribir "Configurar curso óptimo" + "Crear rangos recomendados" + UI dedicada SEMANA management. No bloqueante.

Próximo arranque (otra máquina o nueva sesión): leer §12 §"Cómo retomar desde otra máquina" + validar visualmente `/admin/horarios`.

### 2026-05-06 (tarde) — Cierre D-A a D-E con análisis del codebase

Tras leer `PeriodoLectivo.php`, `PeriodoLectivoImparticion.php`, `Horario.php`, `Grupo.php`, `PeriodoLectivoResolver.php`, `CalendarioLectivoService.php`. Resumen de decisiones cerradas en §11.

### 2026-05-06 — Doc creado, decisión cerrada, branch arrancado

Doc levantado tras discusión sobre alcance del intercambio puntual de imparticiones (mensaje del usuario "facilitaría todo este sistema, si el horario de un curso se tratase por semanas individuales en lugar de por rangos lectivos, verdad?"). Recomendación inicial era `HorarioOverride` por coste de refactor.

Counterfactual del usuario: "si hubiéramos arrancado así, ¿sería más sencillo?" Análisis honesto: sí, sustancialmente, no solo para intercambios sino para toda la familia de excepciones (sustituciones, ausencias, eventos, semanas atípicas). Análisis de rendimiento: despreciable a la escala del producto (queries indexadas son sub-ms; storage MBs no GBs; el único punto perceptible es el editor admin con mitigación trivial vía lazy load).

Decisión D-PRINCIPAL invertida: **modelo semanal puro**. El refactor desbloquea toda la familia de excepciones puntuales con primitivas naturales del modelo, sin acumular capas. Coste aceptado: ~5-6 sesiones.

Branch creado: `develop-semanas-lectivas` desde `develop@a4aef62`. Tareas A1-D listadas. Próximo paso: cerrar D-A a D-E con análisis del codebase real y arrancar migration.

---

## 11. Schema final — Fase A1 cerrada (2026-05-06 tarde)

### Cierres D-A a D-E con datos del codebase

#### D-A — Materialización de la "plantilla base"

**Decisión: discriminator dentro de `PeriodoLectivo` con enum `tipo`.**

```
PeriodoLectivo:
  tipo: TipoPeriodoLectivo enum (PLANTILLA | SEMANA)        NOT NULL
  fechaInicio: DATE                                          NULLABLE (NOT NULL solo si tipo=SEMANA)
  fechaFin:    DATE                                          NULLABLE (NOT NULL solo si tipo=SEMANA)
  semanaNumero: int                                          NULLABLE (NOT NULL solo si tipo=SEMANA, 1..N)
  plantillaBase: ManyToOne<PeriodoLectivo>                   NULLABLE (NOT NULL solo si tipo=SEMANA, FK self-ref)
  + campos existentes (grupo, jornadaTipo, nombre, orden, imparticiones[], traits)
```

Constraint a nivel de service/Assert (no DB check porque MariaDB 10.11 los ignora):
- `tipo=PLANTILLA` ⟹ `fechaInicio=NULL`, `fechaFin=NULL`, `semanaNumero=NULL`, `plantillaBase=NULL`.
- `tipo=SEMANA` ⟹ todos NOT NULL; `plantillaBase.grupo === this.grupo`; `plantillaBase.tipo=PLANTILLA`.
- Cada grupo tiene **exactamente una** PLANTILLA viva (deleted=false). Unique parcial.

Ventaja: una sola tabla, un solo entity. El render filtra por `tipo`. Migración no rompe FKs existentes (Horario.periodoLectivo sigue apuntando a PL, solo cambia su `tipo`).

#### D-B — Lazy on-demand vs eager

**Decisión: lazy on-demand.**

Solo se crean PLs `SEMANA` cuando hay override explícito (jornada distinta, PLI distinto, Horario distinto). Las semanas "limpias" delegan en la plantilla mediante el `HorarioRenderService`.

Volumen esperado: 1 PLANTILLA por grupo + 0..N SEMANA solo si hay overrides. En estado limpio (centro nuevo sin excepciones), volumen idéntico al actual con 1 PL "Curso completo".

#### D-C — `PeriodoLectivoImparticion` (PLI)

**Decisión: PLIs cuelgan tanto de PLANTILLA como de SEMANA. Las de SEMANA overridean.**

```
PLI sin cambios estructurales:
  - PLI(periodoLectivo=PLANTILLA, imparticion=X, minutosSemanales=Y)
    → cuota por defecto.
  - PLI(periodoLectivo=SEMANA_N, imparticion=X, minutosSemanales=Z)
    → override puntual para esa semana.
```

`HorarioRenderService::resolvePliFor(grupo, semana, imparticion)`:
1. Busca PLI(SEMANA, imparticion). Si existe → usar.
2. Si no, busca PLI(PLANTILLA, imparticion). Usar.
3. Si no, default `Materia.minutosSemanales` (mismo fallback que hoy en `getEffectiveMinutosSemanales`).

Unique constraint actual `(periodo_lectivo_id, imparticion_id)` se mantiene.

#### D-D — Source-of-truth duración del curso

**Decisión: `Centro.fechaInicioCurso` + `Centro.fechaFinCurso`** (campos existentes), enumerados vía `CalendarioLectivoService::semanasLectivas()` que ya descuenta festivos aplicables (NACIONAL/AUTONOMICO/PROVINCIAL/LOCAL).

Implicación: todos los grupos de un centro comparten ventana lectiva. Las SEMANA PLs se enumeran sobre los lunes del rango lectivo del centro.

`Grupo` NO gana campos nuevos para esto. El servicio `CalendarioLectivoService` queda como punto único de cálculo.

#### D-E — `Horario.periodoLectivo` NOT NULL

**Decisión: NOT NULL se mantiene.**

Cada Horario apunta a su PL "dueño":
- Caso normal (default del grupo): apunta a la PLANTILLA.
- Caso override puntual (intercambio, semana atípica): apunta a una SEMANA específica.

El `prePersist` que auto-rellena `Horario.periodoLectivo` (existente per Fase 2 PL) sigue funcionando: por defecto rellena con la PLANTILLA del grupo via `PeriodoLectivoResolver::getPlantilla(grupo)`.

### Migración (Fase A2) — wipe & rebuild (estamos en desarrollo)

**Decisión 2026-05-06 (tarde-2)**: la BD actual solo contiene fixtures y datos derivados de pruebas manuales, sin centros reales en producción. El usuario autoriza borrar Horarios/PLIs/PLs existentes y rearrancar limpio. Esto elimina la complejidad del backfill (preservar "mega-rangos SEMANA" temporales) y los riesgos de backward compatibility con NULLs en código viejo.

```sql
-- 1. Wipe del subgrafo PL (solo dev — sin centros reales en producción a 2026-05-06).
DELETE FROM horario;
DELETE FROM periodo_lectivo_imparticion;
DELETE FROM periodo_lectivo;

-- 2. Schema cambios.
ALTER TABLE periodo_lectivo
  ADD COLUMN tipo VARCHAR(16) NOT NULL AFTER orden,
  ADD COLUMN semana_numero INT NULL AFTER tipo,
  ADD COLUMN plantilla_base_id INT NULL AFTER semana_numero,
  ADD CONSTRAINT fk_pl_plantilla FOREIGN KEY (plantilla_base_id)
    REFERENCES periodo_lectivo(id) ON DELETE SET NULL;

ALTER TABLE periodo_lectivo MODIFY fecha_inicio DATE NULL;
ALTER TABLE periodo_lectivo MODIFY fecha_fin    DATE NULL;

-- 3. Índices nuevos.
CREATE INDEX idx_pl_grupo_tipo      ON periodo_lectivo(grupo_id, tipo);
CREATE INDEX idx_pl_plantilla_base  ON periodo_lectivo(plantilla_base_id);
```

`down()`: revertir es destructivo (perderíamos los nuevos PLANTILLA + sus PLIs/Horarios). Aceptable en dev — `down()` reescrito como un truncate completo + drop de columnas/índices.

### Tras la migration — re-seed manual

El estado limpio post-migration deja la BD sin PLs ni horarios. Para recuperar un grupo operativo:
1. Admin entra en `/admin/grupos` y crea grupo (o reusa existente).
2. El `PeriodoLectivoCreateProcessor` (existente) se modifica en Fase A3 para auto-crear una **PLANTILLA** en lugar del "Curso completo" actual.
3. Admin va a `/admin/horarios` y configura plantilla (Fase B reescrita) o usa "Configurar curso óptimo" (Fase C adaptada).

Para no quedarse sin datos durante el desarrollo del refactor: se puede crear un comando `app:semanas:seed-plantillas` que genere PLANTILLAs vacías para todos los grupos existentes con `jornadaTipo` heredado del itinerario, sin Horarios. Útil para que `/admin/horarios` no muestre "no hay PL" durante Fase B antes de tocar el solver.

### Migración futura para producción

Cuando el producto se acerque a producción real (centros reales con datos en BD), habrá que escribir una migration distinta que **preserve los datos**: 1 PLANTILLA por grupo (heredando del PL más antiguo) + materialización de los demás como SEMANA con sus fechas. Ese plan queda anotado aquí para cuando llegue, **no se implementa ahora**.

### Riesgos restantes post-wipe

Los riesgos #1, #2 y #4 del análisis previo (puntos del código que asumen "PL tiene fechas", mega-SEMANAs visuales, seeds que asumen 1 PL por grupo) **desaparecen o se reducen drásticamente** porque:
- Empezamos limpios → no hay PLs viejos sin tipo.
- No hay mega-SEMANAs porque no hay PLs heredados.
- Seeds se reescriben para crear PLANTILLA en vez de "Curso completo".

**Riesgo único restante**: ~30-40 puntos del código que leen `PL.fechaInicio` directamente. Tras la migration esos puntos recibirán NULL al consultar una PLANTILLA. Lista exhaustiva la cierra Fase A3 con grep dirigido sobre `fechaInicio`/`fechaFin` y los reemplaza por:
- `CalendarioLectivoService` cuando piden la ventana del curso del centro.
- `PeriodoLectivoResolver::resolvePara(grupo, fecha)` cuando piden el PL aplicable a una fecha (semana o plantilla).
- Filtro explícito `WHERE pl.tipo = 'SEMANA'` cuando piden eventos en rangos concretos.

---

## 12. Estado Fase B — HorariosEditor frontend (parcial 2026-05-06 noche)

### Helpers compartidos

Archivo nuevo: `frontend/src/utils/pl-utils.js`. Funciones puras reusables:

| Helper | Propósito |
|---|---|
| `isPlantilla(pl)` | true si `pl.tipo === 'plantilla'` o (legacy) sin tipo y sin fechas. |
| `isSemana(pl)` | true si `pl.tipo === 'semana'` o (legacy) tiene fechas. |
| `getSemanasOfPl(pl, fallbackSemanas)` | Duración en semanas. PLANTILLA → fallback (típicamente `semanasReferenciaCentro`). SEMANA → `(fechaFin-fechaInicio+1)/7`. |
| `sortPlsForUi(pls)` | PLANTILLA primero, luego SEMANAs por `fechaInicio` asc. |
| `selectActivePl(pls, fecha)` | Cascada SEMANA-que-cubre-fecha → PLANTILLA. |
| `findPlantilla(pls)` | La PLANTILLA del grupo o null. |
| `labelForPl(pl)` | Etiqueta legible para pills. |

### Hot-spots arreglados en `HorariosEditor.jsx`

12 cambios quirúrgicos sobre el editor de 5 692 líneas. La mayoría del código sobrevive sin tocar; solo se adaptan los puntos que asumían "PL tiene fechas":

| # | Sección | Cambio |
|---|---|---|
| 1 | imports | añadido `import { isPlantilla, ..., labelForPl } from '../utils/pl-utils'`. |
| 2 | `useEffect` carga inicial PLs (~L559) | usa `sortPlsForUi` + `selectActivePl` para selección por defecto. |
| 3 | `semanasReferenciaCentro` | **Movido arriba** del archivo (antes de `semanasByPlId`) para evitar TDZ. |
| 4 | `semanasByPlId` | usa `getSemanasOfPl(pl, semanasReferenciaCentro)`. |
| 5 | `pliModalSemanasRango` | idem. |
| 6 | `openCreatePlModal` | filtra a `existingSemanas` antes de buscar "el último rango". |
| 7 | `openEditPlModal` | bloquea PLANTILLA con toast informativo (la PLANTILLA se edita desde el modal Materias del rango / Sliders). |
| 8 | `handleDeletePl` | bloquea PLANTILLA con toast error + reemplaza fallback de re-selección por `selectActivePl`. |
| 9 | `handleSubmitPlForm` draft create | añade `tipo: 'semana'` + `plantillaBase: /api/periodo_lectivos/{plantillaId}` al draft. Sorts con `sortPlsForUi`. |
| 10 | `applyPendingTxForGrupo` POST | omite fechas para PLANTILLA, añade `tipo`/`plantillaBase`/`semanaNumero` al body. |
| 11 | `runSolverAllRangos` `totalSemanasGrupo` | cascada con `getSemanasOfPl`. |
| 12 | `handleConfigureOptimalCourse` `totalSemanasGrupo` | idem. |
| 13 | Render de pill (~L4329) | PLANTILLA muestra "Por defecto" en vez de fechas, oculta botón Borrar. |

**Bug fix relacionado**: TDZ en `semanasReferenciaCentro` (definida en L968 pero usada en L906 nuevo `semanasByPlId`). Se mueve la definición arriba.

### Lo que queda degradado en Fase B

| Pendiente | Severidad | Comentario |
|---|---|---|
| **"Configurar curso óptimo"** del menú "Acciones del curso" | Alto | Sigue creando SEMANAs equiespaciadas como antes creaba rangos. Funcionalmente válido (genera SEMANAs reales con fechas), pero la semántica conceptual no es la final del modelo semanal. Reescritura completa diferida. |
| **"Crear rangos recomendados"** del menú | Alto | Idem: genera SEMANAs como si fueran rangos. |
| **"Extender curso N días"** CTA | Medio | Degrada gracefully (no aparece porque PLANTILLA no tiene `fechaFin`, y `extendCourseSuggestion` retorna null). En el modelo final, la duración del curso vive en `Centro.fechaInicioCurso/FinCurso`, no en PLs. |
| **Modal "Materias del rango"** header | Bajo (cosmético) | Cuando se abre sobre PLANTILLA, sigue diciendo "Materias del rango" en lugar de "Materias del curso". |
| **`runSolver` single-rango** | Medio | No revisado; puede asumir que el PL tiene fechas. Probable no rompa con PLANTILLA pero sin garantía. |
| **UI dedicada de SEMANA management** | Alto (feature) | Hoy no hay UI clara para "crear una excepción para esta semana específica" — solo el modal genérico de crear PL. Habrá que añadir flujo: "Excepciones de la semana N" con botones contextuales. |

### Lo que SÍ funciona ya

- Carga de un grupo en `/admin/horarios` muestra la PLANTILLA como pill especial ("Por defecto").
- Banner anual de cobertura calcula correctamente con PLANTILLA (cuota × `semanasReferenciaCentro`).
- Modal "Materias del rango" abre sobre PLANTILLA y permite editar PLIs (cuota minutos/sem por imparticion).
- Solver iterativo multi-rango envía `totalSemanasGrupo` correcto.
- Drag-and-drop de placements sigue funcionando sobre la PLANTILLA.

### Próximos pasos al retomar Fase B

1. ~~**Validación visual** en `/admin/horarios`~~ ✅ (2026-05-06 sesión 2 — usuario reportó OK).
2. ~~**Reescribir `handleConfigureOptimalCourse`**~~ ✅ (2026-05-06 sesión 2 — modelo semanal puro: cabida + solver sobre PLANTILLA real, sin distribuidor cross-rango ni creación de PLs).
3. **Eliminar `handleCreateRecommendedRangos`** del menú: ya no tiene sentido en modelo semanal.
4. **Adaptar header del modal "Materias del rango"** para mostrar "Materias del curso" cuando se abre sobre PLANTILLA.
5. **Añadir UI dedicada para SEMANAs**: botón contextual "Crear semana excepcional" con flujo guiado (selección de fecha de semana + heredar plantilla + permitir overrides).
6. **Revisar `runSolver` single-rango** para asegurar compatibilidad PLANTILLA.
7. **i18n × 5 idiomas** para las claves nuevas del flujo "Configurar curso óptimo" modelo semanal (`scheduleEditor.optimalNoPlantilla`, `optimalCabidaError`, `optimalCabidaNetwork`, `optimalCabidaInfeasible`, `optimalConfirmBodyPlantilla`, `solverNoMatch`). Hoy funcionan vía `defaultValue` ES.
8. **UI dedicada para "excedente de jornada"** cuando la cuota escalada del currículo legal supera la jornada lectiva semanal del grupo. Hoy se reporta vía toast accionable. Reusar `SolverReport` para este caso produce textos confusos del viejo flujo distribuidor cross-rango ("el distribuidor ha repartido", "calendario propuesto") que ya no aplican. Una UI propia mostraría: tabla de cuotas (catálogo vs sugerida vs jornada disponible), resumen en horas/sem y horas/año, y CTAs claros (subir jornada en `/admin/jornadas`, marcar materias como AUTÓNOMA/FCT).
9. **Smoke test integración** del endpoint `GET /api/v1/grupos/{id}/plantilla-cabida` con los 4 grupos del centro EAG (cache:clear backend + recarga frontend + clic "Configurar curso óptimo"). Validado 2026-05-06 sesión 2 con 1 grupo (cabida no feasible: cuota escalada 1726 min/sem vs jornada 1650 min/sem). Falta validar el camino feasible con grupo de jornada amplia.

### Cómo retomar desde otra máquina

```bash
git fetch origin
git checkout develop-semanas-lectivas
git pull
docker compose up -d
docker compose exec backend php bin/console doctrine:migrations:status
# Si la migration Version20260506180000 aparece como New, aplicarla:
docker compose exec backend php bin/console doctrine:migrations:migrate --no-interaction
docker compose exec backend php bin/console app:semanas:seed-plantillas --with-plis
docker compose exec backend php bin/console cache:clear
```

Después abrir `https://localhost:8443/admin/horarios` y validar visualmente. El editor debe mostrar 1 pill "Plantilla del curso · Por defecto" por grupo.
