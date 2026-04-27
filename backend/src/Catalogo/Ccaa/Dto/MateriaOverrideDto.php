<?php

namespace App\Catalogo\Ccaa\Dto;

use App\Entity\Ccaa;
use App\Entity\Catalogo\TipoMateria;

/**
 * DTO con un override (o materia autonómica pura) emitido por un
 * `CcaaCurriculumProviderInterface`.
 *
 * El comando `app:catalogo:ccaa:seed` lo persiste como `CatalogoMateriaCcaa`.
 *
 * Modos:
 *   - `materiaCodigoOficial !== null` ⇒ override de la materia nacional con
 *     ese código BOE. Los campos NULL caen al valor nacional.
 *   - `materiaCodigoOficial === null` ⇒ materia autonómica pura (Inglés
 *     profesional, IPE II...). Todos los campos `nombre`, `codigo`,
 *     `minutosSemanales`, `curso`, `tipo` deben estar rellenos.
 */
final class MateriaOverrideDto
{
    public function __construct(
        public readonly Ccaa $ccaa,
        public readonly string $itinerarioCodigoOficial,
        public readonly ?string $materiaCodigoOficial,
        public readonly int $curso,
        public readonly ?int $minutosSemanales,
        public readonly ?string $nombre,
        public readonly ?string $codigo,
        public readonly ?TipoMateria $tipo,
        public readonly string $boletinOficialRef,
        public readonly \DateTimeImmutable $vigenteDesde,
        public readonly ?\DateTimeImmutable $vigenteHasta = null,
    ) {
    }

    public function esAutonomicaPura(): bool
    {
        return $this->materiaCodigoOficial === null;
    }
}
