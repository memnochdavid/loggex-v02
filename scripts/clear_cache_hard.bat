@echo off
cd /d "%~dp0\.."

echo [CACHE] Limpiando cache a fondo...
docker compose exec backend rm -rf var/cache/dev
docker compose exec backend rm -rf var/cache/prod
docker compose exec backend php bin/console cache:clear
echo [OK] Cache eliminada.
