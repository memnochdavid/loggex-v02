<?php

namespace App\Catalogo\Ccaa;

use App\Catalogo\Ccaa\Dto\ItinerarioOverrideDto;
use App\Catalogo\Ccaa\Dto\MateriaOverrideDto;
use App\Entity\Ccaa;

/**
 * Contrato que abstrae la fuente de overrides de currículo por CCAA.
 *
 * Implementaciones esperadas:
 *   - `BojaAndHardcodedProvider` — datos del Decreto 156/2022 + órdenes
 *     vigentes verificados a mano. MVP de Fase 3.
 *   - `BojaAndScraperProvider` — parser real del BOJA. Objetivo final
 *     (Fase 3 B en `docs/hoja-de-ruta-curriculum-ccaa.md`).
 *   - Equivalentes para DOGC, BOCM, DOGV... cuando se aborden.
 *
 * El comando `app:catalogo:ccaa:seed`, el `CcaaResolverService` y la UI
 * consumen este interface — son agnósticos a la fuente concreta.
 */
interface CcaaCurriculumProviderInterface
{
    /**
     * Identificador estable del provider (lo que se persiste como trazabilidad
     * en futuros campos de fuente). Ejemplos: "boja_and_hardcoded",
     * "boja_and_scraper", "dogc_ct_hardcoded".
     */
    public function source(): string;

    /**
     * CCAA cubierta por este provider. Un provider cubre una sola CCAA.
     */
    public function ccaa(): Ccaa;

    /**
     * @return iterable<MateriaOverrideDto>
     */
    public function fetchOverrides(): iterable;

    /**
     * @return iterable<ItinerarioOverrideDto>
     */
    public function fetchItinerarioOverrides(): iterable;
}
