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
use App\Repository\PeriodoEvaluativoRepository;
use App\State\SoftDeleteProcessor;
use Doctrine\DBAL\Types\Types;
use Doctrine\ORM\Mapping as ORM;
use Symfony\Component\Serializer\Attribute\Groups;
use Symfony\Component\Validator\Constraints as Assert;

#[ORM\Entity(repositoryClass: PeriodoEvaluativoRepository::class)]
#[ORM\Table(name: 'periodo_evaluativo')]
#[ORM\HasLifecycleCallbacks]
#[ApiResource(
    operations: [
        new Get(),
        new GetCollection(),
        new Post(),
        new Put(),
        new Delete(processor: SoftDeleteProcessor::class)
    ],
    normalizationContext: ['groups' => ['periodo:read', 'timestamp:read', 'softdelete:read']],
    denormalizationContext: ['groups' => ['periodo:write']]
)]
#[ApiFilter(SearchFilter::class, properties: [
    'grupo' => 'exact',
    'grupo.centro' => 'exact',
    'tipo' => 'exact'
])]
#[ApiFilter(OrderFilter::class, properties: ['fechaInicio', 'nombre', 'id'], arguments: ['orderParameterName' => 'order'])]
class PeriodoEvaluativo
{
    use TimestampableTrait;
    use SoftDeletableTrait;

    #[ORM\Id]
    #[ORM\GeneratedValue]
    #[ORM\Column]
    #[Groups(['periodo:read'])]
    private ?int $id = null;

    #[ORM\Column(length: 100)]
    #[Groups(['periodo:read', 'periodo:write'])]
    private ?string $nombre = null;

    #[ORM\Column(length: 30)]
    #[Assert\Choice(
        choices: ['PRIMERA', 'SEGUNDA', 'TERCERA', 'ORDINARIA_FINAL', 'EXTRAORDINARIA'],
        message: 'El tipo debe ser PRIMERA, SEGUNDA, TERCERA, ORDINARIA_FINAL o EXTRAORDINARIA.'
    )]
    #[Groups(['periodo:read', 'periodo:write'])]
    private ?string $tipo = null;

    #[ORM\Column(type: Types::DATE_MUTABLE)]
    #[Groups(['periodo:read', 'periodo:write'])]
    private ?\DateTimeInterface $fechaInicio = null;

    #[ORM\Column(type: Types::DATE_MUTABLE)]
    #[Groups(['periodo:read', 'periodo:write'])]
    private ?\DateTimeInterface $fechaFin = null;

    #[ORM\ManyToOne(targetEntity: Grupo::class)]
    #[ORM\JoinColumn(nullable: false)]
    #[Groups(['periodo:read', 'periodo:write'])]
    private ?Grupo $grupo = null;

    #[ORM\Column(nullable: true)]
    #[Assert\Range(min: 0, max: 1, notInRangeMessage: 'El peso debe estar entre 0 y 1.')]
    #[Groups(['periodo:read', 'periodo:write'])]
    private ?float $peso = null;

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

    public function getTipo(): ?string
    {
        return $this->tipo;
    }

    public function setTipo(string $tipo): static
    {
        $this->tipo = $tipo;
        return $this;
    }

    public function getFechaInicio(): ?\DateTimeInterface
    {
        return $this->fechaInicio;
    }

    public function setFechaInicio(\DateTimeInterface $fechaInicio): static
    {
        $this->fechaInicio = $fechaInicio;
        return $this;
    }

    public function getFechaFin(): ?\DateTimeInterface
    {
        return $this->fechaFin;
    }

    public function setFechaFin(\DateTimeInterface $fechaFin): static
    {
        $this->fechaFin = $fechaFin;
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

    public function getPeso(): ?float
    {
        return $this->peso;
    }

    public function setPeso(?float $peso): static
    {
        $this->peso = $peso;
        return $this;
    }
}
