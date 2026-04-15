@echo off
setlocal

:: Usar la ruta UNC directa (Docker Desktop soporta \\wsl$ nativo)
set "PROJECT_DIR=%~dp0.."
set DC=docker compose --project-directory "%PROJECT_DIR%"
set BACKUP_FILE=backup_tfg_full.sql

if not exist "%PROJECT_DIR%\%BACKUP_FILE%" (
    echo [ERROR] El archivo '%BACKUP_FILE%' no existe en la raiz del proyecto.
    exit /b 1
)

echo [DB] Iniciando restauracion de base de datos desde '%BACKUP_FILE%'...

type "%PROJECT_DIR%\%BACKUP_FILE%" | %DC% exec -T database mariadb -u app_user -papp_password app_db

if %ERRORLEVEL% EQU 0 (
    echo [OK] Base de datos restaurada correctamente.
) else (
    echo [ERROR] Error al restaurar la base de datos.
    exit /b 1
)
