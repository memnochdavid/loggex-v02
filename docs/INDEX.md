# Índice de hojas de ruta — Loggex

> **Lee esto primero** en cualquier sesión que toque docs/ o que vaya a empezar / continuar trabajo planificado. Te da el estado real, los caminos críticos para llegar a producto comercial y la regla obligatoria de bitácora.

---

## 🚨 REFACTOR EN MARCHA — Fases B+C+D cerradas (2026-05-06 noche)

**🏗️ Modelo semanal puro (PL = semana lectiva)** — Doc: **`hoja-de-ruta-modelo-semanal.md`** · Branch: **`develop-semanas-lectivas`**.

D-PRINCIPAL cerrada con resultado **MODELO SEMANAL PURO** tras counterfactual del usuario y análisis de rendimiento despreciable a escala del producto. El modelo semanal expresa naturalmente toda la familia de excepciones puntuales (intercambios, sustituciones, ausencias, eventos especiales, semanas atípicas) sin acumular capas de override.

### Estado de fases (2026-05-06 noche)

| Fase | Estado | Detalle |
|---|---|---|
| **A1** Diseño schema | ✅ Done (commit `059890c`) | D-A a D-E cerradas con análisis del codebase. PL.tipo discriminator + plantillaBase FK self-ref + lazy on-demand. |
| **A2** Migration | ✅ Done (commit `a28d812`) | `Version20260506180000`: wipe Horarios/PLIs/PLs + ALTER columns + 2 índices nuevos. Aplicada en BD dev. |
| **A3** Entity + service + processors | ✅ Done (commit `a28d812`) | `TipoPeriodoLectivo` enum, `PeriodoLectivo` con asserts, resolver, `HorarioRenderService` (nuevo), `GrupoPlantillaSubscriber` (auto-crea PLANTILLA postPersist), `app:semanas:seed-plantillas`. 4 PLANTILLAs + 33 PLIs sembrados en BD dev. |
| **B** Frontend HorariosEditor | ✅ **Done (2026-05-06 sesiones 2-4, commits `5624582`/`b2785c6`/`d370257`/`9befa14`/`25df9b6`/`e4e10df`)** | `handleConfigureOptimalCourse` reescrita con distribución temporal heterogénea por SEMANAs (PLANTILLA default + N SEMANAs con cuotas heterogéneas vía `CurriculumDistributor`). Backend nuevo: `PlantillaCabidaValidator` + endpoint `GET /grupos/{id}/plantilla-cabida`. Bugs colaterales arreglados: state stale al duplicar PLANTILLAs, PLIs huérfanos en SEMANAs, `TimeTable.jsx` (caja roja con guion + altura proporcional), rejilla mostraba mañana en grupos con override de tarde, PLANTILLA con jornadaTipo asignada pisa al override del grupo (forzado NULL en processor), fallback inflador `min × 36 / 60` en `MaterializationController`/`GrupoResyncCcaaController` eliminado. Validado con 1º DAW + 1º DAM EAG: cubre currículo legal en calendario real (15-sep → 22-jun) con jornada 27.5h sin extender a julio. |
| **C** Solvers | ✅ **Done (2026-05-06 sesión 6, commit `4a0d716`)** | Nuevo `PeriodoLectivoResolver::calcularSemanas(pl)` como punto único: SEMANA → `(fechaFin-fechaInicio+1)/7`, PLANTILLA → `semanasReferenciaCentro` via `CalendarioLectivoService`. `CapacityPlanner` y `HorarioSolverIterativo::solveMultiRango` delegan en el resolver. `HorarioSolverBinPacking` ya era seguro con PLANTILLA (no usa fechas). El endpoint `solver-iterativo-multi` con `{periodoLectivoId: plantilla.id}` ahora computa correctamente sin que el caller invente fechas. Deuda residual anotada: el frontend del flow "Configurar curso óptimo" sigue generando SEMANAs siempre (incluso para casos simples) — mejora opcional pendiente. |
| **D** Vistas dependientes | ✅ **Done (2026-05-06 sesión 5, commits `ede5361`/`2597a0a`/`c4b1297`)** | (#2) `/horario/me` aplica cascada SEMANA→PLANTILLA por fecha visible (no duplicados). (#1) PDF horario personal acepta `?fecha`, resuelve PL aplicable via `PeriodoLectivoResolver` y filtra placements; el frontend pasa `selectedDate` del CalendarView de la página y nombra el PDF con la fecha. (#3) Tab Consumición filtra solo SEMANAs (PLANTILLA no aporta días lectivos transcurridos; antes crasheaba con NULL fechas). (#4) Banner anual cobertura ya respetaba modelo semanal por construcción (validado sesión 4). |

**Cómo retomar desde otra máquina**: ver §12 "Cómo retomar desde otra máquina" en `hoja-de-ruta-modelo-semanal.md`. Resumen: `git checkout develop-semanas-lectivas && git pull && docker compose up -d`. La migration `Version20260506180000` se aplica con `doctrine:migrations:migrate --no-interaction` y luego `app:semanas:seed-plantillas --with-plis` para tener PLANTILLAs por grupo. Bitácora completa de Fase B en §9 sesiones 2-4 del doc.

**Bloquea durante el refactor**: features que toquen `PeriodoLectivo`/`Horario`/`HorariosEditor` en `develop`. Otras features paralelas (notificaciones validación visual, calificaciones B.1, catálogo) pueden seguir en `develop`.

**Desbloquea al terminar**: `hoja-de-ruta-intercambio-imparticiones.md` ✅ creado 2026-05-07 — listo para arrancar Fase A tras cerrar D-A (granularidad temporal de la excepción). El viejo `hoja-de-ruta-cambio-turno.md` se mantiene vivo como **complementario** (cambio permanente de turno del profe), no superseded.

---

## 🚨 PRÓXIMA SESIÓN — MÁXIMA PRIORIDAD (2026-05-05)

**🔥 Sistema de notificaciones del sistema (campanita + propagación a afectados)** — Doc: **`hoja-de-ruta-notificaciones.md`**.

**Estado actualizado 2026-05-05**:

1. ✅ **Fase 1 backend implementada** (commit pendiente): entidad `Notificacion` + repo + migración `Version20260505120000` + `NotificationDispatcher` con 4 métodos `notify*()` + `NotificationDispatchSubscriber` (postPersist + postFlush con guard de re-entrancy) + endpoint custom `POST /api/notificaciones/marcar-todas-leidas` + filtro en `CurrentUserExtension` + topic Mercure `/users/{id}/notifications` (ya en el JWT).
   - **Pendiente para activar end-to-end**: correr migración + cache:clear + smoke tests (detalle en §Bitácora 2026-05-05 del doc).
2. ✅ **Fase 2 frontend** (2026-05-05): refactor del header con DOS botones (Mensajes con icono `Mail`, Notificaciones con icono `Bell`), nuevo `<SystemNotificationsList>` que reusa el CSS module de mensajes para densidad/hover/foco idénticos pero pinta notificaciones del sistema (icono por tipo Lucide, dot de no-leída, footer "Marcar todas como leídas"). Filtra eventos Mercure por `entity === 'Notificacion'` para coexistir con mensajes en el mismo topic. Optimistic update al marcar leída + refetch via Mercure. HMR sin errores. **Pendiente solo validación visual con datos reales en navegador**.
3. ✅ **Fase 3 catálogo + i18n** (2026-05-05): catálogo cerrado + dispatcher + i18n × 5 idiomas (`notifications.types.{tipo}.{title|body}` + UI strings: empty/markAllRead/viewAll/relative time). `header.messages` añadido para el botón renombrado en Fase 2. Iconos por tipo se cablean al crear `<NotificationsList>` (Fase 2).

**Regla de oro**: un mensaje NO genera notificación adicional (evita contadores duplicados).

**Por qué primera**: el bucle de feedback hoy está roto — el alumno no se entera de que su examen ha sido corregido salvo que entre activamente; el profe no ve si llega una entrega nueva. Es bloqueante para "Loggex se vende a un centro real sin que los usuarios se sientan ciegos".

**Otros ítems abiertos en paralelo (menor prioridad):**

- ✅ ~~**Breadcrumbs en cabeceras**~~ Cerrado 2026-05-05 noche (R2.1): componente `Breadcrumbs.jsx` reusable + barrido completo de 27 vistas con `CrudHeader` + wrappers `/fechas` y `/admin/horarios` con tabs embedded. **Ronda 2 cerrada al 100%**.
- ✅ ~~**Bug de seguridad `/centros`**~~ Cerrado 2026-05-05 noche: las 5 operaciones API Platform (`Get`, `GetCollection`, `Post`, `Put`, `Delete`) llevan ahora `security: "is_granted('ROLE_SUPERADMIN')"`. Defensa en profundidad completa.
- ✅ ~~**Bug latente filtro PL en `/horarios`**~~ Cerrado 2026-05-05 noche: `Horarios.jsx` filtra `mySchedule` por `selectedDate ∈ [periodoLectivoFechaInicio, periodoLectivoFechaFin]` antes de pasar al `TimeTable`. Sin solapes al navegar entre semanas.

---

## 📐 Reglas transversales (aplican a TODA sesión)

Estas reglas son **innegociables** y aplican a cualquier ítem que se ataque, esté en la ruta crítica o no. Si un ítem nuevo entra en conflicto con alguna, es la regla la que gana.

### 🎨 Tematización obligatoria — NO hardcodear estilos

**Todo elemento UI debe responder al tema activo del centro en cada momento.** El usuario configura ~80+ variables CSS desde `Configuracion.jsx` que se inyectan en `:root` vía `frontend/src/utils/theme.js`. Hardcodear estilos rompe la promesa central del producto.

- ❌ Colores hex/rgb/hsl literales para fondos, bordes, textos, sombras, gradientes.
- ❌ Fallbacks hex en `var(--color-X, #XXXXXX)` — las variables están siempre definidas, los fallbacks son código muerto que oculta dependencias rotas.
- ❌ Radios, sombras, blur, opacidades fijos en componentes que el usuario tematiza.
- ✅ Variables del tema: `var(--bg-card)`, `var(--color-primary-500)`, `var(--text-muted)`, etc.
- ✅ Semánticos: `--color-success/warning/error/danger/info`.
- ✅ Motion tokens (`--dur-*`, `--ease-*`) — son ortogonales al tema.

**Esto aplica también a componentes nuevos.** Antes de añadir UI nueva (botón campanita, dropdown de notificaciones, breadcrumbs, lo que sea): comprobar que todo color/borde/radio/sombra sale de variables del tema.

Doc completo: `CLAUDE.md` §"REGLA DE ORO" + `docs/modernizacion-ui.md` §"REGLA DE ORO".

### 📋 Bitácora obligatoria al cerrar punto

Ver §"REGLA OBLIGATORIA" más abajo. Cada punto cerrado deja constancia en su doc antes de cerrar la sesión.

### 🔒 Confirmar antes de commit/push

Confirmación explícita por operación. No commit/push automático tras cerrar trabajo.

---

## 🚨 Primera acción al retomar la próxima sesión

**🟢 CERRADA 2026-05-03 — Fase 8 PeriodoLectivo: dashboard "Consumición de horas anuales" en `/admin/horarios`.** Tres sesiones cerradas el mismo día: (1) backend `ConsumicionAnualService` + endpoint + tab + tabla básica (commit `e068bfb`), (2) doble eje rangos↔evaluaciones + tonalidad + filas plegables + banner del grupo (commit `b1143ad`), (3) vista "Proyección" con `recharts` (3 series: currículo lineal, planificado acumulado, impartido teórico) + ReferenceLine en "hoy" + panel sugerencias para materias en déficit + persistencia en `sessionStorage`. `recharts ^3.8.1` añadido a `frontend/package.json`. Bundle frontend de 3293 → 3784 kB minified (+484 kB por la lib; mitigable con dynamic import si empieza a doler). Doc completo en `hoja-de-ruta-periodos-lectivos.md` Status + §3 Fase 8 + bitácora §6 (3 entradas 2026-05-03). Mejoras futuras (no bloqueantes): cambiar a `Asistencia` real cuando la BD esté poblada; retirar `app:fase8:consumicion` cuando deje de ser útil; proyección por evaluaciones si llega demanda.

---

**🗒️ Cierre 2026-05-02 — Sesión polish + Fase F calificaciones ✅ Done.** Bloque cerrado en una sola sesión con commits seguidos `bd8aaed` → `5701301` → `3e2b201` → `e017938`:

1. **Fix `parseHmsToMin` robusto a ISO** (commit `bd8aaed`) — bug del backlog `cosa`: en `/admin/horarios` panel Materias, chips y badge "Completo · X/Yh" solo contaban horas del rango activo; había que pasar por todos los PLs uno a uno para que se fuera sumando. Causa: API Platform serializa `Horario.horaInicio` (TIME_MUTABLE) como ISO `"1970-01-01T08:30:00+00:00"` y `parseHmsToMin` hacía `split(':')` ingenuo → `parseInt("1970-01-01T08") = 1970` → `dur = 0` para cualquier item leído crudo del API. Solo pasaban OK los items que iban por `normHora` previo (state local del PL activo, tramosOrdenados); los del fallback `persistedByPl` daban 0 → no sumaban al chip cross-rango. Fix: 1 sola función reescrita con regex `(\d{1,2}):(\d{2})`. Beneficio colateral: `placedAnualOtrosRangos` que se manda al solver como `alreadyPlacedByImp` ahora vale los minutos reales (antes 0) → menos overshoot inicial → menos trabajo para `redistribuirCrossRango`. Solver sin regresiones, validado E2E con DAW grupo 1. Bitácora: `hoja-de-ruta-solver-iterativo.md` 2026-05-02.

2. **Limpieza backlog `cosa`** (commit `5701301`) — 11 items ya cerrados en INDEX pero con el flag suelto en el archivo: tachados L13 (subtítulos), L15 (columna grupo), L17 (justify-content end), L19 (sidebar scroll), L24 (timetable tarde), L34 (select calificaciones server-side), L36-38 (mis-temarios), L40 (toasts ponderaciones), L47 (UX rango obligatorio), L48 (acciones del curso sin Guardar). El `cosa` queda solo con vivos: L1-3 (Fase 8), L7, L9 (Fase 6), L22, L29 (cambio turno), L39, L42, L53.

3. **L39 cards `/companeros` + L42 widget "Por corregir"** (commit `3e2b201`) — `/companeros` cards de alumnos no mostraban curso: backend `GetCompanerosController` ahora devuelve `grupos` como objetos `{id, curso, nombre, abreviatura}` (antes strings sueltos del nombre); `UserCard` usa `formatGrupoNombre`; `Companeros.jsx` flujo SuperAdmin enriquece con grupo seleccionado para consistencia. Widget "Por corregir" del home mostraba "+600" a sara (admin+profe) porque `?calificacion=null` no estaba registrado como filtro y se ignoraba: el endpoint devolvía las 614 entregas totales del centro vía `CurrentUserExtension`. Fix: `Entrega.php` añade `ExistsFilter` sobre `calificacion` (permite `?exists[calificacion]=false`) + SearchFilter `tarea.imparticion.profesor`; `useHomeStats.js` reduce `isProfesor` a `ROLE_PROFESOR` estricto (antes incluía admin/superadmin) y filtra server-side por `tarea.imparticion.profesor=user.id`. Sara: 81 entregas en sus imparticiones, todas calificadas → widget muestra 0 (cifra real). Tras borrar 1 calificación → widget pasa a 1.

4. **Fase F calificaciones — Cierre manual de tareas vencidas con 0 auto** (commit `e017938`) — petición del usuario tras entender que el "+600" anterior era mentiroso y la BD no tiene NINGUNA entrega sin calificar (los alumnos con tareas "no entregadas" significaban tareas sin entrega del alumno, no entregas pendientes de calificar). Decisión: cuando una tarea vence sin entrega, calificarla a 0 automáticamente para que las medias reflejen la realidad pedagógica. Implementación: opción **C (botón manual)** elegida sobre A1 (cron) — cero dependencias nuevas. `Service/CierreTareasVencidasService` (idempotente, crea Entrega sintética + Calificacion(0), sin tocar modelo) + `Command app:tareas:cerrar-vencidas [--imparticion=ID] [--dry-run]` (listo para Symfony Scheduler futuro) + `POST /api/v1/tareas/cerrar-vencidas` (permisos por rol: profe→propias, admin→centro, super→todas, sin imparticionId solo super). Botón en `CalificacionesGrupo.jsx` con dry-run preview en confirm modal → ejecución → toast → refresca medias. i18n × 5 (8 claves). Bug fix incluido: `useConfirm()` solo estaba en componente interno `ItemsWeightEditor`, el principal `CalificacionesGrupo` caía en `window.confirm()` global → mostraba `[object Object]`. Validado E2E sara@eag.com (PROFESOR+ADMIN, centro 3): comando dry-run global 145 tareas/111 alumnos; endpoint imp 37 → 5/3 alumnos. Bitácora: `hoja-de-ruta-calificaciones.md` 2026-05-02 Fase F.

**Deuda residual de Fase F cerrada el mismo día** (commit pendiente): auditoría reveló que `UploadEntregaController.php:57-61` ya bloqueaba el flujo natural del alumno (`POST /api/entregas/upload`). Lo que faltaba era cubrir POST/PUT directos al recurso API Platform `/api/entregas` (que solo profe/admin pueden hacer). Añadido `Assert\Callback validateDentroDePlazo` en `Entrega.php`: viola con `propertyPath=tarea` cuando `fechaLimite < now`, devuelve 422. El cierre auto sigue funcionando porque persiste vía EntityManager directo (validators Symfony NO se ejecutan en ese flujo). Validado E2E: POST tarea vencida 422, POST tarea futura 201, dry-run del cierre OK. Sin unique constraint en BD (verificado: 0 duplicados; chocaría con soft-delete; confiamos en la lógica de aplicación). Bug encontrado: opcache PHP-FPM requiere `docker compose restart backend` tras añadir validator nuevo (no basta `cache:clear`).

---

**🗒️ Cierre 2026-05-01 noche — Solver iterativo + bloques contiguos + jornadas 30min + rejillas reescritas ✅ Done.** Sesión maratón con cambios estructurales en solver, BD, rejillas y vistas. Trabajo agrupado por bloques temáticos:

1. **Solver iterativo (Fases 1–5 + redistribución cross-rango real)** — `HorarioSolverIterativo` con bucle outer que mueve cuota in-memory entre rangos hasta cuadrar todos los targets anuales o probar imposibilidad heurística. `BottleneckClassifier` + `CorrectiveActionExecutor` (3 acciones). Endpoints `/solver-iterativo/{gid}` y `/solver-iterativo-multi/{gid}`. Modal "Informe del solver" con bottleneck/sugerencias/log de pasadas. Validado E2E con 1º DAW EAG: imp 38 al 0% inicial → 125% tras 1 movimiento outer.
2. **Solver de BLOQUES CONTIGUOS** — `HorarioSolverBinPacking` reescrito a bloques 60-120min sobre granularidad 30min, máx 120/día/materia. `buildTramosContiguos(jornada)` agrupa SLOTs entre recreos; `elegirMejorBloque` busca candidato por día respetando profe libre + cap diario. 1 placement = 1 bloque (no 1/slot).
3. **BD: jornadas a 30min** — `backend/scripts/migrate_tramos_30min.sql` reescribe FP Mañanas (id=3) y FP Tardes (id=6) a 11/12 slots de 30min + recreos preservando totales 5.5h/6h/día. Permite que el solver de bloques componga combos exactos para targets indivisibles antes (1.5h, 0.5h sueltas).
4. **`PeriodoLectivoSoftDeleteProcessor`** — cascadea soft-delete a `Horario` + `PeriodoLectivoImparticion`. Sin esto, "Configurar curso óptimo" dejaba horarios huérfanos vivos apuntando a PL `deleted` → `EntityNotFoundException` 500 en `/api/my-schedule`.
5. **Rejillas reescritas para mostrar bloques con rowspan**:
   - `/admin/horarios`: refactor a UN único CSS Grid global. Celdas día con `gridRow: span N`; continuación retorna null. `infoBar` con `grid-column: 1/-1`. Bordes separadores explícitos.
   - `/horarios` (TimeTable): time labels agrupadas por **tramo contiguo** ("8:30-10:30"). Recreos como banda diagonal saltando columnas con festivo. min-height celdas 45→22px.
   - PDFs (`HorarioPdfController` + `pdf/horario.html.twig`): matriz con rowSpan/skip. `<td rowspan="N">`, ocultar filas all-skip.
6. **GetMyScheduleController limpiado** — quitada fuente (3) "slots derivados de horarios" que mezclaba slots atómicos con bloques. Endpoint incluye recreos (campo `tipo`). **OJO**: cachea response 5min vía `CacheInterface`; cualquier cambio aquí requiere `cache:pool:clear cache.app`.
7. **Helper `getPlacementDur(p)`** — `horaFin - horaInicio` (no `slotMinutosByHi[hi]` que daba 30min para bloques). Sustituido en 5 cálculos: `minutosColocados`, `minutosAnualesColocadosByImp`, `colocadosMinutos`, `profeCarga`, `placedAnualOtrosRangos`.
8. **Banner anual lee pendingTx** para PLs virtuales (id<0) — antes mostraba "Planificado: 0h" y proponía "Extender curso 245 días".
9. **PLs manuales / recomendados heredan jornada** del grupo + inicializan `state[gid_tempId]` vacío para que `grupoState` sea truthy y la rejilla aparezca.

**Bugs corregidos (lista de cosas a no repetir)**: `SLOT_REDUCTION_MIN` no existía en HorarioSolverIterativo; `const t` shadow del t() i18n en IIFE; `optimalMultiJson` fuera de scope; modal "Acciones del curso" transparente y generaba scroll; falsos positivos en modal de informe (unplaced residual cubierto anualmente); sección distribuidor histórica tras redistribución resuelta; `onClick={runSolverAllRangos}` directo (event como plsOverride); duplicate `subtitle` en `Configuracion.jsx` + `CalificacionesGrupo.jsx` que rompía el build.

Bitácora completa: `hoja-de-ruta-solver-iterativo.md` (5 entradas seguidas del 2026-05-01).

**Pendiente futuro residual** (no bloqueante): refinar heurística `redistribuirCrossRango` con anti-loop (no repetir donor/receptor sin avance) y rollback si receptor no aumenta placed.

---

**🗒️ Cierre 2026-05-01 mañana — Tanda B parte 3 ✅ Done.** Cerradas las 3 cosas que aún tocaban BD inmediatamente, cerrando del todo el refactor "nada persiste hasta Guardar" en `/admin/horarios`:

1. **Modal "Materias del rango" (Sliders)** — reemplazadas `activatePli/deactivatePli/updatePliMinutos` por `togglePliInTx` (push a nueva estructura `tx.pliToggles: [{plKey, imparticionId, action}]`) y `setPliMinutosInTx` (push a `tx.pliPatches`). `pliModalRows` reescrito con overlay `base + toggles + patches`; para PL virtual el "base" es "todas las imps activas con minutos heredados" (lo que el processor del backend creará al persistir). `openPliModal` skipea fetch para PL virtual (id<0).
2. **`runSolver` sobre PL virtual** — branching: si `targetPlId<0`, redirige a `/api/v1/horarios/solver-dry-run/{gid}` con body `{rango: {tempId, fechaInicio, fechaFin, jornadaTipoId, plis}, alreadyPlacedByImp, totalSemanasGrupoOverride}` derivado del draft + toggles + patches del pendingTx. `runSolverAllRangos` no necesita cambios (delega a `runSolver`).
3. **`handleConfirmExtendCourse`** — ya no PATCH BD: si último PL es virtual, modifica draft inline en `tx.plsToCreate`; si real, push a `tx.plsToUpdate`. Si grupo necesita extender, set `tx.grupoFechaFin`. Refleja preview en `plByGrupo` + `setGrupos` localmente.

`applyPendingTxForGrupo` añade **paso 3.b** entre POST PLs nuevos y PATCH PLI minutos: procesa `tx.pliToggles` (DELETE/POST de PLIs según action), manteniendo `pliByPlRealCache` para que el paso 4 lo reuse. Tras éxito, `setPliByPl({})` invalida cache del modal. Banner "Cambios pendientes" amplía summary con `{{toggles}} activar/desactivar`. Build OK (12.85s).

Bitácora completa: `hoja-de-ruta-periodos-lectivos.md` §6 entrada 2026-05-01.

**Limitación conocida**: `runSolver` sobre PL **real** con toggles/patches pendientes sigue usando `/solver/{gid}` (lee BD, sin overlays). Workaround: Guardar antes de re-solver. En la práctica raramente molesta — los overlays sobre real surgen casi siempre desde "Configurar curso óptimo" que ejecuta el solver al final.

---

**🗒️ Cierre 2026-04-30 noche — Tanda B partes 1 y 2 ✅ Done** (commits `2f57fc2`, `d40b663`). Refactor "nada persiste hasta Guardar" en `/admin/horarios` para todas las acciones del curso del menú "Acciones del curso" + Crear/Editar/Borrar PL desde modal y pills:

- **Backend**: endpoints `/api/v1/horarios/solver-dry-run/{gid}` y `/api/v1/grupos/{gid}/distribute-curriculum-dry-run` (commit `ba18788`); solver/planner/distribuidor aceptan `?array $pliOverride` y `?array $plsOverride` para operar in-memory.
- **Frontend**: cola `pendingTxByGrupo[gid] = { grupoFechaFin, grupoFechaFinOriginal, plsToDelete, plsRealesOriginales (snapshot), plsToCreate: [{tempId<0, ...}], plsToUpdate: [{realId, nombre?, fechaInicio?, ...}], pliPatches }`. PLs virtuales con `_pending: 'create'` viven en `plByGrupo[gid]` junto a los reales editados con `_pending: 'edit'`. State[gid_tempId] guarda placements del solver-dry-run.
- **Acciones refactorizadas**: Configurar curso óptimo, Crear Rangos Recomendados, Añadir manual, Editar PL existente, Borrar PL, Limpiar todo el curso, Limpiar rango (ya estaba dirty local). Todas acumulan en `pendingTxByGrupo`.
- **Guardar** único (`handleSave` → `performBatchSaveAllDirty`): si hay tx, ejecuta orden estricto: PATCH grupo → DELETE plsToDelete → PATCH plsToUpdate → POST plsToCreate → PATCH PLIs → POST horarios (lee `state[gid_tempId]` actual, no closure). Migra `state[gid_tempId] → state[gid_realId]` con `dirty: false`. Refetch PLs + horarios.
- **Descartar**: restaura `plByGrupo[gid]` desde `plsRealesOriginales` (snapshot completo), limpia state de tempIds, vacía `pendingTx`.
- **Banner amarillo** "Cambios pendientes (sin guardar)" bajo el strip cuando hay tx, con resumen `{create} crear · {update} editar · {del} borrar · {patches} ajustes minutos` y botón Descartar (Guardar es el único del editor).

Bitácora completa: `hoja-de-ruta-periodos-lectivos.md` §6 entrada 2026-04-30.

---

### ✅ Tanda B parte 3 — cerrada (2026-05-01)

Las 3 cosas que aún persistían en BD inmediatamente quedaron migradas a `pendingTx`. Detalle arriba en el cierre 2026-05-01 + bitácora `hoja-de-ruta-periodos-lectivos.md` §6 entrada 2026-05-01.

---

**🗒️ Cierre 2026-04-30 — PeriodoLectivo Fase 7 ✅ Done (calendario lectivo del centro con datos reales BOJA).** El INDEX ruta 3 cerrada en una sesión. Implementación completa con datos extraídos del PDF oficial BOJA Sevilla 2025-26 (Resolución firmada 29-may-2025, código verificación `Pk2jmHN9YZXCU9YPKJTUAQG6SSRYET`). El usuario fue explícito: "los datos de la base de datos son susceptibles a cambiar — prioriza datos reales de fuentes reales". Por eso la fuente de verdad es el JSON curado en MinIO con su PDF al lado, y los seeds idempotentes restauran BD al estado canónico.

Cambios concretos:
- Backend: enum `EtapaEducativa` (12 valores LOMLOE), entidad `CalendarioEscolarCcaa(ccaa, anioAcademico, etapa, fechaInicio, fechaFin, ...)` read-only, `Centro.fechaInicio/FinCurso` (override opcional), migración `Version20260430120000`, servicio `CalendarioLectivoService::semanasLectivas` con cascada `override > Centro > CCAA > fallback 36`.
- Comandos: `app:calendario:ingest-escolar --ccaa=AN --source-dir=...` (sube PDF+JSON a MinIO), `app:calendario:seed-escolar --ccaa=AN` (idempotente: persiste etapas + vacaciones autonómicas como Festivo con rango + día provincial).
- Endpoint: `GET /api/v1/centros/{id}/semanas-lectivas?etapa=fp` devuelve `{semanas, diasLectivos, fechaInicio, fechaFin, origen}`.
- UI: `/admin/centros` modal con dos `<input type="date">` Inicio/Fin curso + sugerencia precargada del CCAA (i18n × 5). `HorariosEditor` y `CapacityPlanner` migrados de `36` hardcoded a `semanasReferenciaCentro` con fallback. Sólo afecta al fallback cuando `materia.horasTotales=null` (caso edge).
- Staging temporal en `backend/var/staging/calendario-escolar-an/{source,curated}/ (gitignored, montado en contenedor como /var/www/html/var/staging/...)` siguiendo el patrón de `app:catalogo:ccaa:ingest`. Los PDFs y JSON viven en MinIO (`catalogo/calendario-escolar/{CCAA}/{source,curated}/`); `minio_backup/` los respalda vía `scripts/backup_storage.sh`.

**Acciones del usuario para activar end-to-end** (no ejecutadas en esta sesión por permisos Docker):
1. `docker compose exec backend php bin/console doctrine:migrations:migrate`
2. `docker compose exec backend php bin/console app:calendario:ingest-escolar --ccaa=AN --source-dir=/var/www/html/var/staging/calendario-escolar-an` (el directorio se monta en el contenedor; ajustar a la ruta accesible)
3. `docker compose exec backend php bin/console app:calendario:seed-escolar --ccaa=AN`
4. F5 `/admin/centros` → editar EAG (CCAA Andalucía) → modal sugiere 15-sep-2025 → 22-jun-2026 → guardar.
5. F5 `/admin/horarios` → grupo cualquiera → cálculos anuales usan semanas reales descontando festivos (Navidad, SS, día Comunidad Educativa, día provincial Sevilla).

**Deuda residual**: las 7 provincias andaluzas restantes (AL, CA, CO, GR, HU, JA, MA) publican sus propias Resoluciones provinciales con su día no lectivo provincial — anotado en `calendario-escolar.json.deuda_residual`.

**Add-on 2026-04-30 (mismo día) — Aplicabilidad de festivos por centro**:
- 🐛 **Bug previo corregido** en `CurrentUserExtension.php`: filtraba `festivo.centro = miCentro OR centro IS NULL`, lo que dejaba ver autonómicos de TODAS las CCAAs y provinciales sueltos del país a un admin de centro. Ahora aplica la cascada `NACIONAL OR (AUTONOMICO ccaa = miCentro.ccaa) OR (PROVINCIAL provincia = miCentro.provincia) OR (LOCAL centro = miCentro)`. Un admin de Andalucía/Sevilla ahora ve solo sus festivos.
- ✅ **Filtro `?aplicaACentro=X`**: nueva extension `FestivoAplicableExtension` para que SuperAdmin pueda ver "los festivos como los ve el centro X". `Festivos.jsx` migrado de `?centro=X` (LOCAL only) a `?aplicaACentro=X` (cascada completa).
- ✅ **Botón "Cargar festivos del centro"** en `/fechas/`: invoca `POST /api/v1/centros/{id}/sync-festivos` que ejecuta upsert idempotente desde los JSONs curados en MinIO (BOE laboral + Resolución BOJA escolar) — persiste solo lo aplicable al centro (nacionales + autonómicos de su CCAA + vacaciones autonómicas + día Comunidad + provincial de su provincia + CalendarioEscolarCcaa por etapa). Servicio: `CentroFestivoSyncService`. UI con confirm + toast con stats. i18n × 5.

Bitácora completa: `docs/hoja-de-ruta-periodos-lectivos.md` §3 Fase 7 + §6 entrada 2026-04-30.

---

**🗒️ Cierre de jornada 2026-04-29 noche.** Sesión cerrada con 4 commits ya empujados (`39dc02d`, `6ef7be1`, `37f49a9`, `6a60db0`): Opción A `horasTotales` + CurriculumDistributor, bin-packing first-fit Fases 1-3, Modalidad Fase 5 UI. Cambios menores empujados al cerrar: `cosa` (backlog) ampliado con nuevas ideas de UX/bugs para triar (consumición horas anuales, UX de rango obligatorio en `/admin/horarios`, "Acciones del curso" persistiendo sin Guardar, etc.) — varias ya están representadas en las rutas 2-8 de abajo; otras necesitarán entrada propia o promoción. Asset Lottie `frontend/public/solver.json` añadido y **cableado 2026-04-30** como overlay durante `runSolver` / `runSolverAllRangos` con progreso `current/total` + nombre del PL activo. Bitácora en `docs/sistema-toasts.md` §12 add-on.

**Calendario escolar Fases 1+2+3 ✅ Done (2026-04-27 noche)** — modelo `Provincia`/`AmbitoFestivo` + 17 nacionales y 118 autonómicos cargados desde PDFs oficiales BOE 2025-26 + UI Centros (selector Provincia cascada CCAA) y Festivos (columna Ámbito + filtro + badges themed). Doc dedicado: **`hoja-de-ruta-calendario-escolar.md`**.

**Fase 3 opción B (parcial) ✅ Done (2026-04-27 noche)** — datos LOMLOE oficiales del BOJA persistidos en MinIO + provider que los lee. PDFs auditables en `catalogo/ccaa/AN/source/`, extracto verificado en `catalogo/ccaa/AN/curated/horarios.json`. Banner rojo en EAG (LOMLOE = 32-33h vs jornada 27.5h) — feedback honesto: el centro adapta jornada al currículo, no al revés.

**Sub-fase O + CCAA Fase 3 (opción A) ✅ Done (2026-04-27 madrugada).** Caso EAG/DAW 2º validado E2E con datos hard-coded aproximados antes de pasar a B real.

**🟡 Solver bin-packing — Fases 1+2+3 ✅ Done con deuda residual APLAZADA (2026-04-29 noche, commit `6ef7be1`):** el bin-packing first-fit (`HorarioSolverBinPacking`) ahora es default, satura jornadas (placed=25/25 FP Mañanas, 30/30 FP Tardes). Cobertura per materia 81-123% en los 4 grupos del centro EAG. **1º DAM perfecto al 97-103%** (FP Tardes uniforme); FP Mañanas tiene asimetría estructural del slot de 90min que causa overshoot residual 116-123% en algunas materias y undershoot 81-88% en otras (DIG, IPEI II) por bucle reductivo. **Decisión 2026-04-29 noche: aplazar afinado del solver para avanzar con Modalidad Fase 5**, que tiene mayor impacto comercial. Deuda detallada en `hoja-de-ruta-solver-bin-packing.md` §7 con 4 ideas de resolución cuando se retome. ILP queda como fallback con `body.solver=ilp`.

**Próxima acción** — **Fase 5 COMPLETA (2026-04-28)** ✅. Fases 1-5 todas cerradas: el sistema soporta cualquier itinerario LOMLOE en cualquier centro real con jornada normal, cap anual cross-rango con tolerancia, truco recreos curriculares, extender curso, multi-rango cronológico y PDF multi-página. Rutas posibles:

1. **Modalidad de imparticion** — enum `PRESENCIAL/FCT/NO_REGULAR/AUTONOMA` para separar placement físico (slot en aula) de carga curricular (horas RD). Resuelve **todo FP LOMLOE** (Básica/Medio/Superior/Especialización 1º+2º). Aditivo: default `PRESENCIAL` = comportamiento actual idéntico, sin regresión.
   - **Fase 1 ✅ Done (2026-04-29)** — enum + columnas Materia/Imparticion + helpers + migración.
   - **Fase 2 ✅ Done (2026-04-29)** — heurística + columnas catálogo + cascada providers/resolver/controller. 2 576 materias del catálogo correctamente etiquetadas.
   - **Fase 3 ✅ Done (2026-04-29)** — `CapacityPlanner` y `HorarioSolver` filtran no presenciales. Smoke test 2º DAM EAG: 33h → 28h, complete=true. Bug original resuelto a nivel solver.
   - **Fase 4 ✅ Done (2026-04-29)** — `/admin/horarios` con panel arrastrable filtrado a PRESENCIAL + sub-panel "Otras horas curriculares" para FCT/NO_REGULAR/AUTONOMA con badge de modalidad. Banner anual y CapacityPlanner sin cambios (ya correctos vía cascada). i18n × 5 idiomas. Build OK.
   - **Fase 5 ✅ Done (2026-04-29 noche)** — UI editar modalidad: columna + select en `/admin/materias` y `/admin/imparticiones` (con override y "heredar de materia"). Badge en modal "Materias del rango". i18n × 5.
   - **Próximo: Fase 6** (~0.5 sesión) — PDF con sección "Otras horas curriculares" tras las páginas por rango.
   - Doc dedicado: `hoja-de-ruta-modalidad-imparticion.md`. **Fases 1-5 cubren ya todo el flujo operativo en UI**; Fase 6 es solo polish del PDF.
2. **Solicitud de cambio de turno (profe → admin)** (~1 sesión) — entidad `SolicitudCambioTurno` + cola de aprobación + notificación vía Mensaje (Mercure live ya cubre). Promovido desde `pulido-ux.md` #8 tras verificar que no existía. Doc dedicado: `hoja-de-ruta-cambio-turno.md`. Fase 2 (reasignación automática) diferida.
3. ~~**Períodos Lectivos Fase 7**~~ ✅ **Done 2026-04-30** — `Centro.fechaInicio/FinCurso` + entidad `CalendarioEscolarCcaa` con datos reales BOJA Sevilla 2025-26. Parametriza D-L (las 36 sem LOMLOE hardcoded sustituidas por `CalendarioLectivoService::semanasLectivas` que descuenta festivos reales). Funde Fase 5 de `hoja-de-ruta-calendario-escolar.md`. Bitácora en `hoja-de-ruta-periodos-lectivos.md` §3 Fase 7.
4. **Períodos Lectivos Fase 8** (~2-3 sesiones) — tab "Consumición de horas anuales": dashboard con vista "ahora" + proyección anual con doble eje (rango vs evaluación). Cierra el ciclo de gestión visualmente para jefe de estudios.
5. **Calendario Fase 4** (~1.5h) — entidad `Municipio` + UI festivos locales manuales. Cross-ref con la ruta 3.
6. ~~**Refactor toasts**~~ ✅ **Done (2026-04-30)** — sistema unificado con fondos saturados bottom-right + close button arriba-derecha solo X. `setDragError` migrado a `toast.error/warning`, `.errorToast` local eliminado, keyframes movidos a CSS global. Bitácora completa en `docs/sistema-toasts.md` §12.
7. **Asignar profesores** a las imparticiones autonómicas LOMLOE (Digitalización GS, Sostenibilidad, IPE I) en `/admin/imparticiones` (operativo, ~10 min).
8. **Períodos Lectivos Fase 6** (~1 sesión) — merge `/admin/jornadas` + `/admin/horarios` (cosmético, baja prioridad).
**PDF multi-página por rango ✅ Done (2026-04-28 noche):** el botón "Exportar PDF" de `/admin/horarios` genera un PDF con **una página por cada `PeriodoLectivo`** del grupo, ordenadas cronológicamente. Cada página repite la cabecera (logo + título + fecha) y añade una sub-cabecera con nombre+fechas del rango. Backend: `HorarioPdfController::horarioGrupo()` agrupa horarios por PL y construye array `paginas[]`. Twig refactorizado en 2 macros (`headerBlock`, `grillaBlock`) con branching multi/single-page para mantener compatibilidad con `/horario/me`.

Otras rutas más amplias:
- Ampliar `BojaAndHardcodedProvider` a DAW 1º + DAM 1º+2º AN (datos verificados contra BOJA — NO inventar).
- Fase 3 opción B completa: scraper PDF del BOJA.
- §14 sub-fases L/M/N (cosméticos del solver).
4. **Jornadas Fase B** (asistente automático de tramos).

**✅ Pulido UX + bugs sueltos cerrados (2026-04-28 noche):** los 8 ítems del doc atendidos en una sola sesión. Fixes de bugs (turno tarde profe en `/horarios`; badge "Completo · X/Yh" coherente con cobertura anual cross-rango); UX (columna Grupo `[curso]º [abrev]` en `/admin/horarios`, Acciones alineadas al final en DataTables, scroll interno del sidebar persistido por sessionStorage); deuda (62 fallback hex muertos eliminados de 7 archivos + 2 inline `#64748b` migrados a `var(--text-muted)`); subtítulos descriptivos en 24 vistas con i18n × 5 (residual: `CatalogoItinerarioDetail` por título dinámico). #8 promovido a `hoja-de-ruta-cambio-turno.md` por no existir la feature. Doc cerrado: **`hoja-de-ruta-pulido-ux.md`**.

**🆕 Limitación detectada con 2º DAM AN (2026-04-28 noche):** la jornada lectiva normal (30h presencial) no acoge el currículo LOMLOE de 2º DAM (33h/sem) porque el modelo trata todas las materias como `PRESENCIAL`, incluidas las **5h "no regulares"** (Proyecto Intermodular 2h + Horas de libre configuración 3h) que NO son clase semanal en aula. Plan: añadir enum `Modalidad` (`PRESENCIAL/FCT/NO_REGULAR/AUTONOMA`) para separar placement físico de carga curricular. Doc dedicado: **`hoja-de-ruta-modalidad-imparticion.md`** (~3 sesiones).

**🆕 Alcance ampliado de Modalidad de imparticion (2026-04-29):** discusión confirma que la feature NO es un parche para DAW/DAM 2º — la causa raíz es estructural en LOMLOE (dual obligatoria RD 659/2023 en todos los 2º cursos + Proyecto intermodular en FP Sup/Med + Horas de libre configuración autonómicas en 1º y 2º) y resuelve **todo FP LOMLOE** (Básica, Medio, Superior, Especialización). FP Básica tiene FCT en 2º; Especialización suele llevar Proyecto final. Punto clave: el enum es **aditivo**, default `PRESENCIAL` = comportamiento actual idéntico, sin riesgo de regresión para itinerarios que ya cuadran (1º DAW EAG, 1º ESO, etc.). Detalle en doc dedicado §"Alcance estructural en LOMLOE" + bitácora 2026-04-29.

**🔥 PRIORIDAD MÁXIMA — Opción A: `horasTotales` como objetivo curricular (2026-04-29):** refactor arquitectónico que ataca la causa raíz de los problemas con calendarios distintos a 36 sem LOMLOE. Las h/sem del catálogo eran tratadas como ley inmutable (`min × 36` rígido), pero la realidad LOMLOE es que las **horas TOTALES anuales** del módulo son el dato legal y las h/sem son una división convencional adaptable al calendario real.

Cambios implementados:
- **Backend**: nueva propiedad `Materia.horasTotales` (int nullable) + helper `getObjetivoAnualMinutos()` (preferente `horasTotales × 60`, fallback `min/sem × 36`). Migration `Version20260429180000` con backfill = `ROUND(min × 36 / 60)`. `CatalogoMaterializationController` y `GrupoResyncCcaaController` copian `horasTotales` del catálogo al crear Materia. `CapacityPlanner` usa el helper como objetivo curricular; cuota equitativa cross-rango solo se aplica si `totalSemanas < 36 LOMLOE` (calendario corto), sino cuota natural + reducción C.
- **Frontend**: `semanasOptimas = max(36, ceil(Σ horasTotales × 60 / slotsSemanalMin))` adapta el calendario a slots colocables reales (sin recreos). Banner anual y chip usan `horasTotales × 60` como objetivo. "Configurar curso óptimo" calcula automáticamente las semanas necesarias.

Cambios complementarios (mismo día, fixes paralelos):
- Reducción proporcional con criterio "menor penalty %" (sustituye round-robin caprichoso). Concentra el déficit estructural en la materia más grande que lo absorbe mejor relativamente.
- Skip materia con cuota residual < slotMin en último rango (evita combos imposibles cuando la materia ya está casi cubierta).
- "Configurar curso óptimo" como flujo combinado en menú "Acciones del curso": crea rangos óptimos + lanza solver multi-rango secuencial con acumulador local cap anual.

**Resultados E2E** (centro EAG, 2026-04-29):
| Grupo | Σ vs jornada slots | Antes | Después |
|---|---|---|---|
| 2º DAW | 28h ≤ 27.5h+0.5 | 5 al 110%, Inglés 126% | **5 al 102%, Inglés 106%** |
| 2º DAM | 28h ≤ 27.5h+0.5 | 6 al 120%, Inglés 120% | **6 al 101-104%, Inglés 108%** |
| 1º DAW | 29h > 27.5h (déficit estructural) | Sistemas/Bases/etc al 78-86% caprichoso | **6 al 102-111% + Programación 88%** (absorbe déficit) |

**Limitación restante** (no resoluble por algoritmo): si Σ presencial > capacidad slots, el déficit es **per-semana** e irreductible. Para 1º DAW EAG (29h vs 27.5h slots), Programación queda al 88% como mejor reparto matemático. La única solución es operativa: subir la jornada del centro a 30h slots/sem (`/admin/jornadas`, 5 min). El truco recreos LOMLOE (banner verde "Currículo dentro de jornada lectiva (incluye recreos)") cubre el caso donde el centro acepta los recreos como tiempo lectivo curricular legítimo.

**Filosofía**: el sistema NO inventa slots físicos; sólo distribuye óptimamente lo disponible. La pregunta del usuario "tan difícil es prolongar el curso" tiene respuesta: el curso SÍ se prolonga (de 36 LOMLOE a 38 sem en 1º DAW), pero la suma per-semana sigue saturando si la jornada es estructuralmente insuficiente.

Detalle completo en `hoja-de-ruta-periodos-lectivos.md` §6 bitácora 2026-04-29 ("Opción A").

**✅ PARCHE TEMPORAL ELIMINADO (2026-04-28 noche):** las jornadas `id 4 Mañanas` y `id 5 Tardes pre Calendario Real` (35h/sem) **borradas de BD** tras cerrar Fase 5 entera de PeriodoLectivo. Itinerarios DAW/DAM ahora apuntan a la jornada normal `id=3 "FP Mañanas"` (27.5h slots + 2.5h recreos = 30h presencial). 164 horarios fantasma (slots inexistentes en jornada normal) soft-deleted. Bitácora completa: `docs/hoja-de-ruta-periodos-lectivos.md` §6 (Sub-fase D). Doc histórico marcado SUPERSEDED: `docs/hoja-de-ruta-jornadas-recreos.md` §"PARCHE TEMPORAL".

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

**✅ Live updates CRUD — COBERTURA TOTAL (2026-05-04)**: framework declarativo con `#[LivePublish]` + `LivePublishSubscriber` genérico + hooks frontend `useLiveCollection`/`useLiveRefetch` + comando `app:mercure:invalidate` + JWT con topics admin/centro/personales. **Entidades marcadas (17)**: Comunicado, Imparticion, Matricula, Grupo, Itinerario, Festivo, Tarea, Calificacion (admin + alumno), Horario, Entrega, User, Materia, Centro, JornadaTipo, PeriodoEvaluativo, **Temario, Asistencia** (sesión 6). **Vistas migradas (20)**: TablonWidget, `/admin/imparticiones`, `/admin/matriculas`, `/admin/grupos`, `/admin/itinerarios`, `/admin/festivos`, `/admin/calificaciones`, `/admin/horarios` tabs Lista + Consumición, `Entregas.jsx` (profe), `/horarios` personal (alumno+profe), `/admin/usuarios`, `/admin/materias`, `/admin/centros`, `/admin/jornadas`, `/admin/evaluaciones`, **`TemariosAlumno`, `TemariosProfesor`, `MisFaltas`, `MisCalificaciones`** (sesión 6). Patrón documentado en `CLAUDE.md`. Detalle y bitácora: `docs/hoja-de-ruta-redis-workers.md` §"Bitácora Live CRUD".

**Regla operativa**:
- Tras `mysql -e 'INSERT/UPDATE...'` o seeds SQL directos: ejecutar `app:mercure:invalidate -t /topic` para que los clientes conectados refresquen (Doctrine no se entera de SQL crudo).
- Vistas nuevas: usar `useLiveRefetch` por defecto (ver `CLAUDE.md` §"Patrones y Convenciones").

**Excluido por diseño** (no es deuda):
- `HorariosEditor` — tab "Editor" de `/admin/horarios` (5613 líneas, sistema `pendingTx`): el draft local "todo a memoria hasta Guardar" colisionaría con un refetch externo. Los otros 2 tabs del wrapper (Lista y Consumición) sí están live.
- `Configuracion.jsx` (TemaVisual del centro): config baja frecuencia (validado con usuario 2026-05-04).
- 3 vistas de catálogo oficial (`/admin/catalogo/*`): read-only seeds; usar `app:mercure:invalidate -t /admin/catalogo` tras `app:catalogo:refresh` si se quiere propagar.

**🧪 Pendiente de validación visual** (último paso antes de cerrar el roadmap del todo):
- Abrir 2 pestañas/navegadores con usuarios distintos sobre el mismo centro y confirmar que la UI refresca sola en cada una de las 16 vistas live al editar desde la otra. Backend está smoke-tested vía `app:mercure:invalidate`; falta confirmar la cadena completa (worker → hub → SSE → React refetch) en navegador real.
- Si algo no refresca: revisar consola del navegador por errores SSE, y confirmar en `docker compose logs mercure` que el evento llega al hub. El JWT incluye los topics necesarios (firmados en `MercureAuthController`).
- Verificación recomendada por entidad y no en bloque: si una falla, el problema casi seguro está en el `payloadGroups` o el placeholder del topic (`{rel.id}`) de esa entidad concreta, no en el framework.

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
| `hoja-de-ruta-periodos-lectivos.md` | **Fases 1-5 + 7 + 8 todas ✅** + **Opción A 2026-04-29**: `Materia.horasTotales` como objetivo curricular (ley LOMLOE) en lugar de `min × 36` rígido. **Fase 7 ✅ 2026-04-30**: calendario lectivo real del centro (datos BOJA AN 2025-26 vía `app:calendario:seed-escolar`, `CalendarioLectivoService` cuenta semanas descontando festivos, UI Centro con sugerencia, sustituidas las 36 hardcoded en HorariosEditor + CapacityPlanner). **Fase 8 ✅ 2026-05-03 (3 sesiones)**: tab "Consumición" en `/admin/horarios` con doble eje rangos↔evaluaciones, tabla tonalizada plegable, vista "Proyección" con `recharts` (currículo / planificado / impartido) y panel sugerencias. | Fase 6 (merge /admin/jornadas + /admin/horarios — cosmético, baja prioridad) |
| `hoja-de-ruta-jornadas-recreos.md` | Fases A, C, D, G, **E ampliada** (D24=A en minutos). **§"PARCHE TEMPORAL" SUPERSEDED 2026-04-28** por periodos-lectivos sub-fase D | Fase B (asistente automático de tramos), Fase F (validador horarios afectados), Fase H (cache jornada en editor), **§14 sub-fases J-N** (minutosSemanales / capacity check / bloques largos / paralelismo refinado / round-up explícito) |
| `hoja-de-ruta-calendario-escolar.md` | **Fases 1+2+3 ✅** (modelo Provincia + Festivo.ambito + datos BOE 2025-26 cargados + UI Centros/Festivos). **Fase 5 ✅ SUPERSEDED 2026-04-30** absorbida por periodos-lectivos Fase 7 con datos reales BOJA AN 2025-26. | Fase 4 (Municipio + UI locales), Fase 6 (distribución temporal materias), Fase 7 (cron anual fetch BOE/BOJA — pendiente) |
| `hoja-de-ruta-calificaciones.md` | **A+B+C+D+E+F ✅ todas cerradas (2026-04-29 + 2026-05-02)**. `backup_tfg_full.sql` con 174 tareas / 614 entregas / 614 calificaciones / 16 periodos / 87 ponderaciones / 725 asistencias / 17 mensajes / 10 comunicados / 87 temarios. **Fase F**: cierre manual de tareas vencidas con 0 auto + validador `Assert\Callback validateDentroDePlazo` en `Entrega` que bloquea POST/PUT API Platform tras `fechaLimite` (cierre auto sigue funcionando porque persiste sin validators). | B.1 validación Σ pesos=1.0 a nivel entidad. Cron de Fase F (A1 vía Symfony Scheduler) si se quiere automatizar. |
| `home-widgets-roadmap.md` | TablonWidget, NotificationList | Resto de widgets marcados 🔴 |
| `modernizacion-ui.md` | Manual vivo de modernización; varios plugins documentados | Sigue activo, registrar cada modernización nueva |

### 🔴 Atadas pero sin código

| Doc | Esfuerzo | Impacto comercial |
|---|---|---|
| **`hoja-de-ruta-modelo-semanal.md`** 🏗️ | **REFACTOR COMPLETO** branch `develop-semanas-lectivas`. Fases A1+A2+A3 ✅ commit `a28d812`. **Fase B ✅ Done (sesiones 2-4)** commits `5624582`/`b2785c6`/`d370257`/`9befa14`/`25df9b6`. **Fase D ✅ Done (sesión 5)** commits `ede5361`/`2597a0a`/`c4b1297`. **Fase C ✅ Done (sesión 6)** commit `4a0d716`. **Refactor cerrado.** Sesión 7 (2026-05-07): cerrados pendientes coherencia DAW/DAM (sin duplicados intra-itinerario · DAM ya regenerado · `GrupoResyncCcaaController.horasTotales` añadido). Próxima feature objetivo: **`hoja-de-ruta-intercambio-imparticiones.md`** ✅ creado 2026-05-07 — listo para arrancar Fase A. | D-PRINCIPAL cerrada con resultado MODELO SEMANAL PURO. PL pasa de rango contiguo a semana lectiva + plantilla. Detalle del estado en §"Estado de fases" arriba y §9 del doc. |
| **`hoja-de-ruta-intercambio-imparticiones.md`** 🆕 (2026-05-07) | **Roadmap dedicado, sin código.** MVP A-E ~4-5 sesiones. Plan A modelo + CRUD, B render/composición, C UI creación, D notificaciones, E intercambios bilaterales, F semana atípica (opcional), G histórico (opcional). | Feature objetivo del refactor modelo-semanal. Cubre intercambios entre profes, sustituciones por ausencia, cancelaciones puntuales, eventos especiales y semanas atípicas. **Bloqueante de arranque**: cerrar D-A (granularidad temporal) — recomendación argumentada Opción B (capa `ExcepcionHorario` aditiva) frente a (A) lazy split de SEMANA y (C) atomización completa, dado que las SEMANAs actuales son multi-week. Reusa entidad `Notificacion` ya operativa para avisar afectados. |
| **`hoja-de-ruta-clases-compartidas.md`** 🆕 (2026-05-06 noche) | **Roadmap dedicado, sin código.** ~4-4.5 sesiones cuando se aborde. Plan A→E. | Caso real EAG: 1º DAW + 1º DAM LOMLOE comparten currículo entero por RD 405/2023 → físicamente la misma clase con mismo profe en misma aula. Hoy el solver bloquea con falsos conflictos de profesor. Feature desbloquea pase de lista combinado, PDF correcto, y solver coordinado entre grupos hermanos. Recomendado: opción B (heurística + 1 columna `Horario.gemeloId` self-FK). Detección por niveles 🟢/🟡/🔴 con sugerencias de unificación cuando los profes no coinciden 100%. |
| **`hoja-de-ruta-notificaciones.md`** 🔥 | **MÁXIMA PRIORIDAD** (~2 sesiones) — entidad + dispatcher + dos botones en header (mensajes con icono `Mail`, notificaciones con icono `Bell`) | **CRÍTICO**: cierra el bucle de feedback. Sin esto los usuarios no se enteran de eventos del sistema (corrección de examen, tarea nueva, comunicado, entrega recibida). Bloqueante para demo real. |
| `hoja-de-ruta-modalidad-imparticion.md` | **Fases 1-5 ✅ Done (2026-04-29 noche)**, queda Fase 6 (~0.5 sesión, solo PDF) | UI completa: el admin etiqueta modalidad de materias e imparticiones desde `/admin/materias` y `/admin/imparticiones`. Backend + editor + admin alineados. Solo falta sección "Otras horas curriculares" en PDF. |
| `hoja-de-ruta-pulido-ux.md` | 🟢 **Ronda 1 + Ronda 2 ✅ Done (2026-05-05)** — Los 6 ítems R2.1-R2.6 cerrados. R2.1 incluye barrido de 27 vistas + 2 wrappers de tabs + fix DOM nesting de TableSkeleton. | Doc cerrado. |
| `hoja-de-ruta-cambio-turno.md` | ~1 sesión (Fase 1) | Bajo-medio: cola de solicitudes profe→admin para cambio **permanente** mañana↔tarde con respuesta y notificación. Promovido desde `pulido-ux.md` #8 tras detectar que no existía la feature. Fase 2 (reasignación automática) diferida. **Nota 2026-05-07**: complementario a `intercambio-imparticiones.md` (no superseded) — éste cubre cambio permanente, aquél cubre excepciones puntuales (1 clase / 1 día). |
| `hoja-de-ruta-curriculum-ccaa.md` | Fases 1+2 ✅ Done; quedan 3-9 (~5-8 sesiones) | **CRÍTICO**: sin Fase 3 (BOJA Andalucía) el solver sigue sin cuadrar para centros reales |
| `hoja-de-ruta-redis-workers.md` | Live CRUD ✅ Cobertura total (sesiones 1+2+3+4+5 — 2026-05-04). **15 entidades, 16 vistas live**. | **Cerrado**. Movible a 🟢 cerradas. |
| `hoja-de-ruta-mejoras-tecnicas.md` | Plan extenso (CI, tests, A11y) | Deuda técnica; no producto, pero importante para mantenibilidad |
| `hoja-de-ruta-solver-bin-packing.md` | **Fases 1+2+3 ✅ Done (commit `6ef7be1`)**. Bin-packing reescrito a BLOQUES CONTIGUOS 2026-05-01 (cierra deuda residual del slot 90 asimétrico) | Bin-packing first-fit es default. Reescrito a bloques contiguos 60-120min (máx 120/día/materia) sobre granularidad 30min en `hoja-de-ruta-solver-iterativo.md` 2026-05-01. Las 4 ideas A-D del §7 se materializan en las acciones correctivas + el cambio de granularidad de la jornada. |
| `hoja-de-ruta-solver-iterativo.md` | **🆕 Fases 1-5 + REDISTRIBUIR_CROSS_RANGO + bloques + jornadas 30min + cascade soft-delete + rejillas reescritas ✅ Done (2026-05-01)** | Doc completo. `HorarioSolverIterativo` con bucle outer + `BottleneckClassifier` + `CorrectiveActionExecutor` (3 acciones) + endpoint multi-rango. Modal "Informe del solver" con bottleneck/sugerencias/log. Bin-packing reescrito a BLOQUES CONTIGUOS sobre slots 30min. `PeriodoLectivoSoftDeleteProcessor` cascadea a Horario+PLI. Rejillas (`/admin/horarios`, `/horarios`, PDFs) renderizan bloques 60-120min con rowspan. Validado E2E con 1º DAW EAG. Pendiente futuro no bloqueante: anti-loop refinado en redistribuirCrossRango. |

### 📋 Referencia / manuales

| Doc | Naturaleza |
|---|---|
| `catalogo-oficial.md` | Arquitectura del catálogo + bitácora de §13 + secciones por etapa (FP, ESO) y §20 cross-ref CCAA |
| `informe-mejoras.md` | Auditoría inicial del proyecto |
| `async-select.md` | Manual del componente `AsyncSearchSelect` |
| `sistema-toasts.md` | Manual del sistema de toasts. **§12 refactor ✅ Done (2026-04-30)** — fondos saturados unificados, close button arriba-derecha, `.errorToast` local eliminado |

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

### Bloque 2.5 — Modalidad de imparticion *(🟡 Fases 1+2+3+4 ✅ Done — bloqueante para FP LOMLOE completo hasta cerrar Fases 5-6 en UI admin/PDF)*

7. **Modalidad enum** — `PRESENCIAL/FCT/NO_REGULAR/AUTONOMA` para separar placement físico de carga curricular. Alcance: **todo FP LOMLOE** (Básica/Medio/Superior/Especialización, 1º y 2º). Causa estructural: dual obligatoria RD 659/2023 + Proyecto intermodular + Horas libre configuración autonómicas. **Aditivo**: default `PRESENCIAL` = comportamiento actual sin regresión.
   - **Fase 1 ✅ Done (2026-04-29)**: enum + columnas + migration + helpers.
   - **Fase 2 ✅ Done (2026-04-29)**: heurística + cascada CCAA. 2 576 materias correctamente etiquetadas.
   - **Fase 3 ✅ Done (2026-04-29)**: solver y CapacityPlanner filtran no presenciales. Bug original resuelto a nivel solver.
   - **Fase 4 ✅ Done (2026-04-29)**: panel del editor `/admin/horarios` con drag filtrado a PRESENCIAL + sub-panel "Otras horas curriculares" con badges. i18n × 5.
   - **Pendiente Fases 5-6** (~0.75 sesiones): UI editar modalidad en `/admin/materias` y `/admin/imparticiones` + sección "Otras horas curriculares" en PDF.
   - Doc: `hoja-de-ruta-modalidad-imparticion.md`.

### Bloque 3 — Solver y editor pulidos *(medio)*

5. **§14 sub-fase L** — heurística bloques largos.
6. **§14 sub-fase M** — paralelismo refinado por solape de rangos.
7. **§14 sub-fase N** — round-up D22=A explícito en chip (asterisco + tooltip).
8. **Jornadas Fase B** — asistente automático de tramos (genera la jornada a partir de Σ horas materias).

Estimación: ~2 sesiones. Docs: `hoja-de-ruta-jornadas-recreos.md` (§14 + Fase B).

### Bloque 4 — Cierre del ciclo evaluativo *(✅ código cerrado 2026-04-29 — falta repoblar BD)*

9. **Calificaciones — Auditar A-D** ✅ Done (2026-04-29). Bitácora cerrada en doc. Fases B/C/D/E todas implementadas en código.
10. **Calificaciones Fase E — boletines PDF** ✅ Done (`dompdf 3.1` + `BoletinController` + plantilla Twig + `PdfBranding` con logo MinIO + i18n × 5 + botones de descarga en frontend).
11. **Cola residual** (~1 sesión): re-aplicar seed de calificaciones (no idempotente; BD vacía hoy), poblar 4 periodos evaluativos por grupo (C.5), añadir validación Σ pesos=1.0 a `PonderacionImparticion`.

Doc: `hoja-de-ruta-calificaciones.md`.

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

   ┌──────────────────────────────────────────┐
   │ hoja-de-ruta-modalidad-imparticion.md    │  separar placement físico
   │  (🔴 sin empezar, ~3 sesiones)           │  vs carga curricular (FP/ESO/Uni)
   └──────────────────────────────────────────┘

   ┌─────────────────────────────────────┐
   │ hoja-de-ruta-calificaciones.md      │  ciclo evaluativo, boletines
   │  (A-D probable ✅, E pendiente)     │
   └──────────────┬──────────────────────┘
                  │ Calificacion::postPersist → notif al alumno
                  ▼
   ┌─────────────────────────────────────┐
   │ hoja-de-ruta-notificaciones.md 🔥   │  bucle de feedback del sistema
   │  (🔴 MÁXIMA PRIORIDAD, ~2 sesiones) │  campanita + propagación a afectados
   └─────────────────────────────────────┘
```

`rename-fp-neutral.md`, `tutorial.md` y `editor-horarios.md` son históricos que ya no condicionan ninguna ruta nueva. `redis-workers.md`, `mejoras-tecnicas.md` y `home-widgets-roadmap.md` son ortogonales al producto core. `notificaciones.md` se cruza con `redis-workers.md` (reusa Mercure + `#[LivePublish]`) y con `home-widgets-roadmap.md` §3.13 (sustituye el ítem "Actividad reciente" ampliándolo a feature transversal).

---

## 📌 Convenciones de los docs (resumen)

- Todo `hoja-de-ruta-*.md` empieza con un **`⚡ Snapshot para retomar`** y termina con **`Bitácora de implementación`**. Si encuentras uno que no, normalízalo cuando lo toques.
- Las decisiones se enumeran como **D1, D2, ...** y viven en una tabla. Las cerradas con resolución; las abiertas con recomendación.
- Las fases se enumeran con letras (**A, B, C, ...** dentro de un doc; minúsculas o mayúsculas según convención del doc).
- Las sub-fases del solver hardening usan letras altas (**J, K, L, M, N**) para no chocar con las fases originales A-H del doc de jornadas.
- Las CCAAs usan códigos ISO 3166-2:ES (AN, CT, MD, VC, PV, GA, ...). Lista completa en `hoja-de-ruta-curriculum-ccaa.md` §3.1.
- Las migraciones Doctrine son `Version2026XXXX_descripcion`.
- Los seeds SQL viven en `scripts/seed_*.sql` y son idempotentes (DELETE previo).
