#!/bin/bash
# Ejecutar migraciones pendientes
cd "$(dirname "$0")/.."

echo "🔄 Ejecutando migraciones pendientes..."

docker compose exec backend php bin/console doctrine:migrations:migrate --no-interaction

if [ $? -eq 0 ]; then
    echo "✅ Migraciones ejecutadas correctamente."
    docker compose exec backend php bin/console cache:clear --no-warmup -q
else
    echo "❌ Error al ejecutar las migraciones."
    exit 1
fi
