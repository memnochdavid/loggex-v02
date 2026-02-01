<?php

namespace App\Doctrine;

use ApiPlatform\Doctrine\Orm\Extension\QueryCollectionExtensionInterface;
use ApiPlatform\Doctrine\Orm\Extension\QueryItemExtensionInterface;
use ApiPlatform\Doctrine\Orm\Util\QueryNameGeneratorInterface;
use ApiPlatform\Metadata\Operation;
use App\Entity\User;
use Doctrine\ORM\QueryBuilder;
use Symfony\Bundle\SecurityBundle\Security;

final class CurrentUserExtension implements QueryCollectionExtensionInterface, QueryItemExtensionInterface
{
    public function __construct(private readonly Security $security)
    {
    }

    public function applyToCollection(QueryBuilder $queryBuilder, QueryNameGeneratorInterface $queryNameGenerator, string $resourceClass, Operation $operation = null, array $context = []): void
    {
        $this->addWhere($queryBuilder, $resourceClass);
    }

    public function applyToItem(QueryBuilder $queryBuilder, QueryNameGeneratorInterface $queryNameGenerator, string $resourceClass, array $identifiers, Operation $operation = null, array $context = []): void
    {
        $this->addWhere($queryBuilder, $resourceClass);
    }

    private function addWhere(QueryBuilder $queryBuilder, string $resourceClass): void
    {
        if (User::class !== $resourceClass) {
            return;
        }

        $user = $this->security->getUser();

        // Si no hay usuario o es SuperAdmin, no filtramos (ve todo)
        if (!$user instanceof User || in_array('ROLE_SUPERADMIN', $user->getRoles())) {
            return;
        }

        // Si es Admin de centro, filtrar por su centro
        if (in_array('ROLE_ADMIN', $user->getRoles()) && $user->getCentro()) {
            $rootAlias = $queryBuilder->getRootAliases()[0];
            $queryBuilder->andWhere(sprintf('%s.centro = :current_centro', $rootAlias));
            $queryBuilder->setParameter('current_centro', $user->getCentro());
        } else {
            // Si es otro rol (ej: profesor/alumno), quizás solo debería verse a sí mismo o nada
            // Por ahora, restringimos a su centro también
             if ($user->getCentro()) {
                $rootAlias = $queryBuilder->getRootAliases()[0];
                $queryBuilder->andWhere(sprintf('%s.centro = :current_centro', $rootAlias));
                $queryBuilder->setParameter('current_centro', $user->getCentro());
            } else {
                // Si no tiene centro y no es superadmin, no ve nada (o solo a sí mismo)
                $rootAlias = $queryBuilder->getRootAliases()[0];
                $queryBuilder->andWhere(sprintf('%s.id = :current_user', $rootAlias));
                $queryBuilder->setParameter('current_user', $user->getId());
            }
        }
    }
}
