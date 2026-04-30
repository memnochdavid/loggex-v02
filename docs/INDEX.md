# Índice de hojas de ruta — Loggex

> **Lee esto primero** en cualquier sesión que toque docs/ o que vaya a empezar / continuar trabajo planificado. Te da el estado real, los caminos críticos para llegar a producto comercial y la regla obligatoria de bitácora.

---

## 🚨 Primera acción al retomar la próxima sesión

**🗒️ Cierre 2026-04-30 noche — Tanda B partes 1 y 2 ✅ Done** (commits `2f57fc2`, `d40b663`). Refactor "nada persiste hasta Guardar" en `/admin/horarios` para todas las acciones del curso del menú "Acciones del curso" + Crear/Editar/Borrar PL desde modal y pills:

- **Backend**: endpoints `/api/v1/horarios/solver-dry-run/{gid}` y `/api/v1/grupos/{gid}/distribute-curriculum-dry-run` (commit `ba18788`); solver/planner/distribuidor aceptan `?array $pliOverride` y `?array $plsOverride` para operar in-memory.
- **Frontend**: cola `pendingTxByGrupo[gid] = { grupoFechaFin, grupoFechaFinOriginal, plsToDelete, plsRealesOriginales (snapshot), plsToCreate: [{tempId<0, ...}], plsToUpdate: [{realId, nombre?, fechaInicio?, ...}], pliPatches }`. PLs virtuales con `_pending: 'create'` viven en `plByGrupo[gid]` junto a los reales editados con `_pending: 'edit'`. State[gid_tempId] guarda placements del solver-dry-run.
- **Acciones refactorizadas**: Configurar curso óptimo, Crear Rangos Recomendados, Añadir manual, Editar PL existente, Borrar PL, Limpiar todo el curso, Limpiar rango (ya estaba dirty local). Todas acumulan en `pendingTxByGrupo`.
- **Guardar** único (`handleSave` → `performBatchSaveAllDirty`): si hay tx, ejecuta orden estricto: PATCH grupo → DELETE plsToDelete → PATCH plsToUpdate → POST plsToCreate → PATCH PLIs → POST horarios (lee `state[gid_tempId]` actual, no closure). Migra `state[gid_tempId] → state[gid_realId]` con `dirty: false`. Refetch PLs + horarios.
- **Descartar**: restaura `plByGrupo[gid]` desde `plsRealesOriginales` (snapshot completo), limpia state de tempIds, vacía `pendingTx`.
- **Banner amarillo** "Cambios pendientes (sin guardar)" bajo el strip cuando hay tx, con resumen `{create} crear · {update} editar · {del} borrar · {patches} ajustes minutos` y botón Descartar (Guardar es el único del editor).

Bitácora completa: `hoja-de-ruta-periodos-lectivos.md` §6 entrada 2026-04-30.

---

### 🟡 Tanda B parte 3 — pendiente al retomar

**Cosas que SIGUEN persistiendo en BD inmediatamente** (no respetan "nada hasta Guardar"):

1. **Editar minutos PLI desde modal "Materias del rango" (icono Sliders)**:
   - Archivo: `frontend/src/pages/HorariosEditor.jsx`.
   - Localización: `grep -n "/api/periodo_lectivo_imparticions" HorariosEditor.jsx` — hay PATCH/POST/DELETE inmediatos del PLI cuando el admin cambia minutos, activa/desactiva imparticion en el rango, o resetea al default heredado.
   - Refactor: en lugar de PATCH directo, push a `pendingTxByGrupo[gid].pliPatches: [{plKey, imparticionId, minutosSemanales}]`. Si el plKey es virtual (tempId<0), el lookup de `applyPendingTxForGrupo` ya lo resuelve (paso 4 hace `tempIdToRealId[plKey] ?? plKey`). Para activar/desactivar imparticion: necesita estructura nueva `pendingTx.pliToggles: [{plKey, imparticionId, action: 'activate'|'deactivate'}]` — el apply lo traduce a POST/DELETE de `PeriodoLectivoImparticion`.
   - El header del modal tiene Σ planificado vs jornada del rango — ese cálculo se hace localmente y debe seguir mostrando preview con los pliPatches pendientes superpuestos al PLI base.

2. **`runSolver` / `runSolverAllRangos` sobre PL virtual**:
   - Archivos y líneas: `runSolver` (~línea 2400) y `runSolverAllRangos` (~línea 2530) en `HorariosEditor.jsx`.
   - Hoy: pegan a `/api/v1/horarios/solver/{gid}` con `periodoLectivoId` real. Si es tempId negativo → 422 del backend.
   - Opción A (recomendada): si `selectedPlId < 0` (o `plIdOverride < 0`), redirigir a `/api/v1/horarios/solver-dry-run/{gid}` construyendo el body con el draft virtual del pendingTx (`pendingTx.plsToCreate.find(d => d.tempId === plId)`) y los plis del distribute-dry-run o de pliPatches.
   - Opción B (mínima): deshabilitar los botones "Generar este horario" / "Generar todos" cuando hay PL virtual activo, con tooltip "Pulsa Guardar primero o usa Configurar curso óptimo".

3. **`extendCourseSuggestion` (botón "Extender el curso N días" del banner anual)**:
   - Archivo `HorariosEditor.jsx`, función que dispara `setExtendModalOpen(true)` y al confirmar hace PATCH a último PL real + PATCH grupo.
   - Refactor: en lugar de PATCH directo, push a `pendingTx.plsToUpdate` (si el último PL es real) o modifica el draft (si es virtual) + set `pendingTx.grupoFechaFin`.

**Cómo retomar (next session prompt)**:

```
examina index.md
# luego:
sigue con la parte 3 (Sliders PLI + solver dry-run sobre virtual)
```

El patrón ya está establecido en `applyPendingTxForGrupo` y `discardPendingTxForGrupo`. Estimación: 1-2 sesiones más para cerrar las 3 cosas pendientes.

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
| `hoja-de-ruta-periodos-lectivos.md` | **Fases 1-5 + 7 todas ✅** + **Opción A 2026-04-29**: `Materia.horasTotales` como objetivo curricular (ley LOMLOE) en lugar de `min × 36` rígido. **Fase 7 ✅ 2026-04-30**: calendario lectivo real del centro (datos BOJA AN 2025-26 vía `app:calendario:seed-escolar`, `CalendarioLectivoService` cuenta semanas descontando festivos, UI Centro con sugerencia, sustituidas las 36 hardcoded en HorariosEditor + CapacityPlanner). | Fase 6 (merge /admin/jornadas + /admin/horarios — cosmético, baja prioridad), Fase 8 (dashboard horas anuales para jefe de estudios) |
| `hoja-de-ruta-jornadas-recreos.md` | Fases A, C, D, G, **E ampliada** (D24=A en minutos). **§"PARCHE TEMPORAL" SUPERSEDED 2026-04-28** por periodos-lectivos sub-fase D | Fase B (asistente automático de tramos), Fase F (validador horarios afectados), Fase H (cache jornada en editor), **§14 sub-fases J-N** (minutosSemanales / capacity check / bloques largos / paralelismo refinado / round-up explícito) |
| `hoja-de-ruta-calendario-escolar.md` | **Fases 1+2+3 ✅** (modelo Provincia + Festivo.ambito + datos BOE 2025-26 cargados + UI Centros/Festivos). **Fase 5 ✅ SUPERSEDED 2026-04-30** absorbida por periodos-lectivos Fase 7 con datos reales BOJA AN 2025-26. | Fase 4 (Municipio + UI locales), Fase 6 (distribución temporal materias), Fase 7 (cron anual fetch BOE/BOJA — pendiente) |
| `hoja-de-ruta-calificaciones.md` | **Auditado 2026-04-29 + BD poblada (tarde)**: Fases A+B+C+D+E ✅ todas cerradas. `backup_tfg_full.sql` ahora contiene 174 tareas / 614 entregas / 614 calificaciones / 16 periodos / 87 ponderaciones / 725 asistencias / 17 mensajes / 10 comunicados / 87 temarios. Todos los archivos referencian a `Dummy.pdf` en MinIO. | B.1 validación Σ pesos=1.0 a nivel entidad (deuda menor; fixtures la cumplen pero la app no la fuerza). |
| `home-widgets-roadmap.md` | TablonWidget, NotificationList | Resto de widgets marcados 🔴 |
| `modernizacion-ui.md` | Manual vivo de modernización; varios plugins documentados | Sigue activo, registrar cada modernización nueva |

### 🔴 Atadas pero sin código

| Doc | Esfuerzo | Impacto comercial |
|---|---|---|
| `hoja-de-ruta-modalidad-imparticion.md` | **Fases 1-5 ✅ Done (2026-04-29 noche)**, queda Fase 6 (~0.5 sesión, solo PDF) | UI completa: el admin etiqueta modalidad de materias e imparticiones desde `/admin/materias` y `/admin/imparticiones`. Backend + editor + admin alineados. Solo falta sección "Otras horas curriculares" en PDF. |
| `hoja-de-ruta-pulido-ux.md` | ✅ Done 2026-04-28 (8 ítems en una sesión) | — (mover a 🟢 cerradas en próxima revisión del INDEX) |
| `hoja-de-ruta-cambio-turno.md` | ~1 sesión (Fase 1) | Bajo-medio: cola de solicitudes profe→admin para cambio mañana↔tarde con respuesta y notificación. Promovido desde `pulido-ux.md` #8 tras detectar que no existía la feature. Fase 2 (reasignación automática) diferida. |
| `hoja-de-ruta-curriculum-ccaa.md` | Fases 1+2 ✅ Done; quedan 3-9 (~5-8 sesiones) | **CRÍTICO**: sin Fase 3 (BOJA Andalucía) el solver sigue sin cuadrar para centros reales |
| `hoja-de-ruta-redis-workers.md` | Mercure + workers tiempo real | Bajo: polling actual aguanta hasta cierto volumen |
| `hoja-de-ruta-mejoras-tecnicas.md` | Plan extenso (CI, tests, A11y) | Deuda técnica; no producto, pero importante para mantenibilidad |
| `hoja-de-ruta-solver-bin-packing.md` | **Fases 1+2+3 ✅ Done (commit `6ef7be1`)**. Deuda residual aplazada (~1-2 sesiones futuras) | Bin-packing first-fit es default. Satura jornadas. Deuda residual: undershoot 81-88% en materias pequeñas con conflict profe (DIG, IPEI II), overshoot 116-123% en materias FP Mañanas por slot de 90 asimétrico. 4 ideas de resolución (A-D) en doc §7. Aplazado para priorizar Modalidad Fase 5. |

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
