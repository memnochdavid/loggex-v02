@echo off
setlocal

set "PROJECT_DIR=%~dp0.."
set DC=docker compose --project-directory "%PROJECT_DIR%"
set MINIO_SERVICE=minio
set MINIO_USER=minio_admin
set MINIO_PASSWORD=minio_password
set MINIO_BUCKET=loggex-data
set BACKUP_DIR=minio_backup

echo --- Iniciando copia de seguridad del bucket de MinIO ---

if not exist "%PROJECT_DIR%\%BACKUP_DIR%" mkdir "%PROJECT_DIR%\%BACKUP_DIR%"

docker run --rm --entrypoint=/bin/sh ^
  -v "%PROJECT_DIR%\%BACKUP_DIR%:/backup" ^
  --network loggex-v02_default ^
  minio/mc:latest ^
  -c "mc alias set myminio http://minio:9000 minio_admin minio_password && mc mirror myminio/loggex-data /backup"

if %ERRORLEVEL% EQU 0 (
    echo [OK] Copia de seguridad guardada en '%BACKUP_DIR%'.
) else (
    echo [ERROR] Error durante la copia de seguridad.
    exit /b 1
)
