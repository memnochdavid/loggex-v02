@echo off
setlocal

set "PROJECT_DIR=%~dp0.."
set DC=docker compose --project-directory "%PROJECT_DIR%"
set BACKUP_FILE=backup_tfg_full.sql

echo [DB] Iniciando copia de seguridad de la base de datos...

%DC% exec database mysqldump -u app_user -papp_password app_db > "%PROJECT_DIR%\%BACKUP_FILE%"

if %ERRORLEVEL% EQU 0 (
    echo [OK] Copia de seguridad guardada en '%BACKUP_FILE%'.
) else (
    echo [ERROR] Error al realizar la copia de seguridad.
    exit /b 1
)
