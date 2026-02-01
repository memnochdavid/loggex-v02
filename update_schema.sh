#!/bin/bash

echo "🔄 Actualizando esquema de base de datos..."

# Ejecutar actualización de esquema forzada
docker compose exec backend php bin/console doctrine:schema:update --force

# Limpiar caché para asegurar que los cambios se reflejen
docker compose exec backend php bin/console cache:clear

echo "✅ Esquema actualizado y caché limpia."
