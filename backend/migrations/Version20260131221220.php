<?php

declare(strict_types=1);

namespace DoctrineMigrations;

use Doctrine\DBAL\Schema\Schema;
use Doctrine\Migrations\AbstractMigration;

/**
 * Auto-generated Migration: Please modify to your needs!
 */
final class Version20260131221220 extends AbstractMigration
{
    public function getDescription(): string
    {
        return '';
    }

    public function up(Schema $schema): void
    {
        // this up() migration is auto-generated, please modify it to your needs
        $this->addSql('ALTER TABLE asistencia ADD created_at DATETIME DEFAULT CURRENT_TIMESTAMP NOT NULL, ADD updated_at DATETIME DEFAULT NULL, ADD deleted TINYINT DEFAULT 0 NOT NULL, ADD deleted_at DATETIME DEFAULT NULL');
        $this->addSql('ALTER TABLE calificacion ADD created_at DATETIME DEFAULT CURRENT_TIMESTAMP NOT NULL, ADD updated_at DATETIME DEFAULT NULL, ADD deleted TINYINT DEFAULT 0 NOT NULL, ADD deleted_at DATETIME DEFAULT NULL');
        $this->addSql('ALTER TABLE centro ADD created_at DATETIME DEFAULT CURRENT_TIMESTAMP NOT NULL, ADD updated_at DATETIME DEFAULT NULL, ADD deleted TINYINT DEFAULT 0 NOT NULL, ADD deleted_at DATETIME DEFAULT NULL');
        $this->addSql('ALTER TABLE ciclo_formativo ADD created_at DATETIME DEFAULT CURRENT_TIMESTAMP NOT NULL, ADD updated_at DATETIME DEFAULT NULL, ADD deleted TINYINT DEFAULT 0 NOT NULL, ADD deleted_at DATETIME DEFAULT NULL');
        $this->addSql('ALTER TABLE entrega ADD created_at DATETIME DEFAULT CURRENT_TIMESTAMP NOT NULL, ADD updated_at DATETIME DEFAULT NULL, ADD deleted TINYINT DEFAULT 0 NOT NULL, ADD deleted_at DATETIME DEFAULT NULL');
        $this->addSql('ALTER TABLE festivo ADD created_at DATETIME DEFAULT CURRENT_TIMESTAMP NOT NULL, ADD updated_at DATETIME DEFAULT NULL, ADD deleted TINYINT DEFAULT 0 NOT NULL, ADD deleted_at DATETIME DEFAULT NULL');
        $this->addSql('ALTER TABLE grupo ADD created_at DATETIME DEFAULT CURRENT_TIMESTAMP NOT NULL, ADD updated_at DATETIME DEFAULT NULL, ADD deleted TINYINT DEFAULT 0 NOT NULL, ADD deleted_at DATETIME DEFAULT NULL');
        $this->addSql('ALTER TABLE horario ADD created_at DATETIME DEFAULT CURRENT_TIMESTAMP NOT NULL, ADD updated_at DATETIME DEFAULT NULL, ADD deleted TINYINT DEFAULT 0 NOT NULL, ADD deleted_at DATETIME DEFAULT NULL');
        $this->addSql('ALTER TABLE imparticion ADD created_at DATETIME DEFAULT CURRENT_TIMESTAMP NOT NULL, ADD updated_at DATETIME DEFAULT NULL, ADD deleted TINYINT DEFAULT 0 NOT NULL, ADD deleted_at DATETIME DEFAULT NULL');
        $this->addSql('ALTER TABLE material ADD created_at DATETIME DEFAULT CURRENT_TIMESTAMP NOT NULL, ADD updated_at DATETIME DEFAULT NULL, ADD deleted TINYINT DEFAULT 0 NOT NULL, ADD deleted_at DATETIME DEFAULT NULL');
        $this->addSql('ALTER TABLE matricula ADD created_at DATETIME DEFAULT CURRENT_TIMESTAMP NOT NULL, ADD updated_at DATETIME DEFAULT NULL, ADD deleted TINYINT DEFAULT 0 NOT NULL, ADD deleted_at DATETIME DEFAULT NULL');
        $this->addSql('ALTER TABLE modulo ADD created_at DATETIME DEFAULT CURRENT_TIMESTAMP NOT NULL, ADD updated_at DATETIME DEFAULT NULL, ADD deleted TINYINT DEFAULT 0 NOT NULL, ADD deleted_at DATETIME DEFAULT NULL');
        $this->addSql('ALTER TABLE noticia ADD created_at DATETIME DEFAULT CURRENT_TIMESTAMP NOT NULL, ADD updated_at DATETIME DEFAULT NULL, ADD deleted TINYINT DEFAULT 0 NOT NULL, ADD deleted_at DATETIME DEFAULT NULL');
        $this->addSql('ALTER TABLE personalizacion ADD created_at DATETIME DEFAULT CURRENT_TIMESTAMP NOT NULL, ADD updated_at DATETIME DEFAULT NULL, ADD deleted TINYINT DEFAULT 0 NOT NULL, ADD deleted_at DATETIME DEFAULT NULL');
        $this->addSql('ALTER TABLE tarea ADD created_at DATETIME DEFAULT CURRENT_TIMESTAMP NOT NULL, ADD updated_at DATETIME DEFAULT NULL, ADD deleted TINYINT DEFAULT 0 NOT NULL, ADD deleted_at DATETIME DEFAULT NULL');
        $this->addSql('ALTER TABLE usuario ADD created_at DATETIME DEFAULT CURRENT_TIMESTAMP NOT NULL, ADD updated_at DATETIME DEFAULT NULL, ADD deleted TINYINT DEFAULT 0 NOT NULL, ADD deleted_at DATETIME DEFAULT NULL');
    }

    public function down(Schema $schema): void
    {
        // this down() migration is auto-generated, please modify it to your needs
        $this->addSql('ALTER TABLE asistencia DROP created_at, DROP updated_at, DROP deleted, DROP deleted_at');
        $this->addSql('ALTER TABLE calificacion DROP created_at, DROP updated_at, DROP deleted, DROP deleted_at');
        $this->addSql('ALTER TABLE centro DROP created_at, DROP updated_at, DROP deleted, DROP deleted_at');
        $this->addSql('ALTER TABLE ciclo_formativo DROP created_at, DROP updated_at, DROP deleted, DROP deleted_at');
        $this->addSql('ALTER TABLE entrega DROP created_at, DROP updated_at, DROP deleted, DROP deleted_at');
        $this->addSql('ALTER TABLE festivo DROP created_at, DROP updated_at, DROP deleted, DROP deleted_at');
        $this->addSql('ALTER TABLE grupo DROP created_at, DROP updated_at, DROP deleted, DROP deleted_at');
        $this->addSql('ALTER TABLE horario DROP created_at, DROP updated_at, DROP deleted, DROP deleted_at');
        $this->addSql('ALTER TABLE imparticion DROP created_at, DROP updated_at, DROP deleted, DROP deleted_at');
        $this->addSql('ALTER TABLE material DROP created_at, DROP updated_at, DROP deleted, DROP deleted_at');
        $this->addSql('ALTER TABLE matricula DROP created_at, DROP updated_at, DROP deleted, DROP deleted_at');
        $this->addSql('ALTER TABLE modulo DROP created_at, DROP updated_at, DROP deleted, DROP deleted_at');
        $this->addSql('ALTER TABLE noticia DROP created_at, DROP updated_at, DROP deleted, DROP deleted_at');
        $this->addSql('ALTER TABLE personalizacion DROP created_at, DROP updated_at, DROP deleted, DROP deleted_at');
        $this->addSql('ALTER TABLE tarea DROP created_at, DROP updated_at, DROP deleted, DROP deleted_at');
        $this->addSql('ALTER TABLE usuario DROP created_at, DROP updated_at, DROP deleted, DROP deleted_at');
    }
}
