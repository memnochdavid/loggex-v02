<?php

namespace App\Catalogo\Source\TodoFpHttp;

use Symfony\Component\DomCrawler\Crawler;

/**
 * Parser de la tabla de ciclos en una página de familia profesional de TodoFP.
 *
 * Estrategia de selección resiliente al reordenamiento de columnas:
 *   1. Lee la cabecera de la tabla (`<th>`) y construye un mapa
 *      texto-cabecera-normalizado → índice de columna.
 *   2. Por cada fila de datos, accede a las columnas por su nombre lógico
 *      ("titulación", "real decreto", "currículo ministerio") en lugar de
 *      por posición ordinal.
 *
 * Esto da resiliencia: si TodoFP añade una columna o reordena, el parser
 * sigue funcionando mientras los nombres de cabecera no cambien.
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

        // Si hubiera varias tablas, escogemos la primera con cabecera reconocible.
        foreach ($tables as $table) {
            $tableCrawler = new Crawler($table);
            $columns = $this->mapHeader($tableCrawler);
            if (!$this->hasRequiredColumns($columns)) {
                continue;
            }
            return $this->parseRows($tableCrawler, $columns, $baseUrl);
        }

        return [];
    }

    /**
     * @return array<string, int>  texto-cabecera-normalizado → índice de columna
     */
    private function mapHeader(Crawler $tableCrawler): array
    {
        $headerCells = $tableCrawler->filter('thead th, tr:first-child th, tr:first-child td');
        $columns = [];
        foreach ($headerCells as $i => $cell) {
            $text = $this->normalize($cell->textContent);
            if ($text !== '') {
                $columns[$text] = $i;
            }
        }
        return $columns;
    }

    private function hasRequiredColumns(array $columns): bool
    {
        // Tras normalizar, las claves no llevan acentos ("titulación"→"titulacion").
        return isset($columns['nivel'])
            && isset($columns['titulacion'])
            && (isset($columns['real decreto']) || isset($columns['rd']));
    }

    /**
     * @return list<array{...}>
     */
    private function parseRows(Crawler $tableCrawler, array $columns, string $baseUrl): array
    {
        $idxNivel = $columns['nivel'];
        $idxTitulacion = $columns['titulacion'];
        $idxRd = $columns['real decreto'] ?? $columns['rd'];
        $idxCurriculo = $columns['curriculo ministerio']
            ?? $columns['curriculo']
            ?? null;

        $rows = $tableCrawler->filter('tbody tr');
        if ($rows->count() === 0) {
            // Tabla sin <tbody>: cogemos todas las <tr> excepto la cabecera.
            $rows = $tableCrawler->filter('tr')->reduce(fn (Crawler $r, int $i) => $i > 0);
        }

        $result = [];
        foreach ($rows as $row) {
            $cells = $row->getElementsByTagName('td');
            if ($cells->length === 0) {
                continue;
            }

            $nivelIconSrc = $this->extractFirstImgSrc($cells->item($idxNivel));
            $titulacionCell = $cells->item($idxTitulacion);
            $rdCell = $cells->item($idxRd);
            $curriculoCell = $idxCurriculo !== null ? $cells->item($idxCurriculo) : null;

            if ($titulacionCell === null || $rdCell === null) {
                continue;
            }

            $nombre = trim($this->extractFirstAnchor($titulacionCell)['text'] ?? '');
            if ($nombre === '') {
                continue;
            }

            $result[] = [
                'nombre' => $nombre,
                'nivelIconSrc' => $nivelIconSrc,
                'detalleUrl' => $this->absolutizeUrl($this->extractFirstAnchor($titulacionCell)['href'] ?? null, $baseUrl),
                'boletinRdUrl' => $this->absolutizeUrl($this->extractFirstBoeUrl($rdCell), $baseUrl),
                'curriculoUrl' => $curriculoCell ? $this->absolutizeUrl($this->extractFirstBoeUrl($curriculoCell), $baseUrl) : null,
            ];
        }

        return $result;
    }

    private function extractFirstImgSrc(?\DOMElement $cell): ?string
    {
        if ($cell === null) {
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
    private function extractFirstAnchor(?\DOMElement $cell): array
    {
        if ($cell === null) {
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
     * Devuelve la primera URL de la celda que apunte al BOE
     * (cualquier formato: txt.php?id=BOE-A-… o /eli/es/rd/…).
     */
    private function extractFirstBoeUrl(?\DOMElement $cell): ?string
    {
        if ($cell === null) {
            return null;
        }
        foreach ($cell->getElementsByTagName('a') as $a) {
            $href = $a->getAttribute('href') ?: '';
            if ($href !== '' && (str_contains($href, 'boe.es'))) {
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

    /**
     * Normaliza texto para usarlo como clave del mapa de cabecera:
     *  - lowercase
     *  - colapsa espacios
     *  - quita tildes (para que "currículo" y "curriculo" funcionen igual)
     */
    private function normalize(string $text): string
    {
        $text = trim($text);
        $text = preg_replace('/\s+/u', ' ', $text);
        $text = mb_strtolower($text, 'UTF-8');
        // Quitar acentos comunes para tolerar "currículo"/"curriculo".
        $text = strtr($text, [
            'á' => 'a', 'é' => 'e', 'í' => 'i', 'ó' => 'o', 'ú' => 'u',
            'ñ' => 'n',
        ]);
        return $text;
    }
}
