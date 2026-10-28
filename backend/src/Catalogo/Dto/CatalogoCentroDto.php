<?php

namespace App\Catalogo\Dto;

use App\Entity\Catalogo\Titularidad;

final readonly class CatalogoCentroDto
{
    public function __construct(
        public string $codigoCentro,
        public string $nombre,
        public string $ccaa,
        public ?string $provincia = null,
        public ?string $municipio = null,
        public ?string $direccion = null,
        public ?Titularidad $titularidad = null,
        public ?array $etapasOfrecidas = null,
        public string $fuenteHash = '',
    ) {}
}
