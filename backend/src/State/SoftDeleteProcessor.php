<?php

namespace App\State;

use ApiPlatform\Metadata\DeleteOperationInterface;
use ApiPlatform\Metadata\Operation;
use ApiPlatform\State\ProcessorInterface;
use App\Entity\Traits\SoftDeletableTrait;
use Doctrine\ORM\EntityManagerInterface;

class SoftDeleteProcessor implements ProcessorInterface
{
    public function __construct(
        private ProcessorInterface $persistProcessor,
        private ProcessorInterface $removeProcessor,
        private EntityManagerInterface $entityManager
    ) {
    }

    public function process(mixed $data, Operation $operation, array $uriVariables = [], array $context = []): mixed
    {
        // Verificar si es una operación DELETE y si la entidad usa SoftDeletableTrait
        // Nota: Verificar traits en tiempo de ejecución es tricky, mejor verificar si tiene el método setDeleted
        if ($operation instanceof DeleteOperationInterface && method_exists($data, 'setDeleted')) {
            $data->setDeleted(true);
            $this->entityManager->persist($data);
            $this->entityManager->flush();
            return $data;
        }

        // Si no es soft delete, usar el procesador por defecto (borrado físico)
        return $this->removeProcessor->process($data, $operation, $uriVariables, $context);
    }
}
