<?php

declare(strict_types=1);

namespace DoctrineMigrations;

use Doctrine\DBAL\Schema\Schema;
use Doctrine\Migrations\AbstractMigration;

final class Version20260205100000 extends AbstractMigration
{
    public function getDescription(): string
    {
        return 'Create Comunicado entity';
    }

    public function up(Schema $schema): void
    {
        $this->addSql('CREATE TABLE comunicado (id INT AUTO_INCREMENT NOT NULL, autor_id INT NOT NULL, centro_id INT DEFAULT NULL, titulo VARCHAR(255) NOT NULL, contenido LONGTEXT NOT NULL, global TINYINT(1) NOT NULL, created_at DATETIME NOT NULL, updated_at DATETIME NOT NULL, deleted_at DATETIME DEFAULT NULL, INDEX IDX_F9C9B92314D45BBE (autor_id), INDEX IDX_F9C9B92395591491 (centro_id), PRIMARY KEY(id)) DEFAULT CHARACTER SET utf8mb4 COLLATE `utf8mb4_unicode_ci` ENGINE = InnoDB');
        $this->addSql('ALTER TABLE comunicado ADD CONSTRAINT FK_F9C9B92314D45BBE FOREIGN KEY (autor_id) REFERENCES usuario (id)');
        $this->addSql('ALTER TABLE comunicado ADD CONSTRAINT FK_F9C9B92395591491 FOREIGN KEY (centro_id) REFERENCES centro (id)');
    }

    public function down(Schema $schema): void
    {
        $this->addSql('ALTER TABLE comunicado DROP FOREIGN KEY FK_F9C9B92314D45BBE');
        $this->addSql('ALTER TABLE comunicado DROP FOREIGN KEY FK_F9C9B92395591491');
        $this->addSql('DROP TABLE comunicado');
    }
}
