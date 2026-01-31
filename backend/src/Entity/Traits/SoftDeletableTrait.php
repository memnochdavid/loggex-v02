<?php

namespace App\Entity\Traits;

use Doctrine\ORM\Mapping as ORM;
use Symfony\Component\Serializer\Attribute\Groups;

trait SoftDeletableTrait
{
    #[ORM\Column(type: 'boolean', options: ['default' => false])]
    #[Groups(['softdelete:read'])]
    private bool $deleted = false;

    #[ORM\Column(type: 'datetime', nullable: true)]
    #[Groups(['softdelete:read'])]
    private ?\DateTimeInterface $deletedAt = null;

    public function isDeleted(): bool
    {
        return $this->deleted;
    }

    public function setDeleted(bool $deleted): static
    {
        $this->deleted = $deleted;
        if ($deleted) {
            $this->deletedAt = new \DateTime();
        } else {
            $this->deletedAt = null;
        }
        return $this;
    }

    public function getDeletedAt(): ?\DateTimeInterface
    {
        return $this->deletedAt;
    }

    public function setDeletedAt(?\DateTimeInterface $deletedAt): static
    {
        $this->deletedAt = $deletedAt;
        return $this;
    }
}
