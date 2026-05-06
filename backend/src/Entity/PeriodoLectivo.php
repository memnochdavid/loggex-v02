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
use Symfony\Component\Validator\Context\ExecutionContextInterface;

/**
 * Modelo semanal puro (refactor 2026-05-06). Cada grupo tiene:
 *  - **1 PLANTILLA** (`tipo=PLANTILLA`) sin fechas, con los Horarios y PLIs
 *    por defecto del curso. Es el horario "que aplica todas las semanas
 *    salvo excepción".
 *  - **0..N SEMANA** (`tipo=SEMANA`) con `fechaInicio`, `fechaFin`,
 *    `semanaNumero` y `plantillaBase` apuntando a su PLANTILLA. Lazy
 *    on-demand: solo se crean cuando hay un override puntual (intercambio
 *    profe, sustitución, semana cultural, festivo no anticipado).
 *
 * El `HorarioRenderService` compone PLANTILLA + SEMANA al renderizar el
 * horario de una fecha concreta (la SEMANA gana cuando existe).
 *
 * Doc: docs/hoja-de-ruta-modelo-semanal.md §11.
 *
 * Reglas:
 *  - PLANTILLA: 1 viva por grupo (deleted=false). Sin fechas. Sin
 *    `plantillaBase` ni `semanaNumero`.
 *  - SEMANA: fechaInicio/Fin NOT NULL en lógica de aplicación,
 *    `plantillaBase` NOT NULL apuntando a una PLANTILLA del mismo grupo,
 *    `semanaNumero` 1..N. Dos SEMANAs del mismo grupo no se solapan.
 *  - `jornadaTipo` nullable en ambos tipos. Si null, fallback a
 *    `Grupo.getEffectiveJornadaTipo()`.
 *
 * Migración previa que tenía rangos contiguos: ver migration
 * `Version20260506180000` (wipe + alter), bitácora de la Fase A2 en el
 * doc del refactor semanal.
 */
#[ORM\Entity(repositoryClass: PeriodoLectivoRepository::class)]
#[ORM\Table(name: 'periodo_lectivo')]
#[ORM\Index(columns: ['grupo_id', 'fecha_inicio', 'fecha_fin'], name: 'idx_pl_fechas')]
#[ORM\Index(columns: ['grupo_id', 'tipo'], name: 'idx_pl_grupo_tipo')]
#[ORM\Index(columns: ['plantilla_base_id'], name: 'idx_pl_plantilla_base')]
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
     * Discriminator del modelo semanal. PLANTILLA = horario por defecto del
     * grupo (sin fechas). SEMANA = override puntual de una semana concreta.
     */
    #[ORM\Column(length: 16, enumType: TipoPeriodoLectivo::class)]
    #[Assert\NotNull]
    #[Groups(['periodo_lectivo:read', 'periodo_lectivo:write', 'horario:read'])]
    private ?TipoPeriodoLectivo $tipo = TipoPeriodoLectivo::PLANTILLA;

    /**
     * Ordinal de la semana 1..N para tipo=SEMANA. NULL para PLANTILLA.
     */
    #[ORM\Column(nullable: true)]
    #[Assert\PositiveOrZero]
    #[Groups(['periodo_lectivo:read', 'periodo_lectivo:write'])]
    private ?int $semanaNumero = null;

    /**
     * FK self-ref a la PLANTILLA del mismo grupo. NOT NULL solo si
     * tipo=SEMANA; NULL para la propia PLANTILLA. ON DELETE CASCADE: borrar
     * la PLANTILLA arrastra todas sus SEMANAs.
     */
    #[ORM\ManyToOne(targetEntity: PeriodoLectivo::class)]
    #[ORM\JoinColumn(nullable: true, onDelete: 'CASCADE')]
    #[Groups(['periodo_lectivo:read', 'periodo_lectivo:write'])]
    private ?PeriodoLectivo $plantillaBase = null;

    /**
     * Jornada de este PL. Si NULL, fallback a `Grupo.getEffectiveJornadaTipo()`
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

    /**
     * Fecha inicio de la semana lectiva. NULL para PLANTILLA (sin fechas),
     * NOT NULL en lógica de aplicación para SEMANA.
     */
    #[ORM\Column(type: Types::DATE_MUTABLE, nullable: true)]
    #[Groups(['periodo_lectivo:read', 'periodo_lectivo:write'])]
    private ?\DateTimeInterface $fechaInicio = null;

    /**
     * Fecha fin de la semana lectiva. NULL para PLANTILLA, NOT NULL para
     * SEMANA. Si está set debe ser posterior a fechaInicio.
     */
    #[ORM\Column(type: Types::DATE_MUTABLE, nullable: true)]
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

    public function setFechaInicio(?\DateTimeInterface $fechaInicio): static
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

    public function getTipo(): ?TipoPeriodoLectivo
    {
        return $this->tipo;
    }

    public function setTipo(TipoPeriodoLectivo $tipo): static
    {
        $this->tipo = $tipo;
        return $this;
    }

    public function isPlantilla(): bool
    {
        return $this->tipo === TipoPeriodoLectivo::PLANTILLA;
    }

    public function isSemana(): bool
    {
        return $this->tipo === TipoPeriodoLectivo::SEMANA;
    }

    public function getSemanaNumero(): ?int
    {
        return $this->semanaNumero;
    }

    public function setSemanaNumero(?int $semanaNumero): static
    {
        $this->semanaNumero = $semanaNumero;
        return $this;
    }

    public function getPlantillaBase(): ?PeriodoLectivo
    {
        return $this->plantillaBase;
    }

    public function setPlantillaBase(?PeriodoLectivo $plantillaBase): static
    {
        $this->plantillaBase = $plantillaBase;
        return $this;
    }

    /**
     * Validación de coherencia tipo↔campos.
     *
     * No usamos check constraints en BD (MariaDB 10.11 los ignora). La
     * validación se aplica en POST/PUT/PATCH vía API Platform y en cualquier
     * `validate()` manual.
     */
    #[Assert\Callback]
    public function validarCoherenciaTipo(ExecutionContextInterface $context): void
    {
        if ($this->tipo === null) {
            return;  // ya cubierto por Assert\NotNull en la propiedad
        }

        if ($this->isPlantilla()) {
            if ($this->fechaInicio !== null) {
                $context->buildViolation('PLANTILLA no debe tener fechaInicio.')
                    ->atPath('fechaInicio')->addViolation();
            }
            if ($this->fechaFin !== null) {
                $context->buildViolation('PLANTILLA no debe tener fechaFin.')
                    ->atPath('fechaFin')->addViolation();
            }
            if ($this->plantillaBase !== null) {
                $context->buildViolation('PLANTILLA no debe tener plantillaBase.')
                    ->atPath('plantillaBase')->addViolation();
            }
            if ($this->semanaNumero !== null) {
                $context->buildViolation('PLANTILLA no debe tener semanaNumero.')
                    ->atPath('semanaNumero')->addViolation();
            }
            return;
        }

        // tipo=SEMANA
        if ($this->fechaInicio === null) {
            $context->buildViolation('SEMANA requiere fechaInicio.')
                ->atPath('fechaInicio')->addViolation();
        }
        if ($this->fechaFin === null) {
            $context->buildViolation('SEMANA requiere fechaFin.')
                ->atPath('fechaFin')->addViolation();
        }
        if ($this->plantillaBase === null) {
            $context->buildViolation('SEMANA requiere plantillaBase.')
                ->atPath('plantillaBase')->addViolation();
        } elseif ($this->grupo !== null && $this->plantillaBase->getGrupo() !== $this->grupo) {
            $context->buildViolation('plantillaBase debe pertenecer al mismo grupo.')
                ->atPath('plantillaBase')->addViolation();
        } elseif ($this->plantillaBase->getTipo() !== TipoPeriodoLectivo::PLANTILLA) {
            $context->buildViolation('plantillaBase debe ser tipo PLANTILLA.')
                ->atPath('plantillaBase')->addViolation();
        }
    }
}
