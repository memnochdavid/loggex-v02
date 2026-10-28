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
use App\Attribute\LivePublish;
use App\Entity\Traits\SoftDeletableTrait;
use App\Entity\Traits\TimestampableTrait;
use App\Repository\TemarioRepository;
use App\State\SoftDeleteProcessor;
use Doctrine\DBAL\Types\Types;
use Doctrine\ORM\Mapping as ORM;
use Symfony\Component\Serializer\Attribute\Groups;

#[ORM\Entity(repositoryClass: TemarioRepository::class)]
#[ORM\Table(name: 'temario')]
#[ORM\HasLifecycleCallbacks]
#[ApiResource(
    operations: [
        new Get(),
        new GetCollection(),
        new Post(),
        new Put(),
        new Delete(processor: SoftDeleteProcessor::class)
    ],
    normalizationContext: ['groups' => ['temario:read', 'timestamp:read', 'softdelete:read']],
    denormalizationContext: ['groups' => ['temario:write']]
)]
#[ApiFilter(SearchFilter::class, properties: ['imparticion' => 'exact'])]
// Topic admin plano `/admin/temarios` para SuperAdmin (cubierto por wildcard
// `/admin/{rec}` en JWT). Topic por imparticion `/imparticiones/{id}/temarios`
// firmado individualmente al profesor titular y a los alumnos del grupo en
// MercureAuthController, así no hay fuga de datos entre imparticiones ajenas.
#[LivePublish(
    topics: ['/admin/temarios', '/imparticiones/{imparticion.id}/temarios'],
    payloadGroups: ['temario:read', 'timestamp:read', 'softdelete:read'],
)]
class Temario
{
    use TimestampableTrait;
    use SoftDeletableTrait;

    #[ORM\Id]
    #[ORM\GeneratedValue]
    #[ORM\Column]
    #[Groups(['temario:read'])]
    private ?int $id = null;

    #[ORM\Column(length: 255)]
    #[Groups(['temario:read', 'temario:write'])]
    private ?string $titulo = null;

    #[ORM\Column(length: 255)]
    #[Groups(['temario:read', 'temario:write'])]
    private ?string $archivo = null;

    #[ORM\Column(type: Types::DATETIME_MUTABLE)]
    #[Groups(['temario:read', 'temario:write'])]
    private ?\DateTimeInterface $fechaSubida = null;

    #[ORM\ManyToOne(inversedBy: 'temarios')]
    #[ORM\JoinColumn(nullable: false)]
    #[Groups(['temario:read', 'temario:write'])]
    private ?Imparticion $imparticion = null;

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

    public function getArchivo(): ?string
    {
        return $this->archivo;
    }

    public function setArchivo(string $archivo): static
    {
        $this->archivo = $archivo;
        return $this;
    }

    public function getFechaSubida(): ?\DateTimeInterface
    {
        return $this->fechaSubida;
    }

    public function setFechaSubida(\DateTimeInterface $fechaSubida): static
    {
        $this->fechaSubida = $fechaSubida;
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
