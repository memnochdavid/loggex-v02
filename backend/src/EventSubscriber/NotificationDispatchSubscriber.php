<?php

namespace App\EventSubscriber;

use App\Entity\Calificacion;
use App\Entity\Comunicado;
use App\Entity\Entrega;
use App\Entity\EstadoExcepcion;
use App\Entity\ExcepcionHorario;
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
    /** @var list<Calificacion|Tarea|Comunicado|Entrega|ExcepcionHorario> Entidades creadas (postPersist) */
    private array $pendingPersist = [];

    /** @var list<Calificacion> Calificaciones cuyo `nota` ha cambiado (preUpdate) */
    private array $pendingCalUpdate = [];

    /**
     * @var list<array{eh: ExcepcionHorario, oldEstado: ?string, newEstado: ?string}>
     * Excepciones cuyo `estado` ha cambiado, con sus valores antes/después.
     */
    private array $pendingExcepcionUpdate = [];

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
            || $entity instanceof ExcepcionHorario
        ) {
            $this->pendingPersist[] = $entity;
        }
    }

    public function preUpdate(PreUpdateEventArgs $args): void
    {
        $entity = $args->getObject();
        if ($entity instanceof Calificacion) {
            // Solo notificar si la NOTA ha cambiado. Ediciones de feedbackProfesor
            // u otros campos no merecen una notificación al alumno (decisión §3
            // del doc — no spam por correcciones internas).
            if ($args->hasChangedField('nota')) {
                $this->pendingCalUpdate[] = $entity;
            }
            return;
        }
        if ($entity instanceof ExcepcionHorario) {
            // Cambio de estado dispara notificaciones según destino. Capturamos
            // old/new para poder detectar transiciones concretas (PENDIENTE→APROBADA,
            // APROBADA→CANCELADA con revertida=true, etc.) en postFlush.
            if ($args->hasChangedField('estado')) {
                $oldRaw = $args->getOldValue('estado');
                $newRaw = $args->getNewValue('estado');
                $this->pendingExcepcionUpdate[] = [
                    'eh' => $entity,
                    'oldEstado' => $oldRaw instanceof EstadoExcepcion ? $oldRaw->value : (is_string($oldRaw) ? $oldRaw : null),
                    'newEstado' => $newRaw instanceof EstadoExcepcion ? $newRaw->value : (is_string($newRaw) ? $newRaw : null),
                ];
            }
        }
    }

    public function postFlush(PostFlushEventArgs $args): void
    {
        if ($this->processing) {
            return;
        }
        if ($this->pendingPersist === [] && $this->pendingCalUpdate === [] && $this->pendingExcepcionUpdate === []) {
            return;
        }
        $this->processing = true;

        try {
            $persistBatch = $this->pendingPersist;
            $updateBatch = $this->pendingCalUpdate;
            $excepcionUpdateBatch = $this->pendingExcepcionUpdate;
            $this->pendingPersist = [];
            $this->pendingCalUpdate = [];
            $this->pendingExcepcionUpdate = [];

            foreach ($persistBatch as $entity) {
                if ($entity instanceof Calificacion) {
                    $this->dispatcher->notifyCalificacionPublicada($entity);
                } elseif ($entity instanceof Tarea) {
                    $this->dispatcher->notifyTareaNueva($entity);
                } elseif ($entity instanceof Comunicado) {
                    $this->dispatcher->notifyComunicadoNuevo($entity);
                } elseif ($entity instanceof Entrega) {
                    $this->dispatcher->notifyEntregaRecibida($entity);
                } elseif ($entity instanceof ExcepcionHorario) {
                    $this->dispatchExcepcionPersist($entity);
                }
            }

            foreach ($updateBatch as $cal) {
                $this->dispatcher->notifyCalificacionActualizada($cal);
            }

            foreach ($excepcionUpdateBatch as $row) {
                $this->dispatchExcepcionUpdate($row['eh'], $row['oldEstado'], $row['newEstado']);
            }

            // Flush final para escribir las Notificaciones persistidas por
            // el dispatcher. Esto dispara otro postFlush que no hace nada
            // (cola vacía + processing=true).
            $args->getObjectManager()->flush();
        } finally {
            $this->processing = false;
        }
    }

    /**
     * Notificaciones al crearse una excepción nueva. Profe puro la crea
     * PENDIENTE → admin del centro recibe aviso. Admin la crea APROBADA
     * directa → solicitante (él mismo, no se notifica) + override + alumnos.
     */
    private function dispatchExcepcionPersist(ExcepcionHorario $eh): void
    {
        $estado = $eh->getEstado();
        if ($estado === EstadoExcepcion::PENDIENTE_APROBACION) {
            $this->dispatcher->notifyExcepcionPendiente($eh);
            // Topic 1 (2026-05-07): el destinatario semántico (profeOverride
            // o imparticionEfectiva.profesor) recibe aviso para poder
            // aceptar implícitamente o rechazar desde su /horarios.
            $this->dispatcher->notifyIncidenciaPropuesta($eh);
            return;
        }
        if ($estado === EstadoExcepcion::APROBADA) {
            // Admin atajo (creó aprobada directa). El solicitante = aprobador
            // habitualmente (no auto-notificar) — `notifyExcepcionResuelta` lo
            // crea igual y deja el frontend decidir si lo agrupa. Por
            // simplicidad y consistencia: lo emitimos.
            $this->dispatcher->notifyExcepcionResuelta($eh, true);
            $this->dispatcher->notifySustitucionAsignada($eh);
            $this->dispatcher->notifyAlumnosCambioClase($eh);
        }
    }

    /**
     * Notificaciones al cambiar de estado una excepción existente.
     */
    private function dispatchExcepcionUpdate(ExcepcionHorario $eh, ?string $oldEstado, ?string $newEstado): void
    {
        if ($newEstado === EstadoExcepcion::APROBADA->value) {
            $this->dispatcher->notifyExcepcionResuelta($eh, true);
            $this->dispatcher->notifySustitucionAsignada($eh);
            $this->dispatcher->notifyAlumnosCambioClase($eh);
            return;
        }
        if ($newEstado === EstadoExcepcion::RECHAZADA->value) {
            $this->dispatcher->notifyExcepcionResuelta($eh, false);
            return;
        }
        // Reversión APROBADA → CANCELADA: avisar a alumnos de que la clase
        // vuelve al horario base. notifyAlumnosCambioClase con motivo de
        // reversión sería ideal; por ahora reusamos el dispatcher con tipo
        // según el original (los alumnos saben que algo cambió, pueden
        // volver a consultar).
        if ($oldEstado === EstadoExcepcion::APROBADA->value && $newEstado === EstadoExcepcion::CANCELADA->value) {
            // No hay tipo dedicado para "reversión"; se podría añadir más
            // tarde. Por ahora notificamos al solicitante de la cancelación
            // y a los alumnos como "trasladada" para que recarguen.
            $this->dispatcher->notifyExcepcionResuelta($eh, false);
            $this->dispatcher->notifyAlumnosCambioClase($eh);
        }
    }
}
