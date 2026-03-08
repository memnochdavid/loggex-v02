<?php

namespace App\Entity;

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
use App\Repository\AsistenciaRepository;
use App\State\SoftDeleteProcessor;
use Doctrine\DBAL\Types\Types;
use Doctrine\ORM\Mapping as ORM;
use Symfony\Component\Serializer\Attribute\Groups;

#[ORM\Entity(repositoryClass: AsistenciaRepository::class)]
#[ORM\Table(name: 'asistencia')]
#[ORM\HasLifecycleCallbacks]
#[ApiResource(
    operations: [
        new Get(),
        new GetCollection(),
        new Post(),
        new Put(),
        new Delete(processor: SoftDeleteProcessor::class)
    ],
    normalizationContext: ['groups' => ['asistencia:read', 'timestamp:read', 'softdelete:read']],
    denormalizationContext: ['groups' => ['asistencia:write']]
)]
#[ApiFilter(SearchFilter::class, properties: [
    'alumno' => 'exact',
    'alumno.id' => 'exact', // AÑADIDO: Para filtrar por ID numérico explícitamente
    'imparticion' => 'exact',
    'imparticion.grupo' => 'exact',
    'imparticion.grupo.centro' => 'exact',
    'imparticion.modulo' => 'exact'
])]
class Asistencia
{
    use TimestampableTrait;
    use SoftDeletableTrait;

    #[ORM\Id]
    #[ORM\GeneratedValue]
    #[ORM\Column]
    #[Groups(['asistencia:read'])]
    private ?int $id = null;

    #[ORM\Column(type: Types::DATE_MUTABLE)]
    #[Groups(['asistencia:read', 'asistencia:write'])]
    private ?\DateTimeInterface $fecha = null;

    #[ORM\Column(type: Types::TIME_MUTABLE)]
    #[Groups(['asistencia:read', 'asistencia:write'])]
    private ?\DateTimeInterface $hora = null;

    #[ORM\Column(length: 20)]
    #[Groups(['asistencia:read', 'asistencia:write'])]
    private ?string $estado = null;

    #[ORM\Column(type: Types::TEXT, nullable: true)]
    #[Groups(['asistencia:read', 'asistencia:write'])]
    private ?string $comentario = null;

    #[ORM\ManyToOne(inversedBy: 'asistencias')]
    #[ORM\JoinColumn(nullable: false)]
    #[Groups(['asistencia:read', 'asistencia:write'])]
    private ?Imparticion $imparticion = null;

    #[ORM\ManyToOne(inversedBy: 'asistencias')]
    #[ORM\JoinColumn(nullable: false)]
    #[Groups(['asistencia:read', 'asistencia:write'])]
    private ?User $alumno = null;

    public function getId(): ?int
    {
        return $this->id;
    }

    public function getFecha(): ?\DateTimeInterface
    {
        return $this->fecha;
    }

    public function setFecha(\DateTimeInterface $fecha): static
    {
        $this->fecha = $fecha;
        return $this;
    }

    public function getHora(): ?\DateTimeInterface
    {
        return $this->hora;
    }

    public function setHora(\DateTimeInterface $hora): static
    {
        $this->hora = $hora;
        return $this;
    }

    public function getEstado(): ?string
    {
        return $this->estado;
    }

    public function setEstado(string $estado): static
    {
        $this->estado = $estado;
        return $this;
    }

    public function getComentario(): ?string
    {
        return $this->comentario;
    }

    public function setComentario(?string $comentario): static
    {
        $this->comentario = $comentario;
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

    public function getAlumno(): ?User
    {
        return $this->alumno;
    }

    public function setAlumno(?User $alumno): static
    {
        $this->alumno = $alumno;
        return $this;
    }
}
