<?php

declare(strict_types=1);

namespace DoctrineMigrations;

use Doctrine\DBAL\Schema\Schema;
use Doctrine\Migrations\AbstractMigration;

/**
 * Modelo unificado de recuperaciones: una recuperación/subida de nota se representa
 * como una Tarea hija que referencia a la original vía tarea_original_id. Elimina la
 * tabla independiente `recuperacion` (que era un registro de nota manual, flujo
 * descartado por no permitir entregas reales de los alumnos).
 */
final class Version20260423150000 extends AbstractMigration
{
    public function getDescription(): string
    {
        return 'Añade tarea.tarea_original_id (recuperaciones como Tarea hija). Elimina tabla recuperacion.';
    }

    public function up(Schema $schema): void
    {
        $this->addSql('ALTER TABLE tarea ADD tarea_original_id INT DEFAULT NULL');
        $this->addSql('ALTER TABLE tarea ADD CONSTRAINT FK_tarea_tarea_original FOREIGN KEY (tarea_original_id) REFERENCES tarea (id) ON DELETE SET NULL');
        $this->addSql('CREATE INDEX IDX_tarea_tarea_original ON tarea (tarea_original_id)');

        $this->addSql('DROP TABLE IF EXISTS recuperacion');
    }

    public function down(Schema $schema): void
    {
        $this->addSql('ALTER TABLE tarea DROP FOREIGN KEY FK_tarea_tarea_original');
        $this->addSql('DROP INDEX IDX_tarea_tarea_original ON tarea');
        $this->addSql('ALTER TABLE tarea DROP tarea_original_id');

        // No reconstruimos recuperacion (tabla descartada).
    }
}
