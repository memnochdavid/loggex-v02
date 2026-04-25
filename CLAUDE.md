# Loggex v02 - Contexto para Claude Code

## Naturaleza del Proyecto
Plataforma de gestión académica para centros educativos (tipo TFG). Gestión de usuarios, centros, ciclos formativos, módulos, grupos, matrículas, horarios, asistencia, tareas, materiales y mensajería.

## Stack Tecnológico
- **Backend**: PHP 8.4 + Symfony 7/8 + API Platform 3 (API REST JSON-LD)
- **Frontend**: React 19 + Vite 7 + React Router 7 + CSS Modules + Lucide Icons
- **BD**: MariaDB 10.11
- **Proxy**: Caddy (HTTPS local)
- **Storage**: MinIO (S3-compatible, bucket `loggex-data`)
- **Auth**: JWT (LexikJWT)
- **Orquestación**: Docker Compose

## Estructura del Proyecto
```
backend/
  src/Entity/          # Entidades Doctrine + recursos API Platform
  src/Controller/      # Controladores custom (uploads, queries especiales)
  src/Doctrine/        # Extensions (CurrentUserExtension - filtro por centro)
  src/State/           # Procesadores (SoftDelete)
  src/Entity/Traits/   # TimestampableTrait, SoftDeletableTrait
frontend/
  src/pages/           # Vistas (JSX + CSS Modules)
  src/components/      # Componentes reutilizables (DataTable, TimeTable, CalendarView, Sidebar...)
  src/context/         # AuthContext, UIContext
  src/utils/           # theme.js (inyección dinámica de CSS)
```

## Entidades Principales
**Centro:** User, Centro, Itinerario, Materia, Grupo, Matricula, Imparticion, Horario, Festivo, Personalizacion, Asistencia, Calificacion, Tarea, Entrega, Temario, TemaVisual, Mensaje, Comunicado.

**Catálogo oficial (read-only):** CatalogoItinerario, CatalogoMateria, CatalogoCentro.

> Nota: el rename `CicloFormativo→Itinerario / Modulo→Materia / Material→Temario / Tema→TemaVisual` se ejecutó para alinear el vocabulario con el catálogo oficial y dejar las entidades neutras frente a la etapa educativa (FP, ESO, Bach, Uni). Plan completo: `docs/hoja-de-ruta-rename-fp-neutral.md`.

## Roles de Usuario
`ROLE_SUPERADMIN`, `ROLE_ADMIN`, `ROLE_PROFESOR`, `ROLE_ALUMNO`

## URLs de Desarrollo
- Frontend: https://localhost:8443
- Backend API: https://localhost:9443/api
- MinIO Console: http://localhost:9001
- BD: localhost:3307 (app_user / app_password / app_db)

## Patrones y Convenciones
- **Soft Delete**: Los registros se marcan `deleted = true`, no se eliminan físicamente
- **Timestamps**: `TimestampableTrait` para `createdAt`/`updatedAt` automáticos
- **Seguridad por centro**: `CurrentUserExtension` filtra datos automáticamente para no-SuperAdmin
- **Estilos**: CSS Modules (`Componente.module.css`), tematización dinámica por centro
- **Frontend CRUD**: Las páginas CRUD siguen un patrón similar (DataTable + formularios modales)
- **Componentes clave**: `DataTable` (tabla con paginación/ordenación), `TimeTable` (horario semanal visual), `CalendarView` (calendario mensual)

## Comandos Útiles
```bash
# Levantar proyecto
./scripts/init.sh  # (o scripts\init.bat en Windows)

# Backend (dentro del contenedor)
docker compose exec backend php bin/console cache:clear
docker compose exec backend php bin/console make:entity
docker compose exec backend php bin/console doctrine:migrations:migrate

# Frontend
docker compose exec frontend npm install [paquete]
```

## Git
- Rama principal: `master`
- Rama de desarrollo actual: `develop-windows`
- No trabajar directamente en `main`/`master`

## Notas
- Los scripts `.sh` y `.bat` están en `scripts/` (duplicados Linux/Windows)
- Los backups de BD están en la raíz (`backup_tfg*.sql`)
- MinIO backup en `minio_backup/`
- Idioma del proyecto: español (commits, docs, variables de negocio)
