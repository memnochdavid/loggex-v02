#!/bin/bash
# Resetea la BD tras el refactor de renombrado (Fase F del plan).
#
# Pasos:
#   1. Genera la migration unificada con make:migration
#   2. Drop schema completo (tablas centro + catalogo_*)
#   3. Aplica la migration nueva → esquema vacío con nombres nuevos
#   4. Restaura las 5 tablas preservadas (centro, comunicado, personalizacion, tema_visual, usuario)
#   5. Re-ejecuta el catálogo oficial (refresh + enrich-boe)
#
# Requiere: backup_preserve.sql en la raíz del proyecto.
#           Generado con: awk -f /tmp/extract_preserve.awk backup_tfg_full.sql > backup_preserve.sql
#
# Uso: sudo bash scripts/post-rename-reset.sh

set -euo pipefail

cd "$(dirname "$0")/.."

if [[ ! -f backup_preserve.sql ]]; then
    echo "❌ falta backup_preserve.sql en la raíz. Generalo con:"
    echo "   awk -f /tmp/extract_preserve.awk backup_tfg_full.sql > backup_preserve.sql"
    exit 1
fi

echo "→ Limpiando caché de Symfony…"
docker compose exec -T backend php bin/console cache:clear

echo "→ Dropping schema (TODAS las tablas)…"
docker compose exec -T backend php bin/console doctrine:schema:drop --full-database --force

echo "→ Generando migration unificada (BD vacía → esquema completo con nombres nuevos)…"
# OJO: tiene que ir DESPUÉS del drop, si no `make:migration` genera un diff
# del esquema viejo al nuevo (DROP+CREATE) y luego al aplicarlo sobre BD vacía
# fallan los DROP. Con BD vacía, genera CREATE TABLE limpios.
docker compose exec -T backend php bin/console make:migration --no-interaction

echo "→ Aplicando migrations…"
docker compose exec -T backend php bin/console doctrine:migrations:migrate --no-interaction

echo "→ Restaurando 5 tablas preservadas (usuario, centro, comunicado, personalizacion, tema_visual)…"
# Desactivamos FK checks: el migrate ya creó tablas que referencian a centro,
# y el backup hace DROP TABLE IF EXISTS al inicio. Sin esto, el DROP de centro
# falla por las FKs de itinerario/grupo/usuario/tema_visual hacia centro.
{
    echo 'SET FOREIGN_KEY_CHECKS=0;'
    cat backup_preserve.sql
    echo 'SET FOREIGN_KEY_CHECKS=1;'
} | docker compose exec -T database mariadb -u app_user -papp_password app_db

echo "→ Refrescando catálogo oficial (TodoFP + BOE)…"
docker compose exec -T backend php bin/console app:catalogo:refresh
docker compose exec -T backend php bin/console app:catalogo:enrich-boe

# La cache de metadata de Doctrine (var/cache/dev/doctrine/...) y el opcache
# de Apache memorizan el mapping con los nombres de clase ANTERIORES. Sin un
# restart, el primer login post-rename peta con:
#   MappingException: target-entity App\Entity\CicloFormativo cannot be found
#   in 'App\Entity\Centro#ciclos'
echo "→ Limpiando cache a fondo y reiniciando backend (libera opcache de Apache)…"
docker compose exec -T backend rm -rf var/cache/dev var/cache/prod
docker compose exec -T backend php bin/console cache:clear
docker compose restart backend

echo
echo "✅ Reset completo. Verificación:"
docker compose exec -T database mysql -uapp_user -papp_password app_db -e "
  SELECT 'usuarios' AS tabla, COUNT(*) AS n FROM usuario
  UNION SELECT 'centros', COUNT(*) FROM centro
  UNION SELECT 'temas_visuales', COUNT(*) FROM tema_visual
  UNION SELECT 'personalizaciones', COUNT(*) FROM personalizacion
  UNION SELECT 'comunicados', COUNT(*) FROM comunicado
  UNION SELECT 'catalogo_itinerarios', COUNT(*) FROM catalogo_itinerario
  UNION SELECT 'catalogo_materias', COUNT(*) FROM catalogo_materia
"
