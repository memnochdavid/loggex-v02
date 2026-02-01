<?php

namespace App\Doctrine;

use ApiPlatform\Doctrine\Orm\Extension\QueryCollectionExtensionInterface;
use ApiPlatform\Doctrine\Orm\Extension\QueryItemExtensionInterface;
use ApiPlatform\Doctrine\Orm\Util\QueryNameGeneratorInterface;
use ApiPlatform\Metadata\Operation;
use App\Entity\CicloFormativo;
use App\Entity\Festivo;
use App\Entity\Modulo;
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
        // Entidades que se filtran por centro
        $supportedClasses = [User::class, CicloFormativo::class, Modulo::class, Festivo::class];

        if (!in_array($resourceClass, $supportedClasses)) {
            return;
        }

        $user = $this->security->getUser();

        // Si no hay usuario o es SuperAdmin, no filtramos (ve todo)
        if (!$user instanceof User || in_array('ROLE_SUPERADMIN', $user->getRoles())) {
            return;
        }

        $rootAlias = $queryBuilder->getRootAliases()[0];

        // Si es Admin de centro (o cualquier usuario de centro), filtrar por su centro
        if ($user->getCentro()) {
            if ($resourceClass === Modulo::class) {
                // Modulo -> CicloFormativo -> Centro
                $queryBuilder->join(sprintf('%s.ciclo', $rootAlias), 'c')
                             ->andWhere('c.centro = :current_centro')
                             ->setParameter('current_centro', $user->getCentro());
            } else {
                // User, CicloFormativo y Festivo tienen relación directa con Centro
                // Nota: Festivo puede tener centro NULL (festivos nacionales globales?), pero asumimos por centro.
                // Si queremos permitir ver festivos globales (centro=null) + festivos del centro:
                if ($resourceClass === Festivo::class) {
                    $queryBuilder->andWhere(sprintf('%s.centro = :current_centro OR %s.centro IS NULL', $rootAlias, $rootAlias));
                    $queryBuilder->setParameter('current_centro', $user->getCentro());
                } else {
                    $queryBuilder->andWhere(sprintf('%s.centro = :current_centro', $rootAlias));
                    $queryBuilder->setParameter('current_centro', $user->getCentro());
                }
            }
        } else {
            // Si no tiene centro y no es superadmin, no ve nada (salvo a sí mismo si es User)
            if ($resourceClass === User::class) {
                $queryBuilder->andWhere(sprintf('%s.id = :current_user', $rootAlias));
                $queryBuilder->setParameter('current_user', $user->getId());
            } else {
                $queryBuilder->andWhere('1 = 0');
            }
        }
    }
}
