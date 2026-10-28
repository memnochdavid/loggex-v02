@echo off
set "PROJECT_DIR=%~dp0.."
set DC=docker compose --project-directory "%PROJECT_DIR%"

%DC% exec backend php bin/console cache:clear
echo [OK] Cache limpiada
