<?php

namespace App\Entity;

use ApiPlatform\Doctrine\Orm\Filter\OrderFilter;
use ApiPlatform\Doctrine\Orm\Filter\SearchFilter;
use ApiPlatform\Metadata\ApiFilter;
use ApiPlatform\Metadata\ApiResource;
use ApiPlatform\Metadata\Delete;
use ApiPlatform\Metadata\Get;
use ApiPlatform\Metadata\GetCollection;
use ApiPlatform\Metadata\Post;
use ApiPlatform\Metadata\Put;
use App\Doctrine\Filter\SearchAnyFilter;
use App\Entity\Traits\SoftDeletableTrait;
use App\Entity\Traits\TimestampableTrait;
use App\Repository\CicloFormativoRepository;
use App\State\SoftDeleteProcessor;
use Doctrine\Common\Collections\ArrayCollection;
use Doctrine\Common\Collections\Collection;
use Doctrine\ORM\Mapping as ORM;
use Symfony\Component\Serializer\Attribute\Groups;

#[ORM\Entity(repositoryClass: CicloFormativoRepository::class)]
#[ORM\Table(name: 'ciclo_formativo')]
#[ORM\HasLifecycleCallbacks]
#[ApiResource(
    operations: [
        new Get(),
        new GetCollection(),
        new Post(),
        new Put(),
        new Delete(processor: SoftDeleteProcessor::class)
    ],
    normalizationContext: ['groups' => ['ciclo:read', 'timestamp:read', 'softdelete:read']],
    denormalizationContext: ['groups' => ['ciclo:write']]
)]
#[ApiFilter(SearchFilter::class, properties: [
    'nombre' => 'partial',
    'nivel' => 'exact',
    'centro' => 'exact'
])]
#[ApiFilter(SearchAnyFilter::class, properties: ['nombre'])]
#[ApiFilter(OrderFilter::class, properties: ['nombre', 'nivel', 'id'], arguments: ['orderParameterName' => 'order'])]
class CicloFormativo
{
    use TimestampableTrait;
    use SoftDeletableTrait;

    #[ORM\Id]
    #[ORM\GeneratedValue]
    #[ORM\Column]
    #[Groups(['ciclo:read', 'modulo:read', 'grupo:read', 'matricula:read'])] // Añadido matricula:read
    private ?int $id = null;

    #[ORM\Column(length: 255)]
    #[Groups(['ciclo:read', 'ciclo:write', 'modulo:read', 'grupo:read', 'matricula:read'])] // Añadido matricula:read
    private ?string $nombre = null;

    #[ORM\Column(length: 50)]
    #[Groups(['ciclo:read', 'ciclo:write', 'modulo:read'])]
    private ?string $nivel = null;

    #[ORM\ManyToOne(inversedBy: 'ciclos')]
    #[ORM\JoinColumn(nullable: false)]
    #[Groups(['ciclo:read', 'ciclo:write'])]
    private ?Centro $centro = null;

    #[ORM\OneToMany(mappedBy: 'ciclo', targetEntity: Modulo::class)]
    private Collection $modulos;

    #[ORM\OneToMany(mappedBy: 'ciclo', targetEntity: Grupo::class)]
    private Collection $grupos;

    public function __construct()
    {
        $this->modulos = new ArrayCollection();
        $this->grupos = new ArrayCollection();
    }

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

    /**
     * @return Collection<int, Modulo>
     */
    public function getModulos(): Collection
    {
        return $this->modulos;
    }

    public function addModulo(Modulo $modulo): static
    {
        if (!$this->modulos->contains($modulo)) {
            $this->modulos->add($modulo);
            $modulo->setCiclo($this);
        }

        return $this;
    }

    public function removeModulo(Modulo $modulo): static
    {
        if ($this->modulos->removeElement($modulo)) {
            if ($modulo->getCiclo() === $this) {
                $modulo->setCiclo(null);
            }
        }

        return $this;
    }

    /**
     * @return Collection<int, Grupo>
     */
    public function getGrupos(): Collection
    {
        return $this->grupos;
    }

    public function addGrupo(Grupo $grupo): static
    {
        if (!$this->grupos->contains($grupo)) {
            $this->grupos->add($grupo);
            $grupo->setCiclo($this);
        }

        return $this;
    }

    public function removeGrupo(Grupo $grupo): static
    {
        if ($this->grupos->removeElement($grupo)) {
            if ($grupo->getCiclo() === $this) {
                $grupo->setCiclo(null);
            }
        }

        return $this;
    }
}
