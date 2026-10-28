<?php

namespace App\EventSubscriber;

use App\Entity\Grupo;
use App\Entity\PeriodoLectivo;
use App\Entity\TipoPeriodoLectivo;
use Doctrine\Bundle\DoctrineBundle\Attribute\AsDoctrineListener;
use Doctrine\ORM\Event\PostPersistEventArgs;
use Doctrine\ORM\Events;

/**
 * Auto-crea la PLANTILLA del grupo en el `postPersist`.
 *
 * Cada grupo tiene exactamente una PLANTILLA viva (ver
 * `docs/hoja-de-ruta-modelo-semanal.md` §11). En lugar de obligar al
 * frontend a crearla explícitamente tras crear el grupo, este listener
 * la materializa automáticamente al persistir un Grupo nuevo.
 *
 * Sin Horarios ni PLIs: el `PeriodoLectivoCreateProcessor` se encarga de
 * los PLIs por defecto (1 por imparticion del grupo). Como las
 * imparticiones se crean DESPUÉS del grupo, los PLIs los creamos también
 * en este listener para que la PLANTILLA quede operativa de inmediato
 * (aunque inicialmente sin imparticiones — el admin las añade luego).
 */
#[AsDoctrineListener(event: Events::postPersist)]
class GrupoPlantillaSubscriber
{
    public function postPersist(PostPersistEventArgs $args): void
    {
        $entity = $args->getObject();
        if (!$entity instanceof Grupo) {
            return;
        }

        $em = $args->getObjectManager();

        // Idempotencia: si ya hay PLANTILLA viva (caso reactivar grupo
        // soft-deleted con su PLANTILLA aún viva), no crear otra.
        $existing = $em->getRepository(PeriodoLectivo::class)->createQueryBuilder('pl')
            ->andWhere('pl.grupo = :grupo')
            ->andWhere('pl.deleted = false')
            ->andWhere('pl.tipo = :tipoPlantilla')
            ->setParameter('grupo', $entity)
            ->setParameter('tipoPlantilla', TipoPeriodoLectivo::PLANTILLA->value)
            ->setMaxResults(1)
            ->getQuery()
            ->getOneOrNullResult();

        if ($existing !== null) {
            return;
        }

        $plantilla = new PeriodoLectivo();
        $plantilla->setGrupo($entity);
        $plantilla->setTipo(TipoPeriodoLectivo::PLANTILLA);
        $plantilla->setNombre('Plantilla del curso');

        $em->persist($plantilla);
        $em->flush();

        // PLIs para imparticiones del grupo, si ya las hay (caso atípico:
        // grupo creado tras un import que mete imparticiones en una sola
        // transacción). En el flujo normal el admin crea el grupo primero
        // y luego las imparticiones — los PLIs los creará el subscriber
        // de Imparticion en otra fase si se necesita, o el editor en Fase B.
    }
}
