<?php

namespace App\Entity;

/**
 * Turno de la jornada lectiva.
 *
 * Se conserva como dato explícito (no derivado del rango horario): permite
 * informar al profesor si su carga semanal abarca solo mañana, solo tarde
 * o ambas. La detección de solapes entre grupos paralelos NO usa este campo
 * — usa el solape real de rangos horarios entre tramos de las jornadas.
 */
enum TurnoJornada: string
{
    case MANANA = 'manana';
    case TARDE  = 'tarde';

    public function label(): string
    {
        return match ($this) {
            self::MANANA => 'Mañana',
            self::TARDE  => 'Tarde',
        };
    }
}
