FROM php:8.4-cli

WORKDIR /var/www

RUN apt-get update && apt-get install -y \
    git \
    unzip \
    zip \
    libzip-dev \
    libpq-dev \
    libsqlite3-dev \
    default-mysql-client \
    && docker-php-ext-install pdo pdo_mysql pdo_pgsql pdo_sqlite zip

COPY --from=composer:2 /usr/bin/composer /usr/bin/composer

COPY . .

RUN composer install --no-dev --optimize-autoloader --no-interaction --no-scripts \
    && mkdir -p storage/logs storage/framework/cache/data storage/framework/sessions storage/framework/views \
    && chmod -R 777 storage bootstrap/cache

COPY start.sh /start.sh
RUN chmod +x /start.sh

EXPOSE 8000

CMD ["/start.sh"]
