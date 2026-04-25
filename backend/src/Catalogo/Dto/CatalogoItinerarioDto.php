<?php

namespace App\Catalogo\Dto;

use App\Entity\Catalogo\EtapaEducativa;

/**
 * DTO normalizado que produce un adapter de fuente para un itinerario formativo
 * (un ciclo de FP, una modalidad de Bachillerato, un grado universitario, …).
 *
 * Lleva también el array de materias (módulos / asignaturas) hijo. El
 * `fuenteHash` debe calcularse sobre el payload bruto de la fuente para que
 * el ingest service detecte cambios entre ejecuciones (sha256 hex).
 */
final readonly class CatalogoItinerarioDto
{
    public function __construct(
        public string $codigoOficial,
        public EtapaEducativa $etapa,
        public string $nombre,
        public ?string $familia,
        public ?string $nivel,
        public ?int $duracionTotalHoras,
        public ?int $duracionTotalEcts,
        public ?string $ccaa,
        public ?string $normativa,
        public ?string $boletinUrl,
        public ?\DateTimeImmutable $vigenteDesde,
        public ?\DateTimeImmutable $vigenteHasta,
        /** @var CatalogoMateriaDto[] */
        public array $materias,
        public string $fuenteHash,
    ) {}
}
