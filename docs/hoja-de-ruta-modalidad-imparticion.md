# Modalidad de imparticion — separar placement vs currículo

> **Status (2026-04-28)**: 🔴 sin empezar. Plan acordado tras detectar la limitación con 2º DAM (33h/sem currículo no cabe en jornada 30h presencial porque incluye 5h "no regulares" de Proyecto Intermodular + Horas de libre configuración que el modelo trata como presenciales). Cierra el ciclo de soporte LOMLOE FP completo + abre la puerta a ESO/Bach/Uni que también necesitan distinguir modalidades.

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

Aplica también a:
- **ESO/Bach LOMLOE**: optativas, refuerzo, asignaturas con horas de autonomía.
- **Universidad**: ECTS no traducen 1:1 a horas semanales; hay teoría/práctica/laboratorio/autoaprendizaje.
- **FP especialización**: módulos de proyecto y FCT.

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

| ID | Decisión | Recomendación inicial |
|---|---|---|
| D-A | ¿Modalidad en `Materia`, en `Imparticion`, o ambas? | Default en `Materia`, override en `Imparticion` (mismo patrón que minutos). |
| D-B | ¿Default si NULL? | `PRESENCIAL` (preserva comportamiento actual: todas las materias del catálogo existente serían presenciales tras la migración). |
| D-C | ¿La modalidad afecta al solver SOLO o también a la rejilla visual? | El solver no las coloca; la rejilla no las muestra. Tienen una zona aparte (lista) con sus horas. |
| D-D | ¿En el PDF? | Una sección al final "Otras horas curriculares (no regulares)" con las materias no PRESENCIALES y sus h/curso. NO una página por modalidad. |
| D-E | ¿La modalidad puede cambiar a mitad de curso? | No. El override de `Imparticion` se fija al crear el grupo. Si el centro cambia de criterio, replantea para el siguiente curso. |
| D-F | ¿Necesitamos sub-modalidades (PRESENCIAL_TEORIA / PRESENCIAL_LAB para Universidad)? | No en Fase 1. Puerta abierta para Universidad cuando llegue. |

### Cerradas

(ninguna todavía)

---

## 3. Fases de implementación

### Fase 1 — Modelo + migración (sin UI)

- Crear enum `App\Entity\Modalidad` (PRESENCIAL/FCT/NO_REGULAR/AUTONOMA).
- Añadir `Materia.modalidad` (default PRESENCIAL, NOT NULL).
- Añadir `Imparticion.modalidad` nullable (NULL = hereda Materia).
- Migration `Version20260429xxxxxx` con backfill: todas las materias y imparticiones existentes → PRESENCIAL.
- Helper `Imparticion::getEffectiveModalidad()` que devuelve override o default Materia.
- API Platform: exponer `modalidad` en serialization groups de Materia y Imparticion.

**Esfuerzo**: ~0.5 sesión.

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

### 2026-04-28 — Doc creado

Plan diseñado tras detectar limitación con 2º DAM AN (33h/sem currículo, déficit 5.5-6h vs jornada 30h presencial). Causa raíz: el modelo trata todas las imparticiones como `PRESENCIAL`, saturando slots con materias que NO son clases semanales regulares (Proyecto Intermodular, Horas de libre configuración).

Decidido modelo enum `Modalidad` con default `Materia.modalidad` + override `Imparticion.modalidad` (mismo patrón que minutos). 6 fases (~3 sesiones total). D-A a D-F pendientes de cerrar antes de Fase 1.

Cross-ref con: `hoja-de-ruta-periodos-lectivos.md` (Fase 5 cerrada antes; el cap anual cross-rango ya está y solo necesita filtrar por modalidad), `catalogo-oficial.md` (donde vivirá la documentación del enum + carga catalogo).
