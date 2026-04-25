<?php

namespace App\Entity\Catalogo;

use ApiPlatform\Doctrine\Orm\Filter\OrderFilter;
use ApiPlatform\Doctrine\Orm\Filter\SearchFilter;
use ApiPlatform\Metadata\ApiFilter;
use ApiPlatform\Metadata\ApiResource;
use ApiPlatform\Metadata\Get;
use ApiPlatform\Metadata\GetCollection;
use App\Doctrine\Filter\SearchAnyFilter;
use Doctrine\Common\Collections\ArrayCollection;
use Doctrine\Common\Collections\Collection;
use Doctrine\ORM\Mapping as ORM;
use Symfony\Component\Serializer\Attribute\Groups;

/**
 * Itinerario formativo del catálogo oficial: un ciclo de FP, una modalidad de
 * Bachillerato, un grado universitario, etc.
 *
 * Read-only desde la API: solo se modifica vía CatalogoIngestService durante
 * un job de ingesta. Los admins lo consumen para alimentar el AsyncSearchSelect
 * del modal de "Nuevo Ciclo / Curso" y para materializar instancias editables
 * en la BD del centro (ver `CicloFormativo::$catalogoOrigen`).
 */
#[ORM\Entity]
#[ORM\Table(name: 'catalogo_itinerario')]
#[ORM\Index(columns: ['etapa', 'ccaa'], name: 'idx_catalogo_itinerario_etapa_ccaa')]
#[ORM\Index(columns: ['codigo_oficial'], name: 'idx_catalogo_itinerario_codigo')]
#[ORM\UniqueConstraint(name: 'uniq_catalogo_itinerario_codigo_ccaa_vigente', columns: ['codigo_oficial', 'ccaa', 'vigente_desde'])]
#[ApiResource(
    operations: [
        new Get(),
        new GetCollection(),
    ],
    normalizationContext: ['groups' => ['catalogo:read', 'catalogo_itinerario:read']],
)]
#[ApiFilter(SearchAnyFilter::class, properties: ['nombre', 'codigoOficial', 'familia'])]
#[ApiFilter(SearchFilter::class, properties: [
    'etapa' => 'exact',
    'ccaa' => 'exact',
    'familia' => 'partial',
])]
#[ApiFilter(OrderFilter::class, properties: ['nombre', 'codigoOficial'], arguments: ['orderParameterName' => 'order'])]
class CatalogoItinerario
{
    #[ORM\Id]
    #[ORM\GeneratedValue]
    #[ORM\Column]
    #[Groups(['catalogo:read'])]
    private ?int $id = null;

    #[ORM\Column(type: 'string', enumType: EtapaEducativa::class)]
    #[Groups(['catalogo:read'])]
    private EtapaEducativa $etapa;

    #[ORM\Column(length: 50)]
    #[Groups(['catalogo:read'])]
    private string $codigoOficial;

    #[ORM\Column(length: 255)]
    #[Groups(['catalogo:read'])]
    private string $nombre;

    /** Familia profesional (FP) o modalidad (Bachillerato) o rama de conocimiento (Universidad). */
    #[ORM\Column(length: 255, nullable: true)]
    #[Groups(['catalogo:read'])]
    private ?string $familia = null;

    /** "Básico" / "Medio" / "Superior" / "Modalidad Ciencias y Tecnología" / etc. */
    #[ORM\Column(length: 100, nullable: true)]
    #[Groups(['catalogo:read'])]
    private ?string $nivel = null;

    #[ORM\Column(nullable: true)]
    #[Groups(['catalogo:read'])]
    private ?int $duracionTotalHoras = null;

    /** Total de ECTS (universitario). NULL si la etapa no usa ECTS. */
    #[ORM\Column(nullable: true)]
    #[Groups(['catalogo:read'])]
    private ?int $duracionTotalEcts = null;

    /** ISO 3166-2:ES sin prefijo "ES-": "AND", "MAD", "CAT", … NULL = nacional. */
    #[ORM\Column(length: 3, nullable: true)]
    #[Groups(['catalogo:read'])]
    private ?string $ccaa = null;

    /** Título completo del RD/Orden tal cual aparece en `<titulo>` del BOE.
     *  Algunos títulos pasan de 1000 caracteres (RD 127/2014 de FP Básica),
     *  por eso usamos TEXT y no VARCHAR. */
    #[ORM\Column(type: 'text', nullable: true)]
    #[Groups(['catalogo:read'])]
    private ?string $normativa = null;

    /** URL al BOE / BOJA / DOCM / … del RD del título. */
    #[ORM\Column(length: 500, nullable: true)]
    #[Groups(['catalogo:read'])]
    private ?string $boletinUrl = null;

    /**
     * URL al boletín del CURRÍCULO del Ministerio (Orden EDU separada en el caso
     * de FP). Es un documento distinto del RD del título: contiene la tabla
     * estructurada de módulos con horas y curso. Lo lee `BoeRdAdapter`.
     */
    #[ORM\Column(length: 500, nullable: true)]
    #[Groups(['catalogo:read'])]
    private ?string $curriculoUrl = null;

    #[ORM\Column(type: 'date_immutable', nullable: true)]
    #[Groups(['catalogo:read'])]
    private ?\DateTimeImmutable $vigenteDesde = null;

    /** NULL = vigente en este momento. */
    #[ORM\Column(type: 'date_immutable', nullable: true)]
    #[Groups(['catalogo:read'])]
    private ?\DateTimeImmutable $vigenteHasta = null;

    /** "TodoFP" / "BOE" / "BOJA" / "RUCT" / … */
    #[ORM\Column(length: 50)]
    private string $fuenteIngesta;

    /** sha256 del payload original — para detectar cambios entre ingestas. */
    #[ORM\Column(length: 64)]
    private string $fuenteHash;

    #[ORM\Column(type: 'datetime_immutable')]
    private \DateTimeImmutable $ingestadoAt;

    /** @var Collection<int, CatalogoMateria> */
    #[ORM\OneToMany(mappedBy: 'itinerario', targetEntity: CatalogoMateria::class, cascade: ['persist', 'remove'], orphanRemoval: true)]
    #[ORM\OrderBy(['curso' => 'ASC', 'orden' => 'ASC'])]
    #[Groups(['catalogo_itinerario:read'])]
    private Collection $materias;

    public function __construct()
    {
        $this->materias = new ArrayCollection();
        $this->ingestadoAt = new \DateTimeImmutable();
    }

    public function getId(): ?int { return $this->id; }
    public function getEtapa(): EtapaEducativa { return $this->etapa; }
    public function setEtapa(EtapaEducativa $etapa): self { $this->etapa = $etapa; return $this; }
    public function getCodigoOficial(): string { return $this->codigoOficial; }
    public function setCodigoOficial(string $codigoOficial): self { $this->codigoOficial = $codigoOficial; return $this; }
    public function getNombre(): string { return $this->nombre; }
    public function setNombre(string $nombre): self { $this->nombre = $nombre; return $this; }
    public function getFamilia(): ?string { return $this->familia; }
    public function setFamilia(?string $familia): self { $this->familia = $familia; return $this; }
    public function getNivel(): ?string { return $this->nivel; }
    public function setNivel(?string $nivel): self { $this->nivel = $nivel; return $this; }
    public function getDuracionTotalHoras(): ?int { return $this->duracionTotalHoras; }
    public function setDuracionTotalHoras(?int $h): self { $this->duracionTotalHoras = $h; return $this; }
    public function getDuracionTotalEcts(): ?int { return $this->duracionTotalEcts; }
    public function setDuracionTotalEcts(?int $e): self { $this->duracionTotalEcts = $e; return $this; }
    public function getCcaa(): ?string { return $this->ccaa; }
    public function setCcaa(?string $ccaa): self { $this->ccaa = $ccaa; return $this; }
    public function getNormativa(): ?string { return $this->normativa; }
    public function setNormativa(?string $n): self { $this->normativa = $n; return $this; }
    public function getBoletinUrl(): ?string { return $this->boletinUrl; }
    public function setBoletinUrl(?string $url): self { $this->boletinUrl = $url; return $this; }
    public function getCurriculoUrl(): ?string { return $this->curriculoUrl; }
    public function setCurriculoUrl(?string $url): self { $this->curriculoUrl = $url; return $this; }
    public function getVigenteDesde(): ?\DateTimeImmutable { return $this->vigenteDesde; }
    public function setVigenteDesde(?\DateTimeImmutable $d): self { $this->vigenteDesde = $d; return $this; }
    public function getVigenteHasta(): ?\DateTimeImmutable { return $this->vigenteHasta; }
    public function setVigenteHasta(?\DateTimeImmutable $d): self { $this->vigenteHasta = $d; return $this; }
    public function getFuenteIngesta(): string { return $this->fuenteIngesta; }
    public function setFuenteIngesta(string $f): self { $this->fuenteIngesta = $f; return $this; }
    public function getFuenteHash(): string { return $this->fuenteHash; }
    public function setFuenteHash(string $h): self { $this->fuenteHash = $h; return $this; }
    public function getIngestadoAt(): \DateTimeImmutable { return $this->ingestadoAt; }
    public function setIngestadoAt(\DateTimeImmutable $d): self { $this->ingestadoAt = $d; return $this; }

    /** @return Collection<int, CatalogoMateria> */
    public function getMaterias(): Collection { return $this->materias; }

    public function addMateria(CatalogoMateria $m): self
    {
        if (!$this->materias->contains($m)) {
            $this->materias->add($m);
            $m->setItinerario($this);
        }
        return $this;
    }

    public function removeMateria(CatalogoMateria $m): self
    {
        if ($this->materias->removeElement($m) && $m->getItinerario() === $this) {
            $m->setItinerario(null);
        }
        return $this;
    }
}
