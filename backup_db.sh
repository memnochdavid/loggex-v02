#!/bin/bash

# Nombre del archivo de backup
BACKUP_FILE="backup_tfg_full.sql"

echo "💾 Iniciando copia de seguridad de la base de datos..."

# Ejecutar mysqldump dentro del contenedor
docker compose exec database mysqldump -u app_user -papp_password app_db > "$BACKUP_FILE"

if [ $? -eq 0 ]; then
    echo "✅ Copia de seguridad guardada en '$BACKUP_FILE'."
else
    echo "❌ Error al realizar la copia de seguridad."
    exit 1
fi
