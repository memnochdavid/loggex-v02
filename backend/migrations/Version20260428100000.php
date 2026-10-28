<?php

declare(strict_types=1);

namespace DoctrineMigrations;

use Doctrine\DBAL\Schema\Schema;
use Doctrine\Migrations\AbstractMigration;

/**
 * Override de jornada por grupo (stepping stone hacia PeriodoLectivo).
 *
 * Añade `grupo.jornada_tipo_override_id` (FK nullable a `jornada_tipo`) para
 * que el admin pueda elegir, desde /admin/horarios, qué plantilla de jornada
 * usa el solver y el editor para un grupo concreto, sin tocar el itinerario.
 *
 * Cuando esté implementado el modelo `PeriodoLectivo` (ver
 * `docs/hoja-de-ruta-periodos-lectivos.md`), este campo migra como
 * `PeriodoLectivo.jornadaTipo` del rango único "Curso completo" autocreado
 * por la migración de la Fase 1.
 */
final class Version20260428100000 extends AbstractMigration
{
    public function getDescription(): string
    {
        return 'grupo.jornada_tipo_override_id (override por grupo de la jornada efectiva, stepping stone PeriodoLectivo)';
    }

    public function up(Schema $schema): void
    {
        $this->addSql('ALTER TABLE grupo ADD jornada_tipo_override_id INT DEFAULT NULL');
        $this->addSql('ALTER TABLE grupo ADD CONSTRAINT FK_GRUPO_JORNADA_OVERRIDE FOREIGN KEY (jornada_tipo_override_id) REFERENCES jornada_tipo (id) ON DELETE SET NULL');
        $this->addSql('CREATE INDEX IDX_GRUPO_JORNADA_OVERRIDE ON grupo (jornada_tipo_override_id)');
    }

    public function down(Schema $schema): void
    {
        $this->addSql('ALTER TABLE grupo DROP FOREIGN KEY FK_GRUPO_JORNADA_OVERRIDE');
        $this->addSql('DROP INDEX IDX_GRUPO_JORNADA_OVERRIDE ON grupo');
        $this->addSql('ALTER TABLE grupo DROP COLUMN jornada_tipo_override_id');
    }
}
