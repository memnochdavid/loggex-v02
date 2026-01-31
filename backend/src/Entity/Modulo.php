<?php

namespace App\Entity;

use ApiPlatform\Metadata\ApiResource;
use App\Repository\ModuloRepository;
use Doctrine\ORM\Mapping as ORM;
use Symfony\Component\Serializer\Attribute\Groups;

#[ORM\Entity(repositoryClass: ModuloRepository::class)]
#[ORM\Table(name: 'modulo')]
#[ApiResource(
    normalizationContext: ['groups' => ['modulo:read']],
    denormalizationContext: ['groups' => ['modulo:write']]
)]
class Modulo
{
    #[ORM\Id]
    #[ORM\GeneratedValue]
    #[ORM\Column]
    #[Groups(['modulo:read'])]
    private ?int $id = null;

    #[ORM\Column(length: 255)]
    #[Groups(['modulo:read', 'modulo:write'])]
    private ?string $nombre = null;

    #[ORM\Column(length: 50, nullable: true)]
    #[Groups(['modulo:read', 'modulo:write'])]
    private ?string $codigoOficial = null;

    #[ORM\Column]
    #[Groups(['modulo:read', 'modulo:write'])]
    private ?int $curso = null;

    #[ORM\Column]
    #[Groups(['modulo:read', 'modulo:write'])]
    private ?int $horasSemanales = null;

    #[ORM\ManyToOne]
    #[ORM\JoinColumn(nullable: false)]
    #[Groups(['modulo:read', 'modulo:write'])]
    private ?CicloFormativo $ciclo = null;

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

    public function getCodigoOficial(): ?string
    {
        return $this->codigoOficial;
    }

    public function setCodigoOficial(?string $codigoOficial): static
    {
        $this->codigoOficial = $codigoOficial;
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

    public function getHorasSemanales(): ?int
    {
        return $this->horasSemanales;
    }

    public function setHorasSemanales(int $horasSemanales): static
    {
        $this->horasSemanales = $horasSemanales;
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
}
