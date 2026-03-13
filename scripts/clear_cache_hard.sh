#!/bin/bash
cd "$(dirname "$0")/.."

echo "🧹 Limpiando caché a fondo..."
docker compose exec backend rm -rf var/cache/dev
docker compose exec backend rm -rf var/cache/prod
docker compose exec backend php bin/console cache:clear
echo "✅ Caché eliminada."
