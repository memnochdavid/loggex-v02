<?php

namespace App\Entity;

use ApiPlatform\Doctrine\Orm\Filter\OrderFilter;
use ApiPlatform\Doctrine\Orm\Filter\SearchFilter;
use ApiPlatform\Metadata\ApiFilter;
use ApiPlatform\Metadata\ApiResource;
use ApiPlatform\Metadata\Delete;
use ApiPlatform\Metadata\Get;
use ApiPlatform\Metadata\GetCollection;
use ApiPlatform\Metadata\Patch;
use ApiPlatform\Metadata\Post;
use ApiPlatform\Metadata\Put;
use App\Entity\Traits\SoftDeletableTrait;
use App\Entity\Traits\TimestampableTrait;
use App\Repository\PeriodoLectivoImparticionRepository;
use Doctrine\ORM\Mapping as ORM;
use Symfony\Component\Serializer\Attribute\Groups;
use Symfony\Component\Validator\Constraints as Assert;

/**
 * Entidad de unión PeriodoLectivo × Imparticion (D-A).
 *
 * Permite que una misma `Imparticion` viva en N rangos del curso con distinto
 * peso semanal en cada uno. Si `minutosSemanales` es NULL, se hereda
 * `Materia.minutosSemanales` como default; si está set, ese valor manda en
 * este rango concreto.
 *
 * Si una imparticion NO tiene fila en un rango, no existe en ese rango — el
 * solver y el `CapacityPlanner` no la considerarán.
 *
 * Doc: docs/hoja-de-ruta-periodos-lectivos.md §1
 */
#[ORM\Entity(repositoryClass: PeriodoLectivoImparticionRepository::class)]
#[ORM\Table(name: 'periodo_lectivo_imparticion')]
#[ORM\UniqueConstraint(name: 'uniq_pli', columns: ['periodo_lectivo_id', 'imparticion_id'])]
#[ORM\HasLifecycleCallbacks]
#[ApiResource(
    operations: [
        new Get(),
        new GetCollection(),
        new Post(),
        new Put(),
        new Patch(),
        // Hard delete: PLI es derivativo (la auditoría vive en PL). Soft delete
        // chocaría con la unique (periodoLectivo, imparticion) si el admin
        // desactiva una materia y luego la reactiva en el mismo rango.
        new Delete()
    ],
    // Sin `periodo_lectivo:read` aquí: si se incluye, el ciclo PLI → PL →
    // PL.imparticiones (Collection<PLI>) → PLI → PL... dispara la explosión
    // de eager-loading de API Platform ("max_joins exceeded").
    // Los grupos `periodo_lectivo:read` en los campos siguen sirviendo cuando
    // un endpoint de PL normaliza sus PLIs embebidos (contexto del PL, no
    // del PLI), que es lo que alimenta el banner anual y el modal de Fase 4.
    normalizationContext: ['groups' => ['pli:read', 'timestamp:read', 'softdelete:read']],
    denormalizationContext: ['groups' => ['pli:write']]
)]
#[ApiFilter(SearchFilter::class, properties: [
    'periodoLectivo' => 'exact',
    'periodoLectivo.grupo' => 'exact',
    'imparticion' => 'exact',
    'imparticion.grupo' => 'exact',
])]
#[ApiFilter(OrderFilter::class, properties: ['id'], arguments: ['orderParameterName' => 'order'])]
class PeriodoLectivoImparticion
{
    use TimestampableTrait;
    use SoftDeletableTrait;

    #[ORM\Id]
    #[ORM\GeneratedValue]
    #[ORM\Column]
    #[Groups(['pli:read', 'periodo_lectivo:read'])]
    private ?int $id = null;

    #[ORM\ManyToOne(inversedBy: 'imparticiones')]
    #[ORM\JoinColumn(nullable: false, onDelete: 'CASCADE')]
    #[Groups(['pli:read', 'pli:write'])]
    private ?PeriodoLectivo $periodoLectivo = null;

    #[ORM\ManyToOne]
    #[ORM\JoinColumn(nullable: false, onDelete: 'CASCADE')]
    #[Groups(['pli:read', 'pli:write', 'periodo_lectivo:read'])]
    private ?Imparticion $imparticion = null;

    /**
     * Minutos semanales de esta imparticion en este rango concreto. Si NULL,
     * hereda `Materia.minutosSemanales`. Permite que una materia anual tenga
     * menos minutos en el rango FCT, por ejemplo.
     */
    #[ORM\Column(nullable: true)]
    #[Assert\PositiveOrZero(message: 'minutosSemanales debe ser >= 0.')]
    #[Groups(['pli:read', 'pli:write', 'periodo_lectivo:read'])]
    private ?int $minutosSemanales = null;

    public function getId(): ?int
    {
        return $this->id;
    }

    public function getPeriodoLectivo(): ?PeriodoLectivo
    {
        return $this->periodoLectivo;
    }

    public function setPeriodoLectivo(?PeriodoLectivo $periodoLectivo): static
    {
        $this->periodoLectivo = $periodoLectivo;
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

    public function getMinutosSemanales(): ?int
    {
        return $this->minutosSemanales;
    }

    public function setMinutosSemanales(?int $minutosSemanales): static
    {
        $this->minutosSemanales = $minutosSemanales;
        return $this;
    }

    /**
     * Minutos efectivos: el override propio o el default de la materia.
     * Punto único de consulta para el solver / CapacityPlanner.
     */
    public function getEffectiveMinutosSemanales(): int
    {
        if ($this->minutosSemanales !== null) {
            return $this->minutosSemanales;
        }
        return $this->imparticion?->getMateria()?->getMinutosSemanales() ?? 0;
    }
}
