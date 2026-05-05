<?php

declare(strict_types=1);

namespace DoctrineMigrations;

use Doctrine\DBAL\Schema\Schema;
use Doctrine\Migrations\AbstractMigration;

/**
 * Notificaciones del sistema — Fase 1 backend.
 *
 * Crea `notificacion` per-destinatario (un evento que afecta a N usuarios
 * crea N filas, sin tabla puente). El frontend la consume desde la nueva
 * **campanita** del header (separada del botón de mensajes — decisión D1
 * en `docs/hoja-de-ruta-notificaciones.md`).
 *
 * Sin soft-delete por diseño: la limpieza de notificaciones leídas viejas
 * es vía comando de poda (futuro), no soft-delete.
 *
 * El índice compuesto `(usuario_id, leida, fecha_creacion)` cubre las dos
 * consultas principales: "mis no-leídas más recientes" y conteo de unread.
 */
final class Version20260505120000 extends AbstractMigration
{
    public function getDescription(): string
    {
        return 'Notificaciones del sistema (Notificacion) — campanita per-destinatario.';
    }

    public function up(Schema $schema): void
    {
        $this->addSql(<<<'SQL'
            CREATE TABLE notificacion (
                id INT AUTO_INCREMENT NOT NULL,
                usuario_id INT NOT NULL,
                tipo VARCHAR(64) NOT NULL,
                titulo VARCHAR(255) NOT NULL,
                mensaje LONGTEXT DEFAULT NULL,
                enlace VARCHAR(500) DEFAULT NULL,
                payload JSON DEFAULT NULL,
                leida TINYINT(1) DEFAULT 0 NOT NULL,
                fecha_creacion DATETIME NOT NULL,
                leida_at DATETIME DEFAULT NULL,
                created_at DATETIME NOT NULL,
                updated_at DATETIME NOT NULL,
                PRIMARY KEY(id),
                INDEX IDX_notif_usuario (usuario_id),
                INDEX idx_notif_usuario_leida_fecha (usuario_id, leida, fecha_creacion),
                CONSTRAINT FK_notif_usuario FOREIGN KEY (usuario_id) REFERENCES usuario (id) ON DELETE CASCADE
            ) DEFAULT CHARACTER SET utf8mb4 COLLATE `utf8mb4_unicode_ci` ENGINE = InnoDB
        SQL);
    }

    public function down(Schema $schema): void
    {
        $this->addSql('DROP TABLE notificacion');
    }
}
