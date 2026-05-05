# Notificaciones del sistema — Hoja de ruta

> **Status (2026-05-05)**: 🔴 **Sin empezar**. Máxima prioridad. Sustituye al ítem 3.13 "Actividad reciente" de `home-widgets-roadmap.md` ampliándolo a feature transversal (no solo widget de home).
>
> **Razón de la prioridad**: hoy un alumno no se entera de que su examen ha sido corregido a no ser que entre activamente a `MisCalificaciones`; un profe no ve si llega una entrega nueva a una de sus tareas; un admin no se entera de errores de integridad. La campanita actual del header solo lista mensajes inter-personales. Esta feature cierra el bucle de feedback del sistema.

---

## ⚡ Snapshot para retomar

### Resumen

| Fase | Alcance | Esfuerzo | Estado |
|---|---|---|---|
| 1 | Backend: entidad `Notificacion` + propagación por evento Doctrine + endpoint REST + Mercure live (reusar framework `#[LivePublish]`) | ~1 sesión | 🔴 |
| 2 | Frontend: nuevo botón **campanita** en header con dropdown de notificaciones del sistema; el actual de mensajes intercambia su icono `Bell` por uno de mensaje (`Mail` / `MessageCircle`) y conserva su lista | ~0.5 sesión | 🔴 |
| 3 | Reglas de propagación por tipo de evento (cataloga qué eventos generan notificación y a quién) + tipos iconados + i18n × 5 | ~0.5 sesión | 🔴 |

**Total**: ~2 sesiones bien planificadas.

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

- `GET /api/notificaciones?usuario=me&leida=false&order[fechaCreacion]=desc&itemsPerPage=10` — lista del header.
- `GET /api/notificaciones/{id}` — detalle (raramente usado, por compleción API Platform).
- `PATCH /api/notificaciones/{id}` — `{ leida: true }`.
- `POST /api/notificaciones/marcar-todas-leidas` — controller custom, `usuario=me`.

`CurrentUserExtension` debe filtrar `usuario = security.getUser()` automáticamente para todos salvo SuperAdmin (que ve todas) — patrón estándar del proyecto.

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

*(vacía — pendiente de implementación)*

---

## Cross-ref

- `home-widgets-roadmap.md` §3.13 "Actividad reciente" — esta hoja de ruta sustituye y amplía el alcance.
- `hoja-de-ruta-redis-workers.md` — framework Mercure / `#[LivePublish]` que reusamos.
- `CLAUDE.md` §"Patrones y Convenciones" — patrón Mercure+useLiveRefetch.
