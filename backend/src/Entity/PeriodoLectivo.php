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
use App\Repository\PeriodoLectivoRepository;
use App\State\PeriodoLectivoCreateProcessor;
use App\State\PeriodoLectivoSoftDeleteProcessor;
use App\State\SoftDeleteProcessor;
use Doctrine\Common\Collections\ArrayCollection;
use Doctrine\Common\Collections\Collection;
use Doctrine\DBAL\Types\Types;
use Doctrine\ORM\Mapping as ORM;
use Symfony\Component\Serializer\Attribute\Groups;
use Symfony\Component\Validator\Constraints as Assert;

/**
 * Rango de fecha del calendario lectivo de un grupo, con su propia
 * `JornadaTipo` y su propio set de imparticiones activas (con minutos
 * por rango). Resuelve la tensión LOMLOE 32h/sem vs jornada real 27.5h/sem
 * sin recurrir al parche de jornadas 35h: el centro parte el curso en N
 * rangos y el cómputo anual cuadra aunque la suma semanal no llegue.
 *
 * Doc: docs/hoja-de-ruta-periodos-lectivos.md
 *
 * Reglas (D-F, D-G):
 *  - Dos rangos del mismo grupo no se solapan.
 *  - Pueden quedar huecos durante edición; se valida cobertura completa
 *    al "cerrar curso" (acción explícita, futuro).
 *  - `jornadaTipo` nullable: si null, fallback a `Grupo.getEffectiveJornadaTipo()`.
 *  - Al crear un grupo nuevo, se auto-crea un rango único "Curso completo"
 *    (D-H). La migración Fase 1 hace lo mismo retroactivamente.
 */
#[ORM\Entity(repositoryClass: PeriodoLectivoRepository::class)]
#[ORM\Table(name: 'periodo_lectivo')]
#[ORM\Index(columns: ['grupo_id', 'fecha_inicio', 'fecha_fin'], name: 'idx_pl_fechas')]
#[ORM\HasLifecycleCallbacks]
#[ApiResource(
    operations: [
        new Get(),
        new GetCollection(),
        new Post(processor: PeriodoLectivoCreateProcessor::class),
        new Put(),
        new Patch(),
        new Delete(processor: PeriodoLectivoSoftDeleteProcessor::class)
    ],
    normalizationContext: ['groups' => ['periodo_lectivo:read', 'timestamp:read', 'softdelete:read']],
    denormalizationContext: ['groups' => ['periodo_lectivo:write']]
)]
#[ApiFilter(SearchFilter::class, properties: [
    'grupo' => 'exact',
    'grupo.centro' => 'exact',
    'jornadaTipo' => 'exact',
])]
#[ApiFilter(OrderFilter::class, properties: ['orden', 'fechaInicio', 'fechaFin', 'id'], arguments: ['orderParameterName' => 'order'])]
class PeriodoLectivo
{
    use TimestampableTrait;
    use SoftDeletableTrait;

    #[ORM\Id]
    #[ORM\GeneratedValue]
    #[ORM\Column]
    #[Groups(['periodo_lectivo:read', 'horario:read'])]
    private ?int $id = null;

    #[ORM\ManyToOne]
    #[ORM\JoinColumn(nullable: false, onDelete: 'CASCADE')]
    #[Groups(['periodo_lectivo:read', 'periodo_lectivo:write'])]
    private ?Grupo $grupo = null;

    /**
     * Jornada de este rango. Si NULL, fallback a `Grupo.getEffectiveJornadaTipo()`
     * (override del grupo o jornada del itinerario). Resolver siempre vía
     * `getEffectiveJornadaTipo()` de esta entidad, no leer el campo directo.
     */
    #[ORM\ManyToOne]
    #[ORM\JoinColumn(nullable: true, onDelete: 'SET NULL')]
    #[Groups(['periodo_lectivo:read', 'periodo_lectivo:write'])]
    private ?JornadaTipo $jornadaTipo = null;

    #[ORM\Column(length: 150)]
    #[Assert\NotBlank]
    #[Groups(['periodo_lectivo:read', 'periodo_lectivo:write'])]
    private ?string $nombre = null;

    #[ORM\Column(type: Types::DATE_MUTABLE)]
    #[Assert\NotNull]
    #[Groups(['periodo_lectivo:read', 'periodo_lectivo:write'])]
    private ?\DateTimeInterface $fechaInicio = null;

    #[ORM\Column(type: Types::DATE_MUTABLE)]
    #[Assert\NotNull]
    #[Assert\Expression(
        'this.getFechaInicio() === null or this.getFechaFin() === null or this.getFechaFin() > this.getFechaInicio()',
        message: 'fechaFin debe ser posterior a fechaInicio.'
    )]
    #[Groups(['periodo_lectivo:read', 'periodo_lectivo:write'])]
    private ?\DateTimeInterface $fechaFin = null;

    /**
     * Posición en el timeline visual. Por defecto 0; los rangos se ordenan
     * por (orden, fechaInicio) en el editor.
     */
    #[ORM\Column(options: ['default' => 0])]
    #[Groups(['periodo_lectivo:read', 'periodo_lectivo:write'])]
    private int $orden = 0;

    #[ORM\OneToMany(mappedBy: 'periodoLectivo', targetEntity: PeriodoLectivoImparticion::class, cascade: ['persist'], orphanRemoval: true)]
    #[Groups(['periodo_lectivo:read'])]
    private Collection $imparticiones;

    public function __construct()
    {
        $this->imparticiones = new ArrayCollection();
    }

    public function getId(): ?int
    {
        return $this->id;
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

    public function getJornadaTipo(): ?JornadaTipo
    {
        return $this->jornadaTipo;
    }

    public function setJornadaTipo(?JornadaTipo $jornadaTipo): static
    {
        $this->jornadaTipo = $jornadaTipo;
        return $this;
    }

    /**
     * Jornada efectiva del rango: la propia si está set, sino fallback a la
     * jornada efectiva del grupo (override del grupo o jornada del itinerario).
     * Punto único que el solver, el `CapacityPlanner` y el editor deben consultar.
     */
    public function getEffectiveJornadaTipo(): ?JornadaTipo
    {
        return $this->jornadaTipo ?? $this->grupo?->getEffectiveJornadaTipo();
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

    public function setFechaFin(\DateTimeInterface $fechaFin): static
    {
        $this->fechaFin = $fechaFin;
        return $this;
    }

    public function getOrden(): int
    {
        return $this->orden;
    }

    public function setOrden(int $orden): static
    {
        $this->orden = $orden;
        return $this;
    }

    /**
     * @return Collection<int, PeriodoLectivoImparticion>
     */
    public function getImparticiones(): Collection
    {
        return $this->imparticiones;
    }

    public function addImparticion(PeriodoLectivoImparticion $pli): static
    {
        if (!$this->imparticiones->contains($pli)) {
            $this->imparticiones->add($pli);
            $pli->setPeriodoLectivo($this);
        }
        return $this;
    }

    public function removeImparticion(PeriodoLectivoImparticion $pli): static
    {
        if ($this->imparticiones->removeElement($pli)) {
            if ($pli->getPeriodoLectivo() === $this) {
                $pli->setPeriodoLectivo(null);
            }
        }
        return $this;
    }
}
