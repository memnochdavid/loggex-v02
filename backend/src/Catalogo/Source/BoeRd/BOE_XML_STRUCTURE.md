# Estructura del XML del BOE para Reales Decretos de FP

> **Validado el 2026-04-25** inspeccionando los XML reales de:
> - RD 686/2010 (DAW) — `BOE-A-2010-9269`
> - Orden EDU/2887/2010 (currículo DAW) — `BOE-A-2010-17329`

Documento de referencia para `BoeRdAdapter` (Fase 1.7).

---

## 1. Endpoint XML del BOE

Cualquier publicación tiene un identificador `BOE-A-AAAA-NNNN`. El XML estructurado se obtiene en:

```
https://www.boe.es/diario_boe/xml.php?id=BOE-A-AAAA-NNNN
```

Funciona también vía formato ELI cuando lo expone:

```
https://www.boe.es/eli/es/rd/AAAA/MM/DD/N/dof/spa/xml
```

**Para los RDs de FP que tenemos (`boletin_url` de los itinerarios scrapeados)**, los formatos en BD son tres:

1. `https://www.boe.es/diario_boe/txt.php?id=BOE-A-2010-9269` → extraer id `BOE-A-2010-9269` y construir URL XML.
2. `https://www.boe.es/eli/es/rd/2014/02/28/127/con` → ya es ELI, añadir `/dof/spa/xml`.
3. `https://www.boe.es/boe/dias/AAAA/MM/DD/pdfs/BOE-A-AAAA-NNNN.pdf` → extraer id de la ruta y construir URL XML.

---

## 2. Estructura del XML

```xml
<?xml version="1.0" encoding="UTF-8"?>
<documento fecha_actualizacion="…">
  <metadatos>
    <identificador>BOE-A-2010-9269</identificador>
    <departamento codigo="4210">Ministerio de Educación</departamento>
    <rango codigo="1340">Real Decreto</rango>
    <fecha_disposicion>20100520</fecha_disposicion>
    <numero_oficial>686/2010</numero_oficial>
    <titulo>Real Decreto 686/2010, de 20 de mayo, por el que se establece el título de Técnico Superior en Desarrollo de Aplicaciones Web…</titulo>
    <diario codigo="BOE">Boletín Oficial del Estado</diario>
    …
  </metadatos>
  <texto>
    <p class="capitulo_tit">…</p>
    <p class="articulo">Artículo 2. Identificación.</p>
    <p class="parrafo">El título de Técnico Superior … queda identificado por los siguientes elementos:</p>
    <p class="parrafo_2">Denominación: Desarrollo de Aplicaciones Web.</p>
    <p class="parrafo">Nivel: Formación Profesional de Grado Superior.</p>
    <p class="parrafo">Duración: 2000 horas.</p>
    <p class="parrafo">Familia Profesional: Informática y Comunicaciones.</p>
    …
    <table class="tabla">  <!-- Múltiples tablas a lo largo del documento -->
      <tr>…</tr>
    </table>
    …
  </texto>
</documento>
```

### 2.1 Datos extraíbles de `<metadatos>`

| Campo Loggex | XPath / regla |
|---|---|
| `vigenteDesde` | `<fecha_disposicion>` (YYYYMMDD) → fecha |
| `normativa` | `Real Decreto {numero_oficial}, de {fecha_disposicion legible}` o usar `<titulo>` |
| `boletinId` (uso interno) | `<identificador>` |

### 2.2 Datos extraíbles del `<texto>` — Identificación del título

Dentro de `<texto>`, el "Artículo 2. Identificación" contiene párrafos con esta estructura (heurística por texto):

```
Denominación: Desarrollo de Aplicaciones Web.
Nivel: Formación Profesional de Grado Superior.
Duración: 2000 horas.
Familia Profesional: Informática y Comunicaciones.
```

Heurística de extracción: buscar `<p>` cuyos textos empiecen por `Denominación:`, `Nivel:`, `Duración:`, `Familia Profesional:` y tomar el resto del texto.

**Observación:** los `<p>` pueden tener distintas clases (`parrafo`, `parrafo_2`, `parrafo_3`, …). NO confiar en la clase, sino en el prefijo del texto.

---

## 3. La tabla del currículo (donde están las horas)

⚠️ **Crítico:** la tabla con horas por módulo NO está en el RD principal del título. Está en el **currículo del Ministerio** (una Orden EDU separada), que TodoFP enlaza en una columna distinta de su tabla.

Para DAW (RD 686/2010), el currículo es la **Orden EDU/2887/2010** (`BOE-A-2010-17329`).

### 3.1 Estructura de la tabla

```html
<table class="tabla">
  <tr>
    <td rowspan="2"><p class="cabeza_tabla">Módulo profesional</p></td>
    <td rowspan="2"><p class="cabeza_tabla">Duración (horas)</p></td>
    <td rowspan="2"><p class="cabeza_tabla">Primer curso (h/semana)</p></td>
    <td colspan="2"><p class="cabeza_tabla">Segundo curso</p></td>
  </tr>
  <tr>
    <td><p class="cabeza_tabla">2 trimestres (h/semana)</p></td>
    <td><p class="cabeza_tabla">1 trimestre (horas)</p></td>
  </tr>
  <tr>
    <td><p class="cuerpo_tabla_izq">0483. Sistemas informáticos (2) . . .</p></td>
    <td><p class="cuerpo_tabla_der">170</p></td>
    <td><p class="cuerpo_tabla_der">5</p></td>
    <td><p class="cuerpo_tabla_centro">   </p></td>
    <td><p class="cuerpo_tabla_centro">   </p></td>
  </tr>
  …
</table>
```

### 3.2 Estrategia de extracción

1. Localizar la `<table class="tabla">` cuya cabecera incluye los textos `"Módulo profesional"` y `"Duración (horas)"`. (El XML tiene ~3 tablas; solo una es la de horas.)
2. Saltar las 2 filas de cabecera (rowspan/colspan).
3. Por cada fila de datos:
   - Texto de la primera celda → split por `.` (primera ocurrencia) → `código` (parte izquierda) y `nombre` (parte derecha).
   - **Limpieza del nombre**: quitar `(N)` o `(NN)` (referencias a notas a pie), quitar `. . . . . . .` (puntos de relleno), trim final.
   - Texto de la segunda celda → `horasTotales` (entero).
   - Texto de la tercera celda → `horasSemanalesPrimerCurso` (entero o vacío).
   - Texto de la cuarta celda → `horasSemanalesSegundoCurso2T` (entero o vacío).
   - Texto de la quinta celda → `horasTotalesSegundoCurso1T` (entero o vacío).
4. **Determinar curso**:
   - Si tiene horas en columna 3 → curso 1.
   - Si tiene horas en columna 4 (2T) o 5 (1T del trimestre del proyecto) → curso 2.
   - El módulo de FCT y proyecto suelen ir en curso 2 con horas totales.
5. **Filtrar filas espurias**:
   - Filas tipo "Horario reservado para el módulo impartido en inglés" → ignorar (no es un módulo curricular real).
   - Fila "Total en el ciclo formativo …" → ignorar.

### 3.3 Tipo de módulo (TipoMateria)

Heurística por nombre del módulo:

| Patrón en el nombre | TipoMateria |
|---|---|
| `Formación en Centros de Trabajo` o `FCT` | `FCT` |
| `Proyecto de` | `PROYECTO` |
| Cualquier otro | `MODULO` |

---

## 4. Lo que el adapter NO va a extraer (todavía)

- **Competencias profesionales** (`competencias` en el modelo). Están en el RD principal pero requiere parsing complejo de `<articulo>`. Aplazado.
- **Prerrequisitos** entre módulos. No están explícitos en el XML; vendrían de inferencia. Aplazado.
- **Equivalencias** entre módulos LOE/LOMLOE. Cuando sea relevante.

---

## 5. Pre-requisitos pendientes

Antes de que `BoeRdAdapter` pueda funcionar:

1. **Añadir campo `curriculoUrl`** al modelo `CatalogoItinerario` (nullable). La URL del currículo del Ministerio que tiene la tabla de horas.
2. **Migración Doctrine**: añadir columna `curriculo_url VARCHAR(500) DEFAULT NULL`.
3. **Modificar `TodoFpHttpAdapter`** para pasar `curriculoUrl` al DTO (ahora lo extrae y descarta).
4. **Modificar `CatalogoItinerarioDto`** para llevar el campo.
5. **Re-ejecutar** `app:catalogo:refresh todofp_http` → llena `curriculoUrl` en los 229 itinerarios existentes.

A partir de ahí, `BoeRdAdapter` lee `curriculoUrl` para extraer módulos+horas y `boletinUrl` para metadata complementaria si se quiere.

---

## 6. Riesgos detectados

1. **Currículos antiguos sin tabla estructurada.** Algunos RDs muy viejos (anteriores a 2010) podrían tener el currículo en formato libre. Probar con varios RDs antes de generalizar.
2. **Cursos de Especialización.** Tienen menos horas (~600h) y pueden no tener cabecera "Primer curso/Segundo curso" — son de un solo curso. La heurística debe contemplarlo.
3. **FP Básica.** RDs distintos a Medio/Superior. Tablas pueden tener otra estructura.
4. **Ciclos LOE en transición.** Algunos están en TodoFP pero su currículo es muy antiguo o no existe en formato XML del BOE. Mitigación: si fetch del currículo falla, el adapter loguea WARN y deja el itinerario sin módulos detallados.
