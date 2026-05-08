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

- **D-1**: al borrar un `Horario` con gemelo, ¿se borra también el gemelo?
  Sugerencia: SÍ — si se decidió compartir clase, borrar uno debería borrar
  ambos para mantener consistencia. Excepción: si el admin desliga
  explícitamente vía un botón "desvincular gemelos".

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
