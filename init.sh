#!/bin/bash

# Script para inicializar el proyecto después de clonarlo (git clone)

set -e

echo "=== Inicializando Loggex v02 ==="

# 1. Levantar contenedores
echo "Levantando contenedores Docker..."
docker compose up -d --build

# 2. Instalar dependencias Backend
echo "Instalando dependencias de Symfony (Composer)..."
docker compose exec backend composer install

# Asegurar que API Platform esté instalado (si no está en composer.json)
echo "Verificando instalación de API Platform..."
docker compose exec backend composer require api

# 3. Instalar dependencias Frontend
echo "Instalando dependencias de React (NPM)..."
docker compose exec frontend npm install

# 4. Base de Datos
echo "Esperando a que la base de datos esté lista..."
sleep 10 # Dar tiempo a MariaDB para inicializar e importar el SQL

# Nota: Como usamos un volcado SQL en docker-entrypoint-initdb.d,
# no ejecutamos migraciones inicialmente para no conflictos,
# a menos que queramos actualizar el esquema sobre los datos importados.
# Si el esquema de Doctrine difiere del SQL importado, podríamos necesitar:
# docker compose exec backend php bin/console doctrine:schema:update --force

echo ""
echo "=== ¡Proyecto listo! ==="
echo "Frontend: https://localhost:8443"
echo "Backend API Docs: https://localhost:9443/api"
echo "Backend Hello: https://localhost:9443/api/hello"
