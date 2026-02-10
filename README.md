# Loggex v02 - Skeleton Project (HTTPS)

Este proyecto es un esqueleto base para aplicaciones web modernas utilizando **Symfony 8 (Backend)** y **React + Vite (Frontend)**, orquestado con **Docker** y servido vía **HTTPS** mediante Caddy.

## 🚀 Inicio Rápido (Nuevo Proyecto)

Si estás creando el proyecto desde cero:

```bash
chmod +x setup.sh
./setup.sh
```

## 🔄 Inicio Rápido (Clonar Proyecto Existente)

Si acabas de clonar este repositorio desde Git en un equipo nuevo:

1. Dale permisos al script de inicialización:
   ```bash
   chmod +x init.sh
   ```

2. Ejecuta el script para instalar dependencias y levantar todo:
   ```bash
   ./init.sh
   ```
   *Este script se encarga de levantar Docker, instalar dependencias (Composer/NPM), generar claves JWT y ejecutar migraciones.*

---

## 📥 Actualización de Cambios (Git Pull)

Si ya tienes el proyecto y has bajado cambios recientes (`git pull`), sigue estos pasos para asegurar que todo funcione (especialmente si hubo cambios en infraestructura o base de datos):

1. **Arreglar permisos y entorno**:
   ```bash
   ./fix_env.sh
   ```

2. **Reconstruir contenedores** (para aplicar cambios en Caddy/PHP):
   ```bash
   docker compose down
   docker compose up -d --build
   ```

3. **Actualizar Base de Datos** (si hubo cambios en Entidades):
   ```bash
   docker compose exec backend php bin/console doctrine:schema:update --force
   ```

4. **Limpiar Caché** (siempre recomendado):
   ```bash
   docker compose exec backend php bin/console cache:clear
   ```

---

## 🌿 Flujo de Trabajo Recomendado (Git)

Para mantener el proyecto ordenado, **nunca trabajes directamente en la rama `main`**.

1. **Asegúrate de estar actualizado**:
   ```bash
   git checkout main
   git pull origin main
   ```

2. **Crea una Rama (Branch)** para tu tarea:
   ```bash
   git checkout -b feature/nombre-funcionalidad
   ```

3. **Desarrolla y Sube**:
   ```bash
   git add .
   git commit -m "Descripción clara"
   git push origin feature/nombre-funcionalidad
   ```

---

## 🛠️ Guía de Desarrollo

### Acceso Seguro (HTTPS)
- **Frontend**: [https://localhost:8443](https://localhost:8443)
- **Frontend (HTTP)**: [http://localhost:8888](http://localhost:8888)
- **Backend API**: [https://localhost:9443/api](https://localhost:9443/api) (Swagger UI)
- **Base de Datos (MariaDB)**: Puerto `3307`
  - Usuario: `app_user`
  - Contraseña: `app_password`
  - Base de datos: `app_db`

### Comandos Backend (Symfony)
Ejecutar siempre dentro del contenedor:
```bash
docker compose exec backend php bin/console [comando]
```
- **Crear Entidad**: `make:entity`
- **Crear Controlador**: `make:controller`
- **Limpiar Caché**: `cache:clear`

**Autenticación JWT**:
El proyecto incluye `lexik/jwt-authentication-bundle`. Las claves RSA se generan automáticamente en `config/jwt/` al ejecutar `./init.sh`.

### Comandos Frontend (React)
```bash
docker compose exec frontend npm install [paquete]
```
**Nota**: Si usas un IDE como PHPStorm, instala también las dependencias en tu máquina local (`cd frontend && npm install`) para tener autocompletado.

---

## 📦 Estructura del Repositorio

### Backend (`backend/`)
- `src/Controller/`: Controladores de la API.
- `src/Entity/`: Entidades de Doctrine (Base de Datos).
- `config/routes.yaml`: Definición de rutas.

### Frontend (`frontend/`)
- `src/components/`: Componentes reutilizables (Botones, Inputs, Cards).
- `src/layout/`: Componentes estructurales (Header, Sidebar).
- `src/pages/`: Vistas completas (Home, Login, Horarios).
- `src/App.jsx`: Router y Layout principal.
- `src/index.css`: Variables globales de diseño (:root).

**Estilos (CSS Modules):**
Se recomienda usar CSS Modules.
- Archivo: `NombreComponente.module.css`
- Uso: `import styles from './Nombre.module.css'` -> `className={styles.clase}`

### Infraestructura
- `docker-compose.yml`: Orquestación de servicios.
- `Caddyfile`: Configuración del Proxy HTTPS.
- `setup.sh`: Script para crear el proyecto desde cero (scaffolding).
- `init.sh`: Script para instalar dependencias tras clonar (bootstrapping).
- `fix_env.sh`: Script para corregir permisos y claves JWT.

## 🔧 Solución de Problemas

**Compatibilidad con Fedora (SELinux)**
La configuración de Docker incluye el flag `:z` en los volúmenes para compatibilidad con SELinux.

**Puerto ocupado**
- Frontend: 8443
- Backend: 9443
- Base de Datos: 3307
Si alguno está ocupado, edita `docker-compose.yml`.

**Permisos en Linux**
```bash
sudo chown -R $USER:$USER backend/ frontend/
```

## 🌐 Acceso Externo (Ngrok)

Si necesitas probar la aplicación desde un móvil o compartirla externamente:

1. **Instalar Ngrok** (Ubuntu/Debian):
   ```bash
   curl -s https://ngrok-agent.s3.amazonaws.com/ngrok.asc | sudo tee /etc/apt/trusted.gpg.d/ngrok.asc >/dev/null
   echo "deb https://ngrok-agent.s3.amazonaws.com buster main" | sudo tee /etc/apt/sources.list.d/ngrok.list
   sudo apt update && sudo apt install ngrok
   ```

2. **Exponer Servicios**:
   - **Frontend (HTTPS)**: `ngrok http https://localhost:8443`
   - **Frontend (HTTP)**: `ngrok http 8888`
   - **Backend (HTTPS)**: `ngrok http https://localhost:9443`
