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
use Doctrine\ORM\Event\PreUpdateEventArgs;
use Doctrine\ORM\Events;

/**
 * Convierte eventos del dominio en notificaciones del sistema.
 *
 * **Triggers**:
 *  - `postPersist` de Calificacion / Tarea / Comunicado / Entrega → tipos
 *    `calificacion_publicada`, `tarea_nueva`, `comunicado_nuevo`,
 *    `entrega_recibida` (catálogo §3 del doc).
 *  - `preUpdate` de Calificacion **solo si cambia el campo `nota`** → tipo
 *    `calificacion_actualizada`. Ediciones que no tocan la nota (p.ej. solo
 *    feedback del profesor) no notifican.
 *
 * **Por qué postFlush para procesar la cola**: persistir Notificaciones
 * desde dentro de un postPersist está formalmente permitido por Doctrine
 * (las nuevas entidades entran en el mismo unit-of-work y se escriben en
 * la misma transacción), pero la cadena puede generar nuevos postPersist
 * para las propias Notificaciones que el LivePublishSubscriber escucha
 * — más simple separar los flushes con la cola interna.
 *
 * **Regla anti-duplicación**: los Mensajes (`App\Entity\Mensaje`) NO se
 * escuchan aquí — la campanita actual del header (mensajes inter-personales)
 * los cubre. Mezclar generaría contadores duplicados (ver decisión D1 del
 * doc).
 *
 * Doc: docs/hoja-de-ruta-notificaciones.md §1.2 + §3.
 */
#[AsDoctrineListener(event: Events::postPersist)]
#[AsDoctrineListener(event: Events::preUpdate)]
#[AsDoctrineListener(event: Events::postFlush)]
class NotificationDispatchSubscriber
{
    /** @var list<Calificacion|Tarea|Comunicado|Entrega> Entidades creadas (postPersist) */
    private array $pendingPersist = [];

    /** @var list<Calificacion> Calificaciones cuyo `nota` ha cambiado (preUpdate) */
    private array $pendingCalUpdate = [];

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
            $this->pendingPersist[] = $entity;
        }
    }

    public function preUpdate(PreUpdateEventArgs $args): void
    {
        $entity = $args->getObject();
        if (!$entity instanceof Calificacion) {
            return;
        }
        // Solo notificar si la NOTA ha cambiado. Ediciones de feedbackProfesor
        // u otros campos no merecen una notificación al alumno (decisión §3
        // del doc — no spam por correcciones internas).
        if ($args->hasChangedField('nota')) {
            $this->pendingCalUpdate[] = $entity;
        }
    }

    public function postFlush(PostFlushEventArgs $args): void
    {
        if ($this->processing) {
            return;
        }
        if ($this->pendingPersist === [] && $this->pendingCalUpdate === []) {
            return;
        }
        $this->processing = true;

        try {
            $persistBatch = $this->pendingPersist;
            $updateBatch = $this->pendingCalUpdate;
            $this->pendingPersist = [];
            $this->pendingCalUpdate = [];

            foreach ($persistBatch as $entity) {
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

            foreach ($updateBatch as $cal) {
                $this->dispatcher->notifyCalificacionActualizada($cal);
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
