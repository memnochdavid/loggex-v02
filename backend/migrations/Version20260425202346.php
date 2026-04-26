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
        $this->addSql('ALTER TABLE materia ADD tipo VARCHAR(255) DEFAULT NULL, CHANGE horas_semanales horas_semanales INT DEFAULT NULL');
        // El squash Version20260425170216 ya crea tema_visual con el índice de nombre nuevo
        // (`IDX_2C49299D298137A7`). En BDs heredadas que aún tengan el nombre LOGSE
        // (`idx_61e3a538298137a7`), renombramos; si ya está bien, no-op.
        if ($this->indexExists('tema_visual', 'idx_61e3a538298137a7')) {
            $this->addSql('ALTER TABLE tema_visual RENAME INDEX idx_61e3a538298137a7 TO IDX_2C49299D298137A7');
        }
    }

    public function down(Schema $schema): void
    {
        $this->addSql('ALTER TABLE materia DROP tipo, CHANGE horas_semanales horas_semanales INT NOT NULL');
        if ($this->indexExists('tema_visual', 'idx_2c49299d298137a7')) {
            $this->addSql('ALTER TABLE tema_visual RENAME INDEX idx_2c49299d298137a7 TO IDX_61E3A538298137A7');
        }
    }

    private function indexExists(string $table, string $index): bool
    {
        $count = (int) $this->connection->fetchOne(
            'SELECT COUNT(*) FROM INFORMATION_SCHEMA.STATISTICS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ? AND INDEX_NAME = ?',
            [$table, $index]
        );
        return $count > 0;
    }
}
