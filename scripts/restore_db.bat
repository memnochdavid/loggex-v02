@echo off
setlocal
cd /d "%~dp0\.."

set BACKUP_FILE=backup_tfg_full.sql

if not exist "%BACKUP_FILE%" (
    echo [ERROR] El archivo '%BACKUP_FILE%' no existe en la raiz del proyecto.
    exit /b 1
)

echo [DB] Iniciando restauracion de base de datos desde '%BACKUP_FILE%'...

type "%BACKUP_FILE%" | docker compose exec -T database mariadb -u app_user -papp_password app_db

if %ERRORLEVEL% EQU 0 (
    echo [OK] Base de datos restaurada correctamente.
) else (
    echo [ERROR] Error al restaurar la base de datos.
    exit /b 1
)
