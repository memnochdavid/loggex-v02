<?php

namespace App\Entity;

use App\Repository\JornadaTramoRepository;
use Doctrine\DBAL\Types\Types;
use Doctrine\ORM\Mapping as ORM;
use Symfony\Component\Serializer\Attribute\Groups;
use Symfony\Component\Validator\Constraints as Assert;

/**
 * Tramo individual de una jornada: un slot lectivo o un recreo.
 *
 * Pertenece a una `JornadaTipo` y tiene un `orden` 0..N que determina la
 * secuencia. La validación de coherencia (no solapes, rango contiguo, al
 * menos un SLOT) vive en `JornadaTramoValidator`.
 *
 * Sin lifecycle traits: los tramos son detalles de la jornada y no se
 * crean/borran independientemente vía API (orphanRemoval en JornadaTipo).
 */
#[ORM\Entity(repositoryClass: JornadaTramoRepository::class)]
#[ORM\Table(name: 'jornada_tramo')]
#[ORM\UniqueConstraint(name: 'uniq_jornada_tramo_orden', columns: ['jornada_tipo_id', 'orden'])]
class JornadaTramo
{
    #[ORM\Id]
    #[ORM\GeneratedValue]
    #[ORM\Column]
    #[Groups(['tramo:read', 'jornada:read'])]
    private ?int $id = null;

    #[ORM\ManyToOne(inversedBy: 'tramos', cascade: ['persist'])]
    #[ORM\JoinColumn(nullable: false, onDelete: 'CASCADE')]
    private ?JornadaTipo $jornadaTipo = null;

    #[ORM\Column(type: Types::SMALLINT)]
    #[Assert\PositiveOrZero]
    #[Groups(['tramo:read', 'tramo:write', 'jornada:read', 'jornada:write'])]
    private int $orden = 0;

    #[ORM\Column(type: 'string', length: 16, enumType: TipoTramo::class)]
    #[Assert\NotNull]
    #[Groups(['tramo:read', 'tramo:write', 'jornada:read', 'jornada:write'])]
    private ?TipoTramo $tipo = null;

    #[ORM\Column(type: Types::TIME_MUTABLE)]
    #[Assert\NotNull]
    #[Groups(['tramo:read', 'tramo:write', 'jornada:read', 'jornada:write'])]
    private ?\DateTimeInterface $horaInicio = null;

    #[ORM\Column(type: Types::TIME_MUTABLE)]
    #[Assert\NotNull]
    #[Assert\Expression(
        "this.getHoraFin() > this.getHoraInicio()",
        message: 'horaFin debe ser posterior a horaInicio.',
    )]
    #[Groups(['tramo:read', 'tramo:write', 'jornada:read', 'jornada:write'])]
    private ?\DateTimeInterface $horaFin = null;

    #[ORM\Column(length: 60, nullable: true)]
    #[Groups(['tramo:read', 'tramo:write', 'jornada:read', 'jornada:write'])]
    private ?string $etiqueta = null;

    public function getId(): ?int
    {
        return $this->id;
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

    public function getOrden(): int
    {
        return $this->orden;
    }

    public function setOrden(int $orden): static
    {
        $this->orden = $orden;
        return $this;
    }

    public function getTipo(): ?TipoTramo
    {
        return $this->tipo;
    }

    public function setTipo(TipoTramo $tipo): static
    {
        $this->tipo = $tipo;
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

    public function getEtiqueta(): ?string
    {
        return $this->etiqueta;
    }

    public function setEtiqueta(?string $etiqueta): static
    {
        $this->etiqueta = $etiqueta;
        return $this;
    }

    /** Duración del tramo en minutos (helper, no persistido). */
    public function getDuracionMinutos(): int
    {
        if ($this->horaInicio === null || $this->horaFin === null) {
            return 0;
        }
        return (int) round(($this->horaFin->getTimestamp() - $this->horaInicio->getTimestamp()) / 60);
    }
}
