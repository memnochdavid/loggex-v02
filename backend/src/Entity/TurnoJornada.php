<?php

namespace App\Entity;

/**
 * Turno de la jornada lectiva.
 *
 * Se conserva como dato explícito (no derivado del rango horario): permite
 * informar al profesor si su carga semanal abarca solo mañana, solo tarde
 * o ambas. La detección de solapes entre grupos paralelos NO usa este campo
 * — usa el solape real de rangos horarios entre tramos de las jornadas.
 *
 * ESPECIAL: pensado para asignar a PLs concretos (típicamente 3ª eval de 2º
 * FP, ventana FCT). No tiene impacto en lógica del solver ni en el contador
 * de carga del profe — esos ya filtran por `modalidad === 'presencial'`
 * (HorariosEditor.jsx:849-854, HorarioSolver*::*Modalidad*). Es un tag
 * informativo de nomenclatura para distinguir jornadas que no encajan en
 * la dicotomía mañana/tarde.
 */
enum TurnoJornada: string
{
    case MANANA   = 'manana';
    case TARDE    = 'tarde';
    case ESPECIAL = 'especial';

    public function label(): string
    {
        return match ($this) {
            self::MANANA   => 'Mañana',
            self::TARDE    => 'Tarde',
            self::ESPECIAL => 'Especial',
        };
    }
}
