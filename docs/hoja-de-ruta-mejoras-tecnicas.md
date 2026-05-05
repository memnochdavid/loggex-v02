# Hoja de Ruta de Mejoras Tecnicas — Loggex v02

Plan de mejora progresiva del proyecto, organizado en fases con dependencias claras.
Cada paso incluye justificacion, alcance, criterios de aceptacion y estimacion de esfuerzo relativo.

---

## Indice

1. [Fase 1 — Seguridad basica](#fase-1--seguridad-basica)
2. [Fase 2 — Capa de servicio API en frontend](#fase-2--capa-de-servicio-api-en-frontend)
3. [Fase 3 — Migraciones de Doctrine](#fase-3--migraciones-de-doctrine)
4. [Fase 4 — Testing de logica critica](#fase-4--testing-de-logica-critica)
5. [Fase 5 — Sistema de auditoria](#fase-5--sistema-de-auditoria)
6. [Fase 6 — Modelo de datos academico](#fase-6--modelo-de-datos-academico)
7. [Fase 7 — Rendimiento y cache](#fase-7--rendimiento-y-cache)
8. [Fase 8 — Infraestructura y CI/CD](#fase-8--infraestructura-y-cicd)
9. [Fase 9 — UX avanzada y accesibilidad](#fase-9--ux-avanzada-y-accesibilidad)

---

## Tabla resumen

| Fase | Nombre | Prioridad | Esfuerzo | Dependencias |
|------|--------|-----------|----------|--------------|
| 1 | Seguridad basica | Critica | Bajo | Ninguna |
| 2 | Capa de servicio API frontend | Alta | Medio | Ninguna |
| 3 | Migraciones de Doctrine | Alta | Bajo | Ninguna |
| 4 | Testing de logica critica | Alta | Alto | Fases 1-3 |
| 5 | Sistema de auditoria | Alta | Medio | Fase 3 |
| 6 | Modelo de datos academico | Media | Alto | Fases 3, 5 |
| 7 | Rendimiento y cache | Media | Medio | Fase 2 |
| 8 | Infraestructura y CI/CD | Media | Medio | Fase 4 |
| 9 | UX avanzada y accesibilidad | Media | Alto | Fases 2, 6 |

---

## Fase 1 — Seguridad basica

**Prioridad:** Critica
**Esfuerzo:** Bajo (1-2 dias)
**Dependencias:** Ninguna — se puede ejecutar inmediatamente

### Justificacion

El proyecto tiene credenciales expuestas en el repositorio, endpoints sin autenticacion y ninguna proteccion contra fuerza bruta. Estos son vectores de ataque reales que deben cerrarse antes de cualquier despliegue.

### Tareas

#### 1.1 Secretos fuera del repositorio

- [ ] Mover todas las credenciales de `backend/.env` a `backend/.env.local` (ya esta en `.gitignore`)
- [ ] Dejar en `.env` solo valores placeholder con comentarios descriptivos
- [ ] Verificar que `docker-compose.yml` usa variables de entorno externas o un fichero `.env` en la raiz (no versionado)
- [ ] Cambiar `APP_SECRET` por un valor generado con `openssl rand -hex 32`
- [ ] Permisos `600` en `config/jwt/private.pem`

**Criterio de aceptacion:** `git grep -i password` no devuelve ningun secreto real.

#### 1.2 Rate limiting en login

- [ ] Instalar y configurar `symfony/rate-limiter`
- [ ] Aplicar limite en `/api/login`: maximo 5 intentos por IP en 15 minutos
- [ ] Devolver respuesta `429 Too Many Requests` con cabecera `Retry-After`

**Criterio de aceptacion:** 6 intentos fallidos consecutivos desde la misma IP devuelven 429.

#### 1.3 Proteccion de endpoints expuestos

- [ ] Anadir `#[IsGranted('ROLE_SUPERADMIN')]` a `DebugLogController`
- [ ] Anadir `#[IsGranted('ROLE_ADMIN')]` a las operaciones de escritura de `CentroController`
- [ ] Revisar que todos los controllers custom tienen anotaciones de seguridad
- [ ] **🐛 BUG REAL DETECTADO 2026-05-05** — la ruta `/centros` (gestión de centros) es accesible desde un **admin de centro** cuando debería ser exclusiva de SuperAdmin. Verificado en sesión por el usuario. Acción concreta:
  - Backend: confirmar que las operaciones de `Centro` (entidad + controller custom si lo hay) exigen `ROLE_SUPERADMIN` (no solo `ROLE_ADMIN`) en `Get`, `GetCollection`, `Post`, `Put`, `Delete`.
  - Frontend: `App.jsx` o equivalente debe envolver la ruta `/centros` con un guard `requireRole='ROLE_SUPERADMIN'`; el sidebar ya esconde el enlace para no-superadmin pero la URL directa funciona — la causa del fallo. Reusar el patrón de guard de otras vistas SuperAdmin-only si existe; si no, crearlo aquí.
  - Test: 401/403 al hacer `GET /api/centros` con JWT de admin de centro; redirección al home si navega a `/centros` con sesión admin.

**Criterio de aceptacion:** peticiones anonimas a estos endpoints devuelven 401/403; un admin de centro autenticado recibe 403 en `/api/centros` y es redirigido al intentar `GET /centros` en el frontend.

#### 1.4 Validacion de uploads

- [ ] Validar tipo MIME real del archivo (no solo extension) en `UploadMaterialController`, `UploadTareaController`, `UploadEntregaController`
- [ ] Definir whitelist de tipos permitidos por tipo de upload (ej: materiales acepta PDF, DOCX, PPTX, imágenes; avatares solo imagenes)
- [ ] Limitar tamano maximo por tipo de upload

**Criterio de aceptacion:** subir un `.php` renombrado a `.pdf` es rechazado con error 422.

#### 1.5 Unificacion del rol superadmin

- [ ] Auditar todas las referencias a `ROLE_SUPER_ADMIN` y `ROLE_SUPERADMIN` en el proyecto
- [ ] Unificar a un unico nombre (`ROLE_SUPERADMIN`) en entidades, controladores, extensiones y fixtures
- [ ] Verificar la jerarquia de roles en `security.yaml`

**Criterio de aceptacion:** `grep -r "ROLE_SUPER_ADMIN"` no devuelve resultados (solo `ROLE_SUPERADMIN`).

---

## Fase 2 — Capa de servicio API en frontend

**Prioridad:** Alta
**Esfuerzo:** Medio (3-4 dias)
**Dependencias:** Ninguna — se puede ejecutar en paralelo con la Fase 1

### Justificacion

Actualmente cada pagina hace `fetch()` directamente con URLs hardcodeadas, headers repetidos y manejo de errores duplicado. Esto genera:
- Duplicacion masiva (~15 paginas repitiendo el mismo patron)
- Imposibilidad de interceptar errores globales (sesion expirada, 500, red caida)
- Dificultad para anadir cache, reintentos o logging

### Tareas

#### 2.1 Cliente API centralizado

- [ ] Crear `frontend/src/services/apiClient.js` con un wrapper de `fetch()` que:
  - Inyecte `credentials: 'include'` y headers comunes automaticamente
  - Parsee respuestas JSON-LD (extraer `hydra:member`, `hydra:totalItems`)
  - Intercepte errores HTTP: 401 → redirect a login, 429 → mostrar toast, 500 → error generico
  - Soporte `AbortController` integrado
  - Soporte query params para paginacion, filtros y ordenacion

```
// Ejemplo de uso final:
const { items, total } = await api.getCollection('/api/usuarios', {
  page: 1,
  itemsPerPage: 20,
  filters: { centro: centroId },
  order: { nombre: 'asc' },
  signal: abortController.signal
});
```

**Criterio de aceptacion:** ninguna pagina usa `fetch()` directamente; todas pasan por `apiClient`.

#### 2.2 Hooks CRUD genericos

- [ ] Crear `frontend/src/hooks/useCrud.js` que encapsule el patron comun:
  - Fetch con paginacion, busqueda, filtros y ordenacion
  - Estados: `loading`, `error`, `data`, `total`
  - Metodos: `create()`, `update()`, `remove()`, `refresh()`
  - Debounce de busqueda integrado
  - Limpieza automatica de AbortController en desmontaje

- [ ] Migrar progresivamente las paginas CRUD para usar `useCrud` (empezar por `Usuarios.jsx` como piloto, luego extender)

**Criterio de aceptacion:** la pagina piloto (`Usuarios.jsx`) reduce su tamano al menos un 30%.

#### 2.3 Interceptor de sesion expirada

- [ ] Detectar respuesta 401 en `apiClient`
- [ ] Limpiar estado de `AuthContext` y redirigir a `/login`
- [ ] Mostrar toast informativo: "Tu sesion ha expirado"

**Criterio de aceptacion:** si el backend devuelve 401 en cualquier peticion, el usuario es redirigido automaticamente.

#### 2.4 Reduccion de polling

- [ ] Cambiar intervalo de notificaciones de 3s a 30s
- [ ] Cambiar intervalo de chat de 1s a 5s (o implementar long-polling)
- [ ] Anadir `visibilitychange` listener para pausar polling cuando la pestana no esta activa

**Criterio de aceptacion:** con la pestana en segundo plano, no se realizan peticiones de polling.

---

## Fase 3 — Migraciones de Doctrine

**Prioridad:** Alta
**Esfuerzo:** Bajo (1 dia)
**Dependencias:** Ninguna

### Justificacion

El proyecto usa `doctrine:schema:update --force` para sincronizar la BD. Este comando puede borrar columnas/tablas con datos en produccion sin aviso. Las migraciones son el mecanismo seguro y estandar para evolucionar el esquema.

### Tareas

#### 3.1 Generar migracion inicial

- [ ] Ejecutar `php bin/console doctrine:migrations:diff` para generar la migracion que represente el esquema actual completo
- [ ] Revisar la migracion generada manualmente (verificar que no destruye datos)
- [ ] Marcar la migracion como ejecutada con `doctrine:migrations:version --add` (ya que el esquema ya existe)

**Criterio de aceptacion:** `doctrine:migrations:status` muestra 1 migracion sincronizada.

#### 3.2 Actualizar workflow de desarrollo

- [ ] Modificar `scripts/init.sh` para usar `doctrine:migrations:migrate` en lugar de `doctrine:schema:update --force`
- [ ] Actualizar `scripts/force_update.sh` para generar migracion + migrar (no `--force`)
- [ ] Documentar el flujo en el README: cambiar entidad → generar migracion → revisar → migrar

**Criterio de aceptacion:** ningun script ejecuta `doctrine:schema:update --force`.

#### 3.3 Anadir indices a consultas frecuentes

- [ ] Crear migracion con indices para:
  - `user.centro_id` (ya deberia existir por FK, verificar)
  - `asistencia(alumno_id, imparticion_id, fecha)` — indice compuesto para la consulta de hoja de asistencia
  - `imparticion(profesor_id, grupo_id)` — indice compuesto para horarios del profesor
  - `matricula(alumno_id)` — consultas frecuentes de "mis grupos"
  - `mensaje(remitente_id, destinatario_id, fecha_envio)` — listado de conversaciones

**Criterio de aceptacion:** `EXPLAIN` de las queries principales muestra uso de indice (no full scan).

---

## Fase 4 — Testing de logica critica

**Prioridad:** Alta
**Esfuerzo:** Alto (5-7 dias)
**Dependencias:** Fases 1-3 (la seguridad y migraciones deben estar estables)

### Justificacion

La logica de filtrado por centro (`CurrentUserExtension`), el calculo de horas lectivas y el control de acceso a ficheros son las partes mas criticas del sistema. Un bug aqui significa que un alumno puede ver datos de otro centro o que un profesor ve notas que no le corresponden.

### Tareas

#### 4.1 Configurar entorno de test backend

- [ ] Configurar `phpunit.xml` con base de datos de test (SQLite en memoria o MariaDB dedicada)
- [ ] Crear `DataFixtures` de test: un centro con 2 ciclos, 3 grupos, 5 profesores, 20 alumnos, horarios e imparticiones
- [ ] Verificar que `doctrine:schema:create` funciona en el entorno de test

**Criterio de aceptacion:** `php bin/phpunit` ejecuta sin errores de configuracion.

#### 4.2 Tests de CurrentUserExtension

- [ ] Test: un ADMIN solo ve usuarios de su centro
- [ ] Test: un ADMIN no ve usuarios con ROLE_SUPERADMIN
- [ ] Test: un PROFESOR solo ve tareas de sus imparticiones
- [ ] Test: un ALUMNO solo ve tareas visibles de sus grupos matriculados
- [ ] Test: un ALUMNO no ve mensajes de otros usuarios
- [ ] Test: un SUPERADMIN ve todo sin filtros

**Criterio de aceptacion:** 6+ tests que cubren todos los roles y clases soportadas por la extension.

#### 4.3 Tests de AsistenciaController

- [ ] Test: la hoja de asistencia devuelve solo alumnos matriculados en el grupo
- [ ] Test: el batch de asistencia no permite duplicados (mismo alumno/imparticion/fecha/hora)
- [ ] Test: el resumen de alumno calcula correctamente horas lectivas descontando festivos
- [ ] Test: el resumen respeta fechaInicio y fechaFin del grupo

**Criterio de aceptacion:** 4+ tests que verifican la logica de asistencia.

#### 4.4 Tests de FileProxyController

- [ ] Test: un alumno no puede descargar entregas de otro alumno
- [ ] Test: un profesor puede descargar entregas de sus imparticiones
- [ ] Test: un usuario anonimo recibe 401
- [ ] Test: tipos de archivo desconocidos devuelven 404

**Criterio de aceptacion:** 4+ tests de control de acceso a ficheros.

#### 4.5 Tests frontend (hooks)

- [ ] Configurar Vitest (compatible con Vite)
- [ ] Test: `useFormValidation` — campos requeridos, email, minLength, maxLength, custom
- [ ] Test: `usePagination` — lee itemsPerPage de personalizacion, fallback a default
- [ ] Test: `apiClient` — intercepta 401, parsea JSON-LD, maneja errores de red

**Criterio de aceptacion:** 10+ tests unitarios de hooks y utilidades.

---

## Fase 5 — Sistema de auditoria

**Prioridad:** Alta
**Esfuerzo:** Medio (3-4 dias)
**Dependencias:** Fase 3 (migraciones disponibles)

### Justificacion

En un sistema educativo, modificar una calificacion o una asistencia tiene implicaciones legales. Es necesario saber quien hizo que cambio y cuando. Esto es especialmente relevante para:
- Reclamaciones de notas
- Justificacion de faltas
- Responsabilidad administrativa

### Tareas

#### 5.1 Entidad AuditLog

- [ ] Crear entidad `AuditLog` con campos:
  - `id`, `entityType` (string), `entityId` (int), `action` (enum: CREATE, UPDATE, DELETE)
  - `oldValues` (JSON nullable), `newValues` (JSON nullable)
  - `userId` (int), `userEmail` (string — para conservar si el usuario se borra)
  - `ipAddress` (string nullable), `createdAt` (datetime)
- [ ] Crear migracion correspondiente
- [ ] Indice compuesto en `(entityType, entityId, createdAt)` para consultas de historial

**Criterio de aceptacion:** la tabla `audit_log` existe con los campos descritos.

#### 5.2 Listener de Doctrine

- [ ] Crear `EventSubscriber` de Doctrine que escuche `onFlush`
- [ ] Registrar cambios automaticamente para entidades auditables: `Calificacion`, `Asistencia`, `Entrega`, `User` (cambios de rol), `Matricula`
- [ ] Capturar valores anteriores y nuevos para cada campo modificado
- [ ] Obtener usuario actual via `Security` service

**Criterio de aceptacion:** al modificar una calificacion, se crea un registro de auditoria automaticamente con los valores antes/despues.

#### 5.3 Endpoint de consulta de historial

- [ ] Crear endpoint `GET /api/audit/{entityType}/{entityId}` (acceso: ROLE_ADMIN y ROLE_SUPERADMIN)
- [ ] Devolver historial paginado ordenado por fecha descendente
- [ ] Incluir nombre del usuario que hizo el cambio

**Criterio de aceptacion:** un admin puede consultar el historial de cambios de una calificacion.

#### 5.4 Vista frontend de historial

- [ ] Anadir boton "Ver historial" en las vistas de detalle de calificaciones y asistencia
- [ ] Mostrar timeline de cambios con: fecha, usuario, accion, valores antes/despues
- [ ] Solo visible para ROLE_ADMIN y ROLE_SUPERADMIN

**Criterio de aceptacion:** un admin ve la linea temporal de cambios en la interfaz.

---

## Fase 6 — Modelo de datos academico

**Prioridad:** Media
**Esfuerzo:** Alto (7-10 dias)
**Dependencias:** Fases 3 y 5 (migraciones y auditoria)

### Justificacion

El modelo actual es funcional pero simplificado. Para un sistema escolar real faltan conceptos clave del dominio educativo espanol: periodos evaluativos, medias ponderadas, roles de familia y gestion tutorial.

### Tareas

#### 6.1 Periodos evaluativos

- [ ] Crear entidad `PeriodoEvaluativo`:
  - `id`, `nombre` (ej: "1a Evaluacion"), `tipo` (enum: TRIMESTRE, CUATRIMESTRE, FINAL)
  - `fechaInicio`, `fechaFin`, `grupo_id`
- [ ] Asociar calificaciones a un periodo evaluativo
- [ ] Permitir generar calificaciones finales como media ponderada de los periodos

**Criterio de aceptacion:** las calificaciones se agrupan por periodo y se puede calcular la media final.

#### 6.2 Calificaciones avanzadas

- [ ] Ampliar `Calificacion` o crear `CalificacionFinal`:
  - Nota por tipo (examen, practica, tarea) con peso configurable por imparticion
  - Media ponderada automatica
  - Estado: provisional, definitiva, reclamada
- [ ] Endpoint para calcular media de un alumno en un modulo/periodo

**Criterio de aceptacion:** un profesor puede configurar pesos (ej: examenes 60%, practicas 30%, tareas 10%) y el sistema calcula la media.

#### 6.3 Justificantes de asistencia

- [ ] Anadir campo `justificante` (archivo) a la entidad `Asistencia`
- [ ] Permitir upload de justificante (PDF/imagen) al cambiar estado a "J"
- [ ] Endpoint para que un alumno o familia suba justificante

**Criterio de aceptacion:** una falta justificada puede tener un documento adjunto consultable.

#### 6.4 Rol de familia/tutor legal

- [ ] Anadir `ROLE_FAMILIA` a la jerarquia de roles
- [ ] Crear relacion `User (familia) <-> User (alumno)` (ManyToMany con tabla intermedia `tutor_alumno`)
- [ ] Extender `CurrentUserExtension` para que ROLE_FAMILIA vea datos de sus hijos
- [ ] Vista de familia: calificaciones, asistencia y comunicados de sus hijos (solo lectura)

**Criterio de aceptacion:** un padre/madre accede y ve las notas y faltas de sus hijos.

#### 6.5 Tutorias

- [ ] Crear entidad `Tutoria`:
  - `tutor_id` (User profesor), `grupo_id`, `anio_escolar`
- [ ] Crear entidad `SesionTutoria`:
  - `tutoria_id`, `fecha`, `tipo` (enum: INDIVIDUAL, GRUPAL, FAMILIA)
  - `asistentes` (JSON), `observaciones` (TEXT)
- [ ] Vista para que el tutor gestione sesiones y registre observaciones

**Criterio de aceptacion:** un profesor-tutor puede registrar sesiones de tutoria con observaciones.

#### 6.6 Excepciones de horario

- [ ] Crear entidad `ExcepcionHorario`:
  - `horario_id`, `fecha`, `tipo` (enum: CANCELADA, SUSTITUCION, CAMBIO_AULA)
  - `profesor_sustituto_id` (nullable), `aula_nueva` (nullable), `motivo`
- [ ] Modificar la vista de horario para mostrar excepciones del dia
- [ ] Considerar excepciones en el calculo de horas lectivas de asistencia

**Criterio de aceptacion:** un admin puede registrar que una clase se cancelo o tuvo sustitucion, y el horario lo refleja.

---

## Fase 7 — Rendimiento y cache

**Prioridad:** Media
**Esfuerzo:** Medio (3-4 dias)
**Dependencias:** Fase 2 (apiClient centralizado)

### Justificacion

Con cientos de usuarios concurrentes (escenario real de un centro), las sesiones en fichero y la ausencia de cache generaran latencia. Ademas, el frontend refetchea datos en cada navegacion sin necesidad.

### Tareas

#### 7.1 Cache de datos en frontend

- [ ] Integrar TanStack Query (React Query):
  - Cache automatica de colecciones con `staleTime` configurable
  - Invalidacion selectiva al crear/editar/borrar
  - Prefetch de datos al hover sobre enlaces de navegacion
- [ ] Migrar las paginas CRUD para usar `useQuery` / `useMutation` en lugar de `useState` + `useEffect`

**Criterio de aceptacion:** navegar de Usuarios a Grupos y volver a Usuarios no genera una nueva peticion (datos cacheados).

#### 7.2 Redis para sesiones

- [ ] Anadir servicio Redis al `docker-compose.yml`
- [ ] Configurar Symfony para usar Redis como handler de sesiones (`framework.yaml`)
- [ ] Mover cache de Doctrine a Redis en produccion

**Criterio de aceptacion:** `redis-cli KEYS *` muestra sesiones activas.

#### 7.3 Paginacion en endpoints custom

- [ ] Anadir paginacion a:
  - `GET /api/my-schedule` (aunque normalmente es poco dato, por consistencia)
  - `GET /api/v1/profesor/alumnos` (puede tener cientos de alumnos)
  - `GET /api/v1/alumno/companeros`
  - `GET /api/v1/profesor/claustro`
- [ ] Formato de respuesta consistente con API Platform (`hydra:member`, `hydra:totalItems`)

**Criterio de aceptacion:** los endpoints custom aceptan `?page=` y `?itemsPerPage=` y devuelven formato hydra.

#### 7.4 OPcache para desarrollo

- [ ] Cambiar `validate_timestamps=1` en desarrollo (para que los cambios se reflejen sin reiniciar)
- [ ] Mantener `validate_timestamps=0` solo en produccion

**Criterio de aceptacion:** al editar un archivo PHP, el cambio se refleja sin reiniciar Apache.

---

## Fase 8 — Infraestructura y CI/CD

**Prioridad:** Media
**Esfuerzo:** Medio (2-3 dias)
**Dependencias:** Fase 4 (tests disponibles para ejecutar en CI)

### Justificacion

Sin CI/CD, los errores se detectan tarde. Sin health checks, los servicios caidos pasan desapercibidos. Sin backups automaticos, un fallo de disco es una catastrofe.

### Tareas

#### 8.1 GitHub Actions basico

- [ ] Crear `.github/workflows/ci.yml`:
  - **Backend**: instalar dependencias, ejecutar PHPUnit, ejecutar PHPStan (analisis estatico)
  - **Frontend**: instalar dependencias, ejecutar ESLint, ejecutar Vitest
- [ ] Ejecutar en cada push y pull request

**Criterio de aceptacion:** un PR con tests rotos no se puede mergear (status check requerido).

#### 8.2 Health checks en Docker

- [ ] Anadir `healthcheck` a cada servicio en `docker-compose.yml`:
  - backend: `curl -f http://localhost/api || exit 1`
  - database: `mysqladmin ping`
  - minio: `curl -f http://localhost:9000/minio/health/live`
  - frontend: `curl -f http://localhost:5173`
- [ ] Configurar Caddy para no enrutar a servicios no saludables

**Criterio de aceptacion:** `docker compose ps` muestra estado de salud de cada servicio.

#### 8.3 Backup automatizado

- [ ] Crear script `scripts/backup_cron.sh` que ejecute backup de BD + MinIO
- [ ] Documentar como configurar un cron del host:
  ```
  0 3 * * * /ruta/al/proyecto/scripts/backup_cron.sh >> /var/log/loggex-backup.log 2>&1
  ```
- [ ] Rotacion de backups: mantener ultimos 7 diarios y 4 semanales

**Criterio de aceptacion:** cada noche se genera un backup de BD y storage con rotacion.

#### 8.4 Entorno de staging

- [ ] Crear `docker-compose.staging.yml` con:
  - Variables de entorno separadas (`.env.staging`)
  - SSL con certificado real (Let's Encrypt via Caddy)
  - Logging a fichero con rotacion
- [ ] Documentar despliegue en un VPS basico

**Criterio de aceptacion:** existe un fichero de compose funcional para staging con su documentacion.

---

## Fase 9 — UX avanzada y accesibilidad

**Prioridad:** Media
**Esfuerzo:** Alto (5-7 dias)
**Dependencias:** Fases 2 y 6 (apiClient y modelo academico)

### Justificacion

La aplicacion es funcional pero puede mejorar significativamente en accesibilidad (requisito legal en muchos contextos), experiencia offline para profesores y generacion de documentos oficiales.

### Tareas

#### 9.1 Accesibilidad WCAG 2.1 AA

- [ ] Anadir enlace "Saltar al contenido" (`skip-to-content`) al inicio de cada pagina
- [ ] Implementar `aria-live="polite"` en regiones que cambian dinamicamente (toast, tablas tras filtrar, contadores)
- [ ] Verificar contraste de colores con herramienta automatica (axe-core) para el tema por defecto
- [ ] Navegacion completa por teclado en DataTable: flechas para moverse entre celdas, Enter para acciones
- [ ] Anadir `role="status"` a indicadores de carga
- [ ] Focus trap en modales (ya parcialmente implementado, verificar completitud)

**Criterio de aceptacion:** audit de axe-core con 0 violaciones criticas en las 5 paginas mas usadas.

#### 9.2 Generacion de informes PDF

- [ ] Instalar libreria de generacion PDF en backend (ej: `dompdf/dompdf` o `knplabs/knp-snappy-bundle`)
- [ ] Endpoint `GET /api/informes/boletin/{alumnoId}/{periodoId}` — genera boletin de notas
- [ ] Endpoint `GET /api/informes/asistencia/{grupoId}/{mes}` — informe mensual de faltas
- [ ] Endpoint `GET /api/informes/acta/{imparticionId}/{periodoId}` — acta de calificaciones
- [ ] Plantillas HTML renderizadas a PDF con cabecera del centro (logo, nombre)

**Criterio de aceptacion:** un admin puede descargar un boletin en PDF con notas por periodo y modulo.

#### 9.3 Notificaciones por email

- [ ] Configurar transporte de email en Symfony (SMTP o servicio como Mailgun/SES)
- [ ] Crear handlers de Messenger para:
  - Notificacion a familia cuando se registra una falta no justificada
  - Notificacion a alumno cuando se publica una nueva tarea
  - Notificacion a alumno cuando se califica una entrega
- [ ] Preferencias de notificacion por usuario (opt-in/opt-out)

**Criterio de aceptacion:** al registrar una falta, la familia recibe un email (si tiene notificaciones activadas).

#### 9.4 Modo offline para asistencia (PWA)

- [ ] Registrar Service Worker con cache de shell de la aplicacion
- [ ] En la pantalla de pasar lista:
  - Cachear lista de alumnos del grupo al acceder online
  - Permitir marcar asistencia sin conexion (guardar en IndexedDB)
  - Sincronizar automaticamente al recuperar conexion
- [ ] Indicador visual de modo offline/online

**Criterio de aceptacion:** un profesor puede pasar lista sin conexion y los datos se sincronizan al volver online.

#### 9.5 Mejora de mensajeria

- [ ] Hilos de conversacion (agrupar mensajes por par remitente-destinatario)
- [ ] Adjuntos en mensajes (reutilizar infraestructura de uploads)
- [ ] Indicador de mensajes no leidos en el sidebar
- [ ] Busqueda dentro de conversaciones

**Criterio de aceptacion:** los mensajes se muestran agrupados por conversacion con contador de no leidos.

---

## Diagrama de dependencias entre fases

```
Fase 1 (Seguridad) ──────────────────────────────┐
Fase 2 (API Frontend) ───────────────┐            │
Fase 3 (Migraciones) ──────┐         │            │
                            │         │            │
                            v         │            v
                    Fase 5 (Auditoria)│    Fase 4 (Testing)
                            │         │            │
                            v         v            v
                    Fase 6 (Modelo)   Fase 7 (Cache)  Fase 8 (CI/CD)
                            │         │
                            v         v
                    Fase 9 (UX avanzada)
```

**Fases paralelizables:**
- Fases 1, 2 y 3 pueden ejecutarse simultaneamente
- Fases 4 y 5 pueden ejecutarse simultaneamente (ambas dependen de Fase 3)
- Fases 7 y 8 pueden ejecutarse simultaneamente

---

## Notas finales

- Cada fase esta disenada para ser un incremento funcional independiente: el proyecto sigue siendo usable al completar cualquier fase.
- Las estimaciones de esfuerzo asumen un desarrollador con experiencia en el stack. Para un equipo o en contexto de TFG, multiplicar por el factor correspondiente.
- Este documento complementa `docs/informe-mejoras.md` (diagnostico detallado) y `docs/hoja-de-ruta-ux.md` (mejoras de experiencia de usuario).
