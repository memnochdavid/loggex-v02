<?php

declare(strict_types=1);

namespace DoctrineMigrations;

use Doctrine\DBAL\Schema\Schema;
use Doctrine\Migrations\AbstractMigration;

/**
 * Añade `personalizacion.modal_border_width` para configurar el grosor del
 * borde del modal desde `/configuracion → Modal`.
 *
 * El color del borde ya reusa `--modal-header-bg` (que tiene su propio
 * input). Esta columna parametriza solo el grosor; los valores válidos
 * desde la UI son 0/1/2/3/4/5/6 px (select discreto). Default 3px para
 * preservar el look existente del componente `ModalView`.
 */
final class Version20260511220000 extends AbstractMigration
{
    public function getDescription(): string
    {
        return 'Añadir modal_border_width a personalizacion (grosor del borde del modal).';
    }

    public function up(Schema $schema): void
    {
        $this->addSql("ALTER TABLE personalizacion ADD modal_border_width VARCHAR(10) NOT NULL DEFAULT '3px'");
    }

    public function down(Schema $schema): void
    {
        $this->addSql('ALTER TABLE personalizacion DROP modal_border_width');
    }
}
