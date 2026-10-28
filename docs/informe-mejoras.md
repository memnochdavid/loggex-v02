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

### Fase 1 - Seguridad (urgente)

- Limpiar secretos del repositorio
- Anadir autenticacion a endpoints desprotegidos
- Unificar roles y corregir `CurrentUserExtension`
- Implementar rate limiting en login

### Fase 2 - Calidad de datos

- Anadir validaciones `#[Assert\*]` a todas las entidades
- Crear indices y constraints unicos en BD
- Extraer servicio de upload compartido
- No exponer errores internos al cliente

### Fase 3 - Frontend

- Crear servicio/hook de API centralizado (`useApi`)
- Reemplazar `alert()` por sistema de toasts
- Anadir Error Boundaries
- Crear constantes para roles y endpoints
- Memoizar contextos

### Fase 4 - Mejoras progresivas

- Dividir paginas grandes en componentes
- Implementar code splitting con lazy loading
- Mejorar accesibilidad (ARIA, alt, focus)
- Considerar migracion a TypeScript
