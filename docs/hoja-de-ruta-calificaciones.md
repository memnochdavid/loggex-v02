# Hoja de Ruta — Sistema de Calificaciones y Boletines de Notas

Funcionalidad nueva para Loggex: calculo personalizable de medias por parte del profesorado,
generacion de boletines de notas en PDF por parte del administrador del centro,
y poblado de datos de prueba (entregas + calificaciones) para el centro Escuela Arte Granada.

---

## ⚡ Snapshot para retomar (auditoría 2026-04-29)

**Todas las fases ✅ implementadas y BD poblada (2026-04-29 tarde).** Fixtures inyectados en `backup_tfg_full.sql` y validados; un `./scripts/restore_db.sh` deja Loggex listo para probar todo el ciclo evaluativo.

| Fase | Código | BD/datos | Notas |
|------|--------|----------|-------|
| A — Datos de prueba | ✅ `scripts/seed_calificaciones.sql` (1600 líneas, 144 tareas + 720 entregas + 720 calificaciones) | ❌ **0 tareas / 0 entregas / 0 calificaciones / 0 periodos** en BD actual | Seed con INSERTs por ID literal sin DELETE/TRUNCATE → no es idempotente. Debe re-aplicarse o reescribirse. |
| B — Ponderaciones | ✅ Entidad `PonderacionImparticion` con CRUD API Platform + endpoints `/media`, `/medias`, `/nota-final` | 3 ponderaciones manuales (1 imparticion configurada) | Falta validación a nivel entidad de "Σ pesos = 1.0" (hoy solo Range 0-1 por peso). Defaults 0.5/0.3/0.2 aplicados desde repo. |
| C — Periodos evaluativos | ✅ Entidad `PeriodoEvaluativo` (tipo enum, peso, grupo) + lógica de media ponderada por periodo en `nota-final` | ❌ 0 periodos en BD | C.5 (poblar 3 ord + 1 extra por grupo de Escuela Arte Granada) sin ejecutar. |
| D — Vistas frontend | ✅ `CalificacionesAdmin.jsx`, `CalificacionesGrupo.jsx`, `CalificacionesDetalle.jsx`, `MisCalificaciones.jsx` | — | D.1 (config ponderaciones) integrada en `CalificacionesGrupo` con `ThemedNumberInput`. Vista `CalificacionesAdmin` agrupa por itinerario (no árbol Centro→Ciclo→Grupo→Modulo como pedía D.5, pero cumple el rol). |
| E — Boletines PDF | ✅ `dompdf/dompdf ^3.1`, `templates/pdf/boletin.html.twig`, `BoletinController` (individual + masivos PDF/ZIP), `PdfGenerator`, `PdfBranding` (logo MinIO → tmp → base64), i18n × 5 | — | Botones de descarga integrados en `CalificacionesAdmin` (admin) y `MisCalificaciones` (alumno). |

**Próximas acciones recomendadas:**

1. **Re-aplicar Fase A** sobre BD actual: o bien hacer el seed idempotente (`DELETE FROM calificacion WHERE entrega_id IN (...); DELETE FROM entrega WHERE tarea_id IN (...); DELETE FROM tarea WHERE id BETWEEN 17 AND 160;`) o regenerarlo, y ejecutar.
2. **Fase C.5** — poblar 4 periodos por grupo (3 ord + 1 extra) con fechas coherentes con `Grupo.fechaInicio/fechaFin`.
3. **B.1 validación Σ=1.0** — añadir `Assert\Callback` o validador de colección en entidad/repo.
4. **Fase E** ya cerrada como ruta crítica — no pendiente.

---

## Indice

1. [Fase A — Poblado de datos de prueba](#fase-a--poblado-de-datos-de-prueba)
2. [Fase B — Configuracion de ponderaciones por imparticion](#fase-b--configuracion-de-ponderaciones-por-imparticion)
3. [Fase C — Periodos evaluativos y calculo de medias](#fase-c--periodos-evaluativos-y-calculo-de-medias)
4. [Fase D — Vistas de calificaciones en frontend](#fase-d--vistas-de-calificaciones-en-frontend)
5. [Fase E — Generacion de boletines de notas en PDF](#fase-e--generacion-de-boletines-de-notas-en-pdf)

---

## Tabla resumen

| Fase | Nombre | Prioridad | Esfuerzo | Dependencias |
|------|--------|-----------|----------|--------------|
| A | Poblado de datos de prueba | Critica | Medio | Ninguna |
| B | Configuracion de ponderaciones | Alta | Medio | A |
| C | Periodos evaluativos y medias | Alta | Alto | B |
| D | Vistas de calificaciones frontend | Alta | Alto | C |
| E | Boletines de notas en PDF | Alta | Medio | C, D |

---

## Contexto actual del modelo de datos

El modelo actual tiene esta cadena de relaciones:

```
Centro → CicloFormativo → Modulo → Imparticion → Tarea → Entrega → Calificacion
                                        ↑                    ↑
                                   Grupo + Profesor      Alumno (User)
                                        ↑
                                   Matricula ← Alumno
```

- **Tarea** tiene un campo `tipo` (valores actuales: `examen`, `tarea`; se anadira `practica`).
- **Calificacion** tiene un campo `nota` (float) y `feedbackProfesor` (string). Relacion 1:1 con Entrega.
- **No existen** periodos evaluativos, ponderaciones por tipo, ni calificaciones finales.
- **No hay datos** de entregas ni calificaciones en la BD actual (solo tareas creadas manualmente para pruebas).

---

## Fase A — Poblado de datos de prueba

**Prioridad:** Critica — sin datos no se puede desarrollar ni probar nada
**Esfuerzo:** Medio (1-2 dias)
**Dependencias:** Ninguna

### Justificacion

El proyecto funciona con un dump SQL (`backup_tfg_full.sql`) que no incluye entregas ni calificaciones.
Para desarrollar el sistema de medias y boletines se necesitan datos realistas: cada alumno matriculado
debe tener entregas con calificaciones en todas las tareas de todos los modulos de su grupo.

### Tareas

#### A.1 Crear tareas representativas por imparticion

- [ ] Para cada imparticion del centro "Escuela Arte Granada", asegurar que existan al menos:
  - 2 tareas de tipo `examen` (con fechas repartidas en el curso)
  - 3 tareas de tipo `tarea`
  - 1 tarea de tipo `practica`
- [ ] Las tareas deben tener fechas coherentes con el anio escolar del grupo (usar `fechaInicio` y `fechaFin` del grupo como referencia)
- [ ] Marcar todas las tareas como `visible = true`

**Criterio de aceptacion:** cada imparticion del centro tiene al menos 6 tareas con tipos variados.

#### A.2 Crear entregas por alumno

- [ ] Para cada alumno matriculado en cada grupo del centro:
  - Crear una entrega (`Entrega`) por cada tarea de cada imparticion de su grupo
  - `fechaEntrega`: fecha aleatoria entre `fechaInicio` de la tarea y `fechaLimite`
  - `comentarioAlumno`: texto breve generico (puede ser null en ~20% de los casos)
  - `enlace` y `archivo`: null (no se necesitan ficheros reales)

**Criterio de aceptacion:** todos los alumnos de Escuela Arte Granada tienen entregas en todas las tareas.

#### A.3 Crear calificaciones

- [ ] Para cada entrega creada, crear una calificacion (`Calificacion`):
  - `nota`: valor float entre 0.0 y 10.0, con distribucion realista (media ~6.5, pocos suspensos puros)
  - `feedbackProfesor`: texto breve generico en ~50% de los casos, null en el resto
- [ ] Asegurar que el enlace `Calificacion.entrega` sea correcto (1:1)

**Criterio de aceptacion:** todas las entregas tienen calificacion. Al consultar `/api/calificacions` se ven datos.

#### A.4 Script SQL o comando Symfony

- [ ] Implementar como:
  - **Opcion preferida:** Script SQL puro insertable con `docker compose exec database mariadb < script.sql`
  - **Opcion alternativa:** Comando Symfony (`php bin/console app:seed-calificaciones`) que use el EntityManager
- [ ] El script debe ser idempotente (comprobar si ya hay datos antes de insertar)
- [ ] Integrar en `scripts/` para facilitar su ejecucion

**Criterio de aceptacion:** ejecutar el script puebla la BD con entregas y calificaciones sin errores ni duplicados.

---

## Fase B — Configuracion de ponderaciones por imparticion

**Prioridad:** Alta
**Esfuerzo:** Medio (2-3 dias)
**Dependencias:** Fase A

### Justificacion

Cada profesor necesita poder decidir cuanto vale cada tipo de evaluacion (examen, tarea, practica)
en la nota final de su asignatura. Esto es fundamental en el sistema educativo espanol, donde la
ponderacion varia enormemente entre asignaturas (una asignatura teorica puede dar 80% al examen,
mientras una practica puede dar 60% a las practicas).

### Tareas

#### B.1 Entidad `PonderacionImparticion`

- [ ] Crear entidad con campos:
  - `id` (int, PK)
  - `imparticion` (ManyToOne → Imparticion)
  - `tipoTarea` (string, max 20: `examen`, `tarea`, `practica`)
  - `peso` (float, entre 0.0 y 1.0 — representa el porcentaje, ej: 0.6 = 60%)
  - Usar `TimestampableTrait` y `SoftDeletableTrait`
- [ ] Restriccion unica: `(imparticion_id, tipoTarea)` — un solo peso por tipo y por imparticion
- [ ] Validacion: la suma de pesos por imparticion debe ser exactamente 1.0
- [ ] Valores por defecto si el profesor no configura nada: examen 0.5, tarea 0.3, practica 0.2

**Criterio de aceptacion:** la entidad existe, tiene operaciones CRUD via API Platform, y valida que los pesos sumen 1.0.

#### B.2 Endpoint de configuracion de pesos

- [ ] `GET /api/ponderacion_imparticions?imparticion={id}` — obtener pesos de una imparticion
- [ ] `POST /api/ponderacion_imparticions` — crear/actualizar pesos
- [ ] Solo accesible por el profesor de la imparticion o ROLE_ADMIN/ROLE_SUPERADMIN
- [ ] Si no existen pesos para una imparticion, devolver los valores por defecto

**Criterio de aceptacion:** un profesor puede consultar y modificar los pesos de sus imparticiones.

#### B.3 Endpoint de calculo de media

- [ ] Crear endpoint custom: `GET /api/v1/imparticion/{id}/media/{alumnoId}`
- [ ] Logica de calculo:
  1. Obtener todas las tareas de la imparticion, agrupadas por `tipo`
  2. Para cada tipo, calcular la media de las notas de las entregas del alumno
  3. Multiplicar cada media por su peso correspondiente
  4. Sumar las medias ponderadas → nota final
- [ ] Devolver desglose: `{ mediaExamenes: 7.5, mediaTareas: 8.0, mediaPracticas: 6.5, notaFinal: 7.35, pesos: {...} }`
- [ ] Si faltan entregas: indicar cuantas faltan y calcular sobre las existentes

**Criterio de aceptacion:** dado un alumno con notas y una configuracion de pesos, el endpoint devuelve la media correcta.

#### B.4 Endpoint de medias del grupo completo

- [ ] Crear endpoint: `GET /api/v1/imparticion/{id}/medias`
- [ ] Devuelve la media de todos los alumnos matriculados en el grupo de esa imparticion
- [ ] Incluye: nombre alumno, media por tipo, nota final, numero de entregas pendientes
- [ ] Ordenable por nota final o nombre

**Criterio de aceptacion:** un profesor ve la tabla completa de medias de su grupo en una imparticion.

---

## Fase C — Periodos evaluativos y calculo de medias

**Prioridad:** Alta
**Esfuerzo:** Alto (3-5 dias)
**Dependencias:** Fase B

### Justificacion

El sistema educativo espanol estructura el curso en evaluaciones (1a, 2a, 3a evaluacion ordinaria, extraordinaria).
Las notas de cada evaluacion se calculan independientemente, y la nota final es configurable (media de las
evaluaciones, o un calculo especifico como "la mejor de las ordinarias" para la extraordinaria).

### Tareas

#### C.1 Entidad `PeriodoEvaluativo`

- [ ] Crear entidad:
  - `id` (int, PK)
  - `nombre` (string, max 100, ej: "1a Evaluacion", "Evaluacion Extraordinaria")
  - `tipo` (string/enum: `PRIMERA`, `SEGUNDA`, `TERCERA`, `ORDINARIA_FINAL`, `EXTRAORDINARIA`)
  - `fechaInicio` (date)
  - `fechaFin` (date)
  - `grupo` (ManyToOne → Grupo)
  - `peso` (float, nullable — peso de este periodo en la nota final anual, ej: 0.333)
  - Usar `TimestampableTrait` y `SoftDeletableTrait`
- [ ] Operaciones CRUD via API Platform
- [ ] Acceso: ROLE_ADMIN, ROLE_SUPERADMIN para crear/editar; ROLE_PROFESOR para leer

**Criterio de aceptacion:** se pueden crear periodos evaluativos asociados a un grupo.

#### C.2 Asignar tareas a periodos automaticamente

- [ ] Las tareas se asignan al periodo segun su `fechaLimite`:
  - Si `fechaLimite` cae dentro del rango `[fechaInicio, fechaFin]` de un periodo → pertenece a ese periodo
- [ ] No hace falta campo extra en Tarea: la asignacion se resuelve por consulta con rango de fechas
- [ ] Endpoint: `GET /api/v1/imparticion/{id}/tareas?periodo={periodoId}` — filtra tareas por periodo

**Criterio de aceptacion:** al consultar tareas de un periodo, solo aparecen las que caen en su rango de fechas.

#### C.3 Media por periodo

- [ ] Extender el endpoint de calculo de media (B.3) para aceptar parametro `?periodo={periodoId}`
- [ ] Cuando se indica periodo, solo considerar tareas cuya `fechaLimite` caiga dentro del periodo
- [ ] Mantener la ponderacion por tipo dentro del periodo

**Criterio de aceptacion:** se puede calcular la media de un alumno en una imparticion para un periodo concreto.

#### C.4 Calificacion final del curso

- [ ] Endpoint: `GET /api/v1/imparticion/{id}/nota-final/{alumnoId}`
- [ ] Logica configurable por el profesor:
  - **Media ponderada de periodos:** cada periodo tiene un peso, la nota final es la media ponderada
  - **Mejor nota ordinaria:** tomar la mejor nota de las evaluaciones ordinarias (para la extraordinaria)
- [ ] Guardar la configuracion del metodo de calculo final en `PonderacionImparticion` o nueva entidad ligera
- [ ] Devolver: nota por periodo, metodo de calculo, nota final

**Criterio de aceptacion:** la nota final refleja correctamente el metodo de calculo elegido por el profesor.

#### C.5 Poblar periodos evaluativos de prueba

- [ ] Crear 3 periodos ordinarios + 1 extraordinario para cada grupo del centro Escuela Arte Granada
- [ ] Fechas coherentes con el anio escolar (septiembre-junio dividido en trimestres)
- [ ] Anadir al script de la Fase A o crear script complementario

**Criterio de aceptacion:** cada grupo tiene 4 periodos evaluativos con fechas correctas.

---

## Fase D — Vistas de calificaciones en frontend

**Prioridad:** Alta
**Esfuerzo:** Alto (4-6 dias)
**Dependencias:** Fase C

### Justificacion

Los profesores necesitan una interfaz para configurar pesos, ver las medias de sus alumnos, y los
alumnos necesitan ver sus propias notas. Los administradores necesitan una vision global para
decidir que datos van al boletin.

### Tareas

#### D.1 Vista del profesor: configuracion de ponderaciones

- [ ] Nueva pagina o seccion dentro de la vista de imparticion
- [ ] Formulario con sliders o inputs numericos para cada tipo de tarea (examen, tarea, practica)
- [ ] Validacion en tiempo real: los pesos deben sumar 100%
- [ ] Barra visual (tipo stacked bar) que muestre la proporcion
- [ ] Boton "Restaurar valores por defecto"
- [ ] Guardar con feedback visual (toast de exito)

**Criterio de aceptacion:** un profesor puede ajustar los pesos y ver el cambio reflejado inmediatamente.

#### D.2 Vista del profesor: tabla de calificaciones del grupo

- [ ] Nueva pagina: `/calificaciones/imparticion/{id}`
- [ ] Tabla con columnas:
  - Alumno (nombre)
  - Media examenes | Media tareas | Media practicas
  - Nota final ponderada
  - Entregas pendientes (contador)
- [ ] Selector de periodo evaluativo (dropdown con los periodos del grupo)
  - "Todos" muestra la media global del curso
  - Seleccionar un periodo filtra las notas de ese rango
- [ ] Coloreado condicional: rojo < 5, amarillo 5-6, verde >= 7
- [ ] Ordenable por cualquier columna
- [ ] Enlace al detalle de cada alumno

**Criterio de aceptacion:** la tabla muestra las medias correctas y responde al cambio de periodo.

#### D.3 Vista del profesor: detalle de un alumno

- [ ] Nueva pagina o modal: `/calificaciones/imparticion/{id}/alumno/{alumnoId}`
- [ ] Listado de todas las tareas con:
  - Titulo, tipo, fecha limite
  - Nota obtenida (o "Pendiente" si no hay entrega)
  - Feedback del profesor (editable inline si lo desea)
- [ ] Resumen: media por tipo, nota ponderada del periodo seleccionado
- [ ] Grafico simple (barras o radar) con las notas por tipo

**Criterio de aceptacion:** el profesor ve el desglose completo de un alumno y puede editar feedback.

#### D.4 Vista del alumno: mis calificaciones

- [ ] Nueva pagina: `/mis-calificaciones`
- [ ] Para cada modulo en el que esta matriculado:
  - Nombre del modulo y profesor
  - Media actual (con desglose por tipo si hay pesos configurados)
  - Listado de tareas con nota y feedback
- [ ] Selector de periodo evaluativo
- [ ] El alumno NO ve los pesos de ponderacion (para evitar "optimizar" su esfuerzo)

**Criterio de aceptacion:** un alumno ve sus notas agrupadas por modulo y periodo.

#### D.5 Vista del admin: resumen de calificaciones del centro

- [ ] Nueva pagina: `/admin/calificaciones`
- [ ] Vista arbol: Centro → Ciclo → Grupo → Modulo → resumen estadistico
  - Media del grupo, tasa de aprobados, distribucion de notas
- [ ] Selector de periodo evaluativo
- [ ] Desde aqui se accede a la generacion de boletines (Fase E)

**Criterio de aceptacion:** el admin tiene una vision global de las calificaciones de todo el centro.

---

## Fase E — Generacion de boletines de notas en PDF

**Prioridad:** Alta
**Esfuerzo:** Medio (3-4 dias)
**Dependencias:** Fases C y D

### Justificacion

El boletin de notas es el documento oficial que los centros entregan a alumnos y familias al final
de cada evaluacion. Debe ser generado automaticamente a partir de las calificaciones del sistema
y contener el formato institucional del centro (logo, nombre, datos del alumno).

### Tareas

#### E.1 Instalar libreria de generacion PDF

- [ ] Anadir `dompdf/dompdf` al backend (o alternativa como `knplabs/knp-snappy-bundle`)
- [ ] Configurar servicio de generacion PDF en Symfony
- [ ] Crear servicio `PdfGenerator` reutilizable con metodo para renderizar plantilla Twig a PDF

**Criterio de aceptacion:** un servicio puede generar un PDF a partir de HTML/Twig.

#### E.2 Plantilla del boletin de notas

- [ ] Crear plantilla Twig `templates/pdf/boletin.html.twig` con:
  - Cabecera: logo del centro, nombre del centro, direccion, telefono
  - Datos del alumno: nombre, grupo, ciclo formativo, curso
  - Periodo evaluativo: nombre y fechas
  - Tabla de calificaciones: un fila por modulo con columnas:
    - Modulo (nombre)
    - Nota del periodo (media ponderada)
    - Nota media del grupo (para referencia)
    - Observaciones del profesor (feedbackProfesor agregado o campo adicional)
  - Pie: espacio para firma del tutor, fecha de emision
- [ ] Estilos CSS inline (compatibles con dompdf)
- [ ] Soporte para el tema/colores del centro (usar datos de `Personalizacion`)

**Criterio de aceptacion:** la plantilla renderiza correctamente en navegador y en PDF.

#### E.3 Endpoint de generacion de boletin individual

- [ ] `GET /api/v1/informes/boletin/{alumnoId}/{periodoId}`
- [ ] Acceso: ROLE_ADMIN, ROLE_SUPERADMIN, o el propio alumno (ROLE_ALUMNO si es su boletin)
- [ ] Logica:
  1. Obtener datos del alumno, grupo, centro
  2. Obtener todos los modulos de las imparticiones del grupo
  3. Para cada modulo: calcular media ponderada del periodo
  4. Renderizar plantilla Twig → generar PDF
  5. Devolver PDF con headers `Content-Type: application/pdf`
- [ ] Nombre del archivo: `boletin_{apellidos}_{nombre}_{periodo}.pdf`

**Criterio de aceptacion:** un admin puede descargar el boletin en PDF de cualquier alumno para cualquier periodo.

#### E.4 Generacion masiva de boletines

- [ ] Endpoint: `GET /api/v1/informes/boletines/{grupoId}/{periodoId}`
- [ ] Genera boletines de todos los alumnos del grupo en un unico PDF (uno por pagina) o en ZIP
- [ ] Acceso: ROLE_ADMIN, ROLE_SUPERADMIN
- [ ] Opcion de formato: `?formato=pdf-unico` (un PDF con todos) o `?formato=zip` (un ZIP con PDFs individuales)

**Criterio de aceptacion:** un admin puede descargar todos los boletines de un grupo de una sola vez.

#### E.5 Boton de descarga en las vistas frontend

- [ ] En la vista del admin (D.5): boton "Generar boletines" por grupo/periodo
  - Dialogo de confirmacion con selector de formato (PDF unico / ZIP)
  - Indicador de progreso (o spinner) durante la generacion
- [ ] En la vista del alumno (D.4): boton "Descargar boletin" por periodo
  - Solo disponible si el admin ha "publicado" las notas del periodo (campo futuro o flag)
- [ ] En la vista del profesor (D.2): boton "Descargar acta" (variante del boletin con formato de acta)

**Criterio de aceptacion:** los boletines se pueden descargar desde la interfaz sin tocar la API manualmente.

---

## Diagrama de dependencias

```
Fase A (Datos de prueba)
    │
    v
Fase B (Ponderaciones)
    │
    v
Fase C (Periodos + medias)
    │
    ├──────────────┐
    v              v
Fase D (Vistas)   Fase E (PDF)
                   │
                   v
              (depende de D tambien)
```

---

## Resumen de entidades nuevas

| Entidad | Campos clave | Relaciones |
|---------|-------------|------------|
| `PonderacionImparticion` | tipoTarea, peso | ManyToOne → Imparticion |
| `PeriodoEvaluativo` | nombre, tipo, fechaInicio, fechaFin, peso | ManyToOne → Grupo |

## Resumen de endpoints nuevos

| Metodo | Ruta | Descripcion | Acceso |
|--------|------|-------------|--------|
| GET | `/api/ponderacion_imparticions?imparticion={id}` | Pesos de una imparticion | Profesor, Admin |
| POST | `/api/ponderacion_imparticions` | Crear/actualizar pesos | Profesor, Admin |
| GET | `/api/v1/imparticion/{id}/media/{alumnoId}` | Media de un alumno | Profesor, Admin |
| GET | `/api/v1/imparticion/{id}/medias` | Medias del grupo completo | Profesor, Admin |
| GET | `/api/v1/imparticion/{id}/tareas?periodo={id}` | Tareas filtradas por periodo | Profesor, Alumno |
| GET | `/api/v1/imparticion/{id}/nota-final/{alumnoId}` | Nota final del curso | Profesor, Admin |
| GET | `/api/v1/informes/boletin/{alumnoId}/{periodoId}` | Boletin individual (PDF) | Admin, Alumno propio |
| GET | `/api/v1/informes/boletines/{grupoId}/{periodoId}` | Boletines masivos (PDF/ZIP) | Admin |

## Resumen de vistas nuevas

| Ruta frontend | Rol | Descripcion |
|---------------|-----|-------------|
| `/calificaciones/imparticion/{id}` | Profesor | Tabla de medias del grupo |
| `/calificaciones/imparticion/{id}/alumno/{alumnoId}` | Profesor | Detalle de calificaciones de un alumno |
| `/mis-calificaciones` | Alumno | Notas propias por modulo y periodo |
| `/admin/calificaciones` | Admin | Resumen global del centro + acceso a boletines |

---

## Notas

- Los tipos de tarea actuales son `examen` y `tarea`. Se anadira `practica` como tercer tipo.
- La Fase A es requisito previo imprescindible: sin datos no se puede desarrollar ni validar nada.
- Este documento complementa la Fase 6 de `docs/hoja-de-ruta-mejoras-tecnicas.md`, que menciona periodos evaluativos y calificaciones avanzadas de forma mas generica. Esta hoja de ruta concreta y detalla esa vision.
- El script de poblado de datos (Fase A) debe conservarse para futuras reinstalaciones del entorno de desarrollo.

---

## Fuera de alcance — FCT (Formacion en Centros de Trabajo)

El modulo de FCT (practicas en empresa) es obligatorio en todos los ciclos de FP pero **no se incluye en esta hoja de ruta** porque tiene requisitos muy diferentes al resto de modulos:

### Por que se excluye

- **Calificacion APTO/NO APTO**, no numerica (0-10). No encaja en el sistema de medias ponderadas.
- **No tiene examenes, tareas ni practicas** convencionales. El alumno realiza horas en una empresa.
- **Requiere entidades propias**: convenio con empresa, tutor de empresa, seguimiento de horas/jornadas, informes periodicos del tutor, evaluacion por competencias.
- **Tiene su propio calendario**: en 2o curso, tipicamente de marzo a junio, tras finalizar las clases ordinarias.
- **Implicaciones administrativas**: documentacion oficial (convenios, anexos, seguros), que excede el ambito de calificaciones.

### Impacto en el modelo actual

- Los modulos de 2o curso en los datos de prueba **no incluyen FCT**. Esto es intencionado.
- Los boletines de notas (Fase E) mostraran solo modulos con calificacion numerica. Si en el futuro se anade FCT, aparecera como fila separada con "APTO" o "NO APTO" en vez de nota.
- La entidad `PeriodoEvaluativo` no cubre el periodo de FCT. Los grupos de 2o curso tienen sus evaluaciones hasta marzo; FCT ocurriria despues.

### Recomendacion para fase futura

Cuando se aborde FCT, se recomienda una fase dedicada que incluya:

1. **Entidad `ConvenioFCT`**: empresa, tutor empresa, tutor centro, alumno, fechas, estado
2. **Entidad `SeguimientoFCT`**: jornadas/horas realizadas, observaciones del tutor, valoracion por competencias
3. **Tipo de calificacion en Modulo**: campo `tipoCalificacion` (`numerico` | `apto_no_apto`) para que el sistema de medias sepa que modulos ignorar
4. **Vista especifica**: panel de seguimiento de FCT diferente al de calificaciones ordinarias
5. **Generacion de documentos**: anexos oficiales del convenio (formatos regulados por la comunidad autonoma)

---

## Bitácora de implementación

### 2026-04-29 — Auditoría completa del estado real

Hecho en una sesión, motivado por el item del INDEX "Auditar y cerrar bitácora" + bug reportado por usuario en `/admin/calificaciones`.

**Bug corregido** (`frontend/src/pages/CalificacionesAdmin.jsx:173`):
- Aparecía un carácter `?` como header bajo las stat cards. Causa raíz: el backend `CalificacionMediaController::resumenCalificaciones` devuelve `grupo.ciclo` como **string** ya formateado (`$itinerario->getNombre()`), pero el frontend lo trataba como objeto haciendo `itin?.nombre`, que sobre un string siempre da `undefined` y caía en el fallback `'?'`.
- Fix: detectar tipo (`typeof itin === 'string' ? itin : itin?.nombre`) y sustituir el fallback por texto i18n descriptivo `"Sin itinerario"`.

**Hallazgos por fase**:
- **Fase A** 🟡: el script `scripts/seed_calificaciones.sql` (1600 líneas) existe y es coherente con la spec, pero NO es idempotente (INSERTs con IDs literales sin DELETE/TRUNCATE previo). La BD actual tiene `tarea/entrega/calificacion = 0` registros: o se reseteó tras aplicar el seed o nunca se aplicó. Imparticiones (51), matrículas (21) y grupos (4) sí están.
- **Fase B** 🟢: entidad `PonderacionImparticion` completa (CRUD API Platform, validación Choice + Range 0-1, unique constraint, soft-delete). Endpoints `/api/v1/imparticion/{id}/media/{alumnoId}`, `/medias`, `/nota-final/{alumnoId}` operativos en `CalificacionMediaController`. Defaults 0.5/0.3/0.2 vía `PonderacionImparticionRepository::getPesosParaImparticion()`. **Pendiente residual**: validación Σ pesos = 1.0 a nivel entidad (B.1 lo pedía pero no está). 3 ponderaciones reales en BD (imparticion 15).
- **Fase C** 🟢: entidad `PeriodoEvaluativo` completa con tipo enum (PRIMERA/SEGUNDA/TERCERA/ORDINARIA_FINAL/EXTRAORDINARIA), peso, grupo, fechas. Lógica de "media ponderada de periodos ordinarios" implementada en endpoint `nota-final`. **Pendiente residual**: C.5 — 0 periodos en BD; no se ha poblado el seed de periodos para Escuela Arte Granada.
- **Fase D** 🟢: cuatro vistas implementadas (`CalificacionesAdmin`, `CalificacionesGrupo`, `CalificacionesDetalle`, `MisCalificaciones`). `CalificacionesGrupo` integra D.1 (config ponderaciones con `ThemedNumberInput`) además de D.2 (tabla del grupo). `CalificacionesAdmin` agrupa por itinerario en lugar del árbol Centro→Ciclo→Grupo→Modulo del spec original — cumple el rol funcional aunque sea un layout más plano.
- **Fase E** 🟢: `dompdf/dompdf ^3.1` instalado, plantilla `templates/pdf/boletin.html.twig` viva, `BoletinController` con endpoints individual y masivo (PDF/ZIP), `PdfGenerator` y `PdfBranding` (logo del centro vía MinIO → tmp → base64 para que dompdf lo embeba), i18n del boletín en 5 idiomas. Botones de descarga ya cableados en `CalificacionesAdmin` y `MisCalificaciones`.

**Conclusión**: el sistema de calificaciones está mucho más cerrado de lo que reflejaba el doc. Cola viva real:
- A.4 idempotencia + re-poblado de BD (datos faltan).
- C.5 poblado de periodos (datos faltan).
- B.1 validación Σ pesos = 1.0 (deuda menor; defaults cubren el caso normal).

### 2026-04-29 (tarde) — BD poblada con fixtures completos

Petición del usuario: "edita el .sql y mete registros creíbles para probar entregas, notas, evaluaciones, etc.". Persistencia vía `./scripts/restore_db.sh` (lee `backup_tfg_full.sql`).

**Estrategia**: generador Python en `/tmp/gen_fixtures.py` (idempotente entre runs, semilla `random.seed(42)`) que produce 9 bloques SQL → script `/tmp/inject_fixtures.py` que los empotra en `backup_tfg_full.sql` reemplazando los `LOCK TABLES … UNLOCK TABLES` correspondientes y ajustando `AUTO_INCREMENT` en cada CREATE TABLE.

**Datos generados** (todos centro 3 / Escuela Arte Granada, año escolar 2025-2026):

| Tabla | Filas | Notas |
|---|---:|---|
| `periodo_evaluativo` | 16 | 4 por grupo: 1ª/2ª/3ª (peso 0.333/0.333/0.334) + Extraordinaria (peso NULL, no entra en media) |
| `ponderacion_imparticion` | 87 (3 previas + 84 nuevas) | Defaults `examen=0.5/tarea=0.3/practica=0.2` para 28 imparticiones (excluyendo FCT y Proyecto Intermodular) |
| `tarea` | 174 | 6 tareas/imparticion (2 examen + 3 tarea + 1 practica) repartidas oct 2025 – may 2026. Todas con `archivo='Dummy.pdf'` |
| `entrega` | 614 | Solo para tareas con `fecha_limite < hoy` (29 tareas son aún futuras → 0 entregas → simulan "pendientes"). ~85% de los alumnos entregan; 15% no → simula faltas. `archivo='Dummy.pdf'`, ~30% con `comentario_alumno` |
| `calificacion` | 614 | 1:1 con entregas. Distribución por perfil de alumno (alto/medio/justo/bajo) + sesgo por tipo (examen –0.4, practica +0.5). Resultado real: media=5.83, suspensos=190 (31%), aprobados=246 (40%), notable+=178 (29%). ~40% lleva `feedback_profesor` contextual a la nota |
| `asistencia` | 725 | Semana 13–17/04/2026 × 5 alumnos × 29 imparticiones. Estados: 620 presente / 57 ausente / 38 justificada / 10 retraso |
| `mensaje` | 17 | 7 conversaciones realistas profesor↔alumno y admin↔profesor (dudas de tareas, retraso de entrega, recordatorio cierre 2ª eval, traslado de aula, etc.) |
| `comunicado` | 10 (5 previos + 5 nuevos) | Calendario fin de curso, jornada puertas abiertas, mantenimiento aulas, mantenimiento plataforma (global), recordatorio trabajos finales |
| `temario` | 87 | 3 temarios por imparticion (Tema 1/2/3) con `archivo='Dummy.pdf'` |

**Convención de archivos**: `tarea.archivo`, `entrega.archivo` y `temario.archivo` guardan **solo el filename** (no path completo). El `FileProxyController` resuelve el path con `tareas/{filename}`, `entregas/{filename}`, `materiales/{filename}` respectivamente. Todos los registros referencian al mismo `Dummy.pdf` físico que existe en `loggex-data/{tareas,entregas,materiales}/Dummy.pdf` en MinIO. La URL pública es distinta (`/uploads/{type}/{id}/Dummy.pdf`) gracias al ID en la URL — se valida que coincida con el almacenado.

**Validación post-restore**:
- 0 entregas sin calificación.
- 0 imparticiones con `Σ pesos ≠ 1.0`.
- 29 tareas futuras = 0 entregas (correcto: son las "pendientes" que aún no han vencido).
- Imparticion 15 conserva sus 3 ponderaciones manuales previas (0.5/0.1/0.4).
- AUTO_INCREMENT ajustado en CREATE TABLE para cada tabla → la app puede seguir creando registros sin choques de PK.

**Fuera de alcance del seed**:
- FCT (imparticiones 27 y 57) y Proyecto Intermodular (43, 69): excluidas porque su evaluación es no-numérica / por proyecto único, no encajan en el modelo "tareas con tipo".
- Centro 4 (IES Tecnológico): tiene 0 grupos / 0 imparticiones, no procede poblar.

**Cierre de cola viva**:
- ✅ A.4 BD poblada (sin reescribir el seed antiguo `scripts/seed_calificaciones.sql`, que queda histórico — los nuevos fixtures viven directamente en `backup_tfg_full.sql`).
- ✅ C.5 Periodos evaluativos poblados (4 por grupo).
- ⏳ B.1 Validación Σ pesos = 1.0 a nivel entidad sigue pendiente (fixtures la cumplen pero la app no la fuerza).
