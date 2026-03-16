<?php

declare(strict_types=1);

namespace DoctrineMigrations;

use Doctrine\DBAL\Schema\Schema;
use Doctrine\Migrations\AbstractMigration;

final class Version20260316120000 extends AbstractMigration
{
    public function getDescription(): string
    {
        return 'Reemplazar showAnimatedBackground (bool) por animatedBackground (string) para soportar múltiples fondos';
    }

    public function up(Schema $schema): void
    {
        $this->addSql('ALTER TABLE personalizacion ADD animated_background VARCHAR(50) DEFAULT NULL');
        $this->addSql('UPDATE personalizacion SET animated_background = \'grid\' WHERE show_animated_background = 1');
        $this->addSql('ALTER TABLE personalizacion DROP COLUMN show_animated_background');
    }

    public function down(Schema $schema): void
    {
        $this->addSql('ALTER TABLE personalizacion ADD show_animated_background TINYINT(1) DEFAULT 0 NOT NULL');
        $this->addSql('UPDATE personalizacion SET show_animated_background = 1 WHERE animated_background IS NOT NULL');
        $this->addSql('ALTER TABLE personalizacion DROP COLUMN animated_background');
    }
}
