<?php

namespace App\Doctrine;

use ApiPlatform\Doctrine\Orm\Extension\QueryCollectionExtensionInterface;
use ApiPlatform\Doctrine\Orm\Util\QueryNameGeneratorInterface;
use ApiPlatform\Metadata\Operation;
use App\Entity\Centro;
use App\Entity\Festivo;
use Doctrine\ORM\EntityManagerInterface;
use Doctrine\ORM\QueryBuilder;
use Symfony\Component\HttpFoundation\RequestStack;

/**
 * Filtro de aplicabilidad de Festivo a un centro concreto.
 *
 *   GET /api/festivos?aplicaACentro=42
 *
 * Devuelve los festivos que aplican al centro 42 según la cascada:
 *
 *   NACIONAL                                   → siempre
 *   AUTONOMICO ccaa = centro.ccaa              → si la CCAA coincide
 *   PROVINCIAL provincia = centro.provincia    → si la provincia coincide
 *   LOCAL centro = centro_42                   → del propio centro
 *
 * Útil para vistas SuperAdmin que necesitan ver "los festivos como los ve
 * el centro X" sin estar logueado como admin de ese centro. Para usuarios
 * normales (admin de centro), `CurrentUserExtension` ya aplica la misma
 * cascada usando su `user.centro`, por lo que NO hace falta pasar el param
 * (y si se pasa, prevalece el último WHERE — que coincidirá si X = miCentro).
 */
final class FestivoAplicableExtension implements QueryCollectionExtensionInterface
{
    public function __construct(
        private readonly RequestStack $requestStack,
        private readonly EntityManagerInterface $em,
    ) {
    }

    public function applyToCollection(
        QueryBuilder $queryBuilder,
        QueryNameGeneratorInterface $queryNameGenerator,
        string $resourceClass,
        ?Operation $operation = null,
        array $context = []
    ): void {
        if ($resourceClass !== Festivo::class) {
            return;
        }

        $request = $this->requestStack->getCurrentRequest();
        if (!$request) {
            return;
        }

        $centroId = $request->query->get('aplicaACentro');
        if (!$centroId) {
            return;
        }

        $centro = $this->em->getRepository(Centro::class)->find($centroId);
        if (!$centro) {
            // Centro inexistente → no devolver nada (evitar leak de catálogo
            // completo si alguien pasa un ID inválido).
            $queryBuilder->andWhere('1 = 0');
            return;
        }

        $rootAlias = $queryBuilder->getRootAliases()[0];
        $queryBuilder->andWhere(
            sprintf(
                "(%s.ambito = 'nacional')"
                . " OR (%s.ambito = 'autonomico' AND %s.ccaa = :aplica_ccaa)"
                . " OR (%s.ambito = 'provincial' AND %s.provincia = :aplica_provincia)"
                . " OR (%s.ambito = 'local' AND %s.centro = :aplica_centro)",
                $rootAlias, $rootAlias, $rootAlias, $rootAlias, $rootAlias, $rootAlias, $rootAlias
            )
        );
        $queryBuilder->setParameter('aplica_centro', $centro);
        $queryBuilder->setParameter('aplica_ccaa', $centro->getCcaa()?->value);
        $queryBuilder->setParameter('aplica_provincia', $centro->getProvincia());
    }
}
