# Hoja de ruta: editor gráfico de horarios

> Documento vivo. Refleja las decisiones acordadas y el orden de ejecución.
> No es una especificación cerrada: sirve como guía de nuestra conversación.

---

## 0. Estado actual (2026-04-15)

### ✅ Completado

**Fase 1 — MVP drag & drop**
- [x] `HorariosEditor.jsx` + `HorariosEditor.module.css` creado.
- [x] Librería `@dnd-kit/core` integrada.
- [x] Drag módulo → celda vacía, celda → panel (borrar), celda → celda (mover/swap).
- [x] Swap correcto: el POST usa las horas derivadas del *key* del placement
      (no del objeto v) para evitar desincronización de posiciones en swaps.
- [x] Contador de horas pendientes por módulo en el panel.
- [x] Selector cascada **año escolar** → **grupo** con estado persistente
      en memoria al cambiar de selección.
- [x] Botón Guardar con diff vs baseline (DELETE + POST individuales; batch
      en fase 5).
- [x] Indicador de estado: Completo / Borrador (≥80%) / Incompleto.
- [x] Aviso `beforeunload` al salir con cambios sin guardar.
- [x] Cache-busting en fetches para reflejar cambios en la vista del alumno
      (`/api/my-schedule?_=ts` + `Cache-Control: no-cache`).
- [x] i18n completa (`scheduleEditor.*`, `profLoad.*`) en los 5 idiomas.
- [x] 100% tematizable (tokens CSS, paleta por módulo derivada del hue).

**Fase 2 — Validaciones duras en vivo**
- [x] `validateDrop()` con reglas: horas restantes, celda vacía (desde panel),
      profesor libre en grupos paralelos (mismo centro, mismo turno).
- [x] Highlight visual de celdas durante el drag: verde (válida),
      rojo (inválida), azul (cursor encima).
- [x] Rechazo con toast explicativo abajo-derecha; autoelimina a 4 s.
- [x] Swap valida ambas direcciones (item→destino + item del destino→origen).

**Fase 4 (parcial) — Detalles UX**
- [x] Swap/drag entre celdas (movido a Fase 1 de facto).
- [x] Tooltip `title` en bloques con módulo + profe + aula.
- [x] Paleta por módulo (HSL derivado de `modulo.id`).

**Accesos y arquitectura**
- [x] Ruta `/admin/horarios` (admins/superadmin) con dos pestañas integradas
      en el `CrudHeader` central: **Editor gráfico** (por defecto) y **Lista**.
- [x] `/horarios` queda como vista general read-only para alumnos/profes/admins
      (calendario personal, sin CRUD).
- [x] `Horarios.jsx` y `HorariosEditor.jsx` aceptan `embedded` + `tabs` props
      para convivir en `HorariosAdmin.jsx` sin duplicar Layout/container.

**Trabajo transversal hecho mientras construíamos el editor**
- [x] `ThemedSelect` — componente unificado de select con trigger idéntico
      al `<select>` nativo de CRUD (bg-input sin borde) y dropdown custom
      tematizado. Migrados **todos** los selects de filtro de todas las
      vistas CRUD (Grupos, Matrículas, Módulos, Usuarios, Ciclos, Imparticiones,
      Festivos, Evaluaciones, Entregas, Materiales, Compañeros, Claustro,
      MisAlumnos/Profesores/Faltas, Calificaciones* + SearchBar + SuperAdminFilters).
- [x] `ThemedNumberInput` — input numérico con spinners `+`/`−` tematizados.
      Aplicado en: Ponderación global, Peso por item, edición de notas en
      `/calificaciones/detalle`.
- [x] `CrudHeader` con slot `middle` (grid `auto 1fr auto`) → tabs fijos
      al cambiar entre vistas; usado en `/fechas` y `/admin/horarios`.
- [x] Corrección del fixture: `dia_semana = 1..5` (convención del frontend);
      el turno de cada grupo se infiere por ciclo (WEB=M, MULTIPLATAFORMA=T);
      grupo con un aula fija.

**Carga del profesorado (adición al plan original)**
- [x] `ProfLoadPanel` — componente reutilizable que ocupa el ancho completo
      bajo el editor. Dos columnas internas con barras 0-40h coloreadas
      (verde <24h, azul 24-35, amarillo 36-40, rojo >40 con "+Xh extra").
- [x] Cálculo combinado: horas en otros grupos (fetch estable) + horas del
      grupo actual (live desde `placements`).
- [x] Fix del `profesor.id` vía `@id` en respuestas de `/api/horarios` (no
      serializa `id` por defecto en el grupo `horario:read`).

**Fase 3 — Constraint solver (autogeneración)**
- [x] Endpoint `POST /api/v1/horarios/solver/{grupoId}` (`HorarioSolverController`).
- [x] `src/Service/HorarioSolver.php` con backtracking + heurística
      (mismo módulo compacto por día máx. 2h, prioriza profes más restringidos
      por paralelos, timeout 2 s).
- [x] Botón **"✨ Sugerir horario"** + **"🔀 Sugerir otra"** (con seed) en el editor.
- [x] Solución parcial: devuelve `unplaced` y el cliente muestra toast con
      módulos/horas sin colocar; el resultado se pinta en el estado (no persiste
      hasta Guardar, que reutiliza el diff de Fase 1).

### ⏳ Pendiente

**Fase 4 — Tap-to-place (móvil) restante** ✅
- [x] Tap en módulo del panel → queda seleccionado (highlight). Tap en celda
      válida → coloca. Tap en otra celda ocupada → reemplaza. Tap sin selección
      sobre una celda ocupada → la libera. ESC deselecciona.
- [x] Tooltip rico en hover sobre los bloques (módulo + profe completo + aula),
      tematizado, sin clipping (se quitó `overflow:hidden` del contenedor).
- [x] Modal custom al salir sin guardar (vía `useBlocker` de RR v7 +
      `ModalView` reutilizado): cubre navegación SPA con tres opciones
      (Quedarme / Descartar / Guardar y salir). Migrado `App.jsx` a
      `createBrowserRouter` + `createRoutesFromElements` para habilitarlo.

**Fase 5 — Batch endpoint y concurrencia** ✅
- [x] `POST /api/v1/horarios/batch` transaccional (`HorarioBatchController`):
      acepta `[{op:'create'|'delete', ...}]`, todo dentro de `beginTransaction`
      con rollback ante cualquier fallo. Devuelve mapping `clientKey → id` y
      el `maxUpdatedAt` resultante.
- [x] Cliente reescrito: `handleSave` construye operaciones desde el diff
      baseline→current y dispara una sola petición. Sin más bucles de
      DELETE/POST individuales.
- [x] Detección de concurrencia: el cliente captura `baselineMaxUpdatedAt` al
      cargar; el backend compara contra `MAX(updatedAt)` actual. Si difiere
      → 409 + modal "alguien editó este horario, ¿recargar?".
- [x] Confirmación al publicar horario incompleto: si `estado !== 'complete'`
      al pulsar Guardar, modal con la lista de módulos/horas sin colocar y
      botones "Cancelar" / "Publicar igualmente".

**Fase 6 — Nice-to-have**
- [ ] Vista multi-grupo en una pantalla.
- [ ] Exportar horario del grupo a PDF.
- [ ] Plantillas (guardar y replicar).
- [ ] Histórico de cambios (auditoría).

**Fase 7 — Excepciones puntuales (sustituciones / cancelaciones)**

Hoy `Horario` es una plantilla semanal recurrente: cualquier cambio
afecta a TODOS los lunes (etc.). Falta poder registrar cambios para un
día concreto sin tocar la plantilla.

- [ ] Backend: entidad `HorarioOverride` con `fecha` (DATE), `horaInicio`,
      `horaFin`, `imparticion` (nullable → cancelado), `motivo`, `creadoPor`,
      timestamps + soft delete. Migración Doctrine.
- [ ] Endpoints CRUD (`/api/horario_overrides`) + filtros por fecha/grupo.
- [ ] `GET /api/my-schedule` y vistas de calendario: mezclar template +
      overrides para la fecha pedida (override gana sobre el template).
- [ ] UI: en `/horarios` (calendario), click en un slot de un día concreto →
      modal "esta instancia": sustituir profesor/módulo, cancelar clase,
      restaurar plantilla. Sin ruta nueva.
- [ ] Indicador visual en los slots con override (badge "modificado").
- [ ] Permisos: solo admin/coordinador puede crear/editar overrides.
- [ ] El editor gráfico de `/admin/horarios` sigue editando SOLO la
      plantilla; mostrar aviso si hay overrides futuros que se verían
      afectados al cambiar la plantilla base.

### 🐛 Bugs conocidos / deuda técnica

- [ ] Al cambiar de pestaña en `/admin/horarios` (Editor ↔ Lista), el estado
      en memoria del editor se pierde (el componente se desmonta). Fix:
      elevar `state` y `imparticiones` a `HorariosAdmin` o mantener ambos
      montados con `display: none`.
- [ ] Si el admin edita el horario desde otra sesión, la actual no lo detecta
      hasta recargar (pendiente de Fase 5).
- [ ] Los horarios preexistentes del dump `backup_tfg_full.sql` usaban
      `dia_semana = 0..4`. Queda corregido para nuevos; si alguien restaura
      un dump muy antiguo habrá que re-aplicar el `+1`.

---

## 1. Objetivo

Sustituir la creación manual de horarios vía CRUD (`/horarios` → botón
"editar CRUD") por una **interfaz gráfica intuitiva** que permita al admin/
coordinador construir el horario de cada grupo con dos flujos complementarios:

1. **Generación automática** (constraint solver) que propone un horario
   válido como punto de partida.
2. **Ajuste manual** (drag & drop o tap-to-place) para afinar el resultado,
   con validación en vivo que **impide colocar algo que incumpla las reglas**
   (horas restantes, turno, profesor en conflicto).

La vista actual seguirá existiendo como *fallback* y como exportación
tabular, pero el flujo principal será el nuevo editor.

## 2. Problema actual

- Crear el horario de cada grupo implica ~30 altas manuales en un DataTable.
- No hay feedback visual: un profe puede acabar doble-asignado en la misma
  franja en grupos paralelos sin que el sistema lo avise.
- No se muestra el progreso: ¿cuántas horas de cada módulo quedan por
  colocar? ¿encaja la suma en las 30 franjas del turno?
- Los festivos y el turno del grupo no aparecen en ningún feedback
  durante la edición.

## 3. Propuesta funcional (UX)

### 3.1 Layout

```
┌──────────────────────────────────────────────────────────────────────┐
│  Editor de horarios                              [Grupo: 1º DAW  ▾]  │
├──────────────┬───────────────────────────────────────────────────────┤
│  Módulos     │                    Lun   Mar   Mié   Jue   Vie       │
│              │   08:30 – 09:30   ┌───┐ ┌───┐ ┌───┐ ┌───┐ ┌───┐       │
│  ▣ Prog.     │                   │PRG│ │BDD│ │   │ │LM │ │PRG│       │
│    8h · 3/8  │   09:30 – 10:30   ┌───┐ ┌───┐ ┌───┐ ┌───┐ ┌───┐       │
│              │                   │SI │ │PRG│ │BDD│ │SI │ │ED │       │
│  ▣ BDD       │   10:30 – 11:30   ...                                 │
│    6h · 1/6  │                                                       │
│              │   11:30 – 12:30                                       │
│  ▣ Sistemas  │                                                       │
│    6h · 0/6  │   12:30 – 13:30                                       │
│              │                                                       │
│  ✓ FOL       │   13:30 – 14:30                                       │
│    3/3 OK    │                                                       │
│              │                                                       │
│  [+ Asignar] │  ⓘ  Aula fija: Aula 12 · Turno mañana · 28/30 franjas │
└──────────────┴───────────────────────────────────────────────────────┘
```

### 3.2 Interacciones principales

| Acción                            | Comportamiento                                              |
|---                                |---                                                          |
| Arrastrar módulo → franja vacía   | Crea 1 hora de horario. Decrementa horas pendientes.       |
| Arrastrar franja ocupada → panel  | Elimina ese horario. Restituye 1h al módulo.               |
| Arrastrar franja → otra franja    | Mueve (swap si hay otra cosa en destino).                   |
| Hover sobre módulo                | Las franjas donde ese módulo PUEDE colocarse se tintan.     |
| Hover sobre franja                | Muestra tooltip con módulo, profesor, aula.                 |
| Cambiar de grupo en el selector   | La parrilla cambia. El estado del grupo anterior se        |
|                                   | conserva en memoria (sin perder cambios no guardados).      |
| Botón **Guardar**                 | Persiste en BD vía batch update de `/api/horarios`.         |
| Botón **+ Asignar**               | Abre modal para crear una nueva imparticion en este grupo. |
| Botón **✨ Sugerir horario**       | Llama al backend, resuelve, pinta la propuesta. Se puede    |
|                                   | editar a mano después. Confirmación si había cambios       |
|                                   | previos (se sobrescriben).                                  |
| **Tap-to-place** (móvil/tablet)   | Tap en un módulo del panel → queda seleccionado (resalte). |
|                                   | Tap en una franja válida → lo coloca. Tap en franja         |
|                                   | ocupada → la libera. Tap en el módulo seleccionado otra    |
|                                   | vez → deselecciona.                                         |

### 3.3 Reglas de validación (en cliente, antes del drop)

1. **Horas pendientes > 0** para ese módulo. Si no, el drop se rechaza.
2. **Franja coherente con el turno** del grupo (si el turno es mañana y
   arrastras a una franja de tarde, no se permite — aunque el selector
   ya filtra por turno, se valida igualmente).
3. **Profesor libre en paralelo**: si la misma franja en el grupo paralelo
   (mismo turno, mismo centro) ya tiene al mismo profe asignado → rechazo
   con mensaje.
4. **Aula**: como cada grupo tiene aula fija, no hay conflicto de aulas
   entre grupos.
5. **Festivo**: no bloqueante (el horario es semanal recurrente), pero
   opcionalmente se puede pintar un indicador si el día coincide con
   festivo próximo.

Las cuatro primeras son **duras** (bloquean el drop).

### 3.4 Estado visual

- Módulo en el panel:
  - `✓`  verde si ya está 100% colocado.
  - `▣`  amarillo si quedan horas.
  - `!`  rojo si se ha desbordado (no debería pasar con validación en
    vivo, pero existe como safety net).
- Franja: color del módulo (una paleta por módulo del grupo) + iniciales
  o abreviatura del módulo.
- Franja con conflicto en grupo paralelo: borde rojo punteado.

### 3.5 Persistencia y navegación

- El estado del editor de cada grupo se guarda en memoria (contexto React)
  durante la sesión. Cambiar de grupo en el selector **no pierde** cambios
  no guardados.
- "Guardar" confirma en BD. Aviso al salir sin guardar (`beforeunload`).
- Si otro admin ha modificado el horario desde otra sesión, al guardar se
  detecta (comparación de `updated_at`) y se ofrece recargar.

### 3.6 Estado del horario (completitud)

Se permite guardar horarios **parciales**, pero la UI deja claro el grado
de completitud. Tres estados calculados (no hay columna nueva en BD):

| Estado         | Condición                                       | Indicador            |
|---             |---                                              |---                    |
| **Completo**   | Todas las horas de todos los módulos colocadas  | ✅ Verde, "Completo"  |
| **Borrador**   | Alguna hora sin colocar, pero ≥ 80% cubierto    | ⚠️ Amarillo, "Borrador" |
| **Incompleto** | < 80% de cobertura                              | ⛔ Rojo, "Incompleto"   |

Al intentar publicar (ver fase 4) un horario que no está **Completo**, la
app pide confirmación explícita indicando qué módulos/horas faltan.

Se guarda siempre (no bloqueamos el trabajo en progreso), pero el estado
visible permite al admin saber si el horario está listo o no.

## 4. Decisiones técnicas

### 4.1 Frontend

- **Librería DnD: [`@dnd-kit/core`](https://dndkit.com/)**. Moderna,
  mantenida, accesible (teclado + ARIA), compatible con touch. ~10 kB.
  Descartadas:
  - `react-beautiful-dnd`: discontinuada.
  - HTML5 DnD nativo: tosco, problemas en móvil.
  - `react-dnd`: API compleja y pesada para lo que necesitamos.
- **Componente principal**: `HorariosEditor.jsx` dentro de `pages/`,
  accesible desde `/horarios?editor=true` o botón "Editor gráfico" en
  la vista actual.
- **Subcomponentes**:
  - `ModulosPanel` — panel lateral con `<DraggableModule>` y contador.
  - `ParrillaSemanal` — grid 5×6 de `<SlotDroppable>` con `<SlotBlock>`
    dentro si está ocupado.
  - `SelectorGrupo` — select arriba.
  - `BarraInfo` — aula, turno, progreso global.
- **Estado**: `useReducer` + contexto. Un reducer centraliza las acciones
  (`PLACE`, `REMOVE`, `SWAP`, `LOAD_GROUP`, `SAVE`).
- **Validación en vivo**: función pura `canDrop(source, target, state)` que
  devuelve `{ ok: bool, reason?: string }`. Se llama desde los eventos de
  `dnd-kit`.
- **Persistencia entre grupos**: estado en memoria (dict
  `{ grupoId: parrilla }`). Al cambiar el selector, se lee de memoria y,
  si no existe, se carga desde el backend.

### 4.1.0 Internacionalización (NO negociable)

Todo el texto visible por el usuario debe pasar por `react-i18next` (`useTranslation` + `t()`).
Nada de strings hardcodeados en JSX ni en mensajes de error.

Reglas:

- Cada componente nuevo añade sus claves a los JSON de `frontend/src/i18n/locales/*.json`
  (al menos `es.json` y `en.json`).
- Las claves se agrupan por dominio: `scheduleEditor.*`, `profLoad.*`, `themedSelect.*`, etc.
- Para contadores y plurales se usa interpolación: `t('panelModules', { count })`.
- Los días de la semana y comunes viven en `days.*`, `common.*` — NO duplicar.
- Para `title` / `aria-label` / `alert()` también se usa `t()`.
- Los mensajes de error (ej. motivos de rechazo de un drop) son claves separadas
  con `{{placeholder}}` para interpolar el contexto dinámico.

Verificación: cambiar `i18n.language` en runtime y comprobar que el editor se
traduce completamente sin fragmentos sueltos.

### 4.1.1 Coherencia visual (NO negociable)

Todo el editor debe usar **exclusivamente las variables CSS del tema
activo** (definidas en `personalizacion` y propagadas por `utils/theme.js`).
Nada de colores, radios, sombras ni tipografías hardcodeados.

Reglas:

- Colores: `var(--color-primary)`, `var(--color-success)`,
  `var(--color-error)`, `var(--bg-card)`, `var(--text-main)`,
  `var(--border-color)`, etc. — los mismos tokens que ya usan el resto
  de vistas (`Calificaciones.module.css`, `DataTable`, `Sidebar`…).
- Radios: `var(--radius-sm)`, `var(--radius-md)`.
- Espaciado: `var(--space-1..12)`.
- Tipografía: `var(--text-xs..lg)`, `var(--font-medium..bold)`.
- Los **bloques de módulo** en el panel deben derivar su color de
  acento del tema (no una paleta fija ajena). La paleta "por módulo"
  (§3.4) se calcula como variaciones de hue partiendo de
  `--color-primary` (HSL shifts deterministas por `modulo.id`).
- En **modo oscuro** (si el tema lo tiene), todos los estados
  (válido/inválido/hover/selección) deben seguir siendo legibles.
- La **barra de completitud** (Completo/Borrador/Incompleto) usa
  `--color-success / --color-warning / --color-error` ya existentes.
- **CSS Modules** consistente con el resto: `HorariosEditor.module.css`.

Se verifica manualmente cambiando el tema del centro (p. ej. EAG con su
paleta violeta) y comprobando que el editor sigue viéndose coherente
con el Sidebar, Header y DataTables.

### 4.2 Backend

Reutiliza lo que ya existe. Cambios mínimos:

- `GET /api/horarios?imparticion.grupo={gid}` — ya funciona.
- `POST /api/horarios` — ya funciona.
- `DELETE /api/horarios/{id}` — ya funciona.
- `PUT /api/horarios/{id}` — ya funciona.
- **Nuevo**: `POST /api/v1/horarios/batch` — acepta un array de
  operaciones (`create`, `update`, `delete`) en una sola transacción.
  Justificación: al guardar el estado completo del grupo se pueden
  generar decenas de cambios; un solo POST es más robusto.
- **Nuevo**: `POST /api/v1/horarios/solver/{grupoId}` — el backend
  resuelve el horario de ese grupo respetando las reglas y devuelve una
  propuesta (no persiste). El cliente la pinta; si el admin pulsa
  Guardar, se aplica vía el endpoint batch.

#### 4.2.1 Constraint solver (backend)

- Entrada: `grupoId`. El servicio lee imparticiones del grupo, módulos,
  horas_semanales, turno, y horarios de los grupos paralelos (para evitar
  conflicto de profe).
- Algoritmo: **backtracking con heurística**. Para cada imparticion se
  ordenan las franjas candidatas por:
  1. Franjas donde el profe no tiene clase en el grupo paralelo.
  2. Franjas del mismo día que otras horas del mismo módulo (bloques
     compactos).
  3. Resto.
  Si no encuentra solución para una imparticion, hace backtrack y reasigna.
- Salida: JSON con la propuesta `[{dia, hora_inicio, hora_fin, aula,
  imparticion_id}, ...]`. Si no hay solución completa, devuelve la
  mejor propuesta parcial + `unplaced: [{imparticion_id, horas}]`.
- Implementación: servicio PHP en `src/Service/HorarioSolver.php`,
  determinístico (misma entrada → misma salida) con seed opcional para
  diversificar propuestas si el admin pulsa "Sugerir otra".
- Timeout defensivo: 2 segundos. Si el solver no termina, devuelve la
  mejor parcial encontrada.

### 4.3 Relación con `/imparticiones`

**Decisión: se mantiene `/imparticiones` como vista independiente**.

Razones:
- Es la fuente de verdad de "quién imparte qué módulo en qué grupo".
- Se gestiona antes de empezar a montar el horario (contratación del
  profesorado).
- Unificarlas forzaría a decidir franjas al crear la imparticion, que no
  siempre es el flujo real.

Atajos desde el editor:
- Botón **+ Asignar módulo al grupo** abre el modal de imparticion ya
  existente, precargado con el grupo actual.
- Si un admin borra una imparticion desde `/imparticiones`, sus horarios
  se eliminan en cascada (ya lo hace actualmente el `SoftDeleteProcessor`).

## 5. Modelo de datos (sin cambios)

Se aprovecha el esquema existente:

- `imparticion` (profesor, módulo, grupo) — inmutable desde este editor.
- `horario` (dia_semana, hora_inicio, hora_fin, aula, imparticion_id) —
  se crea/modifica/elimina masivamente desde este editor.
- `modulo.horas_semanales` — límite superior de horas a colocar por
  módulo.

## 6. Fases

### Fase 1 — MVP funcional drag & drop (1-2 días)

- `HorariosEditor.jsx` con layout básico.
- `dnd-kit` integrado.
- Drag & drop de módulo → franja vacía.
- Drag & drop de franja → panel (borrar).
- Contador de horas pendientes por módulo.
- Botón Guardar → N peticiones individuales (batch llega en fase 5).
- Selector de grupo con persistencia en memoria.
- Indicador de estado (Completo / Borrador / Incompleto).

### Fase 2 — Validaciones duras en vivo (0.5-1 día)

- `canDrop` con las 4 reglas (horas, turno, profe, aula).
- Feedback visual al intentar drops inválidos.
- Mensaje de error claro ("Profesor ya asignado en 1º DAM a esta hora").
- Highlight de franjas válidas al seleccionar un módulo.

### Fase 3 — Constraint solver (autogeneración) (1-1.5 días)

- Endpoint `POST /api/v1/horarios/solver/{grupoId}`.
- `src/Service/HorarioSolver.php` con backtracking + heurística.
- Botón **"✨ Sugerir horario"** en el editor.
- Soporte para solución parcial (devuelve lo que ha podido colocar y
  marca las imparticiones sin ubicar).
- Botón "Sugerir otra" con seed distinto para explorar alternativas.
- El resultado se pinta en el estado del editor (no persiste hasta
  Guardar). El admin puede reajustar a mano después.

### Fase 4 — Tap-to-place (móvil) + swap (0.5-1 día)

- Modo click/tap en paralelo al drag:
  - Tap módulo → queda seleccionado.
  - Tap franja → coloca (si es válida).
  - Funciona idéntico en desktop (los usuarios con ratón pueden elegir).
- Drag de franja a franja (mover o intercambiar) — desktop.
- Tooltip en hover.
- Paleta de colores por módulo.
- Advertencia al salir sin guardar.

### Fase 5 — Batch endpoint y concurrencia (0.5 día)

- `POST /api/v1/horarios/batch` en backend (transaccional).
- Cliente usa batch en vez de N peticiones.
- Manejo de concurrencia: comparación de `updated_at` para detectar si
  otro admin modificó desde que cargamos.
- Al publicar horario no completo, confirmación explícita listando
  las imparticiones con horas sin colocar.

### Fase 6 — Futuro / nice-to-have

- **Vista multi-grupo** en una pantalla (útil cuando haya 10+ grupos).
- **Exportar a PDF** del horario del grupo.
- **Plantillas**: guardar el horario de un grupo como plantilla y
  aplicarla a otro grupo (ajustando imparticiones).
- **Histórico de cambios** (quién movió qué y cuándo).

## 7. Cuestiones abiertas

1. ✅ **Resuelto**: permitimos guardar horarios parciales con indicador
   de completitud (ver §3.6). La publicación requiere confirmación si
   no está completo.
2. Horarios preexistentes (los regenerados con `regen_fixtures.py`) se
   cargan desde BD al abrir el editor. El admin puede partir de ellos,
   regenerarlos con el solver o empezar de cero (botón "Vaciar grupo").
3. ✅ **Resuelto**: tap-to-place en móvil se implementa en fase 4 en
   paralelo al drag de escritorio.
4. Histórico de cambios — fuera de alcance MVP, fase 6 opcional.
5. Pendiente decidir: ¿vincular el estado "Completo" a una columna
   `publicado` en `grupo` para separar "borrador del coordinador" vs
   "horario oficial que ve el alumno"? Podría ser útil; lo evaluamos
   al cerrar fase 5.

## 8. Riesgos

- **DnD en táctil**: en tablets puede entrar en conflicto con scroll
  de la página. Mitigación: `dnd-kit` permite `activationConstraint`
  con distancia mínima de arrastre.
- **Rendimiento**: 4 grupos × 30 franjas × múltiples validaciones por
  drop. No es problema. Si crece a 50+ grupos, re-evaluar.
- **Conflictos entre admins**: dos admins editando el mismo grupo
  simultáneamente. Mitigación en Fase 4 (detección por `updated_at`).

## 9. Criterios de aceptación del MVP

Fase 1-2 (básico + validaciones):
- [ ] Un admin puede abrir `/horarios`, cambiar a editor gráfico, elegir
      un grupo y ver su horario actual.
- [ ] Puede arrastrar módulos del panel a la parrilla y viceversa.
- [ ] Las horas pendientes por módulo se muestran y actualizan en vivo.
- [ ] Al intentar un drop inválido (horas excedidas, profe ocupado),
      el sistema lo impide con mensaje claro.
- [ ] Al pulsar Guardar, los cambios se reflejan en BD y la vista
      tabular (`/horarios`) coincide.
- [ ] Cambiar de grupo en el selector no pierde los cambios sin guardar.
- [ ] El indicador de estado (Completo / Borrador / Incompleto) refleja
      el % de horas colocadas.

Fase 3 (solver):
- [ ] El botón "Sugerir horario" genera una propuesta válida (o parcial)
      en ≤ 2 s.
- [ ] La propuesta respeta las 4 reglas de validación.
- [ ] El admin puede ajustar la propuesta a mano antes de guardarla.

Fase 4 (tap-to-place):
- [ ] En táctil funciona seleccionar un módulo y colocarlo con tap sin
      perder scroll.
- [ ] En desktop funciona tanto drag como tap.

Transversal a todas las fases (coherencia visual):
- [ ] Ningún color, radio, sombra o tamaño está hardcodeado en el CSS:
      todos vienen de variables del tema.
- [ ] Al cambiar el tema del centro, el editor se reestiliza
      automáticamente sin cambios en código.
- [ ] Los estados (válido/inválido/seleccionado/completo/borrador)
      siguen siendo legibles tanto en tema claro como oscuro.
- [ ] Los componentes comparten look & feel con `DataTable`,
      `Sidebar`, `CrudHeader` y demás partes ya existentes.

Transversal a todas las fases (i18n):
- [ ] Ningún texto visible está hardcodeado: todo pasa por `useTranslation()` + `t()`.
- [ ] Las claves nuevas están añadidas en `es.json` y `en.json` (mínimo) y agrupadas
      por dominio (`scheduleEditor.*`, `profLoad.*`, …).
- [ ] Al cambiar de idioma en runtime, el editor se traduce completamente sin
      fragmentos en castellano/inglés embebidos.

---

*Última actualización: 2026-04-14*
