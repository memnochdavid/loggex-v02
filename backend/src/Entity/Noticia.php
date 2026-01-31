<?php

namespace App\Entity;

use ApiPlatform\Metadata\ApiResource;
use ApiPlatform\Metadata\Delete;
use ApiPlatform\Metadata\Get;
use ApiPlatform\Metadata\GetCollection;
use ApiPlatform\Metadata\Post;
use ApiPlatform\Metadata\Put;
use App\Entity\Traits\SoftDeletableTrait;
use App\Entity\Traits\TimestampableTrait;
use App\Repository\NoticiaRepository;
use App\State\SoftDeleteProcessor;
use Doctrine\DBAL\Types\Types;
use Doctrine\ORM\Mapping as ORM;
use Symfony\Component\Serializer\Attribute\Groups;

#[ORM\Entity(repositoryClass: NoticiaRepository::class)]
#[ORM\Table(name: 'noticia')]
#[ORM\HasLifecycleCallbacks]
#[ApiResource(
    operations: [
        new Get(),
        new GetCollection(),
        new Post(),
        new Put(),
        new Delete(processor: SoftDeleteProcessor::class)
    ],
    normalizationContext: ['groups' => ['noticia:read', 'timestamp:read', 'softdelete:read']],
    denormalizationContext: ['groups' => ['noticia:write']]
)]
class Noticia
{
    use TimestampableTrait;
    use SoftDeletableTrait;

    #[ORM\Id]
    #[ORM\GeneratedValue]
    #[ORM\Column]
    #[Groups(['noticia:read'])]
    private ?int $id = null;

    #[ORM\Column(length: 255)]
    #[Groups(['noticia:read', 'noticia:write'])]
    private ?string $titulo = null;

    #[ORM\Column(type: Types::TEXT)]
    #[Groups(['noticia:read', 'noticia:write'])]
    private ?string $contenido = null;

    #[ORM\Column(type: Types::DATETIME_MUTABLE)]
    #[Groups(['noticia:read', 'noticia:write'])]
    private ?\DateTimeInterface $fechaPublicacion = null;

    #[ORM\ManyToOne(inversedBy: 'noticias')]
    #[ORM\JoinColumn(nullable: false)]
    #[Groups(['noticia:read', 'noticia:write'])]
    private ?Centro $centro = null;

    #[ORM\ManyToOne(inversedBy: 'noticias')]
    #[ORM\JoinColumn(nullable: false)]
    #[Groups(['noticia:read', 'noticia:write'])]
    private ?User $autor = null;

    public function getId(): ?int
    {
        return $this->id;
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

    public function getContenido(): ?string
    {
        return $this->contenido;
    }

    public function setContenido(string $contenido): static
    {
        $this->contenido = $contenido;
        return $this;
    }

    public function getFechaPublicacion(): ?\DateTimeInterface
    {
        return $this->fechaPublicacion;
    }

    public function setFechaPublicacion(\DateTimeInterface $fechaPublicacion): static
    {
        $this->fechaPublicacion = $fechaPublicacion;
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

    public function getAutor(): ?User
    {
        return $this->autor;
    }

    public function setAutor(?User $autor): static
    {
        $this->autor = $autor;
        return $this;
    }
}
