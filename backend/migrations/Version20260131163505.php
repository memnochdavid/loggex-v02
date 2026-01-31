<?php

declare(strict_types=1);

namespace DoctrineMigrations;

use Doctrine\DBAL\Schema\Schema;
use Doctrine\Migrations\AbstractMigration;

/**
 * Auto-generated Migration: Please modify to your needs!
 */
final class Version20260131163505 extends AbstractMigration
{
    public function getDescription(): string
    {
        return '';
    }

    public function up(Schema $schema): void
    {
        // this up() migration is auto-generated, please modify it to your needs
        $this->addSql('ALTER TABLE personalizacion ADD text_main_color VARCHAR(7) NOT NULL, ADD text_secondary_color VARCHAR(7) NOT NULL, ADD button_primary_color VARCHAR(7) NOT NULL, ADD button_secondary_color VARCHAR(7) NOT NULL, ADD header_footer_color VARCHAR(7) NOT NULL, ADD header_footer_text_color VARCHAR(7) NOT NULL');
    }

    public function down(Schema $schema): void
    {
        // this down() migration is auto-generated, please modify it to your needs
        $this->addSql('ALTER TABLE personalizacion DROP text_main_color, DROP text_secondary_color, DROP button_primary_color, DROP button_secondary_color, DROP header_footer_color, DROP header_footer_text_color');
    }
}
