@echo off
setlocal

:: Usar la ruta UNC directa (Docker Desktop soporta \\wsl$ nativo)
set "PROJECT_DIR=%~dp0.."
set DC=docker compose --project-directory "%PROJECT_DIR%"
set MINIO_SERVICE=minio
set MINIO_USER=minio_admin
set MINIO_PASSWORD=minio_password
set MINIO_BUCKET=loggex-data
set BACKUP_DIR=minio_backup

echo --- Iniciando restauracion del bucket de MinIO ---

if not exist "%PROJECT_DIR%\%BACKUP_DIR%" (
    echo [ERROR] No existe el directorio '%BACKUP_DIR%'.
    exit /b 1
)

echo Montando volumen: %PROJECT_DIR%\%BACKUP_DIR%

docker run --rm --entrypoint=/bin/sh ^
  -v "%PROJECT_DIR%\%BACKUP_DIR%:/backup" ^
  --network loggex-v02_default ^
  minio/mc:latest ^
  -c "mc alias set myminio http://minio:9000 minio_admin minio_password && mc mb myminio/loggex-data --ignore-existing && mc mirror --overwrite /backup myminio/loggex-data"

if %ERRORLEVEL% EQU 0 (
    echo [OK] Restauracion del bucket '%MINIO_BUCKET%' completada desde '%BACKUP_DIR%'.
) else (
    echo [ERROR] Error durante la restauracion.
    exit /b 1
)
