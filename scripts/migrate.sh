#!/bin/bash
cd "$(dirname "$0")/.."

# Aplica todas las migraciones Doctrine pendientes y limpia la caché.
# Úsalo tras generar una migración con ./make_migration.sh o tras hacer git pull con migraciones nuevas.

echo "🗂  Estado de migraciones actual:"
docker compose exec backend php bin/console doctrine:migrations:status 2>/dev/null | grep -E "Executed|Available|New|Not migrated" || true

echo ""
echo "🚀 Aplicando migraciones pendientes..."
docker compose exec backend php bin/console doctrine:migrations:migrate --no-interaction --allow-no-migration

echo ""
echo "🧹 Limpiando caché (hard + restart)..."
docker compose exec backend rm -rf var/cache/dev var/cache/prod
docker compose exec backend php bin/console cache:clear
docker compose restart backend

echo ""
echo "✅ Migraciones aplicadas y backend reiniciado."
