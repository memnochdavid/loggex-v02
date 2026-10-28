@echo off
set "PROJECT_DIR=%~dp0.."
set DC=docker compose --project-directory "%PROJECT_DIR%"

echo [DB] Forzando actualizacion del esquema de base de datos...
%DC% exec backend php bin/console doctrine:schema:update --force --complete --no-interaction
echo [CACHE] Limpiando cache...
%DC% exec backend php bin/console cache:clear
echo [OK] Listo. La base de datos deberia estar sincronizada con las entidades.
