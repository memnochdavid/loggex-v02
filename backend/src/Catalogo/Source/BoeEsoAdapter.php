<?php

namespace App\Catalogo\Source;

use App\Catalogo\BoeRd\BoeXmlFetcher;
use App\Catalogo\Dto\CatalogoItinerarioDto;
use App\Catalogo\Dto\CatalogoMateriaDto;
use App\Catalogo\Source\BoeEso\EsoCurriculumParser;
use App\Entity\Catalogo\EtapaEducativa;
use Psr\Log\LoggerInterface;

/**
 * Adapter para Educación Secundaria Obligatoria (LOMLOE).
 *
 * Fuente única: el RD 217/2022 de 29 de marzo (BOE-A-2022-4975), que
 * establece las enseñanzas mínimas nacionales de ESO. El adapter extrae:
 *   - Identificación del itinerario "Educación Secundaria Obligatoria".
 *   - 28 materias del Anexo IV, con horas mínimas y curso (1-3 vs 4).
 *
 * Limitaciones aceptadas en MVP-ESO:
 *   - No se ingesta variantes por CCAA (cada autonomía publica su decreto
 *     regional con la distribución horaria por curso). Lo del RD nacional
 *     son **horas mínimas totales por etapa** o por cuarto curso.
 *   - El reparto curso a curso (1 vs 2 vs 3) lo hace cada CCAA, no el RD.
 *     Para 1-3 dejamos `curso=null`, indicando que la materia se distribuye
 *     a lo largo de los tres cursos.
 *   - No hay códigos oficiales por asignatura como sí hay en FP. Sintetizamos:
 *     `ESO-LCL-13` (Lengua Castellana, cursos 1-3), `ESO-MAT-4` (Matemáticas
 *     en cuarto). Estable y único dentro del catálogo.
 *
 * El adapter es self-contained: una sola petición HTTP al BOE (con
 * throttle y normalización vía `BoeXmlFetcher` ya existente).
 */
final class BoeEsoAdapter implements CatalogoSourceAdapterInterface
{
    public const RD_217_2022_URL = 'https://www.boe.es/diario_boe/xml.php?id=BOE-A-2022-4975';
    public const ITINERARIO_NOMBRE = 'Educación Secundaria Obligatoria';
    public const ITINERARIO_CODIGO = 'ESO-LOMLOE-2022';

    public function __construct(
        private readonly BoeXmlFetcher $fetcher,
        private readonly EsoCurriculumParser $parser,
        private readonly LoggerInterface $logger,
    ) {}

    public function source(): string
    {
        return 'boe_eso';
    }

    public function fetchItinerarios(): iterable
    {
        $this->logger->info('[BoeEso] Fetching RD 217/2022');
        $xml = $this->fetcher->fetchXml(self::RD_217_2022_URL);

        $extracted = $this->parser->parse($xml);
        if (empty($extracted)) {
            throw new \RuntimeException('BoeEsoAdapter: el parser no extrajo materias del Anexo IV. ¿Cambio de HTML del BOE?');
        }

        $this->logger->info('[BoeEso] Materias extraídas', ['count' => count($extracted)]);

        $materiasDto = [];
        foreach ($extracted as $m) {
            $codigo = $this->buildCodigo($m['nombre'], $m['curso']);
            $materiasDto[] = new CatalogoMateriaDto(
                codigoOficial: $codigo,
                nombre: $m['nombre'],
                tipo: $m['tipo'],
                curso: $m['curso'],
                horasTotales: $m['horasTotales'],
                minutosSemanales: null,    // No expuesto en RD nacional; CCAA lo decide.
                ects: null,
                obligatoria: $m['obligatoria'],
                orden: $m['orden'],
            );
        }

        // Hash de los datos relevantes — para idempotencia
        $hashable = array_map(static fn(CatalogoMateriaDto $d) => [
            'codigo' => $d->codigoOficial,
            'nombre' => $d->nombre,
            'horas' => $d->horasTotales,
            'curso' => $d->curso,
            'tipo' => $d->tipo->value,
        ], $materiasDto);

        $hash = hash('sha256', json_encode([
            'materias' => $hashable,
            'fuenteVersion' => 'boe_eso_v1.0',
        ], JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES));

        yield new CatalogoItinerarioDto(
            codigoOficial: self::ITINERARIO_CODIGO,
            etapa: EtapaEducativa::ESO,
            nombre: self::ITINERARIO_NOMBRE,
            familia: null, // ESO no tiene familia profesional
            nivel: 'Educación Básica',
            duracionTotalHoras: array_sum(array_column($extracted, 'horasTotales')),
            duracionTotalEcts: null,
            ccaa: null, // Nacional
            normativa: 'Real Decreto 217/2022, de 29 de marzo, por el que se establece la ordenación y las enseñanzas mínimas de la Educación Secundaria Obligatoria.',
            boletinUrl: self::RD_217_2022_URL,
            vigenteDesde: new \DateTimeImmutable('2022-03-29'),
            vigenteHasta: null,
            materias: $materiasDto,
            fuenteHash: $hash,
            curriculoUrl: null,
        );
    }

    public function fetchCentros(): iterable
    {
        // ESO no provee centros desde esta fuente.
        return [];
    }

    /**
     * Sintetiza un código estable a partir del nombre + curso. ESO no tiene
     * códigos oficiales por asignatura — los inventamos para que el sistema
     * mantenga la convención de codigoOficial único por materia.
     *
     * Ejemplos:
     *   "Lengua Castellana y Literatura" + null → "ESO-LCL-13"
     *   "Lengua Castellana y Literatura" + 4    → "ESO-LCL-4"
     *   "Biología y Geología" + null            → "ESO-BIOL-13"
     */
    private function buildCodigo(string $nombre, ?int $curso): string
    {
        $sufijo = $curso === null ? '13' : (string) $curso;
        $abrev = $this->abreviar($nombre);
        return sprintf('ESO-%s-%s', $abrev, $sufijo);
    }

    private function abreviar(string $nombre): string
    {
        // Mapas conocidos para nombres canónicos del Anexo IV.
        $map = [
            'Biología y Geología' => 'BIOL',
            'Educación Física' => 'EF',
            'Educación Plástica, Visual y Audiovisual' => 'EPVA',
            'Física y Química' => 'FQ',
            'Geografía e Historia' => 'GH',
            'Lengua Castellana y Literatura' => 'LCL',
            'Lengua Extranjera' => 'LE',
            'Segunda Lengua Extranjera' => 'LE2',
            'Matemáticas' => 'MAT',
            'Matemáticas A y B' => 'MAT',
            'Música' => 'MUS',
            'Tecnología y Digitalización' => 'TEC',
            'Tecnología' => 'TEC',
            'Religión' => 'REL',
            'Educación en Valores Cívicos y Éticos' => 'EVCE',
            'Digitalización' => 'DIG',
            'Economía y Emprendimiento' => 'ECO',
            'Expresión Artística' => 'EXAR',
            'Formación y Orientación Personal y Profesional' => 'FOPP',
            'Latín' => 'LAT',
        ];
        if (isset($map[$nombre])) {
            return $map[$nombre];
        }

        // Fallback: iniciales de palabras significativas.
        $words = preg_split('/\s+/', $nombre);
        $iniciales = '';
        foreach ($words as $w) {
            $w = preg_replace('/[^A-Za-zÁÉÍÓÚÑáéíóúñ]/', '', $w);
            if (mb_strlen($w) > 2) {
                $iniciales .= mb_strtoupper(mb_substr($w, 0, 1), 'UTF-8');
            }
        }
        return $iniciales !== '' ? $iniciales : 'X';
    }
}
