<?php

namespace App\State;

use ApiPlatform\Metadata\DeleteOperationInterface;
use ApiPlatform\Metadata\Operation;
use ApiPlatform\State\ProcessorInterface;
use App\Entity\Horario;
use App\Entity\PeriodoLectivo;
use App\Entity\PeriodoLectivoImparticion;
use Doctrine\ORM\EntityManagerInterface;

/**
 * Soft-delete del PeriodoLectivo + CASCADE a sus Horarios y PLIs.
 *
 * Sin esto, al borrar un PL quedaban Horarios live (deleted=0) apuntando a
 * un PL soft-deleted (deleted=1). El controlador `GetMyScheduleController`
 * cargaba esos Horarios y al acceder a `getPeriodoLectivo()->getEffective…`
 * Doctrine lanzaba `EntityNotFoundException` (el filtro Doctrine SQL del
 * soft-delete excluye el PL al rehidratar el proxy lazy).
 *
 * Esto pasaba especialmente con "Configurar curso óptimo" que borra todos
 * los PLs viejos del grupo y crea unos nuevos — los Horarios viejos (que
 * pertenecían a los PLs viejos) quedaban huérfanos lógicamente.
 */
class PeriodoLectivoSoftDeleteProcessor implements ProcessorInterface
{
    public function __construct(
        private EntityManagerInterface $em,
    ) {
    }

    public function process(mixed $data, Operation $operation, array $uriVariables = [], array $context = []): mixed
    {
        if (!($operation instanceof DeleteOperationInterface)) {
            return $data;
        }
        if (!($data instanceof PeriodoLectivo)) {
            return $data;
        }

        // Cascade soft-delete a Horarios del PL.
        $this->em->getRepository(Horario::class)->createQueryBuilder('h')
            ->update()
            ->set('h.deleted', ':del')
            ->where('h.periodoLectivo = :pl')
            ->andWhere('h.deleted = false')
            ->setParameter('del', true)
            ->setParameter('pl', $data)
            ->getQuery()
            ->execute();

        // Cascade soft-delete a PeriodoLectivoImparticion del PL.
        $this->em->getRepository(PeriodoLectivoImparticion::class)->createQueryBuilder('pli')
            ->update()
            ->set('pli.deleted', ':del')
            ->where('pli.periodoLectivo = :pl')
            ->andWhere('pli.deleted = false')
            ->setParameter('del', true)
            ->setParameter('pl', $data)
            ->getQuery()
            ->execute();

        // Por último, soft-delete del PL en sí.
        $data->setDeleted(true);
        $this->em->persist($data);
        $this->em->flush();

        return $data;
    }
}
