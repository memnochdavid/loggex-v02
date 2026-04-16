<?php

declare(strict_types=1);

namespace DoctrineMigrations;

use Doctrine\DBAL\Schema\Schema;
use Doctrine\Migrations\AbstractMigration;

final class Version20260416120000 extends AbstractMigration
{
    public function getDescription(): string
    {
        return 'Añadir abreviatura al módulo — forma corta para TimeTable, AccordionView móvil, etc.';
    }

    public function up(Schema $schema): void
    {
        $this->addSql('ALTER TABLE modulo ADD abreviatura VARCHAR(16) DEFAULT NULL');
    }

    public function down(Schema $schema): void
    {
        $this->addSql('ALTER TABLE modulo DROP COLUMN abreviatura');
    }
}
