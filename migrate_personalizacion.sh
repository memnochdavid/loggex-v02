#!/bin/bash
echo "Generando migración..."
docker compose exec backend php bin/console make:migration --no-interaction
echo "Ejecutando migración..."
docker compose exec backend php bin/console doctrine:migrations:migrate --no-interaction
echo "Limpiando caché..."
docker compose exec backend php bin/console cache:clear
echo "Listo!"
