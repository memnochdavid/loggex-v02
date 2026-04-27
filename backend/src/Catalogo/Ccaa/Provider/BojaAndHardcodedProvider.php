<?php

namespace App\Catalogo\Ccaa\Provider;

use App\Catalogo\Ccaa\CcaaCurriculumProviderInterface;
use App\Catalogo\Ccaa\Dto\ItinerarioOverrideDto;
use App\Catalogo\Ccaa\Dto\MateriaOverrideDto;
use App\Entity\Ccaa;
use App\Entity\Catalogo\TipoMateria;

/**
 * Provider hard-coded del currículo de FP en Andalucía (BOJA).
 *
 * MVP de la Fase 3 CCAA. Datos verificados manualmente contra:
 *   - Decreto 156/2022, de 9 de agosto (LOMLOE Andalucía).
 *   - Órdenes específicas por ciclo formativo (DAW: §5.2 del doc CCAA).
 *
 * Será sustituido por `BojaAndScraperProvider` cuando se aborde la opción B
 * del usuario (parser PDF real). El interface garantiza que el reemplazo no
 * tocará el comando seed, el resolver ni la UI.
 *
 * Cobertura actual:
 *   ✅ DAW 2º — datos completos (caso EAG validado).
 *   ⏳ DAW 1º — pendiente verificación BOJA (placeholders comentados).
 *   ⏳ DAM 1º + 2º — pendiente verificación BOJA.
 *
 * Para añadir nuevos itinerarios: completar `MATERIA_OVERRIDES` con los
 * datos verificados contra el BOJA. NO inventar valores: si no hay fuente,
 * dejar el itinerario fuera (queda en BOE puro).
 */
final class BojaAndHardcodedProvider implements CcaaCurriculumProviderInterface
{
    private const BOJA_DECRETO_156_2022 = 'BOJA Decreto 156/2022 de 9 de agosto';
    private const VIGENTE_DESDE = '2022-08-09';

    /**
     * Datos hard-coded de overrides + autonómicas por itinerario.
     *
     * Estructura:
     *   itinerarioCodigoOficial => [
     *     'overrides' => [ {materiaCodigoOficial, curso, minutos, [nombre]}, ... ],
     *     'autonomicas' => [ {curso, minutos, nombre, codigo, tipo}, ... ],
     *   ]
     */
    private const MATERIA_OVERRIDES = [
        // DAW — Técnico Superior en Desarrollo de Aplicaciones Web
        'des-aplicaciones-web' => [
            // 2º curso AN: caso EAG validado, fuente §5.2 doc CCAA.
            // Σ = 6 + 7.5 + 3.5 + 5 + 2 + 3.5 = 27.5h exactos.
            'overrides' => [
                // 0612 Web cliente: 6h (igual a BOE, no override estricto pero documentado)
                ['codigo' => '0613', 'curso' => 2, 'minutos' => 450],  // Web servidor 7.5h (BOE 8h)
                ['codigo' => '0614', 'curso' => 2, 'minutos' => 210],  // Despliegue 3.5h (BOE 5h)
                ['codigo' => '0615', 'curso' => 2, 'minutos' => 300],  // Diseño interfaces 5h (BOE 6h)
                // 0618 Empresa: SUSTITUIDA en LOMLOE por IPE II (autonómica abajo).
                // Marcamos minutos=0 para "desactivarla" del overlay vía override
                // explícito. El resolver tratará minutos=0 como "no impartida".
                ['codigo' => '0618', 'curso' => 2, 'minutos' => 0],
            ],
            'autonomicas' => [
                [
                    'curso' => 2,
                    'minutos' => 120,  // 2h
                    'nombre' => 'Inglés profesional para Grado Superior',
                    'codigo' => 'AN-IP-GS',
                    'tipo' => TipoMateria::MODULO,
                ],
                [
                    'curso' => 2,
                    'minutos' => 210,  // 3.5h
                    'nombre' => 'Itinerario Personal para la Empleabilidad II',
                    'codigo' => 'AN-IPE-II',
                    'tipo' => TipoMateria::MODULO,
                ],
            ],
        ],
        // TODO DAM — pendiente verificación contra BOJA + Orden DAM Andalucía.
        // 'des-aplicaciones-multiplataforma' => [...]
    ];

    /**
     * Overrides de nombre/código del itinerario por CCAA. En Andalucía los
     * nombres oficiales son los mismos que el BOE para DAW/DAM, así que esta
     * tabla queda vacía. Se rellena cuando el BOJA usa nombre alternativo.
     */
    private const ITINERARIO_OVERRIDES = [
        // Ej. 'des-aplicaciones-web' => ['nombre' => '...', 'codigo' => '...'],
    ];

    public function source(): string
    {
        return 'boja_and_hardcoded';
    }

    public function ccaa(): Ccaa
    {
        return Ccaa::AN;
    }

    public function fetchOverrides(): iterable
    {
        $vigenteDesde = new \DateTimeImmutable(self::VIGENTE_DESDE);
        foreach (self::MATERIA_OVERRIDES as $itinCodigo => $bloque) {
            foreach ($bloque['overrides'] ?? [] as $row) {
                yield new MateriaOverrideDto(
                    ccaa: Ccaa::AN,
                    itinerarioCodigoOficial: $itinCodigo,
                    materiaCodigoOficial: $row['codigo'],
                    curso: $row['curso'],
                    minutosSemanales: $row['minutos'],
                    nombre: $row['nombre'] ?? null,
                    codigo: null,
                    tipo: $row['tipo'] ?? null,
                    boletinOficialRef: self::BOJA_DECRETO_156_2022,
                    vigenteDesde: $vigenteDesde,
                );
            }
            foreach ($bloque['autonomicas'] ?? [] as $row) {
                yield new MateriaOverrideDto(
                    ccaa: Ccaa::AN,
                    itinerarioCodigoOficial: $itinCodigo,
                    materiaCodigoOficial: null,
                    curso: $row['curso'],
                    minutosSemanales: $row['minutos'],
                    nombre: $row['nombre'],
                    codigo: $row['codigo'],
                    tipo: $row['tipo'],
                    boletinOficialRef: self::BOJA_DECRETO_156_2022,
                    vigenteDesde: $vigenteDesde,
                );
            }
        }
    }

    public function fetchItinerarioOverrides(): iterable
    {
        $vigenteDesde = new \DateTimeImmutable(self::VIGENTE_DESDE);
        foreach (self::ITINERARIO_OVERRIDES as $itinCodigo => $row) {
            yield new ItinerarioOverrideDto(
                ccaa: Ccaa::AN,
                itinerarioCodigoOficial: $itinCodigo,
                nombre: $row['nombre'] ?? null,
                codigo: $row['codigo'] ?? null,
                boletinOficialRef: self::BOJA_DECRETO_156_2022,
                vigenteDesde: $vigenteDesde,
            );
        }
    }
}
