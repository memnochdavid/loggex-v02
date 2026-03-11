#!/bin/bash

# Configuracion
MINIO_SERVICE="minio"
MINIO_USER="minio_admin"
MINIO_PASSWORD="minio_password"
MINIO_BUCKET="loggex-data"
BACKUP_DIR="./minio_backup"

echo "--- Iniciando restauracion del bucket de MinIO ---"

# Verificar si el directorio existe
if [ ! -d "$BACKUP_DIR" ]; then
    echo "❌ Error: No existe el directorio '$BACKUP_DIR'."
    exit 1
fi

# Usar un contenedor de MinIO Client (mc) para hacer la restauracion
# - Montamos el directorio de backup en /backup
# - Nos conectamos a la red del proyecto para ver el servicio 'minio'
docker run --rm \
  -v "$(pwd)/$BACKUP_DIR:/backup" \
  --network loggex-v02_default \
  minio/mc:latest \
  sh -c " \
    mc alias set myminio http://$MINIO_SERVICE:9000 $MINIO_USER $MINIO_PASSWORD && \
    mc mb myminio/$MINIO_BUCKET --ignore-existing && \
    mc mirror --overwrite /backup myminio/$MINIO_BUCKET \
  "

if [ $? -eq 0 ]; then
    echo "✅ Restauracion del bucket '$MINIO_BUCKET' completada desde '$BACKUP_DIR'."
else
    echo "❌ Error durante la restauracion."
    exit 1
fi
