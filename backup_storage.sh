#!/bin/bash

# Configuracion
MINIO_SERVICE="minio"
MINIO_USER="minio_admin"
MINIO_PASSWORD="minio_password"
MINIO_BUCKET="loggex-data"
BACKUP_DIR="./minio_backup"

echo "--- Iniciando copia de seguridad del bucket de MinIO ---"

# 1. Crear directorio de backup si no existe
mkdir -p $BACKUP_DIR

# 2. Usar un contenedor de MinIO Client (mc) para hacer la copia
#    - Sobrescribimos el ENTRYPOINT para poder ejecutar comandos de shell
docker run --rm --entrypoint=/bin/sh \
  -v "$(pwd)/$BACKUP_DIR:/backup" \
  --network loggex-v02_default \
  minio/mc:latest \
  -c " \
    mc alias set myminio http://$MINIO_SERVICE:9000 $MINIO_USER $MINIO_PASSWORD && \
    mc mirror myminio/$MINIO_BUCKET /backup \
  "

if [ $? -eq 0 ]; then
    echo "✅ Copia de seguridad del bucket '$MINIO_BUCKET' completada en '$BACKUP_DIR'."
else
    echo "❌ Error durante la copia de seguridad."
    exit 1
fi
