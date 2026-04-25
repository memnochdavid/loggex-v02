<?php

namespace App\Catalogo\Source\TodoFpHttp;

use Symfony\Component\DomCrawler\Crawler;

/**
 * Parser de la tabla de ciclos en una página de familia profesional de TodoFP.
 *
 * Estrategia de selección:
 *   En lugar de fiarnos de la posición ordinal de las columnas, usamos las
 *   clases CSS que TodoFP aplica de forma consistente a cada celda:
 *     <th class="Nv">             Nivel (con icono PNG y rowspan)
 *     <td class="Tit">            Titulación (nombre + URL detalle)
 *     <td class="Rd">             Real Decreto (URL al BOE)
 *     <td class="Curriculomecd">  Currículo Ministerio
 *     <td class="Curriculoccaa">  Currículos CCAA
 *
 *   Esto da resiliencia ante reordenamiento de columnas o adición de nuevas:
 *   mientras las clases sigan siendo las mismas, el parser funciona.
 *
 * Manejo de rowspan:
 *   La columna "Nivel" usa `<th rowspan="N">`: aparece UNA vez por grupo de N
 *   ciclos del mismo nivel. Las filas posteriores del mismo grupo no tienen
 *   celda de nivel. El parser hereda el nivel de la fila anterior cuando no lo
 *   encuentra explícitamente.
 */
final class CiclosParser
{
    /**
     * @return list<array{
     *   nombre: string,
     *   nivelIconSrc: ?string,
     *   detalleUrl: ?string,
     *   boletinRdUrl: ?string,
     *   curriculoUrl: ?string,
     * }>
     */
    public function parse(string $html, string $baseUrl): array
    {
        $crawler = new Crawler($html);
        $tables = $crawler->filter('table');
        if ($tables->count() === 0) {
            return [];
        }

        // Iteramos tablas; la correcta es la que tiene <th class="Nv"> en su body.
        foreach ($tables as $tableNode) {
            $tableCrawler = new Crawler($tableNode);
            if ($tableCrawler->filter('th.Nv, td.Nv')->count() === 0) {
                continue;
            }
            return $this->parseRows($tableCrawler, $baseUrl);
        }

        return [];
    }

    /**
     * @return list<array{...}>
     */
    private function parseRows(Crawler $tableCrawler, string $baseUrl): array
    {
        // Iteramos solo las <tr> que NO sean cabecera (las que están en <tbody>
        // o todas excepto la primera si no hay <thead>).
        $bodyRows = $tableCrawler->filter('tbody tr');
        if ($bodyRows->count() === 0) {
            $bodyRows = $tableCrawler->filter('tr')->reduce(fn (Crawler $r, int $i) => $i > 0);
        }

        $result = [];
        $currentNivelIcon = null;  // Para heredar entre filas con rowspan.

        foreach ($bodyRows as $row) {
            $rowCrawler = new Crawler($row);

            // Buscar la celda de nivel (puede ser <th> o <td> con class="Nv").
            // Si la fila la trae, actualizar el "nivel actual"; si no, heredar.
            $nivelCell = $rowCrawler->filter('th.Nv, td.Nv');
            if ($nivelCell->count() > 0) {
                $currentNivelIcon = $this->extractFirstImgSrc($nivelCell->first()->getNode(0));
            }

            // Titulación: texto del <a> dentro de <td class="Tit">.
            $tituCell = $rowCrawler->filter('td.Tit');
            if ($tituCell->count() === 0) {
                // Fila sin titulación visible — saltarla (puede ser separadora o vacía).
                continue;
            }
            $anchor = $this->extractFirstAnchor($tituCell->first()->getNode(0));
            $nombre = trim($anchor['text'] ?? '');
            if ($nombre === '') {
                continue;
            }

            // Real Decreto: primer <a> al BOE dentro de <td class="Rd">.
            $rdCell = $rowCrawler->filter('td.Rd');
            $boletinRdUrl = $rdCell->count() > 0
                ? $this->extractFirstBoeUrl($rdCell->first()->getNode(0))
                : null;

            // Currículo Ministerio: primer <a> al BOE en <td class="Curriculomecd">.
            $curriculoCell = $rowCrawler->filter('td.Curriculomecd');
            $curriculoUrl = $curriculoCell->count() > 0
                ? $this->extractFirstBoeUrl($curriculoCell->first()->getNode(0))
                : null;

            $result[] = [
                'nombre' => $nombre,
                'nivelIconSrc' => $currentNivelIcon,
                'detalleUrl' => $this->absolutizeUrl($anchor['href'] ?? null, $baseUrl),
                'boletinRdUrl' => $this->absolutizeUrl($boletinRdUrl, $baseUrl),
                'curriculoUrl' => $this->absolutizeUrl($curriculoUrl, $baseUrl),
            ];
        }

        return $result;
    }

    private function extractFirstImgSrc(?\DOMNode $cell): ?string
    {
        if (!$cell instanceof \DOMElement) {
            return null;
        }
        foreach ($cell->getElementsByTagName('img') as $img) {
            $src = $img->getAttribute('src');
            if ($src) {
                return $src;
            }
        }
        return null;
    }

    /**
     * @return array{href: ?string, text: ?string}|array{}
     */
    private function extractFirstAnchor(?\DOMNode $cell): array
    {
        if (!$cell instanceof \DOMElement) {
            return [];
        }
        foreach ($cell->getElementsByTagName('a') as $a) {
            return [
                'href' => $a->getAttribute('href') ?: null,
                'text' => trim($a->textContent),
            ];
        }
        return [];
    }

    /**
     * Devuelve la primera URL de la celda que apunte al BOE (cualquier formato).
     * En filas con `<ul><li><a>RD</a></li><li><a>Modificación</a></li>` cogemos
     * el primer enlace al BOE encontrado en orden de documento (el RD original).
     */
    private function extractFirstBoeUrl(?\DOMNode $cell): ?string
    {
        if (!$cell instanceof \DOMElement) {
            return null;
        }
        foreach ($cell->getElementsByTagName('a') as $a) {
            $href = $a->getAttribute('href') ?: '';
            if ($href !== '' && str_contains($href, 'boe.es')) {
                return $href;
            }
        }
        return null;
    }

    private function absolutizeUrl(?string $url, string $baseUrl): ?string
    {
        if ($url === null || $url === '') {
            return null;
        }
        if (str_starts_with($url, 'http://') || str_starts_with($url, 'https://')) {
            return $url;
        }
        if (str_starts_with($url, '/')) {
            return rtrim($baseUrl, '/') . $url;
        }
        return rtrim($baseUrl, '/') . '/' . $url;
    }
}
