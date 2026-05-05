#!/bin/bash
cd "$(dirname "$0")/.."

echo "🧹 Limpiando caché a fondo..."
docker compose exec backend rm -rf var/cache/dev
docker compose exec backend rm -rf var/cache/prod
docker compose exec backend php bin/console cache:clear

# Pools de cache.app (respaldados por Redis, no por filesystem). cache:clear
# y rm -rf var/cache no los tocan, así que respuestas cacheadas como
# `schedule_{userId}` (GetMyScheduleController, TTL 5min) sobreviven al
# restart del contenedor. Sin esta línea, los fixes que cambian el shape de
# una respuesta cacheada NO se notan hasta que expira el TTL.
echo "🔁 Purgando pools de cache.app (Redis: schedule_*, user_stats…)..."
docker compose exec backend php bin/console cache:pool:clear cache.app
docker compose exec backend php bin/console cache:pool:clear cache.user_stats

echo "🔄 Reiniciando backend (libera el Opcache de Apache para que recoja el nuevo container PHP)..."
docker compose restart backend

echo "✅ Caché eliminada y backend reiniciado."
