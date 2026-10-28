@echo off
setlocal EnableDelayedExpansion

set "PROJECT_DIR=%~dp0.."
set DC=docker compose --project-directory "%PROJECT_DIR%"

echo ===============================================
echo    LOGGEX-V02: REPARACION DE ENTORNO LOCAL
echo ===============================================

if exist "%PROJECT_DIR%\backend\.env.local" (
    echo [WARN] Detectado archivo 'backend\.env.local'.
    set /p confirm="?Quieres eliminarlo para usar la configuracion del repo? (s/n): "
    if /i "!confirm!"=="s" (
        del "%PROJECT_DIR%\backend\.env.local"
        echo [OK] backend\.env.local eliminado.
    ) else (
        echo [INFO] Conservando backend\.env.local. Asegurate de que tenga las variables CORS y TRUSTED_PROXIES actualizadas.
    )
)

echo.
echo [DOCKER] Reiniciando contenedores Docker (Build sin cache)...
%DC% down
%DC% build --no-cache
%DC% up -d

echo [WAIT] Esperando a que los servicios arranquen (10s)...
timeout /t 10 /nobreak >nul

echo.
echo [DB] Actualizando esquema de base de datos y cache...
%DC% exec backend php bin/console doctrine:schema:update --force --complete --no-interaction
%DC% exec backend php bin/console cache:clear

echo.
echo [JWT] Verificando claves JWT...
%DC% exec backend php bin/console lexik:jwt:generate-keypair --skip-if-exists

echo.
echo [PERMS] Ajustando permisos de var/ y public/uploads...
%DC% exec backend chmod -R 777 var/ public/uploads/

echo.
echo ===============================================
echo    [OK] ENTORNO REPARADO Y LISTO
echo ===============================================
echo Prueba acceder a:
echo - http://localhost:8888
echo - https://localhost:8443 (Acepta el certificado)
echo.
