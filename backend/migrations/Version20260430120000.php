<?php

declare(strict_types=1);

namespace DoctrineMigrations;

use Doctrine\DBAL\Schema\Schema;
use Doctrine\Migrations\AbstractMigration;

/**
 * Calendario escolar — Fase 7 (PeriodoLectivo) / cierre Fase 5 (calendario-escolar).
 *
 * 1. Crea `calendario_escolar_ccaa` (catálogo de fechas oficiales por
 *    CCAA × año académico × etapa). Sin backfill: lo carga el comando
 *    `app:calendario:seed-escolar` desde el JSON curado en MinIO.
 * 2. Añade `centro.fecha_inicio_curso` y `centro.fecha_fin_curso` (DATE NULL)
 *    como override opcional del centro. NULL = la UI sugerirá las fechas del
 *    calendario CCAA aplicable.
 *
 * Cero impacto en datos existentes: ambas columnas son NULLABLE y la tabla
 * nueva nace vacía.
 *
 * Doc: docs/hoja-de-ruta-periodos-lectivos.md (Fase 7).
 */
final class Version20260430120000 extends AbstractMigration
{
    public function getDescription(): string
    {
        return 'Calendario escolar autonómico (CalendarioEscolarCcaa) + Centro.fechaInicio/FinCurso.';
    }

    public function up(Schema $schema): void
    {
        $this->addSql(<<<'SQL'
            CREATE TABLE calendario_escolar_ccaa (
                id INT AUTO_INCREMENT NOT NULL,
                ccaa VARCHAR(2) NOT NULL,
                anio_academico VARCHAR(9) NOT NULL,
                etapa VARCHAR(32) NOT NULL,
                fecha_inicio DATE NOT NULL,
                fecha_fin DATE NOT NULL,
                dias_lectivos INT DEFAULT NULL,
                horas_docencia INT DEFAULT NULL,
                fuente_url VARCHAR(500) DEFAULT NULL,
                fuente_fecha DATE DEFAULT NULL,
                comentario LONGTEXT DEFAULT NULL,
                created_at DATETIME NOT NULL,
                updated_at DATETIME NOT NULL,
                PRIMARY KEY(id),
                UNIQUE INDEX uniq_calescolar_ccaa_anio_etapa (ccaa, anio_academico, etapa),
                INDEX idx_calescolar_ccaa_anio (ccaa, anio_academico)
            ) DEFAULT CHARACTER SET utf8mb4 COLLATE `utf8mb4_unicode_ci` ENGINE = InnoDB
        SQL);

        $this->addSql('ALTER TABLE centro ADD fecha_inicio_curso DATE DEFAULT NULL, ADD fecha_fin_curso DATE DEFAULT NULL');
    }

    public function down(Schema $schema): void
    {
        $this->addSql('ALTER TABLE centro DROP COLUMN fecha_inicio_curso, DROP COLUMN fecha_fin_curso');
        $this->addSql('DROP TABLE calendario_escolar_ccaa');
    }
}
