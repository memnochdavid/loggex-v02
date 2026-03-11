@echo off
setlocal

set MINIO_SERVICE=minio
set MINIO_USER=minio_admin
set MINIO_PASSWORD=minio_password
set MINIO_BUCKET=loggex-data
set BACKUP_DIR=.\minio_backup

echo --- Iniciando restauracion del bucket de MinIO ---

if not exist "%BACKUP_DIR%" (
    echo [ERROR] No existe el directorio '%BACKUP_DIR%'.
    exit /b 1
)

REM Usar un contenedor de MinIO Client (mc) para hacer la restauracion
REM - Montamos el directorio de backup en /backup
REM - Nos conectamos a la red del proyecto para ver el servicio 'minio'
docker run --rm ^
  -v "%cd%\%BACKUP_DIR%:/backup" ^
  --network loggex-v02_default ^
  minio/mc:latest ^
  sh -c " ^
    mc alias set myminio http://%MINIO_SERVICE%:9000 %MINIO_USER% %MINIO_PASSWORD% && ^
    mc mb myminio/%MINIO_BUCKET% --ignore-existing && ^
    mc mirror --overwrite /backup myminio/%MINIO_BUCKET% ^
  "

if %ERRORLEVEL% EQU 0 (
    echo [OK] Restauracion del bucket '%MINIO_BUCKET%' completada desde '%BACKUP_DIR%'.
) else (
    echo [ERROR] Error durante la restauracion.
    exit /b 1
)
