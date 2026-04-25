<?php

namespace App\Catalogo;

use App\Catalogo\Dto\CatalogoCentroDto;
use App\Catalogo\Dto\CatalogoItinerarioDto;
use App\Catalogo\Dto\CatalogoMateriaDto;
use App\Entity\Catalogo\CatalogoCentro;
use App\Entity\Catalogo\CatalogoItinerario;
use App\Entity\Catalogo\CatalogoMateria;
use Doctrine\ORM\EntityManagerInterface;
use Psr\Log\LoggerInterface;

/**
 * Servicio que recibe DTOs de un adapter de fuente y los persiste en BD
 * de forma idempotente.
 *
 * Reglas:
 *  - Identidad por (codigoOficial, ccaa, fuenteIngesta) para itinerarios y
 *    por (codigoCentro) para centros.
 *  - UPSERT por hash: si la entidad existe y `fuenteHash` coincide, no-op.
 *    Si difiere, actualizar y registrar en el log.
 *  - Tras una ingesta completa, los items que no aparecieron en esta tanda
 *    se marcan como `vigenteHasta = hoy` (solo itinerarios) o se conservan
 *    intactos (centros — no nos atrevemos a "retirar" un centro automáticamente).
 *  - Modo dry-run: cuenta lo que haría sin tocar la BD.
 *
 * El servicio NO llama a flush() implícitamente al UPSERTear cada DTO —
 * lo agrupa para hacer un único flush al final, vía `flush()`.
 */
final class CatalogoIngestService
{
    /**
     * Stats acumuladas durante una sesión de ingesta. Se devuelven al caller
     * para reportar (p. ej. al comando refresh).
     */
    public int $itinerariosNuevos = 0;
    public int $itinerariosActualizados = 0;
    public int $itinerariosSinCambios = 0;
    public int $itinerariosRetirados = 0;
    public int $centrosNuevos = 0;
    public int $centrosActualizados = 0;
    public int $centrosSinCambios = 0;

    /** Códigos vistos en la sesión actual, para detectar retirados al final. */
    private array $itinerariosVistosPorFuente = []; // [fuente => [codigo+ccaa+desde => true]]

    public function __construct(
        private readonly EntityManagerInterface $em,
        private readonly LoggerInterface $logger,
        private bool $dryRun = false,
    ) {}

    public function setDryRun(bool $dryRun): void
    {
        $this->dryRun = $dryRun;
    }

    /**
     * Procesa un DTO de itinerario: insert/update según hash.
     */
    public function upsertItinerario(CatalogoItinerarioDto $dto, string $fuente): void
    {
        $repo = $this->em->getRepository(CatalogoItinerario::class);

        // Identidad de un itinerario:
        //  1) Si el DTO trae `boletinUrl` (RD del BOE), es la clave más estable
        //     entre ingestas — el código oficial o el slug pueden cambiar entre
        //     refreshes (TodoFpHttpAdapter usa slug provisional; BoeRdAdapter
        //     lo sobrescribe con el código real tipo IFC32).
        //  2) Si no hay boletinUrl, fallback a (codigoOficial, ccaa, vigenteDesde).
        $existing = null;
        if ($dto->boletinUrl) {
            $existing = $repo->findOneBy([
                'boletinUrl' => $dto->boletinUrl,
                'fuenteIngesta' => $fuente,
            ]);
        }
        if (!$existing) {
            $existing = $repo->findOneBy([
                'codigoOficial' => $dto->codigoOficial,
                'ccaa' => $dto->ccaa,
                'vigenteDesde' => $dto->vigenteDesde,
                'fuenteIngesta' => $fuente,
            ]);
        }

        $clave = $dto->codigoOficial . '|' . ($dto->ccaa ?? '') . '|' . ($dto->vigenteDesde?->format('Y-m-d') ?? '');
        $this->itinerariosVistosPorFuente[$fuente][$clave] = true;

        if ($existing === null) {
            $this->itinerariosNuevos++;
            if (!$this->dryRun) {
                $entity = $this->buildItinerarioEntity($dto, $fuente);
                $this->em->persist($entity);
            }
            $this->logger->info('[Catalogo] Itinerario nuevo', [
                'codigo' => $dto->codigoOficial, 'ccaa' => $dto->ccaa, 'fuente' => $fuente,
            ]);
            return;
        }

        if ($existing->getFuenteHash() === $dto->fuenteHash) {
            $this->itinerariosSinCambios++;
            return;
        }

        $this->itinerariosActualizados++;
        $this->logger->info('[Catalogo] Itinerario actualizado (hash cambió)', [
            'codigo' => $dto->codigoOficial, 'ccaa' => $dto->ccaa, 'fuente' => $fuente,
            'hashAnterior' => $existing->getFuenteHash(), 'hashNuevo' => $dto->fuenteHash,
        ]);

        if (!$this->dryRun) {
            $this->updateItinerarioEntity($existing, $dto);
            // Las materias se reemplazan por completo al ser actualización: la
            // fuente es la verdad. La cascada orphanRemoval limpia las viejas.
            $existing->getMaterias()->clear();
            foreach ($dto->materias as $matDto) {
                $existing->addMateria($this->buildMateriaEntity($matDto));
            }
        }
    }

    /**
     * Procesa un DTO de centro: insert/update según hash.
     */
    public function upsertCentro(CatalogoCentroDto $dto, string $fuente): void
    {
        $repo = $this->em->getRepository(CatalogoCentro::class);
        $existing = $repo->findOneBy(['codigoCentro' => $dto->codigoCentro]);

        if ($existing === null) {
            $this->centrosNuevos++;
            if (!$this->dryRun) {
                $entity = (new CatalogoCentro())
                    ->setCodigoCentro($dto->codigoCentro)
                    ->setNombre($dto->nombre)
                    ->setCcaa($dto->ccaa)
                    ->setProvincia($dto->provincia)
                    ->setMunicipio($dto->municipio)
                    ->setDireccion($dto->direccion)
                    ->setTitularidad($dto->titularidad)
                    ->setEtapasOfrecidas($dto->etapasOfrecidas)
                    ->setFuenteIngesta($fuente)
                    ->setFuenteHash($dto->fuenteHash)
                    ->setIngestadoAt(new \DateTimeImmutable());
                $this->em->persist($entity);
            }
            return;
        }

        if ($existing->getFuenteHash() === $dto->fuenteHash) {
            $this->centrosSinCambios++;
            return;
        }

        $this->centrosActualizados++;
        if (!$this->dryRun) {
            $existing
                ->setNombre($dto->nombre)
                ->setCcaa($dto->ccaa)
                ->setProvincia($dto->provincia)
                ->setMunicipio($dto->municipio)
                ->setDireccion($dto->direccion)
                ->setTitularidad($dto->titularidad)
                ->setEtapasOfrecidas($dto->etapasOfrecidas)
                ->setFuenteIngesta($fuente)
                ->setFuenteHash($dto->fuenteHash)
                ->setIngestadoAt(new \DateTimeImmutable());
        }
    }

    /**
     * Tras una ingesta completa de UNA fuente, marca como retirados los
     * itinerarios que existían pero ya no aparecen. Solo afecta a registros
     * de esa fuente y que aún no tenían `vigenteHasta`.
     */
    public function marcarRetiradosNoVistos(string $fuente): void
    {
        $repo = $this->em->getRepository(CatalogoItinerario::class);
        $existentes = $repo->findBy(['fuenteIngesta' => $fuente, 'vigenteHasta' => null]);

        $vistos = $this->itinerariosVistosPorFuente[$fuente] ?? [];
        $hoy = new \DateTimeImmutable('today');

        foreach ($existentes as $entity) {
            $clave = $entity->getCodigoOficial() . '|' . ($entity->getCcaa() ?? '') . '|' . ($entity->getVigenteDesde()?->format('Y-m-d') ?? '');
            if (!isset($vistos[$clave])) {
                $this->itinerariosRetirados++;
                if (!$this->dryRun) {
                    $entity->setVigenteHasta($hoy);
                }
                $this->logger->info('[Catalogo] Itinerario marcado como retirado (no apareció en la fuente)', [
                    'codigo' => $entity->getCodigoOficial(),
                    'ccaa' => $entity->getCcaa(),
                    'fuente' => $fuente,
                ]);
            }
        }
    }

    public function flush(): void
    {
        if (!$this->dryRun) {
            $this->em->flush();
        }
    }

    /**
     * Devuelve un resumen serializable de la sesión actual.
     */
    public function summary(): array
    {
        return [
            'dryRun' => $this->dryRun,
            'itinerarios' => [
                'nuevos' => $this->itinerariosNuevos,
                'actualizados' => $this->itinerariosActualizados,
                'sinCambios' => $this->itinerariosSinCambios,
                'retirados' => $this->itinerariosRetirados,
            ],
            'centros' => [
                'nuevos' => $this->centrosNuevos,
                'actualizados' => $this->centrosActualizados,
                'sinCambios' => $this->centrosSinCambios,
            ],
        ];
    }

    // ----- helpers -----

    private function buildItinerarioEntity(CatalogoItinerarioDto $dto, string $fuente): CatalogoItinerario
    {
        $entity = new CatalogoItinerario();
        $this->updateItinerarioEntity($entity, $dto);
        $entity->setFuenteIngesta($fuente);
        foreach ($dto->materias as $matDto) {
            $entity->addMateria($this->buildMateriaEntity($matDto));
        }
        return $entity;
    }

    private function updateItinerarioEntity(CatalogoItinerario $entity, CatalogoItinerarioDto $dto): void
    {
        $entity
            ->setEtapa($dto->etapa)
            ->setCodigoOficial($dto->codigoOficial)
            ->setNombre($dto->nombre)
            ->setFamilia($dto->familia)
            ->setNivel($dto->nivel)
            ->setDuracionTotalHoras($dto->duracionTotalHoras)
            ->setDuracionTotalEcts($dto->duracionTotalEcts)
            ->setCcaa($dto->ccaa)
            ->setNormativa($dto->normativa)
            ->setBoletinUrl($dto->boletinUrl)
            ->setVigenteDesde($dto->vigenteDesde)
            ->setVigenteHasta($dto->vigenteHasta)
            ->setFuenteHash($dto->fuenteHash)
            ->setIngestadoAt(new \DateTimeImmutable());
    }

    private function buildMateriaEntity(CatalogoMateriaDto $dto): CatalogoMateria
    {
        return (new CatalogoMateria())
            ->setCodigoOficial($dto->codigoOficial)
            ->setNombre($dto->nombre)
            ->setTipo($dto->tipo)
            ->setCurso($dto->curso)
            ->setHorasTotales($dto->horasTotales)
            ->setHorasSemanales($dto->horasSemanales !== null ? (string) $dto->horasSemanales : null)
            ->setEcts($dto->ects)
            ->setDistribucionAnual($dto->distribucionAnual)
            ->setObligatoria($dto->obligatoria)
            ->setPrerequisitos($dto->prerequisitos)
            ->setDescripcion($dto->descripcion)
            ->setCompetencias($dto->competencias)
            ->setOrden($dto->orden);
    }
}
