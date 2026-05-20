# Loggex v02 - Skeleton Project (HTTPS)

Este proyecto es un esqueleto base para aplicaciones web modernas utilizando **Symfony 8 (Backend)** y **React + Vite (Frontend)**, orquestado con **Docker** y servido vía **HTTPS** mediante Caddy.

## 🚀 Inicio Rápido (Nuevo Proyecto)

Si estás creando el proyecto desde cero:

```bash
chmod +x scripts/setup.sh
./scripts/setup.sh
```

## 🔄 Inicio Rápido (Clonar Proyecto Existente)

Si acabas de clonar este repositorio desde Git en un equipo nuevo, sigue estos pasos en orden.

> **⚠️ Linux vs Windows**
>
> **Linux es el entorno recomendado para desplegar y desarrollar este proyecto.** Docker funciona de forma nativa y el rendimiento es óptimo.
>
> **En Windows, instala y clona el proyecto DENTRO de WSL** (Windows Subsystem for Linux). Docker Desktop se integra con WSL y los contenedores corren sobre el kernel Linux.
>
> **NO clones el proyecto en el filesystem de Windows** (`C:\Users\...\`) si luego vas a usar Docker Desktop. El volumen montado sobre el filesystem NTFS a través de la capa de compatibilidad de Docker hace que las operaciones de base de datos (especialmente las migraciones Doctrine y las consultas con JOINs) sean **extremadamente lentas** — lo que tarda 2 segundos en WSL puede tardar 30-60 segundos fuera de WSL.
>
> **Forma correcta en Windows:**
> 1. Abre una terminal WSL (`wsl` desde PowerShell/CMD, o abre Ubuntu desde el menú Inicio).
> 2. Clona el proyecto dentro del filesystem de WSL: `git clone ... ~/loggex-v02`
> 3. Sigue los pasos de **Linux** que aparecen abajo.
>
> **Forma alternativa (no recomendada):** si necesitas trabajar desde cmd.exe/PowerShell fuera de WSL, usa los scripts `.bat` que aparecen más abajo, pero espera un rendimiento muy inferior en operaciones de base de datos.

### Linux (nativo o WSL)

1. **Dar permisos a los scripts**:
   ```bash
   chmod +x scripts/init.sh scripts/migrate.sh scripts/force_update.sh scripts/restore_db.sh scripts/restore_storage.sh
   ```

2. **Levantar contenedores + instalar dependencias**:
   ```bash
   ./scripts/init.sh
   ```
   *Levanta todos los contenedores, instala dependencias PHP (composer) y JS (npm), genera claves JWT.*

3. **Aplicar migraciones pendientes**:
   ```bash
   ./scripts/migrate.sh
   ```
   *Si las migraciones fallan (schema desalineado), usa `./scripts/force_update.sh` como alternativa.*

4. **Restaurar base de datos** (datos de prueba):
   ```bash
   ./scripts/restore_db.sh
   ```

5. **Restaurar archivos de almacenamiento** (avatares, logos, entregas, catálogo):
   ```bash
   ./scripts/restore_storage.sh
   ```

### Windows (cmd.exe / PowerShell — fuera de WSL, no recomendado)

> **Antes de empezar:** asegúrate de tener **Docker Desktop** instalado y en ejecución. Sin él, los contenedores no arrancarán.

1. **Levantar contenedores + instalar dependencias**:
   ```cmd
   scripts\init.bat
   ```
   *Si `composer install` o `npm install` fallan por problemas de red, ejecútalos manualmente:*
   ```cmd
   docker compose exec backend composer install
   docker compose exec frontend npm install
   ```

2. **Aplicar migraciones pendientes**:
   ```cmd
   scripts\migrate.bat
   ```
   *Si las migraciones fallan (schema desalineado), usa `scripts\force_update.bat` como alternativa.*

3. **Restaurar base de datos** (datos de prueba):
   ```cmd
   scripts\restore_db.bat
   ```

4. **Restaurar archivos de almacenamiento** (avatares, logos, entregas, catálogo):
   ```cmd
   scripts\restore_storage.bat
   ```

> **¿Qué hace cada script?**
>
> | Script | Función |
> |---|---|
> | `init` | `docker compose up -d --build`, `composer install`, `npm install`, genera claves JWT. Levanta todo el stack y descarga dependencias. |
> | `migrate` | `doctrine:migrations:migrate` + `cache:clear` + restart backend. Aplica las migraciones Doctrine que versionan el esquema de BD. |
> | `force_update` | `doctrine:schema:update --force --complete` + regenera JWT + rebuild sin caché. Alternativa cuando las migraciones fallan por desalineación entre entidades y BD. |
> | `restore_db` | Inyecta `backup_tfg_full.sql` en MariaDB. Puebla la BD con datos de prueba (usuarios, centros, itinerarios, materias, etc.). |
> | `restore_storage` | Restaura el contenido de `minio_backup/` en el bucket `loggex-data` de MinIO. Recupera avatares, logos de centros, entregas, materiales del catálogo y firmas. |

---

## 📥 Actualización de Cambios (Git Pull)

Si ya tienes el proyecto y has bajado cambios recientes (`git pull`), sigue estos pasos para asegurar que todo funcione (especialmente si hubo cambios en infraestructura o base de datos):

1. **Arreglar permisos y entorno**:
   ```bash
   ./scripts/fix_env.sh
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
El proyecto incluye `lexik/jwt-authentication-bundle`. Las claves RSA se generan automáticamente en `config/jwt/` al ejecutar `./scripts/init.sh`.

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
- `scripts/setup.sh` / `setup.bat`: Script para crear el proyecto desde cero (scaffolding).
- `scripts/init.sh` / `init.bat`: Levantar contenedores + instalar dependencias + generar JWT (bootstrapping).
- `scripts/migrate.sh` / `migrate.bat`: Aplicar migraciones Doctrine pendientes + limpiar caché.
- `scripts/force_update.sh` / `force_update.bat`: Forzar actualización del schema + rebuild sin caché (alternativa a migrate).
- `scripts/restore_db.sh` / `restore_db.bat`: Restaurar BD desde `backup_tfg_full.sql`.
- `scripts/restore_storage.sh` / `restore_storage.bat`: Restaurar bucket MinIO desde `minio_backup/`.
- `scripts/fix_env.sh` / `fix_env.bat`: Corregir permisos, claves JWT y entorno.

## 🔧 Solución de Problemas

**Rendimiento lento en Windows (fuera de WSL)**
Si las consultas a la base de datos, las migraciones o el `composer install` son extremadamente lentos, es porque el proyecto está clonado en el filesystem de Windows (`C:\Users\...`) y Docker lo monta a través de la capa de compatibilidad NTFS→ext4. **Solución:** clona el proyecto dentro de WSL (`~/` en Ubuntu) y usa Docker Desktop con integración WSL habilitada. La diferencia es de 10x a 30x en operaciones de BD.

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

TODO: mercure hub para actualizaciones