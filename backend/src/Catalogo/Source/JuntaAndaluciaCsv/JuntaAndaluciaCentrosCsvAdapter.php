<?php

namespace App\Catalogo\Source\JuntaAndaluciaCsv;

use App\Catalogo\Dto\CatalogoCentroDto;
use App\Catalogo\Dto\CatalogoItinerarioDto;
use App\Catalogo\Source\CatalogoSourceAdapterInterface;
use App\Entity\Catalogo\EtapaEducativa;
use App\Entity\Catalogo\Titularidad;
use Psr\Log\LoggerInterface;
use Symfony\Component\DependencyInjection\Attribute\Autowire;

/**
 * Adapter que ingesta el "Directorio de centros docentes no universitarios
 * de Andalucía" desde el CSV oficial publicado por la Consejería de
 * Desarrollo Educativo y FP (datos abiertos de la Junta).
 *
 * Fuente:    https://www.juntadeandalucia.es/datosabiertos/portal/dataset/directorio-de-centros-docentes-de-andalucia
 * Licencia:  CC BY 4.0 (atribución requerida).
 * Cobertura: ~7100 centros andaluces (todas las titularidades y etapas).
 *
 * El CSV está bundled en `backend/data/catalogo/da_centros.csv` para que la
 * demo no dependa de internet. Para refrescar a un curso posterior, descargar
 * el nuevo CSV de la URL anterior y reemplazar el archivo (mismo nombre y
 * separador ';').
 *
 * Solo provee centros — `fetchItinerarios()` devuelve vacío. La oferta
 * formativa por centro queda reflejada en `etapasOfrecidas` agregando las
 * columnas binarias del CSV (pub_pri, pub_eso, pub_bach_*, pub_cfgbas,
 * pub_cfpgm_*, pub_cfpgs_*, pub_ce_g*) sobre `EtapaEducativa`.
 */
final class JuntaAndaluciaCentrosCsvAdapter implements CatalogoSourceAdapterInterface
{
    private const CCAA = 'AND';
    private const SOURCE = 'junta_andalucia_csv';
    private const CSV_RELATIVE = 'data/catalogo/da_centros.csv';

    /**
     * Mapa columna CSV → EtapaEducativa. Una etapa se marca presente si
     * cualquiera de sus columnas (pública, privada concertada, privada no
     * concertada, adultos, semipresencial…) tiene "S".
     */
    private const ETAPA_COLUMNS = [
        EtapaEducativa::PRIMARIA->value => [
            'pub_pri', 'priv_c_pri', 'priv_noc_pri',
        ],
        EtapaEducativa::ESO->value => [
            'pub_eso', 'priv_c_eso', 'priv_noc_eso',
        ],
        EtapaEducativa::BACHILLERATO->value => [
            'pub_bach_ord', 'priv_c_bach_ord', 'priv_noc_bach_ord',
            'pub_bach_adul', 'pub_bach_semi_dist',
        ],
        EtapaEducativa::FP_BASICA->value => [
            'pub_fpbasica', 'priv_c_fpbas', 'priv_noc_fpbas',
        ],
        EtapaEducativa::FP_MEDIO->value => [
            'pub_fpgm_ord', 'priv_c_fpgm_ord', 'priv_noc_fpgm_ord',
            'pub_fpgm_adul', 'pub_fpgm_semi_dist', 'priv_noc_fpgm_semi_dist',
        ],
        EtapaEducativa::FP_SUPERIOR->value => [
            'pub_fpgs_ord', 'priv_c_fpgs_ord', 'priv_noc_fpgs_ord',
            'pub_fpgs_adul', 'priv_noc_fpgs_adul',
            'pub_fpgs_semi_dist', 'priv_noc_fpgs_semi_dist',
        ],
        EtapaEducativa::FP_ESPECIALIZACION->value => [
            'pub_ce_gm', 'pri_noc_ce_gm', 'pub_ce_gs', 'pri_noc_ce_gs',
        ],
    ];

    /** Columnas que evidencian régimen "privado concertado". */
    private const COLS_CONCERTADO = [
        'priv_c_inf2', 'priv_c_pri', 'priv_c_eso', 'priv_c_bach_ord',
        'priv_c_fpbas', 'priv_c_fpgm_ord', 'priv_c_fpgs_ord', 'priv_c_ee',
    ];

    public function __construct(
        #[Autowire('%kernel.project_dir%')]
        private readonly string $projectDir,
        private readonly LoggerInterface $logger,
    ) {}

    public function source(): string
    {
        return self::SOURCE;
    }

    public function fetchItinerarios(): iterable
    {
        return [];
    }

    public function fetchCentros(): iterable
    {
        $path = $this->projectDir . '/' . self::CSV_RELATIVE;
        if (!is_readable($path)) {
            $this->logger->warning('[Catalogo] CSV de la Junta no encontrado', ['path' => $path]);
            return;
        }

        $handle = fopen($path, 'r');
        if ($handle === false) {
            throw new \RuntimeException("No se pudo abrir el CSV: {$path}");
        }

        try {
            $header = fgetcsv($handle, 0, ';', '"', '');
            if ($header === false) {
                throw new \RuntimeException("CSV vacío o corrupto: {$path}");
            }
            $colIndex = array_flip($header);

            while (($row = fgetcsv($handle, 0, ';', '"', '')) !== false) {
                if (count($row) < 2) {
                    continue;
                }
                $dto = $this->rowToDto($row, $colIndex);
                if ($dto !== null) {
                    yield $dto;
                }
            }
        } finally {
            fclose($handle);
        }
    }

    /**
     * @param array<int,string> $row
     * @param array<string,int> $colIndex
     */
    private function rowToDto(array $row, array $colIndex): ?CatalogoCentroDto
    {
        $codigo = $this->cell($row, $colIndex, 'codigo');
        if ($codigo === '') {
            return null;
        }

        $denominacion = $this->cell($row, $colIndex, 'D_DENOMINA');
        $especifica   = $this->cell($row, $colIndex, 'D_ESPECIFICA');
        $nombre       = trim($denominacion . ' ' . $especifica);
        if ($nombre === '') {
            $nombre = "Centro {$codigo}";
        }

        $direccion = $this->buildDireccion($row, $colIndex);
        $titularidad = $this->resolveTitularidad($row, $colIndex);
        $etapas = $this->resolveEtapas($row, $colIndex);

        $hashSource = implode('|', [
            $codigo, $nombre, $direccion ?? '',
            $titularidad?->value ?? '',
            implode(',', $etapas ?? []),
        ]);

        return new CatalogoCentroDto(
            codigoCentro:    $codigo,
            nombre:          $nombre,
            ccaa:            self::CCAA,
            provincia:       $this->cellOrNull($row, $colIndex, 'D_PROVINCIA'),
            municipio:       $this->cellOrNull($row, $colIndex, 'D_MUNICIPIO'),
            direccion:       $direccion,
            titularidad:     $titularidad,
            etapasOfrecidas: $etapas,
            fuenteHash:      hash('sha256', $hashSource),
        );
    }

    /**
     * @param array<int,string> $row
     * @param array<string,int> $colIndex
     */
    private function buildDireccion(array $row, array $colIndex): ?string
    {
        $domicilio = $this->cell($row, $colIndex, 'D_DOMICILIO');
        $cp        = $this->cell($row, $colIndex, 'C_POSTAL');
        $localidad = $this->cell($row, $colIndex, 'D_LOCALIDAD');

        $parts = array_filter([$domicilio, trim($cp . ' ' . $localidad)], fn($p) => $p !== '');
        $direccion = implode(', ', $parts);
        return $direccion !== '' ? $direccion : null;
    }

    /**
     * @param array<int,string> $row
     * @param array<string,int> $colIndex
     */
    private function resolveTitularidad(array $row, array $colIndex): ?Titularidad
    {
        $tipo = strtolower($this->cell($row, $colIndex, 'D_TIPO'));
        if ($tipo === 'público' || $tipo === 'publico') {
            return Titularidad::PUBLICO;
        }
        if ($tipo === 'privado') {
            foreach (self::COLS_CONCERTADO as $col) {
                if ($this->cell($row, $colIndex, $col) === 'S') {
                    return Titularidad::CONCERTADO;
                }
            }
            return Titularidad::PRIVADO;
        }
        return null;
    }

    /**
     * @param array<int,string> $row
     * @param array<string,int> $colIndex
     * @return list<string>|null
     */
    private function resolveEtapas(array $row, array $colIndex): ?array
    {
        $etapas = [];
        foreach (self::ETAPA_COLUMNS as $etapaValue => $cols) {
            foreach ($cols as $col) {
                if ($this->cell($row, $colIndex, $col) === 'S') {
                    $etapas[] = $etapaValue;
                    break;
                }
            }
        }
        return empty($etapas) ? null : $etapas;
    }

    /**
     * @param array<int,string> $row
     * @param array<string,int> $colIndex
     */
    private function cell(array $row, array $colIndex, string $col): string
    {
        if (!isset($colIndex[$col])) {
            return '';
        }
        $idx = $colIndex[$col];
        return trim($row[$idx] ?? '');
    }

    /**
     * @param array<int,string> $row
     * @param array<string,int> $colIndex
     */
    private function cellOrNull(array $row, array $colIndex, string $col): ?string
    {
        $value = $this->cell($row, $colIndex, $col);
        return $value === '' ? null : $value;
    }
}
