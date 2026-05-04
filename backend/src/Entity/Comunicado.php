<?php

namespace App\Entity;

use ApiPlatform\Metadata\ApiResource;
use ApiPlatform\Metadata\Get;
use ApiPlatform\Metadata\GetCollection;
use ApiPlatform\Metadata\Post;
use ApiPlatform\Metadata\Put;
use ApiPlatform\Metadata\Delete;
use App\Attribute\LivePublish;
use App\Entity\Traits\SoftDeletableTrait;
use App\Entity\Traits\TimestampableTrait;
use App\Repository\ComunicadoRepository;
use App\State\ComunicadoProcessor;
use App\State\SoftDeleteProcessor;
use Doctrine\DBAL\Types\Types;
use Doctrine\ORM\Mapping as ORM;
use Symfony\Component\Serializer\Attribute\Groups;

#[ORM\Entity(repositoryClass: ComunicadoRepository::class)]
#[ORM\Table(name: 'comunicado')]
#[ORM\HasLifecycleCallbacks]
#[ApiResource(
    operations: [
        new Get(),
        new GetCollection(),
        new Post(processor: ComunicadoProcessor::class),
        new Put(),
        new Delete(processor: SoftDeleteProcessor::class)
    ],
    normalizationContext: ['groups' => ['comunicado:read', 'timestamp:read', 'softdelete:read', 'user:read', 'centro:read']],
    denormalizationContext: ['groups' => ['comunicado:write']]
)]
// Comunicados con `centro` no-null se publican al topic del centro; los
// comunicados globales (centro=null, global=true) NO disparan este live aún
// porque el placeholder `{centro.id}` no resuelve y el topic se descarta.
// Pendiente para sesión 2: topic `/global/comunicados` + condición en el
// atributo (ver hoja-de-ruta-redis-workers.md §"Deuda live updates CRUD").
#[LivePublish(
    topics: ['/centros/{centro.id}/comunicados'],
    payloadGroups: ['comunicado:read', 'timestamp:read', 'softdelete:read', 'user:read', 'centro:read'],
)]
class Comunicado
{
    use TimestampableTrait;
    use SoftDeletableTrait;

    #[ORM\Id]
    #[ORM\GeneratedValue]
    #[ORM\Column]
    #[Groups(['comunicado:read'])]
    private ?int $id = null;

    #[ORM\Column(length: 255)]
    #[Groups(['comunicado:read', 'comunicado:write'])]
    private ?string $titulo = null;

    #[ORM\Column(type: Types::TEXT)]
    #[Groups(['comunicado:read', 'comunicado:write'])]
    private ?string $contenido = null;

    #[ORM\Column(type: 'boolean')]
    #[Groups(['comunicado:read', 'comunicado:write'])]
    private bool $global = false;

    #[ORM\ManyToOne(targetEntity: User::class)]
    #[ORM\JoinColumn(nullable: false)]
    #[Groups(['comunicado:read'])]
    private ?User $autor = null;

    #[ORM\ManyToOne(targetEntity: Centro::class)]
    #[ORM\JoinColumn(nullable: true)]
    #[Groups(['comunicado:read', 'comunicado:write'])]
    private ?Centro $centro = null;

    public function getId(): ?int
    {
        return $this->id;
    }

    public function getTitulo(): ?string
    {
        return $this->titulo;
    }

    public function setTitulo(string $titulo): static
    {
        $this->titulo = $titulo;
        return $this;
    }

    public function getContenido(): ?string
    {
        return $this->contenido;
    }

    public function setContenido(string $contenido): static
    {
        $this->contenido = $contenido;
        return $this;
    }

    public function isGlobal(): bool
    {
        return $this->global;
    }

    public function setGlobal(bool $global): static
    {
        $this->global = $global;
        return $this;
    }

    public function getAutor(): ?User
    {
        return $this->autor;
    }

    public function setAutor(?User $autor): static
    {
        $this->autor = $autor;
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
