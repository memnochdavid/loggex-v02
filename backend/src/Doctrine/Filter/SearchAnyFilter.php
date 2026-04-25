<?php

namespace App\Doctrine\Filter;

use ApiPlatform\Doctrine\Orm\Filter\FilterInterface;
use ApiPlatform\Doctrine\Orm\Util\QueryNameGeneratorInterface;
use ApiPlatform\Metadata\Operation;
use Doctrine\ORM\QueryBuilder;

/**
 * Filtro de búsqueda OR sobre múltiples campos con un único parámetro `?q=`.
 *
 * Reutilizable en cualquier entidad. Se declara con los campos a buscar:
 *
 *   #[ApiFilter(SearchAnyFilter::class, properties: ['nombre', 'apellidos', 'email'])]
 *
 * y luego en cliente:
 *
 *   GET /api/users?q=ivan
 *
 * que se traduce a SQL en:
 *
 *   WHERE (LOWER(u.nombre) LIKE '%ivan%' OR LOWER(u.apellidos) LIKE '%ivan%' OR LOWER(u.email) LIKE '%ivan%')
 *
 * Pensado para alimentar el componente <AsyncSearchSelect> del frontend en
 * los selects de los modales CRUD.
 */
final class SearchAnyFilter implements FilterInterface
{
    public const QUERY_PARAMETER = 'q';

    public function __construct(
        private readonly array $properties = []
    ) {
    }

    public function apply(
        QueryBuilder $queryBuilder,
        QueryNameGeneratorInterface $queryNameGenerator,
        string $resourceClass,
        ?Operation $operation = null,
        array $context = []
    ): void {
        $value = $context['filters'][self::QUERY_PARAMETER] ?? null;

        if (!is_string($value) || trim($value) === '' || empty($this->properties)) {
            return;
        }

        $rootAlias = $queryBuilder->getRootAliases()[0];
        $parameterName = $queryNameGenerator->generateParameterName('q');

        // Cache de joins ya añadidos en esta invocación, indexados por path-prefix
        // (p. ej. "profesor", "imparticion.modulo"), para reutilizar el mismo
        // alias entre propiedades distintas (`profesor.nombre`, `profesor.email`).
        $joinedAliases = [];

        $orParts = [];
        // API Platform normaliza `properties: ['nombre', 'apellidos']` (lista plana)
        // a `['nombre' => null, 'apellidos' => null]` (mapping propiedad=>strategy).
        // Soportamos ambos formatos: usamos la clave si es string, el valor si es int.
        foreach ($this->properties as $key => $val) {
            $rawField = (string) (is_int($key) ? $val : $key);

            // Saneamos cada segmento del path como identificador SQL.
            $segments = array_values(array_filter(
                array_map(
                    fn($s) => preg_replace('/[^a-zA-Z0-9_]/', '', $s),
                    explode('.', $rawField)
                ),
                fn($s) => $s !== ''
            ));

            if (empty($segments)) {
                continue;
            }

            // Caso simple: campo directo de la entidad raíz.
            if (count($segments) === 1) {
                $orParts[] = sprintf('LOWER(%s.%s) LIKE LOWER(:%s)', $rootAlias, $segments[0], $parameterName);
                continue;
            }

            // Caso con dots: JOIN implícito por cada nivel de relación, LIKE sobre la hoja.
            // P. ej. `profesor.nombre` → leftJoin profesor → LOWER(sa_profesor.nombre) LIKE :q.
            $currentAlias = $rootAlias;
            $leaf = array_pop($segments);
            $pathPrefix = '';
            foreach ($segments as $seg) {
                $pathPrefix .= ($pathPrefix === '' ? '' : '.') . $seg;
                if (!isset($joinedAliases[$pathPrefix])) {
                    // Prefijo `sa_` para reducir el riesgo de colisión con joins
                    // añadidos por otros filtros o por la propia metadata.
                    $joinAlias = 'sa_' . str_replace('.', '_', $pathPrefix);
                    $queryBuilder->leftJoin(sprintf('%s.%s', $currentAlias, $seg), $joinAlias);
                    $joinedAliases[$pathPrefix] = $joinAlias;
                }
                $currentAlias = $joinedAliases[$pathPrefix];
            }
            $orParts[] = sprintf('LOWER(%s.%s) LIKE LOWER(:%s)', $currentAlias, $leaf, $parameterName);
        }

        if (empty($orParts)) {
            return;
        }

        $queryBuilder
            ->andWhere('(' . implode(' OR ', $orParts) . ')')
            ->setParameter($parameterName, '%' . trim($value) . '%');
    }

    public function getDescription(string $resourceClass): array
    {
        return [
            self::QUERY_PARAMETER => [
                'property' => self::QUERY_PARAMETER,
                'type' => 'string',
                'required' => false,
                'description' => 'Búsqueda parcial (OR) sobre los campos: ' . implode(', ', $this->properties),
                'openapi' => [
                    'example' => 'ivan',
                ],
            ],
        ];
    }
}
