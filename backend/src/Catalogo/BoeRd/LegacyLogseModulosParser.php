<?php

namespace App\Catalogo\BoeRd;

use App\Entity\Catalogo\TipoMateria;

/**
 * Fallback terciario para RDs LOGSE (1995-2005). Estos no usan códigos oficiales
 * de 4 dígitos (introducidos por la LOE en 2006) y describen los módulos como:
 *
 *   <p>Módulo profesional 1: operaciones administrativas y documentación sanitaria</p>
 *   <p>…bloques de contenido del módulo…</p>
 *   <p>CONTENIDOS (duración 65 horas).</p>
 *
 * El módulo de FCT suele venir como:
 *   <p>Módulo profesional de formación en centro de trabajo</p>
 *   <p>CONTENIDOS (duración 440 horas).</p>
 *
 * Como no hay código oficial, se genera uno sintético `MP{N}` o `FCT`,
 * único dentro del itinerario.
 */
final class LegacyLogseModulosParser
{
    private const HEADING_REGEX = '/^Módulo(?:\s+profesional)?\s*(?:(\d+)\s*[:.]\s*|\s+de\s+formación\s+en\s+centros?\s+de\s+trabajo\s*[:.]?\s*|[:.]\s*)(.*)$/iu';
    private const CLOSING_REGEX = '/(?:CONTENIDOS|Contenidos)\s*\(\s*[Dd]uración\s+(\d+)\s*horas?\s*\)/iu';

    /**
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
    public function parse(string $xml): array
    {
        if (!preg_match_all('#<p[^>]*>(.*?)</p>#s', $xml, $matches)) {
            return [];
        }
        $paragraphs = array_map(
            fn(string $raw) => trim(preg_replace('/\s+/u', ' ', strip_tags($raw))),
            $matches[1]
        );

        $modulos = [];
        $orden = 0;
        $pendingNumero = null;
        $pendingNombre = null;
        $pendingIsFct = false;

        foreach ($paragraphs as $p) {
            // (1) Cierre del módulo pendiente: CONTENIDOS (duración N horas).
            if ($pendingNombre !== null && preg_match(self::CLOSING_REGEX, $p, $m) && !preg_match(self::HEADING_REGEX, $p)) {
                $modulos[] = $this->buildEntry($orden + 1, $pendingNumero, $pendingNombre, $pendingIsFct, (int) $m[1]);
                $orden++;
                $pendingNumero = $pendingNombre = null;
                $pendingIsFct = false;
                continue;
            }

            // (2) Heading nuevo de módulo. Si había pendiente sin cerrar, lo descartamos.
            if (preg_match(self::HEADING_REGEX, $p, $m)) {
                $pendingNumero = ($m[1] ?? '') !== '' ? $m[1] : null;
                $pendingNombre = trim($m[2] ?? '');
                $pendingIsFct = (bool) preg_match('/formación\s+en\s+centros?\s+de\s+trabajo/iu', $p);

                // ¿La misma línea ya contiene el cierre? (caso de un único <p> con todo).
                if (preg_match(self::CLOSING_REGEX, $p, $cm)) {
                    $tituloLimpio = $this->stripClosing($pendingNombre);
                    if ($tituloLimpio !== '') {
                        $modulos[] = $this->buildEntry($orden + 1, $pendingNumero, $tituloLimpio, $pendingIsFct, (int) $cm[1]);
                        $orden++;
                    }
                    $pendingNumero = $pendingNombre = null;
                    $pendingIsFct = false;
                }
                continue;
            }

            // (3) Continuación corta del título, si seguimos esperando cierre.
            if ($pendingNombre !== null && mb_strlen($p) <= 80 && !str_ends_with($pendingNombre, '.')) {
                if (!preg_match('/^[A-ZÁÉÍÓÚÑ¿\d]/u', $p) || mb_strlen($pendingNombre) < 60) {
                    $pendingNombre .= ' ' . $p;
                }
            }
        }

        return $modulos;
    }

    /**
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
    private function buildEntry(int $orden, ?string $numero, string $nombre, bool $isFct, int $horas): array
    {
        $codigo = $isFct
            ? 'FCT'
            : ($numero !== null ? 'MP' . $numero : 'MP-' . $orden);
        return [
            'codigoOficial' => $codigo,
            'nombre' => $this->cleanNombre($nombre),
            'tipo' => $isFct ? TipoMateria::FCT : TipoMateria::MODULO,
            'curso' => null,
            'horasTotales' => $horas,
            'horasSemanales' => null,
            'ects' => null,
            'orden' => $orden,
        ];
    }

    private function stripClosing(string $text): string
    {
        // Si el título arrastra "...NAME CONTENIDOS (duración N horas)", recortamos antes de CONTENIDOS.
        $lower = mb_strtolower($text, 'UTF-8');
        $pos = mb_strpos($lower, 'contenidos');
        if ($pos === false) {
            return trim($text);
        }
        return $this->cleanNombre(mb_substr($text, 0, $pos));
    }

    private function cleanNombre(string $text): string
    {
        $text = preg_replace('/\s+/u', ' ', $text);
        return trim($text, ". \t\n");
    }
}
