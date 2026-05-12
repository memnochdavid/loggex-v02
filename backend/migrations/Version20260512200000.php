<?php

declare(strict_types=1);

namespace DoctrineMigrations;

use Doctrine\DBAL\Schema\Schema;
use Doctrine\Migrations\AbstractMigration;

/**
 * Añade `periodo_lectivo.etiqueta` (VARCHAR(32) NULL) como discriminador
 * semántico opcional del PL. Inicial use case (Fase A FP 2º, 2026-05-12):
 * marcar la SEMANA "Tercera evaluación" con `etiqueta='no_presenciales'`
 * para que el solver y el distribuidor de currículo la skipeen al iterar
 * los PLs reales del grupo.
 *
 * Sin este campo no podríamos distinguir el rango tras recargar el editor:
 * el planner devuelve `etiqueta` en cada llamada pero `runSolverAllRangos`
 * itera PLs reales sin consultar el planner.
 *
 * Tipo VARCHAR(32) — caben todos los discriminadores razonables que
 * imaginamos (no_presenciales, examen, recuperacion, fct, proyecto, …)
 * sin sobredimensionar.
 */
final class Version20260512200000 extends AbstractMigration
{
    public function getDescription(): string
    {
        return 'Añadir periodo_lectivo.etiqueta como discriminador semántico opcional.';
    }

    public function up(Schema $schema): void
    {
        $this->addSql('ALTER TABLE periodo_lectivo ADD etiqueta VARCHAR(32) DEFAULT NULL');
    }

    public function down(Schema $schema): void
    {
        $this->addSql('ALTER TABLE periodo_lectivo DROP etiqueta');
    }
}
