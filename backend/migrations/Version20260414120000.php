<?php

declare(strict_types=1);

namespace DoctrineMigrations;

use Doctrine\DBAL\Schema\Schema;
use Doctrine\Migrations\AbstractMigration;

final class Version20260414120000 extends AbstractMigration
{
    public function getDescription(): string
    {
        return 'Añadir peso individual a cada tarea (para ponderación dentro de su tipo)';
    }

    public function up(Schema $schema): void
    {
        $this->addSql('ALTER TABLE tarea ADD peso DOUBLE PRECISION DEFAULT NULL');
    }

    public function down(Schema $schema): void
    {
        $this->addSql('ALTER TABLE tarea DROP COLUMN peso');
    }
}
