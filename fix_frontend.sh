#!/bin/bash
echo "Reinstalando dependencias de frontend..."
docker compose exec frontend npm install
docker compose exec frontend npm install lucide-react
echo "Reiniciando contenedor frontend..."
docker compose restart frontend
echo "Listo."
