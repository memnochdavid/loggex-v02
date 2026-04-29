<?php

namespace App\Entity\Catalogo;

use ApiPlatform\Doctrine\Orm\Filter\DateFilter;
use ApiPlatform\Doctrine\Orm\Filter\SearchFilter;
use ApiPlatform\Metadata\ApiFilter;
use ApiPlatform\Metadata\ApiResource;
use ApiPlatform\Metadata\Get;
use ApiPlatform\Metadata\GetCollection;
use App\Entity\Ccaa;
use App\Entity\Modalidad;
use Doctrine\ORM\Mapping as ORM;
use Symfony\Component\Serializer\Attribute\Groups;

/**
 * Capa overlay del catálogo nacional por Comunidad Autónoma.
 *
 * Dos modos según `catalogoMateria`:
 *   - **Override** (`catalogoMateria` NOT NULL): la materia nacional sigue
 *     existiendo; este registro modifica `nombre`/`codigo`/`minutosSemanales`/
 *     `tipo` solo donde estén rellenos (los NULL caen a la nacional).
 *   - **Autonómica pura** (`catalogoMateria` NULL): materia que NO existe en
 *     el currículo nacional pero sí en el de esa CCAA (Inglés profesional GS,
 *     IPE II, etc.). `nombre`, `codigo`, `minutosSemanales`, `curso` y `tipo`
 *     son obligatorios.
 *
 * Versionado por fecha (D10): `vigenteDesde NOT NULL`, `vigenteHasta NULL` =
 * vigente hoy.
 *
 * Doc de referencia: docs/hoja-de-ruta-curriculum-ccaa.md §3.2.
 */
#[ORM\Entity]
#[ORM\Table(name: 'catalogo_materia_ccaa')]
#[ORM\Index(
    columns: ['ccaa', 'catalogo_itinerario_id', 'vigente_desde', 'vigente_hasta'],
    name: 'idx_cat_mat_ccaa_resolver'
)]
#[ApiResource(
    operations: [
        new Get(),
        new GetCollection(),
    ],
    normalizationContext: ['groups' => ['catalogo:read', 'catalogo_materia_ccaa:read']],
)]
#[ApiFilter(SearchFilter::class, properties: [
    'ccaa' => 'exact',
    'catalogoItinerario' => 'exact',
    'catalogoMateria' => 'exact',
    'curso' => 'exact',
    'tipo' => 'exact',
])]
#[ApiFilter(DateFilter::class, properties: ['vigenteDesde', 'vigenteHasta'])]
class CatalogoMateriaCcaa
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
    #[Groups(['catalogo_materia_ccaa:read'])]
    private CatalogoItinerario $catalogoItinerario;

    /**
     * NULL = autonómica pura (no existe en el currículo nacional).
     * NOT NULL = override de la materia nacional referenciada.
     */
    #[ORM\ManyToOne(targetEntity: CatalogoMateria::class)]
    #[ORM\JoinColumn(nullable: true, onDelete: 'CASCADE')]
    #[Groups(['catalogo_materia_ccaa:read'])]
    private ?CatalogoMateria $catalogoMateria = null;

    /** Override del nombre nacional o nombre de la materia autonómica pura. */
    #[ORM\Column(length: 255, nullable: true)]
    #[Groups(['catalogo:read'])]
    private ?string $nombre = null;

    /** Código autonómico de la materia. */
    #[ORM\Column(length: 50, nullable: true)]
    #[Groups(['catalogo:read'])]
    private ?string $codigo = null;

    /** Carga semanal en minutos. Override total (no se mezcla con la nacional). */
    #[ORM\Column(nullable: true)]
    #[Groups(['catalogo:read'])]
    private ?int $minutosSemanales = null;

    /** Curso (1, 2, …). Obligatorio para autonómicas puras. */
    #[ORM\Column(nullable: true)]
    #[Groups(['catalogo:read'])]
    private ?int $curso = null;

    #[ORM\Column(type: 'string', enumType: TipoMateria::class, nullable: true)]
    #[Groups(['catalogo:read'])]
    private ?TipoMateria $tipo = null;

    /**
     * Override de modalidad. NULL = hereda la del CatalogoMateria nacional
     * (override) o PRESENCIAL (autonómica pura sin override). Solo se rellena
     * cuando la CCAA cataloga una materia con modalidad distinta a la nacional
     * o cuando la autonómica pura no es presencial (ej. "Horas de libre
     * configuración" → NO_REGULAR).
     */
    #[ORM\Column(type: 'string', enumType: Modalidad::class, nullable: true)]
    #[Groups(['catalogo:read'])]
    private ?Modalidad $modalidad = null;

    /** Referencia al boletín oficial (ej. "BOJA 149/2011 anexo II + Resolución DG FP 26/06/2024"). */
    #[ORM\Column(length: 255, nullable: true)]
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
    public function getCatalogoMateria(): ?CatalogoMateria { return $this->catalogoMateria; }
    public function setCatalogoMateria(?CatalogoMateria $m): static { $this->catalogoMateria = $m; return $this; }
    public function getNombre(): ?string { return $this->nombre; }
    public function setNombre(?string $n): static { $this->nombre = $n; return $this; }
    public function getCodigo(): ?string { return $this->codigo; }
    public function setCodigo(?string $c): static { $this->codigo = $c; return $this; }
    public function getMinutosSemanales(): ?int { return $this->minutosSemanales; }
    public function setMinutosSemanales(?int $m): static { $this->minutosSemanales = $m; return $this; }
    public function getCurso(): ?int { return $this->curso; }
    public function setCurso(?int $c): static { $this->curso = $c; return $this; }
    public function getTipo(): ?TipoMateria { return $this->tipo; }
    public function setTipo(?TipoMateria $t): static { $this->tipo = $t; return $this; }
    public function getModalidad(): ?Modalidad { return $this->modalidad; }
    public function setModalidad(?Modalidad $m): static { $this->modalidad = $m; return $this; }
    public function getBoletinOficialRef(): ?string { return $this->boletinOficialRef; }
    public function setBoletinOficialRef(?string $r): static { $this->boletinOficialRef = $r; return $this; }
    public function getVigenteDesde(): \DateTimeImmutable { return $this->vigenteDesde; }
    public function setVigenteDesde(\DateTimeImmutable $d): static { $this->vigenteDesde = $d; return $this; }
    public function getVigenteHasta(): ?\DateTimeImmutable { return $this->vigenteHasta; }
    public function setVigenteHasta(?\DateTimeImmutable $d): static { $this->vigenteHasta = $d; return $this; }

    public function esAutonomicaPura(): bool
    {
        return $this->catalogoMateria === null;
    }
}
