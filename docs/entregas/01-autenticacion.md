# TFG — Entrega Parcial 1: Módulo de Autenticación (Home, Registro y Login)

**Proyecto:** Loggex v02 — Plataforma de gestión académica para centros educativos
**Autor:** David Duque Díaz
**Fecha:** 2026-04-24
**Asignatura:** Trabajo de Fin de Grado
**Tutor:** Manuel Prieto Macías

---

## 1. Introducción

Este documento recoge la primera entrega parcial del TFG, centrada en la validación del módulo de autenticación (login) y de la página de inicio (home) del dashboard. Dado que Loggex es una plataforma B2B destinada a centros educativos, **no existe autorregistro público**: las altas de usuarios las realiza un administrador del centro desde el panel de gestión. Este apartado se documenta más abajo como equivalente al "formulario de registro" que pide el enunciado.

## 2. Nota sobre la arquitectura (Twig vs SPA)

El enunciado asume una aplicación Symfony monolítica con Twig y `base.html.twig`. En este TFG se ha optado por una **arquitectura desacoplada**:

- **Backend:** Symfony 7 + **API Platform 3** expone una API REST JSON-LD.
- **Frontend:** **React 19 + Vite 7 + React Router 7** como Single Page Application.

Esta decisión se tomó en la fase de diseño por tres motivos: (a) separación clara de responsabilidades, (b) la API queda reutilizable para futuras apps móviles, y (c) se gana una experiencia de usuario más fluida (navegación sin recargas, actualizaciones en tiempo real vía Mercure). El equivalente funcional de `base.html.twig` es el layout React definido en `frontend/src/App.jsx` junto al componente `Sidebar`, que envuelve todas las rutas protegidas.

---

## 3. Entregables

### 3.1. Página de Inicio (Home)

La home es un **dashboard post-login** con widgets contextuales según el rol del usuario (saludo dinámico, estadísticas rápidas, tablón de comunicados, horario del día, mensajes recientes y tareas pendientes).

**Ruta frontend:** `/` — protegida por `<PrivateRoute>`
**Componente:** `frontend/src/pages/Home.jsx`

<!-- CAPTURA 1: Home completa con el usuario autenticado (vista general del dashboard, con sidebar a la izquierda y bento grid de widgets) -->

<!-- CAPTURA 2 (opcional, recomendada): Stat ribbon en detalle (mensajes sin leer, tareas pendientes, próxima clase, eventos de la semana) -->

---

### 3.2. Formulario de "Registro" (Alta de usuarios por administrador)

Como se ha indicado en la introducción, **Loggex no permite autorregistro público** por coherencia con el dominio: los usuarios (alumnos, profesores y administradores) son dados de alta por un administrador del centro desde el panel `/usuarios`. El formulario que se muestra a continuación cumple el mismo propósito que un formulario de registro clásico: crea una entidad `User` en la base de datos con contraseña hasheada.

**Ruta frontend:** `/usuarios` — protegida, accesible solo a `ROLE_ADMIN` y `ROLE_SUPERADMIN`
**Componente:** `frontend/src/pages/Usuarios.jsx`
**Endpoint backend:** `POST /api/admin/user/create`

**Campos del formulario** (correspondientes a la entidad `User`):

- `nombre` (obligatorio)
- `apellidos` (obligatorio)
- `email` (obligatorio, único)
- `password` (obligatorio en creación)
- `roles` (selector: alumno/profesor/admin)
- `telefono`, `nif`, `avatar` (opcionales)
- `centro` (solo asignable por superadmin; el admin de centro lo hereda automáticamente)

<!-- CAPTURA 3: Panel /usuarios con el modal de "Nuevo usuario" abierto y vacío -->

<!-- CAPTURA 4: El mismo modal con datos válidos rellenados, antes de enviar (se puede usar datos ficticios, p. ej. email prueba.tfg@loggex.local) -->

<!-- CAPTURA 5: Mensaje de éxito tras crear el usuario (toast/notificación "Usuario guardado correctamente" y el nuevo registro visible en la tabla de usuarios) -->

<!-- CAPTURA 6 (opcional): Intento de crear un usuario con email ya existente o faltando campos → mensaje de error devuelto por el backend -->

---

### 3.3. Formulario de Login

**Ruta frontend:** `/login` — pública
**Componente:** `frontend/src/pages/Login.jsx`
**Endpoint backend:** `POST /api/login`

El formulario pide `email` y `password`. Tras un login exitoso, el AuthContext almacena los datos del usuario y React Router redirige a la ruta previa (o a `/` si el usuario entró directamente).

<!-- CAPTURA 7: Formulario de login vacío (con el branding/tematización del centro si aplica) -->

<!-- CAPTURA 8: Formulario de login con credenciales rellenadas, antes de enviar -->

<!-- CAPTURA 9: Dashboard / home tras login exitoso (puede ser la misma que la CAPTURA 1, o una distinta mostrando la transición) -->

<!-- CAPTURA 10 (opcional): Mensaje de error con credenciales incorrectas ("Email o contraseña incorrectos") -->

---

### 3.4. Evidencia de conexión con la base de datos

Para demostrar que el registro persiste correctamente en MariaDB, se aporta la consulta directa sobre la tabla `usuario`.

**Cliente sugerido:** `docker compose exec database mariadb -u app_user -papp_password app_db` o bien DBeaver conectado a `localhost:3307`.

**Consulta recomendada para la captura:**

```sql
SELECT id, email, nombre, apellidos, rol_app, created_at
FROM usuario
ORDER BY id DESC
LIMIT 10;
```

<!-- CAPTURA 11: Resultado de la SELECT anterior en el cliente de BD, mostrando el usuario recién creado en la CAPTURA 5 -->

<!-- CAPTURA 12 (opcional pero muy valorada): SELECT id, email, password FROM usuario WHERE email = 'prueba.tfg@...' — para demostrar que la contraseña está hasheada (formato $2y$... de bcrypt) y no en claro -->

---

## 4. Descripción Técnica

### 4.1. Entidad Doctrine `User`

**Archivo:** `backend/src/Entity/User.php`

La entidad implementa las interfaces estándar de Symfony Security (`UserInterface`, `PasswordAuthenticatedUserInterface`) y está mapeada a la tabla `usuario`. Campos principales:

| Campo | Tipo | Restricciones |
|---|---|---|
| `id` | int | PK, autogenerado |
| `email` | string(180) | **único** |
| `password` | string | hash bcrypt |
| `roles` | json | array de roles Symfony |
| `rol_app` | string(20) | rol de negocio (alumno/profesor/admin/superadmin) |
| `nombre`, `apellidos` | string(255) | obligatorios |
| `telefono`, `nif`, `foto`, `firma` | string | opcionales |
| `centro` | ManyToOne → `Centro` | nullable solo para superadmin |

La entidad expone operaciones REST vía atributos `#[ApiResource]` de API Platform (GET, GetCollection, POST, PUT, DELETE con soft-delete). Usa además los traits `TimestampableTrait` (campos `createdAt`/`updatedAt` automáticos) y `SoftDeletableTrait` (marcado lógico `deleted = true` en lugar de DELETE físico).

### 4.2. Controladores y rutas

#### Autenticación — `backend/src/Controller/SecurityController.php`

Tres endpoints, todos bajo `/api/`:

- **`POST /api/login`** — punto de entrada de sesión. La validación de credenciales la hace automáticamente el firewall `json_login` de Symfony antes de llegar al controlador; si el login es válido, el controlador devuelve los datos del usuario autenticado en JSON.
- **`GET /api/me`** — devuelve el usuario actualmente autenticado junto a su centro y personalización. El frontend lo invoca al arrancar la SPA para restaurar la sesión si la cookie sigue viva.
- **`POST /api/logout`** — destruye la sesión del usuario actual.

#### Alta de usuarios — `backend/src/Controller/AdminUserController.php`

Controlador personalizado protegido a nivel de clase con `#[IsGranted('ROLE_ADMIN')]`, con dos endpoints:

- **`POST /api/admin/user/create`** — crea un usuario a partir de un `multipart/form-data`.
- **`POST /api/admin/user/{id}/update`** — actualiza los datos de un usuario existente (comparte la misma lógica interna que el alta).

Ambos endpoints comparten un método privado `handleForm()` que se encarga de:

- Validar los campos obligatorios (`email`, `password`, `nombre`, `apellidos`).
- Comprobar que el email no está duplicado y devolver `409 Conflict` con JSON si lo está.
- Hashear la contraseña con `UserPasswordHasherInterface` antes de persistir — nunca se almacena la contraseña en claro.
- Asignar el centro del usuario: un superadmin puede elegir cualquier centro; un admin de centro hereda automáticamente el suyo.
- Subir opcionalmente un avatar a MinIO (storage S3-compatible) usando Flysystem.
- Envolver el `persist/flush` en try/catch para convertir cualquier error de base de datos en un JSON con el código HTTP apropiado.

#### Rutas frontend — `frontend/src/App.jsx`

El routing se define con `createBrowserRouter` de React Router 7. Rutas **públicas**: `/login`, `/about`. Rutas **protegidas** (envueltas en `<PrivateRoute>`): `/`, `/usuarios`, `/grupos`, `/horarios`, etc. El componente `PrivateRoute` (`frontend/src/components/PrivateRoute.jsx`) consulta el `AuthContext`; si no hay usuario, redirige a `/login` guardando la ruta original en `location.state.from` para restaurarla tras el login.

### 4.3. Equivalente a `base.html.twig`

El layout raíz vive en `frontend/src/App.jsx` y se compone de:

- `<AuthProvider>` + `<UIProvider>`: contextos globales.
- `<Sidebar>`: navegación lateral con menú dinámico según el rol.
- `<Outlet />` de React Router: inyecta la página actual.
- Sistema de tematización dinámica vía CSS variables (`frontend/src/utils/theme.js`), que permite que cada centro tenga su propia paleta y logotipo.

### 4.4. Gestión de sesión en el frontend

**Archivo:** `frontend/src/context/AuthContext.jsx`

El contexto expone tres métodos: `login(email, password)`, `logout()` y `checkAuth()`. Decisiones relevantes:

- **No se usa `localStorage`** para guardar tokens. Todas las peticiones usan `credentials: 'include'`, de forma que el navegador envía la cookie de sesión HTTP (emitida por Symfony tras el login) automáticamente.
- El rol del usuario se obtiene del endpoint `/api/me` como parte del objeto `user.roles`, no decodificando un JWT.
- Al arrancar la SPA, `useEffect` dispara `checkAuth()` para restaurar la sesión si la cookie sigue viva.

### 4.5. Configuración de seguridad — `backend/config/packages/security.yaml`

```yaml
password_hashers:
    Symfony\Component\Security\Core\User\PasswordAuthenticatedUserInterface: 'auto'

providers:
    app_user_provider:
        entity:
            class: App\Entity\User
            property: email

firewalls:
    main:
        lazy: true
        provider: app_user_provider
        json_login:
            check_path: api_login
            username_path: email
            password_path: password
        logout:
            path: api_logout

access_control:
    - { path: ^/api/login, roles: PUBLIC_ACCESS }
    - { path: ^/api,       roles: IS_AUTHENTICATED_FULLY }
```

- **`password_hashers: auto`** → Symfony elige automáticamente el mejor algoritmo disponible (actualmente bcrypt, con migración automática a algoritmos más modernos si se configuran en el futuro).
- **`json_login`** → en lugar del form login clásico de Twig, el firewall acepta un cuerpo JSON `{ "email": "...", "password": "..." }`, perfecto para una SPA.
- **Stateful (sesión) en lugar de stateless (JWT)** → aunque LexikJWTBundle está instalado (`backend/config/packages/lexik_jwt_authentication.yaml`), el firewall principal es stateful. Ver la píldora 5.3 para la justificación.

### 4.6. Infraestructura y base de datos

**Archivo:** `docker-compose.yml` (raíz del proyecto)

| Servicio | Imagen | Rol |
|---|---|---|
| `caddy` | `caddy:2-alpine` | Proxy HTTPS (puertos 8443 → frontend, 9443 → backend) |
| `database` | `mariadb:10.11` | BD, puerto 3307 externo |
| `backend` | Build local | Symfony + API Platform |
| `frontend` | Build local | Vite + React |
| `minio` | `minio/minio` | Storage S3 (avatares, adjuntos) |
| `redis` | `redis:7-alpine` | Cache + cola Messenger |
| `mercure` | `dunglas/mercure` | Push de eventos en tiempo real |
| `worker` | Imagen backend | Consumer de jobs asíncronos |

**Credenciales de BD** (solo desarrollo local):

- BD: `app_db`
- Usuario: `app_user` / `app_password`
- Tabla de usuarios: `usuario`

**Variables relevantes del backend** (`backend/.env`):

```
DATABASE_URL="mysql://app_user:app_password@database:3306/app_db?serverVersion=10.11.15-MariaDB&charset=utf8mb4"
JWT_SECRET_KEY=%kernel.project_dir%/config/jwt/private.pem
JWT_PUBLIC_KEY=%kernel.project_dir%/config/jwt/public.pem
CORS_ALLOW_ORIGIN=^https?://(localhost|127\.0\.0\.1|.*\.ngrok-free\.app)(:[0-9]+)?$
```

La configuración CORS permite al frontend (`https://localhost:8443`) llamar al backend (`https://localhost:9443`) incluyendo cookies, requisito imprescindible para la autenticación basada en sesión.

---

## 5. Píldoras de investigación

### 5.1. Seguridad en contraseñas: hashing y salting

Las contraseñas **nunca** se guardan en claro. En Loggex se usa el hasher `auto` de Symfony, que actualmente selecciona **bcrypt** (algoritmo adaptativo con factor de coste configurable, resistente a ataques por fuerza bruta). El hasher genera un **salt aleatorio por contraseña**, incluido en el hash resultante (`$2y$13$salt_y_hash...`), lo que impide ataques por tablas rainbow.

Frente a bcrypt, algoritmos más modernos como **Argon2id** (ganador del Password Hashing Competition 2015) ofrecen resistencia adicional frente a GPUs/ASICs al consumir también memoria. Symfony soporta Argon2id de forma nativa (`password_hashers: argon2id`). La configuración `auto` permite migrar transparentemente cuando un hash antiguo sea validado, rehasheándolo con el algoritmo actual.

### 5.2. Autenticación de dos factores (2FA)

La integración de 2FA en Symfony está resuelta por el bundle **`scheb/2fa-bundle`**, que ofrece:

- **TOTP** (Google Authenticator, Authy) vía `scheb/2fa-totp`.
- **Email con código de un solo uso** vía `scheb/2fa-email`.
- **Códigos de backup** para recuperación.

La integración encaja limpiamente con el firewall existente: tras el `json_login`, el bundle inserta una "fase de verificación 2FA" antes de autorizar el acceso completo. Para Loggex, la implementación natural sería añadir un campo `totp_secret` a la entidad `User` y un endpoint adicional `POST /api/login/2fa-verify` que el frontend invocaría como segundo paso.

### 5.3. Sesiones vs JWT

Loggex tiene LexikJWTBundle instalado pero **usa sesión + cookie HttpOnly**. Esta decisión se tomó por seguridad:

| Aspecto | Cookie de sesión (elegido) | JWT en localStorage |
|---|---|---|
| Vulnerable a XSS | **No** (cookie HttpOnly no es accesible desde JS) | **Sí** (cualquier script inyectado puede robar el token) |
| Vulnerable a CSRF | Mitigado con SameSite=Lax y CORS estricto | No aplica |
| Revocación inmediata | **Trivial** (invalidar sesión en servidor) | Requiere blacklist o tokens de vida muy corta |
| Escalable horizontalmente | Requiere store compartido (Redis) | Nativo (stateless) |

Para una SPA de uso interno como Loggex, donde el front y back están en el mismo dominio y el coste de un Redis compartido es asumible, la **cookie HttpOnly gana por protección frente a XSS**. JWT seguiría siendo preferible para APIs públicas consumidas por terceros o para arquitecturas de microservicios distribuidos.

---

## 6. Conclusión

El módulo de autenticación de Loggex está operativo end-to-end: se ha verificado el flujo completo de alta de usuario por administrador → login → navegación protegida → logout, con contraseñas hasheadas y sesión segura basada en cookie HttpOnly. La arquitectura desacoplada (API REST + SPA) cumple el mismo propósito que el monolito Twig clásico del enunciado, pero deja la API preparada para ser consumida por otros clientes (p. ej. una futura app móvil del centro).
