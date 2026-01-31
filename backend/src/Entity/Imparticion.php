<?php

namespace App\Entity;

use ApiPlatform\Metadata\ApiResource;
use ApiPlatform\Metadata\Delete;
use ApiPlatform\Metadata\Get;
use ApiPlatform\Metadata\GetCollection;
use ApiPlatform\Metadata\Post;
use ApiPlatform\Metadata\Put;
use App\Entity\Traits\SoftDeletableTrait;
use App\Entity\Traits\TimestampableTrait;
use App\Repository\ImparticionRepository;
use App\State\SoftDeleteProcessor;
use Doctrine\Common\Collections\ArrayCollection;
use Doctrine\Common\Collections\Collection;
use Doctrine\ORM\Mapping as ORM;
use Symfony\Component\Serializer\Attribute\Groups;

#[ORM\Entity(repositoryClass: ImparticionRepository::class)]
#[ORM\Table(name: 'imparticion')]
#[ORM\HasLifecycleCallbacks]
#[ApiResource(
    operations: [
        new Get(),
        new GetCollection(),
        new Post(),
        new Put(),
        new Delete(processor: SoftDeleteProcessor::class)
    ],
    normalizationContext: ['groups' => ['imparticion:read', 'timestamp:read', 'softdelete:read']],
    denormalizationContext: ['groups' => ['imparticion:write']]
)]
class Imparticion
{
    use TimestampableTrait;
    use SoftDeletableTrait;

    #[ORM\Id]
    #[ORM\GeneratedValue]
    #[ORM\Column]
    #[Groups(['imparticion:read'])]
    private ?int $id = null;

    #[ORM\ManyToOne(inversedBy: 'imparticiones')]
    #[ORM\JoinColumn(nullable: false)]
    #[Groups(['imparticion:read', 'imparticion:write'])]
    private ?User $profesor = null;

    #[ORM\ManyToOne(inversedBy: 'imparticiones')]
    #[ORM\JoinColumn(nullable: false)]
    #[Groups(['imparticion:read', 'imparticion:write'])]
    private ?Modulo $modulo = null;

    #[ORM\ManyToOne(inversedBy: 'imparticiones')]
    #[ORM\JoinColumn(nullable: false)]
    #[Groups(['imparticion:read', 'imparticion:write'])]
    private ?Grupo $grupo = null;

    #[ORM\OneToMany(mappedBy: 'imparticion', targetEntity: Horario::class)]
    private Collection $horarios;

    #[ORM\OneToMany(mappedBy: 'imparticion', targetEntity: Tarea::class)]
    private Collection $tareas;

    #[ORM\OneToMany(mappedBy: 'imparticion', targetEntity: Material::class)]
    private Collection $materiales;

    #[ORM\OneToMany(mappedBy: 'imparticion', targetEntity: Asistencia::class)]
    private Collection $asistencias;

    public function __construct()
    {
        $this->horarios = new ArrayCollection();
        $this->tareas = new ArrayCollection();
        $this->materiales = new ArrayCollection();
        $this->asistencias = new ArrayCollection();
    }

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
