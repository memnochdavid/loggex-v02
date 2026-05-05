<?php

namespace App\Entity;

use ApiPlatform\Doctrine\Orm\Filter\BooleanFilter;
use ApiPlatform\Doctrine\Orm\Filter\OrderFilter;
use ApiPlatform\Doctrine\Orm\Filter\SearchFilter;
use ApiPlatform\Metadata\ApiFilter;
use ApiPlatform\Metadata\ApiResource;
use ApiPlatform\Metadata\Get;
use ApiPlatform\Metadata\GetCollection;
use ApiPlatform\Metadata\Patch;
use App\Attribute\LivePublish;
use App\Entity\Traits\TimestampableTrait;
use App\Repository\NotificacionRepository;
use Doctrine\DBAL\Types\Types;
use Doctrine\ORM\Mapping as ORM;
use Symfony\Component\Serializer\Attribute\Groups;
use Symfony\Component\Validator\Constraints as Assert;

/**
 * Notificación del sistema dirigida a un usuario concreto (per-destinatario,
 * no broadcast). Si un evento afecta a 30 alumnos, se crean 30 filas — el
 * estado "leida" y los contadores son por usuario sin tablas puente.
 *
 * El frontend muestra estas notificaciones en la **campanita** del header
 * (icono `Bell`), separada del botón de mensajes (icono `Mail`/`MessageCircle`)
 * — decisión D1 cerrada 2026-05-05 en `docs/hoja-de-ruta-notificaciones.md`.
 *
 * Catálogo cerrado de tipos en §3 del doc:
 *   - calificacion_publicada       (alumno de la entrega)
 *   - tarea_nueva                  (alumnos del grupo)
 *   - comunicado_nuevo             (usuarios del centro o globales)
 *   - entrega_recibida             (profesor de la imparticion)
 *   - tarea_vencida_sin_entrega    (alumno, generado por cron Fase F)
 *
 * Convención i18n: el frontend renderiza títulos/cuerpos vía claves
 * `notifications.types.{tipo}.{title|body}` interpolando `payload`. `titulo`
 * y `mensaje` se persisten como fallback en español al crear (auditoría +
 * consumidores que no usen i18n).
 *
 * **Sin soft delete** por diseño: las notificaciones leídas viejas se podan
 * con `app:notificaciones:purgar` (futuro), no se conservan eternamente.
 *
 * Live updates: `#[LivePublish]` al topic privado `/users/{usuario.id}/notifications`
 * — el JWT firmado en `MercureAuthController` ya incluye este patrón para
 * cada usuario autenticado.
 */
#[ORM\Entity(repositoryClass: NotificacionRepository::class)]
#[ORM\Table(name: 'notificacion')]
#[ORM\Index(columns: ['usuario_id', 'leida', 'fecha_creacion'], name: 'idx_notif_usuario_leida_fecha')]
#[ORM\HasLifecycleCallbacks]
#[ApiResource(
    operations: [
        new Get(),
        new GetCollection(),
        // PATCH para marcar como leída ({ "leida": true }). No exponemos
        // POST/PUT/DELETE: las notificaciones se crean vía dispatcher
        // (eventos Doctrine), no por API directa.
        new Patch(),
    ],
    normalizationContext: ['groups' => ['notificacion:read', 'timestamp:read']],
    denormalizationContext: ['groups' => ['notificacion:write']],
    order: ['fechaCreacion' => 'DESC'],
)]
#[LivePublish(
    topics: ['/users/{usuario.id}/notifications'],
    payloadGroups: ['notificacion:read', 'timestamp:read'],
)]
#[ApiFilter(BooleanFilter::class, properties: ['leida'])]
#[ApiFilter(SearchFilter::class, properties: ['usuario' => 'exact', 'tipo' => 'exact'])]
#[ApiFilter(OrderFilter::class, properties: ['fechaCreacion', 'leida', 'id'], arguments: ['orderParameterName' => 'order'])]
class Notificacion
{
    use TimestampableTrait;

    #[ORM\Id]
    #[ORM\GeneratedValue]
    #[ORM\Column]
    #[Groups(['notificacion:read'])]
    private ?int $id = null;

    /**
     * Destinatario. Un evento que afecta a N usuarios crea N filas (una por
     * destinatario). Sin tabla puente — simplifica `leida` y conteos.
     */
    #[ORM\ManyToOne(targetEntity: User::class)]
    #[ORM\JoinColumn(nullable: false, onDelete: 'CASCADE')]
    #[Assert\NotNull]
    #[Groups(['notificacion:read'])]
    private ?User $usuario = null;

    /**
     * Tipo del evento (key del catálogo cerrado). Determina el icono, la
     * traducción y la ruta a la que navega el click.
     */
    #[ORM\Column(length: 64)]
    #[Assert\NotBlank]
    #[Assert\Length(max: 64)]
    #[Groups(['notificacion:read'])]
    private ?string $tipo = null;

    /**
     * Título cacheado en español (fallback si el frontend no traduce vía
     * clave i18n). El frontend prefiere `notifications.types.{tipo}.title`
     * con interpolación de `payload`.
     */
    #[ORM\Column(length: 255)]
    #[Assert\NotBlank]
    #[Assert\Length(max: 255)]
    #[Groups(['notificacion:read'])]
    private ?string $titulo = null;

    /**
     * Cuerpo cacheado en español (fallback). El frontend prefiere
     * `notifications.types.{tipo}.body` interpolando `payload`.
     */
    #[ORM\Column(type: Types::TEXT, nullable: true)]
    #[Groups(['notificacion:read'])]
    private ?string $mensaje = null;

    /**
     * Ruta del frontend a la que navega al hacer click. Si NULL, el item
     * solo se marca como leído sin navegación.
     */
    #[ORM\Column(length: 500, nullable: true)]
    #[Groups(['notificacion:read'])]
    private ?string $enlace = null;

    /**
     * Contexto adicional para la interpolación de claves i18n e iconos.
     * Forma libre, depende de `tipo`. Ejemplos:
     *   - calificacion_publicada: `{ entregaId, tareaId, tareaTitulo, nota }`
     *   - tarea_nueva:            `{ tareaId, titulo, fechaLimite }`
     *   - entrega_recibida:       `{ entregaId, tareaId, alumnoNombre }`
     */
    #[ORM\Column(type: Types::JSON, nullable: true)]
    #[Groups(['notificacion:read'])]
    private ?array $payload = null;

    #[ORM\Column(options: ['default' => false])]
    #[Groups(['notificacion:read', 'notificacion:write'])]
    private bool $leida = false;

    #[ORM\Column(type: Types::DATETIME_MUTABLE)]
    #[Groups(['notificacion:read'])]
    private ?\DateTimeInterface $fechaCreacion = null;

    /**
     * Cuándo se marcó como leída. NULL si aún no se ha leído.
     * Auto-rellenado en `setLeida(true)` y limpiado en `setLeida(false)`.
     */
    #[ORM\Column(type: Types::DATETIME_MUTABLE, nullable: true)]
    #[Groups(['notificacion:read'])]
    private ?\DateTimeInterface $leidaAt = null;

    public function __construct()
    {
        $this->fechaCreacion = new \DateTime();
    }

    public function getId(): ?int
    {
        return $this->id;
    }

    public function getUsuario(): ?User
    {
        return $this->usuario;
    }

    public function setUsuario(User $usuario): static
    {
        $this->usuario = $usuario;
        return $this;
    }

    public function getTipo(): ?string
    {
        return $this->tipo;
    }

    public function setTipo(string $tipo): static
    {
        $this->tipo = $tipo;
        return $this;
    }

    public function getTitulo(): ?string
    {
        return $this->titulo;
    }

    public function setTitulo(string $titulo): static
    {
        $this->titulo = $titulo;
        return $this;
    }

    public function getMensaje(): ?string
    {
        return $this->mensaje;
    }

    public function setMensaje(?string $mensaje): static
    {
        $this->mensaje = $mensaje;
        return $this;
    }

    public function getEnlace(): ?string
    {
        return $this->enlace;
    }

    public function setEnlace(?string $enlace): static
    {
        $this->enlace = $enlace;
        return $this;
    }

    public function getPayload(): ?array
    {
        return $this->payload;
    }

    public function setPayload(?array $payload): static
    {
        $this->payload = $payload;
        return $this;
    }

    public function isLeida(): bool
    {
        return $this->leida;
    }

    public function setLeida(bool $leida): static
    {
        if ($leida && !$this->leida) {
            $this->leidaAt = new \DateTime();
        } elseif (!$leida && $this->leida) {
            $this->leidaAt = null;
        }
        $this->leida = $leida;
        return $this;
    }

    public function getFechaCreacion(): ?\DateTimeInterface
    {
        return $this->fechaCreacion;
    }

    public function setFechaCreacion(\DateTimeInterface $fechaCreacion): static
    {
        $this->fechaCreacion = $fechaCreacion;
        return $this;
    }

    public function getLeidaAt(): ?\DateTimeInterface
    {
        return $this->leidaAt;
    }
}
