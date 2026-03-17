<?php

declare(strict_types=1);

namespace DoctrineMigrations;

use Doctrine\DBAL\Schema\Schema;
use Doctrine\Migrations\AbstractMigration;

final class Version20260316130000 extends AbstractMigration
{
    public function getDescription(): string
    {
        return 'Añadir elements_opacity a personalizacion para transparencia de elementos con fondo animado';
    }

    public function up(Schema $schema): void
    {
        $this->addSql('ALTER TABLE personalizacion ADD elements_opacity INT DEFAULT 100 NOT NULL');
    }

    public function down(Schema $schema): void
    {
        $this->addSql('ALTER TABLE personalizacion DROP COLUMN elements_opacity');
    }
}
