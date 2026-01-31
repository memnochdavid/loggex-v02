<?php

namespace App\Entity;

use ApiPlatform\Metadata\ApiResource;
use App\Repository\GrupoRepository;
use Doctrine\ORM\Mapping as ORM;
use Symfony\Component\Serializer\Attribute\Groups;

#[ORM\Entity(repositoryClass: GrupoRepository::class)]
#[ORM\Table(name: 'grupo')]
#[ApiResource(
    normalizationContext: ['groups' => ['grupo:read']],
    denormalizationContext: ['groups' => ['grupo:write']]
)]
class Grupo
{
    #[ORM\Id]
    #[ORM\GeneratedValue]
    #[ORM\Column]
    #[Groups(['grupo:read'])]
    private ?int $id = null;

    #[ORM\Column(length: 50)]
    #[Groups(['grupo:read', 'grupo:write'])]
    private ?string $nombre = null;

    #[ORM\Column(length: 20)]
    #[Groups(['grupo:read', 'grupo:write'])]
    private ?string $anioEscolar = null;

    #[ORM\Column]
    #[Groups(['grupo:read', 'grupo:write'])]
    private ?int $curso = null;

    #[ORM\Column(length: 20, nullable: true)]
    #[Groups(['grupo:read', 'grupo:write'])]
    private ?string $abreviatura = null;

    #[ORM\ManyToOne]
    #[ORM\JoinColumn(nullable: false)]
    #[Groups(['grupo:read', 'grupo:write'])]
    private ?CicloFormativo $ciclo = null;

    #[ORM\ManyToOne]
    #[ORM\JoinColumn(nullable: false)]
    #[Groups(['grupo:read', 'grupo:write'])]
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

    public function getAnioEscolar(): ?string
    {
        return $this->anioEscolar;
    }

    public function setAnioEscolar(string $anioEscolar): static
    {
        $this->anioEscolar = $anioEscolar;
        return $this;
    }

    public function getCurso(): ?int
    {
        return $this->curso;
    }

    public function setCurso(int $curso): static
    {
        $this->curso = $curso;
        return $this;
    }

    public function getAbreviatura(): ?string
    {
        return $this->abreviatura;
    }

    public function setAbreviatura(?string $abreviatura): static
    {
        $this->abreviatura = $abreviatura;
        return $this;
    }

    public function getCiclo(): ?CicloFormativo
    {
        return $this->ciclo;
    }

    public function setCiclo(?CicloFormativo $ciclo): static
    {
        $this->ciclo = $ciclo;
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
