<?php

namespace App\EventSubscriber;

use App\Entity\Mensaje;
use App\Message\PublishMercureUpdate;
use Doctrine\Bundle\DoctrineBundle\Attribute\AsDoctrineListener;
use Doctrine\ORM\Event\PostPersistEventArgs;
use Doctrine\ORM\Event\PostUpdateEventArgs;
use Doctrine\ORM\Events;
use Symfony\Component\Messenger\MessageBusInterface;

/**
 * Detecta cambios relevantes en entidades y despacha un job async
 * (`PublishMercureUpdate`) para publicar al hub. La publicación no bloquea
 * el flush HTTP: ocurre en el worker Messenger.
 *
 * Todas las publicaciones son privadas: solo usuarios con JWT de suscripción
 * que incluya el topic las reciben.
 */
#[AsDoctrineListener(event: Events::postPersist)]
#[AsDoctrineListener(event: Events::postUpdate)]
class MercurePublishSubscriber
{
    public function __construct(private readonly MessageBusInterface $bus)
    {
    }

    public function postPersist(PostPersistEventArgs $args): void
    {
        $entity = $args->getObject();
        if ($entity instanceof Mensaje) {
            $this->publishNewMessage($entity);
        }
    }

    public function postUpdate(PostUpdateEventArgs $args): void
    {
        $entity = $args->getObject();
        if ($entity instanceof Mensaje) {
            $this->publishMessageUpdate($entity);
        }
    }

    private function publishNewMessage(Mensaje $mensaje): void
    {
        $destinatario = $mensaje->getDestinatario();
        $remitente = $mensaje->getRemitente();
        if (!$destinatario || !$remitente) {
            return;
        }

        $destinatarioId = $destinatario->getId();
        $payload = json_encode([
            'type' => 'new_message',
            'data' => [
                'id' => $mensaje->getId(),
                'from' => $remitente->getId(),
                'fromName' => trim(($remitente->getNombre() ?? '') . ' ' . ($remitente->getApellidos() ?? '')),
                'fromFoto' => method_exists($remitente, 'getFoto') ? $remitente->getFoto() : null,
                'to' => $destinatarioId,
                'texto' => $mensaje->getTexto(),
                'preview' => mb_substr((string) $mensaje->getTexto(), 0, 80),
                'fechaEnvio' => $mensaje->getFechaEnvio()?->format('c'),
                'leido' => $mensaje->isLeido(),
            ],
        ]);

        $this->bus->dispatch(new PublishMercureUpdate(
            [
                "/users/{$destinatarioId}/messages",
                "/users/{$destinatarioId}/notifications",
            ],
            $payload,
            true
        ));
    }

    private function publishMessageUpdate(Mensaje $mensaje): void
    {
        // Por ahora solo nos interesa la transición a leído para que el remitente
        // pueda actualizar los ticks de "visto" y el destinatario resetee su contador.
        $destinatario = $mensaje->getDestinatario();
        $remitente = $mensaje->getRemitente();
        if (!$destinatario || !$remitente) {
            return;
        }

        $payload = json_encode([
            'type' => 'message_read',
            'data' => [
                'id' => $mensaje->getId(),
                'from' => $remitente->getId(),
                'to' => $destinatario->getId(),
                'leido' => $mensaje->isLeido(),
            ],
        ]);

        // Publicar a ambos extremos para que ambos reflejen el estado.
        $this->bus->dispatch(new PublishMercureUpdate(
            [
                "/users/{$destinatario->getId()}/messages",
                "/users/{$remitente->getId()}/messages",
                "/users/{$destinatario->getId()}/notifications",
            ],
            $payload,
            true
        ));
    }
}
