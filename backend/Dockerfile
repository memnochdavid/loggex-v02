FROM php:8.4-apache

# Instalar dependencias del sistema y extensiones PHP
# Añadimos opcache para mejorar rendimiento
RUN apt-get update && apt-get install -y \
    git \
    unzip \
    libzip-dev \
    libpng-dev \
    libjpeg62-turbo-dev \
    libfreetype6-dev \
    default-mysql-client \
    && docker-php-ext-configure gd --with-freetype --with-jpeg \
    && docker-php-ext-install pdo pdo_mysql opcache zip gd \
    # phpredis: requerido por symfony/redis-messenger (no soporta predis)
    && pecl install redis \
    && docker-php-ext-enable redis

# Habilitar mod_rewrite
RUN a2enmod rewrite

# Copiar configuración personalizada de Apache
COPY apache-vhost.conf /etc/apache2/sites-available/000-default.conf

# Copiar configuración personalizada de PHP (Opcache)
COPY php.ini /usr/local/etc/php/conf.d/custom.ini

WORKDIR /var/www/html

# Crear carpeta de uploads y asignar permisos
RUN mkdir -p public/uploads/avatar && \
    chown -R www-data:www-data public/uploads && \
    chmod -R 755 public/uploads

# Instalar Composer
COPY --from=composer:latest /usr/bin/composer /usr/bin/composer

# Copiar y configurar script de entrada
COPY entrypoint.sh /usr/local/bin/entrypoint.sh
RUN chmod +x /usr/local/bin/entrypoint.sh

ENTRYPOINT ["/usr/local/bin/entrypoint.sh"]
CMD ["apache2-foreground"]
