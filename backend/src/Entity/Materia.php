<?php

namespace App\Entity;

use ApiPlatform\Doctrine\Orm\Filter\OrderFilter;
use ApiPlatform\Doctrine\Orm\Filter\SearchFilter;
use ApiPlatform\Metadata\ApiFilter;
use ApiPlatform\Metadata\ApiResource;
use ApiPlatform\Metadata\Delete;
use ApiPlatform\Metadata\Get;
use ApiPlatform\Metadata\GetCollection;
use ApiPlatform\Metadata\Post;
use ApiPlatform\Metadata\Put;
use App\Doctrine\Filter\SearchAnyFilter;
use App\Entity\Catalogo\CatalogoMateria;
use App\Entity\Catalogo\TipoMateria;
use App\Entity\Traits\SoftDeletableTrait;
use App\Entity\Traits\TimestampableTrait;
use App\Repository\MateriaRepository;
use App\State\SoftDeleteProcessor;
use Doctrine\Common\Collections\ArrayCollection;
use Doctrine\Common\Collections\Collection;
use Doctrine\ORM\Mapping as ORM;
use Symfony\Component\Serializer\Attribute\Groups;

#[ORM\Entity(repositoryClass: MateriaRepository::class)]
#[ORM\Table(name: 'materia')]
#[ORM\HasLifecycleCallbacks]
#[ApiResource(
    operations: [
        new Get(),
        new GetCollection(),
        new Post(),
        new Put(),
        new Delete(processor: SoftDeleteProcessor::class)
    ],
    normalizationContext: ['groups' => ['materia:read', 'timestamp:read', 'softdelete:read']],
    denormalizationContext: ['groups' => ['materia:write']]
)]
#[ApiFilter(SearchFilter::class, properties: [
    'nombre' => 'partial',
    'abreviatura' => 'partial',
    'codigoOficial' => 'partial',
    'itinerario' => 'exact',
    'itinerario.nombre' => 'partial',
    'itinerario.centro' => 'exact',
    'curso' => 'exact'
])]
#[ApiFilter(SearchAnyFilter::class, properties: ['nombre', 'abreviatura', 'codigoOficial'])]
#[ApiFilter(OrderFilter::class, properties: ['nombre', 'abreviatura', 'codigoOficial', 'curso', 'id', 'itinerario.nombre'], arguments: ['orderParameterName' => 'order'])]
class Materia
{
    use TimestampableTrait;
    use SoftDeletableTrait;

    #[ORM\Id]
    #[ORM\GeneratedValue]
    #[ORM\Column]
    #[Groups(['materia:read', 'imparticion:read', 'horario:read', 'tarea:read'])] // Añadido imparticion:read, horario:read, tarea:read
    private ?int $id = null;

    #[ORM\Column(length: 255)]
    #[Groups(['materia:read', 'materia:write', 'imparticion:read', 'horario:read', 'tarea:read'])] // Añadido tarea:read
    private ?string $nombre = null;

    #[ORM\Column(length: 50, nullable: true)]
    #[Groups(['materia:read', 'materia:write', 'imparticion:read', 'horario:read', 'tarea:read'])] // Añadido tarea:read
    private ?string $codigoOficial = null;

    /**
     * Forma corta del nombre para contextos con poco espacio horizontal
     * (vista móvil de AccordionView, TimeTable, etc.).
     */
    #[ORM\Column(length: 16, nullable: true)]
    #[Groups(['materia:read', 'materia:write', 'imparticion:read', 'horario:read', 'tarea:read'])]
    private ?string $abreviatura = null;

    #[ORM\Column]
    #[Groups(['materia:read', 'materia:write', 'imparticion:read'])]
    private ?int $curso = null;

    /**
     * Carga lectiva semanal en MINUTOS. Permite valores que no encajan en horas
     * enteras (90 min, 75 min, 1h30 = 90, etc.) — frecuente en jornadas reales
     * con bloques mixtos. La UI muestra horas decimales (helper `minToHoras`).
     *
     * Obligatorio en FP (donde el currículo nacional las define). En
     * ESO/Bachillerato es opcional: el RD nacional solo fija horas mínimas
     * totales por etapa, y el reparto curso a curso lo decide cada CCAA. El
     * admin puede dejarlo en blanco hasta confirmar el reparto regional.
     */
    #[ORM\Column(nullable: true)]
    #[Groups(['materia:read', 'materia:write', 'imparticion:read'])]
    private ?int $minutosSemanales = null;

    /**
     * Tipo de materia (TRONCAL, ESPECIFICA, OPTATIVA, MODULO, FCT, …) — re-usa
     * el enum del catálogo. Nullable porque las materias FP existentes pre-ESO
     * no lo tienen. Lo rellena la materialización desde catálogo (catalogoOrigen)
     * o el admin manualmente.
     */
    #[ORM\Column(type: 'string', enumType: TipoMateria::class, nullable: true)]
    #[Groups(['materia:read', 'materia:write', 'imparticion:read'])]
    private ?TipoMateria $tipo = null;

    /**
     * Modalidad de imparticion (D-A): separa placement físico de carga
     * curricular. Default `PRESENCIAL` (D-B): preserva comportamiento previo
     * a 2026-04-29 sin riesgo de regresión.
     *
     * Solo `PRESENCIAL` ocupa slots del horario; el resto (FCT, NO_REGULAR,
     * AUTONOMA) cuenta al currículo total pero no al placement.
     *
     * Override grupo-level posible vía `Imparticion.modalidad`
     * (consultar siempre con `Imparticion::getEffectiveModalidad()`).
     */
    #[ORM\Column(type: 'string', enumType: Modalidad::class, options: ['default' => 'presencial'])]
    #[Groups(['materia:read', 'materia:write', 'imparticion:read'])]
    private Modalidad $modalidad = Modalidad::PRESENCIAL;

    #[ORM\ManyToOne(inversedBy: 'materias')]
    #[ORM\JoinColumn(nullable: false)]
    #[Groups(['materia:read', 'materia:write'])]
    private ?Itinerario $itinerario = null;

    #[ORM\OneToMany(mappedBy: 'materia', targetEntity: Imparticion::class)]
    private Collection $imparticiones;

    /** Trazabilidad al catálogo oficial. Nullable: módulos manuales son válidos. */
    #[ORM\ManyToOne(targetEntity: CatalogoMateria::class)]
    #[ORM\JoinColumn(nullable: true, onDelete: 'SET NULL')]
    #[Groups(['materia:read'])]
    private ?CatalogoMateria $catalogoOrigen = null;

    public function __construct()
    {
        $this->imparticiones = new ArrayCollection();
    }

    public function getId(): ?int
    {
        return $this->id;
    }

    public function getNombre(): ?string
    {
        return $this->nombre;
    }

    public function setNombre(string $nombre): static
    {
        $this->nombre = $nombre;
        return $this;
    }

    public function getCodigoOficial(): ?string
    {
        return $this->codigoOficial;
    }

    public function setCodigoOficial(?string $codigoOficial): static
    {
        $this->codigoOficial = $codigoOficial;
        return $this;
    }

    public function getAbreviatura(): ?string
    {
        return $this->abreviatura;
    }

    public function setAbreviatura(?string $abreviatura): static
    {
        $this->abreviatura = $abreviatura;
        return $this;
    }

    public function getCurso(): ?int
    {
        return $this->curso;
    }

    public function setCurso(int $curso): static
    {
        $this->curso = $curso;
        return $this;
    }

    public function getMinutosSemanales(): ?int
    {
        return $this->minutosSemanales;
    }

    public function setMinutosSemanales(?int $minutosSemanales): static
    {
        $this->minutosSemanales = $minutosSemanales;
        return $this;
    }

    public function getTipo(): ?TipoMateria
    {
        return $this->tipo;
    }

    public function setTipo(?TipoMateria $tipo): static
    {
        $this->tipo = $tipo;
        return $this;
    }

    public function getModalidad(): Modalidad
    {
        return $this->modalidad;
    }

    public function setModalidad(Modalidad $modalidad): static
    {
        $this->modalidad = $modalidad;
        return $this;
    }

    public function getItinerario(): ?Itinerario
    {
        return $this->itinerario;
    }

    public function setItinerario(?Itinerario $itinerario): static
    {
        $this->itinerario = $itinerario;
        return $this;
    }

    public function getCatalogoOrigen(): ?CatalogoMateria
    {
        return $this->catalogoOrigen;
    }

    public function setCatalogoOrigen(?CatalogoMateria $origen): self
    {
        $this->catalogoOrigen = $origen;
        return $this;
    }
}
