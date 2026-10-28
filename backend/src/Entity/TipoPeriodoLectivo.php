<?php

namespace App\Entity;

/**
 * Discriminator de `PeriodoLectivo` (modelo semanal).
 *
 * - `PLANTILLA`: el horario por defecto del grupo. Una por grupo. Sin fechas.
 *   Contiene los Horarios y PLIs que aplican todas las semanas del curso
 *   salvo override.
 * - `SEMANA`: una semana lectiva concreta con override puntual del default
 *   (intercambio de profe, sustitución, semana cultural, festivo no
 *   anticipado, etc.). Tiene `fechaInicio`, `fechaFin`, `semanaNumero` y
 *   `plantillaBase` apuntando a la PLANTILLA del mismo grupo.
 *
 * Doc: docs/hoja-de-ruta-modelo-semanal.md §11.
 */
enum TipoPeriodoLectivo: string
{
    case PLANTILLA = 'plantilla';
    case SEMANA    = 'semana';

    public function label(): string
    {
        return match ($this) {
            self::PLANTILLA => 'Plantilla del curso',
            self::SEMANA    => 'Semana lectiva',
        };
    }
}
