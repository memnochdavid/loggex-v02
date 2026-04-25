<?php

namespace App\Catalogo\BoeRd;

use Symfony\Component\DomCrawler\Crawler;

/**
 * Parser para FP Básica: el RD 127/2014 (y similares) recogen MUCHOS títulos
 * de FP Básica en un único documento, cada uno como `<p class="anexo_num">ANEXO N</p>`
 * + `<p class="anexo_tit">Título Profesional Básico en …</p>`.
 *
 * El RD original define 14 títulos en un solo XML (3MB). RDs posteriores añaden
 * más títulos como nuevos anexos (RD 356/2014, RD 774/2015, etc.). El nombre
 * del título coincide exactamente con el `nombre` del itinerario en BD, así
 * que localizamos el anexo por matching de `<p class="anexo_tit">`.
 *
 * Una vez localizado el rango de párrafos del anexo, delegamos en
 * `SeccionModulosParser` que extrae `Módulo Profesional:` / `Código:` / `Duración:`.
 *
 * Identificación: extraemos el bloque "1. Identificación del título" del propio
 * anexo (no del cuerpo del RD), porque cada título tiene su propia denominación,
 * familia y duración. El bloque empieza con `<p class="parrafo_2">– Denominación:`
 * (con guion ASCII o Unicode `–`).
 */
final class BasicaParser
{
    public function __construct(
        private readonly SeccionModulosParser $seccionParser,
    ) {}

    /**
     * @return array{
     *   modulos: list<array>,
     *   identificacion: ?array{
     *     denominacion: ?string,
     *     nivel: ?string,
     *     duracionTotalHoras: ?int,
     *     familiaProfesional: ?string,
     *   },
     * } modulos en el formato de SeccionModulosParser.
     */
    public function parse(string $xml, string $tituloItinerario): array
    {
        $crawler = new Crawler();
        $crawler->addXmlContent($xml);

        $paragraphs = $crawler->filterXPath('//texto//p');
        if ($paragraphs->count() === 0) {
            return ['modulos' => [], 'identificacion' => null];
        }

        // Localizar el rango del anexo correcto: buscamos el `<p class="anexo_tit">`
        // cuyo texto matchea (case-insensitive, normalizado) `tituloItinerario`.
        // El rango del anexo va desde ese párrafo hasta el siguiente `anexo_num`
        // (o fin del documento).
        $rango = $this->findAnnexRange($paragraphs, $tituloItinerario);

        if ($rango === null) {
            // Fallback: RDs de FP Básica mono-título posteriores al RD 127/2014
            // (p. ej. RD 73/2018 "Acceso y Conservación en Instalaciones Deportivas")
            // NO usan estructura `<p class="anexo_tit">`: el RD entero corresponde
            // a un único título. En ese caso, parseamos todos los párrafos del
            // documento, igual que `EspecializacionParser`.
            $rangeCrawler = $paragraphs;
        } else {
            [$startIdx, $endIdx] = $rango;
            $rangeNodes = [];
            foreach ($paragraphs as $i => $node) {
                if ($i >= $startIdx && $i < $endIdx) {
                    $rangeNodes[] = $node;
                }
            }
            $rangeCrawler = new Crawler($rangeNodes);
        }

        $identificacion = $this->extractIdentificacion($rangeCrawler);
        $materias = $this->seccionParser->parseFromParagraphs($rangeCrawler);

        return [
            'modulos' => $materias,
            'identificacion' => $identificacion,
        ];
    }

    /**
     * Encuentra el rango [start, end) de párrafos del anexo cuyo título
     * matchea `titulo`. Devuelve null si no encuentra match.
     *
     * El matching es tolerante: normaliza espacios, mayúsculas y acentos.
     */
    private function findAnnexRange(Crawler $paragraphs, string $titulo): ?array
    {
        $tituloNorm = $this->normalize($titulo);

        $startIdx = null;
        $endIdx = $paragraphs->count();

        foreach ($paragraphs as $i => $p) {
            if (!$p instanceof \DOMElement) {
                continue;
            }
            $class = $p->getAttribute('class') ?? '';
            $text = trim($p->textContent ?? '');

            if (str_contains($class, 'anexo_tit')) {
                $textNorm = $this->normalize($text);
                if ($startIdx === null && $this->matchesAnnexTitle($textNorm, $tituloNorm)) {
                    $startIdx = $i;
                    continue;
                }
            }
            // Si ya hemos abierto el anexo, el siguiente `anexo_num` cierra el rango.
            if ($startIdx !== null && $i > $startIdx && str_contains($class, 'anexo_num')) {
                $endIdx = $i;
                break;
            }
        }

        return $startIdx !== null ? [$startIdx, $endIdx] : null;
    }

    /**
     * Match permisivo. El `<p class="anexo_tit">` puede traer:
     *   "Título Profesional Básico en Informática y Comunicaciones"
     * Y el itinerario en BD tiene como nombre:
     *   "Informática y Comunicaciones"
     *
     * O al revés: el itinerario puede tener el nombre completo. Probamos
     * containment en ambas direcciones y por sufijo de "en …".
     */
    private function matchesAnnexTitle(string $annexNorm, string $itinerarioNorm): bool
    {
        if ($annexNorm === $itinerarioNorm) {
            return true;
        }
        if (str_contains($annexNorm, $itinerarioNorm)) {
            return true;
        }
        // Extraer el "en …" del título del anexo y compararlo.
        if (preg_match('/(?:basico|básico)\s+en\s+(.+)$/u', $annexNorm, $m)) {
            $core = trim($m[1]);
            if ($core === $itinerarioNorm || str_contains($core, $itinerarioNorm) || str_contains($itinerarioNorm, $core)) {
                return true;
            }
        }
        return false;
    }

    private function normalize(string $s): string
    {
        $s = mb_strtolower($s, 'UTF-8');
        $s = preg_replace('/\s+/u', ' ', $s);
        // Quitar acentos básicos.
        $s = strtr($s, ['á'=>'a','é'=>'e','í'=>'i','ó'=>'o','ú'=>'u','ñ'=>'n','ü'=>'u']);
        return trim($s);
    }

    /**
     * Extrae el bloque de identificación del anexo. Las líneas pueden estar:
     *   <p class="parrafo_2">– Denominación: Informática y Comunicaciones.</p>
     *   <p class="parrafo">– Nivel: Formación Profesional Básica.</p>
     *   <p class="parrafo">– Duración: 2.000 horas.</p>
     *   <p class="parrafo">– Familia Profesional: Informática y Comunicaciones.</p>
     *
     * Tolerancia al guion (`–` Unicode o `-` ASCII) y a la ausencia del mismo.
     */
    private function extractIdentificacion(Crawler $rangeCrawler): ?array
    {
        $denominacion = null;
        $nivel = null;
        $duracion = null;
        $familia = null;

        foreach ($rangeCrawler as $p) {
            if (!$p instanceof \DOMElement) {
                continue;
            }
            $text = trim($p->textContent ?? '');
            if ($text === '') {
                continue;
            }

            foreach (preg_split('/\R+/u', $text) as $line) {
                $line = $this->stripLeadingDash(trim($line));

                if ($denominacion === null && stripos($line, 'Denominación:') === 0) {
                    $denominacion = $this->valueOf($line, 'Denominación:');
                } elseif ($nivel === null && stripos($line, 'Nivel:') === 0) {
                    $nivel = $this->valueOf($line, 'Nivel:');
                } elseif ($duracion === null && stripos($line, 'Duración:') === 0) {
                    $duracion = $this->parseHoras($this->valueOf($line, 'Duración:'));
                } elseif ($familia === null && stripos($line, 'Familia Profesional:') === 0) {
                    $familia = $this->valueOf($line, 'Familia Profesional:');
                }
            }

            // Una vez tenemos los 4, podemos parar pronto.
            if ($denominacion && $nivel && $duracion && $familia) {
                break;
            }
        }

        if ($denominacion === null && $nivel === null && $duracion === null && $familia === null) {
            return null;
        }

        return [
            'denominacion' => $denominacion,
            'nivel' => $nivel,
            'duracionTotalHoras' => $duracion,
            'familiaProfesional' => $familia,
        ];
    }

    private function stripLeadingDash(string $s): string
    {
        // Distintos RDs usan distintos caracteres de guion al inicio de cada línea
        // del bloque de identificación: U+2013 EN DASH (–), U+2014 EM DASH (—),
        // U+2012 FIGURE DASH (‒), U+2010/U+2011 HYPHENs y el ASCII clásico.
        return preg_replace('/^[\x{2010}-\x{2015}\-]\s*/u', '', $s);
    }

    private function valueOf(string $line, string $prefix): ?string
    {
        $value = trim(substr($line, strlen($prefix)));
        $value = rtrim($value, '. ');
        return $value !== '' ? $value : null;
    }

    private function parseHoras(?string $text): ?int
    {
        if ($text === null) {
            return null;
        }
        if (preg_match('/(\d[\d.\s]*)\s*horas?/iu', $text, $m)) {
            $clean = (int) preg_replace('/[^\d]/', '', $m[1]);
            return $clean > 0 ? $clean : null;
        }
        return null;
    }
}
