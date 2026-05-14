<?php

declare(strict_types=1);

namespace DoctrineMigrations;

use Doctrine\DBAL\Schema\Schema;
use Doctrine\Migrations\AbstractMigration;

/**
 * Añade `centro.porcentaje_max_faltas` (INT, default 20). Umbral de faltas de
 * asistencia a partir del cual un alumno pierde la evaluación continua en una
 * materia y se marca "no evaluable" en Calificaciones (ver
 * `CalificacionMediaController::calcularMediaAlumno`).
 *
 * Default 20 → los centros existentes adoptan el umbral del 20% sin
 * intervención. Cada centro puede ajustarlo a su orden autonómica.
 */
final class Version20260514120000 extends AbstractMigration
{
    public function getDescription(): string
    {
        return 'Añadir centro.porcentaje_max_faltas (umbral de pérdida de evaluación continua).';
    }

    public function up(Schema $schema): void
    {
        $this->addSql('ALTER TABLE centro ADD porcentaje_max_faltas INT DEFAULT 20 NOT NULL');
    }

    public function down(Schema $schema): void
    {
        $this->addSql('ALTER TABLE centro DROP porcentaje_max_faltas');
    }
}
