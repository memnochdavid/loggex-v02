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
use App\Attribute\LivePublish;
use App\Entity\Traits\SoftDeletableTrait;
use App\Entity\Traits\TimestampableTrait;
use App\Repository\HorarioRepository;
use App\State\SoftDeleteProcessor;
use Doctrine\DBAL\Types\Types;
use Doctrine\ORM\Mapping as ORM;
use Symfony\Component\Serializer\Attribute\Groups;
use Symfony\Component\Validator\Constraints as Assert;
use Symfony\Component\Validator\Context\ExecutionContextInterface;

#[ORM\Entity(repositoryClass: HorarioRepository::class)]
#[ORM\Table(name: 'horario')]
#[ORM\HasLifecycleCallbacks]
#[Assert\Callback('validateHoras')]
#[ApiResource(
    operations: [
        new Get(),
        new GetCollection(),
        new Post(),
        new Put(),
        new Delete(processor: SoftDeleteProcessor::class)
    ],
    normalizationContext: ['groups' => ['horario:read', 'timestamp:read', 'softdelete:read']],
    denormalizationContext: ['groups' => ['horario:write']]
)]
// Topic admin por centro + topic por grupo para vista personal del user.
// El topic /grupos/{gid}/schedule lo reciben profe del grupo + alumnos
// matriculados (firmados en JWT). Refresca su vista personal de horario.
#[LivePublish(
    topics: [
        '/admin/centros/{imparticion.grupo.centro.id}/horarios',
        '/grupos/{imparticion.grupo.id}/schedule',
    ],
    payloadGroups: ['horario:read', 'timestamp:read', 'softdelete:read'],
)]
#[ApiFilter(SearchFilter::class, properties: [
    'imparticion' => 'exact',
    'imparticion.grupo' => 'exact',
    'imparticion.profesor' => 'exact',
    'periodoLectivo' => 'exact',
    'periodoLectivo.grupo' => 'exact',
    'aula' => 'partial',
    'diaSemana' => 'exact',
    'imparticion.materia.nombre' => 'partial',
    'imparticion.profesor.nombre' => 'partial',
    'imparticion.profesor.apellidos' => 'partial'
])]
#[ApiFilter(OrderFilter::class, properties: [
    'diaSemana',
    'horaInicio',
    'id',
    'aula',
    'imparticion.materia.nombre',
    'imparticion.profesor.nombre'
], arguments: ['orderParameterName' => 'order'])]
class Horario
{
    use TimestampableTrait;
    use SoftDeletableTrait;

    #[ORM\Id]
    #[ORM\GeneratedValue]
    #[ORM\Column]
    #[Groups(['horario:read'])]
    private ?int $id = null;

    #[ORM\Column]
    #[Assert\NotBlank]
    #[Assert\Range(min: 1, max: 7, notInRangeMessage: 'El día de la semana debe estar entre 1 (lunes) y 7 (domingo).')]
    #[Groups(['horario:read', 'horario:write'])]
    private ?int $diaSemana = null;

    #[ORM\Column(type: Types::TIME_MUTABLE)]
    #[Assert\NotBlank]
    #[Groups(['horario:read', 'horario:write'])]
    private ?\DateTimeInterface $horaInicio = null;

    #[ORM\Column(type: Types::TIME_MUTABLE)]
    #[Assert\NotBlank]
    #[Groups(['horario:read', 'horario:write'])]
    private ?\DateTimeInterface $horaFin = null;

    #[ORM\Column(length: 255)]
    #[Assert\NotBlank]
    #[Assert\Length(max: 255)]
    #[Groups(['horario:read', 'horario:write'])]
    private ?string $aula = null;

    #[ORM\ManyToOne(inversedBy: 'horarios')]
    #[ORM\JoinColumn(nullable: false)]
    #[Assert\NotNull]
    #[Groups(['horario:read', 'horario:write'])]
    private ?Imparticion $imparticion = null;

    /**
     * Rango lectivo al que pertenece este placement. La migración Fase 1 de
     * `PeriodoLectivo` rellena este campo para todos los horarios existentes
     * con el rango único "Curso completo" del grupo, y luego pasa a NOT NULL.
     *
     * Doc: docs/hoja-de-ruta-periodos-lectivos.md
     */
    #[ORM\ManyToOne]
    #[ORM\JoinColumn(nullable: false, onDelete: 'CASCADE')]
    #[Groups(['horario:read', 'horario:write'])]
    private ?PeriodoLectivo $periodoLectivo = null;

    /**
     * Gemelo en otro grupo hermano. Marca permanente "este placement es la
     * misma clase física que otro" — usado por la sincronización de Fase D y
     * el solver de Fase C. Canonicalización (D-3 + decisión 2026-05-08): el
     * `gemelo` apunta SIEMPRE al horario raíz (el ORIGINAL, el más antiguo),
     * nunca a otra copia. Las copias clonadas desde otra copia se reasignan
     * al raíz directamente, evitando cadenas y simplificando la query
     * "todos los hermanos de X" a `WHERE id = X OR gemelo_id = X`.
     *
     * `ON DELETE SET NULL`: si se borra el raíz, las copias dejan de ser
     * gemelas pero sobreviven como placements independientes. Doc:
     * docs/hoja-de-ruta-clases-compartidas.md (Fase B).
     */
    #[ORM\ManyToOne(targetEntity: Horario::class)]
    #[ORM\JoinColumn(nullable: true, onDelete: 'SET NULL')]
    #[Groups(['horario:read'])]
    private ?Horario $gemelo = null;

    public function getId(): ?int
    {
        return $this->id;
    }

    public function getGemelo(): ?Horario
    {
        return $this->gemelo;
    }

    public function setGemelo(?Horario $gemelo): static
    {
        $this->gemelo = $gemelo;
        return $this;
    }

    /**
     * Devuelve la "raíz de hermandad": si este horario tiene gemelo, ese
     * gemelo (que por convención es siempre el raíz). Si no, este mismo.
     * Usado por servicios que necesitan canonicalizar antes de propagar.
     */
    public function getGemeloRoot(): self
    {
        return $this->gemelo ?? $this;
    }

    public function getDiaSemana(): ?int
    {
        return $this->diaSemana;
    }

    public function setDiaSemana(int $diaSemana): static
    {
        $this->diaSemana = $diaSemana;
        return $this;
    }

    public function getHoraInicio(): ?\DateTimeInterface
    {
        return $this->horaInicio;
    }

    public function setHoraInicio(\DateTimeInterface $horaInicio): static
    {
        $this->horaInicio = $horaInicio;
        return $this;
    }

    public function getHoraFin(): ?\DateTimeInterface
    {
        return $this->horaFin;
    }

    public function setHoraFin(\DateTimeInterface $horaFin): static
    {
        $this->horaFin = $horaFin;
        return $this;
    }

    public function getAula(): ?string
    {
        return $this->aula;
    }

    public function setAula(string $aula): static
    {
        $this->aula = $aula;
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

    public function getPeriodoLectivo(): ?PeriodoLectivo
    {
        return $this->periodoLectivo;
    }

    public function setPeriodoLectivo(?PeriodoLectivo $periodoLectivo): static
    {
        $this->periodoLectivo = $periodoLectivo;
        return $this;
    }

    public function validateHoras(ExecutionContextInterface $context): void
    {
        if ($this->horaInicio !== null && $this->horaFin !== null) {
            if ($this->horaFin <= $this->horaInicio) {
                $context->buildViolation('La hora de fin debe ser posterior a la hora de inicio.')
                    ->atPath('horaFin')
                    ->addViolation();
            }
        }
    }
}
