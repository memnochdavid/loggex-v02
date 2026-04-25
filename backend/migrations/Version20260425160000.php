<?php

declare(strict_types=1);

namespace DoctrineMigrations;

use Doctrine\DBAL\Schema\Schema;
use Doctrine\Migrations\AbstractMigration;

/**
 * Catálogo Oficial — Fase 0 (infraestructura común).
 *
 * Crea las tres tablas read-only del catálogo (catalogo_itinerario,
 * catalogo_materia, catalogo_centro) y añade FKs nullable de trazabilidad
 * en las tablas existentes ciclo_formativo, modulo y centro.
 *
 * El contenido del catálogo lo alimentan los jobs de ingesta (TodoFpAdapter
 * etc.) cuando se implementen en fases siguientes. Esta migración solo
 * prepara el suelo.
 */
final class Version20260425160000 extends AbstractMigration
{
    public function getDescription(): string
    {
        return 'Catálogo oficial: tablas catalogo_* y FKs catalogo_origen_id en ciclo_formativo, modulo y centro.';
    }

    public function up(Schema $schema): void
    {
        // ---- catalogo_itinerario ----
        $this->addSql('CREATE TABLE catalogo_itinerario (
            id INT AUTO_INCREMENT NOT NULL,
            etapa VARCHAR(255) NOT NULL,
            codigo_oficial VARCHAR(50) NOT NULL,
            nombre VARCHAR(255) NOT NULL,
            familia VARCHAR(255) DEFAULT NULL,
            nivel VARCHAR(100) DEFAULT NULL,
            duracion_total_horas INT DEFAULT NULL,
            duracion_total_ects INT DEFAULT NULL,
            ccaa VARCHAR(3) DEFAULT NULL,
            normativa VARCHAR(255) DEFAULT NULL,
            boletin_url VARCHAR(500) DEFAULT NULL,
            vigente_desde DATE DEFAULT NULL,
            vigente_hasta DATE DEFAULT NULL,
            fuente_ingesta VARCHAR(50) NOT NULL,
            fuente_hash VARCHAR(64) NOT NULL,
            ingestado_at DATETIME NOT NULL,
            INDEX idx_catalogo_itinerario_etapa_ccaa (etapa, ccaa),
            INDEX idx_catalogo_itinerario_codigo (codigo_oficial),
            UNIQUE INDEX uniq_catalogo_itinerario_codigo_ccaa_vigente (codigo_oficial, ccaa, vigente_desde),
            PRIMARY KEY (id)
        ) DEFAULT CHARACTER SET utf8mb4 COLLATE `utf8mb4_unicode_ci` ENGINE = InnoDB');

        // ---- catalogo_materia ----
        $this->addSql('CREATE TABLE catalogo_materia (
            id INT AUTO_INCREMENT NOT NULL,
            itinerario_id INT NOT NULL,
            codigo_oficial VARCHAR(50) NOT NULL,
            nombre VARCHAR(255) NOT NULL,
            tipo VARCHAR(255) NOT NULL,
            curso INT DEFAULT NULL,
            horas_totales INT DEFAULT NULL,
            horas_semanales NUMERIC(4, 2) DEFAULT NULL,
            ects INT DEFAULT NULL,
            distribucion_anual VARCHAR(50) DEFAULT NULL,
            obligatoria TINYINT(1) DEFAULT 1 NOT NULL,
            prerequisitos JSON DEFAULT NULL,
            descripcion LONGTEXT DEFAULT NULL,
            competencias JSON DEFAULT NULL,
            orden INT DEFAULT 0 NOT NULL,
            INDEX idx_catalogo_materia_orden (itinerario_id, curso, orden),
            INDEX IDX_catalogo_materia_itinerario (itinerario_id),
            PRIMARY KEY (id)
        ) DEFAULT CHARACTER SET utf8mb4 COLLATE `utf8mb4_unicode_ci` ENGINE = InnoDB');

        $this->addSql('ALTER TABLE catalogo_materia
            ADD CONSTRAINT FK_catalogo_materia_itinerario
            FOREIGN KEY (itinerario_id) REFERENCES catalogo_itinerario (id)
            ON DELETE CASCADE');

        // ---- catalogo_centro ----
        $this->addSql('CREATE TABLE catalogo_centro (
            id INT AUTO_INCREMENT NOT NULL,
            codigo_centro VARCHAR(20) NOT NULL,
            nombre VARCHAR(255) NOT NULL,
            ccaa VARCHAR(3) NOT NULL,
            provincia VARCHAR(100) DEFAULT NULL,
            municipio VARCHAR(100) DEFAULT NULL,
            direccion VARCHAR(500) DEFAULT NULL,
            titularidad VARCHAR(255) DEFAULT NULL,
            etapas_ofrecidas JSON DEFAULT NULL,
            fuente_ingesta VARCHAR(50) NOT NULL,
            fuente_hash VARCHAR(64) NOT NULL,
            ingestado_at DATETIME NOT NULL,
            INDEX idx_catalogo_centro_ccaa_prov (ccaa, provincia),
            UNIQUE INDEX uniq_catalogo_centro_codigo (codigo_centro),
            PRIMARY KEY (id)
        ) DEFAULT CHARACTER SET utf8mb4 COLLATE `utf8mb4_unicode_ci` ENGINE = InnoDB');

        // ---- FK catalogo_origen_id en tablas del centro ----
        $this->addSql('ALTER TABLE ciclo_formativo ADD catalogo_origen_id INT DEFAULT NULL');
        $this->addSql('ALTER TABLE ciclo_formativo
            ADD CONSTRAINT FK_ciclo_formativo_catalogo_origen
            FOREIGN KEY (catalogo_origen_id) REFERENCES catalogo_itinerario (id)
            ON DELETE SET NULL');
        $this->addSql('CREATE INDEX IDX_ciclo_formativo_catalogo_origen ON ciclo_formativo (catalogo_origen_id)');

        $this->addSql('ALTER TABLE modulo ADD catalogo_origen_id INT DEFAULT NULL');
        $this->addSql('ALTER TABLE modulo
            ADD CONSTRAINT FK_modulo_catalogo_origen
            FOREIGN KEY (catalogo_origen_id) REFERENCES catalogo_materia (id)
            ON DELETE SET NULL');
        $this->addSql('CREATE INDEX IDX_modulo_catalogo_origen ON modulo (catalogo_origen_id)');

        $this->addSql('ALTER TABLE centro ADD catalogo_origen_id INT DEFAULT NULL');
        $this->addSql('ALTER TABLE centro
            ADD CONSTRAINT FK_centro_catalogo_origen
            FOREIGN KEY (catalogo_origen_id) REFERENCES catalogo_centro (id)
            ON DELETE SET NULL');
        $this->addSql('CREATE INDEX IDX_centro_catalogo_origen ON centro (catalogo_origen_id)');
    }

    public function down(Schema $schema): void
    {
        $this->addSql('SET FOREIGN_KEY_CHECKS = 0');
        $this->addSql('ALTER TABLE ciclo_formativo DROP FOREIGN KEY FK_ciclo_formativo_catalogo_origen');
        $this->addSql('ALTER TABLE ciclo_formativo DROP catalogo_origen_id');
        $this->addSql('ALTER TABLE modulo DROP FOREIGN KEY FK_modulo_catalogo_origen');
        $this->addSql('ALTER TABLE modulo DROP catalogo_origen_id');
        $this->addSql('ALTER TABLE centro DROP FOREIGN KEY FK_centro_catalogo_origen');
        $this->addSql('ALTER TABLE centro DROP catalogo_origen_id');
        $this->addSql('DROP TABLE IF EXISTS catalogo_materia');
        $this->addSql('DROP TABLE IF EXISTS catalogo_itinerario');
        $this->addSql('DROP TABLE IF EXISTS catalogo_centro');
        $this->addSql('SET FOREIGN_KEY_CHECKS = 1');
    }
}
