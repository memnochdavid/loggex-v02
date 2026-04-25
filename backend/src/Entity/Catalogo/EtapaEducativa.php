<?php

namespace App\Entity\Catalogo;

/**
 * Etapas educativas reconocidas en el catálogo oficial de Loggex.
 *
 * Los valores son los identificadores que viajan por la API y se persisten en
 * BD. Los nombres legibles para humanos se obtienen vía label().
 */
enum EtapaEducativa: string
{
    case PRIMARIA              = 'primaria';
    case ESO                   = 'eso';
    case BACHILLERATO          = 'bachillerato';
    case FP_BASICA             = 'fp_basica';
    case FP_MEDIO              = 'fp_medio';
    case FP_SUPERIOR           = 'fp_superior';
    case FP_ESPECIALIZACION    = 'fp_especializacion';
    case GRADO_UNIVERSITARIO   = 'grado_universitario';
    case MASTER_UNIVERSITARIO  = 'master_universitario';

    public function label(): string
    {
        return match ($this) {
            self::PRIMARIA              => 'Educación Primaria',
            self::ESO                   => 'Educación Secundaria Obligatoria',
            self::BACHILLERATO          => 'Bachillerato',
            self::FP_BASICA             => 'FP Básica',
            self::FP_MEDIO              => 'FP Grado Medio',
            self::FP_SUPERIOR           => 'FP Grado Superior',
            self::FP_ESPECIALIZACION    => 'FP Curso de Especialización',
            self::GRADO_UNIVERSITARIO   => 'Grado Universitario',
            self::MASTER_UNIVERSITARIO  => 'Máster Universitario',
        };
    }

    /**
     * Indica si la etapa mide la carga curricular en ECTS (universitario)
     * o en horas (resto). Se usa en la validación de ingesta.
     */
    public function usaEcts(): bool
    {
        return match ($this) {
            self::GRADO_UNIVERSITARIO,
            self::MASTER_UNIVERSITARIO => true,
            default                    => false,
        };
    }
}
