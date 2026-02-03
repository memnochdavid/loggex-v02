#!/bin/bash
echo "Arreglando estado de migraciones..."

# Marcar la migración conflictiva como ya ejecutada
docker compose exec backend php bin/console doctrine:migrations:version "DoctrineMigrations\Version20260202135142" --add --no-interaction

echo "Ejecutando migraciones pendientes (incluyendo la de Entregas)..."
docker compose exec backend php bin/console doctrine:migrations:migrate --no-interaction

echo "Limpiando caché..."
docker compose exec backend php bin/console cache:clear

echo "Reparación completada. Intenta usar la aplicación ahora."
