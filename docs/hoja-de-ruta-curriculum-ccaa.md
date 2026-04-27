# Currículo por Comunidad Autónoma — Hoja de Ruta

> Loggex apunta a producto comercial. La realidad de un centro español NO se describe únicamente con el currículo nacional (BOE): cada CCAA publica decretos que ajustan horas de troncales y añaden materias autonómicas. Sin esto, el horario "imposible" del caso EAG (DAW 2º, jornada 27.5h, materias BOE 28h) es la norma, no la excepción. Este documento define cómo Loggex incorpora la capa CCAA encima del catálogo nacional ya implementado.

## ⚡ Snapshot para retomar

### Estado al cierre (2026-04-27 madrugada)
- **Fase 1 + Fase 2** ✅ implementadas (modelo CCAA + minutosSemanales).
- **Fase 3 (opción A) ✅ implementada y validada E2E**: provider `BojaAndHardcodedProvider` con datos del Decreto 156/2022 BOJA hard-coded para DAW 2º. Comando `app:catalogo:ccaa:seed`, servicio `CcaaResolverService` con algoritmo overlay, endpoint `POST /api/v1/grupos/{id}/resync-ccaa`, UI en `Itinerarios.jsx` con selector + botón "Aplicar overlay". Caso EAG/DAW 2º: banner verde, 27.5h exactos.
- **Fase 3 (opción B) — objetivo final pendiente**: scraper PDF real del BOJA. Arquitectura ya preparada (interface `CcaaCurriculumProviderInterface` agnóstica a la fuente).
- D1-D11 cerradas.

### Decisiones cerradas
- **D1**: `Ccaa` se modela como **enum PHP backed string** (17 CCAA + Ceuta + Melilla = 19 valores estables, no cambian con el tiempo). Razón: enum-en-código permite type-safety en queries/tests sin tabla extra.
- **D2**: **Overlay** — el catálogo nacional sigue siendo fuente de verdad. CCAA es una capa que añade overrides (horas, nombre alternativo) y materias autonómicas propias. La mayoría de troncales coinciden con BOE; solo cambian horas y se suman optativas.
- **D3**: refactor `materia.horasSemanales: int` → `materia.minutosSemanales: int` (y mismo cambio en `catalogo_materia.horasSemanales: decimal` → `catalogo_materia.minutosSemanales: int` por coherencia). Migración Doctrine que multiplique los valores existentes (`*60` para `materia`, `ROUND(*60)` para `catalogo_materia` decimal). La UI sigue mostrando horas decimales (`5.5h`, `3.5h`) con el helper `minToHoras`.
- **D4**: cobertura inicial = **Andalucía** (BOJA). Resto en sesiones futuras por demografía (CAT > MAD > VAL > PV > GAL).
- **D5**: `itinerario.ccaa` y `catalogo_itinerario.ccaa` son **nullable**. NULL = currículo nacional puro (BOE). Itinerario con `ccaa = AN` resuelve materias = nacional + overrides Andalucía.
- **D6**: materias autonómicas y overrides viven en la **misma tabla** `CatalogoMateriaCcaa`. Si `catalogo_materia_id IS NULL`, es autonómica pura (Inglés profesional GS, IPE II) con `nombre/codigo/minutosSemanales/curso/tipo` propios. Si NOT NULL, es override de la materia nacional. Razón: DRY; el flag se infiere de la FK, no hay que mantener una entidad aparte.
- **D7**: el nombre del itinerario también puede variar por CCAA. Se modela con `CatalogoItinerarioCcaa` (FK `CatalogoItinerario` + `Ccaa` + `nombre`/`codigo` override). Si para una `(itinerario, ccaa)` no hay registro, se usa el nacional. Razón: caso raro pero existe (algunos decretos autonómicos renombran o asignan códigos propios).
- **D8**: la CCAA es atributo del **itinerario, no del centro**. Un mismo centro puede tener itinerarios con CCAAs distintas (ej. IES en Ceuta con familias profesionales bajo currículo nacional y otras bajo CCAA específica). Razón: máxima flexibilidad, complejidad cero (la FK ya está en `Itinerario`).
- **D9**: default al crear itinerario = **CCAA del centro** si está rellena (`Centro.ccaa`); si el centro no tiene CCAA, el admin elige explícitamente. Sin default a NULL silencioso (causaría errores en producción). Razón: cubre el caso 99% (un centro suele estar en una CCAA) sin perder flexibilidad para los multi-CCAA.
- **D10**: **versionado por fecha** en `CatalogoMateriaCcaa` y `CatalogoItinerarioCcaa`: `vigenteDesde DATE NOT NULL` + `vigenteHasta DATE NULL` (NULL = vigente hoy). Permite consultas históricas y auditoría comercial. Resolver siempre filtra por `vigenteHasta IS NULL OR vigenteHasta >= today`. Razón: coste cero de mantener; beneficio cuando llegue el segundo decreto autonómico.

### Lo siguiente al retomar — orden exacto

> **Fase 3 cerrada 2026-04-27 madrugada** con `BojaAndHardcodedProvider` (opción A). DAW 2º AN cuadra exacto a 27.5h validado E2E. Próximo: ampliar provider a DAW 1º + DAM 1º + DAM 2º cuando se verifiquen datos del BOJA.

1. **Completar provider hard-coded** con DAW 1º, DAM 1º, DAM 2º AN — datos verificados contra BOJA + Órdenes específicas. NO inventar.
2. **Asignar profesores** a las imparticiones autonómicas (Inglés profesional, IPE II) creadas por el resync — necesario antes de "Sugerir horario" en DAW 2º.
3. **Fase 4 — UI extras**: filtro CCAA en `/admin/catalogo/*` + banner provenance ampliado.
4. **Fase 3 B (objetivo final)** — `BojaAndScraperProvider` que sustituye al hard-coded sin tocar comando/resolver/UI.
5. **Fase 6 — Más CCAA** (CT/MD/VC/PV/GA), una por sesión.

---

## 1. Contexto y motivación

### 1.1. La realidad

El RD 686/2010 (DAW nacional) define para 2º curso:

| Materia | Horas BOE |
|---|---:|
| Desarrollo web cliente | 6 |
| Desarrollo web servidor | 8 |
| Despliegue | 5 |
| Diseño interfaces | 6 |
| Empresa e iniciativa | 3 |
| **Σ** | **28** |

Pero un centro real en Andalucía (caso EAG, jornada 27.5h efectivas) imparte:

| Materia | Horas reales | Origen |
|---|---:|---|
| Web cliente | 6 | BOE igual |
| Web servidor | 7.5 | BOJA reduce -0.5 |
| Diseño interfaces | 5 | BOJA reduce -1 |
| Despliegue | 3.5 | BOJA reduce -1.5 |
| Inglés profesional GS | 2 | autonómica AND |
| Itinerario Personal Empleabilidad II | 3.5 | autonómica AND |
| **Σ** | **27.5** | encaja en jornada |

El BOJA (Decreto 156/2022 entre otros) reordena horas y añade dos materias autonómicas que no existen en el currículo nacional. Esto es **el caso normal en España**, no la excepción: cada CCAA tiene su normativa.

### 1.2. Por qué importa para el solver

El solver puede colocar 28h en 27.5h (con `unplaced`) o por D22=A redondear hacia arriba con un slot que sobrepasa. Ambos son síntomas de que la **fuente de verdad de las horas está mal**: si el centro de Andalucía tiene 7.5h de Web servidor y la BD dice 8h, el solver no puede acertar. La capa CCAA arregla la fuente; el solver pasa a ser correcto sin tocarlo.

### 1.3. Por qué no hardcodear "Andalucía"

Loggex apunta a venderse a centros de cualquier CCAA. Hardcodear es deuda técnica garantizada. El modelo overlay permite añadir CCAAs incrementalmente: BOJA primero, DOGC y BOCM después, sin romper nada.

---

## 2. Decisiones cerradas (D1–D5) y su razón

| # | Decisión | Resolución | Razón |
|---|---|---|---|
| D1 | Cómo modelar `Ccaa` | enum PHP backed string | 19 valores estables; enum permite type hints en queries y migraciones |
| D2 | Estrategia | Overlay sobre catálogo nacional | La mayoría de troncales coinciden; solo cambian horas y se añaden optativas |
| D3 | Tipo `horasSemanales` | refactor a `minutosSemanales: int` | Precisión natural para 7.5h, 5.5h, 1.5h sin DECIMAL |
| D4 | Cobertura inicial CCAA | Solo Andalucía como piloto | Centro de pruebas del usuario (EAG) está en AND |
| D5 | `itinerario.ccaa` | nullable (NULL = nacional puro) | Preserva itinerarios actuales sin migración de datos |

### Decisiones cerradas adicionales (D6-D10, 2026-04-27)

Originalmente abiertas; cerradas en la sesión 2026-04-27 al arrancar Fase 1. Se aceptaron las recomendaciones tal cual.

| # | Decisión | Resolución |
|---|---|---|
| D6 | Modelado de materias autonómicas | Misma tabla `CatalogoMateriaCcaa`, FK `catalogo_materia_id` nullable |
| D7 | Override de nombre del itinerario por CCAA | Sí, vía `CatalogoItinerarioCcaa` |
| D8 | Multi-CCAA por centro | Permitido (CCAA es atributo del itinerario) |
| D9 | Default CCAA al crear itinerario | CCAA del centro si está rellena, o elección explícita |
| D10 | Versionado por fecha | `vigenteDesde NOT NULL` + `vigenteHasta NULL` |

### D11 — orden de ataque tras desajuste solver/jornada (cerrada 2026-04-27 noche)

| # | Decisión | Resolución | Razón |
|---|---|---|---|
| D11 | ¿Resolver el desajuste con (a) cambiar jornada, (b) ajustar horas materias, (c) Fase 3 CCAA, o (d) sub-fase O ILP? | **(d) primero, (c) después** | Análisis matemático: con jornada `60+60+60+60+90` y materias múltiplo de 60min, el desajuste mínimo teórico es 30min en una sola materia (paridad). El solver actual produce 3.5h agregadas → margen ~7× sin tocar fuente. Sub-fase O es genérica para cualquier centro; Fase 3 CCAA solo arregla el caso EAG concreto. (a) y (b) se descartan como parches. |

---

## 3. Modelo de datos

### 3.1. Enum `Ccaa`

```php
enum Ccaa: string {
    case AN = 'AN'; // Andalucía
    case AR = 'AR'; // Aragón
    case AS = 'AS'; // Asturias
    case CB = 'CB'; // Cantabria
    case CE = 'CE'; // Ceuta
    case CL = 'CL'; // Castilla y León
    case CM = 'CM'; // Castilla-La Mancha
    case CN = 'CN'; // Canarias
    case CT = 'CT'; // Cataluña
    case EX = 'EX'; // Extremadura
    case GA = 'GA'; // Galicia
    case IB = 'IB'; // Illes Balears
    case MC = 'MC'; // Murcia
    case MD = 'MD'; // Madrid
    case ML = 'ML'; // Melilla
    case NC = 'NC'; // Navarra
    case PV = 'PV'; // País Vasco
    case RI = 'RI'; // La Rioja
    case VC = 'VC'; // C. Valenciana
}
```

> Códigos ISO 3166-2:ES. 19 valores. No cambia con el tiempo (las CCAA están fijadas constitucionalmente).

### 3.2. Entidad `CatalogoMateriaCcaa`

```
CatalogoMateriaCcaa
  ├── id
  ├── ccaa                 enum Ccaa NOT NULL
  ├── catalogoItinerario   FK CatalogoItinerario NOT NULL  (a qué itinerario aplica el override)
  ├── catalogoMateria      FK CatalogoMateria NULL         (NULL si es autonómica pura)
  ├── nombre               string NULL                     (override del nombre nacional; NULL → usa nacional)
  ├── codigo               string NULL                     (código autonómico, ej. BOJA "0612 + sufijo")
  ├── minutosSemanales     int NOT NULL                    (override total de carga semanal)
  ├── curso                int NOT NULL                    (1 ó 2 en FP Superior)
  ├── tipo                 enum (modulo, optativa_autonomica, fol, fct, proyecto)
  ├── boletinOficialRef    string NULL                     (ej. "BOJA Decreto 156/2022 art. 7")
  ├── vigenteDesde         date NOT NULL
  ├── vigenteHasta         date NULL                       (NULL = vigente hoy)
  ├── createdAt / updatedAt   timestampable
  └── deleted / deletedAt     softDelete

  índices:
   - UNIQUE (ccaa, catalogo_itinerario_id, COALESCE(catalogo_materia_id, 0), curso, vigenteDesde)
     → impide duplicados pero permite versiones temporales
   - INDEX (ccaa, catalogo_itinerario_id, vigenteDesde, vigenteHasta)
     → para resolver vigentes en una fecha
```

Notas del modelo:
- **`catalogoMateria` NULL ⇒ materia autonómica pura** (Inglés profesional GS, IPE II). Llevan `nombre`, `codigo`, `minutosSemanales`, `curso`, `tipo` propios.
- **`catalogoMateria` NOT NULL ⇒ override**. La materia nacional sigue existiendo; este registro solo modifica horas y/o nombre. El `tipo` se hereda de la nacional si es NULL aquí.
- **Versionado por fecha**. Cuando un BOJA nuevo cambia las horas, no se borra el registro viejo: se le pone `vigenteHasta = nuevoDecreto.fecha - 1día` y se crea el nuevo con `vigenteDesde`. El resolver consulta por fecha actual.

### 3.3. Entidad `CatalogoItinerarioCcaa` (D7)

Solo si la CCAA tiene un nombre alternativo del itinerario.

```
CatalogoItinerarioCcaa
  ├── id
  ├── ccaa                 enum Ccaa NOT NULL
  ├── catalogoItinerario   FK CatalogoItinerario NOT NULL
  ├── nombre               string NULL          (override)
  ├── codigo               string NULL          (código autonómico)
  ├── boletinOficialRef    string NULL
  ├── vigenteDesde         date NOT NULL
  └── vigenteHasta         date NULL

  UNIQUE (ccaa, catalogo_itinerario_id, vigenteDesde)
```

Si una CCAA no tiene override del nombre, no existe registro y el resolver usa el nacional.

### 3.4. Cambios en entidades existentes

```php
class CatalogoItinerario {
    // existente
    // sin cambios — el catálogo nacional sigue siendo nacional
    //
    // NOTA (2026-04-27): la columna `ccaa: ?string` ya existía como etiqueta libre
    // (siempre NULL en los 230 registros actuales). Se mantiene como string por
    // compatibilidad. NO se usa para la lógica overlay; esa vive en
    // CatalogoMateriaCcaa y CatalogoItinerarioCcaa. Si en el futuro se decide
    // unificar a enum Ccaa, será refactor menor (todos los datos son NULL).
}

class Itinerario {
    // existente
    #[ORM\Column(length: 2, nullable: true, enumType: Ccaa::class)]
    private ?Ccaa $ccaa = null;   // D5: NULL = nacional puro
}

class Materia {
    // existente
    // RENOMBRADA: horasSemanales (int) → minutosSemanales (int)   ← D3, refactor en Fase 2
}

class Centro {
    // existente
    #[ORM\Column(length: 2, nullable: true, enumType: Ccaa::class)]
    private ?Ccaa $ccaa = null;   // D9 opción (b): default para nuevos itinerarios del centro
}
```

### 3.5. Migraciones

Tres migraciones independientes para evitar mezclar conceptos y permitir rollback granular:

1. **Version2026XXXX_minutosSemanales** (Fase 2):
   - Renombra `materia.horas_semanales` → `materia.minutos_semanales`.
   - `UPDATE materia SET minutos_semanales = horas_semanales * 60` antes del rename.
   - Mismo cambio en `catalogo_materia` (si existe la columna allí — verificar).

2. **Version2026XXXX_ccaaModel** (Fase 1):
   - Añade `centro.ccaa VARCHAR(2) NULL` (D9b).
   - Añade `itinerario.ccaa VARCHAR(2) NULL` (D5).
   - Crea tablas `catalogo_materia_ccaa` y `catalogo_itinerario_ccaa`.
   - Índices arriba descritos.

3. **Version2026XXXX_seedAndalucia** (Fase 3, no estrictamente migración: comando `app:catalogo:refresh boja_and`):
   - Carga overrides de Andalucía desde scraper BOJA.
   - Idempotente: si ya hay registros con `vigenteDesde` de un decreto y aparece otro nuevo, marca el anterior como `vigenteHasta`.

---

## 4. Algoritmo de resolución (overlay)

Cuando se materializan las materias de un `Itinerario` (al crearlo o al consultar):

```
function resolverMaterias(Itinerario $it, ?DateTimeImmutable $fecha = null): array {
    $fecha ??= new DateTimeImmutable();
    $ccaa = $it->getCcaa();              // null = nacional puro
    $catItin = $it->getCatalogoOrigen(); // si null, no hay materias del catálogo

    if ($catItin === null) return $it->getMateriasManuales(); // legacy

    // 1. Materias del catálogo nacional (capa base)
    $base = $catItin->getMaterias();    // CatalogoMateria[]

    if ($ccaa === null) {
        return $base->map(fn($m) => $this->materializeNacional($m));
    }

    // 2. Overrides CCAA vigentes en la fecha
    $overrides = $this->repo->findVigentes($ccaa, $catItin, $fecha);
    // Devuelve CatalogoMateriaCcaa[] tales que:
    //   - ccaa = $ccaa
    //   - catalogo_itinerario = $catItin
    //   - vigenteDesde <= $fecha
    //   - vigenteHasta IS NULL OR vigenteHasta >= $fecha
    //   - deleted = 0

    // 3. Aplicar overlay
    $result = [];
    $handledNacionales = [];

    // 3.1 Por cada override que apunta a una materia nacional, sustituir
    foreach ($overrides as $ov) {
        if ($ov->getCatalogoMateria() !== null) {
            $handledNacionales[$ov->getCatalogoMateria()->getId()] = true;
            $result[] = $this->materializeOverride($ov);
        } else {
            // 3.2 Override sin nacional → materia autonómica pura, se añade
            $result[] = $this->materializeAutonomica($ov);
        }
    }

    // 3.3 Materias nacionales no afectadas por override → pasan tal cual
    foreach ($base as $m) {
        if (!isset($handledNacionales[$m->getId()])) {
            $result[] = $this->materializeNacional($m);
        }
    }

    return $result;
}
```

**Casos:**

| Situación | Resultado |
|---|---|
| Itinerario sin CCAA | Materias nacionales tal cual |
| Itinerario con CCAA, override de horas | Materia con `minutosSemanales` de override, resto nacional |
| Itinerario con CCAA, override de nombre | Materia con `nombre` de override, resto nacional |
| Itinerario con CCAA, materia autonómica | Materia nueva del overlay (sin contraparte nacional) |
| Itinerario con CCAA, sin overrides | Equivalente a "sin CCAA" pero con etiqueta CCAA visible en UI |

---

## 5. Fuentes oficiales por CCAA

> **Nota**: las URLs base son estables, las URLs concretas de cada decreto cambian. Cada adapter debe partir de un buscador o índice y filtrar por temática/año.

| Código | CCAA | Boletín | Consejería educación | URL base |
|---|---|---|---|---|
| AN | Andalucía | BOJA | Junta de Andalucía Educación y Deporte | https://www.juntadeandalucia.es/eboja |
| AR | Aragón | BOA | Departamento Educación | https://www.boa.aragon.es |
| AS | Asturias | BOPA | Consejería Educación | https://sede.asturias.es/bopa |
| CB | Cantabria | BOC | Consejería Educación | https://boc.cantabria.es |
| CE | Ceuta | BOCCE | Ciudad Autónoma de Ceuta | https://www.ceuta.es/ceuta/bocce |
| CL | Castilla y León | BOCYL | Consejería Educación | https://bocyl.jcyl.es |
| CM | Castilla-La Mancha | DOCM | Consejería Educación | https://docm.jccm.es |
| CN | Canarias | BOC | Consejería Educación | https://www.gobiernodecanarias.org/boc |
| CT | Cataluña | DOGC | Departament d'Educació | https://dogc.gencat.cat |
| EX | Extremadura | DOE | Consejería Educación | https://doe.juntaex.es |
| GA | Galicia | DOG | Consellería de Educación | https://www.xunta.gal/dog |
| IB | Illes Balears | BOIB | Conselleria d'Educació | https://www.caib.es/eboibfront |
| MC | Murcia | BORM | Consejería Educación | https://www.borm.es |
| MD | Madrid | BOCM | Consejería Educación | https://www.bocm.es |
| ML | Melilla | BOME | Ciudad Autónoma de Melilla | https://www.melilla.es/bome |
| NC | Navarra | BON | Departamento Educación | https://bon.navarra.es |
| PV | País Vasco | BOPV | Hezkuntza Saila | https://www.euskadi.eus/bopv |
| RI | La Rioja | BOR | Consejería Educación | https://www.larioja.org/bor |
| VC | C. Valenciana | DOGV | Conselleria d'Educació | https://dogv.gva.es |

### 5.1. Estructura típica de un decreto autonómico de FP

Cada CCAA publica **un decreto por familia profesional o por ciclo formativo**. La estructura recurrente:
1. Anexo con la **distribución horaria semanal** por curso y módulo (= materia).
2. Listado de **módulos profesionales** del catálogo nacional (referidos por código, ej. `0612`).
3. **Horas autonómicas** asignadas: a) ampliación de troncales; b) módulos autonómicos propios (Inglés, IPE...).
4. **Currículo** detallado (resultados de aprendizaje, contenidos) — fuera del alcance de Loggex en MVP.

Para el adapter solo importan (1) y (3). El (2) y (4) ya están en el catálogo nacional.

### 5.2. Andalucía (piloto)

Decretos vigentes a la fecha:
- **Decreto 156/2022** de 9 de agosto: ordenación general FP en Andalucía (LOMLOE).
- Órdenes específicas por ciclo formativo (ej. Orden de 19 de julio de 2010 para DAW antes del 156/2022).

Plan adapter `BojaAndAdapter`:
1. Buscador de BOJA con query `"currículo" + "ciclo formativo" + "Técnico Superior"` filtrado por año.
2. Detección de tabla horaria en el anexo (similar al `BoeAdapter` actual con `mb_stripos`).
3. Extracción de pares `(codigo_modulo, horas, curso)` y mapeo:
   - Si `codigo_modulo` existe en `catalogo_materia.codigo_oficial` → es override de horas (FK NOT NULL).
   - Si no existe → materia autonómica (FK NULL, `nombre` y `codigo` propios del decreto).

Fragilidad esperada: PDFs del BOJA con tablas formateadas a mano; igual que con BOE habrá que iterar parsers por tipo de plantilla. Documentar cada fallback.

---

## 6. Plan en fases

| Fase | Esfuerzo | Bloquea a | Estado |
|---|---|---|---|
| **1** — Modelo: enum `Ccaa`, FK `Itinerario.ccaa`, FK `Centro.ccaa`, tablas `catalogo_*_ccaa`, migración | 1 día | 2, 3, 4 | ✅ Done (2026-04-27) — pendiente ejecutar migración en BD |
| **2** — Refactor `horasSemanales` → `minutosSemanales` en `materia` (+ `catalogo_materia` si aplica) + ajustes en solver/editor (que ya leen minutos, pero la columna fuente cambia) | 0.5 día | 3 | ✅ Done (2026-04-27) — combinada con Fase 1 en una sola migración |
| **3** — Adapter `BojaAndAdapter` (Andalucía piloto): comando `app:catalogo:refresh boja_and`. Empezar por DAW como caso de validación | 1.5 días | 4, 5 | ⏳ Siguiente |
| **4** — UI: selector "Comunidad Autónoma" en modal de Itinerario; filtro CCAA en `/admin/catalogo/itinerarios` y `/admin/catalogo/materias`; banner provenance ampliado | 1 día | — | ⏳ |
| **5** — Validación previa al solver: capacity check `Σ minutos / capacidadJornada` con banner verde/amarillo/rojo en `/admin/horarios`. Movido a `hoja-de-ruta-jornadas-recreos.md` §11 (cross-ref) | 0.5 día | — | ⏳ |
| **6** — Adapters CCAA por demografía: CT (DOGC), MD (BOCM), VC (DOGV), PV (BOPV), GA (DOG) | 5 días (1 por CCAA) | — | ⏳ Diferida |
| **7** — Resto CCAA: AS, CB, CE, CL, CM, CN, EX, IB, MC, ML, NC, RI, AR | bajo demanda | — | ⏳ Diferida |
| **8** — Histórico/versionado: explotar `vigenteDesde/Hasta` para auditoría y consultas históricas. Útil cuando lleguen los primeros decretos nuevos | 1 día | — | ⏳ Diferida |
| **9** — Tests E2E del overlay: caso EAG/DAW completo, materias materializadas, solver cuadra exacto | 0.5 día | — | ⏳ |

**Camino crítico para que el caso EAG cuadre**: 1 → 2 → 3 → 4 → 5 (≈ 4.5 días).

---

## 7. UI

### 7.1. Modal de Itinerario (`/admin/itinerarios`, `Itinerarios.jsx`)

Nuevo campo entre "Centro" y "Catálogo":

```
┌─ Crear / editar itinerario ─────────────────────────────┐
│ Centro:           [ Escuela Arte Granada     ▼ ]        │
│ Comunidad Aut.:   [ Andalucía                ▼ ]        │  ← NUEVO
│                   ↳ Sin CCAA = currículo nacional puro  │
│ Catálogo origen:  [ Técnico Sup. en DAW      🔍 ]       │
│   ↳ Detectado overlay BOJA (vigente desde 2022-08-09):  │  ← NUEVO
│      · Web servidor reduce a 7.5h (BOE: 8h)             │
│      · Diseño interfaces reduce a 5h (BOE: 6h)          │
│      · Despliegue reduce a 3.5h (BOE: 5h)               │
│      · + Inglés profesional GS (2h)                     │
│      · + Itinerario Personal Empleabilidad II (3.5h)    │
│      · Σ ajustada: 27.5h/sem (encaja en jornada 27.5h)  │
│ Jornada:          [ FP Mañanas 08:30-14:30   ▼ ]        │
│ ...                                                       │
└──────────────────────────────────────────────────────────┘
```

Si el centro tiene `ccaa` rellena, la lista de CCAA pre-selecciona la del centro (D9b). Si el usuario cambia, el banner se recalcula al vuelo.

### 7.2. Filtros en `/admin/catalogo/*`

Tanto `CatalogoItinerarios.jsx` como `CatalogoMaterias.jsx` añaden un filtro `ThemedSelect` con las 19 CCAAs + "Todas" + "Solo nacional". Por defecto "Todas".

### 7.3. Banner de provenance

`DataProvenanceBanner.jsx` (componente existente que muestra "Fuente: BOE - RD X/Y") gana una segunda línea cuando aplica overlay:

```
Fuente: BOE - RD 686/2010 (DAW)
        + adaptación BOJA - Decreto 156/2022 (Andalucía, vigente desde 2022-08-09)
```

### 7.4. Editor de materias del itinerario (existente)

El editor actual permite añadir materias manuales con `tipo='modulo'` y horas libres. Se preserva tal cual: las materias autonómicas del overlay aparecen como **read-only con badge "Autonómica AND"**, las manuales del admin siguen siendo editables. Si el admin quita el overlay (cambia CCAA del itinerario a NULL), las materias autonómicas se eliminan del listado y las troncales con override vuelven a las horas BOE.

---

## 8. Riesgos

- **R1 (alto)**: parsers de BOJA frágiles — los PDFs del BOJA varían de plantilla. Mitigación: empezar solo por DAW, iterar parser, documentar cada plantilla en una sección "fallbacks" del adapter.
- **R2 (medio)**: `catalogo_materia.codigo_oficial` puede no coincidir con el código del decreto autonómico (algunos decretos antiguos del BOJA usan códigos propios). Mitigación: tabla de equivalencias `codigo_boja → codigo_boe` mantenida a mano para los pocos casos discrepantes.
- **R3 (medio)**: refactor `horasSemanales` → `minutosSemanales` toca el seed actual de DAW (`scripts/seed_imparticiones_daw.sql` no, pero sí `scripts/seed_calificaciones.sql` o cualquier otro que asuma horas). Auditar con `grep "horasSemanales\|horas_semanales"` antes de la migración.
- **R4 (bajo)**: enum `Ccaa` añadido a `Centro` sin valor en producción → registros existentes quedan con NULL. Aceptable según D9; si se decide forzar (D9a), añadir comando `app:centros:asignar-ccaa --centro=N --ccaa=AN`.
- **R5 (bajo)**: versionado por fecha. Hasta que aparezca el segundo decreto de una CCAA, la columna `vigenteDesde/Hasta` es ruido. Coste cero mantenerla; beneficio cuando llegue.
- **R6 (estratégico)**: si el comprador comercial es un centro de una CCAA todavía no soportada, fallback a "currículo nacional puro" puede ser inaceptable. Mitigación: lista pública de CCAAs cubiertas en la web/landing y un comando manual para crear overlays a mano (`app:catalogo:ccaa:add`).

---

## 9. Glosario

- **Overlay**: capa que se monta encima del catálogo nacional; añade/sobreescribe sin sustituir.
- **Materia autonómica**: módulo profesional o asignatura introducido por una CCAA que no existe en el currículo nacional (ej. Inglés profesional GS, IPE II).
- **Vigente**: registro `CatalogoMateriaCcaa` cuyo rango `[vigenteDesde, vigenteHasta]` cubre la fecha de consulta.
- **CCAA**: Comunidad Autónoma. Código ISO 3166-2:ES (AN, CT, MD, etc.).
- **Provenance**: trazabilidad del dato hasta su fuente oficial (BOE, BOJA, DOGC...).

---

## 10. Próximo paso concreto

**Sesión inmediata posterior** (cuando se decida arrancar):

1. Cerrar **D6, D7, D8, D9, D10** (recomendaciones en §2).
2. Crear migración Fase 1 (`Version2026XXXX_ccaaModel`):
   - Enum `App\Entity\Ccaa` (PHP).
   - Columnas `centro.ccaa` (D9b), `itinerario.ccaa`, `catalogo_itinerario.ccaa`.
   - Tablas `catalogo_itinerario_ccaa`, `catalogo_materia_ccaa`.
3. Crear migración Fase 2 (`Version2026XXXX_minutosSemanales`):
   - `ALTER TABLE materia ADD COLUMN minutos_semanales INT NULL`.
   - `UPDATE materia SET minutos_semanales = horas_semanales * 60`.
   - `ALTER TABLE materia ALTER COLUMN minutos_semanales SET NOT NULL`.
   - `ALTER TABLE materia DROP COLUMN horas_semanales`.
   - Mismo patrón en `catalogo_materia` si tiene `horas_semanales`.
4. Doctrine entity `Materia.minutosSemanales` (rename de `horasSemanales`). Buscar y actualizar todos los usos.

**Tras esto**, Fase 3 (adapter BOJA) ya tiene contra qué escribir.

---

## 11. Crossrefs

- Catálogo nacional (BOE): `docs/catalogo-oficial.md` (especialmente §13 estado actual y §16 dispatcher por etapa).
- Solver y jornadas: `docs/hoja-de-ruta-jornadas-recreos.md`. La Fase 5 de este doc (validación previa al solver) se redacta allí en §11 para que el solver mantenga toda su documentación junta.
- ESO LOMLOE: `docs/hoja-de-ruta-eso.md` (precedente de cómo añadir adapter por etapa).
- Rename de vocabulario: `docs/hoja-de-ruta-rename-fp-neutral.md` (por si alguien encuentra refs viejas a CicloFormativo/Modulo).

---

## 12. Bitácora

### 2026-04-27 — Diseño inicial aprobado

- Conversación con el usuario que destapa el caso EAG/DAW: jornada real 27.5h, materias BOE 28h → no encajan. Centro real ajusta horas y mete 2 optativas autonómicas.
- D1-D5 cerradas: enum, overlay, minutos enteros, Andalucía piloto, NULL permitido.
- D6-D10 propuestas con recomendaciones; pendientes de cierre formal antes de Fase 3.
- Doc redactado y atado a `catalogo-oficial.md`, `hoja-de-ruta-jornadas-recreos.md` y `CLAUDE.md`.
- **Sin código todavía**: la implementación arranca cuando se confirme el orden de fases.

### 2026-04-27 noche — Fases 1 + 2 cerradas en una sola pasada

D6-D10 cerradas con las recomendaciones del doc tal cual (sin ajustes). Implementación combinada de Fase 1 (modelo CCAA) y Fase 2 (refactor minutosSemanales) porque comparten migración Doctrine y desbloquean al unísono el resto del camino crítico.

**Backend nuevo:**
- `App\Entity\Ccaa` — enum PHP backed string con 19 cases (ISO 3166-2:ES) y método `nombre()` para UI.
- `App\Entity\Catalogo\CatalogoItinerarioCcaa` — override de nombre/codigo del itinerario, con `vigenteDesde NOT NULL` y `vigenteHasta NULL`. ApiResource read-only.
- `App\Entity\Catalogo\CatalogoMateriaCcaa` — overlay de horas/nombre/tipo + materias autonómicas puras (FK `catalogoMateria` nullable según D6). Helper `esAutonomicaPura()`.

**Backend modificado:**
- `Centro.ccaa` (nullable, enumType=Ccaa::class) — D9b default para itinerarios del centro.
- `Itinerario.ccaa` (nullable) — D5; expuesto en `itinerario:read`/`itinerario:write`/`grupo:read`.
- `Materia.horasSemanales` (int) → `Materia.minutosSemanales` (int).
- `CatalogoMateria.horasSemanales` (DECIMAL(4,2) string PHP) → `CatalogoMateria.minutosSemanales` (int).
- `CatalogoMateriaDto.horasSemanales: ?float` → `CatalogoMateriaDto.minutosSemanales: ?int`.
- `HorarioSolver.php` — lee directo `getMinutosSemanales()` sin multiplicar.
- `CatalogoMaterializationController::buildModulo` — propaga `minutosSemanales` directamente, sin `ceil(decimal*60)`.
- `CatalogoIngestService::buildMateriaEntity` — setMinutosSemanales del DTO.
- `BoeRdEnricher` — multiplica `horasSemanales` (float del parser) por 60 al persistir en la entidad.
- `BoeEsoAdapter` — DTO con `minutosSemanales: null`.
- Los parsers internos (`ModulosTableParser`, `SeccionModulosParser`, `ParrafosModulosParser`, `LegacyLogseModulosParser`) siguen produciendo `horasSemanales: ?float` en sus arrays internos — es lo que extraen del BOE; la conversión a minutos vive en el sitio único de persistencia (`BoeRdEnricher`).

**Frontend modificado:**
- `HorariosEditor.jsx` — `imp.materia.minutosSemanales` directo (antes `horasSemanales * 60`).
- `Materias.jsx` — formulario sigue mostrando horas decimales en la UI (input con `step="0.25"`); conversión x60 al enviar y /60 al cargar. Documentado el contrato en comentario.
- `CatalogoItinerarioDetail.jsx` — columna "Horas semanales" muestra `(minutosSemanales/60).toFixed(2)` con `h` sufijo.
- `erModel.js` — `Materia.horasSemanales` renombrado a `minutosSemanales`.

**Migración:**
- `Version20260427150000`: rename `horas_semanales` → `minutos_semanales` con `UPDATE *60` en `materia` y `ROUND(*60)` en `catalogo_materia`; nuevas columnas `centro.ccaa` y `itinerario.ccaa`; nuevas tablas `catalogo_itinerario_ccaa` y `catalogo_materia_ccaa` con FKs e índices según §3.

**Pendiente al retomar:**
- Ejecutar la migración en BD del usuario y verificar que los datos cuadran.
- Fase 3: adapter `BojaAndAdapter`.

**Deuda detectada:** `backend/src/Command/ImportOldDataCommand.php` referencia tablas `modulo` y `ciclo_formativo` que ya no existen tras el rename FP-neutral. El comando está roto independientemente de este refactor; pendiente de borrar o adaptar en sesión futura.

**No tocado intencionadamente:**
- `CatalogoItinerario.ccaa` ya existía como `?string` (siempre NULL en los 230 registros) — etiqueta libre legacy. Se mantiene como string; no es la fuente de la lógica overlay (ver §3.4 nota).

**Aplicación en BD del usuario (post-implementación):**
- Migración aplicada vía `force_update.bat` (que llama a `doctrine:schema:update --complete`) en lugar de `doctrine:migrations:migrate`. Doctrine detectó como **rename de columna** el cambio `materia.horas_semanales (INT)` → `materia.minutos_semanales (INT)` y conservó los datos sin multiplicar por 60. Corrección aplicada con `UPDATE materia SET minutos_semanales = minutos_semanales * 60 WHERE minutos_semanales <= 30` (la guarda <= 30 es idempotente — cualquier valor ya en minutos es ≥ 60).
- Para `catalogo_materia` el cambio fue de tipo (DECIMAL → INT), Doctrine NO detectó rename y dropeó la columna vieja. Repoblación con `app:catalogo:enrich-boe --force` (re-procesa los 229 itinerarios desde BOE; los parsers ya escriben minutos correctamente).
- La migración `Version20260427150000` se registró manualmente con `doctrine:migrations:version --add` para evitar que un futuro `migrations:migrate` intente re-crear las tablas.

**Deuda detectada (no urgente):**
- Algunos `catalogo_materia.minutos_semanales` quedaron con valores anómalos tras `enrich-boe --force` (max=2700 = 45h/sem, probable confusión de algún parser entre horas totales y semanales en un caso raro). 1605/2580 filas pobladas (62%); el resto son NULL legítimo (proyecto, FCT). Deuda menor del scraper BOE; no afecta al solver del centro.
- `backend/src/Command/ImportOldDataCommand.php` referencia tablas `modulo` y `ciclo_formativo` ya inexistentes (rename FP-neutral). Roto independientemente de este refactor; pendiente de borrar o adaptar.

**Validación end-to-end del solver (2026-04-27 noche, EAG/DAW 1º):**

Tras aplicar la migración, repoblar el catálogo y verificar `materia.minutos_semanales` exactos, se probó "Sugerir horario" con DAW 1º. **Resultado**: badge "Completo · 27.5/27h" pero el reparto interno desigual:

| Materia | Declarada | Colocada | Δ |
|---|---:|---:|---:|
| Bases de Datos | 5h | 6h | +1h |
| Lenguajes de marcas | 4h | 5h | +1h |
| FOL | 3h | 1.5h | **−1.5h** |

**Causa raíz** (matemática, no bug del solver): la jornada `1h+1h+1h+1h+1h30 = 5h30/día = 27.5h/sem` ofrece 20 slots de 60min + 5 slots de 90min, pero las materias DAW 1º (todas múltiplos de 60min) requieren 27 slots de 60min equivalentes. Es obligatorio que algunas materias absorban un slot de 90min en su última asignación, redondeando hacia arriba (D22=A) e invadiendo capacidad que correspondería a otras. La heurística `sameDayScore` apila los round-ups en pocas materias, dejando huérfanas a las del final del orden de procesamiento.

**Decisión D11 abierta** — primera acción al retomar (ver INDEX.md):
- (a) Cambiar `jornada_tipo_id=3` a 3 bloques `2h+2h+1h30`. Workaround.
- (b) Editar horas en `/admin/materias` para que sumen 27.5h exactos. Pragmático para test sin tocar arquitectura.
- (c) **Implementar Fase 3 CCAA (`BojaAndAdapter`)** — solución definitiva. Materializa DAW Andalucía con horas BOJA reales que cuadran con la jornada. **Recomendada.**
- (d) Sub-fase O nueva en §14 jornadas: heurística de distribución equitativa de round-up + banner. Complementa (c), no la sustituye.

### 2026-04-27 madrugada — Fase 3 implementada (BojaAndHardcodedProvider) y validada E2E con DAW 2º

Tras cerrar la sub-fase O del solver, se aborda Fase 3 CCAA. Decisión D-nueva: implementar provider hard-coded (opción A) como MVP, dejando arquitectura abierta para sustituir por scraper PDF (opción B = objetivo final).

**Backend nuevo:**
- `App\Catalogo\Ccaa\CcaaCurriculumProviderInterface` — contrato. `source()`, `ccaa()`, `fetchOverrides()`, `fetchItinerarioOverrides()`. Cualquier futuro adapter (BojaAndScraperProvider, DogcCtScraperProvider...) lo implementa sin tocar comando/resolver/UI.
- `App\Catalogo\Ccaa\Dto\MateriaOverrideDto` — DTO inmutable con override (catalogoMateriaCodigo NOT NULL) o autonómica pura (catalogoMateriaCodigo NULL).
- `App\Catalogo\Ccaa\Dto\ItinerarioOverrideDto` — DTO para overrides de nombre/código del itinerario.
- `App\Catalogo\Ccaa\CcaaProviderRegistry` — registro tagged_iterator con todos los providers. Localización por `Ccaa` o por `source()`.
- `App\Catalogo\Ccaa\Provider\BojaAndHardcodedProvider` — datos del Decreto 156/2022 verificados a mano. Cobertura actual: **DAW 2º** completo (caso EAG validado). DAM 1º+2º y DAW 1º quedan como TODO con comentario claro: añadir cuando se verifique contra BOJA, NO inventar.
- `App\Service\CcaaResolverService` — algoritmo overlay §4. Casos: sin CCAA → catálogo nacional; con CCAA → overrides + autonómicas; override `minutos=0` → materia desactivada (LOMLOE: Empresa→IPE II en DAW 2º). Si el catálogo nacional dice `null/0` y no hay override, el ResolvedMateria devuelve `null` para preservar valor existente del admin (sin destruir datos).
- `App\Command\Catalogo\SeedCcaaCommand` — `php bin/console app:catalogo:ccaa:seed --ccaa=AN`. Idempotente (match por (ccaa, itinerario, materia, vigenteDesde) + autonómicas por código). Modo `--dry-run` y `--list`.
- `App\Controller\GrupoResyncCcaaController` — `POST /api/v1/grupos/{id}/resync-ccaa`. Re-aplica overlay sobre las imparticiones del grupo: actualiza minutos/nombre por (`codigoOficial`+`curso`), crea Materia+Imparticion para autonómicas (sin profesor; admin asigna después), soft-deletea imparticiones de materias del catálogo que ya no aplican (preservando manuales). Filtra por curso del grupo para no contaminar otros cursos.

**Backend modificado:**
- `Imparticion.profesor` → nullable (entidad + ALTER TABLE). Permite crear imparticiones autonómicas sin profesor durante el resync.
- `Itinerario.catalogoOrigen` → grupo `itinerario:write` añadido. **Bug raíz crítico**: ApiPlatform en PUT estaba nullificando la FK porque la propiedad solo estaba en `read`. Cada edición del modal de Itinerarios borraba `catalogo_origen_id`. Ahora se preserva.
- `services.yaml` — `_instanceof` para `CcaaCurriculumProviderInterface` con tag `app.catalogo.ccaa.provider` + iterator inyectable en `CcaaProviderRegistry`.

**Frontend modificado (`Itinerarios.jsx`):**
- Constante `CCAA_OPTIONS` con las 19 CCAA (ISO 3166-2:ES) hard-coded.
- `formData.ccaa` cargado desde `itinerario.ccaa` o pre-rellenado con `Centro.ccaa` (D9b).
- `formData.catalogoOrigen` cargado/enviado para preservar la FK.
- Selector "Comunidad Autónoma" en el modal con hint sobre el overlay.
- Botón "Aplicar overlay CCAA a los grupos del itinerario" que llama al endpoint resync por cada grupo. Modal de confirmación + toast con stats (creadas/actualizadas/desactivadas/sinCambios/errores).

**Validación end-to-end (2026-04-27 madrugada, EAG/DAW 2º):**

Tras seedear AN (`Materias nuevas: 6`), asignar `Itinerario.ccaa = AN` + `catalogoOrigen = 129`, y aplicar overlay sobre los 2 grupos:

| Materia DAW 2º | BOE | BOJA AN | Resultado |
|---|---:|---:|---:|
| Web cliente | 6h | 6h | sin cambios |
| Web servidor | 8h | 7.5h | actualizada |
| Despliegue | 5h | 3.5h | actualizada |
| Diseño interfaces | 6h | 5h | actualizada |
| Empresa | 3h | desactivada | imparticion soft-deleted |
| **+ Inglés profesional GS** | — | 2h | autonómica creada (sin profesor) |
| **+ IPE II** | — | 3.5h | autonómica creada (sin profesor) |
| **Σ** | 28h | **27.5h** | encaja exacto |

`/admin/horarios` con DAW 2º → banner **verde**: *"La jornada cubre exactamente las 27.5h/sem del itinerario."* Caso EAG validado.

**Bugs descubiertos durante la implementación (corregidos):**

1. `Materia::getImparticiones()` no tenía getter pese a tener la collection. Sustituido por query directa contra Imparticion.
2. `setDeletedAt(\DateTimeImmutable)` rompe porque `SoftDeletableTrait` mapea `\DateTime` (no immutable). Eliminado el `setDeletedAt` redundante (el trait ya lo gestiona en `setDeleted(true)`).
3. `Imparticion.profesor_id NOT NULL` impedía crear imparticiones autonómicas. Cambio a nullable (entidad + ALTER TABLE).
4. **PUT del modal nullificaba `catalogo_origen_id`** porque la propiedad no estaba en `itinerario:write`. Bug histórico. Corregido.
5. Resolver devolvía `minutos=0` para materias del catálogo nacional con `null` en BD, lo que dañaba datos existentes del admin. Cambiado a `null` (preserva).

**Deudas anotadas (no urgentes):**

- Hard-coded solo cubre DAW 2º. DAW 1º, DAM 1º, DAM 2º quedan como TODO en el provider con comentario claro: añadir cuando se verifiquen los datos contra BOJA. No inventar.
- Las imparticiones autonómicas (Inglés profesional GS, IPE II) se crean sin profesor. El admin debe asignar manualmente en `/admin/imparticiones` antes de "Sugerir horario" (sino, el solver no puede colocar a profesor=null).
- Algunas filas de `materia.minutos_semanales` revirtieron a horas (5, 7, 4...) durante la sesión. Re-aplicado el `UPDATE *60`. Vigilar si vuelve a ocurrir tras un futuro `enrich-boe --force`.
- El cache de `capacityByGrupo` en frontend se invalida solo al re-montar `HorariosEditor`. Navegar entre páginas funciona; refresh manual no es necesario en la práctica.

**Archivos tocados en esta sesión:**

Backend:
- `backend/src/Catalogo/Ccaa/CcaaCurriculumProviderInterface.php` (nuevo)
- `backend/src/Catalogo/Ccaa/Dto/MateriaOverrideDto.php` (nuevo)
- `backend/src/Catalogo/Ccaa/Dto/ItinerarioOverrideDto.php` (nuevo)
- `backend/src/Catalogo/Ccaa/CcaaProviderRegistry.php` (nuevo)
- `backend/src/Catalogo/Ccaa/Provider/BojaAndHardcodedProvider.php` (nuevo)
- `backend/src/Service/CcaaResolverService.php` (nuevo)
- `backend/src/Command/Catalogo/SeedCcaaCommand.php` (nuevo)
- `backend/src/Controller/GrupoResyncCcaaController.php` (nuevo)
- `backend/src/Entity/Imparticion.php` (profesor nullable)
- `backend/src/Entity/Itinerario.php` (catalogoOrigen en write group)
- `backend/config/services.yaml` (tag + registry)

Frontend:
- `frontend/src/pages/Itinerarios.jsx` (CCAA_OPTIONS, selector CCAA, formData.catalogoOrigen, handleAplicarOverlay, toast con errores)

Docs:
- `docs/INDEX.md` (Bloque 2 cerrado)
- `docs/hoja-de-ruta-curriculum-ccaa.md` (esta entrada)
- `docs/hoja-de-ruta-jornadas-recreos.md` (snapshot actualizado)

---

### 2026-04-27 madrugada — D11 cerrada con (d) primero, (c) después

Tras plantear D11, conversación con el usuario sobre la viabilidad heurística de redistribuir slots con jornada fija. Análisis matemático formal del caso EAG/DAW 1º:

- Sistema `60·a + 90·b = m` con `m` múltiplo de 60 fuerza `b` par. Pero Σ b_i = 5 (impar) → mínimo una materia con b impar → mínimo desajuste teórico = **30 min**.
- Solver actual produce **3.5h agregadas** (BD +1h, Lenguajes +1h, FOL −1.5h). Margen de mejora ~7×.

**Plan acordado:**

1. **Sub-fase O primero (`hoja-de-ruta-jornadas-recreos.md` §14.7 — formalizada como ILP)**: nuevo `CapacityPlanner` que pre-asigna `x_ij` (cuántos slots de cada duración por materia) minimizando `Σ |Σ_j d_j·x_ij − m_i|` antes del backtracking topológico. Banner verde/amarillo/rojo en `HorariosEditor.jsx` calculado al cambiar de grupo. Genérico para cualquier centro (no solo Andalucía).
2. **CCAA Fase 3 después**: una vez O resuelve la combinatoria genérica, el caso EAG concreto sigue mostrando banner rojo porque BOE 28h > jornada 27.5h. Fase 3 BOJA cuadra exacto a 27.5h.

(a) y (b) se descartan como parches. Detalle del razonamiento en `docs/INDEX.md` "Primera acción al retomar".
