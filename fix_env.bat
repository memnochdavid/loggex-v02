@echo off
setlocal EnableDelayedExpansion

echo ===============================================
echo    LOGGEX-V02: REPARACION DE ENTORNO LOCAL
echo ===============================================

REM 1. Limpieza de archivos locales conflictivos
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

REM 2. Reinicio limpio de Docker
echo.
echo [DOCKER] Reiniciando contenedores Docker (Build sin cache)...
docker compose down
docker compose build --no-cache
docker compose up -d

echo [WAIT] Esperando a que los servicios arranquen (10s)...
timeout /t 10 /nobreak >nul

REM 3. Actualizacion de Base de Datos y Cache
echo.
echo [DB] Actualizando esquema de base de datos y cache...
docker compose exec backend php bin/console doctrine:schema:update --force --complete --no-interaction
docker compose exec backend php bin/console cache:clear

REM 4. Verificacion de JWT
echo.
echo [JWT] Verificando claves JWT...
REM Intentamos generar las claves. Si ya existen, el comando fallara o no hara nada (depende de la version),
REM pero aseguramos que existan.
docker compose exec backend php bin/console lexik:jwt:generate-keypair --skip-if-exists

REM 5. Permisos (Opcional pero recomendado en Linux, en Windows no suele ser critico pero no daña)
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
