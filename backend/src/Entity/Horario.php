<?php

namespace App\Entity;

use ApiPlatform\Metadata\ApiResource;
use App\Repository\HorarioRepository;
use Doctrine\DBAL\Types\Types;
use Doctrine\ORM\Mapping as ORM;
use Symfony\Component\Serializer\Annotation\Groups;

#[ORM\Entity(repositoryClass: HorarioRepository::class)]
#[ORM\Table(name: 'horario')]
#[ApiResource(
    normalizationContext: ['groups' => ['horario:read']],
    denormalizationContext: ['groups' => ['horario:write']]
)]
class Horario
{
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

    #[ORM\ManyToOne]
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
