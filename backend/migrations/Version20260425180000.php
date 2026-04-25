<?php

declare(strict_types=1);

namespace DoctrineMigrations;

use Doctrine\DBAL\Schema\Schema;
use Doctrine\Migrations\AbstractMigration;

/**
 * Catálogo: amplía `normativa` de VARCHAR(255) a TEXT.
 *
 * Algunos títulos de RD del BOE superan los 255 caracteres (notablemente
 * RD 127/2014 que regula 14 títulos de FP Básica simultáneamente y tiene un
 * preámbulo larguísimo en su `<titulo>`). TEXT es la solución sin más
 * complicación.
 */
final class Version20260425180000 extends AbstractMigration
{
    public function getDescription(): string
    {
        return 'Catálogo: catalogo_itinerario.normativa pasa de VARCHAR(255) a TEXT.';
    }

    public function up(Schema $schema): void
    {
        $this->addSql('ALTER TABLE catalogo_itinerario MODIFY normativa LONGTEXT DEFAULT NULL');
    }

    public function down(Schema $schema): void
    {
        $this->addSql('ALTER TABLE catalogo_itinerario MODIFY normativa VARCHAR(255) DEFAULT NULL');
    }
}
