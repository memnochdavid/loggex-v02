# Hoja de ruta: clases compartidas entre grupos

> **Estado**: 🔴 ROADMAP — sin código. **Diferido para producción** (2026-05-08).
> **Branch sugerida**: `feat/clases-compartidas` cuando se aborde.
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

### Fase E — Vistas dependientes (PDF, vista profe, asistencia)
- PDF profesor / `/horarios`: detectar gemelos y mostrar UNA lección con
  etiqueta combinada "Programación · 1º DAW + 1º DAM".
- Pase de lista: si la lección es compartida, mostrar alumnos de ambos
  grupos en un solo registro con dos columnas o tabs.
- Calificaciones: sin cambios — siguen siendo por grupo.

### Total estimado
- Fase A: 1 sesión.
- Fase B: 0.5 sesiones (migración trivial + service básico).
- Fase C: 0.5 sesiones.
- Fase D: 1 sesión.
- Fase E: 1.5 sesiones (afecta PDF + asistencia).
- **Total: 4-4.5 sesiones**.

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
