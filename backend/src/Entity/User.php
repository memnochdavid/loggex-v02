<?php

namespace App\Entity;

use ApiPlatform\Doctrine\Orm\Filter\OrderFilter;
use ApiPlatform\Doctrine\Orm\Filter\SearchFilter;
use ApiPlatform\Metadata\ApiFilter;
use App\Doctrine\Filter\SearchAnyFilter;
use ApiPlatform\Metadata\ApiResource;
use ApiPlatform\Metadata\Delete;
use ApiPlatform\Metadata\Get;
use ApiPlatform\Metadata\GetCollection;
use ApiPlatform\Metadata\Post;
use ApiPlatform\Metadata\Put;
use App\Entity\Traits\SoftDeletableTrait;
use App\Entity\Traits\TimestampableTrait;
use App\Repository\UserRepository;
use App\State\SoftDeleteProcessor;
use Doctrine\Common\Collections\ArrayCollection;
use Doctrine\Common\Collections\Collection;
use Doctrine\ORM\Mapping as ORM;
use Symfony\Component\Security\Core\User\PasswordAuthenticatedUserInterface;
use Symfony\Component\Security\Core\User\UserInterface;
use Symfony\Component\Serializer\Attribute\Groups;
use Symfony\Component\Serializer\Attribute\SerializedName;

#[ORM\Entity(repositoryClass: UserRepository::class)]
#[ORM\Table(name: 'usuario')]
#[ORM\HasLifecycleCallbacks]
#[ApiResource(
    operations: [
        new Get(),
        new GetCollection(),
        new Post(),
        new Put(),
        new Delete(processor: SoftDeleteProcessor::class)
    ],
    normalizationContext: ['groups' => ['user:read', 'timestamp:read', 'softdelete:read']],
    denormalizationContext: ['groups' => ['user:write']]
)]
#[ApiFilter(SearchFilter::class, properties: [
    'nombre' => 'partial',
    'apellidos' => 'partial',
    'email' => 'partial',
    'telefono' => 'partial',
    'nif' => 'partial',
    'centro' => 'exact',
    'rol_app' => 'exact'
])]
#[ApiFilter(SearchAnyFilter::class, properties: ['nombre', 'apellidos', 'email', 'nif'])]
#[ApiFilter(OrderFilter::class, properties: ['nombre', 'apellidos', 'email', 'id'], arguments: ['orderParameterName' => 'order'])]
class User implements UserInterface, PasswordAuthenticatedUserInterface
{
    use TimestampableTrait;
    use SoftDeletableTrait;

    #[ORM\Id]
    #[ORM\GeneratedValue]
    #[ORM\Column]
    #[Groups(['user:read', 'matricula:read', 'imparticion:read', 'entrega:read', 'tarea:read', 'mensaje:read', 'comunicado:read', 'asistencia:read'])] // Añadido asistencia:read
    private ?int $id = null;

    #[ORM\Column(length: 180, unique: true)]
    #[Groups(['user:read', 'user:write', 'matricula:read', 'imparticion:read', 'entrega:read', 'tarea:read', 'mensaje:read', 'comunicado:read'])] // Añadido comunicado:read
    private ?string $email = null;

    #[ORM\Column]
    #[Groups(['user:read', 'user:write'])]
    private array $roles = [];

    /**
     * @var string The hashed password
     */
    #[ORM\Column]
    private ?string $password = null;

    #[ORM\Column(length: 255)]
    #[Groups(['user:read', 'user:write', 'matricula:read', 'imparticion:read', 'horario:read', 'entrega:read', 'tarea:read', 'mensaje:read', 'comunicado:read', 'asistencia:read'])] // Añadido asistencia:read
    private ?string $nombre = null;

    #[ORM\Column(length: 255)]
    #[Groups(['user:read', 'user:write', 'matricula:read', 'imparticion:read', 'horario:read', 'entrega:read', 'tarea:read', 'mensaje:read', 'comunicado:read', 'asistencia:read'])] // Añadido asistencia:read
    private ?string $apellidos = null;

    #[ORM\Column(length: 20, nullable: true)]
    #[Groups(['user:read', 'user:write'])]
    private ?string $telefono = null;

    #[ORM\Column(length: 20, nullable: true)]
    #[Groups(['user:read', 'user:write'])]
    private ?string $nif = null;

    #[ORM\Column(length: 20)]
    #[Groups(['user:read', 'user:write'])]
    private ?string $rol_app = null;

    #[ORM\Column(length: 255, nullable: true)]
    #[Groups(['user:read', 'user:write', 'matricula:read', 'imparticion:read', 'entrega:read', 'tarea:read', 'mensaje:read', 'comunicado:read', 'asistencia:read'])] // Añadido asistencia:read
    private ?string $foto = null;

    #[ORM\Column(length: 255, nullable: true)]
    #[Groups(['user:read'])]
    private ?string $firma = null;

    #[ORM\ManyToOne(inversedBy: 'usuarios')]
    #[ORM\JoinColumn(nullable: true)]
    #[Groups(['user:read', 'user:write'])]
    private ?Centro $centro = null;

    #[ORM\OneToMany(mappedBy: 'alumno', targetEntity: Matricula::class)]
    private Collection $matriculas;

    #[ORM\OneToMany(mappedBy: 'profesor', targetEntity: Imparticion::class)]
    private Collection $imparticiones;

    #[ORM\OneToMany(mappedBy: 'alumno', targetEntity: Entrega::class)]
    private Collection $entregas;

    #[ORM\OneToMany(mappedBy: 'alumno', targetEntity: Asistencia::class)]
    private Collection $asistencias;

    #[ORM\OneToMany(mappedBy: 'remitente', targetEntity: Mensaje::class)]
    private Collection $mensajesEnviados;

    #[ORM\OneToMany(mappedBy: 'destinatario', targetEntity: Mensaje::class)]
    private Collection $mensajesRecibidos;

    /**
     * IDs de tutoriales interactivos que el usuario ya ha completado o saltado.
     * Persistido en JSON para no acoplar el backend a una lista cerrada de tours
     * (los tours viven en el frontend).
     */
    #[ORM\Column(type: 'json', options: ['default' => '[]'])]
    private array $tutorialsCompleted = [];

    public function __construct()
    {
        $this->matriculas = new ArrayCollection();
        $this->imparticiones = new ArrayCollection();
        $this->entregas = new ArrayCollection();
        $this->asistencias = new ArrayCollection();
        $this->mensajesEnviados = new ArrayCollection();
        $this->mensajesRecibidos = new ArrayCollection();
    }

    public function getId(): ?int
    {
        return $this->id;
    }

    public function getEmail(): ?string
    {
        return $this->email;
    }

    public function setEmail(string $email): static
    {
        $this->email = $email;

        return $this;
    }

    /**
     * A visual identifier that represents this user.
     *
     * @see UserInterface
     */
    public function getUserIdentifier(): string
    {
        return (string)$this->email;
    }

    /**
     * @see UserInterface
     */
    public function getRoles(): array
    {
        $roles = $this->roles;
        // guarantee every user at least has ROLE_USER
        $roles[] = 'ROLE_USER';

        return array_unique($roles);
    }

    public function setRoles(array $roles): static
    {
        $this->roles = $roles;

        return $this;
    }

    /**
     * @see PasswordAuthenticatedUserInterface
     */
    public function getPassword(): string
    {
        return $this->password;
    }

    public function setPassword(string $password): static
    {
        $this->password = $password;

        return $this;
    }

    /**
     * @see UserInterface
     */
    public function eraseCredentials(): void
    {
        // If you store any temporary, sensitive data on the user, clear it here
        // $this->plainPassword = null;
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

    public function getApellidos(): ?string
    {
        return $this->apellidos;
    }

    public function setApellidos(string $apellidos): static
    {
        $this->apellidos = $apellidos;

        return $this;
    }

    public function getTelefono(): ?string
    {
        return $this->telefono;
    }

    public function setTelefono(?string $telefono): static
    {
        $this->telefono = $telefono;

        return $this;
    }

    public function getNif(): ?string
    {
        return $this->nif;
    }

    public function setNif(?string $nif): static
    {
        $this->nif = $nif;

        return $this;
    }

    public function getRolApp(): ?string
    {
        return $this->rol_app;
    }

    public function setRolApp(string $rol_app): static
    {
        $this->rol_app = $rol_app;

        return $this;
    }

    public function getFoto(): ?string
    {
        return $this->foto;
    }

    public function getFirma(): ?string
    {
        return $this->firma;
    }

    public function setFirma(?string $firma): static
    {
        $this->firma = $firma;
        return $this;
    }

    public function setFoto(?string $foto): static
    {
        $this->foto = $foto;

        return $this;
    }

    public function getCentro(): ?Centro
    {
        return $this->centro;
    }

    public function setCentro(?Centro $centro): static
    {
        $this->centro = $centro;

        return $this;
    }

    #[Groups(['user:read'])]
    #[SerializedName('centro_id')]
    public function getCentroId(): ?int
    {
        return $this->centro ? $this->centro->getId() : null;
    }

    /**
     * @return Collection<int, Matricula>
     */
    public function getMatriculas(): Collection
    {
        return $this->matriculas;
    }

    public function addMatricula(Matricula $matricula): static
    {
        if (!$this->matriculas->contains($matricula)) {
            $this->matriculas->add($matricula);
            $matricula->setAlumno($this);
        }

        return $this;
    }

    public function removeMatricula(Matricula $matricula): static
    {
        if ($this->matriculas->removeElement($matricula)) {
            // set the owning side to null (unless already changed)
            if ($matricula->getAlumno() === $this) {
                $matricula->setAlumno(null);
            }
        }

        return $this;
    }

    /**
     * @return Collection<int, Imparticion>
     */
    public function getImparticiones(): Collection
    {
        return $this->imparticiones;
    }

    public function addImparticion(Imparticion $imparticion): static
    {
        if (!$this->imparticiones->contains($imparticion)) {
            $this->imparticiones->add($imparticion);
            $imparticion->setProfesor($this);
        }

        return $this;
    }

    public function removeImparticion(Imparticion $imparticion): static
    {
        if ($this->imparticiones->removeElement($imparticion)) {
            // set the owning side to null (unless already changed)
            if ($imparticion->getProfesor() === $this) {
                $imparticion->setProfesor(null);
            }
        }

        return $this;
    }

    /**
     * @return Collection<int, Entrega>
     */
    public function getEntregas(): Collection
    {
        return $this->entregas;
    }

    public function addEntrega(Entrega $entrega): static
    {
        if (!$this->entregas->contains($entrega)) {
            $this->entregas->add($entrega);
            $entrega->setAlumno($this);
        }

        return $this;
    }

    public function removeEntrega(Entrega $entrega): static
    {
        if ($this->entregas->removeElement($entrega)) {
            // set the owning side to null (unless already changed)
            if ($entrega->getAlumno() === $this) {
                $entrega->setAlumno(null);
            }
        }

        return $this;
    }

    /**
     * @return Collection<int, Asistencia>
     */
    public function getAsistencias(): Collection
    {
        return $this->asistencias;
    }

    public function addAsistencia(Asistencia $asistencia): static
    {
        if (!$this->asistencias->contains($asistencia)) {
            $this->asistencias->add($asistencia);
            $asistencia->setAlumno($this);
        }

        return $this;
    }

    public function removeAsistencia(Asistencia $asistencia): static
    {
        if ($this->asistencias->removeElement($asistencia)) {
            // set the owning side to null (unless already changed)
            if ($asistencia->getAlumno() === $this) {
                $asistencia->setAlumno(null);
            }
        }

        return $this;
    }

    /**
     * @return Collection<int, Mensaje>
     */
    public function getMensajesEnviados(): Collection
    {
        return $this->mensajesEnviados;
    }

    public function addMensajesEnviado(Mensaje $mensajesEnviado): static
    {
        if (!$this->mensajesEnviados->contains($mensajesEnviado)) {
            $this->mensajesEnviados->add($mensajesEnviado);
            $mensajesEnviado->setRemitente($this);
        }

        return $this;
    }

    public function removeMensajesEnviado(Mensaje $mensajesEnviado): static
    {
        if ($this->mensajesEnviados->removeElement($mensajesEnviado)) {
            // set the owning side to null (unless already changed)
            if ($mensajesEnviado->getRemitente() === $this) {
                $mensajesEnviado->setRemitente(null);
            }
        }

        return $this;
    }

    /**
     * @return Collection<int, Mensaje>
     */
    public function getMensajesRecibidos(): Collection
    {
        return $this->mensajesRecibidos;
    }

    public function addMensajesRecibido(Mensaje $mensajesRecibido): static
    {
        if (!$this->mensajesRecibidos->contains($mensajesRecibido)) {
            $this->mensajesRecibidos->add($mensajesRecibido);
            $mensajesRecibido->setDestinatario($this);
        }

        return $this;
    }

    public function removeMensajesRecibido(Mensaje $mensajesRecibido): static
    {
        if ($this->mensajesRecibidos->removeElement($mensajesRecibido)) {
            // set the owning side to null (unless already changed)
            if ($mensajesRecibido->getDestinatario() === $this) {
                $mensajesRecibido->setDestinatario(null);
            }
        }

        return $this;
    }

    /* =========================================================
       Tutoriales interactivos
       ========================================================= */

    public function getTutorialsCompleted(): array
    {
        return $this->tutorialsCompleted;
    }

    public function setTutorialsCompleted(array $ids): static
    {
        /* Normaliza: solo strings, sin duplicados, con índices reseteados
           para que se serialice como array JSON y no como objeto. */
        $clean = array_values(array_unique(array_filter($ids, 'is_string')));
        $this->tutorialsCompleted = $clean;
        return $this;
    }

    public function markTutorialCompleted(string $id): static
    {
        if (!in_array($id, $this->tutorialsCompleted, true)) {
            $this->tutorialsCompleted[] = $id;
        }
        return $this;
    }
}
