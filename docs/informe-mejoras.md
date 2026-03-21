# Informe de Mejoras - Loggex v02

Revision completa del proyecto (backend, frontend, seguridad y configuracion). Hallazgos organizados por prioridad.

---

## 1. SEGURIDAD (Critico)

| Problema | Ubicacion | Impacto |
|----------|-----------|---------|
| Credenciales hardcodeadas en docker-compose | `docker-compose.yml:23-27,62` | DB, MinIO y root password en texto plano |
| Endpoint `/api/debug/logs` sin autenticacion | `DebugLogController.php:12` | Cualquiera puede leer logs del servidor |
| Endpoints de Centro sin autenticacion | `CentroController.php:15-26` | Cualquiera puede crear/modificar centros |
| Clave de cifrado hardcodeada en entidad | `Mensaje.php:43` | `LoggexSecretKeyForMessages2026` en codigo |
| `.env` commiteado con JWT passphrase y credenciales | `backend/.env:32,47,59-61` | Secretos expuestos en el repositorio |
| Clave privada JWT con permisos 666 | `config/jwt/private.pem` | Cualquier proceso puede leer la clave |
| Inconsistencia de roles: `ROLE_SUPER_ADMIN` vs `ROLE_SUPERADMIN` | `CurrentUserExtension.php:56` | Bypass de autorizacion por centro |
| Directorios de upload creados con permisos 777 | `UserController.php:51`, `CentroController.php:60` | Escritura por cualquier proceso |
| Sin rate limiting en `/api/login` | Config global | Vulnerable a fuerza bruta |

### Acciones inmediatas recomendadas

1. Mover secretos a `.env.local` (ya esta en `.gitignore`)
2. Anadir `#[IsGranted]` a `CentroController` y `DebugLogController`
3. Unificar el nombre del rol superadmin en todo el proyecto
4. Permisos `600` en `private.pem`

---

## 2. BACKEND - Validacion y Datos

| Problema | Detalle |
|----------|---------|
| **Sin validaciones en entidades** | `User`, `Centro`, `Modulo`, `Tarea`, `Calificacion`, `Asistencia` carecen de `#[Assert\*]` |
| **Sin indices en BD** | 0 indices explicitos en todo el proyecto; faltan en FKs y campos frecuentes |
| **Sin constraints unicos** | `Matricula(alumno, grupo)` y `Asistencia(alumno, imparticion, fecha, hora)` permiten duplicados |
| **Logica de upload duplicada** | 3 controllers de upload repiten el mismo codigo - extraer a servicio |
| **Errores expuestos al cliente** | `AsistenciaController.php:222` devuelve stack traces; `UserController.php:88` devuelve `$e->getMessage()` |
| **N+1 queries** | `AsistenciaController.php:145` carga todos los festivos; `GetMensajesController.php` falta eager loading |
| **CurrentUserExtension incompleta** | Solo filtra 7 entidades; faltan Material, Festivo, Horario, Grupo, Matricula |
| **Swagger/ReDoc activo siempre** | `api_platform.yaml:18-20` - deberia desactivarse en produccion |

---

## 3. FRONTEND - Arquitectura y UX

| Problema | Detalle |
|----------|---------|
| **Sin capa de abstraccion API** | 127+ instancias de `.then/.catch` repetidas; patron `hydra:member` duplicado 50+ veces |
| **`alert()` usado para errores** | 20+ instancias en lugar de toasts o notificaciones en UI |
| **Sin Error Boundaries** | `ErrorPage.jsx` existe pero no se usa; un error en un componente tumba toda la app |
| **Paginas monoliticas** | `Configuracion.jsx` (1519 lineas), `Horarios.jsx` (653), `Entregas.jsx` (648) |
| **Contextos sin memoizar** | `AuthContext` y `UIContext` no usan `useMemo` - re-renders innecesarios |
| **Polling sin control** | Polling cada 1-3s sin pausar cuando el tab esta inactivo (Visibility API) |
| **Sin code splitting** | Todas las rutas cargan sincronamente; falta `React.lazy` + `Suspense` |
| **Accesibilidad pobre** | Solo 13 atributos ARIA en todo el proyecto; imagenes sin `alt` |
| **Roles como magic strings** | `'ROLE_ALUMNO'`, `'ROLE_PROFESOR'` hardcodeados en multiples archivos |
| **Sin validacion de formularios** | Validacion manual en 10+ paginas; sin react-hook-form ni similar |
| **Sin TypeScript** | Todo el frontend es JS plano - propenso a errores en runtime |

---

## 4. INFRAESTRUCTURA

| Problema | Detalle |
|----------|---------|
| Puerto de BD expuesto (3307) | Sin firewall frente a el |
| Consola MinIO expuesta (9001) | Accesible desde la red |
| CORS permite `*.ngrok-free.app` | Cualquier tunel ngrok seria aceptado |
| Sin health checks en Docker | Contenedores sin verificacion de estado |
| BD inicializada con backup SQL | Deberia usar sistema de migraciones |

---

## 5. PLAN DE ACCION SUGERIDO

### Fase 1 - Seguridad (urgente) -- COMPLETADA

Cambios aplicados:

- **Autenticacion en endpoints desprotegidos**
  - `CentroController.php`: anadido `#[IsGranted('ROLE_ADMIN')]` a nivel de clase
  - `DebugLogController.php`: anadido `#[IsGranted('ROLE_SUPERADMIN')]` a nivel de clase; eliminada exposicion de rutas internas del servidor en las respuestas JSON

- **Unificacion de roles**
  - `CurrentUserExtension.php`: eliminado check redundante de `ROLE_SUPER_ADMIN`, unificado a `ROLE_SUPERADMIN`
  - `ComunicadoProcessor.php`: mismo cambio

- **Clave de cifrado externalizada (Mensaje)**
  - `Mensaje.php`: eliminada constante `ENCRYPTION_KEY` hardcodeada y los lifecycle callbacks de cifrado
  - Creado `src/EventListener/MensajeEncryptionListener.php`: EntityListener que recibe la clave desde el parametro `%app.encryption_key%` (variable de entorno)
  - `config/services.yaml`: anadido parametro `app.encryption_key` vinculado a `env(MESSENGER_ENCRYPTION_KEY)`
  - `.env`: anadida variable `MESSENGER_ENCRYPTION_KEY`

- **Permisos de directorios de upload**
  - `CentroController.php`: `mkdir` cambiado de `0777` a `0755`
  - `UserController.php`: idem

- **Errores internos no expuestos al cliente**
  - Eliminado `$e->getMessage()` y `$e->getTraceAsString()` de las respuestas JSON en: `CentroController`, `UserController`, `AdminUserController`, `AsistenciaController`, `UploadTareaController`, `UploadMaterialController`, `UploadEntregaController`, `GetMensajesController`, `PersonalizacionController`
  - Los logs internos con `$logger->error()` se mantienen intactos

- **Pendiente**: rate limiting en `/api/login`, mover secretos de `.env` a `.env.local`, permisos `600` en `private.pem`

### Fase 2 - Calidad de datos -- COMPLETADA

Cambios aplicados:

- **Validaciones `#[Assert\*]` en entidades**
  - `User.php`: `NotBlank` + `Email` en email; `NotBlank` + `Length` en nombre y apellidos
  - `Centro.php`: `NotBlank` + `Length` en nombre, cif y direccion
  - `Modulo.php`: `NotBlank` + `Length` en nombre; `Range(1-2)` en curso; `Positive` en horasSemanales
  - `Tarea.php`: `NotBlank` + `Length` en titulo; `NotNull` en fechaLimite; `Choice(tarea, examen, practica)` en tipo
  - `Calificacion.php`: `NotNull` + `Range(0-10)` en nota
  - `Asistencia.php`: `NotNull` en fecha y hora; `NotBlank` + `Choice(P, F, R, J)` en estado

- **Constraints unicos en BD (entidades + backup SQL)**
  - `Matricula`: UniqueConstraint en `(alumno_id, grupo_id)` - evita matriculas duplicadas
  - `Asistencia`: UniqueConstraint en `(alumno_id, imparticion_id, fecha, hora)` - evita registros de asistencia duplicados

- **Limpieza de datos en `backup_tfg_full.sql`**
  - Reemplazados comentarios inapropiados de test por texto neutro (6 registros)
  - Corregidos campos `created_at` con valor NULL (4 registros)
  - Anadidos los UNIQUE KEY en las sentencias CREATE TABLE correspondientes

- **Jerarquia de roles** (aplicado en Fase 1)
  - `security.yaml`: anadido `role_hierarchy` donde `ROLE_SUPERADMIN` hereda `ROLE_ADMIN` hereda `ROLE_PROFESOR`

- **Pendiente**: extraer servicio de upload compartido (refactoring de baja prioridad)

### Fase 3 - Frontend -- COMPLETADA

Cambios aplicados:

- **Sistema de toasts** (reemplazo de `alert()`)
  - Creado `components/Toast.jsx` + `Toast.module.css`: componente de notificacion con tipos error/success/warning/info, auto-cierre y animacion
  - Creado `context/ToastContext.jsx`: contexto con API `toast.error()`, `toast.success()`, etc.
  - Reemplazados los 36 `alert()` en 18 archivos (9 pages CRUD, Tareas, Entregas, Mensajes, Perfil, Home, MaterialesProfesor, Header, TimeTable, TablonWidget)

- **Error Boundary**
  - Creado `components/ErrorBoundary.jsx`: captura errores de renderizado y muestra pagina de recuperacion
  - Integrado en `App.jsx` envolviendo toda la aplicacion

- **Constantes de roles**
  - Creado `constants/roles.js`: constantes `ROLES.SUPERADMIN`, `ROLES.ADMIN`, `ROLES.PROFESOR`, `ROLES.ALUMNO` + helpers `hasRole()` y `hasAnyRole()`

- **Contextos memoizados**
  - `AuthContext.jsx`: funciones envueltas en `useCallback`, valor del provider en `useMemo`
  - `UIContext.jsx`: idem

- **Pendiente**: hook centralizado de API (`useApi`) - refactoring progresivo de baja prioridad

### Fase 4 - Mejoras progresivas -- COMPLETADA

Cambios aplicados:

- **Code splitting con lazy loading**
  - `App.jsx`: todas las paginas convertidas a `React.lazy()` con `Suspense` y fallback a `LoadingView`
  - Cada pagina se carga bajo demanda, reduciendo el bundle inicial
  - Login, Header, Footer, AnimatedBackground y PrivateRoute se mantienen en el bundle principal (necesarios al inicio)

- **Accesibilidad (ARIA)**
  - `ModalView.jsx`: anadido `role="dialog"`, `aria-modal="true"`, `aria-labelledby`, `aria-label` en boton de cierre
  - `DataTable.jsx`: `aria-label` en los 4 botones de paginacion (primera, anterior, siguiente, ultima pagina)
  - `SearchBar.jsx`: `role="search"` en contenedor, `aria-label` en input
  - `Sidebar.jsx`: `role="navigation"`, `aria-label="Menu principal"`
  - `Header.jsx`: `role="banner"`
  - `Footer.jsx`: `role="contentinfo"`
  - `App.jsx`: `role="main"` en `<main>`
  - Traducciones de aria-labels anadidas en los 5 idiomas

- **PrivateRoute mejorado**
  - Usa `LoadingView` en vez de texto plano "Cargando..."

- **Pendiente**: dividir paginas grandes en componentes (Configuracion.jsx 1519 lineas), migracion a TypeScript
