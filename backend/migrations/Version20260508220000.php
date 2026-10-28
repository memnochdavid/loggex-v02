<?php

declare(strict_types=1);

namespace DoctrineMigrations;

use Doctrine\DBAL\Schema\Schema;
use Doctrine\Migrations\AbstractMigration;

/**
 * Fase B clases-compartidas: `Horario.gemelo_id` self-FK nullable.
 *
 * Marca permanente que dice "este placement es la misma clase física que
 * otro" — usado por la sincronización de Fase D (mover/borrar/cancelar uno
 * propaga al gemelo) y por el solver de Fase C (no contar al profe como
 * busy si el slot ya tiene un gemelo del candidato).
 *
 * Convención de canonicalización (D-3 + decisión 2026-05-08):
 *   - El "raíz" es siempre el horario ORIGINAL (el más antiguo de la
 *     hermandad). Sus copias apuntan a él vía `gemelo_id`.
 *   - Cuando se clona un placement que ya era copia (gemelo_id != NULL),
 *     la copia nueva NO encadena: apunta directamente al raíz. Eso
 *     mantiene `WHERE id = X OR gemelo_id = X` como query barata para
 *     "todos los hermanos de X" sin recursión.
 *
 * `ON DELETE SET NULL`: si se borra el raíz, las copias dejan de ser
 * gemelas pero sobreviven como placements independientes. La Fase D
 * gestiona el caso "borrar uno borra todos" a nivel aplicación, no FK.
 *
 * Doc: docs/hoja-de-ruta-clases-compartidas.md (Fase B + D-1 cerrada).
 */
final class Version20260508220000 extends AbstractMigration
{
    public function getDescription(): string
    {
        return 'Fase B clases-compartidas — Horario.gemelo_id self-FK + índice.';
    }

    public function up(Schema $schema): void
    {
        $this->addSql('ALTER TABLE horario ADD gemelo_id INT DEFAULT NULL');
        $this->addSql('CREATE INDEX IDX_HORARIO_GEMELO ON horario (gemelo_id)');
        $this->addSql(
            'ALTER TABLE horario
                ADD CONSTRAINT FK_HORARIO_GEMELO FOREIGN KEY (gemelo_id)
                    REFERENCES horario (id) ON DELETE SET NULL'
        );
    }

    public function down(Schema $schema): void
    {
        $this->addSql('ALTER TABLE horario DROP FOREIGN KEY FK_HORARIO_GEMELO');
        $this->addSql('DROP INDEX IDX_HORARIO_GEMELO ON horario');
        $this->addSql('ALTER TABLE horario DROP COLUMN gemelo_id');
    }
}
