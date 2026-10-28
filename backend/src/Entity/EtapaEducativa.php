<?php

namespace App\Entity;

/**
 * Etapas educativas LOE/LOMLOE usadas para el calendario escolar autonómico.
 *
 * Cada CCAA publica anualmente una Resolución que fija fechas de inicio/fin
 * del régimen ordinario de clases por etapa. Loggex modela ese dato en
 * `CalendarioEscolarCcaa(ccaa, anioAcademico, etapa, fechaInicio, fechaFin)`,
 * sirviendo como sugerencia al rellenar `Centro.fechaInicioCurso/FinCurso`
 * y como base de cálculo de semanas lectivas reales.
 *
 * Cobertura actual del piloto Andalucía 2025-26 (Resolución BOJA Sevilla
 * firmada 29-may-2025 por el Delegado Territorial Miguel Ángel Arauz Rivero):
 *
 *   - INFANTIL_2 / PRIMARIA / ESPECIAL: 10-sep-2025 → 22-jun-2026 (178 días, 890h)
 *   - ESO / BACH_1 / FP / EPA:          15-sep-2025 → 22-jun-2026 (175 días, 1050h)
 *   - BACH_2:                           15-sep-2025 → 22-may-2026
 *   - IDIOMAS:                          22-sep-2025 → 22-jun-2026
 *   - IDIOMAS_CERTIFICACION:            22-sep-2025 → 29-may-2026
 *   - ARTISTICAS:                       15-sep-2025 → 22-jun-2026 (175 días)
 *   - ARTISTICAS_SUPERIORES:            22-sep-2025 → 22-jun-2026
 */
enum EtapaEducativa: string
{
    case INFANTIL_2            = 'infantil_2';
    case PRIMARIA              = 'primaria';
    case ESPECIAL              = 'especial';
    case ESO                   = 'eso';
    case BACH_1                = 'bach_1';
    case BACH_2                = 'bach_2';
    case FP                    = 'fp';
    case EPA                   = 'epa';
    case IDIOMAS               = 'idiomas';
    case IDIOMAS_CERTIFICACION = 'idiomas_certificacion';
    case ARTISTICAS            = 'artisticas';
    case ARTISTICAS_SUPERIORES = 'artisticas_superiores';

    public function label(): string
    {
        return match ($this) {
            self::INFANTIL_2            => 'Educación Infantil (2º ciclo)',
            self::PRIMARIA              => 'Educación Primaria',
            self::ESPECIAL              => 'Educación Especial',
            self::ESO                   => 'Educación Secundaria Obligatoria',
            self::BACH_1                => 'Bachillerato (1º curso)',
            self::BACH_2                => 'Bachillerato (2º curso)',
            self::FP                    => 'Formación Profesional Inicial',
            self::EPA                   => 'Educación Permanente para Personas Adultas',
            self::IDIOMAS               => 'Enseñanzas de Idiomas (Régimen Especial)',
            self::IDIOMAS_CERTIFICACION => 'Idiomas — cursos de certificación',
            self::ARTISTICAS            => 'Enseñanzas Artísticas',
            self::ARTISTICAS_SUPERIORES => 'Enseñanzas Artísticas Superiores',
        };
    }
}
