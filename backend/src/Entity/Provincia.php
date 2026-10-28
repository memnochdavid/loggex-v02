<?php

namespace App\Entity;

use ApiPlatform\Doctrine\Orm\Filter\SearchFilter;
use ApiPlatform\Metadata\ApiFilter;
use ApiPlatform\Metadata\ApiResource;
use ApiPlatform\Metadata\Get;
use ApiPlatform\Metadata\GetCollection;
use Doctrine\ORM\Mapping as ORM;
use Symfony\Component\Serializer\Attribute\Groups;

/**
 * Provincias de España (50 + Ceuta + Melilla = 52). Identificadas por código
 * INE (01–52). Cada una pertenece a una y solo una CCAA. Es entidad estática:
 * no cambian con el tiempo (las provincias están fijadas constitucionalmente).
 *
 * Se usa como hijo de `Centro.provincia` para resolver:
 *   - festivos provinciales / locales aplicables al centro
 *   - delegación territorial del calendario lectivo (cuando aplique)
 */
#[ORM\Entity]
#[ORM\Table(name: 'provincia')]
#[ApiResource(
    operations: [new Get(), new GetCollection()],
    normalizationContext: ['groups' => ['provincia:read']],
)]
#[ApiFilter(SearchFilter::class, properties: ['ccaa' => 'exact'])]
class Provincia
{
    /** Código INE de provincia (01..52). PK. */
    #[ORM\Id]
    #[ORM\Column(length: 2)]
    #[Groups(['provincia:read', 'centro:read'])]
    private string $codigo;

    #[ORM\Column(length: 100)]
    #[Groups(['provincia:read', 'centro:read'])]
    private string $nombre;

    #[ORM\Column(type: 'string', length: 2, enumType: Ccaa::class)]
    #[Groups(['provincia:read', 'centro:read'])]
    private Ccaa $ccaa;

    public function __construct(string $codigo, string $nombre, Ccaa $ccaa)
    {
        $this->codigo = $codigo;
        $this->nombre = $nombre;
        $this->ccaa = $ccaa;
    }

    public function getCodigo(): string { return $this->codigo; }
    public function getNombre(): string { return $this->nombre; }
    public function getCcaa(): Ccaa { return $this->ccaa; }
}
