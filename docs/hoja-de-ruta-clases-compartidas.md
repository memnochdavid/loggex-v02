# Hoja de ruta: clases compartidas entre grupos

> **Estado**: 🟢 CASI CERRADA — Fases A + B + C + D + **E ✅ Done (2026-05-13)**.
> Quedan diferidas solo la detección automática 🟢/🟡/🔴 con CTAs y el
> refactor N:M `imparticion_grupo` (opción C, evolución mayor sin demanda actual).
> Fase E entrega vistas combinadas: TimeTable web + PDF horario personal +
> pase de lista compartido. Sin cambios en calificaciones (siguen por grupo
> por diseño).
> **Origen**: conversación 2026-05-06 sesión 4 tras cierre Fase B modelo-semanal.
>
> ### ⚠️ MVP cubierto por otro doc
>
> El **caso operativo mínimo** (1º DAW + 1º DAM compartiendo materias para que el solver no genere falsos conflictos) está cubierto por **`hoja-de-ruta-materias-multi-itinerario.md`** (creado 2026-05-08). Allí se ataca el problema con:
>
> - `Materia` ↔ `Itinerario` ManyToMany (tabla puente, drop columna `materia.itinerario_id`).
> - Solver consciente: misma `materia.id` + misma franja → no conflicto del profesor.
> - UX manual: el admin borra las materias duplicadas de un itinerario y asigna las del otro.
>
> Este doc (`clases-compartidas.md`) queda **pendiente para producción** con todo lo grande:
>
> - `Horario.gemeloId` + sincronización persistente de ediciones (mover en DAW mueve en DAM).
> - Detección automática 🟢/🟡/🔴 con CTA "Replicar horario de Grupo Y".
> - Solver coordinado entre hermanos (`Configurar curso óptimo` corre una vez para ambos).
> - PDF combinado "Programación · 1º DAW + 1º DAM" + pase de lista compartido + asistencia agrupada.
> - Refactor N:M `imparticion_grupo` (opción C, evolución mayor).
>
> Cuándo retomar: cuando llegue fricción real con clientes en producción que demuestre que el flujo manual no escala.

## Problema

En FP LOMLOE (RD 405/2023), los **primeros cursos** de ciclos hermanos suelen
compartir el currículo entero. Caso real Escuela Arte Granada 2025-26:

- 1º DAW (Desarrollo Aplicaciones Web)
- 1º DAM (Desarrollo Aplicaciones Multiplataforma)

Ambos comparten 7 códigos oficiales: 0483 SI, 0484 BD, 0485 PR, 0373 LM,
0487 ED + AN-IPE-I + AN-DIG. Mismas horas legales, mismas cuotas semanales,
y en la práctica del centro **se imparten físicamente en la misma aula con
el mismo profesor a ambos grupos a la vez**.

Hoy el sistema modela cada grupo como entidad independiente con sus propias
imparticiones y horarios. Resultado:
- El profesor aparece "ocupado" en 1º DAW cuando se intenta colocar en 1º DAM
  → el solver bloquea con falso conflicto.
- La agenda del profesor suma las horas dos veces (16 h/sem en lugar de 8).
- El PDF muestra dos lecciones distintas en el mismo slot/aula.
- El pase de lista es independiente por grupo aunque físicamente sea una clase.

## Decisión clave: detección automática vs marca explícita

### Opción A — Heurística pura por similitud de currículo (sin schema)

Trigger: al abrir `/admin/horarios` con un grupo de horario vacío (o `aulaPorDefecto`
recién configurada), el sistema busca otros grupos del mismo centro/curso/turno
con currículo **100% idéntico** y horario ya configurado, y propone replicar.

Detección:
```
Grupo_A "100% idéntico" a Grupo_B sii:
  Σ { codigoOficial, minutosSemanales, horasTotales, profesor.id }
    en A == en B  para todas las imparticiones vivas.
```

Acción al confirmar:
- Replica todos los `PeriodoLectivo` de A en B (PLANTILLA + SEMANAs con sus PLIs).
- Replica todos los `Horario` placements de A en B, apuntando a las imparticiones
  correspondientes (mismo código materia → imparticion del grupo destino).
- En el solver, modificar `HorarioSolverBinPacking::buildParallelBusy` para
  excluir el profesor cuando coincide (profesor, aula, horario día/hora,
  código materia) con un horario propio → es la misma clase, no conflicto.

**Simétrico**: la detección funciona en cualquier orden. Si DAW se configura
primero, DAM se ofrece como espejo. Si DAM se configura primero, DAW se
ofrece como espejo. Para 3+ grupos hermanos (ciclos con varios grupos por
curso), la heurística los enlaza progresivamente.

**Limitación**: una vez duplicado el horario, **A y B son entidades
independientes en BD**. Si el admin después mueve un placement en uno, el
otro NO se actualiza. Las clases que físicamente eran la misma se
desincronizan silenciosamente — la heurística "100% idéntico currículo"
sigue siendo true mientras los horarios ya divergen.

### Opción B — Heurística + columna `Horario.gemeloId` (1 mini-migración)

Mismo trigger y misma detección que A. Diferencia: al duplicar, los `Horario`
clonados se enlazan vía `gemeloId` (FK self-referencing).

```sql
ALTER TABLE horario ADD gemelo_id INT NULL,
  ADD CONSTRAINT FK_horario_gemelo FOREIGN KEY (gemelo_id)
    REFERENCES horario(id) ON DELETE SET NULL;
```

Comportamiento:
- Mover/editar un `Horario` propaga el cambio a su gemelo.
- Borrar un `Horario` rompe el enlace pero deja el gemelo independiente
  (decisión: ¿borrar gemelo también? Decisión abierta D-1 abajo).
- El solver lee la columna directamente para saber "estos dos son la misma
  clase" sin recurrir a heurística cada vez.

Coste: una migración trivial (1 columna nullable + FK), nada más estructural.

### Opción C — Tabla puente `imparticion_grupo` (N:M completo)

Refactor estructural: una `Imparticion` apunta a varios `Grupo` vía tabla
puente. Mismo profesor + materia + horario sirve a N grupos.

```
Imparticion #X
  ├─ profesor: Pérez
  ├─ materia: Programación (código 0485)
  └─ tabla `imparticion_grupo`: [Grupo 1º DAW, Grupo 1º DAM]
```

Refactor afecta a:
- `Imparticion` schema + migración de datos.
- Todos los queries/services que filtran por `imparticion.grupo` (decenas).
- `CapacityPlanner`, `CurriculumDistributor`, solvers — leer cuotas por grupo
  destino.
- Asistencia, calificaciones, notificaciones — entidades que apuntan a
  Imparticion siguen valiendo, pero la pertenencia a grupo cambia de modelo.

Esfuerzo: 3-5 sesiones, similar al refactor modelo-semanal recién cerrado.

## Recomendación

**Opción B** (heurística + 1 columna gemelo) — equilibrio coste/robustez:
- Sin refactor masivo.
- Sincronización persistente ante ediciones (lo que falta a A).
- 1 migración trivial.
- Cubre todos los casos visibles para producción.

C queda anotada como evolución futura si llega un caso real donde N:M
explícito sea necesario (ej. ciclos donde la imparticion tiene profesores
que rotan entre grupos sin un patrón de "compartido fijo").

## Decisiones abiertas

- ~~**D-1**: al borrar un `Horario` con gemelo, ¿se borra también el gemelo?~~
  **Cerrada 2026-05-08 — propagación SIEMPRE, sin opt-out**. Las clases
  gemelas se tratan como el mismo grupo en todos los aspectos
  operativos: cualquier mutación de una se aplica a la otra
  automáticamente (mover, borrar, crear placement, crear incidencia
  ExcepcionHorario, cambio de profesor en imparticion vía sincronización
  de profes compartidos…). No existe "desvincular gemelos" ni "borrar
  solo uno". Razón: una clase física no se puede cancelar para un grupo
  y mantener para el otro — son la misma. Si el admin necesita
  divergencia genuina, primero rompe la hermandad cambiando la
  materia/imparticion subyacente. Esto simplifica Fase D significativamente
  (sin diálogos por mutación, comportamiento uniforme).

- **D-2**: ¿qué pasa si el admin edita la imparticion subyacente (cambia
  profesor, materia, aula) y la nueva configuración rompe el "100% idéntico"?
  Sugerencia: el `gemeloId` persiste igual (la decisión de compartir clase
  fue del admin, no del sistema). Si quiere romper, hay un botón
  "desvincular".

- **D-3**: ¿permitir `gemeloId` para grupos de N>2 (ciclos con 3 grupos
  hermanos)? Implementación: `gemeloId` apunta a UN gemelo, pero al
  consultar "todos los gemelos" recorrer la cadena
  `A.gemelo=B, B.gemelo=C` → A,B,C son hermanos. O usar una tabla
  separada `horario_grupo_compartido` con `id` de grupo de hermandad.
  Decisión abierta según volumen de casos reales.

- **D-4**: nivel de "currículo 100% idéntico" para la detección automática:
  ¿solo materias y cuotas, o también profesores? Sugerencia: tres niveles
  (🟢 idéntico todo, 🟡 idéntico materias/cuotas pero profes parcial,
  🔴 materias o cuotas distintas). El nivel 🟡 dispara "sugerencia de
  unificación" con UI para asignar el mismo profe a las materias
  desviadas. Sin profe asignado, materia se trata como discrepancia 🟡.

- **D-5**: ¿el `gemeloId` se propaga a `PeriodoLectivoImparticion` y `Aula`
  también? Sugerencia: NO. Solo `Horario` (los placements son lo único que
  físicamente se duplica entre grupos). Los PLIs son por grupo y reflejan
  cuotas anuales independientes.

## Plan de fases (canon)

### Fase A — Detección + UI (sin schema)
- Algoritmo de comparación currículo entre grupos del centro con **3 niveles**
  de coincidencia:
  - **🟢 Idéntico**: mismas materias (códigos LOMLOE), mismas cuotas
    (min/sem + horas_totales), mismos profesores → fusión inmediata
    propuesta sin intervención.
  - **🟡 Casi idéntico**: mismas materias y cuotas, **profesores parcialmente
    distintos** (ej. 6 de 7 materias coinciden en profesor; SI tiene profe
    distinto). El sistema **sugiere unificación**: "para fusionar 1º DAM
    con 1º DAW, asigna el profesor X (que da SI en 1º DAW) también a SI
    en 1º DAM, o asigna el profesor Y (que da SI en 1º DAM) a 1º DAW".
    Botón "Asignar profesor compartido" que abre modal de selección
    materia por materia. Tras los ajustes, la coincidencia pasa a 🟢
    y se ofrece la fusión.
  - **🔴 Distintos**: materias o cuotas no coinciden. Sin sugerencia
    automática (los grupos no son hermanos LOMLOE).
- Banner en `/admin/horarios` cuando un grupo vacío detecta hermano lleno
  con coincidencia 🟢 o 🟡:
  - 🟢 → "Replicar horario de Grupo_Y aquí (clase compartida)".
  - 🟡 → "Grupo_Y comparte 6 de 7 materias. Asigna el profesor de SI
    para fusionarlos." + lista detallada de discrepancias y CTA para
    resolverlas.
- CTA "Replicar horario de Grupo_Y" con confirm modal explicando
  "se duplicarán PLs + placements; clases compartirán aula y profesor".

### Fase B — Migración + persistencia
- Migración: `ALTER TABLE horario ADD gemelo_id INT NULL` + FK self-ref.
- Replicación marca `gemeloId` en cada Horario clonado (apunta al original).
- Endpoint `/api/horarios/{id}/desvincular-gemelo` para romper enlace
  manualmente.

### Fase C — Solver consciente de hermandad
- `HorarioSolverBinPacking::buildParallelBusy` lee `Horario.gemeloId`:
  cuando un horario de otro grupo es gemelo de uno propio, NO añadir el
  profe a busy.
- `Configurar curso óptimo` coordinado: si un grupo tiene hermanos
  configurados, ofrecer "replicar plan" en lugar de generar uno nuevo.

### Fase D — Sincronización de ediciones
- Service `HorarioGemeloSync`: cualquier PATCH/DELETE/POST de Horario con
  gemeloId aplica el espejo en el gemelo.
- Mover un placement en 1º DAW lo mueve automáticamente en 1º DAM.
- Toast informativo "Cambio replicado en clase gemela 1º DAM".

### Fase E — Vistas dependientes (PDF, vista profe, asistencia) ✅ Done (2026-05-13)
- ✅ **TimeTable `/horarios`** (vista web del profe): `GetMyScheduleController`
  agrupa los placements con mismo conjunto de hermandad (`getGemeloRoot()`) en
  UN event con array `gruposCompartidos[]`. Frontend pinta etiqueta combinada
  "1º DAW + 1º DAM" en card desktop, mobile y modal de detalle.
- ✅ **PDF horario personal**: `HorarioPdfController` ya tenía dedup paralelo
  por `moduloId|profesor|aula|horaInicio|horaFin|excepcionTipo` desde la Fase B
  fix del 12-may (cerró el caso 1º DAW + 1º DAM tras la unificación de la Fase A
  M:N). El separador se unificó de " · " a " + " para coincidir con el TimeTable.
- ✅ **Pase de lista**: `AsistenciaController.getSheet` recolecta imps gemelas
  vía `findImparticionesGemelas()` y mete alumnos de todos los grupos hermanos
  en una sola hoja. Cada alumno trae su `imparticionId` natural; `saveBatch`
  acepta override por asistencia para registrar contra la imp correcta. UI:
  chip con grupo en cada fila cuando la hoja es compartida.
- Calificaciones: sin cambios — siguen siendo por grupo (decisión de diseño).

### Total estimado
- Fase A: 1 sesión.
- Fase B: 0.5 sesiones (migración trivial + service básico).
- Fase C: 0.5 sesiones.
- Fase D: 1 sesión.
- Fase E: 1.5 sesiones (afecta PDF + asistencia).
- **Total: 4-4.5 sesiones**.

## Modelo de hermandad — conjuntos independientes

Cada placement con `gemelo_id != NULL` pertenece a UN conjunto de
hermandad cuyo raíz es siempre un placement con `gemelo = NULL`. Los
distintos conjuntos son **disjuntos**: las mutaciones que Fase D
propagará afectan solo al conjunto del placement tocado, nunca cruzan
fronteras.

Casos canónicos:

- **Pareja**: `A (raíz) ← B`. Hermandad `{A, B}`.
- **Trío**: `A ← B, A ← C`. Hermandad `{A, B, C}`.
- **Independencia**: `A ← B` y `E ← F`. Conjuntos `{A, B}` y `{E, F}`
  no se hablan.
- **Ampliación post-hoc**: si tienes `{A, B}` y haces `Adjuntar B → C`,
  la canonicalización (`getGemeloRoot()`) hace `C.gemelo = A` directo
  (NO encadena por B). Resultado: `{A, B, C}` con A como único raíz.
- **Cadenas inexistentes**: por construcción del controller, NO existen
  `A ← B ← C` (tres niveles). Siempre planos: raíz + N hojas.

**Caso edge — soft-delete del raíz**:

Si se soft-deleta un raíz que tenía copias vivas, las copias quedan
con `gemelo_id` apuntando a un placement con `deleted=1`. La FK
`ON DELETE SET NULL` solo dispara en hard-delete; el patrón soft-delete
del proyecto NO. Funcionalmente las copias quedan huérfanas: cualquier
query que filtre `gemelo.deleted=0` no las traerá como hermanas.

**Mitigación (Fase D)**: por D-1 cerrada ("se tratan como mismo grupo
en todos los aspectos"), el listener Doctrine debe propagar el
soft-delete del raíz a las copias automáticamente. Sin esto, escenarios
como "Adjuntar C → A cuando A ya era raíz de `{A, B}` con cleanFirst"
dejan B huérfano. Fase D lo cubrirá; hasta entonces se trata de un
caso operativo poco frecuente (re-adjuntar un raíz ya unificado).

## Casos límite a tener en cuenta

1. **Aula `NULL` en imparticion**. Hoy `Imparticion.aula` es nullable y se
   hereda de `Grupo.aulaPorDefecto`. Si DAW hereda Aula 4 y DAM hereda
   Aula 6, la heurística "100% idéntico" debe usar **el aula efectiva**
   (resolución de la cadena), no el campo crudo. Si los grupos heredan
   aulas distintas, NO son hermanos automáticamente — el admin tiene que
   alinear `Grupo.aulaPorDefecto` o ajustar `Imparticion.aula` explícito
   en uno de ellos.

2. **Cambio de profesor a mitad de curso**. Si en febrero el profe titular
   se va de baja y se sustituye en uno solo de los grupos hermanos, la
   heurística los desligaría (ya no son 100% idénticos). Con `gemeloId`
   persistente, el enlace sobrevive — el admin decide si re-replicar o
   desvincular.

3. **Solver `Configurar curso óptimo` para hermanos**. Si dos grupos están
   enlazados como gemelos y el admin ejecuta el solver óptimo en UNO,
   ¿se replica al otro automáticamente? Sugerencia: SÍ — si están enlazados,
   el solver corre una vez y el resultado se aplica a ambos.

4. **Solver para grupo nuevo cuando ya hay hermano configurado**. Caso del
   admin que abre 1º DAM con horario vacío y tiene 1º DAW lleno. Antes de
   ofrecer "Configurar curso óptimo", el banner de hermandad ofrece
   "Replicar horario de 1º DAW" — debería ser la opción por defecto y la
   más rápida. Si el admin la rechaza, el solver óptimo corre normal.

5. **Paseo de lista combinado en clase compartida**. Lección de Programación
   con 25 alumnos de 1º DAW + 22 alumnos de 1º DAM = 47 alumnos en aula.
   El profe pasa lista UNA vez. Implementación: ampliar `AsistenciaModal`
   para que detecte gemelos y muestre alumnos agrupados por grupo con
   columnas distintas (más limpio que mezclarlos).

## Relación con otros docs

- **`hoja-de-ruta-modelo-semanal.md`**: las clases compartidas funcionan
  igual sobre PLANTILLA y SEMANAs. La replicación duplica todos los PLs
  del grupo origen.
- **`hoja-de-ruta-jornadas-recreos.md`**: requiere que ambos grupos tengan
  el mismo turno (mañana o tarde) — un grupo de tarde no puede compartir
  con uno de mañana aunque tengan el mismo currículo.
- **`hoja-de-ruta-modalidad-imparticion.md`**: sin impacto — la modalidad
  se mantiene por imparticion.
- **`docs/INDEX.md`**: añadir entrada en §"🔴 Atadas pero sin código" tras
  cerrar Fase B modelo-semanal.

## Convenciones del doc (sigue patrón loggex)

- Decisiones tomadas se cierran con `D-N` (motivo + alternativas
  descartadas).
- Bitácora de implementación al final, con entradas por sesión.
- Estados: 🟢 Done | 🟡 Parcial | 🔴 Pendiente | 🪦 Superseded.

## Bitácora de implementación

### 2026-05-08 — Fase A MVP simplificado: "Adjuntar a grupo existente"

Tras cerrar el MVP M:N + solver consciente (commit `6dd6e7c`), el usuario
propone implementar el botón explícito que clona placements en lugar de
depender del solver. La sesión adopta una versión **MVP simplificada** de
Fase A: sin detección automática 🟢/🟡/🔴 ni banner, sólo el flujo
manual con preview + clonado. Las funcionalidades grandes restantes
(Fases B/C/D/E del plan canon) siguen diferidas.

**Decisiones de la sesión** (alcance + UX):

| Pregunta | Resolución | Razón |
|---|---|---|
| Alcance Fase A | MVP simplificado (sin detección automática) | Mantener foco; la detección 🟢/🟡/🔴 es UX, no estructural. |
| Destino con PLs vivos | Auto-limpiar destino con doble confirm | Evita fricción de "ve a Limpiar antes". El warning rojo del modal lo deja explícito. |
| Materia origen sin par en destino | Skip silencioso + reportar en stats finales | El admin asigna esas materias al itinerario destino y vuelve a adjuntar si quiere unificar. Bloqueo total daría demasiada fricción. |

**Backend**:
- `AdjuntarGrupoController.php` (nuevo, ~310 líneas) con dos endpoints:
  - `GET /api/v1/grupos/{destinoId}/adjuntar-preview/{origenId}`: stats sin
    tocar BD (PLs/PLIs/horarios a clonar, materias compartidas vs
    omitidas, profe mismatch, si destino tiene PLs vivos).
  - `POST /api/v1/grupos/{destinoId}/adjuntar-a/{origenId}` con body
    `{cleanFirst: bool}`: clona PLs+PLIs+horarios. Si cleanFirst=true,
    soft-delete previo del destino dentro de la misma transacción. Si
    false y destino tiene PLs vivos → 409 Conflict.
  - Lógica del clonado en dos pasadas: PLANTILLAs primero (para que
    SEMANAs puedan apuntar a `plantillaBase` ya persistida), luego
    SEMANAs. Mapeo `materia.id → imparticion(destino)` en `buildImpMap`.
  - Stats devueltos: `plsCreados`, `plisCreados`, `horariosCreados`,
    `materiasOmitidas[]`, `profeMismatch[]`, `destinoLimpiado`.
  - Validaciones: ROLE_ADMIN+, mismo centro, no auto-adjuntar, destino
    debe tener imparticiones.

**Frontend**:
- `AdjuntarGrupoModal.jsx` (nuevo, ~250 líneas):
  - AsyncSearchSelect del grupo origen filtrado al centro del destino.
  - Preview automático tras elegir origen (debounce vía useEffect con
    cancelación de fetches obsoletos).
  - 4 banners temáticos por tono: ok (verde resumen), info (omitidas),
    warn (profe mismatch), error (destino con PLs).
  - Submit pasa `cleanFirst` derivado del preview.
  - Tras éxito: 3 toasts (success + omitidas + profeMismatch) y callback
    `onSuccess` para que el caller refresque su estado.
- `HorariosEditor.jsx`:
  - Import `AdjuntarGrupoModal` + icono `Copy`.
  - Estado `adjuntarModalOpen`.
  - Item nuevo en menú "Acciones del curso" entre "Curso óptimo" y
    "Crear Rangos Recomendados".
  - Render del modal al final con `onSuccess` que llama a
    `refetchPlsForGroup` y limpia caches `state` + `capacityByGrupo` del
    grupo activo.
- `Crud.module.css`: 5 clases nuevas para banners (`adjuntarPreview`,
  `adjuntarBanner` + 4 tonos vía `data-tone`). 100% temáticas.
- i18n × 5: 2 claves nuevas en `scheduleEditor` (`attachToGroupAction`,
  `attachToGroupTitle`) + bloque nuevo `adjuntarGrupo` con 17 claves
  (es, en, ca, gl, eu).

**Validación E2E**: ✅ **Pasada** (2026-05-08). Adjuntado 1º DAW → 1º DAM:
toast verde "Horario adjuntado: 61 placements, 35 PLIs en 5 rangos",
rejilla DAM pinta inmediatamente con franjas coincidentes con DAW
(coincidencia 100% **garantizada** — a diferencia del MVP M:N donde
dependía del solver).

**Bugs detectados durante el smoke test y corregidos en línea**:
1. **Soft-delete con `\DateTimeImmutable` rompía Doctrine**: el código
   inicial pasaba `setDeletedAt(new \DateTimeImmutable())`. La columna
   `deletedAt` está mapeada como `type: 'datetime'` (mutable), no
   `datetime_immutable` → Doctrine rechaza el cast con
   "Could not convert PHP value of type DateTimeImmutable to type
   DateTimeType". Fix: el `setDeleted(true)` del `SoftDeletableTrait` ya
   pone `\DateTime()` mutable automáticamente. Eliminadas las llamadas
   redundantes a `setDeletedAt`.
2. **Rejilla queda vacía tras adjuntar pese a clonado OK**: el flujo
   `onSuccess` llamaba a `refetchPlsForGroup` pero el effect ~595 que
   re-elige PL activo tiene guard `if (plByGrupo[gid] !== undefined)
   return`. Al refetchear, el guard pasa y el branch de selección por
   defecto NO entra → selectedPlId queda apuntando al PL viejo
   soft-deleted → el effect ~679 que carga horarios del PL activo no
   los encuentra → rejilla vacía. Fix: `onSuccess` reescrito para hacer
   todo el flujo explícito en vez de delegar en effects: refetch directo
   de PLs, `selectActivePl()` manual, `setSelectedPlByGrupo` al activo,
   limpiar `state[gid_*]`, `capacityByGrupo[gid_*]`, borrar entrada de
   `allHorariosByGroup[gid]` para forzar el effect ~619 a re-fetch.
   Resultado: la rejilla pinta inmediatamente sin F5 manual.

**Diferido para sesiones futuras** (queda en este doc Fases B-E):
- Fase B: `Horario.gemeloId` + sincronización persistente entre
  hermanos.
- Fase C: solver consciente de `gemeloId` (refinamiento del MVP M:N
  actual).
- Fase D: sincronización de ediciones (mover en DAW mueve en DAM).
- Fase E: vistas combinadas (PDF, asistencia, pase de lista).
- Detección automática 🟢/🟡/🔴 + banner contextual + modal "Asignar
  profesor compartido". UX-only, no estructural.

### 2026-05-08 (continuación 2) — Fase B + C ✅ Done

Tras cerrar Fase A y validar E2E, en la misma sesión se aborda Fase B
(infraestructura para Fase D) y Fase C (refinamiento del solver). D-1
cerrada justo antes (propagación SIEMPRE, sin opt-out) simplifica el
enfoque.

**Fase B — `Horario.gemeloId`**:

- Migración `Version20260508220000`: `ALTER TABLE horario ADD gemelo_id INT NULL`
  + índice `IDX_HORARIO_GEMELO` + FK self-ref `FK_HORARIO_GEMELO`
  con `ON DELETE SET NULL`. Si se borra el horario raíz, las copias
  dejan de ser gemelas pero sobreviven (decisión defensiva: la lógica
  de "borrar uno borra todos" la gestiona la Fase D a nivel aplicación,
  no FK).
- Entidad `Horario`: nueva propiedad `?Horario $gemelo` ManyToOne self-ref,
  helpers `getGemelo` / `setGemelo` + helper de conveniencia
  `getGemeloRoot()` que devuelve el raíz canónico (gemelo o $this si es
  el original). Serializado solo en `horario:read` (no `horario:write`):
  el cliente NO debería poder reescribir gemelos manualmente — la
  hermandad la gestiona el servidor desde Adjuntar y la sincronización.
- `AdjuntarGrupoController`: en el bucle de clonado de horarios, set
  `gemelo = origen.getGemeloRoot()`. **Canonicalización (D-3 cerrada)**:
  el gemelo apunta SIEMPRE al raíz, nunca a otra copia. Si el origen ya
  era una copia previa, el clon nuevo apunta al raíz directamente — sin
  cadenas. Esto mantiene `WHERE id = X OR gemelo_id = X` como query
  barata para "todos los hermanos de X" sin recursión.

**Fase C — solver consciente de gemeloId**:

Análisis: el solver actual (commit `6dd6e7c`) ya gestiona "clase
compartida" en `buildParallelBusy` + `isProfBusyOther` vía coincidencia
de `materia.id`. Como todo placement clonado por Fase A tiene la misma
materia que su gemelo (por construcción del clonado, `impMapDest`
mapea por `materia.id`), añadir `gemeloId` al shape de `parallelBusy`
sería estrictamente redundante hoy. La función real de `gemeloId` es
soportar la **propagación de mutaciones** en Fase D (mover/borrar/
cancelar uno aplica al gemelo), no la decisión del solver al colocar.

**Decisión**: Fase C cerrada sin código adicional. El comportamiento
del solver ya cumple el plan original ("no contar al profe como busy
si el slot tiene un horario gemelo del candidato") por la ruta
`materia.id`. Si en el futuro aparece un caso edge donde dos
placements gemelos tengan materias distintas (no posible vía Adjuntar
por construcción; podría pasar con manipulación manual), se añadiría
una rama secundaria al helper `isProfBusyOther` que aceptara también
match por `gemeloId`.

**Validación E2E pendiente**: pulsar "Adjuntar a grupo existente" tras
aplicar la migración debería marcar `gemelo_id` en cada placement
clonado del destino. Verificable con SQL:
```sql
SELECT id, gemelo_id FROM horario
WHERE imparticion_id IN (SELECT id FROM imparticion WHERE grupo_id = 3)
  AND deleted = 0;
```
Esperado: 61 filas, todas con `gemelo_id NOT NULL` apuntando a las
filas correspondientes del grupo 1.

**Próxima ruta natural**: Fase D — service `HorarioGemeloSync` que
escuche eventos Doctrine de `Horario` (postPersist/postUpdate/preRemove)
y propague al gemelo. También `ExcepcionHorario`: cuando se crea una
incidencia sobre un horario con gemelo, duplicarla al gemelo (decisión
2026-05-08 al cerrar D-1: "se tratan como mismo grupo en todos los
aspectos"). Una sesión completa.

### 2026-05-09 — Fase D ✅ Done

Implementado `HorarioGemeloSyncSubscriber` (un único listener Doctrine
con tres eventos: `preUpdate`, `postPersist`, `postFlush`) que cierra el
contrato de D-1 ("clases gemelas se tratan como el mismo grupo en todos
los aspectos operativos"). Sin migración nueva — Fase B ya añadió
`Horario.gemelo_id` y la canonicalización al raíz.

**Archivo nuevo**: `backend/src/EventSubscriber/HorarioGemeloSyncSubscriber.php`
(~225 líneas).

**Qué propaga**:

| Evento | Trigger | Acción |
|---|---|---|
| `preUpdate(Horario)` | Cambio en `diaSemana`, `horaInicio`, `horaFin`, `aula` | Copia el cambio a TODOS los hermanos del conjunto en el mismo flush vía `recomputeSingleEntityChangeSet`. |
| `preUpdate(Horario)` | Soft-delete (`deleted: false → true`) | `setDeleted(true)` en cada hermano. Necesario porque `ON DELETE SET NULL` solo dispara en hard-delete; el patrón soft-delete del proyecto exige propagación a nivel aplicación (mitigación documentada en §"Modelo de hermandad" del doc). |
| `postPersist(ExcepcionHorario)` + `postFlush` | Crear excepción sobre Horario con gemelos | Encolar en postPersist + procesar batch en postFlush. Para cada hermano, crear copia de la excepción (mismo tipo, fecha, motivo, observaciones, estado, solicitante, aprobador, fecha resolución) apuntando al Horario hermano correspondiente. Comparten `intercambioGrupoId` UUID para que `IntercambioGrupoCascadeSubscriber` cascadee aprobaciones/rechazos atómicamente. |

**Qué NO propaga** (deliberado):

- `imparticion` y `periodoLectivo` del Horario: cada gemelo apunta a su
  propia imparticion del grupo correspondiente (mapeo establecido en
  `AdjuntarGrupoController`). Cambiar la imparticion de un placement
  rompe efectivamente la hermandad y debe hacerse por par.
- POST de Horario nuevo (placement nuevo en grupo con hermano): no
  existe modelo de "grupos hermanos", solo de "placements hermanos".
  La replicación inicial la hace `AdjuntarGrupoController`. Si admin
  añade un placement suelto, debe re-Adjuntar para extender la
  hermandad.
- DELETE (hard) y reactivación (`deleted: true → false`) de
  `ExcepcionHorario`: casos operativos infrecuentes; no implementado.

**Decisiones tomadas en la sesión**:

| Pregunta | Resolución | Razón |
|---|---|---|
| ¿Generar UUID grupoId también para CANCELADO/SUSTITUCION/EVENTO_ESPECIAL gemelados? | Sí, se reusa `intercambioGrupoId` aunque conceptualmente no sea "intercambio" | Evita modificar `IntercambioGrupoCascadeSubscriber`; el campo funciona genéricamente como "grupo de excepciones que cambian de estado juntas". Coste cero, máximo reuso. |
| ¿postPersist directo vs cola en postFlush? | Cola | Persistir nuevas entidades en postPersist es válido pero requiere otro flush; la cola simplifica deduplicación cuando hay varias caras del mismo intercambio en el mismo batch (caso real `IntercambioController` que persiste cara A + N caras B en una sola operación). |
| ¿Cómo evitar duplicar copias en re-flushes? | `findOneBy(horarioBase, fechaConcreta, intercambioGrupoId, deleted=false)` antes de cada `persist` | Idempotente. El flush interno del propio subscriber dispara más postPersist + postFlush; el guard `$processing` cierra la cascada, pero la idempotencia es cinturón de seguridad para casos edge. |
| ¿Propagar también cambios de `imparticion` o `periodoLectivo`? | NO | Cada gemelo apunta a su imparticion del grupo destino (mapeo del Adjuntar). Propagar rompería la coherencia. |

**Patrón anti-loop**: variable `$processing` estática, idéntica al patrón
de `IntercambioGrupoCascadeSubscriber` y `NotificationDispatchSubscriber`.
El `flush()` interno del postFlush dispara nuevos postPersist (de las
copias) y un postFlush adicional, pero el guard cierra la cascada.

**Interacción con otros subscribers** (verificada en diseño):

- `IntercambioGrupoCascadeSubscriber`: complementario. HorarioGemeloSync
  crea las N caras gemeladas con mismo `intercambioGrupoId`;
  IntercambioGrupoCascade cascadea estados entre ellas. Sin loop entre
  ambos: HorarioGemeloSync solo persiste copias en postFlush;
  IntercambioGrupoCascade solo escucha preUpdate en cambios de `estado`.
- `NotificationDispatchSubscriber`: cada copia gemela disparará su
  propia notificación (notify a profe titular + alumnos del grupo
  hermano). Para clases físicamente compartidas, el profe titular
  suele ser el MISMO en ambos grupos (por construcción del Adjuntar) →
  recibirá 2 notificaciones idénticas. Aceptable como trade-off de
  Fase D inicial; la deduplicación de notificaciones es UX no
  estructural y se puede atacar en una ronda de pulido si molesta.
- `LivePublishSubscriber`: cada Horario y cada ExcepcionHorario
  modificada/creada publican en sus topics Mercure automáticamente
  (sin config extra; los atributos `#[LivePublish]` ya existen). La
  rejilla de ambos grupos refrescará en tiempo real.
- `HorarioPeriodoLectivoSubscriber`: solo prePersist. No interfiere con
  los hermanos sincronizados (que ya tienen `periodoLectivo` desde su
  creación inicial vía Adjuntar).
- `CacheInvalidationSubscriber`: invalida cache de schedule personal
  para profe + alumnos del grupo. Las copias gemelas tienen su propio
  grupo → invalidan también para los alumnos del grupo hermano.
  Funciona correctamente sin cambios.

**Acción manual del usuario para activar**:

```bash
docker compose exec backend php bin/console cache:clear
```

Sin migración (FK + columna ya existían desde Fase B).

**Validación E2E pendiente** (siguiente sesión):

1. Adjuntar 1º DAW → 1º DAM (Acciones del curso → Adjuntar a grupo
   existente). Confirmar que la rejilla de DAM pinta los placements
   espejo y que en BD aparecen los `gemelo_id` apuntando al raíz DAW.
2. **Mover un placement en DAW**: drag & drop a otro slot. Tras
   Guardar, comprobar que el placement gemelo en DAM se ha movido al
   mismo slot automáticamente. Mismo test invertido (mover en DAM,
   ver replicación en DAW).
3. **Cambiar aula**: editar `aula` en un placement DAW desde el
   modal. Confirmar que el gemelo DAM toma la nueva aula.
4. **Borrar un placement** (icono papelera): el gemelo desaparece
   también de la rejilla del otro grupo.
5. **Crear excepción CANCELADO** sobre un placement DAW (click derecho
   → Solicitar cambio → cancelado): verificar en BD que aparecen 2
   filas en `excepcion_horario`, una con `horario_base_id` del DAW y
   otra con el del DAM, mismo `intercambio_grupo_id`. Aprobar la del
   DAW; comprobar que la del DAM pasa a APROBADA automáticamente
   (cascade del IntercambioGrupoCascadeSubscriber).
6. **Crear excepción INTERCAMBIO** sobre un placement DAW: además de
   las caras A + B normales, deben aparecer A' (gemela de A en DAM) y
   posiblemente B' si el horario B también tiene gemelos. Todas con
   mismo `intercambio_grupo_id`.

Si cualquier paso falla, el primer sospechoso es el guard `$processing`
o la idempotencia (mirar logs `var/log/dev.log` por excepciones de
Doctrine en postFlush).

**Diferido a Fase E** (sesiones futuras):
- PDF combinado "Programación · 1º DAW + 1º DAM" cuando hay gemelos.
- Pase de lista (`AsistenciaModal`) detecta gemelos y muestra alumnos
  agrupados por grupo en columnas.
- Vista profesor `/horarios` muestra UNA lección con etiqueta
  combinada en lugar de dos placements en el mismo slot.
- Detección automática 🟢/🟡/🔴 + banner contextual + modal "Asignar
  profesor compartido". UX-only sobre infraestructura ya presente.

### 2026-05-09 (continuación) — Fix Fase D: `preUpdate` → `onFlush`

Validación E2E inicial reveló bug silencioso en el listener: aunque el
subscriber estaba registrado (`debug:container` lo confirmó) y la query
`loadSiblings` devolvía los hermanos correctamente, el UPDATE del gemelo
nunca se ejecutaba. Reproducción mínima: usuario hace "curso óptimo" en
DAW → guarda → adjunta DAM ← DAW (61 placements clonados con
`gemelo_id` correcto) → vacía viernes en DAW → guarda. En BD: los DAW
del viernes pasan a `deleted=1` pero los DAM gemelos siguen `deleted=0`.

**Causa raíz**: orden de los hooks de Doctrine en `flush()`:

1. `computeChangeSets()` — calcula qué entidades insertar/actualizar/borrar.
2. Para cada entidad scheduled: dispatch `preUpdate`.
3. Ejecuta INSERT/UPDATE/DELETE.

`recomputeSingleEntityChangeSet()` SOLO afecta a entidades que ya
estaban scheduled en el paso 1. Mi listener cargaba los siblings con
un `createQueryBuilder` nuevo (no estaban scheduled) → el recompute se
silenciaba completamente y los UPDATEs nunca se generaban.

`IntercambioGrupoCascadeSubscriber` usa el mismo patrón `preUpdate +
recompute` y SÍ funciona porque cuando admin aprueba un grupo entero,
TODAS las caras del intercambio están scheduled desde el paso 1
(Doctrine las ve cambiar `estado` en el changeset original).

**Fix aplicado**: cambiar listener de `preUpdate(Horario)` a `onFlush`.
`onFlush` es el evento canónico de Doctrine para cascade modifications:
itera `getScheduledEntityUpdates()`, y `computeChangeSet()` (no
`recompute`) sí registra entidades nuevas en el UoW para esta misma
transacción.

Cambios concretos en `HorarioGemeloSyncSubscriber.php`:

- `#[AsDoctrineListener(event: Events::preUpdate)]` →
  `#[AsDoctrineListener(event: Events::onFlush)]`.
- Método `preUpdate(PreUpdateEventArgs)` → `onFlush(OnFlushEventArgs)`.
- Recolección en dos pasos: primero iterar
  `$uow->getScheduledEntityUpdates()` y guardar tuplas
  `[entity, physical_changes, isSoftDelete]`; luego procesar siblings.
  Evita modificar el UoW mientras iteramos su lista de scheduled.
- Detección de cambios via `$uow->getEntityChangeSet($entity)` (devuelve
  `[oldValue, newValue]` por campo) en lugar de
  `$args->hasChangedField()` / `$args->getNewValue()`.
- Skip de siblings que ya están scheduled (`isScheduledForUpdate` o
  `isScheduledForDelete`): caso "vaciar conjunto entero" donde A y B
  vienen ambos en el batch — al procesar A no debemos pisar el cambio
  pendiente de B.
- `computeChangeSet()` en lugar de `recomputeSingleEntityChangeSet()`:
  los siblings no estaban en el changeset, hay que añadirlos.

**Lección para el futuro**: si necesitas modificar entidades adicionales
durante un flush, usa **`onFlush`**, no `preUpdate`. `preUpdate` solo
sirve para mutar el campo de la entidad cuyo evento dispara (raro), no
para cascadear a entidades hermanas. La regla mnemotécnica:

| Necesitas… | Evento |
|---|---|
| Reaccionar al UPDATE de UNA entidad | `preUpdate` / `postUpdate` |
| Cascadear cambios a OTRAS entidades en el mismo flush | `onFlush` |
| Persistir entidades NUEVAS tras un flush | `postFlush` con cola |

`IntercambioGrupoCascadeSubscriber` "funciona" en `preUpdate` porque
los miembros del grupo de intercambio normalmente cambian de estado
juntos en la misma operación de admin (todos scheduled desde el
principio). Cuando esa premisa no se cumple — escenario edge —
también fallaría silenciosamente. **Anotado como deuda técnica
opcional**: migrar `IntercambioGrupoCascadeSubscriber` a `onFlush`
para evitar el caso edge si aparece.

**Validación E2E ✅ Pasada (2026-05-09 06:35 UTC)**. Tras
`cache:clear`, escenario limpio: curso óptimo en 1º DAW → Adjuntar
1º DAM ← 1º DAW (61 placements gemelados, query confirmó "DAM vivos
con gemelo a DAW vivo = 61, sin gemelo = 0") → vaciar viernes en DAW
→ Guardar. Log de Doctrine:

```
UPDATE horario SET deleted=1 WHERE id=6256  ← DAW ED 08:30
UPDATE horario SET deleted=1 WHERE id=6257  ← DAW SI 09:30
UPDATE horario SET deleted=1 WHERE id=6317  ← DAM ED 08:30 (propagado)
UPDATE horario SET deleted=1 WHERE id=6318  ← DAM SI 09:30 (propagado)
```

Los 4 con `deleted_at = 2026-05-09 06:35:18` exacto (mismo flush).

**Anécdota del diagnóstico** (para evitar perder tiempo en futuras
sesiones): durante la validación inicial salieron varios falsos
positivos confusos:
- En el primer intento los placements borrados eran nuevos creados
  tras un Adjuntar previo y NO tenían `gemelo_id`. Comportamiento
  correcto del listener (no hay hermano que propagar) pero parecía
  bug.
- En el segundo intento el modal `AdjuntarGrupoModal` se abrió
  estando 1º DAW activo; al elegir DAW como origen dio 422 silencioso
  (`destinoId == origenId`) y el Adjuntar nunca llegó a clonar nada.
  La rejilla DAM seguía vacía (sin gemelos) pero parecía que el bug
  era de propagación.
- El bug REAL solo se descubrió tras un escenario completamente
  limpio que SÍ generó gemelos vivos: era el `preUpdate` vs `onFlush`
  descrito arriba.

**Mejora de UX recomendada (no bloqueante)**: el modal Adjuntar
debería filtrar el grupo de destino del selector de origen y/o mostrar
un toast de error cuando el preview devuelve 422 (ahora se silencia).
Anotado en `docs/INDEX.md` como ítem opcional para Fase E.

**Mejora de UX detectada en la validación**: tras Guardar en un grupo
con placements gemelados, el `HorariosEditor` refrescaba solo el grupo
activo. Al navegar al gemelo en el strip se veía el estado viejo y
hacía falta F5. Razón: el editor está excluido del sistema live
updates por diseño (el `pendingTx` local colisionaría con refetch
externo, ver `docs/hoja-de-ruta-redis-workers.md` §"Excluido por
diseño"). Mi listener sí persiste correctamente en la misma
transacción (validado E2E) y `LivePublishSubscriber` sí emite el
evento Mercure para el gemelo, pero el editor ignora ese topic.

**✅ Fix aplicado 2026-05-09**:

- **Backend** (`HorarioBatchController::batch`): tras el commit, una
  query SQL única resuelve los grupos hermanos vivos de los Horarios
  tocados y devuelve `affectedGroups: [int, int, ...]` en la
  respuesta JSON. Excluye el grupo del propio batch. Método nuevo
  `resolveAffectedGemeloGroups()` con SQL plano sobre `horario` +
  `imparticion` que cubre raíz↔hojas (`gemelo_id = root` OR
  `id = root`).
- **Frontend** (`HorariosEditor.jsx`):
  - Helper nuevo `invalidateCachesForGroups(groupIds)` que limpia
    `allHorariosByGroup[gid]`, `state[gid_*]` y
    `capacityByGrupo[gid_*]` para los IDs pasados.
  - `performBatchSave`: llama al helper con `data.affectedGroups`
    tras éxito.
  - `applyPendingTxForGrupo`: acumula `affectedGroups` de cada batch
    interno en un Set y los devuelve en la response;
    `performBatchSaveAllDirty` invalida sus caches tras el éxito de
    la tx.
  - El tercer call site del batch (autoSave del solver "Curso
    óptimo") no necesita el fix: solo emite CREATEs sobre placements
    nuevos sin gemelo (la replicación inicial la hace
    `AdjuntarGrupoController`); el listener de Fase D no propaga
    creates por construcción.

Resultado esperado: tras vaciar/mover placements gemelados en DAW y
guardar, al cambiar a DAM en el strip de grupos el editor fetchea
desde BD automáticamente (sus caches están invalidadas) y ve los
cambios propagados sin necesidad de F5.

Sin riesgo de colisión con `pendingTx`: las invalidaciones aplican a
los grupos hermanos NO activos. Si el usuario tenía un draft sin
guardar en uno de esos grupos, su `state[gid_plId]` se borra — pero
ese caso es raro (el editor mantiene `pendingTx` por grupo y solo es
relevante para el grupo activo durante la edición). Anotado como
edge case poco frecuente.

### 2026-05-13 — Fase E ✅ Done (vistas combinadas TimeTable + PDF + asistencia)

Cerrado en una sesión sin precedente de fricción real — el usuario quería
atacarla "antes de que aparezca". Bloque a bloque:

**1) Backend agrupador — `GetMyScheduleController::computeSchedule`**

Refactor del loop de events a un map `eventsByRootId` indexado por el id del
raíz de hermandad (`$h->getGemeloRoot()->getId()`). Para horarios sin gemelo
la clave es el propio id (no fusiona). Para horarios con gemelo, todos los
del conjunto caen en el mismo bucket: el primero crea el event, los siguientes
solo añaden su grupo al array `gruposCompartidos[]` y hacen `continue`.

Estructura del campo nuevo en cada event:
```json
"gruposCompartidos": [
  {"id": 1, "nombre": "1º DAW", "abreviatura": "DAW", "curso": 1, "imparticionId": 4},
  {"id": 2, "nombre": "1º DAM", "abreviatura": "DAM", "curso": 1, "imparticionId": 7}
]
```

Casos cubiertos:
- **Alumno**: solo carga su grupo vía matrícula → array con 1 entrada. El
  frontend lo trata como antes (etiqueta singular).
- **Profe que imparte ambos**: la query del profe carga las 2 imparticiones →
  el map fusiona → UN solo event con 2 grupos. La rejilla pinta UNA card.
- **Profe que imparte solo uno** (caso edge, no se da en EAG): array con 1
  entrada del único grupo que carga.

Los `loadOverrideAssignedEvents` (sintéticos por excepciones) no se tocaron:
una excepción aprobada actúa sobre UN bloque concreto, no sobre el conjunto
de hermandad (la cascade de gemelos en `HorarioGemeloSyncSubscriber` duplica
la excepción a la cara hermana, así que cada hermano recibe la suya).

⚠️ **Cache**: el controller cachea 5 min por user. Tras desplegar hay que
hacer `docker compose exec backend php bin/console cache:pool:clear cache.app`
(o esperar) para que los clientes vean el shape nuevo.

**2) Frontend TimeTable — etiqueta combinada**

Helper nuevo `formatGruposLabel(event)` que devuelve "1º DAW + 1º DAM" cuando
`gruposCompartidos.length > 1`, o el formato singular previo si no. Aplicado
en 3 sitios: `.eventGroupSmall` (card desktop), `.mobileEventSubtitle` (móvil),
y modal de detalle del placement (que ahora usa `i18n: timetable.groupsLabel`
plural y renderiza lista cuando hay >1).

i18n × 5 idiomas: clave nueva `timetable.groupsLabel` (Grupos / Groups / Grups /
Taldeak / Grupos) — añadida en los DOS bloques `timetable` que tiene cada
locale (uno en `dashboard.*`/`home.*` y otro en `timetable.*`).

La dedup vertical existente (línea ~278, fusión de bloques contiguos misma
materia+grupo+aula) sigue funcionando: el `event.grupo` retenido es el del
primer horario del bucket, así que la comparación se mantiene consistente
dentro de un mismo conjunto de hermandad.

**3) PDF horario personal — separador unificado**

`HorarioPdfController::buildScheduleContext` ya había sido extendido en la
sesión del 12-may (Fase B fix) con dedup paralelo por
`moduloId|profesor|aula|horaInicio|horaFin|excepcionTipo` que concatenaba
`grupoLabel` en `gruposLabel`. El twig (`templates/pdf/horario.html.twig:332`)
ya renderiza `ev.gruposLabel` cuando `isPersonal`. Sin cambios estructurales
necesarios. Solo se unificó el separador `·` → `+` para coincidir con el
TimeTable web (consistencia visual entre PDF descargado y rejilla en pantalla).

**4) Pase de lista compartido — `AsistenciaController`**

- **`getSheet`**: nuevo helper `findImparticionesGemelas(Imparticion, EM)`
  que vuelve `[$imp, $impHermana1, ...]` resolviendo el conjunto de hermandad
  vía `Horario.gemelo_id` (raíz↔hojas, DQL `WHERE h.id IN (:roots) OR
  h.gemelo IN (:roots)`). Carga matrículas (vivas) de TODOS los grupos
  involucrados; cada alumno conserva su `imparticionId` natural (la de SU
  grupo) en el DTO de respuesta.
- **Forma de la respuesta**: array flat `[{...}]` si solo hay 1 grupo (compat
  con clientes viejos). Objeto `{alumnos, gruposCompartidos}` si hay gemelos.
  Frontend usa `Array.isArray(data)` como discriminador.
- **`saveBatch`**: acepta opcionalmente `imparticionId` por asistencia.
  Si presente y distinto del global, se persiste contra esa imp (alumno
  gemelo → imp correcta). Si ausente, fallback al global (compat).
- **Frontend**:
  - `AsistenciaModal.jsx`: nuevo estado `gruposCompartidos`, parser tolerante
    a ambos shapes, helper `grupoChip(alumno)` que pinta un badge themed
    (CSS module `.grupoChip` con `color-mix` sobre `--color-primary-500`)
    junto al nombre del alumno SOLO cuando la hoja es compartida.
  - `TimeTable.jsx::handleSaveAttendance`: incluye `imparticionId` por
    asistencia si el alumno lo trae.

**Decisión de diseño relevante (Opción B sobre A)**: la asistencia del alumno
se registra contra SU imparticion, no contra la del titular. Esto preserva
la integridad del summary del alumno (`AsistenciaController::getAlumnoSummary`
itera matrículas → imparticiones del alumno; sin esta decisión, el alumno
DAM tendría asistencias contra imp DAW y su summary no las encontraría) y
mantiene las medias por grupo separadas en las calificaciones (que siguen
siendo por grupo). El profe sigue viendo una sola hoja; el backend reparte.

**Bug encontrado en validación E2E (mismo día, fix in-line)**:
Primera versión de `findImparticionesGemelas` usaba DQL
`SELECT DISTINCT i FROM Horario h JOIN h.imparticion i WHERE ...`. Doctrine
falló con `QueryException: Cannot select entity through identification
variables without choosing at least one root entity alias` — DQL exige que
la entidad seleccionada sea la raíz del FROM, no un alias obtenido por JOIN.
Reescrito a `SELECT DISTINCT i FROM Imparticion i JOIN i.horarios h WHERE
(h.id IN (:roots) OR h.gemelo IN (:roots)) AND h.deleted = false`, que aprovecha
la relación inversa `OneToMany Imparticion::horarios` (mappedBy='imparticion').
Síntoma: `getSheet` devolvía 500 → AsistenciaModal aparecía vacío sin error
visible en UI (solo `console.error`). Cobertura defensiva mejorable: añadir
toast cuando el response no es OK.

**Validación E2E pendiente**:
1. Profe (Alberto) que imparte 1º DAW + 1º DAM gemelos: ir a `/horarios`,
   confirmar que cada bloque compartido aparece UNA vez con etiqueta
   "1º DAW + 1º DAM". (Requiere `cache:pool:clear cache.app` tras desplegar.)
2. Click en bloque → modal de detalle muestra los 2 grupos en una lista.
3. Click "Pasar lista" → tabla muestra alumnos de ambos grupos con chip
   con el grupo. Marcar asistencia, guardar.
4. `SELECT alumno_id, imparticion_id, estado FROM asistencia WHERE
   fecha='YYYY-MM-DD' AND hora='HH:MM:SS';` → cada asistencia contra la
   imp del grupo del alumno (no la del bloque clicado).
5. PDF horario personal del profe → bloque pinta "1º DAW + 1º DAM" con
   separador " + ".
6. Página `/mis-faltas` del alumno DAM → debe mostrar la falta/presencia
   correctamente atribuida a su materia/imparticion del DAM.

**Diferidos** (sin demanda actual, anotados como mejoras opcionales):
- Detección automática 🟢/🟡/🔴 + banner contextual + modal "Asignar
  profesor compartido" (UX-only, no estructural).
- Refactor N:M `imparticion_grupo` (opción C del análisis original) — la
  evolución mayor que sustituye `gemelo_id` por relación nativa. Solo cuando
  haya fricción real con clientes (a hoy, gemelo_id cubre los casos vistos
  en EAG sin colisiones).
