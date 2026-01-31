#!/bin/bash

echo "=== Diagnóstico y Reparación de Base de Datos ==="

echo "1. Verificando mapeo de entidades..."
docker compose exec backend php bin/console doctrine:mapping:info

echo ""
echo "2. Validando esquema..."
docker compose exec backend php bin/console doctrine:schema:validate

echo ""
echo "3. Intentando actualizar esquema (force)..."
docker compose exec backend php bin/console doctrine:schema:update --force --complete

echo ""
echo "4. Verificando si la tabla 'personalizacion' existe..."
docker compose exec database mariadb -u app_user -papp_password app_db -e "SHOW TABLES LIKE 'personalizacion';"

echo ""
echo "Si la tabla no aparece arriba, intentaremos crearla manualmente."
echo "Creando tabla 'personalizacion' manualmente..."

docker compose exec database mariadb -u app_user -papp_password app_db -e "
CREATE TABLE IF NOT EXISTS personalizacion (
    id INT AUTO_INCREMENT NOT NULL,
    centro_id INT NOT NULL,
    primary_color VARCHAR(7) NOT NULL,
    sidebar_color VARCHAR(7) NOT NULL,
    UNIQUE INDEX UNIQ_C72269B8298137A7 (centro_id),
    PRIMARY KEY(id),
    CONSTRAINT FK_C72269B8298137A7 FOREIGN KEY (centro_id) REFERENCES centro (id)
) DEFAULT CHARACTER SET utf8mb4 COLLATE \`utf8mb4_unicode_ci\` ENGINE = InnoDB;
"

echo ""
echo "Verificando nuevamente..."
docker compose exec database mariadb -u app_user -papp_password app_db -e "SHOW TABLES LIKE 'personalizacion';"

echo "=== Fin ==="
