#!/bin/bash
echo "Arreglando fechas nulas..."
docker compose exec database mariadb -u app_user -papp_password app_db -e "
UPDATE centro SET created_at = NOW() WHERE created_at IS NULL;
UPDATE usuario SET created_at = NOW() WHERE created_at IS NULL;
UPDATE ciclo_formativo SET created_at = NOW() WHERE created_at IS NULL;
UPDATE grupo SET created_at = NOW() WHERE created_at IS NULL;
UPDATE modulo SET created_at = NOW() WHERE created_at IS NULL;
UPDATE matricula SET created_at = NOW() WHERE created_at IS NULL;
"
echo "Fechas arregladas."
