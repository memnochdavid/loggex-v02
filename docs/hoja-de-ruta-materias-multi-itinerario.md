# Materias compartidas entre itinerarios (N:M)

> **Status (2026-05-08)**: 🟢 **MVP cerrado y validado E2E.**
> **Branch sugerida**: `feat/materia-multi-itinerario` (sesión actual sin commit aún — esperando OK del usuario).
> **Origen**: conversación 2026-05-08 tras cierre validación E2E intercambio C.3. El usuario explora cómo unificar 1º DAW + 1º DAM (currículo idéntico LOMLOE en EAG) sin acumular deuda en producción.

## ⚡ Snapshot para retomar

### Qué resuelve

Hoy una `Materia` pertenece a un único `Itinerario` (FK `materia.itinerario_id` NOT NULL). Cuando dos itinerarios LOMLOE comparten currículo en un curso (caso real: 1º DAW + 1º DAM en EAG, 8 materias comunes con código_oficial idéntico), la BD las duplica: 8 filas en DAW + 8 filas en DAM. La duplicación se propaga a `Imparticion` (cada grupo apunta a su copia), por lo que el solver ve "profe X ocupado en grupo 1" cuando lo intenta colocar en grupo 3, aunque sea **la misma clase física**.

Este roadmap permite que **una `Materia` pertenezca a varios `Itinerario`** (ManyToMany vía tabla puente). Combinado con un cambio mínimo en el solver (no contar como ocupación si la materia colocada coincide con la candidata), desbloquea el flujo manual del admin: crear DAM, borrar las materias de 1º duplicadas, asignar las de 1º DAW al itinerario DAM.

### Lo que NO se aborda aquí (deuda diferida)

Todo lo grande que cubre `hoja-de-ruta-clases-compartidas.md` queda explícitamente fuera del MVP:

- Detección automática 🟢/🟡/🔴 de hermandad entre grupos.
- `Horario.gemeloId` + sincronización de ediciones.
- PDF combinado, asistencia agrupada, pase de lista compartido.
- Refactor N:M `imparticion_grupo`.

Esos puntos quedan documentados en `clases-compartidas.md` como evolución post-producción. La pregunta de si se justifican depende de la fricción real del flujo manual con clientes reales.

### Próxima acción al retomar

Arrancar Fase única (ver §5). Sin sub-fases — es un refactor compacto.

---

## 1. Decisiones cerradas (2026-05-08)

| ID | Decisión | Resolución | Razón |
|---|---|---|---|
| **D-1** | ¿Mantener `materia.itinerario_id` como itinerario primario nullable? | **DROP la columna** | Fuente única de verdad en la tabla puente. Doble representación = deuda silenciosa si divergen. |
| **D-2** | Criterio del solver para tratar dos placements como "misma clase compartida" | **Misma `materia.id` + misma franja (día + slot)** | Suficiente para flujo manual descrito. Evita complejidad de aula efectiva. Si admin asigna profes distintos por error, la deuda la lleva el admin (la materia que comparten es literalmente la misma fila). |
| **D-3** | UX para añadir una materia ya existente a un itinerario | **Multi-select en form de Materia + CTA "Añadir materia existente" en vista del itinerario** | Doble vía: edición desde Materia y desde Itinerario. Más natural para el flujo "borras las de 1º DAM y añades las de 1º DAW". |
| **D-4** | Edición de Materia compartida: ¿propaga o split? | **Propaga por defecto, sin botón split en MVP** | KISS. Si el admin necesita divergencia entre itinerarios (ej. horas distintas), retira la materia del itinerario y crea otra. Split automático queda como mejora futura. |

## 2. Decisiones abiertas (no bloquean MVP)

- **D-A** ¿Qué pasa al borrar (soft-delete) una `Materia` compartida? Sugerencia: el soft-delete pone `deleted=1` en `materia` y deja la tabla puente intacta — la materia desaparece de los listados de todos los itinerarios. El admin puede restaurar. Si quiere "quitarla de un itinerario solo", usa el modal del itinerario.
- **D-B** ¿Y el rol `ROLE_SUPERADMIN` cuando navega catálogos de varios centros? No afecta — la tabla puente es centro-agnóstica; los filtros de centro se aplican vía `materia.itinerarios[].centro`. CurrentUserExtension cambia la query (ver §5 punto 3).
- **D-C** ¿Restringir que dos itinerarios de **centros distintos** compartan una `Materia`? Sugerencia: SÍ, restricción a nivel aplicación (no schema). La materia es del centro; un itinerario de otro centro no puede asignársela. Validación en el endpoint PATCH del itinerario y en el form de Materia.

## 3. Modelo propuesto

### Schema

```sql
CREATE TABLE materia_itinerario (
  materia_id INT NOT NULL,
  itinerario_id INT NOT NULL,
  PRIMARY KEY (materia_id, itinerario_id),
  CONSTRAINT FK_mi_materia FOREIGN KEY (materia_id) REFERENCES materia(id) ON DELETE CASCADE,
  CONSTRAINT FK_mi_itinerario FOREIGN KEY (itinerario_id) REFERENCES itinerario(id) ON DELETE CASCADE,
  INDEX IDX_mi_itinerario (itinerario_id)
);

INSERT INTO materia_itinerario (materia_id, itinerario_id)
  SELECT id, itinerario_id FROM materia WHERE itinerario_id IS NOT NULL;

ALTER TABLE materia DROP FOREIGN KEY FK_materia_itinerario;
ALTER TABLE materia DROP COLUMN itinerario_id;
```

### Entidad Materia

```php
#[ORM\ManyToMany(targetEntity: Itinerario::class, inversedBy: 'materias')]
#[ORM\JoinTable(name: 'materia_itinerario')]
private Collection $itinerarios;

public function getItinerarios(): Collection { return $this->itinerarios; }
public function addItinerario(Itinerario $i): self { ... }
public function removeItinerario(Itinerario $i): self { ... }
```

### Entidad Itinerario

```php
#[ORM\ManyToMany(targetEntity: Materia::class, mappedBy: 'itinerarios')]
private Collection $materias;
// addMateria/removeMateria reescritos para operar sobre la colección via owning side.
```

## 4. Impacto en queries existentes

### Crítico — `CurrentUserExtension::applyToCollection`

Hoy filtra Materia por centro vía `JOIN m.itinerario c WHERE c.centro = :ctx`. Tras el refactor:

```php
// Antes:
$qb->join("$root.itinerario", 'c')->andWhere('c.centro = :ctx');

// Después:
$qb->leftJoin("$root.itinerarios", 'i')
   ->leftJoin('i.centro', 'c')
   ->andWhere('c.centro = :ctx OR c.id = :ctx_id')
   ->groupBy("$root.id");
```

Equivalente más limpio con subquery EXISTS si se prefiere evitar el GROUP BY.

### LivePublish topic

Hoy `Materia` declara topic `/admin/centros/{itinerario.centro.id}/materias`. Tras refactor el placeholder simple `itinerario.centro.id` no funciona (multivalor). Opciones:

- (a) Topic plano `/admin/materias` y filtrar en el cliente por centro (pero rompe aislamiento entre centros).
- (b) Calcular topics dinámicos en `LivePublishSubscriber` cuando el atributo del placeholder es una colección: emitir N eventos, uno por cada centro distinto de los itinerarios. **Recomendado** — encaja con el modelo y mantiene aislamiento.
- (c) Topic por itinerario: `/admin/itinerarios/{id}/materias` + suscripción múltiple en el cliente. Más invasivo en frontend.

Decisión: **opción (b)** en el subscriber (~30 líneas de cambio).

## 5. Fase única (canon)

1. **Migración Doctrine** `Version2026MMDDhhmmss`: crear puente, INSERT desde columna existente, DROP columna.
2. **Refactor entidades**: `Materia.itinerarios` ManyToMany + getters/setters; `Itinerario.addMateria/removeMateria` actualizados.
3. **`CurrentUserExtension`**: cambio de JOIN a leftJoin + groupBy.
4. **`LivePublishSubscriber`**: soporte de placeholders sobre colecciones (emit N events).
5. **`CatalogoMaterializationController`**: línea 160, `setItinerario → addItinerario`. Lógica de reuso: si ya existe en el centro una Materia con el mismo `(codigo_oficial, curso, minutos_semanales, horas_totales)`, en lugar de crear nueva, asignar el itinerario destino a la existente. Idempotente.
6. **`GrupoResyncCcaaController`**: revisar `findBy(['itinerario' => ...])` y adaptar.
7. **API Platform serialización**: `Materia` expone `itinerarios` como `iri[]` en `materia:read` y `materia:write`. Filtros `SearchFilter` siguen funcionando vía join implícito de la colección.
8. **Frontend `Materias.jsx`**:
   - `formData.itinerario` (string) → `formData.itinerarios` (string[]).
   - AsyncSearchSelect single → multi (chips themed).
   - Columna "Itinerarios" con chips themed (variable CSS, no hardcoded).
   - i18n × 5 con claves nuevas.
9. **Frontend vista detalle de itinerario**: localizar componente que lista las materias del itinerario (probablemente `CatalogoItinerarioDetail.jsx` o vista similar bajo `/admin/itinerarios/[id]`). Añadir CTA "Añadir materia existente" → modal con AsyncSearchSelect sobre `/api/materias?centro=X` excluyendo las ya asignadas. Submit: PATCH materia añadiendo el itinerario al array. i18n × 5.
10. **Solver `HorarioSolverBinPacking::buildParallelBusy`**: añadir excepción "si el placement existente coincide en `materia.id` y franja con la candidata, no contar al profesor como ocupado". Análogo en `HorarioSolverIterativo` si tiene método similar.
11. **Smoke test E2E manual** (centro EAG):
    - Estado inicial: 1º DAW (grupo 1) tiene 8 materias 1º DAW (ids 1-5, 38-40); 1º DAM (grupo 3) tiene 8 materias 1º DAM (ids 45-49, 61-63).
    - Acción: en `/admin/itinerarios/[DAM]` borrar las 8 materias 1º DAM (soft delete deja vivos los 2º). En `/admin/itinerarios/[DAM]` pulsar "Añadir materia existente" y asignar las 8 materias 1º DAW.
    - Asignar profes en `/admin/imparticiones` para las imparticiones de 1º DAM (ahora apuntando a materias compartidas).
    - Solver en grupo 1 (1º DAW): coloca placements normalmente.
    - Solver en grupo 3 (1º DAM): los placements donde profe coincide con grupo 1 + misma materia se aceptan en mismas franjas (no falso conflicto).

### Total estimado

- ~1.5 sesiones (refactor compacto, sin sub-fases reales).

## 6. Casos límite a tener en cuenta

1. **Materia con minutosSemanales o horasTotales distintos entre itinerarios**: en el flujo manual no debería pasar (el admin asigna la misma fila a ambos). Si ocurriera por edición posterior, se propaga a todos. La opción "split" queda como deuda futura.
2. **Itinerario con override de jornada distinto** (caso EAG: DAW jornada 3 mañanas, DAM override jornada 6 tardes): la materia compartida funciona igual — la jornada vive en `Itinerario` (o en `Grupo.jornadaTipoOverride`), no en `Materia`. Cada grupo coloca placements en su propio horario.
3. **Catálogo refresh** (`app:catalogo:refresh`): si el catálogo nacional cambia las horas de una materia LOMLOE compartida, se aplica a la materia (única fila) → todos los itinerarios la ven actualizada. Comportamiento correcto.
4. **Borrado en cascada de itinerario**: hoy un soft-delete de Itinerario no elimina Materias asociadas (las deja vivas en otro itinerario si es compartida). El soft-delete cascade en BD se queda igual; las filas de la tabla puente se borran físicamente en hard-delete (FK ON DELETE CASCADE), pero el patrón soft-delete del proyecto es suficiente: marcar `Itinerario.deleted=1` y filtrar en query.
5. **Importación masiva (CSV/seeds)**: futuras herramientas de seed que esperen `materia.itinerario_id` deben actualizarse a la API ManyToMany. Hoy no hay seeds activos en este flujo.

## 7. Relación con otros docs

- **`hoja-de-ruta-clases-compartidas.md`**: este MVP cubre el caso operativo mínimo. Las funcionalidades grandes (gemeloId, sincronización, PDF combinado, asistencia compartida) quedan en ese doc como evolución para producción.
- **`hoja-de-ruta-rename-fp-neutral.md`**: cero impacto. Nombres de propiedades neutros se mantienen.
- **`hoja-de-ruta-curriculum-ccaa.md`**: complementario. El overlay autonómico modifica horas en `Materia`; tras el refactor, ese cambio se aplica a la materia compartida.
- **`hoja-de-ruta-modelo-semanal.md`**: cero impacto. PL + Horario son ortogonales.
- **`docs/INDEX.md`**: añadir entrada en §"🔴 Atadas pero sin código" o promover a 🟡 cuando arranque.

## 8. Bitácora de implementación

### 2026-05-08 — MVP cerrado y validado E2E

Sesión completa: refactor + fixes preexistentes + validación E2E. Commit pendiente; working tree con cambios.

**Backend (refactor M:N)**:
- Migración `Version20260508200000`: tabla puente `materia_itinerario(materia_id, itinerario_id)` PK compuesta + 2 FKs ON DELETE CASCADE + INSERT desde `materia.itinerario_id` + DROP FK/index/columna. `down()` lossy (toma MIN(itinerario_id) por materia).
- `Materia` ManyToOne → ManyToMany inversedBy='materias'. Helpers `addItinerario` / `removeItinerario`. `Itinerario.materias` pasa a inverse `mappedBy='itinerarios'`. `addMateria/removeMateria` delegan al owning side.
- Filtros API Platform (SearchFilter `itinerarios.*`), `OrderFilter` retira `itinerario.nombre` (sin sentido en M:N).
- `LivePublish` topic `{itinerario.centro.id}` → `{itinerarios[].centro.id}`. Sintaxis nueva en `LivePublishSubscriber::expand()`: detecta `{X[].Y}`, itera la colección y emite N topics deduplicados.
- `CurrentUserExtension` filtro Materia: JOIN simple → subquery `EXISTS` con `materia_itinerario`+`itinerario.centro` (evita duplicar filas y no rompe paginación).
- `CatalogoMaterializationController:160`: `setItinerario` → `addItinerario`.
- `GrupoResyncCcaaController:64`: `findBy(['itinerario'=>...])` → QueryBuilder con `innerJoin('m.itinerarios', 'i')`. Línea 149: `setItinerario` → `addItinerario`.
- API Platform `Materia`: añadida operación `Patch` (necesaria para `MateriasItinerarioModal` que envía `application/merge-patch+json`).
- **Solver consciente** (`HorarioSolver` + `HorarioSolverBinPacking`): `buildParallelBusy` cambia shape de `[$key]=>[pid,...]` a `[$key][$pid]=>[mid1,mid2,...]`. Helper nuevo `isProfBusyOther($parallelBusy, $key, $pid, $candidateMid)` decide conflicto real (otra materia) vs clase compartida (misma materia). Sustituye `in_array($pid, $parallelBusy[$key])` en los 3 sitios de chequeo.

**Frontend**:
- `Materias.jsx`: `formData.itinerario` (string) → `formData.itinerarios` (string[]). AsyncSearchSelect single + chips themed (X para quitar) + botón "Añadir itinerario…". Validación: ≥1 itinerario para submit. Listado: columna "Itinerarios" con chips. Filtro URL `&itinerario=` → `&itinerarios=`. `searchField itinerario.nombre` → `itinerarios.nombre`.
- **`MateriasItinerarioModal.jsx` (nuevo, ~210 líneas)**: gestiona M:N desde la vista de Itinerario. Lista materias asignadas con chips + botón X para desvincular. CTA "Añadir materia existente" con AsyncSearchSelect filtrado a materias del centro. PATCH `application/merge-patch+json` sobre `/api/materias/{id}` con array `itinerarios` completo. Confirma con `useConfirm` antes de quitar (warning si era el único itinerario).
- `Itinerarios.jsx`: import del modal nuevo + estado `materiasItinerario` + nuevo botón `BookOpen` entre Editar y Eliminar en columna acciones + render del modal al final.
- `Crud.module.css`: clases nuevas `itinerariosChipList`, `itinerarioChip`, `itinerarioChipRemove`, `itinerariosEmpty`. 100% temáticas (variables CSS, sin literales).
- i18n × 5 (es, en, ca, gl, eu): claves `materias.cyclesLabel`, `cyclesAddPlaceholder`, `cyclesHint`, `itinerariosEmpty`, `errorItinerariosRequired`, `itinerarios.manageMaterias`, `materiasItinerario.{title,addLabel,addPlaceholder,addHint,addSuccess,addErrorCtx,alreadyAssigned,assignedLabel,empty,loadError,confirmRemove,confirmLastItinerario,removeSuccess,removeErrorCtx}`.

**Bugs preexistentes detectados y arreglados durante la sesión**:
1. **`HorariosEditor.jsx:520` — Maximum update depth exceeded**. Cuando `jornadaId` es null, el effect llamaba a `setJornadasPorId({...prev, [key]: null})` aunque la marca ya existía → nuevo objeto cada render → dependencia cambia → effect re-corre → loop. Antes no se disparaba porque la BD tenía datos pero tras la limpieza apareció. Fix: guard `key in jornadasPorId` antes del set.
2. **`Materias.jsx` form PUT borra `horasTotales` silenciosamente**. El form nunca tuvo `horasTotales` en su state. Cada PUT (full replace en API Platform) ponía el campo a NULL. Bug histórico que se manifestó cuando el user editó las 9 materias 1º DAW durante el smoke test → 192/256/96/etc se evaporaron. Fix: añadir `horasTotales` al `formData` (lectura de `materia.horasTotales` en `handleOpenModal`, propagación automática vía `...rest` en `handleSubmit`). El form NO expone el campo al usuario; solo lo arrastra round-trip.
3. **`DataTable.jsx` — columna Acciones hideable por localStorage stale**. El filtro `visibleColumns` no aplicaba `isActionsCol`, así que un set persistido stale podía ocultar la columna entera. Fix defensivo: `visibleColumns = columns.filter(c => isActionsCol(c) || !hiddenIds.includes(columnId(c)))`.

**Operaciones SQL ejecutadas en BD durante la sesión** (estado actual centro EAG):
- Limpieza selectiva del itinerario DAM y descendientes: 1791 filas borradas en `backend/scripts/cleanup_dam_2026_05_08.sql`. Conserva DAW intacto + materias compartidas.
- Restauración manual de `horas_totales` de las 9 materias 1º DAW (ids 1-6, 38-40) con valores BOJA AN 2024.
- Creación manual de 7 imparticiones para grupo 3 (1º DAM nuevo) con los mismos profes que DAW (espejo exacto de imparticiones 1º DAW para validar la unificación).
- Clonación de 4 PeriodoEvaluativos del grupo 1 (DAW) al grupo 3 (DAM) con fechas idénticas (1ª/2ª/3ª/Extraordinaria) para que el planner devuelva N=4 tramos en ambos.

**Validación E2E exitosa**:
- Crear DAM nuevo desde catálogo + asignar 8 materias 1º DAW al itinerario DAM vía `MateriasItinerarioModal` (modal del BookOpen en `/admin/itinerarios`) ✓.
- Editar materia con multi-select itinerarios desde `Materias.jsx` ✓.
- "Configurar curso óptimo" en 1º DAW: N=4 SEMANAs, distribuidor feasible, solver con 1 shortfall (Entornos 94%, comportamiento conocido del bin-packing en jornada 27.5h ajustada) ✓.
- "Configurar curso óptimo" en 1º DAM (con PeriodoEvaluativos clonados): N=4 SEMANAs, mismo distribuidor, mismo solver ✓.
- **Comparación de franjas DAW vs DAM tras Guardar**: las **franjas coinciden** para las 7 materias compartidas (PR/SI/BD/LM/ED/IPEI1/DIG). El `isProfBusyOther` permite colocar profe+materia en franja ya ocupada por grupo paralelo cuando coincide la `materia.id`, y el solver lo aprovecha — **MVP unificación validado E2E**.

**Deuda anotada para sesiones futuras** (no bloqueante):
- DELETE 404 al guardar tras "Limpiar todo el curso": el frontend manda DELETE de PLs ya soft-deleted, API Platform devuelve 404. Ruido en consola, no bloquea el guardado. Bug preexistente del HorariosEditor.
- Crear grupo nuevo no auto-siembra imparticiones; el admin necesita lanzar `Aplicar overlay CCAA` desde `/admin/itinerarios` o crearlas a mano. Promovible a "auto-sembrar imparticiones al crear grupo".
- `Imparticion` sigue siendo M:1 con `Grupo` (cada grupo tiene su par profe-materia). La unificación viaja por `materia.id` + `isProfBusyOther`. Refactor N:M `imparticion_grupo` queda en `clases-compartidas.md` como deuda mayor para producción.
- "Adjuntar a grupo existente" (botón explícito que clona placements de un grupo a otro) descrito como **Fase A formal de `clases-compartidas.md`**, ~1.5 sesiones. Propuesta del usuario en esta sesión, decidido diferir tras validar que el solver consciente funciona.
