<?php

declare(strict_types=1);

namespace DoctrineMigrations;

use Doctrine\DBAL\Schema\Schema;
use Doctrine\Migrations\AbstractMigration;

/**
 * Auto-generated Migration: Please modify to your needs!
 */
final class Version20260205050601 extends AbstractMigration
{
    public function getDescription(): string
    {
        return '';
    }

    public function up(Schema $schema): void
    {
        // this up() migration is auto-generated, please modify it to your needs
        $this->addSql('ALTER TABLE noticia DROP FOREIGN KEY `FK_31205F9614D45BBE`');
        $this->addSql('ALTER TABLE noticia DROP FOREIGN KEY `FK_31205F96298137A7`');
        $this->addSql('DROP TABLE noticia');
    }

    public function down(Schema $schema): void
    {
        // this down() migration is auto-generated, please modify it to your needs
        $this->addSql('CREATE TABLE noticia (id INT AUTO_INCREMENT NOT NULL, titulo VARCHAR(255) CHARACTER SET utf8mb4 NOT NULL COLLATE `utf8mb4_general_ci`, contenido LONGTEXT CHARACTER SET utf8mb4 NOT NULL COLLATE `utf8mb4_general_ci`, fecha_publicacion DATETIME NOT NULL, centro_id INT NOT NULL, autor_id INT NOT NULL, created_at DATETIME DEFAULT CURRENT_TIMESTAMP, updated_at DATETIME DEFAULT NULL, deleted TINYINT DEFAULT 0 NOT NULL, deleted_at DATETIME DEFAULT NULL, INDEX IDX_31205F96298137A7 (centro_id), INDEX IDX_31205F9614D45BBE (autor_id), PRIMARY KEY (id)) DEFAULT CHARACTER SET utf8mb4 COLLATE `utf8mb4_general_ci` ENGINE = InnoDB COMMENT = \'\' ');
        $this->addSql('ALTER TABLE noticia ADD CONSTRAINT `FK_31205F9614D45BBE` FOREIGN KEY (autor_id) REFERENCES usuario (id)');
        $this->addSql('ALTER TABLE noticia ADD CONSTRAINT `FK_31205F96298137A7` FOREIGN KEY (centro_id) REFERENCES centro (id)');
    }
}
