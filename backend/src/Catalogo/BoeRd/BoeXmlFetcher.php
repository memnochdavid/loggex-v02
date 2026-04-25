<?php

namespace App\Catalogo\BoeRd;

use Psr\Log\LoggerInterface;
use Symfony\Contracts\HttpClient\HttpClientInterface;

/**
 * Descarga XML del BOE a partir de cualquiera de los formatos de URL que
 * TodoFP nos da en BD (txt.php, ELI con/sin /con, PDF directo). Cada caso se
 * normaliza a un endpoint que devuelve `application/xml`.
 *
 * El BOE expone:
 *  - `https://www.boe.es/diario_boe/xml.php?id=BOE-A-AAAA-NNNN`  (formato moderno)
 *  - `https://www.boe.es/eli/es/rd/AAAA/MM/DD/N/dof/spa/xml`     (formato ELI)
 *
 * Throttle suave (300ms) para no machacar el BOE en bucle.
 */
final class BoeXmlFetcher
{
    private const THROTTLE_USEC = 300_000;

    public function __construct(
        private readonly HttpClientInterface $httpClient,
        private readonly LoggerInterface $logger,
    ) {}

    /**
     * Recibe una URL de BOE en cualquier formato que TodoFP haya proporcionado y
     * devuelve el contenido XML. Lanza excepción si no se puede obtener.
     */
    public function fetchXml(string $boeUrl): string
    {
        $xmlUrl = $this->normalizeToXmlUrl($boeUrl);
        if ($xmlUrl === null) {
            throw new \RuntimeException("BoeXmlFetcher: no sé construir URL XML para '$boeUrl'");
        }

        $this->logger->debug('[BoeRd] GET ' . $xmlUrl);
        usleep(self::THROTTLE_USEC);

        $response = $this->httpClient->request('GET', $xmlUrl, [
            'headers' => [
                'User-Agent' => 'Loggex-Catalogo/1.0 (catálogo educativo; admin@loggex.local)',
                'Accept' => 'application/xml',
            ],
            'timeout' => 20,
        ]);

        $status = $response->getStatusCode();
        if ($status !== 200) {
            throw new \RuntimeException("BoeXmlFetcher: HTTP $status al fetchear $xmlUrl");
        }

        return $response->getContent();
    }

    /**
     * Convierte cualquier formato de URL del BOE a la URL del XML estructurado.
     */
    public function normalizeToXmlUrl(string $boeUrl): ?string
    {
        // Defensa: TodoFP a veces deja espacios en los href guardados.
        $boeUrl = trim($boeUrl);

        // Formato 1: …/diario_boe/txt.php?id=BOE-A-AAAA-NNNN → …/diario_boe/xml.php?id=…
        if (str_contains($boeUrl, '/diario_boe/txt.php')) {
            return str_replace('/diario_boe/txt.php', '/diario_boe/xml.php', $boeUrl);
        }

        // Formato 2: …/eli/es/rd/AAAA/MM/DD/N o …/eli/es/rd/AAAA/MM/DD/N/con
        //         →  …/eli/es/rd/AAAA/MM/DD/N/dof/spa/xml
        // Delimitador `~` porque el patrón contiene `#` dentro de [^?#].
        if (preg_match('~^(https?://www\.boe\.es/eli/[^?#]+?)(/con)?(/?)$~', $boeUrl, $m)) {
            return rtrim($m[1], '/') . '/dof/spa/xml';
        }

        // Formato 3: …/boe/dias/AAAA/MM/DD/pdfs/BOE-A-AAAA-NNNN.pdf → …/diario_boe/xml.php?id=BOE-A-…
        if (preg_match('#/(BOE-A-\d{4}-\d+)\.pdf$#', $boeUrl, $m)) {
            return 'https://www.boe.es/diario_boe/xml.php?id=' . $m[1];
        }

        // Si trae el id en otro lugar, probarlo.
        if (preg_match('#id=(BOE-A-\d{4}-\d+)#', $boeUrl, $m)) {
            return 'https://www.boe.es/diario_boe/xml.php?id=' . $m[1];
        }

        return null;
    }
}
