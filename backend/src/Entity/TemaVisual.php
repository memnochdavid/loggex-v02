<?php

namespace App\Entity;

use ApiPlatform\Metadata\ApiResource;
use ApiPlatform\Metadata\Get;
use ApiPlatform\Metadata\GetCollection;
use ApiPlatform\Metadata\Post;
use ApiPlatform\Metadata\Put;
use ApiPlatform\Metadata\Delete;
use App\Entity\Traits\TimestampableTrait;
use Doctrine\ORM\Mapping as ORM;
use Symfony\Component\Serializer\Attribute\Groups;

#[ORM\Entity]
#[ORM\Table(name: 'tema_visual')]
#[ORM\HasLifecycleCallbacks]
#[ApiResource(
    operations: [
        new Get(),
        new GetCollection(),
        new Post(),
        new Put(),
        new Delete()
    ],
    normalizationContext: ['groups' => ['tema_visual:read', 'timestamp:read']],
    denormalizationContext: ['groups' => ['tema_visual:write']]
)]
class TemaVisual
{
    use TimestampableTrait;

    #[ORM\Id]
    #[ORM\GeneratedValue]
    #[ORM\Column]
    #[Groups(['tema_visual:read', 'centro:read', 'user:read'])]
    private ?int $id = null;

    #[ORM\Column(length: 255)]
    #[Groups(['tema_visual:read', 'tema_visual:write', 'centro:read', 'user:read'])]
    private ?string $nombre = null;

    #[ORM\Column(type: 'json')]
    #[Groups(['tema_visual:read', 'tema_visual:write', 'centro:read', 'user:read'])]
    private array $configuracion = [];

    #[ORM\Column(options: ['default' => false])]
    #[Groups(['tema_visual:read', 'centro:read', 'user:read'])]
    private ?bool $esPredefinido = false;

    #[ORM\ManyToOne(inversedBy: 'temasVisuales')]
    #[ORM\JoinColumn(nullable: true)]
    #[Groups(['tema_visual:read', 'tema_visual:write'])]
    private ?Centro $centro = null;

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

    public function getConfiguracion(): array
    {
        return $this->configuracion;
    }

    public function setConfiguracion(array $configuracion): static
    {
        $this->configuracion = $configuracion;
        return $this;
    }

    public function isEsPredefinido(): ?bool
    {
        return $this->esPredefinido;
    }

    public function setEsPredefinido(bool $esPredefinido): static
    {
        $this->esPredefinido = $esPredefinido;
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
