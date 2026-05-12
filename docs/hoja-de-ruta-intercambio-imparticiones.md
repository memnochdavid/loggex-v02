# Intercambios, sustituciones y excepciones puntuales sobre el horario

> **Status (2026-05-08)**: 🟢 **Fase A + B 5/5 + C parcial + C.3 + Rename + D + E + E.2 + Topic 1 + Plan B + Fase B.3 ✅ Done. Validación E2E intercambio cerrada.** Intercambio multi-bloque mismo profe operativo: 1 bloque A (p.ej. 120min) cubierto por N bloques B (p.ej. 2 de 60min) con validación Σ minutos. Modelo refactorizado de `intercambio_pareja_id` (1↔1 deprecated) a `intercambio_grupo_id` UUID compartido (N caras). Modal C.3 desde click derecho en `/admin/horarios` cubre los 4 tipos del catálogo, **smoke test 9/9 pasado en navegador (2026-05-08)**.
>
> **Próxima acción**: decidir foco. Opciones diferidas en orden de tamaño: (1) C.4 página `/mis-incidencias` (vista profe), (2) badge en rejilla `/admin/horarios` para placements con incidencia aprobada en la semana visible, (3) validación cross-conflicto en POST /excepciones/intercambio, (4) Plan B2 multi-profe (diferido hasta demanda real).

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

### 2026-05-12 (noche) — Dedupe notifs clases gemelas + aviso admins APROBADA directa 🟡 PENDIENTE E2E

Cerrados en código los bugs reportados esa misma sesión sobre `ExcepcionHorario`/notificaciones. Working tree con `backend/src/Service/NotificationDispatcher.php` + `backend/src/EventSubscriber/NotificationDispatchSubscriber.php` modificados; sintaxis PHP validada; **pendiente validación E2E en navegador antes de commit**.

**Síntomas reportados por el usuario** (caso real profe→profe, intercambio 1 lección 120 min, 1º DAM LM&SG):
1. Profe solicitado: **2 notifs idénticas** `incidencia_propuesta` "Alberto te propone una intercambio para el 2026-05-13 (LM&SG · 1º DAM)".
2. Admin del centro: **4 notifs idénticas** `excepcion_pendiente` "Alberto ha solicitado una intercambio para el 2026-05-13".
3. Sospecha del usuario sobre el caso APROBADA directa: "el admin no recibe nada cuando otro admin crea, ¿afectó la corrección anterior de SuperAdmin?".

**Diagnóstico**:

- **Bug del duplicado** (4 admin, 2 destinatario): clases gemelas (1º DAW ↔ 1º DAM unificadas EAG, RD 405/2023) **+ intercambio bilateral**. `IntercambioController` crea 2 EH (cara A + cara B) con mismo `intercambioGrupoId`. `HorarioGemeloSyncSubscriber::postFlush` (línea 247-262) duplica cada cara para el hermano gemelo **copiando la misma `imparticionEfectiva`** del original → **4 EH** total. Cada EH PENDIENTE dispara `notifyExcepcionPendiente` (admin recibe 4) y `notifyIncidenciaPropuesta` (destinatario recibe 2 — sólo las 2 caras que lo apuntan a él). Patrón replicado en `notifyExcepcionResuelta` y `notifySustitucionAsignada`. NO afecta a `notifyAlumnosCambioClase` (grupos gemelos = alumnos distintos).

- **Bug del admin en APROBADA directa**: la sospecha del usuario era errónea. Verificada `notifyExcepcionPendiente` (líneas 287-295): la query de admins/superadmins del centro sigue intacta. El bug real: `NotificationDispatchSubscriber::dispatchExcepcionPersist` solo invocaba `notifyExcepcionPendiente` en rama PENDIENTE — la rama APROBADA (admin crea desde `/admin/horarios`, commit `53367b8`) **nunca avisaba a admins/superadmins del centro**. Olvido del flow APROBADA al cablear C.3, no regresión.

- **Trampa subyacente del dedupe DQL puro**: la primera tanda de fix se aplicó solo a 3 `notify*` (incidencia_propuesta, excepcion_resuelta, sustitucion_asignada) con DQL LIKE sobre `payload`. **El usuario validó y siguieron llegando 2 + 4 notifs**. Análisis: las N EH cascadeadas se procesan secuencialmente en el mismo `postFlush` del subscriber; cada `notify*` persiste vía `em->persist()` sin flush intermedio, así que la query DQL del helper **no ve** las notifs previas del batch — el dedupe falla. Además, faltaba aplicar el helper a `notifyExcepcionPendiente` (el bug del admin que recibía 4).

**Fix aplicado** (sin migración SQL, sin cambios en frontend):

1. **Memoria in-process en el dispatcher** — propiedad `private array $emitidasEsteRequest = []` indexada por clave `tipo|usuario_id|intercambioGrupoId`. Se rellena en `createPersist` y se consulta antes de hacer DQL.

2. **Helper `yaNotificadoPorIntercambioGrupoId(User, string, ?string)` refactorizado** — primero memoria in-process (captura emisiones del mismo batch sin flush); si no, fallback DQL LIKE sobre `payload` (json type, `json_encode` sin espacios, UUID v4 único); cachea el hit DQL en la memoria.

3. **`createPersist` registra la clave** si el payload incluye `intercambioGrupoId`.

4. **4 `notify*` cascadeables** con `intercambioGrupoId` en payload + guard al inicio:
   - `notifyExcepcionPendiente` (admin recibía N, ahora 1).
   - `notifyIncidenciaPropuesta` (destinatario semántico recibía N, ahora 1).
   - `notifyExcepcionResuelta` (solicitante recibía N, ahora 1).
   - `notifySustitucionAsignada` (sustituto recibía N, ahora 1).

5. **Método nuevo** `notifyExcepcionAprobadaDirecta(ExcepcionHorario)` — clon de `notifyExcepcionPendiente` con tipo `'excepcion_aprobada_directa'`, título "Incidencia aprobada en tu centro", enlace `/admin/incidencias`. Excluye solicitante + usa el mismo dedupe.

6. **1 línea añadida** en `NotificationDispatchSubscriber.php` rama APROBADA (línea 189): `$this->dispatcher->notifyExcepcionAprobadaDirecta($eh);` después del `notifyIncidenciaPropuesta` ya existente del commit `83b483a`.

7. **Cascade soft-delete por grupo** en `backend/src/EventSubscriber/IntercambioGrupoCascadeSubscriber.php`. Bug descubierto en la misma sesión durante la consulta del usuario: borrar desde `/admin/incidencias` solo borraba 1 fila aunque hubiera N caras del mismo intercambio (cara A + cara B × clases gemelas = hasta 4 EH por incidencia). El admin tenía que ir borrando una a una.
   - **Primer intento (fallido)** — ampliar el `preUpdate` existente para detectar `hasChangedField('deleted') && oldValue=false && newValue=true` y propagar a hermanas con `recomputeSingleEntityChangeSet`. El usuario reportó "sigue teniendo que borrar 4 registros".
   - **Causa del fallo**: `recomputeSingleEntityChangeSet` SOLO funciona para entidades **ya scheduled for update** en este flush. Las hermanas cargadas con un query nuevo no están scheduled — el método las ignora silenciosamente. Esta es exactamente la limitación que `HorarioGemeloSyncSubscriber` (Fase D, 2026-05-08) ya había documentado y resuelto migrando de `preUpdate` a `onFlush + computeChangeSet`. El cascade de **estado** del mismo subscriber funciona porque, en su flujo (PATCH API Platform sobre 1 EH), la mutación ya pone la entidad disparadora en el changeset principal — pero ni siquiera ahí está claro que las hermanas reciban UPDATE consistentemente: posiblemente sólo funciona porque las hermanas son cargadas por el cascade processor anterior. Esa rama queda intacta porque ya pasa los E2E manuales.
   - **Refactor al patrón canónico (segundo intento)**:
     - Subscriber ahora suscribe a dos eventos: `preUpdate` (cascade de estado, lógica preexistente sin cambios) + `onFlush` (cascade soft-delete, rama nueva).
     - `onFlush` itera `getScheduledEntityUpdates`, filtra `ExcepcionHorario` con `changeSet['deleted'] = [false, true]`, carga hermanas vivas del grupo y aplica `setDeleted(true) + computeChangeSet` — esto sí registra los UPDATEs en el UoW.
     - Helper `loadOtrosDelGrupo(em, grupoId, selfId)` extraído (DRY entre preUpdate y onFlush).
     - Guard `$processing` compartido entre ambos eventos (anti-loop común).
     - Manejo del caso "batch borra A y luego B en el mismo flush": si la hermana ya está scheduled con `deleted=true`, se salta.
   - Limitaciones documentadas: reactivación (`deleted: true → false`) no se propaga; hard-delete vía `em->remove()` tampoco. Todo el delete del producto pasa por `SoftDeleteProcessor`, así que no es problema operativo.

**Validación E2E pendiente** (tras `docker compose restart backend`):
1. Caso real profe→profe (el reporte): Alberto desde `/horarios` solicita intercambio sobre 1º DAM LM&SG → destinatario recibe **1 notif** (antes 2), admin recibe **1 notif** (antes 4). SQL spot-check: `SELECT id, tipo, JSON_EXTRACT(payload,'$.intercambioGrupoId') FROM notificacion WHERE usuario_id=X ORDER BY id DESC LIMIT 10;`.
2. Caso admin→APROBADA directa: otro admin del centro recibe **1 notif** "Incidencia aprobada en tu centro · …".
3. No regresión aprobación: admin aprueba PENDIENTE → solicitante recibe **1** "aprobada", no N.
4. No regresión cancelado/sustitucion/evento: alumnos siguen recibiendo 1 notif por su grupo (los hermanos tienen alumnos distintos).
5. Borrado cascade: `/admin/incidencias` → click "borrar" en una sola fila de un intercambio multi-cara → todas las hermanas del grupo desaparecen del listado en una sola acción. SQL: `SELECT id, deleted, intercambio_grupo_id FROM excepcion_horario WHERE intercambio_grupo_id = '<uuid>';` — todas con `deleted=1` tras el flush.

**Decisión nueva (D-nuevas)**:

- **D-NOTIF-1** (cerrada) — Cuando un admin crea APROBADA directa, los OTROS admins del centro reciben notif tipo `excepcion_aprobada_directa` (distinto de `excepcion_pendiente` para que el frontend pueda diferenciar copy). Razón: la rejilla `/admin/horarios` no avisa de acciones de terceros admins; sin esta notif el equipo de coordinación pierde visibilidad. Solicitante queda excluido por el mismo guard que `excepcion_pendiente`. El destinatario semántico admin+profe (caso Sara) recibe **dos** notifs simultáneas (incidencia_propuesta + excepcion_aprobada_directa) — aceptado como redundancia útil (rol profe vs rol admin); si molesta en uso real, excluir destinatario semántico del set de admins.

- **D-NOTIF-2** (cerrada) — Dedupe por `intercambioGrupoId` se implementa en el dispatcher (no en el subscriber gemelo). Razón: el subscriber gemelo cumple su contrato canónico (duplica la EH para que aprobaciones cascadeen); la responsabilidad de no spamear es del dispatcher, donde se aplica a los 4 `notify*` cascadeables con un solo helper reutilizable.

- **D-NOTIF-3** (cerrada) — Memoria in-process + DQL para el dedupe. Razón: las N notifs cascadeadas se persisten sin flush intermedio en el mismo batch; el DQL solo no las detecta. El array no se resetea entre batches (UUIDs únicos descartan colisiones; tamaño despreciable en escala del producto). Trade-off aceptado: ~1 query extra DQL por notificación cascadeable (el primer chequeo siempre, los subsiguientes hit memoria).

- **D-CASCADE-1** (cerrada) — El cascade soft-delete vive en `IntercambioGrupoCascadeSubscriber` (mismo subscriber que el cascade de estado), no en un subscriber separado. Razón: ambos son la misma operación conceptual ("mutación atómica del grupo de caras"); duplicar el patrón en dos clases multiplica el riesgo de divergencia. El refactor extrae los dos comportamientos a métodos privados (`cascadeEstado`, `cascadeSoftDelete`) reusando el mismo guard, la misma query "otros del grupo" y el mismo `$processing` anti-loop. UI mantiene EH como filas individuales — no se agrupa el listado de `/admin/incidencias` (el usuario lo prefiere así para auditar cada cara por separado).

**Mejora opcional pendiente** (no bloqueante): claves i18n × 5 para `notifications.types.excepcion_aprobada_directa.{title,body}` + icon Lucide en `<SystemNotificationsList>`. Sin esto, el frontend muestra el texto en español que envía el backend (compatible). Apuntar como item residual cuando se reabra ronda de pulido UX.

### 2026-05-08 (sesión siguiente) — Smoke test E2E intercambio ✅ Cerrado

Tras levantar Docker en la siguiente sesión y ejecutar los 9 puntos del smoke test pendientes de la sesión anterior (Fase C.3 modal "Nueva incidencia"), el usuario reportó OK en todos. Los 4 tipos del catálogo (`sustitucion`, `cancelado`, `evento_especial`, `intercambio`) operativos desde click derecho en `/admin/horarios`.

Detalle de los 9 puntos validados, en la entrada "🔬 Validación E2E ✅ cerrada" más abajo (sección "2026-05-08 (continuación 2) — Fase C.3").

Sin código tocado en esta sesión: solo cierre de validación + bitácora.

### 2026-05-08 (continuación 2) — Fase C.3 ✅ Done — modal "Nueva incidencia" desde click derecho en `/admin/horarios`

Atajo desde el editor admin sin tener que pasar por `/admin/excepciones`. El admin que está cuadrando un curso puede ver un placement raro y crear una excepción puntual sobre ese mismo bloque sin perder contexto.

**Decisión clave de UX**: el gesto es **click derecho** sobre el placement (preventDefault del menú nativo del navegador). Razón: el click izquierdo ya está cogido por `handleTapCell` (coloca la imparticion seleccionada o vacía la celda) y no podemos sobrecargarlo. Click derecho es el patrón estándar para "acciones secundarias contextuales", lo que aquí encaja: la creación de excepciones es la acción rara, no la principal.

**Comportamiento**:
- Click derecho sobre placement con `hid` (Horario persistido en BD) → abre `<NuevaExcepcionModal>` con prefill (`horarioBase`, fecha sugerida según tipo de PL, hint con materia/grupo/tramo).
- Click derecho sin `hid` (placement local del draft `pendingTx`) → toast `exceptions.savePlacementFirst` ("Guarda primero los cambios para crear una incidencia sobre este bloque").
- Tap-mode activo (`selectedImpId !== null`) → no se intercepta el click derecho (dejamos el menú nativo del navegador para no robarle "inspeccionar elemento" mientras coloca).
- Click derecho en celda vacía → no hace nada (deja el menú nativo).

**Fecha sugerida** (helper `computeFechaSugerida`):
- PL tipo SEMANA con `fechaInicio` → `fechaInicio + (diaIdx - 1)` días.
- PL tipo PLANTILLA o sin fechas → próximo `diaIdx` desde hoy hacia adelante (incluye hoy si coincide). El admin puede cambiar la fecha en el modal antes de submit.

**Tipos disponibles en el modal**: los **4** del catálogo — `sustitucion`, `cancelado`, `evento_especial` e `intercambio`. La primera versión del componente (esta misma sesión) excluía intercambio para acotar; tras pregunta del usuario se añadió porque dejarlo fuera obligaba a saltar a `/admin/excepciones` solo para ese tipo, rompiendo la promesa "atajo desde el editor". Implementación: cuando `tipo === 'intercambio'` se renderiza el `<HorarioGridPicker>` con `selections={form.parejasB}`, `targetMinutes={durA}` (calculado desde `target.horaInicio/horaFin`), `excludeProfesorId={target.profesorId}` (titular base) y `weekAnchor` derivado de `fechaSugerida`. Submit branchea: intercambio → `POST /api/v1/excepciones/intercambio` con `{horarioBaseA, fechaConcretaA, parejasB[]}`; resto → `POST /api/excepcion_horarios` genérico. Modal pasa a `size="large"` cuando hay picker (~6 días × 12 slots) para que la rejilla quepa cómoda.

**Estado de la excepción al crear**: el backend (`ExcepcionHorarioProcessor`) detecta `ROLE_ADMIN`/`ROLE_SUPERADMIN` y marca `APROBADA` automáticamente con `aprobadaPor=usuarioActual` + `fechaResolucion=now`. Frontend POSTea con el shape genérico, sin pasar `estado` — el processor decide. Mismo patrón que el modal del TimeTable (que crea PENDIENTE para profe y APROBADA para admin sobre el mismo endpoint).

**Ficheros tocados**:

- `frontend/src/components/NuevaExcepcionModal.jsx` (NUEVO, ~210 líneas) — componente reusable con `<ModalView>` + form (tipo, fecha, profeOverride si aplica, motivo, observaciones). Submit POST `/api/excepcion_horarios`. Toast de éxito y `onSuccess(created)` callback. Reusa `crudStyles` (`Crud.module.css`) para los inputs y `TimeTable.module.css` para `modalBody`/`subValue`. 100% temático: variables `--space-*`, `--text-*`, `--bg-*`, motion tokens. Sin literales.
- `frontend/src/pages/HorariosEditor.jsx`:
  - Import `NuevaExcepcionModal`.
  - Estado nuevo `[exceptionTarget, setExceptionTarget] = useState(null)`.
  - Helper `computeFechaSugerida(diaIdx)` (memo `useCallback` sobre `selectedPl`).
  - Handler `handleContextMenuPlacement(e, diaIdx, slotIdx)` — preventDefault + valida placement con hid + setea exceptionTarget con shape requerido por el modal.
  - `SlotCell` acepta nueva prop `onContextMenu` y la propaga al `<div>` raíz.
  - El render del SlotCell pasa `onContextMenu={(e) => handleContextMenuPlacement(e, d.idx, slotIdx)}`.
  - `<NuevaExcepcionModal>` montado al final del JSX (antes del cierre de `Container`).
- `frontend/src/i18n/locales/{es,en,ca,gl,eu}.json` — 3 claves nuevas en `exceptions.*`:
  - `errorFechaRequired` (validación submit).
  - `createdDesc` (descripción del toast de éxito: "Aplicada al horario y notificada a los afectados").
  - `savePlacementFirst` (warning cuando placement no tiene hid).

**Live updates**: el modal POSTea contra `/api/excepcion_horarios` y el `LivePublishSubscriber` genérico publica al hub. El editor `/admin/horarios` no está en la lista de vistas live (excluido por colisión con `pendingTx`), así que tras crear la excepción **el cambio NO se refleja inmediatamente** en la rejilla del editor — se vería al recargar o al cambiar de PL/grupo. Mitigaciones posibles si surge fricción: refetch manual del listado de horarios tras `onSuccess` (sin tocar `pendingTx`), o invalidar la cache del PL activo. **No implementado en C.3** porque la rejilla del editor no muestra excepciones (es la rejilla del horario base) — la excepción aparecería en `/horarios` profe / TimeTable ese día concreto, no en la rejilla maestra.

**Cierra**: tarea diferida C.3 del INDEX (sección "Estado de tareas pendientes en intercambio-imparticiones") y de la lista "Diferidos a Fase C.2 (polish)" en este doc.

**🔬 Validación E2E ✅ cerrada (2026-05-08, sesión siguiente)**. Smoke test de los 9 puntos ejecutado con Docker up y reportado OK por el usuario. Todos los tipos del catálogo (`sustitucion`, `cancelado`, `evento_especial`, `intercambio`) operativos desde el modal C.3. Puntos validados:

1. ✅ F5 `/admin/horarios` con un grupo cargado y PL activo.
2. ✅ Click derecho sobre placement guardado → modal abre con prefill correcto (materia, grupo, tramo, fecha sugerida según tipo de PL).
3. ✅ Cambiar tipo a "Intercambio" → modal se ensancha (`size=large`) y aparece `<HorarioGridPicker>` bajo los campos.
4. ✅ Dropdown de profesor del picker NO lista al titular del placement A (`excludeProfesorId=target.profesorId`).
5. ✅ Elegir profesor B y seleccionar bloques hasta que Σ minutos == minutos A (badge verde "✓").
6. ✅ Crear → toast "Incidencia creada" + las N+1 caras persistidas con mismo `intercambioGrupoId` UUID.
7. ✅ `/admin/excepciones` muestra la fila como APROBADA y agrupada (1 fila por intercambio, expand muestra N caras).
8. ✅ Overlay en `/horarios` de los profes implicados visible para esa fecha concreta.
9. ✅ Caso límite con `excludeProfesorId` undefined: picker lista a todos los profes.

**Pendientes que quedan** del roadmap intercambio-imparticiones:
- C.4 página `/mis-incidencias` (vista profe con sus solicitudes).
- Badge en rejilla `/admin/horarios` (task #17) — marcar visualmente placements con incidencia aprobada en la semana visible.
- Plan B2 multi-profe (intercambio 1↔N caras de varios profes).
- Validación cross-conflicto en POST /excepciones/intercambio.
- Filtro fecha desde/hasta en `/admin/excepciones`.

### 2026-05-08 (continuación) — Fase B.3 ✅ Done — Consumición resta CANCELADO/EVENTO_ESPECIAL + opción A desambiguación visual sintético

Dos piezas diferentes que se validaron juntas en la misma sesión.

**Fase B.3 — Consumición awareness** (cierra task #16 "Fase B — banner anual + Consumición"):

`ConsumicionAnualService::computeForGrupo` ahora descuenta los minutos de incidencias APROBADAS de tipo CANCELADO o EVENTO_ESPECIAL (no INTERCAMBIO ni SUSTITUCION — esas reasignan, no eliminan minutos curriculares). Implementación:

- Nuevo método privado `loadIncidenciasRestadoras(Grupo $grupo)`: DQL que carga las incidencias con join a horario→imparticion donde `imparticion.grupo = $grupo`, filtradas por `estado=APROBADA` y `tipo IN (CANCELADO, EVENTO_ESPECIAL)`. Devuelve array indexado por `imparticionId` con `[fecha, minutos, tipo]` por incidencia. Los minutos se calculan a partir de `horarioBase.horaInicio/Fin`.
- En el bucle por materia se aplica la resta en cuatro puntos:
  1. `planTotal -= minutosPerdidos` (toda la incidencia, cuente o no).
  2. `impartidoTotal -= minutosPerdidosHasta(fechaRef)` (solo las ya pasadas).
  3. `porRango[i].minutosPlanificados/Impartidos`: cada incidencia se ubica en el rango cuyo `[fechaInicio, fechaFin]` contiene su `fecha`. Sin esto la UI mostraba los rangos sin descontar (bug detectado al validar — el banner por evaluación lee `porRango`, no `porEvaluacion`).
  4. `porEvaluacion[].minutosPlanificados/Impartidos`: mismo principio que los rangos.
- DTO de salida: dos nuevos campos por materia, `minutosPerdidosIncidencias` y `minutosPerdidosIncidenciasHoy`. Los consumidores actuales del banner no los usan; quedan disponibles para futuras visualizaciones tipo "X horas perdidas por incidencias".

**Validación end-to-end**:
1. CLI `app:fase8:consumicion 1` con grupo 1º DAW antes/después de aprobar una incidencia tipo CANCELADO de 120min sobre Sistemas informáticos (lunes 4/5 10:50-12:50): `minutosPerdidosIncidencias=120`, rango 323 baja de 2112→1992 plan y 1344→1224 impartido.
2. Banner UI `/admin/horarios` tab Consumición tras `docker compose restart backend` (OPcache PHP-FPM no recoge cambios del Service hasta reiniciar — el CLI sí porque arranca un proceso fresh): Plan 33.2h / Impartido 20.4h en "Hasta 3ª Evaluación".

**Opción A — desambiguación visual sintético** (refinement post-Plan B):

El sintético de un intercambio (cara que cubres) muestra el bloque del horario base de la otra persona pero con TU materia/profesor. Cuando el usuario tiene además su propia clase regular en la misma jornada (caso real: Alberto cubre Sara Vie 8:30-9:30 + tiene su clase regular Vie 9:30-10:30), los dos bloques se renderizan consecutivos con el mismo nombre de materia y se hace difícil distinguir cuál es el sintético marcado y cuál la clase normal.

- Backend `GetMyScheduleController::loadOverrideAssignedEvents` expone tres campos extra en cada evento sintético: `_overrideTitularNombre` (nombre + apellidos del titular del horario base cedido), `_overrideMateriaBase` (nombre completo) y `_overrideMateriaBaseAbrev` (abrev). Se obtienen del `horarioBase.imparticion.profesor` y `horarioBase.imparticion.materia`. Se devuelven incluso si el sintético no cambia de materia — el frontend decide si mostrarlos comparando con la efectiva.
- Frontend `TimeTable.jsx`:
  - Placement card: nueva línea entre el grupo y el tag, "Cubres a {Titular}" + (si la materia base difiere de la efectiva) "· {baseAbrev}→{efAbrev}". Solo aparece para sintéticos `_overrideAssigned` con titular conocido.
  - Modal de detalle: nuevo `detailRow` con icono Shuffle: "Cubres a Sara López (en lugar de IPE)". Solo cuando la materia base difiere para no introducir ruido cuando es la misma.
- `TimeTable.module.css`: clases nuevas `.eventOverrideMeta` (fontsize 0.65rem, opacity 0.85, ellipsis) y `.eventOverrideSwap` (font-weight 600). Sin colores hardcodeados — todo themed.
- `i18n` × 5 (es/en/ca/gl/eu): nuevas claves `exceptions.coveringFor` y `exceptions.insteadOf`.

Validación visual: en el caso de Alberto cubriendo a Sara, el bloque sintético del Vie 8:30 ahora muestra "Cubres a Sara López · IPE→SIS" y queda visualmente distinguible del regular del 9:30. El user confirmó "ok, ya se muestra bien".

### 2026-05-08 — Plan B ✅ Done — refactor pareja → grupo + multi-bloque mismo profe

Tras pregunta del usuario sobre intercambio asimétrico (1 bloque de 120min por 2 de 60min), refactor del modelo bilateral 1↔1 (`intercambio_pareja_id` self-FK) a un grupo identificado por UUID compartido (`intercambio_grupo_id`). El nuevo modelo permite N caras por intercambio manteniendo la regla simétrica en MINUTOS TOTALES (no en cantidad de bloques): Σ duración B == duración A.

Decisión cerrada (multi-profe diferido a Plan B2): todas las parejas B deben pertenecer al MISMO profesor B. Multi-profe queda anotado pero no implementado — la complejidad semántica de N profes cubriendo en distintas franjas la misma clase de A no merece el esfuerzo hasta que aparezca una demanda real.

**Backend**:
- Migración `Version20260508120000` añade columna nullable `intercambio_grupo_id VARCHAR(36)` + índice `idx_eh_grupo`. Backfill: a las parejas existentes (filas con `intercambio_pareja_id`) les asigna un UUID v4 compartido. El campo legacy `intercambio_pareja_id` se mantiene como deprecated para que código que lo lea siga funcionando; nuevas filas 1↔N tienen `intercambio_pareja_id` NULL pero `intercambio_grupo_id` set.
- `ExcepcionHorario` entity: nuevo campo `intercambioGrupoId` con getters/setters. Doc en el comentario de la propiedad.
- `IntercambioController` reescrito para aceptar `parejasB: [{horarioBaseB, fechaConcretaB}, ...]`. Compat retroactiva: si el body llega con `horarioBaseB`/`fechaConcretaB` singulares se convierten a un array de un elemento. Validaciones:
  - Σ duración B == duración A (en minutos).
  - Todas las B son del MISMO profesor B (distinto del de A).
  - Mismo centro entre A y todas las B.
  - Cada fecha coincide con el diaSemana de su horario base.
  - Bloques distintos (no se permite usar el mismo `horarioBaseB` dos veces).
- Genera UUID v4 al crear el grupo. Persiste 1+N caras con mismo `intercambio_grupo_id`. Para 1↔1 también setea `intercambioPareja` legacy (compat con código frontend que aún lo lea); para 1↔N el legacy queda NULL.
- Nuevo `IntercambioGrupoCascadeSubscriber` reemplaza `IntercambioParejaCascadeSubscriber` (archivo borrado). Misma lógica de cascade en `preUpdate` pero busca miembros via `intercambio_grupo_id` en lugar de `intercambio_pareja_id`. Re-entrancy guard + `recomputeSingleEntityChangeSet` para que Doctrine schedule los UPDATEs en el mismo flush.

**Frontend**:
- `HorarioGridPicker`: cambia de selección singular a array `selections`. Click en bloque toggle (añade si no está, quita si está). `targetMinutes` prop nueva — el caller pasa la duración del bloque A. Footer del picker muestra: lista de bloques seleccionados con ✗ remove + total acumulado vs target con badge color-success/warning/error según cuadre. CSS `.cart`, `.cartList`, `.cartItem`, `.cartRemove`, `.cartTotal*` themed sin literales.
- `TimeTable.jsx` modal "Solicitar cambio": estado `excForm.parejasB` array (sustituye `horarioBaseB`/`fechaConcretaB`). El render del picker calcula `durA` desde `selectedEvent.horaInicio/Fin` y se lo pasa como `targetMinutes`. Submit envía array.
- `Excepciones.jsx` modal admin: ídem. Captura el horario base seleccionado en `formData.horarioBaseObj` (vía segundo argumento de `AsyncSearchSelect.onChange`) para conocer su duración y pasarla al picker.

**Validación end-to-end (pendiente del usuario)**:
1. Aplicar migración: `./scripts/migrate.sh`.
2. Ctrl+Shift+R en navegador.
3. Crear intercambio multi-bloque: Alberto cede su bloque de 120min, Joaquín cubre con 2 de 60min seleccionados en el picker. Footer muestra "120min / 120min ✓". Submit aprueba.
4. Verificar BD: `SELECT id, horario_base_id, fecha_concreta, intercambio_grupo_id FROM excepcion_horario;` — 3 filas con mismo `intercambio_grupo_id` (1 cara A + 2 caras B).
5. Sara aprueba 1 cara desde `/admin/excepciones` → cascade subscriber propaga a las 3.
6. Joaquín ve 2 placements sintéticos "✦ Cubres" en sus fechas correspondientes; Alberto ve "↔ Joaquín" en la suya.

**Limitación / siguiente paso**:
- Detail modal de `/admin/excepciones` aún muestra `intercambioParejaId` (legacy). Para 1↔N quedará NULL. Próxima iteración: enumerar miembros del grupo via `intercambio_grupo_id` y mostrarlos como lista expandible en el modal.
- Listado `/admin/excepciones` muestra N filas por intercambio (1 cara A + N caras B). Densidad aumenta. El rediseño "1 fila por intercambio" que aparcamos ahora cobra más relevancia — anotable como tarea futura.

### 2026-05-07 (noche, 8ª iteración + retoques) — Topic 1 ✅ Done + outline visible + notif destinatario + auto-open

Tras feedback del usuario sobre Topic 1: el outline dashed era poco visible y faltaba notificación al destinatario que enlace a la fecha + abra el modal.

**Outline visible**: `.eventCardPending` actualizada — `outline: 3px dashed var(--color-warning)` (en lugar del antiguo info al 70%) + sobrescribe el inset shadow de eventCardException con uno suave + animación `pendingPulse` 2.4s opacity 0.65↔0.95 que llama la atención sin ser ruidoso. Variables temáticas, 0 hex.

**Notificación al destinatario**:
- Nuevo tipo `incidencia_propuesta` en el catálogo. Icono `HelpCircle` en TYPE_ICONS de `SystemNotificationsList`.
- `NotificationDispatcher::notifyIncidenciaPropuesta(eh)` detecta destinatario semántico por tipo (profeOverride para sustitución/evento; imparticionEfectiva.profesor para intercambio; CANCELADO sin destinatario). Guard anti-spam si solicitante == destinatario.
- Se dispara desde `dispatchExcepcionPersist` cuando estado=PENDIENTE_APROBACION. Se añade junto a la notificación al admin (excepcion_pendiente).
- Enlace: `/horarios?fecha=YYYY-MM-DD&excepcion=ID`. El fecha lleva al calendario al día concreto; el excepcion id auto-abre el modal del placement sintético.
- i18n × 5 con interpolación `{{solicitanteNombre}} te propone una {{tipo}} para el {{fecha}} ({{materia}} · {{grupo}})`.

**Auto-navegar + auto-open**:
- `Horarios.jsx`: parsea `?fecha=` (lazy useMemo, una vez al montar) e inicializa selectedDate. Parsea `?excepcion=` y guarda en estado `autoOpenExcepcionId`.
- TimeTable acepta props nuevas `autoOpenExcepcionId` + `onAutoOpenConsumed`.
- `useEffect` en TimeTable: cuando autoOpenExcepcionId está presente y events incluye uno con `_overrideExcepcionId === autoOpenExcepcionId`, llama `setSelectedEvent(target)` → modal abre. Tras consumir, dispara `onAutoOpenConsumed()` que borra los query params (`replace: true`) para que un F5 no repita la apertura.
- Resultado: Joaquín pulsa la campanita → llega a `/horarios?fecha=2026-05-15&excepcion=42` → calendario en mayo 15 + modal abierto sobre la clase con botón "Rechazar este cambio" en rojo. Sin búsquedas.

**Topic 1 — destinatario rechaza desde /horarios** (resumen del bloque original):

Backend `RechazarExcepcionController`:
- `POST /api/v1/excepciones/{id}/rechazar` con body `{respuesta?: string}`.
- Detecta destinatario por tipo. Valida caller == destinatario semántico, estado=PENDIENTE.
- Setea estado=RECHAZADA, aprobadaPor=destinatario, fechaResolucion=now, respuestaAdmin opcional.
- Cascade subscriber + notification subscriber + cache invalidation hacen el resto via Doctrine events.

Backend `GetMyScheduleController`:
- `loadOverrideAssignedEvents` ahora incluye PENDIENTES además de APROBADAS. Cada synthetic event expone `_overrideEstado` y `_overrideCanReject`.

Frontend:
- `Horarios.jsx visibleSchedule` emite `_excepcionTipo: 'asignada_pendiente'` cuando el evento sintético está pendiente.
- `TimeTable.jsx`: clase CSS `eventCardPending` (dashed pulse), tag `⏳ Pendiente`, handler `handleRejectExcepcion`, botón "Rechazar este cambio" (color-error) cuando `_overrideCanReject`. El botón "Solicitar cambio" se oculta sobre placements sintéticos.
- i18n × 5 con `rejectChange`, `rejectedByDestinatario`, `rejectedByDestinatarioDesc`.

### 2026-05-07 (noche, 7ª iteración) — Fase E.2 ✅ Done — cascade pareja intercambio + pulido picker

**Pulido del HorarioGridPicker (continuación de la 6ª iter.)**:
- ModalView pasa a `size="large"` (900px) cuando `tipo=intercambio`. Para los demás tipos sigue `small/medium` como antes. El cambio del tipo en el select dispara re-render → la ventana crece/encoge dinámicamente.
- Bloques del picker renderizan `materia.abreviatura || materia.nombre` (p.ej. "SI" en vez de "Sistemas informáticos"). El `title` (tooltip al hover) mantiene el nombre completo + grupo + duración. Cabe holgadamente en los ~145px por columna.
- Selector de profe del picker pasa de `rol_app=profesor` (valor único) a `rol_app=[profesor, admin]` (multi-valor → SQL `IN`). Sara y otros admins-que-imparten aparecen ahora junto a los profes puros. Edge: un admin que NO imparte aparece en la lista pero al elegirlo el grid se renderiza vacío con placeholder claro. Aplicado al mismo filtro en el selector de "Profesor sustituto" de TimeTable y Excepciones admin.

**Fase E.2 — cascade aprobar/cancelar pareja intercambio ✅ Done**:

Limitación documentada en la 6ª iter.: aprobar/rechazar/cancelar UNA cara de un intercambio bilateral dejaba la otra colgada. Sara podía aprobar la cara A y olvidar la B → solo se aplicaba media permuta. Solución: nuevo subscriber `IntercambioParejaCascadeSubscriber`:

- `#[AsDoctrineListener(event: Events::preUpdate)]` — detecta cambios en `estado` de cualquier `ExcepcionHorario`.
- Si la entidad tiene `intercambioPareja` y la pareja no está ya en el estado nuevo, replica `setEstado` en la pareja + replica `aprobadaPor` + `fechaResolucion` + `respuestaAdmin` (si la cara original los lleva) + `revertida` (si reversión).
- `recomputeSingleEntityChangeSet` para que Doctrine schedule el UPDATE de la pareja en el MISMO flush.
- Re-entrancy guard estático `private bool $processing`: la cascada modifica B durante el preUpdate de A; cuando B se procese (preUpdate B), el guard devuelve early evitando volver a tocar A. Sin el guard sería loop infinito.

**Compatibilidad con NotificationDispatchSubscriber**: ambos suscriben a `preUpdate` de `ExcepcionHorario`, son listeners independientes. Cuando A cambia → cascade toca B → preUpdate de B fire → NotificationDispatchSubscriber registra B en su cola → en postFlush A y B emiten sus respectivas notificaciones. Resultado deseado: aprobar un intercambio bilateral dispara las notificaciones a las dos partes (titular A, sustituto en cara A, alumnos cara A; titular B, sustituto en cara B, alumnos cara B).

**Validación**:
1. Sara en `/admin/excepciones` ve dos pendientes (las dos caras del intercambio creado por Alberto).
2. Aprueba SOLO la cara A → BD: ambas caras quedan APROBADA con el mismo `aprobada_por_id` y `fecha_resolucion`.
3. Notificaciones llegan a las dos partes.
4. Sara revierte la aprobación de A (Undo2) → ambas caras pasan a CANCELADA con `revertida=true`. Alumnos de ambos grupos reciben aviso.
5. Si Sara borra (soft-delete) UNA cara, la otra NO se borra automáticamente — `delete` no es un cambio de `estado`, es un soft-delete distinto. Podríamos cascadar también el delete pero es caso extremo (admin borrando manualmente fila individual). Anotable como E.3 si surge.

### 2026-05-07 (noche, 6ª iteración) — Fase E ✅ Done — UI atómica intercambio bilateral

**Backend** — controller dedicado `App\Controller\IntercambioController`:

- `POST /api/v1/excepciones/intercambio` con body `{ horarioBaseA, fechaConcretaA, horarioBaseB, fechaConcretaB, motivo, observaciones }`.
- Crea **dos** `ExcepcionHorario` linked vía `intercambioPareja` (self-FK bidireccional). Cada cara lleva `imparticionEfectiva` apuntando a la imparticion del otro profe (la que de facto se imparte en esa fecha).
- Validaciones:
  - Bloques distintos (`horarioBaseA != horarioBaseB`).
  - Bloques del mismo centro (un profe no puede intercambiar con otro centro).
  - Profes distintos (no auto-intercambio).
  - `fechaConcretaA.diaSemana == horarioA.diaSemana` y mismo para B.
  - Validators de la entidad ejecutados antes de persistir.
- Estado se decide por rol del solicitante: profe puro → ambas caras `PENDIENTE_APROBACION`; admin/superadmin → ambas `APROBADA` con `aprobadaPor`+`fechaResolucion`.
- Persistencia atómica con dos flushes: el primero asigna IDs; el segundo aplica las referencias mutuas `intercambioPareja`. Si el segundo flush falla, las caras quedan sin link (caso edge a manejar en Fase E.2 con transacción explícita; para MVP está OK porque ambos flushes son contra la misma DB connection).
- El subscriber `NotificationDispatchSubscriber` se activa en postPersist para cada cara, disparando notificaciones (admin si pendientes, solicitante+sustituto+alumnos si aprobadas).

**Frontend** — UI en los dos puntos de creación:

- `TimeTable.jsx` (modal "Solicitar cambio" del profe):
  - Reabierta opción `intercambio` en el select de tipo.
  - Cuando `intercambio` está seleccionado, muestra dos campos extra: `horarioBaseB` (AsyncSearchSelect `/api/horarios` con un getOptionLabel rico que incluye día, hora, materia y profe) y `fechaConcretaB` (date picker).
  - `handleSubmitExcepcion` ramifica: si tipo=intercambio, POST al endpoint dedicado con los 4 campos; si no, POST a `/api/excepcion_horarios` como antes.
- `Excepciones.jsx` (modal admin "Nueva incidencia"):
  - `TIPOS_CREATE` ahora incluye los 4 valores.
  - Se elimina el viejo campo `imparticionEfectiva` del modal (Fase E lo deriva del `horarioBaseB`).
  - Cuando `intercambio`, muestra los mismos dos campos extra y el submit usa el endpoint dedicado.
- 0 estilos nuevos: reuso completo de `Crud.module.css` y `crudStyles` ya importado.
- i18n × 5 idiomas: claves `exceptions.horarioBaseB` y `exceptions.fechaConcretaB` en es/en/ca/gl/eu. JSONs validados.

**Qué resuelve la fase E**:
- Antes: el admin/profe podía elegir "Intercambio" del select pero no había campos para la pareja → POST creaba una fila huérfana sin imparticionEfectiva ni intercambioPareja. Sara podía aprobarla pero no aportaba nada (clase sin sustituto, sin pareja). Ese option se ocultó en la 4ª iteración con un comentario "hasta Fase E".
- Ahora: el flow completo. Profe X reserva su clase del lunes y elige una clase de profe Y para cubrir el viernes. Sara aprueba la pareja entera; X y Y reciben notificaciones cruzadas; ambos ven el cambio en sus respectivos `/horarios` (X: badge "↔ Y" en su lunes; Y: clase sintética nueva con badge "✦ Cubres" en su lunes; X: clase sintética nueva en el viernes; Y: badge "↔ X" en su viernes).

**Limitación conocida (Fase E.2 cuando se necesite)**:
- Cancelar una cara del intercambio NO cancela automáticamente la pareja. Si Sara revierte la aprobación de la cara A, la cara B sigue aprobada y el sistema queda en estado inconsistente (profe X cubre a Y el viernes pero Y no cubre a X el lunes). Mitigación temporal: el admin debe revertir ambas. Plan para próxima iteración: añadir hook en `preUpdate` o un `IntercambioParejaCascadeSubscriber` que propague cambios de estado a la pareja.
- La compensación tipo "Alberto da una doble después para recuperar" sigue siendo un caso distinto que requiere `tipo=RECUPERACION` o equivalente — anotado como D-H en la lista de decisiones pendientes pero no implementado.

### 2026-05-07 (noche, 5ª iteración) — Fase D ✅ Done — notificaciones a afectados

Sistema de notificaciones automatic ya operativo desde 2026-05-05 (entidad `Notificacion` + `NotificationDispatcher` + `NotificationDispatchSubscriber` + topic Mercure `/users/{id}/notifications` + campanita en header). Fase D extiende esos cuatro puntos para cubrir las transiciones de `ExcepcionHorario` con 6 tipos nuevos en el catálogo.

**Catálogo de tipos nuevos**:

| Tipo | Cuándo se dispara | Destinatario(s) | Enlace |
|---|---|---|---|
| `excepcion_pendiente` | postPersist con estado=PENDIENTE | Admin/SuperAdmin del centro (excepto si solicitante también es admin) | `/admin/excepciones` |
| `excepcion_aprobada` | postUpdate con estado→APROBADA | Solicitante (excepto si solicitante=aprobador, evita auto-notificación admin atajo) | `/horarios` |
| `excepcion_rechazada` | postUpdate con estado→RECHAZADA | Solicitante (mismo guard) | `/horarios` |
| `sustitucion_asignada` | postPersist+APROBADA o postUpdate→APROBADA y profeOverride no nulo | profeOverride | `/horarios` |
| `clase_cancelada` | tipo=CANCELADO al pasar a APROBADA | Alumnos matriculados del grupo del horarioBase | `/horarios` |
| `clase_trasladada` | resto de tipos al pasar a APROBADA | Alumnos del grupo | `/horarios` |

**Dispatcher** `App\Service\NotificationDispatcher`:
- 4 métodos públicos nuevos: `notifyExcepcionPendiente`, `notifyExcepcionResuelta($eh, bool $aprobada)`, `notifySustitucionAsignada`, `notifyAlumnosCambioClase`. El último decide entre `clase_cancelada` y `clase_trasladada` por el `tipo` de la excepción.
- Todos persisten sin flush (patrón existente — el flush lo hace el subscriber en postFlush para no encadenar flushes durante un postPersist en cadena).
- Helper `labelTipoExcepcion($tipo)` para copys ES en mensajes (los strings duros del español son fallback; el frontend traduce vía clave i18n + payload).
- Guard anti-spam: `notifyExcepcionResuelta` no auto-notifica si solicitante.id === aprobador.id (caso admin atajo Sara crea aprobada directa o admin aprueba su propia solicitud).

**Subscriber** `App\EventSubscriber\NotificationDispatchSubscriber`:
- `pendingPersist` extendido para aceptar `ExcepcionHorario`.
- `pendingExcepcionUpdate` (nueva cola) registra pares (entidad, oldEstado, newEstado) cuando `preUpdate` detecta cambio en el campo `estado`.
- `dispatchExcepcionPersist($eh)`: si PENDIENTE → `notifyExcepcionPendiente`; si APROBADA (admin atajo) → `resuelta(true)` + `sustitucionAsignada` + `alumnosCambioClase`.
- `dispatchExcepcionUpdate($eh, $old, $new)`: ramifica según `newEstado` (APROBADA/RECHAZADA/CANCELADA con revertida).
- Procesa en `postFlush` igual que el resto. Re-entrancy guard heredado.

**Frontend**:
- `SystemNotificationsList.jsx`: 6 entradas nuevas en `TYPE_ICONS` (Shuffle/Check/X/UserCheck/CalendarOff/ArrowLeftRight). Sin más cambios — la campanita ya consume cualquier `Notificacion` con su `tipo` traducido vía i18n.
- i18n × 5 idiomas: 6 bloques nuevos en `notifications.types.{tipo}.{title|body}` con interpolación de payload (`solicitanteNombre`, `aprobadorNombre`, `tipo`, `fecha`, `hora`, `materia`, `grupo`).

**Reusabilidad / regla de oro**:
- 0 colores hardcodeados nuevos (la campanita ya está temática, los iconos heredan estilo).
- Reuso completo del sistema existente: `Notificacion` entity, `NotificationDispatcher`, `NotificationDispatchSubscriber`, `LivePublishSubscriber` (publica al topic personal), `SystemNotificationsList`, `useMercure`, claves i18n.
- Sin migration nueva (tabla `notificacion` existe; nuevos tipos son strings en columna `tipo VARCHAR(64)`).

**Cómo validar end-to-end**:
1. Aplicar runtime: `./scripts/clear_cache_hard.sh` (entity-attribute cache + opcache).
2. Logout/login en navegadores afectados (los topics no han cambiado — pero si JWT está stale, hacer F5).
3. **Profe (Alberto)** solicita una sustitución → toast "Solicitud enviada".
4. **Admin (Sara)** ve **campanita** (icono Shuffle) con título "Nueva incidencia pendiente" → click → navega a `/admin/excepciones` → aprueba.
5. Tras aprobar:
   - **Solicitante (Alberto)**: campanita con "Tu incidencia ha sido aprobada".
   - **Sustituto (Joaquín)**: campanita con "Te han asignado una sustitución" (icono UserCheck).
   - **Alumnos del grupo**: campanita con "Una clase ha cambiado" (icono ArrowLeftRight) o "Una clase ha sido cancelada" según tipo.
6. Sara revierte la aprobación → alumnos reciben otra notificación (la clase vuelve al horario base).

### 2026-05-07 (noche, 4ª iteración) — Rename "Excepciones" → "Incidencias" + gate intercambio + Fase B.2 ✅ Done

Tras smoke test del bucle profe→admin con Alberto y Sara, tres ajustes derivados de feedback en sesión:

**Rename** "Excepciones" → "Incidencias" (es) / "Incidents" (en) / "Incidències" (ca) / "Incidencias" (gl) / "Intzidentziak" (eu):
- El admin/profe escolar usa "incidencia" para esta familia (sustitución, cancelación, evento, intercambio). "Excepciones" sonaba técnico.
- 5 locales actualizados en sidebar.exceptions + exceptions.title + subtitle + newTitle + confirmApprove/Reject/Cancel/Delete + createdSuccess/updated/deleted + create.
- URL `/admin/excepciones` y entidad/clase backend `ExcepcionHorario` SIN tocar para no invalidar bookmarks ni requerir migración. La consistencia interna prefiere "excepción" como término técnico; el copy externo usa "incidencia".
- JSON validado en los 5 locales tras edición.

**Gate INTERCAMBIO en select de creación**:
- Bug observado: el modal "Solicitar cambio" del TimeTable (profe) y el de Excepciones.jsx (admin) listaban "Intercambio" en el select de tipo, pero al elegirlo NO mostraban campos para la pareja → se POSTeaba una excepción huérfana sin imparticionEfectiva ni intercambioPareja. Sara podía aprobarla pero no aportaba nada (clase sin sustituto, sin pareja, sin recuperación).
- Causa: la UI atómica de pareja de intercambio bilateral está prevista en Fase E. El select estaba abierto antes de tiempo.
- Fix: array `TIPOS_CREATE` (Excepciones.jsx) excluye `intercambio`. El option en TimeTable.jsx también eliminado. Comentarios explican el motivo. La opción `intercambio` se mantiene en el filtro de la tabla y en el render porque pueden existir filas con ese tipo si se crean por API o cuando llegue Fase E.
- Cleanup: borrado fila huérfana id=4 que el usuario creó durante el smoke.

**Fase B.2 ✅ Done — backend my-schedule devuelve eventos sintéticos para el sustituto/override**:
- Gap detectado: cuando Sara aprueba una sustitución donde Joaquín cubre a Alberto, Joaquín NO veía nada en su `/horarios` porque `GetMyScheduleController::computeSchedule` cargaba solo los horarios donde `i.profesor = user`. Joaquín no es titular de ese placement → su schedule queda igual.
- Fix backend: nuevo método `loadOverrideAssignedEvents($user, $em)` que consulta excepciones APROBADAS futuras (`fechaConcreta >= today`) donde `profeOverride = user OR imparticionEfectiva.profesor = user`. Por cada una, construye un evento sintético con los datos del horarioBase (día, hora, materia/grupo del imp efectivo o del base, profe = override) y lo merge con `events`. Marcadores: `_overrideDate`, `_overrideAssigned`, `_overrideTipo`, `_overrideMotivo`, `_overrideExcepcionId`. ID prefijado `eh-{id}` para distinguirlo de horarios reales y evitar colisiones.
- Fix frontend `Horarios.jsx`: la memo `visibleSchedule` detecta eventos con `_overrideDate` y los filtra por la semana visible (lunes-domingo de selectedDate). Si caen dentro, los incluye con `_excepcionTipo='asignada'` para que TimeTable los pinte con border + tag visual.
- Fix frontend `TimeTable.jsx`: nuevo case `tipo='asignada'` en el switch del eventExceptionTag → muestra "✦ Cubres". Tooltip ("Cubres esta clase — motivo X") al hover.
- Cache invalidation existente ya cubre profeOverride (`CacheInvalidationSubscriber` añadido en Fase B), por lo que Joaquín ve el cambio sin esperar TTL al aprobar Sara.

### 2026-05-07 (noche, 3ª iteración) — Fase C parcial ✅ Done (C.1 + C.2 + C.5): bucle profe→admin operativo

Tras validar Fase B end-to-end (smoke test backend OK, marker visual funcionando en navegador con Alberto), implementadas las piezas mínimas de Fase C que cierran el bucle de creación profe→admin sin Postman.

**C.1 — Página `/admin/excepciones`** (`frontend/src/pages/Excepciones.jsx`, ~440 líneas):
- DataTable themed reusando `Crud.module.css` + `CrudHeader` + `Breadcrumbs`. Patrón idéntico a `Festivos.jsx`.
- Columnas: Fecha · Tramo · Materia · Grupo · Titular · Tipo (badge) · Sustituto/Cambio · Estado (badge tonalizado) · Solicita · Acciones.
- Filtros backend: `?estado=` y `?tipo=` vía `ThemedSelect`. Sort por fechaConcreta DESC default.
- Acciones inline:
  - PENDIENTE → Aprobar (Check) / Rechazar (X)
  - APROBADA → Revertir (Undo2) — pasa a CANCELADA con `revertida=true` (D-F).
  - Cualquier estado → Borrar (Trash, soft).
- Modal de creación con campos condicionados por tipo: tipo (4 opciones), horarioBase (`AsyncSearchSelect` `/api/horarios`), fechaConcreta (date), profeOverride / imparticionEfectiva según tipo, motivo, observaciones. POST estado=APROBADA por defecto (admin atajo).
- Live refetch via `useLiveRefetch(['/admin/centros/{cid}/excepciones'])`.
- Bug ENCONTRADO durante implementación: la respuesta de `/api/excepcion_horarios` solo traía IRIs sin nombres de profe/materia/grupo. Causa: las entidades anidadas no tenían `excepcion:read` en sus Groups. Fix: extender el `normalizationContext` de `ExcepcionHorario` para incluir los grupos existentes `horario:read`, `imparticion:read`, `grupo:read` además de `excepcion:read`. Igual para `payloadGroups` del `LivePublish` (consistencia entre GET y eventos Mercure).

**C.2 — Modal "Solicitar cambio" en `TimeTable`** (~110 líneas añadidas a `TimeTable.jsx`):
- Botón "Solicitar cambio" / "Crear excepción" debajo del existente "Pasar lista" en el modal de detalle del placement. Visible para `isProfesor` o `isAdmin`. El admin ve la etiqueta "Crear excepción" (más imperativa).
- Activa `isRequestingException` que swappea el body del mismo `ModalView` por un form (mismo patrón que `isTakingAttendance`). Title del modal cambia a "Nueva excepción". Footer cambia a "Cancelar" + "Solicitar/Crear".
- Form usa `Crud.module.css` (`crudStyles.formGroup`, `crudStyles.label`, `crudStyles.input`, `crudStyles.select`, `crudStyles.textarea`) — todas las clases ya temáticas, sin estilos inline hardcodeados.
- `fechaConcreta` se calcula automáticamente desde `weekDates[event.diaSemana - 1]` (la fecha real del placement clicado en la semana visible). El profe nunca tiene que elegir fecha — viene del contexto.
- Submit POST a `/api/excepcion_horarios` SIN `estado` en el payload. El processor backend pondrá `pendiente` para profe puro y `pendiente` (default) para admin. Si el admin quiere aprobar directa, lo hace después desde `/admin/excepciones`.

**C.5 — i18n × 5 idiomas + sidebar + routing**:
- 5 locales (`es`, `en`, `ca`, `gl`, `eu`) reciben:
  - `sidebar.exceptions`
  - bloque `exceptions.*` con 25+ claves: title, subtitle, columnas (date/slot/subjectGroup/titular/tipo/override/estado/requestedBy), modal (newTitle/horarioBase/fechaConcreta/profeOverride/profeFacilitador/imparticionEfectiva/motivo/observaciones/searchHorario/searchUser/searchImparticion), acciones (approve/reject/revert/confirmApprove/confirmReject/confirmCancel/confirmDelete), filtros (filterEstado/filterTipo/allEstados/allTipos), feedback (errorRequired/createdSuccess/updated/deleted/requested/requestedDesc/requestChange/create/request/modalHint), `types.{tipo}` (4 valores), `estados.{estado}` (4 valores).
  - JSON validados (`python -m json.tool`) — sin syntax errors.
- `App.jsx`: import `Excepciones` + `<Route path="/admin/excepciones" element={<PrivateRoute allowedRoles={['ROLE_ADMIN']}><Excepciones/></PrivateRoute>}/>` justo después de `/admin/jornadas`.
- `Sidebar.jsx`: import del icono `Shuffle`, `NavLink` `/admin/excepciones` en la sección "Administración" entre Jornadas y la rama Fechas/Calificaciones, y entrada en `routeToAccordionMap` para que abra el acordeón correcto.

**Reusabilidad / regla de oro**:
- 0 colores literales nuevos en JSX/CSS. Todo el form usa `crudStyles.input/select/textarea` y los badges Crud. El form del TimeTable reusa `crudStyles` mediante import desde `pages/Crud.module.css` (mismo patrón que ya hacía `calStyles` desde `pages/Calificaciones.module.css`).
- `ModalView`, `DataTable`, `CrudHeader`, `Breadcrumbs`, `AsyncSearchSelect`, `ThemedSelect`, `Button`, `useConfirm`, `useLiveRefetch`, `toast` — todos componentes/hooks existentes reusados.

**Diferidos a Fase C.2 (polish)**:
- ~~C.3 modal de creación desde click en rejilla `/admin/horarios`~~ ✅ **Done 2026-05-08** (entrada de bitácora dedicada más abajo).
- C.4 vista `/mis-excepciones` para que el profe vea su histórico (creadas + asignadas como sustituto).
- Filtro fecha desde/hasta en `/admin/excepciones`.

**Fase D pendiente** (notificaciones a afectados): hooks `postPersist`/`postUpdate` en `ExcepcionHorario` que disparen `NotificationDispatcher` con 6 tipos nuevos (EXCEPCION_PENDIENTE, APROBADA, RECHAZADA, CLASE_CANCELADA, CLASE_TRASLADADA, SUSTITUCION_ASIGNADA). i18n × 5 para los tipos.

### 2026-05-07 (noche, sigue) — Fase B parcial ✅ Done (3/5 puntos): /horario/me + PDF + cache invalidation + frontend overlay

Tras Fase A de la misma noche, atajada la composición en render para los puntos donde el usuario ve su propio horario. Los puntos 4 y 5 (banner anual + tab Consumición + badge rejilla `/admin/horarios`) quedan diferidos a Fase B.2 — no bloquean MVP usable porque el flujo central (un alumno ve que su clase del martes 12-may pasó de Pepe a Lola) ya funciona.

**Backend `GetMyScheduleController`**:
- Nueva sección al final de `computeSchedule` que invoca `loadExcepcionesAplicables($events, $em)`.
- DQL único con joins a imparticionEfectiva (+ materia + profesor), profeOverride e intercambioPareja, filtrado por `horarioBase IN (events.id) AND estado = APROBADA AND deleted = false`.
- Devuelve un DTO minimalista por excepción con `id, horarioBaseId, fechaConcreta (Y-m-d), tipo, motivo, observaciones, imparticionEfectiva: {id, materia, moduloId, moduloAbrv, profesor, profesorId} | null, profeOverride: {id, nombre} | null, intercambioParejaId`.
- Top-level del response sumado a `events` y `slots`: ahora hay 3 keys.

**Backend `HorarioPdfController`**:
- Aceptado parámetro `?fecha` ya existente (Fase D modelo-semanal). Nuevo: pasa `fecha` a `buildScheduleContext` para que el matrix-builder aplique overlay puntual.
- Dentro de `buildScheduleContext`, antes del foreach que construye el matriz: query DQL `excepcion_horario` con `fechaConcreta = $fecha AND estado = APROBADA AND horarioBase IN (...) AND deleted = false`. Map por `horarioBaseId`.
- En el loop, antes de calcular profNombre/rowSpan/etc.: si hay overlay para el horario:
  - `CANCELADO` → `continue` (skip placement; queda hueco en blanco ese día).
  - `INTERCAMBIO` → swap `imp/materia/profesor/grupoEv` con los de `imparticionEfectiva`.
  - `SUSTITUCION` → swap solo `profesor` con `profeOverride`.
  - `EVENTO_ESPECIAL` → `materia=null` (luego se sustituye por `motivo` o "Evento especial" en `materiaLabel`); `profesor` queda con `profeOverride` si lo hay.
- Matrix entry expone `excepcionTipo` y `excepcionMotivo` para que un futuro twig pueda pintar badge (no aplicado todavía; el PDF actual solo refleja el cambio de profe/materia).

**Backend `CacheInvalidationSubscriber`**:
- Añadido `ExcepcionHorario` al cuadro de tipos manejados.
- En `collectAffectedUserIds` para una excepción: une IDs de `solicitadaPor`, `profeOverride`, y `userIdsForImparticion(horarioBase.imparticion)` (que ya incluye titular + alumnos del grupo via matrículas).
- Sin esto, una excepción APROBADA no se reflejaba en `/horario/me` hasta que expiraba el TTL de 5min del cache `schedule_{userId}`.

**Frontend `Horarios.jsx`**:
- Nuevo state `excepciones` poblado desde `scheduleData.excepciones` en `fetchCalendarData` (compat con respuesta legacy array → `setExcepciones([])`).
- `personalScheduleTopics` extendido con `/users/${user.id}/excepciones` (firmado en JWT desde Fase A) → `useLiveRefetch` ya activo refresca el calendario tras cualquier cambio.
- `visibleSchedule` (memo) extendido: tras el filtro PL existente, calcula la fecha real de cada (event.diaSemana) en la semana que contiene `selectedDate`, indexa `excepciones[]` por `(horarioBaseId, fechaConcreta)` y aplica overlay copiando el event con campos modificados según tipo. Preserva `_excepcion`, `_excepcionTipo` y `_cancelado` para que `TimeTable` (o futuras mejoras) puedan pintar marcadores visuales.
- Cancelado: el event sigue en la lista con `_cancelado: true`; el visual badge/strikethrough se difiere a Fase B.2 al refinar `TimeTable.jsx`.

**Diferidos a Fase B.2**:
- **Banner anual cobertura** (`HorariosEditor.jsx`): restar minutos de excepciones APROBADAS tipo CANCELADO/EVENTO_ESPECIAL al planificado total. Requiere extender `ConsumicionAnualService` backend + recálculos frontend.
- **Tab Consumición** (`ConsumicionAnualService`): mismo ajuste.
- **Badge en rejilla `/admin/horarios`**: marcar visualmente placements con excepción en la semana visible. Requiere cargar excepciones del grupo en el editor + render en la rejilla.
- **Strikethrough en `TimeTable`** para `_cancelado: true` events: refinement visual.

Estas piezas son cosméticas/contables; el flujo principal "el usuario ve su clase con la sustitución aplicada" ya funciona.

**Smoke test sugerido**:
1. Crear via Postman/curl un POST a `/api/excepcion_horarios` con un horario base válido + tipo SUSTITUCION + profeOverride + estado=APROBADA (admin token).
2. Logout/login en navegador del profe override → debería ver el cambio en `/horarios` al navegar a la fecha exacta (la cache se invalida via subscriber + refetch via Mercure).
3. Descargar PDF con `?fecha=` igual a la fechaConcreta → el martes (o el día correspondiente) debe mostrar al sustituto en vez del titular.

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
