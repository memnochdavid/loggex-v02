-- Seed de imparticiones para DAW 1º (grupo_id=1) y DAW 2º (grupo_id=2)
-- centro_id = 3 (EAG), itinerario_id = 3 (DAW), curso 2026-2027 / 2025-2026.
--
-- Reparto: cada profe del centro lleva 1-2 materias para cubrir las 13
-- materias del itinerario sin que ningún profe supere ~11 h/sem.
--
-- Ejecutar:
--   sudo docker compose exec -T database mariadb -u app_user -papp_password app_db < scripts/seed_imparticiones_daw.sql
--
-- Si ya existen imparticiones para estos grupos y se quiere re-seedear:
--   DELETE FROM imparticion WHERE grupo_id IN (1, 2);
-- (cuidado: si hay horarios apuntando a estas imparticiones, primero
-- DELETE FROM horario WHERE imparticion_id IN (SELECT id FROM imparticion WHERE grupo_id IN (1,2));

START TRANSACTION;

-- DAW 1º (grupo_id=1) — materias del 1er curso (ids 1..6, 27 h/sem)
INSERT INTO imparticion (deleted, profesor_id, materia_id, grupo_id) VALUES
  (0, 50, 1, 1),  -- Alberto Núñez   → Sistemas informáticos       (5h)
  (0, 51, 2, 1),  -- Joaquín Suarez  → Bases de Datos              (5h)
  (0, 52, 3, 1),  -- José Pérez      → Programación                (7h)
  (0, 53, 4, 1),  -- Walter Donovan  → Lenguajes de marcas         (4h)
  (0, 54, 5, 1),  -- Clara Gutiérrez → Entornos de desarrollo      (3h)
  (0, 55, 6, 1);  -- Sara Alberti    → FOL                         (3h)

-- DAW 2º (grupo_id=2) — materias del 2º curso (ids 7..13, 28 h/sem)
INSERT INTO imparticion (deleted, profesor_id, materia_id, grupo_id) VALUES
  (0, 53,  7, 2),  -- Walter Donovan  → Desarrollo web cliente      (6h)
  (0, 54,  8, 2),  -- Clara Gutiérrez → Desarrollo web servidor     (8h)
  (0, 50,  9, 2),  -- Alberto Núñez   → Despliegue de aplicaciones  (5h)
  (0, 51, 10, 2),  -- Joaquín Suarez  → Diseño de interfaces web    (6h)
  (0, 56, 11, 2),  -- María Cordero   → Proyecto                    (0h)
  (0, 52, 12, 2),  -- José Pérez      → Empresa e iniciativa        (3h)
  (0, 56, 13, 2);  -- María Cordero   → FCT                         (0h)

COMMIT;

-- Verificación: 13 imparticiones (6 + 7), repartidas entre 7 profesores.
SELECT
  g.curso,
  g.abreviatura AS grupo,
  u.nombre AS profe,
  m.nombre AS materia,
  m.horas_semanales AS h
FROM imparticion i
JOIN grupo g    ON i.grupo_id    = g.id
JOIN usuario u  ON i.profesor_id = u.id
JOIN materia m  ON i.materia_id  = m.id
WHERE i.grupo_id IN (1, 2)
  AND i.deleted = 0
ORDER BY g.curso, m.codigo_oficial;

-- Carga total por profe:
SELECT u.nombre, SUM(m.horas_semanales) AS h_sem
FROM imparticion i
JOIN usuario u ON i.profesor_id = u.id
JOIN materia m ON i.materia_id  = m.id
WHERE i.grupo_id IN (1, 2)
  AND i.deleted = 0
GROUP BY u.id, u.nombre
ORDER BY h_sem DESC;
