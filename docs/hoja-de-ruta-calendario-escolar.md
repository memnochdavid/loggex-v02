# Calendario escolar — Hoja de ruta

> Modelado del tiempo lectivo real del centro: festivos (nacionales, autonómicos, provinciales y locales), calendario del curso académico, distribución temporal de materias y, en el futuro, integración con FCT/Boletines/Calificaciones por evaluación.

## ⚡ Snapshot para retomar

### Estado al cierre (2026-04-27)

- **Modelo de festivos completo y poblado** (Fase 1 ✅).
  - Entidad `Provincia` (52 hard-coded INE: 50 + Ceuta + Melilla, FK a CCAA).
  - Enum `AmbitoFestivo` (NACIONAL / AUTONOMICO / PROVINCIAL / LOCAL).
  - `Festivo` ampliada con `ambito`, `ccaa` opcional, `provincia` opcional (+ `centro` ya existente).
  - `Centro.provincia` FK opcional (lookup INE).
  - 17 festivos NACIONALES (2025+2026) + ~118 AUTONÓMICOS persistidos desde JSON oficial extraído de los PDFs BOE.
- **Pipeline de ingesta** (Fase 2 ✅).
  - `app:seed:provincias` — 52 provincias.
  - `app:calendario:ingest --source-dir=PATH` — sube PDFs y JSON a MinIO `catalogo/calendario/{source,curated}/`.
  - `app:calendario:seed [--anio=YYYY]` — persiste festivos NACIONALES y AUTONÓMICOS desde `curated/festivos.json` en MinIO. Idempotente.
  - Parser Python `parse_boe.py` extrae las tablas de los PDFs BOE oficiales (Resolución DG Trabajo) usando posiciones canónicas de columnas derivadas de la línea de "Año Nuevo".
- **UI** (Fase 3 ✅).
  - `/admin/centros`: selectores **Comunidad Autónoma** y **Provincia** (cascada CCAA → provincias filtradas) en el modal.
  - `/admin/festivos` (en `/fechas/` tab Festivos): columna nueva **Ámbito** con badges themed (consistentes con `/admin/catalogo/itinerarios`), filtro de toolbar "Todos / Nacional / Autonómico / Provincial / Local", solo los LOCALES son editables (resto del seed BOE = read-only con candado).

### Lo siguiente al retomar

1. **Modelo Municipio + UI festivos locales manuales** (Fase 4) — el admin del centro añade los 2 festivos locales de su municipio cada año desde la UI. Requiere entidad `Municipio` con código INE 5 dígitos + FK desde `Centro` (opcional) y `Festivo`.
2. **Calendario lectivo del centro** (Fase 5) — fechas inicio/fin del curso, vacaciones (Navidad, Semana Santa, verano), días no docentes puntuales (claustros, etc.). Ya hay `PeriodoEvaluativo` por grupo, pero falta `CalendarioEscolar` por centro/curso académico.
3. **Distribución temporal de materias** (Fase 6) — hoy el modelo asume "regular semanal todo el curso" para toda materia, lo que rompe con Proyecto Intermodular (bloque concentrado), FCT (en empresa) y Libre configuración (bolsa). Tres opciones: (A) flag `entraEnHorarioSemanal`, (B) enum `tipoDistribucion` + fechas, (C) entidad `MateriaTemporada`. Detalle en `hoja-de-ruta-jornadas-recreos.md` entrada "PARCHE TEMPORAL: jornadas pre Calendario Real".
4. **Cron anual de actualización BOE** (Fase 7) — comando que descarga el PDF nuevo cada octubre/noviembre cuando se publica la Resolución DG Trabajo, lo compara contra el JSON cacheado, abre PR con diff propuesto. Vive en `hoja-de-ruta-redis-workers.md` cuando llegue Symfony Scheduler.

### Decisiones cerradas

- **D1**: usar PDFs oficiales BOE como fuente primaria (no APIs de terceros). Razón: trazabilidad citable, cobertura completa de las 19 entidades autonómicas + nacional, sin dependencias externas.
- **D2**: parser Python (`parse_boe.py`) en lugar de PHP. Razón: pdftotext + regex es trivial en Python; PHP requeriría wrappers o vendor packages que no aportan. El parser es script único, no parte del runtime de la app.
- **D3**: snapshot de PDFs originales en MinIO `catalogo/calendario/source/` además del JSON curado. Razón: auditabilidad — cualquiera puede verificar el extracto contra la fuente.
- **D4**: festivos NACIONALES y AUTONÓMICOS del seed BOE = read-only en la UI. Razón: son normativa, el admin no los edita. Si el BOE cambia, se re-ejecuta el seed (idempotente).
- **D5**: festivos LOCALES y PROVINCIALES = editables manualmente por el admin (Fase 4 para añadir UI específica con búsqueda de municipio).
- **D6**: descartar [`jdlopez/open-data`](https://github.com/jdlopez/open-data) como fuente alternativa. Razón: solo cubre hasta 2024 (no 2025+2026), 9 CCAAs de 19, y al ser dependencia externa añade riesgo sin beneficio sobre el BOE oficial. Evaluación 2026-04-27.

---

## 1. Modelo de datos actual

```
Provincia (52, hard-coded INE)
  ├── codigo VARCHAR(2) PK    01..52
  ├── nombre VARCHAR(100)
  └── ccaa enum Ccaa NOT NULL

Centro
  ├── ...
  ├── ccaa enum Ccaa NULL     (ya existía)
  └── provincia FK Provincia NULL   ← nuevo

Festivo
  ├── ambito enum AmbitoFestivo  (NACIONAL/AUTONOMICO/PROVINCIAL/LOCAL, default LOCAL)
  ├── ccaa enum Ccaa NULL        (cuando AUTONOMICO)
  ├── provincia FK NULL          (cuando PROVINCIAL)   ← nuevo
  └── centro FK NULL             (cuando LOCAL, ya existía)

PeriodoEvaluativo (ya existía, no tocado)
  ├── tipo, fechaInicio, fechaFin, peso
  └── grupo FK NOT NULL
```

### Resolución de festivos aplicables a un centro

```
SELECT * FROM festivo f
WHERE
  (f.ambito = 'nacional')
  OR (f.ambito = 'autonomico'  AND f.ccaa = :centro_ccaa)
  OR (f.ambito = 'provincial'  AND f.provincia_id = :centro_provincia)
  OR (f.ambito = 'local'       AND f.centro_id = :centro_id)
  AND f.deleted = 0
```

Hoy se hace en cliente vía filtros API (`?ambito=nacional` etc.). Cuando aparezca cuello de botella, exponer endpoint `GET /api/v1/centro/{id}/festivos-vigentes` que ya combine todos los ámbitos.

---

## 2. Pipeline de ingesta

```
PDF oficial BOE (Resolución DG Trabajo año YYYY)
  │ pdftotext -layout
  ▼
texto plano
  │ parse_boe.py (Python — derivación de columnas + regex)
  ▼
festivos.json (estructura {anios: {YYYY: {nacionales: [...], autonomicos: {AN: [...], CT: [...], ...}}}})
  │ app:calendario:ingest --source-dir=PATH
  ▼
MinIO bucket loggex-data:
  catalogo/calendario/source/calendario-laboral-YYYY.pdf  (auditable)
  catalogo/calendario/curated/festivos.json               (estructurado)
  │ app:calendario:seed
  ▼
BD: tabla festivo con NACIONALES + AUTONÓMICOS por año
```

Idempotencia: el seed busca `(ambito, ccaa, fechaInicio, nombre)`; si existe, sin cambios. Cualquier festivo no presente en el JSON queda como está (no se borra → permite que LOCALES manuales convivan con seeds ejecutados de nuevo).

---

## 3. Riesgos / deudas

- **R1 (medio)**: parser Python `parse_boe.py` depende de la posición canónica de columnas en el PDF. Si el BOE cambia el layout (cambia el orden de CCAAs en la cabecera o añade columna), el parser falla silenciosamente o asigna mal. Mitigación: el script falla loudly si no encuentra "Año Nuevo" con 19 asteriscos (necesario para derivar posiciones).
- **R2 (bajo)**: festivos sustituibles. Algunas CCAAs sustituyen un nacional por uno propio (ej. País Vasco mueve el 6 enero al lunes). El JSON actual los marca con `sustituible: true` en nacionales pero no aplica la sustitución — un centro PV vería ambos. Aceptable mientras nadie reporte el bug.
- **R3 (medio)**: festivos LOCALES = 0 en BD. La UI deja "Solo lectura" para nacional/autonómico/provincial pero permite crear LOCAL. El admin tiene que añadir manualmente cada año los 2 de su municipio.
- **R4 (medio)**: opción A/B/C de distribución temporal sigue pendiente. Mientras tanto, el "parche temporal" de jornadas `pre Calendario Real` (35h/sem) sigue siendo necesario para validar centros con currículo LOMLOE.

---

## 4. Bitácora

### 2026-04-27 — Fases 1+2+3 cerradas

Sesión completa de implementación del calendario escolar tras observación del usuario "vamos a ir olvidándonos de las cosas hardcoded; el admin selecciona una provincia y de ahí se saca su calendario".

**Backend — modelo:**
- `App\Entity\Provincia` (nuevo) — 52 entidades por código INE, FK a CCAA.
- `App\Entity\AmbitoFestivo` (nuevo) — enum NACIONAL/AUTONOMICO/PROVINCIAL/LOCAL.
- `Festivo`: añadidas `ambito` (default LOCAL), `ccaa` opcional, `provincia` opcional. Filtros API ampliados.
- `Centro`: añadida `provincia` FK opcional. `CentroController` acepta `ccaa` y `provincia` del FormData.

**Backend — comandos:**
- `app:seed:provincias` — siembra las 52 provincias hard-coded.
- `app:calendario:ingest --source-dir=PATH` — sube PDFs y JSON a MinIO.
- `app:calendario:seed [--anio=YYYY]` — persiste NACIONALES y AUTONÓMICOS desde MinIO.

**Recolección de datos:**
- 2 PDFs oficiales BOE descargados: Resolución 15/10/2024 (calendario 2025) y Resolución 17/10/2025 (calendario 2026). Snapshot en MinIO `catalogo/calendario/source/`.
- Parser Python `parse_boe.py` con derivación de posiciones de columnas a partir de la línea "Año Nuevo" (festivo nacional con marca en las 19 columnas autonómicas). Output: `festivos.json` con `nacionales[]` y `autonomicos{ccaa: [...]}`.
- 17 festivos NACIONALES persistidos (9 de 2025 + 8 de 2026) + 118 AUTONÓMICOS distribuidos en 19 CCAAs.

**UI:**
- `Centros.jsx`: carga las 52 provincias upfront. Selectores `ThemedSelect` Comunidad Autónoma + Provincia (cascada — provincia filtrada por la CCAA seleccionada, cambiar CCAA resetea provincia).
- `Festivos.jsx`: columna **Ámbito** con badges themed, filtro toolbar 4 ámbitos, solo LOCAL editable (resto candado read-only). Modal de creación fuerza `ambito: 'local'`.

**Decisiones de diseño cerradas durante implementación:**
- D1-D5 listadas en snapshot.
- D6: descartado `jdlopez/open-data` tras evaluación — solo cubre 2024 y 9 CCAAs.

**Reglas obligatorias aplicadas:**
- Estilos siempre themed (regla persistente "no estilos hardcodeados"). Badges unificados con `/admin/catalogo/itinerarios` usando `.badge` color-primary + `.badgeNeutral` gris (variantes color-mix descartadas). Botón "Aplicar overlay CCAA" en `/admin/itinerarios` migrado a `<Button variant="secondary">`. Clase `.helpText` añadida a `Crud.module.css` con `var(--color-gray-500)` + `var(--text-xs)`; eliminados 6 inline styles repetidos.

**Archivos tocados:**

Backend:
- `backend/src/Entity/Provincia.php` (nuevo)
- `backend/src/Entity/AmbitoFestivo.php` (nuevo)
- `backend/src/Entity/Festivo.php` (ambito + ccaa + provincia)
- `backend/src/Entity/Centro.php` (provincia FK)
- `backend/src/Controller/CentroController.php` (acepta ccaa/provincia en FormData)
- `backend/src/Command/SeedProvinciasCommand.php` (nuevo)
- `backend/src/Command/Calendario/IngestCalendarioCommand.php` (nuevo)
- `backend/src/Command/Calendario/SeedCalendarioCommand.php` (nuevo)

Frontend:
- `frontend/src/pages/Centros.jsx` (selectores CCAA + Provincia)
- `frontend/src/pages/Festivos.jsx` (columna Ámbito, filtro, badges themed, modal forza local)
- `frontend/src/pages/Crud.module.css` (.badge unificado, .badgeNeutral, .helpText)

Helper externo (no en repo):
- `/tmp/boe-calendarios/parse_boe.py` (parser BOE)
- `/tmp/boe-calendarios/festivos.json` (extracto verificado, ya en MinIO)

MinIO snapshot (también en `minio_backup/`):
- `catalogo/calendario/source/calendario-laboral-2025.pdf`
- `catalogo/calendario/source/calendario-laboral-2026.pdf`
- `catalogo/calendario/curated/festivos.json`

SQL ejecutado en BD del usuario:
```
CREATE TABLE provincia (codigo VARCHAR(2) PK, nombre VARCHAR(100), ccaa VARCHAR(2));
ALTER TABLE centro ADD provincia_id VARCHAR(2) NULL FK provincia(codigo);
ALTER TABLE festivo ADD ambito VARCHAR(16) DEFAULT 'local',
                    ADD ccaa VARCHAR(2) NULL,
                    ADD provincia_id VARCHAR(2) NULL FK provincia(codigo);
```

**Validación E2E:** las cuatro pantallas relevantes inspeccionadas:
- `/admin/centros` — selector funcionando con cascada CCAA → Provincia.
- `/admin/festivos` — 135 filas (17 nac + 118 aut), badge consistente, filtro funcional.
- `/admin/catalogo/itinerarios` y `/fechas/` — badges visualmente consistentes (color primary + neutral).

**Pendientes anotados:**
- Modelo `Municipio` + UI festivos locales con búsqueda INE (Fase 4).
- Calendario lectivo del centro (Fase 5).
- Distribución temporal de materias para resolver el parche de jornadas `pre Calendario Real` (Fase 6).
- Cron anual fetch BOE (Fase 7).
