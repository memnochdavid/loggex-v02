<?php

namespace App\Catalogo\BoeRd;

use App\Entity\Catalogo\CatalogoItinerario;
use App\Entity\Catalogo\CatalogoMateria;
use App\Entity\Catalogo\EtapaEducativa;
use Doctrine\ORM\EntityManagerInterface;
use Psr\Log\LoggerInterface;

/**
 * Enriquece `CatalogoItinerario` ya creados (típicamente por TodoFpHttpAdapter)
 * con datos extraídos del XML del BOE: módulos completos con horas, fecha de
 * vigencia, número del RD, denominación canónica, duración total.
 *
 * No implementa `CatalogoSourceAdapterInterface` porque NO produce itinerarios
 * nuevos: actualiza existentes. Es invocado por `EnrichFromBoeCommand`.
 *
 * Estrategia de selección de la URL:
 *  - Si el itinerario tiene `curriculoUrl` (caso Medio/Superior/Especialización),
 *    se usa esa: el currículo (Orden EDU) tiene la tabla con horas.
 *  - Si no (caso FP Básica), se usa `boletinUrl`: el RD del título cubre todo.
 *
 * Idempotencia: la entidad guarda `fuenteHash` calculado sobre los datos
 * extraídos del BOE; segundas pasadas detectan "sin cambios" y no hacen UPDATE.
 *
 * Seguridad de datos: si un parser no encuentra módulos (p. ej. tabla con
 * estructura inesperada), el itinerario queda intacto — no se borran las
 * materias existentes. Solo se sobrescriben si la nueva extracción NO está vacía.
 */
final class BoeRdEnricher
{
    public int $itinerariosProcesados = 0;
    public int $itinerariosEnriquecidos = 0;
    public int $itinerariosSinCambios = 0;
    public int $itinerariosFallidos = 0;
    public int $modulosCreados = 0;

    public function __construct(
        private readonly EntityManagerInterface $em,
        private readonly BoeXmlFetcher $fetcher,
        private readonly IdentificacionParser $identificacionParser,
        private readonly ModulosTableParser $modulosParser,
        private readonly BasicaParser $basicaParser,
        private readonly EspecializacionParser $especializacionParser,
        private readonly ParrafosModulosParser $parrafosParser,
        private readonly LegacyLogseModulosParser $logseParser,
        private readonly LoggerInterface $logger,
        private bool $dryRun = false,
    ) {}

    public function setDryRun(bool $dryRun): void
    {
        $this->dryRun = $dryRun;
    }

    /**
     * @param iterable<CatalogoItinerario> $itinerarios
     */
    public function enrich(iterable $itinerarios): void
    {
        foreach ($itinerarios as $itinerario) {
            $this->itinerariosProcesados++;
            try {
                $this->enrichOne($itinerario);
            } catch (\Throwable $e) {
                $this->itinerariosFallidos++;
                $this->logger->warning('[BoeRd] Itinerario fallido, se omite', [
                    'codigoOficial' => $itinerario->getCodigoOficial(),
                    'nombre' => $itinerario->getNombre(),
                    'boletinUrl' => $itinerario->getBoletinUrl(),
                    'curriculoUrl' => $itinerario->getCurriculoUrl(),
                    'error' => $e->getMessage(),
                ]);
            }
        }
    }

    private function enrichOne(CatalogoItinerario $itinerario): void
    {
        $etapa = $itinerario->getEtapa();

        // Dispatch por etapa: cada una tiene una estructura BOE distinta.
        //  - FP Básica: RD multi-título → BasicaParser localiza el anexo.
        //  - Especialización: RD por curso, módulos en secciones → EspecializacionParser.
        //  - Resto (Grado Medio/Superior): currículo (Orden EDU) con tabla → IdentificacionParser + ModulosTableParser.
        match ($etapa) {
            EtapaEducativa::FP_BASICA => $this->enrichBasica($itinerario),
            EtapaEducativa::FP_ESPECIALIZACION => $this->enrichEspecializacion($itinerario),
            default => $this->enrichTabla($itinerario),
        };
    }

    /**
     * Pipeline para Grado Medio/Superior (y otros con currículo + tabla).
     * Es la lógica original previa al dispatcher.
     */
    private function enrichTabla(CatalogoItinerario $itinerario): void
    {
        $sourceUrl = $itinerario->getCurriculoUrl() ?: $itinerario->getBoletinUrl();
        if ($sourceUrl === null) {
            $this->logger->debug('[BoeRd] Itinerario sin URL de BOE; nada que hacer', [
                'codigoOficial' => $itinerario->getCodigoOficial(),
            ]);
            return;
        }

        $identUrl = $itinerario->getBoletinUrl();
        $identData = null;
        $xmlIdent = null;
        if ($identUrl !== null) {
            try {
                $xmlIdent = $this->fetcher->fetchXml($identUrl);
                $identData = $this->identificacionParser->parse($xmlIdent);
            } catch (\Throwable $e) {
                $this->logger->info('[BoeRd] No se pudo leer la identificación del RD; se sigue con módulos', [
                    'codigo' => $itinerario->getCodigoOficial(),
                    'url' => $identUrl,
                    'error' => $e->getMessage(),
                ]);
            }
        }

        $xmlModulos = $sourceUrl === $identUrl ? ($xmlIdent ?? $this->fetcher->fetchXml($sourceUrl)) : $this->fetcher->fetchXml($sourceUrl);
        $modulosExtraidos = $this->modulosParser->parse($xmlModulos);
        $parserUsado = 'tabla';

        // Fallback en cascada: cuando la tabla no encaja, probamos parsers de párrafos.
        //  · ParrafosModulosParser  → LOMLOE 2019+ (Módulo Profesional / Código / Duración).
        //  · LegacyLogseModulosParser → LOGSE 1995-2005 (Módulo profesional N: ... CONTENIDOS (duración N horas)).
        // Sobre cada XML candidato (RD del título y URL de currículo, si difieren).
        if (empty($modulosExtraidos)) {
            $candidatosXml = [];
            if ($xmlIdent !== null) {
                $candidatosXml[] = $xmlIdent;
            }
            if ($xmlModulos !== ($xmlIdent ?? null)) {
                $candidatosXml[] = $xmlModulos;
            }
            foreach ([
                ['parrafos', fn(string $x) => $this->parrafosParser->parse($x)],
                ['logse', fn(string $x) => $this->logseParser->parse($x)],
            ] as [$tag, $parser]) {
                foreach ($candidatosXml as $xml) {
                    $extraidos = $parser($xml);
                    if (!empty($extraidos)) {
                        $modulosExtraidos = $extraidos;
                        $parserUsado = $tag;
                        break 2;
                    }
                }
            }
        }

        $hashable = [
            'identificacion' => $identData,
            'modulos' => $modulosExtraidos,
            'sourceUrl' => $sourceUrl,
            'enricherVersion' => 'boe_rd_v1_' . $parserUsado,
        ];
        $this->applyChanges($itinerario, $hashable, $identData, $modulosExtraidos);
    }

    /**
     * Pipeline para FP Básica: el `boletinUrl` apunta al RD multi-título;
     * el `BasicaParser` localiza el anexo correspondiente al `nombre` del
     * itinerario y extrae identificación + módulos del anexo.
     */
    private function enrichBasica(CatalogoItinerario $itinerario): void
    {
        $url = $itinerario->getBoletinUrl();
        if ($url === null) {
            return;
        }
        $xml = $this->fetcher->fetchXml($url);
        $resultado = $this->basicaParser->parse($xml, $itinerario->getNombre() ?? '');

        $identData = null;
        if ($resultado['identificacion'] !== null) {
            $identData = [
                'fechaDisposicion' => null,
                'duracionTotalHoras' => $resultado['identificacion']['duracionTotalHoras'],
                'normativa' => $resultado['identificacion']['denominacion'] !== null
                    ? sprintf('Título Profesional Básico en %s', $resultado['identificacion']['denominacion'])
                    : null,
            ];
        }
        $hashable = [
            'identificacion' => $resultado['identificacion'],
            'modulos' => $resultado['modulos'],
            'sourceUrl' => $url,
            'enricherVersion' => 'boe_rd_v1_basica',
        ];
        $this->applyChanges($itinerario, $hashable, $identData, $resultado['modulos']);
    }

    /**
     * Pipeline para Cursos de Especialización: el RD entero corresponde al
     * curso; se parsea entero con `EspecializacionParser`.
     */
    private function enrichEspecializacion(CatalogoItinerario $itinerario): void
    {
        $url = $itinerario->getBoletinUrl();
        if ($url === null) {
            return;
        }
        $xml = $this->fetcher->fetchXml($url);
        $resultado = $this->especializacionParser->parse($xml);

        $identData = null;
        if ($resultado['identificacion'] !== null) {
            $identData = [
                'fechaDisposicion' => null,
                'duracionTotalHoras' => $resultado['identificacion']['duracionTotalHoras'],
                'normativa' => $resultado['identificacion']['denominacion'] !== null
                    ? sprintf('Curso de Especialización: %s', $resultado['identificacion']['denominacion'])
                    : null,
                'creditosEctsTotales' => $resultado['identificacion']['creditosEctsTotales'] ?? null,
            ];
        }
        $hashable = [
            'identificacion' => $resultado['identificacion'],
            'modulos' => $resultado['modulos'],
            'sourceUrl' => $url,
            'enricherVersion' => 'boe_rd_v1_especializacion',
        ];
        $this->applyChanges($itinerario, $hashable, $identData, $resultado['modulos']);
    }

    /**
     * Aplica los cambios al itinerario (hash, identificación, módulos).
     * Centraliza el flujo común a los tres pipelines.
     *
     * @param array $hashable estructura serializable usada para hash de idempotencia.
     * @param ?array{fechaDisposicion?: ?\DateTimeImmutable, duracionTotalHoras?: ?int, normativa?: ?string, creditosEctsTotales?: ?int} $identData
     * @param list<array> $modulosExtraidos
     */
    private function applyChanges(
        CatalogoItinerario $itinerario,
        array $hashable,
        ?array $identData,
        array $modulosExtraidos,
    ): void {
        $newHash = hash('sha256', json_encode($hashable, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES));

        if ($itinerario->getFuenteHash() === $newHash) {
            $this->itinerariosSinCambios++;
            return;
        }

        if ($this->dryRun) {
            $this->itinerariosEnriquecidos++;
            $this->logger->info('[BoeRd] (dry-run) Cambiaría', [
                'codigo' => $itinerario->getCodigoOficial(),
                'modulosNuevos' => count($modulosExtraidos),
            ]);
            return;
        }

        if ($identData !== null) {
            if (!empty($identData['fechaDisposicion'])) {
                $itinerario->setVigenteDesde($identData['fechaDisposicion']);
            }
            if (!empty($identData['duracionTotalHoras'])) {
                $itinerario->setDuracionTotalHoras($identData['duracionTotalHoras']);
            }
            if (!empty($identData['normativa'])) {
                $itinerario->setNormativa($identData['normativa']);
            }
            if (!empty($identData['creditosEctsTotales'])) {
                $itinerario->setDuracionTotalEcts($identData['creditosEctsTotales']);
            }
        }

        if (!empty($modulosExtraidos)) {
            $itinerario->getMaterias()->clear();
            foreach ($modulosExtraidos as $mod) {
                $materia = (new CatalogoMateria())
                    ->setCodigoOficial($mod['codigoOficial'])
                    ->setNombre($mod['nombre'])
                    ->setTipo($mod['tipo'])
                    ->setCurso($mod['curso'] ?? null)
                    ->setHorasTotales($mod['horasTotales'])
                    ->setHorasSemanales(!empty($mod['horasSemanales']) ? (string) $mod['horasSemanales'] : null)
                    ->setEcts($mod['ects'] ?? null)
                    ->setOrden($mod['orden']);
                $itinerario->addMateria($materia);
                $this->modulosCreados++;
            }
        } else {
            $this->logger->info('[BoeRd] Sin módulos extraídos; conservando estado actual', [
                'codigo' => $itinerario->getCodigoOficial(),
            ]);
        }

        $itinerario->setFuenteHash($newHash);
        $itinerario->setIngestadoAt(new \DateTimeImmutable());

        $this->itinerariosEnriquecidos++;
    }

    public function flush(): void
    {
        if (!$this->dryRun) {
            $this->em->flush();
        }
    }

    public function summary(): array
    {
        return [
            'dryRun' => $this->dryRun,
            'itinerariosProcesados' => $this->itinerariosProcesados,
            'itinerariosEnriquecidos' => $this->itinerariosEnriquecidos,
            'itinerariosSinCambios' => $this->itinerariosSinCambios,
            'itinerariosFallidos' => $this->itinerariosFallidos,
            'modulosCreados' => $this->modulosCreados,
        ];
    }
}
