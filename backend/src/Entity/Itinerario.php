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
use App\Entity\Catalogo\CatalogoItinerario;
use App\Entity\Traits\SoftDeletableTrait;
use App\Entity\Traits\TimestampableTrait;
use App\Repository\ItinerarioRepository;
use App\State\SoftDeleteProcessor;
use Doctrine\Common\Collections\ArrayCollection;
use Doctrine\Common\Collections\Collection;
use Doctrine\ORM\Mapping as ORM;
use Symfony\Component\Serializer\Attribute\Groups;

#[ORM\Entity(repositoryClass: ItinerarioRepository::class)]
#[ORM\Table(name: 'itinerario')]
#[ORM\HasLifecycleCallbacks]
#[ApiResource(
    operations: [
        new Get(),
        new GetCollection(),
        new Post(),
        new Put(),
        new Delete(processor: SoftDeleteProcessor::class)
    ],
    normalizationContext: ['groups' => ['itinerario:read', 'timestamp:read', 'softdelete:read']],
    denormalizationContext: ['groups' => ['itinerario:write']]
)]
#[ApiFilter(SearchFilter::class, properties: [
    'nombre' => 'partial',
    'nivel' => 'exact',
    'centro' => 'exact'
])]
#[ApiFilter(SearchAnyFilter::class, properties: ['nombre'])]
#[ApiFilter(OrderFilter::class, properties: ['nombre', 'nivel', 'id'], arguments: ['orderParameterName' => 'order'])]
class Itinerario
{
    use TimestampableTrait;
    use SoftDeletableTrait;

    #[ORM\Id]
    #[ORM\GeneratedValue]
    #[ORM\Column]
    #[Groups(['itinerario:read', 'materia:read', 'grupo:read', 'matricula:read'])] // Añadido matricula:read
    private ?int $id = null;

    #[ORM\Column(length: 255)]
    #[Groups(['itinerario:read', 'itinerario:write', 'materia:read', 'grupo:read', 'matricula:read'])] // Añadido matricula:read
    private ?string $nombre = null;

    #[ORM\Column(length: 50)]
    #[Groups(['itinerario:read', 'itinerario:write', 'materia:read'])]
    private ?string $nivel = null;

    #[ORM\ManyToOne(inversedBy: 'itinerarios')]
    #[ORM\JoinColumn(nullable: false)]
    #[Groups(['itinerario:read', 'itinerario:write'])]
    private ?Centro $centro = null;

    /**
     * Trazabilidad al catálogo oficial. Si el ciclo se creó seleccionando del catálogo
     * de TodoFP (o equivalente), aquí queda el origen para detectar futuros cambios
     * normativos. Nullable: ciclos manuales son válidos.
     */
    #[ORM\ManyToOne(targetEntity: CatalogoItinerario::class)]
    #[ORM\JoinColumn(nullable: true, onDelete: 'SET NULL')]
    #[Groups(['itinerario:read'])]
    private ?CatalogoItinerario $catalogoOrigen = null;

    /**
     * Jornada lectiva asignada al itinerario. Nullable: D7 — el admin debe elegir
     * una explícitamente, no hay fallback automático. Mientras esté null, el editor
     * de horarios mostrará un aviso pidiendo asignar jornada.
     *
     * Una misma JornadaTipo puede ser compartida por varios itinerarios (D9).
     */
    #[ORM\ManyToOne(inversedBy: 'itinerarios')]
    #[ORM\JoinColumn(nullable: true, onDelete: 'SET NULL')]
    #[Groups(['itinerario:read', 'itinerario:write', 'grupo:read'])]
    private ?JornadaTipo $jornadaTipo = null;

    /**
     * Comunidad Autónoma cuya normativa aplica al itinerario (D5). NULL = currículo
     * nacional puro (BOE). Si NOT NULL, el resolver de materias aplica la capa
     * overlay correspondiente (`CatalogoMateriaCcaa`, `CatalogoItinerarioCcaa`).
     *
     * Default al crear: si `Centro.ccaa` está rellena, se preselecciona; si no,
     * el admin elige explícitamente (D9).
     */
    #[ORM\Column(type: 'string', length: 2, nullable: true, enumType: Ccaa::class)]
    #[Groups(['itinerario:read', 'itinerario:write', 'grupo:read'])]
    private ?Ccaa $ccaa = null;

    #[ORM\OneToMany(mappedBy: 'itinerario', targetEntity: Materia::class)]
    private Collection $materias;

    #[ORM\OneToMany(mappedBy: 'itinerario', targetEntity: Grupo::class)]
    private Collection $grupos;

    public function __construct()
    {
        $this->materias = new ArrayCollection();
        $this->grupos = new ArrayCollection();
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

    public function getNivel(): ?string
    {
        return $this->nivel;
    }

    public function setNivel(string $nivel): static
    {
        $this->nivel = $nivel;
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

    /**
     * @return Collection<int, Materia>
     */
    public function getMaterias(): Collection
    {
        return $this->materias;
    }

    public function addMateria(Materia $materia): static
    {
        if (!$this->materias->contains($materia)) {
            $this->materias->add($materia);
            $materia->setItinerario($this);
        }

        return $this;
    }

    public function removeMateria(Materia $materia): static
    {
        if ($this->materias->removeElement($materia)) {
            if ($materia->getItinerario() === $this) {
                $materia->setItinerario(null);
            }
        }

        return $this;
    }

    /**
     * @return Collection<int, Grupo>
     */
    public function getGrupos(): Collection
    {
        return $this->grupos;
    }

    public function addGrupo(Grupo $grupo): static
    {
        if (!$this->grupos->contains($grupo)) {
            $this->grupos->add($grupo);
            $grupo->setItinerario($this);
        }

        return $this;
    }

    public function removeGrupo(Grupo $grupo): static
    {
        if ($this->grupos->removeElement($grupo)) {
            if ($grupo->getItinerario() === $this) {
                $grupo->setItinerario(null);
            }
        }

        return $this;
    }

    public function getCatalogoOrigen(): ?CatalogoItinerario
    {
        return $this->catalogoOrigen;
    }

    public function setCatalogoOrigen(?CatalogoItinerario $origen): static
    {
        $this->catalogoOrigen = $origen;
        return $this;
    }

    public function getJornadaTipo(): ?JornadaTipo
    {
        return $this->jornadaTipo;
    }

    public function setJornadaTipo(?JornadaTipo $jornadaTipo): static
    {
        $this->jornadaTipo = $jornadaTipo;
        return $this;
    }

    public function getCcaa(): ?Ccaa
    {
        return $this->ccaa;
    }

    public function setCcaa(?Ccaa $ccaa): static
    {
        $this->ccaa = $ccaa;
        return $this;
    }
}
