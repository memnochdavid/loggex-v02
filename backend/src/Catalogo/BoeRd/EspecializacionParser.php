<?php

namespace App\Catalogo\BoeRd;

use Symfony\Component\DomCrawler\Crawler;

/**
 * Parser para Cursos de Especialización (p. ej. Ciberseguridad BOE-A-2020-4963).
 *
 * Diferencias respecto a un RD de Grado Medio/Superior estándar:
 *  - NO hay tabla resumen de módulos con horas. Las horas viven en la sección
 *    del propio módulo, marcadas con `<strong>Duración: HH horas.</strong>`.
 *  - Cada módulo tiene también `<strong>Créditos ECTS: N.</strong>` (relevante).
 *  - La identificación NO usa guion (`<p>Denominación: …</p>` directamente).
 *  - Solo hay UN título por RD (no necesita anexo-localization).
 *
 * Por eso aquí simplemente delegamos al `SeccionModulosParser` sobre el
 * documento entero, y extraemos identificación con un parser específico
 * sin guion.
 */
final class EspecializacionParser
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
     *     creditosEctsTotales: ?int,
     *   },
     * }
     */
    public function parse(string $xml): array
    {
        $crawler = new Crawler();
        $crawler->addXmlContent($xml);

        $materias = $this->seccionParser->parseAllParagraphs($xml);
        $identificacion = $this->extractIdentificacion($crawler);

        return [
            'modulos' => $materias,
            'identificacion' => $identificacion,
        ];
    }

    /**
     * Busca en los párrafos del documento las líneas:
     *   Denominación: …
     *   Nivel: …
     *   Duración: … horas.
     *   Familia Profesional: …
     *   Créditos ECTS: … (suele aparecer separado, no en el mismo bloque)
     *
     * Limita la búsqueda al primer tercio para no confundir con duraciones de módulos.
     */
    private function extractIdentificacion(Crawler $crawler): ?array
    {
        $paragraphs = $crawler->filterXPath('//texto//p');
        $total = $paragraphs->count();
        if ($total === 0) {
            return null;
        }
        $cap = max(20, (int) ceil($total / 3));

        $denominacion = null;
        $nivel = null;
        $duracion = null;
        $familia = null;
        $ectsTotal = null;

        foreach ($paragraphs as $i => $p) {
            if ($i >= $cap) {
                break;
            }
            $text = trim($p->textContent ?? '');
            if ($text === '') {
                continue;
            }

            foreach (preg_split('/\R+/u', $text) as $line) {
                $line = trim($line);
                $line = preg_replace('/^[\x{2010}-\x{2015}\-]\s*/u', '', $line); // tolerar guion por si aparece

                if ($denominacion === null && stripos($line, 'Denominación:') === 0) {
                    $denominacion = $this->valueOf($line, 'Denominación:');
                } elseif ($nivel === null && stripos($line, 'Nivel:') === 0) {
                    $nivel = $this->valueOf($line, 'Nivel:');
                } elseif ($duracion === null && stripos($line, 'Duración:') === 0) {
                    $duracion = $this->parseHoras($this->valueOf($line, 'Duración:'));
                } elseif ($familia === null && stripos($line, 'Familia Profesional:') === 0) {
                    $familia = $this->valueOf($line, 'Familia Profesional:');
                } elseif ($ectsTotal === null && stripos($line, 'Créditos ECTS:') === 0) {
                    $val = $this->valueOf($line, 'Créditos ECTS:');
                    if ($val !== null && preg_match('/(\d+)/', $val, $m)) {
                        $ectsTotal = (int) $m[1];
                    }
                }
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
            'creditosEctsTotales' => $ectsTotal,
        ];
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
