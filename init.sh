#!/bin/bash

# Script robusto para inicializar/actualizar el proyecto
# Úsalo después de git clone o git pull

set -e

echo "🚀 Iniciando despliegue de Loggex v02..."

# 1. Levantar contenedores
# Usamos --remove-orphans para limpiar contenedores viejos
echo "🐳 Levantando contenedores Docker..."
docker compose up -d --build --remove-orphans

# 2. Instalar dependencias Backend
echo "📦 Instalando dependencias de Symfony (Composer)..."

# Asegurar paquetes para MinIO/S3 antes del install por si no están en composer.json
echo "☁️  Asegurando dependencias de almacenamiento (MinIO/S3)..."
docker compose exec backend composer require league/flysystem-aws-s3-v3 oneup/flysystem-bundle --no-interaction

docker compose exec backend composer install --no-interaction --optimize-autoloader

# 3. Instalar dependencias Frontend
echo "📦 Instalando dependencias de React (NPM)..."
docker compose exec frontend npm install

# 4. Sincronizar Base de Datos
echo "🔄 Sincronizando esquema de base de datos..."
echo "   (Esperando 5s a que MariaDB esté lista...)"
sleep 5

# Actualizar esquema (crea tablas/columnas nuevas sin borrar datos)
docker compose exec backend php bin/console doctrine:schema:update --force --no-interaction

# 5. Limpieza y Optimización (CRÍTICO)
echo "🧹 Limpiando y regenerando caché..."
# Borrado físico para asegurar que no quedan restos corruptos
docker compose exec backend rm -rf var/cache/dev var/cache/prod
# Regeneración oficial
docker compose exec backend php bin/console cache:clear

# 6. Permisos
echo "🔒 Ajustando permisos internos..."
docker compose exec backend chown -R www-data:www-data var/

# 7. Reinicio final del backend (Para asegurar que OPcache/PHP-FPM toman los cambios de código/config)
echo "🔄 Reiniciando servicio backend..."
docker compose restart backend

echo ""
echo "✅ ¡Proyecto desplegado y actualizado correctamente!"
echo "Frontend: https://localhost:8443"
echo "Backend API: https://localhost:9443/api"
echo ""
echo "💡 Si tienes problemas de datos, puedes restaurar el backup inicial con: ./restore_db.sh"
