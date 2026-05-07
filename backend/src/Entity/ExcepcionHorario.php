<?php

namespace App\Entity;

use ApiPlatform\Doctrine\Orm\Filter\DateFilter;
use ApiPlatform\Doctrine\Orm\Filter\OrderFilter;
use ApiPlatform\Doctrine\Orm\Filter\SearchFilter;
use ApiPlatform\Metadata\ApiFilter;
use ApiPlatform\Metadata\ApiResource;
use ApiPlatform\Metadata\Delete;
use ApiPlatform\Metadata\Get;
use ApiPlatform\Metadata\GetCollection;
use ApiPlatform\Metadata\Patch;
use ApiPlatform\Metadata\Post;
use App\Attribute\LivePublish;
use App\Entity\Traits\SoftDeletableTrait;
use App\Entity\Traits\TimestampableTrait;
use App\Repository\ExcepcionHorarioRepository;
use App\State\ExcepcionHorarioProcessor;
use App\State\SoftDeleteProcessor;
use Doctrine\DBAL\Types\Types;
use Doctrine\ORM\Mapping as ORM;
use Symfony\Component\Serializer\Attribute\Groups;
use Symfony\Component\Validator\Constraints as Assert;
use Symfony\Component\Validator\Context\ExecutionContextInterface;

/**
 * Excepción puntual sobre un Horario base recurrente.
 *
 * Cada fila aplica a una FECHA CONCRETA. Los Horarios base no se modifican —
 * el render compone "base + override aplicable a la fecha visible" en los
 * 5 puntos cubiertos por la Fase B (`/horario/me`, PDF horario personal,
 * banner anual, tab Consumición, rejilla `/admin/horarios`).
 *
 * Modelo elegido en D-A 2026-05-07: capa aditiva sobre PL+Horario, sin
 * modificar la estructura del modelo semanal. Razón en
 * docs/hoja-de-ruta-intercambio-imparticiones.md §3.
 *
 * Cuatro tipos posibles (D-B):
 *   - INTERCAMBIO     bilateral entre dos profes (pareja vía intercambioPareja).
 *   - SUSTITUCION     cobertura por ausencia (profeOverride apunta al sustituto).
 *   - CANCELADO       clase no impartida (imparticionEfectiva + profeOverride NULL).
 *   - EVENTO_ESPECIAL franja ocupada con algo no curricular (charla, simulacro).
 *
 * Flujo de aprobación (D-C): profe puro crea como PENDIENTE_APROBACION, admin
 * aprueba/rechaza. Admin (incluido admin+profe como sara) crea directamente
 * APROBADA. Las auto-cancelaciones del propio profe sin afectar a otros
 * pueden saltar la cola en Fase C según UI.
 *
 * Live updates al admin del centro y a los usuarios afectados (solicitante,
 * profe titular del horario base, sustituto si lo hay).
 */
#[ORM\Entity(repositoryClass: ExcepcionHorarioRepository::class)]
#[ORM\Table(name: 'excepcion_horario')]
#[ORM\Index(columns: ['fecha_concreta', 'deleted'], name: 'idx_eh_fecha')]
#[ORM\Index(columns: ['horario_base_id', 'fecha_concreta'], name: 'idx_eh_horario_fecha')]
#[ORM\Index(columns: ['estado', 'deleted'], name: 'idx_eh_estado')]
#[ORM\HasLifecycleCallbacks]
#[ApiResource(
    operations: [
        new Get(security: "is_granted('ROLE_USER')"),
        new GetCollection(security: "is_granted('ROLE_USER')"),
        new Post(
            processor: ExcepcionHorarioProcessor::class,
            security: "is_granted('ROLE_PROFESOR') or is_granted('ROLE_ADMIN') or is_granted('ROLE_SUPERADMIN')"
        ),
        new Patch(
            processor: ExcepcionHorarioProcessor::class,
            security: "is_granted('ROLE_ADMIN') or is_granted('ROLE_SUPERADMIN')"
        ),
        new Delete(
            processor: SoftDeleteProcessor::class,
            security: "is_granted('ROLE_PROFESOR') or is_granted('ROLE_ADMIN') or is_granted('ROLE_SUPERADMIN')"
        ),
    ],
    normalizationContext: ['groups' => ['excepcion:read', 'horario:read', 'imparticion:read', 'grupo:read', 'timestamp:read', 'softdelete:read']],
    denormalizationContext: ['groups' => ['excepcion:write']],
    order: ['fechaConcreta' => 'DESC', 'id' => 'DESC'],
)]
#[LivePublish(
    topics: [
        '/admin/centros/{horarioBase.imparticion.grupo.centro.id}/excepciones',
        '/users/{solicitadaPor.id}/excepciones',
        '/users/{horarioBase.imparticion.profesor.id}/excepciones',
        '/users/{profeOverride.id}/excepciones',
    ],
    payloadGroups: ['excepcion:read', 'horario:read', 'imparticion:read', 'grupo:read', 'timestamp:read', 'softdelete:read'],
)]
#[ApiFilter(SearchFilter::class, properties: [
    'horarioBase' => 'exact',
    'horarioBase.periodoLectivo.grupo' => 'exact',
    'horarioBase.imparticion.profesor' => 'exact',
    'estado' => 'exact',
    'tipo' => 'exact',
    'solicitadaPor' => 'exact',
    'aprobadaPor' => 'exact',
    'profeOverride' => 'exact',
])]
#[ApiFilter(DateFilter::class, properties: ['fechaConcreta', 'fechaSolicitud', 'fechaResolucion'])]
#[ApiFilter(OrderFilter::class, properties: ['fechaConcreta', 'fechaSolicitud', 'estado', 'id'], arguments: ['orderParameterName' => 'order'])]
class ExcepcionHorario
{
    use TimestampableTrait;
    use SoftDeletableTrait;

    #[ORM\Id]
    #[ORM\GeneratedValue]
    #[ORM\Column]
    #[Groups(['excepcion:read'])]
    private ?int $id = null;

    /**
     * Bloque base afectado. El `Horario` es recurrente en su SEMANA padre y
     * sigue intacto; la excepción solo aplica a `fechaConcreta`.
     */
    #[ORM\ManyToOne]
    #[ORM\JoinColumn(nullable: false, onDelete: 'CASCADE')]
    #[Assert\NotNull]
    #[Groups(['excepcion:read', 'excepcion:write'])]
    private ?Horario $horarioBase = null;

    /**
     * Fecha concreta de la excepción. Debe caer dentro del rango de la SEMANA
     * del `horarioBase` y coincidir con su `diaSemana` (ISO 1-7).
     */
    #[ORM\Column(type: Types::DATE_IMMUTABLE)]
    #[Assert\NotNull]
    #[Groups(['excepcion:read', 'excepcion:write'])]
    private ?\DateTimeImmutable $fechaConcreta = null;

    #[ORM\Column(type: Types::STRING, length: 32, enumType: TipoExcepcion::class)]
    #[Assert\NotNull]
    #[Groups(['excepcion:read', 'excepcion:write'])]
    private ?TipoExcepcion $tipo = null;

    /**
     * Imparticion que sustituye al base ese día.
     * - INTERCAMBIO: la imparticion del otro profe.
     * - SUSTITUCION: misma imparticion del base (mismo grupo+materia), el
     *   override de profe va en `profeOverride`.
     * - CANCELADO / EVENTO_ESPECIAL: NULL.
     */
    #[ORM\ManyToOne]
    #[ORM\JoinColumn(nullable: true, onDelete: 'SET NULL')]
    #[Groups(['excepcion:read', 'excepcion:write'])]
    private ?Imparticion $imparticionEfectiva = null;

    /**
     * Sustituto del profe titular cuando el tipo lo requiere (SUSTITUCION
     * típicamente). NULL para INTERCAMBIO/CANCELADO/EVENTO_ESPECIAL.
     */
    #[ORM\ManyToOne]
    #[ORM\JoinColumn(nullable: true, onDelete: 'SET NULL')]
    #[Groups(['excepcion:read', 'excepcion:write'])]
    private ?User $profeOverride = null;

    /**
     * Pareja del intercambio bilateral. Self-FK opcional. Cuando se aprueba
     * un INTERCAMBIO se aprueba el par completo. Validación rica del par se
     * cierra en Fase E.
     */
    #[ORM\ManyToOne(targetEntity: self::class)]
    #[ORM\JoinColumn(nullable: true, onDelete: 'SET NULL')]
    #[Groups(['excepcion:read', 'excepcion:write'])]
    private ?ExcepcionHorario $intercambioPareja = null;

    #[ORM\Column(type: Types::TEXT, nullable: true)]
    #[Assert\Length(max: 2000)]
    #[Groups(['excepcion:read', 'excepcion:write'])]
    private ?string $motivo = null;

    #[ORM\Column(type: Types::TEXT, nullable: true)]
    #[Assert\Length(max: 2000)]
    #[Groups(['excepcion:read', 'excepcion:write'])]
    private ?string $observaciones = null;

    #[ORM\Column(type: Types::STRING, length: 32, enumType: EstadoExcepcion::class, options: ['default' => 'pendiente'])]
    #[Assert\NotNull]
    #[Groups(['excepcion:read', 'excepcion:write'])]
    private EstadoExcepcion $estado = EstadoExcepcion::PENDIENTE_APROBACION;

    /**
     * Quién creó la excepción. Se rellena desde el JWT en el processor de
     * Post; no se acepta del payload para evitar suplantación. NO lleva
     * Assert\NotNull porque la validación corre ANTES del processor en el
     * ciclo API Platform; la columna BD NOT NULL hace de red de seguridad.
     */
    #[ORM\ManyToOne]
    #[ORM\JoinColumn(nullable: false, onDelete: 'CASCADE')]
    #[Groups(['excepcion:read'])]
    private ?User $solicitadaPor = null;

    #[ORM\Column(type: Types::DATETIME_IMMUTABLE)]
    #[Groups(['excepcion:read'])]
    private ?\DateTimeImmutable $fechaSolicitud = null;

    /**
     * Admin que resolvió (aprobó / rechazó / canceló). Se setea desde el JWT
     * en el processor de Patch al cambiar `estado`.
     */
    #[ORM\ManyToOne]
    #[ORM\JoinColumn(nullable: true, onDelete: 'SET NULL')]
    #[Groups(['excepcion:read'])]
    private ?User $aprobadaPor = null;

    #[ORM\Column(type: Types::DATETIME_IMMUTABLE, nullable: true)]
    #[Groups(['excepcion:read'])]
    private ?\DateTimeImmutable $fechaResolucion = null;

    #[ORM\Column(type: Types::TEXT, nullable: true)]
    #[Assert\Length(max: 2000)]
    #[Groups(['excepcion:read', 'excepcion:write'])]
    private ?string $respuestaAdmin = null;

    /**
     * Marca de reversión: una excepción aprobada que se cancela posteriormente
     * queda con `revertida=true` para distinguirla del rechazo previo a la
     * aprobación. Soft-delete preservando histórico (D-F).
     */
    #[ORM\Column(options: ['default' => false])]
    #[Groups(['excepcion:read'])]
    private bool $revertida = false;

    public function __construct()
    {
        $this->fechaSolicitud = new \DateTimeImmutable();
    }

    public function getId(): ?int
    {
        return $this->id;
    }

    public function getHorarioBase(): ?Horario
    {
        return $this->horarioBase;
    }

    public function setHorarioBase(?Horario $horarioBase): static
    {
        $this->horarioBase = $horarioBase;
        return $this;
    }

    public function getFechaConcreta(): ?\DateTimeImmutable
    {
        return $this->fechaConcreta;
    }

    public function setFechaConcreta(?\DateTimeImmutable $fechaConcreta): static
    {
        $this->fechaConcreta = $fechaConcreta;
        return $this;
    }

    public function getTipo(): ?TipoExcepcion
    {
        return $this->tipo;
    }

    public function setTipo(?TipoExcepcion $tipo): static
    {
        $this->tipo = $tipo;
        return $this;
    }

    public function getImparticionEfectiva(): ?Imparticion
    {
        return $this->imparticionEfectiva;
    }

    public function setImparticionEfectiva(?Imparticion $imparticionEfectiva): static
    {
        $this->imparticionEfectiva = $imparticionEfectiva;
        return $this;
    }

    public function getProfeOverride(): ?User
    {
        return $this->profeOverride;
    }

    public function setProfeOverride(?User $profeOverride): static
    {
        $this->profeOverride = $profeOverride;
        return $this;
    }

    public function getIntercambioPareja(): ?ExcepcionHorario
    {
        return $this->intercambioPareja;
    }

    public function setIntercambioPareja(?ExcepcionHorario $intercambioPareja): static
    {
        $this->intercambioPareja = $intercambioPareja;
        return $this;
    }

    public function getMotivo(): ?string
    {
        return $this->motivo;
    }

    public function setMotivo(?string $motivo): static
    {
        $this->motivo = $motivo;
        return $this;
    }

    public function getObservaciones(): ?string
    {
        return $this->observaciones;
    }

    public function setObservaciones(?string $observaciones): static
    {
        $this->observaciones = $observaciones;
        return $this;
    }

    public function getEstado(): EstadoExcepcion
    {
        return $this->estado;
    }

    public function setEstado(EstadoExcepcion $estado): static
    {
        $this->estado = $estado;
        return $this;
    }

    public function getSolicitadaPor(): ?User
    {
        return $this->solicitadaPor;
    }

    public function setSolicitadaPor(?User $solicitadaPor): static
    {
        $this->solicitadaPor = $solicitadaPor;
        return $this;
    }

    public function getFechaSolicitud(): ?\DateTimeImmutable
    {
        return $this->fechaSolicitud;
    }

    public function setFechaSolicitud(?\DateTimeImmutable $fechaSolicitud): static
    {
        $this->fechaSolicitud = $fechaSolicitud;
        return $this;
    }

    public function getAprobadaPor(): ?User
    {
        return $this->aprobadaPor;
    }

    public function setAprobadaPor(?User $aprobadaPor): static
    {
        $this->aprobadaPor = $aprobadaPor;
        return $this;
    }

    public function getFechaResolucion(): ?\DateTimeImmutable
    {
        return $this->fechaResolucion;
    }

    public function setFechaResolucion(?\DateTimeImmutable $fechaResolucion): static
    {
        $this->fechaResolucion = $fechaResolucion;
        return $this;
    }

    public function getRespuestaAdmin(): ?string
    {
        return $this->respuestaAdmin;
    }

    public function setRespuestaAdmin(?string $respuestaAdmin): static
    {
        $this->respuestaAdmin = $respuestaAdmin;
        return $this;
    }

    public function isRevertida(): bool
    {
        return $this->revertida;
    }

    public function setRevertida(bool $revertida): static
    {
        $this->revertida = $revertida;
        return $this;
    }

    /**
     * Validación de coherencia tipo / campos efectivos / fecha.
     *
     * Reglas Fase A:
     *   - CANCELADO ⇒ imparticionEfectiva y profeOverride NULL.
     *   - EVENTO_ESPECIAL ⇒ imparticionEfectiva NULL (profeOverride opcional para anotar facilitador).
     *   - fechaConcreta.diaSemana coincide con horarioBase.diaSemana (ISO 1=Lun .. 7=Dom).
     *
     * El chequeo del rango de la SEMANA padre se difiere al service en Fase B
     * (necesita resolver el PL aplicable y leer fechaInicio/Fin).
     */
    #[Assert\Callback]
    public function validateCoherencia(ExecutionContextInterface $context): void
    {
        if ($this->tipo === TipoExcepcion::CANCELADO) {
            if ($this->imparticionEfectiva !== null) {
                $context->buildViolation('Una excepción CANCELADO no puede llevar imparticion efectiva.')
                    ->atPath('imparticionEfectiva')
                    ->addViolation();
            }
            if ($this->profeOverride !== null) {
                $context->buildViolation('Una excepción CANCELADO no puede llevar profesor override.')
                    ->atPath('profeOverride')
                    ->addViolation();
            }
        }

        if ($this->tipo === TipoExcepcion::EVENTO_ESPECIAL && $this->imparticionEfectiva !== null) {
            $context->buildViolation('Un EVENTO_ESPECIAL no lleva imparticion efectiva (es no curricular).')
                ->atPath('imparticionEfectiva')
                ->addViolation();
        }

        if ($this->fechaConcreta !== null && $this->horarioBase !== null) {
            $isoDay = (int) $this->fechaConcreta->format('N');
            $base = $this->horarioBase->getDiaSemana();
            if ($base !== null && $isoDay !== $base) {
                $context->buildViolation(sprintf(
                    'La fecha %s (día %d) no coincide con el día de semana del horario base (%d).',
                    $this->fechaConcreta->format('Y-m-d'),
                    $isoDay,
                    $base,
                ))
                    ->atPath('fechaConcreta')
                    ->addViolation();
            }
        }
    }
}
