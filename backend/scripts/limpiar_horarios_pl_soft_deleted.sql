-- Limpia horarios live apuntando a PLs soft-deleted (FK rota lógicamente).
-- Causa: SoftDeleteProcessor de PeriodoLectivo no cascadea a Horario.
START TRANSACTION;

UPDATE horario h
JOIN periodo_lectivo pl ON pl.id = h.periodo_lectivo_id
SET h.deleted = 1
WHERE pl.deleted = 1 AND h.deleted = 0;

SELECT ROW_COUNT() AS horarios_marcados;

COMMIT;
