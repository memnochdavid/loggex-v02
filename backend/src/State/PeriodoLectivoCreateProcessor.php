<?php

namespace App\State;

use ApiPlatform\Metadata\Operation;
use ApiPlatform\State\ProcessorInterface;
use App\Entity\Imparticion;
use App\Entity\PeriodoLectivo;
use App\Entity\PeriodoLectivoImparticion;
use Doctrine\ORM\EntityManagerInterface;

/**
 * Tras crear un `PeriodoLectivo` (POST), genera automáticamente un
 * `PeriodoLectivoImparticion` por cada `Imparticion` viva del grupo, con
 * `minutosSemanales = NULL` (= hereda `Materia.minutosSemanales`).
 *
 * Sin esto, un PL recién creado estaría vacío y el editor no tendría
 * imparticiones que mostrar. La Fase 3b añadirá UI para que el admin
 * desactive imparticiones por rango (caso típico: una materia anual no
 * activa en el rango FCT) o ajuste sus minutos.
 *
 * Doc: docs/hoja-de-ruta-periodos-lectivos.md (Fase 3a)
 */
class PeriodoLectivoCreateProcessor implements ProcessorInterface
{
    public function __construct(
        private ProcessorInterface $persistProcessor,
        private EntityManagerInterface $em,
    ) {
    }

    public function process(mixed $data, Operation $operation, array $uriVariables = [], array $context = []): mixed
    {
        $isNew = !($data instanceof PeriodoLectivo) || $data->getId() === null;

        // Persistir primero (decora el persistProcessor por defecto).
        $result = $this->persistProcessor->process($data, $operation, $uriVariables, $context);

        if ($isNew && $result instanceof PeriodoLectivo && $result->getGrupo() !== null) {
            $grupoId = $result->getGrupo()->getId();
            $imps = $this->em->getRepository(Imparticion::class)
                ->createQueryBuilder('i')
                ->andWhere('i.grupo = :g')
                ->andWhere('i.deleted = false')
                ->setParameter('g', $grupoId)
                ->getQuery()
                ->getResult();

            foreach ($imps as $imp) {
                $pli = new PeriodoLectivoImparticion();
                $pli->setPeriodoLectivo($result);
                $pli->setImparticion($imp);
                // minutosSemanales queda NULL → hereda Materia.minutosSemanales.
                $this->em->persist($pli);
            }
            $this->em->flush();
        }

        return $result;
    }
}
