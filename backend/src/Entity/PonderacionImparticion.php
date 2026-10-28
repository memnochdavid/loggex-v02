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
use App\Entity\Traits\SoftDeletableTrait;
use App\Entity\Traits\TimestampableTrait;
use App\Repository\PonderacionImparticionRepository;
use App\State\SoftDeleteProcessor;
use Doctrine\ORM\Mapping as ORM;
use Symfony\Bridge\Doctrine\Validator\Constraints\UniqueEntity;
use Symfony\Component\Serializer\Attribute\Groups;
use Symfony\Component\Validator\Constraints as Assert;

#[ORM\Entity(repositoryClass: PonderacionImparticionRepository::class)]
#[ORM\Table(name: 'ponderacion_imparticion')]
#[ORM\UniqueConstraint(name: 'unique_imparticion_tipo', columns: ['imparticion_id', 'tipo_tarea'])]
#[ORM\HasLifecycleCallbacks]
#[UniqueEntity(fields: ['imparticion', 'tipoTarea'], message: 'Ya existe una ponderación para este tipo en esta impartición.')]
#[ApiResource(
    operations: [
        new Get(),
        new GetCollection(),
        new Post(),
        new Put(),
        new Delete(processor: SoftDeleteProcessor::class)
    ],
    normalizationContext: ['groups' => ['ponderacion:read', 'timestamp:read', 'softdelete:read']],
    denormalizationContext: ['groups' => ['ponderacion:write']]
)]
#[ApiFilter(SearchFilter::class, properties: [
    'imparticion' => 'exact',
    'tipoTarea' => 'exact'
])]
class PonderacionImparticion
{
    use TimestampableTrait;
    use SoftDeletableTrait;

    #[ORM\Id]
    #[ORM\GeneratedValue]
    #[ORM\Column]
    #[Groups(['ponderacion:read'])]
    private ?int $id = null;

    #[ORM\ManyToOne(targetEntity: Imparticion::class)]
    #[ORM\JoinColumn(nullable: false)]
    #[Groups(['ponderacion:read', 'ponderacion:write'])]
    private ?Imparticion $imparticion = null;

    #[ORM\Column(length: 20)]
    #[Assert\Choice(choices: ['examen', 'tarea', 'practica'], message: 'El tipo debe ser examen, tarea o practica.')]
    #[Groups(['ponderacion:read', 'ponderacion:write'])]
    private ?string $tipoTarea = null;

    #[ORM\Column]
    #[Assert\Range(min: 0, max: 1, notInRangeMessage: 'El peso debe estar entre 0 y 1.')]
    #[Groups(['ponderacion:read', 'ponderacion:write'])]
    private ?float $peso = null;

    public function getId(): ?int
    {
        return $this->id;
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

    public function getTipoTarea(): ?string
    {
        return $this->tipoTarea;
    }

    public function setTipoTarea(string $tipoTarea): static
    {
        $this->tipoTarea = $tipoTarea;
        return $this;
    }

    public function getPeso(): ?float
    {
        return $this->peso;
    }

    public function setPeso(float $peso): static
    {
        $this->peso = $peso;
        return $this;
    }
}
