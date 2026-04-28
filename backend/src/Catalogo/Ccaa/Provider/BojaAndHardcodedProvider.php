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
 *   - **Orden de 16 de junio de 2011** (BOJA 149 para DAW, BOJA 142 para DAM):
 *     base curricular pre-LOMLOE — define horas semanales por módulo.
 *   - **Resolución de 26 de junio de 2024** DG FP Andalucía (instrucciones
 *     curso 2024/25): aplica RD 659/2023 mod. RD 658/2024 introduciendo los
 *     módulos transversales LOMLOE (IPE I/II, Inglés profesional GS,
 *     Sostenibilidad y Digitalización aplicada al sistema productivo) que
 *     SUSTITUYEN a FOL/EIE/Inglés-FCT antiguos.
 *
 * NOTA: la referencia "Decreto 156/2022 BOJA" usada en versiones previas era
 * incorrecta — ese decreto regula Bachillerato, no FP.
 *
 * Será sustituido por `BojaAndScraperProvider` cuando se aborde la opción B
 * del usuario (parser PDF real). El interface garantiza que el reemplazo no
 * tocará el comando seed, el resolver ni la UI.
 *
 * Cobertura actual (LOMLOE puro, suma > 27.5h en todos los cursos →
 * dispara banner rojo en jornadas de centros con menos horas, lo que es
 * feedback honesto: el centro debe ampliar jornada para cubrir el currículo):
 *
 *   DAW 1º + DAM 1º (idénticos): 29h totales (5+6+8+3+3 + IPE I 3 + Digit 1).
 *   DAW 2º: 29h (6 + 7.5 + 3.5 + 5 + IPE II 3 + Inglés 2 + Sostenib 2).
 *   DAM 2º: 34h aprox (parcial: 0486/0488/0489 sin verificar contra BOJA).
 *
 * Pendiente verificar contra PDF oficial BOJA:
 *   - DAW 2º: Web servidor 7.5h, Despliegue 3.5h, Diseño 5h (patrón observado
 *     en programaciones de centros andaluces; sin fuente normativa citable).
 *   - DAM 2º: 0486 (Acceso a datos), 0488 (Interfaces), 0489 (Multimedia y
 *     dispositivos móviles) — el agente de investigación no encontró las
 *     horas exactas. Quedan sin override → caen al valor BOE.
 */
final class BojaAndHardcodedProvider implements CcaaCurriculumProviderInterface
{
    private const FUENTE_BASE = 'BOJA Orden 16/06/2011 (149/DAW, 142/DAM)';
    private const FUENTE_LOMLOE = 'Resolución 26/06/2024 DG FP Andalucía';
    private const VIGENTE_DESDE = '2024-09-01';  // curso 2024/25, entrada en vigor LOMLOE FP

    /**
     * Datos hard-coded de overrides + autonómicas por itinerario.
     *
     * Estructura:
     *   itinerarioCodigoOficial => [
     *     'overrides' => [ {materiaCodigoOficial, curso, minutos, [nombre]}, ... ],
     *     'autonomicas' => [ {curso, minutos, nombre, codigo, tipo}, ... ],
     *   ]
     *
     * Convención `minutos = 0` ⇒ materia desactivada en LOMLOE (caso típico:
     * FOL → IPE I, Empresa → IPE II). El resolver omite la materia.
     */
    private const MATERIA_OVERRIDES = [
        // DAW — Técnico Superior en Desarrollo de Aplicaciones Web
        // 1º curso: 5+6+8+3+3 (BOE) + 0 (FOL desact) + 3 (IPE I) + 1 (Digit) = 29h
        // 2º curso: 6 + 7.5 + 3.5 + 5 + 0 (Empresa desact) + 3 (IPE II) + 2 (Inglés) + 2 (Sostenib) = 29h
        'des-aplicaciones-web' => [
            'overrides' => [
                // 1º curso — ajustes BOJA Orden 16/06/2011 (149/DAW) sobre BOE
                ['codigo' => '0483', 'curso' => 1, 'minutos' => 300],  // Sistemas informáticos 5h (BOE 6h, BOJA ajusta a 5h)
                ['codigo' => '0373', 'curso' => 1, 'minutos' => 180],  // Lenguajes de marcas 3h (BOE 4h, BOJA ajusta a 3h)
                ['codigo' => '0617', 'curso' => 1, 'minutos' => 0],    // FOL sustituida por IPE I (LOMLOE Res 26/06/2024)
                // 2º curso — ajustes BOJA + desactivación de Empresa
                ['codigo' => '0613', 'curso' => 2, 'minutos' => 450],  // Web servidor 7.5h (BOE 8h) — patrón observado, sin verificar PDF
                ['codigo' => '0614', 'curso' => 2, 'minutos' => 210],  // Despliegue 3.5h (BOE 5h) — patrón observado
                ['codigo' => '0615', 'curso' => 2, 'minutos' => 300],  // Diseño interfaces 5h (BOE 6h) — patrón observado
                ['codigo' => '0618', 'curso' => 2, 'minutos' => 0],    // Empresa → IPE II
            ],
            'autonomicas' => [
                // 1º curso (transversales LOMLOE Resolución 26/06/2024)
                ['curso' => 1, 'minutos' => 180, 'nombre' => 'Itinerario Personal para la Empleabilidad I', 'codigo' => 'AN-IPE-I', 'tipo' => TipoMateria::MODULO],
                ['curso' => 1, 'minutos' => 60,  'nombre' => 'Digitalización aplicada al sistema productivo', 'codigo' => 'AN-DIG', 'tipo' => TipoMateria::MODULO],
                // 2º curso
                ['curso' => 2, 'minutos' => 120, 'nombre' => 'Inglés profesional para Grado Superior', 'codigo' => 'AN-IP-GS', 'tipo' => TipoMateria::MODULO],
                ['curso' => 2, 'minutos' => 180, 'nombre' => 'Itinerario Personal para la Empleabilidad II', 'codigo' => 'AN-IPE-II', 'tipo' => TipoMateria::MODULO],
                ['curso' => 2, 'minutos' => 120, 'nombre' => 'Sostenibilidad aplicada al sistema productivo', 'codigo' => 'AN-SOS', 'tipo' => TipoMateria::MODULO],
            ],
        ],
        // DAM — Técnico Superior en Desarrollo de Aplicaciones Multiplataforma
        // 1º curso: idéntico a DAW 1º en Andalucía (mismos módulos transversales y troncales)
        // 2º curso: 0486/0488/0489 sin override (caen a BOE 6h c/u, pendiente verificar PDF BOJA)
        'des-aplicaciones-multiplataforma' => [
            'overrides' => [
                // 1º curso — ajustes BOJA Orden 16/06/2011 (142/DAM), idénticos a DAW 1º
                ['codigo' => '0483', 'curso' => 1, 'minutos' => 300],  // Sistemas informáticos 5h
                ['codigo' => '0373', 'curso' => 1, 'minutos' => 180],  // Lenguajes de marcas 3h
                ['codigo' => '0493', 'curso' => 1, 'minutos' => 0],    // FOL DAM sustituida por IPE I (LOMLOE)
                // 2º curso — datos confirmados de DAM 2º AN
                ['codigo' => '0490', 'curso' => 2, 'minutos' => 180],  // Programación de servicios y procesos 3h
                ['codigo' => '0491', 'curso' => 2, 'minutos' => 240],  // Sistemas de gestión empresarial 4h
                ['codigo' => '0492', 'curso' => 2, 'minutos' => 120],  // Proyecto DAM 2h carga lectiva
                ['codigo' => '0494', 'curso' => 2, 'minutos' => 0],    // Empresa → IPE II
                // 0486 Acceso a datos, 0488 Desarrollo de interfaces, 0489 Programación
                // multimedia y dispositivos móviles: SIN OVERRIDE — pendiente verificar
                // PDF BOJA 142/2011 anexo III. Caen a valor BOE (típicamente 6h c/u).
            ],
            'autonomicas' => [
                // 1º curso (idéntico a DAW 1º)
                ['curso' => 1, 'minutos' => 180, 'nombre' => 'Itinerario Personal para la Empleabilidad I', 'codigo' => 'AN-IPE-I', 'tipo' => TipoMateria::MODULO],
                ['curso' => 1, 'minutos' => 60,  'nombre' => 'Digitalización aplicada al sistema productivo', 'codigo' => 'AN-DIG', 'tipo' => TipoMateria::MODULO],
                // 2º curso
                ['curso' => 2, 'minutos' => 120, 'nombre' => 'Inglés profesional para Grado Superior', 'codigo' => 'AN-IP-GS', 'tipo' => TipoMateria::MODULO],
                ['curso' => 2, 'minutos' => 180, 'nombre' => 'Itinerario Personal para la Empleabilidad II', 'codigo' => 'AN-IPE-II', 'tipo' => TipoMateria::MODULO],
                ['curso' => 2, 'minutos' => 120, 'nombre' => 'Sostenibilidad aplicada al sistema productivo', 'codigo' => 'AN-SOS', 'tipo' => TipoMateria::MODULO],
            ],
        ],
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
        $fuenteOverrides = self::FUENTE_BASE;            // ajuste de horas troncales BOJA
        $fuenteAutonomicas = self::FUENTE_LOMLOE;        // transversales LOMLOE 2024
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
                    // Override con minutos=0 (FOL→IPE I, Empresa→IPE II) viene de
                    // LOMLOE; el resto son ajustes BOJA tradicionales.
                    boletinOficialRef: $row['minutos'] === 0 ? $fuenteAutonomicas : $fuenteOverrides,
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
                    boletinOficialRef: $fuenteAutonomicas,
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
                boletinOficialRef: self::FUENTE_BASE,
                vigenteDesde: $vigenteDesde,
            );
        }
    }
}
