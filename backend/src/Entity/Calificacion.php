<?php

namespace App\Entity;

use ApiPlatform\Metadata\ApiResource;
use App\Repository\CalificacionRepository;
use Doctrine\DBAL\Types\Types;
use Doctrine\ORM\Mapping as ORM;
use Symfony\Component\Serializer\Annotation\Groups;

#[ORM\Entity(repositoryClass: CalificacionRepository::class)]
#[ORM\Table(name: 'calificacion')]
#[ApiResource(
    normalizationContext: ['groups' => ['calificacion:read']],
    denormalizationContext: ['groups' => ['calificacion:write']]
)]
class Calificacion
{
    #[ORM\Id]
    #[ORM\GeneratedValue]
    #[ORM\Column]
    #[Groups(['calificacion:read'])]
    private ?int $id = null;

    #[ORM\Column]
    #[Groups(['calificacion:read', 'calificacion:write'])]
    private ?float $nota = null;

    #[ORM\Column(type: Types::TEXT, nullable: true)]
    #[Groups(['calificacion:read', 'calificacion:write'])]
    private ?string $feedbackProfesor = null;

    #[ORM\OneToOne(cascade: ['persist', 'remove'])]
    #[ORM\JoinColumn(nullable: false)]
    #[Groups(['calificacion:read', 'calificacion:write'])]
    private ?Entrega $entrega = null;

    public function getId(): ?int
    {
        return $this->id;
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

    public function getFeedbackProfesor(): ?string
    {
        return $this->feedbackProfesor;
    }

    public function setFeedbackProfesor(?string $feedbackProfesor): static
    {
        $this->feedbackProfesor = $feedbackProfesor;
        return $this;
    }

    public function getEntrega(): ?Entrega
    {
        return $this->entrega;
    }

    public function setEntrega(Entrega $entrega): static
    {
        $this->entrega = $entrega;
        return $this;
    }
}
