<?php

namespace App\Entity;

/**
 * Tipo de un tramo dentro de una jornada lectiva.
 *
 * SLOT  → tramo asignable: el editor de horarios coloca aquí imparticiones.
 * RECREO → tramo no asignable: se pinta en la rejilla pero no acepta drops.
 */
enum TipoTramo: string
{
    case SLOT   = 'slot';
    case RECREO = 'recreo';

    public function label(): string
    {
        return match ($this) {
            self::SLOT   => 'Slot lectivo',
            self::RECREO => 'Recreo',
        };
    }
}
