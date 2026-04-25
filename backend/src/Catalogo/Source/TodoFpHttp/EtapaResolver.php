<?php

namespace App\Catalogo\Source\TodoFpHttp;

use App\Entity\Catalogo\EtapaEducativa;

/**
 * Mapea el icono de nivel que aparece en la tabla de TodoFP (gb.png/gm.png/
 * gs.png/ce.png) a la enum EtapaEducativa de Loggex.
 *
 * Si el icono no se reconoce, devuelve NULL — el adapter loguea WARN y omite
 * la fila. Estas estrategias permiten que un cambio puntual del nombre de un
 * icono no rompa todo el scraping, solo afecte a las filas concretas.
 */
final class EtapaResolver
{
    public static function fromIconSrc(?string $iconSrc): ?EtapaEducativa
    {
        if ($iconSrc === null || $iconSrc === '') {
            return null;
        }

        return match (true) {
            str_contains($iconSrc, '/gb.png') => EtapaEducativa::FP_BASICA,
            str_contains($iconSrc, '/gm.png') => EtapaEducativa::FP_MEDIO,
            str_contains($iconSrc, '/gs.png') => EtapaEducativa::FP_SUPERIOR,
            str_contains($iconSrc, '/ce.png') => EtapaEducativa::FP_ESPECIALIZACION,
            default => null,
        };
    }
}
