<?php

declare(strict_types=1);

namespace DoctrineMigrations;

use Doctrine\DBAL\Schema\Schema;
use Doctrine\Migrations\AbstractMigration;

/**
 * Materia.horasTotales — Opción A del fix Fase 5 PeriodoLectivo (2026-04-29).
 *
 * Añade `materia.horas_totales` (INT NULL) como objetivo curricular ANUAL en
 * horas. Es la "ley LOMLOE" — el RD del título fija las horas totales por
 * módulo, mientras que las h/sem son flexibles (centro las adapta al
 * calendario real).
 *
 * Backfill: ROUND(minutos_semanales × 36 / 60). Mantiene el comportamiento
 * previo (cuando el sistema usaba `min/sem × 36` como objetivo implícito).
 * El admin podrá editar después en /admin/materias (Fase 5 modalidad)
 * si las horas reales del catálogo difieren.
 *
 * Doc: docs/hoja-de-ruta-periodos-lectivos.md (Fase 5 fix Opción A)
 */
final class Version20260429180000 extends AbstractMigration
{
    public function getDescription(): string
    {
        return 'Materia.horasTotales: objetivo curricular anual en horas (Opción A). Backfill = min/sem × 36 / 60.';
    }

    public function up(Schema $schema): void
    {
        // Añade la columna nullable.
        $this->addSql('ALTER TABLE materia ADD horas_totales INT DEFAULT NULL');
        // Backfill: respeta el compromiso curricular implícito previo.
        // ROUND(min/sem × 36 / 60) = horas totales que daban con calendario LOMLOE.
        $this->addSql(
            "UPDATE materia "
            . "SET horas_totales = ROUND(minutos_semanales * 36 / 60) "
            . "WHERE minutos_semanales IS NOT NULL AND horas_totales IS NULL"
        );
    }

    public function down(Schema $schema): void
    {
        $this->addSql('ALTER TABLE materia DROP COLUMN horas_totales');
    }
}
