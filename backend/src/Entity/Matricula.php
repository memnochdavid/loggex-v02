<?php

namespace App\Entity;

use ApiPlatform\Doctrine\Orm\Filter\OrderFilter;
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
use App\Repository\MatriculaRepository;
use App\State\SoftDeleteProcessor;
use Doctrine\ORM\Mapping as ORM;
use Symfony\Component\Serializer\Attribute\Groups;

#[ORM\Entity(repositoryClass: MatriculaRepository::class)]
#[ORM\Table(name: 'matricula')]
#[ORM\HasLifecycleCallbacks]
#[ApiResource(
    operations: [
        new Get(),
        new GetCollection(),
        new Post(),
        new Put(),
        new Delete(processor: SoftDeleteProcessor::class)
    ],
    normalizationContext: ['groups' => ['matricula:read', 'timestamp:read', 'softdelete:read']],
    denormalizationContext: ['groups' => ['matricula:write']]
)]
#[ApiFilter(SearchFilter::class, properties: [
    'alumno' => 'exact',
    'alumno.nombre' => 'partial',
    'grupo' => 'exact',
    'grupo.nombre' => 'partial'
])]
#[ApiFilter(OrderFilter::class, properties: ['id', 'alumno.nombre', 'grupo.nombre'], arguments: ['orderParameterName' => 'order'])]
class Matricula
{
    use TimestampableTrait;
    use SoftDeletableTrait;

    #[ORM\Id]
    #[ORM\GeneratedValue]
    #[ORM\Column]
    #[Groups(['matricula:read'])]
    private ?int $id = null;

    #[ORM\ManyToOne(inversedBy: 'matriculas')]
    #[ORM\JoinColumn(nullable: false)]
    #[Groups(['matricula:read', 'matricula:write'])]
    private ?User $alumno = null;

    #[ORM\ManyToOne(inversedBy: 'matriculas')]
    #[ORM\JoinColumn(nullable: false)]
    #[Groups(['matricula:read', 'matricula:write'])]
    private ?Grupo $grupo = null;

    public function getId(): ?int
    {
        return $this->id;
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

    public function getGrupo(): ?Grupo
    {
        return $this->grupo;
    }

    public function setGrupo(?Grupo $grupo): static
    {
        $this->grupo = $grupo;
        return $this;
    }
}
