<?php

namespace App\Command\Catalogo;

use App\Catalogo\Ccaa\CcaaCurriculumProviderInterface;
use App\Catalogo\Ccaa\CcaaProviderRegistry;
use App\Catalogo\Ccaa\Dto\ItinerarioOverrideDto;
use App\Catalogo\Ccaa\Dto\MateriaOverrideDto;
use App\Entity\Catalogo\CatalogoItinerario;
use App\Entity\Catalogo\CatalogoItinerarioCcaa;
use App\Entity\Catalogo\CatalogoMateria;
use App\Entity\Catalogo\CatalogoMateriaCcaa;
use App\Entity\Ccaa;
use Doctrine\ORM\EntityManagerInterface;
use Symfony\Component\Console\Attribute\AsCommand;
use Symfony\Component\Console\Command\Command;
use Symfony\Component\Console\Input\InputInterface;
use Symfony\Component\Console\Input\InputOption;
use Symfony\Component\Console\Output\OutputInterface;
use Symfony\Component\Console\Style\SymfonyStyle;

/**
 * Persiste overrides + autonómicas del provider CCAA registrado.
 *
 *   php bin/console app:catalogo:ccaa:seed --ccaa=AN
 *   php bin/console app:catalogo:ccaa:seed --source=boja_and_hardcoded
 *   php bin/console app:catalogo:ccaa:seed --ccaa=AN --dry-run
 *
 * Idempotente: si ya existe `CatalogoMateriaCcaa` con la misma
 * `(ccaa, catalogoItinerario, catalogoMateria, vigenteDesde)`, actualiza la
 * row si los datos del provider difieren. No detecta obsoletas (queda como
 * TODO para cuando se implemente el provider scraper real).
 */
#[AsCommand(
    name: 'app:catalogo:ccaa:seed',
    description: 'Persiste overlays de currículo por CCAA desde un provider registrado.'
)]
final class SeedCcaaCommand extends Command
{
    public function __construct(
        private readonly CcaaProviderRegistry $registry,
        private readonly EntityManagerInterface $em,
    ) {
        parent::__construct();
    }

    protected function configure(): void
    {
        $this
            ->addOption('ccaa', null, InputOption::VALUE_REQUIRED, 'Código ISO 3166-2:ES (ej. AN, CT, MD).')
            ->addOption('source', null, InputOption::VALUE_REQUIRED, 'Identificador del provider (ej. boja_and_hardcoded).')
            ->addOption('dry-run', null, InputOption::VALUE_NONE, 'No persiste, solo cuenta lo que haría.')
            ->addOption('list', 'l', InputOption::VALUE_NONE, 'Lista providers registrados y sale.');
    }

    protected function execute(InputInterface $input, OutputInterface $output): int
    {
        $io = new SymfonyStyle($input, $output);

        if ($input->getOption('list')) {
            $sources = $this->registry->listSources();
            if (empty($sources)) {
                $io->warning('No hay providers CCAA registrados.');
                return Command::SUCCESS;
            }
            $io->title('Providers CCAA disponibles');
            foreach ($this->registry->all() as $p) {
                $io->writeln(sprintf(' · %s (CCAA: %s)', $p->source(), $p->ccaa()->value));
            }
            return Command::SUCCESS;
        }

        $provider = $this->resolveProvider($input, $io);
        if ($provider === null) {
            return Command::FAILURE;
        }

        $dryRun = (bool) $input->getOption('dry-run');
        if ($dryRun) {
            $io->warning('Modo dry-run: no se persistirá nada.');
        }

        $io->section(sprintf('Procesando provider "%s" (CCAA %s)', $provider->source(), $provider->ccaa()->value));

        $stats = ['materias' => ['nuevas' => 0, 'actualizadas' => 0, 'sinCambios' => 0, 'falladas' => 0],
                  'itinerarios' => ['nuevas' => 0, 'actualizadas' => 0, 'sinCambios' => 0, 'falladas' => 0]];

        foreach ($provider->fetchOverrides() as $dto) {
            $result = $this->upsertMateriaCcaa($dto, $dryRun, $io);
            $stats['materias'][$result]++;
        }
        foreach ($provider->fetchItinerarioOverrides() as $dto) {
            $result = $this->upsertItinerarioCcaa($dto, $dryRun, $io);
            $stats['itinerarios'][$result]++;
        }

        if (!$dryRun) {
            $this->em->flush();
        }

        $io->section('Resumen');
        $io->definitionList(
            ['Modo' => $dryRun ? 'DRY-RUN' : 'Persistido'],
            ['Materias nuevas'         => $stats['materias']['nuevas']],
            ['Materias actualizadas'   => $stats['materias']['actualizadas']],
            ['Materias sin cambios'    => $stats['materias']['sinCambios']],
            ['Materias falladas'       => $stats['materias']['falladas']],
            ['Itinerarios nuevos'      => $stats['itinerarios']['nuevas']],
            ['Itinerarios actualizados'=> $stats['itinerarios']['actualizadas']],
            ['Itinerarios sin cambios' => $stats['itinerarios']['sinCambios']],
            ['Itinerarios fallados'    => $stats['itinerarios']['falladas']],
        );

        if ($stats['materias']['falladas'] > 0 || $stats['itinerarios']['falladas'] > 0) {
            $io->warning('Algunas filas fallaron — revisa los warnings arriba.');
        } else {
            $io->success('Seed CCAA completado.');
        }
        return Command::SUCCESS;
    }

    private function resolveProvider(InputInterface $input, SymfonyStyle $io): ?CcaaCurriculumProviderInterface
    {
        $sourceOpt = $input->getOption('source');
        $ccaaOpt = $input->getOption('ccaa');

        if ($sourceOpt) {
            $p = $this->registry->bySource($sourceOpt);
            if (!$p) {
                $io->error(sprintf('Provider "%s" no registrado. Disponibles: %s',
                    $sourceOpt, implode(', ', $this->registry->listSources())));
                return null;
            }
            return $p;
        }
        if ($ccaaOpt) {
            $ccaa = Ccaa::tryFrom($ccaaOpt);
            if (!$ccaa) {
                $io->error(sprintf('Código CCAA inválido: %s', $ccaaOpt));
                return null;
            }
            $p = $this->registry->forCcaa($ccaa);
            if (!$p) {
                $io->error(sprintf('No hay provider registrado para CCAA %s.', $ccaa->value));
                return null;
            }
            return $p;
        }
        $io->error('Especifica --ccaa o --source.');
        return null;
    }

    private function upsertMateriaCcaa(MateriaOverrideDto $dto, bool $dryRun, SymfonyStyle $io): string
    {
        $catItin = $this->em->getRepository(CatalogoItinerario::class)
            ->findOneBy(['codigoOficial' => $dto->itinerarioCodigoOficial]);
        if (!$catItin) {
            $io->warning(sprintf('CatalogoItinerario no encontrado: %s', $dto->itinerarioCodigoOficial));
            return 'falladas';
        }

        $catMat = null;
        if ($dto->materiaCodigoOficial !== null) {
            $catMat = $this->em->getRepository(CatalogoMateria::class)
                ->findOneBy([
                    'itinerario' => $catItin,
                    'codigoOficial' => $dto->materiaCodigoOficial,
                    'curso' => $dto->curso,
                ]);
            if (!$catMat) {
                $io->warning(sprintf(
                    'CatalogoMateria %s curso %d no encontrada en itinerario %s',
                    $dto->materiaCodigoOficial, $dto->curso, $dto->itinerarioCodigoOficial
                ));
                return 'falladas';
            }
        }

        $existente = $this->findExistente($dto, $catItin, $catMat);

        if ($existente) {
            if ($this->datosCoinciden($existente, $dto)) {
                return 'sinCambios';
            }
            $this->aplicarDatos($existente, $dto, $catItin, $catMat);
            return 'actualizadas';
        }

        if ($dryRun) {
            return 'nuevas';
        }

        $entity = new CatalogoMateriaCcaa();
        $this->aplicarDatos($entity, $dto, $catItin, $catMat);
        $this->em->persist($entity);
        return 'nuevas';
    }

    private function findExistente(MateriaOverrideDto $dto, CatalogoItinerario $catItin, ?CatalogoMateria $catMat): ?CatalogoMateriaCcaa
    {
        $criteria = [
            'ccaa' => $dto->ccaa->value,
            'catalogoItinerario' => $catItin,
            'catalogoMateria' => $catMat,
            'vigenteDesde' => $dto->vigenteDesde,
        ];
        // Para autonómicas puras (catMat=null) hace falta también discriminar
        // por código autonómico: dos materias autonómicas distintas no chocan.
        if ($catMat === null && $dto->codigo !== null) {
            $criteria['codigo'] = $dto->codigo;
        }
        return $this->em->getRepository(CatalogoMateriaCcaa::class)->findOneBy($criteria);
    }

    private function datosCoinciden(CatalogoMateriaCcaa $e, MateriaOverrideDto $dto): bool
    {
        return $e->getMinutosSemanales() === $dto->minutosSemanales
            && $e->getNombre() === $dto->nombre
            && $e->getCodigo() === $dto->codigo
            && $e->getTipo() === $dto->tipo
            && $e->getCurso() === $dto->curso
            && $e->getBoletinOficialRef() === $dto->boletinOficialRef
            && $e->getVigenteHasta()?->format('Y-m-d') === $dto->vigenteHasta?->format('Y-m-d');
    }

    private function aplicarDatos(CatalogoMateriaCcaa $e, MateriaOverrideDto $dto, CatalogoItinerario $catItin, ?CatalogoMateria $catMat): void
    {
        $e->setCcaa($dto->ccaa);
        $e->setCatalogoItinerario($catItin);
        $e->setCatalogoMateria($catMat);
        $e->setMinutosSemanales($dto->minutosSemanales);
        $e->setNombre($dto->nombre);
        $e->setCodigo($dto->codigo);
        $e->setCurso($dto->curso);
        $e->setTipo($dto->tipo);
        $e->setBoletinOficialRef($dto->boletinOficialRef);
        $e->setVigenteDesde($dto->vigenteDesde);
        $e->setVigenteHasta($dto->vigenteHasta);
    }

    private function upsertItinerarioCcaa(ItinerarioOverrideDto $dto, bool $dryRun, SymfonyStyle $io): string
    {
        $catItin = $this->em->getRepository(CatalogoItinerario::class)
            ->findOneBy(['codigoOficial' => $dto->itinerarioCodigoOficial]);
        if (!$catItin) {
            $io->warning(sprintf('CatalogoItinerario no encontrado: %s', $dto->itinerarioCodigoOficial));
            return 'falladas';
        }

        $existente = $this->em->getRepository(CatalogoItinerarioCcaa::class)
            ->findOneBy([
                'ccaa' => $dto->ccaa->value,
                'catalogoItinerario' => $catItin,
                'vigenteDesde' => $dto->vigenteDesde,
            ]);

        if ($existente) {
            $sinCambios = $existente->getNombre() === $dto->nombre
                && $existente->getCodigo() === $dto->codigo
                && $existente->getBoletinOficialRef() === $dto->boletinOficialRef;
            if ($sinCambios) {
                return 'sinCambios';
            }
            $existente->setNombre($dto->nombre);
            $existente->setCodigo($dto->codigo);
            $existente->setBoletinOficialRef($dto->boletinOficialRef);
            return 'actualizadas';
        }

        if ($dryRun) {
            return 'nuevas';
        }

        $entity = new CatalogoItinerarioCcaa();
        $entity->setCcaa($dto->ccaa);
        $entity->setCatalogoItinerario($catItin);
        $entity->setNombre($dto->nombre);
        $entity->setCodigo($dto->codigo);
        $entity->setBoletinOficialRef($dto->boletinOficialRef);
        $entity->setVigenteDesde($dto->vigenteDesde);
        $entity->setVigenteHasta($dto->vigenteHasta);
        $this->em->persist($entity);
        return 'nuevas';
    }
}
