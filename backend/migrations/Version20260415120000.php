<?php

declare(strict_types=1);

namespace DoctrineMigrations;

use Doctrine\DBAL\Schema\Schema;
use Doctrine\Migrations\AbstractMigration;

final class Version20260415120000 extends AbstractMigration
{
    public function getDescription(): string
    {
        return 'Añadir firma (SVG) al usuario — para boletines firmados por el admin/coordinador';
    }

    public function up(Schema $schema): void
    {
        $this->addSql('ALTER TABLE usuario ADD firma VARCHAR(255) DEFAULT NULL');
    }

    public function down(Schema $schema): void
    {
        $this->addSql('ALTER TABLE usuario DROP COLUMN firma');
    }
}
