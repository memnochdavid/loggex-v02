<?php

namespace App\Entity;

use ApiPlatform\Metadata\ApiResource;
use ApiPlatform\Metadata\Delete;
use ApiPlatform\Metadata\Get;
use ApiPlatform\Metadata\GetCollection;
use ApiPlatform\Metadata\Post;
use ApiPlatform\Metadata\Patch;
use ApiPlatform\Metadata\Put;
use App\Attribute\LivePublish;
use App\Entity\Traits\SoftDeletableTrait;
use App\Entity\Traits\TimestampableTrait;
use App\Repository\CalificacionRepository;
use App\State\SoftDeleteProcessor;
use Doctrine\DBAL\Types\Types;
use Doctrine\ORM\Mapping as ORM;
use Symfony\Component\Serializer\Attribute\Groups;

#[ORM\Entity(repositoryClass: CalificacionRepository::class)]
#[ORM\Table(name: 'calificacion')]
#[ORM\HasLifecycleCallbacks]
#[ApiResource(
    operations: [
        new Get(),
        new GetCollection(),
        new Post(),
        new Put(),
        new Patch(),
        new Delete(processor: SoftDeleteProcessor::class)
    ],
    normalizationContext: ['groups' => ['calificacion:read', 'timestamp:read', 'softdelete:read']],
    denormalizationContext: ['groups' => ['calificacion:write']]
)]
// Topic admin plano `/admin/calificaciones` (path entity → entrega → tarea →
// imparticion → grupo → centro es demasiado largo y frágil para placeholders).
// Topic personal `/users/{entrega.alumno.id}/calificaciones` para que el alumno
// vea su `/mis-calificaciones` actualizada cuando el profe pone/edita la nota.
// El SuperAdmin ya recibe vía `/admin/{rec}` cuando filtra por otro alumno.
#[LivePublish(
    topics: ['/admin/calificaciones', '/users/{entrega.alumno.id}/calificaciones'],
    payloadGroups: ['calificacion:read', 'timestamp:read', 'softdelete:read'],
)]
class Calificacion
{
    use TimestampableTrait;
    use SoftDeletableTrait;

    #[ORM\Id]
    #[ORM\GeneratedValue]
    #[ORM\Column]
    #[Groups(['calificacion:read', 'entrega:read', 'tarea:read'])] // Añadido tarea:read
    private ?int $id = null;

    #[ORM\Column]
    #[Groups(['calificacion:read', 'calificacion:write', 'entrega:read', 'tarea:read'])] // Añadido tarea:read
    private ?float $nota = null;

    #[ORM\Column(type: Types::TEXT, nullable: true)]
    #[Groups(['calificacion:read', 'calificacion:write', 'entrega:read', 'tarea:read'])] // Añadido tarea:read
    private ?string $feedbackProfesor = null;

    #[ORM\OneToOne(inversedBy: 'calificacion', cascade: ['persist', 'remove'])]
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
