# Loggex v02 - Contexto para Claude Code

## ⚠️ Antes de empezar trabajo planificado: lee `docs/INDEX.md`

Es el índice maestro de todas las hojas de ruta con su estado real, los caminos críticos para producto comercial y la **regla obligatoria de bitácora**: cada punto completado se anota en el doc correspondiente antes de cerrar la sesión, sin excepciones.

## Naturaleza del Proyecto
Plataforma de gestión académica para centros educativos (tipo TFG). Gestión de usuarios, centros, itinerarios, materias, grupos, matrículas, horarios, asistencia, tareas, temarios y mensajería.

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

> Nota: el rename `CicloFormativo→Itinerario / Modulo→Materia / Material→Temario / Tema→TemaVisual` se ejecutó para alinear el vocabulario con el catálogo oficial y dejar las entidades neutras frente a la etapa educativa (FP, ESO, Bach, Uni). Plan completo: `docs/hoja-de-ruta-rename-fp-neutral.md`. Los copys de la UI (i18n en 5 idiomas) se actualizaron en abr-2026 para usar el vocabulario neutro: "Itinerario(s)", "Materia(s)", "Temario(s)" — incluyendo el sidebar, tutoriales y descripciones.

## Catálogo oficial (estado)
- **230 itinerarios** y **~2 230 materias** cargados desde BOE.
- **Etapas implementadas**: FP Básica/Medio/Superior/Especialización (vía TodoFP + BOE) + ESO (RD 217/2022 LOMLOE).
- **Vistas admin** read-only en `/admin/catalogo/*` con `DataProvenanceBanner`.
- **Refresh manual**: `app:catalogo:refresh [todofp_http|boe_eso]` + `app:catalogo:enrich-boe` (idempotente).
- **Doc de referencia**: `docs/catalogo-oficial.md` (con §0 mapa rápido al inicio).
- **Currículo por CCAA** (overlay): Fases 1+2 ✅ implementadas (modelo + refactor `materia.horasSemanales` → `materia.minutosSemanales`). Fase 3 (adapter BOJA Andalucía piloto) es lo siguiente. Roadmap dedicado: `docs/hoja-de-ruta-curriculum-ccaa.md`. El solver y editor de horarios trabajan en minutos (D24=A); el endurecimiento del solver para producción está en `docs/hoja-de-ruta-jornadas-recreos.md` §14.

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
- **Frontend CRUD**: Las páginas CRUD siguen un patrón similar (DataTable + formularios modales)
- **Componentes clave**: `DataTable` (tabla con paginación/ordenación), `TimeTable` (horario semanal visual), `CalendarView` (calendario mensual)

### ⚠️ REGLA DE ORO — TEMATIZACIÓN OBLIGATORIA (no negociable)

**Todo elemento de UI debe responder al tema activo en cada momento.** Cada centro elige ~80+ variables CSS (colores, opacidades, radios, blur, fondos animados, paginación, sidebar, scrollbar, calendarios, modales…) que se inyectan dinámicamente vía `frontend/src/utils/theme.js` sobre `:root`. Hardcodear estilos rompe la promesa central del producto.

**Prohibido:**
- ❌ Colores hex/rgb/hsl literales en JSX o CSS modules para fondos, bordes, textos, sombras, gradientes (ej. `color: '#64748b'`, `background: '#fff'`, `border: '1px solid #e5e7eb'`).
- ❌ Fallbacks hex en `var(--color-X, #XXXXXX)` — las variables están **siempre definidas** en `index.css`. El fallback es código muerto y oculta dependencias rotas. (Eliminados 62 fallbacks en pulido-ux Ronda 1 #5.)
- ❌ Radios, sombras, blur, opacidades fijos en componentes que el usuario tematiza.
- ❌ Renombrar variables existentes (`--bg-card`, `--color-primary-*`, `--bg-sidebar`, …).
- ❌ Usar literales en componentes nuevos "porque es solo un detalle". El detalle se acumula y el tema se rompe.

**Permitido:**
- ✅ Variables CSS del tema: `var(--bg-card)`, `var(--color-primary-500)`, `var(--text-main)`, `var(--text-muted)`, `var(--bg-sidebar)`, etc.
- ✅ Colores semánticos definidos en `index.css`: `--color-success/warning/error/danger/info` (siempre presentes).
- ✅ `color-mix(in srgb, var(--color-primary-500), …)` para derivados sutiles (focus rings, hovers).
- ✅ Tokens de motion (`--dur-fast`, `--ease-out-back`, …) — son ortogonales al tema.
- ✅ Tipografía, espaciado, micro-interacciones, animaciones (no afectan al tema visual del centro).

**Casos límite documentados:**
- `Configuracion.jsx` previews (placeholders neutros que NO representan la app real → exentos por diseño).
- `Perfil.jsx` firma sobre `#fff` (representa "papel" donde se ve la firma → deuda menor anotada, no rota nada).

**Doc dedicado**: `docs/modernizacion-ui.md` §"REGLA DE ORO" tiene la versión extendida con ejemplos. Antes de tocar UI nueva o existente: lee esa sección y comprueba que todo lo que añades se rige por variables del tema.

- **Live updates (Mercure)**: Toda entidad cuyas vistas se beneficien de tiempo real lleva `#[LivePublish]` (ver `backend/src/Attribute/LivePublish.php`). El `LivePublishSubscriber` genérico publica al hub en cada postPersist/Update/Remove. En el frontend, las páginas CRUD usan `useLiveRefetch(topics, refetchFn)` (variante ligera para CRUD complejos con paginación/filtros) o `useLiveCollection(...)` (para listas simples). Topic estándar: `/admin/centros/{cid}/{recurso}` para vistas admin, `/admin/{recurso}` para topics planos. Tras `mysql -e 'INSERT/UPDATE...'` o seeds SQL ejecutar `app:mercure:invalidate -t /topic` para que los clientes conectados refresquen. Doc dedicado: `docs/hoja-de-ruta-redis-workers.md` §"Bitácora Live CRUD".
- **Live updates (Mercure)**: Toda entidad cuyas vistas se beneficien de tiempo real lleva `#[LivePublish]` (ver `backend/src/Attribute/LivePublish.php`). El `LivePublishSubscriber` genérico publica al hub en cada postPersist/Update/Remove. En el frontend, las páginas CRUD usan `useLiveRefetch(topics, refetchFn)` (variante ligera para CRUD complejos con paginación/filtros) o `useLiveCollection(...)` (para listas simples). Topic estándar: `/admin/centros/{cid}/{recurso}` para vistas admin, `/admin/{recurso}` para topics planos. Tras `mysql -e 'INSERT/UPDATE...'` o seeds SQL ejecutar `app:mercure:invalidate -t /topic` para que los clientes conectados refresquen. Doc dedicado: `docs/hoja-de-ruta-redis-workers.md` §"Bitácora Live CRUD".

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
