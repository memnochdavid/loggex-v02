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

# 3. Instalar dependencias Frontend
echo "Instalando dependencias de React (NPM)..."
docker compose exec frontend npm install

# 4. Preparar Base de Datos (si hay migraciones)
echo "Ejecutando migraciones de base de datos..."
# Esperar un poco a que la BD esté lista
sleep 5
docker compose exec backend php bin/console doctrine:migrations:migrate --no-interaction

echo ""
echo "=== ¡Proyecto listo! ==="
echo "Frontend: https://localhost:8443"
echo "Backend: https://localhost:9443/api/hello"
