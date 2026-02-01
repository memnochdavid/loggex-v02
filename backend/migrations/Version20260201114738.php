<?php

declare(strict_types=1);

namespace DoctrineMigrations;

use Doctrine\DBAL\Schema\Schema;
use Doctrine\Migrations\AbstractMigration;

/**
 * Auto-generated Migration: Please modify to your needs!
 */
final class Version20260201114738 extends AbstractMigration
{
    public function getDescription(): string
    {
        return '';
    }

    public function up(Schema $schema): void
    {
        // this up() migration is auto-generated, please modify it to your needs
        $this->addSql('ALTER TABLE personalizacion ADD datatable_header_hover_bg_color VARCHAR(7) NOT NULL, ADD datatable_header_hover_text_color VARCHAR(7) NOT NULL, ADD datatable_header_active_bg_color VARCHAR(7) NOT NULL, ADD datatable_header_active_text_color VARCHAR(7) NOT NULL, ADD datatable_pagination_button_bg_color VARCHAR(7) NOT NULL, ADD datatable_pagination_button_text_color VARCHAR(7) NOT NULL, ADD datatable_pagination_button_hover_bg_color VARCHAR(7) NOT NULL, ADD datatable_pagination_button_hover_text_color VARCHAR(7) NOT NULL, ADD datatable_pagination_button_active_bg_color VARCHAR(7) NOT NULL, ADD datatable_pagination_button_active_text_color VARCHAR(7) NOT NULL');
    }

    public function down(Schema $schema): void
    {
        // this down() migration is auto-generated, please modify it to your needs
        $this->addSql('ALTER TABLE personalizacion DROP datatable_header_hover_bg_color, DROP datatable_header_hover_text_color, DROP datatable_header_active_bg_color, DROP datatable_header_active_text_color, DROP datatable_pagination_button_bg_color, DROP datatable_pagination_button_text_color, DROP datatable_pagination_button_hover_bg_color, DROP datatable_pagination_button_hover_text_color, DROP datatable_pagination_button_active_bg_color, DROP datatable_pagination_button_active_text_color');
    }
}
