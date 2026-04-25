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
use App\Repository\CentroRepository;
use App\State\SoftDeleteProcessor;
use Doctrine\Common\Collections\ArrayCollection;
use Doctrine\Common\Collections\Collection;
use Doctrine\ORM\Mapping as ORM;
use Symfony\Component\Serializer\Attribute\Groups;

#[ORM\Entity(repositoryClass: CentroRepository::class)]
#[ORM\Table(name: 'centro')]
#[ORM\HasLifecycleCallbacks]
#[ApiResource(
    operations: [
        new Get(),
        new GetCollection(),
        new Post(),
        new Put(),
        new Delete(processor: SoftDeleteProcessor::class)
    ],
    normalizationContext: ['groups' => ['centro:read', 'timestamp:read', 'softdelete:read']],
    denormalizationContext: ['groups' => ['centro:write']]
)]
#[ApiFilter(SearchFilter::class, properties: ['nombre' => 'partial', 'cif' => 'partial', 'direccion' => 'partial'])]
#[ApiFilter(SearchAnyFilter::class, properties: ['nombre', 'cif', 'direccion'])]
#[ApiFilter(OrderFilter::class, properties: ['nombre', 'cif', 'activo', 'id'], arguments: ['orderParameterName' => 'order'])]
class Centro
{
    use TimestampableTrait;
    use SoftDeletableTrait;

    #[ORM\Id]
    #[ORM\GeneratedValue]
    #[ORM\Column]
    #[Groups(['centro:read', 'user:read', 'grupo:read', 'festivo:read', 'tema:read', 'comunicado:read'])] // Añadido comunicado:read
    private ?int $id = null;

    #[ORM\Column(length: 255)]
    #[Groups(['centro:read', 'centro:write', 'user:read', 'grupo:read', 'festivo:read', 'tema:read', 'comunicado:read'])] // Añadido comunicado:read
    private ?string $nombre = null;

    #[ORM\Column(length: 20)]
    #[Groups(['centro:read', 'centro:write'])]
    private ?string $cif = null;

    #[ORM\Column(type: 'boolean')]
    #[Groups(['centro:read', 'centro:write'])]
    private bool $activo = true;

    #[ORM\Column(length: 255, nullable: true)]
    #[Groups(['centro:read', 'centro:write'])]
    private ?string $webConfig = null;

    #[ORM\Column(length: 255, nullable: true)]
    #[Groups(['centro:read', 'centro:write', 'user:read'])]
    private ?string $logo = null;

    #[ORM\Column(length: 255)]
    #[Groups(['centro:read', 'centro:write'])]
    private ?string $direccion = null;

    #[ORM\Column(length: 25, nullable: true)]
    #[Groups(['centro:read', 'centro:write'])]
    private ?string $telefono = null;

    #[ORM\OneToMany(mappedBy: 'centro', targetEntity: User::class)]
    private Collection $usuarios;

    #[ORM\OneToMany(mappedBy: 'centro', targetEntity: CicloFormativo::class)]
    private Collection $ciclos;

    #[ORM\OneToMany(mappedBy: 'centro', targetEntity: Grupo::class)]
    private Collection $grupos;

    #[ORM\OneToMany(mappedBy: 'centro', targetEntity: Festivo::class)]
    private Collection $festivos;

    #[ORM\OneToMany(mappedBy: 'centro', targetEntity: Tema::class, cascade: ['persist', 'remove'])]
    #[Groups(['centro:read'])]
    private Collection $temas;

    #[ORM\OneToOne(mappedBy: 'centro', targetEntity: Personalizacion::class, cascade: ['persist', 'remove'])]
    #[Groups(['centro:read', 'centro:write', 'user:read'])]
    private ?Personalizacion $personalizacion = null;

    public function __construct()
    {
        $this->usuarios = new ArrayCollection();
        $this->ciclos = new ArrayCollection();
        $this->grupos = new ArrayCollection();
        $this->festivos = new ArrayCollection();
        $this->temas = new ArrayCollection();
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

    public function getCif(): ?string
    {
        return $this->cif;
    }

    public function setCif(string $cif): static
    {
        $this->cif = $cif;
        return $this;
    }

    public function isActivo(): bool
    {
        return $this->activo;
    }

    public function setActivo(bool $activo): static
    {
        $this->activo = $activo;
        return $this;
    }

    public function getWebConfig(): ?string
    {
        return $this->webConfig;
    }

    public function setWebConfig(?string $webConfig): static
    {
        $this->webConfig = $webConfig;
        return $this;
    }

    public function getLogo(): ?string
    {
        return $this->logo;
    }

    public function setLogo(?string $logo): static
    {
        $this->logo = $logo;
        return $this;
    }

    public function getDireccion(): ?string
    {
        return $this->direccion;
    }

    public function setDireccion(string $direccion): static
    {
        $this->direccion = $direccion;
        return $this;
    }

    public function getTelefono(): ?string
    {
        return $this->telefono;
    }

    public function setTelefono(?string $telefono): static
    {
        $this->telefono = $telefono;
        return $this;
    }

    public function getPersonalizacion(): ?Personalizacion
    {
        return $this->personalizacion;
    }

    public function setPersonalizacion(Personalizacion $personalizacion): static
    {
        // set the owning side of the relation if necessary
        if ($personalizacion->getCentro() !== $this) {
            $personalizacion->setCentro($this);
        }

        $this->personalizacion = $personalizacion;

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
            $grupo->setCentro($this);
        }

        return $this;
    }

    public function removeGrupo(Grupo $grupo): static
    {
        if ($this->grupos->removeElement($grupo)) {
            if ($grupo->getCentro() === $this) {
                $grupo->setCentro(null);
            }
        }

        return $this;
    }

    /**
     * @return Collection<int, Festivo>
     */
    public function getFestivos(): Collection
    {
        return $this->festivos;
    }

    public function addFestivo(Festivo $festivo): static
    {
        if (!$this->festivos->contains($festivo)) {
            $this->festivos->add($festivo);
            $festivo->setCentro($this);
        }

        return $this;
    }

    public function removeFestivo(Festivo $festivo): static
    {
        if ($this->festivos->removeElement($festivo)) {
            if ($festivo->getCentro() === $this) {
                $festivo->setCentro(null);
            }
        }

        return $this;
    }

    /**
     * @return Collection<int, Tema>
     */
    public function getTemas(): Collection
    {
        return $this->temas;
    }

    public function addTema(Tema $tema): static
    {
        if (!$this->temas->contains($tema)) {
            $this->temas->add($tema);
            $tema->setCentro($this);
        }

        return $this;
    }

    public function removeTema(Tema $tema): static
    {
        if ($this->temas->removeElement($tema)) {
            if ($tema->getCentro() === $this) {
                $tema->setCentro(null);
            }
        }

        return $this;
    }
}
