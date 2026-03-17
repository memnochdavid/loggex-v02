# Loggex v02 - Documentación Técnica

## Descripción General
Loggex v02 es una plataforma de gestión académica diseñada para centros educativos. Permite la administración de usuarios (alumnos, profesores, administradores), centros, ciclos formativos, módulos, grupos y matrículas.

El sistema está construido con una arquitectura moderna de microservicios utilizando Docker, separando claramente el Backend (API REST) del Frontend (SPA).

## Arquitectura del Sistema

### Contenedores Docker
El proyecto se orquesta mediante `docker-compose` con los siguientes servicios:

1.  **Backend (`loggex-backend`)**:
    *   **Tecnología**: PHP 8.4 + Apache.
    *   **Framework**: Symfony 7 (con API Platform 3).
    *   **Función**: API RESTful, lógica de negocio, seguridad, gestión de base de datos.
2.  **Frontend (`loggex-frontend`)**:
    *   **Tecnología**: React 18 + Vite.
    *   **Función**: Interfaz de usuario (SPA), consumo de API.
3.  **Database (`loggex-db`)**:
    *   **Tecnología**: MariaDB 10.11.
    *   **Función**: Persistencia de datos relacional.
4.  **Caddy (`loggex-caddy`)**:
    *   **Tecnología**: Caddy Web Server.
    *   **Función**: Proxy inverso, terminación SSL (HTTPS local), enrutamiento de tráfico hacia frontend y backend.

### Puertos y URLs
*   **Frontend**: `https://localhost:8443`
*   **Backend API**: `https://localhost:9443/api`
*   **Base de Datos**: `localhost:3307` (mapeado al 3306 interno)

---

## Backend (Symfony + API Platform)

### Estructura de Directorios
*   `src/Entity`: Definición de modelos de datos (ORM) y recursos API.
*   `src/Controller`: Controladores personalizados para lógica compleja (ej: subida de archivos, login custom).
*   `src/Doctrine`: Extensiones de Doctrine para filtrado automático (ej: seguridad por centro).
*   `src/State`: Procesadores de estado (ej: Soft Delete).
*   `src/Entity/Traits`: Traits reutilizables (`TimestampableTrait`, `SoftDeletableTrait`).

### Entidades Principales
*   **User**: Usuarios del sistema (Alumnos, Profesores, Admins, SuperAdmin).
*   **Centro**: Centros educativos.
*   **CicloFormativo**: Ciclos ofertados por un centro.
*   **Modulo**: Asignaturas de un ciclo.
*   **Grupo**: Grupos de alumnos (ej: 1º DAW).
*   **Matricula**: Relación entre Alumno y Grupo.
*   **Personalizacion**: Configuración de colores y estilos por centro.

### Características Clave
*   **API Platform**: Exposición automática de recursos REST (JSON-LD, Hydra).
*   **Seguridad**:
    *   Autenticación JWT (`lexik/jwt-authentication-bundle`).
    *   Control de acceso basado en roles (`ROLE_SUPERADMIN`, `ROLE_ADMIN`, `ROLE_PROFESOR`, `ROLE_ALUMNO`).
    *   Filtrado de datos por centro (`CurrentUserExtension`).
*   **Soft Delete**: Los registros no se borran físicamente, se marcan como `deleted = true`.
*   **Timestampable**: Registro automático de `createdAt` y `updatedAt`.
*   **Personalización**: Sistema de temas dinámicos almacenados en BD.

---

## Frontend (React + Vite)

### Estructura de Directorios
*   `src/pages`: Vistas principales (Login, Home, Usuarios, Centros, etc.).
*   `src/components`: Componentes reutilizables (`DataTable`, `SearchBar`, `Button`, `Sidebar`).
*   `src/context`: Contextos globales (`AuthContext`, `LayoutContext`).
*   `src/layout`: Estructura base (`Header`, `Footer`).
*   `src/utils`: Utilidades (`theme.js` para inyección de estilos).

### Características Clave
*   **React Router**: Navegación SPA.
*   **Context API**: Gestión de estado global (Autenticación, Tema).
*   **CSS Modules**: Estilos encapsulados por componente.
*   **Tematización Dinámica**: Inyección de variables CSS y estilos de scrollbar en tiempo real según la configuración del centro.
*   **Componentes Reutilizables**:
    *   `DataTable`: Tabla con paginación, ordenación y acciones.
    *   `SearchBar`: Barra de búsqueda con selector de campos.
    *   `UserAvatar`: Avatar con menú desplegable.

---

## Base de Datos

### Esquema Relacional
*   **Relaciones**:
    *   Centro 1:N User
    *   Centro 1:N CicloFormativo
    *   Centro 1:N Grupo
    *   CicloFormativo 1:N Modulo
    *   CicloFormativo 1:N Grupo
    *   Grupo 1:N Matricula
    *   User 1:N Matricula
    *   Centro 1:1 Personalizacion

### Migraciones
Se utiliza `Doctrine Migrations` para versionar y desplegar cambios en el esquema de base de datos.

---

## Despliegue y Desarrollo

### Requisitos
*   Docker y Docker Compose.

### Comandos Útiles
*   **Iniciar**: `./scripts/init.sh` (Levanta todo, instala dependencias, migra BD).
*   **Limpiar Caché Backend**: `docker compose exec backend php bin/console cache:clear`
*   **Crear Migración**: `docker compose exec backend php bin/console make:migration`
*   **Ejecutar Migración**: `docker compose exec backend php bin/console doctrine:migrations:migrate`
*   **Cargar Fixtures**: `docker compose exec backend php bin/console doctrine:fixtures:load`

### Scripts de Utilidad
*   `scripts/init.sh`: Script maestro de inicialización.
*   `fix_api_platform_docker.sh`: Repara configuración de API Platform si se corrompe.
*   `fix_composer.sh`: Reinstala dependencias críticas del backend.
*   `fix_dates.sh`: Rellena fechas nulas en la BD.
*   `fix_frontend.sh`: Reinstala dependencias del frontend.
*   `migrate_personalizacion.sh`: Ejecuta migraciones pendientes.

---

## Notas de Seguridad
*   El sistema utiliza HTTPS autofirmado en desarrollo (Caddy).
*   Las contraseñas se almacenan hasheadas (bcrypt/argon2).
*   El acceso a la API está protegido por JWT.
*   Los archivos subidos se almacenan en volúmenes persistentes pero se sirven públicamente a través de Apache/Caddy.
