<?php

declare(strict_types=1);

namespace DoctrineMigrations;

use Doctrine\DBAL\Schema\Schema;
use Doctrine\Migrations\AbstractMigration;

/**
 * Capa CCAA Fase 1 + refactor minutosSemanales (D24=A · §14 sub-fase J).
 *
 * Cambios:
 *  1. Rename `materia.horas_semanales` → `materia.minutos_semanales` con UPDATE *60.
 *  2. Rename `catalogo_materia.horas_semanales` (DECIMAL) → `catalogo_materia.minutos_semanales` (INT)
 *     con conversión `ROUND(value * 60)`.
 *  3. Columna `centro.ccaa VARCHAR(2) NULL` (D9: default para itinerarios del centro).
 *  4. Columna `itinerario.ccaa VARCHAR(2) NULL` (D5: NULL = currículo nacional puro).
 *  5. Tabla `catalogo_itinerario_ccaa` (overrides de nombre/codigo del itinerario por CCAA, D7).
 *  6. Tabla `catalogo_materia_ccaa` (overrides + materias autonómicas, D6, D10 versionado por fecha).
 *
 * Doc: docs/hoja-de-ruta-curriculum-ccaa.md §3 (modelo) y §6 (plan en fases).
 */
final class Version20260427150000 extends AbstractMigration
{
    public function getDescription(): string
    {
        return 'CCAA Fase 1: enum Ccaa, FKs en centro/itinerario, tablas catalogo_*_ccaa, refactor horasSemanales->minutosSemanales';
    }

    public function up(Schema $schema): void
    {
        // ─── 1) materia.horas_semanales (INT) → materia.minutos_semanales (INT) ───
        $this->addSql('ALTER TABLE materia ADD minutos_semanales INT DEFAULT NULL');
        $this->addSql('UPDATE materia SET minutos_semanales = horas_semanales * 60 WHERE horas_semanales IS NOT NULL');
        $this->addSql('ALTER TABLE materia DROP COLUMN horas_semanales');

        // ─── 2) catalogo_materia.horas_semanales (DECIMAL) → catalogo_materia.minutos_semanales (INT) ───
        $this->addSql('ALTER TABLE catalogo_materia ADD minutos_semanales INT DEFAULT NULL');
        $this->addSql('UPDATE catalogo_materia SET minutos_semanales = ROUND(horas_semanales * 60) WHERE horas_semanales IS NOT NULL');
        $this->addSql('ALTER TABLE catalogo_materia DROP COLUMN horas_semanales');

        // ─── 3) centro.ccaa ─────────────────────────────────────────────────────
        $this->addSql('ALTER TABLE centro ADD ccaa VARCHAR(2) DEFAULT NULL');

        // ─── 4) itinerario.ccaa ─────────────────────────────────────────────────
        $this->addSql('ALTER TABLE itinerario ADD ccaa VARCHAR(2) DEFAULT NULL');

        // ─── 5) catalogo_itinerario_ccaa ────────────────────────────────────────
        $this->addSql('CREATE TABLE catalogo_itinerario_ccaa (
            id INT AUTO_INCREMENT NOT NULL,
            ccaa VARCHAR(2) NOT NULL,
            catalogo_itinerario_id INT NOT NULL,
            nombre VARCHAR(255) DEFAULT NULL,
            codigo VARCHAR(50) DEFAULT NULL,
            boletin_oficial_ref VARCHAR(100) DEFAULT NULL,
            vigente_desde DATE NOT NULL COMMENT \'(DC2Type:date_immutable)\',
            vigente_hasta DATE DEFAULT NULL COMMENT \'(DC2Type:date_immutable)\',
            INDEX idx_cat_itin_ccaa_resolver (ccaa, catalogo_itinerario_id, vigente_desde, vigente_hasta),
            UNIQUE INDEX uniq_cat_itin_ccaa_vigencia (ccaa, catalogo_itinerario_id, vigente_desde),
            INDEX IDX_CIC_CATITIN (catalogo_itinerario_id),
            PRIMARY KEY (id)
        ) DEFAULT CHARACTER SET utf8mb4 COLLATE `utf8mb4_unicode_ci` ENGINE = InnoDB');
        $this->addSql('ALTER TABLE catalogo_itinerario_ccaa ADD CONSTRAINT FK_CIC_CATITIN FOREIGN KEY (catalogo_itinerario_id) REFERENCES catalogo_itinerario (id) ON DELETE CASCADE');

        // ─── 6) catalogo_materia_ccaa ───────────────────────────────────────────
        $this->addSql('CREATE TABLE catalogo_materia_ccaa (
            id INT AUTO_INCREMENT NOT NULL,
            ccaa VARCHAR(2) NOT NULL,
            catalogo_itinerario_id INT NOT NULL,
            catalogo_materia_id INT DEFAULT NULL,
            nombre VARCHAR(255) DEFAULT NULL,
            codigo VARCHAR(50) DEFAULT NULL,
            minutos_semanales INT DEFAULT NULL,
            curso INT DEFAULT NULL,
            tipo VARCHAR(255) DEFAULT NULL,
            boletin_oficial_ref VARCHAR(100) DEFAULT NULL,
            vigente_desde DATE NOT NULL COMMENT \'(DC2Type:date_immutable)\',
            vigente_hasta DATE DEFAULT NULL COMMENT \'(DC2Type:date_immutable)\',
            INDEX idx_cat_mat_ccaa_resolver (ccaa, catalogo_itinerario_id, vigente_desde, vigente_hasta),
            INDEX IDX_CMC_CATITIN (catalogo_itinerario_id),
            INDEX IDX_CMC_CATMAT (catalogo_materia_id),
            PRIMARY KEY (id)
        ) DEFAULT CHARACTER SET utf8mb4 COLLATE `utf8mb4_unicode_ci` ENGINE = InnoDB');
        $this->addSql('ALTER TABLE catalogo_materia_ccaa ADD CONSTRAINT FK_CMC_CATITIN FOREIGN KEY (catalogo_itinerario_id) REFERENCES catalogo_itinerario (id) ON DELETE CASCADE');
        $this->addSql('ALTER TABLE catalogo_materia_ccaa ADD CONSTRAINT FK_CMC_CATMAT FOREIGN KEY (catalogo_materia_id) REFERENCES catalogo_materia (id) ON DELETE CASCADE');
    }

    public function down(Schema $schema): void
    {
        // Tablas overlay y FKs CCAA
        $this->addSql('ALTER TABLE catalogo_materia_ccaa DROP FOREIGN KEY FK_CMC_CATITIN');
        $this->addSql('ALTER TABLE catalogo_materia_ccaa DROP FOREIGN KEY FK_CMC_CATMAT');
        $this->addSql('DROP TABLE catalogo_materia_ccaa');
        $this->addSql('ALTER TABLE catalogo_itinerario_ccaa DROP FOREIGN KEY FK_CIC_CATITIN');
        $this->addSql('DROP TABLE catalogo_itinerario_ccaa');
        $this->addSql('ALTER TABLE itinerario DROP COLUMN ccaa');
        $this->addSql('ALTER TABLE centro DROP COLUMN ccaa');

        // Rollback minutos → horas (con pérdida de precisión decimal en catalogo_materia)
        $this->addSql('ALTER TABLE catalogo_materia ADD horas_semanales NUMERIC(4, 2) DEFAULT NULL');
        $this->addSql('UPDATE catalogo_materia SET horas_semanales = minutos_semanales / 60 WHERE minutos_semanales IS NOT NULL');
        $this->addSql('ALTER TABLE catalogo_materia DROP COLUMN minutos_semanales');

        $this->addSql('ALTER TABLE materia ADD horas_semanales INT DEFAULT NULL');
        $this->addSql('UPDATE materia SET horas_semanales = ROUND(minutos_semanales / 60) WHERE minutos_semanales IS NOT NULL');
        $this->addSql('ALTER TABLE materia DROP COLUMN minutos_semanales');
    }
}
