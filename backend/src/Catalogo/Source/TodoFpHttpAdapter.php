<?php

namespace App\Catalogo\Source;

use App\Catalogo\Dto\CatalogoItinerarioDto;
use App\Catalogo\Source\TodoFpHttp\CiclosParser;
use App\Catalogo\Source\TodoFpHttp\EtapaResolver;
use App\Catalogo\Source\TodoFpHttp\FamiliasParser;
use Psr\Log\LoggerInterface;
use Symfony\Contracts\HttpClient\HttpClientInterface;

/**
 * Adapter HTTP que scrapea TodoFP del Ministerio para producir el catálogo
 * nacional de FP. Pareja con `BoeRdAdapter` que después enriquece cada
 * itinerario con código oficial, módulos y horas leídos del RD del BOE.
 *
 * Flujo:
 *  1. Fetch del index de familias profesionales (~1 request).
 *  2. Por cada familia, fetch de su página y parseo de la tabla de ciclos
 *     (~26 requests).
 *  3. Por cada fila de la tabla, emite un CatalogoItinerarioDto con:
 *      - codigoOficial = slug de la URL de detalle (provisional, BOE lo
 *        sobrescribirá con el código real tipo IFC32).
 *      - nombre, etapa (de icono PNG), familia (de la página padre), nivel,
 *        boletinUrl (RD del BOE).
 *      - materias = [] (las completa BoeRdAdapter).
 *
 * Throttle: 1 segundo entre requests para no machacar TodoFP. Total esperado:
 * ~30-60 segundos por refresh completo.
 *
 * Resiliencia:
 *  - Cada parseo defectuoso (familia con tabla vacía, fila sin nivel reconocible)
 *    se loguea como WARN y se omite. El refresh sigue con las demás.
 *  - Si el fetch del index falla, no se pueden listar familias y el adapter
 *    aborta con excepción (sin index no hay scraping posible).
 */
final class TodoFpHttpAdapter implements CatalogoSourceAdapterInterface
{
    private const DEFAULT_BASE_URL = 'https://www.todofp.es';
    private const FAMILIAS_INDEX_PATH = '/que-estudiar/familias-profesionales.html';

    /** Throttle entre requests, en microsegundos (1 segundo). */
    private const THROTTLE_USEC = 1_000_000;

    public function __construct(
        private readonly HttpClientInterface $httpClient,
        private readonly LoggerInterface $logger,
        private readonly FamiliasParser $familiasParser,
        private readonly CiclosParser $ciclosParser,
        private readonly string $baseUrl = self::DEFAULT_BASE_URL,
    ) {}

    public function source(): string
    {
        return 'todofp_http';
    }

    public function fetchItinerarios(): iterable
    {
        $indexUrl = rtrim($this->baseUrl, '/') . self::FAMILIAS_INDEX_PATH;
        $indexHtml = $this->fetch($indexUrl);
        $familias = $this->familiasParser->parse($indexHtml, $this->baseUrl);

        if (empty($familias)) {
            throw new \RuntimeException('TodoFpHttpAdapter: el index no devolvió familias. Posible cambio de HTML; revisar SELECTORS.md.');
        }

        $this->logger->info('[TodoFpHttp] Familias detectadas', ['count' => count($familias)]);

        foreach ($familias as $familia) {
            $this->throttle();
            try {
                yield from $this->fetchCiclosFromFamilia($familia);
            } catch (\Throwable $e) {
                // No detenemos el adapter completo si UNA familia falla.
                $this->logger->warning('[TodoFpHttp] Error procesando familia, se omite', [
                    'familia' => $familia['name'] ?? '?',
                    'url' => $familia['url'] ?? '?',
                    'error' => $e->getMessage(),
                ]);
            }
        }
    }

    public function fetchCentros(): iterable
    {
        // TodoFP no provee centros — eso lo hará JuntaAndaluciaCentrosAdapter (Fase 2).
        return [];
    }

    /**
     * @return iterable<CatalogoItinerarioDto>
     */
    private function fetchCiclosFromFamilia(array $familia): iterable
    {
        $html = $this->fetch($familia['url']);
        $rows = $this->ciclosParser->parse($html, $this->baseUrl);

        if (empty($rows)) {
            $this->logger->warning('[TodoFpHttp] Familia sin ciclos parseados (¿cambio de HTML?)', [
                'familia' => $familia['name'],
                'url' => $familia['url'],
            ]);
            return;
        }

        foreach ($rows as $row) {
            $etapa = EtapaResolver::fromIconSrc($row['nivelIconSrc'] ?? null);
            if ($etapa === null) {
                $this->logger->warning('[TodoFpHttp] Icono de nivel no reconocido, fila omitida', [
                    'familia' => $familia['name'],
                    'nombre' => $row['nombre'] ?? '?',
                    'iconSrc' => $row['nivelIconSrc'] ?? null,
                ]);
                continue;
            }

            yield $this->buildDto($row, $familia, $etapa);
        }
    }

    private function buildDto(array $row, array $familia, \BackedEnum $etapa): CatalogoItinerarioDto
    {
        // codigoOficial provisional desde el slug de la URL de detalle. Si no
        // hay URL de detalle, lo derivamos del nombre como fallback. BoeRdAdapter
        // sobrescribirá esto con el código real (IFC32, etc.) cuando procese el RD.
        $codigoOficial = $this->slugFromUrl($row['detalleUrl'] ?? null)
            ?? $this->slugify($row['nombre']);

        // nivel legible: la EtapaEducativa expone una etiqueta humana.
        $nivelTexto = method_exists($etapa, 'label') ? $etapa->label() : (string) $etapa->value;

        // Hash determinista del payload extraído. Cualquier cambio en TodoFP
        // dispara una actualización en la siguiente ingesta.
        $hashable = [
            'codigoOficial' => $codigoOficial,
            'nombre' => $row['nombre'],
            'etapa' => $etapa->value,
            'familia' => $familia['name'],
            'nivel' => $nivelTexto,
            'boletinUrl' => $row['boletinRdUrl'] ?? null,
            'curriculoUrl' => $row['curriculoUrl'] ?? null,
            'fuenteVersion' => 'todofp_http_v1.1',  // Bump para forzar refresh tras añadir curriculoUrl.
        ];
        $hash = hash('sha256', json_encode($hashable, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES));

        return new CatalogoItinerarioDto(
            codigoOficial: $codigoOficial,
            etapa: $etapa,
            nombre: $row['nombre'],
            familia: $familia['name'],
            nivel: $nivelTexto,
            duracionTotalHoras: null,    // No expuesto en la tabla; lo añadirá BoeRdAdapter.
            duracionTotalEcts: null,
            ccaa: null,                  // Catálogo nacional.
            normativa: null,             // Texto legible del RD; BoeRdAdapter lo completa.
            boletinUrl: $row['boletinRdUrl'] ?? null,
            vigenteDesde: null,          // BoeRdAdapter extrae la fecha del RD.
            vigenteHasta: null,
            materias: [],                // BoeRdAdapter completará.
            fuenteHash: $hash,
            curriculoUrl: $row['curriculoUrl'] ?? null,  // Para que BoeRdAdapter sepa de dónde sacar las horas.
        );
    }

    private function fetch(string $url): string
    {
        $this->logger->debug('[TodoFpHttp] GET ' . $url);
        $response = $this->httpClient->request('GET', $url, [
            'headers' => [
                // Identificarnos como bot honesto. TodoFP no exige API key.
                'User-Agent' => 'Loggex-Catalogo/1.0 (catálogo educativo; contacto: admin@loggex.local)',
                'Accept' => 'text/html',
            ],
            'timeout' => 15,
        ]);

        $status = $response->getStatusCode();
        if ($status !== 200) {
            throw new \RuntimeException("TodoFpHttpAdapter: HTTP $status al fetchear $url");
        }

        return $response->getContent();
    }

    private function throttle(): void
    {
        usleep(self::THROTTLE_USEC);
    }

    private function slugFromUrl(?string $url): ?string
    {
        if ($url === null || $url === '') {
            return null;
        }
        $path = parse_url($url, PHP_URL_PATH) ?: '';
        $base = basename($path, '.html');
        return $base !== '' ? $base : null;
    }

    private function slugify(string $text): string
    {
        $text = mb_strtolower($text, 'UTF-8');
        $text = strtr($text, [
            'á' => 'a', 'é' => 'e', 'í' => 'i', 'ó' => 'o', 'ú' => 'u', 'ñ' => 'n',
        ]);
        $text = preg_replace('/[^a-z0-9]+/', '-', $text);
        return trim($text, '-');
    }
}
