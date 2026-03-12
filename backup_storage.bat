@echo off
setlocal

set MINIO_SERVICE=minio
set MINIO_USER=minio_admin
set MINIO_PASSWORD=minio_password
set MINIO_BUCKET=loggex-data
set BACKUP_DIR=minio_backup

echo --- Iniciando copia de seguridad del bucket de MinIO ---

REM 1. Crear directorio de backup si no existe
if not exist "%BACKUP_DIR%" mkdir "%BACKUP_DIR%"

REM 2. Usar un contenedor de MinIO Client (mc) para hacer la copia
REM    - Sobrescribimos el ENTRYPOINT para poder ejecutar comandos de shell
docker run --rm --entrypoint=/bin/sh ^
  -v "%cd%\%BACKUP_DIR%:/backup" ^
  --network loggex-v02_default ^
  minio/mc:latest ^
  -c "mc alias set myminio http://minio:9000 minio_admin minio_password && mc mirror myminio/loggex-data /backup"

if %ERRORLEVEL% EQU 0 (
    echo [OK] Copia de seguridad guardada en '%BACKUP_DIR%'.
) else (
    echo [ERROR] Error durante la copia de seguridad.
    exit /b 1
)
