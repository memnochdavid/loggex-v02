<?php

namespace App\Catalogo\Ccaa;

use App\Entity\Ccaa;

/**
 * Registro de providers CCAA disponibles. Se inyecta como iterator con todos
 * los servicios tagueados `app.catalogo.ccaa.provider`. Permite localizar el
 * provider por su CCAA o por su `source()` y listar todos.
 *
 * Si llegan múltiples providers para la misma CCAA (ej. hardcoded + scraper en
 * paralelo durante la migración a B), gana el último registrado. La selección
 * explícita por `source()` permite forzar uno concreto durante la transición.
 */
final class CcaaProviderRegistry
{
    /** @var array<string, CcaaCurriculumProviderInterface> indexado por Ccaa->value */
    private array $byCcaa = [];

    /** @var array<string, CcaaCurriculumProviderInterface> indexado por source() */
    private array $bySource = [];

    /**
     * @param iterable<CcaaCurriculumProviderInterface> $providers
     */
    public function __construct(iterable $providers)
    {
        foreach ($providers as $p) {
            $this->byCcaa[$p->ccaa()->value] = $p;
            $this->bySource[$p->source()] = $p;
        }
    }

    public function forCcaa(Ccaa $ccaa): ?CcaaCurriculumProviderInterface
    {
        return $this->byCcaa[$ccaa->value] ?? null;
    }

    public function bySource(string $source): ?CcaaCurriculumProviderInterface
    {
        return $this->bySource[$source] ?? null;
    }

    /**
     * @return list<string>
     */
    public function listSources(): array
    {
        return array_keys($this->bySource);
    }

    /**
     * @return iterable<string, CcaaCurriculumProviderInterface>
     */
    public function all(): iterable
    {
        return $this->bySource;
    }
}
