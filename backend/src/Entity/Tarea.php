<?php

namespace App\Entity;

use ApiPlatform\Metadata\ApiResource;
use App\Repository\TareaRepository;
use Doctrine\DBAL\Types\Types;
use Doctrine\ORM\Mapping as ORM;
use Symfony\Component\Serializer\Attribute\Groups;

#[ORM\Entity(repositoryClass: TareaRepository::class)]
#[ORM\Table(name: 'tarea')]
#[ApiResource(
    normalizationContext: ['groups' => ['tarea:read']],
    denormalizationContext: ['groups' => ['tarea:write']]
)]
class Tarea
{
    #[ORM\Id]
    #[ORM\GeneratedValue]
    #[ORM\Column]
    #[Groups(['tarea:read'])]
    private ?int $id = null;

    #[ORM\Column(length: 255)]
    #[Groups(['tarea:read', 'tarea:write'])]
    private ?string $titulo = null;

    #[ORM\Column(type: Types::TEXT, nullable: true)]
    #[Groups(['tarea:read', 'tarea:write'])]
    private ?string $descripcion = null;

    #[ORM\Column(type: Types::DATETIME_MUTABLE)]
    #[Groups(['tarea:read', 'tarea:write'])]
    private ?\DateTimeInterface $fechaLimite = null;

    #[ORM\Column(type: 'boolean')]
    #[Groups(['tarea:read', 'tarea:write'])]
    private bool $visible = true;

    #[ORM\Column(type: Types::DATETIME_MUTABLE, nullable: true)]
    #[Groups(['tarea:read', 'tarea:write'])]
    private ?\DateTimeInterface $fechaInicio = null;

    #[ORM\Column(length: 20)]
    #[Groups(['tarea:read', 'tarea:write'])]
    private ?string $tipo = null;

    #[ORM\ManyToOne]
    #[ORM\JoinColumn(nullable: false)]
    #[Groups(['tarea:read', 'tarea:write'])]
    private ?Imparticion $imparticion = null;

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

    public function getFechaLimite(): ?\DateTimeInterface
    {
        return $this->fechaLimite;
    }

    public function setFechaLimite(\DateTimeInterface $fechaLimite): static
    {
        $this->fechaLimite = $fechaLimite;
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

    public function getFechaInicio(): ?\DateTimeInterface
    {
        return $this->fechaInicio;
    }

    public function setFechaInicio(?\DateTimeInterface $fechaInicio): static
    {
        $this->fechaInicio = $fechaInicio;
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
}
