#!/bin/bash
cd "$(dirname "$0")/.."

docker compose exec backend php bin/console cache:clear
echo "Caché limpiada"
