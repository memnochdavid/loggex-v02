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
use App\Entity\Traits\SoftDeletableTrait;
use App\Entity\Traits\TimestampableTrait;
use App\Repository\TareaRepository;
use App\State\SoftDeleteProcessor;
use Doctrine\Common\Collections\ArrayCollection;
use Doctrine\Common\Collections\Collection;
use Doctrine\DBAL\Types\Types;
use Doctrine\ORM\Mapping as ORM;
use Symfony\Component\Serializer\Attribute\Groups;
use Symfony\Component\Validator\Constraints as Assert;

#[ORM\Entity(repositoryClass: TareaRepository::class)]
#[ORM\Table(name: 'tarea')]
#[ORM\HasLifecycleCallbacks]
#[ApiResource(
    operations: [
        new Get(),
        new GetCollection(),
        new Post(),
        new Put(),
        new Patch(),
        new Delete(processor: SoftDeleteProcessor::class)
    ],
    normalizationContext: ['groups' => ['tarea:read', 'timestamp:read', 'softdelete:read']],
    denormalizationContext: ['groups' => ['tarea:write']]
)]
// Topic plano /admin/tareas: la cascada por centro se hace en backend
// (CurrentUserExtension). Todos los admins reciben la señal y refetch.
// La vista de evaluación/grupo concreto puede subscribirse al mismo topic
// y refetch su slice — el filtro queda en el endpoint REST.
#[LivePublish(
    topics: ['/admin/tareas'],
    payloadGroups: ['tarea:read', 'timestamp:read', 'softdelete:read'],
)]
#[ApiFilter(SearchFilter::class, properties: [
    'imparticion' => 'exact',
    'tipo' => 'exact',
    'tareaOriginal' => 'exact',
])]
#[ApiFilter(OrderFilter::class, properties: ['fechaLimite', 'titulo'], arguments: ['orderParameterName' => 'order'])]
class Tarea
{
    use TimestampableTrait;
    use SoftDeletableTrait;

    #[ORM\Id]
    #[ORM\GeneratedValue]
    #[ORM\Column]
    #[Groups(['tarea:read', 'imparticion:read', 'entrega:read'])]
    private ?int $id = null;

    #[ORM\Column(length: 255)]
    #[Assert\NotBlank]
    #[Assert\Length(max: 255)]
    #[Groups(['tarea:read', 'tarea:write', 'imparticion:read', 'entrega:read'])]
    private ?string $titulo = null;

    #[ORM\Column(type: Types::TEXT, nullable: true)]
    #[Assert\Length(max: 2000)]
    #[Groups(['tarea:read', 'tarea:write', 'imparticion:read'])]
    private ?string $descripcion = null;

    #[ORM\Column(length: 255, nullable: true)]
    #[Assert\Length(max: 255)]
    #[Groups(['tarea:read', 'tarea:write', 'imparticion:read', 'entrega:read'])]
    private ?string $archivo = null;

    #[ORM\Column(type: Types::DATETIME_MUTABLE)]
    #[Assert\NotBlank]
    #[Groups(['tarea:read', 'tarea:write', 'imparticion:read', 'entrega:read'])]
    private ?\DateTimeInterface $fechaLimite = null;

    #[ORM\Column(type: Types::DATETIME_MUTABLE, nullable: true)]
    #[Groups(['tarea:read', 'tarea:write', 'imparticion:read'])]
    private ?\DateTimeInterface $fechaInicio = null;

    #[ORM\Column(type: 'boolean')]
    #[Assert\NotNull]
    #[Groups(['tarea:read', 'tarea:write', 'imparticion:read'])]
    private bool $visible = true;

    #[ORM\Column(length: 20)]
    #[Assert\NotBlank]
    #[Assert\Choice(choices: ['examen', 'tarea', 'practica'], message: 'El tipo debe ser examen, tarea o practica.')]
    #[Groups(['tarea:read', 'tarea:write', 'imparticion:read', 'entrega:read'])]
    private ?string $tipo = null;

    #[ORM\Column(type: Types::FLOAT, nullable: true)]
    #[Assert\Range(min: 0, max: 1, notInRangeMessage: 'El peso debe estar entre 0 y 1.')]
    #[Groups(['tarea:read', 'tarea:write', 'imparticion:read', 'entrega:read'])]
    private ?float $peso = null;

    #[ORM\Column(type: 'boolean', options: ['default' => true])]
    #[Assert\NotNull]
    #[Groups(['tarea:read', 'tarea:write', 'imparticion:read', 'entrega:read'])]
    private bool $obligatoria = true;

    #[ORM\Column(type: Types::FLOAT, nullable: true)]
    #[Assert\Range(min: 0, max: 10, notInRangeMessage: 'La nota mínima debe estar entre 0 y 10.')]
    #[Groups(['tarea:read', 'tarea:write', 'imparticion:read', 'entrega:read'])]
    private ?float $notaMinima = null;

    #[ORM\ManyToOne(inversedBy: 'tareas')]
    #[ORM\JoinColumn(nullable: false)]
    #[Assert\NotNull]
    #[Groups(['tarea:read', 'tarea:write'])]
    private ?Imparticion $imparticion = null;

    /**
     * Si esta tarea es una recuperación / subida de nota, referencia a la tarea original.
     * Su calificación sustituye (o mejora) la de la original en el cálculo de la media.
     */
    #[ORM\ManyToOne(targetEntity: Tarea::class)]
    #[ORM\JoinColumn(name: 'tarea_original_id', referencedColumnName: 'id', nullable: true, onDelete: 'SET NULL')]
    #[Groups(['tarea:read', 'tarea:write', 'imparticion:read', 'entrega:read'])]
    private ?Tarea $tareaOriginal = null;

    #[ORM\OneToMany(mappedBy: 'tarea', targetEntity: Entrega::class)]
    // NO serializar aquí: filtraría las entregas de todos los alumnos a cualquiera con acceso a la tarea.
    // El profesor obtiene la lista vía GET /api/entregas?tarea={id}.
    private Collection $entregas;

    public function __construct()
    {
        $this->entregas = new ArrayCollection();
    }

    public function getId(): ?int
    {
        return $this->id;
    }

    public function getTitulo(): ?string
    {
        return $this->titulo;
    }

    public function setTitulo(string $titulo): static
    {
        $this->titulo = $titulo;
        return $this;
    }

    public function getDescripcion(): ?string
    {
        return $this->descripcion;
    }

    public function setDescripcion(?string $descripcion): static
    {
        $this->descripcion = $descripcion;
        return $this;
    }

    public function getArchivo(): ?string
    {
        return $this->archivo;
    }

    public function setArchivo(?string $archivo): static
    {
        $this->archivo = $archivo;
        return $this;
    }

    public function getFechaLimite(): ?\DateTimeInterface
    {
        return $this->fechaLimite;
    }

    public function setFechaLimite(\DateTimeInterface $fechaLimite): static
    {
        $this->fechaLimite = $fechaLimite;
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

    public function isVisible(): bool
    {
        return $this->visible;
    }

    public function setVisible(bool $visible): static
    {
        $this->visible = $visible;
        return $this;
    }

    public function getTipo(): ?string
    {
        return $this->tipo;
    }

    public function setTipo(string $tipo): static
    {
        $this->tipo = $tipo;
        return $this;
    }

    public function getPeso(): ?float
    {
        return $this->peso;
    }

    public function setPeso(?float $peso): static
    {
        $this->peso = $peso;
        return $this;
    }

    public function isObligatoria(): bool
    {
        return $this->obligatoria;
    }

    public function setObligatoria(bool $obligatoria): static
    {
        $this->obligatoria = $obligatoria;
        return $this;
    }

    public function getNotaMinima(): ?float
    {
        return $this->notaMinima;
    }

    public function setNotaMinima(?float $notaMinima): static
    {
        $this->notaMinima = $notaMinima;
        return $this;
    }

    public function getImparticion(): ?Imparticion
    {
        return $this->imparticion;
    }

    public function setImparticion(?Imparticion $imparticion): static
    {
        $this->imparticion = $imparticion;
        return $this;
    }

    public function getTareaOriginal(): ?Tarea
    {
        return $this->tareaOriginal;
    }

    public function setTareaOriginal(?Tarea $tareaOriginal): static
    {
        $this->tareaOriginal = $tareaOriginal;
        return $this;
    }

    /**
     * @return Collection<int, Entrega>
     */
    public function getEntregas(): Collection
    {
        return $this->entregas;
    }

    public function addEntrega(Entrega $entrega): static
    {
        if (!$this->entregas->contains($entrega)) {
            $this->entregas->add($entrega);
            $entrega->setTarea($this);
        }

        return $this;
    }

    public function removeEntrega(Entrega $entrega): static
    {
        if ($this->entregas->removeElement($entrega)) {
            // set the owning side to null (unless already changed)
            if ($entrega->getTarea() === $this) {
                $entrega->setTarea(null);
            }
        }

        return $this;
    }
}
