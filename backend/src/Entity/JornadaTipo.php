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
use App\Attribute\LivePublish;
use App\Entity\Traits\SoftDeletableTrait;
use App\Entity\Traits\TimestampableTrait;
use App\Repository\JornadaTipoRepository;
use App\State\SoftDeleteProcessor;
use App\Validator\Constraint\JornadaCoherente;
use Doctrine\Common\Collections\ArrayCollection;
use Doctrine\Common\Collections\Collection;
use Doctrine\DBAL\Types\Types;
use Doctrine\ORM\Mapping as ORM;
use Symfony\Component\Serializer\Attribute\Groups;
use Symfony\Component\Validator\Constraints as Assert;

/**
 * Plantilla de jornada lectiva diaria reutilizable entre itinerarios.
 *
 * Modelo de "lista libre de tramos": el detalle del día (slots y recreos)
 * vive en `tramos` como `JornadaTramo[]`. Aquí solo viven los datos
 * cabecera (nombre, centro, turno informativo, días lectivos).
 *
 * Una misma JornadaTipo puede ser asignada a varios `Itinerario`
 * (D9 — se permite compartir).
 */
#[ORM\Entity(repositoryClass: JornadaTipoRepository::class)]
#[ORM\Table(name: 'jornada_tipo')]
#[ORM\HasLifecycleCallbacks]
#[ApiResource(
    operations: [
        new Get(),
        new GetCollection(),
        new Post(),
        new Put(),
        new Delete(processor: SoftDeleteProcessor::class),
    ],
    normalizationContext: ['groups' => ['jornada:read', 'tramo:read', 'timestamp:read', 'softdelete:read']],
    denormalizationContext: ['groups' => ['jornada:write', 'tramo:write']],
)]
#[ApiFilter(SearchFilter::class, properties: [
    'centro' => 'exact',
    'turno' => 'exact',
    'nombre' => 'partial',
])]
#[ApiFilter(OrderFilter::class, properties: ['nombre', 'turno', 'id'], arguments: ['orderParameterName' => 'order'])]
#[JornadaCoherente]
#[LivePublish(
    topics: ['/admin/centros/{centro.id}/jornadas'],
    payloadGroups: ['jornada:read', 'tramo:read', 'timestamp:read', 'softdelete:read'],
)]
class JornadaTipo
{
    use TimestampableTrait;
    use SoftDeletableTrait;

    #[ORM\Id]
    #[ORM\GeneratedValue]
    #[ORM\Column]
    #[Groups(['jornada:read', 'itinerario:read'])]
    private ?int $id = null;

    #[ORM\Column(length: 100)]
    #[Assert\NotBlank]
    #[Assert\Length(max: 100)]
    #[Groups(['jornada:read', 'jornada:write', 'itinerario:read'])]
    private ?string $nombre = null;

    #[ORM\ManyToOne(inversedBy: 'jornadaTipos')]
    #[ORM\JoinColumn(nullable: false)]
    #[Assert\NotNull]
    #[Groups(['jornada:read', 'jornada:write'])]
    private ?Centro $centro = null;

    #[ORM\Column(type: 'string', length: 16, enumType: TurnoJornada::class)]
    #[Assert\NotBlank]
    #[Assert\Choice(
        choices: [TurnoJornada::MANANA, TurnoJornada::TARDE, TurnoJornada::ESPECIAL],
        message: 'El turno debe ser manana, tarde o especial.'
    )]
    #[Groups(['jornada:read', 'jornada:write', 'itinerario:read'])]
    private ?TurnoJornada $turno = null;

    /**
     * Días de la semana lectivos: 1=lunes … 7=domingo. Default lun-vie.
     * Persistido como JSON para futuro-compat (centros de 4 días, sábados, etc.).
     *
     * @var int[]
     */
    #[ORM\Column(type: Types::JSON)]
    #[Assert\NotBlank]
    #[Groups(['jornada:read', 'jornada:write'])]
    private array $diasLectivos = [1, 2, 3, 4, 5];

    /**
     * Tramos ordenados de la jornada (slots + recreos).
     *
     * @var Collection<int, JornadaTramo>
     */
    #[ORM\OneToMany(
        mappedBy: 'jornadaTipo',
        targetEntity: JornadaTramo::class,
        cascade: ['persist', 'remove'],
        orphanRemoval: true,
    )]
    #[ORM\OrderBy(['orden' => 'ASC'])]
    #[Groups(['jornada:read', 'jornada:write'])]
    private Collection $tramos;

    /**
     * Itinerarios que usan esta jornada (D9 — varios pueden compartir).
     *
     * @var Collection<int, Itinerario>
     */
    #[ORM\OneToMany(mappedBy: 'jornadaTipo', targetEntity: Itinerario::class)]
    private Collection $itinerarios;

    public function __construct()
    {
        $this->tramos = new ArrayCollection();
        $this->itinerarios = new ArrayCollection();
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

    public function getCentro(): ?Centro
    {
        return $this->centro;
    }

    public function setCentro(?Centro $centro): static
    {
        $this->centro = $centro;
        return $this;
    }

    public function getTurno(): ?TurnoJornada
    {
        return $this->turno;
    }

    public function setTurno(TurnoJornada $turno): static
    {
        $this->turno = $turno;
        return $this;
    }

    /** @return int[] */
    public function getDiasLectivos(): array
    {
        return $this->diasLectivos;
    }

    /** @param int[] $diasLectivos */
    public function setDiasLectivos(array $diasLectivos): static
    {
        $this->diasLectivos = array_values(array_unique($diasLectivos));
        sort($this->diasLectivos);
        return $this;
    }

    /** @return Collection<int, JornadaTramo> */
    public function getTramos(): Collection
    {
        return $this->tramos;
    }

    public function addTramo(JornadaTramo $tramo): static
    {
        if (!$this->tramos->contains($tramo)) {
            $this->tramos->add($tramo);
            $tramo->setJornadaTipo($this);
        }
        return $this;
    }

    public function removeTramo(JornadaTramo $tramo): static
    {
        if ($this->tramos->removeElement($tramo)) {
            if ($tramo->getJornadaTipo() === $this) {
                $tramo->setJornadaTipo(null);
            }
        }
        return $this;
    }
}
