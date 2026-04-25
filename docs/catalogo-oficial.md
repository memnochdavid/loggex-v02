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

**Fase 0 — Infraestructura común (1 semana de trabajo)**
- Modelo de datos (entidades `Catalogo*`).
- Comando `app:catalogo:refresh` skeleton.
- Endpoints `/api/catalogo/*` skeleton (sin datos aún).
- Cache Redis con tags.
- Refactor mínimo: añadir `catalogoOrigen` nullable a `CicloFormativo`, `Modulo`, `Centro`.

**Fase 1 — MVP con FP nacional (2 semanas)**
- `TodoFpAdapter` v1: scrap del catálogo nacional. Cobertura: 185 ciclos.
- Materialización de ciclos + módulos al seleccionar (incluye `horasTotales`, `horasSemanales`, `curso`).
- UX en `/ciclos → Nuevo` con `AsyncSearchSelect`.
- Demostrable end-to-end con FP.
- Tests de regresión del scraper (snapshots vs. fixtures).

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

| Fase | Esfuerzo | Aporta valor |
|---|---|---|
| 0 — Infra | 1 semana | Sin demo, base para todo |
| 1 — FP nacional | 2 semanas | **Demo vendible** — el caso de uso principal del proyecto |
| 1.5 — Calendario escolar | 1 semana | Habilita reportes oficiales y elimina trabajo manual cada inicio de curso |
| 2 — Centros | 1 semana | Mejora alta administrativa |
| 3 — ESO + Bach | 3 semanas | Cubre la mayoría de centros no-FP |
| 4 — Grados RUCT | 3 semanas | Habilita universidades |
| 5 — Plan uni | indef. | Solo si hay demanda real |
| 6 — Primaria | 1 semana | Cierra la cobertura |

**Total bloque 0+1+1.5+2 (lo que merece la pena hacer ya):** 5 semanas.

El resto se aborda según evolución del proyecto y feedback de centros piloto. La arquitectura está pensada para que cada fase añada un Adapter sin tocar las demás.

---

## 10. Decisiones abiertas

- ¿Diferenciamos `CatalogoItinerario` por entidad (CicloFP, ModalidadBach, GradoUni…) o lo mantenemos polimórfico con `etapa`? **Recomendación: polimórfico con discriminador**, hasta ver si el dominio justifica clases hijas.
- ¿Permitir al SuperAdmin "promover" un ciclo manual a referencia oficial? **No en MVP**, más complejidad de la que aporta.
- ¿Internacionalización del catálogo (catalán, euskera, gallego, valenciano)? **Aplazado**: empezar en español castellano, los nombres oficiales de los ciclos están en castellano en el BOE.
- ¿Versionado del catálogo (snapshot histórico)? **Por implementación**: el campo `vigenteHasta` y conservar registros retirados ya da trazabilidad mínima. Snapshots completos son fase 7.

---

## 11. Próximo paso concreto

Cuando se decida arrancar:

1. Crear `backend/src/Entity/Catalogo/CatalogoItinerario.php`, `CatalogoMateria.php`, `CatalogoCentro.php` con la migración Doctrine.
2. Crear `backend/src/Catalogo/Source/CatalogoSourceAdapterInterface.php`.
3. Crear `backend/src/Catalogo/CatalogoIngestService.php` (UPSERT idempotente).
4. Stub del comando `app:catalogo:refresh` con `--dry-run`.
5. Endpoint `GET /api/catalogo/itinerarios` (devolviendo lista vacía hasta que haya adapter).
6. Tras Fase 1, añadir `CatalogoCalendarioEscolar.php` y `CatalogoPeriodoCalendario.php` y los endpoints `/api/catalogo/calendarios` (Fase 1.5).

A partir de ahí, cualquier adapter es trabajo aislado en paralelo. El primero en escribir es `TodoFpAdapter` (caso de uso más vendible y la fuente más estructurada de las "no-API"). Después `BoeBojaCalendarioAdapter` (el segundo mayor ahorro percibido por los admins, porque copiar el calendario del BOJA cada inicio de curso es de las cosas más tediosas de la gestión escolar).
