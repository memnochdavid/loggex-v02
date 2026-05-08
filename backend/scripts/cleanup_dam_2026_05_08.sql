-- ==========================================================================
-- Loggex — Limpieza selectiva del itinerario DAM (id=5) y todo lo dependiente
-- ==========================================================================
-- Fecha: 2026-05-08
-- Motivo: dejar la BD en un estado mínimo (solo DAW vivo) para validar el
-- flujo nuevo de "crear DAM desde catálogo + asignar materias compartidas
-- con DAW vía /admin/itinerarios → BookOpen → 'Añadir materia existente'".
--
-- Conserva intactos:
--   - centro, usuario, provincia, jornada_tipo, jornada_tramo, festivo,
--     calendario_escolar_ccaa, personalizacion, tema_visual, catalogo_*
--   - itinerario DAW (id=3) con sus 2 grupos (1, 2) y todo su árbol
--   - mensaje, comunicado, notificacion (no dependen de itinerario)
--
-- Borra:
--   - itinerario DAM (id=5) + sus 2 grupos (3, 4) + cadena descendente
--     (matrículas, imparticiones, horarios, PLs, PLIs, tareas, entregas,
--     calificaciones, asistencias, temarios, ponderaciones, periodos
--     evaluativos)
--   - 24 materias EXCLUSIVAS de DAM. Las 5 materias COMPARTIDAS con DAW
--     (ids 1, 3, 4, 5, 6) sobreviven, sólo se eliminan sus filas en
--     materia_itinerario que ataban a DAM.
--
-- Total esperado: 1 791 filas borradas.
--
-- Backup recomendado: ya hecho por el usuario antes de lanzar.
-- ==========================================================================

START TRANSACTION;

-- ⚠️ Orden FK-safe: hijas → padres.

-- 1) Calificaciones de entregas de tareas de imparticiones DAM     (esperado: 319)
DELETE FROM calificacion
 WHERE entrega_id IN (
   SELECT id FROM entrega WHERE tarea_id IN (
     SELECT id FROM tarea WHERE imparticion_id IN (
       SELECT id FROM imparticion WHERE grupo_id IN (3, 4)
     )
   )
 );

-- 2) Asistencias                                                     (esperado: 375)
DELETE FROM asistencia
 WHERE imparticion_id IN (SELECT id FROM imparticion WHERE grupo_id IN (3, 4));

-- 3) Entregas                                                        (esperado: 319)
DELETE FROM entrega
 WHERE tarea_id IN (
   SELECT id FROM tarea WHERE imparticion_id IN (
     SELECT id FROM imparticion WHERE grupo_id IN (3, 4)
   )
 );

-- 4) Tareas                                                          (esperado: 90)
DELETE FROM tarea
 WHERE imparticion_id IN (SELECT id FROM imparticion WHERE grupo_id IN (3, 4));

-- 5) Temarios                                                        (esperado: 45)
DELETE FROM temario
 WHERE imparticion_id IN (SELECT id FROM imparticion WHERE grupo_id IN (3, 4));

-- 6) Ponderaciones                                                   (esperado: 45)
DELETE FROM ponderacion_imparticion
 WHERE imparticion_id IN (SELECT id FROM imparticion WHERE grupo_id IN (3, 4));

-- 7) Horarios                                                        (esperado: 66)
DELETE FROM horario
 WHERE imparticion_id IN (SELECT id FROM imparticion WHERE grupo_id IN (3, 4));

-- 8) PLIs (PeriodoLectivoImparticion)                                (esperado: 143)
DELETE FROM periodo_lectivo_imparticion
 WHERE imparticion_id IN (SELECT id FROM imparticion WHERE grupo_id IN (3, 4));

-- 9) Periodos lectivos                                               (esperado: 20)
DELETE FROM periodo_lectivo WHERE grupo_id IN (3, 4);

-- 10) Periodos evaluativos                                           (esperado: 8)
DELETE FROM periodo_evaluativo WHERE grupo_id IN (3, 4);

-- 11) Matrículas                                                     (esperado: 10)
DELETE FROM matricula WHERE grupo_id IN (3, 4);

-- 12) Imparticiones                                                  (esperado: 26)
DELETE FROM imparticion WHERE grupo_id IN (3, 4);

-- 13) Grupos                                                         (esperado: 2)
DELETE FROM grupo WHERE id IN (3, 4);

-- 14) Asociaciones materia↔itinerario para itinerario 5              (esperado: 29)
--     Esto desvincula las 24 materias exclusivas + 5 compartidas
--     (las compartidas siguen vivas con su asociación a DAW).
DELETE FROM materia_itinerario WHERE itinerario_id = 5;

-- 15) Materias huérfanas (sin ningún itinerario tras el paso 14)     (esperado: 24)
DELETE FROM materia
 WHERE id NOT IN (SELECT DISTINCT materia_id FROM materia_itinerario);

-- 16) Itinerario DAM                                                 (esperado: 1)
DELETE FROM itinerario WHERE id = 5;

COMMIT;

-- ==========================================================================
-- AUTO_INCREMENT reset (DDL, fuera de la transacción).
-- Calculado a partir de max(id) actual + 1 en cada tabla afectada.
-- ==========================================================================

ALTER TABLE itinerario                  AUTO_INCREMENT = 7;
ALTER TABLE grupo                       AUTO_INCREMENT = 3;
ALTER TABLE materia                     AUTO_INCREMENT = 80;
ALTER TABLE imparticion                 AUTO_INCREMENT = 44;
ALTER TABLE matricula                   AUTO_INCREMENT = 12;
ALTER TABLE periodo_lectivo             AUTO_INCREMENT = 325;
ALTER TABLE periodo_evaluativo          AUTO_INCREMENT = 9;
ALTER TABLE horario                     AUTO_INCREMENT = 5020;
ALTER TABLE periodo_lectivo_imparticion AUTO_INCREMENT = 2397;
ALTER TABLE tarea                       AUTO_INCREMENT = 178;
ALTER TABLE entrega                     AUTO_INCREMENT = 639;
ALTER TABLE calificacion                AUTO_INCREMENT = 639;
ALTER TABLE asistencia                  AUTO_INCREMENT = 746;
ALTER TABLE temario                     AUTO_INCREMENT = 43;
ALTER TABLE ponderacion_imparticion     AUTO_INCREMENT = 43;

-- ==========================================================================
-- Verificación post-ejecución (lanza opcionalmente para confirmar).
-- ==========================================================================
-- SELECT 'itinerarios vivos' AS qué, COUNT(*) AS n FROM itinerario WHERE deleted = 0
-- UNION ALL SELECT 'grupos', COUNT(*) FROM grupo WHERE deleted = 0
-- UNION ALL SELECT 'materias', COUNT(*) FROM materia WHERE deleted = 0
-- UNION ALL SELECT 'asociaciones M:N', COUNT(*) FROM materia_itinerario;
