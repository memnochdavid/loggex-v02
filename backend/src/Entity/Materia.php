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
use App\Attribute\LivePublish;
use App\Doctrine\Filter\SearchAnyFilter;
use App\Entity\Catalogo\CatalogoMateria;
use App\Entity\Catalogo\TipoMateria;
use App\Entity\Traits\SoftDeletableTrait;
use App\Entity\Traits\TimestampableTrait;
use App\Repository\MateriaRepository;
use App\State\SoftDeleteProcessor;
use Doctrine\Common\Collections\ArrayCollection;
use Doctrine\Common\Collections\Collection;
use Doctrine\ORM\Mapping as ORM;
use Symfony\Component\Serializer\Attribute\Groups;

#[ORM\Entity(repositoryClass: MateriaRepository::class)]
#[ORM\Table(name: 'materia')]
#[ORM\HasLifecycleCallbacks]
#[ApiResource(
    operations: [
        new Get(),
        new GetCollection(),
        new Post(),
        new Put(),
        // Patch (merge-patch+json) para mutaciones parciales — usado por
        // `MateriasItinerarioModal` para añadir/quitar itinerarios sin tener
        // que reenviar el resto de campos de la materia.
        new Patch(),
        new Delete(processor: SoftDeleteProcessor::class)
    ],
    normalizationContext: ['groups' => ['materia:read', 'timestamp:read', 'softdelete:read']],
    denormalizationContext: ['groups' => ['materia:write']]
)]
#[LivePublish(
    topics: ['/admin/centros/{itinerarios[].centro.id}/materias'],
    payloadGroups: ['materia:read', 'timestamp:read', 'softdelete:read'],
)]
#[ApiFilter(SearchFilter::class, properties: [
    'nombre' => 'partial',
    'abreviatura' => 'partial',
    'codigoOficial' => 'partial',
    'itinerarios' => 'exact',
    'itinerarios.nombre' => 'partial',
    'itinerarios.centro' => 'exact',
    'curso' => 'exact'
])]
#[ApiFilter(SearchAnyFilter::class, properties: ['nombre', 'abreviatura', 'codigoOficial'])]
#[ApiFilter(OrderFilter::class, properties: ['nombre', 'abreviatura', 'codigoOficial', 'curso', 'id'], arguments: ['orderParameterName' => 'order'])]
class Materia
{
    use TimestampableTrait;
    use SoftDeletableTrait;

    #[ORM\Id]
    #[ORM\GeneratedValue]
    #[ORM\Column]
    #[Groups(['materia:read', 'imparticion:read', 'horario:read', 'tarea:read'])] // Añadido imparticion:read, horario:read, tarea:read
    private ?int $id = null;

    #[ORM\Column(length: 255)]
    #[Groups(['materia:read', 'materia:write', 'imparticion:read', 'horario:read', 'tarea:read'])] // Añadido tarea:read
    private ?string $nombre = null;

    #[ORM\Column(length: 50, nullable: true)]
    #[Groups(['materia:read', 'materia:write', 'imparticion:read', 'horario:read', 'tarea:read'])] // Añadido tarea:read
    private ?string $codigoOficial = null;

    /**
     * Forma corta del nombre para contextos con poco espacio horizontal
     * (vista móvil de AccordionView, TimeTable, etc.).
     */
    #[ORM\Column(length: 16, nullable: true)]
    #[Groups(['materia:read', 'materia:write', 'imparticion:read', 'horario:read', 'tarea:read'])]
    private ?string $abreviatura = null;

    #[ORM\Column]
    #[Groups(['materia:read', 'materia:write', 'imparticion:read'])]
    private ?int $curso = null;

    /**
     * Carga lectiva semanal en MINUTOS. Permite valores que no encajan en horas
     * enteras (90 min, 75 min, 1h30 = 90, etc.) — frecuente en jornadas reales
     * con bloques mixtos. La UI muestra horas decimales (helper `minToHoras`).
     *
     * Obligatorio en FP (donde el currículo nacional las define). En
     * ESO/Bachillerato es opcional: el RD nacional solo fija horas mínimas
     * totales por etapa, y el reparto curso a curso lo decide cada CCAA. El
     * admin puede dejarlo en blanco hasta confirmar el reparto regional.
     *
     * NOTA (Fase 5 PL fix 2026-04-29): aunque sigue siendo el dato persistido
     * para la jornada típica de la materia, el objetivo curricular ANUAL ahora
     * lo fija `horasTotales` (ver abajo). Las h/sem son una sugerencia derivada
     * que el centro adapta según calendario; lo legal LOMLOE son las horas
     * totales anuales del módulo (BOE/BOJA).
     */
    #[ORM\Column(nullable: true)]
    #[Groups(['materia:read', 'materia:write', 'imparticion:read'])]
    private ?int $minutosSemanales = null;

    /**
     * Carga lectiva ANUAL en HORAS, según el RD del título (BOE/BOJA).
     * Es la "ley LOMLOE" — la inspección comprueba que cada módulo se haya
     * impartido durante este número de horas en el curso. El reparto en h/sem
     * es flexible y se adapta al calendario real del centro:
     *   - Calendario 36 sem: h/sem = horasTotales / 36 (LOMLOE estándar).
     *   - Calendario 38 sem: h/sem = horasTotales / 38 (más sem, menos h/sem).
     *   - Si la jornada slots < Σ h/sem, el centro alarga el calendario para
     *     impartir las horas debidas (ver `semanasOptimas` en frontend).
     *
     * Backfill (migration Version20260429xxxxxx): ROUND(minutos_semanales × 36 / 60).
     * Mantiene el comportamiento previo (cuando solo había min/sem × 36 implícito)
     * y deja las h totales editables por el admin si difieren del catálogo.
     */
    #[ORM\Column(nullable: true)]
    #[Groups(['materia:read', 'materia:write', 'imparticion:read'])]
    private ?int $horasTotales = null;

    /**
     * Tipo de materia (TRONCAL, ESPECIFICA, OPTATIVA, MODULO, FCT, …) — re-usa
     * el enum del catálogo. Nullable porque las materias FP existentes pre-ESO
     * no lo tienen. Lo rellena la materialización desde catálogo (catalogoOrigen)
     * o el admin manualmente.
     */
    #[ORM\Column(type: 'string', enumType: TipoMateria::class, nullable: true)]
    #[Groups(['materia:read', 'materia:write', 'imparticion:read'])]
    private ?TipoMateria $tipo = null;

    /**
     * Modalidad de imparticion (D-A): separa placement físico de carga
     * curricular. Default `PRESENCIAL` (D-B): preserva comportamiento previo
     * a 2026-04-29 sin riesgo de regresión.
     *
     * Solo `PRESENCIAL` ocupa slots del horario; el resto (FCT, NO_REGULAR,
     * AUTONOMA) cuenta al currículo total pero no al placement.
     *
     * Override grupo-level posible vía `Imparticion.modalidad`
     * (consultar siempre con `Imparticion::getEffectiveModalidad()`).
     */
    #[ORM\Column(type: 'string', enumType: Modalidad::class, options: ['default' => 'presencial'])]
    #[Groups(['materia:read', 'materia:write', 'imparticion:read'])]
    private Modalidad $modalidad = Modalidad::PRESENCIAL;

    /**
     * Itinerarios a los que pertenece la materia (M:N). Antes 2026-05-08 era
     * ManyToOne con FK `materia.itinerario_id` NOT NULL; el refactor permite
     * que una misma fila Materia (ej. 0485 PR) sea compartida entre 1º DAW y
     * 1º DAM cuando comparten currículo LOMLOE. Doc: docs/hoja-de-ruta-materias-multi-itinerario.md.
     *
     * Owning side: Materia. La tabla puente `materia_itinerario` se gestiona
     * desde aquí (los formularios de Materia y los CTAs "Añadir materia
     * existente" en la vista de Itinerario operan vía PATCH a este array).
     */
    #[ORM\ManyToMany(targetEntity: Itinerario::class, inversedBy: 'materias')]
    #[ORM\JoinTable(name: 'materia_itinerario')]
    #[Groups(['materia:read', 'materia:write'])]
    private Collection $itinerarios;

    #[ORM\OneToMany(mappedBy: 'materia', targetEntity: Imparticion::class)]
    private Collection $imparticiones;

    /** Trazabilidad al catálogo oficial. Nullable: módulos manuales son válidos. */
    #[ORM\ManyToOne(targetEntity: CatalogoMateria::class)]
    #[ORM\JoinColumn(nullable: true, onDelete: 'SET NULL')]
    #[Groups(['materia:read'])]
    private ?CatalogoMateria $catalogoOrigen = null;

    public function __construct()
    {
        $this->itinerarios = new ArrayCollection();
        $this->imparticiones = new ArrayCollection();
    }

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

    public function getCodigoOficial(): ?string
    {
        return $this->codigoOficial;
    }

    public function setCodigoOficial(?string $codigoOficial): static
    {
        $this->codigoOficial = $codigoOficial;
        return $this;
    }

    public function getAbreviatura(): ?string
    {
        return $this->abreviatura;
    }

    public function setAbreviatura(?string $abreviatura): static
    {
        $this->abreviatura = $abreviatura;
        return $this;
    }

    public function getCurso(): ?int
    {
        return $this->curso;
    }

    public function setCurso(int $curso): static
    {
        $this->curso = $curso;
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

    public function getHorasTotales(): ?int
    {
        return $this->horasTotales;
    }

    public function setHorasTotales(?int $horasTotales): static
    {
        $this->horasTotales = $horasTotales;
        return $this;
    }

    /**
     * Objetivo anual en MINUTOS. Punto único de consulta para el solver,
     * CapacityPlanner y banner anual:
     *   1. Si `horasTotales` está set: horasTotales × 60 (las horas RD legales).
     *   2. Si null y hay `catalogoOrigen` con horasTotales: usar las del
     *      catálogo nacional (BOE). Esto evita inflado cuando la materia
     *      se creó antes de que `BoeRdEnricher` enriqueciera el catálogo.
     *   3. Fallback final: min/sem × 36 (cálculo histórico, infla en
     *      calendarios <36 sem reales pero es el último recurso).
     *  Doc: hoja-de-ruta-modelo-semanal.md §9 sesión 3 deuda mayor.
     */
    public function getObjetivoAnualMinutos(): int
    {
        if ($this->horasTotales !== null) {
            return $this->horasTotales * 60;
        }
        $catHoras = $this->catalogoOrigen?->getHorasTotales();
        if ($catHoras !== null) {
            return $catHoras * 60;
        }
        return ($this->minutosSemanales ?? 0) * 36;
    }

    public function getTipo(): ?TipoMateria
    {
        return $this->tipo;
    }

    public function setTipo(?TipoMateria $tipo): static
    {
        $this->tipo = $tipo;
        return $this;
    }

    public function getModalidad(): Modalidad
    {
        return $this->modalidad;
    }

    public function setModalidad(Modalidad $modalidad): static
    {
        $this->modalidad = $modalidad;
        return $this;
    }

    /**
     * @return Collection<int, Itinerario>
     */
    public function getItinerarios(): Collection
    {
        return $this->itinerarios;
    }

    public function addItinerario(Itinerario $itinerario): static
    {
        if (!$this->itinerarios->contains($itinerario)) {
            $this->itinerarios->add($itinerario);
        }
        return $this;
    }

    public function removeItinerario(Itinerario $itinerario): static
    {
        $this->itinerarios->removeElement($itinerario);
        return $this;
    }

    public function getCatalogoOrigen(): ?CatalogoMateria
    {
        return $this->catalogoOrigen;
    }

    public function setCatalogoOrigen(?CatalogoMateria $origen): self
    {
        $this->catalogoOrigen = $origen;
        return $this;
    }
}
