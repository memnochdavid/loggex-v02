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
use App\Entity\Traits\SoftDeletableTrait;
use App\Entity\Traits\TimestampableTrait;
use App\Repository\ModuloRepository;
use App\State\SoftDeleteProcessor;
use Doctrine\Common\Collections\ArrayCollection;
use Doctrine\Common\Collections\Collection;
use Doctrine\ORM\Mapping as ORM;
use Symfony\Component\Serializer\Attribute\Groups;

#[ORM\Entity(repositoryClass: ModuloRepository::class)]
#[ORM\Table(name: 'modulo')]
#[ORM\HasLifecycleCallbacks]
#[ApiResource(
    operations: [
        new Get(),
        new GetCollection(),
        new Post(),
        new Put(),
        new Delete(processor: SoftDeleteProcessor::class)
    ],
    normalizationContext: ['groups' => ['modulo:read', 'timestamp:read', 'softdelete:read']],
    denormalizationContext: ['groups' => ['modulo:write']]
)]
#[ApiFilter(SearchFilter::class, properties: [
    'nombre' => 'partial',
    'codigoOficial' => 'partial',
    'ciclo' => 'exact', // Para filtrar por ID de ciclo
    'ciclo.nombre' => 'partial', // Para filtrar por nombre de ciclo
    'ciclo.centro' => 'exact' // Para filtrar por centro (SuperAdmin)
])]
#[ApiFilter(OrderFilter::class, properties: ['nombre', 'codigoOficial', 'curso', 'id', 'ciclo.nombre'], arguments: ['orderParameterName' => 'order'])]
class Modulo
{
    use TimestampableTrait;
    use SoftDeletableTrait;

    #[ORM\Id]
    #[ORM\GeneratedValue]
    #[ORM\Column]
    #[Groups(['modulo:read'])]
    private ?int $id = null;

    #[ORM\Column(length: 255)]
    #[Groups(['modulo:read', 'modulo:write', 'imparticion:read', 'horario:read'])] // Añadido imparticion:read, horario:read
    private ?string $nombre = null;

    #[ORM\Column(length: 50, nullable: true)]
    #[Groups(['modulo:read', 'modulo:write', 'imparticion:read', 'horario:read'])] // Añadido imparticion:read, horario:read
    private ?string $codigoOficial = null;

    #[ORM\Column]
    #[Groups(['modulo:read', 'modulo:write'])]
    private ?int $curso = null;

    #[ORM\Column]
    #[Groups(['modulo:read', 'modulo:write'])]
    private ?int $horasSemanales = null;

    #[ORM\ManyToOne(inversedBy: 'modulos')]
    #[ORM\JoinColumn(nullable: false)]
    #[Groups(['modulo:read', 'modulo:write'])]
    private ?CicloFormativo $ciclo = null;

    #[ORM\OneToMany(mappedBy: 'modulo', targetEntity: Imparticion::class)]
    private Collection $imparticiones;

    public function __construct()
    {
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
