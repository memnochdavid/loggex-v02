-- Seed de imparticiones para DAW 1º (grupo_id=1) y DAW 2º (grupo_id=2)
-- centro_id=3 (Escuela Arte Granada) · itinerario_id=3 (DAW) · jornada_id=3 (FP
-- Mañanas, slots mixtos 1h+1h+1h+1h+1h30 → 5h30/día = 27h30/sem).
--
-- Reparto equilibrado entre los 7 docentes del centro (ids 50..56), 5-10 h/sem
-- por profe, agrupando materias por afinidad temática. Excluye proyecto (m11)
-- y FCT (m13) porque tienen horasSemanales=0 y el solver las omite.
--
-- Carga DAW 1º (27 h/sem) + DAW 2º (28 h/sem) = 55 h/sem entre 7 profes.
--   Alberto (50)  Sist. Info (5h) + Despliegue (5h)   = 10 h · sistemas/infra
--   Joaquín (51)  Bases de Datos (5h)                 =  5 h · BD
--   José (52)     Programación (7h)                   =  7 h · programación
--   Walter (53)   Lenguajes (4h) + Web cliente (6h)   = 10 h · cadena frontend
--   Clara (54)    Entornos (3h) + Diseño interf. (6h) =  9 h · UI/herramientas
--   Sara (55)     FOL (3h) + Empresa (3h)             =  6 h · FOL/EIE (combo típico)
--   María (56)    Desarrollo web servidor (8h)        =  8 h · backend
--
-- Ejecutar (idempotente — borra previas):
--   docker compose exec -T database mariadb -u app_user -papp_password app_db < scripts/seed_imparticiones_daw.sql

START TRANSACTION;

-- Limpieza idempotente: horarios ligados primero (FK estricta), luego imparticiones.
DELETE FROM horario WHERE imparticion_id IN (SELECT id FROM imparticion WHERE grupo_id IN (1, 2));
DELETE FROM imparticion WHERE grupo_id IN (1, 2);

INSERT INTO imparticion (deleted, profesor_id, materia_id, grupo_id, created_at) VALUES
  -- DAW 1º (grupo 1) — materias 1..6, 27 h/sem
  (0, 50,  1, 1, NOW()),  -- Alberto  → Sistemas informáticos             (5h)
  (0, 51,  2, 1, NOW()),  -- Joaquín  → Bases de Datos                    (5h)
  (0, 52,  3, 1, NOW()),  -- José     → Programación                      (7h)
  (0, 53,  4, 1, NOW()),  -- Walter   → Lenguajes de marcas               (4h)
  (0, 54,  5, 1, NOW()),  -- Clara    → Entornos de desarrollo            (3h)
  (0, 55,  6, 1, NOW()),  -- Sara     → Formación y Orientación Laboral   (3h)

  -- DAW 2º (grupo 2) — materias 7,8,9,10,12 (omitidos m11/m13 con 0h), 28 h/sem
  (0, 53,  7, 2, NOW()),  -- Walter   → Desarrollo web en entorno cliente (6h)
  (0, 56,  8, 2, NOW()),  -- María    → Desarrollo web en entorno servidor (8h)
  (0, 50,  9, 2, NOW()),  -- Alberto  → Despliegue de aplicaciones web    (5h)
  (0, 54, 10, 2, NOW()),  -- Clara    → Diseño de interfaces web          (6h)
  (0, 55, 12, 2, NOW());  -- Sara     → Empresa e iniciativa emprendedora (3h)

COMMIT;

-- ─── Verificación ──────────────────────────────────────────────────────────

-- 11 imparticiones (6 DAW1 + 5 DAW2)
SELECT
  g.curso,
  g.abreviatura       AS grupo,
  CONCAT(u.nombre, ' ', u.apellidos) AS profe,
  m.codigo_oficial    AS cod,
  m.nombre            AS materia,
  m.horas_semanales   AS h_sem
FROM imparticion i
JOIN grupo   g ON i.grupo_id    = g.id
JOIN usuario u ON i.profesor_id = u.id
JOIN materia m ON i.materia_id  = m.id
WHERE i.grupo_id IN (1, 2)
  AND i.deleted = 0
ORDER BY g.curso, m.codigo_oficial;

-- Carga total por profe (debe ir de 5 a 10 h/sem, suma 55)
SELECT
  CONCAT(u.nombre, ' ', SUBSTRING_INDEX(u.apellidos, ' ', 1)) AS profe,
  COUNT(*)                AS imparticiones,
  SUM(m.horas_semanales)  AS h_sem
FROM imparticion i
JOIN usuario u ON i.profesor_id = u.id
JOIN materia m ON i.materia_id  = m.id
WHERE i.grupo_id IN (1, 2)
  AND i.deleted = 0
GROUP BY u.id
ORDER BY h_sem DESC, profe;
