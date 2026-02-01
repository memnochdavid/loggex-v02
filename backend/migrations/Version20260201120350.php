<?php

declare(strict_types=1);

namespace DoctrineMigrations;

use Doctrine\DBAL\Schema\Schema;
use Doctrine\Migrations\AbstractMigration;

/**
 * Auto-generated Migration: Please modify to your needs!
 */
final class Version20260201120350 extends AbstractMigration
{
    public function getDescription(): string
    {
        return '';
    }

    public function up(Schema $schema): void
    {
        // this up() migration is auto-generated, please modify it to your needs
        $this->addSql('ALTER TABLE personalizacion ADD items_per_page_usuarios INT NOT NULL, ADD items_per_page_centros INT NOT NULL, ADD items_per_page_ciclos INT NOT NULL, ADD items_per_page_grupos INT NOT NULL, ADD items_per_page_modulos INT NOT NULL, ADD items_per_page_matriculas INT NOT NULL, ADD items_per_page_imparticiones INT NOT NULL, ADD items_per_page_horarios INT NOT NULL');
    }

    public function down(Schema $schema): void
    {
        // this down() migration is auto-generated, please modify it to your needs
        $this->addSql('ALTER TABLE personalizacion DROP items_per_page_usuarios, DROP items_per_page_centros, DROP items_per_page_ciclos, DROP items_per_page_grupos, DROP items_per_page_modulos, DROP items_per_page_matriculas, DROP items_per_page_imparticiones, DROP items_per_page_horarios');
    }
}
