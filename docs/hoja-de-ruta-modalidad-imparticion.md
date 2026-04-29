# Modalidad de imparticion — separar placement vs currículo

> **Status (2026-04-29)**: 🟡 Fase 1 ✅ Done (modelo + migración + backfill, sin UI). Decisiones D-A→D-F cerradas con sus recomendaciones iniciales. **Siguiente**: Fase 2 (cargar modalidad en catálogo nacional + overrides BOJA para LOMLOE FP).
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

### Fase 2 — Cargar modalidad en el catálogo nacional + BOJA

- `BoeRdEnricher` extrae modalidad del nombre de la materia cuando contiene "Formación en Centros de Trabajo" → FCT, "Proyecto" → NO_REGULAR, etc. (heurística inicial).
- `BojaAndHardcodedProvider` añade overrides explícitos para LOMLOE FP:
  - DAW 2º: `0492 Proyecto DAW` → NO_REGULAR. `0619 FCT` → FCT.
  - DAM 2º: `0492 Proyecto DAM` → NO_REGULAR. `AN-LIBRE-DAM-2` → NO_REGULAR. FCT correspondiente → FCT.
  - DAW/DAM 1º: todas PRESENCIAL.
- Añadir override por código oficial similar al patrón actual de minutos.

**Esfuerzo**: ~0.5 sesión.

### Fase 3 — Solver y CapacityPlanner respetan modalidad

- `CapacityPlanner::plan()`: filtra `materias` para incluir solo `PRESENCIAL` en el cómputo de cuotas. Las no presenciales no entran en el ILP.
- `HorarioSolver::solve()`: `tasks` solo contiene presenciales.
- `cap.totalMinutos` (semanal) → solo presenciales.
- `cap.huerfanos` → solo presenciales.
- Backend tests para verificar que materias FCT/NO_REGULAR no aparecen en placements ni en huerfanos.

**Esfuerzo**: ~0.5 sesión.

### Fase 4 — Banner anual y chip lateral respetan modalidad

- Banner anual (Fase 3b): `curriculumMin` sigue sumando TODAS (presencial + no presencial). `plannedMin` sigue como está. La diferencia entre ambos es lo que cuenta a currículo total.
- Banner CapacityPlanner: el cap usa solo presenciales. Si Σ presenciales ≤ jornada → verde silencioso. Si supera → amarillo "redistribuye" o rojo "extender".
- ModuleChip lateral (Fase 5 sub-A): solo muestra materias PRESENCIAL en el panel arrastrable. Las no presenciales NO se pueden colocar (no tiene sentido). Pero su carga sí cuenta al banner anual.
- Una vista nueva en el panel lateral: "Otras horas curriculares" con la lista de materias no presenciales y sus h/sem informativas. Sin drag-and-drop.

**Esfuerzo**: ~0.75 sesión.

### Fase 5 — UI para editar modalidad

- `/admin/materias`: columna "Modalidad" en la tabla con select por fila (`PRESENCIAL`/`FCT`/`NO_REGULAR`/`AUTONOMA`). Edita `Materia.modalidad` directamente.
- `/admin/imparticiones`: columna "Modalidad (override)" con select que permite override per-grupo (NULL = "heredar de Materia"). Edita `Imparticion.modalidad`.
- Modal "Materias del rango" (Fase 4 PeriodoLectivo): añadir badge de modalidad junto al nombre de la materia. Las no presenciales se muestran "deshabilitadas" para minutos override (no tiene sentido editar minutos de FCT por rango).

**Esfuerzo**: ~0.5 sesión.

### Fase 6 — PDF con sección "Otras horas curriculares"

- `HorarioPdfController::horarioGrupo()`: tras las páginas por rango (multi-página actual), añadir una página final con tabla de modalidades no presenciales:
  ```
  Otras horas curriculares (no regulares)
  ─────────────────────────────────────────
  Proyecto Intermodular DAM         (NO_REGULAR)  72 h totales
  Horas de libre configuración      (NO_REGULAR) 108 h totales
  Formación en Centros de Trabajo   (FCT)        370 h totales
  ```
- Twig `pdf/horario.html.twig`: nueva sub-sección al final del template multi-página.

**Esfuerzo**: ~0.5 sesión.

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
