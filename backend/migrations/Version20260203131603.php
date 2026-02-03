<?php

declare(strict_types=1);

namespace DoctrineMigrations;

use Doctrine\DBAL\Schema\Schema;
use Doctrine\Migrations\AbstractMigration;

/**
 * Auto-generated Migration: Please modify to your needs!
 */
final class Version20260203131603 extends AbstractMigration
{
    public function getDescription(): string
    {
        return '';
    }

    public function up(Schema $schema): void
    {
        // this up() migration is auto-generated, please modify it to your needs
        $this->addSql('ALTER TABLE personalizacion ADD modal_header_bg_color VARCHAR(7) NOT NULL, ADD modal_header_text_color VARCHAR(7) NOT NULL, ADD modal_body_bg_color VARCHAR(7) NOT NULL, ADD modal_body_text_color VARCHAR(7) NOT NULL, ADD modal_footer_bg_color VARCHAR(7) NOT NULL');
    }

    public function down(Schema $schema): void
    {
        // this down() migration is auto-generated, please modify it to your needs
        $this->addSql('ALTER TABLE personalizacion DROP modal_header_bg_color, DROP modal_header_text_color, DROP modal_body_bg_color, DROP modal_body_text_color, DROP modal_footer_bg_color');
    }
}
