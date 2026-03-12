<?php

declare(strict_types=1);

namespace DoctrineMigrations;

use Doctrine\DBAL\Schema\Schema;
use Doctrine\Migrations\AbstractMigration;

final class Version20260312180000 extends AbstractMigration
{
    public function getDescription(): string
    {
        return 'Add input colors, header/footer opacity and sidebar opacity to personalizacion';
    }

    public function up(Schema $schema): void
    {
        $this->addSql('ALTER TABLE personalizacion ADD header_footer_opacity INT NOT NULL DEFAULT 100');
        $this->addSql('ALTER TABLE personalizacion ADD sidebar_opacity INT NOT NULL DEFAULT 100');
        $this->addSql('ALTER TABLE personalizacion ADD input_bg_color VARCHAR(7) DEFAULT \'#ffffff\'');
        $this->addSql('ALTER TABLE personalizacion ADD input_text_color VARCHAR(7) DEFAULT \'#334155\'');
        $this->addSql('ALTER TABLE personalizacion ADD input_border_color VARCHAR(7) DEFAULT \'#e2e8f0\'');
        $this->addSql('ALTER TABLE personalizacion ADD input_focus_border_color VARCHAR(7) DEFAULT \'#6366f1\'');
        $this->addSql('ALTER TABLE personalizacion ADD input_focus_shadow_color VARCHAR(7) DEFAULT \'#e0e7ff\'');
    }

    public function down(Schema $schema): void
    {
        $this->addSql('ALTER TABLE personalizacion DROP header_footer_opacity');
        $this->addSql('ALTER TABLE personalizacion DROP sidebar_opacity');
        $this->addSql('ALTER TABLE personalizacion DROP input_bg_color');
        $this->addSql('ALTER TABLE personalizacion DROP input_text_color');
        $this->addSql('ALTER TABLE personalizacion DROP input_border_color');
        $this->addSql('ALTER TABLE personalizacion DROP input_focus_border_color');
        $this->addSql('ALTER TABLE personalizacion DROP input_focus_shadow_color');
    }
}
