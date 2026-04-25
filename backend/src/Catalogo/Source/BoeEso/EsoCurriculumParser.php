<?php

namespace App\Catalogo\Source\BoeEso;

use App\Entity\Catalogo\TipoMateria;
use Symfony\Component\DomCrawler\Crawler;

/**
 * Parser del Anexo IV del RD 217/2022 (LOMLOE ESO).
 *
 * El anexo es una tabla con tres secciones marcadas por celdas con `<em>`:
 *   - "Para los tres primeros cursos"
 *   - "En algún curso de la etapa"
 *   - "Para el cuarto curso"
 *
 * Cada fila siguiente es: `<td>nombre.</td><td>horas</td>`.
 *
 * Los nombres de cuarto curso pueden llevar `*` final indicando que es
 * optativa (el alumno elige tres entre las marcadas). El parser detecta
 * el asterisco y asigna `tipo = OPTATIVA`.
 *
 * Religión se trata como `ESPECIFICA` (oferta obligatoria del centro pero
 * elección del alumnado/familia).
 *
 * El parser produce `array<int, array{...}>` con los campos suficientes
 * para que `BoeEsoAdapter` construya `CatalogoMateriaDto` luego.
 */
final class EsoCurriculumParser
{
    /**
     * @return list<array{
     *   nombre: string,
     *   horasTotales: int,
     *   curso: ?int,
     *   tipo: TipoMateria,
     *   obligatoria: bool,
     *   orden: int,
     * }>
     */
    public function parse(string $xml): array
    {
        $crawler = new Crawler();
        $crawler->addXmlContent($xml);

        // Localizar el ANEXO IV por su <p class="anexo_num">ANEXO IV</p>.
        // El siguiente <table class="tabla"> es el horario.
        $anexoIvTable = $this->findAnexoIvTable($crawler);
        if ($anexoIvTable === null) {
            throw new \RuntimeException('No encontré la tabla del Anexo IV en el RD 217/2022');
        }

        $rows = (new Crawler($anexoIvTable))->filterXPath('.//tr');

        $section = null; // 'pri' (1-3) | 'algun' (cualquier curso) | 'cuarto' (4)
        $orden = 0;
        $materias = [];

        foreach ($rows as $rowNode) {
            $cells = $this->extractCells($rowNode);

            // Fila de cabecera de sección: una celda con <em>
            $headerCell = $this->extractHeaderCell($rowNode);
            if ($headerCell !== null) {
                $headerLower = mb_strtolower($headerCell, 'UTF-8');
                if (str_contains($headerLower, 'tres primeros')) {
                    $section = 'pri';
                } elseif (str_contains($headerLower, 'algún curso')) {
                    $section = 'algun';
                } elseif (str_contains($headerLower, 'cuarto curso')) {
                    $section = 'cuarto';
                }
                continue;
            }

            // Fila de datos: 2 celdas (nombre, horas).
            if (count($cells) < 2 || $section === null) {
                continue;
            }
            $rawName = trim($cells[0]);
            $rawHoras = trim($cells[1]);

            $horas = $this->parseInt($rawHoras);
            if ($horas === null || $rawName === '') {
                continue;
            }

            $isOpcional = $this->endsWithAsterisk($rawName);
            $name = $this->cleanName($rawName);

            $curso = match ($section) {
                'cuarto' => 4,
                default => null, // 1-3 sin curso específico (mínimo nacional)
            };

            $tipo = match (true) {
                stripos($name, 'religión') !== false => TipoMateria::ESPECIFICA,
                $isOpcional => TipoMateria::OPTATIVA,
                default => TipoMateria::TRONCAL,
            };

            $materias[] = [
                'nombre' => $name,
                'horasTotales' => $horas,
                'curso' => $curso,
                'tipo' => $tipo,
                'obligatoria' => !$isOpcional,
                'orden' => ++$orden,
            ];
        }

        return $materias;
    }

    private function findAnexoIvTable(Crawler $crawler): ?\DOMElement
    {
        // Buscar el <p> con texto "ANEXO IV" y luego el siguiente <table>.
        $paragraphs = $crawler->filterXPath('//texto//p');
        $foundAnexo = false;
        foreach ($paragraphs as $p) {
            $text = trim($p->textContent ?? '');
            if (!$foundAnexo) {
                if ($text === 'ANEXO IV') {
                    $foundAnexo = true;
                }
                continue;
            }
            // ya encontramos ANEXO IV, ahora avanzamos hasta el siguiente <table> sibling.
            // Más sencillo: pedir todas las tablas y elegir la primera que aparezca tras
            // la posición del <p ANEXO IV>.
            break;
        }

        if (!$foundAnexo) {
            return null;
        }

        // Devolver la primera <table class="tabla"> cuya cabecera tenga "Para los tres primeros".
        $tables = $crawler->filterXPath('//texto//table');
        foreach ($tables as $tableNode) {
            $tableText = $tableNode->textContent ?? '';
            if (str_contains($tableText, 'Para los tres primeros')
                && str_contains($tableText, 'cuarto curso')) {
                return $tableNode;
            }
        }
        return null;
    }

    /**
     * Devuelve las dos celdas <td> de una fila si hay justo dos.
     * @return list<string>
     */
    private function extractCells(\DOMNode $rowNode): array
    {
        if (!$rowNode instanceof \DOMElement) {
            return [];
        }
        $cells = [];
        foreach ($rowNode->getElementsByTagName('td') as $td) {
            // Excluir <td> que sean cabecera de sección (colspan=2 con <em>)
            $hasEm = false;
            foreach ($td->childNodes as $child) {
                if ($child instanceof \DOMElement && strtolower($child->nodeName) === 'em') {
                    $hasEm = true;
                    break;
                }
            }
            if ($hasEm) {
                return []; // marca la fila como cabecera, no datos
            }
            $cells[] = $td->textContent ?? '';
        }
        return $cells;
    }

    /**
     * Si la fila es una cabecera de sección (un <td colspan="2"><em>…</em></td>),
     * devuelve el texto. Si no, null.
     */
    private function extractHeaderCell(\DOMNode $rowNode): ?string
    {
        if (!$rowNode instanceof \DOMElement) {
            return null;
        }
        foreach ($rowNode->getElementsByTagName('td') as $td) {
            foreach ($td->childNodes as $child) {
                if ($child instanceof \DOMElement && strtolower($child->nodeName) === 'em') {
                    return trim($child->textContent ?? '');
                }
            }
        }
        return null;
    }

    private function endsWithAsterisk(string $name): bool
    {
        // El * puede ir antes del punto final ("Biología y Geología*.")
        return (bool) preg_match('/\*\.?$/u', trim($name));
    }

    private function cleanName(string $name): string
    {
        $name = trim($name);
        $name = preg_replace('/\s*\*\s*/u', '', $name); // quitar asterisco
        $name = rtrim($name, '. ');
        return trim($name);
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
}
