<?php

namespace App\Entity\Catalogo;

enum Titularidad: string
{
    case PUBLICO    = 'publico';
    case CONCERTADO = 'concertado';
    case PRIVADO    = 'privado';
}
