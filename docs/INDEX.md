# Índice de hojas de ruta — Loggex

> **Lee esto primero** en cualquier sesión que toque docs/ o que vaya a empezar / continuar trabajo planificado. Te da el estado real, los caminos críticos para llegar a producto comercial y la regla obligatoria de bitácora.

---

## 🚨 Primera acción al retomar la próxima sesión

**Calendario escolar Fases 1+2+3 ✅ Done (2026-04-27 noche)** — modelo `Provincia`/`AmbitoFestivo` + 17 nacionales y 118 autonómicos cargados desde PDFs oficiales BOE 2025-26 + UI Centros (selector Provincia cascada CCAA) y Festivos (columna Ámbito + filtro + badges themed). Doc dedicado: **`hoja-de-ruta-calendario-escolar.md`**.

**Fase 3 opción B (parcial) ✅ Done (2026-04-27 noche)** — datos LOMLOE oficiales del BOJA persistidos en MinIO + provider que los lee. PDFs auditables en `catalogo/ccaa/AN/source/`, extracto verificado en `catalogo/ccaa/AN/curated/horarios.json`. Banner rojo en EAG (LOMLOE = 32-33h vs jornada 27.5h) — feedback honesto: el centro adapta jornada al currículo, no al revés.

**Sub-fase O + CCAA Fase 3 (opción A) ✅ Done (2026-04-27 madrugada).** Caso EAG/DAW 2º validado E2E con datos hard-coded aproximados antes de pasar a B real.

**Próxima acción** — Fase 1-4 de PeriodoLectivo cerradas, **Fase 5 reestructurada y acordada (2026-04-28)**. Rutas posibles:

1. **Períodos Lectivos Fase 5 ⭐** (~1.75 sesiones) — modelo mental anual + extender curso + cierre parche temporal. **Es la ruta crítica acordada**: sub-fase A (input "horas anuales" en modal Materias del rango + ModuleChip lateral en horas anuales), sub-fase B (botón "Extender curso" en banner anual con modal de confirmación que ajusta `Grupo.fechaFin` + último PL — D-J), sub-fase C (CapacityPlanner relajado: rojo solo si físicamente imposible globalmente, amarillo informativo si solo desbordamiento semanal), sub-fase D (eliminar parche 35h en BD una vez A+B+C funcionan). D-J/D-K/D-L cerradas. Genérico para cualquier itinerario/grupo/centro.
2. **Períodos Lectivos Fase 7** (~1 sesión) — `Centro.fechaInicioCurso/FinCurso` + vacaciones intermedias. Parametriza D-L (las 36 semanas LOMLOE hardcoded de Fase 5 se sustituyen por cálculo desde calendario lectivo). Funde Fase 5 de `hoja-de-ruta-calendario-escolar.md`.
3. **Calendario Fase 4** (~1.5h) — entidad `Municipio` + UI festivos locales manuales. Cross-ref con la ruta 2.
4. **Asignar profesores** a las imparticiones autonómicas LOMLOE (Digitalización GS, Sostenibilidad, Proyecto Intermodular) en `/admin/imparticiones` para poder pulsar "Sugerir horario" en DAW LOMLOE.
5. **Períodos Lectivos Fase 8** (~2-3 sesiones) — tab "Consumición de horas anuales": dashboard con vista "ahora" + proyección anual con doble eje (rango vs evaluación). Cierra el ciclo de gestión visualmente para jefe de estudios.
6. **PDF multi-página por rango** (~0.5 sesión) — el botón "Exportar PDF" de `/admin/horarios` debe generar un documento con **una página por cada `PeriodoLectivo`** del grupo (rotulada con el nombre y fechas del rango), no un único horario plano. Hoy `HorarioPdfController::horarioGrupo()` carga `Horario[]` plano y el Twig `pdf/horario.html.twig` pinta una sola matriz. Cambios necesarios: (a) `loadHorariosForGrupo()` agrupar por `periodoLectivo_id`; (b) `buildScheduleContext()` devolver array `paginas` con un context por PL; (c) Twig iterar con `<div class="page" style="page-break-after: always">`. Solicitado por usuario sesión 2026-04-28, anotado pendiente en `docs/hoja-de-ruta-periodos-lectivos.md` §6.

Otras rutas más amplias:
- Ampliar `BojaAndHardcodedProvider` a DAW 1º + DAM 1º+2º AN (datos verificados contra BOJA — NO inventar).
- Fase 3 opción B completa: scraper PDF del BOJA.
- §14 sub-fases L/M/N (cosméticos del solver).
4. **Jornadas Fase B** (asistente automático de tramos).

**⚠ PARCHE TEMPORAL en BD:** dos jornadas "pre Calendario Real" creadas (`id 4` Mañanas + `id 5` Tardes en EAG, 35h/sem cada una) para acoger el currículo LOMLOE puro mientras no esté implementado el modelado de distribución temporal de materias (Proyecto Intermodular, FCT y Libre configuración no son "regulares semanales todo el año"). **Solución acordada (2026-04-28): `docs/hoja-de-ruta-periodos-lectivos.md`** — entidad `PeriodoLectivo` (rangos de fecha por grupo, cada uno con su `JornadaTipo` y sus minutos por imparticion), solver corre por rango, fecha-fin de curso flexible. Una vez implementado, las jornadas vuelven a ≈30h/sem (incluyendo recreos, ≈27.5h lectivas) y se borran las jornadas parche.

**Stepping stone listo (2026-04-28):** override de jornada por grupo (`Grupo.jornadaTipoOverride`) operativo en `/admin/horarios`. El admin ya puede elegir, desde el `infoBar` del editor, qué plantilla de jornada usa el solver/planner/rejilla para cada grupo, sin tocar el itinerario.

**Fase 1 PeriodoLectivo ✅ Done (2026-04-28 tarde):** modelo + migración. Entidades `PeriodoLectivo` (rangos por grupo con su `JornadaTipo` opcional + fechas) y `PeriodoLectivoImparticion` (entidad de unión con minutos por rango) creadas con full CRUD API Platform. `Horario.periodoLectivo` ahora NOT NULL. Migración `Version20260428180000` backfilla un rango único `"Curso completo"` por cada grupo existente (copiando el override de jornada como `PeriodoLectivo.jornadaTipo`) y vincula todos los horarios e imparticiones a él.

**Fase 2 PeriodoLectivo ✅ Done (2026-04-28 noche):** solver y `CapacityPlanner` cableados al rango. Servicio nuevo `PeriodoLectivoResolver` (rango activo: contiene `today()` o fallback al primero por `fechaInicio`). `HorarioSolver` y `CapacityPlanner` aceptan `?PeriodoLectivo` (default = activo) y leen imparticiones desde `PeriodoLectivoImparticion` con `getEffectiveMinutosSemanales`. `buildParallelBusy` filtra `Horario` por PL activo de cada grupo paralelo. Endpoints `/solver/{grupoId}` y `/capacity-check/{grupoId}` aceptan `periodoLectivoId` opcional (body POST / query GET). Listener `prePersist` auto-rellena `Horario.periodoLectivo` para que el frontend pre-Fase 3 siga POSTeando horarios sin cambios.

**Fase 3a PeriodoLectivo ✅ Done (2026-04-28 noche):** UI timeline + cableado completo. Strip horizontal en `/admin/horarios` con un pill por cada PL del grupo + botón "Añadir rango" con modal (nombre, fechas, jornada opcional). State Processor backend `PeriodoLectivoCreateProcessor` auto-crea PLIs por cada Imparticion del grupo. Estado del editor refactorizado a clave compuesta `${grupoId}_${plId}` para que cada PL conserve su propio set de placements/baseline en memoria. Cadena frontend de jornada efectiva alineada con backend (`PL > Grupo.override > Itinerario`). API calls (horarios, capacity-check, solver, batch save) cableadas al PL activo.

**Fase 3b PeriodoLectivo ✅ Done (2026-04-28 noche):** UI completa de CRUD inline para PLs + banner Σ horas anuales. Pills del strip ahora incluyen iconos Editar (Pencil) y Borrar (Trash2) en el activo: edición vía mismo modal que la creación con título/submit reactivos al modo (`plPickerMode = 'create'|'edit'`) y PATCH `application/merge-patch+json` para no nullificar campos no enviados; borrado con `useConfirm` (cuenta horarios persistidos cacheados para el confirm body), bloqueo si es el último PL del grupo y limpieza de cachés (`state`, `capacityByGrupo`) + auto-reselección al rango que contiene `today()`. Banner verde/amarillo/rojo bajo el strip comparando Σ currículo (Σ `materia.minutosSemanales` × 36 sem LOMLOE) vs Σ planificado (Σ por PL de `pli.effectiveMinutosSemanales × semanasDelRango`), con aviso D-C asimétrico (sobrar = verde "cumples con margen", faltar = rojo). Limitación conocida: el banner ignora festivos (cuadra cuando llegue Fase 7 calendario lectivo).

**Fase 4 PeriodoLectivo ✅ Done (2026-04-28 noche):** Modal "Materias del rango" abierto desde icono Sliders en pill activo. Tabla con todas las imparticiones del grupo (activas e inactivas en el rango), checkbox activar/desactivar, input minutosSemanales (override por rango) y botón reset al default heredado. Header con Σ planificado vs jornada del rango (verde/rojo). Backend: cambio de `Delete(SoftDeleteProcessor)` → hard-delete en `PeriodoLectivoImparticion` (necesario por unique `(periodoLectivo, imparticion)`: el soft-delete chocaba al revivir). Frontend: cache `pliByPl`, lock por fila `pliRowSaving`, refetch de PLs tras cada cambio (alimenta banner anual). 22 claves i18n nuevas en 5 idiomas.

**Fase 5 sub-A PeriodoLectivo ✅ Done (2026-04-28 noche):** Modelo mental anual en UI sin tocar BD ni solver. Modal "Materias del rango" pasa de input "Min/sem" → "Horas anuales (en este rango)" con conversión interna `minutosSemanales = round(horas × 60 / semanasRango)`. ModuleChip lateral muestra horas anuales colocadas (cross-rango) vs objetivo anual `materia.minutosSemanales × 36` (constante D-L hasta Fase 7). Validación drag y tap-mode usa cuota anual.

**Fase 5 sub-B PeriodoLectivo ✅ Done (2026-04-28 noche):** Botón "Extender el curso N días" en el banner anual cuando `tone='warn'|'error'` (faltan horas para currículo). Cálculo: `extraSemanas = ceil(faltanHoras / jornadaSemanaH)`, `extraDays = extraSemanas × 7` naturales. Click → modal de confirmación (D-J) con tabla diff (Grupo.fechaFin antes/después + último PL.fechaFin antes/después) + preview tonalizado del nuevo banner. Confirmar → PATCH `merge-patch+json` secuencial (PL primero, Grupo después) + refetch de PLs + update local de grupos + invalidate capacity-check. Modal "Nuevo rango" sensible al banner: warn/error → default `fechaFin = newLastPlFinISO` (cubre exactamente las horas faltantes); auto-extend `Grupo.fechaFin` tras crear si la sobrepasa. Bug fix: no adelantar `Grupo.fechaFin` si ya es posterior. Helper `fmtDateEs` para display dd/mm/yyyy. 16+1 claves i18n nuevas en 5 idiomas.

**Fase 5 sub-E PeriodoLectivo ✅ Done (2026-04-28 noche):** Auditoría y corrección de catálogo DAW LOMLOE Andalucía. Tras probar A/B/C con 1º DAW EAG, banner reportaba déficit físico 119h. Investigación: catálogo en BD tenía 3 errores (Sistemas informáticos 6h→5h, Lenguajes de marcas 4h→3h, Sostenibilidad mal asignada en 1º DAW + DAM, debía ser sólo 2º). Corregido vía UPDATE/DELETE en BD + nuevos overrides explícitos en `BojaAndHardcodedProvider` para 0483 y 0373 (DAW 1º + DAM 1º). Tras corrección: 1º DAW EAG suma 29h/sem según BOJA Resolución 26/06/2024; déficit baja a ~11h → cuadrable extendiendo 1 sem o subiendo jornada a 30h. **Sin parche temporal**. Deuda anotada: catalogo_materia.minutos_semanales sigue NULL para todo FP (BOE no extrae horasSemanales); auditar también DAW 2º + DAM 2º + otros itinerarios FP. **Siguiente**: sub-fase D (cleanup parche temporal en BD ahora viable).

**Fase 5 sub-C PeriodoLectivo ✅ Done (2026-04-28 noche):** CapacityPlanner banner relajado y anual-aware. Memo `capacityFeasibilityAnual` compara Σ currículo (`materia.minutosSemanales × 36`) contra Σ capacidad real (`jornadaSemanalMin × Σ semanas total grupo`). Branch del banner cuando `!cap.feasible`: si anual fits → **amarillo informativo** (`AlertTriangle`) "Sobrecarga semanal en este rango" + CTA redistribuir/crear rango; si anual NO fits → **rojo real** (`Ban`) "El currículo no cabe en el calendario actual" con cifras explícitas (currículo H vs capacidad H + déficit H) + CTA extender curso o subir jornada. Branch verde/amarillo de `cap.feasible` sin cambios. 4 claves i18n nuevas en 5 idiomas. Limitación: usa jornada del PL activo asumiéndola representativa (rangos con jornadas distintas dan cifra aproximada). **Siguiente**: sub-fase D (cleanup parche temporal en BD).

**⚠ DEUDA — Live updates CRUD para todas las vistas con persistencia:** Mercure está conectado pero **solo cubre la entidad `Mensaje`** (chat + notificaciones). Cualquier otra entidad CRUD (Itinerario, Grupo, Imparticion, Matricula, Festivo, Materia, Calificacion, Tarea, Entrega…) **requiere F5 manual** para reflejar cambios hechos por otros usuarios o por SQL directo (seeds). Detectada 2026-04-27 tras observación del usuario "pensaba que Mercure se ocupaba de mantener todo en tiempo real". Diseño propuesto: atributo PHP `#[LivePublish]` declarativo + subscriber Doctrine genérico + hook React `useLiveCollection`. Esfuerzo total cobertura completa: ~3 sesiones. Detalle en **`docs/hoja-de-ruta-redis-workers.md`** §"Deuda — Live updates CRUD para todas las vistas con persistencia".

**Mientras tanto, regla obligatoria al crear nuevas vistas CRUD**:
- Toda vista nueva que muestre datos persistidos debe asumir que requiere F5 hasta que llegue Mercure live. No prometer "tiempo real" en UX si no está cubierto.
- Tras `mysql -e 'INSERT/UPDATE...'` o seeds directos, los clientes conectados NO se enteran. Avisar al usuario que recargue.

**Bugs de datos detectados durante la sesión** (anotados en bitácora correspondiente):
- `materia.minutos_semanales` revertido a horas para algunas filas DAW 1º. Re-aplicado `UPDATE *60`.
- `Itinerario.catalogoOrigen` se nullificaba en cada PUT del modal porque la propiedad no estaba en `itinerario:write`. Bug histórico corregido (afectaba potencialmente a todas las ediciones de itinerario desde la UI, no solo a CCAA).

---

## ⚠️ REGLA OBLIGATORIA — dejar constancia de cada punto completado

**Cada tarea, sub-fase, decisión cerrada, fix relevante o cambio de alcance DEBE registrarse en la bitácora del doc correspondiente antes de cerrar la sesión.** Sin excepciones. Sin esto, los roadmaps mienten y la próxima sesión arranca con información obsoleta.

### Patrón mínimo para documentar un cierre

Al completar cualquier punto de un roadmap, **antes de pasar a otra cosa**, hacer las **3 actualizaciones** siguientes en su doc:

1. **Tabla de fases / sub-fases** (suele ser §9 o equivalente):
   - Marcar la fila como `✅ Done (YYYY-MM-DD)`.
   - Si la fase desbloquea otras, retirar el "bloqueada por X" de las dependientes.

2. **Snapshot del inicio del doc** (la sección `⚡ Snapshot para retomar` o `Status`):
   - Cambiar el estado en una línea.
   - Apuntar el siguiente punto a atacar.

3. **Bitácora al final del doc** (suele ser §13 o §N "Bitácora de implementación"):
   - Una entrada nueva con encabezado `### YYYY-MM-DD — [resumen]`.
   - Qué se cambió, dónde (rutas de archivos), por qué, y cualquier bug encontrado durante la implementación.
   - Si hubo decisiones nuevas no anticipadas, anotarlas como `D-nuevas` con su razón.

### Patrón para una decisión cerrada (D-X)

Cuando una decisión abierta se cierra (recomendación aceptada o ajustada):

- En la sección "Decisiones abiertas" del doc, mover la D al bloque "Decisiones cerradas" con el resultado y la razón.
- Si la decisión apareció a mitad de implementación (no estaba prevista), añadirla retroactivamente al doc para que la próxima sesión la encuentre.

### Patrón para un cambio de alcance

Si una tarea descubre que el alcance original era incorrecto (ej. "necesitamos minutos en vez de horas"):

- Reabrir o crear un punto explícito en el roadmap afectado.
- No silenciar el cambio: que quede claro que la fase original cambió y por qué.
- Cross-ref a otros docs si afecta varias hojas de ruta.

### Patrón para una fase ya completada que queda obsoleta

Si una hoja de ruta entera queda **superseded** por otra (ej. el viejo `editor-horarios.md` por `jornadas-recreos.md`):

- Marcar el doc obsoleto al inicio con un banner: `> **SUPERSEDED por [doc-nuevo.md] el YYYY-MM-DD.** Mantener para histórico.`
- Mover los pendientes vivos al doc nuevo si quedan.
- Apuntar el cierre en la bitácora del doc nuevo.

---

## 🗺️ Estado de las hojas de ruta (actualizado 2026-04-27)

Convención: 🟢 cerrado · 🟡 parcial · 🔴 sin empezar · 📋 ref/manual · 🪦 superseded

### 🟢 Cerradas / casi cerradas

| Doc | Estado | Pendiente residual |
|---|---|---|
| `hoja-de-ruta-rename-fp-neutral.md` | rename ejecutado en abril 2026 (commits `f341c32`, `8ff06fc`, `edcf4a0`...) | Cerrar bitácora del doc, marcar como done |
| `hoja-de-ruta-tutorial.md` | 3 fases implementadas en dev | Validar que el header sigue siendo cierto y archivar |
| `hoja-de-ruta-eso.md` | catálogo ESO LOMLOE cargado (1 itinerario + 28 materias) | Adaptaciones por CCAA → migradas al doc CCAA nuevo |

### 🟡 Parciales (con cola viva)

| Doc | Hecho | Pendiente |
|---|---|---|
| `hoja-de-ruta-jornadas-recreos.md` | Fases A, C, D, G, **E ampliada** (D24=A en minutos) | Fase B (asistente automático de tramos), Fase F (validador horarios afectados), Fase H (cache jornada en editor), **§14 sub-fases J-N** (minutosSemanales / capacity check / bloques largos / paralelismo refinado / round-up explícito) |
| `hoja-de-ruta-calendario-escolar.md` | **Fases 1+2+3** ✅ (modelo Provincia + Festivo.ambito + datos BOE 2025-26 cargados + UI Centros/Festivos) | Fase 4 (Municipio + UI locales), Fase 5 (calendario lectivo), Fase 6 (distribución temporal materias), Fase 7 (cron anual fetch BOE) |
| `hoja-de-ruta-calificaciones.md` | Aparentemente Fases A-D (existen `seed_calificaciones.sql`, vistas `CalificacionesAdmin/Detalle/Grupo.jsx`) | **Auditar y cerrar bitácora**; Fase E (boletines PDF) |
| `home-widgets-roadmap.md` | TablonWidget, NotificationList | Resto de widgets marcados 🔴 |
| `modernizacion-ui.md` | Manual vivo de modernización; varios plugins documentados | Sigue activo, registrar cada modernización nueva |

### 🔴 Atadas pero sin código

| Doc | Esfuerzo | Impacto comercial |
|---|---|---|
| `hoja-de-ruta-periodos-lectivos.md` | 8 fases (~7-8 sesiones) | **CRÍTICO**: resuelve el parche temporal de jornadas 35h → 30h, modela distribución temporal de materias (Proyecto Intermodular, FCT, Libre config), funde Fase 5 calendario, desbloquea merge `/admin/jornadas`+`/admin/horarios`. Cierra con tab dashboard de horas anuales (Fase 8). Acordado 2026-04-28. Stepping stone (override de jornada por grupo) ✅ Done. |
| `hoja-de-ruta-curriculum-ccaa.md` | Fases 1+2 ✅ Done; quedan 3-9 (~5-8 sesiones) | **CRÍTICO**: sin Fase 3 (BOJA Andalucía) el solver sigue sin cuadrar para centros reales |
| `hoja-de-ruta-redis-workers.md` | Mercure + workers tiempo real | Bajo: polling actual aguanta hasta cierto volumen |
| `hoja-de-ruta-mejoras-tecnicas.md` | Plan extenso (CI, tests, A11y) | Deuda técnica; no producto, pero importante para mantenibilidad |

### 📋 Referencia / manuales

| Doc | Naturaleza |
|---|---|
| `catalogo-oficial.md` | Arquitectura del catálogo + bitácora de §13 + secciones por etapa (FP, ESO) y §20 cross-ref CCAA |
| `informe-mejoras.md` | Auditoría inicial del proyecto |
| `async-select.md` | Manual del componente `AsyncSearchSelect` |
| `sistema-toasts.md` | Manual del sistema de toasts. **§12 refactor pendiente** (unificar sonner con estilo `.errorToast` saturado, registrado 2026-04-28) |

### 🪦 Superseded (candidatas)

| Doc | Reemplazado por | Acción |
|---|---|---|
| `hoja-de-ruta-editor-horarios.md` | `hoja-de-ruta-jornadas-recreos.md` (refactor de slots dinámicos en abr-2026) | Pendiente confirmar y marcar con banner |

---

## 🎯 Caminos críticos para producto comercial

> Orden recomendado para llegar a "Loggex se vende a un centro real sin parches manuales".

### Bloque 1 — Solver predecible para cualquier jornada *(✅ cerrado 2026-04-27)*

1. **§14 sub-fase O** ✅ — pre-asignación ILP (`CapacityPlanner` + banner verde/amarillo/rojo). Validado E2E con EAG/DAW 1º: factor 7× de mejora sobre el solver previo.
2. **§14 sub-fase K** — banner Σ minutos vs capacidad: cubierta por el banner de O.

### Bloque 2 — Catálogo correcto en cualquier CCAA *(✅ MVP cerrado 2026-04-27)*

3. **CCAA Fase 3 opción A** ✅ — `BojaAndHardcodedProvider` con DAW 2º AN. Validado E2E (banner verde 27.5h exactos).
4. **CCAA Fase 3 opción B (objetivo final)** ⏳ — `BojaAndScraperProvider` parser PDF real. Arquitectura ya preparada.
5. **Ampliar provider** a DAW 1º + DAM 1º + DAM 2º AN ⏳ — datos verificados manualmente.
6. **CCAA Fase 4** ⏳ — filtros CCAA en `/admin/catalogo/*` + banner provenance ampliado.

### Bloque 3 — Solver y editor pulidos *(medio)*

5. **§14 sub-fase L** — heurística bloques largos.
6. **§14 sub-fase M** — paralelismo refinado por solape de rangos.
7. **§14 sub-fase N** — round-up D22=A explícito en chip (asterisco + tooltip).
8. **Jornadas Fase B** — asistente automático de tramos (genera la jornada a partir de Σ horas materias).

Estimación: ~2 sesiones. Docs: `hoja-de-ruta-jornadas-recreos.md` (§14 + Fase B).

### Bloque 4 — Cierre del ciclo evaluativo *(alto)*

9. **Calificaciones — Auditar A-D** y cerrar bitácora.
10. **Calificaciones Fase E** — boletines de notas en PDF.

Estimación: ~1.5 sesiones. Doc: `hoja-de-ruta-calificaciones.md`.

### Bloque 5 — Resto de CCAAs *(medio, incremental)*

11. CCAA Fase 6 — adapters demográficos: CT, MD, VC, PV, GA (1 sesión por CCAA).
12. CCAA Fase 7 — resto de CCAAs por demanda.

### Bloque 6 — Diferibles *(bajo)*

- `hoja-de-ruta-redis-workers.md` — solo si volúmenes lo justifican.
- `hoja-de-ruta-mejoras-tecnicas.md` — deuda técnica progresiva.
- `home-widgets-roadmap.md` — UX, no funcionalidad core.

---

## 🔄 Cómo retomar trabajo en una sesión nueva

1. **Leer este `INDEX.md`** completo (es corto).
2. Identificar en qué bloque/fase estás según el camino crítico.
3. Abrir el doc concreto y leer su **`⚡ Snapshot para retomar`** (siempre al inicio).
4. Leer la **última entrada de bitácora** del doc para entender qué se hizo en la última sesión.
5. Atacar la siguiente sub-fase. **Aplicar la regla obligatoria de bitácora al cerrar**.

---

## 📐 Relaciones entre docs

```
            ┌─────────────────────┐
            │ catalogo-oficial.md │  fuente de verdad nacional
            │  (BOE, ESO LOMLOE)  │
            └──────────┬──────────┘
                       │ §20 cross-ref
                       ▼
   ┌─────────────────────────────────────┐
   │ hoja-de-ruta-curriculum-ccaa.md     │  capa overlay por CCAA
   │  (Andalucía piloto, resto diferido) │
   └────────┬─────────────────┬──────────┘
            │ Fase 2 = §14 J  │ Fase 5 = §14 K
            ▼                 ▼
   ┌─────────────────────────────────────┐
   │ hoja-de-ruta-jornadas-recreos.md    │  solver + editor de horarios
   │  (Fases A,C,D,G,E ✅ + B,F,H + §14) │
   └─────────────────────────────────────┘

   ┌─────────────────────────────────────┐
   │ hoja-de-ruta-calificaciones.md      │  ciclo evaluativo, boletines
   │  (A-D probable ✅, E pendiente)     │
   └─────────────────────────────────────┘
```

`rename-fp-neutral.md`, `tutorial.md` y `editor-horarios.md` son históricos que ya no condicionan ninguna ruta nueva. `redis-workers.md`, `mejoras-tecnicas.md` y `home-widgets-roadmap.md` son ortogonales al producto core.

---

## 📌 Convenciones de los docs (resumen)

- Todo `hoja-de-ruta-*.md` empieza con un **`⚡ Snapshot para retomar`** y termina con **`Bitácora de implementación`**. Si encuentras uno que no, normalízalo cuando lo toques.
- Las decisiones se enumeran como **D1, D2, ...** y viven en una tabla. Las cerradas con resolución; las abiertas con recomendación.
- Las fases se enumeran con letras (**A, B, C, ...** dentro de un doc; minúsculas o mayúsculas según convención del doc).
- Las sub-fases del solver hardening usan letras altas (**J, K, L, M, N**) para no chocar con las fases originales A-H del doc de jornadas.
- Las CCAAs usan códigos ISO 3166-2:ES (AN, CT, MD, VC, PV, GA, ...). Lista completa en `hoja-de-ruta-curriculum-ccaa.md` §3.1.
- Las migraciones Doctrine son `Version2026XXXX_descripcion`.
- Los seeds SQL viven en `scripts/seed_*.sql` y son idempotentes (DELETE previo).
