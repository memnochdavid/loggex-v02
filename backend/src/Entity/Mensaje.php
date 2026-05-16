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
use Symfony\Component\Validator\Constraints as Assert;

#[ORM\Entity(repositoryClass: MensajeRepository::class)]
#[ORM\HasLifecycleCallbacks]
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
    // Clave de cifrado (En producción debería estar en .env)
    private const ENCRYPTION_KEY = 'LoggexSecretKeyForMessages2026';
    private const CIPHER_METHOD = 'AES-256-CBC';

    #[ORM\Id]
    #[ORM\GeneratedValue]
    #[ORM\Column]
    #[Groups(['mensaje:read'])]
    private ?int $id = null;

    #[ORM\Column(type: Types::TEXT)]
    #[Assert\NotBlank]
    private ?string $contenido = null;

    #[Groups(['mensaje:read', 'mensaje:write'])]
    #[Assert\NotBlank(groups: ['write'])]
    #[Assert\Length(max: 5000, groups: ['write'])]
    private ?string $texto = null;

    #[ORM\Column(type: Types::DATETIME_MUTABLE)]
    #[Groups(['mensaje:read'])]
    private ?\DateTimeInterface $fechaEnvio = null;

    #[ORM\Column]
    #[Assert\NotNull]
    #[Groups(['mensaje:read', 'mensaje:write'])]
    private ?bool $leido = false;

    #[ORM\ManyToOne(inversedBy: 'mensajesEnviados')]
    #[ORM\JoinColumn(nullable: false)]
    #[Assert\NotNull]
    #[Groups(['mensaje:read'])]
    private ?User $remitente = null;

    #[ORM\ManyToOne(inversedBy: 'mensajesRecibidos')]
    #[ORM\JoinColumn(nullable: false)]
    #[Assert\NotNull]
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

    #[ORM\PrePersist]
    #[ORM\PreUpdate]
    public function encryptContent(): void
    {
        if ($this->texto) {
            $ivLength = openssl_cipher_iv_length(self::CIPHER_METHOD);
            $iv = openssl_random_pseudo_bytes($ivLength);
            $encrypted = openssl_encrypt($this->texto, self::CIPHER_METHOD, self::ENCRYPTION_KEY, 0, $iv);
            $this->contenido = base64_encode($iv . $encrypted);
        }
    }

    #[ORM\PostLoad]
    public function decryptContent(): void
    {
        if ($this->contenido) {
            // Intentar descifrar
            try {
                $data = base64_decode($this->contenido, true);
                if ($data === false) {
                    throw new \Exception("No es base64 válido");
                }

                $ivLength = openssl_cipher_iv_length(self::CIPHER_METHOD);
                if (strlen($data) < $ivLength) {
                    throw new \Exception("Datos demasiado cortos");
                }

                $iv = substr($data, 0, $ivLength);
                $encrypted = substr($data, $ivLength);

                $decrypted = openssl_decrypt($encrypted, self::CIPHER_METHOD, self::ENCRYPTION_KEY, 0, $iv);

                if ($decrypted === false) {
                    // Si falla el descifrado, asumimos que es texto plano
                    $this->texto = $this->contenido;
                } else {
                    $this->texto = $decrypted;
                }
            } catch (\Exception $e) {
                // Si hay error, devolvemos el contenido tal cual (texto plano)
                $this->texto = $this->contenido;
            }
        }
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
