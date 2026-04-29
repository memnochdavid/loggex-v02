<?php

declare(strict_types=1);

namespace DoctrineMigrations;

use Doctrine\DBAL\Schema\Schema;
use Doctrine\Migrations\AbstractMigration;

/**
 * Modalidad de imparticion Fase 2 — catálogo nacional + overlay CCAA.
 *
 * Añade `modalidad` en dos tablas del catálogo:
 *   - `catalogo_materia.modalidad`     NOT NULL DEFAULT 'presencial' (nacional)
 *   - `catalogo_materia_ccaa.modalidad` nullable                       (overlay)
 *
 * Backfill heurístico para `catalogo_materia` (mismo criterio que
 * `Modalidad::inferFromName()` para que los datos pre-Fase 2 queden
 * coherentes con los nuevos enrichments del BOE):
 *   - "Formación en Centros de Trabajo" o nombre = "FCT" → FCT
 *   - Empieza por "Proyecto " o nombre = "Proyecto"     → NO_REGULAR
 *   - El resto se queda en `presencial` (DEFAULT).
 *
 * Doc: docs/hoja-de-ruta-modalidad-imparticion.md (Fase 2)
 */
final class Version20260429140000 extends AbstractMigration
{
    public function getDescription(): string
    {
        return 'Modalidad Fase 2: añade catalogo_materia.modalidad y catalogo_materia_ccaa.modalidad + backfill heurístico por nombre';
    }

    public function up(Schema $schema): void
    {
        // ─── 1) catalogo_materia.modalidad ───────────────────────────────
        $this->addSql(
            "ALTER TABLE catalogo_materia "
            . "ADD modalidad VARCHAR(255) DEFAULT 'presencial' NOT NULL"
        );

        // Backfill heurístico (case-insensitive): FCT primero, luego Proyecto.
        // Patrón debe coincidir con Modalidad::inferFromName().
        $this->addSql(
            "UPDATE catalogo_materia SET modalidad = 'fct' "
            . "WHERE LOWER(nombre) LIKE '%formación en centros de trabajo%' "
            . "   OR LOWER(nombre) LIKE '%formacion en centros de trabajo%' "
            . "   OR LOWER(nombre) = 'fct' "
            . "   OR LOWER(nombre) LIKE 'fct %'"
        );

        $this->addSql(
            "UPDATE catalogo_materia SET modalidad = 'no_regular' "
            . "WHERE modalidad = 'presencial' "
            . "  AND (LOWER(nombre) = 'proyecto' OR LOWER(nombre) LIKE 'proyecto %')"
        );

        // ─── 2) catalogo_materia_ccaa.modalidad ──────────────────────────
        // Nullable: NULL = hereda la del catálogo nacional (override) o
        // PRESENCIAL (autonómica pura). No hace falta backfill.
        $this->addSql(
            "ALTER TABLE catalogo_materia_ccaa "
            . "ADD modalidad VARCHAR(255) DEFAULT NULL"
        );
    }

    public function down(Schema $schema): void
    {
        $this->addSql('ALTER TABLE catalogo_materia_ccaa DROP COLUMN modalidad');
        $this->addSql('ALTER TABLE catalogo_materia DROP COLUMN modalidad');
    }
}
