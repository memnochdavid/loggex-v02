<?php

declare(strict_types=1);

namespace DoctrineMigrations;

use Doctrine\DBAL\Schema\Schema;
use Doctrine\Migrations\AbstractMigration;

/**
 * Modalidad de imparticion Fase 1 — modelo + backfill.
 *
 * Añade el enum `Modalidad` (PRESENCIAL/FCT/NO_REGULAR/AUTONOMA) en dos sitios
 * (D-A):
 *   - `materia.modalidad`     NOT NULL DEFAULT 'presencial' — default por catálogo
 *   - `imparticion.modalidad` nullable                       — override grupo-level
 *
 * Backfill (D-B): todas las filas existentes pasan a `PRESENCIAL` (en
 * `materia` por DEFAULT del CREATE COLUMN, en `imparticion` por NULL = hereda
 * Materia). Comportamiento posterior idéntico al previo a 2026-04-29.
 *
 * Solo `PRESENCIAL` consume slots de horario. El cambio del solver,
 * CapacityPlanner, rejilla y PDF para honrar la modalidad llega en Fases 3-6.
 *
 * Doc: docs/hoja-de-ruta-modalidad-imparticion.md (Fase 1)
 */
final class Version20260429120000 extends AbstractMigration
{
    public function getDescription(): string
    {
        return 'Modalidad Fase 1: añade enum Modalidad en materia (NOT NULL default presencial) y imparticion (nullable, override)';
    }

    public function up(Schema $schema): void
    {
        // ─── 1) materia.modalidad ──────────────────────────────────────────
        // NOT NULL con default 'presencial': MariaDB rellena automáticamente
        // todas las filas existentes con el default — no hace falta UPDATE.
        $this->addSql(
            "ALTER TABLE materia "
            . "ADD modalidad VARCHAR(255) DEFAULT 'presencial' NOT NULL"
        );

        // ─── 2) imparticion.modalidad ──────────────────────────────────────
        // Nullable: NULL = hereda Materia.modalidad. No hace falta backfill;
        // las imparticiones existentes mantienen su comportamiento (PRESENCIAL
        // efectivo a través del fallback de getEffectiveModalidad()).
        $this->addSql(
            "ALTER TABLE imparticion "
            . "ADD modalidad VARCHAR(255) DEFAULT NULL"
        );
    }

    public function down(Schema $schema): void
    {
        $this->addSql('ALTER TABLE imparticion DROP COLUMN modalidad');
        $this->addSql('ALTER TABLE materia DROP COLUMN modalidad');
    }
}
