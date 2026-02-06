#!/bin/bash

echo "==============================================="
echo "   LOGGEX-V02: REPARACIÓN DE ENTORNO LOCAL"
echo "==============================================="

# 1. Limpieza de archivos locales conflictivos
if [ -f backend/.env.local ]; then
    echo "⚠️  Detectado archivo 'backend/.env.local'."
    read -p "¿Quieres eliminarlo para usar la configuración del repo? (s/n): " confirm
    if [[ $confirm == [sS] || $confirm == [sS][yY] ]]; then
        rm backend/.env.local
        echo "✅ backend/.env.local eliminado."
    else
        echo "ℹ️  Conservando backend/.env.local. Asegúrate de que tenga las variables CORS y TRUSTED_PROXIES actualizadas."
    fi
fi

# 2. Reinicio limpio de Docker
echo ""
echo "🐳 Reiniciando contenedores Docker (Build sin caché)..."
docker compose down
docker compose build --no-cache
docker compose up -d

echo "⏳ Esperando a que los servicios arranquen (10s)..."
sleep 10

# 3. Actualización de Base de Datos y Caché
echo ""
echo "🗄️  Actualizando esquema de base de datos y caché..."
docker compose exec backend php bin/console doctrine:schema:update --force --complete --no-interaction
docker compose exec backend php bin/console cache:clear

# 4. Verificación de JWT
echo ""
echo "🔑 Verificando claves JWT..."
# Intentamos generar las claves. Si ya existen, el comando fallará o no hará nada (depende de la versión),
# pero aseguramos que existan.
docker compose exec backend php bin/console lexik:jwt:generate-keypair --skip-if-exists

# 5. Permisos (Opcional pero recomendado en Linux)
echo ""
echo "🔒 Ajustando permisos de var/ y public/uploads..."
docker compose exec backend chmod -R 777 var/ public/uploads/

echo ""
echo "==============================================="
echo "   ✅ ENTORNO REPARADO Y LISTO"
echo "==============================================="
echo "Prueba acceder a:"
echo "👉 http://localhost:8888"
echo "👉 https://localhost:8443 (Acepta el certificado)"
echo ""
