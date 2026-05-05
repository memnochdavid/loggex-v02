<?php

namespace App\EventSubscriber;

use App\Entity\Calificacion;
use App\Entity\Comunicado;
use App\Entity\Entrega;
use App\Entity\Tarea;
use App\Service\NotificationDispatcher;
use Doctrine\Bundle\DoctrineBundle\Attribute\AsDoctrineListener;
use Doctrine\ORM\Event\PostFlushEventArgs;
use Doctrine\ORM\Event\PostPersistEventArgs;
use Doctrine\ORM\Events;

/**
 * Convierte eventos del dominio en notificaciones del sistema.
 *
 * Para cada `postPersist` de las entidades disparadoras (catálogo §3 del
 * doc), encola la entidad en una lista interna; en `postFlush` consume la
 * lista llamando al dispatcher (que `persist`-ea Notificaciones) y hace un
 * `flush` final.
 *
 * **Por qué postFlush y no postPersist directo**: persistir Notificaciones
 * desde dentro de un postPersist está formalmente permitido por Doctrine
 * (las nuevas entidades entran en el mismo unit-of-work y se escriben en
 * la misma transacción), pero la cadena puede generar nuevos postPersist
 * para las propias Notificaciones que el LivePublishSubscriber escucha
 * — ya tematizado pero más simple separar los flushes con la cola interna.
 *
 * **Regla anti-duplicación**: los Mensajes (`App\Entity\Mensaje`) NO se
 * escuchan aquí — la campanita actual del header (mensajes inter-personales)
 * los cubre. Mezclar generaría contadores duplicados (ver decisión D1 del
 * doc).
 *
 * Doc: docs/hoja-de-ruta-notificaciones.md §1.2 + §3.
 */
#[AsDoctrineListener(event: Events::postPersist)]
#[AsDoctrineListener(event: Events::postFlush)]
class NotificationDispatchSubscriber
{
    /** @var list<Calificacion|Tarea|Comunicado|Entrega> */
    private array $pending = [];

    /** Re-entrancy guard: evita procesar la cola dos veces si el flush
     *  interno dispara más postFlush. */
    private bool $processing = false;

    public function __construct(
        private readonly NotificationDispatcher $dispatcher,
    ) {
    }

    public function postPersist(PostPersistEventArgs $args): void
    {
        $entity = $args->getObject();
        if (
            $entity instanceof Calificacion
            || $entity instanceof Tarea
            || $entity instanceof Comunicado
            || $entity instanceof Entrega
        ) {
            $this->pending[] = $entity;
        }
    }

    public function postFlush(PostFlushEventArgs $args): void
    {
        if ($this->processing || $this->pending === []) {
            return;
        }
        $this->processing = true;

        try {
            $batch = $this->pending;
            $this->pending = [];

            foreach ($batch as $entity) {
                if ($entity instanceof Calificacion) {
                    $this->dispatcher->notifyCalificacionPublicada($entity);
                } elseif ($entity instanceof Tarea) {
                    $this->dispatcher->notifyTareaNueva($entity);
                } elseif ($entity instanceof Comunicado) {
                    $this->dispatcher->notifyComunicadoNuevo($entity);
                } elseif ($entity instanceof Entrega) {
                    $this->dispatcher->notifyEntregaRecibida($entity);
                }
            }

            // Flush final para escribir las Notificaciones persistidas por
            // el dispatcher. Esto dispara otro postFlush que no hace nada
            // (cola vacía + processing=true).
            $args->getObjectManager()->flush();
        } finally {
            $this->processing = false;
        }
    }
}
