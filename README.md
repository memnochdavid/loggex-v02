# Loggex v02 - Skeleton Project (HTTPS)

Este proyecto es un esqueleto base para aplicaciones web modernas utilizando **Symfony 8 (Backend)** y **React + Vite (Frontend)**, orquestado con **Docker** y servido vía **HTTPS** mediante Caddy.

## 🚀 Inicio Rápido (Nuevo Proyecto)

Si estás creando el proyecto desde cero:

```bash
chmod +x setup.sh
./setup.sh
```

## 🔄 Inicio Rápido (Clonar Proyecto Existente)

Si acabas de clonar este repositorio desde Git:

1. Dale permisos al script de inicialización:
   ```bash
   chmod +x init.sh
   ```

2. Ejecuta el script para instalar dependencias y levantar todo:
   ```bash
   ./init.sh
   ```

Este script se encargará de:
- Levantar los contenedores Docker.
- Instalar dependencias de PHP (`composer install`).
- Instalar dependencias de JS (`npm install`).
- Ejecutar migraciones de base de datos.

---

## 🛠️ Guía de Desarrollo

### Acceso Seguro (HTTPS)
- **Frontend**: [https://localhost:8443](https://localhost:8443)
- **Backend API**: [https://localhost:9443/api/hello](https://localhost:9443/api/hello)
- **Base de Datos**: Puerto `5432` (User: `app_user`, Pass: `app_password`, DB: `app_db`)

### Comandos Backend (Symfony)
Ejecutar siempre dentro del contenedor:
```bash
docker compose exec backend php bin/console [comando]
```
- Crear Entidad: `make:entity`
- Crear Controlador: `make:controller`
- Rutas: Editar `backend/config/routes.yaml`

### Comandos Frontend (React)
```bash
docker compose exec frontend npm install [paquete]
```

---

## 📦 Estructura del Repositorio

- `backend/`: Código Symfony.
- `frontend/`: Código React.
- `docker-compose.yml`: Orquestación.
- `Caddyfile`: Configuración del Proxy HTTPS.
- `setup.sh`: Script para crear el proyecto desde cero (scaffolding).
- `init.sh`: Script para instalar dependencias tras clonar (bootstrapping).

## 🔧 Solución de Problemas

**Puerto ocupado**
Si el puerto 8888 o 8443 está ocupado, edita `docker-compose.yml`.

**Permisos en Linux**
```bash
sudo chown -R $USER:$USER backend/ frontend/
```
