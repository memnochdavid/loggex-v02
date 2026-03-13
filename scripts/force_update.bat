@echo off
cd /d "%~dp0\.."

echo [DB] Forzando actualizacion del esquema de base de datos...
docker compose exec backend php bin/console doctrine:schema:update --force --complete --no-interaction
echo [CACHE] Limpiando cache...
docker compose exec backend php bin/console cache:clear
echo [OK] Listo. La base de datos deberia estar sincronizada con las entidades.
