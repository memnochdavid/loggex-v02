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
