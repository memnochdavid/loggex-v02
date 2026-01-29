<?php

namespace App\Entity;

use ApiPlatform\Metadata\ApiResource;
use App\Repository\CicloFormativoRepository;
use Doctrine\ORM\Mapping as ORM;
use Symfony\Component\Serializer\Annotation\Groups;

#[ORM\Entity(repositoryClass: CicloFormativoRepository::class)]
#[ORM\Table(name: 'ciclo_formativo')]
#[ApiResource(
    normalizationContext: ['groups' => ['ciclo:read']],
    denormalizationContext: ['groups' => ['ciclo:write']]
)]
class CicloFormativo
{
    #[ORM\Id]
    #[ORM\GeneratedValue]
    #[ORM\Column]
    #[Groups(['ciclo:read'])]
    private ?int $id = null;

    #[ORM\Column(length: 255)]
    #[Groups(['ciclo:read', 'ciclo:write'])]
    private ?string $nombre = null;

    #[ORM\Column(length: 50)]
    #[Groups(['ciclo:read', 'ciclo:write'])]
    private ?string $nivel = null;

    #[ORM\ManyToOne(inversedBy: 'ciclos')]
    #[ORM\JoinColumn(nullable: false)]
    #[Groups(['ciclo:read', 'ciclo:write'])]
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
}
