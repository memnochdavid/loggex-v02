# Currículo por Comunidad Autónoma — Hoja de Ruta

> Loggex apunta a producto comercial. La realidad de un centro español NO se describe únicamente con el currículo nacional (BOE): cada CCAA publica decretos que ajustan horas de troncales y añaden materias autonómicas. Sin esto, el horario "imposible" del caso EAG (DAW 2º, jornada 27.5h, materias BOE 28h) es la norma, no la excepción. Este documento define cómo Loggex incorpora la capa CCAA encima del catálogo nacional ya implementado.

## ⚡ Snapshot para retomar

### Estado al cierre (2026-04-27)
- **Plan aprobado**, sin código todavía. D1-D5 cerradas.
- Catálogo nacional (BOE) operativo en `/admin/catalogo/*` con 230 itinerarios y ~2 230 materias (ver `docs/catalogo-oficial.md` §13).
- Solver `HorarioSolver.php` y editor `HorariosEditor.jsx` ya trabajan en minutos tras D24 = A (`docs/hoja-de-ruta-jornadas-recreos.md` §13 entrada 2026-04-27 tarde).
- Caso real validado: centro EAG en Andalucía usa jornada 3 bloques `2h+2h+1h30 = 5h30/día = 27h30/sem` y materias con horas `7.5/5.5/3.5` que NO encajan en `int horasSemanales`.

### Decisiones cerradas
- **D1**: `Ccaa` se modela como **enum PHP backed string** (17 CCAA + Ceuta + Melilla = 19 valores estables, no cambian con el tiempo). Razón: enum-en-código permite type-safety en queries/tests sin tabla extra.
- **D2**: **Overlay** — el catálogo nacional sigue siendo fuente de verdad. CCAA es una capa que añade overrides (horas, nombre alternativo) y materias autonómicas propias. La mayoría de troncales coinciden con BOE; solo cambian horas y se suman optativas.
- **D3**: refactor `materia.horasSemanales: int` → `materia.minutosSemanales: int`. Misma columna física pero unidad coherente con el solver. Migración Doctrine que multiplique x60 los valores existentes. La UI sigue mostrando horas decimales (`5.5h`, `3.5h`).
- **D4**: cobertura inicial = **Andalucía** (BOJA). Resto en sesiones futuras por demografía (CAT > MAD > VAL > PV > GAL).
- **D5**: `itinerario.ccaa` y `catalogo_itinerario.ccaa` son **nullable**. NULL = currículo nacional puro (BOE). Itinerario con `ccaa = AND` resuelve materias = nacional + overrides Andalucía.

### Lo siguiente al retomar — orden exacto
1. Implementar Fase 1 (modelo + migración) — ver §6.
2. Refactor `horasSemanales` → `minutosSemanales` (Fase 2). Bloquea al resto: el seed de Andalucía con horas decimales no entra hasta que la columna esté en minutos.
3. Adapter Andalucía piloto (BOJA, FP DAW). Punto cero del scraping CCAA.
4. UI selector "Comunidad Autónoma" en modal de Itinerario y filtro en `/admin/catalogo/*`.
5. Validación previa al solver (capacity check, banner rojo si Σ minutos > capacidad jornada). Esto va en `hoja-de-ruta-jornadas-recreos.md` §11, no aquí.

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

### Decisiones aún abiertas (a cerrar antes de Fase 3)

- **D6**: ¿Las materias autonómicas (Inglés profesional GS, IPE II) viven en `CatalogoMateriaCcaa` con `catalogo_materia_id = NULL` y campos propios (nombre/codigo/horas), o se crea una entidad aparte `CatalogoMateriaAutonomica`? **Recomendación**: en la misma tabla con FK nullable. Más DRY; el flag se infiere de `catalogo_materia_id IS NULL`.
- **D7**: ¿El nombre del itinerario también puede variar por CCAA? Algunos decretos renombran ("Técnico Superior en DAW" sigue igual, pero hay casos de variantes regionales). **Recomendación**: nombre nacional como fuente; si BOJA renombra, se almacena como `CatalogoItinerarioCcaa.nombre` (override). Si NULL, se usa el nacional.
- **D8**: ¿Permitimos que un centro tenga **distintos itinerarios con distintas CCAA**? (un IES en Ceuta podría usar mayoritariamente currículo nacional pero algunas familias profesionales con normativa autonómica). **Recomendación**: sí — la CCAA es atributo del itinerario, no del centro. Mucho más flexible y no añade complejidad.
- **D9**: ¿Cómo se decide la CCAA por defecto al crear un itinerario? Tres opciones:
  - (a) Sin default — el admin elige siempre. Más explícito.
  - (b) Default = CCAA del centro (campo nuevo `Centro.ccaa`). Cómodo pero requiere capturar CCAA del centro.
  - (c) Default = NULL (nacional puro). Conservador, no rompe el flujo actual.
  - **Recomendación**: (b) si el campo `Centro.ccaa` es trivial; en otro caso (a). NUNCA (c) en producción — induciría a errores silenciosos.
- **D10**: ¿Versionado del overlay CCAA? Los decretos cambian; un BOJA de 2018 difiere del de 2022. ¿Marcamos `CatalogoMateriaCcaa.vigenteDesde / vigenteHasta` o solo conservamos el último? **Recomendación**: `vigenteDesde DATE NOT NULL` + `vigenteHasta DATE NULL`. Permite consultar "qué impartía AND en 2020" — útil para histórico y para auditoría comercial. Pero al resolver siempre `vigenteHasta IS NULL OR vigenteHasta > today`.

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
| **1** — Modelo: enum `Ccaa`, FK `Itinerario.ccaa`, FK `Centro.ccaa`, tablas `catalogo_*_ccaa`, migración | 1 día | 2, 3, 4 | ⏳ Siguiente |
| **2** — Refactor `horasSemanales` → `minutosSemanales` en `materia` (+ `catalogo_materia` si aplica) + ajustes en solver/editor (que ya leen minutos, pero la columna fuente cambia) | 0.5 día | 3 | ⏳ |
| **3** — Adapter `BojaAndAdapter` (Andalucía piloto): comando `app:catalogo:refresh boja_and`. Empezar por DAW como caso de validación | 1.5 días | 4, 5 | ⏳ |
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
