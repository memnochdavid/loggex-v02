<?php

declare(strict_types=1);

namespace DoctrineMigrations;

use Doctrine\DBAL\Schema\Schema;
use Doctrine\Migrations\AbstractMigration;

/**
 * Auto-generated Migration: Please modify to your needs!
 */
final class Version20260201102353 extends AbstractMigration
{
    public function getDescription(): string
    {
        return '';
    }

    public function up(Schema $schema): void
    {
        // this up() migration is auto-generated, please modify it to your needs
        $this->addSql('ALTER TABLE personalizacion ADD calendar_selected_bg_color VARCHAR(7) NOT NULL, ADD calendar_selected_text_color VARCHAR(7) NOT NULL, ADD calendar_weekend_bg_color VARCHAR(7) NOT NULL, ADD calendar_weekend_text_color VARCHAR(7) NOT NULL, ADD timetable_header_bg_color VARCHAR(7) NOT NULL, ADD timetable_header_text_color VARCHAR(7) NOT NULL');
    }

    public function down(Schema $schema): void
    {
        // this down() migration is auto-generated, please modify it to your needs
        $this->addSql('ALTER TABLE personalizacion DROP calendar_selected_bg_color, DROP calendar_selected_text_color, DROP calendar_weekend_bg_color, DROP calendar_weekend_text_color, DROP timetable_header_bg_color, DROP timetable_header_text_color');
    }
}
