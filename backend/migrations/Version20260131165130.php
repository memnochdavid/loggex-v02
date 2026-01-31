<?php

declare(strict_types=1);

namespace DoctrineMigrations;

use Doctrine\DBAL\Schema\Schema;
use Doctrine\Migrations\AbstractMigration;

/**
 * Auto-generated Migration: Please modify to your needs!
 */
final class Version20260131165130 extends AbstractMigration
{
    public function getDescription(): string
    {
        return '';
    }

    public function up(Schema $schema): void
    {
        // this up() migration is auto-generated, please modify it to your needs
        $this->addSql('ALTER TABLE personalizacion ADD sidebar_active_color VARCHAR(7) NOT NULL, ADD sidebar_active_text_color VARCHAR(7) NOT NULL, ADD sidebar_hover_color VARCHAR(7) NOT NULL, ADD sidebar_hover_text_color VARCHAR(7) NOT NULL, ADD button_primary_text_color VARCHAR(7) NOT NULL, ADD button_secondary_text_color VARCHAR(7) NOT NULL');
    }

    public function down(Schema $schema): void
    {
        // this down() migration is auto-generated, please modify it to your needs
        $this->addSql('ALTER TABLE personalizacion DROP sidebar_active_color, DROP sidebar_active_text_color, DROP sidebar_hover_color, DROP sidebar_hover_text_color, DROP button_primary_text_color, DROP button_secondary_text_color');
    }
}
