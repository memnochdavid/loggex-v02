-- Migración: jornadas FP Mañanas (id=3) y FP Tardes (id=6) a tramos de 30min.
-- Doc: hoja-de-ruta-solver-iterativo.md sesión 2026-05-01.
--
-- Borra todos los tramos actuales y los reinserta con granularidad 30min,
-- preservando los recreos en sus horas exactas. Los slots de 60/90min se
-- subdividen en N×30min consecutivos. Total min/día se mantiene idéntico.
--
-- Tras esta migración, los `horario` con horaInicio/horaFin que no coinciden
-- con tramos válidos quedarán huérfanos visualmente (la rejilla los descarta).
-- Como estamos en desarrollo, también vaciamos `horario` para empezar limpio.

START TRANSACTION;

-- 1. Borrar tramos existentes de jornadas 3 y 6.
DELETE FROM jornada_tramo WHERE jornada_tipo_id IN (3, 6);

-- 2. FP Mañanas (id=3): 11 slots × 30min + 2 recreos.
INSERT INTO jornada_tramo (jornada_tipo_id, orden, tipo, hora_inicio, hora_fin, etiqueta) VALUES
(3,  0, 'slot',   '08:30:00', '09:00:00', NULL),
(3,  1, 'slot',   '09:00:00', '09:30:00', NULL),
(3,  2, 'slot',   '09:30:00', '10:00:00', NULL),
(3,  3, 'slot',   '10:00:00', '10:30:00', NULL),
(3,  4, 'recreo', '10:30:00', '10:50:00', NULL),
(3,  5, 'slot',   '10:50:00', '11:20:00', NULL),
(3,  6, 'slot',   '11:20:00', '11:50:00', NULL),
(3,  7, 'slot',   '11:50:00', '12:20:00', NULL),
(3,  8, 'slot',   '12:20:00', '12:50:00', NULL),
(3,  9, 'recreo', '12:50:00', '13:00:00', NULL),
(3, 10, 'slot',   '13:00:00', '13:30:00', NULL),
(3, 11, 'slot',   '13:30:00', '14:00:00', NULL),
(3, 12, 'slot',   '14:00:00', '14:30:00', NULL);

-- 3. FP Tardes (id=6): 12 slots × 30min + 2 recreos.
INSERT INTO jornada_tramo (jornada_tipo_id, orden, tipo, hora_inicio, hora_fin, etiqueta) VALUES
(6,  0, 'slot',   '15:00:00', '15:30:00', NULL),
(6,  1, 'slot',   '15:30:00', '16:00:00', NULL),
(6,  2, 'slot',   '16:00:00', '16:30:00', NULL),
(6,  3, 'slot',   '16:30:00', '17:00:00', NULL),
(6,  4, 'recreo', '17:00:00', '17:20:00', NULL),
(6,  5, 'slot',   '17:20:00', '17:50:00', NULL),
(6,  6, 'slot',   '17:50:00', '18:20:00', NULL),
(6,  7, 'slot',   '18:20:00', '18:50:00', NULL),
(6,  8, 'slot',   '18:50:00', '19:20:00', NULL),
(6,  9, 'recreo', '19:20:00', '19:30:00', NULL),
(6, 10, 'slot',   '19:30:00', '20:00:00', NULL),
(6, 11, 'slot',   '20:00:00', '20:30:00', NULL),
(6, 12, 'slot',   '20:30:00', '21:00:00', NULL),
(6, 13, 'slot',   '21:00:00', '21:30:00', NULL);

-- 4. Limpiar horarios persistidos (entorno desarrollo): los de 60/90min
--    no encajarán con tramos de 30min. El usuario regenerará desde el editor.
DELETE FROM horario;

COMMIT;

-- Verificación.
SELECT jt.id AS jornada, jt.nombre, COUNT(jtt.id) AS total_tramos,
       SUM(CASE WHEN jtt.tipo = 'slot' THEN 1 ELSE 0 END) AS slots,
       SUM(CASE WHEN jtt.tipo = 'recreo' THEN 1 ELSE 0 END) AS recreos
FROM jornada_tipo jt
JOIN jornada_tramo jtt ON jtt.jornada_tipo_id = jt.id
WHERE jt.id IN (3, 6)
GROUP BY jt.id, jt.nombre
ORDER BY jt.id;

SELECT COUNT(*) AS horarios_remaining FROM horario;
