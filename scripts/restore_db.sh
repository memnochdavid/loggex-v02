#!/bin/bash
cd "$(dirname "$0")/.."

BACKUP_FILE="backup_tfg_full.sql"

if [ ! -f "$BACKUP_FILE" ]; then
    echo "❌ Error: El archivo '$BACKUP_FILE' no existe en la raíz del proyecto."
    exit 1
fi

echo "🔄 Iniciando restauración de base de datos desde '$BACKUP_FILE'..."

cat "$BACKUP_FILE" | docker compose exec -T database mariadb -u app_user -papp_password app_db

if [ $? -eq 0 ]; then
    echo "✅ Base de datos restaurada correctamente."

    # Limpiar migraciones para evitar desincronizacion
    echo "🗑️  Limpiando tabla de migraciones..."
    docker compose exec backend php bin/console dbal:run-sql "DELETE FROM doctrine_migration_versions" -q

    # Marcar migraciones existentes como ejecutadas
    if ls backend/migrations/Version*.php 1>/dev/null 2>&1; then
        echo "📌 Registrando migraciones actuales..."
        docker compose exec backend php bin/console doctrine:migrations:version --add --all --no-interaction
    fi

    docker compose exec backend php bin/console cache:clear --no-warmup -q
    echo "✅ Restauración completada."
else
    echo "❌ Error al restaurar la base de datos."
    exit 1
fi
