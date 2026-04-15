@echo off
set "PROJECT_DIR=%~dp0.."
set DC=docker compose --project-directory "%PROJECT_DIR%"

echo [CACHE] Limpiando cache a fondo...
%DC% exec backend rm -rf var/cache/dev
%DC% exec backend rm -rf var/cache/prod
%DC% exec backend php bin/console cache:clear
echo [OK] Cache eliminada.
