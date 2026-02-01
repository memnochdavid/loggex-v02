#!/bin/bash

# Script maestro para inicializar el proyecto Loggex v02
# Uso: ./init.sh

set -e

echo "========================================"
echo "🚀  Inicializando Loggex v02"
echo "========================================"

# 1. Preparar carpetas y permisos locales (Host)
echo "📂 [1/8] Preparando carpetas y permisos..."
mkdir -p backend/public/uploads/avatar
mkdir -p backend/public/uploads/logo-centro
mkdir -p backend/var/cache
mkdir -p backend/var/log

# Asignar permisos amplios para evitar problemas con Docker (www-data)
chmod -R 777 backend/public/uploads
chmod -R 777 backend/var

# 2. Asegurar configuración crítica de Backend
echo "⚙️  [2/8] Configurando API Platform..."
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

# 3. Levantar contenedores
echo "🐳 [3/8] Levantando contenedores Docker..."
docker compose up -d --build

# 4. Dependencias Backend
echo "📦 [4/8] Instalando dependencias Backend (Composer)..."
docker compose exec backend composer install --no-interaction

# 5. Generar claves JWT
echo "🔑 [5/8] Verificando claves JWT..."
docker compose exec backend sh -c '
    if [ ! -f config/jwt/private.pem ]; then
        echo "Generando nuevas claves JWT..."
        php bin/console lexik:jwt:generate-keypair --skip-if-exists
    else
        echo "Claves JWT ya existen."
    fi
'

# 6. Dependencias Frontend
echo "📦 [6/8] Instalando dependencias Frontend (NPM)..."
docker compose exec frontend npm install
# Aseguramos las librerías críticas por si acaso
docker compose exec frontend npm install lucide-react react-router-dom

# 7. Base de Datos
echo "🗄️  [7/8] Esperando a la Base de Datos..."
# Bucle de espera
docker compose exec backend sh -c '
    until php bin/console dbal:run-sql "SELECT 1" > /dev/null 2>&1; do
        echo "Esperando a MariaDB..."
        sleep 2
    done
'

echo "🔄 Ejecutando migraciones..."
if ls backend/migrations/*.php 1> /dev/null 2>&1; then
    docker compose exec backend php bin/console doctrine:migrations:migrate --no-interaction
else
    echo "⚠️ No se encontraron migraciones. Intentando actualizar esquema directamente..."
    docker compose exec backend php bin/console doctrine:schema:update --force --complete
fi

# 8. Limpieza final
echo "🧹 [8/8] Limpiando caché..."
docker compose exec backend php bin/console cache:clear

echo ""
echo "========================================"
echo "✅  ¡PROYECTO LISTO!"
echo "========================================"
echo "🌍 Frontend: https://localhost:8443"
echo "🔌 Backend:  https://localhost:9443/api"
echo ""
echo "💡 Tips:"
echo " - Si la BD está vacía, puedes cargar datos de prueba con:"
echo "   docker compose exec backend php bin/console doctrine:fixtures:load --no-interaction"
echo " - Si tienes un backup SQL, impórtalo manualmente en el contenedor de base de datos."
echo ""
