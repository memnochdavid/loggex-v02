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
    private ?string $primaryColor = '#6366f1';

    #[ORM\Column(length: 7)]
    #[Groups(['personalizacion:read', 'personalizacion:write', 'centro:read', 'centro:write', 'user:read'])]
    private ?string $secondaryColor = '#64748b';

    // --- Sidebar ---
    #[ORM\Column(length: 7)]
    #[Groups(['personalizacion:read', 'personalizacion:write', 'centro:read', 'centro:write', 'user:read'])]
    private ?string $sidebarColor = '#1e293b';

    #[ORM\Column(length: 7)]
    #[Groups(['personalizacion:read', 'personalizacion:write', 'centro:read', 'centro:write', 'user:read'])]
    private ?string $sidebarActiveColor = '#334155';

    #[ORM\Column(length: 7)]
    #[Groups(['personalizacion:read', 'personalizacion:write', 'centro:read', 'centro:write', 'user:read'])]
    private ?string $sidebarActiveTextColor = '#ffffff';

    #[ORM\Column(length: 7)]
    #[Groups(['personalizacion:read', 'personalizacion:write', 'centro:read', 'centro:write', 'user:read'])]
    private ?string $sidebarHoverColor = '#334155';

    #[ORM\Column(length: 7)]
    #[Groups(['personalizacion:read', 'personalizacion:write', 'centro:read', 'centro:write', 'user:read'])]
    private ?string $sidebarHoverTextColor = '#ffffff';

    // --- Sidebar Accordion (NUEVO) ---
    #[ORM\Column(length: 7)]
    #[Groups(['personalizacion:read', 'personalizacion:write', 'centro:read', 'centro:write', 'user:read'])]
    private ?string $sidebarAccordionHeaderBgColor = '#1e293b';

    #[ORM\Column(length: 7)]
    #[Groups(['personalizacion:read', 'personalizacion:write', 'centro:read', 'centro:write', 'user:read'])]
    private ?string $sidebarAccordionHeaderTextColor = '#ffffff';

    #[ORM\Column(length: 7)]
    #[Groups(['personalizacion:read', 'personalizacion:write', 'centro:read', 'centro:write', 'user:read'])]
    private ?string $sidebarAccordionContentBgColor = '#0f172a';

    #[ORM\Column(length: 7)]
    #[Groups(['personalizacion:read', 'personalizacion:write', 'centro:read', 'centro:write', 'user:read'])]
    private ?string $sidebarAccordionContentTextColor = '#cbd5e1';

    // --- Textos ---
    #[ORM\Column(length: 7)]
    #[Groups(['personalizacion:read', 'personalizacion:write', 'centro:read', 'centro:write', 'user:read'])]
    private ?string $textMainColor = '#334155';

    #[ORM\Column(length: 7)]
    #[Groups(['personalizacion:read', 'personalizacion:write', 'centro:read', 'centro:write', 'user:read'])]
    private ?string $textSecondaryColor = '#64748b';

    #[ORM\Column(length: 7)]
    #[Groups(['personalizacion:read', 'personalizacion:write', 'centro:read', 'centro:write', 'user:read'])]
    private ?string $specialTextColor = '#ffffff';

    // --- Botones ---
    #[ORM\Column(length: 7)]
    #[Groups(['personalizacion:read', 'personalizacion:write', 'centro:read', 'centro:write', 'user:read'])]
    private ?string $buttonPrimaryColor = '#6366f1';

    #[ORM\Column(length: 7)]
    #[Groups(['personalizacion:read', 'personalizacion:write', 'centro:read', 'centro:write', 'user:read'])]
    private ?string $buttonPrimaryTextColor = '#ffffff';

    #[ORM\Column(length: 7)]
    #[Groups(['personalizacion:read', 'personalizacion:write', 'centro:read', 'centro:write', 'user:read'])]
    private ?string $buttonSecondaryColor = '#ffffff';

    #[ORM\Column(length: 7)]
    #[Groups(['personalizacion:read', 'personalizacion:write', 'centro:read', 'centro:write', 'user:read'])]
    private ?string $buttonSecondaryTextColor = '#334155';

    // --- Header/Footer ---
    #[ORM\Column(length: 7)]
    #[Groups(['personalizacion:read', 'personalizacion:write', 'centro:read', 'centro:write', 'user:read'])]
    private ?string $headerFooterColor = '#1e293b';

    #[ORM\Column(length: 7)]
    #[Groups(['personalizacion:read', 'personalizacion:write', 'centro:read', 'centro:write', 'user:read'])]
    private ?string $headerFooterTextColor = '#ffffff';

    // --- Scrollbar ---
    #[ORM\Column(length: 7)]
    #[Groups(['personalizacion:read', 'personalizacion:write', 'centro:read', 'centro:write', 'user:read'])]
    private ?string $scrollbarThumbColor = '#cbd5e1';

    #[ORM\Column(length: 7)]
    #[Groups(['personalizacion:read', 'personalizacion:write', 'centro:read', 'centro:write', 'user:read'])]
    private ?string $scrollbarTrackColor = '#f1f5f9';

    #[ORM\Column(length: 7)]
    #[Groups(['personalizacion:read', 'personalizacion:write', 'centro:read', 'centro:write', 'user:read'])]
    private ?string $scrollbarHoverColor = '#94a3b8';

    #[ORM\Column(length: 10)]
    #[Groups(['personalizacion:read', 'personalizacion:write', 'centro:read', 'centro:write', 'user:read'])]
    private ?string $scrollbarWidth = '12px';

    // --- Calendario ---
    #[ORM\Column(length: 7)]
    #[Groups(['personalizacion:read', 'personalizacion:write', 'centro:read', 'centro:write', 'user:read'])]
    private ?string $calendarSelectedBgColor = '#6366f1';

    #[ORM\Column(length: 7)]
    #[Groups(['personalizacion:read', 'personalizacion:write', 'centro:read', 'centro:write', 'user:read'])]
    private ?string $calendarSelectedTextColor = '#ffffff';

    #[ORM\Column(length: 7)]
    #[Groups(['personalizacion:read', 'personalizacion:write', 'centro:read', 'centro:write', 'user:read'])]
    private ?string $calendarWeekendBgColor = '#f1f5f9';

    #[ORM\Column(length: 7)]
    #[Groups(['personalizacion:read', 'personalizacion:write', 'centro:read', 'centro:write', 'user:read'])]
    private ?string $calendarWeekendTextColor = '#64748b';

    // --- Horario (TimeTable) ---
    #[ORM\Column(length: 7)]
    #[Groups(['personalizacion:read', 'personalizacion:write', 'centro:read', 'centro:write', 'user:read'])]
    private ?string $timetableHeaderBgColor = '#f1f5f9';

    #[ORM\Column(length: 7)]
    #[Groups(['personalizacion:read', 'personalizacion:write', 'centro:read', 'centro:write', 'user:read'])]
    private ?string $timetableHeaderTextColor = '#334155';

    #[ORM\Column(length: 7)]
    #[Groups(['personalizacion:read', 'personalizacion:write', 'centro:read', 'centro:write', 'user:read'])]
    private ?string $timetableHoursBgColor = '#f8fafc';

    #[ORM\Column(length: 7)]
    #[Groups(['personalizacion:read', 'personalizacion:write', 'centro:read', 'centro:write', 'user:read'])]
    private ?string $timetableHoursTextColor = '#64748b';

    #[ORM\Column(length: 7)]
    #[Groups(['personalizacion:read', 'personalizacion:write', 'centro:read', 'centro:write', 'user:read'])]
    private ?string $timetableSelectedHeaderBg = '#e0e7ff';

    #[ORM\Column(length: 7)]
    #[Groups(['personalizacion:read', 'personalizacion:write', 'centro:read', 'centro:write', 'user:read'])]
    private ?string $timetableSelectedHeaderText = '#4338ca';

    #[ORM\Column(length: 7)]
    #[Groups(['personalizacion:read', 'personalizacion:write', 'centro:read', 'centro:write', 'user:read'])]
    private ?string $timetableSelectedCellBg = '#eef2ff';

    // --- DataTable ---
    #[ORM\Column(length: 7)]
    #[Groups(['personalizacion:read', 'personalizacion:write', 'centro:read', 'centro:write', 'user:read'])]
    private ?string $datatableHeaderBgColor = '#f8fafc';

    #[ORM\Column(length: 7)]
    #[Groups(['personalizacion:read', 'personalizacion:write', 'centro:read', 'centro:write', 'user:read'])]
    private ?string $datatableHeaderTextColor = '#64748b';

    #[ORM\Column(length: 7)]
    #[Groups(['personalizacion:read', 'personalizacion:write', 'centro:read', 'centro:write', 'user:read'])]
    private ?string $datatableHeaderHoverBgColor = '#f1f5f9';

    #[ORM\Column(length: 7)]
    #[Groups(['personalizacion:read', 'personalizacion:write', 'centro:read', 'centro:write', 'user:read'])]
    private ?string $datatableHeaderHoverTextColor = '#334155';

    #[ORM\Column(length: 7)]
    #[Groups(['personalizacion:read', 'personalizacion:write', 'centro:read', 'centro:write', 'user:read'])]
    private ?string $datatableHeaderActiveBgColor = '#e2e8f0';

    #[ORM\Column(length: 7)]
    #[Groups(['personalizacion:read', 'personalizacion:write', 'centro:read', 'centro:write', 'user:read'])]
    private ?string $datatableHeaderActiveTextColor = '#1e293b';

    #[ORM\Column(length: 7)]
    #[Groups(['personalizacion:read', 'personalizacion:write', 'centro:read', 'centro:write', 'user:read'])]
    private ?string $datatablePaginationBgColor = '#f8fafc';

    #[ORM\Column(length: 7)]
    #[Groups(['personalizacion:read', 'personalizacion:write', 'centro:read', 'centro:write', 'user:read'])]
    private ?string $datatablePaginationTextColor = '#64748b';

    #[ORM\Column(length: 7)]
    #[Groups(['personalizacion:read', 'personalizacion:write', 'centro:read', 'centro:write', 'user:read'])]
    private ?string $datatablePaginationButtonBgColor = '#ffffff';

    #[ORM\Column(length: 7)]
    #[Groups(['personalizacion:read', 'personalizacion:write', 'centro:read', 'centro:write', 'user:read'])]
    private ?string $datatablePaginationButtonTextColor = '#64748b';

    #[ORM\Column(length: 7)]
    #[Groups(['personalizacion:read', 'personalizacion:write', 'centro:read', 'centro:write', 'user:read'])]
    private ?string $datatablePaginationButtonHoverBgColor = '#f1f5f9';

    #[ORM\Column(length: 7)]
    #[Groups(['personalizacion:read', 'personalizacion:write', 'centro:read', 'centro:write', 'user:read'])]
    private ?string $datatablePaginationButtonHoverTextColor = '#334155';

    #[ORM\Column(length: 7)]
    #[Groups(['personalizacion:read', 'personalizacion:write', 'centro:read', 'centro:write', 'user:read'])]
    private ?string $datatablePaginationButtonActiveBgColor = '#e2e8f0';

    #[ORM\Column(length: 7)]
    #[Groups(['personalizacion:read', 'personalizacion:write', 'centro:read', 'centro:write', 'user:read'])]
    private ?string $datatablePaginationButtonActiveTextColor = '#1e293b';

    // --- Accordion ---
    #[ORM\Column(length: 7)]
    #[Groups(['personalizacion:read', 'personalizacion:write', 'centro:read', 'centro:write', 'user:read'])]
    private ?string $accordionHeaderBgColor = '#f1f5f9';

    #[ORM\Column(length: 7)]
    #[Groups(['personalizacion:read', 'personalizacion:write', 'centro:read', 'centro:write', 'user:read'])]
    private ?string $accordionHeaderTextColor = '#334155';

    #[ORM\Column(length: 7)]
    #[Groups(['personalizacion:read', 'personalizacion:write', 'centro:read', 'centro:write', 'user:read'])]
    private ?string $accordionHeaderActiveBgColor = '#f1f5f9';

    #[ORM\Column(length: 7)]
    #[Groups(['personalizacion:read', 'personalizacion:write', 'centro:read', 'centro:write', 'user:read'])]
    private ?string $accordionHeaderActiveTextColor = '#334155';

    #[ORM\Column(length: 7)]
    #[Groups(['personalizacion:read', 'personalizacion:write', 'centro:read', 'centro:write', 'user:read'])]
    private ?string $accordionContentBgColor = '#ffffff';

    #[ORM\Column(length: 7)]
    #[Groups(['personalizacion:read', 'personalizacion:write', 'centro:read', 'centro:write', 'user:read'])]
    private ?string $accordionContentTextColor = '#64748b';

    // --- Modal ---
    #[ORM\Column(length: 7)]
    #[Groups(['personalizacion:read', 'personalizacion:write', 'centro:read', 'centro:write', 'user:read'])]
    private ?string $modalHeaderBgColor = '#ffffff';

    #[ORM\Column(length: 7)]
    #[Groups(['personalizacion:read', 'personalizacion:write', 'centro:read', 'centro:write', 'user:read'])]
    private ?string $modalHeaderTextColor = '#334155';

    #[ORM\Column(length: 7)]
    #[Groups(['personalizacion:read', 'personalizacion:write', 'centro:read', 'centro:write', 'user:read'])]
    private ?string $modalBodyBgColor = '#ffffff';

    #[ORM\Column(length: 7)]
    #[Groups(['personalizacion:read', 'personalizacion:write', 'centro:read', 'centro:write', 'user:read'])]
    private ?string $modalBodyTextColor = '#334155';

    #[ORM\Column(length: 7)]
    #[Groups(['personalizacion:read', 'personalizacion:write', 'centro:read', 'centro:write', 'user:read'])]
    private ?string $modalFooterBgColor = '#f8fafc';

    // --- Modal Close Button ---
    #[ORM\Column(length: 7)]
    #[Groups(['personalizacion:read', 'personalizacion:write', 'centro:read', 'centro:write', 'user:read'])]
    private ?string $modalCloseButtonBgColor = '#ffffff';

    #[ORM\Column(length: 7)]
    #[Groups(['personalizacion:read', 'personalizacion:write', 'centro:read', 'centro:write', 'user:read'])]
    private ?string $modalCloseButtonTextColor = '#64748b';

    #[ORM\Column(length: 7)]
    #[Groups(['personalizacion:read', 'personalizacion:write', 'centro:read', 'centro:write', 'user:read'])]
    private ?string $modalCloseButtonHoverBgColor = '#f1f5f9';

    #[ORM\Column(length: 7)]
    #[Groups(['personalizacion:read', 'personalizacion:write', 'centro:read', 'centro:write', 'user:read'])]
    private ?string $modalCloseButtonHoverTextColor = '#334155';

    // --- UserCard (NUEVO) ---
    #[ORM\Column(length: 7)]
    #[Groups(['personalizacion:read', 'personalizacion:write', 'centro:read', 'centro:write', 'user:read'])]
    private ?string $userCardBgColor = '#1e293b';

    #[ORM\Column(length: 7)]
    #[Groups(['personalizacion:read', 'personalizacion:write', 'centro:read', 'centro:write', 'user:read'])]
    private ?string $userCardTextColor = '#ffffff';

    #[ORM\Column(length: 7)]
    #[Groups(['personalizacion:read', 'personalizacion:write', 'centro:read', 'centro:write', 'user:read'])]
    private ?string $userCardTextSecondaryColor = '#cbd5e1';

    // --- Chat (NUEVO) ---
    #[ORM\Column(length: 7)]
    #[Groups(['personalizacion:read', 'personalizacion:write', 'centro:read', 'centro:write', 'user:read'])]
    private ?string $chatSidebarBgColor = '#ffffff';

    #[ORM\Column(length: 7)]
    #[Groups(['personalizacion:read', 'personalizacion:write', 'centro:read', 'centro:write', 'user:read'])]
    private ?string $chatItemHoverBgColor = '#f1f5f9';

    #[ORM\Column(length: 7)]
    #[Groups(['personalizacion:read', 'personalizacion:write', 'centro:read', 'centro:write', 'user:read'])]
    private ?string $chatItemActiveBgColor = '#e0e7ff';

    #[ORM\Column(length: 7)]
    #[Groups(['personalizacion:read', 'personalizacion:write', 'centro:read', 'centro:write', 'user:read'])]
    private ?string $chatItemActiveBorderColor = '#6366f1';

    #[ORM\Column(length: 7)]
    #[Groups(['personalizacion:read', 'personalizacion:write', 'centro:read', 'centro:write', 'user:read'])]
    private ?string $chatItemTextMainColor = '#334155';

    #[ORM\Column(length: 7)]
    #[Groups(['personalizacion:read', 'personalizacion:write', 'centro:read', 'centro:write', 'user:read'])]
    private ?string $chatItemTextSecondaryColor = '#64748b';

    #[ORM\Column(length: 7)]
    #[Groups(['personalizacion:read', 'personalizacion:write', 'centro:read', 'centro:write', 'user:read'])]
    private ?string $chatBadgeBgColor = '#6366f1';

    #[ORM\Column(length: 7)]
    #[Groups(['personalizacion:read', 'personalizacion:write', 'centro:read', 'centro:write', 'user:read'])]
    private ?string $chatBadgeTextColor = '#ffffff';

    #[ORM\Column(length: 7)]
    #[Groups(['personalizacion:read', 'personalizacion:write', 'centro:read', 'centro:write', 'user:read'])]
    private ?string $chatHeaderBgColor = '#1e293b';

    #[ORM\Column(length: 7)]
    #[Groups(['personalizacion:read', 'personalizacion:write', 'centro:read', 'centro:write', 'user:read'])]
    private ?string $chatHeaderTextColor = '#ffffff';

    #[ORM\Column(length: 7)]
    #[Groups(['personalizacion:read', 'personalizacion:write', 'centro:read', 'centro:write', 'user:read'])]
    private ?string $chatContainerBgColor = '#f8fafc';

    #[ORM\Column(length: 7)]
    #[Groups(['personalizacion:read', 'personalizacion:write', 'centro:read', 'centro:write', 'user:read'])]
    private ?string $chatInputAreaBgColor = '#ffffff'; // NUEVO

    #[ORM\Column(length: 7)]
    #[Groups(['personalizacion:read', 'personalizacion:write', 'centro:read', 'centro:write', 'user:read'])]
    private ?string $chatBubbleSentBgColor = '#6366f1';

    #[ORM\Column(length: 7)]
    #[Groups(['personalizacion:read', 'personalizacion:write', 'centro:read', 'centro:write', 'user:read'])]
    private ?string $chatBubbleSentTextColor = '#ffffff';

    #[ORM\Column(length: 7)]
    #[Groups(['personalizacion:read', 'personalizacion:write', 'centro:read', 'centro:write', 'user:read'])]
    private ?string $chatBubbleReceivedBgColor = '#ffffff';

    #[ORM\Column(length: 7)]
    #[Groups(['personalizacion:read', 'personalizacion:write', 'centro:read', 'centro:write', 'user:read'])]
    private ?string $chatBubbleReceivedTextColor = '#334155';

    // --- EventCard & EventsSidebar ---
    #[ORM\Column(length: 7)]
    #[Groups(['personalizacion:read', 'personalizacion:write', 'centro:read', 'centro:write', 'user:read'])]
    private ?string $eventCardBgColor = '#ffffff';

    #[ORM\Column(length: 7)]
    #[Groups(['personalizacion:read', 'personalizacion:write', 'centro:read', 'centro:write', 'user:read'])]
    private ?string $eventCardBorderColor = '#e2e8f0';

    #[ORM\Column(length: 7)]
    #[Groups(['personalizacion:read', 'personalizacion:write', 'centro:read', 'centro:write', 'user:read'])]
    private ?string $eventCardTitleColor = '#334155';

    #[ORM\Column(length: 7)]
    #[Groups(['personalizacion:read', 'personalizacion:write', 'centro:read', 'centro:write', 'user:read'])]
    private ?string $eventCardMetaColor = '#64748b';

    #[ORM\Column(length: 7)]
    #[Groups(['personalizacion:read', 'personalizacion:write', 'centro:read', 'centro:write', 'user:read'])]
    private ?string $eventsSidebarBgColor = 'transparent'; // AÑADIDO

    #[ORM\Column(length: 7)]
    #[Groups(['personalizacion:read', 'personalizacion:write', 'centro:read', 'centro:write', 'user:read'])]
    private ?string $eventsSidebarTitleColor = '#334155';

    // --- Paginación (Items Per Page) ---
    #[ORM\Column]
    #[Groups(['personalizacion:read', 'personalizacion:write', 'centro:read', 'centro:write', 'user:read'])]
    private int $itemsPerPageUsuarios = 20;

    #[ORM\Column]
    #[Groups(['personalizacion:read', 'personalizacion:write', 'centro:read', 'centro:write', 'user:read'])]
    private int $itemsPerPageCentros = 20;

    #[ORM\Column]
    #[Groups(['personalizacion:read', 'personalizacion:write', 'centro:read', 'centro:write', 'user:read'])]
    private int $itemsPerPageCiclos = 20;

    #[ORM\Column]
    #[Groups(['personalizacion:read', 'personalizacion:write', 'centro:read', 'centro:write', 'user:read'])]
    private int $itemsPerPageGrupos = 20;

    #[ORM\Column]
    #[Groups(['personalizacion:read', 'personalizacion:write', 'centro:read', 'centro:write', 'user:read'])]
    private int $itemsPerPageModulos = 20;

    #[ORM\Column]
    #[Groups(['personalizacion:read', 'personalizacion:write', 'centro:read', 'centro:write', 'user:read'])]
    private int $itemsPerPageMatriculas = 20;

    #[ORM\Column]
    #[Groups(['personalizacion:read', 'personalizacion:write', 'centro:read', 'centro:write', 'user:read'])]
    private int $itemsPerPageImparticiones = 20;

    #[ORM\Column]
    #[Groups(['personalizacion:read', 'personalizacion:write', 'centro:read', 'centro:write', 'user:read'])]
    private int $itemsPerPageHorarios = 20;

    // --- Configuración Título Centro ---
    #[ORM\Column(name: 'name_title_config', type: 'json', nullable: true)]
    #[Groups(['personalizacion:read', 'personalizacion:write', 'centro:read', 'centro:write', 'user:read'])]
    private ?array $nameTitleConfig = null;

    // --- Temas Guardados ---
    #[ORM\Column(name: 'temas_guardados', type: 'json', nullable: true)]
    #[Groups(['personalizacion:read', 'personalizacion:write', 'centro:read', 'centro:write', 'user:read'])]
    private ?array $savedThemes = [];

    #[ORM\OneToOne(inversedBy: 'personalizacion', targetEntity: Centro::class)]
    #[ORM\JoinColumn(nullable: true)]
    private ?Centro $centro = null;

    public function getId(): ?int
    {
        return $this->id;
    }

    // ... (Getters y Setters) ...

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

    // --- Sidebar Accordion ---
    public function getSidebarAccordionHeaderBgColor(): ?string { return $this->sidebarAccordionHeaderBgColor; }
    public function setSidebarAccordionHeaderBgColor(string $color): static { $this->sidebarAccordionHeaderBgColor = $color; return $this; }

    public function getSidebarAccordionHeaderTextColor(): ?string { return $this->sidebarAccordionHeaderTextColor; }
    public function setSidebarAccordionHeaderTextColor(string $color): static { $this->sidebarAccordionHeaderTextColor = $color; return $this; }

    public function getSidebarAccordionContentBgColor(): ?string { return $this->sidebarAccordionContentBgColor; }
    public function setSidebarAccordionContentBgColor(string $color): static { $this->sidebarAccordionContentBgColor = $color; return $this; }

    public function getSidebarAccordionContentTextColor(): ?string { return $this->sidebarAccordionContentTextColor; }
    public function setSidebarAccordionContentTextColor(string $color): static { $this->sidebarAccordionContentTextColor = $color; return $this; }

    public function getTextMainColor(): ?string { return $this->textMainColor; }
    public function setTextMainColor(string $color): static { $this->textMainColor = $color; return $this; }

    public function getTextSecondaryColor(): ?string { return $this->textSecondaryColor; }
    public function setTextSecondaryColor(string $color): static { $this->textSecondaryColor = $color; return $this; }

    public function getSpecialTextColor(): ?string { return $this->specialTextColor; }
    public function setSpecialTextColor(string $color): static { $this->specialTextColor = $color; return $this; }

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

    public function getScrollbarWidth(): ?string { return $this->scrollbarWidth; }
    public function setScrollbarWidth(string $width): static { $this->scrollbarWidth = $width; return $this; }

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

    public function getTimetableSelectedHeaderBg(): ?string { return $this->timetableSelectedHeaderBg; }
    public function setTimetableSelectedHeaderBg(string $color): static { $this->timetableSelectedHeaderBg = $color; return $this; }

    public function getTimetableSelectedHeaderText(): ?string { return $this->timetableSelectedHeaderText; }
    public function setTimetableSelectedHeaderText(string $color): static { $this->timetableSelectedHeaderText = $color; return $this; }

    public function getTimetableSelectedCellBg(): ?string { return $this->timetableSelectedCellBg; }
    public function setTimetableSelectedCellBg(string $color): static { $this->timetableSelectedCellBg = $color; return $this; }

    public function getDatatableHeaderBgColor(): ?string { return $this->datatableHeaderBgColor; }
    public function setDatatableHeaderBgColor(string $color): static { $this->datatableHeaderBgColor = $color; return $this; }

    public function getDatatableHeaderTextColor(): ?string { return $this->datatableHeaderTextColor; }
    public function setDatatableHeaderTextColor(string $color): static { $this->datatableHeaderTextColor = $color; return $this; }

    public function getDatatableHeaderHoverBgColor(): ?string { return $this->datatableHeaderHoverBgColor; }
    public function setDatatableHeaderHoverBgColor(string $color): static { $this->datatableHeaderHoverBgColor = $color; return $this; }

    public function getDatatableHeaderHoverTextColor(): ?string { return $this->datatableHeaderHoverTextColor; }
    public function setDatatableHeaderHoverTextColor(string $color): static { $this->datatableHeaderHoverTextColor = $color; return $this; }

    public function getDatatableHeaderActiveBgColor(): ?string { return $this->datatableHeaderActiveBgColor; }
    public function setDatatableHeaderActiveBgColor(string $color): static { $this->datatableHeaderActiveBgColor = $color; return $this; }

    public function getDatatableHeaderActiveTextColor(): ?string { return $this->datatableHeaderActiveTextColor; }
    public function setDatatableHeaderActiveTextColor(string $color): static { $this->datatableHeaderActiveTextColor = $color; return $this; }

    public function getDatatablePaginationBgColor(): ?string { return $this->datatablePaginationBgColor; }
    public function setDatatablePaginationBgColor(string $color): static { $this->datatablePaginationBgColor = $color; return $this; }

    public function getDatatablePaginationTextColor(): ?string { return $this->datatablePaginationTextColor; }
    public function setDatatablePaginationTextColor(string $color): static { $this->datatablePaginationTextColor = $color; return $this; }

    public function getDatatablePaginationButtonBgColor(): ?string { return $this->datatablePaginationButtonBgColor; }
    public function setDatatablePaginationButtonBgColor(string $color): static { $this->datatablePaginationButtonBgColor = $color; return $this; }

    public function getDatatablePaginationButtonTextColor(): ?string { return $this->datatablePaginationButtonTextColor; }
    public function setDatatablePaginationButtonTextColor(string $color): static { $this->datatablePaginationButtonTextColor = $color; return $this; }

    public function getDatatablePaginationButtonHoverBgColor(): ?string { return $this->datatablePaginationButtonHoverBgColor; }
    public function setDatatablePaginationButtonHoverBgColor(string $color): static { $this->datatablePaginationButtonHoverBgColor = $color; return $this; }

    public function getDatatablePaginationButtonHoverTextColor(): ?string { return $this->datatablePaginationButtonHoverTextColor; }
    public function setDatatablePaginationButtonHoverTextColor(string $color): static { $this->datatablePaginationButtonHoverTextColor = $color; return $this; }

    public function getDatatablePaginationButtonActiveBgColor(): ?string { return $this->datatablePaginationButtonActiveBgColor; }
    public function setDatatablePaginationButtonActiveBgColor(string $color): static { $this->datatablePaginationButtonActiveBgColor = $color; return $this; }

    public function getDatatablePaginationButtonActiveTextColor(): ?string { return $this->datatablePaginationButtonActiveTextColor; }
    public function setDatatablePaginationButtonActiveTextColor(string $color): static { $this->datatablePaginationButtonActiveTextColor = $color; return $this; }

    public function getAccordionHeaderBgColor(): ?string { return $this->accordionHeaderBgColor; }
    public function setAccordionHeaderBgColor(string $color): static { $this->accordionHeaderBgColor = $color; return $this; }

    public function getAccordionHeaderTextColor(): ?string { return $this->accordionHeaderTextColor; }
    public function setAccordionHeaderTextColor(string $color): static { $this->accordionHeaderTextColor = $color; return $this; }

    public function getAccordionHeaderActiveBgColor(): ?string { return $this->accordionHeaderActiveBgColor; }
    public function setAccordionHeaderActiveBgColor(string $color): static { $this->accordionHeaderActiveBgColor = $color; return $this; }

    public function getAccordionHeaderActiveTextColor(): ?string { return $this->accordionHeaderActiveTextColor; }
    public function setAccordionHeaderActiveTextColor(string $color): static { $this->accordionHeaderActiveTextColor = $color; return $this; }

    public function getAccordionContentBgColor(): ?string { return $this->accordionContentBgColor; }
    public function setAccordionContentBgColor(string $color): static { $this->accordionContentBgColor = $color; return $this; }

    public function getAccordionContentTextColor(): ?string { return $this->accordionContentTextColor; }
    public function setAccordionContentTextColor(string $color): static { $this->accordionContentTextColor = $color; return $this; }

    public function getModalHeaderBgColor(): ?string { return $this->modalHeaderBgColor; }
    public function setModalHeaderBgColor(string $color): static { $this->modalHeaderBgColor = $color; return $this; }

    public function getModalHeaderTextColor(): ?string { return $this->modalHeaderTextColor; }
    public function setModalHeaderTextColor(string $color): static { $this->modalHeaderTextColor = $color; return $this; }

    public function getModalBodyBgColor(): ?string { return $this->modalBodyBgColor; }
    public function setModalBodyBgColor(string $color): static { $this->modalBodyBgColor = $color; return $this; }

    public function getModalBodyTextColor(): ?string { return $this->modalBodyTextColor; }
    public function setModalBodyTextColor(string $color): static { $this->modalBodyTextColor = $color; return $this; }

    public function getModalFooterBgColor(): ?string { return $this->modalFooterBgColor; }
    public function setModalFooterBgColor(string $color): static { $this->modalFooterBgColor = $color; return $this; }

    public function getModalCloseButtonBgColor(): ?string { return $this->modalCloseButtonBgColor; }
    public function setModalCloseButtonBgColor(string $color): static { $this->modalCloseButtonBgColor = $color; return $this; }

    public function getModalCloseButtonTextColor(): ?string { return $this->modalCloseButtonTextColor; }
    public function setModalCloseButtonTextColor(string $color): static { $this->modalCloseButtonTextColor = $color; return $this; }

    public function getModalCloseButtonHoverBgColor(): ?string { return $this->modalCloseButtonHoverBgColor; }
    public function setModalCloseButtonHoverBgColor(string $color): static { $this->modalCloseButtonHoverBgColor = $color; return $this; }

    public function getModalCloseButtonHoverTextColor(): ?string { return $this->modalCloseButtonHoverTextColor; }
    public function setModalCloseButtonHoverTextColor(string $color): static { $this->modalCloseButtonHoverTextColor = $color; return $this; }

    // --- UserCard ---
    public function getUserCardBgColor(): ?string { return $this->userCardBgColor; }
    public function setUserCardBgColor(string $color): static { $this->userCardBgColor = $color; return $this; }

    public function getUserCardTextColor(): ?string { return $this->userCardTextColor; }
    public function setUserCardTextColor(string $color): static { $this->userCardTextColor = $color; return $this; }

    public function getUserCardTextSecondaryColor(): ?string { return $this->userCardTextSecondaryColor; }
    public function setUserCardTextSecondaryColor(string $color): static { $this->userCardTextSecondaryColor = $color; return $this; }

    // --- Chat ---
    public function getChatSidebarBgColor(): ?string { return $this->chatSidebarBgColor; }
    public function setChatSidebarBgColor(string $color): static { $this->chatSidebarBgColor = $color; return $this; }

    public function getChatItemHoverBgColor(): ?string { return $this->chatItemHoverBgColor; }
    public function setChatItemHoverBgColor(string $color): static { $this->chatItemHoverBgColor = $color; return $this; }

    public function getChatItemActiveBgColor(): ?string { return $this->chatItemActiveBgColor; }
    public function setChatItemActiveBgColor(string $color): static { $this->chatItemActiveBgColor = $color; return $this; }

    public function getChatItemActiveBorderColor(): ?string { return $this->chatItemActiveBorderColor; }
    public function setChatItemActiveBorderColor(string $color): static { $this->chatItemActiveBorderColor = $color; return $this; }

    public function getChatItemTextMainColor(): ?string { return $this->chatItemTextMainColor; }
    public function setChatItemTextMainColor(string $color): static { $this->chatItemTextMainColor = $color; return $this; }

    public function getChatItemTextSecondaryColor(): ?string { return $this->chatItemTextSecondaryColor; }
    public function setChatItemTextSecondaryColor(string $color): static { $this->chatItemTextSecondaryColor = $color; return $this; }

    public function getChatBadgeBgColor(): ?string { return $this->chatBadgeBgColor; }
    public function setChatBadgeBgColor(string $color): static { $this->chatBadgeBgColor = $color; return $this; }

    public function getChatBadgeTextColor(): ?string { return $this->chatBadgeTextColor; }
    public function setChatBadgeTextColor(string $color): static { $this->chatBadgeTextColor = $color; return $this; }

    public function getChatHeaderBgColor(): ?string { return $this->chatHeaderBgColor; }
    public function setChatHeaderBgColor(string $color): static { $this->chatHeaderBgColor = $color; return $this; }

    public function getChatHeaderTextColor(): ?string { return $this->chatHeaderTextColor; }
    public function setChatHeaderTextColor(string $color): static { $this->chatHeaderTextColor = $color; return $this; }

    public function getChatContainerBgColor(): ?string { return $this->chatContainerBgColor; }
    public function setChatContainerBgColor(string $color): static { $this->chatContainerBgColor = $color; return $this; }

    public function getChatInputAreaBgColor(): ?string { return $this->chatInputAreaBgColor; }
    public function setChatInputAreaBgColor(string $color): static { $this->chatInputAreaBgColor = $color; return $this; }

    public function getChatBubbleSentBgColor(): ?string { return $this->chatBubbleSentBgColor; }
    public function setChatBubbleSentBgColor(string $color): static { $this->chatBubbleSentBgColor = $color; return $this; }

    public function getChatBubbleSentTextColor(): ?string { return $this->chatBubbleSentTextColor; }
    public function setChatBubbleSentTextColor(string $color): static { $this->chatBubbleSentTextColor = $color; return $this; }

    public function getChatBubbleReceivedBgColor(): ?string { return $this->chatBubbleReceivedBgColor; }
    public function setChatBubbleReceivedBgColor(string $color): static { $this->chatBubbleReceivedBgColor = $color; return $this; }

    public function getChatBubbleReceivedTextColor(): ?string { return $this->chatBubbleReceivedTextColor; }
    public function setChatBubbleReceivedTextColor(string $color): static { $this->chatBubbleReceivedTextColor = $color; return $this; }

    // --- EventCard & EventsSidebar ---
    public function getEventCardBgColor(): ?string { return $this->eventCardBgColor; }
    public function setEventCardBgColor(string $color): static { $this->eventCardBgColor = $color; return $this; }

    public function getEventCardBorderColor(): ?string { return $this->eventCardBorderColor; }
    public function setEventCardBorderColor(string $color): static { $this->eventCardBorderColor = $color; return $this; }

    public function getEventCardTitleColor(): ?string { return $this->eventCardTitleColor; }
    public function setEventCardTitleColor(string $color): static { $this->eventCardTitleColor = $color; return $this; }

    public function getEventCardMetaColor(): ?string { return $this->eventCardMetaColor; }
    public function setEventCardMetaColor(string $color): static { $this->eventCardMetaColor = $color; return $this; }

    public function getEventsSidebarBgColor(): ?string { return $this->eventsSidebarBgColor; } // AÑADIDO
    public function setEventsSidebarBgColor(string $color): static { $this->eventsSidebarBgColor = $color; return $this; } // AÑADIDO

    public function getEventsSidebarTitleColor(): ?string { return $this->eventsSidebarTitleColor; }
    public function setEventsSidebarTitleColor(string $color): static { $this->eventsSidebarTitleColor = $color; return $this; }

    public function getItemsPerPageUsuarios(): int { return $this->itemsPerPageUsuarios; }
    public function setItemsPerPageUsuarios(int $items): static { $this->itemsPerPageUsuarios = $items; return $this; }

    public function getItemsPerPageCentros(): int { return $this->itemsPerPageCentros; }
    public function setItemsPerPageCentros(int $items): static { $this->itemsPerPageCentros = $items; return $this; }

    public function getItemsPerPageCiclos(): int { return $this->itemsPerPageCiclos; }
    public function setItemsPerPageCiclos(int $items): static { $this->itemsPerPageCiclos = $items; return $this; }

    public function getItemsPerPageGrupos(): int { return $this->itemsPerPageGrupos; }
    public function setItemsPerPageGrupos(int $items): static { $this->itemsPerPageGrupos = $items; return $this; }

    public function getItemsPerPageModulos(): int { return $this->itemsPerPageModulos; }
    public function setItemsPerPageModulos(int $items): static { $this->itemsPerPageModulos = $items; return $this; }

    public function getItemsPerPageMatriculas(): int { return $this->itemsPerPageMatriculas; }
    public function setItemsPerPageMatriculas(int $items): static { $this->itemsPerPageMatriculas = $items; return $this; }

    public function getItemsPerPageImparticiones(): int { return $this->itemsPerPageImparticiones; }
    public function setItemsPerPageImparticiones(int $items): static { $this->itemsPerPageImparticiones = $items; return $this; }

    public function getItemsPerPageHorarios(): int { return $this->itemsPerPageHorarios; }
    public function setItemsPerPageHorarios(int $items): static { $this->itemsPerPageHorarios = $items; return $this; }

    public function getNameTitleConfig(): ?array { return $this->nameTitleConfig; }
    public function setNameTitleConfig(?array $config): static { $this->nameTitleConfig = $config; return $this; }

    public function getSavedThemes(): ?array { return $this->savedThemes; }
    public function setSavedThemes(?array $themes): static { $this->savedThemes = $themes; return $this; }

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
