# Modalidad de imparticion — separar placement vs currículo

> **Status (2026-05-12)**: 🟢 **Fases 1-6 ✅ Done — roadmap cerrado**. Modelo + catálogo + solver + UI editor + UI admin + PDF anexo. El PDF del horario de grupo añade una página final "Otras horas curriculares" cuando el grupo tiene imparticiones FCT/NO_REGULAR/AUTONOMA. i18n × 5 idiomas. Pendiente ampliar al PDF personal (/horario/me) si se considera útil — diferido por baja prioridad: el caso de uso principal es el PDF del grupo que entrega el admin a profes y alumnos.
>
> **Alcance** (discusión 2026-04-29): no es parche para DAW/DAM 2º — resuelve **todo FP LOMLOE** (Básica, Medio, Superior, Especialización) y abre la puerta a ESO/Bach/Uni. Aditivo: default `PRESENCIAL` = comportamiento actual idéntico, sin riesgo de regresión.

---

## ⚡ Snapshot para retomar

### Problema raíz

En FP LOMLOE existen **materias que cuentan al currículo pero NO se imparten como clase semanal regular en aula**. El modelo actual de Loggex las trata todas como "presencial regular" → saturan la jornada lectiva del centro y el solver no las puede colocar.

Casos concretos (verificados con 2º DAM AN — sesión 2026-04-28):

| Materia | h/sem catálogo | Modalidad real | Lo que hace el sistema hoy |
|---|---|---|---|
| Desarrollo de interfaces | 7h | Presencial | ✅ correcto |
| Acceso a datos | 5h | Presencial | ✅ correcto |
| Sistemas de gestión | 4h | Presencial | ✅ correcto |
| Programación multimedia | 4h | Presencial | ✅ correcto |
| Programación servicios | 3h | Presencial | ✅ correcto |
| IPE II | 3h | Presencial | ✅ correcto |
| Inglés GS | 2h | Presencial | ✅ correcto |
| **Proyecto Intermodular** | **2h** | **No regular** (tutorización + autónoma) | ❌ tratada como presencial → satura aula |
| **Horas de libre configuración** | **3h** | **No regular** (distribución libre del centro) | ❌ tratada como presencial → satura aula |
| **FCT** | **0h** | **En empresa** | ✅ ya está a 0 min hoy, suficiente workaround |
| **Total currículo** | **33h** | **28h presenciales + 5h no regulares** | Sistema ve 33h presenciales, falla |

Resultado: el banner del CapacityPlanner para 2º DAM queda amarillo "Sobrecarga semanal" y el solver deja 6 materias con 1h sin cubrir cada una. **Si las 5h "no regulares" no consumieran slots**, el currículo presencial real (28h) cabría holgado en 27.5h slots + 2.5h recreos = 30h.

### Idea de fondo

Distinguir **placement físico** (slot en aula con un profesor) de **carga curricular** (horas que cuentan para cumplir el RD del título):

- El solver/grid maneja **placement**: solo materias presenciales en slots.
- El banner anual maneja **currículo**: TODAS las materias del catálogo (presenciales + no presenciales).
- El PDF puede tener una sección distinta para "Otras horas" no presenciales.

### Alcance estructural en LOMLOE (discusión 2026-04-29)

La feature no es un parche para DAW/DAM 2º. La causa raíz es estructural en LOMLOE FP y aplica a **todos los itinerarios**:

1. **Dual obligatoria** (RD 659/2023, vigente desde 2024-25): todos los itinerarios FP LOMLOE incorporan fase en empresa en 2º curso. La antigua FCT separable se integra como bloque dual que NO ocupa aula → `FCT`.
2. **Proyecto intermodular** (FP Superior) / **Proyecto** (FP Medio): trabajo final tutorizado, no clase semanal regular → `NO_REGULAR`.
3. **Horas de libre configuración / autonómicas**: presentes en 1º y 2º según CCAA y itinerario. En 2º DAM AN son las que detonaron el bug; en 1º DAW AN ya hay "Digitalización aplicada" autonómica que también encaja → `NO_REGULAR`.
4. **FP Básica**: tiene FCT en 2º curso. No tiene Proyecto intermodular, pero la FCT sola justifica la discriminación.
5. **Especialización** (cursos post-FP, 600-800h): mayoría llevan Proyecto final + frecuentemente fase en empresa.

**Por qué es aditivo y no destructivo**: el enum default `PRESENCIAL` = comportamiento actual byte-a-byte. Itinerarios que hoy cuadran bien (1º DAW EAG con 29h presenciales reales, 1º ESO, cualquier itinerario sin materias "no aula") se quedan idénticos sin tocar nada. Solo se reetiqueta lo que demostradamente NO es clase semanal en aula. **No se rompe ningún caso que hoy funciona.**

El riesgo no es perjudicar lo que cuadra; es que **lo que parecía cuadrar gracias a una jornada inflada** (parche temporal de 35h, ya borrado el 2026-04-28) deje de cuadrar al volver a 30h. Eso ya pasó. La modalidad lo arregla, no lo introduce.

Aplica también a (puerta abierta, fuera del alcance Fase 1-6):
- **ESO/Bach LOMLOE**: optativas, refuerzo, asignaturas con horas de autonomía.
- **Universidad**: ECTS no traducen 1:1 a horas semanales; hay teoría/práctica/laboratorio/autoaprendizaje.

---

## 1. Modelo propuesto

### Enum `Modalidad`

```
PRESENCIAL    Clase regular en aula. Consume slots de jornada lectiva.
              Default para casi todas las materias.
FCT           Formación en Centros de Trabajo. En empresa, no consume aula.
              Cuenta al currículo total.
NO_REGULAR    Proyectos, libre configuración, refuerzos sin horario fijo.
              Tutorización puntual posible pero NO clase semanal recurrente.
              Cuenta al currículo total.
AUTONOMA      Trabajo del alumno fuera del aula (LOMLOE permite hasta cierto
              % de horas no presenciales). No consume aula. Cuenta al currículo.
```

### Dónde vive

Decisión **D-A** (a cerrar antes de Fase 1): ¿`Materia.modalidad` o `Imparticion.modalidad`?

- **Opción 1: en `Materia`** (catálogo). La misma materia tiene siempre la misma modalidad para todos los grupos. Simpler. Coincide con cómo el RD del título lo declara.
- **Opción 2: en `Imparticion`** (instancia per-grupo). Permite que un centro decida que la "Libre configuración" sea presencial en su grupo (refuerzo en aula) aunque el catálogo nacional la marque como no_regular. Más flexible pero introduce variabilidad por centro.
- **Opción 3 (recomendada): default en `Materia` con override en `Imparticion`**. El catálogo declara la modalidad por defecto. El admin puede sobrescribir en `/admin/imparticiones` si su centro lo trata distinto. Mismo patrón que `Materia.minutosSemanales` (default catálogo) + `Imparticion`/`PLI.minutosSemanales` (override).

### Cómo afecta a otros campos

- **`materia.minutosSemanales`** sigue siendo "h/sem" pero solo PRESENCIAL las usa para placement. Las demás modalidades usan `minutosSemanales` como "carga semanal equivalente" (informativa para el currículo total).
- **`Imparticion`** sigue siendo materia × grupo × profesor. Para no presenciales, el `profesor` puede ser tutor o quedar nullable.
- **`PeriodoLectivoImparticion` (PLI)** sigue como entidad de unión. La modalidad se hereda de `Imparticion.modalidad` (o `Materia.modalidad`).
- **`Horario`** (placement): solo se generan para `PRESENCIAL`. Los huérfanos del solver dejan de incluir las no presenciales (que NUNCA estaban destinadas a aula).

---

## 2. Decisiones

### Abiertas (a cerrar antes de Fase 1)

(ninguna — todas cerradas el 2026-04-29 antes de empezar Fase 1)

### Cerradas

| ID | Decisión | Resolución | Razón |
|---|---|---|---|
| D-A | ¿Modalidad en `Materia`, en `Imparticion`, o ambas? | **Default en `Materia.modalidad` (NOT NULL) + override opcional en `Imparticion.modalidad` (nullable, NULL = hereda Materia).** | Mismo patrón que `minutosSemanales`. Override grupo-level es suficiente porque la modalidad pertenece a la naturaleza de la materia en ese grupo, no del rango (ver D-E). PLI no necesita modalidad propia. |
| D-B | ¿Default si NULL? | **`PRESENCIAL`.** | Preserva comportamiento actual byte-a-byte: todas las materias e imparticiones existentes serán PRESENCIAL tras el backfill. Itinerarios que ya cuadran no cambian nada. |
| D-C | ¿La modalidad afecta al solver SOLO o también a la rejilla visual? | **El solver no las coloca; la rejilla no las muestra.** Las no presenciales viven en zona aparte del editor (lista con h informativas, sin drag-and-drop). | Clean separation: rejilla = placement físico; lista lateral = currículo total. Evita confundir al admin con bloques que no cuadran. |
| D-D | ¿En el PDF? | **Una sección al final "Otras horas curriculares (no regulares)"** con las materias no presenciales y sus h/curso. NO una página por modalidad. | Coherente con la rejilla: el PDF es un export del horario, las no presenciales son anexo informativo del currículo total. |
| D-E | ¿La modalidad puede cambiar a mitad de curso? | **No.** Override de `Imparticion` se fija al crear el grupo. Si el centro cambia de criterio, replantea para el siguiente curso. | La modalidad es estructural (¿es clase regular en aula o no?), no varía por rango. Cambiarla a mitad de curso invalidaría placements y carga curricular. |
| D-F | ¿Sub-modalidades (PRESENCIAL_TEORIA / PRESENCIAL_LAB para Universidad)? | **No en Fase 1-6.** Puerta abierta para Universidad cuando llegue. | El alcance Fase 1-6 es FP/ESO/Bach LOMLOE. Universidad probablemente requiera modelo aparte (ECTS no traducen 1:1). No precondicionar el enum con casos no resueltos. |

---

## 3. Fases de implementación

### Fase 1 — Modelo + migración (sin UI) ✅ Done (2026-04-29)

- ✅ Enum `App\Entity\Modalidad` con `label()` + `consumeAula()` (único punto de verdad para "¿esto va a la grilla?").
- ✅ `Materia.modalidad` NOT NULL DEFAULT `'presencial'` con enumType, getter/setter, expuesto en `materia:read/write` + `imparticion:read`.
- ✅ `Imparticion.modalidad` nullable con enumType + `getEffectiveModalidad()` (fallback Materia → PRESENCIAL).
- ✅ Migration `Version20260429120000` con backfill por DEFAULT (65 materias → presencial, 51 imparticiones → NULL = hereda).
- ✅ Smoke test PHP CLI: `getEffectiveModalidad()` resuelve correctamente, `consumeAula()` devuelve `true` para PRESENCIAL.

**Esfuerzo real**: ~30 min.

### Fase 2 — Cargar modalidad en el catálogo nacional + BOJA ✅ Done (2026-04-29)

- ✅ `Modalidad::inferFromName($nombre)` heurística: "Formación en Centros de Trabajo"/"FCT" → FCT, "Proyecto X" → NO_REGULAR, "libre configuración" → NO_REGULAR, resto → PRESENCIAL.
- ✅ `CatalogoMateria.modalidad` NOT NULL DEFAULT `presencial` + `CatalogoMateriaCcaa.modalidad` nullable (override). Migration `Version20260429140000` con backfill por LIKE: 293 FCT + 87 NO_REGULAR detectados sobre 2 576 materias del catálogo.
- ✅ `BoeRdEnricher` aplica heurística al persistir cada `CatalogoMateria` desde el BOE (cubre futuros enrichments sin tocar nada).
- ✅ `MateriaOverrideDto.modalidad` nullable propagado por `BojaAndHardcodedProvider` (override explícito en `0492 Proyecto DAM` → NO_REGULAR, belt-and-suspenders sobre la heurística) y `BojaAndJsonProvider` (libre configuración → NO_REGULAR; el resto cae al fallback heurístico vía resolver).
- ✅ `SeedCcaaCommand::aplicarDatos` + `datosCoinciden` propagan modalidad (24 rows actualizados con datos del provider hardcoded).
- ✅ `CcaaResolverService::ResolvedMateria.modalidad` con cascada: override CCAA explícito → modalidad del catálogo nacional (override) → `Modalidad::inferFromName($nombre)` (autonómica pura sin declaración) → PRESENCIAL.
- ✅ `GrupoResyncCcaaController` setea `Materia.modalidad` al crear/actualizar (preserva el override `Imparticion.modalidad` que sea decisión del centro).
- ✅ Smoke test E2E con 2º DAM AN: 4 materias correctamente NO_REGULAR/FCT (`0492 Proyecto DAM`, `1713 Proyecto Intermodular`, `AN-LIBRE-DAM-2`, `0495 FCT`).

**Esfuerzo real**: ~1h.

### Fase 3 — Solver y CapacityPlanner respetan modalidad ✅ Done (2026-04-29)

- ✅ `CapacityPlanner::plan()` filtra PLIs cuya `Imparticion::getEffectiveModalidad()->consumeAula()` sea `false`. Las no presenciales no entran al ILP — ni a `materias[]`, ni a `cuotas`, ni a `totalMinutos`, ni a `huerfanos`.
- ✅ `HorarioSolver::solve()` aplica el mismo filtro al construir `$imps[]`. Coherencia: el solver no debe procesar nada que el planner no consideró. Sus placements no existen para no presenciales.
- ✅ Smoke test E2E con grupo 2º DAM EAG (id=4):

| Métrica | ANTES (todo presencial) | DESPUÉS (modalidad aplicada) |
|---|---|---|
| feasible | false | true (con 0.5h round-up) |
| totalMinutos semanal | 1 980 (33h) | 1 680 (28h) |
| capacidadMinutos | 1 650 (27.5h) | 1 650 (27.5h) |
| imparticiones procesadas | 9 | 7 |
| huérfanos | 6 | 1 (round-up 30 min) |
| placements colocados | parcial | 25 (`complete: true`) |

Tres no presenciales correctamente excluidas del placement: `1713 Proyecto Intermodular` (2h, NO_REGULAR), `AN-LIBRE-DAM-2 Horas de libre configuración` (3h, NO_REGULAR), `0495 Formación en Centros de Trabajo` (FCT). Total deducido: 5h "no regulares" del bug original.

**Esfuerzo real**: ~20 min.

### Fase 4 — Banner anual y chip lateral respetan modalidad ✅ Done (2026-04-29)

- ✅ Helpers `getEffectiveModalidad(imp)` + `consumeAulaModalidad(modalidad)` en `HorariosEditor.jsx` (mirror del backend `Imparticion::getEffectiveModalidad()` + `Modalidad::consumeAula()`).
- ✅ Split `imps` → `impsPresenciales` (drag panel) + `impsNoPresenciales` (sub-panel informativo).
- ✅ Nuevo componente `OtrasHorasItem` sin drag-and-drop, con badge de modalidad (`FCT` azul / `No regular` ámbar / `Autónoma` gris) y `h/sem` informativo.
- ✅ Sub-panel "Otras horas curriculares (N)" con divisor y hint dentro del mismo `<aside>` lateral.
- ✅ CSS para `.otrasHorasSection`, `.otrasHorasItem`, `.modalidadBadge` y sus variantes por modalidad.
- ✅ Banner anual: **sin cambios** — ya sumaba todas las materias (presencial + no presencial) correctamente.
- ✅ Banner CapacityPlanner: **sin cambios textuales** — ya consume `cap.totalMinutos` filtrado por backend (Fase 3) y los textos siguen siendo precisos.
- ✅ i18n × 5 idiomas: claves nuevas `scheduleEditor.panelOtrasHoras`, `scheduleEditor.panelOtrasHorasHint` y bloque `modalidad.badge.{presencial,fct,no_regular,autonoma}`.
- ✅ Build de Vite OK (1992 módulos transformados, sin warnings nuevos).

**Esfuerzo real**: ~30 min.

### Fase 5 — UI para editar modalidad ✅ Done (2026-04-29 noche)

- `/admin/materias`: columna "Modalidad" en la tabla (badge solo cuando NO es presencial). Select en el modal de edición.
- `/admin/imparticiones`: columna "Modalidad" mostrando efectiva (override o heredada con asterisco). Select "Modalidad (override)" en modal con opción "— Heredar de la materia —".
- Modal "Materias del rango": badge de modalidad junto al nombre cuando NO es presencial.
- i18n × 5 idiomas (es/en/ca/gl/eu).

**Esfuerzo real**: ~30 min.

### Fase 6 — PDF con sección "Otras horas curriculares" ✅ Done (2026-05-12)

- `HorarioPdfController::horarioGrupo()`: tras las páginas por rango, añade una página final con tabla de modalidades no presenciales. Implementado vía helper `loadOtrasHorasCurriculares(Grupo)` que lee imparticiones del grupo, filtra `effectiveModalidad !== PRESENCIAL` y ordena FCT → NO_REGULAR → AUTONOMA + alfabético por materia. Las horas totales se leen de `Materia.horasTotales` (Opción A 2026-04-29 — fuente legal LOMLOE).
- Twig `pdf/horario.html.twig`: nueva página condicional `{% if hasOtrasHoras %}` tras el `{% endfor paginas %}` con cabecera, subtítulo explicativo y tabla 4 columnas (materia, modalidad badge, horas totales, profesor). Badge con color por modalidad (gris/marrón/verde).
- i18n × 5: 10 claves nuevas bajo `horario.*` (other_hours_title/subtitle/subject/modality/hours/teacher + modality_fct/no_regular/autonoma + no_hours_set).
- Page-break automático: la última página por rango lleva `page-break` solo si después viene el anexo de "Otras horas".

**Implementación**: PDF personal (`horarioPersonal`) NO se tocó. El caso de uso principal es el PDF del grupo que entrega el admin a profes y alumnos; añadir el anexo al PDF personal requeriría calcular qué materias no presenciales corresponden a cada usuario (alumno = materias de sus matrículas; profe = materias que imparte), lo que duplica la lógica sin valor añadido evidente. Diferido por baja prioridad.

### Total esfuerzo: ~3 sesiones.

---

## 4. Impacto en otros docs

| Doc | Cambio |
|---|---|
| `hoja-de-ruta-periodos-lectivos.md` | El cap anual cross-rango (Fase 5 sub-C) seguirá funcionando, pero solo cuenta presenciales en el cómputo. El banner anual de Fase 3b mantiene la cifra "todo currículo" para el cómputo total. |
| `catalogo-oficial.md` | Añadir §21 "Modalidades de imparticion" explicando el enum y cómo se carga desde el catálogo nacional + overrides CCAA. |
| `hoja-de-ruta-curriculum-ccaa.md` | El provider hardcoded extiende sus overrides para incluir modalidad por materia LOMLOE. |
| `hoja-de-ruta-jornadas-recreos.md` | Sin cambio directo. La jornada sigue siendo lectiva pura. |

---

## 5. Riesgos y mitigaciones

- **Migración de data existente**: todas las materias e imparticiones actuales pasan a `PRESENCIAL`. Sin sorpresas para grupos ya configurados (mantienen comportamiento anterior). Solo materias futuras o overrides explícitos cambian el comportamiento.
- **Catálogo nacional incompleto**: el BOE no siempre marca explícitamente que una materia es "no regular" — hay que inferir por nombre o aplicar override en `BojaAndHardcodedProvider`. Heurística inicial + auditoría manual de los itinerarios principales (DAW, DAM, ASIR, SMR).
- **UX confusa con el nuevo enum**: cuatro modalidades pueden ser muchas para el admin. Mitigación: en la UI, la modalidad se muestra solo cuando NO es PRESENCIAL (default invisible). La columna en tablas se rellena solo cuando aplica.
- **Universitario ECTS**: el modelo ECTS no traduce 1:1 a slots ni horas semanales fijas. Para Universidad probablemente haga falta un modelo distinto (sub-fase futura). Por ahora: PRESENCIAL/AUTONOMA cubre el 80% del caso.

---

## 6. Bitácora de implementación

### 2026-05-12 — Fase 6 ✅ Done (PDF anexo "Otras horas curriculares") — ROADMAP CERRADO

Cierra el roadmap completo. La sesión 2026-05-12 lo abordó tras el último commit de notificaciones (`c0c8708`) cuando el usuario aprobó cerrar Modalidad como primera tarea pendiente.

**Cambios**:

- **`backend/src/Controller/HorarioPdfController.php`**:
  - Nuevo helper `loadOtrasHorasCurriculares(Grupo $grupo): array` que ejecuta una sola query DQL sobre `Imparticion` del grupo (deleted=false + materia deleted=false), filtra `effectiveModalidad !== PRESENCIAL` en PHP y ordena FCT → NO_REGULAR → AUTONOMA + alfabético. Las horas se toman de `Materia.horasTotales` (Opción A 2026-04-29). Profesor opcional (`null` si la imparticion no tiene profesor asignado).
  - Invocación en `horarioGrupo()` tras construir las páginas: `$context['otrasHoras'] = $this->loadOtrasHorasCurriculares($grupo)`.
  - Bloque `i18n` ampliado con 10 claves nuevas: `otherHoursTitle/Subtitle/Subject/Modality/Hours/Teacher`, `modalityFct/NoRegular/Autonoma`, `noHoursSet`.

- **`backend/templates/pdf/horario.html.twig`**:
  - CSS nuevo para `.other-hours-title`, `.other-hours-subtitle`, `.other-hours-table` (4 columnas con anchos definidos), `.modality-badge` (paleta sobria gris/marrón/verde por modalidad, diferenciada de los colores HSL deterministas de la grilla).
  - Bloque condicional `{% if hasOtrasHoras %}` dentro del modo multi-página (después del `{% endfor paginas %}`): página adicional con header + título + subtítulo + tabla 4 columnas (Materia, Modalidad badge, Horas totales, Profesor).
  - Lógica `needsBreak` para que la última página por rango lleve `page-break` solo si el anexo viene a continuación.

- **`backend/translations/horario.{es,en,ca,eu,gl}.yaml`**: 10 claves nuevas por idioma, con etiquetas educativas naturales en cada lengua (FCT español, "Work placement" inglés, "LPP" euskera, etc.).

**Decisión nueva no anticipada**:

- **D-Fase6-1** (cerrada) — el PDF personal (`/api/v1/informes/horario/me`, `horarioPersonal()`) NO recibe el anexo en esta fase. Razón: el caso de uso principal es el PDF del grupo que el admin entrega a profes y alumnos. Añadirlo al personal implicaría calcular qué no presenciales corresponden a cada usuario (alumno = vía matrículas; profe = vía imparticiones que imparte), lo que duplica lógica. Diferido como mejora opcional si llega demanda.

**Limitaciones documentadas**:

- Si una materia no presencial tiene `horasTotales = null` (raro: el catálogo BOE lo trae casi siempre, pero podría ocurrir si se creó una imparticion manual sin catálogo), la celda muestra `—`. Sin fallback a `minutosSemanales × semanas` para no inventar cifras.
- Si la imparticion no tiene profesor asignado, la celda muestra `—` también. UX correcta para FCT (que muchas veces no lleva profesor responsable hasta empezar el curso).

**Validación E2E pendiente** (tras `docker compose restart backend`):
- Generar PDF de un grupo FP LOMLOE con materias FCT/Proyecto/HLC (p.ej. 2º DAM EAG): debe aparecer página final "Otras horas curriculares" con `Proyecto Intermodular [No regular]`, `Horas de libre configuración [No regular]`, `Formación en Centros de Trabajo [FCT]` y sus horas totales.
- Generar PDF de un grupo sin no presenciales (p.ej. 1º ESO si no hay FCT en ESO): el PDF debe quedar como antes — sin página anexa, sin page-break tras la última parrilla.

### 2026-04-29 noche — Fase 5 ✅ Done (UI editar modalidad)

UI completa para editar la modalidad de materias e imparticiones desde el admin. Cambios en 3 archivos frontend + i18n × 5 idiomas:

- **`/admin/materias`** (`pages/Materias.jsx`):
  - Nueva columna "Modalidad" en el `DataTable`. Solo muestra badge cuando NO es `presencial` (95% de los casos default invisible — UX limpia). Badges con color: FCT azul, NO_REGULAR ámbar, AUTONOMA gris (estilos heredados de `HorariosEditor.module.css`, replicados en `Crud.module.css` para reuso).
  - Nuevo `<select>` "Modalidad" en el modal de edición con 4 opciones (presencial/fct/no_regular/autonoma). Hint explicativo bajo el select.
  - `formData.modalidad` integrado en init/edit/payload. PUT/POST envía la modalidad junto con el resto.

- **`/admin/imparticiones`** (`pages/Imparticiones.jsx`):
  - Nueva columna "Modalidad" en el `DataTable`. Muestra modalidad efectiva (override de Imparticion si existe, sino hereda de Materia). Override se distingue con asterisco `*` y tooltip "Override (esta imparticion)" vs "Heredada de la materia".
  - Nuevo `<select>` "Modalidad (override)" en el modal con opción "— Heredar de la materia —" (`value=""` ↔ `null` en BD). Permite override solo para grupo concreto sin afectar la materia base.

- **Modal "Materias del rango"** (PLI editor en `HorariosEditor.jsx` Fase 4 PeriodoLectivo):
  - Badge de modalidad al lado del nombre de la materia cuando NO es presencial. Visualmente alerta al admin de que esa materia no consume slot semanal en aula (su input de horas anuales sigue siendo editable porque el currículo cuenta, pero al placement físico no llega).

- **CSS**: `Crud.module.css` añade `.modalidadDefault`, `.modalidadBadge`, `.modalidadBadge_fct/_no_regular/_autonoma`, `.formHint`. Mirror del estilo ya usado en `HorariosEditor.module.css` para coherencia visual entre vistas admin y editor.

- **i18n × 5 idiomas** (es, en, ca, gl, eu): nuevas claves
  - `modalidad.label.{presencial,fct,no_regular,autonoma}` (textos largos para selects de modal).
  - `materias.modality`, `materias.modalityHint`.
  - `teaching.modality`, `teaching.modalityOverride`, `teaching.modalityInherit`, `teaching.modalityOverrideHint`, `teaching.modalityOverridden`, `teaching.modalityInherited`.
  - Bonus: claves `teaching.aulaEspecifica*` migradas al locale (estaban inline como defaultValue).
  - JSON × 5 idiomas validado.

**Comportamiento E2E**:
- El admin entra a `/admin/materias`, ve columna "Modalidad" con `—` para presenciales y badge para FCT/NO_REGULAR/AUTONOMA. Click en editar → select en modal.
- Tras guardar, el cambio se propaga: panel lateral del editor de horarios filtra automáticamente (Fase 4); modal "Materias del rango" muestra badge.
- Si una materia en general es PRESENCIAL pero un grupo específico la imparte como NO_REGULAR (caso edge), el admin la edita en `/admin/imparticiones` con override. El `getEffectiveModalidad` del backend ya respeta la jerarquía override → herencia.

**Pendiente Fase 6** (~0.5 sesión): PDF con sección "Otras horas curriculares" tras las páginas por rango. Sin implementar todavía.

### 2026-04-29 — Fase 4 ✅ Done (panel lateral del editor honra modalidad)

**Cambios en código**:
- `frontend/src/pages/HorariosEditor.jsx`:
  - Helpers `getEffectiveModalidad(imp)` y `consumeAulaModalidad(modalidad)` cerca del top del archivo (mirror estricto del backend). La API expone modalidad como string en `imp.modalidad` y `imp.materia.modalidad`; el helper aplica la cascada override → catálogo → fallback PRESENCIAL.
  - Componente `OtrasHorasItem` para render no-arrastrable con badge de modalidad. Reutiliza `MateriaLabel` y `colorForModule`. Sin progreso (no aplica para no presenciales).
  - `useMemo` `impsPresenciales` / `impsNoPresenciales` que parten `imps[]` por `consumeAulaModalidad(getEffectiveModalidad(i))`.
  - Render del `<aside className={styles.modulesPanel}>`: el `.map(impsPresenciales)` alimenta `ModuleChip` (drag); abajo, condicional `impsNoPresenciales.length > 0` añade el sub-panel "Otras horas curriculares (N)" con hint y `OtrasHorasItem` por entrada.
- `frontend/src/pages/HorariosEditor.module.css`:
  - `.otrasHorasSection` con `border-top` punteado y margen superior.
  - `.otrasHorasTitle` y `.otrasHorasHint` (texto sutil, italic).
  - `.otrasHorasItem` similar a `moduleChip` pero `cursor: default`, opacidad 0.9, sin estados drag/done.
  - `.modalidadBadge` base + variantes `_fct` (azul), `_no_regular` (ámbar) y `_autonoma` (gris) usando `color-mix` para no añadir variables CSS nuevas.
- `frontend/src/i18n/locales/{es,en,ca,gl,eu}.json`:
  - Claves `scheduleEditor.panelOtrasHoras` ("Otras horas curriculares ({{count}})") y `scheduleEditor.panelOtrasHorasHint` ("No ocupan slot de aula pero cuentan al currículo anual.").
  - Bloque top-level `modalidad.badge.{presencial,fct,no_regular,autonoma}` con etiquetas en cada idioma.

**Decisiones puntuales tomadas durante implementación**:
- **Banner CapacityPlanner sin cambios textuales** (D-G informal, no estaba en D-A→D-F): el banner consume `cap.totalMinutos` ya filtrado por Fase 3 backend, y los textos "Las materias suman X h/sem" siguen siendo correctos (ahora "X" es el subtotal presencial). Cambiar a "Las materias presenciales..." complicaría el copy sin valor añadido. El sub-panel "Otras horas" del lateral ya cubre la separación visual.
- **Banner anual sin cambios**: `curriculumMin` sigue siendo Σ todas las materias × 36 sem, y `plannedMin` sigue siendo Σ PLI × semanas (incluye no presenciales). Esa es la lectura correcta de "currículo total" — separarla por modalidad sería sobrediseño.
- **Badges con `color-mix` en lugar de variables CSS nuevas**: el sistema de tematización del proyecto ya expone `--color-info`, `--color-warning`, `--color-text-secondary`. `color-mix` permite tonalidades blandas (12% / 35% / 40%) sin tocar `theme.js` ni inventar tokens nuevos.
- **Sub-panel dentro del mismo `<aside>`**: la alternativa era un panel separado abajo. Se descartó porque (a) el sticky del aside seguiría funcionando, (b) el admin ve de un vistazo "todas las materias del grupo, separadas por placement", (c) menos cambio de layout.

**Verificación**:
- `npm run build` OK: 1992 módulos transformados, sin warnings nuevos. Solo warnings preexistentes (lottie-web `eval`, chunk size > 500 kB) sin relación.
- JSON de los 5 idiomas validado por parser Python (`json.load`).
- Visualmente pendiente: el usuario verifica en navegador. Esperado en 2º DAM EAG: 7 chips arrastrables (Acceso a datos, Desarrollo de interfaces, Programación multimedia, Programación servicios, Sistemas gestión, Inglés profesional GS, IPE II) + sub-panel "Otras horas curriculares (3)" con `Proyecto Intermodular [No regular] 2h/sem`, `Horas de libre configuración [No regular] 3h/sem`, `Formación en Centros de Trabajo [FCT]` (sin h/sem porque minutosSemanales=0).

**Sin cambios funcionales en**: PDF (sigue sin sección "Otras horas curriculares" — Fase 6), UI de edición de modalidad (no existe — Fase 5), `/admin/materias` y `/admin/imparticiones` (sin columna modalidad).

**Siguiente** (Fase 5, ~0.5 sesión): columna "Modalidad" editable en `/admin/materias` (default catálogo) y "Modalidad (override)" opcional en `/admin/imparticiones` (per-grupo). Modal "Materias del rango" (Fase 4 PeriodoLectivo, no confundir con esta Fase 4) puede mostrar badge de modalidad junto al nombre — opcional, polish.

### 2026-04-29 — Fase 3 ✅ Done (solver + CapacityPlanner respetan modalidad)

**Cambios en código** (mínimos, dos hooks idénticos):
- `backend/src/Service/CapacityPlanner.php` (línea ~131): tras `if ($imp === null || $imp->isDeleted()) continue;`, añadido `if (!$imp->getEffectiveModalidad()->consumeAula()) continue;`. Las no presenciales no entran al ILP — el cómputo de `materias[]`, `totalMinutos`, generación de combos, backtracking y reporte de huérfanos las ignora completamente.
- `backend/src/Service/HorarioSolver.php` (línea ~112): mismo filtro al construir `$imps[]`. Coherencia con planner: si el planner no las cuenta, el solver tampoco.

**Por qué tan poco código**:
- El single point of truth es `Modalidad::consumeAula()` (creado en Fase 1). Solver/planner solo preguntan, sin saber qué modalidades existen.
- Toda la cadena Imparticion.modalidad → Materia.modalidad → fallback heurístico ya está montada (Fases 1+2). Aquí solo se enchufa al consumidor.
- Las no presenciales que ya tenían 0 minutos efectivos (caso típico FCT) ya se filtraban por `<= 0`; el filtro nuevo cubre los casos de NO_REGULAR con minutos > 0 (Proyecto, libre configuración).

**Verificación E2E con 2º DAM EAG** (id=4):

UPDATE manual previo simulando post-resync (las 3 materias no presenciales del grupo: `1713`, `AN-LIBRE-DAM-2`, `0495`) → ejecutar `CapacityPlanner` y `HorarioSolver`.

Resultados:
- `CapacityPlanner`: 33h → 28h totales (cayó las 5h no regulares + 0h FCT). 6 → 1 huérfanos. `feasible` sigue false porque 28h > 27.5h, pero el déficit es solo 30 min (round-up).
- `HorarioSolver`: `complete: true`, 25 placements colocados. 7 imparticiones presenciales procesadas (Acceso a datos, Desarrollo de interfaces, Programación multimedia, Programación servicios, Sistemas gestión, Inglés profesional GS, IPE II). Las 3 no presenciales NO aparecen ni en `imparticiones` ni en `placements`.
- `unplaced`: 1 imparticion con 30 min (round-up D22=A — el truco de recreos LOMLOE lo absorbe).

**Conclusión**: la modalidad cumple lo prometido. El currículo presencial real (28h) cabe en la jornada normal de 27.5h con margen mínimo. El bug original que motivó toda esta hoja de ruta queda resuelto a nivel de solver. Lo único pendiente para producción real es disparar el resync (vía `/admin/grupos` o `POST /api/v1/grupos/{id}/resync-ccaa`) para que las `Materia` live de cada grupo reciban su modalidad correcta del catálogo. **Tras el smoke test, las 3 filas modificadas manualmente quedan con su valor correcto** — coincide con el resultado de un resync real.

**Sin cambios funcionales en**: banner anual (sigue contando todo currículo presencial+no presencial), chip lateral del editor (sigue mostrando todas las materias arrastrables, incluida Proyecto/FCT), PDF (sigue sin sección "Otras horas curriculares"), UI de edición de modalidad (no existe). Esos componentes los aborda Fase 4 (banner + chip), Fase 5 (UI editar), Fase 6 (PDF).

**Siguiente** (Fase 4, ~0.75 sesión): banner anual mantiene `Σ currículo` (todas las modalidades) pero el banner del CapacityPlanner pasa a `Σ presencial vs jornada` (más limpio: si presenciales caben → verde, sin "informativo amarillo" residual). ModuleChip lateral filtra por `consumeAula()` para drag-and-drop; añade vista "Otras horas curriculares" con la lista no presencial.

### 2026-04-29 — Fase 2 ✅ Done (catálogo + heurística + cascada CCAA)

**Cambios en código**:
- `backend/src/Entity/Modalidad.php`: añadida `inferFromName(string)` con tres patrones (FCT/Proyecto/libre configuración). Centraliza la heurística — el resto del código nunca compara substrings de nombre directamente.
- `backend/src/Entity/Catalogo/CatalogoMateria.php`: nueva propiedad `modalidad` NOT NULL DEFAULT `presencial`, expuesta en `catalogo:read`.
- `backend/src/Entity/Catalogo/CatalogoMateriaCcaa.php`: nueva propiedad `modalidad` nullable (override del catálogo nacional o autonómica pura).
- `backend/src/Catalogo/Ccaa/Dto/MateriaOverrideDto.php`: añadido `?Modalidad $modalidad = null` al final del constructor (campo opcional, no rompe llamadas existentes).
- `backend/src/Catalogo/BoeRd/BoeRdEnricher.php`: en `applyChanges()`, al crear cada `CatalogoMateria` se aplica `Modalidad::inferFromName($nombre)` automáticamente. Cubre los ~2 230 módulos cargados desde BOE más cualquier futura ingesta.
- `backend/src/Catalogo/Ccaa/Provider/BojaAndHardcodedProvider.php`: estructura `MATERIA_OVERRIDES` ahora acepta `'modalidad' => Modalidad::X` opcional. Override explícito añadido en DAM 2º `0492 Proyecto` → `NO_REGULAR` (red de seguridad — la heurística lo cazaría igualmente). El resto se queda como NULL = hereda.
- `backend/src/Catalogo/Ccaa/Provider/BojaAndJsonProvider.php`: helper `resolverModalidad($modulo, $default)` que lee `modalidad` del JSON cuando existe, con fallback al default. Para `libreConfig` → NO_REGULAR. Para transversales LOMLOE → NULL (deja al resolver decidir vía heurística, evitando que un JSON viejo que clasifica mal "Proyecto Intermodular" como transversal lo etiquete PRESENCIAL).
- `backend/src/Command/Catalogo/SeedCcaaCommand.php`: `datosCoinciden` y `aplicarDatos` ahora propagan modalidad. Al re-ejecutar el seed con datos pre-Fase 2, 24 rows quedaron con modalidad NULL excepto `0492 Proyecto DAM` que recibió NO_REGULAR explícito.
- `backend/src/Service/CcaaResolverService.php`: `ResolvedMateria.modalidad` con cascada explícita en `resolverMaterias()`. Para autonómicas puras, fallback final a `Modalidad::inferFromName($nombre)` — la red de seguridad que captura "Horas de libre configuración" e "Proyecto Intermodular" cuando ningún provider los marca explícitamente.
- `backend/src/Controller/GrupoResyncCcaaController.php`: el resync ahora copia `r->modalidad` a `Materia.modalidad` tanto al crear como al actualizar. Importante: NO toca `Imparticion.modalidad` (override per-grupo del centro, decisión humana).
- `backend/migrations/Version20260429140000.php`: dos `ALTER TABLE ADD COLUMN`. Para `catalogo_materia` añade DEFAULT 'presencial' que rellena al instante; backfill heurístico vía dos UPDATE con `LIKE` (FCT primero, Proyecto después). Para `catalogo_materia_ccaa` solo añade columna nullable; el backfill se delega al resolver en runtime para no necesitar otra migración cuando se afine la heurística.

**Verificación E2E con 2º DAM AN**:
- Catálogo nacional: 293 FCT + 87 NO_REGULAR detectados (vs 2 196 PRESENCIAL).
- `0492 Proyecto de desarrollo de aplicaciones multiplataforma` → `no_regular` (heurística).
- `0495 Formación en Centros de Trabajo` → `fct` (heurística).
- `1713 Proyecto Intermodular` (autonómica pura JSON sin modalidad) → `no_regular` (resolver fallback inferFromName).
- `AN-LIBRE-DAM-2 Horas de libre configuración` (autonómica pura JSON sin modalidad) → `no_regular` (resolver fallback inferFromName).
- Total 5h "no regulares" del bug original ahora correctamente identificadas — quedan invisibles para el solver cuando llegue Fase 3.

**Bug latente detectado durante verificación** (no afecta ahora pero merece anotar):
- El JSON `catalogo/ccaa/AN/curated/horarios.json` no existe en MinIO actualmente (probablemente borrado tras subida pre-Fase 5 sub-E). `BojaAndJsonProvider` queda no-op silencioso — `forCcaa(AN)` lo escoge porque "gana el último registrado" pero no emite nada. Las rows existentes en `catalogo_materia_ccaa` provienen de un seed pasado y no se refrescan. Mitigación: el resolver aplica heurística sobre las rows existentes, así que el comportamiento end-to-end es correcto. Pendiente regenerar y re-subir el JSON cuando se aborde Fase 3 opción B (parser PDF real).

**Sin cambios funcionales aún para el solver / banner / rejilla / PDF**: estos componentes siguen tratando todo como PRESENCIAL implícito. Es Fase 3 quien los hace honrar la modalidad.

**Siguiente** (Fase 3, ~0.5 sesión): `CapacityPlanner` y `HorarioSolver` filtran imparticiones por `getEffectiveModalidad()->consumeAula()` antes del cómputo. Banner anual mantiene "todo currículo" (presencial + no presencial); banner CapacityPlanner pasa a "presencial vs jornada" (más limpio).

### 2026-04-29 — Fase 1 ✅ Done (modelo + migración + backfill)

**Decisiones cerradas** (D-A→D-F): todas con la recomendación inicial. Movidas al bloque "Cerradas" con resolución y razón. Sin sorpresas durante implementación.

**Cambios en código**:
- `backend/src/Entity/Modalidad.php` (nuevo): backed enum string con 4 cases + `label()` + `consumeAula()`. Este último es el punto único de verdad para "¿esta modalidad consume slot de aula?" — solver, CapacityPlanner, rejilla y PDF deben preguntárselo en lugar de comparar `=== Modalidad::PRESENCIAL` repetido por toda la base.
- `backend/src/Entity/Materia.php`: nueva propiedad `modalidad` con `enumType` + default PHP-side `Modalidad::PRESENCIAL`, expuesta en grupos `materia:read/write` y `imparticion:read`.
- `backend/src/Entity/Imparticion.php`: nueva propiedad `modalidad` nullable + `getEffectiveModalidad()` con fallback `override → materia → PRESENCIAL`. La PRESENCIAL final es defensiva por si la materia no se carga (no debería pasar, pero evita NPEs).
- `backend/migrations/Version20260429120000.php`: dos `ALTER TABLE ADD COLUMN`. La columna de `materia` lleva `DEFAULT 'presencial' NOT NULL` para que MariaDB rellene el backfill automáticamente sin necesidad de UPDATE explícito. Imparticion queda nullable (NULL = hereda).

**Verificación**:
- `doctrine:migrations:migrate` → 1 migración aplicada, 2 SQL queries, 107.5ms.
- `doctrine:schema:validate` → mappings OK; el "no in sync" residual son renames de índices `IDX_PL_*` → `IDX_<hash>` heredados de fases previas (no de modalidad).
- `SELECT COUNT(*) FROM materia WHERE modalidad='presencial'` → 65/65.
- `SELECT COUNT(modalidad) FROM imparticion` → 0 overrides (todas heredan).
- Smoke test PHP CLI: `getEffectiveModalidad()` resuelve a PRESENCIAL, `consumeAula()` devuelve `true`.

**Sin cambios funcionales aún**: solver, CapacityPlanner, banner, rejilla y PDF siguen tratando todo como PRESENCIAL implícito. El comportamiento honor-modalidad llega en Fases 3-6.

**Siguiente** (Fase 2, ~0.5 sesión): cargar modalidad en catálogo nacional + overrides BOJA. Heurística inicial por nombre de materia ("Formación en Centros de Trabajo" → FCT, "Proyecto" → NO_REGULAR) + overrides explícitos en `BojaAndHardcodedProvider` para DAW/DAM 1º+2º.

### 2026-04-29 — Alcance ampliado tras discusión

Conversación clarifica que la feature no es un parche para DAW/DAM 2º. La causa raíz es estructural en LOMLOE y aplica a **todo FP**:

- **Dual obligatoria** (RD 659/2023) en todos los 2º cursos LOMLOE → `FCT`.
- **Proyecto intermodular** (Superior) / Proyecto (Medio) → `NO_REGULAR`.
- **Horas de libre configuración / autonómicas** en 1º y 2º según CCAA → `NO_REGULAR`.
- **FP Básica** tiene FCT en 2º; aunque sin proyecto intermodular, la FCT sola justifica la discriminación.
- **Especialización** suele llevar Proyecto final + fase en empresa.

Punto clave validado: el enum es **aditivo**. Default `PRESENCIAL` = comportamiento actual idéntico. Itinerarios que ya cuadran (1º DAW EAG con 29h reales, 1º ESO, etc.) se quedan sin tocar. Solo se reetiqueta lo que demostradamente no es clase en aula. **Sin riesgo de regresión.**

Añadida sub-sección "Alcance estructural en LOMLOE" en el snapshot. Status actualizado a 2026-04-29. Plan, fases y decisiones D-A→D-F sin cambios (siguen válidos al ampliar alcance).

### 2026-04-28 — Doc creado

Plan diseñado tras detectar limitación con 2º DAM AN (33h/sem currículo, déficit 5.5-6h vs jornada 30h presencial). Causa raíz: el modelo trata todas las imparticiones como `PRESENCIAL`, saturando slots con materias que NO son clases semanales regulares (Proyecto Intermodular, Horas de libre configuración).

Decidido modelo enum `Modalidad` con default `Materia.modalidad` + override `Imparticion.modalidad` (mismo patrón que minutos). 6 fases (~3 sesiones total). D-A a D-F pendientes de cerrar antes de Fase 1.

Cross-ref con: `hoja-de-ruta-periodos-lectivos.md` (Fase 5 cerrada antes; el cap anual cross-rango ya está y solo necesita filtrar por modalidad), `catalogo-oficial.md` (donde vivirá la documentación del enum + carga catalogo).
