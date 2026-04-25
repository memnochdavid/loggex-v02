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
use App\Repository\GrupoRepository;
use App\State\SoftDeleteProcessor;
use Doctrine\Common\Collections\ArrayCollection;
use Doctrine\Common\Collections\Collection;
use Doctrine\DBAL\Types\Types;
use Doctrine\ORM\Mapping as ORM;
use Symfony\Component\Serializer\Attribute\Groups;

#[ORM\Entity(repositoryClass: GrupoRepository::class)]
#[ORM\Table(name: 'grupo')]
#[ORM\HasLifecycleCallbacks]
#[ApiResource(
    operations: [
        new Get(),
        new GetCollection(),
        new Post(),
        new Put(),
        new Delete(processor: SoftDeleteProcessor::class)
    ],
    normalizationContext: ['groups' => ['grupo:read', 'timestamp:read', 'softdelete:read']],
    denormalizationContext: ['groups' => ['grupo:write']]
)]
#[ApiFilter(SearchFilter::class, properties: [
    'nombre' => 'partial',
    'anioEscolar' => 'exact',
    'ciclo' => 'exact',
    'ciclo.nombre' => 'partial',
    'centro' => 'exact'
])]
#[ApiFilter(SearchAnyFilter::class, properties: ['nombre', 'abreviatura', 'anioEscolar'])]
#[ApiFilter(OrderFilter::class, properties: ['nombre', 'curso', 'anioEscolar', 'id', 'fechaInicio', 'fechaFin'], arguments: ['orderParameterName' => 'order'])]
class Grupo
{
    use TimestampableTrait;
    use SoftDeletableTrait;

    #[ORM\Id]
    #[ORM\GeneratedValue]
    #[ORM\Column]
    #[Groups(['grupo:read', 'matricula:read'])]
    private ?int $id = null;

    #[ORM\Column(length: 50)]
    #[Groups(['grupo:read', 'grupo:write', 'matricula:read', 'imparticion:read', 'horario:read'])]
    private ?string $nombre = null;

    #[ORM\Column(length: 20, nullable: true)]
    #[Groups(['grupo:read', 'grupo:write', 'matricula:read', 'imparticion:read', 'horario:read'])]
    private ?string $abreviatura = null;

    #[ORM\Column]
    #[Groups(['grupo:read', 'grupo:write', 'matricula:read', 'imparticion:read'])]
    private ?int $curso = null;

    #[ORM\Column(length: 20)]
    #[Groups(['grupo:read', 'grupo:write', 'matricula:read'])] // Añadido matricula:read
    private ?string $anioEscolar = null;

    #[ORM\Column(type: Types::DATE_MUTABLE, nullable: true)]
    #[Groups(['grupo:read', 'grupo:write'])]
    private ?\DateTimeInterface $fechaInicio = null;

    #[ORM\Column(type: Types::DATE_MUTABLE, nullable: true)]
    #[Groups(['grupo:read', 'grupo:write'])]
    private ?\DateTimeInterface $fechaFin = null;

    #[ORM\ManyToOne(inversedBy: 'grupos')]
    #[ORM\JoinColumn(nullable: false)]
    #[Groups(['grupo:read', 'grupo:write', 'matricula:read'])] // Añadido matricula:read
    private ?Itinerario $itinerario = null;

    #[ORM\ManyToOne(inversedBy: 'grupos')]
    #[ORM\JoinColumn(nullable: false)]
    #[Groups(['grupo:read', 'grupo:write'])]
    private ?Centro $centro = null;

    #[ORM\OneToMany(mappedBy: 'grupo', targetEntity: Matricula::class)]
    private Collection $matriculas;

    #[ORM\OneToMany(mappedBy: 'grupo', targetEntity: Imparticion::class)]
    private Collection $imparticiones;

    public function __construct()
    {
        $this->matriculas = new ArrayCollection();
        $this->imparticiones = new ArrayCollection();
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

    public function getAbreviatura(): ?string
    {
        return $this->abreviatura;
    }

    public function setAbreviatura(?string $abreviatura): static
    {
        $this->abreviatura = $abreviatura;
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

    public function getAnioEscolar(): ?string
    {
        return $this->anioEscolar;
    }

    public function setAnioEscolar(string $anioEscolar): static
    {
        $this->anioEscolar = $anioEscolar;
        return $this;
    }

    public function getFechaInicio(): ?\DateTimeInterface
    {
        return $this->fechaInicio;
    }

    public function setFechaInicio(?\DateTimeInterface $fechaInicio): static
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

    public function getItinerario(): ?Itinerario
    {
        return $this->itinerario;
    }

    public function setItinerario(?Itinerario $itinerario): static
    {
        $this->itinerario = $itinerario;
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
