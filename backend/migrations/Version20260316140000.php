<?php

declare(strict_types=1);

namespace DoctrineMigrations;

use Doctrine\DBAL\Schema\Schema;
use Doctrine\Migrations\AbstractMigration;

final class Version20260316140000 extends AbstractMigration
{
    public function getDescription(): string
    {
        return 'Añadir elements_blur a personalizacion para efecto glassmorphism';
    }

    public function up(Schema $schema): void
    {
        $this->addSql('ALTER TABLE personalizacion ADD elements_blur INT DEFAULT 0 NOT NULL');
    }

    public function down(Schema $schema): void
    {
        $this->addSql('ALTER TABLE personalizacion DROP COLUMN elements_blur');
    }
}
