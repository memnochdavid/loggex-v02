# Sistema de jornadas y recreos para `/admin/horarios`

> **Status (2026-04-27)**: Fases A, C, G y D **implementadas y operativas**. La rejilla del editor consume la jornada del itinerario y pinta los recreos. **PERO se descubrió bug conceptual del solver** que invalida casos reales con slots de duración mixta (2h, 1h30, etc.) — ver §13 bitácora de 2026-04-27 y D24 abajo. **Lo siguiente al retomar es decidir D24 y atacarlo (Fase E ampliada)**.

## ⚡ Snapshot para retomar en otra sesión

### ✅ Lo que YA funciona end-to-end

1. **Backend** (`backend/src/Entity/`, `Service/`, `Validator/Constraint/`):
   - Entidades `JornadaTipo` (cabecera) y `JornadaTramo` (tramos) con `OneToMany` cascade `persist+remove` y `orphanRemoval`.
   - Enums `TurnoJornada` (MANANA|TARDE) y `TipoTramo` (SLOT|RECREO).
   - FK `Itinerario.jornadaTipo` (nullable, `inversedBy='itinerarios'`).
   - Lado inverso `Centro.jornadaTipos`.
   - `JornadaTramoValidator` (servicio) + `JornadaCoherente` constraint Symfony enchufada a la clase `JornadaTipo` → API Platform devuelve 422 si los tramos solapan / hay huecos / no hay slots.
   - Migración aplicada: `migrations/Version20260426191216.php` (tablas `jornada_tipo`, `jornada_tramo`, FK `jornada_tipo_id` en `itinerario`).
   - API Platform CRUD operativo bajo **`/api/jornada_tipos`** (snake_case, no kebab — convención del proyecto, igual que `catalogo_itinerarios`).
   - `HorarioSolver.php` refactorizado: lee jornada del grupo (no slots hardcoded), usa `diasLectivos` y `tramos` SLOT, los grupos paralelos se detectan por coincidencia del campo `turno` (no por nombre del itinerario).
   - **Workaround importante**: `JornadaTramo.jornadaTipo` lleva `cascade: ['persist']` (dirección hijo→padre) para evitar `"A new entity was found through the relationship"` al deserializar PUT/POST con tramos anidados. Si más adelante hay rarezas de update (tramos antiguos que no se borran al editar), reemplazar por `State Processor` custom que controle la collection.

2. **Frontend** (`frontend/src/pages/JornadasAdmin.jsx` + `.module.css`):
   - CRUD `/admin/jornadas` con DataTable, búsqueda, filtros centro+turno (DataTable usa `currentPage`+`onSort(col)`, NO `page`+`onSort(col,dir)` — bug que tuve que arreglar).
   - Modal con: nombre, centro (selector), turno (radio M/T), días lectivos (checkboxes lun-dom), **tabla editable de tramos** con flechas ↑↓ y borrar, **timeline horizontal solo-lectura** (anchos proporcionales, slots en color, recreos rayados), métricas en vivo (slots, h/día, h/sem).
   - Validaciones cliente: rechazo si no hay centro o no hay tramos antes del POST.
   - Manejo robusto del campo `centro` recibido del backend (string IRI, objeto con `.id`, objeto JSON-LD con `@id`). Mismo patrón aplicado a `jornadaTipo` anidado.
   - Ruta + sidebar (icono `Clock` de lucide).
   - Selector "Jornada" (`AsyncSearchSelect`) en el modal de Itinerario filtrando por centro (Fase G); recomendado pero no obligatorio (D7).
   - i18n en 5 idiomas (es/en/ca/eu/gl) bajo bloque `jornadas.*` + `sidebar.jornadas` + `itinerarios.jornadaLabel/Placeholder/Hint`.

3. **Editor `/admin/horarios`** (`frontend/src/pages/HorariosEditor.jsx` + `.module.css`):
   - `useEffect` 1.5 carga la jornada del itinerario del grupo seleccionado vía `GET /api/jornada_tipos/{id}` (porque el GET de Grupo no anida los tramos por groups). Cache local en `jornadasPorId`.
   - Constantes `SLOTS_MANANA`/`SLOTS_TARDE` y heurística `turnoGrupo` (DAW=mañana, DAM=tarde) **eliminadas**.
   - `slotsDia` y `recreosDia` se derivan de `tramosOrdenados` (que ordena los tramos de la jornada por `orden`). El `turnoGrupo` ahora viene del campo `JornadaTipo.turno`.
   - Rejilla: itera sobre `tramosOrdenados` y para cada uno pinta una fila slot droppable o un recreo no asignable (banda gris rayada que ocupa todas las columnas de días).
   - Banner cuando `slotsDia.length === 0` (itinerario sin jornada o jornada sin slots) — explica al admin que asigne una jornada en `/itinerarios` o cree una en `/admin/jornadas`.
   - CSS `.gridRowRecreo` + `.recreoStrip` añadidos en `HorariosEditor.module.css`.

### 🐛 Bug crítico abierto (descubierto 2026-04-27)

El solver y el editor asumen **un slot = una hora lectiva** (`for ($i = 0; $i < $horas; $i++) tasks[]=imp;`). Esto rompe en jornadas reales donde los slots tienen duración variable (ej. tu horario real de 2º DAW: 08:30-10:30 + 10:50-12:50 + 13:00-14:30 = 2h+2h+1h30).

Síntoma: el solver coloca exactamente N slots por imparticion, pero esos N slots pueden ocupar 1.5h, 2h o lo que sea cada uno → las horas reales colocadas no coinciden con `materia.horasSemanales`.

**Decisión D24 abierta** (ver §3.3) sobre cómo resolverlo. **Opción A (minutos) es la recomendada**.

### ⏳ Lo que NO está hecho

- ❌ **Solver respetando duración real de slots** (D24 + Fase E ampliada).
- ❌ **Asistente automático** que rellena tramos a partir de Σ horas materias / días lectivos / recreo (Fase B). Aplazado hasta D24 — sin la matemática correcta de slots/horas no tiene sentido autogenerar.
- ❌ **Materias optativas / autonómicas** (no vienen del scraping BOE; el admin las añade a mano vía `/materias`). No es bug, es comportamiento esperado: el catálogo nacional solo trae materias troncales.
- ❌ **Sistema de aulas** (D12-D17 aplazadas).
- ❌ **Invalidación de cache** de jornada en `HorariosEditor`: si el admin edita una jornada en `/admin/jornadas`, el editor sigue mostrando la cacheada hasta recargar la página. Trivial: escuchar evento o invalidar al volver a montar.
- ❌ **`itemsPerPageJornadas`** en `Personalizacion`: el hook `usePagination('jornadas')` cae al fallback de 20 (no se persiste preferencia).
- ❌ **Detección de paralelismo refinada**: hoy se compara `JornadaTipo.turno` (mañana/tarde) entre grupos paralelos. Si dos jornadas distintas, ambas "MAÑANA", solo solapan parcialmente, se cuenta como solape total (pesimista). Refactor a "solape real de rangos `[horaInicio, horaFin]`" es trivial pero no urgente.

### 🎯 Para retomar mañana — orden exacto

1. **Releer §13 bitácora 2026-04-27** (al final del doc) para entender el contexto del bug de slots mixtos.
2. **Cerrar D24** (§3.3): elegir opción A (minutos), B (sesiones) o C (híbrido). El usuario aún no decidió. Recomendación: **A**.
3. Si A: **arrancar Fase E ampliada**:
   - Refactorizar `HorarioSolver.php` para trabajar en minutos:
     - `tasks` deja de ser "1 task por hora" y pasa a ser "1 task por imparticion con minutos pendientes".
     - El backtracking elige slots y resta `slot.duracionMinutos` de los pendientes de la imparticion.
     - Se acepta una imparticion como "completa" cuando su contador llega a 0 (o lo más cerca posible).
   - Refactorizar `HorariosEditor.jsx`:
     - El `ModuleChip` mostraba `horasColocadas/horasTotales`. Cambiar a `minutosColocados/minutosTotales` o seguir mostrando horas con decimales.
     - `validateDrop` y `validateTap`: ya no comparan "h/sem === slots colocados" sino "minutosTotales === sum(slot.duracionMinutos colocados)".
   - Tests del solver con jornadas mixtas (lo ideal: añadir un test PHPUnit con un caso real).
4. **Verificar con horario real** del usuario (3 bloques: 2h/2h/1h30, total 5h30/día × 5 = 27h30/sem) que el solver ya coloca todas las horas correctamente.
5. (Opcional) Atacar Fase B (asistente) ahora que la matemática es correcta.

### 📌 Convenciones consolidadas

- URL del recurso jornada: **`/api/jornada_tipos`** (snake_case).
- TIME columns viajan como `"HH:MM:SS"` del backend.
- Cualquier FK del backend puede venir en **3 formatos** (string IRI, objeto con `.id`, JSON-LD con `@id`). Helper recurrente:
  ```js
  const extractIdFromRef = (ref) => {
    if (!ref) return '';
    if (typeof ref === 'string') return ref.split('/').pop();
    if (typeof ref === 'object') return String(ref.id || (ref['@id'] ? ref['@id'].split('/').pop() : ''));
    return '';
  };
  ```
- Helpers `normalizeHora()` (a `HH:MM:SS`) y `horaToMinutos()` viven en `JornadasAdmin.jsx`. Si Fase E los necesita en backend o en más sitios, extraer a `frontend/src/utils/time.js` y/o crear equivalente PHP.
- Para itinerar slots+recreos en el editor: usar `tramosOrdenados` y llevar contador `slotIdxCounter` para mantener `slotIdx` consistente con `slotsDia` (las claves de `placements` son `${dia}_${horaInicio}`).
- `usePagination('xxx')` lee `Personalizacion.itemsPerPageXxx` del backend. Si la columna no existe, fallback a 20. **Para añadir** una nueva clave: campo nuevo en `Personalizacion` + migración + UI en `Configuracion.jsx`.

### 🗂️ Archivos clave (referencia rápida)

```
backend/src/Entity/JornadaTipo.php             entidad cabecera (con ApiResource + JornadaCoherente)
backend/src/Entity/JornadaTramo.php            entidad tramo (cascade persist en ManyToOne)
backend/src/Entity/TurnoJornada.php            enum MANANA|TARDE
backend/src/Entity/TipoTramo.php               enum SLOT|RECREO
backend/src/Entity/Itinerario.php              FK jornadaTipo añadida (líneas ~80-92, getter/setter al final)
backend/src/Entity/Centro.php                  inverso jornadaTipos añadido
backend/src/Repository/JornadaTipoRepository.php
backend/src/Repository/JornadaTramoRepository.php
backend/src/Service/JornadaTramoValidator.php  validador de coherencia (sin solapes, contiguo, ≥1 SLOT)
backend/src/Service/HorarioSolver.php          ← REFACTORIZADO en Fase D pero con bug de slots/horas
backend/src/Validator/Constraint/JornadaCoherente.php
backend/src/Validator/Constraint/JornadaCoherenteValidator.php
backend/migrations/Version20260426191216.php   migración Fase A

frontend/src/pages/JornadasAdmin.jsx           CRUD + modal + timeline preview
frontend/src/pages/JornadasAdmin.module.css
frontend/src/pages/HorariosEditor.jsx          ← REFACTORIZADO en Fase D
frontend/src/pages/HorariosEditor.module.css   con .gridRowRecreo y .recreoStrip
frontend/src/pages/Itinerarios.jsx             selector "Jornada" añadido (Fase G)
frontend/src/components/Sidebar.jsx            item "Jornadas" + icono Clock
frontend/src/App.jsx                           ruta /admin/jornadas

frontend/src/i18n/locales/{es,en,ca,eu,gl}.json   bloques jornadas.*

scripts/seed_imparticiones_daw.sql             seed de imparticiones DAW 1º+2º (7 profes, 13 imparticiones)
docs/hoja-de-ruta-jornadas-recreos.md          este documento
```
>
> **Origen**: conversación 2026-04-26. El usuario reportó que los slots en `/admin/horarios` están hardcoded de hora en hora y que faltan recreos, configuración por turno y soporte para itinerarios con distinto número de horas semanales (ESO ≠ FP ≠ Bach).

## 0. Estado de decisiones (snapshot 2026-04-26)

| # | Decisión | Resolución |
|---|---|---|
| D1 | Granularidad: por itinerario | ✓ por itinerario, agnóstico de etapa |
| D2 | Turno explícito | ✓ |
| D3 | Recreo único + distribuido | ✓ ambos modos |
| D4 | Editor en `/admin/horarios` | ✓ |
| D5 | Entidad `JornadaTipo` | ✓ |
| D6 | Restricciones de profe se conservan | ✓ |
| D7 | Itinerario sin jornada → **el admin la elige**, sin fallback automático | ✓ admin obligado a elegir |
| D8 | BD sin horarios actuales → **no hay migración** que hacer | ✓ |
| D9 | `JornadaTipo` se puede compartir entre itinerarios | ✓ |
| D10 (rev.) | Lista libre de tramos (`JornadaTramo[]`) | ✓ |
| D11 | `diasLectivos` = lun-vie (default), configurable | ✓ |
| D18 | `turno` se mantiene; necesario para mostrar al profe si su jornada cubre mañana+tarde | ✓ campo conservado |
| D19 | Plantilla única para todos los días lectivos | ✓ A |
| D20 | UI: **timeline visual horizontal** (drag/resize) | ✓ |
| D21 | Asistente automático + edición manual | ✓ B (híbrido) |
| D22 | Si las horas no encajan, **redondear hacia arriba** con aviso | ✓ A |
| D23 | Recálculo de la jornada **bajo demanda** | ✓ A |
| D12-D17 | Aulas (entidad, FK, validaciones, capacidad) | aplazadas a fase posterior |

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

> **Principio de diseño global**: el sistema de jornadas es **agnóstico de etapa educativa**. El número y el tipo de itinerarios soportados es indiferente: cualquier itinerario (FP, ESO, Bachillerato, Primaria, Universidad o cualquier otro que aparezca en el futuro) se configura mediante los mismos parámetros de jornada. El editor no contiene ramas `if (etapa === 'ESO')` ni asume duraciones / horas de ninguna etapa concreta. Toda la lógica trabaja con la `JornadaTipo` asignada al itinerario, sin más.

---

## 2. Decisiones acordadas

Cerradas en la conversación, se consideran punto de partida pero pueden revisarse:

| # | Decisión | Razón |
|---|---|---|
| D1 | Configuración a nivel de **itinerario**, no de centro ni de grupo individual | Cada itinerario tiene su propia jornada. El sistema no asume etapas concretas: ESO/FP/Bach se citan solo como ejemplos representativos. El editor de horarios trabaja con los **parámetros** de la jornada (horas, slots, recreo, días lectivos), no con la etiqueta de etapa — así soporta cualquier itinerario actual o futuro sin código específico por tipo. |
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
- **D10** *(revisada 2026-04-26)*: el usuario pide **flexibilidad máxima** en los slots. Esto invalida la recomendación inicial de un único `duracionSlotMinutos`. El modelo pasa a una **lista libre de tramos** (`JornadaTramo[]`) donde cada tramo declara su `tipo` (`SLOT` o `RECREO`), `horaInicio` y `horaFin`. Eso permite:
  - Slots de duraciones distintas en el mismo día (50 min, 60 min, 90 min en talleres).
  - Recreos en cualquier posición, no solo "tras slot N".
  - Patios cortos y largos mezclados.
  - Cualquier topología que el centro necesite, sin asumir uniformidad.

  Implicación: las secciones 4.1 (modelo) y 6 (generador) se simplifican (la lista ya viene tal cual de BD, no hay que generar nada) pero la 7 (UX) se complica (necesita editor de timeline tipo "añadir tramo" / "arrastrar / redimensionar").
- **D11**: ¿`diasLectivos` configurable o siempre lun-vie? Algunos centros tienen jornada de 4 días (FCT). **Recomendación: configurable** desde el principio (campo barato).
- **D19** *(nueva, derivada de D10 revisada)*: ¿una **única plantilla de tramos** se aplica a todos los días lectivos, o se permiten **tramos distintos por día de la semana**? Casos reales: un viernes con jornada reducida (4 slots en vez de 6), o un miércoles con bloque extra-curricular al final.
  - **Opción A — plantilla única**: la `JornadaTipo` tiene una sola lista `tramos[]`; aplica idéntica de lunes a viernes (o los días marcados en `diasLectivos`). Simple, suficiente para la mayoría de centros.
  - **Opción B — tramos por día**: la `JornadaTipo` tiene un mapa `tramosPorDia: { 1: [...], 2: [...], 5: [...] }`. Cubre cualquier caso pero el editor se vuelve más complejo (5 timelines en vez de 1) y el modelo gana una capa.
  - **Recomendación**: empezar por **A** (plantilla única) y dejar B documentada como futura ampliación si aparece la demanda. La mayoría de centros tienen jornada uniforme; la opción B es overengineering hasta que se demuestre necesaria.
- **D20** *(nueva)*: ¿UI del editor de tramos? Tres alternativas:
  - **Lista editable vertical**: tabla con filas `[tipo, horaInicio, horaFin, ↑↓×]`, "Añadir slot" / "Añadir recreo" abajo. La más sencilla de implementar, suficiente para el MVP.
  - **Timeline visual horizontal**: barra de 24h con bloques arrastrables/redimensionables. Más bonito y rápido de usar, pero ~3× más trabajo (drag/resize, snap a múltiplos de 5 min, validación de solapes).
  - **Híbrido**: lista editable con preview de timeline solo-lectura debajo. Compromiso razonable.
  - **Recomendación**: **híbrido** — lista para editar + timeline solo-lectura para verificar visualmente.

### 3.3 Bug del solver con slots de duración mixta (descubierto 2026-04-27)

El usuario aportó su horario real de 2º DAW: 3 bloques diarios de duración variable (08:30-10:30 + 10:50-12:50 + 13:00-14:30 = 2h+2h+1h30 = 5h30/día → 27h30/sem). Esto destapó una asunción incorrecta en el solver y el editor:

- `HorarioSolver::solve()` hace `for ($i = 0; $i < $horas; $i++) tasks[] = $imp;` → coloca **N slots** por imparticion, no N horas.
- Si los slots son de 1h, todo coincide.
- Si los slots son de 2h, una materia con `horasSemanales=6` ocupa 6 slots = 12 horas reales (el doble).
- Si los slots son mixtos, el cómputo es impredecible.

El editor frontend (`HorariosEditor.jsx`) tiene la misma asunción al calcular `horasColocadas` (cuenta slots, no minutos).

- **D24** *(crítica, bloqueante de uso real del editor)*: ¿Cómo interpretar `materia.horasSemanales` cuando los slots de la jornada no son de 1h?
  - **Opción A — minutos**: el solver y el editor pasan a trabajar en **minutos**. Cada imparticion necesita acumular `horasSemanales × 60` minutos; cada slot resta `slot.duracionMinutos` del contador. Solución correcta y robusta. Cambio mediano: ~30 líneas en `HorarioSolver.php` + ajuste cosmético en `HorariosEditor.jsx` (chip muestra horas con decimales o minutos pendientes). **Recomendación: A**.
  - **Opción B — sesiones**: reinterpretar `horasSemanales` como "nº de sesiones/sem" sin importar duración del slot. Cambio mínimo pero rompe la semántica del campo (en el catálogo BOE son horas reales).
  - **Opción C — híbrido**: el campo sigue siendo horas; al asignar la jornada al itinerario, el sistema calcula y muestra al admin cuántos slots/sem necesita cada materia (`ceil(horas × 60 / duracionMediaSlot)`); el admin valida o ajusta. Más complejo, no aporta sobre A.
  - **Recomendación**: **A** — la única que respeta la semántica `horas = horas` y soporta jornadas reales con slots de cualquier duración.

### 3.1 Aulas (sub-bloque añadido 2026-04-26)

El usuario añadió que el **aula también debe poder determinarse**, no inferirse del nombre del grupo como hace ahora `HorariosEditor.jsx` (línea ~758: `aula: grupo?.abreviatura ? \`Aula ${grupo.abreviatura}\` : 'Aula'`). Esto introduce un sub-modelo nuevo y abre estas decisiones:

- **D12**: ¿Catálogo de aulas a nivel de centro? Es decir, una entidad `Aula` con sus filas en BD (id, centro, nombre/código, capacidad opcional), gestionada desde un nuevo CRUD `/admin/aulas`. Alternativa más ligera: dejar `Horario.aula` como string libre que el admin teclea. **Recomendación: entidad nueva** — habilita validación de doble-booking y reportes (ocupación por aula).
- **D13**: Si entidad: ¿`Horario.aula` se convierte en FK obligatoria, FK opcional o sigue siendo string libre con FK opcional como complemento? **Recomendación: FK opcional**; permite migración progresiva (los horarios viejos se mantienen con su string actual hasta que el admin los reasigne).
- **D14**: ¿Se valida que un aula no esté en dos grupos a la vez en el mismo `dia + slot`? Es la analogía espacial de la validación de profesor. **Recomendación: sí**, banner rojo si dos grupos paralelos pretenden ocupar la misma aula a la vez.
- **D15**: ¿Aula "por defecto" para un grupo? Hoy cada grupo asume su propia aula derivada de la abreviatura. ¿Mantenemos un campo `Grupo.aulaHabitual` (FK opcional a `Aula`) que el editor preselecciona pero el admin puede sobrescribir slot a slot? Suele coincidir con la realidad (cada grupo tiene "su clase") pero hay excepciones (laboratorios, talleres FP, gimnasio).
- **D16**: ¿Capacidad del aula vs número de alumnos matriculados? Se puede validar al colocar (banner amarillo si aula < alumnos del grupo). **Recomendación: sí, banner amarillo no bloqueante** — útil para evitar errores de planificación, no necesario para el MVP.
- **D17**: ¿Aulas compartidas entre centros? Un IES con dos sedes podría tener aulas distintas por sede. **Recomendación: no en MVP**; cada `Aula` cuelga de un único `Centro`.

### 3.2 Turno como etiqueta vs como dato lógico (sub-bloque añadido 2026-04-26)

El usuario observa que, si la jornada se configura libremente (hora inicio/fin de extremo a extremo), el `turno` mañana/tarde es redundante: se puede inferir del rango horario. Hoy en el editor se usa para detectar grupos paralelos y validar doble booking de profesor, pero esa lógica puede sustituirse por **detección directa de solape temporal** entre jornadas (más robusta, no depende de etiquetas).

- **D18**: ¿Eliminamos el campo `turno` de `JornadaTipo` y trabajamos con **solape de rangos horarios**? Tres opciones:
  - **A — Eliminar `turno`**: el concepto desaparece del modelo. La detección de paralelismo entre grupos pasa a basarse en si sus jornadas se solapan en `[horaInicio, horaFin]`. El editor pinta la jornada que toque sin clasificar; si el admin quiere etiquetar visualmente "mañana"/"tarde" en la UI, se deriva auto (ej. inicio < 14:00 → "mañana"). **Recomendación**: esta. Es la más limpia.
  - **B — `turno` opcional auto-derivado**: el campo existe pero el backend lo calcula al guardar (`if horaInicio.hour < 14: 'MANANA' else 'TARDE'`). Permite filtrar/reportar sin que el admin lo elija. Híbrido aceptable.
  - **C — Mantener `turno` explícito**: el admin lo elige en el modal (estado actual del documento). Más cercano al modelo mental "trabajo de mañana / de tarde", pero introduce la posibilidad de incoherencias (jornada 09:00-15:00 marcada "tarde").

  Si elegimos A o B, las secciones 4.1 (modelo) y 7 (UX) cambian: desaparece el radio "Turno" del modal y se reemplaza por una etiqueta derivada en la vista previa.

---

## 4. Modelo propuesto

### 4.1 Entidad `JornadaTipo`

```
JornadaTipo
  ├── id
  ├── nombre               string   "FP Superior Mañana", "ESO Mañana", "Bach Tarde"…
  ├── centro               FK Centro (nullable=false)
  ├── turno                enum     MANANA | TARDE   ← pendiente D18 (puede desaparecer)
  ├── diasLectivos         json     [1,2,3,4,5]   (1=lunes … 5=viernes)
  ├── tramos               OneToMany → JornadaTramo (orden por `orden` ASC)
  ├── createdAt / updatedAt   timestampable
  └── deleted / deletedAt     softDelete

JornadaTramo
  ├── id
  ├── jornadaTipo          FK JornadaTipo (nullable=false, cascade=remove)
  ├── orden                int       posición en la secuencia (0..N)
  ├── tipo                 enum      SLOT | RECREO
  ├── horaInicio           TIME      08:30
  ├── horaFin              TIME      09:30
  ├── etiqueta             string    nullable; "Bloque mañana", "Patio largo"…
  └── (composite UNIQUE)             (jornada_tipo_id, orden)
```

Notas del modelo:
- **No** hay `duracionSlotMinutos` ni `slotsPorDia` (refactor por D10 revisada): cada tramo lleva su propia duración derivada de `horaFin - horaInicio`.
- **No** hay configuración de recreo en la `JornadaTipo`: los recreos son tramos como cualquier otro, simplemente con `tipo=RECREO`.
- `horaInicio` global de la jornada = `min(tramos.horaInicio)`; `horaFin` global = `max(tramos.horaFin)`. Ambos derivados.
- Validación al guardar: los tramos de una jornada no pueden solaparse y deben cubrir un rango contiguo (no huecos sin declarar — si hay hueco intencionado, se modela como tramo `RECREO`).

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

### 5.2 Cálculo automático de la jornada (asistente)

> **Decisión de diseño solicitada por el usuario (2026-04-26)**: la jornada de un itinerario debe poderse **calcular automáticamente** a partir de los datos que ya tiene el sistema, no construirse a mano slot a slot por defecto. Quedan abiertas D21-D23 para definir el alcance exacto.

**Entradas disponibles para el cálculo:**

| Dato | Origen |
|---|---|
| Suma de horas semanales del itinerario | `Σ materia.horasSemanales` para todas las materias del itinerario |
| Días lectivos | `JornadaTipo.diasLectivos` (configurable, default lun-vie) |
| Duración base del slot | parámetro del asistente, default 60 min |
| Minutos totales de recreo al día | parámetro del asistente, default 30 min |
| Hora de inicio | parámetro del asistente, default 08:30 (mañana) o 15:00 (tarde) |
| Modo de recreo | UNICO (un bloque a mitad) o DISTRIBUIDO (N bloques uniformes) |

**Algoritmo:**

```
1. horasSemanaItinerario  = Σ materia.horasSemanales
2. horasDiaLectivas       = horasSemanaItinerario / count(diasLectivos)
3. slotsPorDia            = ceil( horasDiaLectivas × 60 / duracionSlotMinutos )
4. minutosLectivosDia     = slotsPorDia × duracionSlotMinutos
5. minutosTotalesDia      = minutosLectivosDia + minutosRecreoTotal
6. tramos = generador.intercalarRecreo(slotsPorDia, duracionSlotMinutos, recreoModo, minutosRecreoTotal)
7. ajustar tramos para que el primer tramo arranque en horaInicio
8. persistir tramos en JornadaTramo[]
```

**Validaciones automáticas tras el cálculo:**

- `horasDiaLectivas` no entero → banner amarillo: *"El reparto exacto da X.Y h/día. Se redondea a slotsPorDia=N (Z h/día); sobran W min/sem por cubrir."*
- `minutosTotalesDia > maxJornadaDiaria` (configurable, default 8h en mañana / 7h en tarde) → banner rojo, exige reducir horas o ampliar días lectivos.
- Restricciones de profesor (≤40 h/sem, no doble booking) se aplican como hoy, sobre los slots generados — no requieren cambios en el solver actual.

**Decisiones nuevas:**

- **D21**: ¿el asistente es la **única** vía o convive con el editor manual de tramos (D10)?
  - **Opción A — solo asistente**: el admin elige `(diasLectivos, duracionSlot, minutosRecreo, horaInicio, modoRecreo)` y el sistema genera los tramos cerrados. No se permiten ediciones manuales por tramo.
  - **Opción B — asistente + ajuste manual**: el asistente genera los tramos como punto de partida; el admin puede después editar/añadir/borrar tramos individualmente (vuelve la lista libre de D10).
  - **Recomendación**: **B**. El asistente cubre el 90% de los casos; la edición manual cubre el 10% raro (taller de 90 min, jornada con bloque extra-curricular).

- **D22**: si la suma de horas no encaja exactamente en slots enteros (ej. 28 h/sem ÷ 5 días = 5.6 h/día), ¿qué hace el asistente?
  - **Opción A — redondear hacia arriba**: añadir slots extra hasta cubrir; sobran minutos libres por semana. Más conservador.
  - **Opción B — distribución desigual**: 4 días de 6h + 1 día de 4h. Más eficiente pero rompe la regla "todos los días iguales" (D19=A).
  - **Opción C — pedir al admin**: mostrar las dos opciones y dejar que decida.
  - **Recomendación**: **A** por defecto, con aviso amarillo explícito. Si en la práctica resulta molesto, se reabre.

- **D23**: ¿el asistente se ejecuta una sola vez al crear la jornada, o **se recalcula** cuando cambian las horas de las materias del itinerario?
  - **Opción A — una sola vez**: el admin recalcula manualmente (botón "Volver a calcular"). Más predecible.
  - **Opción B — recálculo automático**: cualquier cambio en `materia.horasSemanales` dispara recálculo. Riesgo: pisa ajustes manuales del admin.
  - **Recomendación**: **A**. Cambios en materias muestran un aviso *"Las horas del itinerario cambiaron de X a Y h/sem. Recalcular jornada"* con botón explícito.

### 5.1 Validaciones nuevas relacionadas con aulas (si D14/D16 = sí)

| Caso | UI | Bloquea |
|---|---|---|
| Aula ocupada por otro grupo en el mismo `dia + slot` | Banner rojo: *"Aula X ya asignada al grupo Y a esta hora."* | Sí |
| Aula con `capacidad < nº alumnos del grupo` | Banner amarillo: *"Aula con capacidad N, el grupo tiene M alumnos."* | No (advertencia) |
| Aula `deleted = true` | El selector la oculta directamente | n/a |

---

## 6. Lectura de tramos (sin generador)

Con el modelo refactorizado por D10 revisada, ya no hace falta generar nada: los tramos viven literalmente en BD como `JornadaTramo[]`. El editor y el solver leen la lista ordenada por `orden` ASC y la usan tal cual.

Endpoint:
```
GET /api/jornada-tipos/{id}    # incluye `tramos` anidados (Groups: jornada:read + tramo:read)
```

Salida ejemplo (jornada con recreo único de 30 min tras tramo 3, slots de 60 min):

```json
{
  "id": 1,
  "nombre": "FP Superior Mañana",
  "diasLectivos": [1,2,3,4,5],
  "tramos": [
    { "orden": 0, "tipo": "SLOT",   "horaInicio": "08:30", "horaFin": "09:30" },
    { "orden": 1, "tipo": "SLOT",   "horaInicio": "09:30", "horaFin": "10:30" },
    { "orden": 2, "tipo": "SLOT",   "horaInicio": "10:30", "horaFin": "11:30" },
    { "orden": 3, "tipo": "RECREO", "horaInicio": "11:30", "horaFin": "12:00", "etiqueta": "Patio" },
    { "orden": 4, "tipo": "SLOT",   "horaInicio": "12:00", "horaFin": "13:00" },
    { "orden": 5, "tipo": "SLOT",   "horaInicio": "13:00", "horaFin": "14:00" },
    { "orden": 6, "tipo": "SLOT",   "horaInicio": "14:00", "horaFin": "15:00" }
  ]
}
```

Salida ejemplo (jornada heterogénea: 50 min los primeros, 60 los últimos, dos patios cortos):

```json
{
  "tramos": [
    { "orden": 0, "tipo": "SLOT",   "horaInicio": "08:30", "horaFin": "09:20" },
    { "orden": 1, "tipo": "SLOT",   "horaInicio": "09:20", "horaFin": "10:10" },
    { "orden": 2, "tipo": "RECREO", "horaInicio": "10:10", "horaFin": "10:25", "etiqueta": "Patio corto" },
    { "orden": 3, "tipo": "SLOT",   "horaInicio": "10:25", "horaFin": "11:15" },
    { "orden": 4, "tipo": "SLOT",   "horaInicio": "11:15", "horaFin": "12:15" },
    { "orden": 5, "tipo": "RECREO", "horaInicio": "12:15", "horaFin": "12:30", "etiqueta": "Patio corto" },
    { "orden": 6, "tipo": "SLOT",   "horaInicio": "12:30", "horaFin": "13:30" },
    { "orden": 7, "tipo": "SLOT",   "horaInicio": "13:30", "horaFin": "14:30" }
  ]
}
```

Helper PHP que aún tiene utilidad (validador, no generador):

```php
class JornadaTramoValidator {
    /**
     * Verifica que los tramos:
     *  - estén ordenados por horaInicio ASC
     *  - no se solapen entre sí
     *  - cubran un rango contiguo (no huecos sin tramo declarado)
     *  - tengan al menos un tramo de tipo SLOT
     */
    public function validate(array $tramos): array { /* devuelve errores */ }
}
```

---

## 7. UX del editor de jornada

Modal o pestaña dentro de `/admin/horarios` (D4). Bocetо:

```
┌─ Configurar jornada ────────────────────────────────────────────┐
│                                                                  │
│  Nombre         [ FP Superior Mañana                  ]         │
│  Días lectivos  [✓]L [✓]M [✓]X [✓]J [✓]V [ ]S                   │
│                                                                  │
│  ── Asistente automático ─────────────────────────────────       │
│  Itinerario:    Desarrollo de Aplicaciones Web                  │
│  Σ horas/sem:   30 h  (calculado de las materias del itinerario)│
│  Hora inicio    [ 08:30 ]                                       │
│  Duración slot  [ 60 ▾ ] min                                    │
│  Recreo total   [ 30 ] min   Modo  (◉) único  ( ) distribuido  │
│  Posición       tras slot [ 3 ▾ ]                               │
│                                                                  │
│  → Cálculo: 6 slots × 60 min + 30 min recreo = 6h30 / día       │
│            Total semanal: 30 h. ✓ Cubre las materias            │
│                                                                  │
│  [ Generar tramos ]   ← rellena la tabla de abajo               │
│                                                                  │
│  ── Tramos de la jornada (editables manualmente) ─────────       │
│  ┌──────────────────────────────────────────────────────┐      │
│  │ # │ Tipo   │ Inicio │ Fin   │ Etiqueta     │ Acción │      │
│  ├──────────────────────────────────────────────────────┤      │
│  │ 0 │ Slot   │ 08:30  │ 09:30 │              │ ↑↓ × │      │
│  │ 1 │ Slot   │ 09:30  │ 10:30 │              │ ↑↓ × │      │
│  │ 2 │ Slot   │ 10:30  │ 11:30 │              │ ↑↓ × │      │
│  │ 3 │ Recreo │ 11:30  │ 12:00 │ Patio        │ ↑↓ × │      │
│  │ 4 │ Slot   │ 12:00  │ 13:00 │              │ ↑↓ × │      │
│  │ 5 │ Slot   │ 13:00  │ 14:00 │              │ ↑↓ × │      │
│  │ 6 │ Slot   │ 14:00  │ 15:00 │              │ ↑↓ × │      │
│  └──────────────────────────────────────────────────────┘      │
│  [ + Añadir slot ]   [ + Añadir recreo ]                        │
│                                                                  │
│  ── Timeline (vista previa) ──────────────────────────────       │
│  08:30 ████████████████████████ 11:30 ░░░░ 12:00 ████████ 15:00│
│        S0   S1   S2             RECREO    S4  S5  S6           │
│                                                                  │
│       [ Cancelar ]                       [ Guardar jornada ]    │
└──────────────────────────────────────────────────────────────────┘
```

Flujo (D21=B híbrido + D20 híbrido):

1. El admin abre el modal con la suma de horas del itinerario ya calculada arriba.
2. Ajusta los parámetros del asistente y pulsa "Generar tramos".
3. La tabla y el timeline se rellenan automáticamente.
4. El admin puede editar tramos individuales (cambiar duración, añadir extras, mover orden) si la jornada real tiene casos atípicos.
5. Al guardar, los tramos se persisten en `JornadaTramo[]` tal como están en la tabla — el cálculo automático no queda atado al modelo, solo es punto de partida.

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

| Fase | Esfuerzo | Bloquea a | Estado |
|---|---|---|---|
| A — Backend: entidades `JornadaTipo` + `JornadaTramo` + migración + API CRUD + validador | 1-2 días | C, D, E | ✅ **Done (2026-04-26)** |
| C — Editor visual de Jornada en `/admin/jornadas` (modal con tabla editable + timeline preview) | 1 día | D | ✅ **Done (2026-04-26)** |
| G — Selector "Jornada" en el modal de Itinerario | 0.5 día | — | ✅ **Done (2026-04-26)** |
| D — Refactor `HorariosEditor.jsx`: slots dinámicos + recreos visuales no asignables | 1-2 días | E, B | ✅ **Done (2026-04-26/27)** |
| **E (ampliada)** — Solver y editor en **minutos**, no en slots fijos (resolver D24) | 1 día | B | ⏳ **CRÍTICO — siguiente al retomar** |
| B — Servicio asistente automático: rellenar tramos a partir de Σ horas materias del itinerario | 0.5 día | — | ⏳ Aplazado tras E (sin matemática correcta de slots/horas no aporta valor) |
| F — Validador de horarios afectados al cambiar la jornada de un itinerario | 0.5 día | — | ⏳ Aplazado a v1.1 (D8 confirmó: la BD no tenía horarios actuales, no urge) |
| H *(nueva, menor)* — Invalidación de cache de jornada en `HorariosEditor` al volver de `/admin/jornadas` | 0.5 día | — | ⏳ Pendiente, no urgente |
| I *(nueva, menor)* — Campo `itemsPerPageJornadas` en `Personalizacion` + UI en `Configuracion` | 0.5 día | — | ⏳ Pendiente, no urgente |

**Restante estimado para que el editor funcione en producción**: 1-2 días (Fase E ampliada + verificación con caso real del usuario).

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

1. **Cerrar D24** (§3.3) — el usuario aún no eligió A/B/C. Recomendación: A (minutos).
2. **Arrancar Fase E ampliada** — refactor del solver y el editor para que trabajen en minutos en vez de slots fijos. Sin esto, el editor no funciona con jornadas reales (caso del usuario: 3 bloques mixtos 2h/2h/1h30).
3. Verificar con un caso real (DAW 2º con jornada 27h30/sem) que el solver coloca todo.
4. Después: Fase B (asistente automático) y aulas (D12-D17).

---

## 13. Bitácora de implementación

### 2026-04-26 — Fases A + C + G cerradas

**Backend (Fase A):**
- 9 archivos nuevos en `backend/src/Entity/`, `Repository/`, `Service/`, `Validator/Constraint/`.
- Migración `Version20260426191216` aplicada.
- URL del recurso quedó en `/api/jornada_tipos` (snake_case + plural inglés, convención del proyecto).

**Frontend (Fase C):**
- `frontend/src/pages/JornadasAdmin.jsx` + `.module.css`: CRUD completo con tabla editable de tramos + timeline horizontal preview.
- Sidebar: nuevo item "Jornadas" con icono `Clock`, ruta `/admin/jornadas`.
- Modal de Itinerario gana selector "Jornada" (Fase G colateral).
- i18n en 5 idiomas, claves `jornadas.*` + `sidebar.jornadas` + `itinerarios.jornadaLabel/Placeholder/Hint`.

**Bugs encontrados durante implementación:**
1. **404 en POST**: el frontend usaba `/api/jornada-tipos` (kebab-case) pero API Platform autogenera `/api/jornada_tipos` (snake_case). Resuelto cambiando el frontend.
2. **`centro: null`** al guardar: validación cliente añadida + extracción robusta del centro del usuario logueado (objeto, IRI o JSON-LD).
3. **`centro: null`** al editar: extracción del centro recibido del backend ampliada para cubrir formato JSON-LD `{"@id": "..."}`.
4. **`A new entity was found through the relationship 'App\Entity\JornadaTramo#jornadaTipo'`**: añadido `cascade: ['persist']` al `ManyToOne` de `JornadaTramo`. Workaround pragmático; si más adelante hay problemas con update de tramos al editar, sustituir por State Processor custom.

**Convenciones consolidadas para Fase D y siguientes:**
- URL del recurso jornada: `/api/jornada_tipos`.
- TIME columns viajan como `"HH:MM:SS"`.
- El campo `centro` puede venir en 3 formatos (string IRI, objeto con `.id`, JSON-LD con `@id`). Mismo patrón aplica a cualquier FK serializada.
- Helpers `normalizeHora()` y `horaToMinutos()` viven hoy en `JornadasAdmin.jsx`. Si Fase D los necesita también, extraer a `frontend/src/utils/time.js`.

### 2026-04-26 noche / 2026-04-27 — Fase D cerrada + Fase G colateral + bug crítico del solver

**Refactor `HorariosEditor.jsx` (Fase D):**
- Eliminadas constantes `SLOTS_MANANA`/`SLOTS_TARDE` y heurística `turnoGrupo` (DAW=mañana / DAM=tarde).
- Nuevo `useEffect` que carga la jornada del itinerario del grupo vía `GET /api/jornada_tipos/{id}` (cache local en `jornadasPorId`). El GET de `/api/grupos` no anida los tramos — un fetch dedicado es más limpio que tocar serializer groups en cascada.
- `tramosOrdenados` (memo): tramos de la jornada ordenados por `orden`. Genera `slotsDia` (solo SLOTs) y `recreosDia` (solo RECREOs).
- Rejilla iterada con contador `slotIdxCounter` para preservar la consistencia de claves `${dia}_${horaInicio}` en `placements`. Recreos pintados como banda gris rayada que ocupa todas las columnas (`gridColumn: span 5`).
- Banner cuando `slotsDia.length === 0` (itinerario sin jornada o jornada sin slots).
- CSS añadido en `HorariosEditor.module.css`: `.gridRowRecreo` y `.recreoStrip` con repeating-linear-gradient.

**Refactor `HorarioSolver.php`:**
- Eliminadas constantes `SLOTS_MANANA`/`SLOTS_TARDE` y método `turnoFromCiclo()`.
- Nuevo método `slotsFromJornada(JornadaTipo)` extrae los SLOTs ordenados.
- `solve()` lee `getJornadaTipo()` del grupo. Si null, devuelve respuesta clara con `error`.
- `buildParallelBusy()` compara grupos paralelos por `JornadaTipo.turno` (en vez de heurística por nombre).

**Selector de Jornada en Itinerario (Fase G colateral):**
- `AsyncSearchSelect` añadido al final del modal manual, filtra por centro vía `extraParams`.
- Helper `extractIdFromRef` unificado para los 3 formatos de FK (string/objeto/JSON-LD).
- Validación cliente del centro antes del PUT/POST.

**Bugs encontrados durante implementación:**
1. **DataTable de JornadasAdmin con props mal nombradas** (`page` en vez de `currentPage`, `onSort(col,dir)` en vez de `onSort(col)`). Causaba aparente "navegación bloqueada" por error de React. Resuelto alineando con el patrón de `Itinerarios.jsx`.
2. **`centro: null` al editar itinerario**: el extractor previo no cubría JSON-LD `{"@id": ...}` sin `.id`. Helper unificado `extractIdFromRef` aplicado tanto a centro como a jornada.
3. **CrudHeader inconsistente** en JornadasAdmin (usaba prop inexistente `animation`, toolbar separado). Reorganizado a `logo={<Lottie/>}` + filtros como children, igual que el resto de CRUDs.
4. **Selector "Jornada" oculto por scroll del modal** — el selector está al final del formulario y el usuario inicialmente no lo vio. Documentado en este doc para evitar confusión futura.

**Bug crítico DESCUBIERTO al final (no resuelto, ver §3.3 D24):**
- El usuario aportó su horario real de 2º DAW: 3 bloques de duración mixta (2h+2h+1h30 = 5h30/día → 27h30/sem). Esto destapó que el solver y el editor asumen "1 slot = 1 hora lectiva".
- Con jornadas reales de slots variables, las horas asignadas NO coinciden con `materia.horasSemanales`.
- Síntoma visible: el solver dejó 2h de "Sistemas informáticos" sin colocar (5h declaradas pero solo 3 slots disponibles para esa materia tras el reparto por backtracking heurístico).
- **Decisión D24 abierta**: A (minutos), B (sesiones), C (híbrido). Recomendación A.

**Datos de prueba creados en BD:**
- Script `scripts/seed_imparticiones_daw.sql` con 13 imparticiones (6 para DAW 1º + 7 para DAW 2º) repartidas entre 7 profesores del centro EAG. Cargas: 0-11 h/sem por profe.
- Sin esto, el editor no muestra chips en el panel lateral (no hay imparticiones que colocar).

**Archivos tocados en esta sesión:**
- `backend/src/Service/HorarioSolver.php` (refactorizado completo)
- `frontend/src/pages/HorariosEditor.jsx` (refactorizado para consumir jornada)
- `frontend/src/pages/HorariosEditor.module.css` (estilos recreos)
- `frontend/src/pages/JornadasAdmin.jsx` (fix DataTable props + CrudHeader pattern)
- `frontend/src/pages/Itinerarios.jsx` (extractIdFromRef + validación centro)
- `scripts/seed_imparticiones_daw.sql` (nuevo, datos de prueba)
- `docs/hoja-de-ruta-jornadas-recreos.md` (este documento, snapshot + bitácora)
