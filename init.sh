#!/bin/bash

# Script para inicializar el proyecto después de clonarlo (git clone)
# Uso: ./init.sh

set -e

echo "=== Inicializando Loggex v02 ==="

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

# 5. Preparar Base de Datos
echo "🗄️  Esperando a que la base de datos esté lista..."
# Bucle de espera simple para asegurar que MariaDB acepte conexiones
docker compose exec backend sh -c '
    until php bin/console dbal:run-sql "SELECT 1" > /dev/null 2>&1; do
        echo "Esperando a MariaDB..."
        sleep 2
    done
'

echo "🔄 Ejecutando migraciones..."
docker compose exec backend php bin/console doctrine:migrations:migrate --no-interaction

echo ""
echo "=== ¡Proyecto listo! ✅ ==="
echo "Frontend: https://localhost:8443"
echo "Backend: https://localhost:9443/api/hello"
