# Catálogo Oficial de Ofertas Educativas — Hoja de Ruta

Documento de arquitectura y planificación. Define cómo Loggex va a ofrecer al admin de un centro una **lista oficial y siempre actualizada** de ciclos, cursos, modalidades y asignaturas para que dar de alta un Ciclo / Curso / Asignatura sea **seleccionar de un desplegable**, no rellenar campos a mano. El objetivo es eliminar el riesgo de typo, código oficial mal escrito o currículo desactualizado.

Estado: **borrador de diseño** (abril 2026). Nada de esto está implementado todavía; este documento existe para alinear la decisión antes de empezar.

---

## 1. Objetivo y alcance

### Objetivo de producto

Cuando un admin entra a `/ciclos → Nuevo`, en lugar de un formulario vacío, ve un `AsyncSearchSelect` contra el catálogo oficial:

- *"Desarrollo de Aplicaciones Web"* → Ciclo Superior, familia Informática y Comunicaciones, código IFC32, currículo nacional (Real Decreto 686/2010), 2.000 horas, 14 módulos predefinidos con su carga horaria y curso de impartición.
- *"1º Educación Secundaria Obligatoria"* → ESO, primer curso, asignaturas troncales y específicas LOMLOE con sus horas semanales según CCAA.
- *"2º Bachillerato — Modalidad Ciencias y Tecnología"* → Bachillerato, segundo curso, asignaturas troncales por modalidad con sus horas.
- *"Grado en Ingeniería Informática — Universidad de Granada"* → Universidad, grado RUCT, plan de estudios con créditos ECTS por asignatura (cuando lo tengamos).

Al seleccionar uno, Loggex **materializa** una instancia editable del ciclo/curso para ese centro: se copia la estructura curricular (módulos / asignaturas con sus horas y créditos), se asigna el grupo, y queda referenciado al ítem del catálogo para futuras sincronizaciones.

Además, el admin puede **importar el calendario escolar oficial** de su CCAA y curso para que las festividades, periodos de evaluación y días lectivos del centro queden alineados con la normativa, sin tener que copiarlos a mano del BOJA.

### Alcance por nivel educativo (priorizado)

| Nivel | Cobertura objetivo | Fuente principal | Dificultad | Fase |
|---|---|---|---|---|
| FP (Básica, Media, Superior, Especialización) | Catálogo nacional (185 ciclos en abr-2026) con módulos, horas totales, horas por curso | TodoFP + INCUAL | Media | **MVP** |
| ESO | LOMLOE, asignaturas por curso y CCAA con horas semanales | BOE + BOJA (en Andalucía) | Media-Alta | **Fase 2** |
| Bachillerato | Modalidades + asignaturas por curso y CCAA con horas semanales | BOE + BOJA | Media-Alta | **Fase 2** |
| Universidad — Grados | Catálogo RUCT (títulos oficiales) con duración total en ECTS | Sede Electrónica MECD | Alta | **Fase 3** |
| Universidad — Asignaturas | Plan de estudios por universidad con ECTS por asignatura | Web universidades (heterogénea) | Muy alta | **Fase 4 (opcional)** |
| Primaria | LOMLOE, áreas con horas semanales | BOE + BOJA | Media | **Fase 5** |
| **Calendario escolar** | Curso lectivo, festivos, periodos de evaluación, días no lectivos por CCAA | Órdenes anuales BOJA + DOCM + DOG + … | Media | **Fase 1.5** |

**Nota explícita:** salvo FP, no existe una API REST oficial; todo se obtiene parseando HTML, PDFs y XML del BOE/BOJA. Eso hace los scrapers frágiles y obliga a planificar mantenimiento (ver sección 8).

### Lo que NO va a hacer este sistema

- No reemplaza al admin: el admin sigue gestionando grupos, matrículas, horarios, etc. Solo le simplifica el alta inicial.
- No expone el catálogo a usuarios finales (alumnos/profesores). Es metadata para administradores.
- No hace scraping en runtime ante una petición del navegador. Toda la ingesta es programada y cacheada.

---

## 2. Modelo de datos

Dos espacios separados, **catálogo oficial** (read-only desde la app, escrito solo por jobs de ingesta) e **instancias del centro** (lo que ya existe hoy: `CicloFormativo`, `Modulo`, `Grupo`, etc.).

### 2.1 Catálogo oficial (entidades nuevas)

Ubicación propuesta: `backend/src/Entity/Catalogo/`.

```
EtapaEducativa            (enum: PRIMARIA, ESO, BACHILLERATO, FP_BASICA, FP_MEDIO,
                           FP_SUPERIOR, FP_ESPECIALIZACION, GRADO_UNIVERSITARIO, …)

CatalogoItinerario        Un ciclo de FP, una modalidad de Bachillerato, un grado universitario.
  ├── id
  ├── etapa                EtapaEducativa
  ├── codigoOficial        IFC32 / RD686-2010 / RUCT-XXXX
  ├── nombre               "Desarrollo de Aplicaciones Web"
  ├── familia              "Informática y Comunicaciones" (FP) / "Ciencias y Tecnología" (Bach)
  ├── nivel                "Superior" / "Modalidad" / "Grado"
  ├── duracionTotalHoras   2000 / null
  ├── ccaa                 NULL = nacional, "AND" = solo Andalucía, etc.
  ├── normativa            "Real Decreto 686/2010 de 20 de mayo"
  ├── boletinUrl           https://www.boe.es/eli/es/rd/2010/05/20/686
  ├── vigenteDesde         2010-09-01
  ├── vigenteHasta         null (NULL = activo)
  ├── fuenteIngesta        "TodoFP" / "BOE" / "BOJA" / "RUCT"
  ├── fuenteHash           sha256 del payload original (para detectar cambios)
  ├── ingestadoAt
  └── itemsCurriculo       OneToMany → CatalogoMateria

CatalogoMateria           Un módulo (FP) o asignatura (ESO/Bach/Uni).
  ├── id
  ├── itinerario           ManyToOne → CatalogoItinerario
  ├── codigoOficial        "0612" (módulo FP) / "MAT-I" (asignatura)
  ├── nombre               "Lenguajes de Marcas y Sistemas de Gestión de Información"
  ├── tipo                 enum: MODULO / TRONCAL / ESPECIFICA / OPTATIVA /
  │                              LIBRE_CONFIGURACION / FCT / PROYECTO / …
  ├── curso                1 / 2 (dentro del itinerario)
  ├── horasTotales         160      (carga total del módulo/asignatura, fuente normativa)
  ├── horasSemanales       4        (horas/semana en el horario lectivo — clave para el horario)
  ├── distribucionAnual    json     (anual / 1er-trimestre / 1er-cuatrimestre / 2o-cuatrimestre…)
  ├── ects                 6        (universidad, NULL en FP/ESO/Bach)
  ├── obligatoria          bool     (true troncales/módulos; false optativas)
  ├── prerequisitos        json     (códigos de otras materias requeridas — útil en FP y uni)
  ├── descripcion          texto breve
  ├── competencias         json     (competencias profesionales/clave asociadas)
  └── orden                int      (para ordenar el plan de estudios)

CatalogoCentro            Centro educativo oficialmente registrado (para autocompletar
                          el alta de Centros en Loggex con datos fiables).
  ├── id
  ├── codigoCentro         "11700199" (Andalucía) / "28000123" (estatal)
  ├── nombre
  ├── ccaa
  ├── provincia
  ├── municipio
  ├── direccion
  ├── titularidad          PUBLICO / CONCERTADO / PRIVADO
  ├── etapasOfrecidas      json: ["ESO", "BACHILLERATO", "FP_SUPERIOR"]
  ├── fuenteIngesta        "RegistroEstatal" / "JuntaAndalucia"
  └── ingestadoAt

CatalogoCalendarioEscolar   Calendario oficial publicado por la administración
                            educativa para un curso académico y CCAA.
  ├── id
  ├── ccaa                  "AND" / "MAD" / "CAT" / …
  ├── etapa                 EtapaEducativa (puede haber matices: ESO+BACH separado de FP)
  ├── anioAcademico         "2025-2026"
  ├── inicioCurso           DATE  primer día lectivo del curso
  ├── finCurso              DATE  último día lectivo
  ├── inicioPrimerTrimestre DATE
  ├── finPrimerTrimestre    DATE
  ├── inicioSegundoTrimestre DATE
  ├── finSegundoTrimestre   DATE
  ├── inicioTercerTrimestre DATE
  ├── finTercerTrimestre    DATE
  ├── diasLectivosTotales   int  (175 mínimo en ESO/Bach por normativa estatal)
  ├── normativa             "Orden de X/X/2025 de la Consejería… (BOJA nº…)"
  ├── boletinUrl            URL al BOJA/DOCM/…
  ├── fuenteIngesta         "BOJA" / "DOCM" / "DOG" / …
  ├── fuenteHash            sha256 del payload
  ├── ingestadoAt
  └── periodos              OneToMany → CatalogoPeriodoCalendario

CatalogoPeriodoCalendario   Tramos del calendario: festivos nacionales/autonómicos,
                            puentes, vacaciones, días no lectivos pedagógicos,
                            sesiones de evaluación, periodos de recuperación.
  ├── id
  ├── calendario            ManyToOne → CatalogoCalendarioEscolar
  ├── tipo                  enum: FESTIVO_NACIONAL / FESTIVO_AUTONOMICO /
  │                                FESTIVO_LOCAL / VACACIONES_NAVIDAD /
  │                                VACACIONES_SEMANA_SANTA / VACACIONES_VERANO /
  │                                NO_LECTIVO_PEDAGOGICO /
  │                                SESION_EVALUACION_1T / SESION_EVALUACION_2T /
  │                                SESION_EVALUACION_3T / SESION_EVALUACION_FINAL /
  │                                PERIODO_RECUPERACION /
  │                                INICIO_FCT / FIN_FCT
  ├── nombre                "Día de Andalucía" / "Vacaciones de Navidad" / …
  ├── fechaInicio           DATE
  ├── fechaFin              DATE  (igual a inicio si es un solo día)
  ├── ambitoMunicipal       string  NULL si nacional/autonómico; "Granada" si solo Granada
  └── notas                 texto opcional
```

> **Sobre festivos locales**: cada municipio en España tiene 2 festivos locales fijados por su ayuntamiento. Estos NO forman parte del calendario escolar publicado por la Consejería, pero el centro tiene que respetarlos. El catálogo solo trae los nacionales y autonómicos; los locales los añade manualmente el admin del centro al festivo del calendario, o los importa de los datos abiertos municipales (fase futura).

### 2.2 Relación con las entidades del centro existentes

Las entidades actuales (`CicloFormativo`, `Modulo`, `Grupo`, `Centro`) ganan un campo opcional de **trazabilidad al catálogo**:

```php
class CicloFormativo {
    // … campos actuales …

    #[ORM\ManyToOne(targetEntity: CatalogoItinerario::class)]
    #[ORM\JoinColumn(nullable: true, onDelete: 'SET NULL')]
    private ?CatalogoItinerario $catalogoOrigen = null;
}

class Modulo {
    // … campos actuales …

    #[ORM\ManyToOne(targetEntity: CatalogoMateria::class)]
    #[ORM\JoinColumn(nullable: true, onDelete: 'SET NULL')]
    private ?CatalogoMateria $catalogoOrigen = null;
}

class Centro {
    // … campos actuales …

    #[ORM\ManyToOne(targetEntity: CatalogoCentro::class)]
    #[ORM\JoinColumn(nullable: true, onDelete: 'SET NULL')]
    private ?CatalogoCentro $catalogoOrigen = null;
}

class Festivo {
    // … campos actuales …

    /** Origen: si vino de importar un CatalogoPeriodoCalendario, queda
     *  trazado para detectar futuras ediciones del calendario oficial. */
    #[ORM\ManyToOne(targetEntity: CatalogoPeriodoCalendario::class)]
    #[ORM\JoinColumn(nullable: true, onDelete: 'SET NULL')]
    private ?CatalogoPeriodoCalendario $catalogoOrigen = null;
}

class PeriodoEvaluativo {
    // … campos actuales …

    #[ORM\ManyToOne(targetEntity: CatalogoPeriodoCalendario::class)]
    #[ORM\JoinColumn(nullable: true, onDelete: 'SET NULL')]
    private ?CatalogoPeriodoCalendario $catalogoOrigen = null;
}
```

**Nullable** porque debe seguir siendo posible crear ciclos/módulos/festivos manuales (test data, casos especiales, currículos no estandarizados, festivos del centro propios). El catálogo es ayuda, no jaula.

### 2.3 Materialización al seleccionar del catálogo

Cuando un admin selecciona "Desarrollo de Aplicaciones Web" en el modal de nuevo ciclo:

1. Se crea un `CicloFormativo` del centro, copiando `nombre`, `nivel`, `codigoOficial`, `duracionTotalHoras` del `CatalogoItinerario`.
2. Se rellena `catalogoOrigen` con la FK al ítem del catálogo.
3. Se crean automáticamente los `Modulo` correspondientes copiando los `CatalogoMateria` hijos: `nombre`, `codigoOficial`, `curso`, `horasSemanales`, `horasTotales`, y `ects` si aplica.
4. El admin puede editar después libremente (p. ej. ajustar `horasSemanales` si su centro reparte distinto las horas dentro del marco normativo). Las ediciones no propagan al catálogo (es read-only).
5. Si el catálogo se actualiza con un cambio normativo, se notifica al admin (no se sobrescribe nada automáticamente).

Y al seleccionar el calendario escolar oficial:

1. Para cada `CatalogoPeriodoCalendario` con `tipo` festivo/vacaciones/no-lectivo, se crea un `Festivo` del centro con `fechaInicio`/`fechaFin`/`nombre` copiados, y se traza el origen.
2. Para cada `CatalogoPeriodoCalendario` con `tipo` sesión de evaluación, se crea o actualiza un `PeriodoEvaluativo` del grupo correspondiente con las fechas oficiales.
3. El admin puede editar después: añadir festivos locales, días puente del centro, retrasar una sesión, etc.

### 2.4 Carga horaria, créditos y unidades de medida

El sistema usa unidades distintas según etapa, y hay que mantener la traza para que los reportes oficiales (al final de curso) sean fiables.

| Etapa | Unidad oficial | Lo que guardamos en `CatalogoMateria` |
|---|---|---|
| FP (todos los niveles) | **Horas** (lectivas) | `horasTotales` (módulo completo, dato del Real Decreto), `horasSemanales` (reparto en horario), `curso` (1 o 2) |
| ESO | **Horas semanales** | `horasSemanales` por curso, `horasTotales` derivable (= h. semanales × ~30 semanas) |
| Bachillerato | **Horas semanales** | Igual que ESO |
| Universidad | **ECTS** (1 ECTS = 25-30 horas estimadas) | `ects` por asignatura, `horasSemanales` opcional (lo fija cada universidad por horario propio) |
| Primaria | **Horas semanales** | Igual que ESO |

**Reglas de validación al materializar:**

- Si `etapa ∈ {FP_*}`, se exige `horasTotales` y `horasSemanales` no NULL en cada `CatalogoMateria`. La suma de `horasTotales` por curso debe cuadrar con `duracionTotalHoras / 2` aproximadamente (margen del 10% para módulos transversales como FCT).
- Si `etapa = GRADO_UNIVERSITARIO`, se exige `ects` no NULL. Total ECTS del grado normalmente 240 (4 cursos × 60).
- Si `etapa ∈ {ESO, BACHILLERATO, PRIMARIA}`, se exige `horasSemanales` no NULL. El total semanal por curso debe estar entre 25 y 32 (rango legal típico).

Estas validaciones se ejecutan en el job de ingesta y un `CatalogoMateria` que las incumpla queda marcado como `vigenteHasta = hoy` con `notas = "Datos incompletos detectados en ingesta"`. Eso evita que un parser roto contamine el catálogo con datos basura.

### 2.5 Periodicidad y vigencia temporal

El catálogo es **versionado por curso académico** en lo que toca a calendario y carga horaria, y **versionado por normativa** en lo que toca a currículo.

- `CatalogoItinerario.vigenteDesde / vigenteHasta` → cubre el ciclo de vida normativo (un Real Decreto deroga al anterior).
- `CatalogoCalendarioEscolar.anioAcademico` → un calendario por curso/CCAA. Los anteriores se conservan para que un centro pueda consultar el calendario que aplicó en cursos pasados.
- `CatalogoMateria.horasSemanales` puede variar entre versiones de un mismo `CatalogoItinerario` cuando una CCAA modifica su Decreto curricular sin cambiar el código del ciclo. Solución: si la CCAA modifica el reparto, se crea una NUEVA fila `CatalogoItinerario` con la misma `codigoOficial` pero distinto `ccaa` y `vigenteDesde`, y los `CatalogoMateria` cuelgan de la nueva.

El frontend siempre presenta al admin la versión vigente más reciente para su CCAA. Si no hay versión específica de su CCAA, cae a la nacional.

---

## 3. Pipeline de ingesta

### 3.1 Arquitectura por capas

```
┌─────────────────────────────────────────────────────────────────────┐
│  Cron (Symfony Scheduler) / SuperAdmin manual / Webhook             │
└────────────────────────────────┬────────────────────────────────────┘
                                 │ dispara
                                 ▼
┌─────────────────────────────────────────────────────────────────────┐
│  Symfony Messenger — cola "catalogo"                                 │
│    RefreshSourceMessage("todofp" | "boe" | "ruct" | "andalucia" | …) │
└────────────────────────────────┬────────────────────────────────────┘
                                 │ consume worker
                                 ▼
┌─────────────────────────────────────────────────────────────────────┐
│  Source Adapters (uno por fuente, interfaz común)                    │
│    interface CatalogoSourceAdapterInterface {                        │
│        public function fetch(): iterable<CatalogoDto>;               │
│        public function source(): string;                             │
│    }                                                                 │
│    implementaciones:                                                 │
│      - TodoFpAdapter            scraper HTML + parseo PDF            │
│      - BoeBojaCurriculumAdapter ELI XML del BOE/BOJA (currículo)     │
│      - BoeBojaCalendarioAdapter ELI XML del BOJA (orden anual de     │
│                                  calendario escolar)                 │
│      - RuctAdapter              consulta sede.educacion.gob.es       │
│      - JuntaAndaluciaCentrosAdapter   API REST oficial               │
│      - RegistroEstatalCentrosAdapter  scraping del registro          │
└────────────────────────────────┬────────────────────────────────────┘
                                 │ devuelve DTOs normalizados
                                 ▼
┌─────────────────────────────────────────────────────────────────────┐
│  CatalogoIngestService                                               │
│    - dedup por codigoOficial + fuente                                │
│    - hash de fuente para detectar cambios                            │
│    - persistencia idempotente (UPSERT)                               │
│    - marcado de ítems retirados como vigenteHasta=hoy                │
└────────────────────────────────┬────────────────────────────────────┘
                                 │
                                 ▼
┌─────────────────────────────────────────────────────────────────────┐
│  MariaDB (catálogo)  +  Redis (cache de queries de lectura)          │
└─────────────────────────────────────────────────────────────────────┘
```

### 3.2 Adapters: separación por fuente

Cada fuente externa es un adapter aislado. Uno se rompe → el resto sigue trabajando. Vive en `backend/src/Catalogo/Source/`.

**Contrato** (todos devuelven el mismo DTO normalizado):

```php
final readonly class CatalogoItinerarioDto {
    public function __construct(
        public string $codigoOficial,
        public EtapaEducativa $etapa,
        public string $nombre,
        public ?string $familia,
        public ?int $duracionTotalHoras,
        public ?string $ccaa,
        public ?string $normativa,
        public ?string $boletinUrl,
        public ?\DateTimeImmutable $vigenteDesde,
        public ?\DateTimeImmutable $vigenteHasta,
        /** @var CatalogoMateriaDto[] */
        public array $itemsCurriculo,
        public string $fuenteHash,
    ) {}
}
```

### 3.3 Job de ingesta — frecuencia y orquestación

| Adapter | Frecuencia | Razón |
|---|---|---|
| `TodoFpAdapter` | Mensual | El catálogo nacional cambia con cada nuevo Real Decreto, ~5-10/año |
| `BoeBojaCurriculumAdapter` | Diario (filtrado por temas) | Para detectar nuevos RD curriculares en cuanto se publican |
| `BoeBojaCalendarioAdapter` | Mensual con foco mayo-julio | Las órdenes de calendario escolar se publican tarde primavera/verano para el curso siguiente |
| `RuctAdapter` | Mensual | Universidades lentas en cambiar |
| `JuntaAndaluciaCentrosAdapter` | Semanal | Centros pueden abrir/cerrar |
| `RegistroEstatalCentrosAdapter` | Mensual | Más estable que el regional |

Implementación con **Symfony Scheduler** (no cron del SO — más controlable). El comando `app:catalogo:refresh <fuente>` también puede invocarse manualmente desde un panel de SuperAdmin para refrescos puntuales.

### 3.4 Detección de cambios y idempotencia

Cada DTO trae un `fuenteHash` calculado a partir del payload bruto de la fuente (sha256). Al persistir:

- Si no existe el `codigoOficial+fuente` → INSERT.
- Si existe y `fuenteHash` cambia → UPDATE + log de auditoría.
- Si existe y `fuenteHash` igual → no-op.
- Si tras una ingesta completa hay ítems del catálogo que no aparecieron en la fuente → marcarlos `vigenteHasta = hoy` (no borrar nunca, conservar para trazabilidad histórica de centros que ya importaron de ese ítem).

### 3.5 Errores y resiliencia

- Cada job fallido se reintenta con backoff exponencial (mecanismo nativo de Messenger).
- Tras 3 fallos consecutivos, se notifica a SuperAdmin (toast + email opcional).
- Un fallo en un adapter no afecta a otros: se procesan independientemente.
- Antes de UPSERT en BD, se hace un *dry-run* opcional que reporta diff (cuántos ítems nuevos, cuántos modificados, cuántos retirados) — útil para refresh manual.

---

## 4. Capa de cache (Redis)

Redis ya está en el `docker-compose.yml` para Messenger. Le añadimos un segundo namespace para cache de lectura del catálogo.

### 4.1 Qué se cachea

**Sí cacheado en Redis:**
- Resultado de `GET /api/catalogo/itinerarios?etapa=fp_superior&q=desarrollo` — TTL 1 hora. Invalidación al terminar una ingesta.
- Resultado de `GET /api/catalogo/centros?ccaa=AND&q=granada` — TTL 24 horas.
- Familias profesionales, etapas educativas, modalidades de Bachillerato — TTL 1 día (datos casi inmutables).

**No cacheado:**
- Las propias entidades del centro (`CicloFormativo`, `Modulo`, `Grupo`) ya tienen sus mecanismos de query y no merecen cache.
- Las consultas individuales por id (Doctrine ya tiene su L1 cache).

### 4.2 Por qué Redis y no Doctrine query cache

Doctrine query cache es por proceso (PHP-FPM). Redis cachea entre procesos y entre instancias horizontales del backend (cuando escalemos). Las queries de catálogo son las que más usuarios hacen simultáneamente al abrir el modal de nuevo ciclo, son perfectas para cache compartido.

### 4.3 Política de invalidación

Tras cada `CatalogoIngestService::flush()`:

```php
$cache->invalidateTags(['catalogo:itinerario', 'catalogo:materia']);
```

Tags de Symfony Cache atadas a Redis. Granular: si solo cambia el catálogo de FP, invalidamos `catalogo:itinerario:fp` sin tocar el resto.

---

## 5. Endpoints de la API Loggex

Bajo `/api/catalogo/*`, **read-only** desde el front:

| Endpoint | Uso | Auth |
|---|---|---|
| `GET /api/catalogo/itinerarios?etapa=&q=&ccaa=&itemsPerPage=20` | Buscar ciclos/cursos/grados — alimenta `AsyncSearchSelect` | autenticado |
| `GET /api/catalogo/itinerarios/{id}` | Detalle con currículo expandido | autenticado |
| `GET /api/catalogo/centros?ccaa=&q=&itemsPerPage=20` | Autocompletar alta de Centro | autenticado |
| `GET /api/catalogo/etapas` | Lista de etapas educativas (enum) | autenticado |
| `GET /api/catalogo/familias` | Familias profesionales / modalidades | autenticado |
| `POST /api/catalogo/refresh/{fuente}` | Disparar ingesta manual | `ROLE_SUPERADMIN` |
| `GET /api/catalogo/refresh/status` | Estado de las últimas ingestas | `ROLE_SUPERADMIN` |

Todas las consultas usan el `SearchAnyFilter` ya existente en backend (sección de `docs/async-select.md`). El frontend reutiliza `AsyncSearchSelect` sin tocar nada.

---

## 6. UX en Loggex

### 6.1 Modal "Nuevo Ciclo / Curso"

Antes (esto):

```
[ Nombre del ciclo: ___________ ]
[ Nivel: [Básico/Medio/Superior] ]
[ Familia: ___________ ]
[ Código oficial: ___________ ]
[ Curso: 1 / 2 ]
[ Horas: ___ ]
…
```

Después:

```
┌─ ¿De dónde sacamos los datos? ──────────────────────┐
│  ◉ Catálogo oficial (recomendado)                   │
│  ○ Definir manualmente                              │
└─────────────────────────────────────────────────────┘

[ Etapa educativa: [ FP Superior ▾ ] ]

[ Buscar en el catálogo: 🔍 desarrollo___________ ]
   ▷ Desarrollo de Aplicaciones Web (IFC32)
   ▷ Desarrollo de Aplicaciones Multiplataforma (IFC30)
   ▷ Desarrollo de Productos Audiovisuales… (IMG…)

[ Resumen del ciclo seleccionado ]
  • Familia: Informática y Comunicaciones
  • Duración: 2.000 horas (2 cursos)
  • Currículo: 14 módulos predefinidos (se crearán automáticamente)
  • Normativa: Real Decreto 686/2010
  • Vigente desde: 2010-09-01
```

Al pulsar "Crear", se materializa todo (ciclo + 14 módulos automáticos). El admin puede luego editar lo que necesite (p. ej. asignar profesores a cada módulo).

### 6.2 Modal "Nuevo Centro" (alta por SuperAdmin)

Idéntico patrón pero contra `/api/catalogo/centros`. Al seleccionar un centro del registro oficial, se autocompleta nombre, CIF/código, dirección, titularidad. El SuperAdmin solo añade la configuración propia de Loggex (logo, personalización, admins…).

### 6.3 Indicador de procedencia

En la tabla de ciclos, junto al nombre, un icono pequeño que indique:

- 🏛 **Oficial sincronizado** (catalogoOrigen != null y hash actualizado)
- ⚠ **Oficial desincronizado** (catalogoOrigen != null pero la fuente cambió desde el alta — invitación a revisar)
- ✏ **Manual** (sin catalogoOrigen)

El mismo indicador se aplica a Festivos, PeriodoEvaluativo y Centros con su catálogo correspondiente.

### 6.4 Importar calendario escolar oficial

En `/festivos` (o en una nueva sección `/calendario`), un botón "Importar calendario oficial":

```
┌─ Importar calendario oficial ───────────────────────┐
│                                                     │
│  CCAA         [ Andalucía ▾ ]                       │
│  Etapa        [ ESO / Bachillerato / FP ▾ ]         │
│  Curso        [ 2025-2026 ▾ ]                       │
│                                                     │
│  Vista previa:                                      │
│  • Inicio del curso: 11 sep 2025                    │
│  • Fin del curso:    23 jun 2026                    │
│  • Festivos a importar: 14                          │
│  • Sesiones de evaluación: 6 (3 trimestrales +      │
│    1 ordinaria final + 2 extraordinarias)           │
│  • No lectivos pedagógicos: 2                       │
│                                                     │
│  Normativa: Orden 15/06/2025 (BOJA nº 117)          │
│                                                     │
│  ☑ Importar festivos al centro                      │
│  ☑ Crear periodos de evaluación para grupos:        │
│     [ ☑ Todos los grupos del año académico ▾ ]      │
│                                                     │
│  [ Cancelar ]      [ Importar al centro ]           │
└─────────────────────────────────────────────────────┘
```

Tras la importación:

- Los `Festivo` aparecen en la lista del centro con icono 🏛.
- Los `PeriodoEvaluativo` se crean para los grupos seleccionados.
- El admin puede añadir festivos locales (los 2 del municipio + los puentes que decida el centro) como entradas manuales con icono ✏.

Si al año siguiente la Junta publica una nueva Orden y se actualiza el catálogo, el admin ve un aviso *"Calendario 2026-2027 ya disponible — importar"* y repite el flujo. El catálogo nunca borra nada del centro: solo añade/sugiere.

---

## 7. Plan en fases

**Fase 0 — Infraestructura común (1 semana de trabajo)** ✅ **COMPLETADA**
- Modelo de datos (entidades `Catalogo*`).
- Comando `app:catalogo:refresh` skeleton.
- Endpoints `/api/catalogo/*` skeleton (sin datos aún).
- Cache Redis con tags.
- Refactor mínimo: añadir `catalogoOrigen` nullable a `CicloFormativo`, `Modulo`, `Centro`.

**Fase 1 — MVP con FP nacional (2 semanas)** ⚠️ **PARCIAL**

Hecho:
- `TodoFpJsonAdapter` (bootstrap con dataset curado a mano).
- 4 ciclos de informática (IFC22, IFC31, IFC32, IFC33) con sus 52 módulos.
- Materialización backend + UX `/ciclos → Nuevo` con toggle catálogo/manual.
- Pipeline end-to-end demostrado.

Pendiente (lo cubren las fases 1.6 y 1.7):
- Datos verificables contra fuente oficial (no escritos a mano).
- Cobertura completa de los 185 ciclos.
- Horas por módulo extraídas del BOE.

**Fase 1.6 — TodoFpHttpAdapter (1-2 semanas)** ⏳ **SIGUIENTE**
- Scraper HTTP de TodoFP que produce los 185 ciclos del catálogo nacional.
- Cobertura de metadata: código, nombre, familia, nivel, duración total, URL del RD, lista de módulos sin horas.
- Tests de snapshot por cada selector crítico.
- Estrategia detallada en sección 15.1.

**Fase 1.7 — BoeRdAdapter (1-2 semanas)** ⏳
- Parser del XML/PDF del BOE para cada RD enlazado.
- Completa `horasTotales` y `horasSemanales` por módulo.
- Estrategia detallada en sección 15.2.

**Fase 1.5 — Calendario escolar (1 semana)**
- Entidades `CatalogoCalendarioEscolar` y `CatalogoPeriodoCalendario`.
- `BoeBojaCalendarioAdapter` v1: parser de la Orden anual del BOJA para Andalucía.
- UX para importar al centro (sección 6.4).
- FK `catalogoOrigen` en `Festivo` y `PeriodoEvaluativo`.
- Detección y aviso de calendario nuevo cada curso.

**Fase 2 — Centros docentes (1 semana)**
- `JuntaAndaluciaCentrosAdapter` (API REST oficial — la única "fácil").
- `RegistroEstatalCentrosAdapter` para el resto de CCAA (scrapeado).
- UX en `/centros → Nuevo`.

**Fase 3 — ESO + Bachillerato (3 semanas)**
- `BoeBojaAdapter` con parser de ELI XML del BOE.
- Capa CCAA opcional (Andalucía como referencia).
- Modalidades de Bachillerato + asignaturas troncales/específicas.
- UX adaptada (etapa selector → carga distinta UI).

**Fase 4 — Universidad: grados (3 semanas)**
- `RuctAdapter` para los títulos oficiales.
- Sin plan de estudios todavía (solo el grado).
- UX para crear "ciclos universitarios" como entidad genérica.

**Fase 5 — Plan de estudios universitarios (?)**
- Cada universidad publica el plan de estudios en su web sin formato común.
- Solución probable: ingesta manual asistida por SuperAdmin (CSV upload por universidad), no scraping.

**Fase 6 — Primaria (1 semana)**
- LOMLOE en BOE + currículo CCAA.
- Reusa la infraestructura de Fase 3.

**Fase 7 — Mantenimiento continuo**
- Monitor de salud de adapters.
- Auditoría de cambios mostrada al SuperAdmin.

---

## 8. Riesgos y plan de fallback

### 8.1 Scrapers se rompen

**Probabilidad:** alta. TodoFP cambia su HTML cada cierto tiempo, los PDFs no tienen estructura garantizada, el BOE/BOJA varía en sus plantillas ELI.

**Mitigación:**
- Tests de snapshot: cada adapter tiene un fixture HTML/PDF de referencia y un test que falla si el parser produce un DTO distinto.
- Alertas: tras 3 fallos consecutivos de un adapter, notificación al SuperAdmin.
- Fallback graceful: si el adapter falla, el catálogo no se actualiza pero **no se borra**. Los datos antiguos siguen disponibles. El admin sigue pudiendo crear ciclos manualmente.

### 8.2 Currículos regionales divergen

**Problema:** un Ciclo de FP es nacional en código y horas totales, pero su desarrollo curricular concreto (qué se da en cada módulo) lo regula cada CCAA. Andalucía → Decreto. Madrid → otro.

**Mitigación:**
- `CatalogoItinerario.ccaa` permite tener varias entradas para el mismo `codigoOficial` con currículos distintos.
- Al crear un ciclo en Loggex, el centro elige la versión que corresponde a su CCAA.
- En el MVP solo modelamos el currículo nacional; las variantes CCAA llegan en Fase 3.

### 8.3 La Junta cambia la API de centros

**Probabilidad:** baja (es una API oficial con OpenAPI documentado), pero existe.

**Mitigación:**
- Adapter aislado, fácil de reescribir.
- Cache Redis aguanta varios días de outage sin afectar UX.

### 8.4 Saturar las fuentes con scraping

**Mitigación:**
- Rate limiting en cada adapter: máx 1 req/segundo, respetando `robots.txt`.
- Cache HTTP con `If-Modified-Since` cuando la fuente lo soporta.
- Ejecutar cron en horarios de baja actividad (madrugada).

### 8.5 LegalIty del scraping

**Cuestión:** ¿Está permitido scrapeear TodoFP / BOE / etc.?

**Análisis:**
- BOE/BOJA: contenido público por definición. Sin restricciones.
- TodoFP: web pública del Ministerio sin login. Términos de uso permiten consulta personal/educativa; un scraper consume datos para uso interno de Loggex (no redistribución masiva). Riesgo bajo.
- Junta de Andalucía: API oficial pensada precisamente para esto, licencia abierta.
- Universidades: cada una con sus términos. Hay que revisar caso por caso.

**Recomendación:** documentar el scraper de TodoFP con respect a `robots.txt`, y publicar atribución clara en Loggex ("datos basados en TodoFP del Ministerio de Educación, FP y Deportes").

### 8.6 Calendario publicado tarde

**Problema:** las CCAA publican la Orden de calendario escolar a veces en mayo, otras veces en julio del curso anterior. Si un centro quiere preparar el curso 2026-2027 en junio y la Junta aún no ha publicado la Orden, el catálogo está vacío para ese curso.

**Mitigación:**
- El admin sigue pudiendo crear festivos manualmente; la importación oficial es una ayuda, no un bloqueo.
- El catálogo ofrece, mientras tanto, "calendario provisional basado en el del curso anterior" como sugerencia (con etiqueta clara de que es estimación). Cuando la Orden real se publique, el sistema avisa al admin para sincronizar.

### 8.7 Currículos con horas semanales que no salen redondas

**Problema:** algunos planes oficiales (especialmente FP) reparten las horas totales en horas semanales no enteras (p. ej. 3.5 h/semana porque 105 h / 30 semanas = 3.5).

**Mitigación:**
- `horasSemanales` es `decimal(4,2)` no entero.
- En el horario lectivo (`Horario`), las sesiones siguen siendo de 1h o 0.5h; el sistema tolera que la suma semanal redondee al alza o a la baja respecto al currículo, dejando un campo de holgura aceptable (±10%) y avisando si se supera.

### 8.8 Coste operativo

**Cuestión:** ¿esto encarece el hosting?

**Estimación:** 
- BD del catálogo completo: <100 MB (tablas pequeñas, bien indexadas).
- Cache Redis: <50 MB (solo queries calientes).
- Scrapers en workers: ~5 minutos por ejecución mensual de TodoFP. Negligible.

**Conclusión:** coste operativo despreciable.

---

## 9. Trabajo estimado y orden

| Fase | Esfuerzo | Aporta valor | Estado |
|---|---|---|---|
| 0 — Infra | 1 semana | Sin demo, base para todo | ✅ Done |
| 1 — FP nacional (bootstrap JSON) | 2 semanas | **Demo vendible** — pipeline end-to-end con datos provisionales | ⚠️ Parcial |
| 1.6 — TodoFpHttpAdapter | 1-2 semanas | Datos oficiales: 185 ciclos verificables vs 4 a mano | ⏳ Siguiente |
| 1.7 — BoeRdAdapter | 1-2 semanas | Horas por módulo desde el BOE | ⏳ |
| 1.5 — Calendario escolar | 1 semana | Habilita reportes oficiales y elimina trabajo manual cada inicio de curso | ⏳ |
| 2 — Centros | 1 semana | Mejora alta administrativa | ⏳ |
| 3 — ESO + Bach | 3 semanas | Cubre la mayoría de centros no-FP | ⏳ |
| 4 — Grados RUCT | 3 semanas | Habilita universidades | ⏳ |
| 5 — Plan uni | indef. | Solo si hay demanda real | ⏳ |
| 6 — Primaria | 1 semana | Cierra la cobertura | ⏳ |

**Total bloque 0+1+1.6+1.7+1.5+2 (lo que merece la pena hacer ya):** 8-9 semanas.

El resto se aborda según evolución del proyecto y feedback de centros piloto. La arquitectura está pensada para que cada fase añada un Adapter sin tocar las demás.

---

## 10. Decisiones abiertas

- ¿Diferenciamos `CatalogoItinerario` por entidad (CicloFP, ModalidadBach, GradoUni…) o lo mantenemos polimórfico con `etapa`? **Recomendación: polimórfico con discriminador**, hasta ver si el dominio justifica clases hijas.
- ¿Permitir al SuperAdmin "promover" un ciclo manual a referencia oficial? **No en MVP**, más complejidad de la que aporta.
- ¿Internacionalización del catálogo (catalán, euskera, gallego, valenciano)? **Aplazado**: empezar en español castellano, los nombres oficiales de los ciclos están en castellano en el BOE.
- ¿Versionado del catálogo (snapshot histórico)? **Por implementación**: el campo `vigenteHasta` y conservar registros retirados ya da trazabilidad mínima. Snapshots completos son fase 7.

---

## 11. Próximo paso concreto

A fecha de **2026-04-25**, completadas Fase 0 + Fase 1 (parcial con bootstrap JSON). El siguiente trabajo es la **Fase 1.6 — TodoFpHttpAdapter** (sección 15.1).

### Pasos para Fase 1.6 + 1.7 (bloque)

Decidido en log 2026-04-25 (sección 13.4): ejecutamos las dos fases juntas porque ninguna por separado entrega valor superior al estado actual.

**A — Inspección y documentación** ✅ COMPLETADO
- Inspección manual del HTML de TodoFP (3 páginas tipo) — sección 14.
- `SELECTORS.md` con selectores y estrategia resiliente al reordenamiento de columnas.
- Decisión: HTTP+DomCrawler suficiente, sin Panther.

**B — TodoFpHttpAdapter** ⏳
- Crear `App\Catalogo\Source\TodoFpHttpAdapter` con `HttpClient` + `DomCrawler`.
- Implementar 2 niveles de scraping: index de familias → tablas por familia.
- Producir `CatalogoItinerarioDto` con: nombre, etapa, familia, nivel, `boletinUrl` (RD), URL del currículo, materias = `[]`, codigoOficial = placeholder (a sobrescribir por BOE).
- Throttle: 1 req/segundo respetando `robots.txt`.

**C — Inspección manual del XML del BOE**
- Descargar 2-3 RDs ELI XML como muestra (DAW, ASIR, SMR).
- Identificar patrón estructural común: dónde está el `codigoOficial`, dónde la lista de módulos, dónde las horas.
- Documentar en `backend/src/Catalogo/Source/BoeRd/BOE_XML_STRUCTURE.md`.

**D — BoeRdAdapter**
- Crear `App\Catalogo\Source\BoeRdAdapter` que itera los `CatalogoItinerario` con `boletinUrl` apuntando al BOE y `codigoOficial` placeholder.
- Para cada uno, fetch del XML ELI, parser, update incremental: `codigoOficial`, `vigenteDesde`, materias completas (código + nombre + horas + curso).
- También fetchea el "Currículo Ministerio" (segundo RD) si tiene horas detalladas.

**E — Fixtures y tests**
- `backend/tests/Fixtures/todofp/familias-index.html`, `familia-informatica.html`.
- `backend/tests/Fixtures/boe/rd-686-2010.xml` (DAW), `rd-1629-2009.xml` (ASIR).
- Tests de snapshot que detectan cambios de estructura.

**F — Refresh end-to-end**
- `app:catalogo:refresh todofp_http` → 185 itinerarios esqueleto.
- `app:catalogo:refresh boe_rd` → módulos y códigos completos.
- Verificar BD: 185 itinerarios con código oficial + ~2000 materias totales.

**G — Limpieza del JSON**
- Una vez los datos del scraper estén validados, borrar `fuente_ingesta='todofp_json'` de la BD.
- Eliminar `TodoFpJsonAdapter.php` del código.
- Eliminar `data/catalogo/todofp/itinerarios-fp.json`.
- Documentar en sección 13.4 la fecha de retirada.

### Después de 1.6+1.7

- **Fase 1.5 (Calendario escolar)** — `BoeBojaCalendarioAdapter`.
- **Fase 2 (Centros)** — adapter andaluz + estatal.

Cada adapter es trabajo aislado, no bloquea a los siguientes. La infraestructura común (Fase 0) ya está, así que cualquier adapter nuevo es solo: implementar la interface, registrar en `services.yaml`, ejecutar.

---

## 12. Refactor de nomenclatura: de FP-only a multi-etapa

> **Status:** pendiente. Es el bloqueador más importante para que Loggex deje de ser "una herramienta de FP" y pase a ser "una plataforma de gestión académica". No tiene sentido lanzar Fase 3 (ESO + Bach) sin haber hecho antes este refactor, o como mínimo decidido la estrategia. Queda documentado aquí para que no se ignore.

### 12.1 Por qué es necesario

Loggex se diseñó originalmente para Formación Profesional. Esa decisión inicial caló en **toda** la pila — base de datos, entidades Doctrine, controladores, rutas API, componentes React, claves i18n, copys de la UI, documentación. Pero la visión del proyecto (ver introducción de este documento) abarca cualquier nivel educativo: Primaria, ESO, Bachillerato, FP, Universidad.

El choque concreto:

- En FP existen **"ciclos formativos"** que se componen de **"módulos"**. Una clase es una **"impartición"** (profesor + módulo + grupo).
- En ESO/Bach/Primaria no hay ciclos: hay **"cursos"** o **"etapas"** con **"asignaturas"**. Las "imparticiones" se llaman simplemente "asignaciones docentes".
- En Universidad hay **"grados"/"másteres"** con **"asignaturas"** que valen ECTS.

Si un IES de ESO entra hoy a Loggex y crea un grupo, el sistema le pide que lo asocie a un *"ciclo formativo"* y a *"módulos"*. El admin del IES no entiende esa terminología — para él son "1º ESO" y "Lengua Castellana", no un ciclo y un módulo. La aplicación queda inutilizable o, en el mejor caso, parece amateur.

El refactor cubre dos planos:

1. **Plano semántico de datos** (entidades, tablas, columnas, FKs). El nombre del concepto a nivel código y BD.
2. **Plano de presentación** (UI, copys, rutas, i18n). Lo que el admin ve.

Ambos están entrelazados ahora mismo. Hay que separarlos.

### 12.2 Inventario de lo que está acoplado a FP

#### 12.2.1 Backend: entidades y tablas

| Entidad / tabla actual | Concepto | Propuesta multi-etapa | Comentario |
|---|---|---|---|
| `CicloFormativo` / `ciclo_formativo` | Programa formativo de un grupo | `ItinerarioFormativo` o `ProgramaEducativo` o `Plan` | El más invasivo. Aparece en muchos joins. |
| `Modulo` / `modulo` | Unidad docente de un programa | `Materia` o `UnidadDocente` | "Asignatura" suena natural pero choca con el dialecto FP. "Materia" es más neutro y se entiende en todas las etapas. |
| `Imparticion` / `imparticion` | Profesor + materia + grupo | `Docencia` o `Asignacion` | "Imparticion" no es palabra estrictamente FP, pero se lee así por contexto. |
| `Tarea` / `tarea` | Actividad evaluable | (igual) | OK, neutro. |
| `Entrega` / `entrega` | Entrega del alumno | (igual) | OK. |
| `Calificacion` / `calificacion` | Nota | (igual) | OK. |
| `Grupo` / `grupo` | Conjunto de alumnos | (igual) | OK; el campo `curso` ya admite distintos significados. |
| `Matricula` / `matricula` | Inscripción alumno↔grupo | (igual) | OK. |
| `PeriodoEvaluativo` / `periodo_evaluativo` | Trimestre / cuatrimestre | (igual) | Neutro. |
| `Asistencia`, `Material`, `Festivo`, `Centro`, `User`, `Mensaje`, `Comunicado` | — | (igual) | Todos neutros. |

Conclusión: **3 entidades** acopladas a FP por nombre (`CicloFormativo`, `Modulo`, `Imparticion`). El resto del modelo es ya neutro.

Pero esas 3 son justamente las entidades centrales del dominio académico, así que su refactor toca **todo**: relaciones, repositorios, fixtures, migraciones, fixtures de test, fixtures de seed, controladores, normalizadores, DTOs, filtros, columnas de DataTable.

#### 12.2.2 Backend: rutas API y código

- `/api/ciclo_formativos` (autogenerada por API Platform).
- `/api/modulos`.
- `/api/imparticions` (sí, con typo plural inglés — bug histórico que también convendría arreglar al renombrar).
- Filtros y SearchFilters declarados con paths `ciclo.nombre`, `modulo.nombre`, `imparticion.modulo`, etc.
- `CurrentUserExtension` con whitelist de clases, varias FP-céntricas.
- Repositorios `CicloFormativoRepository`, `ModuloRepository`, `ImparticionRepository`.
- Mensajería i18n del backend (errores) con cadenas tipo *"No se ha podido borrar el ciclo formativo"*.

#### 12.2.3 Frontend: rutas, componentes, i18n

| Capa | Estado actual | Cambio necesario |
|---|---|---|
| Rutas SPA | `/ciclos`, `/modulos`, `/imparticiones` | Rutas neutras. Posible: `/programas`, `/materias`, `/docencias`. O mantener URLs por compatibilidad y solo cambiar labels. |
| Páginas | `pages/CiclosFormativos.jsx`, `pages/Modulos.jsx`, `pages/Imparticiones.jsx` | Renombrar archivos + clases internas. |
| Sidebar | Items con etiquetas "Ciclos", "Módulos", "Imparticiones" | Etiquetas dinámicas según etapa principal del centro o agnósticas. |
| Modales | Títulos "Nuevo ciclo formativo", "Nuevo módulo" | Adaptar a la etapa: el modal de "nuevo programa" muestra "Nuevo ciclo"/"Nueva modalidad"/"Nuevo grado" según contexto. |
| Componentes auxiliares | `ModuloLabel.jsx` | Renombrar a `MateriaLabel.jsx`. |
| Claves i18n | `cycles.*`, `modules.*`, `teaching.*` (53 + 47 + 31 ocurrencias aprox.) | Migrar a `programs.*`, `subjects.*`, `lessons.*` con scripts de búsqueda y reemplazo. Mantener un alias de compatibilidad durante una transición. |
| Copy en español | "Ciclo Formativo", "Módulo", "Impartición" | Por nivel: en FP siguen apareciendo (es el término oficial), en ESO/Bach pasan a "Curso"/"Asignatura"/"Asignación". |

#### 12.2.4 Documentación, scripts, datos

- `CLAUDE.md` lista entidades como `CicloFormativo`, `Modulo`, `Imparticion`. Mantenerlo coherente.
- Fixtures Doctrine en `backend/src/DataFixtures/` — habrá que regenerarlas cuando cambien los nombres.
- `docs/sistema-toasts.md` y otros docs internos — referencias menores.
- `backup_tfg*.sql` — backups con el esquema antiguo. Tras la migración los backups viejos no se podrán restaurar sin transformación.
- Scripts `scripts/init.sh`, `scripts/seed_calificaciones.sql`, `scripts/regen_fixtures.py` — referencias a tablas.

### 12.3 Estrategias posibles

#### Estrategia A — Solo capa de presentación (cambio cosmético)

Dejar entidades, tablas y rutas API como están. Solo cambiar **etiquetas de UI** según la etapa del centro/grupo: el mismo registro de `CicloFormativo` se muestra como "Ciclo" en FP y como "Curso" en ESO.

- **Pros:** trabajo mínimo. Cero migraciones de BD. APIs siguen funcionando.
- **Contras:** mentira semántica. Cualquier desarrollador nuevo lee el código y se pregunta *"¿por qué un curso de 1º ESO está en la tabla `ciclo_formativo`?"*. La deuda técnica se cronifica. Las migraciones futuras (importar de catálogo no-FP) escupen datos en tablas con nombre engañoso.

#### Estrategia B — Refactor profundo (rename masivo)

Renombrar entidades, tablas, columnas, rutas, claves i18n, componentes. Migración de datos completa.

- **Pros:** dominio limpio y honesto. Onboarding de devs nuevos sin rozaduras. Diccionario único para la próxima década.
- **Contras:** **muy costoso** (estimación abajo). Migración de datos invasiva. Rompe URLs, rompe APIs si hay clientes externos (móvil), rompe backups antiguos. Una semana sin features mientras se ejecuta.

#### Estrategia C — Híbrido (renombrar entidades, mantener tablas con aliases)

Renombrar **clases PHP/JS** (capa lógica) pero **dejar las tablas con su nombre actual** vía atributos `#[ORM\Table(name: 'ciclo_formativo')]`. APIs existentes mantienen sus URLs vía `uriTemplate` explícito en `#[ApiResource]`. Solo el código nuevo usa los nombres limpios.

- **Pros:** ahorra la migración de datos. Devs nuevos solo ven los nombres limpios. Compatibilidad de APIs.
- **Contras:** la BD queda en un limbo donde el dev tiene que recordar que `ItinerarioFormativo` mapea a `ciclo_formativo`. Pasa el problema al SQL crudo.

### 12.4 Estrategia recomendada

**Híbrido (C) en lo profundo + retoques cosméticos (A) en el corto plazo.**

Razones:

- La migración masiva de tablas (Estrategia B) es un proyecto de 2-3 semanas con riesgo alto y casi cero valor añadido para el usuario final. No la haríamos hasta tener un cliente real que justifique el esfuerzo.
- La Estrategia A pura (solo etiquetas) ya nos rompe ahora porque el catálogo oficial (este documento) introduce las entidades `Catalogo*` con nombres limpios y multi-etapa. Tener `CatalogoItinerario` apuntando a `CicloFormativo` ya empieza a oler raro.
- La C nos da un compromiso razonable: el nuevo código (catálogo, próximos features) usa nomenclatura limpia. El código viejo sigue funcionando. Las tablas viejas se dejan estar.

**Plan concreto:**

1. **Renombrar clases PHP** sin tocar tablas:
   - `CicloFormativo` → `ItinerarioFormativo` (clase) pero `#[ORM\Table(name: 'ciclo_formativo')]`.
   - `Modulo` → `Materia` (clase) pero `#[ORM\Table(name: 'modulo')]`.
   - `Imparticion` → `Docencia` (clase) pero `#[ORM\Table(name: 'imparticion')]`.
2. **Renombrar componentes y páginas frontend** (archivos JSX) manteniendo rutas SPA actuales por backwards-compat. Cambiar URLs es opcional, en otra ronda.
3. **Generalizar copys e i18n** con un `useTerminologia(etapa)` hook que devuelve el label correcto según el contexto. *"Ciclo"* en FP, *"Curso"* en ESO, *"Modalidad"* en Bach, *"Grado"* en Universidad. El admin del centro elige (o se infiere por el catálogo).
4. **APIs**: mantener `/api/ciclo_formativos` para no romper clientes (sería breaking change). Cuando exista una API v2 o un cliente nuevo, ofrecer `/api/itinerarios` como alias.
5. **Documentación interna** (`CLAUDE.md`, `docs/*.md`): actualizar a la nomenclatura nueva, dejando notas históricas donde haga falta.

Para los siguientes 3-6 meses esto es suficiente. La migración total de tablas (Estrategia B) puede ejecutarse cuando haya tiempo "de oficina" — un sprint dedicado entre lanzamientos de features — sin bloquear nada.

### 12.5 Plan en sub-fases

| Sub-fase | Esfuerzo | Bloquea a |
|---|---|---|
| 12.A — Hook `useTerminologia` + diccionario base | 2 días | Nada (puro frontend, no rompe) |
| 12.B — Renombrar componentes JSX (`Modulos.jsx` → `Materias.jsx`, etc.) | 3 días | Hay que actualizar imports y rutas internas |
| 12.C — Renombrar clases PHP (mantener tablas) | 5 días | API contracts: requiere `uriTemplate` explícito en `#[ApiResource]` |
| 12.D — Generalizar i18n keys (`cycles.*` → `programs.*`) con alias | 3 días | Toda la UI; alias para no romper traducciones existentes |
| 12.E — Actualizar copys españoles según etapa | 2 días | Tras 12.A |
| 12.F — Actualizar `CLAUDE.md` y docs internos | 1 día | Final, una vez todo lo demás esté consistente |
| 12.G *(opcional, futuro)* — Migrar tablas de BD a nombres limpios | 2-3 semanas | Bloquea features mientras se ejecuta |

**Total bloque obligatorio (12.A-12.F):** ~3 semanas. Encaja como **bloqueador previo a Fase 3** del catálogo (cuando arranque ESO/Bach).

### 12.6 Migración de datos (si en algún momento se ejecuta 12.G)

Si en el futuro ejecutamos 12.G:

1. Migración Doctrine que crea las tablas nuevas (`itinerario_formativo`, `materia`, `docencia`).
2. Migración SQL que copia datos: `INSERT INTO itinerario_formativo SELECT * FROM ciclo_formativo`.
3. Migración que actualiza FKs en tablas dependientes: `UPDATE grupo SET itinerario_formativo_id = ciclo_id`, etc.
4. Borrar tablas viejas (con backup previo).
5. Renombrar atributos `#[ORM\Table]` para apuntar a las nuevas tablas.

Tiempo estimado de ventana de mantenimiento: **2-4 horas** para una BD de tamaño medio (decenas de miles de filas). Para evitar downtime se puede hacer con doble escritura durante una transición.

### 12.7 Riesgos

- **APIs externas**: si Loggex llega a tener una app móvil o integraciones B2B, cualquier cambio de URL/recurso es breaking. Antes de tocar `/api/*` hay que inventariar consumidores. Hoy no hay ninguno (sección 5.3 del doc de autenticación).
- **Marcadores y URLs guardadas**: usuarios que tengan `https://centro.loggex.com/ciclos` guardado verán 404 si cambiamos a `/programas`. Mitigación: redirect 301 permanente.
- **Backups antiguos**: los `backup_tfg*.sql` ya no se podrán restaurar tal cual tras el rename de tablas (12.G). Se mantiene un script de transformación en `scripts/migrate_backup_to_v2.sh` que cualquiera puede aplicar a un dump viejo para adaptarlo.
- **Búsqueda en logs/issues antiguos**: cualquier referencia a "Ciclo Formativo" en issues, commits o documentación queda como referencia histórica. Conviene NO reescribir el historial git para preservar trazabilidad.
- **Equipo nuevo**: durante la transición convivirán dos terminologías. Hay que comunicarlo al onboarding.

### 12.8 Estimación final y recomendación de cuándo

| Bloque | Duración | Cuándo encaja |
|---|---|---|
| 12.A → 12.F (estrategia C) | ~3 semanas | **Antes de Fase 3** del catálogo (ESO + Bach) |
| 12.G (opcional, estrategia B completa) | 2-3 semanas | Cuando se quiera limpieza arqueológica del esquema, sin bloquear features. Probablemente nunca, salvo razón estratégica. |

**Recomendación:** ejecutar 12.A-12.F como **prerrequisito de Fase 3**. Sin esto, importar el catálogo de ESO funciona técnicamente pero es UX inadmisible (admin de IES viendo "Nuevo módulo de FP" cuando intenta crear "Lengua Castellana"). 12.G se aplaza sine die.

---

## 13. Estado de implementación (snapshot abril 2026)

Este apartado registra lo que está construido y operativo a fecha de **2026-04-25**. Sirve para que cualquiera (yo dentro de un mes, otro colaborador, futuro auditor) sepa exactamente qué hay sin tener que leer commits.

### 13.1 Fase 0 — Infraestructura común ✅

Todo el cableado base está hecho:

- Entidades Doctrine: `CatalogoItinerario`, `CatalogoMateria`, `CatalogoCentro` (más enums `EtapaEducativa`, `TipoMateria`, `Titularidad`).
- Migración `Version20260425160000` aplicada — tablas + FKs `catalogo_origen_id` en `ciclo_formativo`, `modulo`, `centro`.
- DTOs: `CatalogoItinerarioDto`, `CatalogoMateriaDto`, `CatalogoCentroDto`.
- `CatalogoSourceAdapterInterface` + `CatalogoSourceAdapterRegistry` (auto-tag vía `_instanceof`).
- `CatalogoIngestService` con UPSERT idempotente, hash, dry-run y marcado de retirados.
- Comando `app:catalogo:refresh [fuente] [--dry-run] [--list]`.
- API REST autogenerada (read-only) con `SearchAnyFilter`: `/api/catalogo_itinerarios`, `/api/catalogo_materias`, `/api/catalogo_centros`.
- `role_hierarchy` con `ROLE_SUPERADMIN: [ROLE_ADMIN]` para que controllers protegidos con `IsGranted('ROLE_ADMIN')` los pueda usar también un SuperAdmin.

### 13.2 Fase 1 — MVP con FP nacional ⚠️ parcialmente completa

**Lo que sí está hecho:**

- `TodoFpJsonAdapter` (lee de `backend/data/catalogo/todofp/itinerarios-fp.json`).
- JSON curado a mano con 4 ciclos de Informática y Comunicaciones: IFC22 (SMR), IFC31 (ASIR), IFC32 (DAW), IFC33 (DAM) — total 52 módulos.
- `DummyFixturesAdapter` para smoke test (ya retirado de uso productivo).
- Endpoint backend `POST /api/ciclos/from-catalogo` (controller `CatalogoMaterializationController`) que recibe el id del itinerario y crea `CicloFormativo` + sus `Modulo` automáticamente, todo con `catalogoOrigen` trazado.
- Frontend: modal de Nuevo Ciclo con toggle **Catálogo / Manual**, `AsyncSearchSelect` filtrado a etapas FP, vista previa del itinerario seleccionado (familia, nivel, duración, número de módulos, normativa) y materialización al confirmar.

**Lo que NO está hecho (por eso ⚠️):**

- Los datos del JSON los **escribí yo basándome en mi conocimiento general**, no provienen de TodoFP ni del BOE. Los códigos de módulos pueden tener pequeñas inexactitudes. Las horas semanales son representativas pero no garantizadas.
- Cobertura: 4 ciclos de 185 (~2%).
- No hay link al BOE verificable en cada entrada.
- No hay variantes por CCAA.

**El JSON cumple su función como bootstrap** (permite probar el flujo end-to-end y demostrar la feature), pero **no es lo definitivo**. La sustitución por una fuente oficial real está documentada en las secciones 14 y 15.

### 13.3 Lo que falta para cerrar Fase 1 de verdad

1. Sustituir el JSON curado por scraping real de TodoFP (Fase 1.6, ver sección 15).
2. Añadir parser BOE para extraer horas por módulo (Fase 1.7).
3. Limpiar el JSON cuando los scrapers cubran todo. Borrar `DummyFixturesAdapter`.

### 13.4 Log de decisiones

**2026-04-25 — Decisión: ejecutar 1.6 + 1.7 en bloque (opción A).**
Análisis previo en sección 14 mostró que TodoFP no expone ni el código oficial ni los módulos detallados — solo enumera ciclos y enlaza al RD del BOE. Si paramos en 1.6, los itinerarios serían "esqueletos sin código ni módulos", lo que sería **regresión** respecto al JSON actual. Por eso hacemos 1.6 + 1.7 juntas como un único entregable. Estimación: 3-4 semanas en lugar de 2+2 secuenciales (gracias a fixtures e integración compartidas). Cuando esto cierre, se elimina el `TodoFpJsonAdapter` y el JSON `itinerarios-fp.json`.

**2026-04-25 — Decisión: NO usar `symfony/panther`.**
Inspección manual del HTML de TodoFP (3 páginas tipo) confirma que el contenido relevante es estático. `Symfony\Contracts\HttpClient` + `Symfony\Component\DomCrawler` es suficiente. Evita la dependencia pesada de Chromium headless en producción.

**2026-04-25 — Decisión: TodoFP es índice, BOE es fuente real del detalle.**
TodoFP no expone código oficial (IFC32, etc.) ni tabla estructurada de módulos. El detalle vive solo en el RD del BOE. Por tanto:
- `TodoFpHttpAdapter` produce solo metadata: nombre, etapa, familia, nivel, URL del RD del BOE, URL del currículo.
- `BoeRdAdapter` lee el XML ELI de cada RD enlazado y completa: código oficial, módulos con códigos y nombres, horas totales/semanales por módulo, fecha de vigencia.
- Ambos adapters trabajan secuencialmente sobre los mismos `CatalogoItinerario` (TodoFP los crea, BOE los enriquece).

---

## 14. Análisis de fuentes oficiales

Antes de programar el scraper hay que evaluar honestamente qué nos puede dar cada fuente para no caer en falsas expectativas. Esta sección documenta el análisis.

### 14.1 Comparativa por fuente

| Fuente | URL canónica | Autoridad | Cobertura | Frescura | Scraping estable |
|---|---|---|---|---|---|
| **TodoFP** | `todofp.es` | ⭐⭐⭐⭐⭐ Ministerio | Metadata estatal de los 185 ciclos. Lista de módulos sin horas. | Lag de semanas/meses tras un RD nuevo. | ⭐⭐⭐ HTML CMS, cambia periódicamente. |
| **BOE** | `boe.es` (ELI) | ⭐⭐⭐⭐⭐⭐ El BOE *es* la fuente. | Currículo completo: módulos + horas + competencias. | Real-time (es donde se publican). | ⭐⭐⭐⭐ XML estructurado con ELI; PDF para legibilidad humana. |
| **BOJA** | `juntadeandalucia.es/boja` | ⭐⭐⭐⭐⭐ regional | Variantes andaluzas del currículo. | Lag pequeño tras BOE. | ⭐⭐⭐ Similar al BOE pero menos uniforme. |
| **DOCM, DOG, …** | varios | ⭐⭐⭐⭐⭐ regional | Variantes de cada CCAA. | Variable. | ⭐⭐ Cada CCAA tiene su formato. |
| **INCUAL** | `incual.educacion.gob.es` | ⭐⭐⭐⭐⭐ | Solo competencias profesionales (no curriculum). | Estable. | ⭐⭐ Web compleja, datos en BD propia. |
| Datasets community (GitHub) | — | ⭐⭐ no oficial | Variable. | Variable. | ⭐⭐⭐⭐ JSON/CSV ya parseado. |
| **datos.gob.es** | datos.gob.es | ⭐⭐⭐ aggregator | Centros sí, ciclos no en general. | Variable. | ⭐⭐⭐⭐ APIs OpenAPI cuando existen. |

### 14.2 ¿Qué da TodoFP en concreto?

Inventario de lo que SÍ podemos extraer scrapeando TodoFP:

- ✅ Lista completa de las **28 familias profesionales**.
- ✅ Por cada familia, lista de ciclos (FP Básica + Medio + Superior + Cursos de Especialización).
- ✅ Por cada ciclo: **código oficial**, **nombre**, **nivel**, **familia**, **duración total en horas**.
- ✅ **URL al BOE** del Real Decreto que regula el ciclo.
- ✅ **Lista de módulos** con su código y nombre (pero sin horas).
- ⚠️ Algunas páginas tienen fecha de publicación, comunidades autónomas donde se imparte, perfil profesional, etc. — útil pero opcional.

Lo que TodoFP NO da:

- ❌ **Horas por módulo** (totales o semanales).
- ❌ Currículos por CCAA.
- ❌ Catálogo de competencias profesionales (eso lo tiene INCUAL).
- ❌ Listado de centros que ofrecen cada ciclo (eso lo tiene cada Consejería).

### 14.3 Riesgos del scraping de TodoFP

1. **Cambio de HTML.** En la última revisión grande (2023) cambiaron toda la estructura de URLs y selectores. Mitigación: tests de snapshot por cada selector crítico, alerta a SuperAdmin si un parser falla 3 veces seguidas.
2. **Contenido JS-rendered.** Algunas tablas pueden depender de JS. Hay que verificar página por página si nos basta con `Symfony\HttpClient` + `DomCrawler` o necesitamos `symfony/panther` (Chromium headless). Esto duplicaría el coste operativo.
3. **Coexistencia LOE/LOMLOE.** Hay ciclos antiguos LOE que conviven con sus equivalentes LOMLOE durante años. El scraper tiene que distinguir y marcar los antiguos como `vigenteHasta`.
4. **Términos de uso.** TodoFP es web pública sin login y términos de uso permiten consulta personal/educativa. Para el uso interno de Loggex el riesgo legal es bajo, pero hay que documentar la atribución (*"datos basados en TodoFP del Ministerio…"*).

### 14.4 Decisión

Vamos con un **enfoque en capas** donde cada capa aporta progresivamente más detalle:

- **Capa 1 (TodoFP HTTP)**: nos da el catálogo completo de los 185 ciclos con metadata + URL del RD.
- **Capa 2 (BOE)**: completa horas por módulo a partir del RD enlazado.
- **Capa 3 (BOJA / CCAA)**: variantes regionales sobre la nacional.

Cada capa es opcional, se construye una a una y aporta valor incremental. Si solo tenemos la capa 1, ya tenemos un salto enorme respecto al JSON curado (185 vs 4 ciclos, todos verificables contra fuente oficial).

---

## 15. Arquitectura de scrapers en capas

### 15.1 Capa 1 — `TodoFpHttpAdapter`

**Objetivo:** producir los 185 ciclos del catálogo nacional con metadata oficial.

**Implementación esperada:**

- Usar `Symfony\Contracts\HttpClient\HttpClientInterface` + `Symfony\Component\DomCrawler\Crawler`.
- Verificar antes con inspección manual si necesitamos `symfony/panther` (Chromium headless) por contenidos JS-rendered.
- 2 niveles de scraping:
  1. Index de familias: `https://www.todofp.es/que-estudiar/familias-profesionales.html` → ~28 URLs de familia.
  2. Por cada familia, listar ciclos → URLs de detalle → extraer datos del ciclo.
- Por cada ciclo, producir un `CatalogoItinerarioDto` con:
  - `codigoOficial`, `nombre`, `etapa` (derivada del nivel), `familia`, `nivel`, `duracionTotalHoras`, `boletinUrl` (URL del RD), `vigenteDesde` (fecha del RD), `materias` con código+nombre **pero sin horas**.

**Datos NO disponibles desde TodoFP** (se rellenan con NULL hasta que la capa 2 los complete):

- `horasTotales` y `horasSemanales` por módulo.
- `competencias`.
- `descripcion` de módulos.
- `prerequisitos`.

**Tests:**

- Fixtures HTML cacheados de 3-4 páginas tipo (un index de familia, dos ciclos distintos, una página con tabla JS).
- Test de regresión por cada selector: si el HTML cambia y el selector falla, el test cae con un mensaje claro.

**Frecuencia:** mensual (la sección 3.3 del documento ya lo refleja).

### 15.2 Capa 2 — `BoeRdAdapter`

**Objetivo:** completar `horasTotales` y `horasSemanales` por módulo, leyendo el RD enlazado en cada itinerario.

**Implementación esperada:**

- Para cada `CatalogoItinerario` con `boletinUrl` del BOE pero materias sin `horasTotales`, fetch del XML ELI del RD.
- Parsear el XML buscando la tabla de horas del módulo (por `codigoOficial`).
- Update incremental: solo escribe `horasTotales`/`horasSemanales`. No toca lo demás.

**Riesgos:** la estructura del XML de los RDs varía bastante entre años. Algunos incluyen tablas en imágenes dentro de los PDFs vinculados (peor caso). Podríamos necesitar un fallback al PDF parser (`smalot/pdfparser`).

**Frecuencia:** mensual, después de TodoFP. Solo procesa los itinerarios que tienen `boletinUrl` y materias con horas NULL.

### 15.3 Capa 3 — Adapters por CCAA

**Objetivo:** variantes regionales del currículo donde apliquen.

**Implementación:** un adapter por CCAA que parsea su boletín oficial. El más urgente sería `BojaAdapter` para Andalucía. Los demás se pueden añadir cuando lleguen centros piloto de otras comunidades.

Cuando una CCAA modifica horas semanales o estructura de un ciclo, se crea una nueva fila `CatalogoItinerario` con el mismo `codigoOficial` pero `ccaa` distinto. El frontend prefiere la variante de la CCAA del centro si existe.

### 15.4 Convivencia entre capas y `TodoFpJsonAdapter`

El `TodoFpJsonAdapter` actual sigue activo durante la transición. Convive con `TodoFpHttpAdapter` a través de la `fuenteIngesta`:

- `fuenteIngesta = 'todofp_json'` para el JSON curado.
- `fuenteIngesta = 'todofp_http'` para el scraper.

La unique constraint actual es `(codigo_oficial, ccaa, vigente_desde)` — no incluye `fuenteIngesta`. Significa que dos adapters con el mismo (código, ccaa, vigente_desde) **chocan**: el segundo en correr fallaría con "duplicate key".

**Resolución:** cuando `TodoFpHttpAdapter` esté operativo y validado, se ejecuta una migración:

1. Borrar todas las entradas con `fuente_ingesta='todofp_json'` (`DELETE FROM catalogo_itinerario WHERE fuente_ingesta='todofp_json'`).
2. Eliminar `TodoFpJsonAdapter` del código.
3. Mantener el JSON solo como fuente de **overrides manuales** en casos puntuales (un ciclo que TodoFP no recoge bien, una corrección urgente). Estos overrides irían bajo otro adapter o se persistirían a mano.

Mientras eso ocurre, **mantener solo uno de los dos activos al mismo tiempo** (el JSON o el HTTP, no ambos).

### 15.5 Métricas de éxito de capa 1

Cuando `TodoFpHttpAdapter` esté en producción, esperamos:

- **185 itinerarios** en `catalogo_itinerario` con `fuente_ingesta='todofp_http'`.
- **0 itinerarios** en `fuente_ingesta='todofp_json'` (tras la limpieza).
- **Cada itinerario tiene `boletin_url`** apuntando al BOE.
- **Cada itinerario tiene N materias** (al menos código y nombre).
- **Tiempo del refresh completo:** menos de 5 minutos.
- **Tasa de fallo de parser:** < 5% (si es mayor, replantear selectores o cambiar a Panther).
