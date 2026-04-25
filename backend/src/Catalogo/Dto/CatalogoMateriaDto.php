<?php

namespace App\Catalogo\Dto;

use App\Entity\Catalogo\TipoMateria;

/**
 * DTO normalizado que produce un adapter de fuente para una materia
 * (módulo de FP, asignatura de ESO/Bach/Uni). Pasa al CatalogoIngestService
 * que lo convierte en una entidad CatalogoMateria persistida.
 */
final readonly class CatalogoMateriaDto
{
    public function __construct(
        public string $codigoOficial,
        public string $nombre,
        public TipoMateria $tipo,
        public ?int $curso = null,
        public ?int $horasTotales = null,
        public ?float $horasSemanales = null,
        public ?int $ects = null,
        public ?string $distribucionAnual = null,
        public bool $obligatoria = true,
        public ?array $prerequisitos = null,
        public ?string $descripcion = null,
        public ?array $competencias = null,
        public int $orden = 0,
    ) {}
}
