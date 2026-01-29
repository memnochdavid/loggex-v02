<?php

namespace App\Entity;

use ApiPlatform\Metadata\ApiResource;
use App\Repository\EntregaRepository;
use Doctrine\DBAL\Types\Types;
use Doctrine\ORM\Mapping as ORM;
use Symfony\Component\Serializer\Annotation\Groups;

#[ORM\Entity(repositoryClass: EntregaRepository::class)]
#[ORM\Table(name: 'entrega')]
#[ApiResource(
    normalizationContext: ['groups' => ['entrega:read']],
    denormalizationContext: ['groups' => ['entrega:write']]
)]
class Entrega
{
    #[ORM\Id]
    #[ORM\GeneratedValue]
    #[ORM\Column]
    #[Groups(['entrega:read'])]
    private ?int $id = null;

    #[ORM\Column(type: Types::DATETIME_MUTABLE)]
    #[Groups(['entrega:read', 'entrega:write'])]
    private ?\DateTimeInterface $fechaEntrega = null;

    #[ORM\Column(type: Types::TEXT, nullable: true)]
    #[Groups(['entrega:read', 'entrega:write'])]
    private ?string $comentarioAlumno = null;

    #[ORM\Column(type: Types::TEXT, nullable: true)]
    #[Groups(['entrega:read', 'entrega:write'])]
    private ?string $enlace = null;

    #[ORM\ManyToOne]
    #[ORM\JoinColumn(nullable: false)]
    #[Groups(['entrega:read', 'entrega:write'])]
    private ?Tarea $tarea = null;

    #[ORM\ManyToOne]
    #[ORM\JoinColumn(nullable: false)]
    #[Groups(['entrega:read', 'entrega:write'])]
    private ?User $alumno = null;

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

    public function getComentarioAlumno(): ?string
    {
        return $this->comentarioAlumno;
    }

    public function setComentarioAlumno(?string $comentarioAlumno): static
    {
        $this->comentarioAlumno = $comentarioAlumno;
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
}
