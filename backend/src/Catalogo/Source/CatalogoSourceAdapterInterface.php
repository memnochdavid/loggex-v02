<?php

namespace App\Catalogo\Source;

use App\Catalogo\Dto\CatalogoCentroDto;
use App\Catalogo\Dto\CatalogoItinerarioDto;

/**
 * Contrato común para cualquier adapter que ingesta datos del catálogo
 * desde una fuente oficial (TodoFP, BOE, BOJA, RUCT, API de la Junta…).
 *
 * Cada implementación devuelve los DTOs normalizados de su fuente. El
 * `CatalogoIngestService` se encarga de la persistencia idempotente.
 *
 * Los métodos `fetchItinerarios()` y `fetchCentros()` devuelven `iterable`
 * para que el adapter pueda hacer streaming (yield) en lugar de cargar
 * miles de registros en memoria.
 *
 * Una implementación puede dejar uno de los dos métodos vacío si su fuente
 * solo provee uno de los dos tipos (p. ej. TodoFP da itinerarios pero no
 * centros; la API andaluza da centros pero no itinerarios).
 */
interface CatalogoSourceAdapterInterface
{
    /**
     * Identificador estable de la fuente (lo que se persiste en
     * `fuente_ingesta`). Ejemplos: "todofp", "boja", "ruct", "junta_andalucia".
     */
    public function source(): string;

    /**
     * @return iterable<CatalogoItinerarioDto>
     */
    public function fetchItinerarios(): iterable;

    /**
     * @return iterable<CatalogoCentroDto>
     */
    public function fetchCentros(): iterable;
}
