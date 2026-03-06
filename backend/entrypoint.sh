#!/bin/sh
set -e

# Check if vendor directory exists, if not, install dependencies
if [ ! -f vendor/autoload.php ]; then
    echo "🚀 Dependencies missing. Running 'composer install'..."
    composer install --prefer-dist --no-progress --no-interaction
fi

# Ensure directories exist (for cache/logs and uploads)
mkdir -p var public/uploads

# Fix permissions for Apache (www-data)
chown -R www-data:www-data var public/uploads

# Execute the original entrypoint (which starts Apache)
# We use docker-php-entrypoint to maintain base image behavior
exec docker-php-entrypoint "$@"