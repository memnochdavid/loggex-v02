# Sistema de jornadas y recreos para `/admin/horarios`

> **Status**: en discusión. Documento vivo. No tocar código hasta que el usuario dé visto bueno explícito al diseño completo.
>
> **Origen**: conversación 2026-04-26. El usuario reportó que los slots en `/admin/horarios` están hardcoded de hora en hora y que faltan recreos, configuración por turno y soporte para itinerarios con distinto número de horas semanales (ESO ≠ FP ≠ Bach).

---

## 1. Problema

Hoy el editor de horarios (`frontend/src/pages/HorariosEditor.jsx`) trabaja con dos constantes hardcoded:

```js
const SLOTS_MANANA = [['08:30','09:30'], …, ['13:30','14:30']]; // 6 slots de 1h
const SLOTS_TARDE  = [['15:00','16:00'], …, ['20:00','21:00']]; // 6 slots de 1h
```

Y elige turno por **heurística sobre el nombre del itinerario** (`"DAW"` → mañana, `"DAM"` → tarde):

```js
const turnoGrupo = useMemo(() => {
  const itinerarioNombre = (grupo.itinerario?.nombre || '').toUpperCase();
  if (itinerarioNombre.includes('WEB')) return 'M';
  if (itinerarioNombre.includes('MULTIPLATAFORMA')) return 'T';
  return 'M';
}, [grupo]);
```

Limitaciones:

- **Slots fijos de 1h**: imposible representar jornadas con módulos de 50 o 55 min, frecuentes en ESO/Bach.
- **Sin recreos**: no existe ningún concepto de tramo "no asignable" entre slots.
- **Turno por heurística**: frágil; si llega un IES con un itinerario sin "WEB" ni "MULTIPLATAFORMA" en el nombre, se cae a mañana por defecto.
- **Mismas 6 horas para todo**: ESO suele tener 25 h/sem, FP Superior 30 h/sem, Bachillerato 30-32 h/sem. Con 6 slots × 5 días salen 30 h fijas — no encaja con ESO (sobran 5h) ni con Bach modalidad ampliada (faltan 2h).

El backend valida solapes y carga semanal del profe (≤ 40h) sobre el id del slot, pero NO sabe nada de recreos ni de configuración de jornada — esa lógica vive solo en el frontend.

---

## 2. Decisiones acordadas

Cerradas en la conversación, se consideran punto de partida pero pueden revisarse:

| # | Decisión | Razón |
|---|---|---|
| D1 | Configuración a nivel de **itinerario**, no de centro ni de grupo individual | ESO, FP y Bach del mismo centro tienen jornadas distintas. Por grupo es overkill. |
| D2 | El admin **elige turno** mañana/tarde explícitamente (no heurística por nombre) | Eliminar la frágil regla actual. |
| D3 | Soportar **dos modos de recreo**, eligibles: ÚNICO o DISTRIBUIDO | Ambos casos existen en centros reales. |
| D4 | El editor de jornada vive en `/admin/horarios` (modal o pestaña), NO en `/configuracion` | Es donde se sufre el problema; reduce clicks. |
| D5 | Modelo: **entidad nueva `JornadaTipo`**, no JSON en Itinerario | Permite queries, validaciones Doctrine y reutilización entre itinerarios. |
| D6 | Las restricciones existentes de profesor (no doble booking, ≤ 40 h/sem) se conservan tal cual | Ya funcionan; el cambio de fuente de slots no las afecta. |

---

## 3. Decisiones aún abiertas

A confirmar antes de empezar:

- **D7**: ¿Default por centro? Si un itinerario no tiene `jornadaTipo` asignada, ¿usamos la primera jornada del centro, una global hardcoded, o forzamos a que el admin la elija?
- **D8**: Migración de los horarios existentes — al asignar por primera vez una jornada custom a un itinerario, los `Horario` ya colocados pueden quedar fuera de slot. ¿Mostrar lista de afectados al admin y dejar que decida (mantener / borrar / mover) o aplicar siempre y avisar?
- **D9**: ¿Permitir que dos itinerarios distintos compartan la misma `JornadaTipo`? (más DRY, menos duplicación; pero requiere que el editor de Itinerario tenga selector).
- **D10**: ¿La `JornadaTipo` admite slots de duración mixta dentro del mismo día (ej. primer slot 50 min, último 60 min)? **Recomendación: no**, complica el modelo y el solver. Un único valor `duracionSlotMinutos` para toda la jornada.
- **D11**: ¿`diasLectivos` configurable o siempre lun-vie? Algunos centros tienen jornada de 4 días (FCT). **Recomendación: configurable** desde el principio (campo barato).

### 3.1 Aulas (sub-bloque añadido 2026-04-26)

El usuario añadió que el **aula también debe poder determinarse**, no inferirse del nombre del grupo como hace ahora `HorariosEditor.jsx` (línea ~758: `aula: grupo?.abreviatura ? \`Aula ${grupo.abreviatura}\` : 'Aula'`). Esto introduce un sub-modelo nuevo y abre estas decisiones:

- **D12**: ¿Catálogo de aulas a nivel de centro? Es decir, una entidad `Aula` con sus filas en BD (id, centro, nombre/código, capacidad opcional), gestionada desde un nuevo CRUD `/admin/aulas`. Alternativa más ligera: dejar `Horario.aula` como string libre que el admin teclea. **Recomendación: entidad nueva** — habilita validación de doble-booking y reportes (ocupación por aula).
- **D13**: Si entidad: ¿`Horario.aula` se convierte en FK obligatoria, FK opcional o sigue siendo string libre con FK opcional como complemento? **Recomendación: FK opcional**; permite migración progresiva (los horarios viejos se mantienen con su string actual hasta que el admin los reasigne).
- **D14**: ¿Se valida que un aula no esté en dos grupos a la vez en el mismo `dia + slot`? Es la analogía espacial de la validación de profesor. **Recomendación: sí**, banner rojo si dos grupos paralelos pretenden ocupar la misma aula a la vez.
- **D15**: ¿Aula "por defecto" para un grupo? Hoy cada grupo asume su propia aula derivada de la abreviatura. ¿Mantenemos un campo `Grupo.aulaHabitual` (FK opcional a `Aula`) que el editor preselecciona pero el admin puede sobrescribir slot a slot? Suele coincidir con la realidad (cada grupo tiene "su clase") pero hay excepciones (laboratorios, talleres FP, gimnasio).
- **D16**: ¿Capacidad del aula vs número de alumnos matriculados? Se puede validar al colocar (banner amarillo si aula < alumnos del grupo). **Recomendación: sí, banner amarillo no bloqueante** — útil para evitar errores de planificación, no necesario para el MVP.
- **D17**: ¿Aulas compartidas entre centros? Un IES con dos sedes podría tener aulas distintas por sede. **Recomendación: no en MVP**; cada `Aula` cuelga de un único `Centro`.

---

## 4. Modelo propuesto

### 4.1 Entidad `JornadaTipo`

```
JornadaTipo
  ├── id
  ├── nombre               string   "FP Superior Mañana", "ESO Mañana", "Bach Tarde"…
  ├── centro               FK Centro (nullable=false)
  ├── turno                enum     MANANA | TARDE
  ├── horaInicio           TIME     08:30
  ├── duracionSlotMinutos  int      50, 55, 60…
  ├── slotsPorDia          int      5, 6, 7…
  ├── diasLectivos         json     [1,2,3,4,5]   (1=lunes … 5=viernes)
  ├── recreoModo           enum     UNICO | DISTRIBUIDO | NINGUNO
  ├── recreoMinutos        int      total acumulado de recreo (p.ej. 30)
  ├── recreoBloques        int      si DISTRIBUIDO: cuántos bloques (2 → 2×15 min)
  ├── recreoPosicion       int      si UNICO: tras qué slot (1..slotsPorDia-1)
  ├── createdAt / updatedAt   timestampable
  └── deleted / deletedAt     softDelete
```

`horaFin` se **deriva**, no se almacena:

```
horaFin = horaInicio + (slotsPorDia * duracionSlotMinutos) + recreoMinutos
```

### 4.2 Relación con `Itinerario`

```php
class Itinerario {
    // … campos actuales …

    #[ORM\ManyToOne(targetEntity: JornadaTipo::class)]
    #[ORM\JoinColumn(nullable: true, onDelete: 'SET NULL')]
    private ?JornadaTipo $jornadaTipo = null;
}
```

Nullable: si la D7 cae en "fallback a default del centro", el campo puede quedar null y el editor resuelve la jornada por cadena de fallback.

### 4.3 Entidad `Aula` (si D12 = sí)

```
Aula
  ├── id
  ├── nombre              string   "A1.02", "Lab. Informática 3", "Taller Mecánica"
  ├── codigo              string   opcional (algunos centros usan códigos cortos: "A102")
  ├── centro              FK Centro (nullable=false)
  ├── capacidad           int      nullable; nº máx de alumnos
  ├── tipo                enum     AULA_NORMAL | LABORATORIO | TALLER | GIMNASIO | OTRO  (D16+)
  ├── notas               text     nullable; "proyector roto", "sin red ethernet"…
  ├── createdAt / updatedAt   timestampable
  └── deleted / deletedAt     softDelete
```

Cambios derivados en entidades existentes:

```php
class Horario {
    // … campos actuales …

    // Antes: private string $aula (texto libre)
    // Tras D13 (FK opcional con string como fallback):
    #[ORM\Column(length: 255, nullable: true)]
    private ?string $aula = null;   // se conserva por compatibilidad / casos sueltos

    #[ORM\ManyToOne(targetEntity: Aula::class)]
    #[ORM\JoinColumn(nullable: true, onDelete: 'SET NULL')]
    private ?Aula $aulaRef = null;  // FK preferente
}

class Grupo {
    // … campos actuales …

    // D15: aula por defecto del grupo, preseleccionada en el editor
    #[ORM\ManyToOne(targetEntity: Aula::class)]
    #[ORM\JoinColumn(nullable: true, onDelete: 'SET NULL')]
    private ?Aula $aulaHabitual = null;
}
```

CRUD nuevo `/admin/aulas` (similar a otros CRUDs del proyecto: `DataTable` + modal).

### 4.4 Migración

Migraciones Doctrine separadas para evitar mezclar conceptos:
1. `Version2026XXXX_jornadaTipo`: crea `jornada_tipo` + añade `jornada_tipo_id` (nullable) a `itinerario`.
2. `Version2026XXXX_aula`: crea `aula` + añade `aula_ref_id` (nullable) a `horario` y `aula_habitual_id` (nullable) a `grupo`.

---

## 5. Validaciones derivadas

Calculadas en runtime al abrir el editor para un grupo:

```
horasLectivasSemana = slotsPorDia × len(diasLectivos) × (duracionSlotMinutos / 60)
horasMateriasSemana = sum(materia.horasSemanales) para todas las materias del itinerario
```

Casos:

| Comparación | UI |
|---|---|
| `horasMaterias > horasLectivas` | Banner rojo: *"El itinerario requiere X h/sem pero la jornada cubre Y h/sem. Ajusta la jornada o las horas de las materias."* Bloquea la edición de slots. |
| `horasMaterias == horasLectivas` | OK, jornada exacta. |
| `horasMaterias < horasLectivas` | Banner amarillo: *"Sobran X h/sem libres en la jornada."* No bloquea. |

Validaciones existentes que **se conservan**:

- Profesor no puede estar en dos slots a la vez (mismo `dia_hora`, distinto grupo).
- Profesor no puede superar las 40 h/sem totales.
- Solo se asigna una imparticion al máximo de horas semanales declaradas en su materia.

Cambian de fuente: ahora los `dia_hora` salen de la jornada generada, no de las constantes.

### 5.1 Validaciones nuevas relacionadas con aulas (si D14/D16 = sí)

| Caso | UI | Bloquea |
|---|---|---|
| Aula ocupada por otro grupo en el mismo `dia + slot` | Banner rojo: *"Aula X ya asignada al grupo Y a esta hora."* | Sí |
| Aula con `capacidad < nº alumnos del grupo` | Banner amarillo: *"Aula con capacidad N, el grupo tiene M alumnos."* | No (advertencia) |
| Aula `deleted = true` | El selector la oculta directamente | n/a |

---

## 6. Generador de slots (servicio compartido)

Tanto el editor visual como el solver necesitan la misma lista de slots para una jornada. Se implementa como **servicio único**, idealmente en backend (PHP) y se sirve al frontend como JSON:

```php
class JornadaSlotGenerator {
    public function generate(JornadaTipo $j): array {
        // Devuelve lista ordenada: [{tipo: 'slot'|'recreo', horaInicio, horaFin, idx?}]
    }
}
```

Salida ejemplo (ÚNICO, recreo de 30 min tras slot 3, slots de 60 min):

```json
[
  { "tipo": "slot",   "idx": 1, "horaInicio": "08:30", "horaFin": "09:30" },
  { "tipo": "slot",   "idx": 2, "horaInicio": "09:30", "horaFin": "10:30" },
  { "tipo": "slot",   "idx": 3, "horaInicio": "10:30", "horaFin": "11:30" },
  { "tipo": "recreo", "horaInicio": "11:30", "horaFin": "12:00", "minutos": 30 },
  { "tipo": "slot",   "idx": 4, "horaInicio": "12:00", "horaFin": "13:00" },
  { "tipo": "slot",   "idx": 5, "horaInicio": "13:00", "horaFin": "14:00" },
  { "tipo": "slot",   "idx": 6, "horaInicio": "14:00", "horaFin": "15:00" }
]
```

Salida ejemplo (DISTRIBUIDO, 30 min en 2 bloques de 15, repartidos uniformemente):

```json
[
  { "tipo": "slot",   "idx": 1, "horaInicio": "08:30", "horaFin": "09:30" },
  { "tipo": "slot",   "idx": 2, "horaInicio": "09:30", "horaFin": "10:30" },
  { "tipo": "recreo", "horaInicio": "10:30", "horaFin": "10:45", "minutos": 15 },
  { "tipo": "slot",   "idx": 3, "horaInicio": "10:45", "horaFin": "11:45" },
  { "tipo": "slot",   "idx": 4, "horaInicio": "11:45", "horaFin": "12:45" },
  { "tipo": "recreo", "horaInicio": "12:45", "horaFin": "13:00", "minutos": 15 },
  { "tipo": "slot",   "idx": 5, "horaInicio": "13:00", "horaFin": "14:00" },
  { "tipo": "slot",   "idx": 6, "horaInicio": "14:00", "horaFin": "15:00" }
]
```

Algoritmo de reparto del recreo distribuido: dividir los `slotsPorDia` en `recreoBloques + 1` segmentos de tamaño aproximadamente igual; intercalar un bloque de recreo entre cada par de segmentos. Si los slots no se dividen exactamente, sesgar los recreos hacia el centro de la jornada.

---

## 7. UX del editor de jornada

Modal o pestaña dentro de `/admin/horarios` (D4). Bocetо:

```
┌─ Configurar jornada ────────────────────────────────────┐
│                                                          │
│  Nombre        [ FP Superior Mañana          ]          │
│                                                          │
│  Turno         (◉) Mañana    ( ) Tarde                  │
│                                                          │
│  Hora inicio   [ 08:30 ]                                │
│  Duración slot [ 60 ▾ ] min                             │
│  Slots por día [ 6   ]   →  Hora fin: 14:30 (calc)      │
│  Días lectivos [✓]L [✓]M [✓]X [✓]J [✓]V [ ]S            │
│                                                          │
│  ── Recreo ───────────────────────────────────           │
│  Modo:  ( ) Sin recreo                                  │
│         (◉) Único bloque                                │
│         ( ) Distribuido en N bloques                    │
│                                                          │
│  Minutos de recreo total:  [ 30 ]                       │
│  Posición:                 tras slot [ 3 ▾ ]            │
│                                                          │
│  ── Vista previa de la jornada ─────────────             │
│  08:30-09:30  Slot 1                                    │
│  09:30-10:30  Slot 2                                    │
│  10:30-11:30  Slot 3                                    │
│  11:30-12:00  RECREO (30 min)                           │
│  12:00-13:00  Slot 4                                    │
│  13:00-14:00  Slot 5                                    │
│  14:00-15:00  Slot 6                                    │
│  ────────────────                                        │
│  Horas lectivas/sem: 30  ·  Materias del itinerario: 28 │
│  ✓ La jornada cubre las horas de las materias           │
│                                                          │
│       [ Cancelar ]              [ Guardar jornada ]     │
└──────────────────────────────────────────────────────────┘
```

Asignación al itinerario: en el modal de Itinerario aparece un nuevo selector "Jornada" (AsyncSearchSelect contra `/api/jornada-tipos?centro=X`).

### 7.1 Selector de aula al colocar un slot (si D12 = sí)

Cuando el admin coloca una imparticion en una celda del horario, además del `slot` ya determinado, aparece un selector mini de aula (preseleccionado a `grupo.aulaHabitual` si existe):

```
┌─ Slot 09:30-10:30 · Lunes · 1º DAW ──────────┐
│  Materia:    Bases de Datos                   │
│  Profesor:   David Duque                       │
│  Aula:       [ A1.02  ▾ ]   ← AsyncSearch    │
│              ⚠ Capacidad 25, grupo tiene 28   │
│  [ Cancelar ]      [ Confirmar ]              │
└──────────────────────────────────────────────┘
```

Si una jornada tiene aula compartida entre dos itinerarios (ej. taller de FP usado por dos grupos en horarios distintos), no hay conflicto porque la validación es por `dia + slot`, no por grupo.

---

## 8. Refactor de `HorariosEditor.jsx`

Cambios mínimos en el editor existente:

1. Eliminar `SLOTS_MANANA`/`SLOTS_TARDE` y `turnoGrupo` heurístico.
2. Cargar la jornada del grupo al montar (vía `grupo.itinerario.jornadaTipo`, con cadena de fallback definida en D7).
3. Generar `slotsDia` desde el servicio compartido; pintar `recreo` como bloques grises no asignables.
4. La columna HORA de la rejilla pasa a renderizar los rangos generados (ya no son fijos hora a hora).
5. El solver `HorarioSolver.php` recibe la lista de slots de la jornada como input en lugar de asumir slots fijos.

---

## 9. Plan en sub-fases

| Fase | Esfuerzo | Bloquea a |
|---|---|---|
| A — Backend: entidad `JornadaTipo` + migración + endpoint CRUD | 1-2 días | C, D, E |
| B — Servicio `JornadaSlotGenerator` (PHP) + endpoint que devuelve slots por id | 0.5 día | D |
| C — Editor visual de Jornada (modal en `/admin/horarios`) con vista previa en vivo | 1 día | D |
| D — Refactor `HorariosEditor.jsx`: slots dinámicos + recreos visuales no asignables | 1-2 días | E |
| E — Adaptar `HorarioSolver.php` para recibir jornada como input | 1 día | — |
| F — Validador de horarios afectados al cambiar la jornada de un itinerario | 0.5 día | — |
| G — Selector "Jornada" en el modal de Itinerario | 0.5 día | — |

**Total estimado**: 5-7 días de trabajo.

---

## 10. Riesgos

- **R1**: el solver actual asume slots de duración uniforme. Si en el futuro D10 se reabre y se permiten slots mixtos, hay que reescribirlo.
- **R2**: las restricciones de profesor (40 h/sem) se calculan multiplicando slots × duración; si la duración no es 60 min, hay que ajustar el cálculo (`horasProfe = sum(slot.duracionMinutos) / 60`).
- **R3**: los `Horario` actuales tienen `horaInicio` y `horaFin` como `TIME` columns. Cambiar la jornada de un itinerario no invalida automáticamente esas filas; queda inconsistencia silenciosa hasta que F detecte el problema.
- **R4**: si dos itinerarios comparten `JornadaTipo` (D9 sí), borrar la jornada deja huérfanos. La FK `onDelete: SET NULL` lo cubre, pero la UX debe avisar.
- **R5**: la columna HORA configurable implica que el componente `TimeTable` (vista de horarios para alumno/profesor) también debe leer de la jornada, no de slots fijos. Es trabajo adicional fuera del editor admin.

---

## 11. Glosario

- **Jornada**: configuración horaria de un día tipo lectivo (inicio, slots, recreo, fin).
- **Slot**: tramo lectivo asignable a una imparticion.
- **Recreo**: tramo no lectivo dentro de la jornada, no asignable, visible en la rejilla.
- **Turno**: bloque del día (mañana o tarde) en que cae la jornada. Determina solapes entre grupos paralelos.
- **Jornada tipo**: plantilla reutilizable; un itinerario apunta a una.

---

## 12. Próximo paso

Cerrar D7-D11 con el usuario. Cuando todas las decisiones estén verdes, abrir tareas concretas para Fase A y empezar.
