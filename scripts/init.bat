@echo off
setlocal

:: Usar la ruta UNC directa (Docker Desktop soporta \\wsl$ nativo)
:: NO usar pushd porque crea unidades temporales que Docker no puede mapear
set "PROJECT_DIR=%~dp0.."
set DC=docker compose --project-directory "%PROJECT_DIR%"

echo === Inicializando Loggex v02 ===

REM 1. Levantar contenedores
echo Levantando contenedores Docker...
%DC% up -d --build
IF %ERRORLEVEL% NEQ 0 ( echo Error al levantar contenedores & exit /b %ERRORLEVEL% )

REM 2. Instalar dependencias Backend
echo Instalando dependencias de Symfony (Composer)...

REM Configuracion para mejorar la estabilidad de red y memoria
%DC% exec backend composer config --global process-timeout 2000
%DC% exec backend composer config --global optimize-autoloader true

REM Intento 1
echo [Intento 1] Ejecutando composer install...
%DC% exec -e COMPOSER_MEMORY_LIMIT=-1 -e COMPOSER_IPRESOLVE=4 backend composer install --no-interaction --no-scripts --prefer-dist
IF %ERRORLEVEL% EQU 0 GOTO :FRONTEND

REM Intento 2 (Retry)
echo [Intento 1 fallo] Reintentando en 5 segundos...
timeout /t 5 /nobreak >nul
echo [Intento 2] Ejecutando composer install...
%DC% exec -e COMPOSER_MEMORY_LIMIT=-1 -e COMPOSER_IPRESOLVE=4 backend composer install --no-interaction --no-scripts --prefer-dist
IF %ERRORLEVEL% EQU 0 GOTO :FRONTEND

REM Intento 3 (Last Retry)
echo [Intento 2 fallo] Reintentando en 5 segundos...
timeout /t 5 /nobreak >nul
echo [Intento 3] Ejecutando composer install...
%DC% exec -e COMPOSER_MEMORY_LIMIT=-1 -e COMPOSER_IPRESOLVE=4 backend composer install --no-interaction --no-scripts --prefer-dist
IF %ERRORLEVEL% NEQ 0 ( echo Error critico en composer install tras 3 intentos & exit /b %ERRORLEVEL% )

:FRONTEND
REM 3. Instalar dependencias Frontend
echo Instalando dependencias de React (NPM)...
%DC% exec frontend npm install
IF %ERRORLEVEL% NEQ 0 ( echo Error en npm install & exit /b %ERRORLEVEL% )

REM 4. Preparar Base de Datos (si hay migraciones)
echo Ejecutando migraciones de base de datos...
REM Esperar un poco a que la BD esté lista
timeout /t 10 /nobreak
%DC% exec backend php bin/console doctrine:migrations:migrate --no-interaction --allow-no-migration
IF %ERRORLEVEL% NEQ 0 ( echo Error en migraciones & exit /b %ERRORLEVEL% )

echo.
echo === Proyecto listo! ===
echo Frontend: https://localhost:8443
echo Backend: https://localhost:9443/api/hello

