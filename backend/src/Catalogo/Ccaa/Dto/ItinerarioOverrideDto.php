<?php

namespace App\Catalogo\Ccaa\Dto;

use App\Entity\Ccaa;

/**
 * Override de nombre/código del itinerario por CCAA. Se persiste como
 * `CatalogoItinerarioCcaa`.
 */
final class ItinerarioOverrideDto
{
    public function __construct(
        public readonly Ccaa $ccaa,
        public readonly string $itinerarioCodigoOficial,
        public readonly ?string $nombre,
        public readonly ?string $codigo,
        public readonly string $boletinOficialRef,
        public readonly \DateTimeImmutable $vigenteDesde,
        public readonly ?\DateTimeImmutable $vigenteHasta = null,
    ) {
    }
}
