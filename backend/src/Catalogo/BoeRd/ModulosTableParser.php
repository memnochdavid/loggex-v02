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
            // Algunas tablas tienen "Módulo profesional" en la 2ª fila (rowspan/colspan
            // las parte). Combinamos las dos primeras filas para detectar.
            $headerCombined = $tableCrawler->filterXPath('.//tr[1]')->text('', false)
                . ' ' . $tableCrawler->filterXPath('.//tr[2]')->text('', false);
            if (stripos($headerCombined, 'Módulo profesional') !== false
                && (stripos($headerCombined, 'Duración') !== false
                    || stripos($headerCombined, 'horas') !== false
                    || stripos($headerCombined, 'h/semana') !== false)) {
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
        $headerRowsToSkip = 2;  // Las dos primeras filas son cabecera (rowspan/colspan).

        foreach ($rows as $i => $rowNode) {
            if ($i < $headerRowsToSkip) {
                continue;
            }

            $cells = $this->extractCells($rowNode);
            if (count($cells) < 2) {
                continue;
            }

            $primaryText = $cells[0];

            if ($this->isSpuriousRow($primaryText)) {
                continue;
            }

            $parsed = $this->parsePrimaryCell($primaryText);
            if ($parsed === null) {
                continue;
            }
            [$codigo, $nombre] = $parsed;

            $horasTotales = $this->parseInt($cells[1] ?? '');
            $horasSem1 = $this->parseFloat($cells[2] ?? '');  // Primer curso h/sem
            $horasSem2 = $this->parseFloat($cells[3] ?? '');  // Segundo curso 2T h/sem
            $horasTrim2 = $this->parseInt($cells[4] ?? '');   // Segundo curso 1T horas

            // Determinar curso por columna que tenga valor.
            $curso = null;
            $horasSemanalesElegidas = null;
            if ($horasSem1 !== null && $horasSem1 > 0) {
                $curso = 1;
                $horasSemanalesElegidas = $horasSem1;
            } elseif ($horasSem2 !== null && $horasSem2 > 0) {
                $curso = 2;
                $horasSemanalesElegidas = $horasSem2;
            } elseif ($horasTrim2 !== null && $horasTrim2 > 0) {
                $curso = 2;
                $horasSemanalesElegidas = null;  // Solo horas totales, sin h/sem (proyecto, FCT).
            }

            $modulos[] = [
                'codigoOficial' => $codigo,
                'nombre' => $nombre,
                'tipo' => $this->detectTipo($nombre),
                'curso' => $curso,
                'horasTotales' => $horasTotales,
                'horasSemanales' => $horasSemanalesElegidas,
                'orden' => ++$orden,
            ];
        }

        return $modulos;
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
