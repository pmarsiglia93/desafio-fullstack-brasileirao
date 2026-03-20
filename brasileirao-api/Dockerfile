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
    && docker-php-ext-install pdo pdo_mysql pdo_sqlite zip

COPY --from=composer:2 /usr/bin/composer /usr/bin/composer

COPY . .

EXPOSE 8000