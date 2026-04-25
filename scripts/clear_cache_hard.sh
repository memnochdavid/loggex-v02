#!/bin/bash
cd "$(dirname "$0")/.."

echo "🧹 Limpiando caché a fondo..."
docker compose exec backend rm -rf var/cache/dev
docker compose exec backend rm -rf var/cache/prod
docker compose exec backend php bin/console cache:clear

echo "🔄 Reiniciando backend (libera el Opcache de Apache para que recoja el nuevo container PHP)..."
docker compose restart backend

echo "✅ Caché eliminada y backend reiniciado."
