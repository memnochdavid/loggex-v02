<?php

namespace App\Catalogo\BoeRd;

use Symfony\Component\DomCrawler\Crawler;

/**
 * Extrae los datos de identificación del XML del BOE de un Real Decreto:
 *  - Denominación (nombre del título).
 *  - Nivel ("Formación Profesional de Grado Superior", etc.).
 *  - Duración total en horas.
 *  - Familia profesional.
 *  - Fecha de disposición.
 *  - Número oficial (p. ej. "686/2010").
 *
 * Heurística: dentro de `<texto>`, los párrafos relevantes empiezan por
 * `Denominación:`, `Nivel:`, `Duración:`, `Familia Profesional:`. Buscamos
 * por prefijo de texto, NO por clase CSS (las clases son inconsistentes
 * entre RDs de distintas épocas).
 */
final class IdentificacionParser
{
    /**
     * @return array{
     *   denominacion: ?string,
     *   nivel: ?string,
     *   duracionTotalHoras: ?int,
     *   familiaProfesional: ?string,
     *   fechaDisposicion: ?\DateTimeImmutable,
     *   numeroOficial: ?string,
     *   normativa: ?string,
     * }
     */
    public function parse(string $xml): array
    {
        $crawler = new Crawler();
        $crawler->addXmlContent($xml);

        // Metadatos del documento (fuera de <texto>).
        $fechaDisposicion = $this->parseFechaDisposicion(
            $this->firstText($crawler, '//metadatos/fecha_disposicion')
        );
        $numeroOficial = $this->firstText($crawler, '//metadatos/numero_oficial');
        $titulo = $this->firstText($crawler, '//metadatos/titulo');

        // Buscar párrafos en <texto> que empiecen por los prefijos clave.
        $denominacion = $this->findByPrefix($crawler, 'Denominación:');
        $nivel        = $this->findByPrefix($crawler, 'Nivel:');
        $duracionStr  = $this->findByPrefix($crawler, 'Duración:');
        $familia      = $this->findByPrefix($crawler, 'Familia Profesional:');

        return [
            'denominacion' => $denominacion,
            'nivel' => $nivel,
            'duracionTotalHoras' => $this->parseDuracion($duracionStr),
            'familiaProfesional' => $familia,
            'fechaDisposicion' => $fechaDisposicion,
            'numeroOficial' => $numeroOficial,
            'normativa' => $titulo,
        ];
    }

    private function firstText(Crawler $crawler, string $xpath): ?string
    {
        $node = $crawler->filterXPath($xpath)->first();
        return $node->count() > 0 ? trim($node->text()) : null;
    }

    /**
     * Busca la PRIMERA línea (en todo el texto) que empiece por el prefijo dado.
     *
     * Algunos RDs ponen los datos de identificación en `<p>` separados
     * ("Denominación: …" en su propio `<p>`, "Duración: …" en otro). Otros los
     * concatenan en un único `<p>` separados por `\n`. Esta función contempla
     * ambos casos: agrega TODO el texto del `<p>` que esté en el primer tercio
     * del documento (donde aparece la identificación), parte por líneas, y se
     * queda con la primera línea que empiece por el prefijo.
     *
     * Limitar al primer tercio evita confundir "Duración: 2000 horas" del título
     * con "Duración: 130 horas" de un módulo concreto del Anexo I.
     */
    private function findByPrefix(Crawler $crawler, string $prefix): ?string
    {
        $paragraphs = $crawler->filterXPath('//texto//p');
        $total = $paragraphs->count();
        if ($total === 0) {
            return null;
        }

        // Limitamos la búsqueda a los párrafos del primer tercio del documento.
        // Las identificaciones siempre están al principio (artículo 2 del RD).
        $cap = max(20, (int) ceil($total / 3));

        foreach ($paragraphs as $i => $p) {
            if ($i >= $cap) {
                break;
            }
            $text = $p->textContent ?? '';
            if ($text === '') {
                continue;
            }
            // Partir por saltos de línea: cubre tanto "1 prefijo por <p>"
            // como "varios prefijos en el mismo <p> separados por \n".
            foreach (preg_split('/\R+/u', $text) as $line) {
                $line = trim($line);
                if (stripos($line, $prefix) === 0) {
                    $value = trim(substr($line, strlen($prefix)));
                    return rtrim($value, '. ');
                }
            }
        }
        return null;
    }

    private function parseDuracion(?string $text): ?int
    {
        if ($text === null) {
            return null;
        }
        // "2000 horas" / "2.000 horas" / "1300 horas".
        if (preg_match('/(\d[\d.\s]*)\s*horas?/iu', $text, $m)) {
            $clean = (int) preg_replace('/[^\d]/', '', $m[1]);
            return $clean > 0 ? $clean : null;
        }
        return null;
    }

    private function parseFechaDisposicion(?string $yyyymmdd): ?\DateTimeImmutable
    {
        if ($yyyymmdd === null || strlen($yyyymmdd) < 8) {
            return null;
        }
        $clean = preg_replace('/[^\d]/', '', $yyyymmdd);
        if (strlen($clean) !== 8) {
            return null;
        }
        try {
            return \DateTimeImmutable::createFromFormat('!Ymd', $clean) ?: null;
        } catch (\Throwable) {
            return null;
        }
    }
}
