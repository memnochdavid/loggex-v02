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
use App\Entity\Traits\SoftDeletableTrait;
use App\Entity\Traits\TimestampableTrait;
use App\Repository\EntregaRepository;
use App\State\SoftDeleteProcessor;
use Doctrine\DBAL\Types\Types;
use Doctrine\ORM\Mapping as ORM;
use Symfony\Component\Serializer\Attribute\Groups;

#[ORM\Entity(repositoryClass: EntregaRepository::class)]
#[ORM\Table(name: 'entrega')]
#[ORM\HasLifecycleCallbacks]
#[ApiResource(
    operations: [
        new Get(),
        new GetCollection(),
        new Post(),
        new Put(),
        new Delete(processor: SoftDeleteProcessor::class)
    ],
    normalizationContext: ['groups' => ['entrega:read', 'timestamp:read', 'softdelete:read']],
    denormalizationContext: ['groups' => ['entrega:write']]
)]
#[ApiFilter(SearchFilter::class, properties: ['alumno' => 'exact', 'tarea' => 'exact'])]
#[ApiFilter(OrderFilter::class, properties: ['fechaEntrega', 'id'], arguments: ['orderParameterName' => 'order'])]
class Entrega
{
    use TimestampableTrait;
    use SoftDeletableTrait;

    #[ORM\Id]
    #[ORM\GeneratedValue]
    #[ORM\Column]
    #[Groups(['entrega:read', 'tarea:read'])] // Añadido tarea:read
    private ?int $id = null;

    #[ORM\Column(type: Types::DATETIME_MUTABLE)]
    #[Groups(['entrega:read', 'entrega:write', 'tarea:read'])] // Añadido tarea:read
    private ?\DateTimeInterface $fechaEntrega = null;

    #[ORM\Column(type: Types::TEXT, nullable: true)]
    #[Groups(['entrega:read', 'entrega:write', 'tarea:read'])] // Añadido tarea:read
    private ?string $enlace = null;

    #[ORM\Column(length: 255, nullable: true)]
    #[Groups(['entrega:read', 'entrega:write', 'tarea:read'])] // Añadido tarea:read
    private ?string $archivo = null;

    #[ORM\Column(type: Types::TEXT, nullable: true)]
    #[Groups(['entrega:read', 'entrega:write', 'tarea:read'])] // Añadido tarea:read
    private ?string $comentarioAlumno = null;

    #[ORM\ManyToOne(inversedBy: 'entregas')]
    #[ORM\JoinColumn(nullable: false)]
    #[Groups(['entrega:read', 'entrega:write'])]
    private ?Tarea $tarea = null;

    #[ORM\ManyToOne(inversedBy: 'entregas')]
    #[ORM\JoinColumn(nullable: false)]
    #[Groups(['entrega:read', 'entrega:write', 'tarea:read'])] // Añadido tarea:read
    private ?User $alumno = null;

    #[ORM\OneToOne(mappedBy: 'entrega', cascade: ['persist', 'remove'])]
    #[Groups(['entrega:read', 'tarea:read'])] // Añadido tarea:read
    private ?Calificacion $calificacion = null;

    public function getId(): ?int
    {
        return $this->id;
    }

    public function getFechaEntrega(): ?\DateTimeInterface
    {
        return $this->fechaEntrega;
    }

    public function setFechaEntrega(\DateTimeInterface $fechaEntrega): static
    {
        $this->fechaEntrega = $fechaEntrega;
        return $this;
    }

    public function getEnlace(): ?string
    {
        return $this->enlace;
    }

    public function setEnlace(?string $enlace): static
    {
        $this->enlace = $enlace;
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

    public function getComentarioAlumno(): ?string
    {
        return $this->comentarioAlumno;
    }

    public function setComentarioAlumno(?string $comentarioAlumno): static
    {
        $this->comentarioAlumno = $comentarioAlumno;
        return $this;
    }

    public function getTarea(): ?Tarea
    {
        return $this->tarea;
    }

    public function setTarea(?Tarea $tarea): static
    {
        $this->tarea = $tarea;
        return $this;
    }

    public function getAlumno(): ?User
    {
        return $this->alumno;
    }

    public function setAlumno(?User $alumno): static
    {
        $this->alumno = $alumno;
        return $this;
    }

    public function getCalificacion(): ?Calificacion
    {
        return $this->calificacion;
    }

    public function setCalificacion(Calificacion $calificacion): static
    {
        // set the owning side of the relation if necessary
        if ($calificacion->getEntrega() !== $this) {
            $calificacion->setEntrega($this);
        }

        $this->calificacion = $calificacion;

        return $this;
    }
}
