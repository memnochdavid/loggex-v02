<?php

namespace App\Message;

/**
 * Job async para publicar un update al hub Mercure.
 *
 * La publicación al hub es una llamada HTTP síncrona; si se hace dentro del
 * flush de Doctrine bloquea la respuesta al cliente. Despachando este mensaje
 * el controlador responde inmediato y un worker Messenger publica en paralelo.
 *
 * Payload ya serializado como string (normalmente JSON) para que el mensaje
 * sea transportable por Redis sin sorpresas de serialización.
 */
final class PublishMercureUpdate
{
    public function __construct(
        /** @var string[] */
        public readonly array $topics,
        public readonly string $payload,
        public readonly bool $private = true,
    ) {
    }
}
