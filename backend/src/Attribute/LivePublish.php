<?php

namespace App\Attribute;

use Attribute;

/**
 * Marca una entidad Doctrine como "live": cambios CRUD (postPersist/Update/Remove)
 * publican un update Mercure en los topics indicados.
 *
 * El LivePublishSubscriber lee este atributo, expande placeholders
 * (`{prop}`, `{prop.subprop}` con notación dot) usando PropertyAccess,
 * serializa el payload con los grupos indicados y despacha PublishMercureUpdate
 * al bus async (sin bloquear la respuesta HTTP).
 *
 * Topics que no resuelvan todos sus placeholders (p.ej. `{centro.id}` con
 * centro=null) se descartan silenciosamente — útil para entidades cuya
 * relación opcional decide a qué canal va el evento.
 *
 * Ejemplo:
 *   #[LivePublish(
 *     topics: ['/centros/{centro.id}/comunicados'],
 *     payloadGroups: ['comunicado:read', 'centro:read', 'user:read', 'timestamp:read'],
 *   )]
 *   class Comunicado { ... }
 */
#[Attribute(Attribute::TARGET_CLASS)]
final class LivePublish
{
    /**
     * @param string[]      $topics          Topics aplicados a persist+update+remove (atajo común)
     * @param string[]|null $topicsOnPersist Override para postPersist (si null, usa $topics)
     * @param string[]|null $topicsOnUpdate  Override para postUpdate
     * @param string[]|null $topicsOnRemove  Override para postRemove
     * @param string[]      $payloadGroups   Grupos de serialización para `data` del payload
     * @param bool          $private         Update privado (true) — sólo suscriptores con JWT que incluya el topic lo reciben
     */
    public function __construct(
        public readonly array $topics = [],
        public readonly ?array $topicsOnPersist = null,
        public readonly ?array $topicsOnUpdate = null,
        public readonly ?array $topicsOnRemove = null,
        public readonly array $payloadGroups = [],
        public readonly bool $private = true,
    ) {
    }

    /** @return string[] */
    public function topicsForPersist(): array
    {
        return $this->topicsOnPersist ?? $this->topics;
    }

    /** @return string[] */
    public function topicsForUpdate(): array
    {
        return $this->topicsOnUpdate ?? $this->topics;
    }

    /** @return string[] */
    public function topicsForRemove(): array
    {
        return $this->topicsOnRemove ?? $this->topics;
    }
}
