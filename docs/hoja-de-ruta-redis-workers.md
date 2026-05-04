# Hoja de Ruta: Redis + Mercure + Workers para Tiempo Real

## ⚡ Snapshot para retomar (2026-05-04)

**Sesión 1 Live CRUD ✅ Done (2026-05-04) — framework + smoke test Comunicado.**
Ver §"Bitácora Live CRUD" al final del doc para el detalle.

**Implementado:**
- Bundle `symfony/mercure-bundle` instalado y registrado.
- Contenedor `mercure` corriendo en Docker.
- `MercurePublishSubscriber` escucha `Mensaje::postPersist/postUpdate` y publica eventos `new_message` / `message_read` a topics `/users/{id}/messages` y `/users/{id}/notifications`.
- `Symfony Messenger` con cola async para `PublishMercureUpdate` (no bloquea HTTP).
- Frontend: hook `useMercure(topics, onEvent)` con EventSource, reconexión automática y cookie firmada vía `/api/me/mercure-subscribe`.
- Consumido por: `NotificationList`, `Mensajes.jsx`, `useUnreadMessages.js`.
- **Framework Live CRUD declarativo (sesión 1 2026-05-04)**: atributo `#[LivePublish]`, `LivePublishSubscriber` genérico (postPersist/Update/Remove), comando `app:mercure:invalidate` (fallback SQL), hook frontend `useLiveCollection`. Aplicado a `Comunicado` + `TablonWidget` como smoke test (validar end-to-end pendiente del usuario).

**Deuda principal — live updates CRUD:**
- Quedan por migrar las vistas de prioridad alta+media (Imparticion, Matricula, Grupo, Itinerario, Horario, Festivo, Tarea, Entrega, Calificacion). Plan: ~2 sesiones más siguiendo el patrón ya validado.
- Falta extender `MercureAuthController` con topics `/admin/centros/{cid}/{rec}` para que admins puedan suscribirse a vistas de gestión. Se hará en sesión 2 al migrar la primera vista admin.
- Comunicados globales (`global=true`, `centro=null`) aún no propagan: el placeholder `{centro.id}` no resuelve y el topic se descarta. Requiere mecanismo de "topic condicional" en el atributo.

Ver §"Deuda — Live updates CRUD para todas las vistas con persistencia" + §"Bitácora Live CRUD" más abajo.

---

## Problema Actual

Toda la "reactividad" de Loggex se basa en **polling directo a la BD** desde el frontend:

| Mecanismo | Intervalo | Endpoint(s) | Impacto BD |
|---|---|---|---|
| Chat (Mensajes.jsx) | **1s** | `/api/v1/mensajes` | Muy alto: 1 query/s por usuario en chat |
| Notificaciones (NotificationList) | **3s** | `/api/mensajes?leido=false` | Alto: cada 3s por usuario con la app abierta |
| Mensajes sin leer (useUnreadMessages) | 30s | `/api/mensajes?leido=false` | Medio (duplica NotificationList) |
| Stats Home (useHomeStats) | 60s | `/api/tareas` + `/api/my-schedule` + `/api/entregas?calificacion=null` | Medio: 3 queries concurrentes/min |

**Problemas:**
- Con 50 usuarios concurrentes en chat: 50 queries/s solo para mensajes.
- NotificationList y useUnreadMessages hacen lo mismo con intervalos distintos.
- Sin cache: cada poll golpea MariaDB directamente.
- Latencia perceptible: el chat "se siente" lento (hasta 1s de delay).

---

## Arquitectura Objetivo

```
Frontend (React)
    │
    ├── EventSource (Mercure) ← para mensajes, notificaciones, stats
    │       1 conexión SSE persistente por usuario, gestionada por el hub Mercure
    │
    └── fetch REST ← para CRUD (tareas, usuarios, etc.) — sin cambios
    
Backend (Symfony)
    │
    ├── Controladores REST ← sin cambios (API Platform)
    │
    ├── Mercure Publisher ← al crear/editar mensaje, entrega, calificación...
    │       publica update al hub Mercure con topic por usuario/recurso
    │
    └── Symfony Messenger ← despacha jobs async a Redis
    
Mercure Hub (binario Go)
    └── Recibe updates del backend → los push-ea a los clientes suscritos vía SSE
        Autenticación por JWT (misma clave que LexikJWT)
    
Redis
    ├── Cache ← stats precalculados, contadores de no-leídos
    └── Queue ← transport para Symfony Messenger (jobs async)
    
Worker(s) (Symfony Messenger)
    └── Consume jobs → recalcula medias, genera PDFs, invalida cache, etc.
```

### Por qué Mercure + Redis (en vez de solo Redis pub/sub)

**Mercure** es el protocolo estándar recomendado por Symfony para tiempo real:
- **SSE nativo** — el hub gestiona las conexiones, reconexión, heartbeat. No hay que implementar un SseController manual.
- **Autenticación por JWT** — usa la misma clave que LexikJWT. El backend firma un token con los topics a los que el usuario puede suscribirse; el hub lo valida. Seguridad built-in.
- **API Platform integration** — basta con añadir `mercure: true` a una entidad para que los updates se publiquen automáticamente al crear/editar/borrar.
- **Un solo binario Go (~15MB)** — se añade a docker-compose y ya. No hay que programar el servidor de eventos.
- **Topics flexibles** — se puede suscribir por usuario (`/users/57`), por recurso (`/mensajes/{id}`), por grupo (`/centros/3/comunicados`), etc.

**Redis** se mantiene para lo que hace mejor: cache de lectura rápida y cola de trabajos (Messenger transport). No hace pub/sub — eso lo hace Mercure.

| Responsabilidad | Componente |
|---|---|
| Tiempo real (push al cliente) | **Mercure** |
| Cache de lectura | **Redis** |
| Cola de jobs async | **Redis** (Messenger transport) |
| API REST / CRUD | **API Platform** (sin cambios) |

---

## Fases de Implementación

### Fase 1: Infraestructura Redis + Mercure + Cache

**Objetivo:** Añadir Redis y Mercure al stack. Redis cachea las queries frecuentes (el polling golpea cache en vez de BD). Mercure queda disponible pero aún no se usa desde el frontend.

#### Docker Compose

```yaml
redis:
  image: redis:7-alpine
  volumes:
    - redis_data:/data
  command: redis-server --appendonly yes
  healthcheck:
    test: ["CMD", "redis-cli", "ping"]
    interval: 10s
    retries: 3

mercure:
  image: dunglas/mercure
  restart: unless-stopped
  environment:
    # Misma clave JWT que LexikJWT para simplificar
    MERCURE_PUBLISHER_JWT_KEY: '${JWT_SECRET}'
    MERCURE_SUBSCRIBER_JWT_KEY: '${JWT_SECRET}'
    MERCURE_PUBLISHER_JWT_ALG: 'HS256'
    MERCURE_SUBSCRIBER_JWT_ALG: 'HS256'
    # Permitir orígenes del frontend
    MERCURE_EXTRA_DIRECTIVES: |
      cors_origins https://localhost:8443
      anonymous
  ports:
    - "3000:80"
  volumes:
    - mercure_data:/data
```

#### Backend — Symfony Cache con Redis

```yaml
# config/packages/cache.yaml
framework:
  cache:
    app: cache.adapter.redis
    default_redis_provider: 'redis://redis:6379'
```

#### Backend — Mercure Bundle

```bash
composer require symfony/mercure-bundle
```

```yaml
# config/packages/mercure.yaml
mercure:
  hubs:
    default:
      url: 'http://mercure/.well-known/mercure'
      jwt:
        secret: '%env(JWT_SECRET)%'
        algorithm: 'hmac.sha256'
```

#### Endpoints a cachear (invalidación por evento Doctrine)

| Dato | Clave Redis | TTL | Invalidado cuando |
|---|---|---|---|
| Mensajes sin leer de user X | `unread:{userId}` | 60s | Se crea/lee mensaje con destinatario X |
| Stats Home de user X | `home_stats:{userId}` | 30s | Se crea tarea, entrega, calificación en sus imparticiones |
| Horario de user X | `schedule:{userId}` | 5min | Se modifica horario de su grupo/impartición |
| Entregas sin calificar del profe X | `pending_deliveries:{userId}` | 30s | Se crea entrega o calificación en sus imparticiones |

**Invalidación:** Event subscribers de Doctrine (`postPersist`, `postUpdate`, `postRemove`) que borran las claves afectadas.

**Frontend:** Sin cambios todavía. Sigue polling, pero las respuestas salen de Redis (~1ms) en vez de queries SQL.

**Resultado:** Carga de MariaDB reducida drásticamente. Latencia de polling <5ms.

---

### Fase 2: Mercure — Tiempo Real sin Polling

**Objetivo:** Reemplazar todo el polling del frontend por suscripciones Mercure. El usuario recibe eventos push instantáneamente.

#### Backend — Publicación de updates

Cada acción relevante publica un update Mercure en los topics del usuario afectado:

```php
use Symfony\Component\Mercure\HubInterface;
use Symfony\Component\Mercure\Update;

class MensajeEventSubscriber implements EventSubscriberInterface
{
    public function __construct(private HubInterface $hub) {}

    public function onMensajeCreated(MensajeCreatedEvent $event): void
    {
        $mensaje = $event->getMensaje();
        $destinatarioId = $mensaje->getDestinatario()->getId();

        $this->hub->publish(new Update(
            // Topics: el destinatario se suscribe a estos
            [
                "/users/{$destinatarioId}/messages",
                "/users/{$destinatarioId}/notifications",
            ],
            json_encode([
                'type' => 'new_message',
                'data' => [
                    'id' => $mensaje->getId(),
                    'from' => $mensaje->getRemitente()->getId(),
                    'fromName' => $mensaje->getRemitente()->getNombre(),
                    'preview' => mb_substr($mensaje->getTexto(), 0, 80),
                    'timestamp' => $mensaje->getFechaEnvio()->format('c'),
                ],
            ]),
            // Private: solo el usuario con JWT que incluya este topic puede recibirlo
            true
        ));
    }
}
```

#### Topics por funcionalidad

| Topic | Quién se suscribe | Eventos que recibe |
|---|---|---|
| `/users/{id}/messages` | El usuario {id} | `new_message`, `message_read` |
| `/users/{id}/notifications` | El usuario {id} | `new_message`, `new_delivery`, `grade_updated`, `new_comunicado` |
| `/users/{id}/stats` | El usuario {id} | `stats_update` (pendingTasks, pendingDeliveries, etc.) |
| `/centros/{id}/comunicados` | Todos los usuarios del centro | `new_comunicado` |
| `/imparticiones/{id}/entregas` | El profesor de la impartición | `new_delivery` |

#### API Platform — Mercure automático en entidades

Para entidades donde queremos updates automáticos al CRUD:

```php
#[ApiResource(
    mercure: true,  // Publica update automáticamente en POST/PUT/PATCH/DELETE
)]
class Mensaje { ... }
```

Esto publica automáticamente cuando se crea/edita un mensaje vía API Platform, sin necesidad de event subscriber manual. Para lógica custom (topics privados, payload específico), se usa el subscriber manual.

#### Frontend — Hook `useMercure`

```javascript
import { useEffect, useCallback, useRef } from 'react';
import { useAuth } from '../context/AuthContext';

const MERCURE_HUB_URL = 'https://localhost:3000/.well-known/mercure';

export function useMercure(topics, onEvent) {
    const { user } = useAuth();
    const callbackRef = useRef(onEvent);
    callbackRef.current = onEvent;

    useEffect(() => {
        if (!user?.id || !topics?.length) return;

        const url = new URL(MERCURE_HUB_URL);
        topics.forEach(topic => url.searchParams.append('topic', topic));

        const source = new EventSource(url, { withCredentials: true });

        source.onmessage = (e) => {
            try {
                const event = JSON.parse(e.data);
                callbackRef.current(event);
            } catch { /* ignore malformed */ }
        };

        // EventSource reconecta automáticamente con backoff
        source.onerror = () => {
            console.warn('Mercure: conexión perdida, reconectando...');
        };

        return () => source.close();
    }, [user?.id, JSON.stringify(topics)]);
}
```

#### Migración de cada mecanismo de polling

**useUnreadMessages → useMercure:**
```javascript
// Antes: polling cada 30s a /api/mensajes?leido=false
// Después:
const [unreadCount, setUnreadCount] = useState(0);

// Carga inicial (1 sola vez)
useEffect(() => { fetchUnreadCount().then(setUnreadCount); }, []);

// Updates en tiempo real
useMercure(
    [`/users/${user.id}/notifications`],
    (event) => {
        if (event.type === 'new_message') setUnreadCount(c => c + 1);
        if (event.type === 'message_read') fetchUnreadCount().then(setUnreadCount);
    }
);
```

**NotificationList → useMercure:**
```javascript
// Antes: polling cada 3s
// Después:
useMercure(
    [`/users/${user.id}/notifications`],
    (event) => {
        if (event.type === 'new_message') {
            setNotifications(prev => [event.data, ...prev].slice(0, limit));
        }
    }
);
```

**Mensajes.jsx (Chat) → useMercure:**
```javascript
// Antes: polling cada 1s a /api/v1/mensajes
// Después:
useMercure(
    [`/users/${user.id}/messages`],
    (event) => {
        if (event.type === 'new_message') {
            // Añadir a la conversación correcta
            addMessageToConversation(event.data);
        }
        if (event.type === 'message_read') {
            // Actualizar estado de leído
            markConversationRead(event.data.conversationId);
        }
    }
);
```

**useHomeStats → useMercure:**
```javascript
// Antes: polling cada 60s a 3 endpoints
// Después:
// Carga inicial (1 sola vez)
useEffect(() => { fetchStats().then(setStats); }, []);

// Updates en tiempo real
useMercure(
    [`/users/${user.id}/stats`],
    (event) => {
        if (event.type === 'stats_update') setStats(event.data);
    }
);
```

**Fallback:** Si Mercure se desconecta (red inestable), EventSource reconecta automáticamente. Si la reconexión tarda >10s, activar polling lento (30s) como respaldo temporal.

**Resultado:** Chat instantáneo (0ms delay percibido), 0 polling, 1 conexión SSE por usuario gestionada por Mercure.

---

### Fase 3: Workers con Symfony Messenger

**Objetivo:** Mover lógica pesada fuera del request HTTP. El profesor pone una nota → respuesta instantánea; el recálculo de medias, generación de PDFs, publicación a Mercure... todo en background.

#### Docker Compose — Worker

```yaml
worker:
  build: ./backend
  command: php bin/console messenger:consume async --time-limit=3600 --memory-limit=256M
  depends_on:
    - redis
    - database
    - mercure
  restart: unless-stopped
  deploy:
    replicas: 2  # 2 workers en paralelo
```

#### Transport Redis (Messenger)

```yaml
# config/packages/messenger.yaml
framework:
  messenger:
    transports:
      async:
        dsn: 'redis://redis:6379/messages'
        options:
          stream: loggex_jobs
          group: workers
          consumer: worker_%hostname%
    routing:
      App\Message\RecalcularMedias: async
      App\Message\PublicarMercureUpdate: async
      App\Message\GenerarBoletin: async
      App\Message\InvalidarCache: async
      App\Message\EnviarEmailResumen: async
```

#### Jobs a mover a workers

| Job | Trigger | Qué hace | Prioridad |
|---|---|---|---|
| `RecalcularMedias` | POST/PUT/PATCH calificacion | Recalcula medias del alumno, invalida cache, publica `stats_update` vía Mercure | Alta |
| `InvalidarCache` | Cualquier write en entidades cacheadas | Borra claves Redis afectadas | Alta |
| `PublicarMercureUpdate` | Cualquier acción notificable | Publica update en el hub Mercure | Alta |
| `GenerarBoletin` | Solicitud de PDF de boletín | Genera PDF y lo sube a MinIO | Media |
| `EnviarEmailResumen` | Cron diario | Email resumen a profesores con entregas pendientes | Baja |
| `LimpiarSesiones` | Cron horario | Limpia tokens JWT expirados | Baja |

#### Ejemplo: flujo completo de "profesor pone nota"

```
1. Frontend: PATCH /api/calificacions/245 { nota: 7.5 }
2. Backend Controller: actualiza BD, responde 200 (~50ms)
3. Doctrine postUpdate Event: despacha RecalcularMedias al bus
4. Worker (async):
   a. Recalcula medias del alumno
   b. Invalida cache Redis (home_stats:{alumnoId}, pending_deliveries:{profId})
   c. Publica Mercure update en /users/{alumnoId}/stats
   d. Publica Mercure update en /users/{alumnoId}/notifications (grade_updated)
5. Frontend del alumno: recibe SSE → stats se actualizan, aparece notificación
```

**Resultado:** Respuestas HTTP instantáneas (~50ms). El trabajo pesado se procesa en paralelo sin bloquear al usuario.

---

### Fase 4: Monitorización y Observabilidad

#### Redis
- `redis-cli INFO` para métricas de memoria, conexiones, hit rate.
- Docker healthcheck (ya incluido en Fase 1).

#### Mercure
- Dashboard nativo del hub (si se habilita `debug: true`).
- Logs del contenedor para conexiones activas.
- Métrica: conexiones SSE activas (el hub lo expone).

#### Workers
- `php bin/console messenger:stats` — cola pendiente por transport.
- `php bin/console messenger:failed:show` — jobs fallidos.
- Alertas si la cola crece por encima de 100 jobs pendientes.
- Logs por job (level INFO para éxito, ERROR para fallos).

#### Caddy
- Logs de acceso para `/api/v1/` y `/.well-known/mercure`.
- Métricas de requests/segundo (confirmar que el polling desapareció).

---

## Configuración de Caddy para Mercure

```caddyfile
# Proxy al hub Mercure
handle /.well-known/mercure* {
    reverse_proxy mercure:80
}
```

El hub Mercure se sirve a través de Caddy como cualquier otro servicio. El frontend se conecta a `https://localhost:8443/.well-known/mercure` (mismo dominio, sin CORS).

---

## Orden de Ejecución Recomendado

```
Fase 1 (Infraestructura + Cache)
  ├── Añadir Redis + Mercure a docker-compose
  ├── composer require symfony/mercure-bundle
  ├── Configurar Symfony Cache con Redis adapter
  ├── Configurar Mercure bundle (hub URL + JWT)
  ├── Configurar Caddy proxy para Mercure
  ├── Cachear endpoints de lectura frecuente
  ├── Event subscribers Doctrine para invalidación de cache
  └── Verificar: polling sigue, pero respuestas salen de Redis
         ↓
Fase 2 (Mercure — Tiempo Real)
  ├── Event subscribers que publican updates Mercure
  ├── mercure: true en entidades clave (Mensaje, Comunicado)
  ├── Hook useMercure en frontend
  ├── Migrar useUnreadMessages → useMercure
  ├── Migrar NotificationList → useMercure
  ├── Migrar Mensajes.jsx chat → useMercure
  ├── Migrar useHomeStats → useMercure
  ├── Eliminar POLLING_INTERVAL_* de api.js
  ├── Fallback polling para desconexiones
  └── Verificar: 0 polling, chat instantáneo
         ↓
Fase 3 (Workers — Async)
  ├── Configurar Symfony Messenger con Redis transport
  ├── Crear Message classes + Handlers
  ├── Añadir worker service a docker-compose (2 replicas)
  ├── Migrar RecalcularMedias a async
  ├── Migrar GenerarBoletin a async
  ├── Migrar PublicarMercureUpdate a async
  └── Verificar: jobs se procesan sin bloquear HTTP
         ↓
Fase 4 (Monitorización)
  ├── Healthchecks Redis + Mercure + Workers
  ├── Dashboard de métricas (opcional)
  └── Alertas de cola
```

---

## Impacto en Archivos Existentes

### Backend (modificar)
- `docker-compose.yml` — añadir servicios redis, mercure, worker
- `Caddyfile` — proxy para Mercure hub
- `config/packages/cache.yaml` — adapter Redis
- `config/packages/mercure.yaml` — hub URL + JWT (**nuevo**)
- `config/packages/messenger.yaml` — transport Redis (**nuevo**)
- Controladores que crean/editan Mensaje, Entrega, Calificacion, Comunicado — despachar al bus
- Nuevo: `src/EventSubscriber/CacheInvalidationSubscriber.php`
- Nuevo: `src/EventSubscriber/MercureEventPublisher.php`
- Nuevo: `src/Message/` (clases de mensajes para workers)
- Nuevo: `src/MessageHandler/` (handlers)

### Frontend (modificar)
- `src/config/api.js` — eliminar `POLLING_INTERVAL_*`, añadir `MERCURE_HUB_URL`
- `src/hooks/useUnreadMessages.js` — reemplazar polling por `useMercure`
- `src/hooks/useHomeStats.js` — reemplazar polling por `useMercure`
- `src/components/NotificationList.jsx` — reemplazar polling por `useMercure`
- `src/pages/Mensajes.jsx` — reemplazar polling por `useMercure`
- Nuevo: `src/hooks/useMercure.js`

### Sin cambios
- Entidades Doctrine (sin cambios de schema, solo añadir `mercure: true` opcionalmente)
- API Platform resources (los endpoints REST siguen igual)
- Todas las vistas/componentes UI (solo cambia de dónde viene el dato)
- Auth (JWT) — Mercure reutiliza la misma clave

---

## Comparativa: Antes vs Después

| Métrica | Antes (polling) | Después (Mercure + Redis) |
|---|---|---|
| Queries/s a BD (50 usuarios) | ~60/s | ~2/s (solo writes) |
| Latencia de chat | 0-1000ms | <50ms |
| Latencia de notificaciones | 0-3000ms | <50ms |
| Conexiones HTTP por usuario | 4 intervalos concurrentes | 1 SSE persistente |
| Banda ancha consumida | Alta (respuestas repetidas) | Mínima (solo deltas) |
| Complejidad de deploy | Baja (solo PHP + MariaDB) | Media (+ Redis + Mercure + Workers) |

---

## Deuda — Live updates CRUD para todas las vistas con persistencia

**Detectada 2026-04-27** tras observación del usuario: "he tenido que refrescar la página para ver los cambios. pensaba que mercure se ocupaba de mantener todo actualizado en tiempo real".

**Estado actual** (ver Snapshot arriba): el `MercurePublishSubscriber` solo cubre `Mensaje`. Para cualquier otra entidad (Itinerario, Grupo, Imparticion, Matricula, Festivo, Materia, Centro, Calificacion, Tarea, Entrega, Temario, Comunicado…), si el admin/profesor hace un cambio:
1. Si lo hizo via API REST → Doctrine emite eventos pero no hay listener para esa entidad → no se publica al hub.
2. Si lo hizo via SQL directo (caso del seed) → Doctrine ni se entera → ningún evento.
3. Otros usuarios viendo esa misma vista en otro navegador NO se enteran. Tienen que hacer F5.

**Caso de uso concreto que motivó la deuda**: superadmin matricula 20 alumnos vía SQL para test; admin de centro tiene `/admin/matriculas` abierta y no ve los nuevos. El usuario espera que la lista se actualice sola.

### Alcance esperado por el usuario

Toda vista que muestre datos persistidos del backend debe refrescarse automáticamente cuando esos datos cambian, **sin importar quién los modifique** (admin actual, otro admin, comando CLI, seed SQL).

### Diseño propuesto

Sistema **declarativo** que minimice el código por entidad:

#### Backend — `#[LivePublish]` atributo PHP

Atributo que marca una entidad como "live" con metadata de topics:

```php
#[ORM\Entity]
#[LivePublish(
    topicsOnPersist: ['/admin/itinerarios', '/centros/{centro_id}/itinerarios'],
    topicsOnUpdate: ['/admin/itinerarios', '/itinerarios/{id}'],
    topicsOnRemove: ['/admin/itinerarios'],
    payloadGroups: ['itinerario:read'],
)]
class Itinerario { ... }
```

Un `LivePublishSubscriber` genérico (postPersist/postUpdate/postRemove en todas las entidades con el atributo) lee la metadata, expande placeholders (`{id}`, `{centro_id}`...) con valores de la entidad, serializa el payload con los grupos indicados y despacha `PublishMercureUpdate` por cada topic.

#### Backend — fallback para SQL directo

Comando `app:mercure:invalidate --topics=...` que dispara publicaciones manualmente. Pensado para usar tras seeds o migraciones SQL. Documentar en MEMORY.md la regla: "tras `mysql -e 'INSERT/UPDATE...'` que afecte a entidades live, ejecutar el comando para que los clientes conectados se enteren".

#### Frontend — hook `useLiveCollection(endpoint, topic)`

Reemplaza `useEffect + fetch` en cada vista con una sola línea:

```js
const { items, total, loading, refetch } = useLiveCollection(
  `/api/itinerarios?centro=${centroId}`,
  `/centros/${centroId}/itinerarios`,
);
```

El hook hace fetch inicial + abre EventSource al topic + al recibir evento hace refetch (debounced 200ms para agrupar ráfagas). Maneja paginación y filtros automáticamente.

#### Cobertura objetivo (priorización)

Por orden de impacto en UX percibida:

| Vista | Entidad principal | Topics | Prioridad |
|---|---|---|---|
| `/admin/imparticiones` | Imparticion | `/admin/centros/{centro_id}/imparticiones` | Alta |
| `/admin/matriculas` | Matricula | `/admin/centros/{centro_id}/matriculas` | Alta |
| `/admin/grupos` | Grupo | `/admin/centros/{centro_id}/grupos` | Alta |
| `/admin/itinerarios` | Itinerario | `/admin/centros/{centro_id}/itinerarios` | Alta |
| `/admin/horarios` | Horario | `/admin/grupos/{id}/horarios` | Alta — múltiples profes editando |
| `/horarios` (vista personal) | Horario | `/users/{id}/schedule` | Media |
| `/admin/festivos` | Festivo | `/centros/{centro_id}/festivos` | Media |
| `/admin/tareas` y entregas | Tarea, Entrega | `/grupos/{id}/tareas`, `/users/{id}/entregas` | Media |
| `/admin/calificaciones` | Calificacion | `/grupos/{id}/calificaciones`, `/users/{id}/calificaciones` | Media |
| `/admin/usuarios` | User | `/admin/centros/{centro_id}/usuarios` | Baja |
| `/admin/centros` | Centro | `/admin/centros` | Baja (cambios poco frecuentes) |
| `/admin/catalogo/*` | CatalogoItinerario, CatalogoMateria | `/catalogo` | Baja (read-only del seed) |

#### Esfuerzo estimado

- Atributo PHP `#[LivePublish]` + subscriber genérico + comando manual: **~1 sesión** (~4h).
- Hook `useLiveCollection`: **~2h**.
- Migración por vista: **~30 min cada una**, ordenado por prioridad.

Total para cobertura completa de vistas alta+media: **~3 sesiones**.

### Mientras tanto

Hasta que se implemente, **toda nueva vista CRUD que se cree debe**:
1. Documentar explícitamente que requiere F5 manual hasta que llegue Mercure live.
2. Considerar si vale la pena un polling local en `useEffect` con `setInterval` corto (no recomendado por carga BD; usar solo si la vista lo justifica).
3. Asumir que los seeds SQL directos NO disparan ninguna actualización para nadie.

### Deuda relacionada

- **Cron anual fetch BOE** (calendario laboral) que vive aquí cuando llegue Symfony Scheduler.
- **Notificaciones tipo "el admin acaba de matricular un alumno en tu grupo"** se beneficia del mismo sistema con un topic adicional por usuario afectado.

---

## Bitácora Live CRUD

### Sesión 1 ✅ Done (2026-05-04) — Framework + smoke test Comunicado

**Objetivo:** dejar el patrón declarativo listo y validado con UNA entidad antes de migrar el resto. Permite que cada vista posterior se migre con ~30 min de cambio.

**Implementado:**

1. **`backend/src/Attribute/LivePublish.php`** — atributo PHP `#[LivePublish]` con campos:
   - `topics: string[]` — atajo aplicado a persist+update+remove.
   - `topicsOnPersist|Update|Remove: ?string[]` — overrides por evento.
   - `payloadGroups: string[]` — grupos de serialización para `data` del payload.
   - `private: bool` — privado (true) por defecto: solo suscriptores con JWT que incluya el topic lo reciben.
   - Soporta placeholders `{prop}` y `{prop.subprop}` con notación dot (PropertyAccess).

2. **`backend/src/EventSubscriber/LivePublishSubscriber.php`** — listener Doctrine genérico (postPersist/postUpdate/postRemove). Para cualquier entidad marcada con el atributo:
   - Lee atributo (cache estático por clase, lectura de reflexión solo la primera vez).
   - Expande topics; si algún placeholder no resuelve (objeto null), descarta ese topic silenciosamente.
   - Serializa con `payloadGroups` (omite `data` en `remove`).
   - Despacha `PublishMercureUpdate` al bus async (Redis), no bloquea HTTP.
   - Payload: `{ type: 'persist'|'update'|'remove', entity: 'Comunicado', id: 123, data: {...}|null }`.

3. **`backend/src/Command/MercureInvalidateCommand.php`** — `app:mercure:invalidate -t /topic1 -t /topic2 -r "razón"`. Despacha update con `type: 'invalidate'` para señalizar refetch a clientes tras seeds o INSERT/UPDATE SQL directos (Doctrine no se entera → el subscriber no dispara).
   - **Gotcha Windows**: Git Bash mangla los paths que empiezan por `/` (los convierte a `C:/Program Files/Git/...`). Workaround: prefijar `MSYS_NO_PATHCONV=1` o ejecutar desde dentro del contenedor (`docker compose exec backend bash`).

4. **`frontend/src/hooks/useLiveCollection.js`** — hook que combina:
   - Fetch inicial al endpoint REST.
   - Suscripción a topics Mercure vía `useMercure`.
   - Refetch debounced 200ms al recibir cualquier evento (colapsa ráfagas, p.ej. una migración batch).
   - Token de in-flight para descartar respuestas obsoletas (race condition de fetch).
   - Endpoint REST queda como fuente de verdad — no hay reducer optimista por id (evita inconsistencias con filtros, ordenación o filtro por centro hechos en backend).
   - API: `useLiveCollection({ endpoint, topics, parseItems?, parseTotal?, headers?, enabled?, debounceMs?, onEvent? })`.

5. **`backend/src/Entity/Comunicado.php`** — primera entidad con `#[LivePublish]`:
   ```php
   #[LivePublish(
     topics: ['/centros/{centro.id}/comunicados'],
     payloadGroups: ['comunicado:read', 'timestamp:read', 'softdelete:read', 'user:read', 'centro:read'],
   )]
   ```
   - `/centros/{centroId}/comunicados` ya estaba firmado en el JWT del `MercureAuthController`, así que **no hizo falta tocar auth**.

6. **`frontend/src/components/TablonWidget.jsx`** — migrado de `useEffect+fetch+manual refetch` a `useLiveCollection`. Conserva el `refetch()` explícito tras handleSave/handleDelete por inmediatez UX (no esperar a que llegue el SSE de vuelta).

**Smoke tests ejecutados:**
- ✅ `php bin/console debug:container LivePublishSubscriber` → registrado con tags `postPersist`, `postUpdate`, `postRemove`, autowired `MessageBusInterface` + `SerializerInterface`.
- ✅ `php bin/console list app:mercure` → `app:mercure:invalidate` aparece junto a los `:test` y `:test-async` existentes.
- ✅ `app:mercure:invalidate -t /centros/1/comunicados -r "smoke"` → `[OK] Publicado update invalidate a 1 topic(s) [privado]`. Job entra al stream Redis sin error.
- ⏳ **Pendiente verificación visual usuario**: abrir TablonWidget en dos pestañas, crear/editar/eliminar comunicado en una y verificar que la otra refresca sola.

**Limitaciones conocidas (apuntadas para sesión 2):**

| Limitación | Mitigación |
|---|---|
| Comunicados globales (`global=true`, `centro=null`) no se propagan: el placeholder `{centro.id}` falla y el topic se descarta. | Añadir mecanismo `condition` al atributo o `topicsConditional` (mapa expr→topics). Mientras: el publicador ve el cambio (refetch local), el resto necesita F5. |
| `MercureAuthController` solo firma `/users/{id}/*` y `/centros/{id}/comunicados`. Vistas admin necesitarán topics tipo `/admin/centros/{cid}/{rec}`. | Extender en sesión 2 al migrar la primera vista admin. Recomendado URI template `/admin/centros/{cid}/{rec}` para admins de centro y `/admin/centros/{cid}/{rec}` con cid wildcard para superadmin. |
| El subscriber re-serializa la entidad en cada flush. Para entidades con relaciones pesadas o bulk operations puede ser caro. | Aceptable para CRUD UI normal. Si aparece bottleneck: mover serialización al worker (que ya recibe el update via bus). |
| Si la cola Redis cae, los eventos se pierden silenciosamente. | Asumido: live update es best-effort; el siguiente fetch de la vista (F5 manual o navegación) recupera consistencia. |

### Próximos pasos (sesión 2 — ~3-4h)

**Orden propuesto** (de menos riesgo a más):

1. **Extender `MercureAuthController`**: añadir topics admin/centro al JWT firmado según rol. Sin esto, los admins no pueden suscribirse a `/admin/centros/{cid}/{rec}`.
2. **Mecanismo de topics condicionales** en `#[LivePublish]` (probablemente `topicsConditional: ['expr' => ['/topic']]` con ExpressionLanguage). Resuelve el caso comunicados globales y abre puertas a entidades con routing dinámico.
3. **Migrar `/admin/imparticiones`** (alta prioridad #1 del roadmap) — incluye `useLiveCollection` con paginación.
4. **Migrar `/admin/matriculas`** (alta prioridad #2).
5. **Migrar `/admin/grupos`**, `/admin/itinerarios`.

Las vistas con paginación/filtros pueden necesitar pasar query params al fetch inicial dentro de `useLiveCollection` (ya soportado vía `endpoint`). Conviene re-evaluar el debounce si vista tiene >50 items por página (refetch puede ser caro).

### Sesión 3 (estimado)

- `/admin/horarios` (clave para multi-edición), `/admin/festivos`, `/admin/tareas`, `/admin/calificaciones`.
- Vistas de profesor: `/horarios` personal, `/entregas` por imparticion.
- Documentar el patrón en `CLAUDE.md` para que cualquier vista nueva use `useLiveCollection` por defecto.
- Retirar la "regla obligatoria" de F5 manual del `INDEX.md` cuando la cobertura llegue al 100% de vistas alta+media.

---
