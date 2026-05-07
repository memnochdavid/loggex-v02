<?php

namespace App\EventSubscriber;

use App\Entity\EstadoExcepcion;
use App\Entity\ExcepcionHorario;
use Doctrine\Bundle\DoctrineBundle\Attribute\AsDoctrineListener;
use Doctrine\ORM\Event\PreUpdateEventArgs;
use Doctrine\ORM\Events;

/**
 * Cascade del cambio de estado a la pareja de un INTERCAMBIO bilateral.
 *
 * Una excepción tipo `intercambio` viaja en pareja vía `intercambioPareja`
 * (self-FK bidireccional creada en `IntercambioController`). Las dos caras
 * representan UN solo acuerdo: A cubre la clase de B en fecha X, y B cubre
 * la de A en fecha Y. Tratarlas como independientes deja al sistema en
 * estados inconsistentes (admin aprueba A pero olvida B → solo se aplica
 * media permuta; admin revierte B y A queda colgada).
 *
 * **Regla**: cuando cambia `estado` en una cara, la otra cara recibe el
 * mismo cambio en el mismo flush. También se replican `aprobadaPor`,
 * `fechaResolucion` y `revertida` si proceden.
 *
 * **Anti-loop**: re-entrancy guard estático. La cascada actualiza B en el
 * mismo flush; cuando B se procese (preUpdate sobre B) el guard impide
 * volver a cascadear a A.
 *
 * **Compatibilidad con NotificationDispatchSubscriber**: éste reacciona a
 * preUpdate de cada cara independientemente. Tras la cascada, ambas caras
 * emiten sus notificaciones (al solicitante por cara, al sustituto, a los
 * alumnos del grupo correspondiente). Es el comportamiento deseado:
 * aprobar un intercambio dispara las notificaciones a las dos partes.
 *
 * Doc: docs/hoja-de-ruta-intercambio-imparticiones.md Fase E.2.
 */
#[AsDoctrineListener(event: Events::preUpdate)]
class IntercambioParejaCascadeSubscriber
{
    private bool $processing = false;

    public function preUpdate(PreUpdateEventArgs $args): void
    {
        if ($this->processing) {
            return;
        }
        $entity = $args->getObject();
        if (!$entity instanceof ExcepcionHorario) {
            return;
        }
        if (!$args->hasChangedField('estado')) {
            return;
        }
        $pareja = $entity->getIntercambioPareja();
        if ($pareja === null) {
            return;
        }

        $newEstadoRaw = $args->getNewValue('estado');
        $newEstado = $newEstadoRaw instanceof EstadoExcepcion
            ? $newEstadoRaw
            : (is_string($newEstadoRaw) ? EstadoExcepcion::from($newEstadoRaw) : null);
        if ($newEstado === null) {
            return;
        }
        if ($pareja->getEstado() === $newEstado) {
            return;  // ya está en el mismo estado — nada que cascadear.
        }

        $this->processing = true;
        try {
            $pareja->setEstado($newEstado);

            // Replicar metadatos de resolución si la cara A los lleva.
            if (in_array($newEstado, [
                EstadoExcepcion::APROBADA,
                EstadoExcepcion::RECHAZADA,
                EstadoExcepcion::CANCELADA,
            ], true)) {
                $aprobadorA = $entity->getAprobadaPor();
                if ($aprobadorA !== null && $pareja->getAprobadaPor() === null) {
                    $pareja->setAprobadaPor($aprobadorA);
                }
                $fechaResA = $entity->getFechaResolucion();
                if ($fechaResA !== null && $pareja->getFechaResolucion() === null) {
                    $pareja->setFechaResolucion($fechaResA);
                }
                $respuestaA = $entity->getRespuestaAdmin();
                if ($respuestaA !== null && $pareja->getRespuestaAdmin() === null) {
                    $pareja->setRespuestaAdmin($respuestaA);
                }
            }

            // Reversión APROBADA→CANCELADA: mantener el flag `revertida` en sincronía.
            if ($newEstado === EstadoExcepcion::CANCELADA && $entity->isRevertida()) {
                $pareja->setRevertida(true);
            }

            // Como modificamos `pareja` durante preUpdate de `entity`, su
            // change set ya estaba computado. Forzamos a Doctrine a
            // recalcularlo y schedule the update en el mismo flush.
            $em = $args->getObjectManager();
            $em->getUnitOfWork()->recomputeSingleEntityChangeSet(
                $em->getClassMetadata(ExcepcionHorario::class),
                $pareja
            );
        } finally {
            $this->processing = false;
        }
    }
}
