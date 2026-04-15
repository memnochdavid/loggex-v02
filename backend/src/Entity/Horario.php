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
use App\Repository\HorarioRepository;
use App\State\SoftDeleteProcessor;
use Doctrine\DBAL\Types\Types;
use Doctrine\ORM\Mapping as ORM;
use Symfony\Component\Serializer\Attribute\Groups;

#[ORM\Entity(repositoryClass: HorarioRepository::class)]
#[ORM\Table(name: 'horario')]
#[ORM\HasLifecycleCallbacks]
#[ApiResource(
    operations: [
        new Get(),
        new GetCollection(),
        new Post(),
        new Put(),
        new Delete(processor: SoftDeleteProcessor::class)
    ],
    normalizationContext: ['groups' => ['horario:read', 'timestamp:read', 'softdelete:read']],
    denormalizationContext: ['groups' => ['horario:write']]
)]
#[ApiFilter(SearchFilter::class, properties: [
    'imparticion' => 'exact',
    'imparticion.grupo' => 'exact',
    'imparticion.profesor' => 'exact',
    'aula' => 'partial',
    'diaSemana' => 'exact',
    'imparticion.modulo.nombre' => 'partial',
    'imparticion.profesor.nombre' => 'partial',
    'imparticion.profesor.apellidos' => 'partial'
])]
#[ApiFilter(OrderFilter::class, properties: [
    'diaSemana',
    'horaInicio',
    'id',
    'aula',
    'imparticion.modulo.nombre',
    'imparticion.profesor.nombre'
], arguments: ['orderParameterName' => 'order'])]
class Horario
{
    use TimestampableTrait;
    use SoftDeletableTrait;

    #[ORM\Id]
    #[ORM\GeneratedValue]
    #[ORM\Column]
    #[Groups(['horario:read'])]
    private ?int $id = null;

    #[ORM\Column]
    #[Groups(['horario:read', 'horario:write'])]
    private ?int $diaSemana = null;

    #[ORM\Column(type: Types::TIME_MUTABLE)]
    #[Groups(['horario:read', 'horario:write'])]
    private ?\DateTimeInterface $horaInicio = null;

    #[ORM\Column(type: Types::TIME_MUTABLE)]
    #[Groups(['horario:read', 'horario:write'])]
    private ?\DateTimeInterface $horaFin = null;

    #[ORM\Column(length: 255)]
    #[Groups(['horario:read', 'horario:write'])]
    private ?string $aula = null;

    #[ORM\ManyToOne(inversedBy: 'horarios')]
    #[ORM\JoinColumn(nullable: false)]
    #[Groups(['horario:read', 'horario:write'])]
    private ?Imparticion $imparticion = null;

    public function getId(): ?int
    {
        return $this->id;
    }

    public function getDiaSemana(): ?int
    {
        return $this->diaSemana;
    }

    public function setDiaSemana(int $diaSemana): static
    {
        $this->diaSemana = $diaSemana;
        return $this;
    }

    public function getHoraInicio(): ?\DateTimeInterface
    {
        return $this->horaInicio;
    }

    public function setHoraInicio(\DateTimeInterface $horaInicio): static
    {
        $this->horaInicio = $horaInicio;
        return $this;
    }

    public function getHoraFin(): ?\DateTimeInterface
    {
        return $this->horaFin;
    }

    public function setHoraFin(\DateTimeInterface $horaFin): static
    {
        $this->horaFin = $horaFin;
        return $this;
    }

    public function getAula(): ?string
    {
        return $this->aula;
    }

    public function setAula(string $aula): static
    {
        $this->aula = $aula;
        return $this;
    }

    public function getImparticion(): ?Imparticion
    {
        return $this->imparticion;
    }

    public function setImparticion(?Imparticion $imparticion): static
    {
        $this->imparticion = $imparticion;
        return $this;
    }
}
