# Hoja de Ruta: Redis + Workers para Tiempo Real

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
    ├── SSE (Server-Sent Events) ← para mensajes, notificaciones, stats
    │       EventSource persistente, una conexión por usuario
    │
    └── fetch REST ← para CRUD (tareas, usuarios, etc.) — sin cambios
    
Backend (Symfony)
    │
    ├── Controladores REST ← sin cambios (API Platform)
    │
    ├── Event Dispatcher ← al crear/editar mensaje, entrega, calificación...
    │       despacha evento a Redis (pub/sub)
    │
    └── SSE Controller ← endpoint /api/v1/stream
            lee de Redis, emite al cliente conectado
    
Redis
    ├── Pub/Sub ← canal por usuario (user:{id}:events)
    ├── Cache ← stats precalculados, contadores
    └── Queue (opcional fase 3) ← jobs pesados
    
Worker(s) (Symfony Messenger)
    └── Consume eventos → precalcula stats, limpia cache, etc.
```

### Por qué SSE en vez de WebSockets

- **SSE** funciona sobre HTTP estándar — compatible con Caddy sin config extra.
- Unidireccional (servidor → cliente) — suficiente para notificaciones y chat (el envío de mensajes sigue siendo POST REST).
- Más simple que WebSockets: no hay handshake, no hay heartbeat custom, auto-reconnect nativo del browser.
- Si en el futuro se necesita bidireccional (ej: typing indicators), se puede migrar a WS sin cambiar la arquitectura Redis.

---

## Fases de Implementación

### Fase 1: Infraestructura Redis + Cache de Lectura

**Objetivo:** Añadir Redis al stack y usarlo como cache para las queries más frecuentes. El frontend sigue con polling pero golpea Redis en vez de MariaDB.

**Docker Compose:**
```yaml
redis:
  image: redis:7-alpine
  ports:
    - "6379:6379"
  volumes:
    - redis_data:/data
  command: redis-server --appendonly yes
```

**Backend — Symfony Cache:**
```yaml
# config/packages/cache.yaml
framework:
  cache:
    app: cache.adapter.redis
    default_redis_provider: 'redis://redis:6379'
```

**Endpoints a cachear (invalidación por evento):**

| Dato | Clave Redis | TTL | Invalidado cuando |
|---|---|---|---|
| Mensajes sin leer de user X | `unread:{userId}` | 60s | Se crea/lee mensaje con destinatario X |
| Stats Home de user X | `home_stats:{userId}` | 30s | Se crea tarea, entrega, calificación en sus imparticiones |
| Horario de user X | `schedule:{userId}` | 5min | Se modifica horario de su grupo/impartición |
| Entregas sin calificar del profe X | `pending_deliveries:{userId}` | 30s | Se crea entrega o calificación en sus imparticiones |

**Invalidación:** Event subscribers de Doctrine (`postPersist`, `postUpdate`, `postRemove`) que borran las claves afectadas.

**Frontend:** Sin cambios. Sigue polling, pero las respuestas son instantáneas (Redis) en vez de queries SQL.

**Resultado:** Reducción drástica de carga en MariaDB. La latencia del polling baja a <5ms.

---

### Fase 2: SSE — Tiempo Real sin Polling

**Objetivo:** Reemplazar todo el polling del frontend por una conexión SSE persistente. El usuario recibe eventos push instantáneamente.

#### Backend

**Nuevo endpoint SSE:**
```php
#[Route('/api/v1/stream', name: 'api_sse_stream', methods: ['GET'])]
public function stream(): StreamedResponse
{
    $user = $this->getUser();
    $response = new StreamedResponse(function () use ($user) {
        $redis = new \Redis();
        $redis->connect('redis', 6379);
        $redis->subscribe(["user:{$user->getId()}:events"], function ($redis, $channel, $message) {
            echo "data: {$message}\n\n";
            ob_flush();
            flush();
        });
    });
    $response->headers->set('Content-Type', 'text/event-stream');
    $response->headers->set('Cache-Control', 'no-cache');
    $response->headers->set('X-Accel-Buffering', 'no');
    return $response;
}
```

**Publicación de eventos (Event Subscribers):**

Cada acción relevante publica un evento JSON en el canal del usuario afectado:

```php
// Al crear un mensaje
$this->redis->publish("user:{$destinatarioId}:events", json_encode([
    'type' => 'new_message',
    'data' => [
        'from' => $remitente->getId(),
        'fromName' => $remitente->getNombre(),
        'preview' => mb_substr($mensaje->getTexto(), 0, 80),
        'conversationId' => $remitente->getId(),
        'timestamp' => (new \DateTime())->format('c'),
    ],
]));
```

**Tipos de evento:**

| Evento | Publicado cuando | Canal(es) | Payload |
|---|---|---|---|
| `new_message` | Se crea un Mensaje | `user:{destinatarioId}` | from, preview, timestamp |
| `message_read` | Se marcan mensajes como leídos | `user:{remitentes}` | conversationId |
| `unread_count` | Cambia el conteo de no leídos | `user:{userId}` | count |
| `new_delivery` | Alumno entrega una tarea | `user:{profesorId}` | tareaId, alumnoNombre |
| `grade_updated` | Profesor pone/modifica nota | `user:{alumnoId}` | tareaId, nota |
| `new_comunicado` | Se publica comunicado | `user:{todos del centro}` | titulo, preview |
| `stats_update` | Cambian stats del home | `user:{userId}` | pendingTasks, pendingDeliveries, etc. |

#### Frontend

**Hook `useEventStream`:**
```javascript
export function useEventStream() {
    const { user } = useAuth();
    const [lastEvent, setLastEvent] = useState(null);

    useEffect(() => {
        if (!user) return;
        const source = new EventSource(getApiUrl('/api/v1/stream'), {
            withCredentials: true,
        });
        source.onmessage = (e) => {
            const event = JSON.parse(e.data);
            setLastEvent(event);
            // Dispatch a un event bus interno
            window.dispatchEvent(new CustomEvent('sse-event', { detail: event }));
        };
        source.onerror = () => {
            // Auto-reconnect nativo de EventSource (backoff exponencial)
        };
        return () => source.close();
    }, [user?.id]);

    return lastEvent;
}
```

**Migración de cada mecanismo de polling:**

| Antes (polling) | Después (SSE) |
|---|---|
| `useUnreadMessages` (30s poll) | Escucha evento `unread_count` → actualiza estado |
| `NotificationList` (3s poll) | Escucha evento `new_message` → añade al listado local |
| `useHomeStats` (60s poll) | Escucha evento `stats_update` → actualiza chips |
| `Mensajes.jsx` (1s poll) | Escucha `new_message` + `message_read` → actualiza conversación |

**Cada componente se suscribe a los tipos de evento que le interesan:**
```javascript
useEffect(() => {
    const handler = (e) => {
        if (e.detail.type === 'new_message') {
            // Añadir mensaje a la conversación local
        }
    };
    window.addEventListener('sse-event', handler);
    return () => window.removeEventListener('sse-event', handler);
}, []);
```

**Fallback:** Si SSE se desconecta (red inestable), los hooks vuelven a polling lento (30s) como respaldo. Al reconectar SSE, se desactiva el polling automáticamente.

**Resultado:** Chat instantáneo (0ms delay), 0 polling, 1 conexión HTTP por usuario.

---

### Fase 3: Workers con Symfony Messenger

**Objetivo:** Mover lógica pesada fuera del request HTTP — el profesor pone una nota y la respuesta es instantánea; el recálculo de medias, envío de notificaciones, etc. ocurren en background.

**Docker Compose — Worker:**
```yaml
worker:
  build: ./backend
  command: php bin/console messenger:consume async --time-limit=3600 --memory-limit=256M
  depends_on:
    - redis
    - database
  restart: unless-stopped
  deploy:
    replicas: 2  # 2 workers en paralelo
```

**Transport Redis:**
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
      App\Message\EnviarNotificacionPush: async
      App\Message\GenerarBoletin: async
      App\Message\InvalidarCache: async
```

**Jobs a mover a workers:**

| Job | Trigger | Qué hace | Prioridad |
|---|---|---|---|
| `RecalcularMedias` | PUT/POST calificacion | Recalcula medias del alumno + publica `stats_update` por SSE | Alta |
| `InvalidarCache` | Cualquier write en entidades cacheadas | Borra claves Redis afectadas | Alta |
| `PublicarEventoSSE` | Cualquier acción notificable | Publica en canal Redis del usuario | Alta |
| `GenerarBoletin` | Solicitud de PDF de boletín | Genera PDF y lo sube a MinIO | Media |
| `EnviarEmailResumen` | Cron diario | Email resumen a profesores con entregas pendientes | Baja |
| `LimpiarSesiones` | Cron horario | Limpia tokens JWT expirados | Baja |

**Resultado:** Las respuestas HTTP son instantáneas (~50ms). El trabajo pesado se procesa en paralelo sin bloquear al usuario.

---

## Fase 4: Monitorización y Observabilidad

**Redis:**
- `redis-cli INFO` para métricas de memoria/conexiones.
- Supervisord o Docker healthcheck para restart automático.

**Workers:**
- `messenger:stats` para ver cola pendiente.
- Log de errores por job (`messenger:failed:show`).
- Alertas si la cola crece por encima de umbral (>100 jobs pendientes).

**SSE:**
- Contador de conexiones activas (middleware que incrementa/decrementa en Redis).
- Timeout de conexiones inactivas (Caddy: `flush_interval 100ms`, `read_timeout 5m`).

---

## Configuración de Caddy para SSE

```caddyfile
handle /api/v1/stream {
    reverse_proxy backend:80 {
        flush_interval 100ms
        transport http {
            read_timeout 0
        }
    }
}
```

---

## Orden de Ejecución Recomendado

```
Fase 1 (Cache Redis)
  ├── Añadir Redis a docker-compose
  ├── Configurar Symfony Cache con Redis adapter
  ├── Cachear endpoints de lectura frecuente
  ├── Event subscribers para invalidación
  └── Verificar: polling sigue funcionando pero sin tocar BD
         ↓
Fase 2 (SSE)
  ├── Endpoint /api/v1/stream con Redis pub/sub
  ├── Hook useEventStream en frontend
  ├── Migrar useUnreadMessages → SSE
  ├── Migrar NotificationList → SSE
  ├── Migrar Mensajes.jsx chat → SSE
  ├── Migrar useHomeStats → SSE
  ├── Eliminar polling constants de api.js
  ├── Fallback polling para desconexiones
  └── Configurar Caddy para SSE
         ↓
Fase 3 (Workers)
  ├── Configurar Symfony Messenger con Redis transport
  ├── Crear Message classes + Handlers
  ├── Añadir worker service a docker-compose
  ├── Migrar RecalcularMedias a async
  ├── Migrar GenerarBoletin a async
  ├── Migrar PublicarEventoSSE a async
  └── Verificar: jobs se procesan sin bloquear HTTP
         ↓
Fase 4 (Monitorización)
  ├── Healthchecks Redis + Workers
  ├── Dashboard de métricas (opcional)
  └── Alertas de cola
```

---

## Impacto en Archivos Existentes

### Backend (modificar)
- `docker-compose.yml` — añadir servicio redis + worker
- `config/packages/cache.yaml` — adapter Redis
- `config/packages/messenger.yaml` — transport Redis
- `Caddyfile` — configurar SSE proxy
- Controladores que crean/editan Mensaje, Entrega, Calificacion, Comunicado — despachar eventos
- Nuevo: `src/Controller/SseController.php`
- Nuevo: `src/EventSubscriber/CacheInvalidationSubscriber.php`
- Nuevo: `src/EventSubscriber/SseEventPublisher.php`
- Nuevo: `src/Message/` (clases de mensajes para workers)
- Nuevo: `src/MessageHandler/` (handlers)

### Frontend (modificar)
- `src/config/api.js` — eliminar `POLLING_INTERVAL_*`
- `src/hooks/useUnreadMessages.js` — reemplazar polling por SSE listener
- `src/hooks/useHomeStats.js` — reemplazar polling por SSE listener
- `src/components/NotificationList.jsx` — reemplazar polling por SSE listener
- `src/pages/Mensajes.jsx` — reemplazar polling por SSE listener
- Nuevo: `src/hooks/useEventStream.js`

### Sin cambios
- Entidades Doctrine (sin cambios de schema)
- API Platform resources (los endpoints REST siguen igual)
- Todas las vistas/componentes UI (solo cambia de dónde viene el dato)
