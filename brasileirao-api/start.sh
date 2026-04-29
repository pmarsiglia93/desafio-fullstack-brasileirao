#!/bin/sh
set -e

echo "==> Discovering packages..."
php artisan package:discover --ansi

echo "==> Caching config..."
php artisan config:cache

echo "==> Running migrations..."
php artisan migrate --force

echo "==> Running seeders..."
php artisan db:seed --force

echo "==> Syncing Brasileirao data in background..."
php artisan sync:brasileirao &

echo "==> Starting server on port 8000..."
exec php artisan serve --host=0.0.0.0 --port=8000
