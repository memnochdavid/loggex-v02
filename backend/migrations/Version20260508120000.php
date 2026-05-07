<?php

declare(strict_types=1);

namespace DoctrineMigrations;

use Doctrine\DBAL\Schema\Schema;
use Doctrine\Migrations\AbstractMigration;

/**
 * Plan B (intercambio bilateral) — refactor pareja → grupo.
 *
 * El modelo anterior (intercambio_pareja_id self-FK 1-a-1) restringía un
 * intercambio a dos caras de duración igual. Plan B generaliza a un
 * GRUPO de N caras vinculadas por un UUID compartido (`intercambio_grupo_id`).
 * Permite casos asimétricos en número de bloques manteniendo simetría
 * en minutos totales: 1 bloque de 120min ↔ 2 bloques de 60min.
 *
 * Migración:
 *  1. Añade columna nullable `intercambio_grupo_id VARCHAR(36)`.
 *  2. Crea índice `idx_eh_grupo` para queries cascade.
 *  3. Backfill: a las parejas existentes (intercambio_pareja_id no nulo)
 *     les asigna un UUID compartido. Procesa pares una sola vez via
 *     un set de IDs ya asignados.
 *  4. `intercambio_pareja_id` se MANTIENE como deprecated. El código
 *     nuevo usa solo `intercambio_grupo_id`. Se podría dropear en una
 *     migración futura cuando ningún render lo lea.
 *
 * Doc: docs/hoja-de-ruta-intercambio-imparticiones.md Plan B.
 */
final class Version20260508120000 extends AbstractMigration
{
    public function getDescription(): string
    {
        return 'ExcepcionHorario.intercambio_grupo_id (Plan B) — refactor pareja → grupo + backfill UUIDs.';
    }

    public function up(Schema $schema): void
    {
        // 1) Schema change.
        $this->addSql('ALTER TABLE excepcion_horario ADD intercambio_grupo_id VARCHAR(36) DEFAULT NULL');
        $this->addSql('CREATE INDEX idx_eh_grupo ON excepcion_horario (intercambio_grupo_id)');

        // 2) Backfill: a cada pareja existente le asignamos un UUID compartido.
        //    Procesamos en PHP porque MariaDB UUID() generaría uno por fila.
        $rows = $this->connection->fetchAllAssociative(
            "SELECT id, intercambio_pareja_id FROM excepcion_horario
             WHERE tipo = 'intercambio'
               AND intercambio_pareja_id IS NOT NULL
               AND deleted = 0"
        );
        $assigned = [];  // id → uuid
        foreach ($rows as $row) {
            $id = (int) $row['id'];
            $parejaId = (int) $row['intercambio_pareja_id'];
            if (isset($assigned[$id]) || isset($assigned[$parejaId])) continue;
            $uuid = $this->generateUuidV4();
            $assigned[$id] = $uuid;
            $assigned[$parejaId] = $uuid;
        }
        foreach ($assigned as $id => $uuid) {
            $this->connection->executeStatement(
                'UPDATE excepcion_horario SET intercambio_grupo_id = ? WHERE id = ?',
                [$uuid, $id]
            );
        }
    }

    public function down(Schema $schema): void
    {
        $this->addSql('DROP INDEX idx_eh_grupo ON excepcion_horario');
        $this->addSql('ALTER TABLE excepcion_horario DROP intercambio_grupo_id');
    }

    /**
     * UUID v4 RFC 4122 con PHP nativo (sin depender de symfony/uid, que no
     * está instalado en este proyecto).
     */
    private function generateUuidV4(): string
    {
        $data = random_bytes(16);
        $data[6] = chr((ord($data[6]) & 0x0f) | 0x40);
        $data[8] = chr((ord($data[8]) & 0x3f) | 0x80);
        return vsprintf('%s%s-%s-%s-%s-%s%s%s', str_split(bin2hex($data), 4));
    }
}
