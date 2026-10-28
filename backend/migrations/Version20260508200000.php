<?php

declare(strict_types=1);

namespace DoctrineMigrations;

use Doctrine\DBAL\Schema\Schema;
use Doctrine\Migrations\AbstractMigration;

/**
 * Materia ↔ Itinerario ManyToMany.
 *
 * Refactor estructural: una `Materia` pasa de pertenecer a un único itinerario
 * (vía FK `materia.itinerario_id` NOT NULL) a poder pertenecer a varios
 * (vía tabla puente `materia_itinerario`).
 *
 * Caso real motivador (EAG, 1º DAW + 1º DAM): los 8 códigos LOMLOE comunes en
 * primer curso (0373 LM, 0483 SI, 0484 BD, 0485 PR, 0487 ED + autonómicas
 * 1665 DIG, 1708 SOST, 1709 IPEI) hoy están duplicados — 8 filas en DAW + 8
 * en DAM con el mismo `codigo_oficial`. Tras este refactor el admin puede
 * tener UNA sola fila Materia compartida entre ambos itinerarios y el solver
 * (con el cambio en `buildParallelBusy`) deja de generar falsos conflictos
 * del profesor al colocarlo en grupos hermanos en la misma franja.
 *
 * Migración:
 *  1. Crea tabla puente `materia_itinerario` (PK compuesta + 2 índices).
 *  2. Backfill: INSERT desde `materia.itinerario_id` actual.
 *  3. DROP FK `FK_6DF05284B824E717`, índice `IDX_6DF05284B824E717`, columna.
 *
 * Doc: docs/hoja-de-ruta-materias-multi-itinerario.md.
 */
final class Version20260508200000 extends AbstractMigration
{
    public function getDescription(): string
    {
        return 'Materia ↔ Itinerario ManyToMany — tabla puente + backfill + DROP materia.itinerario_id.';
    }

    public function up(Schema $schema): void
    {
        // 1) Tabla puente.
        $this->addSql(
            'CREATE TABLE materia_itinerario (
                materia_id INT NOT NULL,
                itinerario_id INT NOT NULL,
                INDEX IDX_MI_MATERIA (materia_id),
                INDEX IDX_MI_ITINERARIO (itinerario_id),
                PRIMARY KEY (materia_id, itinerario_id)
            ) DEFAULT CHARACTER SET utf8mb4 COLLATE `utf8mb4_unicode_ci` ENGINE = InnoDB'
        );
        $this->addSql(
            'ALTER TABLE materia_itinerario
                ADD CONSTRAINT FK_MI_MATERIA FOREIGN KEY (materia_id)
                    REFERENCES materia (id) ON DELETE CASCADE'
        );
        $this->addSql(
            'ALTER TABLE materia_itinerario
                ADD CONSTRAINT FK_MI_ITINERARIO FOREIGN KEY (itinerario_id)
                    REFERENCES itinerario (id) ON DELETE CASCADE'
        );

        // 2) Backfill: copia las asignaciones existentes a la tabla puente.
        //    Las soft-deleted (materia.deleted = 1) también se copian: el modelo
        //    sigue conservando la pertenencia para restauración posterior.
        $this->addSql(
            'INSERT INTO materia_itinerario (materia_id, itinerario_id)
             SELECT id, itinerario_id FROM materia WHERE itinerario_id IS NOT NULL'
        );

        // 3) DROP FK + índice + columna.
        $this->addSql('ALTER TABLE materia DROP FOREIGN KEY FK_6DF05284B824E717');
        $this->addSql('DROP INDEX IDX_6DF05284B824E717 ON materia');
        $this->addSql('ALTER TABLE materia DROP COLUMN itinerario_id');
    }

    public function down(Schema $schema): void
    {
        // Restaura columna como nullable temporal para backfill inverso.
        $this->addSql('ALTER TABLE materia ADD itinerario_id INT DEFAULT NULL');

        // Backfill inverso: a cada materia le asignamos UN itinerario (el primero
        // por id si está en varios). En M:N una materia podía estar en N
        // itinerarios; el down es destructivo en ese sentido (lossy) — sólo
        // útil para revertir antes de que el sistema empiece a explotar M:N.
        $this->addSql(
            'UPDATE materia m SET itinerario_id = (
                SELECT MIN(itinerario_id) FROM materia_itinerario mi WHERE mi.materia_id = m.id
            )'
        );

        // Re-crea FK + índice y vuelve a NOT NULL.
        $this->addSql('CREATE INDEX IDX_6DF05284B824E717 ON materia (itinerario_id)');
        $this->addSql(
            'ALTER TABLE materia
                ADD CONSTRAINT FK_6DF05284B824E717 FOREIGN KEY (itinerario_id)
                    REFERENCES itinerario (id)'
        );
        $this->addSql('ALTER TABLE materia MODIFY itinerario_id INT NOT NULL');

        // DROP tabla puente.
        $this->addSql('ALTER TABLE materia_itinerario DROP FOREIGN KEY FK_MI_MATERIA');
        $this->addSql('ALTER TABLE materia_itinerario DROP FOREIGN KEY FK_MI_ITINERARIO');
        $this->addSql('DROP TABLE materia_itinerario');
    }
}
