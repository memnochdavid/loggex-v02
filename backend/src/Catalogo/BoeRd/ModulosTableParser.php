<?php

namespace App\Catalogo\BoeRd;

use App\Entity\Catalogo\TipoMateria;
use Symfony\Component\DomCrawler\Crawler;

/**
 * Extrae la lista de módulos profesionales con sus horas de la tabla del Anexo II
 * del currículo del Ministerio (Orden EDU) o, si no existe currículo separado
 * (caso FP Básica), de la tabla equivalente en el RD del título.
 *
 * Estructura esperada de la tabla (ver `BOE_XML_STRUCTURE.md`):
 *   1ª fila de cabecera (rowspan/colspan): "Módulo profesional", "Duración (horas)",
 *      "Primer curso (h/semana)", "Segundo curso" (cspan=2).
 *   2ª fila de cabecera: "2 trimestres (h/semana)", "1 trimestre (horas)".
 *   Filas de datos: cada una con 5 celdas (módulo, duración, h/sem 1º, h/sem 2º 2T, h 2º 1T).
 *
 * Heurísticas:
 *   - Filas espurias ("Horario reservado para el módulo impartido en inglés",
 *     "Total en el ciclo formativo") se ignoran.
 *   - Curso (1 vs 2): la columna que tiene número.
 *   - Tipo (MODULO/FCT/PROYECTO): por palabras clave en el nombre del módulo.
 */
final class ModulosTableParser
{
    /**
     * @return list<array{
     *   codigoOficial: string,
     *   nombre: string,
     *   tipo: TipoMateria,
     *   curso: ?int,
     *   horasTotales: ?int,
     *   horasSemanales: ?float,
     *   orden: int,
     * }>
     */
    public function parse(string $xml): array
    {
        $crawler = new Crawler();
        $crawler->addXmlContent($xml);

        // Localizar la tabla cuya cabecera contiene "Módulo profesional" + duración/horas.
        // No filtramos por @class porque varía entre RDs ("tabla", "tabla_ancha", …);
        // confiamos en la heurística de cabecera, que es más estable.
        $tables = $crawler->filterXPath('//texto//table');
        $targetTable = null;
        foreach ($tables as $tableNode) {
            $tableCrawler = new Crawler($tableNode);
            // Algunos RDs anteponen 1-2 filas de caption ("ANEXO II", "Ciclo formativo: …")
            // antes del encabezado real. Combinamos hasta las 3 primeras filas para detectar.
            $headerCombined = '';
            for ($r = 1; $r <= 3; $r++) {
                $rowCrawler = $tableCrawler->filterXPath('.//tr[' . $r . ']');
                if ($rowCrawler->count() > 0) {
                    $headerCombined .= ' ' . $rowCrawler->text('', false);
                }
            }
            if (mb_stripos($headerCombined, 'Módulo profesional') !== false
                && (mb_stripos($headerCombined, 'Duración') !== false
                    || mb_stripos($headerCombined, 'horas') !== false
                    || mb_stripos($headerCombined, 'h/semana') !== false)) {
                $targetTable = $tableNode;
                break;
            }
        }

        if ($targetTable === null) {
            return [];
        }

        $tableCrawler = new Crawler($targetTable);
        $rows = $tableCrawler->filterXPath('.//tr');

        $modulos = [];
        $orden = 0;

        foreach ($rows as $rowNode) {
            $cells = $this->extractCells($rowNode);
            if (count($cells) < 2) {
                continue;
            }

            if ($this->isSpuriousRow($cells[0]) || $this->isSpuriousRow($cells[1] ?? '')) {
                continue;
            }

            $codigo = null;
            $nombre = null;
            $horasCells = [];

            // Variante A (legacy Orden EDU): "0612. Nombre del módulo" en cells[0],
            // duración + h/sem en cells[1..4].
            $parsed = $this->parsePrimaryCell($cells[0]);
            if ($parsed !== null) {
                [$codigo, $nombre] = $parsed;
                $horasCells = array_slice($cells, 1);
            } elseif (preg_match('/^\s*(\d{3,4}[a-zA-Z_]?)\s*\.?\s*$/u', $cells[0], $m)) {
                // Variante B (LOMLOE 2024+): código solo en cells[0], nombre en cells[1],
                // horas en cells[2..N] (típicamente "Horas 50%", "Horas 60%", ECTS).
                $cleaned = $this->cleanName($cells[1] ?? '');
                if ($cleaned !== '') {
                    $codigo = trim($m[1]);
                    $nombre = $cleaned;
                    $horasCells = array_slice($cells, 2);
                }
            }

            if ($codigo === null || $nombre === null) {
                continue;  // Fila de cabecera, sub-cabecera o no curricular.
            }

            $horasInfo = $this->extractHoras($horasCells);

            $modulos[] = [
                'codigoOficial' => $codigo,
                'nombre' => $nombre,
                'tipo' => $this->detectTipo($nombre),
                'curso' => $horasInfo['curso'],
                'horasTotales' => $horasInfo['horasTotales'],
                'horasSemanales' => $horasInfo['horasSemanales'],
                'orden' => ++$orden,
            ];
        }

        return $modulos;
    }

    /**
     * Determina horas totales, h/semana y curso a partir de las celdas posteriores
     * al nombre del módulo. Soporta dos layouts:
     *
     *  Legacy (Orden EDU): [duración total, h/sem 1º, h/sem 2º (2T), horas 2º (1T)]
     *  LOMLOE 2024+:       [horas modalidad A, horas modalidad B, (ects)]
     *
     * Heurística: las celdas legacy con `h/sem` traen valores < 50; las LOMLOE
     * traen valores >= 50 (horas totales completas) en las dos primeras columnas.
     *
     * @param list<string> $cells
     * @return array{horasTotales: ?int, horasSemanales: ?float, curso: ?int}
     */
    private function extractHoras(array $cells): array
    {
        $horasTotales = $this->parseInt($cells[0] ?? '');
        $h1 = $this->parseFloat($cells[1] ?? '');
        $h2 = $this->parseFloat($cells[2] ?? '');
        $h3 = $this->parseInt($cells[3] ?? '');

        // LOMLOE: dos columnas de horas totales por modalidad. Tomamos la mayor.
        if ($horasTotales !== null && $horasTotales >= 50 && $h1 !== null && $h1 >= 50) {
            return [
                'horasTotales' => (int) max($horasTotales, $h1),
                'horasSemanales' => null,
                'curso' => null,
            ];
        }

        // Legacy: cells[1]=h/sem 1º curso, cells[2]=h/sem 2º curso (2T), cells[3]=horas 2º curso (1T proyecto/FCT).
        if ($h1 !== null && $h1 > 0 && $h1 < 50) {
            return ['horasTotales' => $horasTotales, 'horasSemanales' => $h1, 'curso' => 1];
        }
        if ($h2 !== null && $h2 > 0 && $h2 < 50) {
            return ['horasTotales' => $horasTotales, 'horasSemanales' => $h2, 'curso' => 2];
        }
        if ($h3 !== null && $h3 > 0) {
            return ['horasTotales' => $horasTotales, 'horasSemanales' => null, 'curso' => 2];
        }

        return ['horasTotales' => $horasTotales, 'horasSemanales' => null, 'curso' => null];
    }

    private function cleanName(string $text): string
    {
        $text = preg_replace('/\s*\.\s*\.\s*\.\s*[\.\s]*$/u', '', $text);
        $text = preg_replace('/\s*\(\d+\)\s*/', ' ', $text);
        $text = preg_replace('/\s+/u', ' ', $text);
        return trim($text, ". \t\n");
    }

    /**
     * @return list<string>  textos de cada celda (td) en orden.
     */
    private function extractCells(\DOMNode $rowNode): array
    {
        $cells = [];
        if (!$rowNode instanceof \DOMElement) {
            return $cells;
        }
        foreach ($rowNode->getElementsByTagName('td') as $td) {
            $cells[] = trim($td->textContent ?? '');
        }
        return $cells;
    }

    private function isSpuriousRow(string $text): bool
    {
        // Filas no curriculares pero presentes en la tabla.
        $patterns = [
            'horario reservado',
            'total en el ciclo',
            'total ciclo',
        ];
        $lower = mb_strtolower($text, 'UTF-8');
        foreach ($patterns as $pat) {
            if (str_contains($lower, $pat)) {
                return true;
            }
        }
        return false;
    }

    /**
     * Acepta varios formatos del nombre que aparecen entre RDs:
     *   "0483. Sistemas informáticos (2) . . . . ."   (DAW Orden EDU/2887/2010)
     *   "0370 Planificación y Administración de Redes" (ASIR Orden EDU/392/2010)
     *   "0612. Desarrollo web en entorno cliente"     (variantes)
     *
     * → ['0612', 'Desarrollo web en entorno cliente']
     */
    private function parsePrimaryCell(string $text): ?array
    {
        // Empieza por dígitos (3-4) opcionalmente con letra, separados del nombre por punto y/o espacios.
        if (!preg_match('/^\s*(\d{3,4}[a-zA-Z_]?)\s*\.?\s+(.+)$/u', $text, $m)) {
            return null;
        }
        $codigo = trim($m[1]);
        $nombre = trim($m[2]);

        // Limpieza del nombre: quitar puntos de relleno y referencias a notas.
        $nombre = preg_replace('/\s*\.\s*\.\s*\.\s*[\.\s]*$/u', '', $nombre);  // ". . . . ."
        $nombre = preg_replace('/\s*\(\d+\)\s*/', ' ', $nombre);                // "(1) (2)"
        $nombre = preg_replace('/\s+/u', ' ', $nombre);                         // espacios múltiples
        $nombre = trim($nombre, ". \t\n");

        if ($nombre === '') {
            return null;
        }

        return [$codigo, $nombre];
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

    private function parseInt(string $text): ?int
    {
        $text = trim($text);
        if ($text === '' || !preg_match('/\d/', $text)) {
            return null;
        }
        $clean = (int) preg_replace('/[^\d]/', '', $text);
        return $clean > 0 ? $clean : null;
    }

    private function parseFloat(string $text): ?float
    {
        $text = trim($text);
        if ($text === '' || !preg_match('/\d/', $text)) {
            return null;
        }
        // En BD el separador puede ser "," (3,5h/sem) o "." (poco probable en BOE pero por si acaso).
        $clean = str_replace(',', '.', preg_replace('/[^\d.,]/', '', $text));
        return is_numeric($clean) && $clean > 0 ? (float) $clean : null;
    }
}
