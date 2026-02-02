<?php

declare(strict_types=1);

namespace DoctrineMigrations;

use Doctrine\DBAL\Schema\Schema;
use Doctrine\Migrations\AbstractMigration;

/**
 * Auto-generated Migration: Please modify to your needs!
 */
final class Version20260202114720 extends AbstractMigration
{
    public function getDescription(): string
    {
        return '';
    }

    public function up(Schema $schema): void
    {
        // this up() migration is auto-generated, please modify it to your needs
        $this->addSql('ALTER TABLE personalizacion DROP timetable_active_header_bg_color, DROP timetable_active_header_text_color, DROP timetable_active_cell_bg_color, CHANGE saved_themes saved_themes JSON DEFAULT NULL');
    }

    public function down(Schema $schema): void
    {
        // this down() migration is auto-generated, please modify it to your needs
        $this->addSql('ALTER TABLE personalizacion ADD timetable_active_header_bg_color VARCHAR(7) NOT NULL, ADD timetable_active_header_text_color VARCHAR(7) NOT NULL, ADD timetable_active_cell_bg_color VARCHAR(7) NOT NULL, CHANGE saved_themes saved_themes LONGTEXT DEFAULT NULL COMMENT \'(DC2Type:json)\'');
    }
}
