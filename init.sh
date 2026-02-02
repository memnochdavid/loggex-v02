#!/bin/bash

# Script robusto para inicializar/actualizar el proyecto
# Úsalo después de git clone o git pull

set -e

echo "🚀 Iniciando despliegue de Loggex v02..."

# 1. Levantar contenedores (forzando recreación para asegurar config nueva)
echo "🐳 Levantando contenedores Docker..."
docker compose up -d --build --remove-orphans

# 2. Instalar dependencias Backend
echo "📦 Instalando dependencias de Symfony (Composer)..."
docker compose exec backend composer install --no-interaction --optimize-autoloader

# Asegurar API Platform
docker compose exec backend composer require api --no-interaction

# 3. Instalar dependencias Frontend
echo "📦 Instalando dependencias de React (NPM)..."
docker compose exec frontend npm install

# 4. Sincronizar Base de Datos
echo "🔄 Sincronizando esquema de base de datos..."
# Esperar a que MariaDB esté lista
sleep 10
# Forzar actualización del esquema para que coincida con las Entidades PHP
docker compose exec backend php bin/console doctrine:schema:update --force --no-interaction

# 5. Limpiar Caché (CRÍTICO para evitar errores 500/401 por metadatos viejos)
echo "🧹 Limpiando caché de Symfony..."
docker compose exec backend php bin/console cache:clear
# Borrar caché física por si acaso
docker compose exec backend rm -rf var/cache/dev var/cache/prod

# 6. Permisos (Opcional, para evitar problemas de escritura en logs/sesiones)
echo "🔒 Ajustando permisos..."
docker compose exec backend chown -R www-data:www-data var/

echo ""
echo "✅ ¡Proyecto desplegado y actualizado!"
echo "Frontend: https://localhost:8443"
echo "Backend API: https://localhost:9443/api"
