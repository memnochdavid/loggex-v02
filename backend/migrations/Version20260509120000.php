<?php

declare(strict_types=1);

namespace DoctrineMigrations;

use Doctrine\DBAL\Schema\Schema;
use Doctrine\Migrations\AbstractMigration;
use Doctrine\Migrations\Exception\AbortMigration;

/**
 * UNIQUE constraint en `usuario.nif` — espejo de `Assert\NifEspanol` +
 * `Assert\Length(20)` añadidos en `App\Entity\User`.
 *
 * Permite NULL múltiples (los usuarios sin DNI registrado). Pero dos
 * registros con el mismo NIF (no-NULL) ya no son posibles tras esta
 * migración.
 *
 * **Comportamiento defensivo**: antes del ALTER, comprueba si la tabla
 * tiene duplicados activos (deleted=0). Si los hay, **aborta** con la
 * lista exacta para que el usuario los limpie manualmente. No queremos
 * sufijar automáticamente datos sensibles (DNI) — el operador debe
 * decidir cuál es el correcto y borrar/editar los demás.
 *
 * Procedimiento ante un abort:
 *   1. Lee la lista de duplicados que devuelve el error.
 *   2. Para cada NIF duplicado, decide cuál es el registro válido.
 *   3. Edita los demás (cambia el NIF o ponlo a NULL) o sóft-delete el
 *      duplicado erróneo.
 *   4. Vuelve a aplicar la migración.
 *
 * Doc: discusión "DNI unique + validaciones + sesión" 2026-05-09.
 */
final class Version20260509120000 extends AbstractMigration
{
    public function getDescription(): string
    {
        return 'UNIQUE constraint en usuario.nif (con guard contra duplicados existentes).';
    }

    public function up(Schema $schema): void
    {
        // 1. Detectar duplicados activos. Solo cuentan los registros vivos
        //    (deleted=0): los soft-deleted pueden tener NIF "fantasma" sin
        //    impacto operativo y no queremos forzar limpieza histórica.
        $rows = $this->connection->executeQuery(
            "SELECT nif, COUNT(*) AS n, GROUP_CONCAT(id ORDER BY id SEPARATOR ',') AS ids
             FROM usuario
             WHERE nif IS NOT NULL AND nif != '' AND deleted = 0
             GROUP BY nif
             HAVING n > 1
             ORDER BY n DESC, nif ASC"
        )->fetchAllAssociative();

        if (count($rows) > 0) {
            $lines = [
                'Migration abortada: hay NIFs duplicados activos en la tabla `usuario`.',
                'Limpia los siguientes registros antes de re-aplicar (deja un único `id` por `nif`):',
                '',
            ];
            foreach ($rows as $r) {
                $lines[] = sprintf(
                    '  NIF "%s" → %d registros (ids: %s)',
                    $r['nif'],
                    (int) $r['n'],
                    $r['ids'],
                );
            }
            $lines[] = '';
            $lines[] = 'Opciones por duplicado:';
            $lines[] = '  - Editar el NIF de los registros incorrectos (UI Usuarios o SQL).';
            $lines[] = '  - Soft-deletear los registros obsoletos (UPDATE usuario SET deleted=1 WHERE id=X).';
            $lines[] = '  - Si un duplicado es bug (mismo usuario duplicado), mergear y borrar el sobrante.';
            throw new AbortMigration(implode("\n", $lines));
        }

        // 2. ALTER seguro: índice UNIQUE acepta múltiples NULLs en MySQL/MariaDB
        //    (cumple SQL standard), así que los usuarios sin NIF coexisten.
        $this->addSql('CREATE UNIQUE INDEX UNIQ_USUARIO_NIF ON usuario (nif)');
    }

    public function down(Schema $schema): void
    {
        $this->addSql('DROP INDEX UNIQ_USUARIO_NIF ON usuario');
    }
}
