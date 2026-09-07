FROM php:8.4-fpm

RUN apt-get update && apt-get install -y \
    nginx \
    git curl zip unzip \
    libpng-dev libonig-dev libxml2-dev libzip-dev libicu-dev libpq-dev \
    supervisor \
    && docker-php-ext-install pdo pdo_mysql pdo_pgsql mbstring zip exif pcntl gd intl \
    && apt-get clean && rm -rf /var/lib/apt/lists/*

COPY --from=composer:latest /usr/bin/composer /usr/bin/composer

WORKDIR /var/www/html

COPY composer.json composer.lock ./

RUN composer install --no-dev --optimize-autoloader --no-interaction --no-scripts

COPY . .

RUN composer dump-autoload --optimize

RUN rm /etc/nginx/sites-enabled/default
COPY conf/nginx/nginx-site.conf /etc/nginx/sites-enabled/default

RUN chown -R www-data:www-data /var/www/html/storage /var/www/html/bootstrap/cache

EXPOSE 80

#CMD ["/bin/sh", "-c", "php artisan migrate --force && php-fpm -D && nginx -g 'daemon off;' & php artisan db:seed --force && wait"]
COPY scripts/start.sh /start.sh
RUN chmod +x /start.sh
CMD ["/start.sh"]