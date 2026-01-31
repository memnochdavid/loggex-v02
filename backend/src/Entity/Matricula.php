<?php

namespace App\Entity;

use ApiPlatform\Metadata\ApiResource;
use App\Repository\MatriculaRepository;
use Doctrine\ORM\Mapping as ORM;
use Symfony\Component\Serializer\Attribute\Groups;

#[ORM\Entity(repositoryClass: MatriculaRepository::class)]
#[ORM\Table(name: 'matricula')]
#[ApiResource(
    normalizationContext: ['groups' => ['matricula:read']],
    denormalizationContext: ['groups' => ['matricula:write']]
)]
class Matricula
{
    #[ORM\Id]
    #[ORM\GeneratedValue]
    #[ORM\Column]
    #[Groups(['matricula:read'])]
    private ?int $id = null;

    #[ORM\ManyToOne]
    #[ORM\JoinColumn(nullable: false)]
    #[Groups(['matricula:read', 'matricula:write'])]
    private ?User $alumno = null;

    #[ORM\ManyToOne]
    #[ORM\JoinColumn(nullable: false)]
    #[Groups(['matricula:read', 'matricula:write'])]
    private ?Grupo $grupo = null;

    public function getId(): ?int
    {
        return $this->id;
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

    public function getGrupo(): ?Grupo
    {
        return $this->grupo;
    }

    public function setGrupo(?Grupo $grupo): static
    {
        $this->grupo = $grupo;
        return $this;
    }
}
