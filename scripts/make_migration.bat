@echo off
set "PROJECT_DIR=%~dp0.."
set DC=docker compose --project-directory "%PROJECT_DIR%"

rem Genera una nueva migracion a partir del diff entre entidades Doctrine y el esquema actual.
rem No aplica nada: solo crea el archivo. Despues revisalo y aplicalo con migrate.bat.

echo [MIG] Generando nueva migracion Doctrine (diff contra la BD)...
%DC% exec backend php bin/console doctrine:migrations:diff --no-interaction

echo.
echo [OK] Archivo creado en backend/migrations/. Revisalo antes de aplicarlo.
echo [TIP] Si el diff esta vacio, el esquema ya esta sincronizado.
echo [TIP] Para aplicar migraciones pendientes: scripts\migrate.bat
