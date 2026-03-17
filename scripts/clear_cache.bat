@echo off
cd /d "%~dp0\.."

docker compose exec backend php bin/console cache:clear
echo [OK] Cache limpiada
