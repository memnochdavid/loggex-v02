<?php

namespace App\Entity\Catalogo;

use ApiPlatform\Doctrine\Orm\Filter\DateFilter;
use ApiPlatform\Doctrine\Orm\Filter\SearchFilter;
use ApiPlatform\Metadata\ApiFilter;
use ApiPlatform\Metadata\ApiResource;
use ApiPlatform\Metadata\Get;
use ApiPlatform\Metadata\GetCollection;
use App\Entity\Ccaa;
use Doctrine\ORM\Mapping as ORM;
use Symfony\Component\Serializer\Attribute\Groups;

/**
 * Override autonómico del nombre/código de un itinerario del catálogo nacional.
 *
 * Caso de uso: un decreto de CCAA renombra o reasigna un código a un ciclo
 * formativo nacional. Si para una `(catalogoItinerario, ccaa)` no hay registro,
 * el resolver usa los campos nacionales tal cual.
 *
 * Versionado por fecha (D10): `vigenteDesde NOT NULL`, `vigenteHasta NULL` =
 * vigente hoy. Permite consultas históricas y auditoría comercial.
 *
 * Doc de referencia: docs/hoja-de-ruta-curriculum-ccaa.md §3.3.
 */
#[ORM\Entity]
#[ORM\Table(name: 'catalogo_itinerario_ccaa')]
#[ORM\UniqueConstraint(
    name: 'uniq_cat_itin_ccaa_vigencia',
    columns: ['ccaa', 'catalogo_itinerario_id', 'vigente_desde']
)]
#[ORM\Index(
    columns: ['ccaa', 'catalogo_itinerario_id', 'vigente_desde', 'vigente_hasta'],
    name: 'idx_cat_itin_ccaa_resolver'
)]
#[ApiResource(
    operations: [
        new Get(),
        new GetCollection(),
    ],
    normalizationContext: ['groups' => ['catalogo:read', 'catalogo_itinerario_ccaa:read']],
)]
#[ApiFilter(SearchFilter::class, properties: [
    'ccaa' => 'exact',
    'catalogoItinerario' => 'exact',
])]
#[ApiFilter(DateFilter::class, properties: ['vigenteDesde', 'vigenteHasta'])]
class CatalogoItinerarioCcaa
{
    #[ORM\Id]
    #[ORM\GeneratedValue]
    #[ORM\Column]
    #[Groups(['catalogo:read'])]
    private ?int $id = null;

    #[ORM\Column(type: 'string', length: 2, enumType: Ccaa::class)]
    #[Groups(['catalogo:read'])]
    private Ccaa $ccaa;

    #[ORM\ManyToOne(targetEntity: CatalogoItinerario::class)]
    #[ORM\JoinColumn(nullable: false, onDelete: 'CASCADE')]
    #[Groups(['catalogo_itinerario_ccaa:read'])]
    private CatalogoItinerario $catalogoItinerario;

    /** Override del nombre nacional. NULL = usar el nacional. */
    #[ORM\Column(length: 255, nullable: true)]
    #[Groups(['catalogo:read'])]
    private ?string $nombre = null;

    /** Código autonómico (ej. "FP-AND-DAW-2022"). NULL = usar el nacional. */
    #[ORM\Column(length: 50, nullable: true)]
    #[Groups(['catalogo:read'])]
    private ?string $codigo = null;

    /** Referencia al boletín oficial del decreto (ej. "BOJA Decreto 156/2022"). */
    #[ORM\Column(length: 100, nullable: true)]
    #[Groups(['catalogo:read'])]
    private ?string $boletinOficialRef = null;

    #[ORM\Column(type: 'date_immutable')]
    #[Groups(['catalogo:read'])]
    private \DateTimeImmutable $vigenteDesde;

    #[ORM\Column(type: 'date_immutable', nullable: true)]
    #[Groups(['catalogo:read'])]
    private ?\DateTimeImmutable $vigenteHasta = null;

    public function getId(): ?int { return $this->id; }
    public function getCcaa(): Ccaa { return $this->ccaa; }
    public function setCcaa(Ccaa $ccaa): static { $this->ccaa = $ccaa; return $this; }
    public function getCatalogoItinerario(): CatalogoItinerario { return $this->catalogoItinerario; }
    public function setCatalogoItinerario(CatalogoItinerario $i): static { $this->catalogoItinerario = $i; return $this; }
    public function getNombre(): ?string { return $this->nombre; }
    public function setNombre(?string $n): static { $this->nombre = $n; return $this; }
    public function getCodigo(): ?string { return $this->codigo; }
    public function setCodigo(?string $c): static { $this->codigo = $c; return $this; }
    public function getBoletinOficialRef(): ?string { return $this->boletinOficialRef; }
    public function setBoletinOficialRef(?string $r): static { $this->boletinOficialRef = $r; return $this; }
    public function getVigenteDesde(): \DateTimeImmutable { return $this->vigenteDesde; }
    public function setVigenteDesde(\DateTimeImmutable $d): static { $this->vigenteDesde = $d; return $this; }
    public function getVigenteHasta(): ?\DateTimeImmutable { return $this->vigenteHasta; }
    public function setVigenteHasta(?\DateTimeImmutable $d): static { $this->vigenteHasta = $d; return $this; }
}
