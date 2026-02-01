#!/bin/bash

# Script para inicializar el proyecto Loggex v02
# Uso: ./init.sh

set -e

echo "=== Inicializando Loggex v02 ==="

# 0. Preparar carpetas y permisos locales
echo "📂 Preparando carpetas y permisos..."
mkdir -p backend/public/uploads/avatar
mkdir -p backend/public/uploads/logo-centro
# Asignar permisos de escritura para que el contenedor pueda escribir (www-data)
chmod -R 777 backend/public/uploads

# Asegurar configuración correcta de API Platform
echo "⚙️  Verificando configuración de API Platform..."
cat <<EOF > backend/config/packages/api_platform.yaml
api_platform:
    title: Loggex API
    version: 1.0.0
    formats:
        jsonld: ['application/ld+json']
        json: ['application/json']
    defaults:
        stateless: true
        cache_headers:
            vary: ['Content-Type', 'Authorization', 'Origin']
        pagination_items_per_page: 20
        pagination_client_items_per_page: true
    patch_formats:
        json: ['application/merge-patch+json']
EOF

# 1. Levantar contenedores
echo "🚀 Levantando contenedores Docker..."
docker compose up -d --build

# 2. Instalar dependencias Backend
echo "📦 Instalar dependencias de Symfony (Composer)..."
docker compose exec backend composer install

# 3. Generar claves JWT (si no existen)
echo "🔑 Verificando claves JWT..."
docker compose exec backend sh -c '
    if [ ! -f config/jwt/private.pem ]; then
        echo "Generando nuevas claves JWT..."
        php bin/console lexik:jwt:generate-keypair --skip-if-exists
    else
        echo "Claves JWT ya existen."
    fi
'

# 4. Instalar dependencias Frontend
echo "📦 Instalar dependencias de React (NPM)..."
docker compose exec frontend npm install
# Asegurar instalación de dependencias clave
docker compose exec frontend npm install lucide-react react-router-dom

# 5. Preparar Base de Datos
echo "🗄️  Esperando a que la base de datos esté lista..."
# Bucle de espera simple para asegurar que MariaDB acepte conexiones
docker compose exec backend sh -c '
    until php bin/console dbal:run-sql "SELECT 1" > /dev/null 2>&1; do
        echo "Esperando a MariaDB..."
        sleep 2
    done
'

echo "🔄 Gestionando esquema de base de datos..."

# Intentar ejecutar migraciones si existen
if ls backend/migrations/*.php 1> /dev/null 2>&1; then
    echo "Ejecutando migraciones..."
    docker compose exec backend php bin/console doctrine:migrations:migrate --no-interaction
else
    echo "No se encontraron migraciones. Actualizando esquema directamente..."
    docker compose exec backend php bin/console doctrine:schema:update --force --complete
fi

# Limpiar caché para asegurar que todo está fresco
echo "🧹 Limpiando caché..."
docker compose exec backend php bin/console cache:clear

echo ""
echo "=== ¡Proyecto listo! ✅ ==="
echo "Frontend: https://localhost:8443"
echo "Backend: https://localhost:9443/api/hello"
echo ""
echo "Nota: Si necesitas cargar datos de prueba, ejecuta:"
echo "docker compose exec backend php bin/console doctrine:fixtures:load --no-interaction"
