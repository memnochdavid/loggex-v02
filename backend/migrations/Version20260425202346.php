<?php

declare(strict_types=1);

namespace DoctrineMigrations;

use Doctrine\DBAL\Schema\Schema;
use Doctrine\Migrations\AbstractMigration;

/**
 * Auto-generated Migration: Please modify to your needs!
 */
final class Version20260425202346 extends AbstractMigration
{
    public function getDescription(): string
    {
        return '';
    }

    public function up(Schema $schema): void
    {
        // this up() migration is auto-generated, please modify it to your needs
        $this->addSql('ALTER TABLE materia ADD tipo VARCHAR(255) DEFAULT NULL, CHANGE horas_semanales horas_semanales INT DEFAULT NULL');
        $this->addSql('ALTER TABLE tema_visual RENAME INDEX idx_61e3a538298137a7 TO IDX_2C49299D298137A7');
    }

    public function down(Schema $schema): void
    {
        // this down() migration is auto-generated, please modify it to your needs
        $this->addSql('ALTER TABLE materia DROP tipo, CHANGE horas_semanales horas_semanales INT NOT NULL');
        $this->addSql('ALTER TABLE tema_visual RENAME INDEX idx_2c49299d298137a7 TO IDX_61E3A538298137A7');
    }
}
