<?php

declare(strict_types=1);

namespace DoctrineMigrations;

use Doctrine\DBAL\Schema\Schema;
use Doctrine\Migrations\AbstractMigration;

/**
 * Refactor PeriodoLectivo a modelo semanal puro (Fase A2).
 *
 * El modelo pasa de "rango contiguo de fechas" a "una entidad con tipo
 * discriminator: PLANTILLA o SEMANA". Cada grupo tiene 1 PLANTILLA (sin
 * fechas) que contiene los Horarios/PLIs por defecto + 0..N SEMANA
 * lazy-on-demand cuando hay overrides puntuales (intercambio profe,
 * sustitución, semana atípica, festivo no anticipado).
 *
 * Cambios schema:
 *  - +tipo VARCHAR(16) NOT NULL — discriminator PLANTILLA|SEMANA.
 *  - +semana_numero INT NULL — solo si tipo=SEMANA, ordinal 1..N.
 *  - +plantilla_base_id INT NULL — solo si tipo=SEMANA, FK self-ref a la PLANTILLA del grupo.
 *  - fecha_inicio, fecha_fin pasan a NULL — la PLANTILLA no tiene fechas.
 *  - Índices `(grupo, tipo)` y `(plantilla_base)`.
 *
 * BD wipe: el usuario autoriza borrar Horarios/PLIs/PLs existentes
 * (BD dev sin centros reales en producción a 2026-05-06). Esto evita
 * la complejidad del backfill ("primer PL por grupo → PLANTILLA",
 * mega-rangos SEMANA temporales) y los riesgos de backward
 * compatibility con NULLs leídos por código viejo.
 *
 * Cuando el producto se acerque a producción real con datos en BD,
 * habrá que escribir una migration distinta que **preserve los datos**
 * (1 PLANTILLA por grupo + materialización de los demás como SEMANA con
 * sus fechas). Plan anotado, no implementado en esta migration.
 *
 * Doc: docs/hoja-de-ruta-modelo-semanal.md §11.
 *
 * down(): destructivo (perderíamos PLANTILLA + sus PLIs/Horarios). En dev
 * es aceptable — wipe + drop columnas/índices.
 */
final class Version20260506180000 extends AbstractMigration
{
    public function getDescription(): string
    {
        return 'PeriodoLectivo modelo semanal: +tipo (PLANTILLA|SEMANA), +semana_numero, +plantilla_base_id; fechas NULL.';
    }

    public function up(Schema $schema): void
    {
        // 1. Wipe del subgrafo PL (Horario.periodoLectivo y PLI.periodoLectivo
        //    ya tienen ON DELETE CASCADE, pero hacemos los DELETE explícitos
        //    en orden para que el log de la migration deje constancia).
        $this->addSql('DELETE FROM horario');
        $this->addSql('DELETE FROM periodo_lectivo_imparticion');
        $this->addSql('DELETE FROM periodo_lectivo');

        // 2. Schema: añadir columnas nuevas.
        //    `tipo` NOT NULL sin default — la tabla está vacía tras el wipe,
        //    así que no hay violaciones. El State Processor de creación
        //    (Fase A3) garantiza el valor en cada nuevo PL.
        $this->addSql(<<<'SQL'
            ALTER TABLE periodo_lectivo
                ADD COLUMN tipo VARCHAR(16) NOT NULL AFTER orden,
                ADD COLUMN semana_numero INT DEFAULT NULL AFTER tipo,
                ADD COLUMN plantilla_base_id INT DEFAULT NULL AFTER semana_numero,
                ADD CONSTRAINT FK_pl_plantilla_base
                    FOREIGN KEY (plantilla_base_id) REFERENCES periodo_lectivo (id)
                    ON DELETE CASCADE
        SQL);

        // 3. Relajar fechas a NULL (la PLANTILLA no tiene fechas; las SEMANA sí).
        //    La validación (PLANTILLA → fechas NULL, SEMANA → NOT NULL) la
        //    aplica el entity con #[Assert\Callback] en Fase A3.
        $this->addSql('ALTER TABLE periodo_lectivo MODIFY fecha_inicio DATE DEFAULT NULL');
        $this->addSql('ALTER TABLE periodo_lectivo MODIFY fecha_fin DATE DEFAULT NULL');

        // 4. Índices nuevos.
        //    `idx_pl_grupo_tipo` cubre el caso "dame la PLANTILLA del grupo X"
        //    y "dame las SEMANA del grupo X". Es la query más frecuente del
        //    HorarioRenderService.
        //    `idx_pl_plantilla_base` cubre "dame todas las SEMANA que dependen
        //    de esta PLANTILLA" — usado al borrar/editar la plantilla.
        $this->addSql('CREATE INDEX idx_pl_grupo_tipo ON periodo_lectivo (grupo_id, tipo)');
        $this->addSql('CREATE INDEX idx_pl_plantilla_base ON periodo_lectivo (plantilla_base_id)');
    }

    public function down(Schema $schema): void
    {
        // Destructivo en dev — perdemos cualquier PL/PLI/Horario nuevo.
        // Aceptable porque la migration nace en branch develop-semanas-lectivas.
        $this->addSql('DELETE FROM horario');
        $this->addSql('DELETE FROM periodo_lectivo_imparticion');
        $this->addSql('DELETE FROM periodo_lectivo');

        $this->addSql('DROP INDEX idx_pl_plantilla_base ON periodo_lectivo');
        $this->addSql('DROP INDEX idx_pl_grupo_tipo ON periodo_lectivo');

        $this->addSql('ALTER TABLE periodo_lectivo DROP FOREIGN KEY FK_pl_plantilla_base');
        $this->addSql(<<<'SQL'
            ALTER TABLE periodo_lectivo
                DROP COLUMN plantilla_base_id,
                DROP COLUMN semana_numero,
                DROP COLUMN tipo
        SQL);

        $this->addSql('ALTER TABLE periodo_lectivo MODIFY fecha_inicio DATE NOT NULL');
        $this->addSql('ALTER TABLE periodo_lectivo MODIFY fecha_fin DATE NOT NULL');
    }
}
