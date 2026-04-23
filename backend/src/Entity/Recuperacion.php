<?php

namespace App\Entity;

use ApiPlatform\Doctrine\Orm\Filter\OrderFilter;
use ApiPlatform\Doctrine\Orm\Filter\SearchFilter;
use ApiPlatform\Metadata\ApiFilter;
use ApiPlatform\Metadata\ApiResource;
use ApiPlatform\Metadata\Delete;
use ApiPlatform\Metadata\Get;
use ApiPlatform\Metadata\GetCollection;
use ApiPlatform\Metadata\Patch;
use ApiPlatform\Metadata\Post;
use ApiPlatform\Metadata\Put;
use App\Entity\Traits\SoftDeletableTrait;
use App\Entity\Traits\TimestampableTrait;
use App\Repository\RecuperacionRepository;
use App\State\SoftDeleteProcessor;
use Doctrine\DBAL\Types\Types;
use Doctrine\ORM\Mapping as ORM;
use Symfony\Component\Serializer\Attribute\Groups;

#[ORM\Entity(repositoryClass: RecuperacionRepository::class)]
#[ORM\Table(name: 'recuperacion')]
#[ORM\HasLifecycleCallbacks]
#[ApiResource(
    operations: [
        new Get(),
        new GetCollection(),
        new Post(security: "is_granted('ROLE_PROFESOR') or is_granted('ROLE_ADMIN') or is_granted('ROLE_SUPERADMIN')"),
        new Put(security: "is_granted('ROLE_PROFESOR') or is_granted('ROLE_ADMIN') or is_granted('ROLE_SUPERADMIN')"),
        new Patch(security: "is_granted('ROLE_PROFESOR') or is_granted('ROLE_ADMIN') or is_granted('ROLE_SUPERADMIN')"),
        new Delete(security: "is_granted('ROLE_PROFESOR') or is_granted('ROLE_ADMIN') or is_granted('ROLE_SUPERADMIN')", processor: SoftDeleteProcessor::class)
    ],
    normalizationContext: ['groups' => ['recuperacion:read', 'timestamp:read', 'softdelete:read']],
    denormalizationContext: ['groups' => ['recuperacion:write']]
)]
#[ApiFilter(SearchFilter::class, properties: ['tarea' => 'exact', 'alumno' => 'exact', 'tipo' => 'exact'])]
#[ApiFilter(OrderFilter::class, properties: ['fecha', 'id'], arguments: ['orderParameterName' => 'order'])]
class Recuperacion
{
    use TimestampableTrait;
    use SoftDeletableTrait;

    #[ORM\Id]
    #[ORM\GeneratedValue]
    #[ORM\Column]
    #[Groups(['recuperacion:read', 'tarea:read'])]
    private ?int $id = null;

    #[ORM\ManyToOne]
    #[ORM\JoinColumn(nullable: false)]
    #[Groups(['recuperacion:read', 'recuperacion:write'])]
    private ?Tarea $tarea = null;

    #[ORM\ManyToOne]
    #[ORM\JoinColumn(nullable: false)]
    #[Groups(['recuperacion:read', 'recuperacion:write', 'tarea:read'])]
    private ?User $alumno = null;

    #[ORM\Column(length: 20)]
    #[Groups(['recuperacion:read', 'recuperacion:write', 'tarea:read'])]
    private ?string $tipo = null;

    #[ORM\Column(type: Types::FLOAT)]
    #[Groups(['recuperacion:read', 'recuperacion:write', 'tarea:read'])]
    private ?float $nota = null;

    #[ORM\Column(type: Types::DATETIME_MUTABLE)]
    #[Groups(['recuperacion:read', 'recuperacion:write', 'tarea:read'])]
    private ?\DateTimeInterface $fecha = null;

    #[ORM\Column(type: Types::TEXT, nullable: true)]
    #[Groups(['recuperacion:read', 'recuperacion:write', 'tarea:read'])]
    private ?string $feedbackProfesor = null;

    public function getId(): ?int
    {
        return $this->id;
    }

    public function getTarea(): ?Tarea
    {
        return $this->tarea;
    }

    public function setTarea(?Tarea $tarea): static
    {
        $this->tarea = $tarea;
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

    public function getTipo(): ?string
    {
        return $this->tipo;
    }

    public function setTipo(string $tipo): static
    {
        $this->tipo = $tipo;
        return $this;
    }

    public function getNota(): ?float
    {
        return $this->nota;
    }

    public function setNota(float $nota): static
    {
        $this->nota = $nota;
        return $this;
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

    public function getFeedbackProfesor(): ?string
    {
        return $this->feedbackProfesor;
    }

    public function setFeedbackProfesor(?string $feedbackProfesor): static
    {
        $this->feedbackProfesor = $feedbackProfesor;
        return $this;
    }
}
