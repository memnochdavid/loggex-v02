# Selectores HTML del scraper TodoFP

> **Estado:** validación inicial 2026-04-25 mediante inspección manual con WebFetch a 4 páginas tipo. Cuando TodoFP rediseñe su HTML, este documento es el punto de partida para reescribir el parser.

Este documento registra los selectores CSS y la estrategia de extracción que `TodoFpHttpAdapter` aplica sobre cada tipo de página. Convive con tests de snapshot en `backend/tests/Fixtures/todofp/` que detectan cuando el HTML cambia.

---

## 0. Decisión de herramienta

**Symfony `HttpClient` + `DomCrawler`** es suficiente. Confirmado:

- El HTML de TodoFP es **estático**. No depende de JavaScript para renderizar el contenido relevante (familias, ciclos, RDs).
- No hay placeholders vacíos, no hay APIs internas que rellenen tablas, no hay React/Vue/etc.

→ **No necesitamos `symfony/panther`** (Chromium headless), lo que evita la dependencia pesada y el coste operativo de un navegador real en cada refresh.

---

## 1. Página tipo: índice de familias profesionales

**URL canónica:** `https://www.todofp.es/que-estudiar/familias-profesionales.html`

**Qué extraemos:**

| Campo | Cómo |
|---|---|
| Lista de familias (URL + nombre) | Iterar todos los `<a>` cuyo `href` cumpla el patrón `/que-estudiar/familias-profesionales/[slug].html` |
| Nombre de la familia | Atributo `alt` del `<img>` hijo del `<a>` |
| Slug (para construir URL absoluta) | Última parte del path antes de `.html` |

**Pseudocódigo:**

```php
$crawler = new Crawler($html);
$familias = $crawler
    ->filter('a[href^="/que-estudiar/familias-profesionales/"]')
    ->reduce(fn (Crawler $a) => preg_match(
        '#^/que-estudiar/familias-profesionales/[^/]+\.html$#',
        $a->attr('href')
    ))
    ->each(function (Crawler $a) {
        $img = $a->filter('img')->first();
        return [
            'url'    => 'https://www.todofp.es' . $a->attr('href'),
            'nombre' => $img->count() ? trim($img->attr('alt') ?? '') : trim($a->text()),
        ];
    });
```

**Resultado esperado:** ~26 familias profesionales.

**Riesgos del selector:**

- TodoFP no usa clases CSS específicas en estos enlaces. Confiamos en el patrón del `href` para identificarlos.
- Si añaden enlaces que cumplan el patrón pero NO sean familias (p. ej. una página meta), filtraremos en código.
- Si rediseñan moviendo familias a un menú JS o a otra ruta, este selector se rompe → caer al test de snapshot, replantear.

---

## 2. Página tipo: detalle de una familia (con tabla de ciclos)

**URL canónica:** `https://www.todofp.es/que-estudiar/familias-profesionales/[slug].html`

(Ejemplo: `informatica-comunicaciones.html`, `sanidad.html`, `administracion-gestion.html`.)

**Estructura observada:**

- El contenido principal es una **tabla HTML** (sin clase identificable estable).
- 7 columnas, en este orden exacto en el momento de la inspección:
  1. **Nivel** — solo un `<img>` con `src` que contiene `gb.png`/`gm.png`/`gs.png`/`ce.png` (FP Básica/Medio/Superior/Especialización).
  2. **Titulación** — `<a>` con el nombre del ciclo y `href` a la página de detalle del ciclo en TodoFP.
  3. **Real Decreto** — `<a>` apuntando al BOE (URL tipo `https://www.boe.es/...`). Puede haber múltiples (RD original + modificaciones).
  4. **Currículo Ministerio** — `<a>` al BOE con el RD curricular.
  5. **Currículos CCAA** — múltiples `<a>` por CCAA (DOCM, BOJA, …). Lo dejamos para la capa 3.
  6. **Perfiles Profesionales** — texto/PDF, irrelevante para nosotros.
  7. **Dónde Estudiar** — link, irrelevante.

**Estrategia de selección (basada en clases CSS estables):**

Tras la inspección manual del HTML real (2026-04-25), descubrimos que TodoFP aplica clases CSS consistentes a cada celda. Esto es **más estable** que un mapping por texto de cabecera porque las clases están programadas en la plantilla:

| Clase CSS | Significado |
|---|---|
| `<th class="Nv">` o `<td class="Nv">` | Celda de Nivel (con icono PNG) |
| `<td class="Tit">` | Celda de Titulación (nombre + URL detalle) |
| `<td class="Rd">` | Celda de Real Decreto (URL al BOE) |
| `<td class="Curriculomecd">` | Currículo Ministerio (URL al BOE) |
| `<td class="Curriculoccaa">` | Currículos CCAA |
| `<td class="Pp">` | Perfiles Profesionales |
| `<td class="Dondeestudiar">` | Dónde Estudiar |

**Identificación de la tabla correcta** entre múltiples `<table>` en la página:
- La tabla buena es la única con `<th class="Nv">` o `<td class="Nv">` en su body.

**Manejo de `rowspan`:**
- La celda `<th class="Nv">` lleva un `rowspan="N"` cuando hay N ciclos del mismo nivel agrupados.
- Las filas siguientes del grupo NO tienen celda de nivel propia.
- El parser **hereda** el `nivelIconSrc` de la fila anterior cuando no encuentra una celda `Nv` propia.

**Por cada fila de datos:**

| Dato | Cómo extraer |
|---|---|
| Nivel | `<img>` dentro de `<th.Nv>`/`<td.Nv>` → leer `src`, matchear `gb.png`/`gm.png`/`gs.png`/`ce.png` → mapear a `EtapaEducativa` |
| Nombre del ciclo | Texto del primer `<a>` dentro de `<td.Tit>` |
| URL detalle TodoFP | `href` del mismo `<a>` |
| URL del RD del BOE | Primer `<a>` con `href` que contiene `boe.es` dentro de `<td.Rd>` |
| URL del currículo | Primer `<a>` con `href` que contiene `boe.es` dentro de `<td.Curriculomecd>` |

**Ejemplo de HTML real (extracto de informatica-comunicaciones.html):**

```html
<tr class="fpb">
    <th rowspan="2" headers="nivel" id="fpb" class="Nv">
        <img alt="Logotipo Fp Básica" src="…/gb.png">
    </th>
    <td headers="titulacion fpb" class="Tit">
        <p><a id="tit-informatica-oficina" href="/que-estudiar/familias-profesionales/informatica-comunicaciones/informatica-oficina.html">Título Profesional Básico en Informática de Oficina</a></p>
    </td>
    <td headers="real-decreto fpb" class="Rd">
        <a href="https://www.boe.es/eli/es/rd/2014/05/16/356"><img …></a>
    </td>
    <td headers="curriculo-mecd fpb" class="Curriculomecd">
        <a href="http://boe.es/diario_boe/txt.php?id=BOE-A-2014-9335"><img …></a>
    </td>
    <!-- … resto de columnas … -->
</tr>
<tr class="fpb">
    <!-- (Sin th de nivel — heredado por rowspan) -->
    <td headers="titulacion fpb" class="Tit">…</td>
    <td headers="real-decreto fpb" class="Rd">
        <ul>
            <li><a href="https://www.boe.es/eli/es/rd/2014/02/28/127/con">…</a></li>
            <li><a href="https://www.boe.es/eli/es/rd/2024/05/21/498">Modificación</a></li>
        </ul>
    </td>
    <!-- … -->
</tr>
```

**Mapeo de iconos a etapa educativa:**

```php
match (true) {
    str_contains($iconSrc, '/gb.png') => EtapaEducativa::FP_BASICA,
    str_contains($iconSrc, '/gm.png') => EtapaEducativa::FP_MEDIO,
    str_contains($iconSrc, '/gs.png') => EtapaEducativa::FP_SUPERIOR,
    str_contains($iconSrc, '/ce.png') => EtapaEducativa::FP_ESPECIALIZACION,
    default                           => null, // log warning, skip
};
```

**Riesgos del selector:**

- Si TodoFP cambia los nombres de los iconos PNG → el mapeo falla. Mitigación: el adapter loguea WARN cuando no reconoce un icono, y el test de snapshot detecta cambios.
- Si TodoFP cambia la cabecera ("Real Decreto" → "Norma reguladora") → el adapter no encuentra la columna. Mitigación: el adapter exige que la cabecera incluya las columnas críticas, lanza error claro si falta una.
- Múltiples `<a>` en la columna "Real Decreto" (RD + modificaciones). Cogemos el primero como RD principal; el resto se ignora en v1 pero se registra en logs para futura iteración.

---

## 3. Página tipo: detalle de un ciclo (NO la usamos en v1)

**Ejemplo:** `https://www.todofp.es/que-estudiar/familias-profesionales/informatica-comunicaciones/des-aplicaciones-web.html`

**Decisión:** **NO scrapeamos esta página en `TodoFpHttpAdapter` v1**.

**Por qué no:**

- No expone el código oficial del ciclo (IFC32, etc.).
- No tiene tabla estructurada de módulos.
- No tiene horas por módulo.
- Solo añade el dato `duracionTotalHoras` (`<div>2000h</div>`), que también está en el RD del BOE.

→ Todo el detalle relevante (código, módulos, horas, duración total) se obtendrá del BOE en `BoeRdAdapter` (Fase 1.7).

Si en una iteración futura quisiéramos extraer la duración total desde TodoFP para acelerar (sin tener que parsear el RD entero), añadiríamos una pasada opcional aquí. Mientras tanto, queda como NULL hasta que el BoeRdAdapter la rellene.

---

## 4. Validación y tests

### Fixtures HTML

En `backend/tests/Fixtures/todofp/` guardamos snapshots reales:

- `familias-index.html` — descargado el 2026-04-25.
- `familia-informatica.html` — descargado el 2026-04-25.
- (Cuando lleguen casos límite reales, añadir más.)

### Tests

`tests/Catalogo/Source/TodoFpHttpAdapterTest.php` carga el fixture, lo pasa al parser y verifica:

- Index: ~26 familias detectadas, primera URL conocida.
- Familia: ~5 ciclos detectados, con código (cuando lo añadamos), nombre, nivel y RD URL.

Si TodoFP cambia el HTML, los tests fallan con un diff humanamente legible.

### Refresh manual de fixtures

Cuando un test falle por cambio en TodoFP:

```bash
# (script futuro) re-descarga las fixtures y muestra diff
sudo docker compose exec backend php bin/console app:catalogo:fixtures-refresh todofp
```

---

## 5. Resumen ejecutivo

- **Index de familias** → 26 familias con URL.
- **Por cada familia** → tabla con ~5-15 ciclos: nivel (icono), nombre, URL del RD, URL del currículo.
- **Por cada ciclo** → datos van a `CatalogoItinerarioDto` con: nombre, etapa, familia (heredada), nivel (string), `boletinUrl` (RD), `vigenteDesde` (a deducir del RD), materias = `[]` (las completa BoeRdAdapter), `codigoOficial` = a derivar más adelante (también del RD).
- **Total HTTP requests por refresh:** 1 (index) + 26 (familias) ≈ 27. ~30-60 segundos con 1s de throttle entre cada.
- **NO scrapeamos** las páginas de detalle de cada ciclo (no aportan).

→ Listo para programar `TodoFpHttpAdapter`.
