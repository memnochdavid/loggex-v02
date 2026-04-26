<?php

namespace App\Catalogo\BoeRd;

use App\Entity\Catalogo\TipoMateria;

/**
 * Fallback para RDs cuyo Anexo I describe los módulos como párrafos secuenciales
 * (no como una tabla con horas/h-semana). Patrón típico (FP LOMLOE 2019-2023):
 *
 *   <p>Módulo Profesional: Fundamentos de electricidad.</p>
 *   <p>Equivalencia en créditos ECTS: 6</p>
 *   <p>Código: 1425.</p>
 *   <p>Resultados de aprendizaje…</p>
 *   …
 *   <p>Duración: 135 horas.</p>           ← cierra el bloque del módulo
 *
 * Cobertura: familia aeromecánica (RD 1798-1801/2018), Técnico en Seguridad
 * (RD 570/2023), Formación para la Movilidad (RD 178/2021), etc.
 *
 * Limitación conocida: estos RDs nunca traen `h/semana` ni `curso` (eso lo
 * desarrolla cada CCAA), así que `horasSemanales` y `curso` quedan en `null`.
 */
final class ParrafosModulosParser
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
        if (!preg_match_all('#<p[^>]*>(.*?)</p>#s', $xml, $matches)) {
            return [];
        }
        $paragraphs = array_map(
            fn(string $raw) => trim(preg_replace('/\s+/u', ' ', strip_tags($raw))),
            $matches[1]
        );

        $modulos = [];
        $orden = 0;
        $pendingNombre = null;
        $pendingEcts = null;
        $current = null;  // Última entrada añadida; donde aplicar "Duración" cuando llegue.

        foreach ($paragraphs as $p) {
            // Nombre del módulo. Soporta "Módulo Profesional:", "Módulo profesional:",
            // "Módulo Profesional 1:", etc.
            if (preg_match('/^Módulo profesional(?:\s+\d+)?\s*:\s*(.+?)\.?\s*$/iu', $p, $m)) {
                $pendingNombre = $this->cleanNombre($m[1]);
                $pendingEcts = null;
                continue;
            }

            if (preg_match('/^Equivalencia en créditos ECTS\s*:\s*(\d+)/iu', $p, $m)) {
                $pendingEcts = (int) $m[1];
                continue;
            }

            // Código: cierra el "alta" del módulo (nombre + ects ya conocidos, código define identidad).
            if (preg_match('/^Código\s*:\s*(\d{3,4}[a-zA-Z_]?)\.?\s*$/u', $p, $m)) {
                if ($pendingNombre === null || $pendingNombre === '') {
                    // Código suelto sin nombre previo; lo descartamos para no contaminar.
                    continue;
                }
                $current = [
                    'codigoOficial' => $m[1],
                    'nombre' => $pendingNombre,
                    'tipo' => $this->detectTipo($pendingNombre),
                    'curso' => null,
                    'horasTotales' => null,
                    'horasSemanales' => null,
                    'ects' => $pendingEcts,
                    'orden' => ++$orden,
                ];
                $modulos[] = &$current;
                unset($current);
                $current = &$modulos[count($modulos) - 1];
                $pendingNombre = null;
                $pendingEcts = null;
                continue;
            }

            // Duración: la primera "Duración: N horas" tras un Código pertenece al módulo recién abierto.
            // Saltamos si aún no hay módulo (puede ser la duración total del ciclo, descrita en cabecera).
            if ($current !== null
                && $current['horasTotales'] === null
                && preg_match('/^Duración\s*:\s*(\d+)\s*horas/iu', $p, $m)) {
                $current['horasTotales'] = (int) $m[1];
                continue;
            }
        }

        unset($current);

        // Limpiar referencia y serializar (sin claves ects internas que no pinta el upstream).
        return array_map(static function (array $mod): array {
            return [
                'codigoOficial' => $mod['codigoOficial'],
                'nombre' => $mod['nombre'],
                'tipo' => $mod['tipo'],
                'curso' => $mod['curso'],
                'horasTotales' => $mod['horasTotales'],
                'horasSemanales' => $mod['horasSemanales'],
                'ects' => $mod['ects'],
                'orden' => $mod['orden'],
            ];
        }, $modulos);
    }

    private function cleanNombre(string $text): string
    {
        $text = preg_replace('/\s+/u', ' ', $text);
        return trim($text, ". \t\n");
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
}
