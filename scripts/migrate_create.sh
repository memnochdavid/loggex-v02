#!/bin/bash
# Generar nueva migracion a partir de diferencias entre entidades y BD
cd "$(dirname "$0")/.."

echo "🔍 Comparando entidades con la base de datos..."

docker compose exec backend php bin/console make:migration

if [ $? -eq 0 ]; then
    echo ""
    echo "📋 Para ejecutar la migracion: ./scripts/migrate.sh"
else
    echo "❌ Error al generar la migracion."
    exit 1
fi
