<?php

namespace App\Entity;

use ApiPlatform\Doctrine\Orm\Filter\OrderFilter;
use ApiPlatform\Doctrine\Orm\Filter\SearchFilter;
use ApiPlatform\Metadata\ApiFilter;
use ApiPlatform\Metadata\ApiResource;
use ApiPlatform\Metadata\Delete;
use ApiPlatform\Metadata\Get;
use ApiPlatform\Metadata\GetCollection;
use ApiPlatform\Metadata\Patch;
use ApiPlatform\Metadata\Post;
use ApiPlatform\Metadata\Put;
use App\Attribute\LivePublish;
use App\Doctrine\Filter\SearchAnyFilter;
use App\Entity\Traits\SoftDeletableTrait;
use App\Entity\Traits\TimestampableTrait;
use App\Repository\GrupoRepository;
use App\State\SoftDeleteProcessor;
use Doctrine\Common\Collections\ArrayCollection;
use Doctrine\Common\Collections\Collection;
use Doctrine\DBAL\Types\Types;
use Doctrine\ORM\Mapping as ORM;
use Symfony\Component\Serializer\Attribute\Groups;
use Symfony\Component\Validator\Constraints as Assert;
use Symfony\Component\Validator\Context\ExecutionContextInterface;

#[ORM\Entity(repositoryClass: GrupoRepository::class)]
#[ORM\Table(name: 'grupo')]
#[ORM\HasLifecycleCallbacks]
#[Assert\Callback('validateAnioEscolar')]
#[ApiResource(
    operations: [
        new Get(),
        new GetCollection(),
        new Post(),
        new Put(),
        new Patch(),
        new Delete(processor: SoftDeleteProcessor::class)
    ],
    normalizationContext: ['groups' => ['grupo:read', 'timestamp:read', 'softdelete:read']],
    denormalizationContext: ['groups' => ['grupo:write']]
)]
#[LivePublish(
    topics: ['/admin/centros/{centro.id}/grupos'],
    payloadGroups: ['grupo:read', 'timestamp:read', 'softdelete:read'],
)]
#[ApiFilter(SearchFilter::class, properties: [
    'nombre' => 'partial',
    'anioEscolar' => 'exact',
    'itinerario' => 'exact',
    'itinerario.nombre' => 'partial',
    'centro' => 'exact'
])]
#[ApiFilter(SearchAnyFilter::class, properties: ['nombre', 'abreviatura', 'anioEscolar'])]
#[ApiFilter(OrderFilter::class, properties: ['nombre', 'curso', 'anioEscolar', 'id', 'fechaInicio', 'fechaFin'], arguments: ['orderParameterName' => 'order'])]
class Grupo
{
    use TimestampableTrait;
    use SoftDeletableTrait;

    #[ORM\Id]
    #[ORM\GeneratedValue]
    #[ORM\Column]
    #[Groups(['grupo:read', 'matricula:read'])]
    private ?int $id = null;

    #[ORM\Column(length: 50)]
    #[Assert\NotBlank]
    #[Assert\Length(max: 50)]
    #[Groups(['grupo:read', 'grupo:write', 'matricula:read', 'imparticion:read', 'horario:read'])] // Añadido horario:read
    private ?string $nombre = null;

    #[ORM\Column(length: 10)]
    #[Assert\NotBlank]
    #[Assert\Length(max: 10)]
    #[Groups(['grupo:read', 'grupo:write', 'matricula:read', 'imparticion:read', 'horario:read'])]
    private ?string $abreviatura = null;

    /**
     * Aula por defecto del grupo. Se aplica a los placements del horario salvo
     * que la imparticion concreta tenga `aulaEspecifica` (override por materia).
     * Si NULL, fallback final del solver: "Aula " + abreviatura.
     */
    #[ORM\Column(length: 100, nullable: true)]
    #[Assert\Length(max: 100)]
    #[Groups(['grupo:read', 'grupo:write', 'imparticion:read'])]
    private ?string $aulaDefault = null;

    #[ORM\Column]
    #[Groups(['grupo:read', 'grupo:write', 'matricula:read', 'imparticion:read', 'horario:read'])]
    private ?int $curso = null;

    #[ORM\Column(length: 20)]
    #[Assert\Regex(pattern: '/^\d{4}-\d{4}$/', message: 'El año escolar debe tener el formato YYYY-YYYY (ej. 2025-2026).')]
    #[Groups(['grupo:read', 'grupo:write', 'matricula:read'])] // Añadido matricula:read
    private ?string $anioEscolar = null;

    #[ORM\Column(type: Types::DATE_MUTABLE, nullable: true)]
    #[Groups(['grupo:read', 'grupo:write'])]
    private ?\DateTimeInterface $fechaInicio = null;

    #[ORM\Column(type: Types::DATE_MUTABLE, nullable: true)]
    #[Groups(['grupo:read', 'grupo:write'])]
    private ?\DateTimeInterface $fechaFin = null;

    #[ORM\ManyToOne(inversedBy: 'grupos')]
    #[ORM\JoinColumn(nullable: false)]
    #[Groups(['grupo:read', 'grupo:write', 'matricula:read'])] // Añadido matricula:read
    private ?Itinerario $itinerario = null;

    #[ORM\ManyToOne(inversedBy: 'grupos')]
    #[ORM\JoinColumn(nullable: false)]
    #[Groups(['grupo:read', 'grupo:write'])]
    private ?Centro $centro = null;

    /**
     * Override por grupo de la jornada efectiva. Si null, hereda de
     * `Itinerario.jornadaTipo`. Permite que el admin cambie la plantilla de
     * jornada con la que trabaja /admin/horarios sin tocar el itinerario
     * (ni afectar a otros grupos del mismo itinerario).
     *
     * Stepping stone hacia `PeriodoLectivo` (ver
     * `docs/hoja-de-ruta-periodos-lectivos.md`): cuando se implementen los
     * rangos, el override del grupo se migra como `JornadaTipo` del rango
     * único `"Curso completo"`.
     */
    #[ORM\ManyToOne]
    #[ORM\JoinColumn(nullable: true, onDelete: 'SET NULL')]
    #[Groups(['grupo:read', 'grupo:write'])]
    private ?JornadaTipo $jornadaTipoOverride = null;

    #[ORM\OneToMany(mappedBy: 'grupo', targetEntity: Matricula::class)]
    private Collection $matriculas;

    #[ORM\OneToMany(mappedBy: 'grupo', targetEntity: Imparticion::class)]
    private Collection $imparticiones;

    public function __construct()
    {
        $this->matriculas = new ArrayCollection();
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

    public function getAbreviatura(): ?string
    {
        return $this->abreviatura;
    }

    public function setAbreviatura(?string $abreviatura): static
    {
        $this->abreviatura = $abreviatura;
        return $this;
    }

    public function getAulaDefault(): ?string
    {
        return $this->aulaDefault;
    }

    public function setAulaDefault(?string $aulaDefault): static
    {
        $this->aulaDefault = $aulaDefault;
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

    public function getAnioEscolar(): ?string
    {
        return $this->anioEscolar;
    }

    public function setAnioEscolar(string $anioEscolar): static
    {
        $this->anioEscolar = $anioEscolar;
        return $this;
    }

    public function getFechaInicio(): ?\DateTimeInterface
    {
        return $this->fechaInicio;
    }

    public function setFechaInicio(?\DateTimeInterface $fechaInicio): static
    {
        $this->fechaInicio = $fechaInicio;
        return $this;
    }

    public function getFechaFin(): ?\DateTimeInterface
    {
        return $this->fechaFin;
    }

    public function setFechaFin(?\DateTimeInterface $fechaFin): static
    {
        $this->fechaFin = $fechaFin;
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

    public function getCentro(): ?Centro
    {
        return $this->centro;
    }

    public function setCentro(?Centro $centro): static
    {
        $this->centro = $centro;
        return $this;
    }

    public function getJornadaTipoOverride(): ?JornadaTipo
    {
        return $this->jornadaTipoOverride;
    }

    public function setJornadaTipoOverride(?JornadaTipo $jornadaTipoOverride): static
    {
        $this->jornadaTipoOverride = $jornadaTipoOverride;
        return $this;
    }

    /**
     * Jornada efectiva del grupo: override si está definido, default del
     * itinerario en otro caso. Punto único que el solver, el CapacityPlanner
     * y el editor deben consultar.
     */
    public function getEffectiveJornadaTipo(): ?JornadaTipo
    {
        return $this->jornadaTipoOverride ?? $this->itinerario?->getJornadaTipo();
    }

    public function validateAnioEscolar(ExecutionContextInterface $context): void
    {
        if (!$this->anioEscolar) {
            return;
        }
        if (!preg_match('/^(\d{4})-(\d{4})$/', $this->anioEscolar, $matches)) {
            $context->buildViolation('El año escolar debe tener el formato YYYY-YYYY (ej. 2025-2026).')
                ->atPath('anioEscolar')
                ->addViolation();
            return;
        }
        $inicio = (int) $matches[1];
        $fin = (int) $matches[2];
        if ($fin !== $inicio + 1) {
            $context->buildViolation('El segundo año debe ser exactamente el siguiente al primero (ej. 2025-2026).')
                ->atPath('anioEscolar')
                ->addViolation();
        }
    }
}
