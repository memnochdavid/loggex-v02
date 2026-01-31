<?php

namespace App\Entity;

use ApiPlatform\Metadata\ApiResource;
use App\Repository\FestivoRepository;
use Doctrine\DBAL\Types\Types;
use Doctrine\ORM\Mapping as ORM;
use Symfony\Component\Serializer\Attribute\Groups;

#[ORM\Entity(repositoryClass: FestivoRepository::class)]
#[ORM\Table(name: 'festivo')]
#[ApiResource(
    normalizationContext: ['groups' => ['festivo:read']],
    denormalizationContext: ['groups' => ['festivo:write']]
)]
class Festivo
{
    #[ORM\Id]
    #[ORM\GeneratedValue]
    #[ORM\Column]
    #[Groups(['festivo:read'])]
    private ?int $id = null;

    #[ORM\Column(length: 255)]
    #[Groups(['festivo:read', 'festivo:write'])]
    private ?string $nombre = null;

    #[ORM\Column(type: Types::DATE_MUTABLE)]
    #[Groups(['festivo:read', 'festivo:write'])]
    private ?\DateTimeInterface $fechaInicio = null;

    #[ORM\Column(type: Types::DATE_MUTABLE, nullable: true)]
    #[Groups(['festivo:read', 'festivo:write'])]
    private ?\DateTimeInterface $fechaFin = null;

    #[ORM\ManyToOne]
    #[Groups(['festivo:read', 'festivo:write'])]
    private ?Centro $centro = null;

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

    public function getFechaInicio(): ?\DateTimeInterface
    {
        return $this->fechaInicio;
    }

    public function setFechaInicio(\DateTimeInterface $fechaInicio): static
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

    public function getCentro(): ?Centro
    {
        return $this->centro;
    }

    public function setCentro(?Centro $centro): static
    {
        $this->centro = $centro;
        return $this;
    }
}
