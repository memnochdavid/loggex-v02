FROM php:8.4-apache

# Instalar dependencias del sistema y extensiones PHP
# Cambiamos libpq-dev (Postgres) por default-mysql-client (opcional) y extensiones pdo_mysql
RUN apt-get update && apt-get install -y \
    git \
    unzip \
    default-mysql-client \
    && docker-php-ext-install pdo pdo_mysql

# Habilitar mod_rewrite
RUN a2enmod rewrite

# Copiar configuración personalizada de Apache
COPY apache-vhost.conf /etc/apache2/sites-available/000-default.conf

WORKDIR /var/www/html

# Crear carpeta de uploads y asignar permisos
RUN mkdir -p public/uploads/avatar && \
    chown -R www-data:www-data public/uploads && \
    chmod -R 755 public/uploads

# Instalar Composer
COPY --from=composer:latest /usr/bin/composer /usr/bin/composer
