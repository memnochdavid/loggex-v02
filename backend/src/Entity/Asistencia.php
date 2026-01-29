<?php

namespace App\Entity;

use ApiPlatform\Metadata\ApiResource;
use App\Repository\AsistenciaRepository;
use Doctrine\DBAL\Types\Types;
use Doctrine\ORM\Mapping as ORM;
use Symfony\Component\Serializer\Annotation\Groups;

#[ORM\Entity(repositoryClass: AsistenciaRepository::class)]
#[ORM\Table(name: 'asistencia')]
#[ApiResource(
    normalizationContext: ['groups' => ['asistencia:read']],
    denormalizationContext: ['groups' => ['asistencia:write']]
)]
class Asistencia
{
    #[ORM\Id]
    #[ORM\GeneratedValue]
    #[ORM\Column]
    #[Groups(['asistencia:read'])]
    private ?int $id = null;

    #[ORM\Column(type: Types::DATE_MUTABLE)]
    #[Groups(['asistencia:read', 'asistencia:write'])]
    private ?\DateTimeInterface $fecha = null;

    #[ORM\Column(length: 20)]
    #[Groups(['asistencia:read', 'asistencia:write'])]
    private ?string $estado = null;

    #[ORM\Column(type: Types::TIME_MUTABLE)]
    #[Groups(['asistencia:read', 'asistencia:write'])]
    private ?\DateTimeInterface $hora = null;

    #[ORM\Column(type: Types::TEXT, nullable: true)]
    #[Groups(['asistencia:read', 'asistencia:write'])]
    private ?string $comentario = null;

    #[ORM\ManyToOne]
    #[ORM\JoinColumn(nullable: false)]
    #[Groups(['asistencia:read', 'asistencia:write'])]
    private ?Imparticion $imparticion = null;

    #[ORM\ManyToOne]
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

    public function getEstado(): ?string
    {
        return $this->estado;
    }

    public function setEstado(string $estado): static
    {
        $this->estado = $estado;
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
