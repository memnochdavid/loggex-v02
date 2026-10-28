-- =============================================================
-- Seed fixtures de demostración para Escuela Arte Granada (centro_id = 3)
-- Cubre grupos sin datos o con huecos:
--   * Grupo 3 (DAM 1, alumnos 72-76): temarios + asistencia (imp 49-55)
--   * Grupo 5 (DAM 2, alumnos 67-71): temarios + asistencia (imp 57-62)
--   * Grupo 2 (DAW 2, alumnos 62-66), imp 43 (IPE-II):
--       temarios + tareas + entregas + calificaciones + asistencia
--
-- Idempotente: TODO se ejecuta dentro de un stored procedure que
-- aborta con SIGNAL al detectar temarios ya presentes para los
-- imparticiones objetivo. Si se aborta, ninguna fila se inserta.
-- Para reaplicar, borrar manualmente las filas insertadas.
--
-- Todos los PDFs apuntan a 'Dummy.pdf' (ya en bucket MinIO loggex-data).
--
-- Ejecución típica:
--   docker compose exec -T db mariadb -uapp_user -papp_password app_db \
--     < backend/scripts/seed_eag_grupos_3_5_2_43.sql
--
-- Tras ejecutar, refrescar clientes conectados:
--   docker compose exec backend php bin/console app:mercure:invalidate \
--     -t /admin/temarios -t /admin/asistencias -t /admin/tareas \
--     -t /admin/entregas -t /admin/calificaciones
-- =============================================================

DELIMITER //

DROP PROCEDURE IF EXISTS _seed_eag_grupos //

CREATE PROCEDURE _seed_eag_grupos()
BEGIN
  DECLARE v_tarea_base   INT DEFAULT 0;
  DECLARE v_entrega_base INT DEFAULT 0;
  DECLARE v_t1 INT; DECLARE v_t2 INT; DECLARE v_t3 INT; DECLARE v_t4 INT; DECLARE v_t5 INT;

  -- Rollback automático ante cualquier excepción SQL
  DECLARE EXIT HANDLER FOR SQLEXCEPTION
  BEGIN
    ROLLBACK;
    RESIGNAL;
  END;

  START TRANSACTION;

  -- -----------------------------------------------------------
  -- Guard de idempotencia
  -- -----------------------------------------------------------
  IF (SELECT COUNT(*) FROM temario
        WHERE imparticion_id IN (43,49,50,51,52,53,54,55,57,58,59,60,61,62)
          AND deleted = 0) > 0
  THEN
    SIGNAL SQLSTATE '45000'
      SET MESSAGE_TEXT = 'Seed EAG ya aplicado (existen temarios en imps objetivo). Aborto sin cambios.';
  END IF;

  -- -----------------------------------------------------------
  -- BLOQUE 0 — Ponderaciones (examen 0.5 / tarea 0.3 / practica 0.2)
  -- para imps 43, 49-55, 57-62. Sin esto la UI Calificaciones muestra
  -- "—" porque CalificacionMediaController no encuentra cómo ponderar.
  -- INSERT IGNORE: respeta UNIQUE (imparticion_id, tipo_tarea).
  -- -----------------------------------------------------------
  INSERT IGNORE INTO ponderacion_imparticion (tipo_tarea, peso, created_at, updated_at, deleted, deleted_at, imparticion_id)
  SELECT t.tipo, t.peso, NOW(), NOW(), 0, NULL, i.imparticion_id
  FROM (SELECT 43 AS imparticion_id UNION ALL SELECT 49 UNION ALL SELECT 50 UNION ALL SELECT 51
     UNION ALL SELECT 52 UNION ALL SELECT 53 UNION ALL SELECT 54 UNION ALL SELECT 55
     UNION ALL SELECT 57 UNION ALL SELECT 58 UNION ALL SELECT 59 UNION ALL SELECT 60
     UNION ALL SELECT 61 UNION ALL SELECT 62) i
  CROSS JOIN (SELECT 'examen' AS tipo, 0.5 AS peso
         UNION ALL SELECT 'tarea', 0.3
         UNION ALL SELECT 'practica', 0.2) t;

  -- -----------------------------------------------------------
  -- BLOQUE A — Grupo 3 (DAM 1): 21 temarios (imp 49-55)
  -- -----------------------------------------------------------
  INSERT INTO temario (titulo, archivo, fecha_subida, created_at, updated_at, deleted, deleted_at, imparticion_id) VALUES
    ('Sistemas informáticos - Tema 1','Dummy.pdf','2025-09-15 09:00:00','2025-09-15 09:00:00','2025-09-15 09:00:00',0,NULL,49),
    ('Sistemas informáticos - Tema 2','Dummy.pdf','2025-11-15 09:00:00','2025-11-15 09:00:00','2025-11-15 09:00:00',0,NULL,49),
    ('Sistemas informáticos - Tema 3','Dummy.pdf','2026-01-15 09:00:00','2026-01-15 09:00:00','2026-01-15 09:00:00',0,NULL,49),
    ('Bases de Datos - Tema 1','Dummy.pdf','2025-09-15 09:00:00','2025-09-15 09:00:00','2025-09-15 09:00:00',0,NULL,50),
    ('Bases de Datos - Tema 2','Dummy.pdf','2025-11-15 09:00:00','2025-11-15 09:00:00','2025-11-15 09:00:00',0,NULL,50),
    ('Bases de Datos - Tema 3','Dummy.pdf','2026-01-15 09:00:00','2026-01-15 09:00:00','2026-01-15 09:00:00',0,NULL,50),
    ('Programación - Tema 1','Dummy.pdf','2025-09-15 09:00:00','2025-09-15 09:00:00','2025-09-15 09:00:00',0,NULL,51),
    ('Programación - Tema 2','Dummy.pdf','2025-11-15 09:00:00','2025-11-15 09:00:00','2025-11-15 09:00:00',0,NULL,51),
    ('Programación - Tema 3','Dummy.pdf','2026-01-15 09:00:00','2026-01-15 09:00:00','2026-01-15 09:00:00',0,NULL,51),
    ('Lenguajes de marcas - Tema 1','Dummy.pdf','2025-09-15 09:00:00','2025-09-15 09:00:00','2025-09-15 09:00:00',0,NULL,52),
    ('Lenguajes de marcas - Tema 2','Dummy.pdf','2025-11-15 09:00:00','2025-11-15 09:00:00','2025-11-15 09:00:00',0,NULL,52),
    ('Lenguajes de marcas - Tema 3','Dummy.pdf','2026-01-15 09:00:00','2026-01-15 09:00:00','2026-01-15 09:00:00',0,NULL,52),
    ('Entornos de desarrollo - Tema 1','Dummy.pdf','2025-09-15 09:00:00','2025-09-15 09:00:00','2025-09-15 09:00:00',0,NULL,53),
    ('Entornos de desarrollo - Tema 2','Dummy.pdf','2025-11-15 09:00:00','2025-11-15 09:00:00','2025-11-15 09:00:00',0,NULL,53),
    ('Entornos de desarrollo - Tema 3','Dummy.pdf','2026-01-15 09:00:00','2026-01-15 09:00:00','2026-01-15 09:00:00',0,NULL,53),
    ('Itinerario Personal Empleabilidad I - Tema 1','Dummy.pdf','2025-09-15 09:00:00','2025-09-15 09:00:00','2025-09-15 09:00:00',0,NULL,54),
    ('Itinerario Personal Empleabilidad I - Tema 2','Dummy.pdf','2025-11-15 09:00:00','2025-11-15 09:00:00','2025-11-15 09:00:00',0,NULL,54),
    ('Itinerario Personal Empleabilidad I - Tema 3','Dummy.pdf','2026-01-15 09:00:00','2026-01-15 09:00:00','2026-01-15 09:00:00',0,NULL,54),
    ('Digitalización aplicada - Tema 1','Dummy.pdf','2025-09-15 09:00:00','2025-09-15 09:00:00','2025-09-15 09:00:00',0,NULL,55),
    ('Digitalización aplicada - Tema 2','Dummy.pdf','2025-11-15 09:00:00','2025-11-15 09:00:00','2025-11-15 09:00:00',0,NULL,55),
    ('Digitalización aplicada - Tema 3','Dummy.pdf','2026-01-15 09:00:00','2026-01-15 09:00:00','2026-01-15 09:00:00',0,NULL,55);

  -- -----------------------------------------------------------
  -- BLOQUE B — Grupo 5 (DAM 2): 18 temarios (imp 57-62)
  -- -----------------------------------------------------------
  INSERT INTO temario (titulo, archivo, fecha_subida, created_at, updated_at, deleted, deleted_at, imparticion_id) VALUES
    ('Acceso a datos - Tema 1','Dummy.pdf','2025-09-15 09:00:00','2025-09-15 09:00:00','2025-09-15 09:00:00',0,NULL,57),
    ('Acceso a datos - Tema 2','Dummy.pdf','2025-11-15 09:00:00','2025-11-15 09:00:00','2025-11-15 09:00:00',0,NULL,57),
    ('Acceso a datos - Tema 3','Dummy.pdf','2026-01-15 09:00:00','2026-01-15 09:00:00','2026-01-15 09:00:00',0,NULL,57),
    ('Desarrollo de interfaces - Tema 1','Dummy.pdf','2025-09-15 09:00:00','2025-09-15 09:00:00','2025-09-15 09:00:00',0,NULL,58),
    ('Desarrollo de interfaces - Tema 2','Dummy.pdf','2025-11-15 09:00:00','2025-11-15 09:00:00','2025-11-15 09:00:00',0,NULL,58),
    ('Desarrollo de interfaces - Tema 3','Dummy.pdf','2026-01-15 09:00:00','2026-01-15 09:00:00','2026-01-15 09:00:00',0,NULL,58),
    ('Programación multimedia y dispositivos móviles - Tema 1','Dummy.pdf','2025-09-15 09:00:00','2025-09-15 09:00:00','2025-09-15 09:00:00',0,NULL,59),
    ('Programación multimedia y dispositivos móviles - Tema 2','Dummy.pdf','2025-11-15 09:00:00','2025-11-15 09:00:00','2025-11-15 09:00:00',0,NULL,59),
    ('Programación multimedia y dispositivos móviles - Tema 3','Dummy.pdf','2026-01-15 09:00:00','2026-01-15 09:00:00','2026-01-15 09:00:00',0,NULL,59),
    ('Sistemas de gestión empresarial - Tema 1','Dummy.pdf','2025-09-15 09:00:00','2025-09-15 09:00:00','2025-09-15 09:00:00',0,NULL,60),
    ('Sistemas de gestión empresarial - Tema 2','Dummy.pdf','2025-11-15 09:00:00','2025-11-15 09:00:00','2025-11-15 09:00:00',0,NULL,60),
    ('Sistemas de gestión empresarial - Tema 3','Dummy.pdf','2026-01-15 09:00:00','2026-01-15 09:00:00','2026-01-15 09:00:00',0,NULL,60),
    ('Programación de servicios y procesos - Tema 1','Dummy.pdf','2025-09-15 09:00:00','2025-09-15 09:00:00','2025-09-15 09:00:00',0,NULL,61),
    ('Programación de servicios y procesos - Tema 2','Dummy.pdf','2025-11-15 09:00:00','2025-11-15 09:00:00','2025-11-15 09:00:00',0,NULL,61),
    ('Programación de servicios y procesos - Tema 3','Dummy.pdf','2026-01-15 09:00:00','2026-01-15 09:00:00','2026-01-15 09:00:00',0,NULL,61),
    ('Empresa e iniciativa emprendedora - Tema 1','Dummy.pdf','2025-09-15 09:00:00','2025-09-15 09:00:00','2025-09-15 09:00:00',0,NULL,62),
    ('Empresa e iniciativa emprendedora - Tema 2','Dummy.pdf','2025-11-15 09:00:00','2025-11-15 09:00:00','2025-11-15 09:00:00',0,NULL,62),
    ('Empresa e iniciativa emprendedora - Tema 3','Dummy.pdf','2026-01-15 09:00:00','2026-01-15 09:00:00','2026-01-15 09:00:00',0,NULL,62);

  -- -----------------------------------------------------------
  -- BLOQUE C — Grupo 2 imp 43 (IPE-II): temarios + tareas + entregas + calificaciones
  -- -----------------------------------------------------------
  INSERT INTO temario (titulo, archivo, fecha_subida, created_at, updated_at, deleted, deleted_at, imparticion_id) VALUES
    ('Itinerario Personal Empleabilidad II - Tema 1','Dummy.pdf','2025-09-15 09:00:00','2025-09-15 09:00:00','2025-09-15 09:00:00',0,NULL,43),
    ('Itinerario Personal Empleabilidad II - Tema 2','Dummy.pdf','2025-11-15 09:00:00','2025-11-15 09:00:00','2025-11-15 09:00:00',0,NULL,43),
    ('Itinerario Personal Empleabilidad II - Tema 3','Dummy.pdf','2026-01-15 09:00:00','2026-01-15 09:00:00','2026-01-15 09:00:00',0,NULL,43);

  -- Capturamos el AUTO_INCREMENT base para encadenar entregas/calificaciones
  SET v_tarea_base = (SELECT IFNULL(MAX(id),0) FROM tarea);

  INSERT INTO tarea (titulo, descripcion, archivo, fecha_limite, fecha_inicio, visible, tipo, peso, obligatoria, nota_minima, created_at, updated_at, deleted, deleted_at, imparticion_id, tarea_original_id) VALUES
    ('Itinerario Personal Empleabilidad II - Examen Tema 1','<p>Examen Tema 1 de Itinerario Personal Empleabilidad II. Material disponible adjunto.</p>','Dummy.pdf','2025-11-05 23:59:00','2025-10-22 00:00:00',1,'examen',100,1,3,'2025-10-22 09:00:00','2025-10-22 09:00:00',0,NULL,43,NULL),
    ('Itinerario Personal Empleabilidad II - Ejercicios Tema 2','<p>Ejercicios Tema 2 de Itinerario Personal Empleabilidad II. Material disponible adjunto.</p>','Dummy.pdf','2025-11-20 23:59:00','2025-11-06 00:00:00',1,'tarea',20,1,NULL,'2025-11-06 09:00:00','2025-11-06 09:00:00',0,NULL,43,NULL),
    ('Itinerario Personal Empleabilidad II - Trabajo Tema 3','<p>Trabajo Tema 3 de Itinerario Personal Empleabilidad II. Material disponible adjunto.</p>','Dummy.pdf','2025-12-15 23:59:00','2025-12-01 00:00:00',1,'tarea',80,1,NULL,'2025-12-01 09:00:00','2025-12-01 09:00:00',0,NULL,43,NULL),
    ('Itinerario Personal Empleabilidad II - Examen Tema 4','<p>Examen Tema 4 de Itinerario Personal Empleabilidad II. Material disponible adjunto.</p>','Dummy.pdf','2026-02-12 23:59:00','2026-01-29 00:00:00',1,'examen',NULL,1,NULL,'2026-01-29 09:00:00','2026-01-29 09:00:00',0,NULL,43,NULL),
    ('Itinerario Personal Empleabilidad II - Práctica integradora','<p>Práctica integradora de Itinerario Personal Empleabilidad II. Material disponible adjunto.</p>','Dummy.pdf','2026-03-18 23:59:00','2026-03-04 00:00:00',1,'tarea',NULL,1,NULL,'2026-03-04 09:00:00','2026-03-04 09:00:00',0,NULL,43,NULL),
    ('Itinerario Personal Empleabilidad II - Proyecto final tema','<p>Proyecto final tema de Itinerario Personal Empleabilidad II. Material disponible adjunto.</p>','Dummy.pdf','2026-05-15 23:59:00','2026-05-01 00:00:00',1,'practica',100,1,NULL,'2026-05-01 09:00:00','2026-05-01 09:00:00',0,NULL,43,NULL);

  SET v_t1 = v_tarea_base + 1; -- Examen Tema 1
  SET v_t2 = v_tarea_base + 2; -- Ejercicios Tema 2
  SET v_t3 = v_tarea_base + 3; -- Trabajo Tema 3
  SET v_t4 = v_tarea_base + 4; -- Examen Tema 4
  SET v_t5 = v_tarea_base + 5; -- Práctica integradora
  -- v_t6 (Proyecto final, tipo=practica) NO recibe entregas (patrón del dataset existente)

  -- Entregas (5 alumnos × 5 tareas no-practica)
  INSERT INTO entrega (fecha_entrega, enlace, archivo, comentario_alumno, created_at, updated_at, deleted, deleted_at, tarea_id, alumno_id) VALUES
    -- Examen Tema 1 (limite 2025-11-05)
    ('2025-11-03 18:20:00',NULL,'Dummy.pdf','Adjunto el documento solicitado.','2025-11-03 18:20:00','2025-11-03 18:20:00',0,NULL,v_t1,62),
    ('2025-11-04 21:05:00',NULL,'Dummy.pdf',NULL,'2025-11-04 21:05:00','2025-11-04 21:05:00',0,NULL,v_t1,63),
    ('2025-11-05 10:45:00',NULL,'Dummy.pdf','Espero que se entienda bien la explicación del último apartado.','2025-11-05 10:45:00','2025-11-05 10:45:00',0,NULL,v_t1,64),
    ('2025-11-02 16:30:00',NULL,'Dummy.pdf',NULL,'2025-11-02 16:30:00','2025-11-02 16:30:00',0,NULL,v_t1,65),
    ('2025-11-05 22:10:00',NULL,'Dummy.pdf','Entrega completada según el enunciado.','2025-11-05 22:10:00','2025-11-05 22:10:00',0,NULL,v_t1,66),
    -- Ejercicios Tema 2 (limite 2025-11-20)
    ('2025-11-17 19:00:00',NULL,'Dummy.pdf',NULL,'2025-11-17 19:00:00','2025-11-17 19:00:00',0,NULL,v_t2,62),
    ('2025-11-18 21:14:00',NULL,'Dummy.pdf','Trabajo realizado en grupo con compañero.','2025-11-18 21:14:00','2025-11-18 21:14:00',0,NULL,v_t2,63),
    ('2025-11-20 13:06:00',NULL,'Dummy.pdf',NULL,'2025-11-20 13:06:00','2025-11-20 13:06:00',0,NULL,v_t2,64),
    ('2025-11-19 09:45:00',NULL,'Dummy.pdf',NULL,'2025-11-19 09:45:00','2025-11-19 09:45:00',0,NULL,v_t2,65),
    ('2025-11-20 23:30:00',NULL,'Dummy.pdf','Entrega completada según el enunciado.','2025-11-20 23:30:00','2025-11-20 23:30:00',0,NULL,v_t2,66),
    -- Trabajo Tema 3 (limite 2025-12-15)
    ('2025-12-10 17:40:00',NULL,'Dummy.pdf','Adjunto el documento solicitado.','2025-12-10 17:40:00','2025-12-10 17:40:00',0,NULL,v_t3,62),
    ('2025-12-12 21:00:00',NULL,'Dummy.pdf',NULL,'2025-12-12 21:00:00','2025-12-12 21:00:00',0,NULL,v_t3,63),
    ('2025-12-14 18:53:00',NULL,'Dummy.pdf',NULL,'2025-12-14 18:53:00','2025-12-14 18:53:00',0,NULL,v_t3,64),
    ('2025-12-15 11:25:00',NULL,'Dummy.pdf',NULL,'2025-12-15 11:25:00','2025-12-15 11:25:00',0,NULL,v_t3,65),
    ('2025-12-13 15:55:00',NULL,'Dummy.pdf','Adjunto el documento solicitado.','2025-12-13 15:55:00','2025-12-13 15:55:00',0,NULL,v_t3,66),
    -- Examen Tema 4 (limite 2026-02-12)
    ('2026-02-09 12:59:00',NULL,'Dummy.pdf',NULL,'2026-02-09 12:59:00','2026-02-09 12:59:00',0,NULL,v_t4,62),
    ('2026-02-10 13:53:00',NULL,'Dummy.pdf',NULL,'2026-02-10 13:53:00','2026-02-10 13:53:00',0,NULL,v_t4,63),
    ('2026-02-11 13:25:00',NULL,'Dummy.pdf','Adjunto el documento solicitado.','2026-02-11 13:25:00','2026-02-11 13:25:00',0,NULL,v_t4,64),
    ('2026-02-08 19:45:00',NULL,'Dummy.pdf',NULL,'2026-02-08 19:45:00','2026-02-08 19:45:00',0,NULL,v_t4,65),
    ('2026-02-12 22:00:00',NULL,'Dummy.pdf',NULL,'2026-02-12 22:00:00','2026-02-12 22:00:00',0,NULL,v_t4,66),
    -- Práctica integradora (limite 2026-03-18)
    ('2026-03-15 22:58:00',NULL,'Dummy.pdf',NULL,'2026-03-15 22:58:00','2026-03-15 22:58:00',0,NULL,v_t5,62),
    ('2026-03-12 12:47:00',NULL,'Dummy.pdf',NULL,'2026-03-12 12:47:00','2026-03-12 12:47:00',0,NULL,v_t5,63),
    ('2026-03-18 13:14:00',NULL,'Dummy.pdf',NULL,'2026-03-18 13:14:00','2026-03-18 13:14:00',0,NULL,v_t5,64),
    ('2026-03-17 09:20:00',NULL,'Dummy.pdf','Trabajo realizado en grupo con compañero.','2026-03-17 09:20:00','2026-03-17 09:20:00',0,NULL,v_t5,65),
    ('2026-03-14 18:30:00',NULL,'Dummy.pdf',NULL,'2026-03-14 18:30:00','2026-03-14 18:30:00',0,NULL,v_t5,66);

  SET v_entrega_base = (SELECT IFNULL(MIN(id),0) FROM entrega WHERE tarea_id IN (v_t1, v_t2, v_t3, v_t4, v_t5));

  -- Calificaciones (1 por entrega; orden de inserción = orden de IDs)
  INSERT INTO calificacion (nota, feedback_profesor, created_at, updated_at, deleted, deleted_at, entrega_id) VALUES
    (6.25,'Bien ejecutado, podría mejorar la estructura.','2025-11-08 09:00:00','2025-11-08 09:00:00',0,NULL, v_entrega_base + 0),
    (7.40,NULL,                                            '2025-11-08 09:00:00','2025-11-08 09:00:00',0,NULL, v_entrega_base + 1),
    (5.10,'Aceptable. Faltan algunos detalles que vimos en clase.','2025-11-08 09:00:00','2025-11-08 09:00:00',0,NULL, v_entrega_base + 2),
    (8.35,'Perfecto, has cubierto todos los puntos.',      '2025-11-08 09:00:00','2025-11-08 09:00:00',0,NULL, v_entrega_base + 3),
    (4.80,'No se cumple con lo solicitado. Recuperación necesaria.','2025-11-08 09:00:00','2025-11-08 09:00:00',0,NULL, v_entrega_base + 4),
    (7.90,NULL,                                            '2025-11-23 09:00:00','2025-11-23 09:00:00',0,NULL, v_entrega_base + 5),
    (5.55,'Buen trabajo en general, revisa el apartado de conclusiones.','2025-11-23 09:00:00','2025-11-23 09:00:00',0,NULL, v_entrega_base + 6),
    (6.78,NULL,                                            '2025-11-23 09:00:00','2025-11-23 09:00:00',0,NULL, v_entrega_base + 7),
    (9.10,'Perfecto, has cubierto todos los puntos.',      '2025-11-23 09:00:00','2025-11-23 09:00:00',0,NULL, v_entrega_base + 8),
    (6.42,'Cumple con lo pedido, mejorable la presentación.','2025-11-23 09:00:00','2025-11-23 09:00:00',0,NULL, v_entrega_base + 9),
    (8.05,NULL,                                            '2025-12-18 09:00:00','2025-12-18 09:00:00',0,NULL, v_entrega_base + 10),
    (7.20,'Buen trabajo en general, revisa el apartado de conclusiones.','2025-12-18 09:00:00','2025-12-18 09:00:00',0,NULL, v_entrega_base + 11),
    (4.55,'Faltan apartados clave del enunciado. Revisa lo entregado.','2025-12-18 09:00:00','2025-12-18 09:00:00',0,NULL, v_entrega_base + 12),
    (6.85,NULL,                                            '2025-12-18 09:00:00','2025-12-18 09:00:00',0,NULL, v_entrega_base + 13),
    (8.60,'Perfecto, has cubierto todos los puntos.',      '2025-12-18 09:00:00','2025-12-18 09:00:00',0,NULL, v_entrega_base + 14),
    (7.10,NULL,                                            '2026-02-15 09:00:00','2026-02-15 09:00:00',0,NULL, v_entrega_base + 15),
    (5.95,'Cumple con lo pedido, mejorable la presentación.','2026-02-15 09:00:00','2026-02-15 09:00:00',0,NULL, v_entrega_base + 16),
    (9.25,'Perfecto, has cubierto todos los puntos.',      '2026-02-15 09:00:00','2026-02-15 09:00:00',0,NULL, v_entrega_base + 17),
    (6.30,NULL,                                            '2026-02-15 09:00:00','2026-02-15 09:00:00',0,NULL, v_entrega_base + 18),
    (5.40,'Aceptable. Faltan algunos detalles que vimos en clase.','2026-02-15 09:00:00','2026-02-15 09:00:00',0,NULL, v_entrega_base + 19),
    (8.15,'Buen trabajo en general, revisa el apartado de conclusiones.','2026-03-21 09:00:00','2026-03-21 09:00:00',0,NULL, v_entrega_base + 20),
    (6.95,NULL,                                            '2026-03-21 09:00:00','2026-03-21 09:00:00',0,NULL, v_entrega_base + 21),
    (7.50,'Cumple con lo pedido, mejorable la presentación.','2026-03-21 09:00:00','2026-03-21 09:00:00',0,NULL, v_entrega_base + 22),
    (9.05,'Perfecto, has cubierto todos los puntos.',      '2026-03-21 09:00:00','2026-03-21 09:00:00',0,NULL, v_entrega_base + 23),
    (6.10,NULL,                                            '2026-03-21 09:00:00','2026-03-21 09:00:00',0,NULL, v_entrega_base + 24);

  -- -----------------------------------------------------------
  -- ASISTENCIA — 13 fechas representativas alineadas con el patrón demo.
  -- Estado pseudo-aleatorio determinista basado en (alumno_id, idx_fecha):
  --   ~92% P, ~4% F (falta), ~2% R (retraso), ~2% J (justificada)
  -- -----------------------------------------------------------
  DROP TEMPORARY TABLE IF EXISTS _tmp_alumno_imp;
  CREATE TEMPORARY TABLE _tmp_alumno_imp (alumno_id INT, imparticion_id INT);
  INSERT INTO _tmp_alumno_imp VALUES
    -- Grupo 3 (DAM 1) alumnos 72-76 × imp 49-55  → 35 combinaciones
    (72,49),(72,50),(72,51),(72,52),(72,53),(72,54),(72,55),
    (73,49),(73,50),(73,51),(73,52),(73,53),(73,54),(73,55),
    (74,49),(74,50),(74,51),(74,52),(74,53),(74,54),(74,55),
    (75,49),(75,50),(75,51),(75,52),(75,53),(75,54),(75,55),
    (76,49),(76,50),(76,51),(76,52),(76,53),(76,54),(76,55),
    -- Grupo 5 (DAM 2) alumnos 67-71 × imp 57-62  → 30 combinaciones
    (67,57),(67,58),(67,59),(67,60),(67,61),(67,62),
    (68,57),(68,58),(68,59),(68,60),(68,61),(68,62),
    (69,57),(69,58),(69,59),(69,60),(69,61),(69,62),
    (70,57),(70,58),(70,59),(70,60),(70,61),(70,62),
    (71,57),(71,58),(71,59),(71,60),(71,61),(71,62),
    -- Grupo 2 imp 43 (IPE-II) alumnos 62-66       → 5 combinaciones
    (62,43),(63,43),(64,43),(65,43),(66,43);

  DROP TEMPORARY TABLE IF EXISTS _tmp_fecha;
  CREATE TEMPORARY TABLE _tmp_fecha (idx INT, fecha DATE);
  INSERT INTO _tmp_fecha VALUES
    (1,'2026-01-12'),(2,'2026-01-14'),(3,'2026-01-16'),
    (4,'2026-04-13'),(5,'2026-04-14'),(6,'2026-04-15'),(7,'2026-04-16'),(8,'2026-04-17'),
    (9,'2026-04-21'),(10,'2026-04-22'),
    (11,'2026-04-30'),
    (12,'2026-05-06'),(13,'2026-05-08');

  INSERT INTO asistencia (fecha, hora, estado, comentario, created_at, updated_at, deleted, deleted_at, imparticion_id, alumno_id)
  SELECT
    f.fecha,
    '08:30:00',
    CASE
      WHEN ((a.alumno_id * 7  + f.idx * 11) % 47) = 0 THEN 'J'
      WHEN ((a.alumno_id * 13 + f.idx * 5)  % 23) = 0 THEN 'F'
      WHEN ((a.alumno_id * 17 + f.idx * 3)  % 41) = 0 THEN 'R'
      ELSE 'P'
    END AS estado,
    CASE
      WHEN ((a.alumno_id * 7  + f.idx * 11) % 47) = 0 THEN 'Cita médica justificada con parte'
      WHEN ((a.alumno_id * 17 + f.idx * 3)  % 41) = 0 THEN 'Llegó 10 min tarde'
      ELSE NULL
    END AS comentario,
    NOW(), NOW(), 0, NULL,
    a.imparticion_id, a.alumno_id
  FROM _tmp_alumno_imp a
  CROSS JOIN _tmp_fecha f;

  DROP TEMPORARY TABLE _tmp_alumno_imp;
  DROP TEMPORARY TABLE _tmp_fecha;

  COMMIT;
END //

DELIMITER ;

CALL _seed_eag_grupos();
DROP PROCEDURE _seed_eag_grupos;

-- Resumen post-ejecución
SELECT
  (SELECT COUNT(*) FROM temario      WHERE imparticion_id IN (43,49,50,51,52,53,54,55,57,58,59,60,61,62) AND deleted=0) AS temarios,
  (SELECT COUNT(*) FROM tarea        WHERE imparticion_id = 43 AND deleted=0)                                            AS tareas_imp43,
  (SELECT COUNT(*) FROM entrega      WHERE tarea_id IN (SELECT id FROM tarea WHERE imparticion_id=43) AND deleted=0)     AS entregas_imp43,
  (SELECT COUNT(*) FROM calificacion WHERE entrega_id IN (SELECT id FROM entrega WHERE tarea_id IN (SELECT id FROM tarea WHERE imparticion_id=43))) AS calificaciones_imp43,
  (SELECT COUNT(*) FROM asistencia   WHERE imparticion_id IN (43,49,50,51,52,53,54,55,57,58,59,60,61,62) AND deleted=0)  AS asistencia;
