<?php

declare(strict_types=1);

namespace DoctrineMigrations;

use Doctrine\DBAL\Schema\Schema;
use Doctrine\Migrations\AbstractMigration;

/**
 * Catálogo Oficial — añade `curriculo_url` al CatalogoItinerario.
 *
 * Necesario para que `BoeRdAdapter` (Fase 1.7) sepa de qué documento del BOE
 * extraer la tabla de módulos con horas. La URL del currículo (Orden EDU) es
 * distinta de la del RD del título: TodoFP las publica en columnas distintas
 * y nuestro adapter las captura, pero hasta ahora la del currículo se descartaba.
 */
final class Version20260425170000 extends AbstractMigration
{
    public function getDescription(): string
    {
        return 'Catálogo: añade curriculo_url a catalogo_itinerario para alimentar BoeRdAdapter.';
    }

    public function up(Schema $schema): void
    {
        $this->addSql('ALTER TABLE catalogo_itinerario ADD curriculo_url VARCHAR(500) DEFAULT NULL');
    }

    public function down(Schema $schema): void
    {
        $this->addSql('ALTER TABLE catalogo_itinerario DROP curriculo_url');
    }
}
