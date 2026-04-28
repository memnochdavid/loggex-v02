# Solicitud de cambio de turno (profesor → admin)

> **Status (2026-04-28)**: 🔴 sin empezar. Promovido desde `hoja-de-ruta-pulido-ux.md` #8 tras verificar que la feature **no existe** en código (sin entidad `Solicitud*`/`CambioTurno*` en backend ni endpoints/views relacionados en frontend). Se levanta como roadmap propio porque toca modelo + API + UI ambos roles + notificación.

---

## ⚡ Snapshot para retomar

### Problema

Centros con doble turno (mañana + tarde) tienen profesores asignados a uno u otro. Hoy no hay forma de que un profe pida formalmente al admin un cambio de turno (mañana ↔ tarde) y tampoco hay rastro/cola de aprobación. La gestión informal vía chat/mensajería pierde trazabilidad y deja la decisión sin histórico.

### Idea

Modelo simple de "solicitud" del profe que el admin aprueba o rechaza, con motivo y fecha de resolución. Sin efectos automáticos sobre horarios/imparticiones (Fase 1) — el admin sigue siendo quien hace el cambio efectivo en `/admin/imparticiones` o reasignando grupos. Lo que aporta esta feature es **trazabilidad y comunicación estructurada**, no automatización.

Cuando el modelo esté maduro, una Fase 2 podría aplicar el cambio automáticamente reasignando las imparticiones del profe al grupo equivalente del otro turno (si existe).

---

## 1. Modelo propuesto

### Entidad `SolicitudCambioTurno`

```
id                    int
profesor              ManyToOne User (rol PROFESOR)  NOT NULL
turnoActual           Enum TurnoJornada              NOT NULL  (snapshot al crear)
turnoSolicitado       Enum TurnoJornada              NOT NULL  (mañana/tarde, !== turnoActual)
motivo                text                           nullable
estado                Enum EstadoSolicitud           NOT NULL  default PENDIENTE
fechaSolicitud        DateTime                       NOT NULL  auto
fechaResolucion       DateTime                       nullable
resueltaPor           ManyToOne User                 nullable  (rol ADMIN/SUPERADMIN)
respuesta             text                           nullable  (mensaje del admin al rechazar/aceptar)
deleted, createdAt, updatedAt   (traits estándar)
```

### Enum `EstadoSolicitud`

```
PENDIENTE     Recién creada, esperando decisión del admin.
APROBADA      Admin aceptó. El cambio efectivo lo hace manualmente (Fase 1).
RECHAZADA     Admin rechazó. Respuesta opcional con razón.
CANCELADA     El propio profe canceló su solicitud antes de resolverse.
```

### Constraints

- Solo puede haber **1 solicitud PENDIENTE por profesor** a la vez. Validación a nivel de service (no de BD para no complicar la migración) — antes de POST, comprobar que no existe ya una pendiente del mismo profe.
- `turnoSolicitado !== turnoActual` (validación en denormalize).
- `turnoActual` se snapshotea desde el perfil/jornada del profe al crear, NO se acepta del payload.

---

## 2. Decisiones

### Abiertas

| ID | Decisión | Recomendación |
|---|---|---|
| D-A | ¿Dónde vive el "turno actual" del profe hoy? | El proyecto no tiene `User.turno` explícito — se infiere de las imparticiones (jornada del grupo). Para el MVP, snapshotear el turno mayoritario al crear la solicitud. Cuando llegue la Fase 2 automatizada, formalizar `User.turnoPreferente`. |
| D-B | ¿Cómo se notifica al profe la resolución? | Toast + entrada en `Mensaje` (chat) con el admin que resolvió. Mercure ya cubre `Mensaje` → notificación en vivo gratis. |
| D-C | ¿El profe puede ver histórico de solicitudes propias? | Sí. Vista `/mis-solicitudes` lista solo las del usuario actual. |
| D-D | ¿El admin ve solicitudes de todos los centros (SUPERADMIN) o solo el suyo (ADMIN)? | Aplicar `CurrentUserExtension` filter por centro como en el resto del modelo. |
| D-E | Fase 2 — ¿reasignación automática? | Diferida. Implementar cuando haya datos de uso real. |

### Cerradas

(ninguna)

---

## 3. Fases de implementación

### Fase 1 — Modelo + endpoints + UI básica (~1 sesión)

- Entidad `App\Entity\SolicitudCambioTurno` + enum `EstadoSolicitud` + migration `Version20260429xxxxxx`.
- API Platform: GET (collection + item), POST (rol PROFESOR), PATCH (rol ADMIN+ para `estado`/`respuesta`/`fechaResolucion`/`resueltaPor`), DELETE (PROFESOR su propia + estado=PENDIENTE → CANCELADA).
- Validación: 1 PENDIENTE por profe, turnos distintos, autoría coherente.
- `CurrentUserExtension` aplicado para filtrar por centro del solicitante.
- UI profe: botón "Solicitar cambio de turno" en `/perfil` o ajustes. Modal con select turno objetivo + textarea motivo. Lista `/mis-solicitudes` con columna estado.
- UI admin: `/admin/solicitudes-cambio-turno` con DataTable (profesor, turno actual → solicitado, fecha, estado) + botones Aprobar/Rechazar (con respuesta opcional).
- Toast al profe + entrada en `Mensaje` con el admin tras resolución (notificación Mercure live ya operativa para chat).
- i18n × 5.

### Fase 2 — Aplicar cambio efectivo (futuro, ~1.5 sesiones)

- Al aprobar, opcional "aplicar reasignación automática": el sistema mueve las imparticiones del profe a grupos equivalentes del turno destino (si existen).
- Heurística de matching de grupos: misma materia, mismo curso, distinto turno. Si no hay match 1-a-1, abrir flujo manual.
- Snapshot pre/post para auditoría.

---

## 4. Impacto en otros docs

| Doc | Cambio |
|---|---|
| `hoja-de-ruta-pulido-ux.md` | Cerrar #8 con resultado "feature no existía, promovida a hoja de ruta propia". |
| `hoja-de-ruta-redis-workers.md` | El uso de `Mensaje` para notificación al profe se beneficia de Mercure live ya operativo (sin cambio). |
| `INDEX.md` | Añadir entrada en 🔴 sin empezar. |

---

## 5. Riesgos y mitigaciones

- **Inferir el turno actual**: como el modelo no tiene `User.turnoPreferente` formal, dependemos de las jornadas de las imparticiones. Mitigación: helper `Imparticion.getTurnoMayoritario(User)` que cuenta turnos de los grupos donde imparte. Edge case profes mixtos (mañana+tarde): el modal pre-rellena con el turno minoritario como destino sugerido.
- **1 PENDIENTE por profe**: validación a nivel de service. Si llega POST con otra pendiente, error 409 con mensaje claro ("ya tienes una solicitud pendiente, cancélala primero").
- **Notificación al profe**: vincular con `Mensaje` evita reinventar canal de notificación. Si el sistema de mensajería falla, la solicitud queda igual (estado actualizado en BD), solo no avisa.

---

## 6. Bitácora de implementación

### 2026-04-28 — Doc creado

Creado tras verificar (#8 de `hoja-de-ruta-pulido-ux.md`) que la feature no existe en código: sin entidad `SolicitudCambioTurno` / `CambioTurnoRequest` ni variantes en backend, y sin views/endpoints relacionados en frontend. Promovido a hoja de ruta propia por D-D del doc de pulido. Modelo simple Fase 1 (~1 sesión) con cola de aprobación + notificación vía `Mensaje` (Mercure live ya cubre). Fase 2 (reasignación automática) diferida hasta tener datos reales de uso.
