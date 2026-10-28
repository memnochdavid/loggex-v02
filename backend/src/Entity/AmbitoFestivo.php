<?php

namespace App\Entity;

/**
 * Ámbito territorial de un Festivo. Determina qué centros lo aplican:
 *
 *   - NACIONAL    → todos los centros de España.
 *   - AUTONOMICO  → centros cuya CCAA coincide con `Festivo.ccaa`.
 *   - PROVINCIAL  → centros cuya provincia coincide con `Festivo.provincia`.
 *   - LOCAL       → solo el centro indicado en `Festivo.centro`.
 */
enum AmbitoFestivo: string
{
    case NACIONAL    = 'nacional';
    case AUTONOMICO  = 'autonomico';
    case PROVINCIAL  = 'provincial';
    case LOCAL       = 'local';
}
