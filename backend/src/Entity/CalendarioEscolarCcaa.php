<?php

namespace App\Entity;

use ApiPlatform\Doctrine\Orm\Filter\OrderFilter;
use ApiPlatform\Doctrine\Orm\Filter\SearchFilter;
use ApiPlatform\Metadata\ApiFilter;
use ApiPlatform\Metadata\ApiResource;
use ApiPlatform\Metadata\Get;
use ApiPlatform\Metadata\GetCollection;
use App\Entity\Traits\TimestampableTrait;
use Doctrine\DBAL\Types\Types;
use Doctrine\ORM\Mapping as ORM;
use Symfony\Component\Serializer\Attribute\Groups;

/**
 * Calendario escolar oficial publicado anualmente por cada CCAA. Una fila
 * por (ccaa, anioAcademico, etapa). Datos extraídos de las Resoluciones
 * publicadas en los boletines autonómicos (BOJA en Andalucía, DOGC en
 * Cataluña, etc.) y persistidas en MinIO con sus PDFs auditables.
 *
 * Read-only desde la API: la única fuente de verdad es el JSON curado en
 * `catalogo/calendario-escolar/{CCAA}/curated/calendario-escolar.json` y el
 * comando `app:calendario:seed-escolar` que lo persiste de forma idempotente.
 *
 * Sirve como:
 *   - Sugerencia al rellenar `Centro.fechaInicioCurso/FinCurso` (la UI lee la
 *     etapa relevante del centro y precarga el modal del centro).
 *   - Base del cálculo de semanas lectivas reales en `CalendarioLectivoService`
 *     cuando el centro no rellena fechas propias.
 */
#[ORM\Entity]
#[ORM\Table(name: 'calendario_escolar_ccaa')]
#[ORM\UniqueConstraint(name: 'uniq_calescolar_ccaa_anio_etapa', columns: ['ccaa', 'anio_academico', 'etapa'])]
#[ORM\Index(name: 'idx_calescolar_ccaa_anio', columns: ['ccaa', 'anio_academico'])]
#[ORM\HasLifecycleCallbacks]
#[ApiResource(
    operations: [
        new Get(),
        new GetCollection(),
    ],
    normalizationContext: ['groups' => ['calendario_escolar:read', 'timestamp:read']],
)]
#[ApiFilter(SearchFilter::class, properties: [
    'ccaa' => 'exact',
    'anioAcademico' => 'exact',
    'etapa' => 'exact',
])]
#[ApiFilter(OrderFilter::class, properties: ['anioAcademico', 'ccaa', 'etapa'])]
class CalendarioEscolarCcaa
{
    use TimestampableTrait;

    #[ORM\Id]
    #[ORM\GeneratedValue]
    #[ORM\Column]
    #[Groups(['calendario_escolar:read'])]
    private ?int $id = null;

    #[ORM\Column(type: 'string', length: 2, enumType: Ccaa::class)]
    #[Groups(['calendario_escolar:read'])]
    private Ccaa $ccaa;

    /** Curso académico en formato `YYYY-YYYY` (ej. `2025-2026`). */
    #[ORM\Column(length: 9)]
    #[Groups(['calendario_escolar:read'])]
    private string $anioAcademico;

    #[ORM\Column(type: 'string', length: 32, enumType: EtapaEducativa::class)]
    #[Groups(['calendario_escolar:read'])]
    private EtapaEducativa $etapa;

    /** Inicio del régimen ordinario de clases para esta etapa. */
    #[ORM\Column(type: Types::DATE_MUTABLE)]
    #[Groups(['calendario_escolar:read'])]
    private \DateTimeInterface $fechaInicio;

    /** Fin del régimen ordinario de clases para esta etapa. */
    #[ORM\Column(type: Types::DATE_MUTABLE)]
    #[Groups(['calendario_escolar:read'])]
    private \DateTimeInterface $fechaFin;

    /** Días lectivos oficiales (puede ser NULL si la Resolución no los fija explícitamente para esta etapa). */
    #[ORM\Column(type: Types::INTEGER, nullable: true)]
    #[Groups(['calendario_escolar:read'])]
    private ?int $diasLectivos = null;

    /** Horas de docencia directa oficiales (puede ser NULL). */
    #[ORM\Column(type: Types::INTEGER, nullable: true)]
    #[Groups(['calendario_escolar:read'])]
    private ?int $horasDocencia = null;

    /** URL de la Resolución oficial (BOJA, DOGC, etc.). */
    #[ORM\Column(length: 500, nullable: true)]
    #[Groups(['calendario_escolar:read'])]
    private ?string $fuenteUrl = null;

    /** Fecha de firma de la Resolución (auditoría). */
    #[ORM\Column(type: Types::DATE_MUTABLE, nullable: true)]
    #[Groups(['calendario_escolar:read'])]
    private ?\DateTimeInterface $fuenteFecha = null;

    /** Comentario libre extraído del PDF (excepciones, observaciones). */
    #[ORM\Column(type: Types::TEXT, nullable: true)]
    #[Groups(['calendario_escolar:read'])]
    private ?string $comentario = null;

    public function getId(): ?int { return $this->id; }
    public function getCcaa(): Ccaa { return $this->ccaa; }
    public function setCcaa(Ccaa $c): static { $this->ccaa = $c; return $this; }
    public function getAnioAcademico(): string { return $this->anioAcademico; }
    public function setAnioAcademico(string $a): static { $this->anioAcademico = $a; return $this; }
    public function getEtapa(): EtapaEducativa { return $this->etapa; }
    public function setEtapa(EtapaEducativa $e): static { $this->etapa = $e; return $this; }
    public function getFechaInicio(): \DateTimeInterface { return $this->fechaInicio; }
    public function setFechaInicio(\DateTimeInterface $d): static { $this->fechaInicio = $d; return $this; }
    public function getFechaFin(): \DateTimeInterface { return $this->fechaFin; }
    public function setFechaFin(\DateTimeInterface $d): static { $this->fechaFin = $d; return $this; }
    public function getDiasLectivos(): ?int { return $this->diasLectivos; }
    public function setDiasLectivos(?int $v): static { $this->diasLectivos = $v; return $this; }
    public function getHorasDocencia(): ?int { return $this->horasDocencia; }
    public function setHorasDocencia(?int $v): static { $this->horasDocencia = $v; return $this; }
    public function getFuenteUrl(): ?string { return $this->fuenteUrl; }
    public function setFuenteUrl(?string $u): static { $this->fuenteUrl = $u; return $this; }
    public function getFuenteFecha(): ?\DateTimeInterface { return $this->fuenteFecha; }
    public function setFuenteFecha(?\DateTimeInterface $d): static { $this->fuenteFecha = $d; return $this; }
    public function getComentario(): ?string { return $this->comentario; }
    public function setComentario(?string $c): static { $this->comentario = $c; return $this; }
}
