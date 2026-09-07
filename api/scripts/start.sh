#!/bin/sh

echo "Running migrations..."
php artisan migrate --force

echo "Starting PHP-FPM..."
php-fpm -D

echo "Starting Nginx..."
nginx -g 'daemon off;' &

# echo "Seeding database..."
# php artisan db:seed --force

# echo "Fixing protocol ratings..."
# php artisan protocols:recalculate-ratings

echo "Indexing Typesense..."
# php artisan scout:import 'App\Models\Protocol'
# php artisan scout:import 'App\Models\Thread'
php artisan typesense:reindex

echo "Ingesting knowledgebase PDF into vector store..."
php artisan pdf:ingest Knowledgebased.pdf || echo "WARNING: PDF ingestion failed — chat will fall back to KB-only"

echo "Done!"
wait
