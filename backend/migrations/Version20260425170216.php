<?php

declare(strict_types=1);

namespace DoctrineMigrations;

use Doctrine\DBAL\Schema\Schema;
use Doctrine\Migrations\AbstractMigration;

/**
 * Auto-generated Migration: Please modify to your needs!
 */
final class Version20260425170216 extends AbstractMigration
{
    public function getDescription(): string
    {
        return '';
    }

    public function up(Schema $schema): void
    {
        // this up() migration is auto-generated, please modify it to your needs
        $this->addSql('CREATE TABLE asistencia (id INT AUTO_INCREMENT NOT NULL, fecha DATE NOT NULL, hora TIME NOT NULL, estado VARCHAR(20) NOT NULL, comentario LONGTEXT DEFAULT NULL, created_at DATETIME DEFAULT CURRENT_TIMESTAMP, updated_at DATETIME DEFAULT NULL, deleted TINYINT DEFAULT 0 NOT NULL, deleted_at DATETIME DEFAULT NULL, imparticion_id INT NOT NULL, alumno_id INT NOT NULL, INDEX IDX_D8264A8D5396730A (imparticion_id), INDEX IDX_D8264A8DFC28E5EE (alumno_id), PRIMARY KEY (id)) DEFAULT CHARACTER SET utf8mb4');
        $this->addSql('CREATE TABLE calificacion (id INT AUTO_INCREMENT NOT NULL, nota DOUBLE PRECISION NOT NULL, feedback_profesor LONGTEXT DEFAULT NULL, created_at DATETIME DEFAULT CURRENT_TIMESTAMP, updated_at DATETIME DEFAULT NULL, deleted TINYINT DEFAULT 0 NOT NULL, deleted_at DATETIME DEFAULT NULL, entrega_id INT NOT NULL, UNIQUE INDEX UNIQ_8A3AF2187AB91AEC (entrega_id), PRIMARY KEY (id)) DEFAULT CHARACTER SET utf8mb4');
        $this->addSql('CREATE TABLE catalogo_centro (id INT AUTO_INCREMENT NOT NULL, codigo_centro VARCHAR(20) NOT NULL, nombre VARCHAR(255) NOT NULL, ccaa VARCHAR(3) NOT NULL, provincia VARCHAR(100) DEFAULT NULL, municipio VARCHAR(100) DEFAULT NULL, direccion VARCHAR(500) DEFAULT NULL, titularidad VARCHAR(255) DEFAULT NULL, etapas_ofrecidas JSON DEFAULT NULL, fuente_ingesta VARCHAR(50) NOT NULL, fuente_hash VARCHAR(64) NOT NULL, ingestado_at DATETIME NOT NULL, INDEX idx_catalogo_centro_ccaa_prov (ccaa, provincia), UNIQUE INDEX uniq_catalogo_centro_codigo (codigo_centro), PRIMARY KEY (id)) DEFAULT CHARACTER SET utf8mb4');
        $this->addSql('CREATE TABLE catalogo_itinerario (id INT AUTO_INCREMENT NOT NULL, etapa VARCHAR(255) NOT NULL, codigo_oficial VARCHAR(50) NOT NULL, nombre VARCHAR(255) NOT NULL, familia VARCHAR(255) DEFAULT NULL, nivel VARCHAR(100) DEFAULT NULL, duracion_total_horas INT DEFAULT NULL, duracion_total_ects INT DEFAULT NULL, ccaa VARCHAR(3) DEFAULT NULL, normativa LONGTEXT DEFAULT NULL, boletin_url VARCHAR(500) DEFAULT NULL, curriculo_url VARCHAR(500) DEFAULT NULL, vigente_desde DATE DEFAULT NULL, vigente_hasta DATE DEFAULT NULL, fuente_ingesta VARCHAR(50) NOT NULL, fuente_hash VARCHAR(64) NOT NULL, ingestado_at DATETIME NOT NULL, INDEX idx_catalogo_itinerario_etapa_ccaa (etapa, ccaa), INDEX idx_catalogo_itinerario_codigo (codigo_oficial), UNIQUE INDEX uniq_catalogo_itinerario_codigo_ccaa_vigente (codigo_oficial, ccaa, vigente_desde), PRIMARY KEY (id)) DEFAULT CHARACTER SET utf8mb4');
        $this->addSql('CREATE TABLE catalogo_materia (id INT AUTO_INCREMENT NOT NULL, codigo_oficial VARCHAR(50) NOT NULL, nombre VARCHAR(255) NOT NULL, tipo VARCHAR(255) NOT NULL, curso INT DEFAULT NULL, horas_totales INT DEFAULT NULL, horas_semanales NUMERIC(4, 2) DEFAULT NULL, ects INT DEFAULT NULL, distribucion_anual VARCHAR(50) DEFAULT NULL, obligatoria TINYINT DEFAULT 1 NOT NULL, prerequisitos JSON DEFAULT NULL, descripcion LONGTEXT DEFAULT NULL, competencias JSON DEFAULT NULL, orden INT DEFAULT 0 NOT NULL, itinerario_id INT NOT NULL, INDEX IDX_55EAD35B824E717 (itinerario_id), INDEX idx_catalogo_materia_orden (itinerario_id, curso, orden), PRIMARY KEY (id)) DEFAULT CHARACTER SET utf8mb4');
        $this->addSql('CREATE TABLE centro (id INT AUTO_INCREMENT NOT NULL, nombre VARCHAR(255) NOT NULL, cif VARCHAR(20) NOT NULL, activo TINYINT NOT NULL, web_config VARCHAR(255) DEFAULT NULL, logo VARCHAR(255) DEFAULT NULL, direccion VARCHAR(255) NOT NULL, telefono VARCHAR(25) DEFAULT NULL, created_at DATETIME DEFAULT CURRENT_TIMESTAMP, updated_at DATETIME DEFAULT NULL, deleted TINYINT DEFAULT 0 NOT NULL, deleted_at DATETIME DEFAULT NULL, catalogo_origen_id INT DEFAULT NULL, INDEX IDX_2675036B438E8617 (catalogo_origen_id), PRIMARY KEY (id)) DEFAULT CHARACTER SET utf8mb4');
        $this->addSql('CREATE TABLE comunicado (id INT AUTO_INCREMENT NOT NULL, titulo VARCHAR(255) NOT NULL, contenido LONGTEXT NOT NULL, global TINYINT NOT NULL, created_at DATETIME DEFAULT CURRENT_TIMESTAMP, updated_at DATETIME DEFAULT NULL, deleted TINYINT DEFAULT 0 NOT NULL, deleted_at DATETIME DEFAULT NULL, autor_id INT NOT NULL, centro_id INT DEFAULT NULL, INDEX IDX_B5F8831014D45BBE (autor_id), INDEX IDX_B5F88310298137A7 (centro_id), PRIMARY KEY (id)) DEFAULT CHARACTER SET utf8mb4');
        $this->addSql('CREATE TABLE entrega (id INT AUTO_INCREMENT NOT NULL, fecha_entrega DATETIME NOT NULL, enlace LONGTEXT DEFAULT NULL, archivo VARCHAR(255) DEFAULT NULL, comentario_alumno LONGTEXT DEFAULT NULL, created_at DATETIME DEFAULT CURRENT_TIMESTAMP, updated_at DATETIME DEFAULT NULL, deleted TINYINT DEFAULT 0 NOT NULL, deleted_at DATETIME DEFAULT NULL, tarea_id INT NOT NULL, alumno_id INT NOT NULL, INDEX IDX_E56D596B6D5BDFE1 (tarea_id), INDEX IDX_E56D596BFC28E5EE (alumno_id), PRIMARY KEY (id)) DEFAULT CHARACTER SET utf8mb4');
        $this->addSql('CREATE TABLE festivo (id INT AUTO_INCREMENT NOT NULL, nombre VARCHAR(255) NOT NULL, fecha_inicio DATE NOT NULL, fecha_fin DATE DEFAULT NULL, created_at DATETIME DEFAULT CURRENT_TIMESTAMP, updated_at DATETIME DEFAULT NULL, deleted TINYINT DEFAULT 0 NOT NULL, deleted_at DATETIME DEFAULT NULL, centro_id INT DEFAULT NULL, INDEX IDX_9472C78A298137A7 (centro_id), PRIMARY KEY (id)) DEFAULT CHARACTER SET utf8mb4');
        $this->addSql('CREATE TABLE grupo (id INT AUTO_INCREMENT NOT NULL, nombre VARCHAR(50) NOT NULL, abreviatura VARCHAR(20) DEFAULT NULL, curso INT NOT NULL, anio_escolar VARCHAR(20) NOT NULL, fecha_inicio DATE DEFAULT NULL, fecha_fin DATE DEFAULT NULL, created_at DATETIME DEFAULT CURRENT_TIMESTAMP, updated_at DATETIME DEFAULT NULL, deleted TINYINT DEFAULT 0 NOT NULL, deleted_at DATETIME DEFAULT NULL, itinerario_id INT NOT NULL, centro_id INT NOT NULL, INDEX IDX_8C0E9BD3B824E717 (itinerario_id), INDEX IDX_8C0E9BD3298137A7 (centro_id), PRIMARY KEY (id)) DEFAULT CHARACTER SET utf8mb4');
        $this->addSql('CREATE TABLE horario (id INT AUTO_INCREMENT NOT NULL, dia_semana INT NOT NULL, hora_inicio TIME NOT NULL, hora_fin TIME NOT NULL, aula VARCHAR(255) NOT NULL, created_at DATETIME DEFAULT CURRENT_TIMESTAMP, updated_at DATETIME DEFAULT NULL, deleted TINYINT DEFAULT 0 NOT NULL, deleted_at DATETIME DEFAULT NULL, imparticion_id INT NOT NULL, INDEX IDX_E25853A35396730A (imparticion_id), PRIMARY KEY (id)) DEFAULT CHARACTER SET utf8mb4');
        $this->addSql('CREATE TABLE imparticion (id INT AUTO_INCREMENT NOT NULL, created_at DATETIME DEFAULT CURRENT_TIMESTAMP, updated_at DATETIME DEFAULT NULL, deleted TINYINT DEFAULT 0 NOT NULL, deleted_at DATETIME DEFAULT NULL, profesor_id INT NOT NULL, materia_id INT NOT NULL, grupo_id INT NOT NULL, INDEX IDX_D179FDFDE52BD977 (profesor_id), INDEX IDX_D179FDFDB54DBBCB (materia_id), INDEX IDX_D179FDFD9C833003 (grupo_id), PRIMARY KEY (id)) DEFAULT CHARACTER SET utf8mb4');
        $this->addSql('CREATE TABLE itinerario (id INT AUTO_INCREMENT NOT NULL, nombre VARCHAR(255) NOT NULL, nivel VARCHAR(50) NOT NULL, created_at DATETIME DEFAULT CURRENT_TIMESTAMP, updated_at DATETIME DEFAULT NULL, deleted TINYINT DEFAULT 0 NOT NULL, deleted_at DATETIME DEFAULT NULL, centro_id INT NOT NULL, catalogo_origen_id INT DEFAULT NULL, INDEX IDX_11ECF404298137A7 (centro_id), INDEX IDX_11ECF404438E8617 (catalogo_origen_id), PRIMARY KEY (id)) DEFAULT CHARACTER SET utf8mb4');
        $this->addSql('CREATE TABLE materia (id INT AUTO_INCREMENT NOT NULL, nombre VARCHAR(255) NOT NULL, codigo_oficial VARCHAR(50) DEFAULT NULL, abreviatura VARCHAR(16) DEFAULT NULL, curso INT NOT NULL, horas_semanales INT NOT NULL, created_at DATETIME DEFAULT CURRENT_TIMESTAMP, updated_at DATETIME DEFAULT NULL, deleted TINYINT DEFAULT 0 NOT NULL, deleted_at DATETIME DEFAULT NULL, itinerario_id INT NOT NULL, catalogo_origen_id INT DEFAULT NULL, INDEX IDX_6DF05284B824E717 (itinerario_id), INDEX IDX_6DF05284438E8617 (catalogo_origen_id), PRIMARY KEY (id)) DEFAULT CHARACTER SET utf8mb4');
        $this->addSql('CREATE TABLE matricula (id INT AUTO_INCREMENT NOT NULL, created_at DATETIME DEFAULT CURRENT_TIMESTAMP, updated_at DATETIME DEFAULT NULL, deleted TINYINT DEFAULT 0 NOT NULL, deleted_at DATETIME DEFAULT NULL, alumno_id INT NOT NULL, grupo_id INT NOT NULL, INDEX IDX_15DF1885FC28E5EE (alumno_id), INDEX IDX_15DF18859C833003 (grupo_id), PRIMARY KEY (id)) DEFAULT CHARACTER SET utf8mb4');
        $this->addSql('CREATE TABLE mensaje (id INT AUTO_INCREMENT NOT NULL, contenido LONGTEXT NOT NULL, fecha_envio DATETIME NOT NULL, leido TINYINT NOT NULL, remitente_id INT NOT NULL, destinatario_id INT NOT NULL, INDEX IDX_9B631D011C3E945F (remitente_id), INDEX IDX_9B631D01B564FBC1 (destinatario_id), PRIMARY KEY (id)) DEFAULT CHARACTER SET utf8mb4');
        $this->addSql('CREATE TABLE periodo_evaluativo (id INT AUTO_INCREMENT NOT NULL, nombre VARCHAR(100) NOT NULL, tipo VARCHAR(30) NOT NULL, fecha_inicio DATE NOT NULL, fecha_fin DATE NOT NULL, peso DOUBLE PRECISION DEFAULT NULL, created_at DATETIME DEFAULT CURRENT_TIMESTAMP, updated_at DATETIME DEFAULT NULL, deleted TINYINT DEFAULT 0 NOT NULL, deleted_at DATETIME DEFAULT NULL, grupo_id INT NOT NULL, INDEX IDX_FC9F21709C833003 (grupo_id), PRIMARY KEY (id)) DEFAULT CHARACTER SET utf8mb4');
        $this->addSql('CREATE TABLE personalizacion (id INT AUTO_INCREMENT NOT NULL, primary_color VARCHAR(7) NOT NULL, secondary_color VARCHAR(7) NOT NULL, view_background_color VARCHAR(7) NOT NULL, border_radius VARCHAR(20) NOT NULL, show_lottie TINYINT NOT NULL, enable_draggable_modal TINYINT NOT NULL, animated_background VARCHAR(50) DEFAULT NULL, elements_opacity INT NOT NULL, elements_blur INT NOT NULL, sidebar_color VARCHAR(7) NOT NULL, sidebar_active_color VARCHAR(7) NOT NULL, sidebar_active_text_color VARCHAR(7) NOT NULL, sidebar_hover_color VARCHAR(7) NOT NULL, sidebar_hover_text_color VARCHAR(7) NOT NULL, sidebar_opacity INT NOT NULL, sidebar_accordion_header_bg_color VARCHAR(7) NOT NULL, sidebar_accordion_header_text_color VARCHAR(7) NOT NULL, sidebar_accordion_content_bg_color VARCHAR(7) NOT NULL, sidebar_accordion_content_text_color VARCHAR(7) NOT NULL, text_main_color VARCHAR(7) NOT NULL, text_secondary_color VARCHAR(7) NOT NULL, special_text_color VARCHAR(7) NOT NULL, button_primary_color VARCHAR(7) NOT NULL, button_primary_text_color VARCHAR(7) NOT NULL, button_secondary_color VARCHAR(7) NOT NULL, button_secondary_text_color VARCHAR(7) NOT NULL, header_footer_color VARCHAR(7) NOT NULL, header_footer_text_color VARCHAR(7) NOT NULL, header_footer_opacity INT NOT NULL, scrollbar_thumb_color VARCHAR(7) NOT NULL, scrollbar_track_color VARCHAR(7) NOT NULL, scrollbar_hover_color VARCHAR(7) NOT NULL, scrollbar_width VARCHAR(10) NOT NULL, calendar_selected_bg_color VARCHAR(7) NOT NULL, calendar_selected_text_color VARCHAR(7) NOT NULL, calendar_weekend_bg_color VARCHAR(7) NOT NULL, calendar_weekend_text_color VARCHAR(7) NOT NULL, timetable_header_bg_color VARCHAR(7) NOT NULL, timetable_header_text_color VARCHAR(7) NOT NULL, timetable_hours_bg_color VARCHAR(7) NOT NULL, timetable_hours_text_color VARCHAR(7) NOT NULL, timetable_selected_header_bg VARCHAR(7) NOT NULL, timetable_selected_header_text VARCHAR(7) NOT NULL, timetable_selected_cell_bg VARCHAR(7) NOT NULL, datatable_header_bg_color VARCHAR(7) NOT NULL, datatable_header_text_color VARCHAR(7) NOT NULL, datatable_header_hover_bg_color VARCHAR(7) NOT NULL, datatable_header_hover_text_color VARCHAR(7) NOT NULL, datatable_header_active_bg_color VARCHAR(7) NOT NULL, datatable_header_active_text_color VARCHAR(7) NOT NULL, datatable_pagination_bg_color VARCHAR(7) NOT NULL, datatable_pagination_text_color VARCHAR(7) NOT NULL, datatable_pagination_button_bg_color VARCHAR(7) NOT NULL, datatable_pagination_button_text_color VARCHAR(7) NOT NULL, datatable_pagination_button_hover_bg_color VARCHAR(7) NOT NULL, datatable_pagination_button_hover_text_color VARCHAR(7) NOT NULL, datatable_pagination_button_active_bg_color VARCHAR(7) NOT NULL, datatable_pagination_button_active_text_color VARCHAR(7) NOT NULL, accordion_header_bg_color VARCHAR(7) NOT NULL, accordion_header_text_color VARCHAR(7) NOT NULL, accordion_header_active_bg_color VARCHAR(7) NOT NULL, accordion_header_active_text_color VARCHAR(7) NOT NULL, accordion_content_bg_color VARCHAR(7) NOT NULL, accordion_content_text_color VARCHAR(7) NOT NULL, modal_header_bg_color VARCHAR(7) NOT NULL, modal_header_text_color VARCHAR(7) NOT NULL, modal_body_bg_color VARCHAR(7) NOT NULL, modal_body_text_color VARCHAR(7) NOT NULL, modal_footer_bg_color VARCHAR(7) NOT NULL, modal_close_button_bg_color VARCHAR(7) NOT NULL, modal_close_button_text_color VARCHAR(7) NOT NULL, modal_close_button_hover_bg_color VARCHAR(7) NOT NULL, modal_close_button_hover_text_color VARCHAR(7) NOT NULL, user_card_bg_color VARCHAR(7) NOT NULL, user_card_text_color VARCHAR(7) NOT NULL, user_card_text_secondary_color VARCHAR(7) NOT NULL, chat_sidebar_bg_color VARCHAR(7) NOT NULL, chat_item_hover_bg_color VARCHAR(7) NOT NULL, chat_item_active_bg_color VARCHAR(7) NOT NULL, chat_item_active_border_color VARCHAR(7) NOT NULL, chat_item_text_main_color VARCHAR(7) NOT NULL, chat_item_text_secondary_color VARCHAR(7) NOT NULL, chat_badge_bg_color VARCHAR(7) NOT NULL, chat_badge_text_color VARCHAR(7) NOT NULL, chat_header_bg_color VARCHAR(7) NOT NULL, chat_header_text_color VARCHAR(7) NOT NULL, chat_container_bg_color VARCHAR(7) NOT NULL, chat_input_area_bg_color VARCHAR(7) NOT NULL, chat_bubble_sent_bg_color VARCHAR(7) NOT NULL, chat_bubble_sent_text_color VARCHAR(7) NOT NULL, chat_bubble_received_bg_color VARCHAR(7) NOT NULL, chat_bubble_received_text_color VARCHAR(7) NOT NULL, input_bg_color VARCHAR(7) NOT NULL, input_text_color VARCHAR(7) NOT NULL, input_border_color VARCHAR(7) NOT NULL, input_focus_border_color VARCHAR(7) NOT NULL, input_focus_shadow_color VARCHAR(7) NOT NULL, event_card_bg_color VARCHAR(7) NOT NULL, event_card_border_color VARCHAR(7) NOT NULL, event_card_title_color VARCHAR(7) NOT NULL, event_card_meta_color VARCHAR(7) NOT NULL, events_sidebar_bg_color VARCHAR(11) NOT NULL, events_sidebar_title_color VARCHAR(7) NOT NULL, widget_bg_color VARCHAR(7) NOT NULL, widget_header_bg_color VARCHAR(7) NOT NULL, widget_header_text_color VARCHAR(7) NOT NULL, widget_border_color VARCHAR(7) NOT NULL, widget_item_text_color VARCHAR(7) NOT NULL, widget_item_hover_bg_color VARCHAR(7) NOT NULL, widget_icon_color VARCHAR(7) NOT NULL, items_per_page_usuarios INT NOT NULL, items_per_page_centros INT NOT NULL, items_per_page_ciclos INT NOT NULL, items_per_page_grupos INT NOT NULL, items_per_page_modulos INT NOT NULL, items_per_page_matriculas INT NOT NULL, items_per_page_imparticiones INT NOT NULL, items_per_page_horarios INT NOT NULL, name_title_config JSON DEFAULT NULL, created_at DATETIME DEFAULT CURRENT_TIMESTAMP, updated_at DATETIME DEFAULT NULL, deleted TINYINT DEFAULT 0 NOT NULL, deleted_at DATETIME DEFAULT NULL, centro_id INT DEFAULT NULL, UNIQUE INDEX UNIQ_A6EC3EF3298137A7 (centro_id), PRIMARY KEY (id)) DEFAULT CHARACTER SET utf8mb4');
        $this->addSql('CREATE TABLE ponderacion_imparticion (id INT AUTO_INCREMENT NOT NULL, tipo_tarea VARCHAR(20) NOT NULL, peso DOUBLE PRECISION NOT NULL, created_at DATETIME DEFAULT CURRENT_TIMESTAMP, updated_at DATETIME DEFAULT NULL, deleted TINYINT DEFAULT 0 NOT NULL, deleted_at DATETIME DEFAULT NULL, imparticion_id INT NOT NULL, INDEX IDX_A8C81A9D5396730A (imparticion_id), UNIQUE INDEX unique_imparticion_tipo (imparticion_id, tipo_tarea), PRIMARY KEY (id)) DEFAULT CHARACTER SET utf8mb4');
        $this->addSql('CREATE TABLE tarea (id INT AUTO_INCREMENT NOT NULL, titulo VARCHAR(255) NOT NULL, descripcion LONGTEXT DEFAULT NULL, archivo VARCHAR(255) DEFAULT NULL, fecha_limite DATETIME NOT NULL, fecha_inicio DATETIME DEFAULT NULL, visible TINYINT NOT NULL, tipo VARCHAR(20) NOT NULL, peso DOUBLE PRECISION DEFAULT NULL, obligatoria TINYINT DEFAULT 1 NOT NULL, nota_minima DOUBLE PRECISION DEFAULT NULL, created_at DATETIME DEFAULT CURRENT_TIMESTAMP, updated_at DATETIME DEFAULT NULL, deleted TINYINT DEFAULT 0 NOT NULL, deleted_at DATETIME DEFAULT NULL, imparticion_id INT NOT NULL, tarea_original_id INT DEFAULT NULL, INDEX IDX_3CA053665396730A (imparticion_id), INDEX IDX_3CA053669588CB6 (tarea_original_id), PRIMARY KEY (id)) DEFAULT CHARACTER SET utf8mb4');
        $this->addSql('CREATE TABLE tema_visual (id INT AUTO_INCREMENT NOT NULL, nombre VARCHAR(255) NOT NULL, configuracion JSON NOT NULL, es_predefinido TINYINT DEFAULT 0 NOT NULL, created_at DATETIME DEFAULT CURRENT_TIMESTAMP, updated_at DATETIME DEFAULT NULL, centro_id INT DEFAULT NULL, INDEX IDX_2C49299D298137A7 (centro_id), PRIMARY KEY (id)) DEFAULT CHARACTER SET utf8mb4');
        $this->addSql('CREATE TABLE temario (id INT AUTO_INCREMENT NOT NULL, titulo VARCHAR(255) NOT NULL, archivo VARCHAR(255) NOT NULL, fecha_subida DATETIME NOT NULL, created_at DATETIME DEFAULT CURRENT_TIMESTAMP, updated_at DATETIME DEFAULT NULL, deleted TINYINT DEFAULT 0 NOT NULL, deleted_at DATETIME DEFAULT NULL, imparticion_id INT NOT NULL, INDEX IDX_10D862C5396730A (imparticion_id), PRIMARY KEY (id)) DEFAULT CHARACTER SET utf8mb4');
        $this->addSql('CREATE TABLE usuario (id INT AUTO_INCREMENT NOT NULL, email VARCHAR(180) NOT NULL, roles JSON NOT NULL, password VARCHAR(255) NOT NULL, nombre VARCHAR(255) NOT NULL, apellidos VARCHAR(255) NOT NULL, telefono VARCHAR(20) DEFAULT NULL, nif VARCHAR(20) DEFAULT NULL, rol_app VARCHAR(20) NOT NULL, foto VARCHAR(255) DEFAULT NULL, firma VARCHAR(255) DEFAULT NULL, tutorials_completed JSON DEFAULT \'[]\' NOT NULL, created_at DATETIME DEFAULT CURRENT_TIMESTAMP, updated_at DATETIME DEFAULT NULL, deleted TINYINT DEFAULT 0 NOT NULL, deleted_at DATETIME DEFAULT NULL, centro_id INT DEFAULT NULL, UNIQUE INDEX UNIQ_2265B05DE7927C74 (email), INDEX IDX_2265B05D298137A7 (centro_id), PRIMARY KEY (id)) DEFAULT CHARACTER SET utf8mb4');
        $this->addSql('CREATE TABLE messenger_messages (id BIGINT AUTO_INCREMENT NOT NULL, body LONGTEXT NOT NULL, headers LONGTEXT NOT NULL, queue_name VARCHAR(190) NOT NULL, created_at DATETIME NOT NULL, available_at DATETIME NOT NULL, delivered_at DATETIME DEFAULT NULL, INDEX IDX_75EA56E0FB7336F0E3BD61CE16BA31DBBF396750 (queue_name, available_at, delivered_at, id), PRIMARY KEY (id)) DEFAULT CHARACTER SET utf8mb4');
        $this->addSql('ALTER TABLE asistencia ADD CONSTRAINT FK_D8264A8D5396730A FOREIGN KEY (imparticion_id) REFERENCES imparticion (id)');
        $this->addSql('ALTER TABLE asistencia ADD CONSTRAINT FK_D8264A8DFC28E5EE FOREIGN KEY (alumno_id) REFERENCES usuario (id)');
        $this->addSql('ALTER TABLE calificacion ADD CONSTRAINT FK_8A3AF2187AB91AEC FOREIGN KEY (entrega_id) REFERENCES entrega (id)');
        $this->addSql('ALTER TABLE catalogo_materia ADD CONSTRAINT FK_55EAD35B824E717 FOREIGN KEY (itinerario_id) REFERENCES catalogo_itinerario (id) ON DELETE CASCADE');
        $this->addSql('ALTER TABLE centro ADD CONSTRAINT FK_2675036B438E8617 FOREIGN KEY (catalogo_origen_id) REFERENCES catalogo_centro (id) ON DELETE SET NULL');
        $this->addSql('ALTER TABLE comunicado ADD CONSTRAINT FK_B5F8831014D45BBE FOREIGN KEY (autor_id) REFERENCES usuario (id)');
        $this->addSql('ALTER TABLE comunicado ADD CONSTRAINT FK_B5F88310298137A7 FOREIGN KEY (centro_id) REFERENCES centro (id)');
        $this->addSql('ALTER TABLE entrega ADD CONSTRAINT FK_E56D596B6D5BDFE1 FOREIGN KEY (tarea_id) REFERENCES tarea (id)');
        $this->addSql('ALTER TABLE entrega ADD CONSTRAINT FK_E56D596BFC28E5EE FOREIGN KEY (alumno_id) REFERENCES usuario (id)');
        $this->addSql('ALTER TABLE festivo ADD CONSTRAINT FK_9472C78A298137A7 FOREIGN KEY (centro_id) REFERENCES centro (id)');
        $this->addSql('ALTER TABLE grupo ADD CONSTRAINT FK_8C0E9BD3B824E717 FOREIGN KEY (itinerario_id) REFERENCES itinerario (id)');
        $this->addSql('ALTER TABLE grupo ADD CONSTRAINT FK_8C0E9BD3298137A7 FOREIGN KEY (centro_id) REFERENCES centro (id)');
        $this->addSql('ALTER TABLE horario ADD CONSTRAINT FK_E25853A35396730A FOREIGN KEY (imparticion_id) REFERENCES imparticion (id)');
        $this->addSql('ALTER TABLE imparticion ADD CONSTRAINT FK_D179FDFDE52BD977 FOREIGN KEY (profesor_id) REFERENCES usuario (id)');
        $this->addSql('ALTER TABLE imparticion ADD CONSTRAINT FK_D179FDFDB54DBBCB FOREIGN KEY (materia_id) REFERENCES materia (id)');
        $this->addSql('ALTER TABLE imparticion ADD CONSTRAINT FK_D179FDFD9C833003 FOREIGN KEY (grupo_id) REFERENCES grupo (id)');
        $this->addSql('ALTER TABLE itinerario ADD CONSTRAINT FK_11ECF404298137A7 FOREIGN KEY (centro_id) REFERENCES centro (id)');
        $this->addSql('ALTER TABLE itinerario ADD CONSTRAINT FK_11ECF404438E8617 FOREIGN KEY (catalogo_origen_id) REFERENCES catalogo_itinerario (id) ON DELETE SET NULL');
        $this->addSql('ALTER TABLE materia ADD CONSTRAINT FK_6DF05284B824E717 FOREIGN KEY (itinerario_id) REFERENCES itinerario (id)');
        $this->addSql('ALTER TABLE materia ADD CONSTRAINT FK_6DF05284438E8617 FOREIGN KEY (catalogo_origen_id) REFERENCES catalogo_materia (id) ON DELETE SET NULL');
        $this->addSql('ALTER TABLE matricula ADD CONSTRAINT FK_15DF1885FC28E5EE FOREIGN KEY (alumno_id) REFERENCES usuario (id)');
        $this->addSql('ALTER TABLE matricula ADD CONSTRAINT FK_15DF18859C833003 FOREIGN KEY (grupo_id) REFERENCES grupo (id)');
        $this->addSql('ALTER TABLE mensaje ADD CONSTRAINT FK_9B631D011C3E945F FOREIGN KEY (remitente_id) REFERENCES usuario (id)');
        $this->addSql('ALTER TABLE mensaje ADD CONSTRAINT FK_9B631D01B564FBC1 FOREIGN KEY (destinatario_id) REFERENCES usuario (id)');
        $this->addSql('ALTER TABLE periodo_evaluativo ADD CONSTRAINT FK_FC9F21709C833003 FOREIGN KEY (grupo_id) REFERENCES grupo (id)');
        $this->addSql('ALTER TABLE personalizacion ADD CONSTRAINT FK_A6EC3EF3298137A7 FOREIGN KEY (centro_id) REFERENCES centro (id)');
        $this->addSql('ALTER TABLE ponderacion_imparticion ADD CONSTRAINT FK_A8C81A9D5396730A FOREIGN KEY (imparticion_id) REFERENCES imparticion (id)');
        $this->addSql('ALTER TABLE tarea ADD CONSTRAINT FK_3CA053665396730A FOREIGN KEY (imparticion_id) REFERENCES imparticion (id)');
        $this->addSql('ALTER TABLE tarea ADD CONSTRAINT FK_3CA053669588CB6 FOREIGN KEY (tarea_original_id) REFERENCES tarea (id) ON DELETE SET NULL');
        $this->addSql('ALTER TABLE tema_visual ADD CONSTRAINT FK_2C49299D298137A7 FOREIGN KEY (centro_id) REFERENCES centro (id)');
        $this->addSql('ALTER TABLE temario ADD CONSTRAINT FK_10D862C5396730A FOREIGN KEY (imparticion_id) REFERENCES imparticion (id)');
        $this->addSql('ALTER TABLE usuario ADD CONSTRAINT FK_2265B05D298137A7 FOREIGN KEY (centro_id) REFERENCES centro (id)');
    }

    public function down(Schema $schema): void
    {
        // this down() migration is auto-generated, please modify it to your needs
        $this->addSql('ALTER TABLE asistencia DROP FOREIGN KEY FK_D8264A8D5396730A');
        $this->addSql('ALTER TABLE asistencia DROP FOREIGN KEY FK_D8264A8DFC28E5EE');
        $this->addSql('ALTER TABLE calificacion DROP FOREIGN KEY FK_8A3AF2187AB91AEC');
        $this->addSql('ALTER TABLE catalogo_materia DROP FOREIGN KEY FK_55EAD35B824E717');
        $this->addSql('ALTER TABLE centro DROP FOREIGN KEY FK_2675036B438E8617');
        $this->addSql('ALTER TABLE comunicado DROP FOREIGN KEY FK_B5F8831014D45BBE');
        $this->addSql('ALTER TABLE comunicado DROP FOREIGN KEY FK_B5F88310298137A7');
        $this->addSql('ALTER TABLE entrega DROP FOREIGN KEY FK_E56D596B6D5BDFE1');
        $this->addSql('ALTER TABLE entrega DROP FOREIGN KEY FK_E56D596BFC28E5EE');
        $this->addSql('ALTER TABLE festivo DROP FOREIGN KEY FK_9472C78A298137A7');
        $this->addSql('ALTER TABLE grupo DROP FOREIGN KEY FK_8C0E9BD3B824E717');
        $this->addSql('ALTER TABLE grupo DROP FOREIGN KEY FK_8C0E9BD3298137A7');
        $this->addSql('ALTER TABLE horario DROP FOREIGN KEY FK_E25853A35396730A');
        $this->addSql('ALTER TABLE imparticion DROP FOREIGN KEY FK_D179FDFDE52BD977');
        $this->addSql('ALTER TABLE imparticion DROP FOREIGN KEY FK_D179FDFDB54DBBCB');
        $this->addSql('ALTER TABLE imparticion DROP FOREIGN KEY FK_D179FDFD9C833003');
        $this->addSql('ALTER TABLE itinerario DROP FOREIGN KEY FK_11ECF404298137A7');
        $this->addSql('ALTER TABLE itinerario DROP FOREIGN KEY FK_11ECF404438E8617');
        $this->addSql('ALTER TABLE materia DROP FOREIGN KEY FK_6DF05284B824E717');
        $this->addSql('ALTER TABLE materia DROP FOREIGN KEY FK_6DF05284438E8617');
        $this->addSql('ALTER TABLE matricula DROP FOREIGN KEY FK_15DF1885FC28E5EE');
        $this->addSql('ALTER TABLE matricula DROP FOREIGN KEY FK_15DF18859C833003');
        $this->addSql('ALTER TABLE mensaje DROP FOREIGN KEY FK_9B631D011C3E945F');
        $this->addSql('ALTER TABLE mensaje DROP FOREIGN KEY FK_9B631D01B564FBC1');
        $this->addSql('ALTER TABLE periodo_evaluativo DROP FOREIGN KEY FK_FC9F21709C833003');
        $this->addSql('ALTER TABLE personalizacion DROP FOREIGN KEY FK_A6EC3EF3298137A7');
        $this->addSql('ALTER TABLE ponderacion_imparticion DROP FOREIGN KEY FK_A8C81A9D5396730A');
        $this->addSql('ALTER TABLE tarea DROP FOREIGN KEY FK_3CA053665396730A');
        $this->addSql('ALTER TABLE tarea DROP FOREIGN KEY FK_3CA053669588CB6');
        $this->addSql('ALTER TABLE tema_visual DROP FOREIGN KEY FK_2C49299D298137A7');
        $this->addSql('ALTER TABLE temario DROP FOREIGN KEY FK_10D862C5396730A');
        $this->addSql('ALTER TABLE usuario DROP FOREIGN KEY FK_2265B05D298137A7');
        $this->addSql('DROP TABLE asistencia');
        $this->addSql('DROP TABLE calificacion');
        $this->addSql('DROP TABLE catalogo_centro');
        $this->addSql('DROP TABLE catalogo_itinerario');
        $this->addSql('DROP TABLE catalogo_materia');
        $this->addSql('DROP TABLE centro');
        $this->addSql('DROP TABLE comunicado');
        $this->addSql('DROP TABLE entrega');
        $this->addSql('DROP TABLE festivo');
        $this->addSql('DROP TABLE grupo');
        $this->addSql('DROP TABLE horario');
        $this->addSql('DROP TABLE imparticion');
        $this->addSql('DROP TABLE itinerario');
        $this->addSql('DROP TABLE materia');
        $this->addSql('DROP TABLE matricula');
        $this->addSql('DROP TABLE mensaje');
        $this->addSql('DROP TABLE periodo_evaluativo');
        $this->addSql('DROP TABLE personalizacion');
        $this->addSql('DROP TABLE ponderacion_imparticion');
        $this->addSql('DROP TABLE tarea');
        $this->addSql('DROP TABLE tema_visual');
        $this->addSql('DROP TABLE temario');
        $this->addSql('DROP TABLE usuario');
        $this->addSql('DROP TABLE messenger_messages');
    }
}
