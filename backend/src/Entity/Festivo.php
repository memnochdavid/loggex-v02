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
use App\Repository\FestivoRepository;
use App\State\SoftDeleteProcessor;
use Doctrine\DBAL\Types\Types;
use Doctrine\ORM\Mapping as ORM;
use Symfony\Component\Serializer\Attribute\Groups;

#[ORM\Entity(repositoryClass: FestivoRepository::class)]
#[ORM\Table(name: 'festivo')]
#[ORM\HasLifecycleCallbacks]
#[ApiResource(
    operations: [
        new Get(),
        new GetCollection(),
        new Post(),
        new Put(),
        new Delete(processor: SoftDeleteProcessor::class)
    ],
    normalizationContext: ['groups' => ['festivo:read', 'timestamp:read', 'softdelete:read']],
    denormalizationContext: ['groups' => ['festivo:write']]
)]
// Topic plano /admin/festivos (no por centro): los festivos NACIONAL/AUTO/PROV
// pueden tener centro=null y aplican a múltiples centros vía cascada — un
// topic global para admins evita el modelado complejo de matchers por ámbito.
#[LivePublish(
    topics: ['/admin/festivos'],
    payloadGroups: ['festivo:read', 'timestamp:read', 'softdelete:read'],
)]
#[ApiFilter(SearchFilter::class, properties: ['centro' => 'exact', 'ambito' => 'exact', 'ccaa' => 'exact', 'provincia' => 'exact'])]
class Festivo
{
    use TimestampableTrait;
    use SoftDeletableTrait;

    #[ORM\Id]
    #[ORM\GeneratedValue]
    #[ORM\Column]
    #[Groups(['festivo:read'])]
    private ?int $id = null;

    #[ORM\Column(length: 255)]
    #[Groups(['festivo:read', 'festivo:write'])]
    private ?string $nombre = null;

    #[ORM\Column(type: Types::DATE_MUTABLE)]
    #[Groups(['festivo:read', 'festivo:write'])]
    private ?\DateTimeInterface $fechaInicio = null;

    #[ORM\Column(type: Types::DATE_MUTABLE, nullable: true)]
    #[Groups(['festivo:read', 'festivo:write'])]
    private ?\DateTimeInterface $fechaFin = null;

    /**
     * Ámbito territorial. Determina qué centros aplican el festivo:
     *   NACIONAL → todos.
     *   AUTONOMICO → centros con `centro.ccaa = festivo.ccaa`.
     *   PROVINCIAL → centros con `centro.provincia = festivo.provincia`.
     *   LOCAL → solo `festivo.centro`.
     */
    #[ORM\Column(type: 'string', length: 16, enumType: AmbitoFestivo::class, options: ['default' => 'local'])]
    #[Groups(['festivo:read', 'festivo:write'])]
    private AmbitoFestivo $ambito = AmbitoFestivo::LOCAL;

    #[ORM\Column(type: 'string', length: 2, nullable: true, enumType: Ccaa::class)]
    #[Groups(['festivo:read', 'festivo:write'])]
    private ?Ccaa $ccaa = null;

    #[ORM\ManyToOne]
    #[ORM\JoinColumn(nullable: true, referencedColumnName: 'codigo')]
    #[Groups(['festivo:read', 'festivo:write'])]
    private ?Provincia $provincia = null;

    #[ORM\ManyToOne(inversedBy: 'festivos')]
    #[Groups(['festivo:read', 'festivo:write'])]
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

    public function getFechaInicio(): ?\DateTimeInterface
    {
        return $this->fechaInicio;
    }

    public function setFechaInicio(\DateTimeInterface $fechaInicio): static
    {
        $this->fechaInicio = $fechaInicio;
        return $this;
    }

    public function getFechaFin(): ?\DateTimeInterface
    {
        return $this->fechaFin;
    }

    public function setFechaFin(?\DateTimeInterface $fechaFin): static
    {
        $this->fechaFin = $fechaFin;
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

    public function getAmbito(): AmbitoFestivo { return $this->ambito; }
    public function setAmbito(AmbitoFestivo $a): static { $this->ambito = $a; return $this; }
    public function getCcaa(): ?Ccaa { return $this->ccaa; }
    public function setCcaa(?Ccaa $c): static { $this->ccaa = $c; return $this; }
    public function getProvincia(): ?Provincia { return $this->provincia; }
    public function setProvincia(?Provincia $p): static { $this->provincia = $p; return $this; }
}
