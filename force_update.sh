#!/bin/bash
echo "Forzando actualización del esquema de base de datos..."
docker compose exec backend php bin/console doctrine:schema:update --force --complete --no-interaction
echo "Limpiando caché..."
docker compose exec backend php bin/console cache:clear
echo "Listo. La base de datos debería estar sincronizada con las entidades."
