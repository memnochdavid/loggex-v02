<?php

namespace App\Catalogo\Source;

/**
 * Registro de los adapters del catálogo disponibles. Inyectable como
 * iterator con todos los servicios tagueados `app.catalogo.source`.
 *
 * Permite localizar un adapter por su `source()` (clave) y listar todos.
 */
final class CatalogoSourceAdapterRegistry
{
    /** @var array<string, CatalogoSourceAdapterInterface> */
    private array $bySource;

    /**
     * @param iterable<CatalogoSourceAdapterInterface> $adapters
     */
    public function __construct(iterable $adapters)
    {
        $this->bySource = [];
        foreach ($adapters as $adapter) {
            $this->bySource[$adapter->source()] = $adapter;
        }
    }

    /**
     * @return list<string>
     */
    public function listSources(): array
    {
        return array_keys($this->bySource);
    }

    public function get(string $source): ?CatalogoSourceAdapterInterface
    {
        return $this->bySource[$source] ?? null;
    }

    /**
     * @return iterable<string, CatalogoSourceAdapterInterface>
     */
    public function all(): iterable
    {
        return $this->bySource;
    }
}
