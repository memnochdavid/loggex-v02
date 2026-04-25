<?php

namespace App\Entity\Catalogo;

use ApiPlatform\Doctrine\Orm\Filter\OrderFilter;
use ApiPlatform\Doctrine\Orm\Filter\SearchFilter;
use ApiPlatform\Metadata\ApiFilter;
use ApiPlatform\Metadata\ApiResource;
use ApiPlatform\Metadata\Get;
use ApiPlatform\Metadata\GetCollection;
use App\Doctrine\Filter\SearchAnyFilter;
use Doctrine\ORM\Mapping as ORM;
use Symfony\Component\Serializer\Attribute\Groups;

/**
 * Centro educativo registrado oficialmente. Lo consume `AsyncSearchSelect`
 * cuando un SuperAdmin da de alta un nuevo Centro en Loggex, para autocompletar
 * nombre, código, dirección y titularidad con datos fiables.
 *
 * Read-only desde la API. Se alimenta de:
 *  - `JuntaAndaluciaCentrosAdapter` (API REST oficial) para Andalucía.
 *  - `RegistroEstatalCentrosAdapter` (scraping del registro estatal) para resto.
 */
#[ORM\Entity]
#[ORM\Table(name: 'catalogo_centro')]
#[ORM\Index(columns: ['ccaa', 'provincia'], name: 'idx_catalogo_centro_ccaa_prov')]
#[ORM\UniqueConstraint(name: 'uniq_catalogo_centro_codigo', columns: ['codigo_centro'])]
#[ApiResource(
    operations: [
        new Get(),
        new GetCollection(),
    ],
    normalizationContext: ['groups' => ['catalogo:read', 'catalogo_centro:read']],
)]
#[ApiFilter(SearchAnyFilter::class, properties: ['nombre', 'codigoCentro', 'municipio', 'direccion'])]
#[ApiFilter(SearchFilter::class, properties: [
    'ccaa' => 'exact',
    'provincia' => 'exact',
    'titularidad' => 'exact',
])]
#[ApiFilter(OrderFilter::class, properties: ['nombre', 'municipio'], arguments: ['orderParameterName' => 'order'])]
class CatalogoCentro
{
    #[ORM\Id]
    #[ORM\GeneratedValue]
    #[ORM\Column]
    #[Groups(['catalogo:read'])]
    private ?int $id = null;

    /** Código oficial del centro (8 dígitos en el registro estatal/andaluz). */
    #[ORM\Column(length: 20)]
    #[Groups(['catalogo:read'])]
    private string $codigoCentro;

    #[ORM\Column(length: 255)]
    #[Groups(['catalogo:read'])]
    private string $nombre;

    /** Código ISO 3166-2:ES sin "ES-": "AND", "MAD", "CAT", … */
    #[ORM\Column(length: 3)]
    #[Groups(['catalogo:read'])]
    private string $ccaa;

    #[ORM\Column(length: 100, nullable: true)]
    #[Groups(['catalogo:read'])]
    private ?string $provincia = null;

    #[ORM\Column(length: 100, nullable: true)]
    #[Groups(['catalogo:read'])]
    private ?string $municipio = null;

    #[ORM\Column(length: 500, nullable: true)]
    #[Groups(['catalogo:read'])]
    private ?string $direccion = null;

    #[ORM\Column(type: 'string', enumType: Titularidad::class, nullable: true)]
    #[Groups(['catalogo:read'])]
    private ?Titularidad $titularidad = null;

    /** Lista de etapas que ofrece el centro: ["ESO", "BACHILLERATO", "FP_SUPERIOR"]. */
    #[ORM\Column(type: 'json', nullable: true)]
    #[Groups(['catalogo:read'])]
    private ?array $etapasOfrecidas = null;

    #[ORM\Column(length: 50)]
    private string $fuenteIngesta;

    #[ORM\Column(length: 64)]
    private string $fuenteHash;

    #[ORM\Column(type: 'datetime_immutable')]
    private \DateTimeImmutable $ingestadoAt;

    public function __construct()
    {
        $this->ingestadoAt = new \DateTimeImmutable();
    }

    public function getId(): ?int { return $this->id; }
    public function getCodigoCentro(): string { return $this->codigoCentro; }
    public function setCodigoCentro(string $c): self { $this->codigoCentro = $c; return $this; }
    public function getNombre(): string { return $this->nombre; }
    public function setNombre(string $n): self { $this->nombre = $n; return $this; }
    public function getCcaa(): string { return $this->ccaa; }
    public function setCcaa(string $c): self { $this->ccaa = $c; return $this; }
    public function getProvincia(): ?string { return $this->provincia; }
    public function setProvincia(?string $p): self { $this->provincia = $p; return $this; }
    public function getMunicipio(): ?string { return $this->municipio; }
    public function setMunicipio(?string $m): self { $this->municipio = $m; return $this; }
    public function getDireccion(): ?string { return $this->direccion; }
    public function setDireccion(?string $d): self { $this->direccion = $d; return $this; }
    public function getTitularidad(): ?Titularidad { return $this->titularidad; }
    public function setTitularidad(?Titularidad $t): self { $this->titularidad = $t; return $this; }
    public function getEtapasOfrecidas(): ?array { return $this->etapasOfrecidas; }
    public function setEtapasOfrecidas(?array $e): self { $this->etapasOfrecidas = $e; return $this; }
    public function getFuenteIngesta(): string { return $this->fuenteIngesta; }
    public function setFuenteIngesta(string $f): self { $this->fuenteIngesta = $f; return $this; }
    public function getFuenteHash(): string { return $this->fuenteHash; }
    public function setFuenteHash(string $h): self { $this->fuenteHash = $h; return $this; }
    public function getIngestadoAt(): \DateTimeImmutable { return $this->ingestadoAt; }
    public function setIngestadoAt(\DateTimeImmutable $d): self { $this->ingestadoAt = $d; return $this; }
}
