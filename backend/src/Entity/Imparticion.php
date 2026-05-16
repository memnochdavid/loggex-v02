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
use App\Doctrine\Filter\SearchAnyFilter;
use App\Entity\Traits\SoftDeletableTrait;
use App\Entity\Traits\TimestampableTrait;
use App\Repository\ImparticionRepository;
use App\State\SoftDeleteProcessor;
use Doctrine\Common\Collections\ArrayCollection;
use Doctrine\Common\Collections\Collection;
use Doctrine\ORM\Mapping as ORM;
use Symfony\Component\Serializer\Attribute\Groups;
use Symfony\Component\Validator\Constraints as Assert;

#[ORM\Entity(repositoryClass: ImparticionRepository::class)]
#[ORM\Table(name: 'imparticion')]
#[ORM\HasLifecycleCallbacks]
#[ApiResource(
    operations: [
        new Get(),
        new GetCollection(),
        new Post(),
        new Put(),
        new Delete(processor: SoftDeleteProcessor::class)
    ],
    normalizationContext: ['groups' => ['imparticion:read', 'timestamp:read', 'softdelete:read']],
    denormalizationContext: ['groups' => ['imparticion:write']]
)]
// Live updates al topic admin del centro al que pertenece el grupo. Si el
// grupo aún no tiene centro (caso resync CCAA con grupo huérfano) el topic
// se descarta y el evento no se publica — aceptable.
#[LivePublish(
    topics: ['/admin/centros/{grupo.centro.id}/imparticiones'],
    payloadGroups: ['imparticion:read', 'timestamp:read', 'softdelete:read'],
)]
#[ApiFilter(SearchFilter::class, properties: [
    'profesor' => 'exact',
    'profesor.nombre' => 'partial',
    'materia' => 'exact',
    'materia.nombre' => 'partial',
    'grupo' => 'exact',
    'grupo.nombre' => 'partial',
    'grupo.centro' => 'exact'
])]
#[ApiFilter(SearchAnyFilter::class, properties: ['profesor.nombre', 'profesor.apellidos', 'materia.nombre', 'materia.abreviatura', 'materia.codigoOficial', 'grupo.nombre', 'grupo.abreviatura'])]
#[ApiFilter(OrderFilter::class, properties: ['id', 'profesor.nombre', 'materia.nombre', 'grupo.nombre'], arguments: ['orderParameterName' => 'order'])]
class Imparticion
{
    use TimestampableTrait;
    use SoftDeletableTrait;

    #[ORM\Id]
    #[ORM\GeneratedValue]
    #[ORM\Column]
    #[Groups(['imparticion:read', 'horario:read', 'tarea:read'])]
    private ?int $id = null;

    // Nullable: el resync CCAA crea imparticiones para materias autonómicas
    // sin profesor, que el admin asigna después en /admin/imparticiones.
    #[ORM\ManyToOne(inversedBy: 'imparticiones')]
    #[ORM\JoinColumn(nullable: true)]
    #[Groups(['imparticion:read', 'imparticion:write', 'horario:read', 'tarea:read'])]
    private ?User $profesor = null;

    #[ORM\ManyToOne(inversedBy: 'imparticiones')]
    #[ORM\JoinColumn(nullable: false)]
    #[Assert\NotNull]
    #[Groups(['imparticion:read', 'imparticion:write', 'horario:read', 'tarea:read'])]
    private ?Materia $materia = null;

    #[ORM\ManyToOne(inversedBy: 'imparticiones')]
    #[ORM\JoinColumn(nullable: false)]
    #[Assert\NotNull]
    #[Groups(['imparticion:read', 'imparticion:write', 'horario:read', 'tarea:read'])]
    private ?Grupo $grupo = null;

    /**
     * Aula específica para esta materia/profesor (override). Si está rellena,
     * prevalece sobre Grupo.aulaDefault. Caso típico: laboratorio para
     * "Lenguajes de marcas", aula de música para una asignatura ESO.
     */
    #[ORM\Column(length: 100, nullable: true)]
    #[Assert\Length(max: 100)]
    #[Groups(['imparticion:read', 'imparticion:write', 'horario:read'])]
    private ?string $aulaEspecifica = null;

    /**
     * Override de modalidad per-grupo (D-A). NULL = hereda
     * `Materia.modalidad`. Permite que un centro trate, p.ej., las "Horas de
     * libre configuración" como `PRESENCIAL` (refuerzo en aula) en uno de sus
     * grupos aunque el catálogo nacional las marque como `NO_REGULAR`.
     *
     * Se fija al crear el grupo y no debe variar a mitad de curso (D-E):
     * cambiarla invalidaría placements existentes y la carga curricular.
     *
     * Consultar siempre vía `getEffectiveModalidad()` para no olvidar el
     * fallback al default de Materia.
     */
    #[ORM\Column(type: 'string', enumType: Modalidad::class, nullable: true)]
    #[Groups(['imparticion:read', 'imparticion:write'])]
    private ?Modalidad $modalidad = null;

    #[ORM\OneToMany(mappedBy: 'imparticion', targetEntity: Horario::class)]
    private Collection $horarios;

    #[ORM\OneToMany(mappedBy: 'imparticion', targetEntity: Tarea::class)]
    #[Groups(['imparticion:read'])] // Añadido para ver tareas anidadas
    private Collection $tareas;

    #[ORM\OneToMany(mappedBy: 'imparticion', targetEntity: Temario::class)]
    private Collection $temarios;

    #[ORM\OneToMany(mappedBy: 'imparticion', targetEntity: Asistencia::class)]
    private Collection $asistencias;

    public function __construct()
    {
        $this->horarios = new ArrayCollection();
        $this->tareas = new ArrayCollection();
        $this->temarios = new ArrayCollection();
        $this->asistencias = new ArrayCollection();
    }

    public function getId(): ?int
    {
        return $this->id;
    }

    public function getProfesor(): ?User
    {
        return $this->profesor;
    }

    public function setProfesor(?User $profesor): static
    {
        $this->profesor = $profesor;
        return $this;
    }

    public function getMateria(): ?Materia
    {
        return $this->materia;
    }

    public function setMateria(?Materia $materia): static
    {
        $this->materia = $materia;
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

    public function getAulaEspecifica(): ?string
    {
        return $this->aulaEspecifica;
    }

    public function setAulaEspecifica(?string $aulaEspecifica): static
    {
        $this->aulaEspecifica = $aulaEspecifica;
        return $this;
    }

    public function getModalidad(): ?Modalidad
    {
        return $this->modalidad;
    }

    public function setModalidad(?Modalidad $modalidad): static
    {
        $this->modalidad = $modalidad;
        return $this;
    }

    /**
     * Modalidad efectiva: override propio o default de la materia. Punto único
     * de consulta para el solver, CapacityPlanner, rejilla y PDF — nadie debe
     * leer `$imparticion->getModalidad()` directamente sin el fallback.
     */
    public function getEffectiveModalidad(): Modalidad
    {
        if ($this->modalidad !== null) {
            return $this->modalidad;
        }
        return $this->materia?->getModalidad() ?? Modalidad::PRESENCIAL;
    }

    /**
     * Cascada del aula efectiva para los placements del horario:
     *   1. Si la imparticion tiene `aulaEspecifica` → esa.
     *   2. Si no, si el grupo tiene `aulaDefault` → esa.
     *   3. Si no, fallback automático: "Aula " + grupo.abreviatura → "Aula".
     *
     * El cuarto nivel (override puntual por slot) vive en `Horario.aula` y
     * lo gestiona el editor: el solver inicializa con esta cascada, pero el
     * admin puede sobrescribirlo manualmente sin que la cascada lo restablezca.
     */
    public function resolveAula(): string
    {
        if ($this->aulaEspecifica) {
            return $this->aulaEspecifica;
        }
        $aulaGrupo = $this->grupo?->getAulaDefault();
        if ($aulaGrupo) {
            return $aulaGrupo;
        }
        $abrev = $this->grupo?->getAbreviatura();
        return $abrev ? 'Aula ' . $abrev : 'Aula';
    }

    /**
     * @return Collection<int, Horario>
     */
    public function getHorarios(): Collection
    {
        return $this->horarios;
    }

    public function addHorario(Horario $horario): static
    {
        if (!$this->horarios->contains($horario)) {
            $this->horarios->add($horario);
            $horario->setImparticion($this);
        }

        return $this;
    }

    public function removeHorario(Horario $horario): static
    {
        if ($this->horarios->removeElement($horario)) {
            // set the owning side to null (unless already changed)
            if ($horario->getImparticion() === $this) {
                $horario->setImparticion(null);
            }
        }

        return $this;
    }

    /**
     * @return Collection<int, Tarea>
     */
    public function getTareas(): Collection
    {
        return $this->tareas;
    }

    public function addTarea(Tarea $tarea): static
    {
        if (!$this->tareas->contains($tarea)) {
            $this->tareas->add($tarea);
            $tarea->setImparticion($this);
        }

        return $this;
    }

    public function removeTarea(Tarea $tarea): static
    {
        if ($this->tareas->removeElement($tarea)) {
            // set the owning side to null (unless already changed)
            if ($tarea->getImparticion() === $this) {
                $tarea->setImparticion(null);
            }
        }

        return $this;
    }
}
