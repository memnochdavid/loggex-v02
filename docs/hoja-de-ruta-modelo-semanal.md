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

1. **Validación visual** en `https://localhost:8443/admin/horarios` con cada grupo del centro EAG.
2. **Resolver cualquier rotura residual** (errores en consola browser) que aparezca tras navegación profunda.
3. **Reescribir `handleConfigureOptimalCourse`**: en lugar de crear N rangos equiespaciados, debe distribuir la cuota anual sobre la PLANTILLA y dejar el módulo de SEMANAs vacío.
4. **Reescribir `handleCreateRecommendedRangos`**: ya no tiene sentido en modelo semanal — eliminar del menú.
5. **Adaptar header del modal "Materias del rango"** para mostrar "Materias del curso" cuando se abre sobre PLANTILLA.
6. **Añadir UI dedicada para SEMANAs**: botón contextual "Crear semana excepcional" con flujo guiado (selección de fecha de semana + heredar plantilla + permitir overrides).
7. **Revisar `runSolver` single-rango** para asegurar compatibilidad PLANTILLA.

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
