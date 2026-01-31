<?php

namespace App\Entity;

use ApiPlatform\Metadata\ApiResource;
use Doctrine\ORM\Mapping as ORM;
use Symfony\Component\Serializer\Attribute\Groups;

#[ORM\Entity]
#[ORM\Table(name: 'personalizacion')]
#[ApiResource(
    normalizationContext: ['groups' => ['personalizacion:read']],
    denormalizationContext: ['groups' => ['personalizacion:write']]
)]
class Personalizacion
{
    #[ORM\Id]
    #[ORM\GeneratedValue]
    #[ORM\Column]
    #[Groups(['personalizacion:read', 'centro:read', 'user:read'])]
    private ?int $id = null;

    // --- General ---
    #[ORM\Column(length: 7)]
    #[Groups(['personalizacion:read', 'personalizacion:write', 'centro:read', 'centro:write', 'user:read'])]
    private ?string $primaryColor = '#6366f1'; // Indigo

    #[ORM\Column(length: 7)]
    #[Groups(['personalizacion:read', 'personalizacion:write', 'centro:read', 'centro:write', 'user:read'])]
    private ?string $secondaryColor = '#64748b'; // Slate-500 (Nuevo)

    // --- Sidebar ---
    #[ORM\Column(length: 7)]
    #[Groups(['personalizacion:read', 'personalizacion:write', 'centro:read', 'centro:write', 'user:read'])]
    private ?string $sidebarColor = '#1e293b'; // Slate-800

    #[ORM\Column(length: 7)]
    #[Groups(['personalizacion:read', 'personalizacion:write', 'centro:read', 'centro:write', 'user:read'])]
    private ?string $sidebarActiveColor = '#334155'; // Slate-700

    #[ORM\Column(length: 7)]
    #[Groups(['personalizacion:read', 'personalizacion:write', 'centro:read', 'centro:write', 'user:read'])]
    private ?string $sidebarActiveTextColor = '#ffffff'; // White

    #[ORM\Column(length: 7)]
    #[Groups(['personalizacion:read', 'personalizacion:write', 'centro:read', 'centro:write', 'user:read'])]
    private ?string $sidebarHoverColor = '#334155'; // Slate-700

    #[ORM\Column(length: 7)]
    #[Groups(['personalizacion:read', 'personalizacion:write', 'centro:read', 'centro:write', 'user:read'])]
    private ?string $sidebarHoverTextColor = '#ffffff'; // White

    // --- Textos ---
    #[ORM\Column(length: 7)]
    #[Groups(['personalizacion:read', 'personalizacion:write', 'centro:read', 'centro:write', 'user:read'])]
    private ?string $textMainColor = '#334155'; // Slate-700

    #[ORM\Column(length: 7)]
    #[Groups(['personalizacion:read', 'personalizacion:write', 'centro:read', 'centro:write', 'user:read'])]
    private ?string $textSecondaryColor = '#64748b'; // Slate-500

    // --- Botones ---
    #[ORM\Column(length: 7)]
    #[Groups(['personalizacion:read', 'personalizacion:write', 'centro:read', 'centro:write', 'user:read'])]
    private ?string $buttonPrimaryColor = '#6366f1'; // Indigo

    #[ORM\Column(length: 7)]
    #[Groups(['personalizacion:read', 'personalizacion:write', 'centro:read', 'centro:write', 'user:read'])]
    private ?string $buttonPrimaryTextColor = '#ffffff'; // White

    #[ORM\Column(length: 7)]
    #[Groups(['personalizacion:read', 'personalizacion:write', 'centro:read', 'centro:write', 'user:read'])]
    private ?string $buttonSecondaryColor = '#ffffff'; // White

    #[ORM\Column(length: 7)]
    #[Groups(['personalizacion:read', 'personalizacion:write', 'centro:read', 'centro:write', 'user:read'])]
    private ?string $buttonSecondaryTextColor = '#334155'; // Slate-700

    // --- Header/Footer ---
    #[ORM\Column(length: 7)]
    #[Groups(['personalizacion:read', 'personalizacion:write', 'centro:read', 'centro:write', 'user:read'])]
    private ?string $headerFooterColor = '#1e293b'; // Slate-800

    #[ORM\Column(length: 7)]
    #[Groups(['personalizacion:read', 'personalizacion:write', 'centro:read', 'centro:write', 'user:read'])]
    private ?string $headerFooterTextColor = '#ffffff'; // White

    #[ORM\OneToOne(inversedBy: 'personalizacion', targetEntity: Centro::class)]
    #[ORM\JoinColumn(nullable: false)]
    private ?Centro $centro = null;

    public function getId(): ?int
    {
        return $this->id;
    }

    // Getters y Setters
    public function getPrimaryColor(): ?string { return $this->primaryColor; }
    public function setPrimaryColor(string $color): static { $this->primaryColor = $color; return $this; }

    public function getSecondaryColor(): ?string { return $this->secondaryColor; }
    public function setSecondaryColor(string $color): static { $this->secondaryColor = $color; return $this; }

    public function getSidebarColor(): ?string { return $this->sidebarColor; }
    public function setSidebarColor(string $color): static { $this->sidebarColor = $color; return $this; }

    public function getSidebarActiveColor(): ?string { return $this->sidebarActiveColor; }
    public function setSidebarActiveColor(string $color): static { $this->sidebarActiveColor = $color; return $this; }

    public function getSidebarActiveTextColor(): ?string { return $this->sidebarActiveTextColor; }
    public function setSidebarActiveTextColor(string $color): static { $this->sidebarActiveTextColor = $color; return $this; }

    public function getSidebarHoverColor(): ?string { return $this->sidebarHoverColor; }
    public function setSidebarHoverColor(string $color): static { $this->sidebarHoverColor = $color; return $this; }

    public function getSidebarHoverTextColor(): ?string { return $this->sidebarHoverTextColor; }
    public function setSidebarHoverTextColor(string $color): static { $this->sidebarHoverTextColor = $color; return $this; }

    public function getTextMainColor(): ?string { return $this->textMainColor; }
    public function setTextMainColor(string $color): static { $this->textMainColor = $color; return $this; }

    public function getTextSecondaryColor(): ?string { return $this->textSecondaryColor; }
    public function setTextSecondaryColor(string $color): static { $this->textSecondaryColor = $color; return $this; }

    public function getButtonPrimaryColor(): ?string { return $this->buttonPrimaryColor; }
    public function setButtonPrimaryColor(string $color): static { $this->buttonPrimaryColor = $color; return $this; }

    public function getButtonPrimaryTextColor(): ?string { return $this->buttonPrimaryTextColor; }
    public function setButtonPrimaryTextColor(string $color): static { $this->buttonPrimaryTextColor = $color; return $this; }

    public function getButtonSecondaryColor(): ?string { return $this->buttonSecondaryColor; }
    public function setButtonSecondaryColor(string $color): static { $this->buttonSecondaryColor = $color; return $this; }

    public function getButtonSecondaryTextColor(): ?string { return $this->buttonSecondaryTextColor; }
    public function setButtonSecondaryTextColor(string $color): static { $this->buttonSecondaryTextColor = $color; return $this; }

    public function getHeaderFooterColor(): ?string { return $this->headerFooterColor; }
    public function setHeaderFooterColor(string $color): static { $this->headerFooterColor = $color; return $this; }

    public function getHeaderFooterTextColor(): ?string { return $this->headerFooterTextColor; }
    public function setHeaderFooterTextColor(string $color): static { $this->headerFooterTextColor = $color; return $this; }

    public function getCentro(): ?Centro
    {
        return $this->centro;
    }

    public function setCentro(Centro $centro): static
    {
        $this->centro = $centro;
        return $this;
    }
}
