<?php

namespace App\Catalogo\Source\TodoFpHttp;

use Symfony\Component\DomCrawler\Crawler;

/**
 * Parser del index de familias profesionales en TodoFP.
 *
 * Página origen: https://www.todofp.es/que-estudiar/familias-profesionales.html
 *
 * Devuelve una lista de [name, url] que TodoFpHttpAdapter usa después para
 * iterar las páginas de detalle de cada familia.
 */
final class FamiliasParser
{
    private const HREF_PATTERN = '#^/que-estudiar/familias-profesionales/[^/]+\.html$#';

    /**
     * @return list<array{name: string, url: string}>
     */
    public function parse(string $html, string $baseUrl): array
    {
        $crawler = new Crawler($html);
        $familias = [];
        $seen = [];

        $links = $crawler->filter('a[href^="/que-estudiar/familias-profesionales/"]');
        foreach ($links as $node) {
            $href = $node->getAttribute('href') ?: '';
            if (!preg_match(self::HREF_PATTERN, $href)) {
                continue;
            }
            if (isset($seen[$href])) {
                continue;
            }
            $seen[$href] = true;

            $name = $this->extractName($node);
            if ($name === null || $name === '') {
                continue;
            }

            $familias[] = [
                'name' => $name,
                'url' => rtrim($baseUrl, '/') . $href,
            ];
        }

        return $familias;
    }

    private function extractName(\DOMElement $a): ?string
    {
        // Estrategia 1: alt del <img> hijo (es como TodoFP etiqueta normalmente).
        foreach ($a->getElementsByTagName('img') as $img) {
            $alt = trim((string) $img->getAttribute('alt'));
            if ($alt !== '') {
                // Limpiar prefijos comunes tipo "Icono familia profesional ..."
                $alt = preg_replace('/^Icono\s+familia\s+profesional\s+/i', '', $alt);
                return trim($alt);
            }
        }

        // Estrategia 2: texto plano del <a>.
        $text = trim($a->textContent);
        return $text !== '' ? $text : null;
    }
}
