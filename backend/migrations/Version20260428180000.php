<?php

declare(strict_types=1);

namespace DoctrineMigrations;

use Doctrine\DBAL\Schema\Schema;
use Doctrine\Migrations\AbstractMigration;

/**
 * PeriodoLectivo Fase 1 — modelo + backfill.
 *
 * Crea las entidades `PeriodoLectivo` (rangos de fecha por grupo, cada uno con
 * su propia `JornadaTipo` opcional) y `PeriodoLectivoImparticion` (entidad de
 * unión con minutos semanales por rango), añade `Horario.periodoLectivo`
 * (NOT NULL al final de la migración) y backfilla todos los registros
 * existentes con un rango único `"Curso completo"` por grupo.
 *
 * Reglas del backfill (D-H):
 *  - Por cada grupo se crea UN PeriodoLectivo "Curso completo".
 *  - fechaInicio = COALESCE(grupo.fecha_inicio, año1+'-09-01')
 *  - fechaFin    = COALESCE(grupo.fecha_fin,    año2+'-06-30')
 *    (año1, año2 extraídos de grupo.anio_escolar formato 'YYYY-YYYY')
 *  - jornadaTipo = grupo.jornada_tipo_override_id (puede ser NULL → runtime
 *    fallback en `PeriodoLectivo.getEffectiveJornadaTipo()`).
 *  - Por cada `Imparticion` viva se crea UN `PeriodoLectivoImparticion`
 *    en el rango "Curso completo" del grupo, con `minutos_semanales = NULL`
 *    (= hereda `Materia.minutosSemanales`, el comportamiento actual).
 *  - Por cada `Horario`, se vincula al rango "Curso completo" de su grupo.
 *
 * Tras el backfill, `horario.periodo_lectivo_id` pasa a NOT NULL.
 *
 * Doc: docs/hoja-de-ruta-periodos-lectivos.md (Fase 1)
 */
final class Version20260428180000 extends AbstractMigration
{
    public function getDescription(): string
    {
        return 'PeriodoLectivo Fase 1: tablas periodo_lectivo + periodo_lectivo_imparticion + horario.periodo_lectivo_id (con backfill rango único "Curso completo" por grupo)';
    }

    public function up(Schema $schema): void
    {
        // ─── 1) periodo_lectivo ─────────────────────────────────────────────
        $this->addSql('CREATE TABLE periodo_lectivo (
            id INT AUTO_INCREMENT NOT NULL,
            grupo_id INT NOT NULL,
            jornada_tipo_id INT DEFAULT NULL,
            nombre VARCHAR(150) NOT NULL,
            fecha_inicio DATE NOT NULL,
            fecha_fin DATE NOT NULL,
            orden INT DEFAULT 0 NOT NULL,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP NULL,
            updated_at DATETIME DEFAULT NULL,
            deleted TINYINT(1) DEFAULT 0 NOT NULL,
            deleted_at DATETIME DEFAULT NULL,
            INDEX IDX_PL_GRUPO (grupo_id),
            INDEX IDX_PL_JORNADA (jornada_tipo_id),
            INDEX idx_pl_fechas (grupo_id, fecha_inicio, fecha_fin),
            PRIMARY KEY (id)
        ) DEFAULT CHARACTER SET utf8mb4 COLLATE `utf8mb4_unicode_ci` ENGINE = InnoDB');
        $this->addSql('ALTER TABLE periodo_lectivo ADD CONSTRAINT FK_PL_GRUPO FOREIGN KEY (grupo_id) REFERENCES grupo (id) ON DELETE CASCADE');
        $this->addSql('ALTER TABLE periodo_lectivo ADD CONSTRAINT FK_PL_JORNADA FOREIGN KEY (jornada_tipo_id) REFERENCES jornada_tipo (id) ON DELETE SET NULL');

        // ─── 2) periodo_lectivo_imparticion ────────────────────────────────
        $this->addSql('CREATE TABLE periodo_lectivo_imparticion (
            id INT AUTO_INCREMENT NOT NULL,
            periodo_lectivo_id INT NOT NULL,
            imparticion_id INT NOT NULL,
            minutos_semanales INT DEFAULT NULL,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP NULL,
            updated_at DATETIME DEFAULT NULL,
            deleted TINYINT(1) DEFAULT 0 NOT NULL,
            deleted_at DATETIME DEFAULT NULL,
            INDEX IDX_PLI_PL (periodo_lectivo_id),
            INDEX IDX_PLI_IMP (imparticion_id),
            UNIQUE INDEX uniq_pli (periodo_lectivo_id, imparticion_id),
            PRIMARY KEY (id)
        ) DEFAULT CHARACTER SET utf8mb4 COLLATE `utf8mb4_unicode_ci` ENGINE = InnoDB');
        $this->addSql('ALTER TABLE periodo_lectivo_imparticion ADD CONSTRAINT FK_PLI_PL FOREIGN KEY (periodo_lectivo_id) REFERENCES periodo_lectivo (id) ON DELETE CASCADE');
        $this->addSql('ALTER TABLE periodo_lectivo_imparticion ADD CONSTRAINT FK_PLI_IMP FOREIGN KEY (imparticion_id) REFERENCES imparticion (id) ON DELETE CASCADE');

        // ─── 3) horario.periodo_lectivo_id (nullable temporalmente) ─────────
        $this->addSql('ALTER TABLE horario ADD periodo_lectivo_id INT DEFAULT NULL');
        $this->addSql('ALTER TABLE horario ADD CONSTRAINT FK_HORARIO_PL FOREIGN KEY (periodo_lectivo_id) REFERENCES periodo_lectivo (id) ON DELETE CASCADE');
        $this->addSql('CREATE INDEX IDX_HORARIO_PL ON horario (periodo_lectivo_id)');

        // ─── 4) Backfill: un PeriodoLectivo "Curso completo" por grupo ─────
        // Fechas: COALESCE(grupo.fecha_inicio, año1+'-09-01'), COALESCE(grupo.fecha_fin, año2+'-06-30').
        // anio_escolar formato 'YYYY-YYYY'; SUBSTRING_INDEX extrae año1 y año2.
        // Incluimos grupos soft-deleted (deleted=1) por seguridad: si tienen horarios vivos asociados,
        // necesitan su rango para que el ALTER TABLE NOT NULL del paso 7 no falle.
        //
        // jornada_tipo_id = NULL deliberadamente: el campo debe quedar nulo por defecto
        // para que `PeriodoLectivo::getEffectiveJornadaTipo()` caiga al grupo (override
        // o itinerario). Solo se rellena cuando el admin quiere una jornada distinta
        // *para ese rango concreto* (caso FCT/Proyecto Intermodular en Fase 3). Si lo
        // copiásemos del override del grupo aquí, "congelaríamos" la jornada en el
        // momento de la migración: cambios posteriores del override desde el selector
        // de /admin/horarios no propagarían y el CapacityPlanner se desincronizaría.
        $this->addSql("INSERT INTO periodo_lectivo (grupo_id, jornada_tipo_id, nombre, fecha_inicio, fecha_fin, orden, created_at, updated_at, deleted)
            SELECT
                g.id,
                NULL,
                'Curso completo',
                COALESCE(g.fecha_inicio, STR_TO_DATE(CONCAT(SUBSTRING_INDEX(g.anio_escolar, '-', 1), '-09-01'), '%Y-%m-%d')),
                COALESCE(g.fecha_fin,    STR_TO_DATE(CONCAT(SUBSTRING_INDEX(g.anio_escolar, '-', -1), '-06-30'), '%Y-%m-%d')),
                0,
                NOW(),
                NOW(),
                0
            FROM grupo g");

        // ─── 5) Backfill: PeriodoLectivoImparticion para cada Imparticion VIVA
        // minutos_semanales = NULL (= hereda Materia.minutos_semanales, comportamiento actual).
        // Filtro deleted=0: las imparticiones soft-deleted no las usa nadie y
        // un PLI suyo sería ruido permanente en la tabla de unión.
        $this->addSql("INSERT INTO periodo_lectivo_imparticion (periodo_lectivo_id, imparticion_id, minutos_semanales, created_at, updated_at, deleted)
            SELECT
                pl.id,
                i.id,
                NULL,
                NOW(),
                NOW(),
                0
            FROM imparticion i
            JOIN periodo_lectivo pl
              ON pl.grupo_id = i.grupo_id
             AND pl.nombre = 'Curso completo'
             AND pl.deleted = 0
            WHERE i.deleted = 0
              AND NOT EXISTS (
                SELECT 1 FROM periodo_lectivo_imparticion pli
                 WHERE pli.periodo_lectivo_id = pl.id
                   AND pli.imparticion_id = i.id
            )");

        // ─── 6) Backfill: vincula horarios al rango "Curso completo" ────────
        $this->addSql("UPDATE horario h
            JOIN imparticion i ON i.id = h.imparticion_id
            JOIN periodo_lectivo pl
              ON pl.grupo_id = i.grupo_id
             AND pl.nombre = 'Curso completo'
             AND pl.deleted = 0
            SET h.periodo_lectivo_id = pl.id
            WHERE h.periodo_lectivo_id IS NULL");

        // ─── 7) horario.periodo_lectivo_id pasa a NOT NULL ──────────────────
        // Si quedan horarios sin rango (huérfanos), este ALTER fallará — es
        // intencional: indicaría datos rotos antes de la migración.
        $this->addSql('ALTER TABLE horario MODIFY periodo_lectivo_id INT NOT NULL');
    }

    public function down(Schema $schema): void
    {
        // Revertir el ALTER TABLE NOT NULL antes de borrar la columna,
        // para que un down parcial no deje el schema inconsistente.
        $this->addSql('ALTER TABLE horario MODIFY periodo_lectivo_id INT DEFAULT NULL');
        $this->addSql('ALTER TABLE horario DROP FOREIGN KEY FK_HORARIO_PL');
        $this->addSql('DROP INDEX IDX_HORARIO_PL ON horario');
        $this->addSql('ALTER TABLE horario DROP COLUMN periodo_lectivo_id');

        $this->addSql('ALTER TABLE periodo_lectivo_imparticion DROP FOREIGN KEY FK_PLI_PL');
        $this->addSql('ALTER TABLE periodo_lectivo_imparticion DROP FOREIGN KEY FK_PLI_IMP');
        $this->addSql('DROP TABLE periodo_lectivo_imparticion');

        $this->addSql('ALTER TABLE periodo_lectivo DROP FOREIGN KEY FK_PL_GRUPO');
        $this->addSql('ALTER TABLE periodo_lectivo DROP FOREIGN KEY FK_PL_JORNADA');
        $this->addSql('DROP TABLE periodo_lectivo');
    }
}
