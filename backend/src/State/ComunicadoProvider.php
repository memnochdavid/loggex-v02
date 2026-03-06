<?php

namespace App\State;

use ApiPlatform\Metadata\Operation;
use ApiPlatform\State\ProviderInterface;
use App\Repository\ComunicadoRepository;

class ComunicadoProvider implements ProviderInterface
{
    public function __construct(private ComunicadoRepository $repository)
    {
    }

    public function provide(Operation $operation, array $uriVariables = [], array $context = []): object|array|null
    {
        if (isset($uriVariables['id'])) {
            return $this->repository->find($uriVariables['id']);
        }

        // No filtramos aquí, dejamos que CurrentUserExtension lo haga a nivel de QueryBuilder
        return $this->repository->findBy([], ['createdAt' => 'DESC']);
    }
}
