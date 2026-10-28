<?php

namespace App\EventSubscriber;

use App\Entity\ExcepcionHorario;
use App\Entity\Horario;
use Doctrine\Bundle\DoctrineBundle\Attribute\AsDoctrineListener;
use Doctrine\ORM\EntityManagerInterface;
use Doctrine\ORM\Event\OnFlushEventArgs;
use Doctrine\ORM\Event\PostFlushEventArgs;
use Doctrine\ORM\Event\PostPersistEventArgs;
use Doctrine\ORM\Events;

/**
 * Sincronización de mutaciones entre placements gemelos (Fase D).
 *
 * Por D-1 (cerrada 2026-05-08, ver `docs/hoja-de-ruta-clases-compartidas.md`):
 * los placements gemelos se tratan como el mismo grupo en todos los aspectos
 * operativos. Cualquier mutación de un Horario gemelo se aplica al conjunto
 * entero de hermandad automáticamente.
 *
 * **Modelo de hermandad**: cada `Horario.gemelo_id` apunta SIEMPRE al raíz
 * (canonicalizado por AdjuntarGrupoController). La query "todos los
 * hermanos de X" es plana: `WHERE id = root_id OR gemelo_id = root_id`.
 *
 * **Qué propaga este listener**:
 *
 *  1. `onFlush` (para Horario):
 *     - Itera `getScheduledEntityUpdates()` y, para cada Horario con
 *       cambios en `diaSemana`, `horaInicio`, `horaFin`, `aula` o el
 *       par soft-delete (`deleted: false → true`), carga los hermanos
 *       y aplica el mismo cambio. Llama `computeChangeSet` para que
 *       los UPDATEs de los hermanos se ejecuten en el mismo flush.
 *     - **Por qué onFlush y no preUpdate**: `preUpdate` se dispara
 *       después de la fase "computing change sets". Llamar
 *       `recomputeSingleEntityChangeSet` allí solo afecta a entidades
 *       que YA estaban scheduled — los hermanos cargados con un query
 *       nuevo no lo están y los cambios se ignorarían silenciosamente.
 *       `onFlush` es el evento canónico para cascade modifications:
 *       ahí `computeChangeSet` sí registra entidades nuevas en el UoW.
 *     - Lo que NO se propaga: `imparticion` y `periodoLectivo` — cada
 *       gemelo apunta a su propia imparticion del grupo correspondiente
 *       (mapeo establecido en AdjuntarGrupoController). Cambiar la
 *       imparticion de un placement es una operación que rompe
 *       efectivamente la hermandad y debe hacerse manualmente por par.
 *
 *  2. `postPersist(ExcepcionHorario)` + `postFlush`:
 *     - Cuando se crea una excepción sobre un Horario con gemelos, se
 *       duplica para cada hermano. Tipo, fecha, motivo, observaciones,
 *       estado y solicitante se replican; la copia apunta a su Horario
 *       hermano correspondiente como `horarioBase`.
 *     - Para que aprobaciones / rechazos / reversiones se cascadeen
 *       atómicamente entre original y copias, todas comparten un
 *       `intercambioGrupoId` UUID. Si la original ya lo tenía (caso
 *       INTERCAMBIO), se reusa; si no (CANCELADO/SUSTITUCION/EVENTO_ESPECIAL),
 *       se genera uno nuevo y se asigna también a la original. Esto
 *       reusa `IntercambioGrupoCascadeSubscriber` sin modificarlo.
 *     - Idempotente: si ya existe una excepción con el mismo
 *       `(horarioBase, fechaConcreta, intercambioGrupoId)`, se omite
 *       (evita duplicar tras re-flushes o reentradas).
 *
 * **Anti-loop**: variable estática `$processing` siguiendo el patrón de
 * `IntercambioGrupoCascadeSubscriber` y `NotificationDispatchSubscriber`.
 * El flush interno de postFlush dispara más postPersist/postFlush, pero
 * el guard cierra la cascada.
 *
 * **Limitaciones conocidas (Fase D inicial)**:
 *  - DELETE de `ExcepcionHorario` no se cascadea a la copia gemela.
 *    En la práctica las excepciones se cancelan/rechazan, no se borran.
 *  - Reactivación (`deleted: true → false`) no se propaga; sólo el camino
 *    "soft-delete down". Caso edge poco frecuente.
 *  - POST de un Horario nuevo (placement nuevo en un grupo con hermano)
 *    NO se replica al hermano: no existe modelo de "grupos hermanos",
 *    sólo de "placements hermanos" (la relación es por Horario, no por
 *    Grupo). La replicación inicial la hace `AdjuntarGrupoController`.
 *
 * Doc: `docs/hoja-de-ruta-clases-compartidas.md` Fase D.
 */
#[AsDoctrineListener(event: Events::onFlush)]
#[AsDoctrineListener(event: Events::postPersist)]
#[AsDoctrineListener(event: Events::postFlush)]
class HorarioGemeloSyncSubscriber
{
    /** Campos físicos compartidos por todo el conjunto de hermandad. */
    private const SHARED_FIELDS = ['diaSemana', 'horaInicio', 'horaFin', 'aula'];

    /** @var list<ExcepcionHorario> Excepciones recién persistidas, procesadas en postFlush. */
    private array $pendingExcepciones = [];

    /** Re-entrancy guard común a onFlush(Horario) y postFlush(ExcepcionHorario). */
    private bool $processing = false;

    public function onFlush(OnFlushEventArgs $args): void
    {
        if ($this->processing) {
            return;
        }

        $em = $args->getObjectManager();
        $uow = $em->getUnitOfWork();
        $metadata = $em->getClassMetadata(Horario::class);

        // Recolectamos los Horarios scheduled para UPDATE con cambios
        // relevantes ANTES de mutar nada — modificar el UoW mientras
        // iteramos su lista de scheduled puede dar comportamiento raro.
        $changesByHorario = [];
        foreach ($uow->getScheduledEntityUpdates() as $entity) {
            if (!$entity instanceof Horario) {
                continue;
            }
            $changeSet = $uow->getEntityChangeSet($entity);
            $physical = [];
            foreach (self::SHARED_FIELDS as $field) {
                if (isset($changeSet[$field])) {
                    $physical[$field] = $changeSet[$field][1];
                }
            }
            $isSoftDelete = isset($changeSet['deleted'])
                && $changeSet['deleted'][0] === false
                && $changeSet['deleted'][1] === true;

            if ($physical === [] && !$isSoftDelete) {
                continue;
            }
            $changesByHorario[] = [
                'entity' => $entity,
                'physical' => $physical,
                'isSoftDelete' => $isSoftDelete,
            ];
        }

        if ($changesByHorario === []) {
            return;
        }

        $this->processing = true;
        try {
            foreach ($changesByHorario as $row) {
                /** @var Horario $h */
                $h = $row['entity'];
                $siblings = $this->loadSiblings($em, $h);
                if ($siblings === []) {
                    continue;
                }
                foreach ($siblings as $sib) {
                    // Saltar si el sibling ya está scheduled (caso "vaciar
                    // todo el conjunto a la vez": el batch borra A y luego B,
                    // cuando procesamos A propagaríamos a B; si B también
                    // viene en el batch su cambio ya está, no lo pisamos).
                    if ($uow->isScheduledForUpdate($sib) || $uow->isScheduledForDelete($sib)) {
                        continue;
                    }

                    if ($row['isSoftDelete'] && !$sib->isDeleted()) {
                        $sib->setDeleted(true);
                    }
                    foreach ($row['physical'] as $field => $value) {
                        $setter = 'set' . ucfirst($field);
                        $sib->$setter($value);
                    }
                    // computeChangeSet (no recompute): el sibling no estaba
                    // en el changeset de este flush; computeChangeSet lo
                    // añade y programa el UPDATE para esta misma transacción.
                    $uow->computeChangeSet($metadata, $sib);
                }
            }
        } finally {
            $this->processing = false;
        }
    }

    public function postPersist(PostPersistEventArgs $args): void
    {
        $entity = $args->getObject();
        if (!$entity instanceof ExcepcionHorario) {
            return;
        }
        // Encolar para procesar tras el flush actual; persistir copias
        // dentro de postPersist es válido pero requiere otro flush, y la
        // cola simplifica la deduplicación cuando hay varias caras del
        // mismo intercambio en el mismo batch.
        $this->pendingExcepciones[] = $entity;
    }

    public function postFlush(PostFlushEventArgs $args): void
    {
        if ($this->processing) {
            return;
        }
        if ($this->pendingExcepciones === []) {
            return;
        }

        $batch = $this->pendingExcepciones;
        $this->pendingExcepciones = [];

        /** @var EntityManagerInterface $em */
        $em = $args->getObjectManager();
        $repo = $em->getRepository(ExcepcionHorario::class);

        $this->processing = true;
        $needsFlush = false;
        try {
            foreach ($batch as $eh) {
                if ($eh->isDeleted()) {
                    continue;
                }
                $base = $eh->getHorarioBase();
                if ($base === null) {
                    continue;
                }
                $siblings = $this->loadSiblings($em, $base);
                if ($siblings === []) {
                    continue;
                }

                // UUID compartido. Si la original es INTERCAMBIO, ya tiene
                // grupoId asignado por IntercambioController; si no
                // (CANCELADO/SUSTITUCION/EVENTO_ESPECIAL), lo generamos para
                // que IntercambioGrupoCascadeSubscriber pueda cascadear el
                // estado entre original y copias.
                $grupoId = $eh->getIntercambioGrupoId();
                if ($grupoId === null || $grupoId === '') {
                    $grupoId = $this->generateUuidV4();
                    $eh->setIntercambioGrupoId($grupoId);
                    $em->getUnitOfWork()->recomputeSingleEntityChangeSet(
                        $em->getClassMetadata(ExcepcionHorario::class),
                        $eh
                    );
                    $needsFlush = true;
                }

                foreach ($siblings as $sib) {
                    // Idempotencia: si ya existe una excepción con misma
                    // base + fecha + grupoId, no duplicar (evita carreras
                    // con re-flushes en cascada).
                    $existing = $repo->findOneBy([
                        'horarioBase' => $sib,
                        'fechaConcreta' => $eh->getFechaConcreta(),
                        'intercambioGrupoId' => $grupoId,
                        'deleted' => false,
                    ]);
                    if ($existing !== null) {
                        continue;
                    }

                    $copy = (new ExcepcionHorario())
                        ->setHorarioBase($sib)
                        ->setFechaConcreta($eh->getFechaConcreta())
                        ->setTipo($eh->getTipo())
                        ->setImparticionEfectiva($eh->getImparticionEfectiva())
                        ->setProfeOverride($eh->getProfeOverride())
                        ->setMotivo($eh->getMotivo())
                        ->setObservaciones($eh->getObservaciones())
                        ->setEstado($eh->getEstado())
                        ->setSolicitadaPor($eh->getSolicitadaPor())
                        ->setFechaSolicitud($eh->getFechaSolicitud() ?? new \DateTimeImmutable())
                        ->setAprobadaPor($eh->getAprobadaPor())
                        ->setFechaResolucion($eh->getFechaResolucion())
                        ->setRespuestaAdmin($eh->getRespuestaAdmin())
                        ->setIntercambioGrupoId($grupoId);
                    $em->persist($copy);
                    $needsFlush = true;
                }
            }

            if ($needsFlush) {
                // Dispara otro postFlush, pero $processing=true cierra la
                // cascada. Las copias persistidas también encolarán via
                // postPersist y serán procesadas en el siguiente request
                // o ignoradas por idempotencia si el flujo termina aquí.
                $em->flush();
            }
        } finally {
            $this->processing = false;
        }
    }

    /**
     * Devuelve los hermanos vivos del placement (excluyendo a $self).
     * El conjunto es plano: raíz + N copias. La query usa `id = root OR
     * gemelo = root`, así que incluye tanto al raíz como a las hojas.
     *
     * @return list<Horario>
     */
    private function loadSiblings(EntityManagerInterface $em, Horario $self): array
    {
        $rootId = $self->getGemelo()?->getId() ?? $self->getId();
        if ($rootId === null) {
            return [];
        }
        $repo = $em->getRepository(Horario::class);
        return $repo->createQueryBuilder('h')
            ->where('h.id = :rootId OR h.gemelo = :rootId')
            ->andWhere('h.id != :selfId')
            ->andWhere('h.deleted = false')
            ->setParameter('rootId', $rootId)
            ->setParameter('selfId', $self->getId())
            ->getQuery()
            ->getResult();
    }

    /**
     * UUID v4 RFC 4122. Mismo helper que IntercambioController, copiado
     * para evitar dependencia inversa entre subscriber y controller.
     */
    private function generateUuidV4(): string
    {
        $data = random_bytes(16);
        $data[6] = chr((ord($data[6]) & 0x0f) | 0x40);
        $data[8] = chr((ord($data[8]) & 0x3f) | 0x80);
        return vsprintf('%s%s-%s-%s-%s-%s%s%s', str_split(bin2hex($data), 4));
    }
}
