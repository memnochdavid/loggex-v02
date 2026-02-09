#!/bin/bash
echo "--- PUERTOS ESCUCHANDO EN CADDY ---"
docker compose exec caddy netstat -tuln
