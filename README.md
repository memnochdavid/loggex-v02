# Loggex v02 - SaaS Educativo (HTTPS)

Este proyecto es una plataforma SaaS para la gestión de centros educativos, construida con **Symfony 8 + API Platform (Backend)** y **React + Vite (Frontend)**, orquestada con **Docker** y servida vía **HTTPS** mediante Caddy.

## 🚀 Inicio Rápido (Clonar Proyecto)

Si acabas de clonar este repositorio en un equipo nuevo:

1. Dale permisos al script de inicialización:
   ```bash
   chmod +x init.sh
   ```

2. Ejecuta el script para instalar dependencias, levantar contenedores e importar la base de datos:
   ```bash
   ./init.sh
   ```

---

## 🛠️ Acceso y Credenciales

### URLs
- **Frontend (App)**: [https://localhost:8443](https://localhost:8443)
- **Backend API (Swagger/Docs)**: [https://localhost:9443/api](https://localhost:9443/api)
- **Backend Hello**: [https://localhost:9443/api/hello](https://localhost:9443/api/hello)

### Base de Datos (MariaDB)
- **Host**: `localhost`
- **Puerto**: `3306`
- **Usuario**: `app_user`
- **Contraseña**: `app_password`
- **Base de Datos**: `app_db`
- **Root Password**: `root_password`

### Usuarios de Prueba (Login)
Puedes usar cualquiera de los usuarios existentes en la base de datos importada.
- **Email Admin**: `admin@loggex.com`
- **Email Profesor**: `alberto@eag.com`
- **Email Alumno**: `vega.ferrer@alvarez.es`

*(Nota: Las contraseñas están hasheadas en la BD. Si no conoces la contraseña original, puedes crear un nuevo usuario o actualizar el hash en la tabla `usuario`).*

---

## 🌿 Flujo de Trabajo (Git)

1. **Actualiza main**: `git checkout main && git pull origin main`
2. **Crea rama**: `git checkout -b feature/mi-tarea`
3. **Desarrolla y Commit**: `git add . && git commit -m "..."`
4. **Push**: `git push origin feature/mi-tarea`

---

## 📦 Arquitectura del Proyecto

### Backend (`backend/`)
- **API Platform**: Expone automáticamente una API REST completa basada en las entidades.
- **Autenticación**: Login JSON (`/api/login`) y Sesiones (Cookies).
- **Entidades (`src/Entity/`)**: Modelo de datos completo (Centro, Usuario, Grupo, etc.).
- **Seguridad**: `config/packages/security.yaml` configura el firewall y control de acceso.

### Frontend (`frontend/`)
- **React + Vite**: SPA moderna.
- **AuthContext**: Manejo de sesión global.
- **CSS Modules**: Estilos encapsulados por componente.
- **Estructura**:
  - `src/pages/`: Vistas (Login, Home, etc.).
  - `src/components/`: Componentes reutilizables.
  - `src/context/`: Lógica global (Auth).

### Infraestructura
- **Docker**: Contenedores para PHP, Caddy, MariaDB y Node.
- **Caddy**: Proxy inverso que maneja HTTPS automáticamente (certificados locales).
- **MariaDB**: Base de datos relacional compatible con MySQL.

---

## 🔧 Comandos Útiles

**Backend (Symfony)**
```bash
# Instalar paquete
docker compose exec backend composer require [paquete]

# Actualizar esquema de BD (si cambias entidades)
docker compose exec backend php bin/console doctrine:schema:update --force

# Limpiar caché
docker compose exec backend php bin/console cache:clear
```

**Frontend (React)**
```bash
# Instalar paquete
docker compose exec frontend npm install [paquete]
```

**Docker**
```bash
# Reiniciar todo reconstruyendo imágenes
docker compose up -d --build

# Ver logs
docker compose logs -f [servicio]
```
