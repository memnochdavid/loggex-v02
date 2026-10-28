@echo off
set "PROJECT_DIR=%~dp0.."
set DC=docker compose --project-directory "%PROJECT_DIR%"

rem Aplica todas las migraciones Doctrine pendientes y limpia la cache.

echo [MIG] Estado de migraciones actual:
%DC% exec backend php bin/console doctrine:migrations:status

echo.
echo [MIG] Aplicando migraciones pendientes...
%DC% exec backend php bin/console doctrine:migrations:migrate --no-interaction --allow-no-migration

echo.
echo [CACHE] Limpiando cache (hard + restart)...
%DC% exec backend sh -c "rm -rf var/cache/dev var/cache/prod"
%DC% exec backend php bin/console cache:clear
%DC% restart backend

echo.
echo [OK] Migraciones aplicadas y backend reiniciado.
