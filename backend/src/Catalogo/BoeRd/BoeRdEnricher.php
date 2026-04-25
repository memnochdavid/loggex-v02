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
        // Decidir qué URL usar para extraer módulos: currículo si existe, si no el RD del título.
        $sourceUrl = $itinerario->getCurriculoUrl() ?: $itinerario->getBoletinUrl();
        if ($sourceUrl === null) {
            $this->logger->debug('[BoeRd] Itinerario sin URL de BOE; nada que hacer', [
                'codigoOficial' => $itinerario->getCodigoOficial(),
            ]);
            return;
        }

        // 1) Identificación: del RD del título (boletinUrl), no del currículo.
        // Limitación conocida v1: FP Básica y Cursos de Especialización tienen
        // estructura XML atípica donde la "Duración:" del título es ambigua
        // entre múltiples títulos del mismo RD (FP Básica) o no existe como tal
        // (Especialización). Saltamos el parser de identificación para esas
        // etapas — preferimos dejar los campos NULL antes que cargar datos
        // incorrectos. Documentado en BOE_XML_STRUCTURE.md §6.
        $skipIdentificacion = in_array(
            $itinerario->getEtapa(),
            [EtapaEducativa::FP_BASICA, EtapaEducativa::FP_ESPECIALIZACION],
            true
        );

        $identUrl = $itinerario->getBoletinUrl();
        $identData = null;
        $xmlIdent = null;
        if (!$skipIdentificacion && $identUrl !== null) {
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

        // 2) Módulos: del XML del currículo (o del RD si es FP Básica).
        $xmlModulos = $sourceUrl === $identUrl ? ($xmlIdent ?? $this->fetcher->fetchXml($sourceUrl)) : $this->fetcher->fetchXml($sourceUrl);
        $modulosExtraidos = $this->modulosParser->parse($xmlModulos);

        // Hash de los datos relevantes — para idempotencia.
        $hashable = [
            'identificacion' => $identData,
            'modulos' => $modulosExtraidos,
            'sourceUrl' => $sourceUrl,
            'enricherVersion' => 'boe_rd_v1',
        ];
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

        // Aplicar identificación si la tenemos.
        if ($identData !== null) {
            if ($identData['fechaDisposicion'] !== null) {
                $itinerario->setVigenteDesde($identData['fechaDisposicion']);
            }
            if ($identData['duracionTotalHoras'] !== null) {
                $itinerario->setDuracionTotalHoras($identData['duracionTotalHoras']);
            }
            if ($identData['normativa'] !== null) {
                $itinerario->setNormativa($identData['normativa']);
            }
        } elseif ($skipIdentificacion) {
            // Para etapas con estructura atípica (FP Básica, Especialización),
            // limpiamos los campos: ejecuciones anteriores pueden haber cargado
            // datos incorrectos que el parser actual no genera.
            $itinerario->setDuracionTotalHoras(null);
            $itinerario->setNormativa(null);
            $itinerario->setVigenteDesde(null);
        }

        // Reemplazar módulos solo si hemos extraído al menos uno.
        if (!empty($modulosExtraidos)) {
            $itinerario->getMaterias()->clear();
            foreach ($modulosExtraidos as $mod) {
                $materia = (new CatalogoMateria())
                    ->setCodigoOficial($mod['codigoOficial'])
                    ->setNombre($mod['nombre'])
                    ->setTipo($mod['tipo'])
                    ->setCurso($mod['curso'])
                    ->setHorasTotales($mod['horasTotales'])
                    ->setHorasSemanales($mod['horasSemanales'] !== null ? (string) $mod['horasSemanales'] : null)
                    ->setOrden($mod['orden']);
                $itinerario->addMateria($materia);
                $this->modulosCreados++;
            }
        } else {
            $this->logger->info('[BoeRd] Sin módulos extraídos; conservando estado actual', [
                'codigo' => $itinerario->getCodigoOficial(),
                'sourceUrl' => $sourceUrl,
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
