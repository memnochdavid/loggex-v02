<?php

namespace App\Entity;

use ApiPlatform\Doctrine\Orm\Filter\SearchFilter;
use ApiPlatform\Metadata\ApiFilter;
use ApiPlatform\Metadata\ApiResource;
use ApiPlatform\Metadata\Get;
use ApiPlatform\Metadata\GetCollection;
use ApiPlatform\Metadata\Post;
use ApiPlatform\Metadata\Put;
use ApiPlatform\Metadata\Patch; // Importar Patch
use ApiPlatform\Metadata\Delete;
use App\Repository\MensajeRepository;
use App\State\MensajeProcessor;
use Doctrine\DBAL\Types\Types;
use Doctrine\ORM\Mapping as ORM;
use Symfony\Component\Serializer\Attribute\Groups;

#[ORM\Entity(repositoryClass: MensajeRepository::class)]
#[ApiResource(
    operations: [
        new Get(),
        new GetCollection(),
        new Post(processor: MensajeProcessor::class),
        new Put(),
        new Patch(), // Añadido PATCH para actualizaciones parciales
        new Delete()
    ],
    normalizationContext: ['groups' => ['mensaje:read']],
    denormalizationContext: ['groups' => ['mensaje:write']],
    order: ['fechaEnvio' => 'DESC']
)]
#[ApiFilter(SearchFilter::class, properties: [
    'remitente' => 'exact',
    'destinatario' => 'exact',
    'leido' => 'exact'
])]
class Mensaje
{

    #[ORM\Id]
    #[ORM\GeneratedValue]
    #[ORM\Column]
    #[Groups(['mensaje:read'])]
    private ?int $id = null;

    #[ORM\Column(type: Types::TEXT)]
    private ?string $contenido = null;

    #[Groups(['mensaje:read', 'mensaje:write'])]
    private ?string $texto = null;

    #[ORM\Column(type: Types::DATETIME_MUTABLE)]
    #[Groups(['mensaje:read'])]
    private ?\DateTimeInterface $fechaEnvio = null;

    #[ORM\Column]
    #[Groups(['mensaje:read', 'mensaje:write'])]
    private ?bool $leido = false;

    #[ORM\ManyToOne(inversedBy: 'mensajesEnviados')]
    #[ORM\JoinColumn(nullable: false)]
    #[Groups(['mensaje:read'])]
    private ?User $remitente = null;

    #[ORM\ManyToOne(inversedBy: 'mensajesRecibidos')]
    #[ORM\JoinColumn(nullable: false)]
    #[Groups(['mensaje:read', 'mensaje:write'])]
    private ?User $destinatario = null;

    public function __construct()
    {
        $this->fechaEnvio = new \DateTime();
    }

    public function getId(): ?int
    {
        return $this->id;
    }

    public function getContenido(): ?string
    {
        return $this->contenido;
    }

    public function setContenido(?string $contenido): static
    {
        $this->contenido = $contenido;
        return $this;
    }

    public function getTexto(): ?string
    {
        return $this->texto;
    }

    public function setTexto(string $texto): static
    {
        $this->texto = $texto;
        return $this;
    }

    public function getFechaEnvio(): ?\DateTimeInterface
    {
        return $this->fechaEnvio;
    }

    public function setFechaEnvio(\DateTimeInterface $fechaEnvio): static
    {
        $this->fechaEnvio = $fechaEnvio;
        return $this;
    }

    public function isLeido(): ?bool
    {
        return $this->leido;
    }

    public function setLeido(bool $leido): static
    {
        $this->leido = $leido;
        return $this;
    }

    public function getRemitente(): ?User
    {
        return $this->remitente;
    }

    public function setRemitente(?User $remitente): static
    {
        $this->remitente = $remitente;
        return $this;
    }

    public function getDestinatario(): ?User
    {
        return $this->destinatario;
    }

    public function setDestinatario(?User $destinatario): static
    {
        $this->destinatario = $destinatario;
        return $this;
    }
}
