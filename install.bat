@echo off
setlocal enabledelayedexpansion

:: =============================================================================
:: Loggex v02 — Install Script (post-clone, one-shot)
::
:: Uso: tras git clone, ejecutar desde la raíz del repo:
::   install.bat
::
:: Deja el proyecto listo para funcionar en la rama develop.
:: =============================================================================

set "PROJECT_DIR=%~dp0.."
set "DC=docker compose --project-directory %PROJECT_DIR%"

echo.
echo ==============================================
echo   LOGGEX v02 — Instalación post-clone
echo ==============================================
echo.

:: ── Requisitos del sistema ───────────────────────────────────────────────────
echo Requisitos del sistema:
echo   Docker Desktop para Windows ............ requerido
echo   Docker Compose (plugin v2) ............. requerido
echo.
echo   NO se requiere en el host: PHP, Composer, Node.js, npm, MariaDB
echo   (todo se ejecuta dentro de contenedores Docker)
echo.

:: Verificar dependencias
set "MISSING=0"

docker --version >nul 2>&1
IF !ERRORLEVEL! EQU 0 (
    for /f "tokens=3" %%v in ('docker --version 2^>nul') do echo ✅ Docker %%v
) else (
    echo ⚠️  Docker NO encontrado — instala Docker Desktop: https://www.docker.com/products/docker-desktop/
    set "MISSING=1"
)

docker compose version >nul 2>&1
IF !ERRORLEVEL! EQU 0 (
    for /f "tokens=4" %%v in ('docker compose version 2^>nul') do echo ✅ Docker Compose %%v
) else (
    echo ⚠️  Docker Compose NO encontrado — viene con Docker Desktop
    set "MISSING=1"
)

:: Verificar estructura del repo
echo.
IF EXIST "%PROJECT_DIR%\docker-compose.yml" (
    IF EXIST "%PROJECT_DIR%\backend" (
        IF EXIST "%PROJECT_DIR%\frontend" (
            echo ✅ Estructura del repo OK (docker-compose.yml, backend\, frontend\)
        ) else (
            echo Error: directorio frontend\ no encontrado & goto :FAIL
        )
    ) else (
        echo Error: directorio backend\ no encontrado & goto :FAIL
    )
) else (
    echo Error: docker-compose.yml no encontrado & goto :FAIL
)

:: Si falta algo crítico, abortar
IF "%MISSING%"=="1" (
    echo.
    echo Faltan dependencias del sistema. Instálalas y vuelve a ejecutar este script.
    exit /b 1
)

:: Confirmación
echo.
echo El script realizará las siguientes acciones:
echo   1. Levantar contenedores (build + up)
echo   2. Restaurar BD desde backup_tfg_full.sql (si existe)
echo   3. Restaurar storage desde minio_backup\ (si existe)
echo   4. Instalar dependencias backend (composer install)
echo   5. Generar claves JWT
echo   6. Aplicar migraciones Doctrine
echo   7. Instalar dependencias frontend (npm install)
echo   8. Reiniciar backend
echo.
set /p "confirm=¿Continuar? (s/N): "
IF /I NOT "!confirm!"=="s" (
    IF /I NOT "!confirm!"=="si" (
        echo Cancelado.
        exit /b 0
    )
)

:: ── 1. Levantar contenedores ─────────────────────────────────────────────────
echo.
echo ℹ️  Levantando contenedores Docker (build + up)...
%DC% up -d --build --remove-orphans
IF !ERRORLEVEL! NEQ 0 ( echo Error al levantar contenedores & exit /b !ERRORLEVEL! )
echo ✅ Contenedores en marcha

:: ── 2. Esperar a que MariaDB esté lista ──────────────────────────────────────
echo.
echo ℹ️  Esperando a que MariaDB esté lista...
for /l %%i in (1,1,30) do (
    %DC% exec -T database mariadb -u app_user -papp_password app_db -e "SELECT 1" >nul 2>&1
    IF !ERRORLEVEL! EQU 0 (
        echo ✅ MariaDB lista (%%i intentos)
        goto :DB_OK
    )
    timeout /t 2 /nobreak >nul
)
echo Error: MariaDB no respondió tras 30 intentos & exit /b 1

:DB_OK
echo ℹ️  Esperando a que MinIO esté listo...
for /l %%i in (1,1,15) do (
    %DC% exec -T minio mc alias set myminio http://localhost:9000 minio_admin minio_password >nul 2>&1
    IF !ERRORLEVEL! EQU 0 (
        echo ✅ MinIO listo (%%i intentos)
        goto :MINIO_OK
    )
    timeout /t 2 /nobreak >nul
)
echo Error: MinIO no respondió tras 15 intentos & exit /b 1

:MINIO_OK
:: ── 3. Configurar MinIO + restaurar storage ──────────────────────────────────
echo.
echo ℹ️  Configurando bucket MinIO 'loggex-data'...
:: Detectar red Docker (fallback al nombre predecible)
set "NETWORK="
for /f "tokens=*" %%n in ('docker network ls -q --filter name^=loggex-v02_default') do (
    IF "!NETWORK!"=="" set "NETWORK=%%n"
)
IF "!NETWORK!"=="" set "NETWORK=loggex-v02_default"

docker run --rm --network "!NETWORK!" minio/mc alias set myminio http://minio:9000 minio_admin minio_password >nul 2>&1
docker run --rm --network "!NETWORK!" minio/mc mb --ignore-existing myminio/loggex-data >nul 2>&1
echo ✅ Bucket 'loggex-data' creado

IF EXIST "%PROJECT_DIR%\minio_backup" (
    echo ℹ️  Restaurando archivos desde minio_backup\...
    call "%PROJECT_DIR%\scripts\restore_storage.bat"
    IF !ERRORLEVEL! NEQ 0 ( echo Warning: restore_storage fallo, continuando... )
    echo ✅ Storage restaurado
) else (
    echo ⚠️  minio_backup\ no encontrado — bucket vacío
)

:: ── 4. Restaurar BD desde backup ─────────────────────────────────────────────
echo.
IF EXIST "%PROJECT_DIR%\backup_tfg_full.sql" (
    echo ℹ️  Restaurando base de datos desde backup_tfg_full.sql...
    call "%PROJECT_DIR%\scripts\restore_db.bat"
    IF !ERRORLEVEL! NEQ 0 ( echo Warning: restore_db fallo, continuando... )
    echo ✅ Base de datos restaurada
) else (
    echo ⚠️  backup_tfg_full.sql no encontrado — BD vacía
)

:: ── 5. Instalar dependencias Backend (Composer) ──────────────────────────────
echo.
echo ℹ️  Instalando dependencias de Symfony (composer install)...
%DC% exec -T backend composer install --no-interaction --optimize-autoloader
IF !ERRORLEVEL! NEQ 0 ( echo Error en composer install & exit /b !ERRORLEVEL! )
echo ✅ Composer install completado

:: ── 6. Generar claves JWT ────────────────────────────────────────────────────
echo.
echo ℹ️  Generando claves JWT...
%DC% exec -T backend php bin/console lexik:jwt:generate-keypair --skip-if-exists --no-interaction
IF !ERRORLEVEL! NEQ 0 ( echo Warning: error generando JWT, continuando... )
echo ✅ Claves JWT generadas

:: ── 7. Aplicar migraciones Doctrine ──────────────────────────────────────────
echo.
echo ℹ️  Aplicando migraciones Doctrine...
%DC% exec -T backend php bin/console doctrine:migrations:migrate --no-interaction --allow-no-migration
IF !ERRORLEVEL! NEQ 0 ( echo Error en migraciones & exit /b !ERRORLEVEL! )
echo ✅ Migraciones aplicadas

:: ── 8. Limpiar caché + permisos ──────────────────────────────────────────────
echo.
echo ℹ️  Limpiando caché y ajustando permisos...
%DC% exec -T backend rm -rf var/cache/dev var/cache/prod
%DC% exec -T backend php bin/console cache:clear
%DC% exec -T backend chown -R www-data:www-data var/
echo ✅ Caché limpio y permisos ajustados

:: ── 9. Instalar dependencias Frontend (NPM) ──────────────────────────────────
echo.
echo ℹ️  Instalando dependencias de React (npm install)...
%DC% exec -T frontend npm install
IF !ERRORLEVEL! NEQ 0 ( echo Error en npm install & exit /b !ERRORLEVEL! )
echo ✅ npm install completado

:: ── 10. Reiniciar backend (OPcache) ─────────────────────────────────────────
echo.
echo ℹ️  Reiniciando backend para aplicar OPcache...
%DC% restart backend
echo ✅ Backend reiniciado

:: ── Resumen ──────────────────────────────────────────────────────────────────
echo.
echo ==============================================
echo   ✅ Loggex v02 instalado y listo
echo ==============================================
echo.
echo   Frontend:    https://localhost:8443
echo   Backend API: https://localhost:9443/api
echo   MinIO:       http://localhost:9001  (admin / minio_password)
echo.
echo   Credenciales por defecto (backup):
echo     superadmin@loggex.com / 1234
echo.
goto :EOF

:FAIL
echo.
echo Estructura del repo incompleta — ejecuta desde la raíz del proyecto
exit /b 1
