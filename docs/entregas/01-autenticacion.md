## 1. Introducción

Este documento recoge la primera entrega parcial del TFG, centrada en la validación del módulo de autenticación (login) y de la página de inicio (home) del dashboard. Dado que Loggex es una plataforma B2B destinada a centros educativos, **no existe autorregistro público**: las altas de usuarios las realiza un administrador del centro desde el panel de gestión. Este apartado se documenta más abajo como equivalente al "formulario de registro" que pide el enunciado.

## 2. Nota sobre la arquitectura (Twig vs SPA)

El enunciado asume una aplicación Symfony monolítica con Twig y `base.html.twig`. En este TFG se ha optado por una **arquitectura desacoplada**:

- **Backend:** Symfony 8 + **API Platform 3** expone una API REST JSON-LD.
- **Frontend:** **React 19 + Vite 7 + React Router 7** como Single Page Application.

Esta decisión se tomó en la fase de diseño por tres motivos: (a) separación clara de responsabilidades, (b) la API queda reutilizable para futuras apps móviles, y (c) se gana una experiencia de usuario más fluida (navegación sin recargas, actualizaciones en tiempo real vía Mercure). El equivalente funcional de `base.html.twig` es el layout React definido en `frontend/src/App.jsx` junto al componente `Sidebar`, que envuelve todas las rutas protegidas.

---

## 3. Entregables

### 3.1. Página de Inicio (Home)

La home es un **dashboard post-login** con widgets contextuales según el rol del usuario (saludo dinámico, estadísticas rápidas, tablón de comunicados, horario del día, mensajes recientes y tareas pendientes).

**Ruta frontend:** `/` — protegida por `<PrivateRoute>`
**Componente:** `frontend/src/pages/Home.jsx`

![Vista general de la home: sidebar a la izquierda, stat ribbon superior y bento grid de widgets contextuales (tablón de anuncios, horario del día, mensajes recientes, tareas pendientes).](images/home-dashboard.png)

*Captura sacada con GoFullPage, extensión de Chrome. No se ve exactamente así, pero te puedes hacer una idea.*

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

<table class="figure-pair">
<tr>
<td>

![Modal "Nuevo Usuario" recién abierto, sin datos.](images/usuario-modal-vacio.png)

</td>
<td>

![El mismo modal con datos válidos rellenados, listo para enviar.](images/usuario-modal-datos.png)

</td>
</tr>
</table>

Una vez creado el usuario, vemos que aparece en la vista CRUD de usuarios:

![Fila del nuevo usuario "Iván El Trolazo" en la tabla `/usuarios`, con avatar, datos de contacto y rol asignado.](images/usuarios-datatable-nuevo.png)

Si queremos, podemos usar SQL para hacer la consulta:

```sql
select * from usuario where apellidos like "El Trolazo"
```

![Resultado en la herramienta de base de datos integrada de PhpStorm: id, email, password (hasheado con bcrypt `$2y$13$…`), nombre, apellidos, rol_app y centro_id.](images/dbeaver-usuario-bcrypt.png)

![Toast de confirmación "Usuario creado" en la cabecera del centro tras un alta correcta.](images/toast-usuario-creado.png)

![Toast de error "Ya existe un usuario con ese email — No se ha podido crear el usuario" al intentar reutilizar un email existente.](images/toast-email-duplicado.png)

---

### 3.3. Formulario de Login

**Ruta frontend:** `/login` — pública
**Componente:** `frontend/src/pages/Login.jsx`
**Endpoint backend:** `POST /api/login`

El formulario pide `email` y `password`. Tras un login exitoso, el AuthContext almacena los datos del usuario y React Router redirige a la ruta previa (o a `/` si el usuario entró directamente).

<table class="figure-pair">
<tr>
<td>

![Formulario de login con credenciales válidas rellenadas, listo para enviar.](images/login-vacio.png)

</td>
<td>

![Mismo formulario tras un intento con credenciales inválidas: aparece el mensaje "Error al iniciar sesión" sobre el campo de email.](images/login-error.png)

</td>
</tr>
</table>

![Cabecera del dashboard tras un login exitoso: saludo dinámico al usuario y stat ribbon con su resumen del día.](images/post-login-saludo.png)

---

### 3.4. Evidencia de conexión con la base de datos

Para demostrar que el registro persiste correctamente en MariaDB, se aporta la consulta directa sobre la tabla `usuario`.

**Cliente sugerido:** `docker compose exec database mariadb -u app_user -papp_password app_db` o bien la herramienta de base de datos integrada de PhpStorm conectada a `localhost:3307`.

**Consulta para ver todos los usuarios existentes:**

```sql
select * from usuario
```

Vemos cantidad de resultados, debido a los fixtures existentes:

![Resultado completo de la consulta en la herramienta de base de datos integrada de PhpStorm: muchas filas correspondientes a los fixtures cargados, con sus contraseñas hasheadas con bcrypt visibles en la columna `password`.](images/dbeaver-todos-usuarios.png)

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

![Vista de `/about/er`: visualización dinámica del modelo entidad-relación del proyecto, con desglose de cada entidad, sus campos y sus relaciones en vivo.](images/entity-relacion-vista.png)

*Captura sacada con GoFullPage, extensión de Chrome. No se ve exactamente así, pero te puedes hacer una idea. Esta vista de `/about/er` se ha añadido específicamente para la exposición del TFG; permite explorar el modelo entidad-relación de forma totalmente dinámica y ver las relaciones entre las entidades en vivo, con desglose y todo lujo de detalles. Si el proyecto se llevase a producción comercial, sería una funcionalidad que se ocultaría o eliminaría.*

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
- **Stateful (sesión) en lugar de stateless (JWT)** → el firewall principal autentica con cookie de sesión HttpOnly. JWT sí se usa en el proyecto, pero en otro plano: como mecanismo de autorización del hub Mercure (eventos en tiempo real). LexikJWTBundle está instalado pero inactivo, preparado para una futura API pública. Ver la píldora 5.3 para el detalle.

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

### 5.3. Sesiones, JWT y el rol de cada uno

JWT en Loggex no es una decisión binaria de "se usa o no se usa": cumple **dos roles distintos** y conviene separarlos. La regla aplicada en todo el proyecto ha sido *usar JWT donde el protocolo lo exige y prescindir de él donde se puede elegir algo más seguro frente a XSS*.

#### a) Autenticación de usuarios → cookie de sesión HttpOnly (no JWT)

El firewall `main` de `security.yaml` es **stateful**: tras el `json_login` el navegador recibe una cookie de sesión HttpOnly y todas las llamadas a `/api/...` viajan con `credentials: 'include'`. Ningún endpoint del proyecto exige `Authorization: Bearer <token>`.

| Aspecto | Cookie de sesión (elegido) | JWT en localStorage |
|---|---|---|
| Vulnerable a XSS | **No** (cookie HttpOnly no es accesible desde JS) | **Sí** (cualquier script inyectado puede robar el token) |
| Vulnerable a CSRF | Mitigado con SameSite=Lax y CORS estricto | No aplica |
| Revocación inmediata | **Trivial** (invalidar sesión en servidor) | Requiere blacklist o tokens de vida muy corta |
| Escalable horizontalmente | Requiere store compartido (Redis) | Nativo (stateless) |

Para una SPA de uso interno como Loggex, donde front y back viven en el mismo dominio y existe un Redis compartido, la **cookie HttpOnly gana por protección frente a XSS**. JWT seguiría siendo preferible para APIs públicas consumidas por terceros o para arquitecturas de microservicios distribuidos.

#### b) Mercure (eventos en tiempo real) → JWT, sin alternativa por especificación

Loggex utiliza **Mercure** (`dunglas/mercure`) para empujar al frontend cambios en vivo (mensajes, comunicados, calificaciones nuevas…). El protocolo Mercure se basa en Server-Sent Events y **toda su autorización va en JWT firmado** — no hay otra forma de hacerlo. Hay dos flujos:

- **Publicador (backend → hub):** cuando una entidad cambia y debe notificarse, el backend firma un JWT con el claim `mercure.publish: ["*"]` usando `MERCURE_JWT_SECRET` (`backend/.env`) y lo envía al hub. Sin ese token el hub rechaza el `POST`.
- **Suscriptor (frontend → hub):** para recibir eventos privados (los topics dirigidos a este usuario o a su centro), el backend emite una cookie HttpOnly `mercureAuthorization` con un JWT que contiene `mercure.subscribe: ["topic1", "topic2", …]` listando los topics que ese usuario tiene derecho a escuchar. El navegador la envía sola al conectar al hub.

Detalle relevante: este JWT usa **HS256 con un secreto compartido** (`MERCURE_JWT_SECRET`), distinto del par **RS256** que tiene configurado LexikJWT (`JWT_SECRET_KEY` / `JWT_PUBLIC_KEY` en `.env`). La razón es que Mercure y el backend confían entre sí (viven en el mismo despliegue), por lo que la simetría de HS256 resulta más simple y barata. RS256 tendría sentido cuando un cliente no confiable necesita verificar el token sin poder firmarlo, escenario que en Loggex hoy no se da.

Es importante notar también que la cookie `mercureAuthorization` que transporta este JWT al hub **también es HttpOnly**, de modo que la elección de "no exponer tokens al JavaScript del navegador" se mantiene coherente en toda la aplicación.

#### c) LexikJWTBundle → instalado pero inactivo

`LexikJWTAuthenticationBundle` aparece en `config/bundles.php` y se han generado las claves RS256 en `backend/config/jwt/`. Sin embargo, ningún firewall lo activa hoy. Se dejó preparado para un escenario futuro previsible: **exponer la API a clientes no acoplados a la sesión web** (una app móvil del centro, integraciones de terceros, un Single Sign-On cross-dominio). Cuando llegue ese caso, bastará con añadir un firewall paralelo `api_jwt` con `pattern: ^/api/external` y `stateless: true`, sin tocar nada del flujo actual.

En resumen: en Loggex se usa **cookie HttpOnly para autenticar usuarios**, **JWT (HS256) por exigencia del protocolo de Mercure**, y se reserva **JWT (RS256) vía LexikJWT** para una eventual apertura de la API a terceros.

#### d) ¿No usar JWT para autenticar perjudica la seguridad?

No: en este proyecto la decisión de **no usar JWT para autenticar mejora la postura de seguridad**, no la empeora. La intuición de "JWT = más moderno = más seguro" es un mito muy extendido que conviene desmontar.

JWT no es un mecanismo de seguridad: es un **formato de credencial**. Sus propiedades reales dependen de (a) dónde lo guarda el cliente, (b) cómo lo transmite, (c) cómo se revoca. Lo que cambia entre "sesión" y "JWT" no es la robustez criptográfica — Symfony firma ambos con algoritmos sólidos — sino *dónde vive la credencial en el navegador* y *quién puede invalidarla*.

| Vector | Sesión + cookie HttpOnly (Loggex) | JWT en localStorage (alternativa típica) |
|---|---|---|
| **Robo por XSS** | Imposible: el JS no puede leer cookies HttpOnly | Trivial: cualquier `<script>` inyectado lee `localStorage` y exfiltra el token |
| **Revocación tras compromiso** | Instantánea (borra la sesión y caduca) | El token sigue válido hasta su `exp`; requiere blacklist (que rompe el "stateless") o tokens de vida corta con refresh (más superficie de ataque) |
| **Logout real** | Destruye la sesión en servidor | El token sigue siendo válido fuera del cliente que lo "olvidó" |
| **CSRF** | Mitigado con `SameSite=Lax` + CORS estricto | No aplica si viaja en `Authorization: Bearer` |

OWASP lleva años recomendando **no almacenar credenciales en `localStorage`** precisamente por el primer vector: en una SPA con dependencias npm, una sola vulnerabilidad XSS (propia o de una librería transitiva) convierte el robo de tokens en trivial. La cookie HttpOnly cierra ese vector por construcción.

JWT sería preferible (o imprescindible) en escenarios que **no aplican a Loggex hoy**: clientes en otro dominio donde las cookies resultan incómodas, microservicios que verifican credenciales sin llamar a un servicio central de sesión, o autenticación en el edge a gran escala sin store compartido. Para el día en que aparezca un cliente externo, LexikJWT ya está preparado para activar un firewall stateless paralelo (ver apartado c).

La coherencia que persigue el proyecto es clara: **ninguna credencial vive en el JavaScript del navegador**. Ni la sesión de usuario (cookie HttpOnly), ni el token de Mercure (cookie `mercureAuthorization` también HttpOnly). Esa postura es estrictamente más segura que la de la mayoría de SPAs que delegan en `localStorage`.

---

## 6. Conclusión

El módulo de autenticación de Loggex está operativo end-to-end: se ha verificado el flujo completo de alta de usuario por administrador → login → navegación protegida → logout, con contraseñas hasheadas y sesión segura basada en cookie HttpOnly. La arquitectura desacoplada (API REST + SPA) cumple el mismo propósito que el monolito Twig clásico del enunciado, pero deja la API preparada para ser consumida por otros clientes (p. ej. una futura app móvil del centro).
