@echo off
setlocal

REM Nombre del archivo de backup
set BACKUP_FILE=backup_tfg_full.sql

echo [DB] Iniciando copia de seguridad de la base de datos...

REM Ejecutar mysqldump dentro del contenedor
docker compose exec database mysqldump -u app_user -papp_password app_db > "%BACKUP_FILE%"

if %ERRORLEVEL% EQU 0 (
    echo [OK] Copia de seguridad guardada en '%BACKUP_FILE%'.
) else (
    echo [ERROR] Error al realizar la copia de seguridad.
    exit /b 1
)
