#!/bin/bash
docker compose exec backend php bin/console cache:clear
echo "Caché limpiada"
