# Intercambios, sustituciones y excepciones puntuales sobre el horario

> **Status (2026-05-07 noche)**: 🟡 **Fase A ✅ Done — en marcha.** Doc creado y D-A a D-G cerradas el mismo día. Fase A entera (modelo + enums + migration + endpoints + processor + filter centro + topic Mercure) implementada. Pendiente de aplicar la migración (`scripts/migrate.sh`) y smoke test del CRUD desde un cliente HTTP.
>
> **Próxima acción**: aplicar migración → smoke test creación excepción tipo SUSTITUCION via curl o Postman → si funciona, arrancar Fase B (composición en render).

---

## ⚡ Snapshot para retomar

### Qué resuelve

El día a día de un centro está lleno de excepciones puntuales sobre el horario "estable":

- Profe X le pide a profe Y que le cubra el martes la clase de las 10:30 a cambio de cubrirle el jueves la de las 12:00 (intercambio bilateral acordado).
- Profe X falta una semana por enfermedad: profe Y la sustituye en sus horas.
- Una semana cultural sustituye 3 días de horario normal por talleres y charlas.
- El centro cancela las clases de la tarde un día por alerta meteorológica.
- El claustro decide adelantar el final de un módulo a una fecha distinta del calendario base.

Hoy no existe un mecanismo formal para registrar nada de eso. Los cambios se comunican por chat/llamada, no quedan rastreados, los alumnos no se enteran si no preguntan, y la cobertura anual del banner no refleja la realidad pedagógica.

### Lo que ya tenemos a favor

- **Refactor modelo-semanal cerrado** (commits `a28d812` → `4a0d716`): cada grupo tiene 1 PLANTILLA (stub de cuota) + N SEMANAs (tramos cronológicos con sus Horarios). El `PeriodoLectivoResolver` resuelve el PL aplicable a una fecha vía cascada SEMANA→PLANTILLA.
- **Sistema de notificaciones** (Fases 1+2+3 cerradas 2026-05-05): entidad `Notificacion` + `NotificationDispatcher` + topic Mercure por usuario. Reutilizable directamente para avisar a afectados.
- **Mensajería + Mercure live**: ya cubre comunicación 1-a-1 y 1-a-N.
- **Calendario lectivo real del centro** (BOJA Sevilla 2025-26): los días lectivos vs festivos están bien resueltos; cualquier excepción se anota sobre fechas reales.

### Lo que NO tenemos y necesitamos diseñar

- Granularidad por fecha. Hoy un Horario en una "SEMANA" multi-week (13 sem reales) es **recurrente**: editar el Horario del martes 10:30 lo cambia para los 13 martes del tramo. No hay forma de decir "solo el 12-may".
- Tipología de excepción: el sistema no distingue intercambio / sustitución / cancelación / evento / atípica.
- Solicitud + aprobación: el viejo `hoja-de-ruta-cambio-turno.md` propone cola PROFESOR→ADMIN para cambio de turno **completo** (caso permanente). Aquí lo extendemos a excepciones **puntuales**, conservando ese flujo donde sea aplicable.
- UI ligera para "abrir el calendario de la semana N y modificar puntualmente".

### Próxima acción al retomar

**Cerrar D-A con el usuario** (ver §3). Las opciones reales son:

- **(A) Lazy split de SEMANA multi-week** al crear la primera excepción: la SEMANA padre se parte en sub-SEMANAs alrededor de la fecha tocada. Modelo puro, sin tabla nueva.
- **(B) Capa `HorarioOverride`** (tabla nueva con `horarioBase + fechaConcreta + …`). Aditiva, render compone base + override.
- **(C) Pre-atomizar todas las SEMANAs** a 1 por semana real (refactor adicional sobre lo ya hecho).

Recomendación inicial: **(B)**. Ver §3 para razones contrastadas con D-PRINCIPAL del doc modelo-semanal.

Plan de fases tentativo en §5. Bitácora cronológica al final.

---

## 1. Casos de uso cubiertos

| Caso | Descripción | Frecuencia esperada |
|---|---|---|
| **Intercambio puntual entre profes** | Profes A y B acuerdan permutar sus clases en 1-2 fechas concretas. | Semanal |
| **Sustitución por ausencia** | Profe X falta (enfermedad, asunto propio); profe Y la cubre 1 día o N días. | Semanal |
| **Cancelación puntual** | Una clase se cancela sin sustituto (huelga parcial, salida del grupo, alerta meteorológica). | Mensual |
| **Evento especial dentro del horario** | Charla externa, taller monográfico, simulacro: se altera 1 o varias franjas de un día. | Mensual |
| **Semana atípica completa** | Semana de exámenes finales, semana cultural, semana FCT inicial — el horario base entero se sustituye o se reduce. | 2-4 / curso |
| **Día festivo no anticipado** | Luto oficial, cierre por incidencia, alerta meteorológica multi-día. | Esporádico |
| **Adelanto/aplazamiento de evaluación** | El claustro adelanta el cierre de la 1ª eval por causa académica. | Esporádico |

**No cubre** (mantener fuera de scope):
- Cambio de turno **permanente** del profe (mañana ↔ tarde para todo el curso): vive en `hoja-de-ruta-cambio-turno.md` como flujo distinto. Un profe que cambia de turno permanente no es una "excepción puntual" sino una reasignación de imparticiones. Los dos docs son complementarios, no se solapan.
- Reasignación automática de imparticiones a otro grupo: out of scope (Fase 2 de cambio-turno).
- Boletines / calificaciones afectadas por excepciones: el ciclo evaluativo ya está cerrado y no necesita awareness de excepciones puntuales.

---

## 2. Estado actual del modelo (pre-feature)

### Cómo se ve un grupo hoy

Tras "Configurar curso óptimo" en `/admin/horarios`:

```
Grupo (ej. 1º DAW, id=1)
  ├─ PLANTILLA (id=304, fechas NULL, tipo=plantilla)
  │     └─ PLI[] × 7 imparticiones presenciales (cuota legal anual)
  │     └─ Horario[] = 0  (stub vacío)
  │
  └─ SEMANAs[] × 4 (tipo=semana, plantillaBase=304)
        ├─ "Hasta 1ª Evaluación"   15-sep → 19-dic (96 días, ~13.71 sem reales)
        │     └─ Horario[] × 17 bloques recurrentes (lunes-viernes)
        ├─ "Hasta 2ª Evaluación"   20-dic → 20-mar (91 días, ~13 sem reales)
        ├─ "Hasta 3ª Evaluación"   21-mar → 29-may (70 días, ~10 sem reales)
        └─ "Tras última evaluación" 30-may → 22-jun (24 días, ~3.43 sem reales)
```

Las **SEMANAs son multi-week**. El nombre engaña — heredan estructura de los antiguos "rangos" del modelo viejo. La promesa del modelo-semanal §2 ("una SEMANA = una semana lectiva, ~36 por grupo") **no se materializó así** en la implementación: lo que se hizo fue marcar los rangos cronológicos con `tipo=semana` para que el render cascada los privilegie sobre la PLANTILLA, sin atomizar.

### Implicación para excepciones puntuales

Editar `Horario(martes, 10:30, profe_X)` de la SEMANA "Hasta 1ª Eval" lo cambia para los **13 martes** del tramo, no para uno concreto. Hoy no hay manera de decir "solo el martes 11-nov".

Ese es el agujero que cierra esta hoja de ruta.

---

## 3. Decisiones

### Cerradas (2026-05-07)

| ID | Resolución | Razón |
|---|---|---|
| **D-A** | **Opción B** — capa `ExcepcionHorario` aditiva | Las SEMANAs actuales son multi-week; (A)/(C) implican refactor adicional fuerte sin valor pedagógico distinto. (B) es 1 entidad + composición en 4-5 puntos de render. |
| **D-B** | Enum 4 valores: `INTERCAMBIO`, `SUSTITUCION`, `CANCELADO`, `EVENTO_ESPECIAL` | Cubre 95% de casos sin sobreingeniería. `SEMANA_ATIPICA` diferida a Fase F. |
| **D-C** | Admin aprueba excepciones que afecten a otros profes/alumnos. Profe crea directamente sus auto-cancelaciones puntuales sin cola. Admin+Profe (sara) salta cola. | Trazabilidad real exige firma del centro; auto-cancelaciones no piden veto. |
| **D-D** | Reusar `Notificacion` existente. 6 tipos nuevos + i18n × 5. | El sistema ya está operativo desde 2026-05-05. |
| **D-E** | 5 puntos de composición: `/horario/me`, PDF horario personal, banner anual, tab Consumición, rejilla `/admin/horarios` con badge. | Mínimo para que las excepciones se reflejen donde el usuario las espera. |
| **D-F** | Soft-delete con flag `revertida` | Coherente con patrón general + auditoría inspectores educativos. |
| **D-G** | Profe: botón en placement de `TimeTable` `/horarios`. Admin: click en placement de rejilla `/admin/horarios` + vista `/admin/excepciones`. Histórico profe en `/mis-excepciones`. | Ataja al sitio donde el usuario está mirando. |

### Abiertas

(ninguna; D-A a D-G cerradas en sesión 7)

---

### D-A — Granularidad de la excepción (CERRADA — Opción B)

¿Cómo introducimos la granularidad por fecha?

| Opción | Forma | Pros | Contras |
|---|---|---|---|
| **A — Lazy split de SEMANA** | Al crear la 1ª excepción que afecta a una SEMANA multi-week, el sistema la parte en 3 sub-SEMANAs (antes / la semana de la excepción / después). Cada sub-SEMANA hereda la jornada y los Horarios de la padre. La excepción se aplica editando el Horario en la sub-SEMANA aislada. | Modelo puro: sin tabla nueva, todo es PL+Horario; respeta el espíritu del refactor (D-PRINCIPAL). | Splitting es complejo: copiar Horarios + PLIs + reapuntar plantillaBase + invalidar cachés del editor + reasignar nombres ("Hasta 1ª Eval (parte 1)"). Cada excepción explota la cantidad de PLs en BD. La estructura cronológica del editor queda fragmentada. Tras 5 excepciones en un trimestre el strip de pills se vuelve ilegible. |
| **B — Capa `HorarioOverride`** | Tabla nueva: `(horarioBase FK Horario, fechaConcreta Date, tipo Enum, imparticionEfectiva FK Imparticion nullable, …)`. El render compone Horario base + override aplicable. | Aditiva, no toca PLs. Reusable por todos los casos de uso. Render simple: un JOIN extra al consultar fecha concreta. Volumen acotado (1 fila por excepción real, no por semana del rango). El editor `/admin/horarios` no cambia. | Lógica de render más compleja en 2-3 puntos críticos (`/horario/me`, banner anual, PDFs por fecha). Requiere caché por fecha. La opción "rechazada" en D-PRINCIPAL del modelo-semanal — pero rechazada **frente a atomizar todo a SEMANAs atómicas**, no frente al "multi-week + override puntual" que es el escenario real. |
| **C — Pre-atomizar todas las SEMANAs** | Refactor adicional sobre lo ya hecho: cada SEMANA cubre exactamente 1 semana real (~36 por grupo). Horarios duplicados N veces. Excepción = editar el Horario de la SEMANA atómica. | Modelo conceptualmente puro tal como §2 del doc modelo-semanal lo describía. | Multiplica filas Horario × 13 (ahora 16-18 por SEMANA × 4 SEMANAs = ~70; pasaría a 16-18 × 36 = ~600 / grupo). Refactor estimado en 3-4 sesiones más. Banner anual y cobertura piden recálculo. **No justificado solo para resolver excepciones puntuales** (sería sobre-ingeniería). |

**Recomendación**: **Opción B**. Justificación detallada:

1. **D-PRINCIPAL del modelo-semanal cerró por modelo semanal puro vs rangos+override**, en un escenario donde el cambio se haría una vez para resolver TODA la familia de excepciones de raíz. Hoy ese escenario NO se materializó: la implementación quedó a medio camino (multi-week SEMANAs con PLANTILLA stub). Resolver excepciones puntuales sobre ese estado actual con (A) o (C) implica refactor adicional fuerte que no aporta valor pedagógico distinto del que aporta (B).

2. **(B) es lo más barato** para llegar a una feature usable: 1 entidad nueva, 1 migración, 1 query de composición en 3-5 puntos del render, ~2 sesiones de implementación.

3. **(B) preserva la trazabilidad** mejor que (A): la excepción es un objeto de primera clase con `tipo`, `motivo`, `solicitadaPor`, `aprobadaPor`, fechas. En (A), la excepción está implícita en la existencia de un PL extra y se pierde fácilmente.

4. **(A) puede convivir con (B) en el futuro** si una semana entera se vuelve atípica: la UI puede ofrecer "esta semana es atípica completa → splittear y editar libremente" como acción avanzada. El 90% de los casos comunes (1-2 excepciones por semana) caben en (B) sin splitting.

Si el usuario prefiere (A) o quiere mezcla, anotar resolución aquí.

### D-B — Tipo de excepción modelado

Enum `TipoExcepcion`:

| Valor | Significado | Imparticion efectiva |
|---|---|---|
| `INTERCAMBIO` | Permuta bilateral acordada entre dos profes. La excepción referencia su pareja (FK a otra excepción). | La de la imparticion del otro profe. |
| `SUSTITUCION` | Un profe cubre la clase de otro (ausencia, enfermedad). | Misma imparticion (mismo grupo+materia), profe override. |
| `CANCELADO` | Sin sustituto, la clase no se imparte. | NULL. |
| `EVENTO_ESPECIAL` | Charla, taller, simulacro. La franja se ocupa con algo no curricular. | NULL (con flag `noCurricular=true` o texto descriptivo). |
| `SEMANA_ATIPICA` | Marcador de "esta franja entra en una semana atípica completa". Útil para agrupar excepciones masivas y mostrar contexto. | A definir. |

**Recomendación**: implementar los 4 primeros en Fase A (cubren 95% de casos), `SEMANA_ATIPICA` en Fase F si el usuario lo demanda.

### D-C — Quién crea la excepción y con qué cola

| Rol | Acción | Estado inicial |
|---|---|---|
| `ROLE_PROFESOR` | Crea excepción tipo `SUSTITUCION` (pidiendo a otro profe que cubra) o `INTERCAMBIO` (proponiendo a otro profe). | `PENDIENTE_APROBACION`. |
| `ROLE_ADMIN` / `ROLE_SUPERADMIN` | Crea excepción de cualquier tipo. Aprueba/rechaza pendientes. | `APROBADA` directamente. |

**Recomendación**: aprobación obligatoria del admin para cualquier excepción que afecte a otros profes o a alumnos. Las excepciones autoaplicadas (un profe que decide cancelar UNA clase suya por X) requieren al menos notificación al admin, no aprobación previa — a definir según el centro. **Anotar como D-C abierta**: ¿el admin aprueba todo o solo los intercambios? Mi voto: **aprueba todo** (centro real exigiría trazabilidad). Edge case admin-profe (sara@eag): saltar la cola si solicitante es ADMIN+PROFESOR.

### D-D — Notificación a afectados

Aprovechar el sistema de `Notificacion` (Fase 1+2+3 cerradas 2026-05-05).

| Evento | Notificados |
|---|---|
| Excepción creada (estado PENDIENTE_APROBACION) | Admin del centro + profe receptor (si es INTERCAMBIO/SUSTITUCION). |
| Excepción aprobada | Profe titular + profe sustituto + admin que aprobó + alumnos del grupo afectado. |
| Excepción rechazada | Solo el solicitante + admin que rechazó. |
| Excepción cancelada (por solicitante o admin) | Mismos que aprobada (si ya estaba aprobada). |

Tipos de notificación nuevos a añadir al catálogo: `EXCEPCION_PENDIENTE`, `EXCEPCION_APROBADA`, `EXCEPCION_RECHAZADA`, `CLASE_CANCELADA`, `CLASE_TRASLADADA`, `SUSTITUCION_ASIGNADA`. i18n × 5 (`notifications.types.{tipo}.{title|body}`).

### D-E — Composición en render

Si elegimos (B), los puntos de composición:

1. `/horario/me` — `GetMyScheduleController`: cargar Horarios del PL aplicable a la fecha + cargar `HorarioOverride` con `fechaConcreta IN [rango_visible]`. Para cada Horario, si tiene override aplicable a la fecha visible → sustituir.
2. `/admin/horarios` rejilla — debe mostrar excepciones marcadas como pinta-encima (badge "intercambio" / "cancelado") sobre los placements base. UX a definir.
3. PDF horario personal — ya filtra por fecha (sesión 5); aplicar mismo overlay.
4. Banner anual cobertura — restar minutos de excepciones tipo `CANCELADO` al planificado total. Sumar cero a `EVENTO_ESPECIAL` y `SEMANA_ATIPICA` (no curricular). `INTERCAMBIO`/`SUSTITUCION` no afectan cobertura curricular (la clase se imparte, solo cambia el profe).
5. Tab "Consumición" `/admin/horarios` — idem banner.

**Caché**: 1 query extra por consulta de fecha. Aceptable. Si llega a doler, caché por (centro, semanaIso) en `cache.app`.

### D-F — Histórico

¿Qué pasa cuando se borra una excepción aprobada?

- **Hard-delete**: la fecha vuelve al horario base como si no hubiera ocurrido. Simple pero se pierde la traza.
- **Soft-delete con flag `revertida`**: la fecha vuelve al base pero queda registro. Permite auditoría.

**Recomendación**: soft-delete con `revertida` (alineado con el patrón general del proyecto).

### D-G — UI: dónde vive

| Ubicación | Para quién | Función |
|---|---|---|
| Botón en cada placement del `TimeTable` (vista `/horarios` profe/alumno) | Profe sobre clase suya | "Solicitar cambio en esta clase" abre modal con tipo + fecha + motivo + profe destino opcional. Estado PENDIENTE_APROBACION. |
| Vista nueva `/admin/excepciones` | Admin | DataTable con filtros (estado, tipo, fecha, profe, grupo). Botones Aprobar/Rechazar/Cancelar inline. |
| Vista nueva `/mis-excepciones` (profe) | Profe | Histórico propio (creadas + recibidas) con estado. |
| Hook en `/admin/horarios` rejilla | Admin | Click derecho sobre placement → "Crear excepción para fecha…" abre modal. |
| Notificación pinchable en campanita | Cualquier afectado | Va al detalle de la excepción. |

---

## 4. Modelo propuesto (asumiendo D-A=B, D-B=enum 4 valores, D-C=admin aprueba todo)

### Entidad `ExcepcionHorario`

```php
#[ORM\Entity]
#[LivePublish(['/admin/centros/{centro.id}/excepciones', '/users/{solicitadaPor.id}/notifications'])]
class ExcepcionHorario
{
    use TimestampableTrait;
    use SoftDeletableTrait;

    private int $id;

    // Bloque base afectado (recurrente en su SEMANA padre).
    private Horario $horarioBase;

    // Fecha concreta de la excepción.
    private \DateTimeImmutable $fechaConcreta;

    private TipoExcepcion $tipo;

    // Imparticion que sustituye (NULL = clase cancelada).
    // Para INTERCAMBIO: la imparticion del otro profe.
    // Para SUSTITUCION: misma imparticion pero con profeOverride.
    private ?Imparticion $imparticionEfectiva;

    // Profe sustituto (cuando difiere del titular de imparticionEfectiva).
    private ?User $profeOverride;

    // INTERCAMBIO bilateral: pareja de la otra cara del intercambio.
    private ?ExcepcionHorario $intercambioPareja;

    private ?string $motivo;
    private ?string $observaciones;

    private EstadoExcepcion $estado;
    private User $solicitadaPor;
    private \DateTimeImmutable $fechaSolicitud;
    private ?User $aprobadaPor;
    private ?\DateTimeImmutable $fechaResolucion;
    private ?string $respuestaAdmin;

    // Histórico
    private bool $revertida = false;
}

enum TipoExcepcion: string {
    case INTERCAMBIO     = 'intercambio';
    case SUSTITUCION     = 'sustitucion';
    case CANCELADO       = 'cancelado';
    case EVENTO_ESPECIAL = 'evento_especial';
}

enum EstadoExcepcion: string {
    case PENDIENTE_APROBACION = 'pendiente';
    case APROBADA             = 'aprobada';
    case RECHAZADA            = 'rechazada';
    case CANCELADA            = 'cancelada';  // por el propio solicitante antes de resolverse
}
```

**Constraints e invariantes**:

- `fechaConcreta` debe estar dentro del rango de la SEMANA del `horarioBase`. Validador.
- `fechaConcreta.diaSemana == horarioBase.diaSemana`. Validador.
- Si `tipo=INTERCAMBIO`, `intercambioPareja` debe existir y ser bidireccional (ambas excepciones se referencian).
- Si `tipo=CANCELADO`, `imparticionEfectiva` debe ser NULL y `profeOverride` debe ser NULL.
- Solo una excepción **APROBADA** activa por (`horarioBase`, `fechaConcreta`). Si llega otra al mismo (horario, fecha) en estado APROBADA, error 409 (validador a nivel service).
- `solicitadaPor` se setea desde el JWT, no del payload.
- Filtro `CurrentUserExtension` por centro: `excepcion.horarioBase.periodoLectivo.grupo.centro = miCentro`.

### Migration

```sql
CREATE TABLE excepcion_horario (
  id INT AUTO_INCREMENT PRIMARY KEY,
  horario_base_id INT NOT NULL,
  fecha_concreta DATE NOT NULL,
  tipo VARCHAR(32) NOT NULL,
  imparticion_efectiva_id INT NULL,
  profe_override_id INT NULL,
  intercambio_pareja_id INT NULL,
  motivo TEXT NULL,
  observaciones TEXT NULL,
  estado VARCHAR(32) NOT NULL DEFAULT 'pendiente',
  solicitada_por_id INT NOT NULL,
  fecha_solicitud DATETIME NOT NULL,
  aprobada_por_id INT NULL,
  fecha_resolucion DATETIME NULL,
  respuesta_admin TEXT NULL,
  revertida TINYINT(1) NOT NULL DEFAULT 0,
  created_at DATETIME NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NULL,
  deleted TINYINT(1) NOT NULL DEFAULT 0,
  deleted_at DATETIME NULL,
  CONSTRAINT fk_eh_base FOREIGN KEY (horario_base_id) REFERENCES horario(id),
  CONSTRAINT fk_eh_imp  FOREIGN KEY (imparticion_efectiva_id) REFERENCES imparticion(id),
  CONSTRAINT fk_eh_user FOREIGN KEY (profe_override_id) REFERENCES user(id),
  CONSTRAINT fk_eh_par  FOREIGN KEY (intercambio_pareja_id) REFERENCES excepcion_horario(id),
  CONSTRAINT fk_eh_sol  FOREIGN KEY (solicitada_por_id) REFERENCES user(id),
  CONSTRAINT fk_eh_apr  FOREIGN KEY (aprobada_por_id) REFERENCES user(id)
);

CREATE INDEX idx_eh_fecha          ON excepcion_horario(fecha_concreta, deleted);
CREATE INDEX idx_eh_horario_fecha  ON excepcion_horario(horario_base_id, fecha_concreta);
CREATE INDEX idx_eh_estado         ON excepcion_horario(estado, deleted);
```

`down()`: drop table + indexes.

---

## 5. Fases de implementación

### Fase A — Modelo + endpoints CRUD básicos (~1 sesión)

- Cerrar D-A a D-G con el usuario.
- Entidad `ExcepcionHorario` + enums + migration `Version2026MMDD180000`.
- Validators (constraints arriba).
- API Platform: `GetCollection`, `Get`, `Post` (PROFESOR/ADMIN), `Patch` (solo ADMIN cambia estado y campos de resolución), `Delete` (soft).
- `CurrentUserExtension` por centro vía cadena `horarioBase.periodoLectivo.grupo.centro`.
- Filtros API Platform: `?fechaConcreta[after]=`, `?estado=`, `?tipo=`, `?horarioBase.periodoLectivo.grupo=`, `?solicitadaPor=`.
- `LivePublish` para refresh live de las vistas.

**Salida**: backend con CRUD live + vista temporal `/admin/excepciones` con DataTable básico que lista todas las del centro.

### Fase B — Cascada en render (`/horario/me` + PDF + banner) (~1 sesión)

- `GetMyScheduleController`: cargar overrides que apliquen al rango visible + composición. Cache invalidation por `Excepcion::postPersist`.
- `HorarioPdfController`: misma composición filtrada por fecha (ya tiene parámetro `?fecha`).
- Banner anual `/admin/horarios`: restar CANCELADO al planificado. INTERCAMBIO/SUSTITUCION no afectan cobertura.
- Tab Consumición: idem.
- `/admin/horarios` rejilla: badge sobre placements con excepción aprobada en la semana visible (overlay). Tooltip con detalle.

**Salida**: las excepciones aprobadas se reflejan en todas las vistas de horario y en cobertura.

### Fase C — UI ligera de creación (admin + profe) (~1 sesión)

- **Admin**: modal "Crear excepción para fecha…" desde click derecho sobre placement en `/admin/horarios` rejilla. Campos: tipo, fecha (auto-rellena día de semana), imparticionEfectiva (select según tipo), profeOverride, motivo. Aprobada directa.
- **Profe**: botón "Solicitar cambio" en cada placement del `TimeTable` de `/horarios`. Modal similar pero con menos campos (no puede aprobar). Estado PENDIENTE.
- Vista `/mis-excepciones` con tabs "Solicitadas por mí" / "Recibidas / asignadas a mí".
- Mejoras de la vista `/admin/excepciones` Fase A: filtros, columnas pretty, acciones Aprobar/Rechazar.

**Salida**: flujo end-to-end funcional para los 4 tipos de excepción.

### Fase D — Notificaciones a afectados (~0.5 sesión)

- 6 nuevos tipos en el catálogo de `Notificacion`.
- Hooks `postPersist` y `postUpdate` en `ExcepcionHorario` que disparan dispatcher según transición de estado.
- Notificar alumnos del grupo cuando se aprueba o cancela una clase (uso del existente sistema de notificaciones).
- i18n × 5 para los 6 tipos nuevos.

### Fase E — Caso "intercambio bilateral" (~0.5 sesión)

- UI: cuando profe A propone intercambio con B, el modal pre-rellena las dos parejas (crea ambas excepciones atómicamente con `intercambioPareja` mutua).
- Aprobación del admin acepta o rechaza el par; nunca por separado.
- Notificación a B con CTA "aceptar / rechazar la propuesta de A" antes de pasar al admin (opcional Fase E.2).

### Fase F — Caso "semana atípica completa" (~0.5-1 sesión, opcional MVP)

- Atajo "Marcar semana atípica" desde `/admin/horarios` rejilla → genera N excepciones tipo `EVENTO_ESPECIAL`/`CANCELADO` para todos los placements de la semana visible con un mismo `motivo` agrupado.
- Render del banner anual con awareness de "semana atípica" (no contar para cobertura).
- Tipo `SEMANA_ATIPICA` opcional como agrupador visual.

### Fase G — Auditoría e histórico (~0.5 sesión)

- Vista `/admin/excepciones/historico` con todas las soft-deleted/revertidas.
- Export CSV / PDF para inspectores educativos.
- Métricas: nº excepciones por mes, tipos más frecuentes, profe con más sustituciones recibidas, etc.

**Total estimado**: 4-5 sesiones para Fases A-E (MVP usable). F-G según demanda.

---

## 6. Impacto en otros docs

| Doc | Cambio |
|---|---|
| `hoja-de-ruta-modelo-semanal.md` | Anotar en bitácora que la feature objetivo arrancó. Cross-ref aquí. |
| `hoja-de-ruta-cambio-turno.md` | NO marcar superseded — cubre cambio de turno **permanente** del profe (caso distinto). Añadir cross-ref aquí explicando la diferencia. |
| `hoja-de-ruta-notificaciones.md` | Anotar 6 tipos nuevos a añadir al catálogo en Fase D. |
| `hoja-de-ruta-redis-workers.md` | `ExcepcionHorario` se beneficia del framework `LivePublish` ya operativo. Sin cambios al doc, pero la entidad debe llevar `#[LivePublish]` desde Fase A. |
| `INDEX.md` | Añadir entrada en sección "🚨 PRÓXIMA SESIÓN" cuando arranque Fase A. Mover de "🔴 sin código" a "🟡 parcial". |

---

## 7. Riesgos y mitigaciones

- **Conflicto fecha-horario**: una excepción para `(horario, fecha)` que ya tiene otra excepción aprobada. Mitigación: validador a nivel service + índice único parcial `(horario_base_id, fecha_concreta) WHERE estado='aprobada' AND deleted=0` (MariaDB no soporta WHERE en UNIQUE; lo emulamos en service o con trigger).
- **Caché del `GetMyScheduleController`**: ya cachea 5 min. Las excepciones nuevas no aparecen hasta que expira. Mitigación: invalidar cache pool en `Excepcion::postPersist`/`postUpdate` (`cache.app` invalidation por usuario afectado).
- **Excepciones para fechas pasadas**: ¿se permite? Mi voto: sí, para registrar lo ya ocurrido (sustitución que se hizo hace 2 días pero no se anotó). Validador permisivo, UI con aviso.
- **Excepciones encadenadas**: profe A pide intercambio con B; B acepta; pero A modifica luego su propia clase con otra excepción que choca. Mitigación: validador chequea conflictos antes de aprobar.
- **Volumen de notificaciones**: una semana atípica puede generar 30-50 notificaciones. Mitigación: agrupador por evento en el frontend (un solo bell para "se ha cancelado tu clase del lunes y martes" en lugar de dos entradas).
- **Doble sentido del intercambio**: si A↔B aprueba y luego A se da de baja, hay que decidir qué pasa con la cara B del intercambio. Mitigación: cuando se cancela una cara del intercambio, el sistema cancela automáticamente la pareja con motivo "cancelación en cadena".

---

## 8. Bitácora de implementación

### 2026-05-07 (noche) — Fase A ✅ Done — modelo + endpoints + filtros + LivePublish

Tras cerrar D-A a D-G (todas con la recomendación inicial sin modulación: D-A=B capa aditiva, D-B enum 4 valores, D-C admin aprueba todas las que afecten a otros, D-D reusar `Notificacion`, D-E 5 puntos de composición, D-F soft-delete con `revertida`, D-G UI en placement directo del usuario), implementación completa de Fase A en una sola sesión:

**Entidades nuevas**:
- `App\Entity\TipoExcepcion` (enum, 4 valores). Helper `afectaCobertura()` distingue CANCELADO/EVENTO_ESPECIAL (sí restan) de INTERCAMBIO/SUSTITUCION (no afectan curricular).
- `App\Entity\EstadoExcepcion` (enum, 4 valores). Helper `aplicaAlRender()` solo true para APROBADA.
- `App\Entity\ExcepcionHorario` con `TimestampableTrait`+`SoftDeletableTrait`, validador `Assert\Callback validateCoherencia` (CANCELADO ⇒ imparticionEfectiva/profeOverride NULL; fechaConcreta.diaSemana coincide con horarioBase.diaSemana). Validador estricto del rango SEMANA padre diferido a service (Fase B).
- `App\Repository\ExcepcionHorarioRepository`.

**Migration** `Version20260507180000`:
- Tabla `excepcion_horario` con 6 FKs: horario_base (CASCADE on delete), imparticion_efectiva (SET NULL), profe_override (SET NULL), intercambio_pareja self (SET NULL), solicitada_por (CASCADE), aprobada_por (SET NULL).
- 3 índices funcionales: `idx_eh_fecha (fecha, deleted)`, `idx_eh_horario_fecha (horario, fecha)`, `idx_eh_estado (estado, deleted)` + 6 índices automáticos por FK.

**API Platform** sobre la entidad:
- Operations: `Get`/`GetCollection` (ROLE_USER), `Post` (PROFESOR/ADMIN/SUPERADMIN, processor `ExcepcionHorarioProcessor`), `Patch` (ADMIN/SUPERADMIN, mismo processor), `Delete` (PROFESOR/ADMIN/SUPERADMIN, processor `SoftDeleteProcessor`).
- Filtros: SearchFilter sobre 8 propiedades (incluido `horarioBase.periodoLectivo.grupo` + `horarioBase.imparticion.profesor`); DateFilter sobre 3 fechas; OrderFilter sobre 4 campos.
- Order default: `fechaConcreta DESC, id DESC`.

**Processor** `App\State\ExcepcionHorarioProcessor`:
- POST: setea `solicitadaPor` desde JWT (no del payload). Si solicitante NO es admin/superadmin, fuerza `estado=PENDIENTE_APROBACION` + nullifica `aprobadaPor`/`fechaResolucion`. Si es admin y crea APROBADA directa, autofirma con su propio user.
- PATCH: si `estado` pasa a APROBADA/RECHAZADA/CANCELADA y `aprobadaPor` está vacío, lo rellena con el user actual + `fechaResolucion=now`. Reversión APROBADA → CANCELADA marca `revertida=true` (D-F).

**Filtro de visibilidad** `CurrentUserExtension`:
- Añadido `ExcepcionHorario` a `supportedClasses` + nuevo `addWhereExcepcionHorario` con cascada por rol:
  - Admin/SuperAdmin: cadena `horarioBase.imparticion.grupo.centro = miCentro` (vía 3 joins). SuperAdmin queda exento por el early-return de la clase.
  - Profe puro: `solicitadaPor=self OR profeOverride=self OR horarioBase.imparticion.profesor=self`.
  - Otros roles (ALUMNO): `1=0` por API directa. Verán las que les afecten vía notificaciones (Fase D) y composición de su propio horario (Fase B).

**Live updates**:
- `#[LivePublish]` con 4 topics declarados: admin del centro + solicitante + profe titular del horario + profeOverride. Topics que no resuelvan placeholders (p.ej. profeOverride NULL) se descartan silenciosamente.
- `MercureAuthController`: añadido `/users/{userId}/excepciones` al JWT firmado para cada user autenticado. Admin/SuperAdmin ya cubren `/admin/centros/{cid}/excepciones` por wildcard `/admin/centros/{cid}/{rec}` y `/admin/{rec}` existentes.
- ⚠️ Editar `MercureAuthController` exige logout/login en cada navegador (memoria del proyecto).

**Sin afectar todavía**: todo el render. Las excepciones APROBADAS persisten en BD pero ningún render las consume aún — esto es Fase B. Por tanto la BD puede tener excepciones aprobadas sin que la UI las muestre, lo cual es consistente con un MVP iterativo.

**Pendientes inmediatos para validar Fase A**:
1. Aplicar migración: `./scripts/migrate.sh` (lo ejecuta el usuario; el script ya hace status + migrate + cache:clear + restart backend).
2. Smoke test: con curl/Postman, POST `/api/excepcion_horarios` con un horario base existente y profile JWT de un profe → debería devolver 201 con estado=PENDIENTE_APROBACION. PATCH con admin token cambiando estado → debería rellenar aprobadaPor + fechaResolucion automáticamente.
3. Verificar Mercure: tras logout/login en cliente conectado, abrir DevTools y comprobar que el JWT incluye el topic `/users/{userId}/excepciones`.

**Próximo paso (Fase B)**: composición en render. 5 puntos: `/horario/me`, PDF horario personal, banner anual `/admin/horarios`, tab Consumición, rejilla `/admin/horarios` con badge.

### 2026-05-07 — Doc creado

Creado tras cerrar el refactor modelo-semanal (Fases A+B+C+D ✅, último commit `4a0d716` el 2026-05-06 noche). Cumple el ítem #5 de "Pendientes próxima sesión" anotado al final de la sesión 6.

Estructura: 7 secciones de planificación + bitácora. Decisiones D-A a D-G abiertas, con recomendación inicial argumentada en cada una. La D-A es bloqueante (granularidad de la excepción) — sin cerrarla no se puede arrancar Fase A.

**Decisión recomendada**: Opción B (capa `HorarioOverride` / `ExcepcionHorario`) por:
1. La implementación actual del modelo-semanal dejó SEMANAs multi-week (no atómicas como §2 del modelo-semanal sugería); resolver excepciones puntuales con (A) o (C) implicaría refactor adicional fuerte.
2. (B) es lo más barato: 1 entidad, 1 migración, 4-5 sesiones para MVP.
3. (B) preserva trazabilidad (excepción es objeto con tipo/motivo/aprobador) mejor que un PL extra.

Arquitectura de la entidad `ExcepcionHorario` perfilada en §4 con 4 tipos de excepción (INTERCAMBIO, SUSTITUCION, CANCELADO, EVENTO_ESPECIAL) y enum de estado de aprobación.

Plan de fases: A modelo + CRUD, B render + composición, C UI creación, D notificaciones, E intercambios bilaterales, F semana atípica completa (opcional), G histórico/auditoría (opcional). MVP usable tras A-E (~4-5 sesiones).

**Pendiente próxima sesión**:
1. Cerrar D-A con el usuario (aceptar/rechazar/modular Opción B).
2. Cerrar D-B a D-G en la misma conversación (rápidas tras A).
3. Arrancar Fase A: entidad + migration + endpoints + filtros + LivePublish.
