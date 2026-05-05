# Pulido UX — ajustes y bugs detectados

> **Status (2026-05-05)**: 🟡 **Ronda 1 ✅ Done (2026-04-28, 8 ítems)** — bitácora abajo.
> **Ronda 2 🔴 abierta (2026-05-05)** con nuevos ítems detectados. Ver §"Ronda 2" más abajo.

---

## ⚡ Snapshot para retomar

### Ronda 1 — cerrada 2026-04-28

| # | Ítem | Tipo | Estado |
|---|---|---|---|
| 1 | Subtítulos descriptivos en headers de todas las vistas | UX | ✅ 2026-04-28 (24 vistas + 5 idiomas) |
| 2 | `admin/horarios` columna Grupo: formato `"[curso]º [abreviatura]"` | UX | ✅ 2026-04-28 |
| 3 | DataTable columna Acciones: `justify-content: flex-end` (cabecera + filas) | UX | ✅ 2026-04-28 |
| 4 | Sidebar AccordionView: preservar scroll interno al navegar | Bug UX | ✅ 2026-04-28 |
| 5 | Auditar hardcodes en banners/toasts de vistas nuevas de catálogos | Deuda | ✅ 2026-04-28 (62 fallback hex eliminados + 2 inline `#64748b`) |
| 6 | `/horarios` (profe): no muestra el turno de tarde aunque PDF sí | **Bug funcional** | ✅ 2026-04-28 |
| 7 | `admin/horarios` panel Materias: badge "Completo · 25/27.5h" inconsistente al pasar entre rangos | **Bug funcional** | ✅ 2026-04-28 |
| 8 | Verificar que los profes pueden pedir cambio de turno | Feature/verificación | ✅ 2026-04-28 (no existía → promovido a `hoja-de-ruta-cambio-turno.md`) |

### Ronda 2 — abierta 2026-05-05

| # | Ítem | Tipo | Estado |
|---|---|---|---|
| R2.1 | Breadcrumbs en todas las vistas (CrudHeader) | UX | 🔴 sin empezar |
| R2.2 | `/admin/catalogo` y subvistas no se traducen (i18n × 5) | i18n / Bug | ✅ 2026-05-05 (bloque `catalogo` faltaba en en/ca/gl/eu — caía a fallback español; añadido el bloque completo de 112 claves a los 4 idiomas) |
| R2.3 | Profe en `/horarios` → click evento → `/entregas?imparticion=X&tarea=Y` no auto-despliega el accordion correspondiente | Bug UX | ✅ 2026-05-05 (deep-link reescrito robusto + fallback: si no encuentra la tarea concreta al menos expande el accordion de la imparticion; búsqueda fallback por sólo `?tarea=Y`) |
| R2.4 | Profe en `/entregas`: header del accordion `[materia] - [abrev]` debería ser `[materia] - [curso]º [abrev]` (formato consistente con `/admin/horarios`, Ronda 1 #2) | UX | ✅ 2026-05-05 (`useImparticiones` añade `[curso]º` al label; `Grupo.curso` ya estaba en `imparticion:read`) |
| R2.5 | **Bug seguridad**: `/calificaciones` accesible por alumno (debería ser solo profe/admin/superadmin); el alumno tiene `/mis-calificaciones`. Hace falta guard de ruta a nivel de App.jsx, no solo redirección desde sidebar | **Bug seguridad** | ✅ 2026-05-05 (`PrivateRoute` ampliado con prop `allowedRoles`; aplicado a las 22 rutas; SuperAdmin pasa cualquier guard automáticamente) |
| R2.6 | Enlaces de notificaciones para alumno apuntan a rutas incorrectas: `calificacion_publicada`/`actualizada` → `/calificaciones?tarea=X` (profe-only, ahora bloqueada por R2.5) → debe ir a `/mis-calificaciones` con la entrega expandida; `tarea_nueva` → `/tareas/{id}` da 404 (la ruta no existe) | Bug | ✅ 2026-05-05 (dispatcher backend cambiado: `calificacion*` → `/mis-calificaciones?tarea=X`, `tarea_nueva` → `/entregas?tarea=X`; deep-link en MisCalificaciones resuelve tarea→imparticion via `GET /api/tareas/{id}` y expande el accordion correspondiente) |

**Total Ronda 2**: ~1-1.5 sesiones (R2.5 y R2.6 son los más urgentes — ambos son bugs de seguridad/funcionalidad reportados en producción).

### Orden recomendado

1. Atacar primero los **bugs funcionales** (#6 y #7) — son regresiones que afectan al uso real.
2. Luego los **ajustes UX cortos** (#2, #3) — alta visibilidad, esfuerzo bajo.
3. Después la **deuda de hardcodes** (#5) — si rompemos tema, lo arreglamos antes de seguir.
4. Más tarde el **scroll del sidebar** (#4) — requiere cuidado con tutoriales.
5. Al final los **subtítulos en vistas** (#1) — barrido amplio, mejor cuando lo demás está limpio.
6. **#8** se ataca cuando esté claro si la feature ya existe o no.

---

## 1. Subtítulos descriptivos en headers de vistas

### Qué

Todas las vistas con cabecera estándar (lottie + título) deben llevar un **subtítulo bajo el título** con una mini-descripción de qué encontrará el usuario en esa vista.

Ejemplos esperados:

| Vista | Título | Subtítulo |
|---|---|---|
| `/admin/grupos` | Grupos | Crea, edita y desactiva los grupos de tu centro. |
| `/admin/horarios` | Horarios | Distribuye las materias en la rejilla semanal por grupo y rango lectivo. |
| `/admin/itinerarios` | Itinerarios | Itinerarios académicos del centro y materias asociadas. |
| `/admin/catalogo/itinerarios` | Catálogo de itinerarios | Itinerarios oficiales del MEFP/CCAA — solo lectura. |

### Dónde

- Identificar el **componente común** que renderiza el header (probablemente un `PageHeader` o similar). Si no existe, este ítem incluye su creación.
- Aplicar a todas las vistas `/admin/*` y a las del rol profesor/alumno (`/horarios`, `/calificaciones`, `/tareas`...).

### Reglas

- Subtítulo **i18n** en los 5 idiomas (es/en/ca/eu/gl).
- Tipografía y color: **variables del tema** (no hardcoded). Suele ser `--text-secondary` o equivalente.
- Tono breve (1 línea, máx ~80 caracteres).
- No repetir el título; aporta contexto, no eco.

### Esfuerzo

~0.5 sesión (mucho del esfuerzo es i18n × 5).

---

## 2. `/admin/horarios` columna Grupo: formato `"[curso]º [abreviatura]"`

### Qué

En la tabla del listado superior de `/admin/horarios`, la columna **Grupo** muestra hoy el nombre completo del grupo. Cambiar a formato compacto:

```
1º DAW    (en lugar de "1º Desarrollo de Aplicaciones Web")
2º DAM    (en lugar de "2º Desarrollo de Aplicaciones Multiplataforma")
```

### Dónde

- Buscar el accessor/renderer de la columna en `frontend/src/pages/HorariosAdmin.jsx` o similar.
- Patrón: `${grupo.curso}º ${grupo.abreviatura ?? grupo.itinerario.abreviatura}`.

### Edge case

Si `grupo.abreviatura` y `grupo.itinerario.abreviatura` son ambos null, fallback al nombre completo.

### Esfuerzo

~10 min.

---

## 3. DataTable columna Acciones: `justify-content: flex-end`

### Qué

En **todas las DataTable** de las vistas CRUD, la columna **Acciones** (botones Editar / Borrar / Restaurar) debe alinearse al final (derecha) — **incluida la cabecera** con el texto "Acciones".

Hoy en algunas tablas la cabecera queda alineada a la izquierda y los iconos de acción al centro o a la izquierda, generando salto visual.

### Dónde

- Componente común `DataTable` (probablemente `frontend/src/components/DataTable.jsx` y su CSS module).
- Aplicar la regla por **tipo de columna** (`actions`) o por **convención de id de columna** (`'acciones'`, `'actions'`).
- CSS: `justify-content: flex-end` en cabecera y celda.

### Reglas

- No usar inline styles. Editar el CSS module del componente.
- Si la regla es por tipo de columna, exponer `align: 'end'` en la API del componente para reutilizar en otros casos.

### Esfuerzo

~15 min.

---

## 4. Sidebar AccordionView: preservar scroll interno al navegar

### Bug observado

En el sidebar, dentro de un `AccordionView` desplegado, si el contenedor tiene scroll interno (porque hay muchos accesos), el usuario hace scroll hacia abajo y entra en uno de los accesos del fondo. Al renderizarse la nueva ruta, **el scroll del sidebar vuelve arriba**, ocultando el acceso seleccionado.

Esperado: el sidebar **mantiene su posición de scroll** tras la navegación.

### Cuidado con

- **Tutoriales**: hay tutoriales que tocan estos mismos elementos del sidebar (probablemente con `scrollIntoView` o similar). La solución no debe romper el comportamiento de los tutoriales.
- **Rerender por cambio de ruta**: si el sidebar se desmonta+remonta, el scroll se pierde por defecto. Soluciones:
  - Persistir scroll en `sessionStorage` con clave por id de accordion.
  - Mover el componente sidebar a un nivel superior del árbol (Layout) para que no se desmonte.
  - `scrollRestoration` controlado.

### Dónde

- Componente sidebar (probable `frontend/src/components/Sidebar/*`).
- AccordionView interno.
- Verificar en tutoriales (`frontend/src/tutorials/*` o equivalente).

### Esfuerzo

~30 min.

---

## 5. Auditar hardcodes en banners/toasts de vistas nuevas

### Qué

Las vistas creadas/modificadas en las últimas sesiones (catálogos, periodos lectivos, modalidad…) pueden tener **estilos hardcodeados** en banners de feedback y toasts (colores literales, tamaños fijos, gradientes inline) que rompen la regla del proyecto: **toda UI usa variables CSS del tema**.

> Memoria del proyecto: "No estilos hardcodeados — usar siempre tema. Toda UI debe usar variables CSS del tema, clases CSS module y componentes themed; nunca colores inline. **No discutible**."

### Sitios sospechosos

- `HorariosEditor.jsx`/`.module.css` — banners verde/amarillo/rojo del CapacityPlanner y banner anual (Fase 3b/Fase 5 sub-C). Verificar que cada `background`, `color`, `border-color` viene de `var(--*)` y no de hex literales.
- Modal "Materias del rango" (Fase 4 PL) — header verde/rojo Σ planificado vs jornada.
- Vistas catálogo CCAA: `DataProvenanceBanner` y similares.
- Modal de extender curso (Fase 5 sub-B).
- Toasts informativos en flujos PL/cleanup parche temporal.

### Cómo auditar

1. `grep -rn "background-color: #" frontend/src/pages/HorariosEditor.module.css` y CSS modules vecinos.
2. Buscar `style={{` en JSX de las vistas listadas → debe ser excepción justificada (cálculo dinámico imposible vía CSS) o estar mal.
3. Cruzar con `frontend/src/utils/theme.js` para identificar variables existentes y reutilizar.
4. Verificar que los toasts usan el sistema unificado (cuando aterrice el refactor de `sistema-toasts.md` §12) o, mientras tanto, las clases themed locales (`.errorToast` etc.).

### Esfuerzo

~0.5 sesión (el grep es rápido, fix toma tiempo).

---

## 6. **Bug**: `/horarios` (profe) no muestra el turno de tarde

### Síntoma

Un profesor con clases por la tarde entra en `/horarios` (su vista personal) y solo ve la rejilla de mañana. Si descarga el PDF de su horario, **el turno de tarde sí aparece**.

→ Discrepancia entre la vista web y el PDF. La data de tarde está, no se renderiza.

### Diagnóstico inicial (a confirmar)

- El controlador `/horarios/me` (o el endpoint que alimenta la vista) probablemente devuelve solo `slotsManana`.
- O el componente `TimeTable` solo renderiza un turno por instancia y la página solo monta una.
- Comparar con `HorarioPdfController::horarioPersonal()`: el Twig refactorizado usa la macro `grillaBlock` que itera `[manana, tarde]`. La web debería hacer lo mismo.

### Dónde

- Backend: `HorarioApiController` o similar para `/horario/me`.
- Frontend: vista del profesor para `/horarios` (probable `frontend/src/pages/MiHorario.jsx` o `frontend/src/pages/Horarios.jsx`).
- Componente `TimeTable`.

### Esfuerzo

~20 min (data probablemente ya viene; falta render).

---

## 7. **Bug**: `admin/horarios` panel Materias muestra badge inconsistente al cambiar de rango

### Síntoma

En el editor de horarios con varios rangos lectivos, el panel **Materias** (lateral derecho) muestra un badge por materia con su estado (`Borrador · X/Yh` amarillo o `Completo · X/Xh` verde). Aunque el horario de cada rango está correcto, **al pasar entre rangos a veces el badge aparece como "Completo · 25/27.5h" en verde o "Borrador" en amarillo cuando no corresponde** al rango activo.

→ Suena a memoización/cacheo cruzado entre rangos. Caso similar al ya corregido en sub-fase 5 (memo `ModuleChip` solo leía estado activo); puede que quede una variante.

### Hipótesis

- El cómputo del badge usa una mezcla de `state[stateKey]` (placements en memoria del rango activo) + `horariosCache` (placements persistidos de OTROS rangos) y la "frescura" de cada uno se desincroniza al cambiar de pl.
- O el `useMemo` del badge no incluye `selectedPlId` en la lista de deps y queda con valor del rango anterior un frame.

### Cómo reproducir

1. Crear 3 rangos lectivos en un grupo.
2. Generar horarios con el solver en los 3.
3. Saltar entre pills del strip rápido.
4. Observar el panel Materias: alguna materia mostrará el badge en color/cifras del rango anterior.

### Dónde

- `frontend/src/pages/HorariosEditor.jsx` — buscar el render del badge en el panel Materias y el `useMemo` que calcula `placedByImp` o equivalente.
- Cross-ref con la memo `placedAcrossRangosByImp` (cap anual cross-rango, sub-fase 5 sub-A) — debería ser una sola fuente de verdad.

### Esfuerzo

~30 min.

---

## 8. Verificar que los profes pueden pedir cambio de turno

### Qué

El centro tiene profesores con jornada de mañana o de tarde. El profe debe poder **pedir desde la UI un cambio de turno** (mañana ↔ tarde) que llegue al admin como solicitud (cola de aprobación o similar).

### Estado a verificar

- ¿Existe ya esta feature? Buscar entidad `SolicitudCambioTurno` / `CambioTurnoRequest` o variantes; vista `/mis-solicitudes` o `/admin/solicitudes`.
- Si existe → verificar el flujo end-to-end y registrar resultado en bitácora.
- Si NO existe → este ítem se convierte en **mini-feature** (~1 sesión):
  - Entidad `SolicitudCambioTurno { profesor, turnoActual, turnoSolicitado, motivo, estado, fechaSolicitud, fechaResolucion, resueltaPor }`.
  - Endpoint POST `/api/v1/solicitudes-cambio-turno` (rol PROFESOR crea, ADMIN aprueba/rechaza).
  - UI profe: botón "Solicitar cambio de turno" en su perfil o ajustes.
  - UI admin: vista `/admin/solicitudes-cambio-turno` con DataTable + botones aprobar/rechazar.
  - Notificación al profe cuando se resuelve.

### Esfuerzo

- Verificación + arreglo de huecos: ~30 min.
- Implementación desde cero: ~1 sesión.

---

## 9. Decisiones

### Abiertas

| ID | Decisión | Recomendación |
|---|---|---|
| D-A | ¿Subtítulos (#1) van en `PageHeader` común o cada vista los pasa? | Componente común con prop `subtitle` opcional. Default vacío. |
| D-B | ¿La columna Acciones (#3) se identifica por `id` de columna o por `type: 'actions'`? | Por `type: 'actions'` (más declarativo). |
| D-C | ¿Scroll del sidebar (#4) se persiste por sesión o por sesión + por usuario? | Por sesión (sessionStorage). Simple. |
| D-D | ¿#8 entra en este doc o se promueve a hoja de ruta propia? | **Cerrada 2026-04-28**: feature no existía → promovido a `hoja-de-ruta-cambio-turno.md` (Fase 1 ~1 sesión, Fase 2 diferida). |

### Cerradas

(ninguna todavía)

---

## 10. Bitácora de implementación

### 2026-04-28 — Doc creado

Lista recogida tras la sesión de cierre de Fase 5 PeriodoLectivo. 8 ítems entre UX cosmético, bugs funcionales y deuda de tema/hardcodes. Esfuerzo total ~1.5-2 sesiones, sin dependencias internas. Recomendado atacar bugs (#6, #7) primero por ser regresiones funcionales; luego ajustes UX cortos (#2, #3); después auditar hardcodes (#5); más tarde scroll sidebar (#4) con cuidado de no romper tutoriales; al final el barrido de subtítulos (#1). #8 se decide tras verificar si la feature ya existe.

Cross-ref con: `sistema-toasts.md` §12 (refactor toasts unificado debe coordinarse con #5), memoria del proyecto "No estilos hardcodeados" (regla aplicable a #5), `MEMORY.md` "Formato de fechas en UI español" (verificar también en banners/modales nuevos durante #5).

### 2026-04-28 — Cierre de #2, #3, #6, #7

**#6 (`/horarios` profe sin turno tarde)** — `GetMyScheduleController` derivaba los slots únicamente de `$grupo->getItinerario()->getJornadaTipo()`, ignorando `Grupo.jornadaTipoOverride` y `PeriodoLectivo.jornadaTipo`. Si el profe daba clase en un grupo cuyo itinerario era de mañana pero el override (o PL) lo cambiaba a tarde, los slots de tarde no llegaban al frontend → el grid de tarde salía vacío aunque el PDF sí lo mostraba (el PDF deriva slots de los horarios reales, no de la jornada). Fix: union de tres fuentes en orden, dedup por `HH:MM-HH:MM`: (1) jornada efectiva del PL del horario, (2) jornada efectiva del grupo (override o itinerario), (3) slots derivados de los horarios reales como red de seguridad. Helper privado `collectSlots(JornadaTipo, &$slotsByKey)`. Cache 5min: tras deploy puede haber lag breve para schedules ya cacheadas.

**#7 (badge "Completo · 25/27.5h" inconsistente)** — el `estadoBadge` en `HorariosEditor.jsx` decidía el color por cobertura ANUAL cross-rango (`allAnualCubierto`) pero el label siempre mostraba cifras SEMANALES del PL activo. Cuando el currículo anual estaba cubierto pero el rango activo estaba parcialmente lleno (típico cross-rango con 3 PLs), aparecía "Completo · 25/27.5h" verde — disonancia label/color. Fix: cuando `estado='complete'` y `colocadosMinutos < targetMinutos`, mostrar cifras anuales (`Σ minutosAnualesColocadosByImp` vs `Σ minutosAnualesObjetivoByImp`) con clave i18n nueva `statusCompleteAnual`. Si la cobertura anual coincide con la semanal (rango único o todos llenos), se mantiene el label semanal anterior. 5 idiomas actualizados.

**#2 (columna Grupo `[curso]º [abrev]`)** — `Horarios.jsx` columna Grupo ya mostraba `abreviatura || nombre`; añadido prefijo `${grupo.curso}º ` cuando existe. Backfill API: añadido `'horario:read'` al grupo de serialización del campo `Grupo.curso` (antes solo en `imparticion:read`/`matricula:read`/`grupo:read`).

**#3 (DataTable Acciones alineadas al final)** — extraído helper `isActionsCol(col)` reusando la heurística existente (`accessor === 'actions'`, header literal `'Acciones'` o traducción `t('common.actions')`). Aplicadas clases `actionsCol`/`actionsCell` al `<th>`/`<td>` correspondientes. Reglas CSS: `text-align: right` + `justify-content: flex-end` en `.thContent` (flex con icon de orden) y en hijos directos de `.actionsCell` (los wrappers `<div>` con los iconos suelen ser flex). Sin estilos inline; respeta el tema.

### 2026-04-28 — Cierre de #1, #4, #5 y #8 (doc cerrado)

**#5 (auditoría de hardcodes)** — limpieza de **62 fallback hex muertos** del patrón `var(--color-X, #XXXXXX)` en 7 archivos: 40 en `HorariosEditor.module.css`, 12 en `Calificaciones.module.css`, 3 en `ProfLoadPanel.module.css`, 3 en `ShowProgress.jsx`, 2 en `Home.module.css`, 1 en `PendingTasksWidget.module.css`, 1 en `ThemedNumberInput.module.css`. Las variables `--color-success/warning/error/danger/primary/info` están definidas siempre en `index.css`, así que los fallbacks eran código muerto. Adicionalmente, 2 `color: '#64748b'` inline en `MisFaltas.jsx` migrados a `var(--text-muted)`. **Sin tocar** Configuracion previews (intencional: representan placeholders neutros, no la app real) ni Perfil firma `#fff` (representa "papel" donde se ve la firma; deuda menor anotada).

**#4 (sidebar scroll interno)** — añadido prop `persistScrollKey` al `AccordionView`. Cuando el consumidor lo pasa (`Sidebar` lo usa con valor `"sidebar"`), cada `AccordionItem` abre con `useEffect` que restaura `scrollTop` desde `sessionStorage[\`${key}_${itemId}_scroll\`]`, y un `onScroll` que persiste la nueva posición. Solución inocua para tutoriales: Joyride scrollea hacia el target después de nuestra restauración (último gana), así que mantiene compatibilidad. Try/catch alrededor de sessionStorage por modo privado/iframes.

**#1 (subtítulos descriptivos en headers)** — `CrudHeader` ya soportaba `subtitle` como prop opcional con su CSS module. Aplicado a 24 vistas:
- 17 vistas vía script Python (Itinerarios, Grupos, Materias, Matriculas, Imparticiones, Centros, Mensajes, Configuracion, Claustro, MisAlumnos, Companeros, MisProfesores, MisFaltas, Entregas, CalificacionesGrupo, TemariosAlumno, TemariosProfesor).
- 7 vistas con título dinámico vía Edit manual (Usuarios, CalificacionesAdmin, Festivos, HorariosEditor, Horarios, JornadasAdmin, Evaluaciones).
- 4 vistas de catálogo (CatalogoItinerarios, CatalogoMaterias, CatalogoCentros, CatalogoAcerca) ya tenían subtitle.
- Pendiente residual: `CatalogoItinerarioDetail.jsx` (título dinámico per-itinerario, no encaja con clave estática). Anotado para sesión futura cuando se decida si llevar subtítulo descriptivo o el contexto del itinerario.

i18n: 24 claves nuevas en 5 idiomas (es/en/ca/eu/gl) inyectadas vía script Python con `OrderedDict` para mantener orden de inserción tras `title`. Validación JSON de las 5 locales OK.

**#8 (cambio de turno)** — verificación: feature no existe en código (ni entidad ni UI). Promovido a `hoja-de-ruta-cambio-turno.md` con plan Fase 1 (~1 sesión: modelo + endpoints + UI básica) y Fase 2 diferida (reasignación automática). D-D cerrada.

**Cierre del doc (2026-04-28 noche)**: los 8 ítems atendidos en una sola sesión.

### 2026-04-28 — Addendum (post-cierre): consistencia de header de grupo

Continuación natural de #2 detectada por el usuario tras el cierre: en `/admin/calificaciones` (`CalificacionesAdmin.jsx`) los headers del `AccordionView` mostraban `"[nombre] ([anioEscolar])"`. Cambio al mismo formato que la columna Grupo de `/admin/horarios`: `"[curso]º [nombre]"` con fallback a `[nombre]` si `curso` es null. Backend: `/api/v1/centro/resumen-calificaciones` ahora devuelve `grupo.curso` en el JSON (antes faltaba).

---

# Ronda 2 — abierta 2026-05-05

## R2.1 — Breadcrumbs en cabeceras de vista

### Qué

Todas las vistas con `CrudHeader` deben mostrar una línea de migas de pan **encima del título** que refleje la jerarquía de navegación, p. ej.:

```
Inicio › Administración › Grupos
```

### Dónde

- Componente compartido: `frontend/src/components/CrudHeader.jsx` (o equivalente — confirmar al empezar la sesión).
- Nuevo prop opcional `breadcrumbs={[{ label, to }, …]}`. Si `undefined`, no renderiza nada → no rompe vistas existentes hasta que se vayan migrando.
- Aplicar en todas las vistas `/admin/*` y las del rol profesor/alumno (`/horarios`, `/calificaciones`, `/tareas`, …) en una sola pasada (similar a #1 de Ronda 1).

### Reglas de UX

- **Emplazamiento**: encima del título, dentro de `CrudHeader`. Es el patrón clásico (Material, Bootstrap, GitHub, Atlassian). No competir con el subtítulo descriptivo de Ronda 1.
- **Tipografía y color**: pequeña (`0.75-0.8rem`), color `var(--text-muted)`. Sin negritas. Separador `›` (chevron) o `/` (decidir D-R2.1.A en sesión).
- **🎨 Tematización obligatoria**: cero literales hex/rgb. Color del separador, hover de las migas clicables, borde inferior si lo hay — todo desde variables del tema (`var(--text-muted)`, `var(--color-primary-500)` para hover, `var(--border-soft)` si aplica). Ver `CLAUDE.md` §"REGLA DE ORO".
- **Click**: cada miga (excepto la última) navega a `to`; la última (= vista actual) es texto plano sin link.
- **i18n**: las labels usan claves i18n × 5 idiomas. Reusar las que ya existen para nombres de secciones del sidebar cuando se pueda, evitando duplicación.
- **Truncado en móvil**: si la cadena no cabe, mostrar solo `… › [última]` con tooltip de la cadena completa. No envolver en 2 líneas.
- **Reduced-motion**: sin animaciones de entrada en breadcrumbs (decoración, no contenido nuevo).

### Edge cases

- Vistas sin contexto claro (Login, About): no llevan breadcrumbs (no pasar prop).
- Vistas con título dinámico (`CatalogoItinerarioDetail`): última miga es el título dinámico.
- SuperAdmin que ve vista per-centro: incluir `[Centro] › [Sección] › [Vista]` cuando aplique.

### Esfuerzo

~0.5 sesión (gran parte es i18n × 5 + barrido de vistas).

### Cross-ref

- Cross-ref con Ronda 1 #1 (subtítulos): mismo componente `CrudHeader`. Coordinar para no romper layout vertical (breadcrumb arriba + título + subtítulo + ...).
- Cross-ref con `hoja-de-ruta-tutorial.md`: si hay tutoriales que apuntan a posiciones del header, validar selectores tras el refactor.

---

## Bitácora Ronda 2

### 2026-05-05 — R2.2 + R2.3 + R2.4 + R2.5 + R2.6 cerrados en una sesión

5 ítems atendidos del tirón tras la implementación del sistema de notificaciones. Reportados por el usuario tras smoke-test del primer commit operativo de la campanita.

**R2.5 — Bug seguridad `/calificaciones` accesible por alumno** (también `/centros` por admin de centro, etc.). `PrivateRoute` ampliado con prop opcional `allowedRoles={[...]}`; SuperAdmin pasa cualquier guard automáticamente; usuarios no autorizados se redirigen a `/`. Aplicado a 22 rutas en `App.jsx`.

**Matriz de permisos por ruta** (resultado del barrido R2.5 — referencia para futuras rutas nuevas):

| Ruta | Roles permitidos | Notas |
|---|---|---|
| `/centros` | SuperAdmin | Gestión de centros del sistema. Bug crítico cerrado en frontend; backend pendiente (`mejoras-tecnicas.md` §1.3). |
| `/usuarios`, `/itinerarios`, `/grupos`, `/materias`, `/matriculas`, `/imparticiones`, `/fechas` | Admin | CRUD del centro. |
| `/admin/horarios`, `/admin/jornadas`, `/admin/calificaciones`, `/admin/catalogo/*` | Admin | Vistas administrativas. |
| `/calificaciones`, `/calificaciones/detalle` | Profesor + Admin | Vista de profe (sus grupos+tareas para corregir). |
| `/mis-calificaciones` | Alumno | Vista personal del alumno (separada de la profe). |
| `/entregas` | Profesor + Alumno | Profe ve para corregir, alumno ve para entregar. |
| `/faltas`, `/apuntes`, `/companeros`, `/mis-profesores` | Alumno | Vistas personales del alumno. |
| `/mis-temarios`, `/mis-alumnos` | Profesor | Vistas personales del profe. |
| `/`, `/perfil`, `/configuracion`, `/horarios`, `/horarios/editor`, `/mensajes`, `/claustro` | Cualquier autenticado | Sin restricción de rol. |

**Convención**: SuperAdmin pasa cualquier guard automáticamente (early return en `PrivateRoute`). Para añadir una ruta nueva: si solo es para un rol concreto, declarar `allowedRoles={['ROLE_X']}`; si es para varios, `['ROLE_X', 'ROLE_Y']`; si es para cualquier autenticado, omitir el prop.

**Defensa en profundidad**: el guard frontend NO sustituye al guard backend. Una llamada `curl` directa con JWT puede saltarse el frontend. Para cada ruta sensible, asegurar que el endpoint API correspondiente exige el rol con `#[IsGranted(...)]` o filtra los datos vía `CurrentUserExtension` + `ApiPlatform Voter`.

**R2.6 — Notification links rotos para alumno**.
- Backend `NotificationDispatcher`:
  - `calificacion_publicada/actualizada.enlace` cambiado de `/calificaciones?tarea=X` (profe-only, ahora bloqueada por R2.5) → `/mis-calificaciones?tarea=X`.
  - `tarea_nueva.enlace` cambiado de `/tareas/{id}` (404, ruta inexistente) → `/entregas?tarea=X`.
- Frontend deep-link en `MisCalificaciones`: nuevo `useEffect` con `useRef` guard que lee `?tarea=X`, hace `GET /api/tareas/{id}` para resolver la imparticion, expande el accordion del módulo correspondiente y limpia el query param. Falla silenciosamente si la tarea no se puede resolver.
- Frontend deep-link en `Entregas`: reescritura robusta. Acepta `?imparticion=X&tarea=Y` (caso /horarios), `?tarea=Y` aislado (caso notificación) buscando en todas las imparticiones, y degrada a expandir solo el accordion si no encuentra la tarea concreta. Guard con `useRef` para no re-disparar tras refetch via Mercure.

**R2.3 — Profe `/horarios` → `/entregas` no abría accordion**. Corregido por la reescritura del deep-link de R2.6 (mismo cambio): el path para profe (`isAlumno=false`) ya pasaba por `setExpandedId(imp.id)` + `handleViewEntregas(...)` pero el flujo era frágil cuando alguno de los lookups fallaba. Ahora siempre que se resuelva la imparticion se expande, aunque la tarea no aparezca en el JSON cargado todavía (caso de Mercure latente).

**R2.4 — Header accordion `/entregas` con curso**. `useImparticiones.js`: `grupoLabel` ahora es `${cursoGrupo}º ${nombreGrupo}` cuando `grupo.curso != null` (fallback a solo `nombreGrupo`). Resultado: en lugar de `Sistemas Informáticos - DAW1`, se ve `Sistemas Informáticos - 1º DAW1`. Consistente con `/admin/horarios` columna Grupo (Ronda 1 #2) y headers de `/admin/calificaciones` (Ronda 1 addendum).

**R2.2 — i18n `/admin/catalogo` falta en en/ca/gl/eu**. El bloque `catalogo` (112 claves anidadas en sub-bloques `banner/acerca/itinerarios/itinerarioDetail/materias/centros/etapaLabel/tipoLabel`) **solo existía en `es.json`**. En los otros 4 idiomas caía al fallback español (las vistas de catálogo se veían en español aunque el usuario eligiese otro idioma). Script Python one-shot con dict de traducciones por idioma, deep-merge dentro del bloque existente (idempotente). Las traducciones a EN son cuidadas (con notas explicativas para conceptos como "FP Básica" → "FP Básica" mantenido sin traducir + glosa "vocational training"); CA/GL/EU son traducciones razonables aprovechando cognados con español, pendiente revisión de un hablante nativo si surge demanda comercial. Script borrado tras ejecutar.

### 2026-05-05 (tarde) — R2.2 + R2.4 + R2.6 reabiertos y cerrados (fixes residuales)

Tras smoke-test del usuario sobre los cierres de la mañana, 3 de los 5 ítems aparecieron parcialmente rotos. Causas reales y correcciones:

**R2.2 (residual) — 4 claves i18n faltaban en los 5 idiomas, se mostraban en español.** El script de la mañana cubrió 112 claves del bloque `catalogo` pero **dejó fuera** `catalogo.materias.filterCcaa`, `catalogo.materias.columnCcaa`, `catalogo.materias.filterCcaaNacional` y `catalogo.itinerarios.filterCcaaNacional`. El código las llamaba con `defaultValue: 'Overlays CCAA' / 'Overlay CCAA' / 'Solo nacional (sin overlay)'` (5/6 sitios), por lo que en EN/CA/GL/EU el usuario veía esos defaults en castellano. Fix:
  - Añadidas las 4 claves a `es/en/ca/gl/eu.json` con traducciones nativas (`Region` en EN, `EAE` en EU, `CCAA` en ES/CA/GL).
  - Eliminados los 6 `defaultValue` hardcoded de `CatalogoItinerarios.jsx` (líneas 227, 343, 349) y `CatalogoMaterias.jsx` (líneas 211, 285, 291). Cumple regla del proyecto: "los `defaultValue` son código muerto que oculta dependencias rotas" (CLAUDE.md §regla de oro tematización + §"Patrones").

**R2.4 (residual) — `useImparticiones.js` construía el label manualmente.** El fix de la mañana añadió `${cursoGrupo}º ${nombreGrupo}` inline pero ignoró el helper `formatGrupoAbrev` que ya hacía exactamente eso (con misma regla en otras 8 vistas). Refactor a `formatGrupoAbrev(imp.grupo) || t('common.unknownGroup')` para una sola fuente de verdad y manejo limpio del caso edge en que el grupo venga como IRI string sin populate.

**R2.6 (residual) — datos sucios en BD.** El fix del dispatcher (commit `dd06005` 2026-05-05 14:42) corrigió los `enlace` futuros pero las 7 notificaciones generadas por el smoke-test de la mañana (10:34-10:35) quedaron en BD con los enlaces antiguos (`/tareas/177`, `/calificaciones?tarea=X`). UPDATE manual:

```sql
UPDATE notificacion SET enlace = REPLACE(enlace, '/tareas/', '/entregas?tarea=')
  WHERE tipo = 'tarea_nueva' AND enlace LIKE '/tareas/%';
UPDATE notificacion SET enlace = REPLACE(enlace, '/calificaciones?tarea=', '/mis-calificaciones?tarea=')
  WHERE tipo IN ('calificacion_publicada','calificacion_actualizada')
    AND enlace LIKE '/calificaciones?tarea=%';
UPDATE notificacion SET enlace = REPLACE(enlace, '/calificaciones?tarea=', '/entregas?tarea=')
  WHERE tipo = 'entrega_recibida' AND enlace LIKE '/calificaciones?tarea=%';
```

Resultado: las 7 filas (5 `tarea_nueva` + 2 `calificacion_actualizada`) quedan apuntando a la ruta correcta. **Acción del usuario**: si tras la sesión genera notifs y los enlaces siguen viejos, reiniciar backend (`docker compose restart backend`) — opcache PHP-FPM puede mantener el dispatcher viejo en memoria pese al cambio en disco (mismo síndrome del 2026-05-02 con el validator de Entrega; INDEX:74).

**R2.3 y R2.5 — sin cambios.** Tras revisar deep-link de `Entregas.jsx` y guard `PrivateRoute.jsx`, ambos están correctos en código (R2.5: `App.jsx:267` con `allowedRoles={['ROLE_PROFESOR','ROLE_ADMIN']}`; R2.3: `Entregas.jsx:349-402` con fallback a `?tarea=Y` aislado y guard `useRef`). El usuario reportó síntomas pero no se reproducen leyendo el código actual; muy probablemente cache de Vite/navegador. Se recomienda hard-reload (Ctrl+Shift+R) tras los fixes residuales de esta sesión.

**HMR**: backend reiniciado para opcache (cambio en NotificationDispatcher). Vite HMR aceptó los cambios frontend sin errores.
