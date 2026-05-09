<?php

namespace App\Doctrine;

use ApiPlatform\Doctrine\Orm\Extension\QueryCollectionExtensionInterface;
use ApiPlatform\Doctrine\Orm\Util\QueryNameGeneratorInterface;
use ApiPlatform\Metadata\Operation;
use App\Entity\User;
use Doctrine\ORM\QueryBuilder;
use Symfony\Component\HttpFoundation\RequestStack;

/**
 * Filtro: alumnos sin matrícula activa en ningún grupo del centro X.
 *
 *   GET /api/users?rol_app=alumno&sinMatriculaEnCentro=42
 *
 * Útil para el modal "Nueva matrícula": acota el selector de alumnos a los
 * que aún no tienen ningún grupo asignado en el centro, evitando confusión
 * (alumnos ya matriculados aparecerían como duplicados al añadirles una
 * segunda matrícula, salvo en el caso edge de doble grupo).
 *
 * Implementación: subquery `NOT EXISTS` sobre Matricula filtrando por
 * `grupo.centro = :centroId` y respetando soft-delete de Matricula.
 *
 * Si el `centroId` no existe en BD el filtro no actúa (se devolverían todos).
 * El frontend solo activa el param cuando el usuario marca el checkbox y hay
 * un centro contextual; cualquier ID inválido sería ya un bug del cliente.
 */
final class UserSinMatriculaEnCentroExtension implements QueryCollectionExtensionInterface
{
    public function __construct(
        private readonly RequestStack $requestStack,
    ) {
    }

    public function applyToCollection(
        QueryBuilder $queryBuilder,
        QueryNameGeneratorInterface $queryNameGenerator,
        string $resourceClass,
        ?Operation $operation = null,
        array $context = []
    ): void {
        if ($resourceClass !== User::class) {
            return;
        }

        $request = $this->requestStack->getCurrentRequest();
        if (!$request) {
            return;
        }

        $centroId = $request->query->get('sinMatriculaEnCentro');
        if (!$centroId || !ctype_digit((string) $centroId)) {
            return;
        }

        $rootAlias = $queryBuilder->getRootAliases()[0];
        $paramName = $queryNameGenerator->generateParameterName('sinMatriculaCentro');

        // NOT EXISTS subquery: no debe haber ninguna Matricula viva del
        // alumno en un grupo de este centro.
        $queryBuilder->andWhere(
            sprintf(
                'NOT EXISTS (SELECT 1 FROM %s m JOIN m.grupo g WHERE m.alumno = %s AND m.deleted = false AND g.centro = :%s)',
                \App\Entity\Matricula::class,
                $rootAlias,
                $paramName
            )
        );
        $queryBuilder->setParameter($paramName, (int) $centroId);
    }
}
