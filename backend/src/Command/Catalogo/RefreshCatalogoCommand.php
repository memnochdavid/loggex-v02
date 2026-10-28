<?php

namespace App\Command\Catalogo;

use App\Catalogo\CatalogoIngestService;
use App\Catalogo\Source\CatalogoSourceAdapterInterface;
use App\Catalogo\Source\CatalogoSourceAdapterRegistry;
use Symfony\Component\Console\Attribute\AsCommand;
use Symfony\Component\Console\Command\Command;
use Symfony\Component\Console\Input\InputArgument;
use Symfony\Component\Console\Input\InputInterface;
use Symfony\Component\Console\Input\InputOption;
use Symfony\Component\Console\Output\OutputInterface;
use Symfony\Component\Console\Style\SymfonyStyle;

/**
 * Refresca el catálogo oficial ejecutando uno o todos los adapters de fuente.
 *
 * Uso:
 *   php bin/console app:catalogo:refresh                  # todas las fuentes
 *   php bin/console app:catalogo:refresh todofp           # solo TodoFP
 *   php bin/console app:catalogo:refresh --dry-run        # cuenta sin tocar BD
 *   php bin/console app:catalogo:refresh --list           # lista adapters disponibles
 */
#[AsCommand(
    name: 'app:catalogo:refresh',
    description: 'Refresca el catálogo oficial desde sus fuentes (TodoFP, BOJA, RUCT, …).'
)]
final class RefreshCatalogoCommand extends Command
{
    public function __construct(
        private readonly CatalogoSourceAdapterRegistry $registry,
        private readonly CatalogoIngestService $ingest,
    ) {
        parent::__construct();
    }

    protected function configure(): void
    {
        $this
            ->addArgument(
                'fuente',
                InputArgument::OPTIONAL,
                'Identificador de la fuente a refrescar. Sin valor → todas.',
                null
            )
            ->addOption(
                'dry-run',
                null,
                InputOption::VALUE_NONE,
                'No persiste nada en BD. Solo cuenta lo que haría.'
            )
            ->addOption(
                'list',
                'l',
                InputOption::VALUE_NONE,
                'Lista los adapters registrados y sale.'
            );
    }

    protected function execute(InputInterface $input, OutputInterface $output): int
    {
        $io = new SymfonyStyle($input, $output);

        if ($input->getOption('list')) {
            $sources = $this->registry->listSources();
            if (empty($sources)) {
                $io->warning('No hay adapters de catálogo registrados todavía.');
                return Command::SUCCESS;
            }
            $io->title('Adapters de catálogo disponibles');
            $io->listing($sources);
            return Command::SUCCESS;
        }

        $dryRun = (bool) $input->getOption('dry-run');
        $this->ingest->setDryRun($dryRun);

        if ($dryRun) {
            $io->warning('Modo dry-run: no se persistirá nada en la base de datos.');
        }

        $fuente = $input->getArgument('fuente');
        $adapters = $this->resolveAdapters($fuente, $io);
        if (empty($adapters)) {
            return Command::FAILURE;
        }

        foreach ($adapters as $adapter) {
            $this->runAdapter($adapter, $io);
        }

        $this->ingest->flush();

        $summary = $this->ingest->summary();
        $io->section('Resumen de la sesión');
        $io->definitionList(
            ['Modo' => $summary['dryRun'] ? 'DRY-RUN' : 'Persistido'],
            ['Itinerarios nuevos'        => $summary['itinerarios']['nuevos']],
            ['Itinerarios actualizados'  => $summary['itinerarios']['actualizados']],
            ['Itinerarios sin cambios'   => $summary['itinerarios']['sinCambios']],
            ['Itinerarios retirados'     => $summary['itinerarios']['retirados']],
            ['Centros nuevos'            => $summary['centros']['nuevos']],
            ['Centros actualizados'      => $summary['centros']['actualizados']],
            ['Centros sin cambios'       => $summary['centros']['sinCambios']],
        );

        $io->success('Refresh completado.');
        return Command::SUCCESS;
    }

    /**
     * @return list<CatalogoSourceAdapterInterface>
     */
    private function resolveAdapters(?string $fuente, SymfonyStyle $io): array
    {
        if ($fuente === null) {
            $all = iterator_to_array($this->registry->all());
            if (empty($all)) {
                $io->warning('No hay adapters de catálogo registrados. Nada que refrescar.');
                return [];
            }
            return array_values($all);
        }

        $adapter = $this->registry->get($fuente);
        if ($adapter === null) {
            $available = $this->registry->listSources();
            $io->error(sprintf(
                'Fuente "%s" desconocida. Disponibles: %s',
                $fuente,
                empty($available) ? '(ninguna)' : implode(', ', $available)
            ));
            return [];
        }
        return [$adapter];
    }

    private function runAdapter(CatalogoSourceAdapterInterface $adapter, SymfonyStyle $io): void
    {
        $source = $adapter->source();
        $io->section(sprintf('Procesando fuente: %s', $source));

        try {
            $countItinerarios = 0;
            foreach ($adapter->fetchItinerarios() as $dto) {
                $this->ingest->upsertItinerario($dto, $source);
                $countItinerarios++;
            }
            if ($countItinerarios > 0) {
                $this->ingest->marcarRetiradosNoVistos($source);
            }

            $countCentros = 0;
            foreach ($adapter->fetchCentros() as $dto) {
                $this->ingest->upsertCentro($dto, $source);
                $countCentros++;
            }

            $io->writeln(sprintf(
                ' · %d itinerarios procesados, %d centros procesados',
                $countItinerarios,
                $countCentros
            ));
        } catch (\Throwable $e) {
            $io->error(sprintf('Adapter "%s" falló: %s', $source, $e->getMessage()));
            // Seguimos con el resto de adapters (resilencia).
        }
    }
}
