<?php

namespace App\Entity;

use ApiPlatform\Metadata\ApiResource;
use App\Repository\MaterialRepository;
use Doctrine\DBAL\Types\Types;
use Doctrine\ORM\Mapping as ORM;
use Symfony\Component\Serializer\Attribute\Groups;

#[ORM\Entity(repositoryClass: MaterialRepository::class)]
#[ORM\Table(name: 'material')]
#[ApiResource(
    normalizationContext: ['groups' => ['material:read']],
    denormalizationContext: ['groups' => ['material:write']]
)]
class Material
{
    #[ORM\Id]
    #[ORM\GeneratedValue]
    #[ORM\Column]
    #[Groups(['material:read'])]
    private ?int $id = null;

    #[ORM\Column(length: 255)]
    #[Groups(['material:read', 'material:write'])]
    private ?string $titulo = null;

    #[ORM\Column(length: 255)]
    #[Groups(['material:read', 'material:write'])]
    private ?string $archivo = null;

    #[ORM\Column(type: Types::DATETIME_MUTABLE)]
    #[Groups(['material:read', 'material:write'])]
    private ?\DateTimeInterface $fechaSubida = null;

    #[ORM\ManyToOne]
    #[ORM\JoinColumn(nullable: false)]
    #[Groups(['material:read', 'material:write'])]
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

    public function getArchivo(): ?string
    {
        return $this->archivo;
    }

    public function setArchivo(string $archivo): static
    {
        $this->archivo = $archivo;
        return $this;
    }

    public function getFechaSubida(): ?\DateTimeInterface
    {
        return $this->fechaSubida;
    }

    public function setFechaSubida(\DateTimeInterface $fechaSubida): static
    {
        $this->fechaSubida = $fechaSubida;
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
