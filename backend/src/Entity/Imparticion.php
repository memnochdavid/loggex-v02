<?php

namespace App\Entity;

use ApiPlatform\Metadata\ApiResource;
use App\Repository\ImparticionRepository;
use Doctrine\ORM\Mapping as ORM;
use Symfony\Component\Serializer\Attribute\Groups;

#[ORM\Entity(repositoryClass: ImparticionRepository::class)]
#[ORM\Table(name: 'imparticion')]
#[ApiResource(
    normalizationContext: ['groups' => ['imparticion:read']],
    denormalizationContext: ['groups' => ['imparticion:write']]
)]
class Imparticion
{
    #[ORM\Id]
    #[ORM\GeneratedValue]
    #[ORM\Column]
    #[Groups(['imparticion:read'])]
    private ?int $id = null;

    #[ORM\ManyToOne]
    #[ORM\JoinColumn(nullable: false)]
    #[Groups(['imparticion:read', 'imparticion:write'])]
    private ?User $profesor = null;

    #[ORM\ManyToOne]
    #[ORM\JoinColumn(nullable: false)]
    #[Groups(['imparticion:read', 'imparticion:write'])]
    private ?Modulo $modulo = null;

    #[ORM\ManyToOne]
    #[ORM\JoinColumn(nullable: false)]
    #[Groups(['imparticion:read', 'imparticion:write'])]
    private ?Grupo $grupo = null;

    public function getId(): ?int
    {
        return $this->id;
    }

    public function getProfesor(): ?User
    {
        return $this->profesor;
    }

    public function setProfesor(?User $profesor): static
    {
        $this->profesor = $profesor;
        return $this;
    }

    public function getModulo(): ?Modulo
    {
        return $this->modulo;
    }

    public function setModulo(?Modulo $modulo): static
    {
        $this->modulo = $modulo;
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
