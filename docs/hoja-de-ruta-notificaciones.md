# Notificaciones del sistema — Hoja de ruta

> **Status (2026-05-08)**: 🟢 **Cerrada — validada E2E en navegador**. Las 3 fases (backend + i18n + frontend) están operativas en `master` desde el 2026-05-05. Hotfixes y nuevo tipo `calificacion_actualizada` aplicados en la misma jornada. La validación visual con datos reales confirmada por el usuario el 2026-05-08 cierra el roadmap.
>
> **Lo que logró**: ahora el alumno se entera al instante (badge en `Bell` + dropdown) de que su examen ha sido corregido / actualizado, de cada tarea nueva publicada y de cada comunicado; el profe ve cada entrega recibida; el bucle de feedback del sistema queda cerrado. Mercure entrega los eventos en vivo a las pestañas abiertas (D8: abrir uno cierra el otro; D9: contador exacto vía `hydra:totalItems`).

---

## ⚡ Snapshot para retomar

### Resumen

| Fase | Alcance | Esfuerzo | Estado |
|---|---|---|---|
| 1 | Backend: entidad `Notificacion` + propagación por evento Doctrine + endpoint REST + Mercure live (reusar framework `#[LivePublish]`) | ~1 sesión | 🟢 **Done 2026-05-05** · validada E2E 2026-05-08 |
| 2 | Frontend: nuevo botón **campanita** en header con dropdown de notificaciones del sistema; el actual de mensajes intercambia su icono `Bell` por uno de mensaje (`Mail` / `MessageCircle`) y conserva su lista | ~0.5 sesión | 🟢 **Done 2026-05-05** · validada E2E 2026-05-08 |
| 3 | Reglas de propagación por tipo de evento (cataloga qué eventos generan notificación y a quién) + tipos iconados + i18n × 5 | ~0.5 sesión | 🟢 **Done 2026-05-05** · validada E2E 2026-05-08 |

**Total**: ~2 sesiones efectivas. **Roadmap cerrado**.

### Decisión clave de UX (D1) — cerrada 2026-05-05

**Dos botones separados en el header, no un dropdown con tabs:**

- **Botón "Mensajes"** (existente, refactor): cambia icono `Bell` → `Mail` (o `MessageCircle`). Mantiene el dropdown actual con `NotificationList` y los mensajes inter-personales.
- **Botón "Notificaciones"** (nuevo): icono `Bell`. Dropdown visualmente idéntico al de mensajes (mismo `styles.dropdown`, mismo patrón de badge con contador, misma altura y look). Lista las **N últimas notificaciones del sistema** (vistas o no).

**Justificación**:
- Separación conceptual real — *mensajes = comunicación humana*; *notificaciones = eventos del sistema* (corrección, tarea nueva, comunicado, falta de integridad, …).
- Patrón conocido (Slack, GitHub, Gmail).
- Contadores de no-leídos por tipo son más informativos que un agregado mezclado.
- 1 click vs 2 (no hay tab intermedio).
- Swap de iconos arregla la disonancia semántica actual: la `Bell` ahora muestra mensajes — semánticamente debería ser para alertas/notificaciones.

**Coste asumido**:
- 2 iconos en el header (más densidad). Mitigación: en móvil colapsar a 1 menú combinado (overflow) si hace falta — decisión D2 cuando llegue Fase 2.
- **Regla anti-duplicación**: un mensaje **NO** genera además notificación del sistema. La campanita es solo para eventos no-mensaje. Si en el futuro hay demanda de "notificación cuando llega un mensaje urgente", se modela como tipo de notificación específico, no replicación automática.

### Orden recomendado

1. **Fase 1** — backend primero (entidad, eventos, endpoint, Mercure). Sin esto no hay datos que pintar.
2. **Fase 3** — definir el catálogo de tipos antes de cablear UI: evita hacer el frontend genérico de menos y luego rehacer.
3. **Fase 2** — frontend del header + dropdown.

---

## Fase 1 — Backend

### 1.1 Entidad `Notificacion`

```
notificacion
├── id (PK)
├── usuario_id (FK User, NOT NULL)        ← destinatario
├── tipo (string, enum)                    ← p.ej. "calificacion_publicada"
├── titulo (string, 255)                   ← clave i18n o texto, decidir D3
├── mensaje (text, nullable)
├── enlace (string, 500, nullable)         ← ruta frontend a abrir al hacer click
├── payload (json, nullable)               ← contexto adicional ({ entregaId, tareaId, … })
├── leida (boolean, default false)
├── fechaCreacion (datetime)
├── leidaAt (datetime, nullable)
└── (timestamps + soft-delete vía traits)
```

**Decisiones cerradas**:
- **D2 (cerrada)** — Una `Notificacion` es **per-destinatario**, no broadcast. Si un evento afecta a 30 alumnos, se crean 30 filas. Pro: contadores y `leida` por usuario sin tabla puente; Con: volumen — mitigable con poda mensual de leídas + softdelete.

**Decisiones abiertas**:
- **D3** — `titulo` y `mensaje`: ¿guardamos texto literal en BD (idioma del usuario en el momento del evento) o claves i18n + payload, traduciendo en frontend? Recomendación: **claves i18n + payload** para que el cambio de idioma del usuario re-traduzca y para mantener la BD libre de literales en 5 lenguas.

### 1.2 Servicio de propagación

`NotificationDispatcher` con un método por tipo de evento:
- `notifyCalificacionPublicada(Calificacion $c)` → 1 notificación al alumno de la entrega.
- `notifyTareaNueva(Tarea $t)` → N notificaciones a todos los alumnos matriculados en el grupo de la imparticion.
- `notifyComunicadoNuevo(Comunicado $c)` → N notificaciones (todos los del centro o globales).
- `notifyEntregaRecibida(Entrega $e)` → 1 notificación al profesor de la imparticion.

**Wire-up**: subscribers Doctrine (`postPersist` / `postUpdate`) sobre `Calificacion`, `Tarea`, `Comunicado`, `Entrega`. Cada uno llama al método correspondiente del dispatcher.

**Cuidado**: el dispatcher persiste `Notificacion` con `EntityManager` directo dentro del mismo flush — usar `postFlush` o cola de notificaciones diferida si causa loops. Pattern probado en `LivePublishSubscriber`.

### 1.3 Endpoint REST + filtros

> **Nota de URL**: API Platform pluraliza con regla inglesa (`Notificacion` → `notificacions`, igual que `Imparticion` → `imparticions`). Por coherencia con el resto del proyecto se mantiene `notificacions` en lugar de forzar `notificaciones` con `uriTemplate`.

- `GET /api/notificacions?leida=false&order[fechaCreacion]=desc&itemsPerPage=10` — lista del header. `CurrentUserExtension` filtra a `usuario = security.getUser()` automáticamente; SuperAdmin ve todas.
- `GET /api/notificacions/{id}` — detalle (raramente usado, por compleción API Platform).
- `PATCH /api/notificacions/{id}` — `{ leida: true }`.
- `POST /api/notificacions/marcar-todas-leidas` — controller custom (`MarcarNotificacionesLeidasController`), idempotente, devuelve `{ marcadas: int }`.

### 1.4 Live updates (Mercure)

Marcar `Notificacion` con `#[LivePublish(topics: ['/users/{usuario.id}/notificaciones'])]` para que cada usuario reciba sus eventos en vivo. El JWT del frontend ya firma `/users/{userId}/*` (revisar `MercureAuthController` por si hay que añadir el patrón).

Frontend: `useLiveCollection('/users/me/notificaciones', refetch)` en el dropdown.

---

## Fase 2 — Frontend

> **🎨 Recordatorio crítico antes de tocar nada visual**: el botón nuevo de campanita, el dropdown de notificaciones, los iconos por tipo, los badges de "no leído", los hover states, el empty state — **todo debe usar variables del tema** (`var(--bg-card)`, `var(--color-primary-*)`, `var(--text-muted)`, semánticos `--color-success/warning/error`, motion tokens). Cero literales hex/rgb. Reusar las clases CSS del dropdown actual de mensajes (`styles.dropdown`, `styles.notificationButton`, `styles.badge`) — ya están tematizadas. Si hace falta un color nuevo, se añade como variable a `:root` en `index.css` (no como literal en el componente). Ver `CLAUDE.md` §"REGLA DE ORO" antes de empezar.

### 2.1 Refactor del header

**Estado actual** (`frontend/src/layout/Header.jsx:240-287`):
- Un solo botón con `<Bell size={22}>` que abre dropdown de `<NotificationList>`.
- `NotificationList` muestra los mensajes inter-personales.

**Estado objetivo**:
- **Botón izquierdo (mensajes, refactorizado)**: icono `Mail` o `MessageCircle` (decidir D4 con frontend-design). Mantiene `NotificationList` actual sin cambios.
- **Botón derecho (notificaciones, nuevo)**: icono `Bell`. Dropdown nuevo `<NotificationsList>` (componente nuevo) que mimetiza visualmente al de mensajes (mismo `styles.dropdown`, badge contador, mismas dimensiones, mismo patrón hasUnread).

### 2.2 Componente `<NotificationsList>` (nuevo)

Inspirado en `NotificationList.jsx` (mensajes) pero con:
- Endpoint `/api/notificaciones?usuario=me`.
- Iconos por tipo de notificación (mapeo en sección 3).
- Click en item → `navigate(notif.enlace)` + PATCH `{ leida: true }` con optimistic update.
- "Marcar todas como leídas" en el footer del dropdown.
- Empty state: "Sin notificaciones recientes".

### 2.3 i18n × 5

Claves nuevas:
- `header.messages` (label nuevo del botón mensajes).
- `header.systemNotifications` (label del botón nuevo).
- `notifications.markAllRead`, `notifications.empty`, `notifications.viewAll`, `notifications.justNow`, etc.
- Por tipo: `notifications.types.calificacionPublicada.title`, `.body` (con interpolación: `"Tu nota de {{tarea}} está disponible"`).

---

## Fase 3 — Catálogo de tipos de notificación

Antes de Fase 2, fijar la lista cerrada de tipos. **No añadir tipos en código sin actualizar este catálogo + i18n**.

| Tipo | Disparador | Destinatario | Enlace al hacer click | Icono sugerido |
|---|---|---|---|---|
| `calificacion_publicada` | `Calificacion::postPersist` | alumno de la entrega | `/calificaciones?tarea=ID` | `CheckCircle` o `Award` |
| `tarea_nueva` | `Tarea::postPersist` con `visible=true` | alumnos matriculados en grupo de la imparticion | `/tareas/ID` | `BookOpen` o `FileText` |
| `comunicado_nuevo` | `Comunicado::postPersist` | usuarios del centro (o globales si `global=true`) | `/comunicados/ID` | `Megaphone` |
| `entrega_recibida` | `Entrega::postPersist` | profesor de la imparticion | `/entregas?tarea=ID` | `Inbox` |
| `tarea_vencida_sin_entrega` | `Tarea` + cron (Fase F calificaciones) | alumno | `/tareas/ID` | `AlertTriangle` |
| `mensaje_urgente` *(diferido)* | flag opcional en `Mensaje` | destinatario | `/mensajes/ID` | `AlertCircle` |

**Excluidos por diseño** (no generan notificación del sistema):
- Mensaje normal (cubierto por la campanita de mensajes existente).
- Cualquier evento de admin sobre el centro (no es "para" el usuario, es contexto).

---

## Bitácora de implementación

> Una entrada por sesión cerrada. Antes de cerrar: actualizar Snapshot + tabla de fases + esta bitácora.

### 2026-05-05 — Fase 1 backend ✅ implementada (pendiente migración + smoke test)

**Ficheros creados:**

- `backend/src/Entity/Notificacion.php` — entidad per-destinatario con `tipo`, `titulo`, `mensaje`, `enlace`, `payload` (JSON), `leida`, `fechaCreacion`, `leidaAt`. Sin soft-delete por diseño (poda futura). Setter `setLeida(bool)` actualiza `leidaAt` automáticamente. `#[ApiResource]` expone `Get`/`GetCollection`/`Patch` (no POST/PUT/DELETE — se crean vía dispatcher). `#[LivePublish(topics: ['/users/{usuario.id}/notifications'])]` — el JWT firmado en `MercureAuthController:60` ya incluye este patrón (`/users/{userId}/notifications`).
- `backend/src/Repository/NotificacionRepository.php` — `markAllReadFor(User)` (UPDATE bulk idempotente) + `countUnreadFor(User)` (badge del header).
- `backend/migrations/Version20260505120000.php` — `CREATE TABLE notificacion` con FK `usuario_id → usuario.id ON DELETE CASCADE` + índice compuesto `(usuario_id, leida, fecha_creacion)` para las 2 consultas dominantes (mis no-leídas recientes + count unread).
- `backend/src/Service/NotificationDispatcher.php` — 4 métodos `notify*()` para los 4 tipos del catálogo (calificacion_publicada, tarea_nueva, comunicado_nuevo, entrega_recibida). Solo `persist()`-ea (no flush); el flush lo hace el subscriber.
- `backend/src/EventSubscriber/NotificationDispatchSubscriber.php` — listener `postPersist` + `postFlush`. En postPersist acumula entidades disparadoras (Calificacion/Tarea/Comunicado/Entrega) en `$pending`; en postFlush procesa la cola y hace flush final. Re-entrancy guard `processing=true` evita loops cuando el flush final dispara otro postFlush.
- `backend/src/Controller/MarcarNotificacionesLeidasController.php` — `POST /api/notificacions/marcar-todas-leidas` (custom, idempotente, devuelve `{ marcadas: int }`).

**Ficheros modificados:**

- `backend/src/Doctrine/CurrentUserExtension.php` — añadida `Notificacion` a `$supportedClasses` + filtro `n.usuario = current_user_id` (cada usuario solo ve las suyas; SuperAdmin queda exento por el early return existente).

**Decisiones tomadas durante la implementación:**

- **D3 (cerrada)** — `titulo`/`mensaje` se persisten en español como fallback. El frontend prefiere claves i18n `notifications.types.{tipo}.{title|body}` con interpolación de `payload`. Razón: BD no contiene literales en 5 idiomas, pero clientes API que ignoran i18n siguen viendo algo legible.
- **D4 (nueva)** — flush sincrono dentro de `postFlush` (con guard `processing`) en lugar de async vía Symfony Messenger. Justificación: notificaciones llegan en la misma transacción → consistencia inmediata, errores explícitos, menos infraestructura. Si en producción se observa latencia o picos, el refactor a async es un único fichero (mover el batch a un `MessageHandler`).
- **D5 (nueva)** — Tarea con `visible=false` no genera notificación al crearla. Si más tarde se cambia a `visible=true`, **NO** se notifica retroactivamente (postPersist solo fire una vez). Aceptable: el caso "borrador → publicar" es minoritario; añadir un postUpdate que detecte el cambio si surge demanda.
- **D6 (nueva)** — Comunicado: el autor NO se notifica a sí mismo. Comparación por `id` para evitar problemas con identidades de Doctrine.

**Acciones pendientes para activar end-to-end** (no ejecutadas porque requieren Docker corriendo):

1. `docker compose exec backend php bin/console doctrine:migrations:migrate` → crea la tabla `notificacion`.
2. `docker compose exec backend php bin/console cache:clear` → registra los servicios y listeners nuevos.
3. **Smoke tests manuales** (con `tomar-curl` o frontend de pruebas):
   - Como profesor: crear una `Tarea` con `visible=true` → confirmar que cada alumno matriculado en el grupo recibe 1 notificación con `tipo=tarea_nueva` y `enlace=/tareas/{id}`.
   - Como alumno: subir una `Entrega` → confirmar que el profesor de la imparticion recibe 1 notificación `entrega_recibida`.
   - Como profesor: crear una `Calificacion` para una entrega → confirmar que el alumno recibe 1 notificación `calificacion_publicada` con la nota en `payload`.
   - Como admin: crear un `Comunicado` no global → todos los usuarios del centro EXCEPTO el autor reciben 1 `comunicado_nuevo`.
   - Como admin: crear un `Comunicado` `global=true` → TODOS los usuarios EXCEPTO el autor reciben 1.
   - Llamar a `POST /api/notificacions/marcar-todas-leidas` → devuelve `{marcadas: N}`; segunda llamada → `{marcadas: 0}`.
   - Verificar que `GET /api/notificacions` devuelve solo las del usuario autenticado (filtrado por `CurrentUserExtension`); fallo de seguridad si ve las de otros.
   - Verificar que SuperAdmin ve todas (no aplica el filtro `CurrentUserExtension`).
4. Confirmar que el evento Mercure llega al hub: abrir DevTools en frontend, suscribirse manualmente a `/users/{miId}/notifications`, disparar uno de los flujos de arriba → llega un evento `persist` con el payload serializado.

**Limitación conocida (de momento)**: las notificaciones se crean siempre que pasan los `instanceof` del subscriber. Si se importan datos vía SQL crudo (seeds), el subscriber no se entera (Doctrine no se entera) — habrá que rellenar las notificaciones manualmente o ejecutar `app:notificaciones:backfill` (futuro) si se requiere histórico.

**Siguiente sesión**: Fase 2 frontend (refactor del header + dropdown nuevo).

### 2026-05-05 — Fase 3 i18n ✅ implementada

**Refactor mínimo del dispatcher**: añadido `tareaTitulo` al payload de `entrega_recibida` (`backend/src/Service/NotificationDispatcher.php`) para que la traducción del cuerpo `"{{alumnoNombre}} ha entregado \"{{tareaTitulo}}\""` tenga la información sin pedir al frontend que cargue la Tarea.

**Claves i18n añadidas a 5 locales** (`es/en/ca/gl/eu`):

- `header.messages` — label del botón refactorizado en Fase 2 (icono `Mail`/`MessageCircle`). El existente `header.notifications` se reusa para el botón nuevo (icono `Bell`).
- `notifications.empty` / `markAllRead` / `viewAll` / `loading` / `errorLoad` / `justNow` / `minutesAgo` / `hoursAgo` / `daysAgo` / `unread` / `markedAllRead` — UI del dropdown.
- `notifications.types.{tipo}.{title|body}` para los 5 tipos del catálogo cerrado (`calificacion_publicada`, `tarea_nueva`, `comunicado_nuevo`, `entrega_recibida`, `tarea_vencida_sin_entrega`).

**Convenciones de interpolación**:

- Cuerpos con `{{count}}`: tiempo relativo abreviado (`Hace {{count}} min/h/d`) — sin pluralización por simplicidad y consistencia entre los 5 idiomas (eu tiene reglas de plural diferentes).
- Cuerpos por tipo: usan los keys del `payload` que el `NotificationDispatcher` rellena. Ejemplos:
  - `calificacion_publicada.body`: `{{nota}}`, `{{tareaTitulo}}`.
  - `tarea_nueva.body`: `{{titulo}}` (ya está en payload, evita lookup adicional).
  - `comunicado_nuevo.body`: `{{titulo}}`.
  - `entrega_recibida.body`: `{{alumnoNombre}}`, `{{tareaTitulo}}`.

**Iconos por tipo (pendiente Fase 2)**: el catálogo del doc §3 ya sugiere los iconos Lucide (`CheckCircle`/`Award`, `BookOpen`/`FileText`, `Megaphone`, `Inbox`, `AlertTriangle`). Se cablea cuando se cree `<NotificationsList>`. No se i18n (son símbolos).

**JSON validado**: los 5 locales parsean correctamente con `json.load()`.

**Pendiente**: Fase 2 frontend.

### 2026-05-05 — Fase 2 frontend ✅ implementada (HMR OK; pendiente smoke visual)

**Ficheros creados:**

- `frontend/src/components/SystemNotificationsList.jsx` — dropdown de notificaciones del sistema. Reusa `NotificationList.module.css` para layout (DRY) y añade `SystemNotificationsList.module.css` con detalles propios (icono por tipo, dot de no-leída, tono atenuado de leídas). Endpoints: `GET /api/notificacions?order[fechaCreacion]=desc&itemsPerPage=N` para la lista + `GET /api/notificacions?leida=false&itemsPerPage=1` para el contador exacto via `hydra:totalItems`. Mercure: filtra por `event.entity === 'Notificacion'` para coexistir con eventos de mensaje en el mismo topic `/users/{id}/notifications`. Optimistic update al marcar leída; refetch externo via Mercure como red de seguridad.
- `frontend/src/components/SystemNotificationsList.module.css` — solo estilos específicos (icono por tipo + dot de no-leída + atenuación de leídas). 100% tematizado: `var(--widget-icon-color)`, `var(--color-primary)`, `color-mix()` sobre variables. Cero literales hex. `prefers-reduced-motion` respetado (oculta box-shadow del dot).

**Ficheros modificados:**

- `frontend/src/layout/Header.jsx`:
  - Imports: `SystemNotificationsList` + icono `Mail` añadidos.
  - Estado dual: `unreadCount`/`isMessagesOpen`/`messagesRef` (existentes renombrados) + `systemUnreadCount`/`isSystemNotifsOpen`/`systemNotifsRef` (nuevos).
  - Click fuera + Escape cierran ambos dropdowns; abrir uno cierra el otro automáticamente (mejora UX vs. dejar ambos abiertos solapados).
  - Botón Mensajes: icono `Mail`, label `t('header.messages')`, `data-tour="header-messages"`.
  - Botón Notificaciones (nuevo): icono `Bell`, label `t('header.notifications')`, `data-tour="header-notifications"` (mantiene el selector del tutorial existente apuntando ahora al botón nuevo, semánticamente correcto).
  - Ambos reusan el CSS `notificationContainer/notificationButton/badge/dropdown` del Header — visualmente idénticos, garantizado.
  - Handlers separados: `handleMessageClick`/`handleViewAllMessages` (mensajes) + `handleSystemNotifClick` (notificaciones — navega a `notif.enlace` si existe).

**Decisiones tomadas durante la implementación:**

- **D8 (nueva)** — abrir un dropdown cierra el otro automáticamente. Razón: dejar ambos abiertos los solaparía visualmente y crearía ruido. Patrón GitHub/Slack.
- **D9 (nueva)** — la cuenta exacta de no-leídas se obtiene con un GET separado (`itemsPerPage=1`, lee `hydra:totalItems`) en lugar de pedir todas y contar. Beneficio: si un usuario tiene 200 notificaciones no-leídas, no descargamos 200 sino 1 + el header. Desventaja: 2 fetches por refetch — aceptable porque ambos son cache-friendly.
- **D10 (nueva)** — el `data-tour="header-notifications"` del Header.jsx ahora apunta al botón nuevo (campanita). Semánticamente más correcto que mantenerlo en el botón de mensajes. Si algún paso del tutorial dependía de eso, hay que revisarlo en `hoja-de-ruta-tutorial.md` cuando se ataque la próxima ronda.
- **D11 (nueva)** — sin endpoint custom ni vista "Ver todas las notificaciones" — la campanita ES la vista. Diferente del botón de mensajes (que sí navega a `/mensajes`). Razón: las notificaciones son efímeras (se leen y se archivan), no hay valor en una vista dedicada hoy. Si surge demanda, se añade después.

**Vinculación visual con NotificationList** (mensajes):
- Reusar `sharedStyles` de `NotificationList.module.css` garantiza idéntica densidad, padding, hover, focus y animaciones — se ve como "el mismo dropdown, distinto contenido".

**Smoke tests funcionales pendientes (necesitan navegador con sesión iniciada)**:

1. Login → header muestra 2 botones (Mail + Bell) con badges en 0.
2. Crear una `Tarea` con `visible=true` desde admin → todos los alumnos del grupo ven el badge de `Bell` subir a 1; al abrir, ven la notificación con icono `BookOpen`, título traducido, cuerpo con `{{titulo}}` interpolado, tiempo relativo "Ahora mismo".
3. Click en el item → navega a `/tareas/{id}` y la notificación se marca leída (badge baja a 0).
4. "Marcar todas como leídas" en el footer → vacía el badge y elimina puntos de no-leída.
5. En otra pestaña/navegador con el mismo usuario: una notificación llega vía Mercure y la lista se refresca sin recargar.
6. Verificar que abrir un botón cierra el otro.
7. Verificar Escape y click-fuera (ambos dropdowns).

**Estado del producto end-to-end**:

- ✅ Backend operativo (Fase 1).
- ✅ i18n × 5 (Fase 3).
- ✅ Frontend integrado (Fase 2 — HMR sin errores).
- 🔬 Pendiente solo validación visual con datos reales (5 minutos en navegador).

### 2026-05-05 — Hotfix: bug 500 al crear Tarea + nuevo tipo `calificacion_actualizada`

**Bug 500**: al crear una tarea (`POST /api/tareas/upload`), el dispatcher fallaba con `Call to undefined method App\Entity\Grupo::getMatriculas()`. La propiedad `Grupo::$matriculas` existe pero el getter público no — el patrón del proyecto consulta `Matricula` directamente vía repo. **Fix**: `notifyTareaNueva` ahora hace `MatriculaRepository::createQueryBuilder('m')->andWhere(grupo + deleted=false)` en vez de iterar la colección lazy. Beneficio adicional: SQL explícito sin riesgo de lazy-load durante postFlush.

**Feature: edición de nota notifica al alumno**. Hasta ahora solo la creación de Calificacion notificaba; rectificar la nota era silencioso (reportado por el usuario). Implementación:

- Nuevo método `NotificationDispatcher::notifyCalificacionActualizada($cal)` con tipo `calificacion_actualizada`. Refactor con helper privado `notifyCalificacion()` para no duplicar payload entre publicada y actualizada.
- Subscriber escucha también `Events::preUpdate` y solo encola la Calificacion si **`hasChangedField('nota')`** es true. Editar solo `feedbackProfesor` u otros campos NO notifica (decisión: evitar spam por correcciones internas que el alumno no necesita ver).
- Cola separada `pendingCalUpdate[]` en el subscriber para no mezclar con `pendingPersist[]` (tipos de proceso distintos).
- Catálogo § 3 ampliado: `calificacion_actualizada` con icono `Edit3` (Lucide). Cuerpo i18n: "Tu nota de \"X\" se ha actualizado a Y" (interpolación de payload). Aplicado a los 5 idiomas.

**D12 cerrada** — `preUpdate` filtra por campo cambiado (`hasChangedField`). Razón: una rectificación de feedback sin cambio de nota no merece notificación al alumno; solo el cambio del valor numérico tiene impacto pedagógico real.

### 2026-05-08 — Validación E2E ✅ Roadmap cerrado

Tras 3 días de uso real con la BD del centro EAG, las notificaciones funcionan end-to-end:

- Crear tarea visible → cada alumno matriculado recibe badge + entrada en el dropdown con icono `BookOpen`, título traducido y cuerpo interpolado del payload.
- Click en notificación → navega a `notif.enlace` y la marca leída con optimistic update; el badge baja al instante.
- "Marcar todas como leídas" en el footer vacía el badge y atenúa los items.
- Mercure entrega los eventos a otras pestañas/usuarios sin recargar (filtro `event.entity === 'Notificacion'` evita ruido cuando hay actividad de mensajes en el mismo topic).
- Los dos botones del header son mutuamente excluyentes (D8): abrir uno cierra el otro.
- El nuevo tipo `calificacion_actualizada` (hotfix 2026-05-05) avisa al alumno cuando el profe rectifica la nota; los cambios solo de feedback siguen silentes (D12).

**No se detectaron bugs** durante la validación. Las 4 acciones pendientes documentadas en la bitácora del 2026-05-05 (migración, cache:clear, smoke tests backend, smoke tests visuales) quedan completadas.

**Cierre de roadmap**: la entrada en `docs/INDEX.md` se promueve de 🔴 (sin código) a la sección de cerradas. La feature pasa al manual vivo del proyecto vía `CLAUDE.md` ya en su parte de patrones (Mercure + `useLiveCollection`).

**Posibles ampliaciones futuras** (no roadmap, solo si surge demanda):
- Tipo `mensaje_urgente` (diferido en el catálogo §3): flag opcional en `Mensaje` que sí genera notificación adicional. La regla anti-duplicación actual mantiene mensaje y notificación separados, pero la puerta queda abierta.
- Vista dedicada `/notificaciones` con histórico paginado: hoy la campanita es la única vista (D11). Si los usuarios piden ver más allá de las N últimas, se añade entonces.
- Backfill de notificaciones tras un import vía SQL crudo: comando `app:notificaciones:backfill` mencionado como limitación en la bitácora del 2026-05-05.
- Poda mensual de leídas con > 90 días: la D2 (per-destinatario, no broadcast) implica volumen; no es bloqueante hoy pero conviene tener un cron preparado antes de que la tabla pase de 1M filas.

---

## Cross-ref

- `home-widgets-roadmap.md` §3.13 "Actividad reciente" — esta hoja de ruta sustituye y amplía el alcance.
- `hoja-de-ruta-redis-workers.md` — framework Mercure / `#[LivePublish]` que reusamos.
- `CLAUDE.md` §"Patrones y Convenciones" — patrón Mercure+useLiveRefetch.
