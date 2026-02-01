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
use App\State\SoftDeleteProcessor;
use Doctrine\ORM\Mapping as ORM;
use Symfony\Component\Serializer\Attribute\Groups;

#[ORM\Entity]
#[ORM\Table(name: 'personalizacion')]
#[ORM\HasLifecycleCallbacks]
#[ApiResource(
    operations: [
        new Get(),
        new GetCollection(),
        new Post(),
        new Put(),
        new Delete(processor: SoftDeleteProcessor::class)
    ],
    normalizationContext: ['groups' => ['personalizacion:read', 'timestamp:read', 'softdelete:read']],
    denormalizationContext: ['groups' => ['personalizacion:write']]
)]
class Personalizacion
{
    use TimestampableTrait;
    use SoftDeletableTrait;

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
    private ?string $secondaryColor = '#64748b'; // Slate-500

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

    // --- Scrollbar ---
    #[ORM\Column(length: 7)]
    #[Groups(['personalizacion:read', 'personalizacion:write', 'centro:read', 'centro:write', 'user:read'])]
    private ?string $scrollbarThumbColor = '#cbd5e1'; // Slate-300

    #[ORM\Column(length: 7)]
    #[Groups(['personalizacion:read', 'personalizacion:write', 'centro:read', 'centro:write', 'user:read'])]
    private ?string $scrollbarTrackColor = '#f1f5f9'; // Slate-100

    #[ORM\Column(length: 7)]
    #[Groups(['personalizacion:read', 'personalizacion:write', 'centro:read', 'centro:write', 'user:read'])]
    private ?string $scrollbarHoverColor = '#94a3b8'; // Slate-400

    // --- Calendario ---
    #[ORM\Column(length: 7)]
    #[Groups(['personalizacion:read', 'personalizacion:write', 'centro:read', 'centro:write', 'user:read'])]
    private ?string $calendarSelectedBgColor = '#6366f1'; // Indigo-500

    #[ORM\Column(length: 7)]
    #[Groups(['personalizacion:read', 'personalizacion:write', 'centro:read', 'centro:write', 'user:read'])]
    private ?string $calendarSelectedTextColor = '#ffffff'; // White

    #[ORM\Column(length: 7)]
    #[Groups(['personalizacion:read', 'personalizacion:write', 'centro:read', 'centro:write', 'user:read'])]
    private ?string $calendarWeekendBgColor = '#f1f5f9'; // Slate-100

    #[ORM\Column(length: 7)]
    #[Groups(['personalizacion:read', 'personalizacion:write', 'centro:read', 'centro:write', 'user:read'])]
    private ?string $calendarWeekendTextColor = '#64748b'; // Slate-500

    // --- Horario (TimeTable) ---
    #[ORM\Column(length: 7)]
    #[Groups(['personalizacion:read', 'personalizacion:write', 'centro:read', 'centro:write', 'user:read'])]
    private ?string $timetableHeaderBgColor = '#f1f5f9'; // Slate-100

    #[ORM\Column(length: 7)]
    #[Groups(['personalizacion:read', 'personalizacion:write', 'centro:read', 'centro:write', 'user:read'])]
    private ?string $timetableHeaderTextColor = '#334155'; // Slate-700

    #[ORM\Column(length: 7)]
    #[Groups(['personalizacion:read', 'personalizacion:write', 'centro:read', 'centro:write', 'user:read'])]
    private ?string $timetableHoursBgColor = '#f8fafc'; // Slate-50 (Nuevo)

    #[ORM\Column(length: 7)]
    #[Groups(['personalizacion:read', 'personalizacion:write', 'centro:read', 'centro:write', 'user:read'])]
    private ?string $timetableHoursTextColor = '#64748b'; // Slate-500 (Nuevo)

    #[ORM\OneToOne(inversedBy: 'personalizacion', targetEntity: Centro::class)]
    #[ORM\JoinColumn(nullable: true)]
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

    public function getScrollbarThumbColor(): ?string { return $this->scrollbarThumbColor; }
    public function setScrollbarThumbColor(string $color): static { $this->scrollbarThumbColor = $color; return $this; }

    public function getScrollbarTrackColor(): ?string { return $this->scrollbarTrackColor; }
    public function setScrollbarTrackColor(string $color): static { $this->scrollbarTrackColor = $color; return $this; }

    public function getScrollbarHoverColor(): ?string { return $this->scrollbarHoverColor; }
    public function setScrollbarHoverColor(string $color): static { $this->scrollbarHoverColor = $color; return $this; }

    public function getCalendarSelectedBgColor(): ?string { return $this->calendarSelectedBgColor; }
    public function setCalendarSelectedBgColor(string $color): static { $this->calendarSelectedBgColor = $color; return $this; }

    public function getCalendarSelectedTextColor(): ?string { return $this->calendarSelectedTextColor; }
    public function setCalendarSelectedTextColor(string $color): static { $this->calendarSelectedTextColor = $color; return $this; }

    public function getCalendarWeekendBgColor(): ?string { return $this->calendarWeekendBgColor; }
    public function setCalendarWeekendBgColor(string $color): static { $this->calendarWeekendBgColor = $color; return $this; }

    public function getCalendarWeekendTextColor(): ?string { return $this->calendarWeekendTextColor; }
    public function setCalendarWeekendTextColor(string $color): static { $this->calendarWeekendTextColor = $color; return $this; }

    public function getTimetableHeaderBgColor(): ?string { return $this->timetableHeaderBgColor; }
    public function setTimetableHeaderBgColor(string $color): static { $this->timetableHeaderBgColor = $color; return $this; }

    public function getTimetableHeaderTextColor(): ?string { return $this->timetableHeaderTextColor; }
    public function setTimetableHeaderTextColor(string $color): static { $this->timetableHeaderTextColor = $color; return $this; }

    public function getTimetableHoursBgColor(): ?string { return $this->timetableHoursBgColor; }
    public function setTimetableHoursBgColor(string $color): static { $this->timetableHoursBgColor = $color; return $this; }

    public function getTimetableHoursTextColor(): ?string { return $this->timetableHoursTextColor; }
    public function setTimetableHoursTextColor(string $color): static { $this->timetableHoursTextColor = $color; return $this; }

    public function getCentro(): ?Centro
    {
        return $this->centro;
    }

    public function setCentro(?Centro $centro): static
    {
        $this->centro = $centro;
        return $this;
    }
}
