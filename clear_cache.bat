@echo off
docker compose exec backend php bin/console cache:clear
echo [OK] Cache limpiada
