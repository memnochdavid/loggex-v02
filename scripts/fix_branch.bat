@echo off
setlocal EnableDelayedExpansion
cd /d "%~dp0\.."

set OLD_BRANCH=feature/mariadb-migration
set NEW_BRANCH=develop
set REMOTE=origin

echo [GIT] Obteniendo ultimos cambios del remoto...
git fetch %REMOTE%

git show-ref --verify --quiet refs/heads/%OLD_BRANCH%
if %ERRORLEVEL% EQU 0 (
    echo [WARN] Detectada rama antigua local: %OLD_BRANCH%

    git show-ref --verify --quiet refs/heads/%NEW_BRANCH%
    if %ERRORLEVEL% EQU 0 (
        echo [ERROR] La rama '%NEW_BRANCH%' ya existe localmente.
        echo    Por favor, revisa tus ramas manualmente para decidir cual conservar.
        exit /b 1
    )

    echo [GIT] Renombrando '%OLD_BRANCH%' a '%NEW_BRANCH%'...
    git branch -m %OLD_BRANCH% %NEW_BRANCH%

    echo [GIT] Vinculando '%NEW_BRANCH%' local con '%REMOTE%/%NEW_BRANCH%'...
    git branch -u %REMOTE%/%NEW_BRANCH% %NEW_BRANCH%

    echo [OK] Rama migrada correctamente.

) else (
    echo [INFO] No se encontro la rama '%OLD_BRANCH%' localmente.

    git show-ref --verify --quiet refs/heads/%NEW_BRANCH%
    if %ERRORLEVEL% EQU 0 (
        echo [OK] Ya tienes la rama '%NEW_BRANCH%' correctamente.
    ) else (
        echo [GIT] Creando rama '%NEW_BRANCH%' desde el remoto...
        git checkout -b %NEW_BRANCH% %REMOTE%/%NEW_BRANCH%
    )
)

echo [GIT] Limpiando referencias remotas obsoletas...
git remote prune %REMOTE%

echo [OK] Proceso finalizado! Ahora estas sincronizado con '%NEW_BRANCH%'.
