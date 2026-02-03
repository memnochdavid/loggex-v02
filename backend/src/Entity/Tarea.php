<?php

namespace App\Entity;

use ApiPlatform\Metadata\ApiResource;
use ApiPlatform\Metadata\Delete;
use ApiPlatform\Metadata\Get;
use ApiPlatform\Metadata\GetCollection;
use ApiPlatform\Metadata\Post;
use ApiPlatform\Metadata\Put;
use App\Entity\Traits\SoftDeletableTrait;
use App\Entity\Traits\TimestampableTrait;
use App\Repository\TareaRepository;
use App\State\SoftDeleteProcessor;
use Doctrine\Common\Collections\ArrayCollection;
use Doctrine\Common\Collections\Collection;
use Doctrine\DBAL\Types\Types;
use Doctrine\ORM\Mapping as ORM;
use Symfony\Component\Serializer\Attribute\Groups;

#[ORM\Entity(repositoryClass: TareaRepository::class)]
#[ORM\Table(name: 'tarea')]
#[ORM\HasLifecycleCallbacks]
#[ApiResource(
    operations: [
        new Get(),
        new GetCollection(),
        new Post(),
        new Put(),
        new Delete(processor: SoftDeleteProcessor::class)
    ],
    normalizationContext: ['groups' => ['tarea:read', 'timestamp:read', 'softdelete:read']],
    denormalizationContext: ['groups' => ['tarea:write']]
)]
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
    #[Groups(['tarea:read', 'tarea:write', 'imparticion:read', 'entrega:read'])]
    private ?string $titulo = null;

    #[ORM\Column(type: Types::TEXT, nullable: true)]
    #[Groups(['tarea:read', 'tarea:write', 'imparticion:read'])]
    private ?string $descripcion = null;

    #[ORM\Column(length: 255, nullable: true)]
    #[Groups(['tarea:read', 'tarea:write', 'imparticion:read', 'entrega:read'])]
    private ?string $archivo = null;

    #[ORM\Column(type: Types::DATETIME_MUTABLE)]
    #[Groups(['tarea:read', 'tarea:write', 'imparticion:read', 'entrega:read'])]
    private ?\DateTimeInterface $fechaLimite = null;

    #[ORM\Column(type: Types::DATETIME_MUTABLE, nullable: true)]
    #[Groups(['tarea:read', 'tarea:write', 'imparticion:read'])]
    private ?\DateTimeInterface $fechaInicio = null;

    #[ORM\Column(type: 'boolean')]
    #[Groups(['tarea:read', 'tarea:write', 'imparticion:read'])]
    private bool $visible = true;

    #[ORM\Column(length: 20)]
    #[Groups(['tarea:read', 'tarea:write', 'imparticion:read', 'entrega:read'])]
    private ?string $tipo = null;

    #[ORM\ManyToOne(inversedBy: 'tareas')]
    #[ORM\JoinColumn(nullable: false)]
    #[Groups(['tarea:read', 'tarea:write'])]
    private ?Imparticion $imparticion = null;

    #[ORM\OneToMany(mappedBy: 'tarea', targetEntity: Entrega::class)]
    #[Groups(['tarea:read'])] // Añadido para que el profesor pueda ver las entregas
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

    public function getImparticion(): ?Imparticion
    {
        return $this->imparticion;
    }

    public function setImparticion(?Imparticion $imparticion): static
    {
        $this->imparticion = $imparticion;
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
