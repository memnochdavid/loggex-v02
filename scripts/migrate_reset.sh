#!/bin/bash
# Resetear migraciones: borra todas las versiones registradas y archivos de migracion,
# luego genera una migracion limpia con el estado actual de las entidades.
# Util cuando la BD ya esta sincronizada y se quiere empezar de cero.
cd "$(dirname "$0")/.."

echo "⚠️  Esto va a:"
echo "   1. Borrar todos los archivos de migracion"
echo "   2. Vaciar la tabla doctrine_migration_versions"
echo "   3. Generar una migracion limpia (si hay diferencias)"
echo "   4. Marcarla como ejecutada (sin tocar la BD)"
echo ""
read -p "¿Continuar? (s/N): " confirm

if [[ "$confirm" != "s" && "$confirm" != "S" ]]; then
    echo "Cancelado."
    exit 0
fi

# 1. Borrar archivos de migracion
echo "🗑️  Borrando archivos de migracion..."
rm -f backend/migrations/Version*.php

# 2. Vaciar tabla de versiones
echo "🗑️  Vaciando tabla doctrine_migration_versions..."
docker compose exec backend php bin/console dbal:run-sql "DELETE FROM doctrine_migration_versions" -q

# 3. Generar migracion limpia
echo "🔍 Generando migracion limpia..."
docker compose exec backend php bin/console make:migration --no-interaction

# 4. Marcar como ejecutada si se genero alguna
if ls backend/migrations/Version*.php 1>/dev/null 2>&1; then
    echo "📌 Marcando migracion como ejecutada..."
    docker compose exec backend php bin/console doctrine:migrations:version --add --all --no-interaction
    echo "✅ Migraciones reseteadas. Nueva migracion generada y marcada como ejecutada."
else
    echo "✅ Migraciones reseteadas. La BD ya esta sincronizada con las entidades."
fi

docker compose exec backend php bin/console cache:clear --no-warmup -q
