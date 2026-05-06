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

### Estado actual del refactor

🟡 Fase A1 (diseño schema) en curso.

Plan de fases en §10. Bitácora de progreso en §9.

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
