<?php

namespace App\Entity\Catalogo;

use ApiPlatform\Doctrine\Orm\Filter\OrderFilter;
use ApiPlatform\Doctrine\Orm\Filter\SearchFilter;
use ApiPlatform\Metadata\ApiFilter;
use ApiPlatform\Metadata\ApiResource;
use ApiPlatform\Metadata\Get;
use ApiPlatform\Metadata\GetCollection;
use App\Doctrine\Filter\SearchAnyFilter;
use App\Entity\Modalidad;
use Doctrine\ORM\Mapping as ORM;
use Symfony\Component\Serializer\Attribute\Groups;

/**
 * Materia (módulo de FP, asignatura de ESO/Bach/Uni) que forma parte de un
 * CatalogoItinerario. Read-only desde la API.
 *
 * Las unidades de medida varían por etapa (sección 2.4 del doc):
 *  - FP                 → horasTotales + minutosSemanales obligatorios
 *  - ESO/Bach/Primaria  → minutosSemanales obligatorias, horasTotales opcional
 *  - Universidad        → ects obligatorio
 */
#[ORM\Entity]
#[ORM\Table(name: 'catalogo_materia')]
#[ORM\Index(columns: ['itinerario_id', 'curso', 'orden'], name: 'idx_catalogo_materia_orden')]
#[ApiResource(
    operations: [
        new Get(),
        new GetCollection(),
    ],
    normalizationContext: ['groups' => ['catalogo:read', 'catalogo_materia:read']],
)]
#[ApiFilter(SearchAnyFilter::class, properties: ['nombre', 'codigoOficial'])]
#[ApiFilter(SearchFilter::class, properties: [
    'itinerario' => 'exact',
    'tipo' => 'exact',
    'curso' => 'exact',
])]
#[ApiFilter(OrderFilter::class, properties: ['curso', 'orden', 'nombre'], arguments: ['orderParameterName' => 'order'])]
class CatalogoMateria
{
    #[ORM\Id]
    #[ORM\GeneratedValue]
    #[ORM\Column]
    #[Groups(['catalogo:read'])]
    private ?int $id = null;

    #[ORM\ManyToOne(targetEntity: CatalogoItinerario::class, inversedBy: 'materias')]
    #[ORM\JoinColumn(nullable: false, onDelete: 'CASCADE')]
    #[Groups(['catalogo_materia:read'])]
    private ?CatalogoItinerario $itinerario = null;

    #[ORM\Column(length: 50)]
    #[Groups(['catalogo:read'])]
    private string $codigoOficial;

    #[ORM\Column(length: 255)]
    #[Groups(['catalogo:read'])]
    private string $nombre;

    #[ORM\Column(type: 'string', enumType: TipoMateria::class)]
    #[Groups(['catalogo:read'])]
    private TipoMateria $tipo;

    /**
     * Modalidad de imparticion declarada por el catálogo nacional. Default
     * `PRESENCIAL` (D-B). El BoeRdEnricher la infiere por heurística sobre el
     * nombre del módulo ("Formación en Centros de Trabajo"→FCT, "Proyecto"→
     * NO_REGULAR). Los casos no detectables por nombre (ej. autonómicas tipo
     * "Horas de libre configuración") se cubren vía override CCAA.
     */
    #[ORM\Column(type: 'string', enumType: Modalidad::class, options: ['default' => 'presencial'])]
    #[Groups(['catalogo:read'])]
    private Modalidad $modalidad = Modalidad::PRESENCIAL;

    /** Curso (1, 2, …) dentro del itinerario. NULL en universidades sin estructura por curso. */
    #[ORM\Column(nullable: true)]
    #[Groups(['catalogo:read'])]
    private ?int $curso = null;

    /** Carga total en horas. Obligatorio en FP. */
    #[ORM\Column(nullable: true)]
    #[Groups(['catalogo:read'])]
    private ?int $horasTotales = null;

    /** Carga semanal en MINUTOS. Soporta cualquier duración real (1h30=90, 50min, etc.). */
    #[ORM\Column(nullable: true)]
    #[Groups(['catalogo:read'])]
    private ?int $minutosSemanales = null;

    /** Créditos ECTS (universidad). NULL si no aplica. */
    #[ORM\Column(nullable: true)]
    #[Groups(['catalogo:read'])]
    private ?int $ects = null;

    /** "anual" / "primer_cuatrimestre" / "segundo_cuatrimestre" / "primer_trimestre" / … */
    #[ORM\Column(length: 50, nullable: true)]
    #[Groups(['catalogo:read'])]
    private ?string $distribucionAnual = null;

    #[ORM\Column(options: ['default' => true])]
    #[Groups(['catalogo:read'])]
    private bool $obligatoria = true;

    /** Códigos oficiales de otras materias requeridas (uni, FP). */
    #[ORM\Column(type: 'json', nullable: true)]
    #[Groups(['catalogo:read'])]
    private ?array $prerequisitos = null;

    #[ORM\Column(type: 'text', nullable: true)]
    #[Groups(['catalogo:read'])]
    private ?string $descripcion = null;

    /** Competencias profesionales (FP) o competencias clave (LOMLOE). */
    #[ORM\Column(type: 'json', nullable: true)]
    #[Groups(['catalogo:read'])]
    private ?array $competencias = null;

    #[ORM\Column(options: ['default' => 0])]
    #[Groups(['catalogo:read'])]
    private int $orden = 0;

    public function getId(): ?int { return $this->id; }
    public function getItinerario(): ?CatalogoItinerario { return $this->itinerario; }
    public function setItinerario(?CatalogoItinerario $i): self { $this->itinerario = $i; return $this; }
    public function getCodigoOficial(): string { return $this->codigoOficial; }
    public function setCodigoOficial(string $c): self { $this->codigoOficial = $c; return $this; }
    public function getNombre(): string { return $this->nombre; }
    public function setNombre(string $n): self { $this->nombre = $n; return $this; }
    public function getTipo(): TipoMateria { return $this->tipo; }
    public function setTipo(TipoMateria $t): self { $this->tipo = $t; return $this; }
    public function getModalidad(): Modalidad { return $this->modalidad; }
    public function setModalidad(Modalidad $m): self { $this->modalidad = $m; return $this; }
    public function getCurso(): ?int { return $this->curso; }
    public function setCurso(?int $c): self { $this->curso = $c; return $this; }
    public function getHorasTotales(): ?int { return $this->horasTotales; }
    public function setHorasTotales(?int $h): self { $this->horasTotales = $h; return $this; }
    public function getMinutosSemanales(): ?int { return $this->minutosSemanales; }
    public function setMinutosSemanales(?int $m): self { $this->minutosSemanales = $m; return $this; }
    public function getEcts(): ?int { return $this->ects; }
    public function setEcts(?int $e): self { $this->ects = $e; return $this; }
    public function getDistribucionAnual(): ?string { return $this->distribucionAnual; }
    public function setDistribucionAnual(?string $d): self { $this->distribucionAnual = $d; return $this; }
    public function isObligatoria(): bool { return $this->obligatoria; }
    public function setObligatoria(bool $o): self { $this->obligatoria = $o; return $this; }
    public function getPrerequisitos(): ?array { return $this->prerequisitos; }
    public function setPrerequisitos(?array $p): self { $this->prerequisitos = $p; return $this; }
    public function getDescripcion(): ?string { return $this->descripcion; }
    public function setDescripcion(?string $d): self { $this->descripcion = $d; return $this; }
    public function getCompetencias(): ?array { return $this->competencias; }
    public function setCompetencias(?array $c): self { $this->competencias = $c; return $this; }
    public function getOrden(): int { return $this->orden; }
    public function setOrden(int $o): self { $this->orden = $o; return $this; }
}
