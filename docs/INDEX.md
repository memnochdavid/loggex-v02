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

**Bloquea durante el refactor**: features que toquen `PeriodoLectivo`/`Horario`/`HorariosEditor` en `develop`. Otras features paralelas (calificaciones B.1, catálogo) pueden seguir en `develop`.

**Desbloquea al terminar**: `hoja-de-ruta-intercambio-imparticiones.md` ✅ creado 2026-05-07 — listo para arrancar Fase A tras cerrar D-A (granularidad temporal de la excepción). El viejo `hoja-de-ruta-cambio-turno.md` se mantiene vivo como **complementario** (cambio permanente de turno del profe), no superseded.

---

## 🟢 CERRADA 2026-05-08 — Sistema de notificaciones del sistema (validación E2E)

**🔔 Notificaciones del sistema (campanita + propagación a afectados)** — Doc: **`hoja-de-ruta-notificaciones.md`** (cerrado).

Tras 3 días de uso real con la BD del centro EAG (commits del 2026-05-05 al 2026-05-08), las 3 fases están operativas y validadas en navegador:

1. ✅ **Fase 1 backend** — entidad `Notificacion` + repo + migración `Version20260505120000` + `NotificationDispatcher` con 4 métodos `notify*()` + `NotificationDispatchSubscriber` (postPersist + postFlush con guard de re-entrancy) + endpoint custom `POST /api/notificaciones/marcar-todas-leidas` + filtro en `CurrentUserExtension` + topic Mercure `/users/{id}/notifications` (firmado en el JWT).
2. ✅ **Fase 2 frontend** — header con DOS botones (Mensajes con icono `Mail`, Notificaciones con icono `Bell`); `<SystemNotificationsList>` reusa el CSS module de mensajes para densidad/hover/foco idénticos pero pinta notificaciones del sistema (icono por tipo Lucide, dot de no-leída, footer "Marcar todas como leídas"). Filtra eventos Mercure por `entity === 'Notificacion'` para coexistir con mensajes en el mismo topic. Optimistic update al marcar leída + refetch via Mercure.
3. ✅ **Fase 3 catálogo + i18n × 5** — catálogo cerrado + dispatcher + claves `notifications.types.{tipo}.{title|body}` + UI strings (empty/markAllRead/viewAll/relative time).
4. ✅ **Hotfixes 2026-05-05** — bug 500 al crear `Tarea` (`Grupo::getMatriculas` inexistente; reemplazado por query directa al `MatriculaRepository`) + nuevo tipo `calificacion_actualizada` que avisa cuando el profe rectifica la nota (filtro `preUpdate` con `hasChangedField('nota')` para no spamear con cambios de feedback — D12).

**Regla de oro confirmada en producción**: un mensaje NO genera notificación adicional. Los dos botones del header son mutuamente excluyentes (D8: abrir uno cierra el otro).

**Resultado**: el bucle de feedback queda cerrado — alumno se entera al instante de correcciones, tareas nuevas y comunicados; profe ve cada entrega recibida; admin ve los eventos relevantes. Roadmap promovido a 🟢 cerradas. Cualquier ampliación futura (mensaje_urgente, vista dedicada `/notificaciones`, backfill SQL, poda mensual) está anotada como mejora opcional sin urgencia en la bitácora del doc.

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

## 🟡 PENDIENTE VALIDACIÓN E2E 2026-05-12 — Notificaciones de incidencias

**Sesión 2026-05-12 noche** cerró en código los dos bugs descubiertos esa misma tarde sobre `ExcepcionHorario`/notificaciones. Working tree con 2 archivos modificados (`NotificationDispatcher.php` + `NotificationDispatchSubscriber.php`), sintaxis PHP validada, **pendiente test E2E en navegador antes de commit**.

### 1) Duplicado por clases gemelas / multi-bloque — FIX APLICADO

**Síntoma reportado** (caso real profe→profe, 1 lección 120 min):
- Solicitado: **2 notifs idénticas** `incidencia_propuesta` "Alberto te propone una intercambio para el 2026-05-13 (LM&SG · 1º DAM)".
- Admin del centro: **4 notifs idénticas** `excepcion_pendiente` "Alberto ha solicitado una intercambio para el 2026-05-13".

**Causa real**: clases gemelas (1º DAW ↔ 1º DAM unificadas en EAG, RD 405/2023) + multi-bloque del intercambio bilateral. `IntercambioController` crea 2 EH (cara A + cara B) con mismo `intercambioGrupoId`; `HorarioGemeloSyncSubscriber::postFlush` duplica cada cara para el hermano gemelo copiando la misma `imparticionEfectiva` → **4 EH** total. Cada EH dispara:
- `notifyExcepcionPendiente` → admin recibe 4.
- `notifyIncidenciaPropuesta` → destinatario semántico recibe 2 (sólo las 2 caras que lo apuntan a él).

Patrón replicado también en `notifyExcepcionResuelta` y `notifySustitucionAsignada`. NO afecta a `notifyAlumnosCambioClase` (grupos gemelos tienen alumnos distintos).

**Trampa adicional encontrada**: el dedupe DQL solo no basta. Las notifs previas del mismo batch están persistadas en el UnitOfWork sin flush, así que la query LIKE no las ve. Necesario combinar memoria in-process + DQL.

**Fix aplicado** en `backend/src/Service/NotificationDispatcher.php`:
- Propiedad privada `$emitidasEsteRequest: array<string, true>` indexada por `tipo|usuario_id|intercambioGrupoId`. Se rellena al `createPersist` y se consulta antes de emitir.
- Helper `yaNotificadoPorIntercambioGrupoId(User, string, ?string)` consulta primero la memoria in-process; si no, fallback a DQL LIKE sobre `payload` (json type, `json_encode` sin espacios, UUID v4 único); cachea el resultado.
- Los **4 `notify*` cascadeables** ahora añaden `intercambioGrupoId` al payload y consultan el helper antes de `createPersist`: `notifyIncidenciaPropuesta`, `notifyExcepcionResuelta`, `notifySustitucionAsignada`, `notifyExcepcionPendiente`.

### 2) Admin del centro sin notificación en APROBADA directa — FIX APLICADO

**Síntoma reportado**: el admin (que también es profe) no recibe nada cuando otro user crea un intercambio APROBADA directa.

**Causa real**: `NotificationDispatchSubscriber::dispatchExcepcionPersist` solo invocaba `notifyExcepcionPendiente` en la rama PENDIENTE. La rama APROBADA nunca avisaba a admins/superadmins del centro. NO es regresión de la "corrección anterior de SuperAdmin" — la query de admins en `NotificationDispatcher.php:287-295` sigue intacta. El commit `83b483a` (2026-05-12 mañana) arregló sólo `notifyIncidenciaPropuesta` para el destinatario semántico en APROBADA, no abrió la rama a admins.

**Fix aplicado**:
- Nuevo método `NotificationDispatcher::notifyExcepcionAprobadaDirecta(ExcepcionHorario)` similar a `notifyExcepcionPendiente` pero tipo `'excepcion_aprobada_directa'`, título "Incidencia aprobada en tu centro", enlace `/admin/incidencias`. Excluye al solicitante (mismo guard) y dedupe por `intercambioGrupoId` (in-process + DQL).
- 1 línea añadida en `NotificationDispatchSubscriber.php` rama APROBADA: `$this->dispatcher->notifyExcepcionAprobadaDirecta($eh);` después de `notifyIncidenciaPropuesta`.

### 3) Borrado de incidencias desde `/admin/incidencias` requería N clicks — FIX APLICADO

**Síntoma**: el admin al borrar una incidencia desde `/admin/incidencias` borraba solo 1 `ExcepcionHorario` aunque hubiera N caras del mismo intercambio (cara A + cara B × clases gemelas DAW+DAM = hasta 4 filas para 1 sola incidencia). Tenía que borrar manualmente las N. Si dejaba alguna, el estado del grupo quedaba incoherente.

**Causa**: `IntercambioGrupoCascadeSubscriber` (Plan B 2026-05-08) cascadeaba SOLO cambios de estado vía `preUpdate hasChangedField('estado')`. Soft-delete del `SoftDeleteProcessor` también es un `preUpdate` (setea `deleted=true` y persiste, no es REMOVE), pero el guard original lo ignoraba.

**Fix aplicado** en `backend/src/EventSubscriber/IntercambioGrupoCascadeSubscriber.php`:
- Subscriber ahora escucha **dos eventos**: `preUpdate` (estado, lógica preexistente sin cambios) + `onFlush` (soft-delete, nueva rama).
- **Primer intento usaba preUpdate también para soft-delete y NO funcionó**: el usuario reportó que seguían quedando las 4 filas tras borrar una. Causa: `SoftDeleteProcessor` invoca `setDeleted(true) + persist + flush`; las hermanas cargadas con query nuevo NO están scheduled for update y `recomputeSingleEntityChangeSet` las ignora silenciosamente (limitación documentada en `HorarioGemeloSyncSubscriber` Fase D — preUpdate solo recompone changesets ya scheduled, no añade nuevos).
- **Refactor al patrón canónico**: `onFlush` itera `getScheduledEntityUpdates`, detecta EH con `changeSet['deleted'] = [false, true]`, carga hermanas y aplica `setDeleted(true) + computeChangeSet` para que los UPDATEs entren en el mismo flush.
- Reusa el mismo `$processing` anti-loop (compartido entre preUpdate y onFlush) y el helper `loadOtrosDelGrupo` extraído.
- **Limitaciones documentadas**: reactivación (deleted: true→false) no se propaga; hard-delete vía `em->remove()` tampoco — todo el delete del producto pasa por `SoftDeleteProcessor`.

### Validación E2E pendiente (antes de commit)

Tras `docker compose restart backend` (opcache PHP-FPM):

1. **Dedupe profe→profe** (el reporte original): Alberto solicita desde `/horarios` intercambio sobre 1º DAM LM&SG → destinatario recibe **1 notif** (antes 2), admin recibe **1 notif** (antes 4). SQL: `SELECT id, tipo, JSON_EXTRACT(payload, '$.intercambioGrupoId') FROM notificacion WHERE usuario_id=X ORDER BY id DESC LIMIT 10;`.
2. **Admin APROBADA directa**: admin crea desde `/admin/horarios` → otro admin del centro recibe **1 notif** `excepcion_aprobada_directa`.
3. **No regresión aprobación**: admin aprueba PENDIENTE → solicitante recibe **1** "aprobada", no N.
4. **Borrado en cascade**: admin va a `/admin/incidencias` → click "borrar" en una sola fila del intercambio → todas las hermanas del grupo (incluidas las gemelas DAW↔DAM) desaparecen del listado. SQL: `SELECT id, deleted, intercambio_grupo_id FROM excepcion_horario WHERE intercambio_grupo_id = '<uuid>';` — todas con `deleted=1`.

Si algo falla: `docker compose logs backend` (errores del LIKE sobre JSON), `SELECT payload FROM notificacion ORDER BY id DESC LIMIT 3;` (verificar serialización sin espacios), `app:mercure:invalidate -t /users/{id}/notifications` como palanca de recuperación.

## 🚨 Primera acción al retomar la próxima sesión

**Tras commit `c0c8708` (2026-05-12)** — fixes de notificaciones de incidencias (dedupe por intercambioGrupoId + aviso admins APROBADA directa + cascade soft-delete por grupo) cerrados, validados E2E y empujados a `origin/develop`. Working tree limpio.

**Bloqueantes residuales documentados pero NO implementados** (decisiones cerradas por el usuario en sesión 2026-05-12):
- ❎ Renombrar etiqueta "Borrador" → "Parcial" en los 5 locales: el usuario decidió mantenerlo así.
- ❎ i18n × 5 de `notifications.types.excepcion_aprobada_directa.{title,body}`: el backend manda texto en español (compatible); el usuario decidió mantenerlo así.

**Candidatos para la siguiente sesión** (orden = recomendación por tamaño/impacto):

- ~~**Modalidad Fase 6 (PDF)**~~ ✅ Done 2026-05-12 — roadmap `hoja-de-ruta-modalidad-imparticion.md` cerrado al 100%. PDF anexo "Otras horas curriculares" con tabla 4 columnas + badge por modalidad + i18n × 5.
- ~~**Columna + campo `horasTotales` en `/admin/materias`**~~ ✅ Done 2026-05-12 — micro-tarea descubierta en discusión sobre FP 2º: el campo `Materia.horasTotales` (dato legal LOMLOE — `Materia.php:113-128`) existía en BD pero estaba oculto en la UI. Solo se editaba `minutosSemanales` (sugerencia derivada). Añadidas columna ordenable + input en modal con hints explicativos en 5 idiomas. `OrderFilter` ampliado en backend (`Materia.php:60`) a `horasTotales` y `modalidad`. Desbloquea el siguiente paso: en FP 2º, "Configurar curso óptimo" debe crear también el rango de la 3ª evaluación con las imparticiones no presenciales (FCT/Proyecto/HLC) anclables temporalmente en él. Sin ver las horas totales el flow del rango 3 no tiene sentido para el admin.
- ~~**FP 2º — Rango 3ª evaluación en "Configurar curso óptimo"** (Fase A)~~ ✅ Done 2026-05-12 (commit `135f1a9`) — En FP 2º, "Configurar curso óptimo" crea **3 SEMANAs** (Hasta PRIMERA, Hasta SEGUNDA, Tercera evaluación). La 3ª persiste con `PeriodoLectivo.etiqueta='no_presenciales'` (migration `Version20260512200000`); solver y distribuidor de currículo la skipean automáticamente; el banner anual la excluye del cap. Validado E2E.
- ~~**FP 2º — Fase B: arrastrar no presenciales al rango 3**~~ ✅ Done 2026-05-12 (working tree) — `OtrasHorasItem` ahora es arrastrable cuando el PL activo es `no_presenciales`. El rango "Tercera evaluación" hereda jornada del grupo por defecto; el admin la cambia con "Editar PL" a una jornada custom (típico: "FP 3ª eval" con SLOT 08:30-15:30 + RECREO 15:30-18:00 + SLOT 18:00-20:00 para FCT + tutoría Proyecto, replicando el horario real LOMLOE de un alumno). La rejilla reusa el render de presenciales sin cambios. Drop handler agnóstico a modalidad. CSS `.otrasHorasItemDraggable` con cursor grab + hover themed. **B.1-B.4 cerradas pragmáticamente**: rejilla = misma vista que presenciales con jornada custom, banner sin cambios (decoupling con `horasTotales`), solver no aplica (filtrado de Fase A), cascade gemelo reusa `HorarioGemeloSyncSubscriber`.
- **C.4 página `/mis-incidencias`** — vista profe con sus solicitudes (estado, motivo, otra cara…). ~0.5-1 sesión.
- ~~**Fase E clases-compartidas**~~ ✅ Done 2026-05-13 — TimeTable web + PDF horario personal + pase de lista compartido. Backend `GetMyScheduleController` agrupa events por `gemelo_id` con array `gruposCompartidos[]`; `AsistenciaController.getSheet` recolecta alumnos de grupos hermanos con su `imparticionId` natural (preserva integridad del summary del alumno). Bitácora en `hoja-de-ruta-clases-compartidas.md` §"2026-05-13".
- **Badge en rejilla `/admin/horarios`** — placements con incidencia aprobada. ~0.5 sesión.
- **Validación cross-conflicto en POST /excepciones/intercambio** — ~0.5 sesión.
- **Pequeña mejora UX en `AdjuntarGrupoModal`** — filtrar grupo destino del selector de origen + toast de error en 422.
- **Curriculum CCAA Fase 3 BOJA Andalucía** — **CRÍTICO** para venta a centros reales fuera del piloto EAG, ~2 sesiones.
- **Comercialización F1.1 backups automatizados a remoto** — único ítem de comercializacion.md que si falla provoca litigio inmediato, ~1-2 sesiones.

**Deuda residual estructural (no del solver/distribuidor)**: IPEI II en PL2 puede quedar 11.7h corta por **conflict de profesor**, no por algoritmo. Con `MAX_DIARIO_MIN_POR_MATERIA = 120`, cuota 300 min/sem necesita ≥3 días lectivos libres. Si el profe tiene clase en otro grupo paralelo en 3 de los 5 días en PL2, su cap real cae a 240 → `REDUCIR_CUOTA_PROPIA` recorta 300→240. Solución operativa: reasignar profe en `/admin/imparticiones` o rebalanceo manual.

---

**🟢 MVP `materias-multi-itinerario` cerrado, validado E2E y commiteado** (commit `6dd6e7c`, 2026-05-08) — `Materia` ↔ `Itinerario` ManyToMany (tabla puente + drop columna) + solver consciente (`isProfBusyOther`: misma `materia.id` + misma franja → no conflicto profe) + UI multi-select + CTA "Añadir materia existente" en vista de itinerario. **Validado E2E en EAG**: las franjas de las 7 materias compartidas DAW↔DAM coinciden tras Guardar. Doc completo: `hoja-de-ruta-materias-multi-itinerario.md`.

**Bugs preexistentes arreglados de paso** (incluidos en `6dd6e7c`):
- `HorariosEditor.jsx:520` Maximum update depth (loop de `setJornadasPorId({...prev, key:null})` sin guard).
- `Materias.jsx` PUT borraba `horasTotales` (campo nunca presente en el state del form → API Platform full replace lo ponía a NULL silenciosamente).
- `DataTable.jsx` columna Acciones hideable por localStorage stale (faltaba guard `isActionsCol`).

**🟢 Fases A + B + C + D de `hoja-de-ruta-clases-compartidas.md` cerradas, validadas E2E y commiteadas** (commits `1543b32`/`d634aa1`/`6dd6e7c`/`0188147`, 2026-05-08/09) — Fase A: botón "Adjuntar a grupo existente" + endpoint backend, validado E2E (61 placements clonados, franjas DAM coinciden con DAW al 100%). **Fase B**: migración `Horario.gemelo_id` self-FK + helpers en entidad + canonicalización al raíz en el controller. **Fase C**: solver consciente cubierto sin código adicional vía ruta `materia.id` del MVP M:N. **Fase D**: `HorarioGemeloSyncSubscriber` (`onFlush` + `postPersist`/`postFlush`) propaga al conjunto de hermandad cambios físicos, soft-delete y duplica `ExcepcionHorario` con `intercambioGrupoId` compartido. Anti-loop con guard `$processing` estático. **D-1 cerrada**: clases gemelas se tratan como mismo grupo en todos los aspectos operativos. **Bug genérico descubierto en validación**: `preUpdate + recomputeSingleEntityChangeSet` ignora silenciosamente entidades nuevas no scheduled → migrado a `onFlush + computeChangeSet` (mismo patrón aplicado en `IntercambioGrupoCascadeSubscriber` Fase 3 cascade soft-delete, commit `c0c8708`).

**Validación E2E intercambio C.3 cerrada** (commit `53367b8` + smoke test 2026-05-08) — los 9 puntos OK. Los 4 tipos del catálogo (`sustitucion`, `cancelado`, `evento_especial`, `intercambio`) operativos desde click derecho en `/admin/horarios`. Detalle en `hoja-de-ruta-intercambio-imparticiones.md` §8.

---

## 📋 Sesión 2026-05-11 — FP correctness end-to-end (planner + datos + UI + hardcodes)

**Cerrados en commits `569add5` + `c6b5478`** sobre branch `develop-semanas-lectivas`. Sesión larga motivada por un solo síntoma (2º DAM EAG: `redistributionShortfall extendBy:7` 12 veces) que descubrió desalineaciones en 4 capas. Detalle completo en `hoja-de-ruta-solver-iterativo.md` §"2026-05-11 — Sesión correctness FP end-to-end".

**Reglas de negocio FP nuevas en `PeriodoLectivoPlanner`** (bitácora detallada en §"Fase B+" del solver-iterativo):
- Universal: la ventana lectiva NUNCA solapa EXTRAORDINARIA.
- FP (cualquier curso): NO clases después de TERCERA (`fin` cropped a `tercera.fechaFin`).
- FP 2º (`grupo.curso=2` ∧ etapa `FP_*`): además TERCERA es FCT → cropped a `segunda.fechaFin`, sin cola residual.
- `jornadaSemanalMin` incluye SLOT+RECREO (truco LOMLOE FP, ya asumido por el frontend).
- Detector `isFp(Grupo)` via `itinerario.catalogoOrigen.etapa ∈ {FP_BASICA, FP_MEDIO, FP_SUPERIOR, FP_ESPECIALIZACION}`.

**Datos corregidos en BD EAG** (no migración — son datos de centro, no schema):
- `jornada_tramo` id 108 borrado (FP Tardes 21:00–21:30 sobrante para igualar con FP Mañanas).
- `materia` ids 7-10 + 13 alineados con catálogo BOE (2º DAW había quedado con `horas_totales = minutos_semanales × 36 / 60` desde abr-26, antes del enrich BOE; nadie había pulsado "Resync CCAA" sobre grupo 2). FCT 0→400h restaurado. **Idempotente con Resync** — re-ingestar el catálogo no pisa el fix.
- 4 `periodo_evaluativo` clonados para grupo 5 (2º DAM): PRIMERA/SEGUNDA/TERCERA/EXTRAORDINARIA con las fechas estándar EAG. Sin evaluaciones, el planner caía a "Curso completo" y el distribuidor reventaba.

**Fix UI en `HorariosEditor.jsx`** (banner y badge dejan de mentir/confundir):
- Banner `curriculumMin` filtra a presencial (antes mezclaba FCT/no_regular dando Δ −562h falsa en 2º DAW).
- Badge `allAnualCubierto` filtra a presencial + tolerancia per-materia alineada con backend (`max(60min, 5% target)`).
- Badge `targetMinutos = slotsCapacityWeekly` directo (jornada de slots). Antes derivaba "weekly ideal" desde anual/semanasReferencia dando target 18.7h con jornada 27.5h (confundía al admin).
- `showAnualLabel` quitado: el badge siempre muestra cifras semanales del PL activo. El estado sigue decidido por cobertura anual cross-rango.
- Toast distingue `capacityShortfall` (no cabe → deficit agregado + palancas) de `redistributionShortfall` (cabe pero greedy desbalanceó → lista materias afectadas).

**Hardcodes `* 5` quitados en 4 sitios** del editor. Nuevo memo `diasLectivosCount` deriva de `jornadaActual.diasLectivos` (JSON `int[]` del entity `JornadaTipo`). Centros con jornada de 4 días (FCT) o sábados lectivos quedan soportados de raíz.

**Deuda residual anotada** (no aplicada en esta sesión):
- Bin-packing prioriza materias grandes (`score = liquido pendiente absoluto`) → pequeñas como IPEI II (4-5h/sem) quedan famélicas y `redistribuirCrossRango` no las rescata porque mira `accumPlacedByImp` (teórico) en vez de placements reales del bin-packing. Caso real 2º DAW: IPEI II quedó 6.3h corta; admin rebalanceó manualmente. Fix propuesto: bonus de score por cobertura relativa baja.
- Etiqueta "Borrador" del badge es engañosa en castellano (sugiere "no guardado"); cambio propuesto a "Parcial" en los 5 locales pendiente de validación término final.

---

## 📋 Sesión 2026-05-08 (cierre completo)

Tres commits cerrados hoy en orden cronológico: `9e032ce` (B.3 + opción A) → `29ce569` (DataTable selector columnas + dropdowns inmunes + botón danger) → `f67eaf9` (docs cierre) → `6fd8a41` (cierre roadmap notificaciones tras validación E2E) → `53367b8` (Fase C.3 modal Nueva incidencia desde click derecho en /admin/horarios, 4 tipos).

**Notificaciones del sistema → 🟢 cerrada definitivamente** tras 3 días de uso real (validación E2E confirmada por el usuario). Los 5 tipos del catálogo (`calificacion_publicada`, `calificacion_actualizada`, `tarea_nueva`, `comunicado_nuevo`, `entrega_recibida`) operativos. Detalle en sección "🟢 CERRADA 2026-05-08 — Sistema de notificaciones del sistema" más arriba.

**Fase B.3 Consumición awareness + opción A desambiguación sintético + pulido UX Ronda 3.** Dos commits: `9e032ce` (intercambio-imparticiones) y `29ce569` (DataTable + header dropdowns + botón rechazar danger).

1. **Fase B.3 Consumición awareness** (`9e032ce`) — `ConsumicionAnualService` resta minutos de incidencias APROBADAS tipo CANCELADO/EVENTO_ESPECIAL en `planTotal`/`impartidoTotal`/`porRango[]`/`porEvaluacion[]` (las INTERCAMBIO/SUSTITUCION no afectan: la clase se imparte igual, sólo cambia el profe). Nuevo método privado `loadIncidenciasRestadoras(grupo)` con DQL indexada por `imparticionId`. DTO añade `minutosPerdidosIncidencias`/`minutosPerdidosIncidenciasHoy` por materia. Bug detectado al validar: la primera versión sólo restaba al total y a `porEvaluacion`; el banner UI lee `porRango[].minutosPlanificados` y mostraba los rangos sin descontar. Fix añadiendo segundo bucle que ubica la incidencia en el rango cuyo `[fechaInicio,fechaFin]` contiene su `fechaConcreta`. Validado E2E en `/admin/horarios` tab Consumición tras `docker compose restart backend` (OPcache PHP-FPM no recoge cambios del Service hasta reiniciar; el CLI `app:fase8:consumicion 1` sí porque arranca proceso fresh). Cierra task #16 ("Fase B — banner anual + Consumición") del roadmap intercambio-imparticiones.

2. **Opción A — desambiguación visual sintético** (`9e032ce`) — el sintético de un intercambio (cara que cubres) se renderizaba en el TimeTable con la misma materia que tu clase regular cuando la cubres con la misma materia, lo que confundía si tenías otra clase contigua (caso real: Alberto cubre Sara Vie 8:30-9:30 + tiene su Vie 9:30-10:30 propio). `GetMyScheduleController::loadOverrideAssignedEvents` expone tres campos extra en cada sintético: `_overrideTitularNombre`, `_overrideMateriaBase`, `_overrideMateriaBaseAbrev` (datos del titular del horario base). `TimeTable.jsx` muestra "Cubres a {Titular} · {baseAbrev}→{efAbrev}" en el card del placement y un nuevo `detailRow` con icono `Shuffle` en el modal cuando la materia base difiere. CSS themed (`.eventOverrideMeta`/`.eventOverrideSwap`). i18n × 5: `exceptions.coveringFor`, `exceptions.insteadOf`.

3. **Pulido UX Ronda 3** (`29ce569`) — tres ítems cerrados (R3.1, R3.2, R3.3 en `hoja-de-ruta-pulido-ux.md`):
    - **R3.1 — DataTable selector de columnas**. Hook nuevo `frontend/src/hooks/useColumnVisibility.js` que persiste el set de columnas ocultas en `localStorage` bajo `dataTableHiddenCols_{tableId}` y depura ids huérfanos. `DataTable.jsx` acepta nueva prop `tableId` (sin ella el botón no aparece) y `id`/`hideable` por columna ("Acciones" siempre fija). Botón `Columns3` centrado en el paginador superior (grid `1fr auto 1fr` con `grid-column` explícito en cada hijo para que `pageButtons` quede a la derecha también en el inferior). Popover renderizado vía `createPortal(menu, document.body)` con `position: fixed` + reposicionamiento al scroll/resize, así escapa del `overflow:hidden` del `.container` y no se corta verticalmente cuando la tabla termina antes. Estilo del dropdown copiando al `LanguageSelector` del header (radius lg, shadow lg, animación `slideDown`, hover via `--datatable-header-hover-bg/text`). i18n × 5: `dataTable.columns`, `dataTable.showColumns`. **Cobertura**: `tableId` aplicado a las 16 páginas con `<DataTable>` (usuarios, itinerarios, jornadas, centros, imparticiones, grupos, materias, catalogo-materias, evaluaciones, matriculas, festivos, catalogo-itinerario-detail, catalogo-itinerarios, entregas, horarios, excepciones). `Configuracion.jsx` queda fuera por usar columnas mock de preview.
    - **R3.2 — Header dropdowns inmunes a transparencia**. Doble capa `--bg-body` (sólido) + `linear-gradient(--bg-card-solid|--bg-card)` aplicada a `layout/Header.module.css .dropdown` (popover compartido por mensajes y notificaciones) y al `.columnsMenu` del DataTable. Si el tema activo da alpha a `--bg-card` (glassmorphism), el `--bg-body` opaco rellena por debajo. Sin colores hex.
    - **R3.3 — Botón "Rechazar este cambio" pasa a `variant="danger"`**. En `TimeTable.jsx` modal de placement, el botón usaba `variant="secondary"` con estilos inline `color/borderColor: var(--color-error)`. Cambiado a `variant="danger"` (igual que el "Cerrar sesión" del `ConfirmLogoutModal`); estilos inline eliminados.

**Estado de tareas pendientes en intercambio-imparticiones** (lo que queda por hacer cuando se retome esa feature):
- ~~**C.3 modal "Solicitar cambio" desde rejilla `/admin/horarios`**~~ ✅ **Done 2026-05-08** (commit `53367b8`) — click derecho sobre placement con `hid` abre `<NuevaExcepcionModal>` (componente reusable nuevo) con prefill de horarioBase, materia, grupo, tramo y fecha sugerida (SEMANA → fechaInicio + diaIdx; PLANTILLA → próximo diaIdx desde hoy). Cubre los **4 tipos** del catálogo: sustitucion / cancelado / evento_especial / intercambio (este último con `<HorarioGridPicker>` integrado, `targetMinutes=durA`, `excludeProfesorId=titularBase`; modal pasa a size `large`). Submit branchea entre `/api/excepcion_horarios` (3 tipos directos) y `/api/v1/excepciones/intercambio` (Plan B). Backend marca APROBADA automáticamente para admin vía `ExcepcionHorarioProcessor`/`IntercambioController`. i18n × 5 (3 claves nuevas: `errorFechaRequired`, `createdDesc`, `savePlacementFirst`). **🟢 Smoke test 9/9 pasado en navegador (2026-05-08, sesión siguiente)** — todos los tipos validados E2E incluyendo intercambio multi-bloque con cascade UUID compartido.
- **C.4 página `/mis-incidencias`** — vista profe con sus solicitudes (estado, motivo, otra cara…). Diferida.
- **Badge en rejilla `/admin/horarios`** (task #17) — marcar visualmente placements con incidencia aprobada en la semana visible. Diferido.
- **Plan B2 multi-profe** — en intercambio 1↔N permitir que las caras B sean de varios profes. Diferido hasta que aparezca demanda real.
- **Validación cross-conflicto en POST /excepciones/intercambio** — si el solicitante (o el otro profe) tiene OTRA clase suya en franja contigua/solapada al slot que va a cubrir, avisar (no rechazar). Idea surgida hoy al desambiguar el sintético; no se implementó.

**Estado de pulido-ux**: doc cerrado tras Ronda 3. No hay Ronda 4 abierta. Si en próxima sesión surge un nuevo ajuste UX/bug fácil, anotarlo como R4.

---

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
| `hoja-de-ruta-notificaciones.md` | **Fases 1-3 + hotfixes ✅ Done 2026-05-05; validación E2E 2026-05-08**: campanita `Bell` en header con dropdown de eventos del sistema (`<SystemNotificationsList>`); 5 tipos cableados (`calificacion_publicada`, `calificacion_actualizada`, `tarea_nueva`, `comunicado_nuevo`, `entrega_recibida`); Mercure live; i18n × 5. | Posibles ampliaciones diferidas (no urgentes): `mensaje_urgente`, vista dedicada `/notificaciones`, `app:notificaciones:backfill`, poda mensual de leídas. |
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
| **`hoja-de-ruta-intercambio-imparticiones.md`** 🆕 (2026-05-07) | 🟢 **Fase A + B 5/5 + C parcial + C.3 + Rename + D + E + E.2 + Plan B + Fase B.3 ✅ Done (2026-05-08); validación E2E intercambio cerrada 2026-05-08 (sesión siguiente)** — Los 4 tipos operativos + intercambio bilateral con cascade automático (`IntercambioGrupoCascadeSubscriber`, UUID compartido `intercambio_grupo_id` permite 1↔N caras). Picker visual con grid temático (multi-selección, abreviatura primero, modal ancho dinámico, admins-que-imparten incluidos). Sintético muestra titular base + materia base ("Cubres a Sara · IPE→SIS") para desambiguar visualmente cuando el user tiene su propia clase contigua. **B.3 ✅** — `ConsumicionAnualService` resta minutos de incidencias APROBADAS tipo CANCELADO/EVENTO_ESPECIAL a planTotal/impartidoTotal/porRango/porEvaluacion. **C.3 ✅** — click derecho sobre placement en rejilla `/admin/horarios` abre `<NuevaExcepcionModal>` reusable con prefill (horarioBase, fecha sugerida, materia, grupo, tramo) y los 4 tipos del catálogo (intercambio incluido con `<HorarioGridPicker>` integrado); admin crea APROBADA directa vía processor. **Smoke test E2E 9/9 OK (intercambio incluido).** Diferidos restantes: C.4 (`/mis-incidencias`), badge en rejilla, Plan B2 multi-profe, validación cross-conflicto. | Feature objetivo del refactor modelo-semanal. Cubre intercambios entre profes, sustituciones por ausencia, cancelaciones puntuales, eventos especiales. La capa `ExcepcionHorario` es aditiva: el modelo PL+Horario sigue intacto y el render compone "base + override aplicable a fecha visible". Reusa entidad `Notificacion` ya operativa para avisar afectados. |
| **`hoja-de-ruta-materias-multi-itinerario.md`** 🆕 (2026-05-08) | 🟢 **MVP cerrado y validado E2E (2026-05-08)** | Resuelve duplicación estructural de `Materia` entre itinerarios LOMLOE hermanos (caso real 1º DAW + 1º DAM en EAG). Refactor `Materia.itinerario` ManyToOne → `Materia.itinerarios` ManyToMany (tabla puente + drop columna) + solver consciente (`isProfBusyOther`: misma `materia.id` + misma franja → no conflicto del profe) + UX multi-select itinerarios + CTA "Añadir materia existente" en vista de itinerario (`MateriasItinerarioModal`). **E2E validado**: las franjas de las 7 materias compartidas DAW↔DAM coinciden tras Guardar. Bugs preexistentes arreglados de paso (HorariosEditor max update depth, Materias.jsx PUT borraba horasTotales, DataTable acciones hideable). Working tree con cambios sin commitear. |
| **`hoja-de-ruta-clases-compartidas.md`** 🆕 (2026-05-06 noche) | 🟢 **Fases A + B + C + D + E ✅ Done (2026-05-08 / 2026-05-09 / 2026-05-13)**. Adjuntar grupo + `Horario.gemelo_id` canonicalizado + solver consciente vía `materia.id` + `HorarioGemeloSyncSubscriber` que propaga cambios físicos, soft-delete y duplica `ExcepcionHorario` con `intercambioGrupoId` compartido. **Fase E (2026-05-13)**: TimeTable web etiqueta combinada "1º DAW + 1º DAM", PDF horario personal con separador unificado, pase de lista compartido (alumnos de ambos grupos con chip de grupo, cada asistencia contra su imp natural). Diferidas: detección automática 🟢/🟡/🔴 + refactor N:M `imparticion_grupo` (opción C, evolución mayor sin demanda actual). | Caso real EAG: 1º DAW + 1º DAM LOMLOE comparten currículo entero por RD 405/2023. La unificación física es ahora operación explícita de un click + cualquier mutación posterior se replica al hermano automáticamente. Las incidencias (cancelaciones, intercambios, sustituciones) se aplican a ambos lados de la hermandad sin intervención del admin. Tras Fase E, el profe ve un solo bloque combinado en su rejilla y pasa lista una sola vez para los alumnos de los dos grupos. |
| `hoja-de-ruta-modalidad-imparticion.md` | **🟢 Fases 1-6 ✅ Done (2026-05-12) — ROADMAP CERRADO** | UI completa: el admin etiqueta modalidad de materias e imparticiones desde `/admin/materias` y `/admin/imparticiones`. Backend + editor + admin + PDF alineados. El PDF de grupo añade página anexa "Otras horas curriculares" con tabla 4 columnas y badge por modalidad. Pendiente opcional diferido: extender al PDF personal (sin demanda actual). |
| `hoja-de-ruta-pulido-ux.md` | 🟢 **Ronda 1 + Ronda 2 + Ronda 3 ✅ Done (2026-05-08)** — Ronda 3: R3.1 selector de columnas DataTable persistido en localStorage (16 páginas con `tableId`), R3.2 dropdowns header inmunes a transparencia (doble capa `--bg-body` + `--bg-card-solid|--bg-card`), R3.3 botón "Rechazar este cambio" `variant="danger"`. Commit `29ce569`. | Doc cerrado tras Ronda 3. |
| `hoja-de-ruta-cambio-turno.md` | ~1 sesión (Fase 1) | Bajo-medio: cola de solicitudes profe→admin para cambio **permanente** mañana↔tarde con respuesta y notificación. Promovido desde `pulido-ux.md` #8 tras detectar que no existía la feature. Fase 2 (reasignación automática) diferida. **Nota 2026-05-07**: complementario a `intercambio-imparticiones.md` (no superseded) — éste cubre cambio permanente, aquél cubre excepciones puntuales (1 clase / 1 día). |
| `hoja-de-ruta-curriculum-ccaa.md` | Fases 1+2 ✅ Done; quedan 3-9 (~5-8 sesiones) | **CRÍTICO**: sin Fase 3 (BOJA Andalucía) el solver sigue sin cuadrar para centros reales |
| `hoja-de-ruta-redis-workers.md` | Live CRUD ✅ Cobertura total (sesiones 1+2+3+4+5 — 2026-05-04). **15 entidades, 16 vistas live**. | **Cerrado**. Movible a 🟢 cerradas. |
| `hoja-de-ruta-mejoras-tecnicas.md` | Plan extenso (CI, tests, A11y) | Deuda técnica; no producto, pero importante para mantenibilidad |
| `hoja-de-ruta-solver-bin-packing.md` | **Fases 1+2+3 ✅ Done (commit `6ef7be1`)**. Bin-packing reescrito a BLOQUES CONTIGUOS 2026-05-01 (cierra deuda residual del slot 90 asimétrico) | Bin-packing first-fit es default. Reescrito a bloques contiguos 60-120min (máx 120/día/materia) sobre granularidad 30min en `hoja-de-ruta-solver-iterativo.md` 2026-05-01. Las 4 ideas A-D del §7 se materializan en las acciones correctivas + el cambio de granularidad de la jornada. |
| `hoja-de-ruta-solver-iterativo.md` | **🆕 Fases 1-5 + REDISTRIBUIR_CROSS_RANGO + bloques + jornadas 30min + cascade soft-delete + rejillas reescritas ✅ Done (2026-05-01)** | Doc completo. `HorarioSolverIterativo` con bucle outer + `BottleneckClassifier` + `CorrectiveActionExecutor` (3 acciones) + endpoint multi-rango. Modal "Informe del solver" con bottleneck/sugerencias/log. Bin-packing reescrito a BLOQUES CONTIGUOS sobre slots 30min. `PeriodoLectivoSoftDeleteProcessor` cascadea a Horario+PLI. Rejillas (`/admin/horarios`, `/horarios`, PDFs) renderizan bloques 60-120min con rowspan. Validado E2E con 1º DAW EAG. Pendiente futuro no bloqueante: anti-loop refinado en redistribuirCrossRango. |
| **`hoja-de-ruta-validacion-formularios.md`** 🆕 (2026-05-16) | 🔴 **~4-6 sesiones.** Fase 1: 12 entidades sin NINGUNA validación Symfony (Horario, Materia, Itinerario, Imparticion, Matricula, Asistencia, Calificacion, Tarea, Festivo, Mensaje, Comunicado, Temario). Fase 2: completar entidades parciales (Centro, Grupo, PeriodoEvaluativo, User, JornadaTipo). Fase 3: replicar en frontend (cross-field, maxLength, pattern, archivos). Audit completo: `docs/audit-validacion-formularios.md`. | **Integridad de datos.** Sin validación backend, cualquier dato corrupto entra por API directa. Notas fuera de [0,10], horarios con horaFin < horaInicio, festivos con rangos invertidos, materias/centros sin nombre. Fix previo: `Grupo.anioEscolar` con Regex + Callback (hecho 2026-05-16). |
| **`hoja-de-ruta-comercializacion.md`** 🆕 (2026-05-09) | 🔴 **8–12 semanas full-time a primer cliente piloto pagando.** F1 (3-4 sem, 7 ítems rojos), F2 (2-3 sem, 4 naranjas), F3 (3-4 sem, 5 amarillos), F4 (open-ended, 10 verdes diferibles). Próxima acción: F1.1 backups automatizados a remoto + rotación (1-2 sesiones, único ítem que si falla puede provocar litigio inmediato). | **Producto vs prototipo.** El núcleo de dominio (modelo semanal, solver, catálogo CCAA, clases compartidas, intercambios, notificaciones, modalidad LOMLOE, tematización, i18n × 5, DNI/NIE/CIF, sesión inactividad, bulk delete) está sobresaliente; lo que falta es la capa de producto: tests/CI, deploy real, RGPD hard-delete, headers de seguridad, audit log, WCAG AA, política privacidad, multi-tenancy hardening, SMTP, SSO, onboarding, mobile horarios, manuales. Tres caminos a mercado documentados (SaaS centralizado / Self-hosted / Consultora educativa). Recomendado camino C (2-3 pilotos a precio amigo) → migración a SaaS en mes 12. |

### 📋 Referencia / manuales

| Doc | Naturaleza |
|---|---|
| `audit-validacion-formularios.md` | Auditoría completa de validación (24 entities + 24 páginas). 12 entidades sin NINGUNA validación Symfony. Referenciado en `hoja-de-ruta-validacion-formularios.md` |
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
>
> **🆕 2026-05-09**: la pieza que falta (no es feature de dominio, es capa de producto: tests, CI, deploy, RGPD, accesibilidad, manuales, integraciones operativas) está documentada como roadmap propio en **`hoja-de-ruta-comercializacion.md`** (F1 bloqueantes absolutos · F2 legales · F3 operativos · F4 diferibles + 3 caminos a mercado + métricas de Done). Los bloques 1-6 de abajo cubren cobertura **funcional**; comercialización cubre la cobertura **operativa** que el cliente exige aunque no la vea.

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
   │ hoja-de-ruta-notificaciones.md 🟢   │  bucle de feedback del sistema
   │  (cerrada 2026-05-08, validada E2E) │  campanita + propagación a afectados
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
