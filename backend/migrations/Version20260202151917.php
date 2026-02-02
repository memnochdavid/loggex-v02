<?php

declare(strict_types=1);

namespace DoctrineMigrations;

use Doctrine\DBAL\Schema\Schema;
use Doctrine\Migrations\AbstractMigration;

/**
 * Auto-generated Migration: Please modify to your needs!
 */
final class Version20260202151917 extends AbstractMigration
{
    public function getDescription(): string
    {
        return '';
    }

    public function up(Schema $schema): void
    {
        // this up() migration is auto-generated, please modify it to your needs
        $this->addSql('ALTER TABLE personalizacion DROP accordion_header_bg_color, DROP accordion_header_text_color, DROP temas_guardados');
    }

    public function down(Schema $schema): void
    {
        // this down() migration is auto-generated, please modify it to your needs
        $this->addSql('ALTER TABLE personalizacion ADD accordion_header_bg_color VARCHAR(7) NOT NULL, ADD accordion_header_text_color VARCHAR(7) NOT NULL, ADD temas_guardados JSON DEFAULT NULL');
    }
}
