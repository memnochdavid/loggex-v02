<?php

namespace App\Entity;

use ApiPlatform\Metadata\ApiResource;
use ApiPlatform\Metadata\Delete;
use ApiPlatform\Metadata\Get;
use ApiPlatform\Metadata\GetCollection;
use ApiPlatform\Metadata\Post;
use ApiPlatform\Metadata\Put;
use App\Entity\Traits\SoftDeletableTrait;
use App\Entity\Traits\TimestampableTrait;
use App\Repository\CicloFormativoRepository;
use App\State\SoftDeleteProcessor;
use Doctrine\ORM\Mapping as ORM;
use Symfony\Component\Serializer\Attribute\Groups;

#[ORM\Entity(repositoryClass: CicloFormativoRepository::class)]
#[ORM\Table(name: 'ciclo_formativo')]
#[ORM\HasLifecycleCallbacks]
#[ApiResource(
    operations: [
        new Get(),
        new GetCollection(),
        new Post(),
        new Put(),
        new Delete(processor: SoftDeleteProcessor::class)
    ],
    normalizationContext: ['groups' => ['ciclo:read', 'timestamp:read', 'softdelete:read']],
    denormalizationContext: ['groups' => ['ciclo:write']]
)]
class CicloFormativo
{
    use TimestampableTrait;
    use SoftDeletableTrait;

    #[ORM\Id]
    #[ORM\GeneratedValue]
    #[ORM\Column]
    #[Groups(['ciclo:read'])]
    private ?int $id = null;

    #[ORM\Column(length: 255)]
    #[Groups(['ciclo:read', 'ciclo:write'])]
    private ?string $nombre = null;

    #[ORM\Column(length: 50)]
    #[Groups(['ciclo:read', 'ciclo:write'])]
    private ?string $nivel = null;

    #[ORM\ManyToOne(inversedBy: 'ciclos')]
    #[ORM\JoinColumn(nullable: false)]
    #[Groups(['ciclo:read', 'ciclo:write'])]
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

    public function getNivel(): ?string
    {
        return $this->nivel;
    }

    public function setNivel(string $nivel): static
    {
        $this->nivel = $nivel;
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
