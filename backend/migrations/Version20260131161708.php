<?php

declare(strict_types=1);

namespace DoctrineMigrations;

use Doctrine\DBAL\Schema\Schema;
use Doctrine\Migrations\AbstractMigration;

/**
 * Auto-generated Migration: Please modify to your needs!
 */
final class Version20260131161708 extends AbstractMigration
{
    public function getDescription(): string
    {
        return '';
    }

    public function up(Schema $schema): void
    {
        // this up() migration is auto-generated, please modify it to your needs
        $this->addSql('CREATE TABLE personalizacion (id INT AUTO_INCREMENT NOT NULL, primary_color VARCHAR(7) NOT NULL, sidebar_color VARCHAR(7) NOT NULL, centro_id INT NOT NULL, UNIQUE INDEX UNIQ_A6EC3EF3298137A7 (centro_id), PRIMARY KEY (id)) DEFAULT CHARACTER SET utf8mb4');
        $this->addSql('CREATE TABLE messenger_messages (id BIGINT AUTO_INCREMENT NOT NULL, body LONGTEXT NOT NULL, headers LONGTEXT NOT NULL, queue_name VARCHAR(190) NOT NULL, created_at DATETIME NOT NULL, available_at DATETIME NOT NULL, delivered_at DATETIME DEFAULT NULL, INDEX IDX_75EA56E0FB7336F0E3BD61CE16BA31DBBF396750 (queue_name, available_at, delivered_at, id), PRIMARY KEY (id)) DEFAULT CHARACTER SET utf8mb4');
        $this->addSql('ALTER TABLE personalizacion ADD CONSTRAINT FK_A6EC3EF3298137A7 FOREIGN KEY (centro_id) REFERENCES centro (id)');
        $this->addSql('ALTER TABLE usuario RENAME INDEX uniq_identifier_email TO UNIQ_2265B05DE7927C74');
    }

    public function down(Schema $schema): void
    {
        // this down() migration is auto-generated, please modify it to your needs
        $this->addSql('ALTER TABLE personalizacion DROP FOREIGN KEY FK_A6EC3EF3298137A7');
        $this->addSql('DROP TABLE personalizacion');
        $this->addSql('DROP TABLE messenger_messages');
        $this->addSql('ALTER TABLE usuario RENAME INDEX uniq_2265b05de7927c74 TO UNIQ_IDENTIFIER_EMAIL');
    }
}
