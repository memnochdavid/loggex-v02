#!/bin/sh
set -e

# Eliminamos la instalacion automatica de composer para evitar conflictos con init.bat
# y evitar que el contenedor muera si falla la red al inicio.

# Ensure directories exist (for cache/logs and uploads)
mkdir -p var public/uploads

# Fix permissions for Apache (www-data)
chown -R www-data:www-data var public/uploads

# Execute the original entrypoint (which starts Apache)
exec docker-php-entrypoint "$@"
