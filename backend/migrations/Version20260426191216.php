<?php

declare(strict_types=1);

namespace DoctrineMigrations;

use Doctrine\DBAL\Schema\Schema;
use Doctrine\Migrations\AbstractMigration;

/**
 * Auto-generated Migration: Please modify to your needs!
 */
final class Version20260426191216 extends AbstractMigration
{
    public function getDescription(): string
    {
        return '';
    }

    public function up(Schema $schema): void
    {
        // this up() migration is auto-generated, please modify it to your needs
        $this->addSql('CREATE TABLE jornada_tipo (id INT AUTO_INCREMENT NOT NULL, nombre VARCHAR(100) NOT NULL, turno VARCHAR(16) NOT NULL, dias_lectivos JSON NOT NULL, created_at DATETIME DEFAULT CURRENT_TIMESTAMP, updated_at DATETIME DEFAULT NULL, deleted TINYINT DEFAULT 0 NOT NULL, deleted_at DATETIME DEFAULT NULL, centro_id INT NOT NULL, INDEX IDX_57BBA106298137A7 (centro_id), PRIMARY KEY (id)) DEFAULT CHARACTER SET utf8mb4');
        $this->addSql('CREATE TABLE jornada_tramo (id INT AUTO_INCREMENT NOT NULL, orden SMALLINT NOT NULL, tipo VARCHAR(16) NOT NULL, hora_inicio TIME NOT NULL, hora_fin TIME NOT NULL, etiqueta VARCHAR(60) DEFAULT NULL, jornada_tipo_id INT NOT NULL, INDEX IDX_4EF1F68B89635E79 (jornada_tipo_id), UNIQUE INDEX uniq_jornada_tramo_orden (jornada_tipo_id, orden), PRIMARY KEY (id)) DEFAULT CHARACTER SET utf8mb4');
        $this->addSql('ALTER TABLE jornada_tipo ADD CONSTRAINT FK_57BBA106298137A7 FOREIGN KEY (centro_id) REFERENCES centro (id)');
        $this->addSql('ALTER TABLE jornada_tramo ADD CONSTRAINT FK_4EF1F68B89635E79 FOREIGN KEY (jornada_tipo_id) REFERENCES jornada_tipo (id) ON DELETE CASCADE');
        $this->addSql('ALTER TABLE itinerario ADD jornada_tipo_id INT DEFAULT NULL');
        $this->addSql('ALTER TABLE itinerario ADD CONSTRAINT FK_11ECF40489635E79 FOREIGN KEY (jornada_tipo_id) REFERENCES jornada_tipo (id) ON DELETE SET NULL');
        $this->addSql('CREATE INDEX IDX_11ECF40489635E79 ON itinerario (jornada_tipo_id)');
    }

    public function down(Schema $schema): void
    {
        // this down() migration is auto-generated, please modify it to your needs
        $this->addSql('ALTER TABLE jornada_tipo DROP FOREIGN KEY FK_57BBA106298137A7');
        $this->addSql('ALTER TABLE jornada_tramo DROP FOREIGN KEY FK_4EF1F68B89635E79');
        $this->addSql('DROP TABLE jornada_tipo');
        $this->addSql('DROP TABLE jornada_tramo');
        $this->addSql('ALTER TABLE itinerario DROP FOREIGN KEY FK_11ECF40489635E79');
        $this->addSql('DROP INDEX IDX_11ECF40489635E79 ON itinerario');
        $this->addSql('ALTER TABLE itinerario DROP jornada_tipo_id');
    }
}
