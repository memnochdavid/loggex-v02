<?php

declare(strict_types=1);

namespace DoctrineMigrations;

use Doctrine\DBAL\Schema\Schema;
use Doctrine\Migrations\AbstractMigration;

/**
 * Corrige datos del enum `tipo` en `catalogo_materia` y `materia`.
 *
 * Bug: el sed del rename §18 (Modulo→Materia) cambió por error el VALOR del
 * caso enum `MODULO` de 'modulo' a 'materia'. Los registros del catálogo
 * ingestados después tienen `tipo='materia'` cuando deberían tener `tipo='modulo'`.
 *
 * Esta migration actualiza los datos. El cambio del enum (en código PHP) ya
 * está aplicado en TipoMateria.php — sin esta migration, Doctrine fallaría
 * al hidratar registros con `tipo='materia'` porque ese valor ya no existe.
 */
final class Version20260425210000 extends AbstractMigration
{
    public function getDescription(): string
    {
        return 'Corrige enum TipoMateria: tipo="materia" → tipo="modulo" en catalogo_materia y materia';
    }

    public function up(Schema $schema): void
    {
        $this->addSql("UPDATE catalogo_materia SET tipo = 'modulo' WHERE tipo = 'materia'");
        $this->addSql("UPDATE materia SET tipo = 'modulo' WHERE tipo = 'materia'");
    }

    public function down(Schema $schema): void
    {
        // Revierte al valor incorrecto (no recomendado, solo para simetría).
        $this->addSql("UPDATE catalogo_materia SET tipo = 'materia' WHERE tipo = 'modulo'");
        $this->addSql("UPDATE materia SET tipo = 'materia' WHERE tipo = 'modulo'");
    }
}
