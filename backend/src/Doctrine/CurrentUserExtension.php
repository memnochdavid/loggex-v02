<?php

namespace App\Doctrine;

use ApiPlatform\Doctrine\Orm\Extension\QueryCollectionExtensionInterface;
use ApiPlatform\Doctrine\Orm\Extension\QueryItemExtensionInterface;
use ApiPlatform\Doctrine\Orm\Util\QueryNameGeneratorInterface;
use ApiPlatform\Metadata\Operation;
use App\Entity\CicloFormativo;
use App\Entity\Comunicado;
use App\Entity\Festivo;
use App\Entity\Mensaje;
use App\Entity\Modulo;
use App\Entity\Tarea;
use App\Entity\User;
use Doctrine\ORM\QueryBuilder;
use Symfony\Bundle\SecurityBundle\Security;
use Symfony\Component\HttpFoundation\RequestStack;

final class CurrentUserExtension implements QueryCollectionExtensionInterface, QueryItemExtensionInterface
{
    public function __construct(
        private readonly Security $security,
        private readonly RequestStack $requestStack
    ) {
    }

    public function applyToCollection(QueryBuilder $queryBuilder, QueryNameGeneratorInterface $queryNameGenerator, string $resourceClass, Operation $operation = null, array $context = []): void
    {
        $this->addWhere($queryBuilder, $resourceClass, true);
    }

    public function applyToItem(QueryBuilder $queryBuilder, QueryNameGeneratorInterface $queryNameGenerator, string $resourceClass, array $identifiers, Operation $operation = null, array $context = []): void
    {
        $this->addWhere($queryBuilder, $resourceClass, false);
    }

    private function addWhere(QueryBuilder $queryBuilder, string $resourceClass, bool $isCollection): void
    {
        $supportedClasses = [
            User::class,
            CicloFormativo::class,
            Modulo::class,
            Festivo::class,
            Mensaje::class,
            Tarea::class,
            Comunicado::class
        ];

        if (!in_array($resourceClass, $supportedClasses)) {
            return;
        }

        $user = $this->security->getUser();

        if (!$user instanceof User || in_array('ROLE_SUPER_ADMIN', $user->getRoles()) || in_array('ROLE_SUPERADMIN', $user->getRoles())) {
            return;
        }

        $rootAlias = $queryBuilder->getRootAliases()[0];

        // Lógica específica para Mensajes
        if ($resourceClass === Mensaje::class) {
            $queryBuilder->andWhere(sprintf('%s.remitente = :current_user_id OR %s.destinatario = :current_user_id', $rootAlias, $rootAlias))
                ->setParameter('current_user_id', $user->getId());
            return;
        }

        // Lógica específica para Tareas
        if ($resourceClass === Tarea::class) {
            $this->addWhereTarea($queryBuilder, $user, $rootAlias);
            return;
        }

        // Lógica específica para Comunicados
        if ($resourceClass === Comunicado::class) {
            if ($user->getCentro()) {
                $queryBuilder->andWhere(sprintf('%s.global = :is_global OR %s.centro = :current_centro', $rootAlias, $rootAlias))
                    ->setParameter('current_centro', $user->getCentro())
                    ->setParameter('is_global', true);
            } else {
                $queryBuilder->andWhere(sprintf('%s.global = :is_global', $rootAlias))
                    ->setParameter('is_global', true);
            }
            return;
        }

        // Si es Admin de centro (o cualquier usuario de centro), filtrar por su centro
        if (method_exists($user, 'getCentro') && $user->getCentro()) {
            if ($resourceClass === Modulo::class) {
                $queryBuilder->join(sprintf('%s.ciclo', $rootAlias), 'c')
                             ->andWhere('c.centro = :current_centro')
                             ->setParameter('current_centro', $user->getCentro());
            } else {
                if ($resourceClass === Festivo::class) {
                    $queryBuilder->andWhere(sprintf('%s.centro = :current_centro OR %s.centro IS NULL', $rootAlias, $rootAlias));
                    $queryBuilder->setParameter('current_centro', $user->getCentro());
                } elseif ($resourceClass === User::class && in_array('ROLE_ADMIN', $user->getRoles())) {
                    // Admin de centro ve usuarios de su centro
                    $queryBuilder->andWhere(sprintf('%s.centro = :current_centro OR %s.centro IS NULL', $rootAlias, $rootAlias))
                                 ->setParameter('current_centro', $user->getCentro());

                    // EXCLUIR SuperAdmins SOLO si es una colección Y no se está buscando explícitamente por ese rol
                    if ($isCollection) {
                        $request = $this->requestStack->getCurrentRequest();
                        $rolesFilter = $request ? $request->query->get('roles') : null;

                        // Si no se está filtrando por rol SUPERADMIN, excluirlos
                        if (!$rolesFilter || !str_contains($rolesFilter, 'SUPERADMIN')) {
                            $queryBuilder->andWhere(sprintf('%s.roles NOT LIKE :superadmin_role', $rootAlias))
                                         ->setParameter('superadmin_role', '%ROLE_SUPERADMIN%');
                        }
                    }
                } else {
                    $queryBuilder->andWhere(sprintf('%s.centro = :current_centro', $rootAlias));
                    $queryBuilder->setParameter('current_centro', $user->getCentro());
                }
            }
        } else {
            if ($resourceClass === User::class) {
                $queryBuilder->andWhere(sprintf('%s.id = :current_user', $rootAlias));
                $queryBuilder->setParameter('current_user', $user->getId());
            } else {
                $queryBuilder->andWhere('1 = 0');
            }
        }
    }

    private function addWhereTarea(QueryBuilder $qb, User $user, string $rootAlias): void
    {
        if (in_array('ROLE_ADMIN', $user->getRoles())) {
            $qb->join(sprintf('%s.imparticion', $rootAlias), 'i')
               ->join('i.grupo', 'g')
               ->join('g.ciclo', 'c')
               ->andWhere('c.centro = :centro')
               ->setParameter('centro', $user->getCentro());
            return;
        }

        if (in_array('ROLE_PROFESOR', $user->getRoles())) {
            $qb->join(sprintf('%s.imparticion', $rootAlias), 'i')
               ->andWhere('i.profesor = :user')
               ->setParameter('user', $user);
            return;
        }

        if (in_array('ROLE_ALUMNO', $user->getRoles())) {
            $qb->join(sprintf('%s.imparticion', $rootAlias), 'i')
               ->join('i.grupo', 'g')
               ->join('g.matriculas', 'm')
               ->andWhere('m.alumno = :user')
               ->setParameter('user', $user)
               ->andWhere(sprintf('%s.visible = true', $rootAlias));
            return;
        }
    }
}
