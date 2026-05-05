<?php

namespace App\Repository;

use App\Entity\Notificacion;
use App\Entity\User;
use Doctrine\Bundle\DoctrineBundle\Repository\ServiceEntityRepository;
use Doctrine\Persistence\ManagerRegistry;

/**
 * @extends ServiceEntityRepository<Notificacion>
 */
class NotificacionRepository extends ServiceEntityRepository
{
    public function __construct(ManagerRegistry $registry)
    {
        parent::__construct($registry, Notificacion::class);
    }

    /**
     * Marca todas las notificaciones no leídas de un usuario como leídas.
     * Devuelve el número de filas afectadas. Operación idempotente: llamarla
     * dos veces seguidas afecta a 0 la segunda vez.
     */
    public function markAllReadFor(User $user): int
    {
        return $this->createQueryBuilder('n')
            ->update()
            ->set('n.leida', ':true')
            ->set('n.leidaAt', ':now')
            ->where('n.usuario = :user')
            ->andWhere('n.leida = :false')
            ->setParameter('true', true)
            ->setParameter('false', false)
            ->setParameter('now', new \DateTime())
            ->setParameter('user', $user)
            ->getQuery()
            ->execute();
    }

    /**
     * Conteo de no-leídas para un usuario. El frontend lo usa para el badge
     * del header sin tener que pedir la lista entera.
     */
    public function countUnreadFor(User $user): int
    {
        return (int) $this->createQueryBuilder('n')
            ->select('COUNT(n.id)')
            ->where('n.usuario = :user')
            ->andWhere('n.leida = :false')
            ->setParameter('user', $user)
            ->setParameter('false', false)
            ->getQuery()
            ->getSingleScalarResult();
    }
}
