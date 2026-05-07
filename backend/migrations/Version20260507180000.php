<?php

declare(strict_types=1);

namespace DoctrineMigrations;

use Doctrine\DBAL\Schema\Schema;
use Doctrine\Migrations\AbstractMigration;

/**
 * Excepciones puntuales sobre Horario (Fase A — modelo base).
 *
 * Capa aditiva: cada fila aplica a una FECHA CONCRETA del Horario base
 * recurrente. El render compone "base + override aplicable a la fecha"
 * en los 5 puntos cubiertos en Fase B.
 *
 * Decisión arquitectónica D-A 2026-05-07: opción B (entidad nueva) sobre
 * (A) lazy split de SEMANA y (C) atomización completa, dado que las
 * SEMANAs actuales son multi-week (modelo-semanal sesión 6).
 *
 * Doc: docs/hoja-de-ruta-intercambio-imparticiones.md §4 + Fase A §5.
 *
 * Índices:
 *   - idx_eh_fecha (fecha_concreta, deleted) — query "excepciones del rango visible".
 *   - idx_eh_horario_fecha (horario_base_id, fecha_concreta) — composición por placement.
 *   - idx_eh_estado (estado, deleted) — vista admin de pendientes.
 */
final class Version20260507180000 extends AbstractMigration
{
    public function getDescription(): string
    {
        return 'ExcepcionHorario (Fase A) — capa puntual sobre Horario base con tipo + estado de aprobación.';
    }

    public function up(Schema $schema): void
    {
        $this->addSql(<<<'SQL'
            CREATE TABLE excepcion_horario (
                id INT AUTO_INCREMENT NOT NULL,
                horario_base_id INT NOT NULL,
                fecha_concreta DATE NOT NULL COMMENT '(DC2Type:date_immutable)',
                tipo VARCHAR(32) NOT NULL,
                imparticion_efectiva_id INT DEFAULT NULL,
                profe_override_id INT DEFAULT NULL,
                intercambio_pareja_id INT DEFAULT NULL,
                motivo LONGTEXT DEFAULT NULL,
                observaciones LONGTEXT DEFAULT NULL,
                estado VARCHAR(32) DEFAULT 'pendiente' NOT NULL,
                solicitada_por_id INT NOT NULL,
                fecha_solicitud DATETIME NOT NULL COMMENT '(DC2Type:datetime_immutable)',
                aprobada_por_id INT DEFAULT NULL,
                fecha_resolucion DATETIME DEFAULT NULL COMMENT '(DC2Type:datetime_immutable)',
                respuesta_admin LONGTEXT DEFAULT NULL,
                revertida TINYINT(1) DEFAULT 0 NOT NULL,
                created_at DATETIME NOT NULL,
                updated_at DATETIME NOT NULL,
                deleted TINYINT(1) DEFAULT 0 NOT NULL,
                deleted_at DATETIME DEFAULT NULL,
                PRIMARY KEY(id),
                INDEX IDX_eh_horario_base (horario_base_id),
                INDEX IDX_eh_imparticion_efectiva (imparticion_efectiva_id),
                INDEX IDX_eh_profe_override (profe_override_id),
                INDEX IDX_eh_intercambio_pareja (intercambio_pareja_id),
                INDEX IDX_eh_solicitada_por (solicitada_por_id),
                INDEX IDX_eh_aprobada_por (aprobada_por_id),
                INDEX idx_eh_fecha (fecha_concreta, deleted),
                INDEX idx_eh_horario_fecha (horario_base_id, fecha_concreta),
                INDEX idx_eh_estado (estado, deleted),
                CONSTRAINT FK_eh_horario_base FOREIGN KEY (horario_base_id) REFERENCES horario (id) ON DELETE CASCADE,
                CONSTRAINT FK_eh_imparticion_efectiva FOREIGN KEY (imparticion_efectiva_id) REFERENCES imparticion (id) ON DELETE SET NULL,
                CONSTRAINT FK_eh_profe_override FOREIGN KEY (profe_override_id) REFERENCES usuario (id) ON DELETE SET NULL,
                CONSTRAINT FK_eh_intercambio_pareja FOREIGN KEY (intercambio_pareja_id) REFERENCES excepcion_horario (id) ON DELETE SET NULL,
                CONSTRAINT FK_eh_solicitada_por FOREIGN KEY (solicitada_por_id) REFERENCES usuario (id) ON DELETE CASCADE,
                CONSTRAINT FK_eh_aprobada_por FOREIGN KEY (aprobada_por_id) REFERENCES usuario (id) ON DELETE SET NULL
            ) DEFAULT CHARACTER SET utf8mb4 COLLATE `utf8mb4_unicode_ci` ENGINE = InnoDB
        SQL);
    }

    public function down(Schema $schema): void
    {
        $this->addSql('DROP TABLE excepcion_horario');
    }
}
