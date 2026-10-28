<?php

namespace App\Catalogo\BoeRd;

use App\Entity\Catalogo\TipoMateria;
use Symfony\Component\DomCrawler\Crawler;

/**
 * Extrae módulos de un RD que NO usa tabla, sino secciones marcadas con
 * `<strong>Módulo Profesional: …</strong>` / `<strong>Código: XXXX.</strong>` /
 * `<strong>Duración: HH horas.</strong>`.
 *
 * Aplica a:
 *  - FP Básica (RDs multi-título tipo RD 127/2014): cada título vive en un
 *    `<p class="anexo_tit">` y dentro tiene secciones de módulos.
 *  - Cursos de Especialización (RDs por curso, sin tabla resumen).
 *
 * El parser opera sobre un RANGO de párrafos `<p>` (no sobre todo el documento)
 * para que el caller pueda restringirlo al anexo correcto en FP Básica.
 *
 * Variantes toleradas:
 *  - Header puede ser "Módulo Profesional:" o "Módulo:" (sin Profesional).
 *  - El nombre puede estar partido en varios `<strong>` (estilo italics).
 *  - Pueden aparecer marcadores `Créditos ECTS:` opcionales.
 *  - Algún módulo puede no traer `Duración:` (raro pero posible).
 *
 * No se trata de un parser de la "lista 3.2" — se va al detalle por sección,
 * porque en RDs de Especialización no hay sección 3.2 separada y porque las
 * horas viven en las secciones (no en la lista). Para FP Básica además es
 * resistente al desorden ocasional de la lista resumen.
 */
final class SeccionModulosParser
{
    // Todas las regex case-insensitive: distintos RDs alternan "Módulo Profesional"
    // (capitalizado, RDs antiguos) y "Módulo profesional" (minúscula, RDs ≥2020).
    private const HEADER_RE  = '/^\s*Módulo(?:\s+Profesional)?:\s*(.+?)[\.\s]*$/iu';
    private const CODIGO_RE  = '/^\s*Código:\s*(\d{3,5}[A-Za-z_]?)[\.\s]*$/iu';
    private const DURACION_RE = '/Duración:\s*(\d[\d.\s]*)\s*horas?/iu';
    private const ECTS_RE    = '/Cr[eé]ditos\s*ECTS:\s*(\d+)/iu';

    /**
     * @param Crawler $paragraphs lista (Crawler) de `<p>` ya filtrados al rango deseado.
     * @return list<array{
     *   codigoOficial: string,
     *   nombre: string,
     *   tipo: TipoMateria,
     *   curso: ?int,
     *   horasTotales: ?int,
     *   horasSemanales: ?float,
     *   ects: ?int,
     *   orden: int,
     * }>
     */
    public function parseFromParagraphs(Crawler $paragraphs): array
    {
        $materias = [];
        $orden = 0;

        // Estado: cuando vemos un header, abrimos un módulo "abierto" hasta que
        // veamos un Duración: posterior (lo cierra) o llegue el siguiente header
        // (lo cierra sin duración).
        $current = null;

        foreach ($paragraphs as $p) {
            $text = $this->paragraphText($p);
            if ($text === '') {
                continue;
            }

            // Procesar línea por línea (algunos RDs concatenan varios marcadores en un único `<p>`).
            foreach (preg_split('/\R+/u', $text) as $line) {
                $line = trim($line);
                if ($line === '') {
                    continue;
                }

                if (preg_match(self::HEADER_RE, $line, $m)) {
                    if ($current !== null) {
                        $materias[] = $this->finalizeModulo($current, ++$orden);
                    }
                    $current = [
                        'nombre' => $this->cleanName($m[1]),
                        'codigoOficial' => null,
                        'horasTotales' => null,
                        'ects' => null,
                    ];
                    continue;
                }

                if ($current === null) {
                    continue; // Líneas previas al primer módulo: ignorar.
                }

                if ($current['codigoOficial'] === null && preg_match(self::CODIGO_RE, $line, $m)) {
                    $current['codigoOficial'] = $m[1];
                    continue;
                }

                if ($current['horasTotales'] === null && preg_match(self::DURACION_RE, $line, $m)) {
                    $clean = (int) preg_replace('/[^\d]/', '', $m[1]);
                    $current['horasTotales'] = $clean > 0 ? $clean : null;
                    continue;
                }

                if ($current['ects'] === null && preg_match(self::ECTS_RE, $line, $m)) {
                    $current['ects'] = (int) $m[1];
                    continue;
                }
            }
        }

        if ($current !== null) {
            $materias[] = $this->finalizeModulo($current, ++$orden);
        }

        // Filtrar módulos que solo tengan nombre pero ni código ni horas — son
        // falsos positivos (p. ej. "Módulo: Resultados de aprendizaje" como mero título).
        return array_values(array_filter($materias, static function (array $m): bool {
            return !empty($m['codigoOficial']);
        }));
    }

    /**
     * Helper de conveniencia: parsea el documento entero (todos los `<p>` en `<texto>`).
     * Usado por EspecializacionParser cuando no hay anexo a localizar.
     */
    public function parseAllParagraphs(string $xml): array
    {
        $crawler = new Crawler();
        $crawler->addXmlContent($xml);
        $paragraphs = $crawler->filterXPath('//texto//p');
        return $this->parseFromParagraphs($paragraphs);
    }

    /**
     * Toma el texto del párrafo concatenando hijos.
     *
     * Reglas (descubiertas por casos reales del BOE):
     *  - `<br>` → `\n` (salto real del contenido).
     *  - Text-node entre elementos (p. ej. entre dos `<strong>`) que sea
     *    **puro whitespace de formato XML** (newlines + indentación): se
     *    **descarta**. Esto es CRÍTICO porque BOE divide palabras en varios
     *    `<strong>` por estilos: `<strong>Reparació</strong>\n  <strong>n …</strong>`
     *    debe quedar como "Reparación …", NO como "Reparació n …".
     *  - Cualquier otro text-node se conserva tal cual (sus espacios son contenido).
     *  - Otros elementos hijos: `textContent` (preserva sus espacios internos).
     *
     * Después se colapsan runs de espacios/tabs (no `\n`) a uno solo.
     */
    private function paragraphText(\DOMNode $p): string
    {
        if (!$p instanceof \DOMElement) {
            return '';
        }
        $parts = [];
        foreach ($p->childNodes as $child) {
            if ($child instanceof \DOMElement && strtolower($child->nodeName) === 'br') {
                $parts[] = "\n";
                continue;
            }
            if ($child instanceof \DOMText) {
                $t = $child->textContent ?? '';
                if ($t === '' || preg_match('/^\s+$/u', $t)) {
                    continue; // formato XML, no contenido.
                }
                $parts[] = $t;
                continue;
            }
            // Elemento hijo (p. ej. <strong>, <em>): tomar su textContent íntegro.
            $parts[] = $child->textContent ?? '';
        }
        $text = implode('', $parts);
        $text = preg_replace('/[ \t]+/u', ' ', $text); // colapsar espacios/tabs, NO \n.
        return trim($text);
    }

    /**
     * @param array{nombre: string, codigoOficial: ?string, horasTotales: ?int, ects: ?int} $current
     * @return array{
     *   codigoOficial: string,
     *   nombre: string,
     *   tipo: TipoMateria,
     *   curso: ?int,
     *   horasTotales: ?int,
     *   horasSemanales: ?float,
     *   ects: ?int,
     *   orden: int,
     * }
     */
    private function finalizeModulo(array $current, int $orden): array
    {
        return [
            'codigoOficial' => $current['codigoOficial'] ?? '',
            'nombre' => $current['nombre'],
            'tipo' => $this->detectTipo($current['nombre']),
            'curso' => null, // FP Básica/Especialización no separan h/sem por curso en el RD.
            'horasTotales' => $current['horasTotales'],
            'horasSemanales' => null,
            'ects' => $current['ects'],
            'orden' => $orden,
        ];
    }

    private function cleanName(string $raw): string
    {
        $name = preg_replace('/\s+/u', ' ', $raw);
        return trim($name, ". \t\n");
    }

    private function detectTipo(string $nombre): TipoMateria
    {
        $lower = mb_strtolower($nombre, 'UTF-8');
        if (str_contains($lower, 'formación en centros de trabajo') || preg_match('/\bfct\b/iu', $nombre)) {
            return TipoMateria::FCT;
        }
        if (str_contains($lower, 'proyecto')) {
            return TipoMateria::PROYECTO;
        }
        return TipoMateria::MODULO;
    }
}
