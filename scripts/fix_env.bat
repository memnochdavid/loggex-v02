@echo off
setlocal EnableDelayedExpansion
cd /d "%~dp0\.."

echo ===============================================
echo    LOGGEX-V02: REPARACION DE ENTORNO LOCAL
echo ===============================================

if exist "backend\.env.local" (
    echo [WARN] Detectado archivo 'backend\.env.local'.
    set /p confirm="?Quieres eliminarlo para usar la configuracion del repo? (s/n): "
    if /i "!confirm!"=="s" (
        del backend\.env.local
        echo [OK] backend\.env.local eliminado.
    ) else (
        echo [INFO] Conservando backend\.env.local. Asegurate de que tenga las variables CORS y TRUSTED_PROXIES actualizadas.
    )
)

echo.
echo [DOCKER] Reiniciando contenedores Docker (Build sin cache)...
docker compose down
docker compose build --no-cache
docker compose up -d

echo [WAIT] Esperando a que los servicios arranquen (10s)...
timeout /t 10 /nobreak >nul

echo.
echo [DB] Actualizando esquema de base de datos y cache...
docker compose exec backend php bin/console doctrine:schema:update --force --complete --no-interaction
docker compose exec backend php bin/console cache:clear

echo.
echo [JWT] Verificando claves JWT...
docker compose exec backend php bin/console lexik:jwt:generate-keypair --skip-if-exists

echo.
echo [PERMS] Ajustando permisos de var/ y public/uploads...
docker compose exec backend chmod -R 777 var/ public/uploads/

echo.
echo ===============================================
echo    [OK] ENTORNO REPARADO Y LISTO
echo ===============================================
echo Prueba acceder a:
echo - http://localhost:8888
echo - https://localhost:8443 (Acepta el certificado)
echo.
