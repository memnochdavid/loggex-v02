# Home & Widgets — Hoja de ruta

Documento vivo con las ideas de widgets y mejoras estructurales para la vista `/` (Home). Sirve como referencia para futuras iteraciones; **no está implementado salvo lo que ya existe**.

> Convención: 🟢 ya existe · 🟡 parcialmente · 🔴 nuevo por implementar.

---

## 1. Diagnóstico del estado actual

La Home actual (`frontend/src/pages/Home.jsx`) muestra 4 widgets envueltos cada uno en su propio `AccordionView`:

- 🟢 **Tablón de Anuncios** (`TablonWidget`)
- 🟢 **Mensajes Recientes** (`NotificationList`)
- 🟢 **Tareas Pendientes** (`PendingTasksWidget`) — solo rol Alumno
- 🟢 **Horario de Hoy** (`UpcomingEventsWidget`)

**Problemas detectados:**

1. Los widgets van en `AccordionView` individuales con un único item y `defaultOpenAll`. El acordeón aquí no aporta nada: no agrupa, no hay "solo uno abierto a la vez". Añade padding vertical y un nivel visual de ruido.
2. Layout uniforme: todos los widgets tienen el mismo peso visual aunque su importancia/densidad sea muy distinta.
3. No hay **estadísticas rápidas** — el usuario tiene que entrar a varias vistas para saber "cuántas cosas pendientes tengo".
4. No hay **atajos** a las acciones más frecuentes del rol (pasar lista, subir entrega, nuevo usuario…).
5. El saludo es estático (`"Hola, {nombre}"`) sin contexto temporal ni resumen.
6. Mensajes/Tablón: al estar en acordeón desplegado ocupan mucho espacio aunque haya pocos items.

---

## 2. Mejoras estructurales

### 2.1 Bento grid asimétrico
Sustituir el `dashboardGrid` uniforme por un grid con `grid-template-areas` que dé **peso visual** a cada widget según importancia:

```
┌──────────────┬────────┬────────┐
│              │        │        │
│    Tu día    │ Stats  │ Tablón │
│  (destacado) │ ribbon │        │
│              │        │        │
├──────────────┴────────┼────────┤
│     Deadlines         │ Msgs   │
├───────────────────────┴────────┤
│         Atajos rápidos         │
└────────────────────────────────┘
```

- Responsive: en tablet se colapsa a 2 columnas, en móvil a 1.
- Cada bloque tiene su propio padding/shadow/radius, sin envoltorios intermedios.

### 2.2 Stat ribbon
Tira horizontal con 4 chips métricos del día bajo el saludo:

- "3 mensajes sin leer"
- "2 tareas pendientes" (alumno) / "5 entregas por corregir" (profe)
- "Próxima clase en 30 min"
- "4 eventos esta semana"

Cada chip es clicable y lleva a la vista correspondiente. Datos reaprovechables del hook `useUnreadMessages` y endpoints existentes.

### 2.3 Saludo contextual
En lugar de `"Hola, {nombre}"`:
- Según hora: "Buenos días", "Buenas tardes", "Buenas noches".
- Sub-línea: resumen rápido ("Tienes 3 cosas pendientes hoy" / "Sin pendientes urgentes").

### 2.4 Eliminar el `AccordionView` wrapper
Cada widget pasa a ser una **card directa** con:
- Header propio (icono + título + botón "Ver todo" que navega).
- Contenido sin padding extra del accordion.
- Borde y shadow suaves para delimitar sin romper el bento.

### 2.5 Personalización por usuario (opcional, avanzado)
Botón de "configurar" que permite al usuario:
- Ocultar widgets que no le interesan.
- Reordenar (drag-drop con dnd-kit, ya está en dependencias).
- Persistir en `localStorage` o en el backend (nueva entidad `UserPreferences`).

---

## 3. Widgets propuestos

Leyenda: **[A]** Alumno, **[P]** Profesor, **[Adm]** Admin, **[SA]** SuperAdmin.

### 3.1 🔴 Tu día — timeline unificado
**Para quién:** todos.

Línea de tiempo del día actual mezclando:
- Clases del horario.
- Tareas con fecha límite hoy.
- Eventos/evaluaciones con fecha hoy.
- Mensajes importantes (si hay push).

Ordenado cronológicamente, con un indicador "ahora" que se desplaza en vivo. Cada item tiene chip de tipo (Clase/Entrega/Examen) y color por módulo.

**Supera a "Horario de Hoy" porque:** integra deadlines y contexto en una única vista.

### 3.2 🔴 Próximos deadlines
**Para quién:** todos (contenido distinto según rol).

Lista ordenada por urgencia de lo que vence en los próximos 7–14 días:
- **[A]** Entregas propias sin subir + próximos exámenes.
- **[P]** Tareas cuyo plazo expira (para recordar corregir) + evaluaciones próximas.

Coloreado por urgencia (rojo <48h, ámbar <7d, verde >7d). Click → entrega/tarea detallada.

### 3.3 🔴 Atajos rápidos (shortcut panel)
**Para quién:** todos — contenido por rol.

4–6 botones grandes con icono + label para las acciones más frecuentes del rol:

| Rol | Atajos |
|-----|--------|
| **[A]** | Subir entrega · Ver mis calificaciones · Mi asistencia · Mis compañeros |
| **[P]** | Pasar lista (clase actual) · Corregir pendientes · Nueva tarea · Calificar |
| **[Adm]** | Nuevo usuario · Nueva matrícula · Nuevo grupo · Configuración |
| **[SA]** | Nuevo centro · Nueva tarea global · Logs · Integridad |

**Ventaja:** evita "abrir sidebar, buscar ruta, navegar" → acciones a un click.

### 3.4 🔴 Mi rendimiento
**Para quién:** **[A]**.

Mini-visualización del rendimiento del alumno:
- Sparkline de la media por módulo (últimos periodos).
- Porcentaje de entregas completadas vs totales (gauge/barra).
- Tendencia (subiendo / bajando / estable).

**Fuente de datos:** endpoint `/api/v1/alumno/mis-calificaciones` (ya existe).

### 3.5 🔴 Por corregir
**Para quién:** **[P]**.

Contador destacado de entregas sin calificar agrupadas por módulo/grupo:
- "Mat. Discreta · 2º DAM": 12 pendientes.
- "Bases de Datos · 1º ASIR": 7 pendientes.

Click en cada grupo → `/calificaciones?imparticion=X&filter=pending`.

### 3.6 🔴 Alumnos en riesgo
**Para quién:** **[P]**, **[Adm]**.

Lista priorizada de alumnos con alguna señal:
- Nota media < 5 en el periodo actual.
- Tasa de faltas > 20%.
- 3+ entregas sin presentar seguidas.

Con badge del tipo de riesgo y click → perfil del alumno.

### 3.7 🔴 Mi asistencia del mes
**Para quién:** **[A]**.

Gauge circular con el porcentaje de asistencia del mes actual + desglose:
- Presente, Falta, Retraso, Justificada.

Click → `/faltas` con el mes abierto.

### 3.8 🔴 Alertas de integridad
**Para quién:** **[Adm]**, **[SA]**.

Panel con chequeos automáticos del centro:
- Matrículas sin grupo.
- Imparticiones sin profesor asignado.
- Módulos sin tareas en el periodo actual.
- Usuarios activos sin login en >60 días.

Cada alerta con CTA para resolver directamente.

### 3.9 🔴 Stats globales del centro
**Para quién:** **[Adm]**, **[SA]**.

4–6 números grandes con contadores animados (similar al `/about` stats strip):
- Alumnos activos.
- Profesores.
- Grupos.
- Matrículas del curso actual.
- (SA) Centros totales.

### 3.10 🟡 Tablón — refactor compacto
**Estado:** existe como `TablonWidget`.

Mantenerlo pero más compacto: 3 últimos anuncios con "Ver todo". Sigue siendo el único widget que representa "noticias del centro" — valor real.

### 3.11 🟡 Mensajes — refactor compacto
**Estado:** existe como `NotificationList`.

Preview de 3 mensajes no leídos + botón "Ver todos" → `/mensajes`. Ya hay vista completa, no hace falta ocupar mucho espacio.

### 3.12 🔴 Calendario mensual mini
**Para quién:** todos.

Mini `CalendarView` (ya existe el componente) con los eventos del mes marcados como dots de colores. Click en día → navegación a horarios filtrados por ese día.

### 3.13 🔴 Actividad reciente
**Para quién:** **[A]**.

Feed de lo que ha pasado para este alumno:
- "Tu entrega de X ha sido calificada".
- "Nuevo comentario del profesor en Y".
- "Nota publicada: Z".

Requiere endpoint agregador en el backend.

### 3.14 🔴 Próxima clase — widget destacado
**Para quién:** **[A]**, **[P]**.

Card prominente con la próxima clase del día:
- Hora · Módulo · Grupo · Aula · Profesor (para alumno).
- **[P]** con botón "Pasar lista" directo si la clase está en curso.
- Contador "En 30 min" / "Ahora" / "Terminó hace 15 min".

---

## 4. Priorización sugerida

### Fase 1 — Estructural (alto impacto, poco riesgo) ✅
1. ✅ Bento grid asimétrico + eliminar `AccordionView` wrapper. `grid-template-areas` 6×N para desktop, colapsa a 2 cols (≤1100px) y 1 col (≤680px). Nuevo componente local `WidgetCard` con header (icono + título + botón "Ver todo" + acción opcional).
2. ✅ Stat ribbon (4 chips clicables): mensajes no leídos, tareas/por corregir (según rol), próxima clase del día, eventos de la semana. Datos vía nuevo hook `useHomeStats` (polling 60s) + `useUnreadMessages` existente. Cada chip navega a su vista relevante. Stagger 50ms en entrada.
3. ✅ Saludo contextual: `getGreetingKey()` decide "Buenos días / Buenas tardes / Buenas noches" por hora; sub-línea genera resumen dinámico ("3 mensajes sin leer · 2 tareas · Próxima clase a las 10:30"). Claves i18n en 5 idiomas con pluralización.

### Fase 2 — Widgets núcleo (reemplazan los 4 actuales)
4. 🎯 **Tu día** — timeline unificado.
5. 🎯 **Próximos deadlines**.
6. 🎯 **Atajos rápidos** por rol.
7. Tablón compacto + Mensajes compacto.

### Fase 3 — Widgets específicos por rol
8. **[A]** Mi rendimiento.
9. **[A]** Mi asistencia del mes.
10. **[P]** Por corregir.
11. **[P]** Alumnos en riesgo.
12. **[Adm]/[SA]** Alertas de integridad.
13. **[Adm]/[SA]** Stats globales.

### Fase 4 — Extras
14. Calendario mensual mini.
15. Actividad reciente (requiere endpoint agregador).
16. Próxima clase destacada.
17. Personalización (ocultar/reordenar widgets).

---

## 5. Endpoints backend necesarios

La mayoría se pueden construir sobre lo existente; los 🔴 son nuevos.

| Widget | Endpoint | Estado |
|--------|----------|--------|
| Tu día | `/api/v1/alumno/mi-dia` o `/api/v1/profesor/mi-dia` (agregador) | 🔴 |
| Próximos deadlines | `/api/tareas?fechaLimite[before]=X&imparticion.alumno=me` | 🟢 (con query) |
| Mi rendimiento | `/api/v1/alumno/mis-calificaciones` | 🟢 |
| Por corregir | `/api/entregas?calificacion=null&tarea.imparticion.profesor=me` | 🟢 (con query) |
| Alumnos en riesgo | `/api/v1/profesor/alumnos-riesgo` | 🔴 |
| Asistencia del mes | `/api/asistencias?alumno=me&fecha[after]=X` | 🟢 (con agregación) |
| Alertas de integridad | `/api/v1/admin/integrity-check` | 🔴 |
| Stats del centro | `/api/v1/admin/center-stats` | 🔴 |
| Actividad reciente | `/api/v1/alumno/activity` | 🔴 |

---

## 6. Consideraciones transversales

- **Respeto al tema**: cualquier widget nuevo debe usar los tokens `--bg-card`, `--text-main`, `--color-primary-*`, etc., siguiendo la regla de oro de `modernizacion-ui.md`.
- **A11y**: `role="region"` + `aria-label` en cada widget; focus-visible global; textos con contraste 4.5:1.
- **Loading states**: skeleton loaders (ya existe el componente `Skeleton`) mientras cargan datos; nada de Lottie bloqueante.
- **Empty states**: mensaje útil + CTA cuando un widget no tiene datos ("Sin tareas pendientes · ¡Buen trabajo!").
- **Reduced-motion**: todos los contadores animados, tilts o cascadas deben tener su bloque `@media (prefers-reduced-motion: reduce)`.
- **Polling**: centralizar el polling en un hook global si varios widgets piden los mismos datos (ej. conteo de mensajes no leídos).

---

## 7. Fuera de alcance (por ahora)

Ideas que se descartan hasta que el resto esté maduro:
- Notificaciones push (PWA + service worker).
- Integración de calendarios externos (Google Calendar import/export).
- Dashboards multicentro comparativos para SuperAdmin.
- Tema de Home independiente del tema global.
