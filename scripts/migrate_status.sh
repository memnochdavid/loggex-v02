#!/bin/bash
# Ver estado de las migraciones
cd "$(dirname "$0")/.."

docker compose exec backend php bin/console doctrine:migrations:status
echo ""
docker compose exec backend php bin/console doctrine:migrations:list
